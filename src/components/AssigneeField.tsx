'use client'

import { useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { assigneesOf, useKb } from '@/client/store'

const NEW = '\u0000new'

export function AssigneeField({
  id,
  assignee,
  className,
  onClick,
}: {
  id: string
  assignee?: string
  className?: string
  onClick?: (e: MouseEvent<HTMLElement>) => void
}) {
  const op = useKb((s) => s.op)
  const tasks = useKb((s) => s.index?.tasks)
  const assignees = useMemo(() => assigneesOf(tasks ?? []), [tasks])
  const [adding, setAdding] = useState(false)
  const cancelled = useRef(false)

  function commit(value: string): void {
    setAdding(false)
    const next = value.trim() || null
    if (next === (assignee ?? null)) return
    void op(id, { type: 'setAssignee', assignee: next }, (t) => ({ ...t, assignee: next ?? undefined }))
  }

  if (adding) {
    return (
      <input
        autoFocus
        onClick={onClick}
        onBlur={(e) => {
          const name = e.currentTarget.value.trim()
          if (cancelled.current || !name) setAdding(false)
          else commit(name)
        }}
        onKeyDown={(e) => {
          cancelled.current = e.key === 'Escape'
          if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
        }}
        placeholder="New name"
        className={className}
      />
    )
  }

  return (
    <select
      value={assignee ?? ''}
      onClick={onClick}
      onChange={(e) => {
        if (e.target.value !== NEW) return commit(e.target.value)
        cancelled.current = false
        setAdding(true)
      }}
      className={className}
    >
      <option value="">Unassigned</option>
      {assignees.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
      <option value={NEW}>+ New…</option>
    </select>
  )
}
