import { create } from 'zustand'
import { isDone } from '@/core/columns'
import type { Config, CreateInput, Index, Op, TaskView } from '@/core'
import type { ServerEvent } from '@/server/state'
import { ApiError, applyOp as apiApplyOp, createTask as apiCreateTask, removeTask as apiRemoveTask } from './api'

export type Filters = {
  q: string
  hideSubtasks: boolean
  project?: string
  assignee?: string
  due?: 'overdue' | 'week'
  showDone: boolean
}

type Toast = { id: string; message: string }

type KbStore = {
  index: Index | null
  byId: Record<string, TaskView>
  filters: Filters
  panelId: string | null
  toasts: Toast[]
  connect(): void
  op(id: string, op: Op, optimistic?: (t: TaskView) => TaskView): Promise<void>
  create(input: CreateInput): Promise<TaskView>
  remove(id: string): Promise<void>
  openPanel(id: string | null): void
  setFilters(p: Partial<Filters>): void
  dismissToast(id: string): void
}

let eventSource: EventSource | null = null
const TOAST_MS = 6000

function sortByRank(tasks: TaskView[]): TaskView[] {
  return [...tasks].sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
}

function replaceTask(index: Index, task: TaskView): Index {
  return { ...index, tasks: sortByRank([...index.tasks.filter((t) => t.id !== task.id), task]) }
}

function removeFromIndex(index: Index, id: string): Index {
  return { ...index, tasks: index.tasks.filter((t) => t.id !== id) }
}

export const useKb = create<KbStore>()((set, get) => {
  // Bookkeeping for op() sequencing — not reactive state, so plain objects.
  // `confirmed[id]` is the last server-confirmed TaskView (from a snapshot,
  // an upsert applied while idle, or a successful op's response); `inFlight[id]`
  // counts ops currently in flight for that task, so a failing op only rolls
  // back to `confirmed` when it's the last one still outstanding — otherwise
  // an older op's failure would stomp a newer op's optimistic/confirmed state.
  const confirmed: Record<string, TaskView> = {}
  const inFlight: Record<string, number> = {}

  function pushToast(message: string): void {
    const toast: Toast = { id: crypto.randomUUID(), message }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toast.id) })), TOAST_MS)
  }

  return {
    index: null,
    byId: {},
    filters: { q: '', hideSubtasks: false, showDone: false },
    panelId: null,
    toasts: [],

    connect() {
      if (eventSource) return
      eventSource = new EventSource('/api/events')
      eventSource.onmessage = (ev: MessageEvent<string>) => {
        const event = JSON.parse(ev.data) as ServerEvent
        if (event.type === 'snapshot') {
          for (const t of event.index.tasks) confirmed[t.id] = t
          set({ index: event.index, byId: Object.fromEntries(event.index.tasks.map((t) => [t.id, t])) })
          return
        }
        const index = get().index
        if (!index) return
        if (event.type === 'upsert') {
          // An in-flight op for this task will overwrite byId with its own
          // POST response when it settles, so an update here would either be
          // redundant or, worse, clobber a newer optimistic write.
          if ((inFlight[event.task.id] ?? 0) > 0) return
          const prev = get().byId[event.task.id]
          if (prev && JSON.stringify(prev) === JSON.stringify(event.task)) return
          confirmed[event.task.id] = event.task
          set({ index: replaceTask(index, event.task), byId: { ...get().byId, [event.task.id]: event.task } })
        } else if (event.type === 'remove') {
          delete confirmed[event.id]
          delete inFlight[event.id]
          const byId = { ...get().byId }
          delete byId[event.id]
          set({ index: removeFromIndex(index, event.id), byId })
        }
      }
    },

    async op(id, opArg, optimistic) {
      const current = get().byId[id]
      if (optimistic && current) {
        const next = optimistic(current)
        const index = get().index
        set({ byId: { ...get().byId, [id]: next }, index: index ? replaceTask(index, next) : index })
      }
      inFlight[id] = (inFlight[id] ?? 0) + 1
      let thrown: unknown
      try {
        const result = await apiApplyOp(id, opArg)
        confirmed[id] = result
      } catch (err) {
        thrown = err
      }
      inFlight[id] = (inFlight[id] ?? 1) - 1
      const isLast = inFlight[id] <= 0
      if (isLast) delete inFlight[id]
      // Only write the (possibly stale, since other ops may have superseded
      // it) server result into byId once every op for this task has
      // settled — otherwise an earlier op's response would stomp the
      // optimistic state of a still-in-flight later op (visible as a
      // snap-back flicker on e.g. a cross-column drag's two sequential ops).
      if (isLast) {
        const base = confirmed[id]
        if (base) {
          const index = get().index
          set({ byId: { ...get().byId, [id]: base }, index: index ? replaceTask(index, base) : index })
        }
      }
      if (thrown) {
        const code = thrown instanceof ApiError ? thrown.code : undefined
        if (code !== 'conflict') pushToast(thrown instanceof Error ? thrown.message : String(thrown))
        throw thrown
      }
    },

    async create(input) {
      try {
        const task = await apiCreateTask(input)
        confirmed[task.id] = task
        const index = get().index
        set({ byId: { ...get().byId, [task.id]: task }, index: index ? replaceTask(index, task) : index })
        return task
      } catch (err) {
        pushToast(err instanceof Error ? err.message : String(err))
        throw err
      }
    },

    async remove(id) {
      try {
        await apiRemoveTask(id)
        delete confirmed[id]
        delete inFlight[id]
        const index = get().index
        const byId = { ...get().byId }
        delete byId[id]
        set({ byId, index: index ? removeFromIndex(index, id) : index })
      } catch (err) {
        pushToast(err instanceof Error ? err.message : String(err))
        throw err
      }
    },

    openPanel(id) {
      set({ panelId: id })
    },

    setFilters(p) {
      set((s) => ({ filters: { ...s.filters, ...p } }))
    },

    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    },
  }
})

const DAY_MS = 24 * 60 * 60 * 1000

function localDay(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function todayLocalDay(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function descendantsOf(tasks: TaskView[], rootId: string): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const keep = new Set<string>()
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (keep.has(id)) continue
    keep.add(id)
    const t = byId.get(id)
    if (t) stack.push(...t.children)
  }
  return keep
}

// showDone is always applied here; the board (Task 8) handles its own
// done column (14-day cutoff) separately and should pass showDone: true
// so this filter doesn't also hide those cards.
export function applyFilters(tasks: TaskView[], f: Filters, config: Config): TaskView[] {
  let result = tasks

  const q = f.q.trim().toLowerCase()
  if (q) result = result.filter((t) => t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))

  if (f.hideSubtasks) result = result.filter((t) => !t.parent)

  if (f.project) {
    const keep = descendantsOf(tasks, f.project)
    result = result.filter((t) => keep.has(t.id))
  }

  if (f.assignee) result = result.filter((t) => t.assignee === f.assignee)

  if (f.due) {
    const today = todayLocalDay()
    result = result.filter((t) => {
      if (!t.due) return false
      const day = localDay(t.due)
      return f.due === 'overdue' ? day < today : day >= today && day <= today + 6 * DAY_MS
    })
  }

  if (!f.showDone) result = result.filter((t) => !isDone(config, t.status))

  return result
}

export function dueState(due?: string): 'overdue' | 'soon' | null {
  if (!due) return null
  const today = todayLocalDay()
  const day = localDay(due)
  if (day < today) return 'overdue'
  if (day <= today + 2 * DAY_MS) return 'soon'
  return null
}
