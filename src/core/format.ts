import { createHash } from 'node:crypto'

export function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 12)
}
