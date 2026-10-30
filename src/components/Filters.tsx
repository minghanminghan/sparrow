'use client'

import { useKb } from '@/client/store'
import type { Filters as FiltersType } from '@/client/store'
import type { Project } from '@/core'
import { ProjectSquare } from '@/components/ProjectSquare'

const NO_PROJECTS: Project[] = []

export function Filters() {
  const filters = useKb((s) => s.filters)
  const setFilters = useKb((s) => s.setFilters)
  const projects = useKb((s) => s.index?.projects ?? NO_PROJECTS)

  function toggleProject(key: string, on: boolean): void {
    setFilters({ projects: on ? [...filters.projects, key] : filters.projects.filter((k) => k !== key) })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={filters.hideSubtasks}
          onChange={(e) => setFilters({ hideSubtasks: e.target.checked })}
        />
        Hide subtasks
      </label>
      <select
        value={filters.due ?? ''}
        onChange={(e) => setFilters({ due: (e.target.value || undefined) as FiltersType['due'] })}
        className="rounded border border-gray-300 px-2 py-1"
      >
        <option value="">Due: any</option>
        <option value="overdue">Overdue</option>
        <option value="week">This week</option>
      </select>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={filters.showDone}
          onChange={(e) => setFilters({ showDone: e.target.checked })}
        />
        Show done
      </label>
      <details className="relative">
        <summary className="cursor-pointer list-none rounded border border-gray-300 px-2 py-1">
          Project: {filters.projects.length ? filters.projects.join(', ') : 'All'}
        </summary>
        <div className="absolute z-20 mt-1 min-w-48 rounded border border-gray-200 bg-white p-1 shadow-lg">
          {projects.map((p) => (
            <label key={p.key} className="flex items-center gap-2 rounded px-2 py-1 whitespace-nowrap hover:bg-gray-50">
              <input type="checkbox" checked={filters.projects.includes(p.key)} onChange={(e) => toggleProject(p.key, e.target.checked)} />
              <ProjectSquare color={p.color} />
              <span className="font-mono text-xs">{p.key}</span>
              <span className="text-gray-500">{p.name}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}
