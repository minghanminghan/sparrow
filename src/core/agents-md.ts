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

1. \`kb list --status todo\` — find a task. Tasks are listed by rank.
2. \`kb update <id> --status in-progress --assignee ai\` — take it.
3. Do the work.
4. \`kb comment <id> --body "what you did"\` — leave a note.
5. \`kb update <id> --status done\` — mark it done.

Skip tasks that have an assignee other than you, are blocked by an
unfinished task, or have unfinished subtasks.

## Editing a task

- \`kb update <id> --body "..."\` (or \`--body -\` for stdin, \`--body-file <path>\`)
  replaces the description. Pass \`--body-hash <bodyHash>\` from \`kb show\`
  to fail with a conflict if someone else changed it first. \`--title-hash\`
  does the same for \`--title\`.
- \`kb update <id> --ref <url> [--ref-label <label>]\` adds a reference;
  add \`--ref-remove\` to remove it.
- \`kb link <id> --blocks <other>\` or \`--relates <other>\` adds a link;
  add \`--remove\` to remove it.

## Breaking work into subtasks

Use \`kb create --title "..." --parent <id>\` to add a subtask under a task.
Work on subtasks before their parent. \`kb show <id>\` reports
\`progress: { done, total }\` over direct children.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | ok |
| 1 | usage error |
| 2 | not found |
| 3 | conflict (e.g. a stale \`--title-hash\` or \`--body-hash\`) |
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
