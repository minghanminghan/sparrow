# Kanban: a file-based task tracker — Design

Date: 2026-10-21
Status: draft, awaiting owner approval

## 1. Intent

A personal task tracker that runs locally. Every task is a Markdown file in a folder, with no database, the way Obsidian treats notes. The owner keeps it open in a browser tab all day. They come back to check progress, change statuses, and add follow-up work.

An AI agent is a first-class user. It can draft and refine tickets. It can also create work for itself, do the work, and report back through the same files. The AI integration is simple: a CLI built for agents. What matters is that an LLM finds the tool easy to navigate.

**Why files:** the data stays readable and editable in any editor. Git can version it. An agent can read it without special access.

## 2. Goals

1. **Fast task creation.** You can add a task from anywhere in the UI with the keyboard alone.
2. **Breaking down large projects.** Tasks nest to any depth, and a parent shows the progress of its subtasks.
3. **Deadlines** on any task, with overdue and due-soon states easy to see.
4. **Easy LLM integration.** An agent can run the whole loop (find work, claim it, update it, comment, finish) using only the CLI and the guide file.
5. **The feel of the two main views matters most.** Dragging cards across the board, changing status, and adding comments must feel instant and seamless.

## 3. Non-goals (v1)

- Automatic PR linking or any GitHub sync. PR links are added by hand only.
- More than one board.
- An MCP server.
- Multi-user use, auth, or hosting. The app is local-only.
- Mobile layout, notifications, calendar or Gantt views, time tracking.

## 4. Anti-goals

These are failures even if the feature technically works:

- **The UI feels laggy:** a drag waits on the server, or a status change needs a page refresh.
- **Data loss:** two writers (UI, CLI, text editor) silently overwrite each other's changes.
- **Only the app can read the files.** They must stay clean, hand-editable Markdown.
- **The agent has to guess.** It needs to read source code, scrape HTML, or parse human-formatted output to use the tool.
- **A database or cache becomes the source of truth.** The files are always the truth.

## 5. Constraints (decided by owner)

- Next.js (App Router), TypeScript, Tailwind.
- Tasks are Markdown files on the filesystem. No database.
- One board.
- AI integration is a CLI designed for agents, with JSON output. No MCP.
- Concurrent writes and live updates in an open browser tab are in scope (section 8).
- Top-level views: **Kanban board** and **All tasks** (Jira-backlog style). Task detail follows the **GitHub Issues** style, including sub-issues.

## 6. Data model

### 6.1 Workspace layout

```
<workspace>/
  .kanban/
    config.yaml          # columns, id prefix, user name
    trash/               # deleted tasks are moved here, not erased
  AGENTS.md              # guide for AI agents, written by `kb init`
  tasks/
    KB-1.md
    KB-2.md
    ...
```

- **Flat folder.** Nesting is stored in frontmatter, not in folders, so moving a task to a new parent rewrites one file and no file paths change. *(My call.)*
- **File name = task ID.** Titles can change without renaming files. *(My call.)*
- The CLI finds the workspace by walking up from the current directory to the nearest `.kanban/`, like git does, or from `--dir` / `KB_DIR`. The web app reads `KB_DIR`.

### 6.2 Task file format

```markdown
---
id: KB-42
title: Add live updates to board
status: in-progress
parent: KB-7
due: 2026-11-01
rank: "0|hzzzzz"
assignee: ai
links:
  - blocks: KB-50
  - relates: KB-12
refs:
  - url: https://github.com/org/repo/pull/123
    label: org/repo#123
created: 2026-10-21T15:04:05Z
updated: 2026-10-21T16:10:00Z
---

Description in GitHub-flavored Markdown. Mentions like [[KB-12]] render as task links.

## Comments

### 2026-10-21T16:10:00Z · andrew
Looks good, ship it.

### 2026-10-21T16:20:00Z · ai
Done in PR org/repo#123.
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `<prefix>-<n>`. Prefix comes from config. IDs are never reused. |
| `title` | yes | |
| `status` | yes | Must match a column key in config. |
| `parent` | no | ID of the parent task. Cycles are rejected. |
| `due` | no | Date only (`YYYY-MM-DD`), local time zone. *(My call.)* |
| `rank` | yes | Fractional-index string. It orders tasks in the backlog and within each board column. A reorder rewrites only the moved task. *(My call.)* |
| `assignee` | no | Free text. `ai` is the convention for agent-owned work. |
| `links` | no | Outgoing typed links: `blocks`, `relates`, `duplicates`. |
| `refs` | no | External links (PRs, docs). The label is optional; a GitHub PR URL is shown as `owner/repo#n` by parsing the URL only (no network call). |
| `created`, `updated` | yes | ISO timestamps, set by the tool. |
| `completed` | no | ISO timestamp. Set when a task enters a `done` column. Cleared when it leaves. *(My call.)* |

