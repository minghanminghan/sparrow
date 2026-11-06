#!/usr/bin/env bash
# Ships the current branch end to end: pnpm ship [--task SPAR-12]
# check → push → pr → ci → merge → release → deploy → sync → task → cleanup.
# Safe to re-run: each step asks git/GitHub whether it is done and skips if so.
# On failure prints `SHIP FAILED at <step>`, the command, a hint, the rerun command, then the
# command's error, and exits with that command's exit code.
set -uo pipefail

REPO=minghanminghan/sparrow
PROD=https://sparrow.andrewminghanjiang.com
SERVER=andrewj@andrewsserver
TITLE_RE='^(feat|fix|perf|refactor|docs|test|build|ci|chore|style|revert)(\([a-z0-9-]+\))?!?: .+'
TOTAL=10

TASK=
while (($#)); do
  case $1 in
    --task) TASK=${2:-}; shift 2 || shift ;;
    --task=*) TASK=${1#*=}; shift ;;
    *) echo "usage: pnpm ship [--task SPAR-12]" >&2; exit 1 ;;
  esac
done
RERUN="pnpm ship${TASK:+ --task $TASK}"

ERR=$(mktemp)
trap 'rm -f "$ERR"' EXIT
STEP= HINT= N=0 OUT=

step() { STEP=$1 HINT= N=$((N + 1)); echo "==> [$N/$TOTAL] $1"; }
say() { echo "    $*"; }

# fail <exit code> <command> <error text>
fail() {
  {
    echo
    echo "SHIP FAILED at $STEP"
    echo "cmd: $2"
    if [[ -n $HINT ]]; then echo "hint: $HINT"; fi
    echo "rerun: $RERUN"
    echo "---"
    printf '%s\n' "$3" | tail -n 50
  } >&2
  exit "$1"
}

# Runs a command and keeps its stdout in $OUT. On failure reports it and exits with its code.
run() {
  OUT=$("$@" 2>"$ERR")
  local rc=$?
  local text=$OUT
  [[ -s $ERR ]] && text+=${text:+$'\n'}$(cat "$ERR")
  if ((rc != 0)); then fail "$rc" "$*" "$text"; fi
}

run_id() { [[ $1 =~ /runs/([0-9]+) ]] && echo "${BASH_REMATCH[1]}"; }

# The failed jobs' logs for a workflow run.
failed_log() { gh run view "$1" -R "$REPO" --log-failed 2>&1 | cut -c1-300 | tail -n 50; }

load_pr() {
  run gh pr list -R "$REPO" --head "$BRANCH" --state all --limit 1 \
    --json number,state,title,url,mergeCommit --jq '.[0] // empty'
  PR_JSON=$OUT
  PR=$(jaq -r '.number // empty' <<<"$PR_JSON")
  PR_STATE=$(jaq -r '.state // empty' <<<"$PR_JSON")
  PR_URL=$(jaq -r '.url // empty' <<<"$PR_JSON")
}

# True when version $1 >= $2.
version_ge() { [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && $(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1) == "$2" ]]; }

# ---------------------------------------------------------------------------
step check
BRANCH=$(git branch --show-current)
if [[ -z $BRANCH || $BRANCH == main ]]; then
  HINT="ship runs on a feature branch. Commit your work on one first"
  fail 1 "git branch --show-current" "current branch: ${BRANCH:-detached HEAD}"
fi
dirty=$(git status --porcelain)
if [[ -n $dirty ]]; then
  HINT="commit or stash these files first"
  fail 1 "git status --porcelain" "$dirty"
fi
HINT="sign in with: gh auth login"
run gh auth status
if [[ -n $TASK ]]; then
  HINT="check the task key, or run without --task"
  run sparrow show "$TASK" --json
  TASK_JSON=$OUT
  TASK=$(jaq -r .id <<<"$TASK_JSON")
fi
HINT=
run git fetch -q origin main
git fetch -q origin "$BRANCH" 2>/dev/null
load_pr
if [[ $PR_STATE == CLOSED ]]; then
  HINT="the PR was closed without a merge. Reopen it: gh pr reopen $PR"
  fail 1 "gh pr list --head $BRANCH" "PR #$PR is closed: $PR_URL"
