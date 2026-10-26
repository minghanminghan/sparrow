import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { dbPath, tx } from './db'
import type { Db } from './db'
import { KbError } from './errors'
import { MAX_ATTACHMENT_BYTES, mimeFor } from './mime'
import { now, readTask } from './ops'
import type { Attachment } from './types'

export function attachmentsDir(): string {
  return process.env.SPARROW_ATTACHMENTS ?? path.join(path.dirname(dbPath()), 'attachments')
}

// Display name only; the file on disk is always named by its uuid.
function cleanName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? ''
  return base.replace(/[\x00-\x1f\x7f"]/g, '').trim().slice(0, 255) || 'file'
}

const MIME_RE = /^[\w.+-]+\/[\w.+-]+$/

const toAttachment = (r: Record<string, unknown>): Attachment => ({
  id: String(r.id),
  filename: String(r.filename),
  mime: String(r.mime),
  size: Number(r.size),
  created: String(r.created),
})

// Attachments of live tasks, grouped by task id.
export function loadAttachments(db: Db): Map<string, Attachment[]> {
  const rows = db
    .prepare('SELECT a.* FROM attachments a JOIN tasks t ON t.id = a.task_id WHERE t.deleted_at IS NULL ORDER BY a.created, a.rowid')
    .all() as Record<string, unknown>[]
  const out = new Map<string, Attachment[]>()
  for (const r of rows) {
    const id = String(r.task_id)
    if (!out.has(id)) out.set(id, [])
    out.get(id)!.push(toAttachment(r))
  }
  return out
}

export function addAttachment(
  db: Db,
  taskId: string,
  file: { filename: string; mime?: string; data: Uint8Array },
  dir = attachmentsDir(),
): Attachment {
  readTask(db, taskId)
  if (file.data.byteLength > MAX_ATTACHMENT_BYTES) throw new KbError('invalid', 'attachment exceeds 25 MB')
  const filename = cleanName(file.filename)
  const mime = file.mime && MIME_RE.test(file.mime) ? file.mime.toLowerCase() : mimeFor(filename)
  const att: Attachment = { id: randomUUID(), filename, mime, size: file.data.byteLength, created: now() }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, att.id), file.data, { flag: 'wx' })
  tx(db, () => {
    db.prepare('INSERT INTO attachments (id, task_id, filename, mime, size, created) VALUES (?, ?, ?, ?, ?, ?)').run(
      att.id,
      taskId,
      att.filename,
      att.mime,
      att.size,
      att.created,
    )
    db.prepare('UPDATE tasks SET updated = ? WHERE id = ?').run(att.created, taskId)
  })
  return att
}

export function getAttachment(db: Db, taskId: string, attId: string, dir = attachmentsDir()): Attachment & { file: string } {
  readTask(db, taskId)
  const row = db.prepare('SELECT * FROM attachments WHERE id = ? AND task_id = ?').get(attId, taskId) as
    | Record<string, unknown>
    | undefined
  if (!row) throw new KbError('not_found', `attachment ${attId} not found on task ${taskId}`)
  const att = toAttachment(row)
  return { ...att, file: path.join(dir, att.id) }
}

// Deletes the row only; the file stays on disk for the cleanup job. Touching the file restarts
// its 7-day clock, so backups taken before the removal can still be restored.
export function removeAttachment(db: Db, taskId: string, attId: string, dir = attachmentsDir()): void {
  tx(db, () => {
    readTask(db, taskId)
    const res = db.prepare('DELETE FROM attachments WHERE id = ? AND task_id = ?').run(attId, taskId)
    if (res.changes === 0) throw new KbError('not_found', `attachment ${attId} not found on task ${taskId}`)
    db.prepare('UPDATE tasks SET updated = ? WHERE id = ?').run(now(), taskId)
  })
  const file = path.join(dir, attId)
  if (fs.existsSync(file)) fs.utimesSync(file, new Date(), new Date())
}
