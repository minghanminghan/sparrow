import { generateKeyBetween } from 'fractional-indexing'

export function rankBetween(before?: string, after?: string): string {
  return generateKeyBetween(before ?? null, after ?? null)
}
