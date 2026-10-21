'use client'

import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useKb } from '@/client/store'

export function AssigneeField({
  id,
  assignee,
  className,
  onClick,
}: {
  id: string
  assignee?: string
  className?: string
  onClick?: (e: MouseEvent<HTMLInputElement>) => void
}) {
  const op = useKb((s) => s.op)
  const [value, setValue] = useState(assignee ?? '')

  useEffect(() => setValue(assignee ?? ''), [assignee])

  function commit(): void {
    const next = value.trim() || null
    if (next === (assignee ?? null)) return
    void op(id, { type: 'setAssignee', assignee: next }, (t) => ({ ...t, assignee: next ?? undefined }))
  }

  return (
    <input
      value={value}
      onClick={onClick}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      placeholder="Unassigned"
      className={className}
    />
  )
}
