import fs from 'node:fs'
import path from 'node:path'
import {
  applyOp,
  buildIndex,
  createTask,
  deleteTask,
  EXIT,
  findWorkspace,
  initWorkspace,
  isDone,
  KbError,
  nextTask,
  rankBetween,
  readTask,
  viewTask,
} from '../core'
import type { LinkType, Op, TaskView } from '../core'

export type FlagType = 'string' | 'boolean'
export type FlagDef = { name: string; type: FlagType; desc: string }
export type CommandDef = { name: string; summary: string; flags: FlagDef[] }
export type Values = Record<string, string | boolean | undefined>

export const GLOBAL_FLAGS: FlagDef[] = [
  { name: 'dir', type: 'string', desc: 'workspace directory (default: KB_DIR, then nearest .kanban/)' },
  { name: 'json', type: 'boolean', desc: 'force JSON output' },
]

export const COMMANDS: CommandDef[] = [
  { name: 'init', summary: 'Create .kanban/, tasks/, AGENTS.md.', flags: [{ name: 'prefix', type: 'string', desc: 'ID prefix (default KB)' }] },
  { name: 'serve', summary: 'Start the web app for this workspace.', flags: [{ name: 'port', type: 'string', desc: 'port to bind (default 4600)' }] },
  {
    name: 'list',
    summary: 'List tasks, ordered by rank.',
    flags: [
      { name: 'status', type: 'string', desc: 'filter by status' },
      { name: 'parent', type: 'string', desc: 'filter by parent id' },
      { name: 'assignee', type: 'string', desc: 'filter by assignee' },
      { name: 'due-before', type: 'string', desc: 'filter: due before YYYY-MM-DD' },
      { name: 'overdue', type: 'boolean', desc: 'filter: due before today (local)' },
      { name: 'tree', type: 'boolean', desc: 'order children under parents' },
      { name: 'all', type: 'boolean', desc: 'include done tasks' },
    ],
  },
  { name: 'show', summary: 'Show full task detail (id is positional).', flags: [] },
  {
    name: 'create',
    summary: 'Create a new task.',
    flags: [
      { name: 'title', type: 'string', desc: 'task title (required)' },
      { name: 'parent', type: 'string', desc: 'parent task id' },
      { name: 'status', type: 'string', desc: 'status (default: ready column)' },
      { name: 'due', type: 'string', desc: 'due date YYYY-MM-DD' },
      { name: 'assignee', type: 'string', desc: 'assignee' },
      { name: 'body', type: 'string', desc: 'body text, or "-" for stdin' },
      { name: 'body-file', type: 'string', desc: 'path to a file with body text' },
    ],
  },
  {
    name: 'update',
    summary: 'Update task fields (id is positional).',
    flags: [
      { name: 'title', type: 'string', desc: 'new title' },
      { name: 'base-hash', type: 'string', desc: 'expected titleHash, for conflict checking' },
      { name: 'status', type: 'string', desc: 'new status' },
      { name: 'due', type: 'string', desc: 'YYYY-MM-DD, or "none" to clear' },
      { name: 'assignee', type: 'string', desc: 'assignee, or "none" to clear' },
      { name: 'parent', type: 'string', desc: 'new parent task id' },
      { name: 'before', type: 'string', desc: 'rank just before this task id, same status' },
      { name: 'after', type: 'string', desc: 'rank just after this task id, same status' },
    ],
  },
  {
    name: 'body',
    summary: 'Replace the task description (id is positional).',
    flags: [
      { name: 'body', type: 'string', desc: 'body text, or "-" for stdin' },
      { name: 'body-file', type: 'string', desc: 'path to a file with body text' },
      { name: 'base-hash', type: 'string', desc: 'expected bodyHash, for conflict checking' },
    ],
  },
  {
    name: 'comment',
    summary: 'Add a comment to a task (id is positional).',
    flags: [
      { name: 'body', type: 'string', desc: 'comment text, or "-" for stdin' },
      { name: 'body-file', type: 'string', desc: 'path to a file with comment text' },
      { name: 'author', type: 'string', desc: 'default: KB_AUTHOR, then "ai"' },
    ],
  },
  {
    name: 'link',
    summary: 'Add a typed link to another task (id is positional).',
    flags: [
      { name: 'blocks', type: 'string', desc: 'id of the task this one blocks' },
      { name: 'relates', type: 'string', desc: 'id of a related task' },
      { name: 'duplicates', type: 'string', desc: 'id of the task this one duplicates' },
    ],
  },
  {
    name: 'unlink',
    summary: 'Remove a typed link (id is positional).',
    flags: [
      { name: 'blocks', type: 'string', desc: 'id of the task this one blocks' },
      { name: 'relates', type: 'string', desc: 'id of a related task' },
      { name: 'duplicates', type: 'string', desc: 'id of the task this one duplicates' },
    ],
  },
  {
    name: 'ref',
    summary: 'Add an external reference (id is positional).',
    flags: [
      { name: 'url', type: 'string', desc: 'reference URL (required)' },
      { name: 'label', type: 'string', desc: 'optional label' },
    ],
  },
  {
    name: 'unref',
    summary: 'Remove an external reference (id is positional).',
    flags: [{ name: 'url', type: 'string', desc: 'reference URL (required)' }],
  },
  {
    name: 'next',
    summary: 'Show the highest-ranked available task.',
    flags: [{ name: 'assignee', type: 'string', desc: 'include tasks already assigned to this assignee' }],
  },
  {
    name: 'claim',
    summary: 'Claim a task and move it to the active column (id is positional).',
    flags: [{ name: 'assignee', type: 'string', desc: 'assignee (required)' }],
  },
  { name: 'delete', summary: 'Move a task to trash (id is positional).', flags: [] },
  { name: 'help', summary: 'List every command, flag, and exit code.', flags: [] },
]

