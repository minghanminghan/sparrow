'use client'

import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { isDone } from '@/core/columns'
import { rankBetween } from '@/core/rank'
import type { TaskView } from '@/core'
import { applyFilters, useKb } from '@/client/store'
import { Column } from './Column'
import { Card } from './Card'

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

function recentlyCompleted(completed?: string): boolean {
  if (!completed) return false
  return Date.now() - new Date(completed).getTime() <= FOURTEEN_DAYS_MS
}

export function Board() {
  const index = useKb((s) => s.index)
  const filters = useKb((s) => s.filters)
  const op = useKb((s) => s.op)
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeTask = useKb((s) => (activeId ? s.byId[activeId] : undefined))

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const columnTasks = useMemo(() => {
    const map: Record<string, TaskView[]> = {}
    if (!index) return map
    const visible = applyFilters(index.tasks, { ...filters, showDone: true }, index.config)
    for (const col of index.config.columns) {
      let tasks = visible.filter((t) => t.status === col.key)
      if (isDone(index.config, col.key) && !filters.showDone) {
        tasks = tasks.filter((t) => recentlyCompleted(t.completed))
      }
      map[col.key] = tasks
    }
    return map
  }, [index, filters])

  function handleDragStart(event: DragStartEvent): void {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)
    if (overId === id) return

    const byId = useKb.getState().byId
    const task = byId[id]
    if (!task) return
    const destKey = overId.startsWith('col:') ? overId.slice(4) : byId[overId]?.status
    if (!destKey) return

    const siblings = (columnTasks[destKey] ?? []).filter((t) => t.id !== id)
    let insertAt = siblings.length
    if (!overId.startsWith('col:')) {
      const idx = siblings.findIndex((t) => t.id === overId)
      if (idx !== -1) insertAt = idx
    }
    const rank = rankBetween(siblings[insertAt - 1]?.rank, siblings[insertAt]?.rank)

    if (task.status !== destKey) {
      void op(id, { type: 'setStatus', status: destKey }, (t) => ({ ...t, status: destKey }))
    }
    void op(id, { type: 'setRank', rank }, (t) => ({ ...t, rank }))
  }

  if (!index) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {index.config.columns.map((col) => (
          <Column key={col.key} column={col} tasks={columnTasks[col.key] ?? []} />
        ))}
      </div>
      <DragOverlay>{activeTask ? <Card task={activeTask} dragOverlay /> : null}</DragOverlay>
    </DndContext>
  )
}
