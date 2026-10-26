import fs from 'node:fs'
import path from 'node:path'
import {
  addAttachment,
  applyOp,
  buildIndex,
  createTask,
  deleteTask,
  EXIT,
  isDone,
  KbError,
  openDb,
  MAX_ATTACHMENT_BYTES,
  rankBetween,
  readTask,
  removeAttachment,
  viewTask,
} from '../core'
import type { Attachment, Db, LinkType, Op, TaskView } from '../core'

export type FlagType = 'string' | 'boolean'
export type FlagDef = { name: string; short?: string; type: FlagType; desc: string }
export type CommandDef = { name: string; summary: string; args?: string; flags: FlagDef[] }
export type Values = Record<string, string | boolean | undefined>

export const GLOBAL_FLAGS: FlagDef[] = [
  { name: 'json', type: 'boolean', desc: 'force JSON output' },
  { name: 'help', short: 'h', type: 'boolean', desc: 'Print help' },
]

export const COMMANDS: CommandDef[] = [
  {
    name: 'list',
    summary: 'List tasks, ordered by rank',
    flags: [
      { name: 'status', type: 'string', desc: 'filter by status' },
      { name: 'parent', type: 'string', desc: 'filter by parent id' },
      { name: 'assignee', type: 'string', desc: 'filter by assignee' },
      { name: 'due-before', type: 'string', desc: 'filter: due before YYYY-MM-DD' },
      { name: 'overdue', type: 'boolean', desc: 'filter: due before today (local)' },
      { name: 'tree', type: 'boolean', desc: 'order children under parents' },
      { name: 'all', type: 'boolean', desc: 'include done tasks' },
      { name: 'limit', type: 'string', desc: 'max tasks to return (default 20)' },
      { name: 'offset', type: 'string', desc: 'tasks to skip (default 0)' },
    ],
  },
  { name: 'show', summary: 'Show full task detail', args: '<ID>', flags: [] },
  {
    name: 'create',
    summary: 'Create a new task',
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
    summary: 'Update task fields',
    args: '<ID>',
    flags: [
      { name: 'title', type: 'string', desc: 'new title' },
      { name: 'title-hash', type: 'string', desc: 'expected titleHash, for conflict checking' },
      { name: 'body', type: 'string', desc: 'replace description, or "-" for stdin' },
      { name: 'body-file', type: 'string', desc: 'replace description from a file' },
      { name: 'body-hash', type: 'string', desc: 'expected bodyHash, for conflict checking' },
      { name: 'status', type: 'string', desc: 'new status' },
      { name: 'due', type: 'string', desc: 'YYYY-MM-DD, or "none" to clear' },
      { name: 'assignee', type: 'string', desc: 'assignee, or "none" to clear' },
      { name: 'parent', type: 'string', desc: 'new parent task id' },
      { name: 'before', type: 'string', desc: 'rank just before this task id, same status' },
      { name: 'after', type: 'string', desc: 'rank just after this task id, same status' },
      { name: 'ref', type: 'string', desc: 'add an external reference URL' },
      { name: 'ref-label', type: 'string', desc: 'label for --ref' },
      { name: 'ref-remove', type: 'boolean', desc: 'remove the --ref URL instead of adding it' },
    ],
  },
  {
    name: 'comment',
    summary: 'Add a comment to a task',
    args: '<ID>',
    flags: [
      { name: 'body', type: 'string', desc: 'comment text, or "-" for stdin' },
      { name: 'body-file', type: 'string', desc: 'path to a file with comment text' },
      { name: 'author', type: 'string', desc: 'default: KB_AUTHOR, then "ai"' },
    ],
  },
  {
    name: 'link',
    summary: 'Add or remove a typed link to another task',
    args: '<ID>',
    flags: [
      { name: 'blocks', type: 'string', desc: 'id of the task this one blocks' },
      { name: 'relates', type: 'string', desc: 'id of a related task' },
      { name: 'remove', type: 'boolean', desc: 'remove the link instead of adding it' },
    ],
  },
  {
    name: 'attach',
    summary: 'Attach a file to a task (max 25 MB), or remove an attachment',
    args: '<ID> <FILE | ATTACHMENT_ID>',
    flags: [{ name: 'remove', type: 'boolean', desc: 'remove the attachment with the given id instead' }],
  },
  { name: 'delete', summary: 'Delete a task (soft delete; the id is never reused)', args: '<ID>', flags: [] },
  { name: 'help', summary: 'Print this message or the help of the given command', args: '[COMMAND]', flags: [] },
]

