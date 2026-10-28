import { constants, createGzip } from 'node:zlib'
import { errorResponse, getState } from '@/server/state'
import type { ServerEvent } from '@/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PING_MS = 15000

function sse(data: string): string {
  return `data: ${data}\n\n`
}

export async function GET(req: Request): Promise<Response> {
  try {
    const state = getState()
    const clientRev = new URL(req.url).searchParams.get('rev')
    // Gzipped by hand (see /api/tasks); a sync flush after each write keeps events from being buffered.
    const gzip = /\bgzip\b/.test(req.headers.get('accept-encoding') ?? '') ? createGzip() : null

    const stream = new ReadableStream({
      start(controller) {
        let closed = false
        const cleanup = (): void => {
          if (closed) return
          closed = true
          clearInterval(ping)
          state.emitter.off('event', onEvent)
          gzip?.destroy()
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

        const send = (text: string): void => {
          if (closed) return
          if (!gzip) return safeEnqueue(new TextEncoder().encode(text))
          gzip.write(text)
          gzip.flush(constants.Z_SYNC_FLUSH)
        }
        gzip?.on('data', safeEnqueue)
        gzip?.on('error', cleanup)

        const onEvent = (event: ServerEvent): void => send(sse(JSON.stringify(event)))
        state.emitter.on('event', onEvent)

        const ping = setInterval(() => send(': ping\n\n'), PING_MS)

        req.signal.addEventListener('abort', cleanup)

        const first: ServerEvent =
          clientRev === state.rev
            ? { type: 'unchanged', rev: state.rev }
            : { type: 'snapshot', index: state.index, rev: state.rev }
        send(sse(JSON.stringify(first)))
      },
    })

    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      Vary: 'Accept-Encoding',
    }
    if (gzip) headers['Content-Encoding'] = 'gzip'
    return new Response(stream, { headers })
  } catch (err) {
    return errorResponse(err)
  }
}
