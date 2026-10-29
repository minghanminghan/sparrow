import fs from 'node:fs'
import path from 'node:path'
import { isDone } from '../core/columns'
import { EXIT, KbError } from '../core/errors'
import type { Index, TaskView } from '../core/indexer'
import { MAX_ATTACHMENT_BYTES, mimeFor } from '../core/mime'
import type { CreateInput, Op } from '../core/ops'
import { rankBetween } from '../core/rank'
import type { Attachment, LinkType } from '../core/types'
import { VERSION, VERSION_HEADER } from '../core/version'
import { serverUrl } from './config'
import { api, call, sendJson, toError } from './http'

export type FlagType = 'string' | 'boolean'
export type FlagDef = { name: string; short?: string; type: FlagType; desc: string }
export type CommandDef = { name: string; summary: string; args?: string; flags: FlagDef[] }
export type Values = Record<string, string | boolean | undefined>

export const GLOBAL_FLAGS: FlagDef[] = [
  { name: 'json', type: 'boolean', desc: 'force JSON output' },
  { name: 'env', type: 'string', desc: 'dev (the local `pnpm dev` DB) or prod. Default: SPARROW_URL, then prod' },
  { name: 'help', short: 'h', type: 'boolean', desc: 'Print help' },
]

export const COMMANDS: CommandDef[] = [
  {
    name: 'list',
    summary: 'List tasks, ordered by rank',
    flags: [
      { name: 'status', type: 'string', desc: 'filter by status' },
      { name: 'parent', type: 'string', desc: 'filter by parent id' },
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
      { name: 'author', type: 'string', desc: 'default: SPARROW_AUTHOR, then Tailscale login, then board user' },
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
  { name: 'config', summary: 'Show the server url', flags: [] },
  { name: 'upgrade', summary: "Replace this CLI with the server's version", flags: [] },
  { name: 'help', summary: 'Print this message or the help of the given command', args: '[COMMAND]', flags: [] },
]

export type CommandResult =
  | { kind: 'task'; value: TaskView }
  | { kind: 'detail'; value: TaskView }
  | { kind: 'tasks'; value: { total: number; tasks: TaskView[] }; offset: number; lines: { task: TaskView; depth: number }[] }
  | { kind: 'attachment'; value: Attachment }
  | { kind: 'deleted'; value: { id: string; deleted: true } }
  | { kind: 'config'; value: { url: string } }
  | { kind: 'upgraded'; value: { file: string; from: string; to: string } }
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

function cmdHelp(positionals: string[]): CommandResult {
  const exitCodes = { ok: 0, ...EXIT }
  const name = positionals[0]
  if (name === undefined) return { kind: 'help', value: { commands: COMMANDS, globalFlags: GLOBAL_FLAGS, exitCodes } }
  const cmd = COMMANDS.find((c) => c.name === name)
  if (!cmd) throw new KbError('usage', `unknown command "${name}"`)
  return { kind: 'help', value: { command: name, commands: [cmd], globalFlags: GLOBAL_FLAGS, exitCodes } }
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

const taskPath = (id: string): string => `/api/tasks/${encodeURIComponent(id)}`
const getTask = (id: string): Promise<TaskView> => api<TaskView>(taskPath(id))
const postOp = (id: string, op: Op): Promise<TaskView> => sendJson<TaskView>(taskPath(id), 'POST', { op })

function filterTasks(idx: Index, values: Values): TaskView[] {
  let tasks = idx.tasks
  if (!values.all) tasks = tasks.filter((t) => !isDone(idx.config, t.status))
  if (values.status !== undefined) tasks = tasks.filter((t) => t.status === values.status)
  if (values.parent !== undefined) tasks = tasks.filter((t) => t.parent === values.parent)
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

async function cmdList(values: Values): Promise<CommandResult> {
  const offset = intFlag(values, 'offset', 0)
  const limit = intFlag(values, 'limit', 20)
  const tasks = filterTasks(await api<Index>('/api/tasks'), values)
  const all = values.tree ? treeLines(tasks) : tasks.map((t) => ({ task: t, depth: 0 }))
  const lines = all.slice(offset, offset + limit)
  return { kind: 'tasks', value: { total: all.length, tasks: lines.map((l) => l.task) }, offset, lines }
}

async function cmdCreate(values: Values): Promise<CommandResult> {
  const title = values.title as string | undefined
  if (!title) throw new KbError('usage', 'create requires --title')
  const input: CreateInput = {
    title,
    parent: values.parent as string | undefined,
    status: values.status as string | undefined,
    due: values.due as string | undefined,
    body: readBodyInput(values),
  }
  return { kind: 'task', value: await sendJson<TaskView>('/api/tasks', 'POST', input) }
}

async function neighborRank(status: string, selfId: string, beforeId?: string, afterId?: string): Promise<string> {
  const siblings = (await api<Index>('/api/tasks')).tasks.filter((t) => t.status === status && t.id !== selfId)
  if (beforeId !== undefined) {
    const i = siblings.findIndex((t) => t.id === beforeId)
    if (i === -1) throw new KbError('not_found', `task ${beforeId} not found in status "${status}"`)
    return rankBetween(siblings[i - 1]?.rank, siblings[i].rank)
  }
  const i = siblings.findIndex((t) => t.id === afterId)
  if (i === -1) throw new KbError('not_found', `task ${afterId} not found in status "${status}"`)
  return rankBetween(siblings[i].rank, siblings[i + 1]?.rank)
}

async function cmdUpdate(id: string, values: Values): Promise<CommandResult> {
  let task = await getTask(id)
  const apply = async (op: Op): Promise<void> => {
    task = await postOp(id, op)
  }
  if ((values['ref-label'] !== undefined || values['ref-remove']) && values.ref === undefined) {
    throw new KbError('usage', '--ref-label and --ref-remove require --ref')
  }
  if (values.title !== undefined) await apply({ type: 'setTitle', title: values.title as string, baseHash: values['title-hash'] as string | undefined })
  const body = readBodyInput(values)
  if (body !== undefined) await apply({ type: 'setBody', body, baseHash: values['body-hash'] as string | undefined })
  if (values.status !== undefined) await apply({ type: 'setStatus', status: values.status as string })
  if (values.due !== undefined) await apply({ type: 'setDue', due: values.due === 'none' ? null : (values.due as string) })
  if (values.parent !== undefined) await apply({ type: 'setParent', parent: values.parent as string })
  if (values.before !== undefined || values.after !== undefined) {
    const rank = await neighborRank(task.status, id, values.before as string | undefined, values.after as string | undefined)
    await apply({ type: 'setRank', rank })
  }
  if (values.ref !== undefined) {
    const url = values.ref as string
    const label = values['ref-label'] as string | undefined
    await apply(values['ref-remove'] ? { type: 'removeRef', url } : { type: 'addRef', ref: label ? { url, label } : { url } })
  }
  return { kind: 'task', value: task }
}

// An empty author lets the server pick: Tailscale-User-Login, then the board user, then "ai".
async function cmdComment(id: string, values: Values): Promise<CommandResult> {
  const body = requireBody(values, 'comment')
  const author = (values.author as string | undefined) ?? process.env.SPARROW_AUTHOR ?? process.env.KB_AUTHOR ?? ''
  return { kind: 'task', value: await postOp(id, { type: 'addComment', author, body }) }
}

function linkTypeAndTarget(values: Values): { type: LinkType; target: string } {
  const kinds: LinkType[] = ['blocks', 'relates']
  const given = kinds.filter((k) => values[k] !== undefined)
  if (given.length !== 1) throw new KbError('usage', 'specify exactly one of --blocks, --relates')
  return { type: given[0], target: values[given[0]] as string }
}

async function cmdLink(id: string, values: Values): Promise<CommandResult> {
  const { type, target } = linkTypeAndTarget(values)
  const op: Op = values.remove ? { type: 'removeLink', link: { type, id: target } } : { type: 'addLink', link: { type, id: target } }
  return { kind: 'task', value: await postOp(id, op) }
}

async function cmdAttach(positionals: string[], values: Values): Promise<CommandResult> {
  if (positionals.length !== 2) throw new KbError('usage', 'expected a task id and a file (or an attachment id with --remove)')
  const [id, arg] = positionals
  if (values.remove) {
    return { kind: 'task', value: await api<TaskView>(`${taskPath(id)}/attachments/${encodeURIComponent(arg)}`, { method: 'DELETE' }) }
  }
  const file = path.resolve(arg)
  if (!fs.existsSync(file)) throw new KbError('not_found', `file ${arg} not found`)
  if (fs.statSync(file).size > MAX_ATTACHMENT_BYTES) throw new KbError('invalid', 'attachment exceeds 25 MB')
  const form = new FormData()
  form.append('file', new File([fs.readFileSync(file)], path.basename(file), { type: mimeFor(file) }))
  const view = await api<TaskView>(`${taskPath(id)}/attachments`, { method: 'POST', body: form })
  // Attachments are ordered by creation, so the new one is last.
  return { kind: 'attachment', value: view.attachments[view.attachments.length - 1] as Attachment }
}

async function cmdDelete(id: string): Promise<CommandResult> {
  await api(taskPath(id), { method: 'DELETE' })
  return { kind: 'deleted', value: { id, deleted: true } }
}

function cmdConfig(positionals: string[]): CommandResult {
  if (positionals.length > 0) throw new KbError('usage', 'sparrow config takes no arguments. Use --env or SPARROW_URL to pick the server')
  return { kind: 'config', value: { url: serverUrl() } }
}

// Downloads the server's CLI bundle and swaps it in for the running file.
async function cmdUpgrade(): Promise<CommandResult> {
  const file = fs.realpathSync(process.argv[1])
  if (!file.endsWith('.js')) throw new KbError('usage', `cannot upgrade ${file}: not a built sparrow bundle`)
  const res = await call('/cli/sparrow.js', {}, true)
  if (!res.ok) throw await toError(res)
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()), { mode: 0o755 })
  fs.renameSync(tmp, file)
  return { kind: 'upgraded', value: { file, from: VERSION, to: res.headers.get(VERSION_HEADER) ?? 'unknown' } }
}

export async function runCommand(name: string, values: Values, positionals: string[]): Promise<CommandResult> {
  switch (name) {
    case 'help':
      return cmdHelp(positionals)
    case 'list':
      return cmdList(values)
    case 'show':
      return { kind: 'detail', value: await getTask(requireOneId(positionals)) }
    case 'create':
      return cmdCreate(values)
    case 'update':
      return cmdUpdate(requireOneId(positionals), values)
    case 'comment':
      return cmdComment(requireOneId(positionals), values)
    case 'link':
      return cmdLink(requireOneId(positionals), values)
    case 'attach':
      return cmdAttach(positionals, values)
    case 'delete':
      return cmdDelete(requireOneId(positionals))
    case 'config':
      return cmdConfig(positionals)
    case 'upgrade':
      return cmdUpgrade()
    default:
      throw new KbError('usage', `unknown command "${name}"`)
  }
}