fi
MERGED=false
[[ $PR_STATE == MERGED ]] && MERGED=true

if $MERGED; then
  say "PR #$PR already merged, skipping local checks"
else
  run git log --format=%s origin/main..HEAD
  if [[ -z $OUT ]]; then
    HINT="commit your work first"
    fail 1 "git log origin/main..HEAD" "branch $BRANCH has no commits ahead of origin/main"
  fi
  if [[ -n $PR ]]; then
    TITLE=$(jaq -r .title <<<"$PR_JSON")
    HINT="fix it with: gh pr edit $PR --title 'type(scope): summary'"
  else
    TITLE=$(tail -n1 <<<"$OUT")
    HINT="the PR title comes from the branch's first commit. Reword that commit, or open the PR yourself: gh pr create --title 'type(scope): summary', then rerun"
  fi
  if ! grep -Eq "$TITLE_RE" <<<"$TITLE"; then
    fail 1 "title check" "not a conventional commit: $TITLE"$'\n'"must match: $TITLE_RE"
  fi
  HINT="rebase on main and fix the conflicts: git rebase origin/main"
  run git merge-tree --write-tree --name-only --no-messages origin/main HEAD
  HINT="fix the errors, commit, then rerun"
  run pnpm -s typecheck
  run pnpm -s test
  say "title, conflicts, typecheck, tests ok"
fi

# ---------------------------------------------------------------------------
step push
if $MERGED; then
  say "skipped (merged)"
elif [[ $(git rev-parse HEAD) == $(git rev-parse -q --verify "origin/$BRANCH") ]]; then
  say "origin/$BRANCH is up to date"
else
  HINT="if the push was rejected after a rebase, run: git push --force-with-lease, then rerun"
  run git push -q -u origin HEAD
  say "pushed $BRANCH"
fi

# ---------------------------------------------------------------------------
step pr
if [[ -z $PR ]]; then
  body=$(git log --reverse --format='- %s' origin/main..HEAD)
  [[ -n $TASK ]] && body="Task: $TASK"$'\n\n'"$body"
  run gh pr create -R "$REPO" --head "$BRANCH" --base main --title "$TITLE" --body "$body"
  load_pr
  say "opened #$PR $PR_URL"
else
  say "#$PR $PR_URL ($PR_STATE)"
fi

# ---------------------------------------------------------------------------
# Waits for the PR's checks to finish. Fails with the failed job's log.
wait_ci() {
  local start=$SECONDS json pending failed link
  while :; do
    json=$(gh pr checks "$PR" -R "$REPO" --json name,bucket,link 2>/dev/null)
    [[ -z $json ]] && json='[]'
    if [[ $(jaq length <<<"$json") == 0 ]]; then
      if ((SECONDS - start > 60)); then
        HINT="no CI run started for 60s. See: gh run list -R $REPO --branch $BRANCH"
        fail 1 "gh pr checks $PR" "no checks reported on the '$BRANCH' branch"
      fi
    else
      failed=$(jaq -r '[.[] | select(.bucket == "fail" or .bucket == "cancel") | .name] | join(", ")' <<<"$json")
      if [[ -n $failed ]]; then
        link=$(jaq -r '[.[] | select(.bucket == "fail" or .bucket == "cancel")][0].link' <<<"$json")
        HINT="fix the code, commit, then rerun. Full log: $link"
        fail 1 "gh pr checks $PR" "failed: $failed"$'\n'"$(failed_log "$(run_id "$link")")"
      fi
      pending=$(jaq '[.[] | select(.bucket == "pending")] | length' <<<"$json")
      if [[ $pending == 0 ]]; then return; fi
    fi
    if ((SECONDS - start > 1200)); then
      HINT="CI ran for over 20 min. See: gh pr checks $PR"
      fail 1 "gh pr checks $PR" "$json"
    fi
    sleep 10
  done
}

step ci
if $MERGED; then
  say "skipped (merged)"
else
  wait_ci
  say "checks passed"
fi

# ---------------------------------------------------------------------------
step merge
if $MERGED; then
  say "skipped (merged)"
