'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import type { TaskView } from '@/core'
import { dueState, useKb } from '@/client/store'

const DUE_STYLE: Record<'overdue' | 'soon', string> = {
  overdue: 'text-red-600',
  soon: 'text-amber-600',
}

function transformStyle(transform: { x: number; y: number } | null): string | undefined {
  return transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined
}

function CardImpl({ task, dragOverlay = false }: { task: TaskView; dragOverlay?: boolean }) {
  const openPanel = useKb((s) => s.openPanel)
  const parentTitle = useKb((s) => (task.parent ? s.byId[task.parent]?.title : undefined))
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragOverlay,
  })

  const due = dueState(task.due)
  const style = dragOverlay
    ? undefined
    : { transform: transformStyle(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    <div
      ref={dragOverlay ? undefined : setNodeRef}
      style={style}
      {...(dragOverlay ? {} : attributes)}
      {...(dragOverlay ? {} : listeners)}
      onClick={() => openPanel(task.id)}
      className={`rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm ${
        dragOverlay ? 'rotate-2 shadow-lg' : 'cursor-grab hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-gray-400">{task.id}</span>
        {task.assignee && <span className="truncate text-xs text-gray-500">{task.assignee}</span>}
      </div>
      <div className="mt-1 font-medium text-gray-900">{task.title}</div>
      {parentTitle && <div className="mt-1 truncate text-xs text-gray-500">↳ {parentTitle}</div>}
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
        {task.due && <span className={due ? DUE_STYLE[due] : undefined}>{task.due}</span>}
        {task.progress.total > 0 && (
          <span>
            {task.progress.done}/{task.progress.total}
          </span>
        )}
        {task.links.length > 0 && <span>🔗 {task.links.length}</span>}
        {task.refs.length > 0 && <span>📎 {task.refs.length}</span>}
      </div>
    </div>
  )
}

export const Card = memo(CardImpl)
