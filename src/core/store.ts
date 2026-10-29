import type { Db } from './db'
import type { Comment, Link, Ref, Task } from './types'

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

// Loads live (not soft-deleted) tasks, or just one when id is given.
export function loadTasks(db: Db, id?: string): Task[] {
  const where = id === undefined ? '' : 'AND t.id = ?'
  const args = id === undefined ? [] : [id]
  const join = (table: string, order: string) =>
    db
      .prepare(`SELECT x.* FROM ${table} x JOIN tasks t ON t.id = x.task_id WHERE t.deleted_at IS NULL ${where} ORDER BY ${order}`)
      .all(...args) as Row[]

  const links = group(join('links', 'x.rowid'), (r): Link => ({ type: r.type as Link['type'], id: String(r.target_id) }))
  const refs = group(join('refs', 'x.rowid'), (r): Ref => (r.label === null ? { url: String(r.url) } : { url: String(r.url), label: String(r.label) }))
  const comments = group(join('comments', 'x.id'), (r): Comment => ({ at: String(r.at), author: String(r.author), body: String(r.body) }))
  const rows = db.prepare(`SELECT * FROM tasks t WHERE t.deleted_at IS NULL ${where} ORDER BY t.id`).all(...args) as Row[]

  return rows.map((r) => {
    const tid = String(r.id)
    return {
      id: tid,
      title: String(r.title),
      status: String(r.status),
      rank: String(r.rank),
      parent: str(r.parent),
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

// Inserts (when task.id is '') or updates a task and replaces its links, refs, and comments. Returns the id.
export function saveTask(db: Db, task: Task): string {
  const row = db
    .prepare(
      `INSERT INTO tasks (id, title, status, rank, parent, due, body, extra, created, updated, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET title = excluded.title, status = excluded.status, rank = excluded.rank,
         parent = excluded.parent, due = excluded.due, body = excluded.body,
         extra = excluded.extra, updated = excluded.updated, completed = excluded.completed
       RETURNING id`,
    )
    .get(
      task.id || null,
      task.title,
      task.status,
      task.rank,
      task.parent ?? null,
      task.due ?? null,
      task.body,
      JSON.stringify(task.extra),
      task.created,
      task.updated,
      task.completed ?? null,
    ) as Row
  const id = String(row.id)

  for (const table of ['links', 'refs', 'comments']) db.prepare(`DELETE FROM ${table} WHERE task_id = ?`).run(id)
  const link = db.prepare('INSERT INTO links (task_id, type, target_id) VALUES (?, ?, ?)')
  for (const l of task.links) link.run(id, l.type, l.id)
  const ref = db.prepare('INSERT INTO refs (task_id, url, label) VALUES (?, ?, ?)')
  for (const r of task.refs) ref.run(id, r.url, r.label ?? null)
  const comment = db.prepare('INSERT INTO comments (task_id, at, author, body) VALUES (?, ?, ?, ?)')
  for (const c of task.comments) comment.run(id, c.at, c.author, c.body)
  return id
}
