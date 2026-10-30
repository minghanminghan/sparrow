import { loadAttachments } from './attachments'
import { columnByRole, isDone, loadConfig } from './config'
import type { Db } from './db'
import { hash } from './format'
import { MENTION_RE } from './keys'
import { loadProjects } from './projects'
import { loadTasks } from './store'
import type { Attachment, Config, Project, Task } from './types'

export type Backlink = { type: 'blocked-by' | 'relates' | 'mentioned-in'; id: string; done?: true }
export type TaskView = Task & {
  titleHash: string
  bodyHash: string
  backlinks: Backlink[]
  blocked: boolean
  children: string[]
  progress: { done: number; total: number }
  attachments: Attachment[]
}
export type Index = { config: Config; projects: Project[]; tasks: TaskView[] }

const REVERSE_LINK: Record<Task['links'][number]['type'], Backlink['type']> = {
  blocks: 'blocked-by',
  relates: 'relates',
}

function mentionsIn(task: Task): string[] {
  const ids = new Set<string>()
  for (const m of task.body.matchAll(MENTION_RE)) ids.add(m[1].toUpperCase())
  for (const c of task.comments) for (const m of c.body.matchAll(MENTION_RE)) ids.add(m[1].toUpperCase())
  return [...ids]
}

export function buildIndex(db: Db): Index {
  const config = loadConfig(db)
  const tasksById = new Map<string, Task>(loadTasks(db).map((t) => [t.id, t]))
  const attachments = loadAttachments(db)

  const backlinks = new Map<string, Backlink[]>()
  const addBacklink = (id: string, bl: Backlink) => {
    if (!tasksById.has(id)) return
    if (!backlinks.has(id)) backlinks.set(id, [])
    backlinks.get(id)!.push(bl)
  }
  const children = new Map<string, string[]>()

  for (const task of tasksById.values()) {
    const done = isDone(config, task.status)
    for (const link of task.links) {
      const bl: Backlink = { type: REVERSE_LINK[link.type], id: task.id }
      if (bl.type === 'blocked-by' && done) bl.done = true
      addBacklink(link.id, bl)
    }
    for (const mentioned of mentionsIn(task)) addBacklink(mentioned, { type: 'mentioned-in', id: task.id })
    if (task.parent) {
      if (!children.has(task.parent)) children.set(task.parent, [])
      children.get(task.parent)!.push(task.id)
    }
  }

  const views: TaskView[] = [...tasksById.values()].map((task) => {
    const kids = children.get(task.id) ?? []
    const done = kids.filter((id) => isDone(config, tasksById.get(id)!.status)).length
    const bls = backlinks.get(task.id) ?? []
    return {
      ...task,
      titleHash: hash(task.title),
      bodyHash: hash(task.body),
      backlinks: bls,
      blocked: bls.some((b) => b.type === 'blocked-by' && !b.done),
      children: kids,
      progress: { done, total: kids.length },
      attachments: attachments.get(task.id) ?? [],
    }
  })

  views.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))

  return { config, projects: loadProjects(db), tasks: views }
}

export function viewTask(index: Index, id: string): TaskView | undefined {
  return index.tasks.find((t) => t.id === id)
}

export function nextTask(index: Index): TaskView | null {
  const { config, tasks } = index
  const readyKey = columnByRole(config, 'ready').key
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const unfinished = (status: string) => !isDone(config, status)

  const hasUnfinishedSubtask = (task: TaskView) =>
    task.children.some((id) => {
      const child = byId.get(id)
      return child !== undefined && unfinished(child.status)
    })

  const candidates = tasks.filter((t) => {
    if (t.status !== readyKey) return false
    if (hasUnfinishedSubtask(t)) return false
    return !t.blocked
  })

  candidates.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
  return candidates[0] ?? null
}
