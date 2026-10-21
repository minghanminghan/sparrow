'use client'

import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useShallow } from 'zustand/react/shallow'
import type { Config, TaskView } from '@/core'
import { rankBetween } from '@/core/rank'
import { applyFilters, useKb } from '@/client/store'
import type { Filters } from '@/client/store'
import { Row } from './Row'

type Tree = {
  order: string[]
  childrenOf: Map<string | undefined, TaskView[]>
  included: Map<string, boolean>
}

const EMPTY_TASKS: TaskView[] = []
const EMPTY_TREE: Tree = { order: [], childrenOf: new Map(), included: new Map() }

// Matches = tasks that pass the active filters. A match keeps its ancestor
// chain so it stays in context, even when an ancestor itself doesn't match
// (it's rendered dimmed). Roots are tasks whose parent is missing or wasn't
// pulled into this set.
function buildTree(tasks: TaskView[], filters: Filters, config: Config, collapsed: Set<string>): Tree {
  const matches = applyFilters(tasks, filters, config)
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const included = new Map<string, boolean>()
  for (const t of matches) included.set(t.id, false)
  for (const t of matches) {
    let cur = t.parent
    while (cur && !included.has(cur)) {
      const p = byId.get(cur)
      if (!p) break
      included.set(cur, true)
      cur = p.parent
    }
  }

  const childrenOf = new Map<string | undefined, TaskView[]>()
  for (const t of tasks) {
    if (!included.has(t.id)) continue
    const key = t.parent && included.has(t.parent) ? t.parent : undefined
    if (!childrenOf.has(key)) childrenOf.set(key, [])
    childrenOf.get(key)!.push(t)
  }

  const order: string[] = []
  const walk = (parentId: string | undefined): void => {
    for (const t of childrenOf.get(parentId) ?? []) {
      order.push(t.id)
      if (!collapsed.has(t.id)) walk(t.id)
    }
  }
  walk(undefined)

  return { order, childrenOf, included }
}

function keyOf(task: TaskView, included: Map<string, boolean>): string | undefined {
  return task.parent && included.has(task.parent) ? task.parent : undefined
}

type GroupProps = {
  parentId: string | undefined
  depth: number
  tree: Tree
  collapsed: Set<string>
  selected: Set<string>
  onToggleCollapse: (id: string) => void
  onRowClick: (id: string, e: MouseEvent) => void
}

function GroupRows({ parentId, depth, tree, collapsed, selected, onToggleCollapse, onRowClick }: GroupProps) {
  const siblings = tree.childrenOf.get(parentId) ?? []
  if (siblings.length === 0) return null
  const ids = siblings.map((t) => t.id)

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {siblings.map((t) => (
        <div key={t.id}>
          <Row
            id={t.id}
            depth={depth}
            dimmed={tree.included.get(t.id) === true}
            selected={selected.has(t.id)}
            hasChildren={(tree.childrenOf.get(t.id) ?? []).length > 0}
            collapsed={collapsed.has(t.id)}
            onToggleCollapse={() => onToggleCollapse(t.id)}
            onSelectClick={(e) => onRowClick(t.id, e)}
          />
          {!collapsed.has(t.id) && (
            <GroupRows
              parentId={t.id}
              depth={depth + 1}
              tree={tree}
              collapsed={collapsed}
              selected={selected}
              onToggleCollapse={onToggleCollapse}
              onRowClick={onRowClick}
            />
          )}
        </div>
      ))}
    </SortableContext>
  )
}

export function TaskList() {
  const tasks = useKb(useShallow((s) => s.index?.tasks ?? EMPTY_TASKS))
  const config = useKb((s) => s.index?.config)
  const filters = useKb((s) => s.filters)
  const op = useKb((s) => s.op)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastClicked, setLastClicked] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')

  const tree = useMemo(
    () => (config ? buildTree(tasks, filters, config, collapsed) : EMPTY_TREE),
    [tasks, filters, config, collapsed],
  )

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent): void {
      if (e.key === 'Escape') setSelected((prev) => (prev.size > 0 ? new Set() : prev))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function toggleCollapse(id: string): void {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleRowClick(id: string, e: MouseEvent): void {
    if (e.shiftKey && lastClicked) {
      const a = tree.order.indexOf(lastClicked)
      const b = tree.order.indexOf(id)
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        setSelected(new Set(tree.order.slice(lo, hi + 1)))
        return
      }
    }
    if (e.metaKey || e.ctrlKey) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      setLastClicked(id)
      return
    }
    setSelected(new Set([id]))
    setLastClicked(id)
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)
    if (id === overId) return

    const state = useKb.getState()
    const idx = state.index
    if (!idx) return
    const task = state.byId[id]
    const overTask = state.byId[overId]
    if (!task || !overTask) return

    const fresh = buildTree(idx.tasks, state.filters, idx.config, collapsed)
    const activeKey = keyOf(task, fresh.included)
    const overKey = keyOf(overTask, fresh.included)
    if (activeKey !== overKey) return

    const siblings = fresh.childrenOf.get(activeKey) ?? []
    const withoutActive = siblings.filter((t) => t.id !== id)
    const overIdx = withoutActive.findIndex((t) => t.id === overId)
    let insertAt = withoutActive.length
    if (overIdx !== -1) {
      const activeOriginalIdx = siblings.findIndex((t) => t.id === id)
      const overOriginalIdx = siblings.findIndex((t) => t.id === overId)
      insertAt = activeOriginalIdx < overOriginalIdx ? overIdx + 1 : overIdx
    }
    const rank = rankBetween(withoutActive[insertAt - 1]?.rank, withoutActive[insertAt]?.rank)
    void op(id, { type: 'setRank', rank }, (t) => ({ ...t, rank }))
  }

  async function submitNewTask(): Promise<void> {
    const title = newTitle.trim()
    if (!title) return
    setNewTitle('')
    const state = useKb.getState()
    const idx = state.index
    if (!idx) return
    const roots = idx.tasks.filter((t) => !t.parent)
    const rank = rankBetween(roots[roots.length - 1]?.rank, undefined)
    try {
      await state.create({ title, rank })
    } catch {
      // the store already pushed a toast with the error
    }
  }

  function onNewTaskKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submitNewTask()
    }
  }

  function applyBulkStatus(status: string): void {
    for (const id of selected) {
      void op(id, { type: 'setStatus', status }, (t) => ({ ...t, status }))
    }
  }

  if (!config) {
    return <div className="p-8 text-sm text-gray-500">Loading…</div>
  }
  const columns = config.columns

  return (
    <div className="flex h-full flex-col">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-gray-200 bg-amber-50 px-4 py-2 text-sm">
          <span>{selected.size} selected</span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyBulkStatus(e.target.value)
              e.target.value = ''
            }}
            className="rounded border border-gray-300 px-2 py-1"
          >
            <option value="" disabled>
              Set status…
            </option>
            {columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:text-gray-700">
            Clear
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <GroupRows
            parentId={undefined}
            depth={0}
            tree={tree}
            collapsed={collapsed}
            selected={selected}
            onToggleCollapse={toggleCollapse}
            onRowClick={handleRowClick}
          />
        </DndContext>
      </div>
      <div className="flex items-center gap-2 border-t border-gray-200 px-2 py-2">
        <span className="w-16 shrink-0" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={onNewTaskKeyDown}
          placeholder="+ New task"
          className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-gray-400"
        />
      </div>
    </div>
  )
}
