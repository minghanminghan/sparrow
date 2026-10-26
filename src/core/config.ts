import type { Db } from './db'
import type { Config } from './types'
import { validateConfig } from './columns'

export * from './columns'

export function loadConfig(db: Db): Config {
  const row = db.prepare('SELECT value FROM config WHERE id = 1').get() as { value: string }
  const config = JSON.parse(row.value) as Config
  validateConfig(config)
  return config
}
