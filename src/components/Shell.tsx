'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { InvalidFile } from '@/core'
import { useKb } from '@/client/store'
import { Filters } from './Filters'
import { QuickCreate } from './QuickCreate'
import { TaskPanel } from './TaskPanel'

// Stable reference: a selector returning `?? []` would create a new array
// each call, which useSyncExternalStore treats as a changed snapshot and
// re-renders forever.
const NO_INVALID: InvalidFile[] = []

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const connect = useKb((s) => s.connect)
  const q = useKb((s) => s.filters.q)
  const setFilters = useKb((s) => s.setFilters)
  const openPanel = useKb((s) => s.openPanel)
  const invalid = useKb((s) => s.index?.invalid ?? NO_INVALID)
  const toasts = useKb((s) => s.toasts)
  const dismissToast = useKb((s) => s.dismissToast)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    connect()
  }, [connect])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e.target)) return
      if (e.key === 'c') {
        e.preventDefault()
        setQuickCreateOpen(true)
      } else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape') {
        openPanel(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openPanel])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-gray-200 px-4 py-2">
        <nav className="flex gap-3 text-sm font-medium">
          <Link href="/" className={pathname === '/' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}>
            Board
          </Link>
          <Link
            href="/tasks"
            className={pathname === '/tasks' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}
          >
            All tasks
          </Link>
        </nav>
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder="Search ( / )"
          className="w-48 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <Filters />
        <button
          onClick={() => setQuickCreateOpen(true)}
          className="ml-auto rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700"
        >
          + New (c)
        </button>
      </header>

      {invalid.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {invalid.length} file{invalid.length === 1 ? '' : 's'} failed to parse:{' '}
          {invalid.map((f) => f.file).join(', ')}
        </div>
      )}

      <main className="flex-1">{children}</main>

      <QuickCreate open={quickCreateOpen} onClose={() => setQuickCreateOpen(false)} />
      <TaskPanel />

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className="rounded bg-gray-900 px-3 py-2 text-left text-sm text-white shadow-lg"
          >
            {t.message}
          </button>
        ))}
      </div>
    </div>
  )
}
