import fs from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { parse } from 'yaml'
import { dbPath, openDb, tx } from '../core/db'
import { validateConfig } from '../core/columns'
import { parseTask } from '../core/format'
import { loadTasks, saveTask } from '../core/store'
import type { Config, Task } from '../core/types'

// One-time import of a markdown workspace into SPARROW_DB: `node dist/import.js <workspace dir>`.
// Refuses to run on a DB that already has tasks. Trash comes in as soft-deleted.
function readDir(dir: string): Task[] {
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d+\.md$/.test(name))
    .map((name) => {
      const task = parseTask(fs.readFileSync(path.join(dir, name), 'utf8'))
      if (`${task.id}.md` !== name) throw new Error(`${name}: id ${task.id} does not match file name`)
      return task
    })
}

const ws = process.argv[2]
if (!ws) throw new Error('usage: node dist/import.js <workspace dir>')
const config = parse(fs.readFileSync(path.join(ws, '.kanban', 'config.yaml'), 'utf8')) as Config
validateConfig(config)
const live = readDir(path.join(ws, 'tasks'))
const trash = readDir(path.join(ws, '.kanban', 'trash'))
const ids = [...live, ...trash].map((t) => t.id)
const dup = ids.find((id, i) => ids.indexOf(id) !== i)
if (dup) throw new Error(`task ${dup} is in both tasks/ and trash/`)

const db = openDb()
tx(db, () => {
  if ((db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n > 0) {
    throw new Error(`${dbPath()} already has tasks`)
  }
  db.prepare('UPDATE config SET value = ? WHERE id = 1').run(JSON.stringify(config))
  for (const t of [...live, ...trash]) saveTask(db, t)
  const del = db.prepare('UPDATE tasks SET deleted_at = ? WHERE id = ?')
  for (const t of trash) del.run(t.updated, t.id)
  const bad = live.find((t) => !isDeepStrictEqual(loadTasks(db, t.id)[0], t))
  if (bad) throw new Error(`task ${bad.id} did not round trip`)
})
console.log(JSON.stringify({ db: dbPath(), tasks: live.length, deleted: trash.length }))
