import fs from 'node:fs'
import path from 'node:path'
import { stringify } from 'yaml'
import { AGENTS_MD } from './agents-md'
import { DEFAULT_CONFIG } from './columns'
import { KbError } from './errors'
import { parseTask } from './format'
import type { Task } from './types'

const hasKanban = (dir: string) => fs.existsSync(path.join(dir, '.kanban'))

export function findWorkspace(opts: { dir?: string; cwd?: string } = {}): string {
  const explicit = opts.dir ?? process.env.KB_DIR
  if (explicit) {
    const dir = path.resolve(explicit)
    if (!hasKanban(dir)) throw new KbError('not_found', `no .kanban/ in ${dir}`)
    return dir
  }
  let dir = path.resolve(opts.cwd ?? process.cwd())
  while (!hasKanban(dir)) {
    const up = path.dirname(dir)
    if (up === dir) throw new KbError('not_found', 'no .kanban/ found in this or any parent directory')
    dir = up
  }
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

export function taskPath(ws: string, id: string): string {
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
