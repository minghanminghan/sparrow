#!/usr/bin/env bash
# Run by `hawk deploy` in the new release dir, with VERSION set.
set -euo pipefail
pnpm pkg set version="$VERSION"
pnpm install --frozen-lockfile
pnpm build
