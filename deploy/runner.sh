#!/usr/bin/env bash
# One-time install of the GitHub Actions runner that runs the release workflow's deploy job.
# Run as root after deploy/setup.sh (which creates sparrow-runner), with a fresh registration token:
#   gh api -X POST repos/<owner>/<repo>/actions/runners/registration-token -q .token
#   sudo RUNNER_TOKEN=<token> [REPO_URL=https://github.com/<owner>/<repo>] deploy/runner.sh
set -euo pipefail

VERSION=2.338.2
SHA256=baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40
REPO_URL=${REPO_URL:-https://github.com/minghanminghan/sparrow}
DIR=/home/sparrow-runner/actions-runner

die() { echo "error: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root (sudo $0)"
: "${RUNNER_TOKEN:?set RUNNER_TOKEN}"
id -u sparrow-runner >/dev/null 2>&1 || die "run deploy/setup.sh first"
[[ -e $DIR/.runner ]] && { echo "runner already configured in $DIR"; exit 0; }

tarball=actions-runner-linux-x64-$VERSION.tar.gz
runuser -u sparrow-runner -- mkdir -p "$DIR"
cd "$DIR"
runuser -u sparrow-runner -- curl -fsSL -o "$tarball" "https://github.com/actions/runner/releases/download/v$VERSION/$tarball"
echo "$SHA256  $tarball" | sha256sum -c -
runuser -u sparrow-runner -- tar -xzf "$tarball"
rm "$tarball"
runuser -u sparrow-runner -- ./config.sh --unattended --url "$REPO_URL" --token "$RUNNER_TOKEN" \
  --name "$(hostname)" --labels sparrow --no-default-labels --replace
./svc.sh install sparrow-runner
./svc.sh start
