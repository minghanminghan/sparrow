import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { KbError } from './errors'

export type Db = DatabaseSync

// Migration N is MIGRATIONS[N - 1]. PRAGMA user_version holds the last one applied. Append only.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE config (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL);
  INSERT INTO config (id, value) VALUES (1, '{"user":"andrew","columns":[{"key":"backlog","name":"Backlog"},{"key":"todo","name":"To do","role":"ready"},{"key":"in-progress","name":"In progress","role":"active"},{"key":"review","name":"In review"},{"key":"done","name":"Done","role":"done"}]}');
  CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    rank TEXT NOT NULL,
    parent INTEGER,
    due TEXT,
    assignee TEXT,
    body TEXT NOT NULL DEFAULT '',
    extra TEXT NOT NULL DEFAULT '{}',
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    completed TEXT,
    deleted_at TEXT
  );
  CREATE TABLE links (
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    PRIMARY KEY (task_id, type, target_id)
  );
  CREATE TABLE refs (
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    url TEXT NOT NULL,
    label TEXT,
    PRIMARY KEY (task_id, url)
  );
  CREATE TABLE comments (
    id INTEGER PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    at TEXT NOT NULL,
    author TEXT NOT NULL,
    body TEXT NOT NULL
  );
  CREATE INDEX comments_task ON comments (task_id);
  CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created TEXT NOT NULL
  );
  CREATE INDEX attachments_task ON attachments (task_id);
  `,
  // Status changes used to keep the old column's rank, leaving ties that break drag and drop.
  // Suffix each tie after the first so it sorts just after it and before the next rank.
  `
  UPDATE tasks SET rank = rank || substr('123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', d.n - 1, 1)
  FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY status, rank ORDER BY id) AS n FROM tasks WHERE deleted_at IS NULL) AS d
  WHERE tasks.id = d.id AND d.n > 1;
  `,
  `
  ALTER TABLE tasks ADD COLUMN client_id TEXT;
  CREATE UNIQUE INDEX tasks_client_id ON tasks (client_id) WHERE client_id IS NOT NULL;
  `,
  `ALTER TABLE tasks DROP COLUMN assignee;`,
]

export function dbPath(): string {
  return process.env.SPARROW_DB ?? path.join(os.homedir(), '.sparrow', 'sparrow.db')
}

export function migrate(db: Db): { from: number; to: number } {
  const from = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  if (from > MIGRATIONS.length) {
    throw new KbError('invalid', `database is at migration ${from}, this build only knows ${MIGRATIONS.length}`)
  }
  for (let v = from + 1; v <= MIGRATIONS.length; v++) {
    tx(db, () => {
      db.exec(MIGRATIONS[v - 1])
      db.exec(`PRAGMA user_version = ${v}`)
    })
  }
  return { from, to: MIGRATIONS.length }
}

export function connect(file = dbPath()): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON')
  return db
}

export function openDb(file = dbPath()): Db {
  const db = connect(file)
  migrate(db)
  return db
}

export function tx<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
