import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { stringify } from 'yaml'
import { AGENTS_MD } from './agents-md'
import { DEFAULT_CONFIG } from './columns'
import { KbError } from './errors'
import { parseTask } from './format'
import type { Task } from './types'

const hasKanban = (dir: string) => fs.existsSync(path.join(dir, '.kanban'))

export function findWorkspace(opts: { dir?: string } = {}): string {
  const dir = path.resolve(opts.dir ?? process.env.KB_DIR ?? path.join(os.homedir(), 'Desktop', 'personal', '.kb'))
  if (!hasKanban(dir)) throw new KbError('not_found', `no .kanban/ in ${dir}`)
  return dir
}

export function initWorkspace(dir: string, prefix = 'KB'): void {
  fs.mkdirSync(path.join(dir, '.kanban', 'trash'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'tasks'), { recursive: true })
  const config = path.join(dir, '.kanban', 'config.yaml')
  if (!fs.existsSync(config)) fs.writeFileSync(config, stringify({ ...DEFAULT_CONFIG, idPrefix: prefix }))
  const agents = path.join(dir, 'AGENTS.md')
  if (!fs.existsSync(agents)) fs.writeFileSync(agents, AGENTS_MD)
}

const ID_RE = /^[A-Za-z]+-\d+$/

export function taskPath(ws: string, id: string): string {
  if (!ID_RE.test(id)) throw new KbError('usage', `invalid task id "${id}"`)
  return path.join(ws, 'tasks', `${id}.md`)
}

export function readTask(ws: string, id: string): { task: Task; text: string } {
  let text: string
  try {
    text = fs.readFileSync(taskPath(ws, id), 'utf8')
  } catch {
    throw new KbError('not_found', `task ${id} not found`)
  }
  return { task: parseTask(text), text }
}
