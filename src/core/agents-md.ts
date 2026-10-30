export const AGENTS_MD = `# AGENTS.md

This workspace uses a \`sparrow\` kanban board. Tasks live on a sparrow server
(SQLite behind a Next.js app); the \`sparrow\` CLI talks to it over HTTP. Each
task has a key, title, status, rank, parent, due, links, refs,
a Markdown body, comments, and attachments.

## Projects and keys

Every task belongs to a project. A task's id is its key: the project key, a
dash, and a number counted per project, like \`SPAR-28\` or \`NEWS-3\`. Keys are
case-insensitive (\`spar-28\` works). A bare number like \`28\` is an error.
Get the project from the task you are working on or from your instructions.

- \`sparrow project list\` lists the projects.
- \`sparrow project create <KEY> --name "..."\` makes one (1-6 letters or
  digits, starting with a letter).
- \`sparrow list --project <KEY>\` lists one project's tasks.
- Mention another task in a body or comment as \`[[KEY-N]]\`.

## Rule: change tasks through \`sparrow\`

Always go through the \`sparrow\` CLI so ranks, timestamps, and hashes stay
correct. Run \`sparrow help --json\` any time for the full command, flag, and
exit-code reference.

## Connecting

\`--env prod\` uses the prod server and \`--env dev\` the local \`pnpm dev\` server.
Without \`--env\`, the CLI uses \`SPARROW_URL\`, else the prod server.
If the server's major version differs, commands fail with exit code 5; run
\`sparrow upgrade\` to download the server's CLI.

## The work loop

1. \`sparrow list --project SPAR --status todo\` — find a task. Tasks are listed by rank.
2. \`sparrow update SPAR-28 --status in-progress\` — take it.
3. Do the work.
4. \`sparrow comment SPAR-28 --author ai --body "what you did"\` — leave a note.
5. \`sparrow update SPAR-28 --status done\` — mark it done.

Skip tasks that are already in progress, are blocked by an unfinished
task, or have unfinished subtasks.

## Editing a task

- \`sparrow update <key> --body "..."\` (or \`--body -\` for stdin, \`--body-file <path>\`)
  replaces the description. Pass \`--body-hash <bodyHash>\` from \`sparrow show\`
  to fail with a conflict if someone else changed it first. \`--title-hash\`
  does the same for \`--title\`.
- \`sparrow update <key> --ref <url> [--ref-label <label>]\` adds a reference;
  add \`--ref-remove\` to remove it.
- \`sparrow link <key> --blocks <other>\` or \`--relates <other>\` adds a link;
  add \`--remove\` to remove it.
- \`sparrow comment\` without \`--author\` uses \`SPARROW_AUTHOR\`, else your
  Tailscale login, else the board user.

## Creating tasks

\`sparrow create --project <KEY> --title "..."\` creates a task. \`--project\` is
required unless \`--parent\` is given.

## Breaking work into subtasks

Use \`sparrow create --title "..." --parent <key>\` to add a subtask under a task.
A subtask is always in its parent's project.
Work on subtasks before their parent. \`sparrow show <key>\` reports
\`progress: { done, total }\` over direct children.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | ok |
| 1 | usage error |
| 2 | not found |
| 3 | conflict (e.g. a stale \`--title-hash\` or \`--body-hash\`) |
| 4 | invalid (e.g. an attachment over 25 MB) |
| 5 | version mismatch with the server (run \`sparrow upgrade\`) |
| 6 | server unreachable (check \`SPARROW_URL\` / \`sparrow config\`) |

Errors are JSON on stderr: \`{ "error": { "code", "message" } }\`.

## Output

Every command supports \`--json\` and prints JSON by default when stdout is
not a terminal (the normal case for an agent). Commands that change a task
print its full view (fields, body hashes, backlinks, progress) after the
change.

## Learning the tool

Run \`sparrow help --json\` for every command, its flags, and the exit codes
above — no other docs are required.
`
