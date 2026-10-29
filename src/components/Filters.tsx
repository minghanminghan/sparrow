'use client'

import { useKb } from '@/client/store'
import type { Filters as FiltersType } from '@/client/store'

export function Filters() {
  const filters = useKb((s) => s.filters)
  const setFilters = useKb((s) => s.setFilters)

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
    </div>
  )
}