else
  for _ in 1 2 3; do
    for _ in $(seq 1 15); do
      run gh pr view "$PR" -R "$REPO" --json mergeStateStatus --jq .mergeStateStatus
      [[ $OUT != UNKNOWN && $OUT != BLOCKED ]] && break
      sleep 2
    done
    [[ $OUT != BEHIND ]] && break
    say "branch is behind main, updating it"
    run gh pr update-branch "$PR" -R "$REPO"
    sleep 5
    wait_ci
  done
  case $OUT in
    CLEAN | UNSTABLE | HAS_HOOKS) ;;
    DIRTY) HINT="rebase on main and fix the conflicts: git rebase origin/main, then rerun"
      fail 1 "gh pr view $PR --json mergeStateStatus" "PR #$PR has merge conflicts (DIRTY)" ;;
    *) HINT="see why: gh pr view $PR --json mergeStateStatus,reviewDecision,statusCheckRollup"
      fail 1 "gh pr view $PR --json mergeStateStatus" "PR #$PR cannot merge: $OUT" ;;
  esac
  run gh pr merge "$PR" -R "$REPO" --squash
  load_pr
  say "merged #$PR"
fi
SHA=$(jaq -r '.mergeCommit.oid // empty' <<<"$PR_JSON")
if [[ -z $SHA ]]; then
  fail 1 "gh pr list --head $BRANCH --json mergeCommit" "PR #$PR has no merge commit"
fi

# ---------------------------------------------------------------------------
# Waits for job $1 ("hawk / release" or "hawk / deploy") of the release run to finish. Retries a
# semantic-release notes push rejection once. Fails with the log of any failed job.
RERAN=false
wait_job() {
  local start=$SECONDS queued_at= json failed state
  while :; do
    run gh run view "$RUN" -R "$REPO" --json status,conclusion,jobs
    json=$OUT
    # GitHub keeps one pending run per concurrency group; a newer merge cancels ours and releases it too.
    if [[ $(jaq -r .conclusion <<<"$json") == cancelled ]]; then
      run gh run list -R "$REPO" --workflow release.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId'
      if [[ -n $OUT && $OUT != "$RUN" ]]; then
        say "run $RUN was replaced by newer run $OUT"
        RUN=$OUT
        continue
      fi
    fi
    failed=$(jaq -r '[.jobs[] | select(.conclusion == "failure" or .conclusion == "cancelled") | .name] | join(", ")' <<<"$json")
    if [[ -n $failed ]]; then
      local log
      log=$(failed_log "$RUN")
      if ! $RERAN && grep -Eq 'refs/notes/semantic-release.*(rejected|failed)' <<<"$log"; then
        say "semantic-release notes push was rejected, rerunning failed jobs once"
        RERAN=true
        run gh run rerun "$RUN" -R "$REPO" --failed
        sleep 10
        continue
      fi
      fail 1 "gh run view $RUN" "failed: $failed"$'\n'"$log"
    fi
    state=$(jaq -r --arg n "$1" '.jobs[] | select(.name == $n) | .status' <<<"$json")
    [[ $state == completed ]] && return
    # A job that never started is skipped once the run is done.
    [[ -z $state && $(jaq -r .status <<<"$json") == completed ]] && return
    if [[ $1 == "hawk / deploy" && $state == queued ]]; then
      queued_at=${queued_at:-$SECONDS}
      if ((SECONDS - queued_at > 120)); then
        run gh api "repos/$REPO/actions/runners" --jq '.runners[] | select(any(.labels[]; .name == "hawk")) | .status'
        if [[ $OUT != *online* ]]; then
          HINT="the mini PC runner is down. Check it: ssh $SERVER 'systemctl status \"actions.runner.*\"'"
          fail 1 "gh api repos/$REPO/actions/runners" "deploy is queued and the hawk runner is ${OUT:-missing}"
        fi
      fi
    fi
    if ((SECONDS - start > 1800)); then
      fail 1 "gh run view $RUN" "job $1 did not finish in 30 min"$'\n'"$json"
    fi
    sleep 15
  done
}

