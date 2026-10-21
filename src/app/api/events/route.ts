import { errorResponse, getState } from '@/server/state'
import type { ServerEvent } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PING_MS = 15000

function sse(data: string): Uint8Array {
  return new TextEncoder().encode(`data: ${data}\n\n`)
}

export async function GET(req: Request): Promise<Response> {
  try {
    const state = getState()

    const stream = new ReadableStream({
      start(controller) {
        let closed = false
        const cleanup = (): void => {
          if (closed) return
          closed = true
          clearInterval(ping)
          state.emitter.off('event', onEvent)
          try {
            controller.close()
          } catch {}
        }

        // Guards against enqueueing on an already-closed/errored controller
        // (e.g. a client that disconnected between ticks): a thrown error
        // here would otherwise surface as an uncaught exception at the
        // emitter/watcher callsite that triggered it.
        const safeEnqueue = (chunk: Uint8Array): void => {
          try {
            controller.enqueue(chunk)
          } catch {
            cleanup()
          }
        }

        const onEvent = (event: ServerEvent): void => safeEnqueue(sse(JSON.stringify(event)))
        state.emitter.on('event', onEvent)

        const ping = setInterval(() => safeEnqueue(new TextEncoder().encode(': ping\n\n')), PING_MS)

        req.signal.addEventListener('abort', cleanup)

        safeEnqueue(sse(JSON.stringify({ type: 'snapshot', index: state.index } satisfies ServerEvent)))
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}
