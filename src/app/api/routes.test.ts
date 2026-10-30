import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { createTask, PROJECT_COLORS } from '@/core'
import { getState, refresh } from '@/server/state'
import { PATCH as patchProject } from './projects/[key]/route'
import { POST as postProject } from './projects/route'
import { GET } from './tasks/[id]/route'

beforeEach(() => {
  process.env.SPARROW_DB = path.join(mkdtempSync(path.join(tmpdir(), 'sparrow-api-')), 'x.db')
  globalThis.__kb = undefined
})

const jsonReq = (body: unknown) =>
  new Request('http://x/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

test('GET /api/tasks/spar-1 returns SPAR-1', async () => {
  createTask(getState().db, { title: 'a', project: 'SPAR' })
  refresh(getState())
  const res = await GET(new Request('http://x/api/tasks/spar-1'), { params: Promise.resolve({ id: 'spar-1' }) })
  expect((await res.json()).id).toBe('SPAR-1')
})

test('GET /api/tasks/1 is a 400 that names the key format', async () => {
  const res = await GET(new Request('http://x/api/tasks/1'), { params: Promise.resolve({ id: '1' }) })
  expect(res.status).toBe(400)
  expect((await res.json()).error.message).toContain('like SPAR-28')
})

test('POST /api/projects then PATCH its color', async () => {
  const created = await (await postProject(jsonReq({ key: 'news', name: 'Newsletter' }))).json()
  expect(created.key).toBe('NEWS')
  const res = await patchProject(jsonReq({ color: PROJECT_COLORS[0] }), { params: Promise.resolve({ key: 'news' }) })
  expect((await res.json()).color).toBe(PROJECT_COLORS[0])
  expect(getState().index.projects.find((p) => p.key === 'NEWS')!.color).toBe(PROJECT_COLORS[0])
})
