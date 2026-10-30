'use client'

import { memo } from 'react'
import NextLink from 'next/link'
import { useSortable } from '@dnd-kit/sortable'
import type { TaskView } from '@/core'
import { dueState, useKb, useProject } from '@/client/store'
import { ProjectSquare } from '@/components/ProjectSquare'

const DUE_STYLE: Record<'overdue' | 'soon', string> = {
  overdue: 'text-red-600',
  soon: 'text-amber-600',
}

function transformStyle(transform: { x: number; y: number } | null): string | undefined {
  return transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined
}

function CardContent({ task }: { task: TaskView }) {
  const parentTitle = useKb((s) => (task.parent ? s.byId[task.parent]?.title : undefined))
  const due = dueState(task.due)
  const color = useProject(task.project)?.color

  return (
    <>
      <div className="font-mono text-xs text-gray-400">
        {/* Stops the click and the pointerdown so the key opens the project, not the panel or a drag. */}
        <NextLink
          href={`/p/${task.project}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ProjectSquare color={color} />
          {task.id}
        </NextLink>
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
    </>
  )
}

function SortableCard({ taskId, dragOverlay }: { taskId: string; dragOverlay: boolean }) {
  // Subscribing to byId[taskId] here (rather than taking the task as a prop)
  // is what keeps a field edit elsewhere from re-rendering this card's
  // column: only the one card whose own task object changed re-renders.
  const task = useKb((s) => s.byId[taskId])
  const openPanel = useKb((s) => s.openPanel)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskId,
    disabled: dragOverlay,
  })

  if (!task) return null

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
      data-opens-task
      className={`rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm ${
        dragOverlay ? 'rotate-2 shadow-lg' : 'cursor-grab hover:border-gray-300'
      }`}
    >
      <CardContent task={task} />
    </div>
  )
}

// No useSortable, so it renders outside a DndContext (the phone board).
function StaticCard({ taskId }: { taskId: string }) {
  const task = useKb((s) => s.byId[taskId])
  const openPanel = useKb((s) => s.openPanel)
  if (!task) return null

  return (
    <div
      onClick={() => openPanel(task.id)}
      data-opens-task
      className="cursor-pointer rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm"
    >
      <CardContent task={task} />
    </div>
  )
}

function CardImpl({ taskId, dragOverlay = false, drag = true }: { taskId: string; dragOverlay?: boolean; drag?: boolean }) {
  return drag ? <SortableCard taskId={taskId} dragOverlay={dragOverlay} /> : <StaticCard taskId={taskId} />
}

export const Card = memo(CardImpl)
