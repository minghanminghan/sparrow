'use client'

import { useState } from 'react'
import { useKb } from '@/client/store'
import { ENVS } from '@/core/env'
import type { Env } from '@/core/env'

// Dev servers only: flips between the local DB and the prod server. The board, cache, and live updates follow.
export function EnvToggle({ env: initial }: { env: Env }) {
  const env = useKb((s) => s.env) ?? initial
  const switchEnv = useKb((s) => s.switchEnv)
  const [busy, setBusy] = useState(false)

  async function flip(): Promise<void> {
    setBusy(true)
    const next = env === 'dev' ? 'prod' : 'dev'
    const res = await fetch('/api/dev/env', { method: 'POST', body: JSON.stringify({ env: next }) }).catch(() => null)
    if (res?.ok) switchEnv(next)
    setBusy(false)
  }

  return (
    <button
      onClick={flip}
      disabled={busy}
      title={`Using the ${env} DB. Click to switch.`}
      className="flex shrink-0 overflow-hidden rounded-full border border-gray-900 text-xs font-medium"
    >
      {ENVS.map((e) => (
        <span key={e} className={`px-2.5 py-0.5 ${e === env ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
          {e}
        </span>
      ))}
    </button>
  )
}
