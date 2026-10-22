'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useShallow } from 'zustand/react/shallow'
import type { Column as ColumnConfig } from '@/core'
import { useKb } from '@/client/store'
import { Card } from './Card'
import { visibleColumnTasks } from './visibleTasks'

const EMPTY_IDS: string[] = []

export function Column({ column }: { column: ColumnConfig }) {
  const openCreate = useKb((s) => s.openCreate)
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.key}` })
  // useShallow bails out of a re-render when the id list is the same
  // strings in the same order, so an edit to a task's title/due/etc. (which
  // doesn't move it between columns or change its rank) never re-renders
  // this column — only the one Card subscribed to that task does.
  const ids = useKb(
    useShallow((s) => (s.index ? visibleColumnTasks(s.index, s.filters, column.key).map((t) => t.id) : EMPTY_IDS)),
  )

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg lg:w-auto lg:min-w-56 lg:max-w-md lg:flex-1 xl:min-w-64 2xl:max-w-xl ${isOver ? 'bg-gray-100' : 'bg-gray-50'}`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-700">{column.name}</h2>
        <span className="text-xs text-gray-400">{ids.length}</span>
      </div>
      <div className="px-2">
        <button
          onClick={() => openCreate({ status: column.key })}
          className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-left text-sm text-gray-500 hover:border-gray-400"
        >
          + Add task
        </button>
      </div>
      <SortableContext id={`list:${column.key}`} items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {ids.map((id) => (
            <Card key={id} taskId={id} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