export type CommandResult =
  | { kind: 'task'; value: TaskView }
  | { kind: 'maybeTask'; value: TaskView | null }
  | { kind: 'tasks'; value: TaskView[]; lines: { task: TaskView; depth: number }[] }
  | { kind: 'init'; value: { ws: string } }
  | { kind: 'deleted'; value: { id: string; deleted: true } }
  | { kind: 'help'; value: { commands: CommandDef[]; globalFlags: FlagDef[]; exitCodes: Record<string, number> } }

function requireOneId(positionals: string[]): string {
  if (positionals.length !== 1) throw new KbError('usage', 'expected exactly one task id')
  return positionals[0]
}

function readBodyInput(values: Values): string | undefined {
  const body = values.body as string | undefined
  if (body !== undefined) return body === '-' ? fs.readFileSync(0, 'utf8') : body
  const bodyFile = values['body-file'] as string | undefined
  if (bodyFile !== undefined) return fs.readFileSync(path.resolve(bodyFile), 'utf8')
  return undefined
}

function requireBody(values: Values, command: string): string {
  const body = readBodyInput(values)
  if (body === undefined) throw new KbError('usage', `${command} requires --body or --body-file`)
  return body
}

function todayLocal(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

async function freshView(ws: string, id: string): Promise<TaskView> {
  return viewTask(buildIndex(ws), id)!
}

function cmdInit(values: Values): CommandResult {
  const dir = path.resolve((values.dir as string | undefined) ?? process.env.KB_DIR ?? process.cwd())
  initWorkspace(dir, (values.prefix as string | undefined) ?? 'KB')
  return { kind: 'init', value: { ws: dir } }
}

function cmdHelp(): CommandResult {
  return { kind: 'help', value: { commands: COMMANDS, globalFlags: GLOBAL_FLAGS, exitCodes: { ok: 0, ...EXIT } } }
}

function cmdShow(ws: string, id: string): CommandResult {
  const view = viewTask(buildIndex(ws), id)
  if (!view) throw new KbError('not_found', `task ${id} not found`)
  return { kind: 'task', value: view }
}

function filterTasks(ws: string, values: Values): TaskView[] {
  const idx = buildIndex(ws)
  let tasks = idx.tasks
  if (!values.all) tasks = tasks.filter((t) => !isDone(idx.config, t.status))
  if (values.status !== undefined) tasks = tasks.filter((t) => t.status === values.status)
  if (values.parent !== undefined) tasks = tasks.filter((t) => t.parent === values.parent)
  if (values.assignee !== undefined) tasks = tasks.filter((t) => t.assignee === values.assignee)
  if (values['due-before'] !== undefined) {
    const before = values['due-before'] as string
    tasks = tasks.filter((t) => t.due !== undefined && t.due < before)
  }
  if (values.overdue) {
    const today = todayLocal()
    tasks = tasks.filter((t) => t.due !== undefined && t.due < today)
  }
  return tasks
}

function treeLines(tasks: TaskView[]): { task: TaskView; depth: number }[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const childMap = new Map<string, TaskView[]>()
  for (const t of tasks) {
    if (t.parent && byId.has(t.parent)) {
      if (!childMap.has(t.parent)) childMap.set(t.parent, [])
      childMap.get(t.parent)!.push(t)
    }
  }
  const roots = tasks.filter((t) => !t.parent || !byId.has(t.parent))
  const out: { task: TaskView; depth: number }[] = []
  const visit = (t: TaskView, depth: number): void => {
    out.push({ task: t, depth })
    for (const c of childMap.get(t.id) ?? []) visit(c, depth + 1)
  }
  for (const r of roots) visit(r, 0)
  return out
}

function cmdList(ws: string, values: Values): CommandResult {
  const tasks = filterTasks(ws, values)
  const lines = values.tree ? treeLines(tasks) : tasks.map((t) => ({ task: t, depth: 0 }))
  return { kind: 'tasks', value: lines.map((l) => l.task), lines }
}

function cmdNext(ws: string, values: Values): CommandResult {
  const task = nextTask(buildIndex(ws), values.assignee as string | undefined)
  return { kind: 'maybeTask', value: task }
}

async function cmdCreate(ws: string, values: Values): Promise<CommandResult> {
  const title = values.title as string | undefined
  if (!title) throw new KbError('usage', 'create requires --title')
  const task = await createTask(ws, {
    title,
    parent: values.parent as string | undefined,
    status: values.status as string | undefined,
    due: values.due as string | undefined,
    assignee: values.assignee as string | undefined,
    body: readBodyInput(values),
  })
  return { kind: 'task', value: await freshView(ws, task.id) }
}

function neighborRank(ws: string, status: string, selfId: string, beforeId?: string, afterId?: string): string {
  const siblings = buildIndex(ws).tasks.filter((t) => t.status === status && t.id !== selfId)
  if (beforeId !== undefined) {
    const i = siblings.findIndex((t) => t.id === beforeId)
    if (i === -1) throw new KbError('not_found', `task ${beforeId} not found in status "${status}"`)
    return rankBetween(siblings[i - 1]?.rank, siblings[i].rank)
  }
  const i = siblings.findIndex((t) => t.id === afterId)
  if (i === -1) throw new KbError('not_found', `task ${afterId} not found in status "${status}"`)
  return rankBetween(siblings[i].rank, siblings[i + 1]?.rank)
}

async function cmdUpdate(ws: string, id: string, values: Values): Promise<CommandResult> {
  let task = readTask(ws, id).task
  const apply = async (op: Op): Promise<void> => {
    task = await applyOp(ws, id, op)
  }
  if (values.title !== undefined) await apply({ type: 'setTitle', title: values.title as string, baseHash: values['base-hash'] as string | undefined })
  if (values.status !== undefined) await apply({ type: 'setStatus', status: values.status as string })
  if (values.due !== undefined) await apply({ type: 'setDue', due: values.due === 'none' ? null : (values.due as string) })
  if (values.assignee !== undefined) {
    await apply({ type: 'setAssignee', assignee: values.assignee === 'none' ? null : (values.assignee as string) })
  }
  if (values.parent !== undefined) await apply({ type: 'setParent', parent: values.parent as string })
  if (values.before !== undefined || values.after !== undefined) {
    const rank = neighborRank(ws, task.status, id, values.before as string | undefined, values.after as string | undefined)
    await apply({ type: 'setRank', rank })
  }
  return { kind: 'task', value: await freshView(ws, id) }
}

async function cmdBody(ws: string, id: string, values: Values): Promise<CommandResult> {
  const body = requireBody(values, 'body')
  await applyOp(ws, id, { type: 'setBody', body, baseHash: values['base-hash'] as string | undefined })
  return { kind: 'task', value: await freshView(ws, id) }
}

async function cmdComment(ws: string, id: string, values: Values): Promise<CommandResult> {
  const body = requireBody(values, 'comment')
  const author = (values.author as string | undefined) ?? process.env.KB_AUTHOR ?? 'ai'
  await applyOp(ws, id, { type: 'addComment', author, body })
  return { kind: 'task', value: await freshView(ws, id) }
}

function linkTypeAndTarget(values: Values): { type: LinkType; target: string } {
  const kinds: LinkType[] = ['blocks', 'relates', 'duplicates']
  const given = kinds.filter((k) => values[k] !== undefined)
  if (given.length !== 1) throw new KbError('usage', 'specify exactly one of --blocks, --relates, --duplicates')
  return { type: given[0], target: values[given[0]] as string }
}

async function cmdLink(ws: string, id: string, values: Values, remove: boolean): Promise<CommandResult> {
  const { type, target } = linkTypeAndTarget(values)
  const op: Op = remove ? { type: 'removeLink', link: { type, id: target } } : { type: 'addLink', link: { type, id: target } }
  await applyOp(ws, id, op)
  return { kind: 'task', value: await freshView(ws, id) }
}

async function cmdRef(ws: string, id: string, values: Values): Promise<CommandResult> {
  const url = values.url as string | undefined
  if (!url) throw new KbError('usage', 'ref requires --url')
  const label = values.label as string | undefined
  await applyOp(ws, id, { type: 'addRef', ref: label ? { url, label } : { url } })
  return { kind: 'task', value: await freshView(ws, id) }
}

async function cmdUnref(ws: string, id: string, values: Values): Promise<CommandResult> {
  const url = values.url as string | undefined
  if (!url) throw new KbError('usage', 'unref requires --url')
  await applyOp(ws, id, { type: 'removeRef', url })
  return { kind: 'task', value: await freshView(ws, id) }
}

async function cmdClaim(ws: string, id: string, values: Values): Promise<CommandResult> {
  const assignee = values.assignee as string | undefined
  if (!assignee) throw new KbError('usage', 'claim requires --assignee')
  await applyOp(ws, id, { type: 'claim', assignee })
  return { kind: 'task', value: await freshView(ws, id) }
}

async function cmdDelete(ws: string, id: string): Promise<CommandResult> {
  await deleteTask(ws, id)
  return { kind: 'deleted', value: { id, deleted: true } }
}

export async function runCommand(name: string, values: Values, positionals: string[]): Promise<CommandResult> {
  if (name === 'init') return cmdInit(values)
  if (name === 'help') return cmdHelp()

  const ws = findWorkspace({ dir: values.dir as string | undefined })
  switch (name) {
    case 'list':
      return cmdList(ws, values)
    case 'show':
      return cmdShow(ws, requireOneId(positionals))
    case 'create':
      return cmdCreate(ws, values)
    case 'update':
      return cmdUpdate(ws, requireOneId(positionals), values)
    case 'body':
      return cmdBody(ws, requireOneId(positionals), values)
    case 'comment':
      return cmdComment(ws, requireOneId(positionals), values)
    case 'link':
      return cmdLink(ws, requireOneId(positionals), values, false)
    case 'unlink':
      return cmdLink(ws, requireOneId(positionals), values, true)
    case 'ref':
      return cmdRef(ws, requireOneId(positionals), values)
    case 'unref':
      return cmdUnref(ws, requireOneId(positionals), values)
    case 'next':
      return cmdNext(ws, values)
    case 'claim':
      return cmdClaim(ws, requireOneId(positionals), values)
    case 'delete':
      return cmdDelete(ws, requireOneId(positionals))
    default:
      throw new KbError('usage', `unknown command "${name}"`)
  }
}
