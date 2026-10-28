'use client'

import { useKb } from '@/client/store'
import { Filters } from '@/components/Filters'

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useKb((s) => s.filters.q)
  const setFilters = useKb((s) => s.setFilters)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose}>
      <div className="space-y-3 border-b border-gray-200 bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Search"
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button onClick={onClose} className="text-sm text-gray-500">
            Done
          </button>
        </div>
        <Filters />
      </div>
    </div>
  )
}
