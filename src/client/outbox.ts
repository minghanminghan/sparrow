import { get, set } from 'idb-keyval'
import type { CreateInput, TaskView } from '@/core'
import { ApiError } from './api'
import { storageKey } from './env'

export type OutboxEntry = {
  clientId: string
  input: CreateInput
  photos: { name: string; blob: Blob }[]
  createdAt: number
  taskId?: string
  error?: string
}

export type OutboxDeps = {
  createTask(input: CreateInput, signal: AbortSignal): Promise<TaskView>
  uploadAttachment(id: string, file: File, signal: AbortSignal): Promise<TaskView>
}

export const CREATE_TIMEOUT_MS = 8000
export const UPLOAD_TIMEOUT_MS = 30000

const KEY = () => storageKey('outbox')

export function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return false
  return err instanceof TypeError || (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError'))
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const aborted = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new DOMException('Timed out', 'TimeoutError'))
    }, ms)
  })
  try {
    return await Promise.race([run(controller.signal), aborted])
  } finally {
    clearTimeout(timer)
  }
}

export async function flushEntry(
  e: OutboxEntry,
  deps: OutboxDeps,
): Promise<{ entry: OutboxEntry | null; task?: TaskView; cause?: unknown }> {
  let entry = e
  let task: TaskView | undefined
  function fail(err: unknown) {
    const next = isNetworkError(err) ? entry : { ...entry, error: err instanceof Error ? err.message : String(err) }
    return { entry: next, task, cause: err }
  }
  if (!entry.taskId) {
    try {
      task = await withTimeout(CREATE_TIMEOUT_MS, (signal) =>
        deps.createTask({ ...entry.input, clientId: entry.clientId }, signal),
      )
    } catch (err) {
      return fail(err)
    }
    entry = { ...entry, taskId: task.id }
  }
  while (entry.photos.length) {
    const [photo, ...rest] = entry.photos
    try {
      const file = new File([photo.blob], photo.name, { type: photo.blob.type })
      task = await withTimeout(UPLOAD_TIMEOUT_MS, (signal) => deps.uploadAttachment(entry.taskId!, file, signal))
    } catch (err) {
      return fail(err)
    }
    entry = { ...entry, photos: rest }
  }
  return { entry: null, task }
}

export async function loadOutbox(): Promise<OutboxEntry[]> {
  try {
    return (await get<OutboxEntry[]>(KEY())) ?? []
  } catch {
    return []
  }
}

export async function saveOutbox(entries: OutboxEntry[]): Promise<void> {
  try {
    await set(KEY(), entries)
  } catch {}
}
