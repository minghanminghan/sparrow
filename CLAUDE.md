### Sparrow Usage

- `https://sparrow.andrewminghanjiang.com/t/SPAR-1` = `sparrow show SPAR-1`
- Full reference: `sparrow help --json`. Use `--env dev` for the local `pnpm dev` server; default is prod.

### Shipping

- To finish a task, commit on a feature branch, then run `pnpm ship --task SPAR-12`. It pushes, opens the PR, waits for CI, merges, watches the release and deploy, upgrades the local CLI, comments on the task and marks it done, then switches to `main`.
- If it prints `SHIP FAILED at <step>`, read `hint:` and the error below `---`, fix it, then run the `rerun:` command. Done steps are skipped.

### Development Guidelines

- Keep code implementation simple
- Write minimal comments, docs, and unit tests. None wherever possible
- Keep docblocks under 12 lines long

### Commits

- Use conventional commits: `type(scope): summary`. Types: feat, fix, perf, refactor, docs, test, build, ci, chore, style, revert.
- `fix:` → patch, `feat:` → minor, `feat!:` or a `BREAKING CHANGE:` footer → major. Other types do not release.
- Changes reach `main` through PRs only. PRs are squash merged, so the PR title is the commit message and must follow the same format.
