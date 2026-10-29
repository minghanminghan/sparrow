import { EXIT, KbError } from '../core/errors'
import type { ErrorCode } from '../core/errors'
import { ENV_HEADER } from '../core/env'
import { compareVersions, VERSION, VERSION_HEADER } from '../core/version'
import { currentEnv, serverUrl } from './config'

let warned = false

// fetch for CLI → server calls: sends the version header and handles a server version mismatch.
export async function request(url: string | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set(VERSION_HEADER, VERSION)
  if (currentEnv() === 'dev') headers.set(ENV_HEADER, 'dev')
  const res = await fetch(url, { ...init, headers })
  checkServerVersion(res.headers.get(VERSION_HEADER) ?? (res.status === 426 ? 'unknown' : null))
  return res
}

export function checkServerVersion(server: string | null): void {
  if (!server) return
  const match = compareVersions(VERSION, server)
  if (match === 'incompatible') {
    throw new KbError('version', `sparrow ${VERSION} is incompatible with server ${server}. Run: sparrow upgrade`)
  }
  if (match === 'compatible' && !warned) {
    warned = true
    process.stderr.write(`sparrow: cli ${VERSION} differs from server ${server}. Run: sparrow upgrade\n`)
  }
}

// Calls `path` on the configured server; `raw` skips the version check (for `sparrow upgrade`).
export async function call(path: string, init: RequestInit = {}, raw = false): Promise<Response> {
  const base = serverUrl()
  try {
    return await (raw ? fetch : request)(base + path, init)
  } catch (err) {
    if (err instanceof KbError) throw err
    const cause = (err as { cause?: { code?: string; message?: string } }).cause
    const reason = cause?.code ?? cause?.message ?? (err as Error).message
    throw new KbError(
      'unavailable',
      `cannot reach the sparrow server at ${base} (${reason}). Check SPARROW_URL or --env`,
    )
  }
}

// Turns an API error body ({ error: { code, message } }) back into the matching KbError.
export async function toError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null
  const message = body?.error?.message ?? `server returned ${res.status} ${res.statusText}`
  const code = body?.error?.code
  return code && code in EXIT ? new KbError(code as ErrorCode, message) : new Error(message)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await call(path, init)
  if (!res.ok) throw await toError(res)
  return (await res.json()) as T
}

export function sendJson<T>(path: string, method: string, data: unknown): Promise<T> {
  return api<T>(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
}
