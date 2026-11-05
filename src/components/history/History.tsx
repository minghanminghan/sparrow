'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useKb } from '@/client/store'
import type { TaskView } from '@/core'
import { ProjectSquare } from '@/components/ProjectSquare'
import { isTypingTarget } from '@/components/Shell'

type Range = 'week' | 'month'
const DAY = 86_400_000
const WIDTH_KEY = 'sparrow.history.taskWidth'

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function windowFor(range: Range, offset: number): { start: Date; days: number } {
  const today = startOfDay(new Date())
  if (range === 'week') {
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7)
    return { start: monday, days: 7 }
  }
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return { start: first, days }
}

function fmt(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString(undefined, opts)
}

export function History() {
  const [range, setRange] = useState<Range>('week')
  const [offset, setOffset] = useState(0)
  const [taskWidth, setTaskWidth] = useState(288)

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(WIDTH_KEY))
      if (saved) setTaskWidth(saved)
    } catch {}
  }, [])

  function startResize(e: ReactPointerEvent): void {
    e.preventDefault()
    const x0 = e.clientX
    const w0 = taskWidth
    let w = w0
    const onMove = (m: PointerEvent) => {
      w = Math.min(Math.max(w0 + m.clientX - x0, 160), 800)
      setTaskWidth(w)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      try {
        localStorage.setItem(WIDTH_KEY, String(w))
      } catch {}
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const { start, days } = windowFor(range, offset)
  const end = new Date(start.getTime() + days * DAY)
  const filters = useKb(useShallow((s) => ({ q: s.filters.q, projects: s.filters.projects })))
  const tasks = useKb((s) => s.index?.tasks)
  const projects = useKb((s) => s.index?.projects)
  const openPanel = useKb((s) => s.openPanel)

  const done = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return (tasks ?? [])
      .filter((t): t is TaskView & { started: string; completed: string } => Boolean(t.started && t.completed))
      .filter((t) => {
        const c = new Date(t.completed).getTime()
        return c >= start.getTime() && c < end.getTime()
      })
      .filter((t) => !filters.projects.length || filters.projects.includes(t.project))
      .filter((t) => !q || t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
      .sort((a, b) => {
        const pa = projects?.findIndex((p) => p.key === a.project) ?? 0
        const pb = projects?.findIndex((p) => p.key === b.project) ?? 0
        return pa - pb || (a.started < b.started ? -1 : 1)
      })
  }, [tasks, projects, filters, start.getTime(), end.getTime()])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') setOffset((o) => o - 1)
      else if (e.key === 'ArrowRight') setOffset((o) => o + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!tasks) return <div className="p-8 text-sm text-gray-500">Loading…</div>

  const colorOf = (key: string) => projects?.find((p) => p.key === key)?.color
  const span = end.getTime() - start.getTime()
  const pct = (ms: number) => `${(Math.min(Math.max(ms - start.getTime(), 0), span) / span) * 100}%`
  const todayIdx = Math.floor((startOfDay(new Date()).getTime() - start.getTime()) / DAY)
  const dayList = Array.from({ length: days }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const label =
    range === 'week'
      ? `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(new Date(end.getTime() - DAY), { month: 'short', day: 'numeric', year: 'numeric' })}`
      : fmt(start, { month: 'long', year: 'numeric' })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-2 text-sm">
        <button onClick={() => setOffset(offset - 1)} className="px-1 text-gray-500 hover:text-gray-900">
          ‹
        </button>
        <span className="min-w-44 text-center font-medium text-gray-900">{label}</span>
        <button onClick={() => setOffset(offset + 1)} className="px-1 text-gray-500 hover:text-gray-900">
          ›
        </button>
        {offset !== 0 && (
          <button onClick={() => setOffset(0)} className="text-xs text-gray-500 hover:text-gray-900">
            Today
          </button>
        )}
        <div className="flex overflow-hidden rounded border border-gray-300 text-xs">
          {(['week', 'month'] as const).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r)
                setOffset(0)
              }}
              className={`px-2 py-1 capitalize ${range === r ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {r}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-500">{done.length} done</span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="relative min-h-full min-w-[720px]">
          <div
            onPointerDown={startResize}
            className="absolute top-0 bottom-0 z-20 w-2 -translate-x-1 cursor-col-resize hover:bg-gray-300/60"
            style={{ left: taskWidth }}
          />
          <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white text-xs text-gray-500">
            <div className="shrink-0 px-4 py-1" style={{ width: taskWidth }}>
              Task
            </div>
            <div className="relative flex flex-1">
              {dayList.map((d, i) => (
                <div
                  key={i}
                  className={`flex-1 border-l border-gray-100 py-1 text-center ${i === todayIdx ? 'font-semibold text-gray-900' : ''}`}
                >
                  {range === 'week' ? fmt(d, { weekday: 'short', day: 'numeric' }) : d.getDate()}
                </div>
              ))}
            </div>
          </div>

          {done.length === 0 && <div className="p-8 text-sm text-gray-500">Nothing finished in this range.</div>}

          {done.map((t) => {
            const started = new Date(t.started).getTime()
            const completed = new Date(t.completed).getTime()
            const clipped = started < start.getTime()
            const color = colorOf(t.project) ?? '#9ca3af'
            return (
              <div key={t.id} className="group flex border-b border-gray-50 text-sm hover:bg-gray-50">
                <button
                  onClick={() => openPanel(t.id)}
                  className="flex shrink-0 items-center gap-2 truncate px-4 py-1.5 text-left"
                  style={{ width: taskWidth }}
                >
                  <span className="flex w-20 shrink-0 items-center gap-1 font-mono text-xs text-gray-400">
                    <ProjectSquare color={colorOf(t.project)} />
                    {t.id}
                  </span>
                  <span className="truncate text-gray-900">{t.title}</span>
                </button>
                <div className="relative flex flex-1">
                  {dayList.map((_, i) => (
                    <div key={i} className={`flex-1 border-l border-gray-100 ${i === todayIdx ? 'bg-amber-50/60' : ''}`} />
                  ))}
                  <button
                    onClick={() => openPanel(t.id)}
                    title={`${new Date(t.started).toLocaleString()} → ${new Date(t.completed).toLocaleString()}`}
                    className="absolute top-1/2 h-4 min-w-1.5 -translate-y-1/2 rounded-sm"
                    style={{
                      left: pct(started),
                      width: `calc(${pct(completed)} - ${pct(started)})`,
                      background: color,
                      borderTopLeftRadius: clipped ? 0 : undefined,
                      borderBottomLeftRadius: clipped ? 0 : undefined,
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
