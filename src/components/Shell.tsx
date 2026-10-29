'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useKb } from '@/client/store'
import type { Env } from '@/core/env'
import { EnvToggle } from './EnvToggle'
import { Filters } from './Filters'
import { FilterSheet } from './mobile/FilterSheet'
import { OfflineBar } from './OfflineBar'
import { QuickCreate } from './QuickCreate'
import { TaskPanel } from './TaskPanel'

// Stable reference: a selector returning `?? []` would create a new array
// each call, which useSyncExternalStore treats as a changed snapshot and
// re-renders forever.

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function Shell({ children, env, version }: { children: ReactNode; env?: Env; version: string }) {
  const pathname = usePathname()
  const connect = useKb((s) => s.connect)
  const q = useKb((s) => s.filters.q)
  const setFilters = useKb((s) => s.setFilters)
  const openPanel = useKb((s) => s.openPanel)
  const toasts = useKb((s) => s.toasts)
  const dismissToast = useKb((s) => s.dismissToast)
  const openCreate = useKb((s) => s.openCreate)
  const searchRef = useRef<HTMLInputElement>(null)
  const filtered = useKb((s) => {
    const f = s.filters
    return Boolean(f.q || f.hideSubtasks || f.due || f.showDone)
  })
  const [filterOpen, setFilterOpen] = useState(false)
  // Only the board has a phone layout; other pages keep the desktop header at every width.
  const phone = pathname === '/'

  useEffect(() => {
    connect()
  }, [connect])

  useEffect(() => {
    openPanel(null)
  }, [pathname, openPanel])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'c') {
        e.preventDefault()
        openCreate({})
      } else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape') {
        openPanel(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openPanel, openCreate])

  return (
    <div className="flex h-dvh flex-col">
      <OfflineBar />
      {phone && (
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2 md:hidden">
          <div className="flex items-center gap-3">
            {env && <EnvToggle env={env} />}
            <h1 className="text-sm font-medium text-gray-900">Board</h1>
            <span className="text-xs text-gray-400">v{version}</span>
          </div>
          <button onClick={() => setFilterOpen(true)} className="flex items-center gap-1 text-sm text-gray-600">
            Filter
            {filtered && <span className="h-1.5 w-1.5 rounded-full bg-gray-900" />}
          </button>
        </header>
      )}
      <header className={`${phone ? 'hidden md:flex' : 'flex'} flex-wrap items-center gap-4 border-b border-gray-200 px-4 py-2`}>
        {env && <EnvToggle env={env} />}
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
        <span className="text-xs text-gray-400">v{version}</span>
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder="Search ( / )"
          className="w-48 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <Filters />
        <button
          onClick={() => openCreate({})}
          className="ml-auto rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700"
        >
          + New (c)
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <main className="h-full overflow-auto">{children}</main>
        <TaskPanel />
      </div>

      <QuickCreate />
      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))]">
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
