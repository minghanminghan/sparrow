import { getState } from '@/server/state'
import type { ServerEvent } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PING_MS = 15000

function sse(data: string): Uint8Array {
  return new TextEncoder().encode(`data: ${data}\n\n`)
}

export async function GET(req: Request): Promise<Response> {
  const state = getState()

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(sse(JSON.stringify({ type: 'snapshot', index: state.index } satisfies ServerEvent)))

      const onEvent = (event: ServerEvent) => controller.enqueue(sse(JSON.stringify(event)))
      state.emitter.on('event', onEvent)

      const ping = setInterval(() => controller.enqueue(new TextEncoder().encode(': ping\n\n')), PING_MS)

      req.signal.addEventListener('abort', () => {
        clearInterval(ping)
        state.emitter.off('event', onEvent)
        try {
          controller.close()
        } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
