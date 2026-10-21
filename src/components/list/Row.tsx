'use client'

import { memo, useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { useKb } from '@/client/store'

type RowProps = {
  id: string
  depth: number
  dimmed: boolean
  selected: boolean
  hasChildren: boolean
  collapsed: boolean
  // Stable (useCallback'd) handlers from the list, taking the row's id as an
  // argument rather than being wrapped per-row — that's what lets Row's memo
  // hold when a sibling row's task data changes.
  onToggleCollapse: (id: string) => void
  onSelectClick: (id: string, e: MouseEvent) => void
}

function AssigneeCell({ taskId, assignee }: { taskId: string; assignee?: string }) {
  const op = useKb((s) => s.op)
  const [value, setValue] = useState(assignee ?? '')

  useEffect(() => setValue(assignee ?? ''), [assignee])

  function commit(): void {
    const next = value.trim() || null
    if (next === (assignee ?? null)) return
    void op(taskId, { type: 'setAssignee', assignee: next }, (t) => ({ ...t, assignee: next ?? undefined }))
  }

  return (
    <input
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          e.currentTarget.blur()
        }
      }}
      placeholder="Unassigned"
      className="w-24 shrink-0 rounded border border-gray-200 px-1 py-0.5 text-xs"
    />
  )
}

function RowImpl({ id, depth, dimmed, selected, hasChildren, collapsed, onToggleCollapse, onSelectClick }: RowProps) {
  // Subscribing to byId[id] here (rather than taking the task as a prop) is
  // what keeps an edit to one row from re-rendering the whole list.
  const task = useKb((s) => s.byId[id])
  const op = useKb((s) => s.op)
  const openPanel = useKb((s) => s.openPanel)
  const columns = useKb((s) => s.index?.config.columns)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  if (!task || !columns) return null

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => onSelectClick(id, e)}
      className={`flex items-center gap-2 border-b border-gray-100 px-2 py-1 text-sm ${
        selected ? 'bg-blue-50' : dimmed ? 'text-gray-400' : ''
      }`}
    >
      <span style={{ width: depth * 16 }} className="shrink-0" />
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse(id)
          }}
          className="w-4 shrink-0 text-gray-400"
        >
          {collapsed ? '▸' : '▾'}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <span className="w-16 shrink-0 font-mono text-xs text-gray-400">{task.id}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          openPanel(task.id)
        }}
        className="flex-1 truncate text-left font-medium text-gray-900 hover:underline"
      >
        {task.title}
      </button>
      <select
        value={task.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) =>
          void op(task.id, { type: 'setStatus', status: e.target.value }, (t) => ({ ...t, status: e.target.value }))
        }
        className="shrink-0 rounded border border-gray-200 px-1 py-0.5 text-xs"
      >
        {columns.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={task.due ?? ''}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const due = e.target.value || null
          void op(task.id, { type: 'setDue', due }, (t) => ({ ...t, due: due ?? undefined }))
        }}
        className="shrink-0 rounded border border-gray-200 px-1 py-0.5 text-xs"
      />
      <AssigneeCell taskId={task.id} assignee={task.assignee} />
      <span className="w-10 shrink-0 text-right text-xs text-gray-500">
        {task.progress.total > 0 ? `${task.progress.done}/${task.progress.total}` : ''}
      </span>
    </div>
  )
}

export const Row = memo(RowImpl)
