import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { addAttachment, removeAttachment } from './attachments'
import { connect, MIGRATIONS, migrate, openDb } from './db'
import { MAX_ATTACHMENT_BYTES } from './mime'
import type { Db } from './db'
import { hash } from './format'
import { buildIndex, nextTask, viewTask } from './indexer'
import { applyOp, createTask, deleteTask, readTask } from './ops'

let db: Db
beforeEach(() => {
  db = openDb(':memory:')
})

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (err) {
    return (err as { code?: string }).code
  }
}

test('fresh file db is migrated to latest', () => {
  const file = openDb(path.join(mkdtempSync(path.join(tmpdir(), 'sparrow-')), 'a', 'x.db'))
  expect(file.prepare('PRAGMA user_version').get()).toEqual({ user_version: MIGRATIONS.length })
  expect(file.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' })
})

test('links, refs, and comments round trip in order', () => {
  const a = createTask(db, { project: 'SPAR', title: 'a' })
  const b = createTask(db, { project: 'SPAR', title: 'b', body: 'v1', refs: [{ url: 'u1', label: 'L' }, { url: 'u0' }] })
  applyOp(db, b.id, { type: 'addLink', link: { type: 'relates', id: a.id } })
  applyOp(db, b.id, { type: 'addComment', author: 'ai', body: 'one' })
  applyOp(db, b.id, { type: 'addComment', author: 'me', body: 'two' })
  const got = readTask(db, b.id)
  expect(got.refs).toEqual([{ url: 'u1', label: 'L' }, { url: 'u0' }])
  expect(got.links).toEqual([{ type: 'relates', id: a.id }])
  expect(got.comments.map((c) => c.body)).toEqual(['one', 'two'])
})

test('deleted ids are not reused and deleted tasks disappear', () => {
  for (let i = 0; i < 3; i++) createTask(db, { project: 'SPAR', title: 'x' })
  deleteTask(db, 'SPAR-3')
  expect(code(() => readTask(db, 'SPAR-3'))).toBe('not_found')
  expect(createTask(db, { project: 'SPAR', title: 'y' }).id).toBe('SPAR-4')
  expect(buildIndex(db).tasks.map((t) => t.id)).toEqual(['SPAR-1', 'SPAR-2', 'SPAR-4'])
})

test('stale body hash conflicts, other ops do not', () => {
  const t = createTask(db, { project: 'SPAR', title: 'a', body: 'v1' })
  const h = hash('v1')
  applyOp(db, t.id, { type: 'addComment', author: 'ai', body: 'hi' })
  applyOp(db, t.id, { type: 'setBody', body: 'v2', baseHash: h })
  expect(code(() => applyOp(db, t.id, { type: 'setBody', body: 'v3', baseHash: h }))).toBe('conflict')
  expect(readTask(db, t.id).body).toBe('v2')
})

test('parent cycle rejected', () => {
  const a = createTask(db, { project: 'SPAR', title: 'a' })
  const b = createTask(db, { project: 'SPAR', title: 'b', parent: a.id })
  expect(code(() => applyOp(db, a.id, { type: 'setParent', parent: b.id }))).toBe('usage')
})

test('done sets and clears completed', () => {
  const t = createTask(db, { project: 'SPAR', title: 'a' })
  expect(applyOp(db, t.id, { type: 'setStatus', status: 'done' }).completed).toBeTruthy()
  expect(applyOp(db, t.id, { type: 'setStatus', status: 'todo' }).completed).toBeUndefined()
})

test('attachments: uuid file on disk, listed in index, remove keeps the file', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sparrow-att-'))
  const t = createTask(db, { project: 'SPAR', title: 'a' })
  const att = addAttachment(db, t.id, { filename: '../x/shot.png', data: new Uint8Array([1, 2]) }, dir)
  expect(att).toMatchObject({ filename: 'shot.png', mime: 'image/png', size: 2 })
  expect(existsSync(path.join(dir, att.id))).toBe(true)
  expect(viewTask(buildIndex(db), t.id)!.attachments.map((a) => a.id)).toEqual([att.id])
  removeAttachment(db, t.id, att.id)
  expect(viewTask(buildIndex(db), t.id)!.attachments).toEqual([])
  expect(existsSync(path.join(dir, att.id))).toBe(true)
  const big = new Uint8Array(MAX_ATTACHMENT_BYTES + 1)
  expect(code(() => addAttachment(db, t.id, { filename: 'big', data: big }, dir))).toBe('invalid')
})

test('index computes backlinks, progress, and next task', () => {
  const a = createTask(db, { project: 'SPAR', title: 'a' })
  const b = createTask(db, { project: 'SPAR', title: 'b', body: `see [[${a.id}]]`, parent: a.id })
  applyOp(db, b.id, { type: 'addLink', link: { type: 'blocks', id: a.id } })
  const idx = buildIndex(db)
  const va = viewTask(idx, a.id)!
  expect(va.backlinks).toEqual(expect.arrayContaining([{ type: 'blocked-by', id: b.id }, { type: 'mentioned-in', id: b.id }]))
  expect(va.progress).toEqual({ done: 0, total: 1 })
  expect(nextTask(idx)?.id).toBe(b.id)
})

