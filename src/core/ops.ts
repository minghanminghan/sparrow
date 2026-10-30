import { generateKeyBetween } from 'fractional-indexing'
import { columnByRole, isDone, loadConfig } from './config'
import { tx } from './db'
import type { Db } from './db'
import { KbError } from './errors'
import { hash } from './format'
import { normalizeProjectKey, normalizeTaskKey, splitTaskKey } from './keys'
import { loadTasks, rowIdOf, saveTask } from './store'
import type { Config, Link, Ref, Task } from './types'

export type Op =
  | { type: 'setStatus'; status: string; rank?: string }
  | { type: 'setRank'; rank: string }
  | { type: 'setDue'; due: string | null }
  | { type: 'setParent'; parent: string | null }
  | { type: 'setTitle'; title: string; baseHash?: string }
  | { type: 'setBody'; body: string; baseHash?: string }
  | { type: 'addLink'; link: Link }
  | { type: 'removeLink'; link: Link }
  | { type: 'addRef'; ref: Ref }
  | { type: 'removeRef'; url: string }
  | { type: 'addComment'; author: string; body: string }
  | { type: 'editComment'; index: number; at: string; body: string }

export type CreateInput = {
  title: string
  project?: string
  status?: string
  parent?: string
  due?: string
  body?: string
  rank?: string
  links?: Link[]
  refs?: Ref[]
  clientId?: string
}

export const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

export function readTask(db: Db, id: string): Task {
  const key = normalizeTaskKey(id)
  const task = loadTasks(db, key)[0]
  if (!task) throw new KbError('not_found', `task ${key} not found`)
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

function checkSameProject(project: string, parent: Task): void {
  if (parent.project !== project) throw new KbError('usage', `${project} task cannot have parent ${parent.id} from another project`)
}

function checkParent(db: Db, task: Task, parent: string): void {
  checkSameProject(task.project, readTask(db, parent))
  const parentOf = db.prepare(
    "SELECT p.project || '-' || p.number AS key FROM tasks c JOIN tasks p ON p.id = c.parent WHERE c.project = ? AND c.number = ? AND c.deleted_at IS NULL",
  )
  const seen = new Set<string>()
  for (let cur: string | undefined = parent; cur && !seen.has(cur); ) {
    if (cur === task.id) throw new KbError('usage', `setting parent ${parent} on ${task.id} would create a cycle`)
    seen.add(cur)
    const { project, number } = splitTaskKey(cur)
    const row = parentOf.get(project, number) as { key: string } | undefined
    cur = row?.key
  }
}

const normalizeLink = (link: Link): Link => ({ type: link.type, id: normalizeTaskKey(link.id) })

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
    case 'setParent': {
      const parent = op.parent ? normalizeTaskKey(op.parent) : undefined
      if (parent) checkParent(db, task, parent)
      task.parent = parent
      return
    }
    case 'setTitle':
      checkHash('title', task.title, op.baseHash)
      task.title = op.title
      return
    case 'setBody':
      checkHash('body', task.body, op.baseHash)
      task.body = op.body
      return
    case 'addLink': {
      const link = normalizeLink(op.link)
      if (link.id === task.id) throw new KbError('usage', 'a task cannot link to itself')
      if (!task.links.some((l) => l.type === link.type && l.id === link.id)) task.links.push(link)
      return
    }
    case 'removeLink': {
      const link = normalizeLink(op.link)
      task.links = task.links.filter((l) => !(l.type === link.type && l.id === link.id))
      return
    }
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
      const row = db.prepare("SELECT project || '-' || number AS key, deleted_at FROM tasks WHERE client_id = ?").get(input.clientId) as
        | { key: string; deleted_at: string | null }
        | undefined
      if (row?.deleted_at) throw new KbError('not_found', `task ${row.key} not found`)
      if (row) return readTask(db, row.key)
    }
    let project = input.project ? normalizeProjectKey(input.project) : undefined
    const parent = input.parent ? readTask(db, input.parent) : undefined
    if (parent) {
      if (project) checkSameProject(project, parent)
      project = parent.project
    }
    if (!project) {
      const keys = (db.prepare('SELECT key FROM projects ORDER BY key').all() as { key: string }[]).map((r) => r.key)
      throw new KbError('usage', `a project is required (one of: ${keys.join(', ')})`)
    }
    const next = db.prepare('UPDATE projects SET next_number = next_number + 1 WHERE key = ? RETURNING next_number - 1 AS n').get(project) as
      | { n: number }
      | undefined
    if (!next) throw new KbError('not_found', `project ${project} not found`)
    const status = input.status ?? columnByRole(config, 'ready').key
    const at = now()
    const task: Task = {
      id: `${project}-${next.n}`,
      project,
      title: input.title,
      status,
      rank: '',
      parent: parent?.id,
      due: input.due,
      links: (input.links ?? []).map(normalizeLink),
      refs: input.refs ?? [],
      created: at,
      updated: at,
      body: input.body ?? '',
      comments: [],
      extra: {},
    }
    setStatus(config, task, status, at)
    task.rank = input.rank ?? rankAtEnd(db, status)
    saveTask(db, task)
    if (input.clientId) db.prepare('UPDATE tasks SET client_id = ? WHERE id = ?').run(input.clientId, rowIdOf(db, task.id))
    return task
  })
}

export function deleteTask(db: Db, id: string): void {
  tx(db, () => {
    const task = readTask(db, id)
    db.prepare('UPDATE tasks SET deleted_at = ? WHERE id = ?').run(now(), rowIdOf(db, task.id))
  })
}
