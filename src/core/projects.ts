import { PROJECT_COLORS, pickColor } from './colors'
import type { Db } from './db'
import { KbError } from './errors'
import { normalizeProjectKey } from './keys'
import type { Project } from './types'

export function loadProjects(db: Db): Project[] {
  return db.prepare('SELECT key, name, color FROM projects ORDER BY key').all() as Project[]
}

export function createProject(db: Db, input: { key: string; name?: string }): Project {
  const key = normalizeProjectKey(input.key)
  const name = input.name?.trim() || key
  const color = pickColor(loadProjects(db).map((p) => p.color))
  const res = db.prepare('INSERT INTO projects (key, name, color, next_number) VALUES (?, ?, ?, 1) ON CONFLICT DO NOTHING').run(key, name, color)
  if (res.changes === 0) throw new KbError('conflict', `project ${key} already exists`)
  return { key, name, color }
}

export function updateProject(db: Db, key: string, patch: { name?: string; color?: string }): Project {
  const k = normalizeProjectKey(key)
  const cur = loadProjects(db).find((p) => p.key === k)
  if (!cur) throw new KbError('not_found', `project ${k} not found`)
  const name = patch.name === undefined ? cur.name : patch.name.trim()
  if (!name) throw new KbError('usage', 'project name cannot be empty')
  const color = patch.color ?? cur.color
  if (!PROJECT_COLORS.includes(color)) throw new KbError('invalid', `color ${color} is not in the palette`)
  db.prepare('UPDATE projects SET name = ?, color = ? WHERE key = ?').run(name, color, k)
  return { key: k, name, color }
}
