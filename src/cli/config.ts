import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { KbError } from '../core/errors'

export type CliConfig = { url?: string }

export const DEFAULT_URL = 'http://127.0.0.1:3000'

export function configPath(): string {
  const dir = process.env.SPARROW_CONFIG_DIR ?? path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'sparrow')
  return path.join(dir, 'config.json')
}

export function readConfig(): CliConfig {
  const file = configPath()
  if (!fs.existsSync(file)) return {}
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as CliConfig
  } catch (err) {
    throw new KbError('invalid', `${file}: ${(err as Error).message}`)
  }
}

export function writeConfig(config: CliConfig): void {
  const file = configPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
}

// SPARROW_URL, then the config file, then a local `pnpm dev` / `next start`.
export function serverUrl(): string {
  return (process.env.SPARROW_URL || readConfig().url || DEFAULT_URL).replace(/\/+$/, '')
}
