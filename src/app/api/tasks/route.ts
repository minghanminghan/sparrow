import { gzipSync } from 'node:zlib'
import { createTask, viewTask } from '@/core'
import type { CreateInput } from '@/core'
import { errorResponse, getState, refresh } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  try {
    const state = getState()
    const etag = `"${state.rev}"`
    if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } })
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ETag: etag, Vary: 'Accept-Encoding' }
    const json = JSON.stringify(state.index)
    // Next 16.4 hands route-handler Content-Type to its compression middleware as an array, which it then refuses to compress.
    if (/\bgzip\b/.test(req.headers.get('accept-encoding') ?? '')) {
      headers['Content-Encoding'] = 'gzip'
      return new Response(gzipSync(json), { headers })
    }
    return new Response(json, { headers })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const state = getState()
    const input = (await req.json()) as CreateInput
    const task = createTask(state.db, input)
    refresh(state)
    return Response.json(viewTask(state.index, task.id))
  } catch (err) {
    return errorResponse(err)
  }
}
