import fs from 'node:fs'
import path from 'node:path'
import { columnByRole, isDone, loadConfig } from './config'
import { hash, parseTask } from './format'
import type { Config, Task } from './types'

export type Backlink = { type: 'blocked-by' | 'relates' | 'duplicated-by' | 'mentioned-in'; id: string }
export type TaskView = Task & {
  titleHash: string
  bodyHash: string
  backlinks: Backlink[]
  children: string[]
  progress: { done: number; total: number }
}
export type InvalidFile = { file: string; error: string }
export type Index = { config: Config; tasks: TaskView[]; invalid: InvalidFile[] }

const TASK_FILE_RE = /^[A-Za-z]+-\d+\.md$/
const MENTION_RE = /\[\[([A-Za-z]+-\d+)\]\]/g

export function isTaskFile(name: string): boolean {
  return TASK_FILE_RE.test(name)
}

const REVERSE_LINK: Record<Task['links'][number]['type'], Backlink['type']> = {
  blocks: 'blocked-by',
  relates: 'relates',
  duplicates: 'duplicated-by',
}

function mentionsIn(task: Task): string[] {
  const ids = new Set<string>()
  for (const m of task.body.matchAll(MENTION_RE)) ids.add(m[1])
  for (const c of task.comments) for (const m of c.body.matchAll(MENTION_RE)) ids.add(m[1])
  return [...ids]
}

export function buildIndex(ws: string): Index {
  const config = loadConfig(ws)
  const dir = path.join(ws, 'tasks')
  const tasksById = new Map<string, Task>()
  const invalid: InvalidFile[] = []

  for (const name of fs.readdirSync(dir)) {
    if (!isTaskFile(name)) continue
    try {
      const task = parseTask(fs.readFileSync(path.join(dir, name), 'utf8'))
      tasksById.set(task.id, task)
    } catch (err) {
      invalid.push({ file: name, error: (err as Error).message })
    }
  }

  const backlinks = new Map<string, Backlink[]>()
  const addBacklink = (id: string, bl: Backlink) => {
    if (!tasksById.has(id)) return
    if (!backlinks.has(id)) backlinks.set(id, [])
    backlinks.get(id)!.push(bl)
  }
  const children = new Map<string, string[]>()

  for (const task of tasksById.values()) {
    for (const link of task.links) addBacklink(link.id, { type: REVERSE_LINK[link.type], id: task.id })
    for (const mentioned of mentionsIn(task)) addBacklink(mentioned, { type: 'mentioned-in', id: task.id })
    if (task.parent) {
      if (!children.has(task.parent)) children.set(task.parent, [])
      children.get(task.parent)!.push(task.id)
    }
  }

  const views: TaskView[] = [...tasksById.values()].map((task) => {
    const kids = children.get(task.id) ?? []
    const done = kids.filter((id) => isDone(config, tasksById.get(id)!.status)).length
    return {
      ...task,
      titleHash: hash(task.title),
      bodyHash: hash(task.body),
      backlinks: backlinks.get(task.id) ?? [],
      children: kids,
      progress: { done, total: kids.length },
    }
  })

  views.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))

  return { config, tasks: views, invalid }
}

export function viewTask(index: Index, id: string): TaskView | undefined {
  return index.tasks.find((t) => t.id === id)
}

export function nextTask(index: Index, assignee?: string): TaskView | null {
  const { config, tasks } = index
  const readyKey = columnByRole(config, 'ready').key
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const unfinished = (status: string) => !isDone(config, status)

  const isBlocked = (task: TaskView) =>
    tasks.some(
      (other) => unfinished(other.status) && other.links.some((l) => l.type === 'blocks' && l.id === task.id),
    )

  const hasUnfinishedSubtask = (task: TaskView) =>
    task.children.some((id) => {
      const child = byId.get(id)
      return child !== undefined && unfinished(child.status)
    })

  const candidates = tasks.filter((t) => {
    if (t.status !== readyKey) return false
    if (hasUnfinishedSubtask(t)) return false
    if (isBlocked(t)) return false
    if (assignee === undefined) return t.assignee === undefined
    return t.assignee === undefined || t.assignee === assignee
  })

  candidates.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
  return candidates[0] ?? null
}
