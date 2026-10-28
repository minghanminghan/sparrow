import { describe, expect, it } from 'vitest'
import { usableCache, type CachedIndex } from './cache'

const entry = (version: string): CachedIndex => ({
  index: { tasks: [] } as unknown as CachedIndex['index'],
  rev: 'r1',
  savedAt: 1,
  version,
})

describe('usableCache', () => {
  it('loadCachedIndex ignores a different major version', () => {
    expect(usableCache(entry('1.4.0'), '2.0.0')).toBeNull()
  })

  it('same major is usable', () => {
    const c = entry('1.1.0')
    expect(usableCache(c, '1.3.0')).toBe(c)
  })
})