**Rules:**
- **Round-trip safety.** The tool keeps unknown frontmatter fields and keeps the body byte-for-byte unless the body itself is edited.
- **A file that fails to parse is never rewritten.** It shows in the UI as an "invalid task" with the parse error.
- **Comments live in the task file** under a `## Comments` heading, one `###` block per comment. The header is `<ISO timestamp> · <author>`. *(My call.)* This keeps a task readable as one file.

### 6.3 Two-way links

- A link is stored **only on the task that created it.** The reverse side is computed when the index is built: `blocks` ↔ `blocked by`, `relates` ↔ `relates`, `duplicates` ↔ `duplicated by`. *(My call.)* One write per link means nothing can drift out of sync.
- `[[ID]]` mentions in a body or comment count as "mentioned in" backlinks.
- The UI, `kb show`, and `kb list --json` always return both directions.
- If a task is deleted, links to it show as broken. They are never silently removed.

### 6.4 Config

```yaml
idPrefix: KB
user: andrew              # author name for comments made in the UI
columns:
  - { key: backlog, name: Backlog }
  - { key: todo, name: To do, role: ready }
  - { key: in-progress, name: In progress, role: active }
  - { key: review, name: In review }
  - { key: done, name: Done, role: done }
```

These columns are the defaults *(my call)*. The owner can rename, add, or remove columns. Each column has an optional `role`, and the tool uses roles, not keys, wherever it needs to know what a column means. *(My call.)*

**Roles:**
- **`ready`:** work that can be started. `kb next` picks from this column. Unticking a subtask moves it here. Exactly one column must have this role.
- **`active`:** work in progress. `kb claim` moves a task here. Exactly one column must have this role.
- **`done`:** complete. These columns count as finished for progress bars and are hidden by default in All tasks. At least one column must have this role. Ticking a subtask moves it to the first one.
- **Columns with no role** (for example Backlog and In review) are plain statuses.

Config validation fails, with a clear error, if these rules are broken or if a task's status matches no column.

## 7. Views and interactions

Both main views share a **task detail side panel**. Clicking a task opens it without leaving the view. Every panel also has a full-page URL (`/t/KB-42`).

**Global:**
- `c` opens quick-create from anywhere (title, then Enter; optional parent and due).
- `/` focuses search.
- `Esc` closes the panel.

### 7.1 Kanban board (`/`)

- One column per configured status. Cards are sorted by `rank`.
- **Card content:**
  - ID and title
  - Due date, red if overdue and amber if due within 2 days
  - Parent title, if any
  - Subtask progress ("3/10"), if any
  - Small icons for link and ref counts
  - Assignee
- **Every task and subtask is its own card.**
- **Dragging:**
  - Dragging a card between columns changes its status.
  - Dragging within a column changes its rank.
  - The UI moves the card first, then saves. If the save fails, the card moves back and a toast explains why.
- **Quick add** at the top of each column creates a task with that status.
- **Filters:**
  - Hide subtasks
  - Only one project (one top-level task and everything under it)
  - Assignee
  - Due (overdue, this week)
  - Text search
- **Done column** shows only tasks with `completed` in the last 14 days by default.

### 7.2 All tasks (`/tasks`)

This view works like the Jira backlog.

- **One list of all open tasks,** ordered by `rank`, with subtasks indented under their parent. Each group opens and closes.
- **Row content:** ID, title, status, due, assignee, subtask progress.
- **Inline editing:** you can change status, due, and assignee without opening the task.
- **Drag to reorder** among siblings. A parent is changed from the detail panel, not by dragging. *(My call: dragging to change a parent is error-prone.)*
- **New-task row** at the bottom: type a title and press Enter. Pressing Enter again creates the next task.
- **Filters** are the same as on the board, plus "show done".
- **Multi-select** with shift-click, to change status in bulk.

