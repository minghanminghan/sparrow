import type { Db } from './db'
import { KbError } from './errors'
import { splitTaskKey } from './keys'
import type { Comment, Link, Ref, Task } from './types'

// The integer tasks.id never leaves this file and attachments.ts: everything above uses keys like SPAR-28.

type Row = Record<string, string | number | null>

const str = (v: string | number | null) => (v === null ? undefined : String(v))

function group<T>(rows: Row[], map: (r: Row) => T): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const r of rows) {
    const id = String(r.task_id)
    if (!out.has(id)) out.set(id, [])
    out.get(id)!.push(map(r))
  }
  return out
}

// Integer id -> key for every row, deleted included, so links to deleted tasks still resolve.
function keysById(db: Db): Map<string, string> {
  const rows = db.prepare('SELECT id, project, number FROM tasks').all() as Row[]
  return new Map(rows.map((r) => [String(r.id), `${r.project}-${r.number}`]))
}

export function rowIdOf(db: Db, key: string): number {
  const { project, number } = splitTaskKey(key)
  const row = db.prepare('SELECT id FROM tasks WHERE project = ? AND number = ?').get(project, number) as { id: number } | undefined
  if (!row) throw new KbError('not_found', `task ${key} not found`)
  return row.id
}

// Loads live (not soft-deleted) tasks, or just one when key is given.
export function loadTasks(db: Db, key?: string): Task[] {
  const where = key === undefined ? '' : 'AND t.project = ? AND t.number = ?'
  const k = key === undefined ? undefined : splitTaskKey(key)
  const args = k ? [k.project, k.number] : []
  const join = (table: string, order: string) =>
    db
      .prepare(`SELECT x.* FROM ${table} x JOIN tasks t ON t.id = x.task_id WHERE t.deleted_at IS NULL ${where} ORDER BY ${order}`)
      .all(...args) as Row[]

  const keys = keysById(db)
  const keyOf = (v: string | number | null) => (v === null ? undefined : keys.get(String(v)))
  const links = group(join('links', 'x.rowid'), (r): Link => ({ type: r.type as Link['type'], id: keyOf(r.target_id)! }))
  const refs = group(join('refs', 'x.rowid'), (r): Ref => (r.label === null ? { url: String(r.url) } : { url: String(r.url), label: String(r.label) }))
  const comments = group(join('comments', 'x.id'), (r): Comment => ({ at: String(r.at), author: String(r.author), body: String(r.body) }))
  const rows = db.prepare(`SELECT * FROM tasks t WHERE t.deleted_at IS NULL ${where} ORDER BY t.id`).all(...args) as Row[]

  return rows.map((r) => {
    const tid = String(r.id)
    return {
      id: keys.get(tid)!,
      project: String(r.project),
      title: String(r.title),
      status: String(r.status),
      rank: String(r.rank),
      parent: keyOf(r.parent),
      due: str(r.due),
      completed: str(r.completed),
      links: links.get(tid) ?? [],
      refs: refs.get(tid) ?? [],
      created: String(r.created),
      updated: String(r.updated),
      body: String(r.body),
      comments: comments.get(tid) ?? [],
      extra: JSON.parse(String(r.extra)),
    }
  })
}

// Inserts or updates the task's (project, number) row and replaces its links, refs, and comments. Returns the key.
export function saveTask(db: Db, task: Task): string {
  const { project, number } = splitTaskKey(task.id)
  const row = db
    .prepare(
      `INSERT INTO tasks (project, number, title, status, rank, parent, due, body, extra, created, updated, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (project, number) DO UPDATE SET title = excluded.title, status = excluded.status, rank = excluded.rank,
         parent = excluded.parent, due = excluded.due, body = excluded.body,
         extra = excluded.extra, updated = excluded.updated, completed = excluded.completed
       RETURNING id`,
    )
    .get(
      project,
      number,
      task.title,
      task.status,
      task.rank,
      task.parent ? rowIdOf(db, task.parent) : null,
      task.due ?? null,
      task.body,
      JSON.stringify(task.extra),
      task.created,
      task.updated,
      task.completed ?? null,
    ) as Row
  const id = Number(row.id)

  for (const table of ['links', 'refs', 'comments']) db.prepare(`DELETE FROM ${table} WHERE task_id = ?`).run(id)
  const link = db.prepare('INSERT INTO links (task_id, type, target_id) VALUES (?, ?, ?)')
  for (const l of task.links) link.run(id, l.type, rowIdOf(db, l.id))
  const ref = db.prepare('INSERT INTO refs (task_id, url, label) VALUES (?, ?, ?)')
  for (const r of task.refs) ref.run(id, r.url, r.label ?? null)
  const comment = db.prepare('INSERT INTO comments (task_id, at, author, body) VALUES (?, ?, ?, ?)')
  for (const c of task.comments) comment.run(id, c.at, c.author, c.body)
  return task.id
}
