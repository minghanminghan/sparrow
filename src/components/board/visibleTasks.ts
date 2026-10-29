import { isDone } from '@/core/columns'
import type { Index, TaskView } from '@/core'
import { applyFilters } from '@/client/store'
import type { Filters } from '@/client/store'
import type { OutboxEntry } from '@/client/outbox'

// Monday 00:00 local time.
function startOfWeek(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

function completedThisWeek(completed?: string): boolean {
  if (!completed) return false
  return new Date(completed).getTime() >= startOfWeek()
}

/** Tasks for one board column: filtered, done-this-week rule applied, sorted by rank. */
export function visibleColumnTasks(index: Index, filters: Filters, columnKey: string): TaskView[] {
  const visible = applyFilters(index.tasks, { ...filters, showDone: true }, index.config)
  let tasks = visible.filter((t) => t.status === columnKey)
  if (isDone(index.config, columnKey) && !filters.showDone) {
    tasks = tasks.filter((t) => completedThisWeek(t.completed))
  }
  return tasks
}

/** Outbox entries shown as pending cards in a column: not yet created, or failed. */
export function pendingForColumn(pending: OutboxEntry[], readyKey: string | undefined, columnKey: string): OutboxEntry[] {
  return pending.filter((e) => (!e.taskId || e.error) && (e.input.status ?? readyKey) === columnKey)
}
