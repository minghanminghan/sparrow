import { version } from '../../package.json'

export const VERSION: string = version
export const VERSION_HEADER = 'X-Sparrow-Version'

export type VersionMatch = 'same' | 'compatible' | 'incompatible'

// Different major (or unparsable) → incompatible; minor/patch differences → compatible.
export function compareVersions(a: string, b: string): VersionMatch {
  if (a === b) return 'same'
  const major = (v: string): number => Number(v.split('.')[0])
  return major(a) === major(b) ? 'compatible' : 'incompatible'
}
