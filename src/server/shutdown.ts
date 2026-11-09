// `next start` waits for open requests to end before it exits on SIGTERM, and an
// SSE stream never ends. Streams register here so a restart closes them instead
// of hanging until systemd kills the server.
const closers = new Set<() => void>()
let hooked = false

export function onShutdown(close: () => void): () => void {
  if (!hooked) {
    hooked = true
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.once(signal, () => {
        for (const fn of closers) fn()
        closers.clear()
      })
    }
  }
  closers.add(close)
  return () => closers.delete(close)
}
