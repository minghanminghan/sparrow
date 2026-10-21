'use client'

import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Column as ColumnConfig, TaskView } from '@/core'
import { rankBetween } from '@/core/rank'
import { useKb } from '@/client/store'
import { Card } from './Card'

export function Column({ column, tasks }: { column: ColumnConfig; tasks: TaskView[] }) {
  const create = useKb((s) => s.create)
  const [title, setTitle] = useState('')
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.key}` })
  const ids = useMemo(() => tasks.map((t) => t.id), [tasks])

  async function submit(): Promise<void> {
    const t = title.trim()
    if (!t) return
    setTitle('')
    try {
      await create({ title: t, status: column.key, rank: rankBetween(undefined, tasks[0]?.rank) })
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
        <span className="text-xs text-gray-400">{tasks.length}</span>
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
          {tasks.map((task) => (
            <Card key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
