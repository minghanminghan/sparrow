import { get, set } from 'idb-keyval'
import type { Index } from '@/core'
import { VERSION, compareVersions } from '@/core/version'
import { storageKey } from './env'

export type CachedIndex = { index: Index; rev: string; savedAt: number; version: string }

const KEY = () => storageKey('index')

// A cache from before projects has numeric task ids and no project list, so it is dropped even within a major.
export function usableCache(c: CachedIndex | null, appVersion: string): CachedIndex | null {
  return c && Array.isArray(c.index.projects) && compareVersions(c.version, appVersion) !== 'incompatible' ? c : null
}

export async function loadCachedIndex(): Promise<CachedIndex | null> {
  try {
    return usableCache((await get<CachedIndex>(KEY())) ?? null, VERSION)
  } catch {
    return null
  }
}

export async function saveCachedIndex(c: CachedIndex): Promise<void> {
  try {
    await set(KEY(), c)
  } catch {}
}
