import { beforeEach, expect, test } from 'vitest'
import { PROJECT_COLORS } from './colors'
import { openDb } from './db'
import type { Db } from './db'
import { buildIndex } from './indexer'
import { createProject, updateProject } from './projects'

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

test('createProject normalizes, defaults the name, and picks a palette color', () => {
  const p = createProject(db, { key: 'news' })
  expect(p).toMatchObject({ key: 'NEWS', name: 'NEWS' })
  expect(PROJECT_COLORS).toContain(p.color)
  expect(code(() => createProject(db, { key: 'NEWS' }))).toBe('conflict')
  expect(code(() => createProject(db, { key: 'TOOLONG' }))).toBe('usage')
  expect(buildIndex(db).projects.map((x) => x.key)).toEqual(['NEWS', 'SPAR'])
})

test('updateProject changes name and color, rejects off-palette colors', () => {
  createProject(db, { key: 'NEWS', name: 'Newsletter' })
  expect(updateProject(db, 'news', { name: 'Feed', color: PROJECT_COLORS[3] })).toEqual({ key: 'NEWS', name: 'Feed', color: PROJECT_COLORS[3] })
  expect(code(() => updateProject(db, 'NEWS', { color: '#ffffff' }))).toBe('invalid')
  expect(code(() => updateProject(db, 'NEWS', { name: ' ' }))).toBe('usage')
  expect(code(() => updateProject(db, 'NOPE', { name: 'x' }))).toBe('not_found')
})
