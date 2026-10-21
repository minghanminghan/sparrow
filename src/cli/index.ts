import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { EXIT, findWorkspace, KbError } from '../core'
import type { TaskView } from '../core'
import { COMMANDS, GLOBAL_FLAGS, runCommand } from './commands'
import type { CommandDef, CommandResult, FlagDef, Values } from './commands'

function buildOptions(cmd: CommandDef): Record<string, { type: 'string' | 'boolean' }> {
  const options: Record<string, { type: 'string' | 'boolean' }> = {}
  for (const f of [...GLOBAL_FLAGS, ...cmd.flags]) options[f.name] = { type: f.type }
  return options
}

function taskLine(t: TaskView): string {
  return `${t.id}  ${t.status}  ${t.due ?? ''}  ${t.title}`
}

function printHelp(value: { commands: CommandDef[]; globalFlags: FlagDef[]; exitCodes: Record<string, number> }): void {
  console.log('Commands:')
  for (const c of value.commands) {
    console.log(`  ${c.name.padEnd(10)} ${c.summary}`)
    for (const f of c.flags) console.log(`      --${f.name} <${f.type}>  ${f.desc}`)
  }
  console.log('\nGlobal flags:')
  for (const f of value.globalFlags) console.log(`  --${f.name} <${f.type}>  ${f.desc}`)
  console.log('\nExit codes:')
  for (const [code, n] of Object.entries(value.exitCodes)) console.log(`  ${n} ${code}`)
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
    case 'maybeTask':
      console.log(result.value ? taskLine(result.value) : 'no task available')
      return
    case 'tasks':
      for (const { task, depth } of result.lines) console.log('  '.repeat(depth) + taskLine(task))
      return
    case 'init':
      console.log(result.value.ws)
      return
    case 'deleted':
      console.log(`${result.value.id} deleted`)
      return
    case 'help':
      printHelp(result.value)
      return
  }
}

async function runServe(values: Values): Promise<number> {
  const ws = findWorkspace({ dir: values.dir as string | undefined })
  const root = path.resolve(__dirname, '..')
  if (!fs.existsSync(path.join(root, '.next'))) throw new KbError('usage', 'run pnpm build')
  const port = (values.port as string | undefined) ?? '4600'
  const bin = path.join(root, 'node_modules', '.bin', 'next')
  const child = spawn(bin, ['start', '-H', '127.0.0.1', '-p', port], {
    cwd: root,
    env: { ...process.env, KB_DIR: ws },
    stdio: 'inherit',
  })
  return new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 0)))
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const name = argv.length === 0 ? 'help' : argv[0]
  const cmd = COMMANDS.find((c) => c.name === name)
  if (!cmd) throw new KbError('usage', `unknown command "${name}"`)
  const rest = argv.length === 0 ? [] : argv.slice(1)

  let values: Values
  let positionals: string[]
  try {
    ;({ values, positionals } = parseArgs({ args: rest, options: buildOptions(cmd), allowPositionals: true }) as {
      values: Values
      positionals: string[]
    })
  } catch (err) {
    throw new KbError('usage', (err as Error).message)
  }

  if (cmd.name === 'serve') {
    process.exit(await runServe(values))
  }

  const jsonMode = Boolean(values.json) || !process.stdout.isTTY
  const result = await runCommand(cmd.name, values, positionals)
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
