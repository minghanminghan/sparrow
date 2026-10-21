import { KbError } from './errors'
import type { Column, Config, Role } from './types'

export const DEFAULT_CONFIG: Config = {
  idPrefix: 'KB',
  user: 'andrew',
  columns: [
    { key: 'backlog', name: 'Backlog' },
    { key: 'todo', name: 'To do', role: 'ready' },
    { key: 'in-progress', name: 'In progress', role: 'active' },
    { key: 'review', name: 'In review' },
    { key: 'done', name: 'Done', role: 'done' },
  ],
}

export function validateConfig(c: Config): void {
  const count = (role: Role) => c.columns.filter((col) => col.role === role).length
  if (count('ready') !== 1) throw new KbError('invalid', 'config must have exactly one "ready" column')
  if (count('active') !== 1) throw new KbError('invalid', 'config must have exactly one "active" column')
  if (count('done') < 1) throw new KbError('invalid', 'config must have at least one "done" column')
}

export function columnByRole(c: Config, role: Role): Column {
  const col = c.columns.find((col) => col.role === role)
  if (!col) throw new KbError('invalid', `no column with role "${role}"`)
  return col
}

export function isDone(c: Config, status: string): boolean {
  return c.columns.some((col) => col.key === status && col.role === 'done')
}
