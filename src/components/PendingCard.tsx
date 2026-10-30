'use client'

import { useKb, useProject } from '@/client/store'
import type { OutboxEntry } from '@/client/outbox'
import { pendingProject } from '@/components/board/visibleTasks'
import { ProjectSquare } from '@/components/ProjectSquare'

export function PendingCard({ entry }: { entry: OutboxEntry }) {
  const retryPending = useKb((s) => s.retryPending)
  const discardPending = useKb((s) => s.discardPending)
  const project = pendingProject(entry.input)
  const color = useProject(project)?.color

  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-white p-2 text-sm opacity-70">
      {project && (
        <div className="flex items-center gap-1 font-mono text-xs text-gray-400">
          <ProjectSquare color={color} />
          {project}-…
        </div>
      )}
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
