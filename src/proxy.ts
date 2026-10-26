import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { compareVersions, VERSION, VERSION_HEADER } from '@/core/version'

// Rejects API calls from clients on a different major version. No header (browsers, curl) is allowed.
export function proxy(req: NextRequest): Response {
  const client = req.headers.get(VERSION_HEADER)
  const headers = { [VERSION_HEADER]: VERSION }
  if (client && req.nextUrl.pathname !== '/api/version' && compareVersions(client, VERSION) === 'incompatible') {
    const message = `client version ${client} is incompatible with server version ${VERSION}`
    return Response.json({ error: { code: 'version', message } }, { status: 426, headers })
  }
  return NextResponse.next({ headers })
}

export const config = { matcher: '/api/:path*' }
