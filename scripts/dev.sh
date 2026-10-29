#!/usr/bin/env bash
# Runs `next dev` on the first free port from 3000: pnpm dev [--env dev|prod] [next dev options]
# --env dev (the default) uses the local DB. --env prod sends the app's API calls to the prod server.
# Writes ~/.sparrow/dev.json with the url and env, for the toggle in the app and `sparrow --env dev`.
set -euo pipefail

ENV=dev
PORT=
args=()
while (($#)); do
  case $1 in
    --env) ENV=${2:-}; shift 2 || shift ;;
    --env=*) ENV=${1#*=}; shift ;;
    -p | --port) PORT=${2:-}; shift 2 || shift ;;
    *) args+=("$1"); shift ;;
  esac
done
[[ $ENV == dev || $ENV == prod ]] || { echo "error: --env must be dev or prod" >&2; exit 1; }

if [[ -z $PORT ]]; then
  PORT=3000
  while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
fi

STATE=$HOME/.sparrow/dev.json
mkdir -p "$(dirname "$STATE")"
running=$(grep -o '"pid":[0-9]*' "$STATE" 2>/dev/null | cut -d: -f2 || true)
if [[ -n $running ]] && kill -0 "$running" 2>/dev/null; then
  echo "error: a sparrow dev server is already running (pid $running, see $STATE)" >&2
  exit 1
fi
echo "{\"url\":\"http://localhost:$PORT\",\"env\":\"$ENV\",\"pid\":$$}" >"$STATE"
trap 'grep -qF "\"pid\":$$}" "$STATE" 2>/dev/null && rm -f "$STATE"' EXIT

next dev -p "$PORT" ${args[@]+"${args[@]}"}