### 7.3 Task detail (panel and `/t/[id]`)

This view follows the GitHub Issues style.

- **Header:**
  - Title, editable inline
  - Status, due, and assignee pickers
  - Breadcrumb through the parent chain
- **Description:**
  - Rendered Markdown. Click Edit to change it.
  - The editor has a preview toggle and saves with `Cmd+Enter`.
- **Subtasks:**
  - A list with checkboxes and a progress bar.
  - Ticking a box moves the subtask to the first `done` column.
  - An inline "Add subtask" row is at the bottom of the list.
- **Links:**
  - Outgoing links and backlinks, grouped by type.
  - You add a link with a search picker.
- **References:**
  - A list of external links.
  - You add one by pasting a URL; the label is optional.
- **Comments:**
  - Oldest first, rendered as Markdown.
  - A composer at the bottom submits with `Cmd+Enter`.
- **Delete** moves the file to `.kanban/trash/`.

### 7.4 Markdown rendering

- GitHub-flavored Markdown: tables, task lists, fenced code with syntax highlighting.
- `[[ID]]` renders as a task link.
- HTML is sanitized.

### 7.5 Feel targets

- A drag or status change shows on screen in under 100 ms (the UI updates first).
- A change made by the CLI or an editor shows in the open tab in under 1 s.
- You can create a task with the keyboard alone in under 2 s.
- The board stays smooth with 2,000 tasks.

## 8. Concurrency and live updates

There are three kinds of writer: the web app, the CLI (agents), and any text editor.

### 8.1 Shared core

A single `core` TypeScript package owns parsing, serializing, validation, the index, and all writes. Both the Next.js server and the CLI use it. **The CLI does not need the server to be running.** It reads and writes files directly through `core`.

### 8.2 Safe writes

- **Atomic write.** Write to a temp file in the same directory, `fsync`, then `rename` over the target. A reader never sees a half-written file.
- **Lock per file.** All `core` writes take a cross-process lock on the task file (for example `proper-lockfile`), so the server and the CLI cannot interleave. Text editors ignore the lock, so the version check below still covers them.
- **Operations, not whole-file saves.** UI and CLI changes are sent as small operations: set status, set rank, set due, set assignee, set parent, add/remove link, add ref, add comment. Under the lock, `core` re-reads the latest file, applies the operation, and writes it back. Operations on different fields never conflict, and two comments added at the same time are both kept. *(My call: this makes the board feel seamless while keeping changes safe.)*
- **Body and title edits use a version check.** The check is per field *(my call)*: the client sends the hash of the title or body it started from. If that field has changed since, the write is rejected. The UI then shows the newer version next to the unsaved text so you can choose. The CLI exits with a conflict code. A comment or status change during an edit does not cause a conflict. `kb show` returns `titleHash` and `bodyHash`.
- **ID allocation** takes a workspace lock, scans for the highest ID, and creates the file with exclusive-create (`wx`). Two creators can never get the same ID.

### 8.3 Live updates

- The server keeps an **in-memory index** of all tasks. It builds the index from the files at startup. The index is never written to disk.
- **A file watcher** (for example `chokidar`) on `tasks/`, with debouncing, re-parses each changed file and updates the index.
- **Server-Sent Events (SSE)** push each change to every open tab. The client merges it into its state; matching hashes are ignored, so the client's own optimistic writes do not flicker.
- When the connection drops, the client reconnects and gets a fresh snapshot.

## 9. Agent CLI (`kb`)

**Design rules:**
- **Every command supports `--json`.** JSON output is the default when stdout is not a terminal.
- **Errors** are written to stderr as JSON: `{ "error": { "code", "message" } }`.
- **Exit codes:** `0` ok, `1` usage error, `2` not found, `3` conflict, `4` invalid file.
- **Long text** (body, comment) is read from `--body <text>`, `--body-file <path>`, or stdin (`--body -`).
- **Safe to retry:** commands that set a value do nothing extra when repeated.
- **Self-describing:** `kb help --json` prints every command, flag, and exit code, so an agent can learn the tool without docs.

