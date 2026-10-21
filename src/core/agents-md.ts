export const AGENTS_MD = `# AGENTS.md

This workspace is a \`kb\` kanban board. Tasks live in \`tasks/*.md\`: YAML
frontmatter (id, title, status, rank, parent, due, assignee, links, refs,
created, updated, completed) followed by a Markdown body and an optional
\`## Comments\` section with \`### <ISO timestamp> · <author>\` headers.

## Rule: change tasks through \`kb\`

Never hand-edit files in \`tasks/\`. Always go through the \`kb\` CLI so ranks,
timestamps, hashes, and locking stay correct. Run \`kb help --json\` any time
for the full command, flag, and exit-code reference.

## The work loop

1. \`kb next --assignee ai\` — get the highest-ranked available task.
2. \`kb claim <id> --assignee ai\` — claim it (moves it to the active column).
3. Do the work.
4. \`kb comment <id> --body "what you did"\` — leave a note.
5. \`kb update <id> --status done\` — mark it done.

\`kb next\` returns \`null\` with exit code 0 when nothing is available. A task
is available when it is in the \`ready\` column, has no unfinished subtasks,
is not blocked by an unfinished task, and has no assignee (or is already
assigned to you).

## Breaking work into subtasks

Use \`kb create --title "..." --parent <id>\` to add a subtask under a task.
A parent with unfinished subtasks is never offered by \`kb next\`, so
splitting work this way keeps agents from claiming a whole project at
once. \`kb show <id>\` reports \`progress: { done, total }\` over direct
children.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | ok |
| 1 | usage error |
| 2 | not found |
| 3 | conflict (e.g. already claimed by someone else) |
| 4 | invalid file |

Errors are JSON on stderr: \`{ "error": { "code", "message" } }\`.

## Output

Every command supports \`--json\` and prints JSON by default when stdout is
not a terminal (the normal case for an agent). Commands that change a task
print its full view (fields, body hashes, backlinks, progress) after the
change.

## Learning the tool

Run \`kb help --json\` for every command, its flags, and the exit codes
above — no other docs are required.
`
