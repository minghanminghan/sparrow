#!/usr/bin/env bash
# One-time (and safe to re-run) mini PC setup for sparrow. Run as root from a repo checkout:
#   sudo [PORT=3417] [TS_PORT=8443] [NODE_BIN=/usr/bin/node] deploy/setup.sh
# Creates the sparrow and sparrow-runner users and dirs, installs sparrow.service on 127.0.0.1:$PORT,
# the nightly sparrow-backup.timer and sparrow-predeploy.service, lets sparrow-runner deploy (see
# deploy/runner.sh), and adds https://<host>:$TS_PORT -> 127.0.0.1:$PORT to the existing tailscale
# serve config.
set -euo pipefail

UNIT=/etc/systemd/system/sparrow.service
DATA=/var/lib/sparrow
BACKUPS=/var/backups/sparrow
OPT=/opt/sparrow
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

die() { echo "error: $*" >&2; exit 1; }
step() { echo "==> $*"; }

[[ $EUID -eq 0 ]] || die "run as root (sudo $0)"
for cmd in systemctl ss tailscale install useradd visudo; do
  command -v "$cmd" >/dev/null || die "$cmd not found"
done

# Keep the port from a previous run unless PORT is given.
PORT=${PORT:-$(sed -n 's/^Environment=PORT=//p' "$UNIT" 2>/dev/null || true)}
PORT=${PORT:-3417}
TS_PORT=${TS_PORT:-8443}
NODE_BIN=${NODE_BIN:-$(command -v node || true)}
TARGET=http://127.0.0.1:$PORT

