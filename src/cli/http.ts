import { KbError } from '../core'
import { compareVersions, VERSION, VERSION_HEADER } from '../core/version'

let warned = false

// fetch for CLI → server calls: sends the version header and handles a server version mismatch.
export async function request(url: string | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set(VERSION_HEADER, VERSION)
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
