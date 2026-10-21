import fs from 'node:fs'
import path from 'node:path'
import { generateKeyBetween } from 'fractional-indexing'
import { columnByRole, isDone, loadConfig } from './config'
import { KbError } from './errors'
import { hash, parseTask, serializeTask } from './format'
import type { Config, Link, Ref, Task } from './types'
import { readTask, taskPath } from './workspace'
import { atomicWrite, withLock } from './write'

export type Op =
  | { type: 'setStatus'; status: string }
  | { type: 'setRank'; rank: string }
  | { type: 'setDue'; due: string | null }
  | { type: 'setAssignee'; assignee: string | null }
  | { type: 'setParent'; parent: string | null }
  | { type: 'setTitle'; title: string; baseHash?: string }
  | { type: 'setBody'; body: string; baseHash?: string }
  | { type: 'addLink'; link: Link }
  | { type: 'removeLink'; link: Link }
  | { type: 'addRef'; ref: Ref }
  | { type: 'removeRef'; url: string }
  | { type: 'addComment'; author: string; body: string }
  | { type: 'claim'; assignee: string }

export type CreateInput = {
  title: string
  status?: string
  parent?: string
  due?: string
  assignee?: string
  body?: string
  rank?: string
}

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

function requireExists(ws: string, id: string): string {
  const file = taskPath(ws, id)
  if (!fs.existsSync(file)) throw new KbError('not_found', `task ${id} not found`)
  return file
}

function setStatus(config: Config, task: Task, status: string, at: string): void {
  if (!config.columns.some((c) => c.key === status)) throw new KbError('usage', `unknown status "${status}"`)
  task.status = status
  task.completed = isDone(config, status) ? (task.completed ?? at) : undefined
}

function checkHash(field: string, current: string, baseHash?: string): void {
  if (baseHash !== undefined && baseHash !== hash(current)) {
    throw new KbError('conflict', `${field} changed since it was read`)
  }
}

function checkParent(ws: string, id: string, parent: string): void {
  requireExists(ws, parent)
  const seen = new Set<string>()
  for (let cur: string | undefined = parent; cur && !seen.has(cur); ) {
    if (cur === id) throw new KbError('usage', `setting parent ${parent} on ${id} would create a cycle`)
    seen.add(cur)
    try {
      cur = readTask(ws, cur).task.parent
    } catch {
      cur = undefined
    }
  }
}

function apply(ws: string, config: Config, task: Task, op: Op, at: string): void {
  switch (op.type) {
    case 'setStatus':
      return setStatus(config, task, op.status, at)
    case 'setRank':
      task.rank = op.rank
      return
    case 'setDue':
      task.due = op.due ?? undefined
      return
    case 'setAssignee':
      task.assignee = op.assignee ?? undefined
      return
    case 'setParent':
      if (op.parent) checkParent(ws, task.id, op.parent)
      task.parent = op.parent ?? undefined
      return
    case 'setTitle':
      checkHash('title', task.title, op.baseHash)
      task.title = op.title
      return
    case 'setBody':
      checkHash('body', task.body, op.baseHash)
      task.body = op.body
      return
    case 'addLink':
      if (op.link.id === task.id) throw new KbError('usage', 'a task cannot link to itself')
      if (!task.links.some((l) => l.type === op.link.type && l.id === op.link.id)) task.links.push(op.link)
      return
    case 'removeLink':
      task.links = task.links.filter((l) => !(l.type === op.link.type && l.id === op.link.id))
      return
    case 'addRef':
      if (!task.refs.some((r) => r.url === op.ref.url)) task.refs.push(op.ref)
      return
    case 'removeRef':
      task.refs = task.refs.filter((r) => r.url !== op.url)
      return
    case 'addComment':
      task.comments.push({ at, author: op.author, body: op.body })
      return
    case 'claim':
      if (task.assignee && task.assignee !== op.assignee) {
        throw new KbError('conflict', `${task.id} is already claimed by ${task.assignee}`)
      }
      task.assignee = op.assignee
      return setStatus(config, task, columnByRole(config, 'active').key, at)
  }
}

export async function applyOp(ws: string, id: string, op: Op): Promise<Task> {
  const config = loadConfig(ws)
  const file = requireExists(ws, id)
  return withLock(file, () => {
    const { task, text } = readTask(ws, id)
    const at = now()
    apply(ws, config, task, op, at)
    task.updated = at
    atomicWrite(file, serializeTask(task, text))
    return task
  })
}

function lastRank(ws: string, status: string): string | null {
  let max: string | null = null
  for (const name of fs.readdirSync(path.join(ws, 'tasks'))) {
    if (!name.endsWith('.md')) continue
    try {
      const t = parseTask(fs.readFileSync(path.join(ws, 'tasks', name), 'utf8'))
      if (t.status === status && (max === null || t.rank > max)) max = t.rank
    } catch {}
  }
  return max
}

function nextId(ws: string, prefix: string): string {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.md$`)
  let max = 0
  for (const dir of [path.join(ws, 'tasks'), path.join(ws, '.kanban', 'trash')]) {
    for (const name of fs.readdirSync(dir)) {
      const m = re.exec(name)
      if (m) max = Math.max(max, Number(m[1]))
    }
  }
  return `${prefix}-${max + 1}`
}

export async function createTask(ws: string, input: CreateInput): Promise<Task> {
  const config = loadConfig(ws)
  return withLock(path.join(ws, '.kanban', 'config.yaml'), () => {
    if (input.parent) requireExists(ws, input.parent)
    const status = input.status ?? columnByRole(config, 'ready').key
    const at = now()
    const task: Task = {
      id: nextId(ws, config.idPrefix),
      title: input.title,
      status,
      rank: '',
      parent: input.parent,
      due: input.due,
      assignee: input.assignee,
      links: [],
      refs: [],
      created: at,
      updated: at,
      body: input.body ?? '',
      comments: [],
      extra: {},
    }
    setStatus(config, task, status, at)
    task.rank = input.rank ?? generateKeyBetween(lastRank(ws, status), null)
    fs.writeFileSync(taskPath(ws, task.id), serializeTask(task), { flag: 'wx' })
    return task
  })
}

export async function deleteTask(ws: string, id: string): Promise<void> {
  const file = requireExists(ws, id)
  await withLock(file, () => {
    requireExists(ws, id)
    fs.renameSync(file, path.join(ws, '.kanban', 'trash', `${id}.md`))
  })
}