step release
HINT="see the run: gh run list -R $REPO --workflow release.yml --commit $SHA"
start=$SECONDS
RUN=
while [[ -z $RUN ]]; do
  run gh run list -R "$REPO" --workflow release.yml --commit "$SHA" --limit 1 --json databaseId --jq '.[0].databaseId // empty'
  RUN=$OUT
  if [[ -z $RUN ]]; then
    ((SECONDS - start > 60)) && fail 1 "gh run list --workflow release.yml --commit $SHA" "no release run started for 60s"
    sleep 5
  fi
done
say "run https://github.com/$REPO/actions/runs/$RUN"
HINT="if main is broken, fix it in a new PR. Full log: https://github.com/$REPO/actions/runs/$RUN"
# semantic-release skips a run when main moved past it; a newer run then releases this commit.
start=$SECONDS
while :; do
  wait_job "hawk / release"
  run git fetch -q --tags origin main
  VER=$(git tag --contains "$SHA" --list 'v*' --sort=v:refname | head -n1)
  [[ -n $VER ]] && break
  [[ $(git rev-parse origin/main) == "$SHA" ]] && break
  run gh run list -R "$REPO" --workflow release.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId'
  if [[ $OUT != "$RUN" ]]; then
    say "run $RUN made no release and main moved on, following newer run $OUT"
    RUN=$OUT
    start=$SECONDS
  elif ((SECONDS - start > 60)); then
    break
  else
    sleep 5
  fi
done
VER=${VER#v}
if [[ -z $VER ]]; then
  say "no release (this commit type does not release)"
else
  say "released v$VER"
fi

# ---------------------------------------------------------------------------
step deploy
if [[ -z $VER ]]; then
  say "skipped (no release)"
else
  HINT="see the server log: ssh $SERVER journalctl -u sparrow -n 50. After a fix on the server: gh run rerun $RUN -R $REPO --failed, then rerun"
  wait_job "hawk / deploy"
  start=$SECONDS
  while :; do
    got=$(curl -fsS "$PROD/api/version" 2>&1 | jaq -r .version 2>/dev/null)
    version_ge "${got:-0}" "$VER" && break
    if ((SECONDS - start > 30)); then
      fail 1 "curl $PROD/api/version" "prod reports '$got', expected $VER"
    fi
    sleep 3
  done
  say "prod is on $got"
fi

# ---------------------------------------------------------------------------
step sync
if [[ -z $VER ]]; then
  say "skipped (no release)"
else
  HINT="check that $PROD is up: curl $PROD/api/version"
  run sparrow upgrade
  to=$(jaq -r .to <<<"$OUT")
  if ! version_ge "$to" "$VER"; then
    fail 1 "sparrow upgrade" "local CLI is $to, expected $VER"$'\n'"$OUT"
  fi
  say "local CLI is $to"
fi

# ---------------------------------------------------------------------------
step task
if [[ -z $TASK ]]; then
  say "skipped (no --task)"
else
  HINT="check the task: sparrow show $TASK"
  run sparrow show "$TASK" --json
  if jaq -e --arg u "$PR_URL" 'any(.comments[]; .body | contains($u))' <<<"$OUT" >/dev/null; then
    say "$TASK already has a comment for this PR"
  else
    if [[ -n $VER ]]; then
      msg="Shipped in v$VER (PR #$PR $PR_URL). Deployed. Local CLI synced."
    else
      msg="Merged in PR #$PR $PR_URL. No release."
    fi
    run sparrow comment "$TASK" --body "$msg"
    say "commented on $TASK"
  fi
  run sparrow update "$TASK" --status done
  say "$TASK is done"
fi

# ---------------------------------------------------------------------------
step cleanup
HINT="you can finish this by hand: git switch main (or git switch --detach origin/main in a worktree) && git branch -D $BRANCH"
run git fetch -q origin main
# In a worktree, main is checked out elsewhere, so detach at origin/main instead.
if git switch -q main 2>/dev/null; then run git pull -q --ff-only; else run git switch -q --detach origin/main; fi
run git branch -D "$BRANCH"
if [[ -n $(git ls-remote --heads origin "$BRANCH") ]]; then run git push -q origin --delete "$BRANCH"; fi
say "on $(git branch --show-current | grep . || echo 'detached origin/main') at $(git log --oneline -1)"

echo
echo "SHIPPED #$PR${VER:+ as v$VER}${TASK:+ ($TASK done)}"
