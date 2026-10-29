import { ENVS, KbError, writeDevEnv } from '@/core'
import type { Env } from '@/core'
import { errorResponse } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Switches a `pnpm dev` server between the local DB and the prod server. See scripts/dev.sh.
export async function POST(req: Request): Promise<Response> {
  try {
    if (process.env.NODE_ENV !== 'development') throw new KbError('not_found', 'only a dev server can switch env')
    const { env } = (await req.json()) as { env: Env }
    if (!ENVS.includes(env)) throw new KbError('usage', `env must be one of: ${ENVS.join(', ')}`)
    return Response.json(writeDevEnv(env))
  } catch (err) {
    return errorResponse(err)
  }
}
