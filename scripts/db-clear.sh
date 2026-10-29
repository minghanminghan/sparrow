#!/usr/bin/env bash
# Deletes every task from the local dev DB, with its comments, links, refs, and attachments: pnpm db:clear
# Task ids start again at 1. Prod is never touched. The old local DB is kept as <db>.bak. Stop `pnpm dev` first.
set -euo pipefail

DB=${SPARROW_DB:-$HOME/.sparrow/sparrow.db}
ATTACH=${SPARROW_ATTACHMENTS:-$(dirname "$DB")/attachments}

die() { echo "error: $*" >&2; exit 1; }

[[ -e $DB ]] || die "$DB does not exist"
if lsof "$DB" >/dev/null 2>&1; then die "$DB is open (pnpm dev?). Stop it first."; fi

sqlite3 "$DB" ".backup '$DB.bak'"
sqlite3 "$DB" "BEGIN;
  DELETE FROM attachments; DELETE FROM comments; DELETE FROM refs; DELETE FROM links; DELETE FROM tasks;
  DELETE FROM sqlite_sequence WHERE name = 'tasks';
COMMIT;"
if [[ -d $ATTACH ]]; then find "$ATTACH" -mindepth 1 -delete; fi

echo "cleared $DB"
