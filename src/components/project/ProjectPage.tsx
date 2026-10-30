'use client'

import { useState } from 'react'
import type { Task } from '@/core/types'
import Link from 'next/link'
import { PROJECT_COLORS } from '@/core/colors'
import { isDone } from '@/core/columns'
import { useKb, useProject } from '@/client/store'
import { ProjectSquare } from '@/components/ProjectSquare'

const FIRST_PAGE = 5
const PAGE_SIZE = 10
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

function ColorPicker({ projectKey, color }: { projectKey: string; color?: string }) {
  const updateProject = useKb((s) => s.updateProject)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex">
      <button onClick={() => setOpen(!open)} aria-label="Change color" className="flex p-1">
        <ProjectSquare color={color} size="h-3 w-3" />
      </button>
      {open && (
        <>
          <button aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 flex w-max gap-2 rounded border border-gray-200 bg-white p-2 shadow">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setOpen(false)
                  void updateProject(projectKey, { color: c }).catch(() => {})
                }}
                aria-label={`Color ${c}`}
                className={`h-6 w-6 rounded ${c === color ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatusGroup({ name, tasks, color, done }: { name: string; tasks: Task[]; color?: string; done: boolean }) {
  const openPanel = useKb((s) => s.openPanel)
  const [limit, setLimit] = useState(done ? 0 : FIRST_PAGE)
  const shown = tasks.slice(0, limit)
  const rest = tasks.length - shown.length

  return (
    <section className="space-y-1">
      <button
        onClick={() => setLimit(limit ? 0 : FIRST_PAGE)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700"
      >
        <span className="w-3 text-gray-400">{limit ? '▾' : '▸'}</span>
        {name}
        <span className="font-normal text-gray-400">{tasks.length}</span>
      </button>
      {limit > 0 && (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200">
          {shown.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => openPanel(t.id)}
                data-opens-task
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="flex w-20 shrink-0 items-center gap-1 font-mono text-xs text-gray-400">
                  <ProjectSquare color={color} />
                  {t.id}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{t.title}</span>
                {t.due && <span className="shrink-0 text-xs text-gray-500">{t.due}</span>}
              </button>
            </li>
          ))}
          {rest > 0 && (
            <li>
              <button
                onClick={() => setLimit(limit + PAGE_SIZE)}
                className="w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
              >
                Show {Math.min(rest, PAGE_SIZE)} more ({rest} left)
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

export function ProjectPage({ projectKey }: { projectKey: string }) {
  const index = useKb((s) => s.index)
  const project = useProject(projectKey)
  const [q, setQ] = useState('')

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
    .filter((t) => !needle || t.id.toLowerCase().includes(needle) || t.title.toLowerCase().includes(needle))
    .sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0))

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center gap-1">
        <ColorPicker projectKey={project.key} color={project.color} />
        <span className="font-mono text-sm font-medium text-gray-400">{project.key}</span>
        <NameEditor key={project.name} projectKey={project.key} name={project.name} />
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`w-full ${FIELD}`} />
      {config.columns.map((c) => {
        const group = tasks.filter((t) => t.status === c.key)
        if (!group.length) return null
        // A new search remounts the group so its page size starts over.
        return (
          <StatusGroup key={`${c.key}:${needle}`} name={c.name} tasks={group} color={project.color} done={isDone(config, c.key)} />
        )
      })}
      {tasks.length === 0 && <div className="text-sm text-gray-500">No tasks</div>}
    </div>
  )
}
