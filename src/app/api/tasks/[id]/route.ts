import { applyOp, deleteTask, KbError, viewTask } from '@/core'
import type { Op } from '@/core'
import { errorResponse, getState, refresh } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params
    const state = getState()
    const { op } = (await req.json()) as { op: Op }
    await applyOp(state.ws, id, op)
    refresh(state)
    const view = viewTask(state.index, id)
    if (!view) throw new KbError('not_found', `task ${id} not found`)
    return Response.json(view)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params
    const state = getState()
    await deleteTask(state.ws, id)
    refresh(state)
    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
