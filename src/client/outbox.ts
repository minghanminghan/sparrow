import { get, set } from 'idb-keyval'
import type { CreateInput, TaskView } from '@/core'
import { ApiError } from './api'

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
  uploadAttachment(id: string, file: File): Promise<TaskView>
}

export const CREATE_TIMEOUT_MS = 8000

const KEY = 'outbox'

export function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return false
  return err instanceof TypeError || (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError'))
}

async function createWithTimeout(input: CreateInput, deps: OutboxDeps): Promise<TaskView> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const aborted = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new DOMException('Timed out', 'TimeoutError'))
    }, CREATE_TIMEOUT_MS)
  })
  try {
    return await Promise.race([deps.createTask(input, controller.signal), aborted])
  } finally {
    clearTimeout(timer)
  }
}

export async function flushEntry(
  e: OutboxEntry,
  deps: OutboxDeps,
): Promise<{ entry: OutboxEntry | null; task?: TaskView }> {
  let entry = e
  let task: TaskView | undefined
  function fail(err: unknown) {
    const next = isNetworkError(err) ? entry : { ...entry, error: err instanceof Error ? err.message : String(err) }
    return { entry: next, task }
  }
  if (!entry.taskId) {
    try {
      task = await createWithTimeout({ ...entry.input, clientId: entry.clientId }, deps)
    } catch (err) {
      return fail(err)
    }
    entry = { ...entry, taskId: task.id }
  }
  while (entry.photos.length) {
    const [photo, ...rest] = entry.photos
    try {
      task = await deps.uploadAttachment(entry.taskId!, new File([photo.blob], photo.name, { type: photo.blob.type }))
    } catch (err) {
      return fail(err)
    }
    entry = { ...entry, photos: rest }
  }
  return { entry: null, task }
}

export async function loadOutbox(): Promise<OutboxEntry[]> {
  try {
    return (await get<OutboxEntry[]>(KEY)) ?? []
  } catch {
    return []
  }
}

export async function saveOutbox(entries: OutboxEntry[]): Promise<void> {
  try {
    await set(KEY, entries)
  } catch {}
}
