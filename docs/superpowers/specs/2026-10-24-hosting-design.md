# Host kb on the mini PC (KB-5)

## Why

The filesystem board is a local prototype. Andrew wants one board reachable
from every device (laptop CLI, phone browser) over Tailscale, with updates
shipped automatically and as little release busywork as possible.

## Goals

- Mini PC (Ubuntu 24 server) is the single source of truth.
- Storage moves from `tasks/*.md` to SQLite.
- The CLI talks to the server over HTTP. It no longer touches files.
- Push to `main` → tests → automatic semver release → deploy → migrations.
- Task attachments (screenshots, files).
- Daily DB backups with cleanup.

## Non-goals

- Zero downtime. A 2–3 s restart on deploy is fine.
- Offline CLI or offline web use.
- Multi-user accounts or app-level login. The tailnet is the auth boundary.
- Off-box backups (backups live on the same disk; they protect against bad
  migrations and bugs, not disk failure).
- Phone UI design. That is a separate task (see "Follow-up").

## Anti-goals

- Release process that needs manual steps (opening/merging release PRs,
  hand-bumping versions).
- Losing data during the one-time import or a migration.

## Decisions (Andrew's)

- SQLite-backed server is the source of truth; CLI uses HTTP.
- Short restart on deploy is acceptable.
- Conventional commits + fully automated releases (semantic-release style):
  `fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE` → major,
  other types → no release. App and CLI share one version.
- Backups: one nightly + one before each migration. Delete backups older
  than 7 days, but always keep the newest 3.
- Attachments are in scope.
- Phone UI is its own task. Intended use: Apple-Reminders-style quick
  capture (e.g. logging a mobile UI bug with a screenshot).

## Design

### Storage

- SQLite file at `/var/lib/kb/kb.db`, WAL mode.
- Tables for tasks, links, refs, comments, attachments. Markdown body stays
  as text. Keep `rank` (fractional indexing), body/title hashes for
  conflict checks, and existing `kb` exit codes / error JSON.
- Migrations: numbered SQL files in the repo, applied in order, tracked by
  `PRAGMA user_version`. Runner is a script the deploy calls before restart.
- One-time import script: reads an existing `.kb` workspace (`tasks/*.md`,
  `.kanban/config.yaml`) into the DB, preserving ids, timestamps, ranks,
  comments, links, refs. Columns/config move into the DB or a config file
  (builder's call).
- Delete stays a soft delete (my call, matches today's trash): a
  `deleted_at` column; deleted tasks keep their ids and attachments, and
  ids are never reused. The import brings over `.kanban/trash/` as deleted.
- Live updates: SSE stays. Writes emit events in-process; chokidar and
  file locking go away.

### Attachments

- Files on disk at `/var/lib/kb/attachments/<uuid>`; metadata row
  (task id, filename, mime, size, created).
- API: upload (multipart), download, delete.
- CLI: `kb attach <id> <file>`, listed in `kb show`, `kb attach <id> --remove <attId>`.
- Web: show/download in task detail; images preview inline.
- `kb attach --remove` deletes the row; the file stays on disk until the
  nightly cleanup removes files unreferenced for 7+ days (my call — keeps
  DB backups restorable).
- Max size per file: 25 MB (my call).

### Network and hosting

- Tailscale and Node are already installed. Other services already run on
  the mini PC: pick a free port and add to (not replace) the existing
  `tailscale serve` config.
- `next start` runs as a `systemd` service (`kb.service`) bound to
  `127.0.0.1:<free port>`, under a dedicated `kb` user.
- `tailscale serve` exposes it as `https://<minipc>.<tailnet>.ts.net`.
- Comment author: use the `Tailscale-User-Login` header when present,
  else config `user` (my call).

### CLI

- Server URL from `KB_URL` env, else `~/.config/kb/config.json`
  (`kb config set url <url>`).
- Every command maps to an HTTP call; output and exit codes stay the same.
- Every request sends `X-Kb-Version`. Server returns it at `/api/version`.
  Major mismatch → server rejects, CLI prints how to upgrade. Minor/patch
  mismatch → CLI prints a one-line warning.
- Install/upgrade: the server serves its own CLI bundle at `/cli/kb.js`;
  `kb upgrade` downloads it over the existing path (my call — avoids
  GitHub auth and keeps CLI = server version).
- `AGENTS.md` text updated to match.

### Releases and deploys

- Repo pushed to GitHub (visibility does not matter). The workflow runs
  only on push to `main`, never on `pull_request`, so fork PRs cannot run
  code on the self-hosted runner.
- Commit messages follow conventional commits. Enforced by a rule in
  `CLAUDE.md` only (my call); a bad message just means no release.
- GitHub Actions workflow on push to `main`:
  1. `test` (GitHub-hosted): install, typecheck, test.
  2. `release` (GitHub-hosted): semantic-release computes the version,
     tags, creates a GitHub release. Outputs whether a release happened.
  3. `deploy` (self-hosted runner on the mini PC), only if released:
     checkout the tag, install, build into `/opt/kb/releases/<version>`,
     back up DB, run migrations, point `/opt/kb/current` at the new build,
     `systemctl restart kb`, health check `/api/version`.
- Deploy runs in the same workflow as release (tags pushed with the default
  `GITHUB_TOKEN` do not trigger other workflows).
- If the backup or migration fails, stop; the old build keeps running.
- If the health check fails, the job fails and the old release dir is still
  on disk for a manual rollback (`ln -sfn` + restart). Keep the last 3
  release dirs.
- Runner user gets a sudoers rule for `systemctl restart kb` only.

### Backups

- `kb-backup.timer` (nightly) runs a script that:
  1. `sqlite3 /var/lib/kb/kb.db ".backup /var/backups/kb/kb-<timestamp>.db"`
  2. Deletes backups older than 7 days, never deleting the newest 3.
  3. Deletes attachment files with no DB row for 7+ days.
- The deploy uses the same script for its pre-migration backup.

## Naming

`kb` will be renamed (KB-3, which blocks KB-5). Every `kb` in paths,
service names, env vars (`KB_URL`), and headers (`X-Kb-Version`) is a
placeholder for the new name.

## Left to the builder

- SQLite library (`node:sqlite` vs `better-sqlite3`), exact schema, query
  layer.
- Exact semantic-release plugins/config.
- Node install method on the mini PC.
- How the web UI's existing API client changes (it already uses HTTP).

## Follow-up (separate task)

- Phone UI: PWA (add to home screen), quick-capture box first (title,
  notes, photo/screenshot attachment), board still usable on phone.
