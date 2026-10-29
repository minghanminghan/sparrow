'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useShallow } from 'zustand/react/shallow'
import type { Config, TaskView } from '@/core'
import { rankBetween } from '@/core/rank'
import { applyFilters, useKb } from '@/client/store'
import type { Filters } from '@/client/store'
import { isTypingTarget } from '@/components/Shell'
import { Row } from './Row'

type Groups = {
  // A task whose parent is missing, or wasn't pulled into `included`, is a
  // root (key `undefined`).
  childrenOf: Map<string | undefined, TaskView[]>
  included: Map<string, boolean>
}

// Matches = tasks that pass the active filters. A match keeps its ancestor
// chain so it stays in context, even when an ancestor itself doesn't match
// (`included` is true but not a match) — it's rendered dimmed.
function computeGroups(tasks: TaskView[], filters: Filters, config: Config): Groups {
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

  return { childrenOf, included }
}

function keyOf(task: TaskView, included: Map<string, boolean>): string | undefined {
  return task.parent && included.has(task.parent) ? task.parent : undefined
}

// Encoded as primitive strings (not objects/Maps) so a `useShallow` selector
// can bail the component out of re-rendering when an edit doesn't change
// which rows are shown, their order, depth, or dimmed state — only id/parent/
// rank/status/due/title changes (the inputs to filtering and
// ordering) can change this array's contents.
function encodeRows(groups: Groups): string[] {
  const rows: string[] = []
  const walk = (parentId: string | undefined, depth: number): void => {
    for (const t of groups.childrenOf.get(parentId) ?? []) {
      const dimmed = groups.included.get(t.id) === true
      rows.push(`${t.id}|${depth}|${dimmed ? 1 : 0}|${parentId ?? ''}`)
      walk(t.id, depth + 1)
    }
  }
  walk(undefined, 0)
  return rows
}

type RowDescriptor = { id: string; depth: number; dimmed: boolean; parentKey: string | undefined }

function decodeRows(rows: string[]): RowDescriptor[] {
  return rows.map((line) => {
    const [id, depthStr, dimmedStr, parentKey] = line.split('|')
    return { id, depth: Number(depthStr), dimmed: dimmedStr === '1', parentKey: parentKey || undefined }
  })
}

const EMPTY_ROWS: string[] = []

type DisplayTree = {
  childrenOf: Map<string | undefined, RowDescriptor[]>
  hasChildrenOf: Set<string>
}

// Collapsing a node hides its whole subtree, not just its direct children —
// `allRows` is in parent-before-child order, so a single pass tracking which
// ids were actually kept visible cascades that correctly.
function applyCollapse(allRows: RowDescriptor[], collapsed: Set<string>): { displayed: RowDescriptor[]; order: string[] } {
  const visible = new Set<string>()
  const displayed: RowDescriptor[] = []
  for (const r of allRows) {
    const parentVisible = r.parentKey === undefined || (visible.has(r.parentKey) && !collapsed.has(r.parentKey))
    if (!parentVisible) continue
    visible.add(r.id)
    displayed.push(r)
  }
  return { displayed, order: displayed.map((r) => r.id) }
}

type GroupProps = {
  parentKey: string | undefined
  tree: DisplayTree
  collapsed: Set<string>
  selected: Set<string>
  onToggleCollapse: (id: string) => void
  onRowClick: (id: string, e: MouseEvent) => void
}

function GroupRows({ parentKey, tree, collapsed, selected, onToggleCollapse, onRowClick }: GroupProps) {
  const siblings = tree.childrenOf.get(parentKey) ?? []
  if (siblings.length === 0) return null
  const ids = siblings.map((r) => r.id)

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {siblings.map((r) => (
        <div key={r.id}>
          <Row
            id={r.id}
            depth={r.depth}
            dimmed={r.dimmed}
            selected={selected.has(r.id)}
            hasChildren={tree.hasChildrenOf.has(r.id)}
            collapsed={collapsed.has(r.id)}
            onToggleCollapse={onToggleCollapse}
            onSelectClick={onRowClick}
          />
          {!collapsed.has(r.id) && (
            <GroupRows
              parentKey={r.id}
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
  // Filtering (title/status/due/etc.) happens inside the selector,
  // which returns only primitive strings encoding order/depth/dimmed/parent.
  // useShallow then bails the component out of re-rendering when an edit
  // doesn't change the visible structure — see computeGroups/encodeRows.
  const rawRows = useKb(
    useShallow((s) => (s.index ? encodeRows(computeGroups(s.index.tasks, s.filters, s.index.config)) : EMPTY_ROWS)),
  )
  const config = useKb((s) => s.index?.config)
  const op = useKb((s) => s.op)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newTitle, setNewTitle] = useState('')
  const lastClickedRef = useRef<string | null>(null)

  const allRows = useMemo(() => decodeRows(rawRows), [rawRows])
  const { displayed, order } = useMemo(() => applyCollapse(allRows, collapsed), [allRows, collapsed])
  const orderRef = useRef<string[]>(order)
  orderRef.current = order

  const tree = useMemo((): DisplayTree => {
    // hasChildrenOf comes from the *full* tree (not `displayed`) so a
    // collapsed group's toggle stays visible — otherwise, once hidden, its
    // children could never be found to re-expand it.
    const childrenOf = new Map<string | undefined, RowDescriptor[]>()
    for (const r of displayed) {
      if (!childrenOf.has(r.parentKey)) childrenOf.set(r.parentKey, [])
      childrenOf.get(r.parentKey)!.push(r)
    }
    const hasChildrenOf = new Set<string>()
    for (const r of allRows) {
      if (r.parentKey) hasChildrenOf.add(r.parentKey)
    }
    return { childrenOf, hasChildrenOf }
  }, [displayed, allRows])

  // Prune selection to ids still visible after a collapse/filter/search
  // change, so bulk actions never reach hidden rows.
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(order)
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visible.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [order])

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent): void {
      if (e.key !== 'Escape' || isTypingTarget(e.target)) return
      setSelected((prev) => (prev.size > 0 ? new Set() : prev))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onToggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onRowClick = useCallback((id: string, e: MouseEvent) => {
    if (e.shiftKey && lastClickedRef.current) {
      const ord = orderRef.current
      const a = ord.indexOf(lastClickedRef.current)
      const b = ord.indexOf(id)
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        setSelected(new Set(ord.slice(lo, hi + 1)))
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
      lastClickedRef.current = id
      return
    }
    setSelected(new Set([id]))
    lastClickedRef.current = id
  }, [])

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

    const groups = computeGroups(idx.tasks, state.filters, idx.config)
    const activeKey = keyOf(task, groups.included)
    const overKey = keyOf(overTask, groups.included)
    if (activeKey !== overKey) return

    const siblings = groups.childrenOf.get(activeKey) ?? []
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
            parentKey={undefined}
            tree={tree}
            collapsed={collapsed}
            selected={selected}
            onToggleCollapse={onToggleCollapse}
            onRowClick={onRowClick}
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
