'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isDone } from '@/core/columns'
import { useKb } from '@/client/store'

const FIELD = 'rounded border border-gray-300 px-2 py-1 text-sm'

export function ProjectsList() {
  const index = useKb((s) => s.index)
  const createProject = useKb((s) => s.createProject)
  const router = useRouter()
  const [key, setKey] = useState('')
  const [name, setName] = useState('')

  if (!index) return <div className="p-8 text-sm text-gray-500">Loading…</div>

  async function submit(): Promise<void> {
    if (!key.trim()) return
    try {
      const p = await createProject({ key, name: name.trim() || undefined })
      router.push(`/p/${p.key}`)
    } catch {
      // the store already pushed a toast with the error
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="text-lg font-semibold text-gray-900">Projects</h1>
      <ul className="divide-y divide-gray-100 rounded border border-gray-200">
        {index.projects.map((p) => {
          const open = index.tasks.filter((t) => t.project === p.key && !isDone(index.config, t.status)).length
          return (
            <li key={p.key}>
              <Link href={`/p/${p.key}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="w-16 shrink-0 font-mono text-xs" style={{ color: p.color }}>
                  {p.key}
                </span>
                <span className="flex-1 truncate font-medium text-gray-900">{p.name}</span>
                <span className="shrink-0 text-xs text-gray-500">{open} open</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className="space-y-2"
      >
        <h2 className="text-sm font-semibold text-gray-700">New project</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Key (e.g. NEWS)"
            maxLength={6}
            className={`w-36 font-mono uppercase ${FIELD}`}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className={`min-w-0 flex-1 ${FIELD}`}
          />
          <button
            type="submit"
            disabled={!key.trim()}
            className="rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
