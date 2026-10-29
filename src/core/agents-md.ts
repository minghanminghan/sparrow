export const AGENTS_MD = `# AGENTS.md

This workspace uses a \`sparrow\` kanban board. Tasks live on a sparrow server
(SQLite behind a Next.js app); the \`sparrow\` CLI talks to it over HTTP. Each
task has an id, title, status, rank, parent, due, assignee, links, refs,
a Markdown body, comments, and attachments.

## Rule: change tasks through \`sparrow\`

Always go through the \`sparrow\` CLI so ranks, timestamps, and hashes stay
correct. Run \`sparrow help --json\` any time for the full command, flag, and
exit-code reference.

## Connecting

\`--env prod\` uses the prod server and \`--env dev\` the local \`pnpm dev\` server.
Without \`--env\`, the CLI uses \`SPARROW_URL\`, else the url in \`~/.config/sparrow/config.json\`
(set it with \`sparrow config set url <url>\`), else \`http://127.0.0.1:3000\`.
If the server's major version differs, commands fail with exit code 5; run
\`sparrow upgrade\` to download the server's CLI.

## The work loop

1. \`sparrow list --status todo\` — find a task. Tasks are listed by rank.
2. \`sparrow update <id> --status in-progress --assignee ai\` — take it.
3. Do the work.
4. \`sparrow comment <id> --author ai --body "what you did"\` — leave a note.
5. \`sparrow update <id> --status done\` — mark it done.

Skip tasks that have an assignee other than you, are blocked by an
unfinished task, or have unfinished subtasks.

## Editing a task

- \`sparrow update <id> --body "..."\` (or \`--body -\` for stdin, \`--body-file <path>\`)
  replaces the description. Pass \`--body-hash <bodyHash>\` from \`sparrow show\`
  to fail with a conflict if someone else changed it first. \`--title-hash\`
  does the same for \`--title\`.
- \`sparrow update <id> --ref <url> [--ref-label <label>]\` adds a reference;
  add \`--ref-remove\` to remove it.
- \`sparrow link <id> --blocks <other>\` or \`--relates <other>\` adds a link;
  add \`--remove\` to remove it.
- \`sparrow comment\` without \`--author\` uses \`SPARROW_AUTHOR\`, else your
  Tailscale login, else the board user.

## Breaking work into subtasks

Use \`sparrow create --title "..." --parent <id>\` to add a subtask under a task.
Work on subtasks before their parent. \`sparrow show <id>\` reports
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
