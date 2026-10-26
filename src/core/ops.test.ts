import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { MIGRATIONS, openDb } from './db'
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
  const a = createTask(db, { title: 'a' })
  const b = createTask(db, { title: 'b', body: 'v1', refs: [{ url: 'u1', label: 'L' }, { url: 'u0' }] })
  applyOp(db, b.id, { type: 'addLink', link: { type: 'relates', id: a.id } })
  applyOp(db, b.id, { type: 'addComment', author: 'ai', body: 'one' })
  applyOp(db, b.id, { type: 'addComment', author: 'me', body: 'two' })
  const got = readTask(db, b.id)
  expect(got.refs).toEqual([{ url: 'u1', label: 'L' }, { url: 'u0' }])
  expect(got.links).toEqual([{ type: 'relates', id: a.id }])
  expect(got.comments.map((c) => c.body)).toEqual(['one', 'two'])
})

test('deleted ids are not reused and deleted tasks disappear', () => {
  for (let i = 0; i < 3; i++) createTask(db, { title: 'x' })
  deleteTask(db, '3')
  expect(code(() => readTask(db, '3'))).toBe('not_found')
  expect(createTask(db, { title: 'y' }).id).toBe('4')
  expect(buildIndex(db).tasks.map((t) => t.id)).toEqual(['1', '2', '4'])
})

test('stale body hash conflicts, other ops do not', () => {
  const t = createTask(db, { title: 'a', body: 'v1' })
  const h = hash('v1')
  applyOp(db, t.id, { type: 'addComment', author: 'ai', body: 'hi' })
  applyOp(db, t.id, { type: 'setBody', body: 'v2', baseHash: h })
  expect(code(() => applyOp(db, t.id, { type: 'setBody', body: 'v3', baseHash: h }))).toBe('conflict')
  expect(readTask(db, t.id).body).toBe('v2')
})

test('parent cycle rejected', () => {
  const a = createTask(db, { title: 'a' })
  const b = createTask(db, { title: 'b', parent: a.id })
  expect(code(() => applyOp(db, a.id, { type: 'setParent', parent: b.id }))).toBe('usage')
})

test('done sets and clears completed', () => {
  const t = createTask(db, { title: 'a' })
  expect(applyOp(db, t.id, { type: 'setStatus', status: 'done' }).completed).toBeTruthy()
  expect(applyOp(db, t.id, { type: 'setStatus', status: 'todo' }).completed).toBeUndefined()
})

test('index computes backlinks, progress, and next task', () => {
  const a = createTask(db, { title: 'a' })
  const b = createTask(db, { title: 'b', body: `see [[${a.id}]]`, parent: a.id })
  applyOp(db, b.id, { type: 'addLink', link: { type: 'blocks', id: a.id } })
  const idx = buildIndex(db)
  const va = viewTask(idx, a.id)!
  expect(va.backlinks).toEqual(expect.arrayContaining([{ type: 'blocked-by', id: b.id }, { type: 'mentioned-in', id: b.id }]))
  expect(va.progress).toEqual({ done: 0, total: 1 })
  expect(nextTask(idx)?.id).toBe(b.id)
})
