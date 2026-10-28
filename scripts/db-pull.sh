#!/usr/bin/env bash
# Replaces the local dev DB and attachments with a fresh snapshot of prod: pnpm db:pull
# Prod is never written. The old local DB is kept as <db>.bak. Stop `pnpm dev` first.
set -euo pipefail

HOST=${SPARROW_HOST:-root@andrewsserver}
DB=${SPARROW_DB:-$HOME/.sparrow/sparrow.db}
ATTACH=${SPARROW_ATTACHMENTS:-$(dirname "$DB")/attachments}

die() { echo "error: $*" >&2; exit 1; }

if lsof "$DB" >/dev/null 2>&1; then die "$DB is open (pnpm dev?). Stop it first."; fi
mkdir -p "$(dirname "$DB")" "$ATTACH"

tmp=$DB.pull
ssh "$HOST" 'f=$(mktemp) && sqlite3 /var/lib/sparrow/sparrow.db ".backup $f" && cat "$f"; rm -f "$f"' >"$tmp"
[[ $(sqlite3 "$tmp" 'PRAGMA integrity_check') == ok ]] || { rm -f "$tmp"*; die "snapshot failed the integrity check"; }
count=$(sqlite3 "$tmp" 'SELECT count(*) FROM tasks WHERE deleted_at IS NULL')
rm -f "$tmp-wal" "$tmp-shm"

if [[ -e $DB ]]; then sqlite3 "$DB" ".backup '$DB.bak'"; fi
rm -f "$DB" "$DB-wal" "$DB-shm"
mv "$tmp" "$DB"
rsync -a --delete "$HOST:/var/lib/sparrow/attachments/" "$ATTACH/"

echo "pulled $count tasks into $DB"
