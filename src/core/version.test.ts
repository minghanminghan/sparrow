import { expect, test } from 'vitest'
import { compareVersions } from './version'

test('compareVersions', () => {
  expect(compareVersions('1.2.3', '1.2.3')).toBe('same')
  expect(compareVersions('1.2.3', '1.4.0')).toBe('compatible')
  expect(compareVersions('1.2.3', '1.2.4')).toBe('compatible')
  expect(compareVersions('1.2.3', '2.0.0')).toBe('incompatible')
  expect(compareVersions('junk', '1.0.0')).toBe('incompatible')
})
