'use client'

import { useEffect, useRef, useState } from 'react'
import { useKb } from '@/client/store'
import { TaskDetail } from '@/components/detail/TaskDetail'

export function TaskPanel() {
  const panelId = useKb((s) => s.panelId)
  const openPanel = useKb((s) => s.openPanel)
  const ref = useRef<HTMLDivElement>(null)
  // Lags panelId on close so the panel stays mounted while it slides out.
  const [shownId, setShownId] = useState(panelId)
  if (panelId && panelId !== shownId) setShownId(panelId)
  const closing = !panelId && shownId !== null

  useEffect(() => {
    if (!panelId) return
    function onPointerDown(e: PointerEvent): void {
      const panel = ref.current
      if (!panel || panel.contains(e.target as Node)) return
      // Clicking another task swaps the panel's content instead of closing it.
      if (e.target instanceof Element && e.target.closest('[data-opens-task]')) return
      // Blur first so an open editor saves before the panel unmounts.
      const active = document.activeElement
      if (active instanceof HTMLElement && panel.contains(active)) active.blur()
      openPanel(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [panelId, openPanel])

  if (!shownId) return null

  return (
    <div
      ref={ref}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) setShownId(null)
      }}
      className={`absolute inset-y-0 right-0 z-30 w-full max-w-2xl overflow-y-auto border-l border-gray-200 bg-white shadow-xl ${
        closing ? 'pointer-events-none animate-panel-out' : 'animate-panel-in'
      }`}
    >
      <button
        onClick={() => {
          // Blur first so an open editor saves, as when tapping outside.
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
          openPanel(null)
        }}
        className="px-4 pt-3 text-sm text-gray-500 md:hidden"
      >
        ‹ Board
      </button>
      <TaskDetail id={shownId} />
    </div>
  )
}
