import { KbError } from './errors'

const PROJECT_RE = /^[A-Z][A-Z0-9]{0,5}$/
const TASK_RE = /^[A-Z][A-Z0-9]{0,5}-[1-9]\d*$/

export const MENTION_RE = /\[\[([A-Za-z][A-Za-z0-9]{0,5}-\d+)\]\]/g

export function normalizeProjectKey(s: string): string {
  const key = s.trim().toUpperCase()
  if (!PROJECT_RE.test(key)) throw new KbError('usage', `invalid project key "${s}": use 1-6 letters or digits, starting with a letter`)
  return key
}

export function normalizeTaskKey(s: string): string {
  const key = s.trim().toUpperCase()
  if (/^\d+$/.test(key)) throw new KbError('usage', `task ids are keys now, like SPAR-28 (got "${s}")`)
  if (!TASK_RE.test(key)) throw new KbError('usage', `invalid task id "${s}"`)
  return key
}

export function splitTaskKey(key: string): { project: string; number: number } {
  const i = key.lastIndexOf('-')
  return { project: key.slice(0, i), number: Number(key.slice(i + 1)) }
}