| Command | Purpose |
|---|---|
| `kb init [--prefix KB]` | Create `.kanban/`, `tasks/`, `AGENTS.md`. |
| `kb serve [--port 4600]` | Start the web app for this workspace, bound to `127.0.0.1`. |
| `kb list [--status] [--parent] [--assignee] [--due-before] [--overdue] [--tree] [--all]` | List tasks. Done tasks are excluded unless `--all`. |
| `kb show <id>` | Full task: fields, body, comments, links in both directions, subtasks, `titleHash`, `bodyHash`. |
| `kb create --title <t> [--parent] [--status] [--due] [--assignee] [--body …]` | Prints the new task (with ID). |
| `kb update <id> [--title [--base-hash <h>]] [--status] [--due] [--assignee] [--parent] [--before <id> \| --after <id>]` | Field operations. `--due none` clears the date. |
| `kb body <id> --body … [--base-hash <h>]` | Replace the description, with a version check if a hash is given. |
| `kb comment <id> --body … [--author]` | Author defaults to `KB_AUTHOR`, else `ai`. |
| `kb link <id> --blocks\|--relates\|--duplicates <id2>` / `kb unlink …` | Typed links. |
| `kb ref <id> --url <u> [--label <l>]` / `kb unref <id> --url <u>` | External references. |
| `kb next [--assignee <a>]` | The highest-ranked available task in the `ready` column (rules below). |
| `kb claim <id> --assignee <a>` | Under the lock, sets the assignee and moves the task to the `active` column, from any status. Succeeds if the task has no assignee or already has `<a>`. Otherwise it fails with the conflict code. |
| `kb delete <id>` | Move to trash. |

**Available work for `kb next`** *(my call)*. A task counts as available when it meets all of these rules:
- It is in the `ready` column.
- It has no unfinished subtasks, so an agent never claims a whole project.
- No unfinished task blocks it.
- It has no assignee, or its assignee is `<a>`. With no `--assignee` flag, only tasks with no assignee count.

If no task is available, `kb next` returns `null` and exit code `0`.

**Install** *(my call)*. The repo builds one package with a `kb` bin, which contains both the CLI and the web app. It is installed globally from the repo (`npm link` or `npm i -g .`), so agents in any directory can run `kb`. `kb serve` runs the built Next.js app with `KB_DIR` set. Because of this, the watcher and SSE must work under `next start`, not only under `next dev`.

**`AGENTS.md`** is written into the workspace by `kb init`. It explains:
- The file format.
- The rule: change tasks through `kb`, not by editing files, so changes stay safe.
- The work loop: `kb next` → `kb claim` → work → `kb comment` → `kb update --status done`.
- How to break work into subtasks.

It must fit an agent's context comfortably (under about 150 lines).

## 10. Testing expectations

- **`core` round-trip tests.** Parse and serialize real files without losing unknown fields or formatting.
- **Concurrency tests.**
  - Many parallel processes run mixed operations on one task; no update is lost and no file is corrupted.
  - Parallel creates get unique IDs.
  - A body edit with a stale hash is rejected.
- **CLI tests.** Check the JSON shapes and exit codes for every command.
- **Browser tests** (for example Playwright):
  - Drag across columns and within a column.
  - An external file edit shows up live.
  - Conflict handling for body edits.

## 11. Left to the builder

- Repo structure (`apps/web`, `packages/core`, `packages/cli` workspaces are suggested), as long as it installs as one `kb` package.
- Whether progress counts direct children or all descendants, and whether done cascades.
- Parsing details: telling comment headers apart from `###` inside comment text, and handling hand-made files with missing fields.
- Scanning `trash/` during ID allocation so IDs are never reused.
- Package manager, drag-and-drop library (`dnd-kit` suggested), Markdown stack (`remark`/`rehype` suggested), editor component, and client state approach.
- How the watcher and SSE are hosted within Next.js. A single long-lived module or a small custom server are both fine, as long as dev hot-reload does not create duplicate watchers.
- Visual design, within the GitHub Issues and Jira backlog references.
- Fractional-index library and format.

## 12. Prior art

- **Backlog.md:** Markdown tasks in a repo, with an agent-friendly CLI. Closest reference for the file format.
- **Obsidian:** plain files and `[[wiki links]]` with backlinks.
- **GitHub Issues:** the issue page and sub-issues with progress.
- **Jira:** the backlog list.
- Background research: `research/open-source-kanban-tools.md`.
