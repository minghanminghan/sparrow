import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskView } from '@/core'
import { ApiError } from './api'
import { CREATE_TIMEOUT_MS, flushEntry, type OutboxDeps, type OutboxEntry } from './outbox'

const task = { id: 'T-1', title: 'x' } as TaskView
const entry = (over: Partial<OutboxEntry> = {}): OutboxEntry => ({
  clientId: 'c1',
  input: { title: 'x' },
  photos: [],
  createdAt: 1,
  ...over,
})
const deps = (over: Partial<OutboxDeps> = {}): OutboxDeps => ({
  createTask: vi.fn().mockResolvedValue(task),
  uploadAttachment: vi.fn().mockResolvedValue(task),
  ...over,
})

afterEach(() => vi.useRealTimers())

describe('flushEntry', () => {
  it('flush creates the task, uploads photos, and finishes', async () => {
    const d = deps()
    const photos = [
      { name: 'a.png', blob: new Blob(['a']) },
      { name: 'b.png', blob: new Blob(['b']) },
    ]
    const r = await flushEntry(entry({ photos }), d)
    expect(r.entry).toBeNull()
    expect(d.uploadAttachment).toHaveBeenCalledTimes(2)
    expect(vi.mocked(d.uploadAttachment).mock.calls[0][0]).toBe('T-1')
  })

  it('flush retries with the same clientId', async () => {
    const createTask = vi.fn().mockRejectedValueOnce(new TypeError('Load failed')).mockResolvedValue(task)
    const d = deps({ createTask })
    const r = await flushEntry(entry(), d)
    expect(r.entry).not.toBeNull()
    expect(r.entry?.error).toBeUndefined()
    await flushEntry(r.entry!, d)
    expect(createTask.mock.calls[1][0].clientId).toBe(createTask.mock.calls[0][0].clientId)
  })

  it('flush keeps taskId when a photo upload fails on the network', async () => {
    const d = deps({ uploadAttachment: vi.fn().mockRejectedValue(new TypeError('Load failed')) })
    const r = await flushEntry(entry({ photos: [{ name: 'a.png', blob: new Blob(['a']) }] }), d)
    expect(r.entry?.taskId).toBe('T-1')
    await flushEntry(r.entry!, d)
    expect(d.createTask).toHaveBeenCalledTimes(1)
  })

  it('flush marks a 4xx as error and keeps it', async () => {
    const d = deps({ createTask: vi.fn().mockRejectedValue(new ApiError('not_found', 'task 9 not found')) })
    const r = await flushEntry(entry(), d)
    expect(r.entry?.error).toBe('task 9 not found')
  })

  it('create queues after CREATE_TIMEOUT_MS', async () => {
    vi.useFakeTimers()
    const d = deps({ createTask: vi.fn(() => new Promise<TaskView>(() => {})) })
    const p = flushEntry(entry(), d)
    await vi.advanceTimersByTimeAsync(CREATE_TIMEOUT_MS)
    const r = await p
    expect(r.entry).not.toBeNull()
    expect(r.entry?.error).toBeUndefined()
  })
})
