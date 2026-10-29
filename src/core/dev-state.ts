import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Env } from './env'

// Written by scripts/dev.sh while `pnpm dev` runs. The toggle in the app rewrites `env`.
export type DevState = { url: string; env: Env; pid: number }

export function devStatePath(): string {
  return path.join(os.homedir(), '.sparrow', 'dev.json')
}

export function readDevState(): DevState | null {
  try {
    const state = JSON.parse(fs.readFileSync(devStatePath(), 'utf8')) as DevState
    process.kill(state.pid, 0)
    return state
  } catch {
    return null
  }
}

export function writeDevEnv(env: Env): DevState {
  const state = readDevState()
  if (!state) throw new Error(`${devStatePath()} is missing. Start the server with: pnpm dev`)
  const next = { ...state, env }
  fs.writeFileSync(devStatePath(), JSON.stringify(next) + '\n')
  return next
}
