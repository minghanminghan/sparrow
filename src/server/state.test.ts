import { EventEmitter } from 'node:events'
import { describe, expect, test } from 'vitest'
import { buildIndex, createTask, openDb } from '@/core'
import { refresh, revOf } from '@/server/state'
import type { ServerEvent, State } from '@/server/state'

function setup(): { state: State; events: ServerEvent[] } {
  const db = openDb(':memory:')
  const index = buildIndex(db)
  const emitter = new EventEmitter()
  const events: ServerEvent[] = []
  emitter.on('event', (e: ServerEvent) => events.push(e))
  return { state: { db, index, rev: revOf(index), emitter }, events }
}

describe('state', () => {
  test('revOf is stable for the same index and changes after a create', () => {
    const { state } = setup()
    expect(revOf(buildIndex(state.db))).toBe(state.rev)
    createTask(state.db, { title: 'a' })
    expect(revOf(buildIndex(state.db))).not.toBe(state.rev)
  })

  test('refresh emits upserts then one rev event equal to state.rev', () => {
    const { state, events } = setup()
    const before = state.rev
    createTask(state.db, { title: 'a' })
    refresh(state)
    expect(events.map((e) => e.type)).toEqual(['upsert', 'rev'])
    expect(events.at(-1)).toEqual({ type: 'rev', rev: state.rev })
    expect(state.rev).not.toBe(before)
  })

  test('refresh with no change emits nothing', () => {
    const { state, events } = setup()
    refresh(state)
    expect(events).toEqual([])
  })
})
