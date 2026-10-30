# Projects: multiple projects on one board (task 28)

## Why

Andrew works on more than one project (sparrow itself, a newsletter feed
reader in `~/desktop/personal/newsletter`, more later). Today the only way to
tell them apart is a title prefix like `sparrow:`. They want each task to
belong to a project with a short key, Jira style (`NEWS-12`), so work across
projects is easy to track on one board and agents can file tasks into the
right project.

Users: Andrew plus agents. No multi-user features.

## Success and anti-goal

- Success: the board shows every project's tasks at once, each project is
  easy to spot by color, and one filter narrows the board to one or more
  projects. Agents create tasks with `--project NEWS` and refer to them as
  `NEWS-12`.
- Anti-goal: the project page must not pull attention from the kanban. The
  board stays the main view.

## Goals

- Projects with a key, a name, and a color.
- Task keys `KEY-N`, numbered per project.
- Project color on the board (desktop and phone).
- Project filter on the board (multi-select).
- Project page with config and the project's tasks.
- Projects list page where projects can be created.
- CLI support for projects and keys.

## Non-goals

- Renaming a project key.
- Moving a task to another project.
- Deleting or archiving projects.
- A default project.
- Picking a color from the CLI.

## Decisions (Andrew's)

- **Key format:** uppercase letters, starts with a letter, 6 characters max.
- **Per-project numbering.** Each project has its own counter: `NEWS-1`,
  `NEWS-2`, `SPAR-1`.
- **Existing tasks:** all current tasks go into one project, key `SPAR`.
- **Board shows all projects** by default. A project filter narrows it.
  The filter can hold several projects at once.
- **Color:** `sparrow project create` assigns a random color. There is no
  `--color` flag. The color is changed in the UI on the project page.
- **Project page:** the project equivalent of the task page. Shows the
  project (key, name, color; name and color are editable) and the project's
  tasks with filtering options and pagination. Kept simple.
- **Projects list page** at `/p`: lists all projects and has a
  "New project" button (key and name; the color is random, like the CLI).
- **CLI:**
  - `sparrow show spar-1` works; keys are case-insensitive everywhere.
  - `sparrow create` takes `--project`. There is no default project.
  - `sparrow list` takes `--project`.
  - Agents get the project from the task or from their instructions, not
    from the working directory.
- **Quick create** has a project picker. When the board is filtered to
  projects, the picker starts on the first filtered project. With no filter
  it starts empty and Create stays disabled until a project is picked.
- **Subtasks** must be in the same project as their parent.

## Calls made in design (Claude's, not yet confirmed by Andrew)

- **Storage:** tasks keep their hidden integer `id` as the real primary key.
  New columns `project` and `number` sit next to it with a unique constraint
  on the pair. Links, refs, comments, and attachments keep pointing at the
  integer id. A `projects` table holds key, name, color, and the next number.
- **Migration numbering:** existing tasks keep their numbers (task 28 becomes
  `SPAR-28`). The `SPAR` counter continues after the highest existing id,
  so the next task is `SPAR-32`. Soft-deleted ids are never reused.
- **Everything visible uses the key.** API responses, CLI output, the UI,
  and URLs show `SPAR-28`, never the integer id. CLI flags that take a task
  (`--parent`, `--blocks`, `--relates`, `--before`, `--after`) take keys.
  A bare number like `sparrow show 28` fails with a clear error.
- **`create` without `--project` fails** with a usage error that lists the
  existing project keys.
- **CLI project commands:** `sparrow project create <KEY> --name "<name>"`
  and `sparrow project list`. `--name` defaults to the key.
- **Links** (blocks / relates) may cross projects.
- **Key characters:** a letter first, then letters or digits (Jira's rule),
  so `V2` is allowed.
- **Subtasks inherit the parent's project.** `create --parent SPAR-5`
  without `--project` uses `SPAR`; the add-subtask button keeps working.
  A `--project` that differs from the parent's, or setting a parent in
  another project, fails with a clear error.
- **Mentions:** `[[SPAR-28]]` replaces `[[28]]`, case-insensitive. The
  migration rewrites existing `[[N]]` in bodies and comments to `[[SPAR-N]]`.
- **URLs:** task page `/t/SPAR-28`, project page `/p/NEWS`. Old `/t/28`
  URLs do not need to keep working.
- **Card:** the task key shows in the project's color. The rest of the
  card is unchanged.
- **"First filtered project"** means the first one picked.
- **Project page entry:** clicking a project key (on a card or the task
  page) opens it. A "Projects" link in the top nav opens `/p`. On the
  phone both pages are a single stacked column.
- **Phone:** when a project filter is on, colored chips under the column
  tabs (`NEWS ×`) show it; tapping × removes that project from the filter.
  The project filter also appears in the filter sheet (it shares the
  desktop `Filters` component). The quick-create project picker is a row
  of colored chips under the title.
- **Offline:** the project list is cached with the board, so quick create
  works offline. A pending task shows its project as `NEWS-…` until the
  server assigns its number.
- **AGENTS.md** (`src/core/agents-md.ts`) is updated to explain projects,
  keys, and that `create` needs `--project`.

## Constraints

- SQLite via `node:sqlite`, append-only migrations in `src/core/db.ts`.
- Next.js 16 app router, React 19, zustand store (`src/client/store.ts`),
  Tailwind v4. Live updates via SSE `/api/events`.
- The phone UI's offline board and outbox (see
  `docs/superpowers/specs/2026-10-28-phone-ui-design.md`) must keep working.
- The CLI checks the server's major version. This change breaks task ids in
  the CLI and API, so it is a major version (`feat!:`); old CLIs must fail
  with exit code 5 and `sparrow upgrade`.
- Desktop and phone must not regress otherwise.

## Left to the builder

- The color palette random colors come from, and the color picker UI.
  Colors must stay readable as text on white cards.
- Where the project filter state lives and whether it persists across
  reloads.
- Project page filters (which ones) and page size.
- API route shapes for projects.
- How the board's project dropdown and the phone chips look in detail.
