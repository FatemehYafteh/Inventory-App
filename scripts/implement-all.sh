#!/usr/bin/env bash
# Implement every ticket, one at a time, then review all of it once.
#
#   1. For each ticket, start a fresh Claude Code session that runs
#      /mattpocock-skills:implement #<issue>, builds only that ticket's scope,
#      skips the per-ticket code review, commits, and ends.
#   2. Move on to the next ticket in a new session (the same as /clear).
#   3. When every ticket is done, start one more fresh session that runs
#      /mattpocock-skills:code-review over all the changes since the start.
#
# A ticket is skipped only when its session reports it is genuinely blocked.
# Any other failure stops the run, leaving the tree as that session left it.
#
# Usage:
#   scripts/implement-all.sh [--base <ref>] [<issue> ...]
#
# With no issues, it takes every open issue, in issue-number order, that has no
# "(#<issue>)" commit on this branch yet. Otherwise it takes the issues given,
# in the order given (blockers first).
#
#   --base <ref>   fixed point for the final review (default: HEAD at the start)
#
# Environment:
#   CLAUDE_BIN               claude executable (default: claude)
#   CLAUDE_PERMISSION_MODE   permission mode for every session (default: auto)
#
# Logs and the review report go to logs/tickets/<timestamp>/ (gitignored).

set -euo pipefail

CLAUDE_BIN="${CLAUDE_BIN:-claude}"
PERMISSION_MODE="${CLAUDE_PERMISSION_MODE:-auto}"
PROTECTED_BRANCHES="main sub-prds"

die() { echo "error: $*" >&2; exit 1; }

base=""
issues=()
while [ $# -gt 0 ]; do
  case "$1" in
    --base) [ $# -ge 2 ] || die "--base needs a ref"; base="$2"; shift 2 ;;
    -h|--help) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) issues+=("${1#\#}"); shift ;;
  esac
done

# --- Preflight -------------------------------------------------------------
cd "$(git rev-parse --show-toplevel)"

command -v "$CLAUDE_BIN" >/dev/null || die "'$CLAUDE_BIN' not found on PATH (set CLAUDE_BIN)"
command -v gh >/dev/null || die "gh not found on PATH"
gh auth status >/dev/null 2>&1 || die "gh is not signed in (run: gh auth login)"

branch="$(git branch --show-current)"
[ -n "$branch" ] || die "detached HEAD; check out a feature branch first"
for b in $PROTECTED_BRANCHES; do
  [ "$branch" != "$b" ] || die "on '$branch'; use a feat/<area>-<short-name> branch"
done
[ -z "$(git status --porcelain)" ] || die "working tree is not clean"

base="${base:-$(git rev-parse HEAD)}"
git rev-parse --verify --quiet "$base^{commit}" >/dev/null || die "base '$base' is not a commit"

# An issue is already built when a commit on this branch ends in "(#<issue>)".
built() { git log --format=%s HEAD | grep -qE "\(#$1\)\$"; }

if [ ${#issues[@]} -eq 0 ]; then
  while read -r n; do
    built "$n" || issues+=("$n")
  done < <(gh issue list --state open --limit 500 --json number --jq '.[].number' | sort -n)
  [ ${#issues[@]} -gt 0 ] || { echo "No open issues left to build."; exit 0; }
fi

declare -A titles
for n in "${issues[@]}"; do
  [[ "$n" =~ ^[0-9]+$ ]] || die "'$n' is not an issue number"
  info="$(gh issue view "$n" --json state,title --jq '.state + " " + .title' 2>/dev/null)" \
    || die "issue #$n not found"
  [ "${info%% *}" = "OPEN" ] || die "issue #$n is ${info%% *}"
  titles[$n]="${info#* }"
done

log_dir="logs/tickets/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$log_dir"

echo "Branch: $branch"
echo "Review base: $base"
echo "Logs: $log_dir"
for n in "${issues[@]}"; do echo "  #$n ${titles[$n]}"; done
echo

# --- One fresh session per ticket -----------------------------------------
done_issues=()
blocked_issues=()

for n in "${issues[@]}"; do
  echo "=== #$n ${titles[$n]} ==="
  before="$(git rev-parse HEAD)"
  log="$log_dir/issue-$n.log"

  blocked_note=""
  if [ ${#blocked_issues[@]} -gt 0 ]; then
    blocked_note="
- These tickets were skipped as blocked earlier in this run: $(printf '#%s ' "${blocked_issues[@]}")"
  fi

  prompt="/mattpocock-skills:implement #$n

This session runs unattended, so nobody can answer questions:
- Implement only the scope of issue #$n. Leave other tickets, refactors and follow-ups alone.
- Skip the code-review step of the implement skill. One review runs after all tickets are built.
- If the ticket is unclear, choose the reading that fits docs/prds and the root CLAUDE.md, and say what you chose in the commit body.
- Before committing, run \`npm run lint\` and \`npm test\` and make them pass.
- Commit all of the work to the current branch ($branch) as one commit titled \"feat: ${titles[$n]} (#$n)\".
- Do not push, open a PR, or close the issue.
- Only if the ticket is genuinely blocked (a blocking ticket is not built yet, or it needs a decision or access that nothing in the repo settles), change nothing and make the last line of your reply \"BLOCKED: <reason>\".${blocked_note}"

  if ! "$CLAUDE_BIN" -p "$prompt" --permission-mode "$PERMISSION_MODE" </dev/null >"$log" 2>&1; then
    die "#$n: the session failed; see $log"
  fi

  reason="$(grep -E '^BLOCKED:' "$log" | tail -n 1 || true)"
  if [ -n "$reason" ] && [ "$(git rev-parse HEAD)" = "$before" ]; then
    [ -z "$(git status --porcelain)" ] || die "#$n: reported blocked but left changes behind; see $log"
    echo "    skipped, $reason"
    blocked_issues+=("$n")
    continue
  fi

  [ "$(git rev-parse HEAD)" != "$before" ] || die "#$n: no commit was made; see $log"
  [ -z "$(git status --porcelain)" ] || die "#$n: uncommitted changes were left behind; see $log"
  echo "    done: $(git log -1 --format='%h %s')"
  done_issues+=("$n")
done

# --- One fresh session for the final review -------------------------------
echo
if [ ${#done_issues[@]} -eq 0 ]; then
  echo "No tickets were implemented, so there is nothing to review."
else
  echo "=== Code review since $(git rev-parse --short "$base") ==="
  review="$log_dir/review.md"
  done_list="$(printf '#%s ' "${done_issues[@]}")"

  review_prompt="/mattpocock-skills:code-review $base

The specs are GitHub issues ${done_list% }. This session runs unattended: report the findings only, do not change any files."

  if ! "$CLAUDE_BIN" -p "$review_prompt" --permission-mode "$PERMISSION_MODE" </dev/null >"$review" 2>&1; then
    die "the review session failed; see $review"
  fi
  echo "Review: $review"
fi

# --- Summary --------------------------------------------------------------
echo
echo "Implemented: ${#done_issues[@]}"
for n in ${done_issues[@]+"${done_issues[@]}"}; do echo "  #$n ${titles[$n]}"; done
if [ ${#blocked_issues[@]} -gt 0 ]; then
  echo "Skipped as blocked: ${#blocked_issues[@]} (reasons in $log_dir/issue-<n>.log)"
  for n in "${blocked_issues[@]}"; do echo "  #$n ${titles[$n]}"; done
fi
