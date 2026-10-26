import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { hash } from './format'
import { applyOp, createTask, deleteTask } from './ops'
import { initWorkspace, readTask, taskPath } from './workspace'

let ws: string
beforeEach(() => {
  ws = mkdtempSync(path.join(tmpdir(), 'kb-'))
  initWorkspace(ws)
})

test('parallel comments are all kept', async () => {
  const t = await createTask(ws, { title: 'a' })
  await Promise.all(Array.from({ length: 20 }, (_, i) => applyOp(ws, t.id, { type: 'addComment', author: 'ai', body: `c${i}` })))
  expect(readTask(ws, t.id).task.comments).toHaveLength(20)
})

test('parallel creates get unique ids, deleted ids not reused', async () => {
  const ts = await Promise.all(Array.from({ length: 10 }, () => createTask(ws, { title: 'x' })))
  expect(new Set(ts.map((t) => t.id)).size).toBe(10)
  await deleteTask(ws, '10')
  expect((await createTask(ws, { title: 'y' })).id).toBe('11')
})

test('stale body hash conflicts, other ops do not', async () => {
  const t = await createTask(ws, { title: 'a', body: 'v1' })
  const h = hash('v1')
  await applyOp(ws, t.id, { type: 'addComment', author: 'ai', body: 'hi' })
  await applyOp(ws, t.id, { type: 'setBody', body: 'v2', baseHash: h })
  await expect(applyOp(ws, t.id, { type: 'setBody', body: 'v3', baseHash: h })).rejects.toMatchObject({ code: 'conflict' })
})

test('parent cycle rejected', async () => {
  const a = await createTask(ws, { title: 'a' })
  const b = await createTask(ws, { title: 'b', parent: a.id })
  await expect(applyOp(ws, a.id, { type: 'setParent', parent: b.id })).rejects.toMatchObject({ code: 'usage' })
})

test('invalid file is never rewritten', async () => {
  writeFileSync(taskPath(ws, '9'), 'garbage')
  await expect(applyOp(ws, '9', { type: 'setStatus', status: 'done' })).rejects.toMatchObject({ code: 'invalid' })
  expect(readFileSync(taskPath(ws, '9'), 'utf8')).toBe('garbage')
})

test('done sets and clears completed', async () => {
  const t = await createTask(ws, { title: 'a' })
  expect((await applyOp(ws, t.id, { type: 'setStatus', status: 'done' })).completed).toBeTruthy()
  expect((await applyOp(ws, t.id, { type: 'setStatus', status: 'todo' })).completed).toBeUndefined()
})
