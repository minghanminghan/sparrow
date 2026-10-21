import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { KbError } from './errors'
import type { Config } from './types'
import { validateConfig } from './columns'

export * from './columns'

export function loadConfig(ws: string): Config {
  const file = path.join(ws, '.kanban', 'config.yaml')
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    throw new KbError('invalid', `cannot read config at ${file}`)
  }
  let config: Config
  try {
    config = parse(text) as Config
  } catch (err) {
    throw new KbError('invalid', `invalid config yaml: ${(err as Error).message}`)
  }
  validateConfig(config)
  return config
}