[[ -x $NODE_BIN ]] || die "node not found; set NODE_BIN=/path/to/node"
NODE_BIN=$(readlink -f "$NODE_BIN")
case $NODE_BIN in /home/* | /root/*) die "node at $NODE_BIN is under a home dir; the service runs with ProtectHome. Install node system-wide or set NODE_BIN" ;; esac
[[ $("$NODE_BIN" -p 'process.versions.node.split(".")[0]') -ge 24 ]] || die "node 24+ required ($NODE_BIN is $("$NODE_BIN" --version))"

step "user: sparrow"
if ! id -u sparrow >/dev/null 2>&1; then
  useradd --system --user-group --home-dir "$DATA" --no-create-home --shell /usr/sbin/nologin sparrow
fi
runuser -u sparrow -- "$NODE_BIN" --version >/dev/null || die "user sparrow cannot run $NODE_BIN"

step "user: sparrow-runner"
if ! id -u sparrow-runner >/dev/null 2>&1; then
  useradd --system --user-group --create-home --home-dir /home/sparrow-runner --shell /bin/bash sparrow-runner
fi
sudoers=$(printf '%s\n' "sparrow-runner ALL=(root) NOPASSWD: $(command -v systemctl) start sparrow-predeploy, $(command -v systemctl) restart sparrow")
if [[ $(cat /etc/sudoers.d/sparrow-runner 2>/dev/null) != "$sudoers" ]]; then
  printf '%s\n' "$sudoers" >/etc/sudoers.d/sparrow-runner.tmp
  visudo -cqf /etc/sudoers.d/sparrow-runner.tmp || die "bad sudoers rule"
  chmod 0440 /etc/sudoers.d/sparrow-runner.tmp
  mv /etc/sudoers.d/sparrow-runner.tmp /etc/sudoers.d/sparrow-runner
fi

step "dirs: $DATA $BACKUPS $OPT/releases"
install -d -o sparrow -g sparrow -m 0750 "$DATA" "$DATA/attachments" "$BACKUPS"
install -d -o sparrow-runner -g sparrow-runner -m 0755 "$OPT" "$OPT/releases"
chown -R sparrow-runner:sparrow-runner "$OPT/releases"

step "port: 127.0.0.1:$PORT"
pids=$(ss -Hltnp "sport = :$PORT" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true)
for pid in $pids; do
  owner=$(ps -o user= -p "$pid" | tr -d ' ')
  [[ $owner == sparrow ]] || die "port $PORT is used by pid $pid ($owner). Pick another: PORT=<port> $0"
done
if [[ -z $pids ]] && ss -Hltn "sport = :$PORT" | grep -q .; then
  die "port $PORT is in use. Pick another: PORT=<port> $0"
fi

step "systemd: sparrow.service sparrow-backup.service sparrow-backup.timer sparrow-predeploy.service"
changed=()
for unit in sparrow.service sparrow-backup.service sparrow-backup.timer sparrow-predeploy.service; do
  rendered=$(sed -e "s|@NODE_BIN@|$NODE_BIN|" -e "s|@PORT@|$PORT|" "$HERE/$unit")
  dest=/etc/systemd/system/$unit
  if [[ ! -f $dest ]] || [[ $(cat "$dest") != "$rendered" ]]; then
    printf '%s\n' "$rendered" >"$dest"
    changed+=("$unit")
  fi
done
[[ ${#changed[@]} -eq 0 ]] || systemctl daemon-reload
systemctl enable sparrow >/dev/null
systemctl enable --now sparrow-backup.timer >/dev/null
if [[ -e $OPT/current/package.json ]]; then
  if [[ " ${changed[*]} " == *" sparrow.service "* ]] || ! systemctl is-active --quiet sparrow; then systemctl restart sparrow; fi
  systemctl is-active --quiet sparrow || echo "warning: sparrow did not start; see journalctl -u sparrow" >&2
else
  echo "    $OPT/current does not exist yet; the service starts after the first deploy"
fi

step "tailscale serve: https :$TS_PORT -> $TARGET"
# Prints "ours <port>" if some HTTPS port already proxies to TARGET, "taken" if TS_PORT is used, else "free".
state=$(tailscale serve status --json | "$NODE_BIN" -e '
  const s = JSON.parse(require("fs").readFileSync(0, "utf8") || "{}")
  const [target, want] = process.argv.slice(1)
  for (const [hostPort, web] of Object.entries(s.Web || {}))
    if (Object.values(web.Handlers || {}).some((h) => h.Proxy === target)) { console.log("ours", hostPort.split(":").pop()); process.exit() }
  console.log((s.TCP || {})[want] ? "taken" : "free")
' "$TARGET" "$TS_PORT")
case $state in
  ours*) TS_PORT=${state#ours }; echo "    already served on :$TS_PORT" ;;
  taken) die "tailscale HTTPS port $TS_PORT is already in use. Pick another: TS_PORT=<port> $0" ;;
  free) tailscale serve --bg --https="$TS_PORT" "$TARGET" ;;
esac

HOST=$(tailscale status --json | "$NODE_BIN" -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).Self.DNSName.replace(/\.$/, ""))')
URL=https://$HOST:$TS_PORT

cat <<EOF

Done. sparrow will be at $URL (local: $TARGET).

Deploys (CD): install the GitHub runner once, then each release on main deploys itself:
  sudo RUNNER_TOKEN=<token> deploy/runner.sh
  token: gh api -X POST repos/<owner>/<repo>/actions/runners/registration-token -q .token
  First deploy: re-run the deploy job of the latest release workflow run.

Move your laptop data (one time):
  laptop:  sqlite3 ~/.sparrow/sparrow.db ".backup /tmp/sparrow.db" && scp /tmp/sparrow.db <minipc>:/tmp/
  minipc:  sudo systemctl stop sparrow
           sudo rm -f $DATA/sparrow.db-wal $DATA/sparrow.db-shm
           sudo install -o sparrow -g sparrow -m 0640 /tmp/sparrow.db $DATA/sparrow.db
           sudo systemctl start sparrow

Backups run nightly (sparrow-backup.timer) into $BACKUPS. Run one now:
  sudo systemctl start sparrow-backup && journalctl -u sparrow-backup -n 5

Then point the CLI and browser at $URL.
EOF
