'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PROJECT_COLORS } from '@/core/colors'
import { isDone } from '@/core/columns'
import { useKb, useProject } from '@/client/store'
import { ProjectSquare } from '@/components/ProjectSquare'

const PAGE_SIZE = 20
const FIELD = 'rounded border border-gray-300 px-2 py-1 text-sm'

function NameEditor({ projectKey, name }: { projectKey: string; name: string }) {
  const updateProject = useKb((s) => s.updateProject)
  const [draft, setDraft] = useState<string | null>(null)

  function save(): void {
    const next = draft?.trim()
    setDraft(null)
    if (next && next !== name) void updateProject(projectKey, { name: next }).catch(() => {})
  }

  return (
    <input
      value={draft ?? name}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setDraft(null)
      }}
      aria-label="Project name"
      className="min-w-0 flex-1 rounded border border-transparent px-1 text-lg font-semibold text-gray-900 outline-none hover:border-gray-200 focus:border-gray-400"
    />
  )
}

export function ProjectPage({ projectKey }: { projectKey: string }) {
  const index = useKb((s) => s.index)
  const project = useProject(projectKey)
  const updateProject = useKb((s) => s.updateProject)
  const openPanel = useKb((s) => s.openPanel)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [page, setPage] = useState(0)

  if (!index) return <div className="p-8 text-sm text-gray-500">Loading…</div>
  if (!project) {
    return (
      <div className="mx-auto max-w-3xl p-4 text-sm text-gray-600">
        No project {projectKey}.{' '}
        <Link href="/p" className="underline">
          All projects
        </Link>
      </div>
    )
  }

  const { config } = index
  const needle = q.trim().toLowerCase()
  const tasks = index.tasks
    .filter((t) => t.project === project.key)
    .filter((t) => !status || t.status === status)
    .filter((t) => showDone || status || !isDone(config, t.status))
    .filter((t) => !needle || t.id.toLowerCase().includes(needle) || t.title.toLowerCase().includes(needle))
    .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0))
  const pages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const shown = tasks.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
  // Any filter change goes back to the first page.
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(0)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ProjectSquare color={project.color} size="h-3 w-3" />
          <span className="font-mono text-sm font-medium text-gray-400">
            {project.key}
          </span>
          <NameEditor key={project.name} projectKey={project.key} name={project.name} />
        </div>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => void updateProject(project.key, { color: c }).catch(() => {})}
              aria-label={`Color ${c}`}
              className={`h-6 w-6 rounded ${c === project.color ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <input
            value={q}
            onChange={(e) => filter(setQ)(e.target.value)}
            placeholder="Search"
            className={`min-w-0 flex-1 ${FIELD}`}
          />
          <select value={status} onChange={(e) => filter(setStatus)(e.target.value)} className={FIELD}>
            <option value="">All</option>
            {config.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={showDone} onChange={(e) => filter(setShowDone)(e.target.checked)} />
            Show done
          </label>
        </div>
        <ul className="divide-y divide-gray-100 rounded border border-gray-200">
          {shown.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => openPanel(t.id)}
                data-opens-task
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="flex w-20 shrink-0 items-center gap-1 font-mono text-xs text-gray-400">
                  <ProjectSquare color={project.color} />
                  {t.id}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{t.title}</span>
                <span className="shrink-0 text-xs text-gray-500">
                  {config.columns.find((c) => c.key === t.status)?.name ?? t.status}
                </span>
                {t.due && <span className="shrink-0 text-xs text-gray-500">{t.due}</span>}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No tasks</li>}
        </ul>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{tasks.length ? `${current * PAGE_SIZE + 1}–${current * PAGE_SIZE + shown.length} of ${tasks.length}` : '0 of 0'}</span>
          <span className="flex gap-3">
            <button onClick={() => setPage(current - 1)} disabled={current === 0} className="disabled:opacity-40">
              ‹ Prev
            </button>
            <button onClick={() => setPage(current + 1)} disabled={current >= pages - 1} className="disabled:opacity-40">
              Next ›
            </button>
          </span>
        </div>
      </section>
    </div>
  )
}
