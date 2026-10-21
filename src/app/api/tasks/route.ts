import { createTask, viewTask } from '@/core'
import type { CreateInput } from '@/core'
import { errorResponse, getState, refresh } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const state = getState()
  return Response.json(state.index)
}

export async function POST(req: Request): Promise<Response> {
  try {
    const state = getState()
    const input = (await req.json()) as CreateInput
    const task = await createTask(state.ws, input)
    refresh(state)
    return Response.json(viewTask(state.index, task.id))
  } catch (err) {
    return errorResponse(err)
  }
}
