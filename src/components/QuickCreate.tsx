'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useKb } from '@/client/store'

export function QuickCreate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useKb((s) => s.create)
  const titleRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [parent, setParent] = useState('')
  const [due, setDue] = useState('')

  useEffect(() => {
    if (open) titleRef.current?.focus()
  }, [open])

  if (!open) return null

  async function submit(): Promise<void> {
    const t = title.trim()
    if (!t) return
    try {
      await create({ title: t, parent: parent.trim() || undefined, due: due.trim() || undefined })
      setTitle('')
      titleRef.current?.focus()
    } catch {
      // the store already pushed a toast with the error
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/20 pt-24" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="w-full border-b border-gray-300 pb-2 text-lg outline-none"
        />
        <div className="mt-3 flex gap-2 text-sm">
          <input
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            placeholder="Parent ID (optional)"
            className="flex-1 rounded border border-gray-300 px-2 py-1"
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </div>
      </div>
    </div>
  )
}
