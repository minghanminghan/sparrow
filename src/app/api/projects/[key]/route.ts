import { updateProject } from '@/core'
import { errorResponse, getState, refresh } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  try {
    const { key } = await params
    const state = getState()
    const patch = (await req.json()) as { name?: string; color?: string }
    const project = updateProject(state.db, key, patch)
    refresh(state)
    return Response.json(project)
  } catch (err) {
    return errorResponse(err)
  }
}
