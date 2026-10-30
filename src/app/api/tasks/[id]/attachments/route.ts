import { addAttachment, KbError, MAX_ATTACHMENT_BYTES, normalizeTaskKey, viewTask } from '@/core'
import { errorResponse, getState, refresh } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Multipart upload with a single `file` field.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const key = normalizeTaskKey((await params).id)
    if (Number(req.headers.get('content-length')) > MAX_ATTACHMENT_BYTES + 64 * 1024) {
      return Response.json({ error: { code: 'invalid', message: 'attachment exceeds 25 MB' } }, { status: 413 })
    }
    const file = (await req.formData().catch(() => null))?.get('file')
    if (!(file instanceof File)) throw new KbError('usage', 'expected multipart form data with a "file" field')
    const state = getState()
    addAttachment(state.db, key, { filename: file.name, mime: file.type, data: new Uint8Array(await file.arrayBuffer()) })
    refresh(state)
    return Response.json(viewTask(state.index, key))
  } catch (err) {
    return errorResponse(err)
  }
}
