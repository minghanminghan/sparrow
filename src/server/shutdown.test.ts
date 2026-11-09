import { describe, expect, test, vi } from 'vitest'
import { onShutdown } from './shutdown'

describe('onShutdown', () => {
  test('runs registered closers on SIGTERM, but not removed ones', () => {
    const kept = vi.fn()
    const removed = vi.fn()
    onShutdown(kept)
    onShutdown(removed)()
    process.emit('SIGTERM')
    expect(kept).toHaveBeenCalledOnce()
    expect(removed).not.toHaveBeenCalled()
  })
})
