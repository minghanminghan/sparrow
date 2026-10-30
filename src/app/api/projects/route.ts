import { createProject } from '@/core'
import { errorResponse, getState, refresh } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  try {
    const state = getState()
    const input = (await req.json()) as { key: string; name?: string }
    const project = createProject(state.db, input)
    refresh(state)
    return Response.json(project)
  } catch (err) {
    return errorResponse(err)
  }
}
