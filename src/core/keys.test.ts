import { expect, test } from 'vitest'
import { PROJECT_COLORS, pickColor } from './colors'
import { normalizeProjectKey, normalizeTaskKey, splitTaskKey } from './keys'

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (err) {
    return (err as { code?: string }).code
  }
}

test('normalizeTaskKey uppercases and validates', () => {
  expect(normalizeTaskKey('spar-1')).toBe('SPAR-1')
  expect(normalizeTaskKey('V2-10')).toBe('V2-10')
  expect(code(() => normalizeTaskKey('28'))).toBe('usage')
  expect(() => normalizeTaskKey('28')).toThrow('like SPAR-28')
  for (const bad of ['SPAR', 'SPAR-0', 'SPAR-x', '1AB-2', 'TOOLONG-1', 'A-B-1']) expect(code(() => normalizeTaskKey(bad))).toBe('usage')
})

test('normalizeProjectKey', () => {
  expect(normalizeProjectKey(' news ')).toBe('NEWS')
  expect(normalizeProjectKey('v2')).toBe('V2')
  for (const bad of ['', '2V', 'SEVENCH', 'NE-WS']) expect(code(() => normalizeProjectKey(bad))).toBe('usage')
})

test('splitTaskKey', () => {
  expect(splitTaskKey('V2-10')).toEqual({ project: 'V2', number: 10 })
})

test('pickColor avoids used colors until all are used', () => {
  const used = PROJECT_COLORS.slice(1)
  expect(pickColor(used)).toBe(PROJECT_COLORS[0])
  expect(PROJECT_COLORS).toContain(pickColor(PROJECT_COLORS))
})
