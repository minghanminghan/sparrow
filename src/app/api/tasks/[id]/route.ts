import { applyOp, deleteTask, KbError, normalizeTaskKey, viewTask } from '@/core'
import type { Op } from '@/core'
import { errorResponse, getState, refresh } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const key = normalizeTaskKey((await params).id)
    const view = viewTask(getState().index, key)
    if (!view) throw new KbError('not_found', `task ${key} not found`)
    return Response.json(view)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const key = normalizeTaskKey((await params).id)
    const state = getState()
    const { op } = (await req.json()) as { op: Op }
    // A comment without an author (the CLI default) is from the Tailscale user, else the board user.
    if (op?.type === 'addComment' && !op.author) {
      op.author = req.headers.get('Tailscale-User-Login') || state.index.config.user || 'ai'
    }
    applyOp(state.db, key, op)
    refresh(state)
    const view = viewTask(state.index, key)
    if (!view) throw new KbError('not_found', `task ${key} not found`)
    return Response.json(view)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const key = normalizeTaskKey((await params).id)
    const state = getState()
    deleteTask(state.db, key)
    refresh(state)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
