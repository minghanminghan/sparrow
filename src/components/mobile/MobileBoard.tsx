'use client'

import { useState } from 'react'
import { columnByRole } from '@/core/columns'
import { useKb } from '@/client/store'
import { PendingCard } from '@/components/PendingCard'
import { Card } from '@/components/board/Card'
import { pendingForColumn, visibleColumnTasks } from '@/components/board/visibleTasks'

const TAB_KEY = 'sparrow:tab'

export function MobileBoard() {
  const index = useKb((s) => s.index)
  const filters = useKb((s) => s.filters)
  const pending = useKb((s) => s.pending)
  const openCreate = useKb((s) => s.openCreate)
  const [tab, setTab] = useState(() => (typeof window === 'undefined' ? null : sessionStorage.getItem(TAB_KEY)))

  if (!index) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>
  }

  const { columns } = index.config
  const readyKey = columnByRole(index.config, 'ready').key
  const active = columns.some((c) => c.key === tab) ? tab! : readyKey
  const lists = columns.map((c) => ({
    column: c,
    tasks: visibleColumnTasks(index, filters, c.key),
    pending: pendingForColumn(pending, readyKey, c.key, filters.projects),
  }))
  const current = lists.find((l) => l.column.key === active)!

  function choose(key: string): void {
    setTab(key)
    sessionStorage.setItem(TAB_KEY, key)
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 flex gap-3 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 text-sm font-medium whitespace-nowrap">
        {lists.map(({ column, tasks, pending }) => (
          <button
            key={column.key}
            onClick={() => choose(column.key)}
            className={column.key === active ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500'}
          >
            {column.name} {tasks.length + pending.length}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2 bg-gray-50 p-2 pb-28">
        {current.pending.map((e) => (
          <PendingCard key={e.clientId} entry={e} />
        ))}
        {current.tasks.map((t) => (
          <Card key={t.id} taskId={t.id} drag={false} />
        ))}
      </div>
      <div
        className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button onClick={() => openCreate({ status: active })} className="w-full rounded bg-gray-900 py-2 text-sm text-white">
          + New task
        </button>
      </div>
    </div>
  )
}
