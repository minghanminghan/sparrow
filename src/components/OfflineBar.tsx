'use client'

import { useEffect, useState } from 'react'
import { useKb } from '@/client/store'

function age(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h`
}

export function OfflineBar() {
  const offline = useKb((s) => s.offline)
  const savedAt = useKb((s) => s.savedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  if (!offline || !savedAt) return null
  return (
    <div className="bg-amber-50 px-3 py-1 text-[11px] text-amber-800">
      Offline · tasks from {age(now - savedAt)} ago
    </div>
  )
}
