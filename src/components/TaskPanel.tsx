'use client'

import { useKb } from '@/client/store'

export function TaskPanel() {
  const panelId = useKb((s) => s.panelId)
  const openPanel = useKb((s) => s.openPanel)

  if (!panelId) return null

  return (
    <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 p-3">
        <span className="font-mono text-sm font-medium text-gray-700">{panelId}</span>
        <button
          onClick={() => openPanel(null)}
          aria-label="Close"
          className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
        >
          Esc
        </button>
      </div>
      <div data-task-id={panelId} className="flex-1 overflow-y-auto p-4 text-sm text-gray-500">
        Task detail coming soon.
      </div>
    </div>
  )
}
