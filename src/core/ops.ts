import { generateKeyBetween } from 'fractional-indexing'
import { columnByRole, isDone, loadConfig } from './config'
import { tx } from './db'
import type { Db } from './db'
import { KbError } from './errors'
import { hash } from './format'
import { loadTasks, saveTask } from './store'
import type { Config, Link, Ref, Task } from './types'

export type Op =
  | { type: 'setStatus'; status: string; rank?: string }
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
  | { type: 'editComment'; index: number; at: string; body: string }
  | { type: 'claim'; assignee: string }

export type CreateInput = {
  title: string
  status?: string
  parent?: string
  due?: string
  assignee?: string
  body?: string
  rank?: string
  links?: Link[]
  refs?: Ref[]
  clientId?: string
}

export const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

const ID_RE = /^\d+$/

export function readTask(db: Db, id: string): Task {
  if (!ID_RE.test(id)) throw new KbError('usage', `invalid task id "${id}"`)
  const task = loadTasks(db, id)[0]
  if (!task) throw new KbError('not_found', `task ${id} not found`)
  return task
}

function setStatus(config: Config, task: Task, status: string, at: string): void {
  if (!config.columns.some((c) => c.key === status)) throw new KbError('usage', `unknown status "${status}"`)
  task.status = status
  task.completed = isDone(config, status) ? (task.completed ?? at) : undefined
}

// Ranks only order tasks within a column, so a task changing columns needs a new one.
function move(db: Db, config: Config, task: Task, status: string, at: string, rank?: string): void {
  const moved = status !== task.status
  setStatus(config, task, status, at)
  if (rank) task.rank = rank
  else if (moved) task.rank = rankAtEnd(db, status)
}

function rankAtEnd(db: Db, status: string): string {
  const last = db.prepare('SELECT MAX(rank) AS r FROM tasks WHERE status = ? AND deleted_at IS NULL').get(status) as { r: string | null }
  return generateKeyBetween(last.r, null)
}

function checkHash(field: string, current: string, baseHash?: string): void {
  if (baseHash !== undefined && baseHash !== hash(current)) {
    throw new KbError('conflict', `${field} changed since it was read`)
  }
}

function checkParent(db: Db, id: string, parent: string): void {
  readTask(db, parent)
  const parentOf = db.prepare('SELECT parent FROM tasks WHERE id = ? AND deleted_at IS NULL')
  const seen = new Set<string>()
  for (let cur: string | undefined = parent; cur && !seen.has(cur); ) {
    if (cur === id) throw new KbError('usage', `setting parent ${parent} on ${id} would create a cycle`)
    seen.add(cur)
    const row = parentOf.get(cur) as { parent: number | null } | undefined
    cur = row?.parent == null ? undefined : String(row.parent)
  }
}

function apply(db: Db, config: Config, task: Task, op: Op, at: string): void {
  switch (op.type) {
    case 'setStatus':
      return move(db, config, task, op.status, at, op.rank)
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
      if (op.parent) checkParent(db, task.id, op.parent)
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
    case 'editComment':
      if (task.comments[op.index]?.at !== op.at) throw new KbError('conflict', 'comment changed since it was read')
      task.comments[op.index].body = op.body
      return
    case 'claim':
      if (task.assignee && task.assignee !== op.assignee) {
        throw new KbError('conflict', `${task.id} is already claimed by ${task.assignee}`)
      }
      task.assignee = op.assignee
      return move(db, config, task, columnByRole(config, 'active').key, at)
  }
}

export function applyOp(db: Db, id: string, op: Op): Task {
  const config = loadConfig(db)
  return tx(db, () => {
    const task = readTask(db, id)
    const at = now()
    apply(db, config, task, op, at)
    task.updated = at
    saveTask(db, task)
    return task
  })
}

export function createTask(db: Db, input: CreateInput): Task {
  const config = loadConfig(db)
  return tx(db, () => {
    if (input.clientId) {
      const row = db.prepare('SELECT id, deleted_at FROM tasks WHERE client_id = ?').get(input.clientId) as { id: number; deleted_at: string | null } | undefined
      if (row?.deleted_at) throw new KbError('not_found', `task ${row.id} not found`)
      if (row) return readTask(db, String(row.id))
    }
    if (input.parent) readTask(db, input.parent)
    const status = input.status ?? columnByRole(config, 'ready').key
    const at = now()
    const task: Task = {
      id: '',
      title: input.title,
      status,
      rank: '',
      parent: input.parent,
      due: input.due,
      assignee: input.assignee,
      links: input.links ?? [],
      refs: input.refs ?? [],
      created: at,
      updated: at,
      body: input.body ?? '',
      comments: [],
      extra: {},
    }
    setStatus(config, task, status, at)
    task.rank = input.rank ?? rankAtEnd(db, status)
    task.id = saveTask(db, task)
    if (input.clientId) db.prepare('UPDATE tasks SET client_id = ? WHERE id = ?').run(input.clientId, task.id)
    return task
  })
}

export function deleteTask(db: Db, id: string): void {
  tx(db, () => {
    readTask(db, id)
    db.prepare('UPDATE tasks SET deleted_at = ? WHERE id = ?').run(now(), id)
  })
}
