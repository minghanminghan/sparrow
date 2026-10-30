import { EventEmitter } from 'node:events'
import { buildIndex, hash, KbError, openDb } from '@/core'
import type { Db, ErrorCode, Index, TaskView } from '@/core'

export type ServerEvent =
  | { type: 'upsert'; task: TaskView }
  | { type: 'remove'; id: string }
  | { type: 'snapshot'; index: Index; rev: string }
  | { type: 'unchanged'; rev: string }
  | { type: 'rev'; rev: string }

export type State = { db: Db; index: Index; rev: string; emitter: EventEmitter }

export function revOf(index: Index): string {
  return hash(JSON.stringify(index))
}

declare global {
  // eslint-disable-next-line no-var
  var __kb: State | undefined
}

function createState(): State {
  const db = openDb()
  const emitter = new EventEmitter()
  emitter.setMaxListeners(0)
  const index = buildIndex(db)
  return { db, index, rev: revOf(index), emitter }
}

export function getState(): State {
  if (!globalThis.__kb) globalThis.__kb = createState()
  return globalThis.__kb
}

// A listener throwing (e.g. an SSE connection enqueueing on a closed
// controller) must never stop other listeners from being notified, nor
// turn a successful write into an error response.
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
  const next = buildIndex(state.db)
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

  const configChanged =
    JSON.stringify(next.config) !== JSON.stringify(state.index.config) || JSON.stringify(next.projects) !== JSON.stringify(state.index.projects)
  state.index = next
  const rev = revOf(next)
  if (rev !== state.rev) {
    state.rev = rev
    // A bare rev would let clients cache the new rev with a stale config or project list.
    safeEmit(state.emitter, configChanged ? { type: 'snapshot', index: next, rev } : { type: 'rev', rev })
  }
}

const STATUS: Record<ErrorCode, number> = { usage: 400, not_found: 404, conflict: 409, invalid: 422, version: 426, unavailable: 503 }

export function errorResponse(err: unknown): Response {
  if (err instanceof KbError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: STATUS[err.code] })
  }
  const message = err instanceof Error ? err.message : String(err)
  return Response.json({ error: { code: 'internal', message } }, { status: 500 })
}