export type CommandResult =
  | { kind: 'task'; value: TaskView }
  | { kind: 'detail'; value: TaskView }
  | { kind: 'tasks'; value: { total: number; tasks: TaskView[] }; offset: number; lines: { task: TaskView; depth: number }[] }
  | { kind: 'attachment'; value: Attachment }
  | { kind: 'deleted'; value: { id: string; deleted: true } }
  | { kind: 'help'; value: HelpValue }

export type HelpValue = { command?: string; commands: CommandDef[]; globalFlags: FlagDef[]; exitCodes: Record<string, number> }

function requireOneId(positionals: string[]): string {
  if (positionals.length !== 1) throw new KbError('usage', 'expected exactly one task id')
  return positionals[0]
}

function intFlag(values: Values, name: string, fallback: number): number {
  const raw = values[name] as string | undefined
  if (raw === undefined) return fallback
  if (!/^\d+$/.test(raw)) throw new KbError('usage', `--${name} must be a non-negative integer`)
  return Number(raw)
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

function freshView(db: Db, id: string): TaskView {
  return viewTask(buildIndex(db), id)!
}

function cmdHelp(positionals: string[]): CommandResult {
  const exitCodes = { ok: 0, ...EXIT }
  const name = positionals[0]
  if (name === undefined) return { kind: 'help', value: { commands: COMMANDS, globalFlags: GLOBAL_FLAGS, exitCodes } }
  const cmd = COMMANDS.find((c) => c.name === name)
  if (!cmd) throw new KbError('usage', `unknown command "${name}"`)
  return { kind: 'help', value: { command: name, commands: [cmd], globalFlags: GLOBAL_FLAGS, exitCodes } }
}

function cmdShow(db: Db, id: string): CommandResult {
  const view = viewTask(buildIndex(db), id)
  if (!view) throw new KbError('not_found', `task ${id} not found`)
  return { kind: 'detail', value: view }
}

function filterTasks(db: Db, values: Values): TaskView[] {
  const idx = buildIndex(db)
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

function cmdList(db: Db, values: Values): CommandResult {
  const tasks = filterTasks(db, values)
  const offset = intFlag(values, 'offset', 0)
  const all = values.tree ? treeLines(tasks) : tasks.map((t) => ({ task: t, depth: 0 }))
  const lines = all.slice(offset, offset + intFlag(values, 'limit', 20))
  return { kind: 'tasks', value: { total: all.length, tasks: lines.map((l) => l.task) }, offset, lines }
}

function cmdCreate(db: Db, values: Values): CommandResult {
  const title = values.title as string | undefined
  if (!title) throw new KbError('usage', 'create requires --title')
  const task = createTask(db, {
    title,
    parent: values.parent as string | undefined,
    status: values.status as string | undefined,
    due: values.due as string | undefined,
    assignee: values.assignee as string | undefined,
    body: readBodyInput(values),
  })
  return { kind: 'task', value: freshView(db, task.id) }
}

function neighborRank(db: Db, status: string, selfId: string, beforeId?: string, afterId?: string): string {
  const siblings = buildIndex(db).tasks.filter((t) => t.status === status && t.id !== selfId)
  if (beforeId !== undefined) {
    const i = siblings.findIndex((t) => t.id === beforeId)
    if (i === -1) throw new KbError('not_found', `task ${beforeId} not found in status "${status}"`)
    return rankBetween(siblings[i - 1]?.rank, siblings[i].rank)
  }
  const i = siblings.findIndex((t) => t.id === afterId)
  if (i === -1) throw new KbError('not_found', `task ${afterId} not found in status "${status}"`)
  return rankBetween(siblings[i].rank, siblings[i + 1]?.rank)
}

function cmdUpdate(db: Db, id: string, values: Values): CommandResult {
  let task = readTask(db, id)
  const apply = (op: Op): void => {
    task = applyOp(db, id, op)
  }
  if ((values['ref-label'] !== undefined || values['ref-remove']) && values.ref === undefined) {
    throw new KbError('usage', '--ref-label and --ref-remove require --ref')
  }
  if (values.title !== undefined) apply({ type: 'setTitle', title: values.title as string, baseHash: values['title-hash'] as string | undefined })
  const body = readBodyInput(values)
  if (body !== undefined) apply({ type: 'setBody', body, baseHash: values['body-hash'] as string | undefined })
  if (values.status !== undefined) apply({ type: 'setStatus', status: values.status as string })
  if (values.due !== undefined) apply({ type: 'setDue', due: values.due === 'none' ? null : (values.due as string) })
  if (values.assignee !== undefined) {
    apply({ type: 'setAssignee', assignee: values.assignee === 'none' ? null : (values.assignee as string) })
  }
  if (values.parent !== undefined) apply({ type: 'setParent', parent: values.parent as string })
  if (values.before !== undefined || values.after !== undefined) {
    const rank = neighborRank(db, task.status, id, values.before as string | undefined, values.after as string | undefined)
    apply({ type: 'setRank', rank })
  }
  if (values.ref !== undefined) {
    const url = values.ref as string
    const label = values['ref-label'] as string | undefined
    apply(values['ref-remove'] ? { type: 'removeRef', url } : { type: 'addRef', ref: label ? { url, label } : { url } })
  }
  return { kind: 'task', value: freshView(db, id) }
}

function cmdComment(db: Db, id: string, values: Values): CommandResult {
  const body = requireBody(values, 'comment')
  const author = (values.author as string | undefined) ?? process.env.KB_AUTHOR ?? 'ai'
  applyOp(db, id, { type: 'addComment', author, body })
  return { kind: 'task', value: freshView(db, id) }
}

function linkTypeAndTarget(values: Values): { type: LinkType; target: string } {
  const kinds: LinkType[] = ['blocks', 'relates']
  const given = kinds.filter((k) => values[k] !== undefined)
  if (given.length !== 1) throw new KbError('usage', 'specify exactly one of --blocks, --relates')
  return { type: given[0], target: values[given[0]] as string }
}

function cmdLink(db: Db, id: string, values: Values): CommandResult {
  const { type, target } = linkTypeAndTarget(values)
  const op: Op = values.remove ? { type: 'removeLink', link: { type, id: target } } : { type: 'addLink', link: { type, id: target } }
  applyOp(db, id, op)
  return { kind: 'task', value: freshView(db, id) }
}

function cmdAttach(db: Db, positionals: string[], values: Values): CommandResult {
  if (positionals.length !== 2) throw new KbError('usage', 'expected a task id and a file (or an attachment id with --remove)')
  const [id, arg] = positionals
  if (values.remove) {
    removeAttachment(db, id, arg)
    return { kind: 'task', value: freshView(db, id) }
  }
  const file = path.resolve(arg)
  if (!fs.existsSync(file)) throw new KbError('not_found', `file ${arg} not found`)
  if (fs.statSync(file).size > MAX_ATTACHMENT_BYTES) throw new KbError('invalid', 'attachment exceeds 25 MB')
  return { kind: 'attachment', value: addAttachment(db, id, { filename: path.basename(file), data: fs.readFileSync(file) }) }
}

function cmdDelete(db: Db, id: string): CommandResult {
  deleteTask(db, id)
  return { kind: 'deleted', value: { id, deleted: true } }
}

export async function runCommand(name: string, values: Values, positionals: string[]): Promise<CommandResult> {
  if (name === 'help') return cmdHelp(positionals)

  const db = openDb()
  switch (name) {
    case 'list':
      return cmdList(db, values)
    case 'show':
      return cmdShow(db, requireOneId(positionals))
    case 'create':
      return cmdCreate(db, values)
    case 'update':
      return cmdUpdate(db, requireOneId(positionals), values)
    case 'comment':
      return cmdComment(db, requireOneId(positionals), values)
    case 'link':
      return cmdLink(db, requireOneId(positionals), values)
    case 'attach':
      return cmdAttach(db, positionals, values)
    case 'delete':
      return cmdDelete(db, requireOneId(positionals))
    default:
      throw new KbError('usage', `unknown command "${name}"`)
  }
}
