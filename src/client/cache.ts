import { get, set } from 'idb-keyval'
import type { Index } from '@/core'
import { VERSION, compareVersions } from '@/core/version'

export type CachedIndex = { index: Index; rev: string; savedAt: number; version: string }

const KEY = 'index'

export function usableCache(c: CachedIndex | null, appVersion: string): CachedIndex | null {
  return c && compareVersions(c.version, appVersion) !== 'incompatible' ? c : null
}

export async function loadCachedIndex(): Promise<CachedIndex | null> {
  try {
    return usableCache((await get<CachedIndex>(KEY)) ?? null, VERSION)
  } catch {
    return null
  }
}

export async function saveCachedIndex(c: CachedIndex): Promise<void> {
  try {
    await set(KEY, c)
  } catch {}
}