test('createTask with the same clientId returns the first task', () => {
  const a = createTask(db, { project: 'SPAR', title: 'x', clientId: 'c1' })
  const b = createTask(db, { project: 'SPAR', title: 'x again', clientId: 'c1' })
  expect(b.id).toBe(a.id)
  expect(buildIndex(db).tasks.filter((t) => t.title.startsWith('x'))).toHaveLength(1)
})

test('createTask without clientId always creates', () => {
  expect(createTask(db, { project: 'SPAR', title: 'y' }).id).not.toBe(createTask(db, { project: 'SPAR', title: 'y' }).id)
})

test('createTask retried after its task was deleted is not_found and makes no task', () => {
  const a = createTask(db, { project: 'SPAR', title: 'z', clientId: 'c2' })
  deleteTask(db, a.id)
  expect(code(() => createTask(db, { project: 'SPAR', title: 'z', clientId: 'c2' }))).toBe('not_found')
  expect(buildIndex(db).tasks.filter((t) => t.title === 'z')).toHaveLength(0)
})

test('migration 5 keeps numbers and rewrites mentions', () => {
  const db = connect(':memory:')
  for (let v = 1; v <= 4; v++) db.exec(MIGRATIONS[v - 1] as string)
  db.exec('PRAGMA user_version = 4')
  const ins = db.prepare("INSERT INTO tasks (id, title, status, rank, parent, body, created, updated, deleted_at) VALUES (?, ?, 'todo', ?, ?, ?, 'x', 'x', ?)")
  ins.run(1, 'a', 'a0', null, '', null)
  ins.run(2, 'b', 'a1', 1, 'see [[1]] and [[x]]', null)
  ins.run(3, 'gone', 'a2', null, '', 'x')
  db.exec("INSERT INTO links VALUES (2, 'blocks', 1); INSERT INTO comments (task_id, at, author, body) VALUES (1, 'x', 'me', 'ping [[2]]')")
  migrate(db)
  const b = readTask(db, 'SPAR-2')
  expect(b).toMatchObject({ project: 'SPAR', parent: 'SPAR-1', links: [{ type: 'blocks', id: 'SPAR-1' }], body: 'see [[SPAR-1]] and [[x]]' })
  expect(readTask(db, 'SPAR-1').comments[0].body).toBe('ping [[SPAR-2]]')
  expect(createTask(db, { title: 'n', project: 'spar' }).id).toBe('SPAR-4')
})

test('projects count separately and keys are case-insensitive', () => {
  db.exec("INSERT INTO projects VALUES ('NEWS', 'News', '#dc2626', 1)")
  expect(createTask(db, { title: 'a', project: 'news' }).id).toBe('NEWS-1')
  expect(createTask(db, { title: 'b', project: 'SPAR' }).id).toBe('SPAR-1')
  expect(readTask(db, 'news-1').title).toBe('a')
  expect(code(() => readTask(db, '1'))).toBe('usage')
})

test('create needs a project or a parent', () => {
  expect(() => createTask(db, { title: 'x' })).toThrow('a project is required (one of: SPAR)')
  expect(code(() => createTask(db, { title: 'x', project: 'NOPE' }))).toBe('not_found')
  const p = createTask(db, { title: 'p', project: 'SPAR' })
  expect(createTask(db, { title: 'c', parent: p.id.toLowerCase() }).project).toBe('SPAR')
})

test('subtask project must match parent', () => {
  db.exec("INSERT INTO projects VALUES ('NEWS', 'News', '#dc2626', 1)")
  const p = createTask(db, { title: 'p', project: 'SPAR' })
  const n = createTask(db, { title: 'n', project: 'NEWS' })
  expect(code(() => createTask(db, { title: 'c', project: 'NEWS', parent: p.id }))).toBe('usage')
  expect(code(() => applyOp(db, n.id, { type: 'setParent', parent: p.id }))).toBe('usage')
  expect(readTask(db, n.id).parent).toBeUndefined()
})

test('links may cross projects', () => {
  db.exec("INSERT INTO projects VALUES ('NEWS', 'News', '#dc2626', 1)")
  const a = createTask(db, { title: 'a', project: 'SPAR' })
  const n = createTask(db, { title: 'n', project: 'NEWS' })
  applyOp(db, n.id, { type: 'addLink', link: { type: 'blocks', id: 'spar-1' } })
  expect(viewTask(buildIndex(db), a.id)!.backlinks).toEqual([{ type: 'blocked-by', id: 'NEWS-1' }])
})
