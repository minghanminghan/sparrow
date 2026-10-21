import { isDone } from '@/core/columns'
import type { Index, TaskView } from '@/core'
import { applyFilters } from '@/client/store'
import type { Filters } from '@/client/store'

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

function recentlyCompleted(completed?: string): boolean {
  if (!completed) return false
  return Date.now() - new Date(completed).getTime() <= FOURTEEN_DAYS_MS
}

/** Tasks for one board column: filtered, done-14-day rule applied, sorted by rank. */
export function visibleColumnTasks(index: Index, filters: Filters, columnKey: string): TaskView[] {
  const visible = applyFilters(index.tasks, { ...filters, showDone: true }, index.config)
  let tasks = visible.filter((t) => t.status === columnKey)
  if (isDone(index.config, columnKey) && !filters.showDone) {
    tasks = tasks.filter((t) => recentlyCompleted(t.completed))
  }
  return tasks
}
