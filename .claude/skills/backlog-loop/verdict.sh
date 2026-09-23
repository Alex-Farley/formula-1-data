#!/usr/bin/env bash
# A reviewer's verdict, recorded by a command rather than read from prose.
#
#   bash .claude/skills/backlog-loop/verdict.sh new <PR> <sha> [quick]   (the fork)
#   bash .claude/skills/backlog-loop/verdict.sh record <id> PASS|FAIL [applied]
#                                                              (the reviewer)
#   bash .claude/skills/backlog-loop/verdict.sh read <id>                 (the fork)
#
# `new` opens one review pass against one head and prints its id, which the
# fork puts in the brief. `record` is the reviewer's verdict: it takes PASS
# or FAIL and nothing else, refuses a pass that already has one, and refuses
# unless the checkout it runs in is at the head the pass was opened for. A
# pass opened with `quick` (frontend-reviewer-quick) also needs its applied
# items, `record <id> PASS 1,4,7`, the evidence that the rules were read.
# `read` prints PASS or FAIL and exits 0, or says why there is none and
# exits 1: a pass with no recorded verdict is not a PASS.
#
# Why a command: the loop used to take the verdict from the first line of the
# reviewer's reply, and reviewers kept writing a summary above it however the
# brief put it (D-37, D-38). A command has no first line to get wrong, and a
# FAIL cannot be phrased as a sentence that starts with PASS (D-40).
#
# Files live beside the main checkout in .claude/loop/verdicts/ (gitignored),
# so a reviewer in a worktree and the fork in another write and read the
# same place; the path logic is progress.sh's.
set -u
usage() { echo "usage: verdict.sh new <PR> <sha> [quick] | record <id> PASS|FAIL [applied] | read <id>" >&2; exit 2; }
common=$(git rev-parse --git-common-dir 2>/dev/null || echo ".git")
case "$common" in /*) ;; *) common="$PWD/$common" ;; esac
dir="$(dirname "$common")/.claude/loop/verdicts"
valid_id() { case "$1" in *[!A-Za-z0-9-]*|"") return 1 ;; esac; }

case "${1:-}" in
  new)
    pr="${2:-}"; sha="${3:-}"; kind="${4:-full}"
    case "$pr" in ''|*[!0-9]*) usage ;; esac
    full=$(git rev-parse --verify --quiet "${sha}^{commit}") || { echo "verdict.sh: $sha is not a commit here" >&2; exit 2; }
    case "$kind" in full|quick) ;; *) usage ;; esac
    mkdir -p "$dir" || { echo "verdict.sh: could not create $dir" >&2; exit 1; }
    n=1
    while [ -e "$dir/$pr-${full:0:7}-$n.pass" ]; do n=$((n + 1)); done
    id="$pr-${full:0:7}-$n"
    printf '%s %s\n' "$full" "$kind" > "$dir/$id.pass" || { echo "verdict.sh: could not write $dir/$id.pass" >&2; exit 1; }
    printf '%s\n' "$id"
    ;;
  record)
    id="${2:-}"; verdict="${3:-}"; applied="${4:-}"
    valid_id "$id" || usage
    [ -f "$dir/$id.pass" ] || { echo "verdict.sh: no review pass $id was opened" >&2; exit 2; }
    case "$verdict" in PASS|FAIL) ;; *) echo "verdict.sh: the verdict is PASS or FAIL, not '$verdict'" >&2; exit 2 ;; esac
    [ -e "$dir/$id.verdict" ] && { echo "verdict.sh: pass $id already has a verdict; a pass records one" >&2; exit 2; }
    read -r want kind < "$dir/$id.pass"
    head=$(git rev-parse HEAD 2>/dev/null)
    [ "$head" = "$want" ] || { echo "verdict.sh: this checkout is at ${head:-nothing}, pass $id is for $want" >&2; exit 2; }
    if [ "$kind" = quick ]; then
      case "$applied" in ''|*[!0-9,]*) echo "verdict.sh: a quick pass records its applied items, e.g. 'record $id $verdict 1,4,7'" >&2; exit 2 ;; esac
    fi
    printf '%s %s\n' "$verdict" "$applied" > "$dir/$id.verdict" || { echo "verdict.sh: could not write the verdict" >&2; exit 1; }
    echo "recorded: $verdict for pass $id"
    ;;
  read)
    id="${2:-}"
    valid_id "$id" || usage
    [ -f "$dir/$id.pass" ] || { echo "verdict.sh: no review pass $id was opened" >&2; exit 1; }
    [ -f "$dir/$id.verdict" ] || { echo "verdict.sh: pass $id recorded no verdict" >&2; exit 1; }
    read -r verdict applied < "$dir/$id.verdict"
    printf '%s%s\n' "$verdict" "${applied:+ applied $applied}"
    ;;
  *) usage ;;
esac
