import type { CreateInput, ErrorCode, Index, Op, TaskView } from '@/core'
import { VERSION, VERSION_HEADER } from '@/core/version'

export class ApiError extends Error {
  code: ErrorCode | 'internal'
  constructor(code: ErrorCode | 'internal', message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(body?.error?.code ?? 'internal', body?.error?.message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

const HEADERS = { [VERSION_HEADER]: VERSION }
const JSON_HEADERS = { ...HEADERS, 'Content-Type': 'application/json' }

export function fetchIndex(): Promise<Index> {
  return fetch('/api/tasks', { headers: HEADERS }).then((res) => handle<Index>(res))
}

export function createTask(input: CreateInput): Promise<TaskView> {
  return fetch('/api/tasks', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(input) }).then((res) =>
    handle<TaskView>(res),
  )
}

export function applyOp(id: string, op: Op): Promise<TaskView> {
  return fetch(`/api/tasks/${id}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ op }) }).then(
    (res) => handle<TaskView>(res),
  )
}

export function removeTask(id: string): Promise<{ ok: true }> {
  return fetch(`/api/tasks/${id}`, { method: 'DELETE', headers: HEADERS }).then((res) => handle<{ ok: true }>(res))
}

export function uploadAttachment(id: string, file: File): Promise<TaskView> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`/api/tasks/${id}/attachments`, { method: 'POST', body: form }).then((res) => handle<TaskView>(res))
}

export function removeAttachment(id: string, attId: string): Promise<TaskView> {
  return fetch(`/api/tasks/${id}/attachments/${attId}`, { method: 'DELETE' }).then((res) => handle<TaskView>(res))
}
