### Development Guidelines

- Keep code implementation simple
- Write minimal comments, docs, and unit tests. None wherever possible
- Keep docblocks under 12 lines long

### Commits

- Use conventional commits: `type(scope): summary`. Types: feat, fix, perf, refactor, docs, test, build, ci, chore, style, revert.
- `fix:` → patch, `feat:` → minor, `feat!:` or a `BREAKING CHANGE:` footer → major. Other types do not release.
- Changes reach `main` through PRs only. PRs are squash merged, so the PR title is the commit message and must follow the same format.
