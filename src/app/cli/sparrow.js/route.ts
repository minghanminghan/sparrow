import fs from 'node:fs'
import path from 'node:path'
import { VERSION, VERSION_HEADER } from '@/core/version'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The CLI bundle built by tsup, for `sparrow upgrade` and first installs.
export function GET(): Response {
  const headers = { [VERSION_HEADER]: VERSION }
  const file = path.join(process.cwd(), 'dist', 'cli.js')
  if (!fs.existsSync(file)) {
    return Response.json({ error: { code: 'not_found', message: 'CLI bundle not built; run pnpm build' } }, { status: 404, headers })
  }
  return new Response(new Uint8Array(fs.readFileSync(file)), {
    headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' },
  })
}
