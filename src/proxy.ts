import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { readDevState } from '@/core/dev-state'
import { ENV_HEADER, PROD_URL } from '@/core/env'
import { compareVersions, VERSION, VERSION_HEADER } from '@/core/version'

// Rejects API calls from clients on a different major version. No header (browsers, curl) is allowed.
// A dev server switched to prod (scripts/dev.sh) forwards API calls to the prod server.
export function proxy(req: NextRequest): Response {
  const client = req.headers.get(VERSION_HEADER)
  const headers = { [VERSION_HEADER]: VERSION }
  const { pathname, search } = req.nextUrl
  if (client && pathname !== '/api/version' && compareVersions(client, VERSION) === 'incompatible') {    const message = `client version ${client} is incompatible with server version ${VERSION}`
    return Response.json({ error: { code: 'version', message } }, { status: 426, headers })
  }
  if (
    process.env.NODE_ENV === 'development' &&
    pathname !== '/api/dev/env' &&
    req.headers.get(ENV_HEADER) !== 'dev' &&
    readDevState()?.env === 'prod'
  ) {
    // Dev code is often ahead of prod's version, so it skips prod's version check.
    const forwarded = new Headers(req.headers)
    forwarded.delete(VERSION_HEADER)
    return NextResponse.rewrite(new URL(pathname + search, PROD_URL), { request: { headers: forwarded } })
  }
  return NextResponse.next({ headers })
}

export const config = { matcher: '/api/:path*' }
