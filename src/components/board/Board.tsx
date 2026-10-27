'use client'

import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, closestCorners, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { isDone } from '@/core/columns'
import { rankBetween } from '@/core/rank'
import { useKb } from '@/client/store'
import { Column } from './Column'
import { Card } from './Card'
import { visibleColumnTasks } from './visibleTasks'

// Anywhere inside a column counts as dropping into it: only that column and
// its cards compete. Between columns, fall back to the nearest target overall.
const collisionDetection: CollisionDetection = (args) => {
  const col = pointerWithin(args).find((c) => String(c.id).startsWith('col:'))
  if (!col) return closestCorners(args)
  const listId = `list:${String(col.id).slice(4)}`
  const droppableContainers = args.droppableContainers.filter(
    (c) => c.id === col.id || c.data.current?.sortable?.containerId === listId,
  )
  return closestCorners({ ...args, droppableContainers })
}

export function Board() {
  // Only config/columns is subscribed here — it's a stable reference across
  // task ops (only a fresh snapshot replaces it), so Board itself never
  // re-renders from a task update. Each Column tracks its own visible task
  // ids; handleDragEnd reads fresh data via getState() instead of
  // subscribing, since it only needs it at drop time.
  const columns = useKb((s) => s.index?.config.columns)
  const op = useKb((s) => s.op)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

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

    const state = useKb.getState()
    const index = state.index
    if (!index) return
    const task = state.byId[id]
    if (!task) return
    const destKey = overId.startsWith('col:') ? overId.slice(4) : state.byId[overId]?.status
    if (!destKey) return

    const sourceKey = task.status
    const destList = visibleColumnTasks(index, state.filters, destKey)
    const siblings = destList.filter((t) => t.id !== id)

    // Default: dropped on the column's empty space (over is the `col:`
    // container droppable, or the hovered task somehow isn't in the list
    // anymore) — append at the end.
    let insertAt = siblings.length
    if (!overId.startsWith('col:')) {
      const overIdx = siblings.findIndex((t) => t.id === overId)
      if (overIdx !== -1) {
        if (sourceKey === destKey) {
          // Same column: arrayMove semantics — moving down lands after the
          // drop target, moving up lands before it.
          const activeOriginalIdx = destList.findIndex((t) => t.id === id)
          const overOriginalIdx = destList.findIndex((t) => t.id === overId)
          insertAt = activeOriginalIdx < overOriginalIdx ? overIdx + 1 : overIdx
        } else {
          // Cross column: no "original position" in this column to compare,
          // so use whether the dragged card's center is below the drop
          // target's center.
          const activeRect = active.rect.current.translated
          const overRect = over.rect
          const movingBelow = activeRect
            ? activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
            : false
          insertAt = movingBelow ? overIdx + 1 : overIdx
        }
      }
    }

    const rank = rankBetween(siblings[insertAt - 1]?.rank, siblings[insertAt]?.rank)

    if (sourceKey === destKey) {
      void op(id, { type: 'setRank', rank }, (t) => ({ ...t, rank }))
      return
    }
    // One op, not setStatus + setRank: the server can apply two concurrent requests out of order.
    const completed = isDone(index.config, destKey) ? (task.completed ?? new Date().toISOString()) : undefined
    void op(id, { type: 'setStatus', status: destKey, rank }, (t) => ({ ...t, status: destKey, rank, completed }))
  }

  if (!columns) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-full justify-center-safe gap-4 overflow-x-auto p-4">
        {columns.map((col) => (
          <Column key={col.key} column={col} />
        ))}
      </div>
      <DragOverlay>{activeId ? <Card taskId={activeId} dragOverlay /> : null}</DragOverlay>
    </DndContext>
  )
}
