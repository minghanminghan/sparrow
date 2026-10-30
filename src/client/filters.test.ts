import { expect, test } from 'vitest'
import { DEFAULT_CONFIG } from '@/core'
import type { TaskView } from '@/core'
import { applyFilters } from '@/client/store'
import { pendingProject } from '@/components/board/visibleTasks'

const config = DEFAULT_CONFIG

const view = (p: Partial<TaskView>): TaskView => ({
  id: 'SPAR-1',
  project: 'SPAR',
  title: 't',
  status: 'todo',
  rank: 'a0',
  links: [],
  refs: [],
  created: '',
  updated: '',
  body: '',
  comments: [],
  extra: {},
  titleHash: '',
  bodyHash: '',
  backlinks: [],
  blocked: false,
  children: [],
  progress: { done: 0, total: 0 },
  attachments: [],
  ...p,
})

test('project filter keeps only picked projects', () => {
  const tasks = [view({ id: 'SPAR-1', project: 'SPAR' }), view({ id: 'NEWS-1', project: 'NEWS' }), view({ id: 'V2-1', project: 'V2' })]
  const base = { q: '', hideSubtasks: false, showDone: true, projects: [] }
  expect(applyFilters(tasks, base, config).map((t) => t.id)).toHaveLength(3)
  expect(applyFilters(tasks, { ...base, projects: ['NEWS', 'V2'] }, config).map((t) => t.id)).toEqual(['NEWS-1', 'V2-1'])
})

test('pendingProject falls back to the parent key', () => {
  expect(pendingProject({ title: 'x', project: 'news' })).toBe('NEWS')
  expect(pendingProject({ title: 'x', parent: 'v2-3' })).toBe('V2')
  expect(pendingProject({ title: 'x' })).toBeUndefined()
})
