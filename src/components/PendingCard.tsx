'use client'

import { useKb } from '@/client/store'
import type { OutboxEntry } from '@/client/outbox'

export function PendingCard({ entry }: { entry: OutboxEntry }) {
  const retryPending = useKb((s) => s.retryPending)
  const discardPending = useKb((s) => s.discardPending)

  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-white p-2 text-sm opacity-70">
      <div className="break-words">{entry.input.title}</div>
      {entry.error ? (
        <div className="mt-1 text-xs text-red-600">
          {entry.error}{' '}
          <button onClick={() => void retryPending(entry.clientId)} className="underline">
            Retry
          </button>{' '}
          <button onClick={() => void discardPending(entry.clientId)} className="underline">
            Discard
          </button>
        </div>
      ) : (
        <div className="mt-1 text-xs text-gray-400">Waiting to send</div>
      )}
    </div>
  )
}
