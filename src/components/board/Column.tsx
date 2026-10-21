'use client'

import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useShallow } from 'zustand/react/shallow'
import type { Column as ColumnConfig } from '@/core'
import { rankBetween } from '@/core/rank'
import { useKb } from '@/client/store'
import { Card } from './Card'
import { visibleColumnTasks } from './visibleTasks'

const EMPTY_IDS: string[] = []

export function Column({ column }: { column: ColumnConfig }) {
  const create = useKb((s) => s.create)
  const [title, setTitle] = useState('')
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.key}` })
  // useShallow bails out of a re-render when the id list is the same
  // strings in the same order, so an edit to a task's title/due/etc. (which
  // doesn't move it between columns or change its rank) never re-renders
  // this column — only the one Card subscribed to that task does.
  const ids = useKb(
    useShallow((s) => (s.index ? visibleColumnTasks(s.index, s.filters, column.key).map((t) => t.id) : EMPTY_IDS)),
  )

  async function submit(): Promise<void> {
    const t = title.trim()
    if (!t) return
    setTitle('')
    const state = useKb.getState()
    const first = state.index ? visibleColumnTasks(state.index, state.filters, column.key)[0] : undefined
    try {
      await create({ title: t, status: column.key, rank: rankBetween(undefined, first?.rank) })
    } catch {
      // the store already pushed a toast with the error
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-gray-50">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-700">{column.name}</h2>
        <span className="text-xs text-gray-400">{ids.length}</span>
      </div>
      <div className="px-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="+ Add task"
          className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-gray-400"
        />
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto p-2 ${isOver ? 'bg-gray-100' : ''}`}
        >
          {ids.map((id) => (
            <Card key={id} taskId={id} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
