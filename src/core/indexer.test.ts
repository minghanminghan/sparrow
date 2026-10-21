import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { buildIndex, nextTask, viewTask } from './indexer'
import { applyOp, createTask } from './ops'
import { initWorkspace } from './workspace'

let ws: string
beforeEach(() => {
  ws = mkdtempSync(path.join(tmpdir(), 'kb-'))
  initWorkspace(ws)
})

test('index ignores temp files and computes backlinks', async () => {
  const a = await createTask(ws, { title: 'a' })
  const b = await createTask(ws, { title: 'b', body: `see [[${a.id}]]`, parent: a.id })
  await applyOp(ws, b.id, { type: 'addLink', link: { type: 'blocks', id: a.id } })
  writeFileSync(join(ws, 'tasks', `.${a.id}.md.tmp-123`), 'junk')
  const idx = buildIndex(ws)
  expect(idx.tasks).toHaveLength(2)
  expect(idx.invalid).toHaveLength(0)
  const va = viewTask(idx, a.id)!
  expect(va.backlinks).toEqual(expect.arrayContaining([{ type: 'blocked-by', id: b.id }, { type: 'mentioned-in', id: b.id }]))
  expect(va.progress).toEqual({ done: 0, total: 1 })
  expect(nextTask(idx)?.id).toBe(b.id) // a has an open subtask and is blocked; b is available
})
