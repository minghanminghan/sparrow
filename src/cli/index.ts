import { parseArgs } from 'node:util'
import { EXIT, KbError } from '../core'
import type { TaskView } from '../core'
import { COMMANDS, GLOBAL_FLAGS, runCommand } from './commands'
import type { CommandResult, FlagDef, HelpValue, Values } from './commands'

type ParseOption = { type: 'string' | 'boolean'; short?: string }

function buildOptions(flags: FlagDef[]): Record<string, ParseOption> {
  const options: Record<string, ParseOption> = {}
  for (const f of flags) options[f.name] = f.short ? { type: f.type, short: f.short } : { type: f.type }
  return options
}

function taskLine(t: TaskView): string {
  return `${t.id}  ${t.status}  ${t.due ?? ''}  ${t.title}`
}

function printTable(rows: string[][]): void {
  const keep = rows[0].map((_, i) => rows.some((r) => r[i] !== ''))
  const cols = rows.map((r) => r.filter((_, i) => keep[i]))
  const widths = cols[0].map((_, i) => Math.max(...cols.map((r) => r[i].length)))
  for (const r of cols) console.log(r.map((cell, i) => (i === r.length - 1 ? cell : cell.padEnd(widths[i]))).join('  '))
}

function printTasks(lines: { task: TaskView; depth: number }[], offset: number, total: number): void {
  if (lines.length === 0) {
    console.log(`Showing 0 of ${total} tasks`)
    return
  }
  printTable(lines.map(({ task, depth }) => ['  '.repeat(depth) + task.id, task.status, task.due ?? '', task.title]))
  console.log(`\nShowing ${offset + 1}-${offset + lines.length} of ${total} tasks`)
}

function printDetail(t: TaskView): void {
  const fields: [string, string | undefined][] = [
    ['Status', t.status],
    ['Assignee', t.assignee],
    ['Due', t.due],
    ['Parent', t.parent],
    ['Children', t.children.length ? `${t.children.join(', ')} (${t.progress.done}/${t.progress.total} done)` : undefined],
    ['Links', t.links.map((l) => `${l.type} ${l.id}`).join(', ') || undefined],
    ['Backlinks', t.backlinks.map((l) => `${l.type} ${l.id}`).join(', ') || undefined],
    ['Refs', t.refs.map((r) => (r.label ? `${r.label} <${r.url}>` : r.url)).join(', ') || undefined],
    ['Created', t.created],
    ['Updated', t.updated],
    ['Completed', t.completed],
  ]
  console.log(`${t.id}  ${t.title}\n`)
  printTable(fields.filter(([, v]) => v !== undefined).map(([k, v]) => [`${k}:`, v!]))
  if (t.body.trim()) console.log(`\n${t.body.trimEnd()}`)
  if (t.comments.length) {
    console.log('\nComments:')
    for (const c of t.comments) console.log(`\n${c.at} · ${c.author}\n${c.body.trimEnd()}`)
  }
}

function printOptions(flags: FlagDef[]): void {
  const left = flags.map((f) => {
    const long = f.type === 'string' ? `--${f.name} <${f.name.toUpperCase().replace(/-/g, '_')}>` : `--${f.name}`
    return f.short ? `-${f.short}, ${long}` : `    ${long}`
  })
  const width = Math.max(...left.map((l) => l.length))
  console.log('Options:')
  flags.forEach((f, i) => console.log(`  ${left[i].padEnd(width)}  ${f.desc}`))
}

function printHelp(value: HelpValue): void {
  if (value.command) {
    const cmd = value.commands[0]
    console.log(`${cmd.summary}\n\nUsage: kb ${cmd.name} [OPTIONS]${cmd.args ? ` ${cmd.args}` : ''}\n`)
    printOptions([...cmd.flags, ...value.globalFlags])
    return
  }
  const width = Math.max(...value.commands.map((c) => c.name.length))
  console.log('Local kanban board CLI\n\nUsage: kb [OPTIONS] <COMMAND>\n\nCommands:')
  for (const c of value.commands) console.log(`  ${c.name.padEnd(width)}  ${c.summary}`)
  console.log()
  printOptions(value.globalFlags)
}

function printResult(result: CommandResult, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(result.value))
    return
  }
  switch (result.kind) {
    case 'task':
      console.log(taskLine(result.value))
      return
    case 'detail':
      printDetail(result.value)
      return
    case 'tasks':
      printTasks(result.lines, result.offset, result.value.total)
      return
    case 'deleted':
      console.log(`${result.value.id} deleted`)
      return
    case 'help':
      printHelp(result.value)
      return
  }
}

async function main(): Promise<void> {
  const allFlags = [...GLOBAL_FLAGS, ...COMMANDS.flatMap((c) => c.flags)]
  let values: Values
  let positionals: string[]
  try {
    ;({ values, positionals } = parseArgs({ args: process.argv.slice(2), options: buildOptions(allFlags), allowPositionals: true }) as {
      values: Values
      positionals: string[]
    })
  } catch (err) {
    throw new KbError('usage', (err as Error).message)
  }

  const name = positionals.shift() ?? 'help'
  const cmd = COMMANDS.find((c) => c.name === name)
  if (!cmd) throw new KbError('usage', `unknown command "${name}"`)
  const allowed = new Set([...GLOBAL_FLAGS, ...cmd.flags].map((f) => f.name))
  const unknown = Object.keys(values).find((k) => !allowed.has(k))
  if (unknown) throw new KbError('usage', `unknown option "--${unknown}" for ${cmd.name}`)
  if (values.help && cmd.name !== 'help') positionals = [cmd.name]


  const jsonMode = Boolean(values.json) || !process.stdout.isTTY
  const result = await runCommand(values.help ? 'help' : cmd.name, values, positionals)
  printResult(result, jsonMode)
}

main().catch((err: unknown) => {
  const isKb = err instanceof KbError
  const code = isKb ? err.code : 'internal'
  const exit = isKb ? EXIT[err.code] : 1
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(JSON.stringify({ error: { code, message } }) + '\n')
  process.exit(exit)
})
