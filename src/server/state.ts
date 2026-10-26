import { EventEmitter } from 'node:events'
import path from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import { buildIndex, findWorkspace, isTaskFile, KbError } from '@/core'
import type { ErrorCode, Index, TaskView } from '@/core'

export type ServerEvent =
  | { type: 'upsert'; task: TaskView }
  | { type: 'remove'; id: string }
  | { type: 'snapshot'; index: Index }

export type State = { ws: string; index: Index; emitter: EventEmitter; watcher: FSWatcher }

declare global {
  // eslint-disable-next-line no-var
  var __kb: State | undefined
}

const DEBOUNCE_MS = 50

function createState(): State {
  const ws = findWorkspace()
  const emitter = new EventEmitter()
  emitter.setMaxListeners(0)
  const index = buildIndex(ws)
  const watcher = chokidar.watch(path.join(ws, 'tasks'), {
    ignoreInitial: true,
    ignored: (p, stats) => (stats?.isFile() ?? false) && !isTaskFile(path.basename(p)),
  })
  const state: State = { ws, index, emitter, watcher }

  let timer: ReturnType<typeof setTimeout> | undefined
  watcher.on('all', () => {
    clearTimeout(timer)
    timer = setTimeout(() => refresh(state), DEBOUNCE_MS)
  })

  return state
}

export function getState(): State {
  if (!globalThis.__kb) globalThis.__kb = createState()
  return globalThis.__kb
}

// A listener throwing (e.g. an SSE connection enqueueing on a closed
// controller) must never stop other listeners from being notified, nor
// propagate out of refresh() — refresh() runs both inside API route
// try/catch blocks and bare inside the watcher's debounce setTimeout,
// where an uncaught exception would crash the whole `next start` process.
function safeEmit(emitter: EventEmitter, event: ServerEvent): void {
  for (const listener of emitter.listeners('event')) {
    try {
      ;(listener as (e: ServerEvent) => void)(event)
    } catch (err) {
      console.error('sparrow: event listener failed', err)
    }
  }
}

export function refresh(state: State): void {
  const next = buildIndex(state.ws)
  const oldById = new Map(state.index.tasks.map((t) => [t.id, t]))
  const nextById = new Map(next.tasks.map((t) => [t.id, t]))

  for (const [id, task] of nextById) {
    const prev = oldById.get(id)
    if (!prev || JSON.stringify(prev) !== JSON.stringify(task)) {
      safeEmit(state.emitter, { type: 'upsert', task })
    }
  }
  for (const id of oldById.keys()) {
    if (!nextById.has(id)) safeEmit(state.emitter, { type: 'remove', id })
  }

  state.index = next
}

const STATUS: Record<ErrorCode, number> = { usage: 400, not_found: 404, conflict: 409, invalid: 422 }

export function errorResponse(err: unknown): Response {
  if (err instanceof KbError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: STATUS[err.code] })
  }
  const message = err instanceof Error ? err.message : String(err)
  return Response.json({ error: { code: 'internal', message } }, { status: 500 })
}
