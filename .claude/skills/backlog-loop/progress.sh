#!/usr/bin/env bash
# One line of progress from the backlog-item fork, for a person to watch.
#   bash .claude/skills/backlog-loop/progress.sh <ITEM-ID> "<stage>"
# Appends "HH:MM:SS ITEM stage" to .claude/loop/progress.log (gitignored;
# the driver opens it before the fork starts) and prints the same line. The
# fork's own context is discarded when it returns, so this file is the only
# view of the fork a person has while it runs. A stage is a few words: the
# item chosen, the worktree open, the build green, the PR opened, a reviewer
# launched and which, its verdict, CI green, merged. Never a report.
set -u
item="${1:?item id}"
shift
stage="$*"
[ -n "$stage" ] || { echo "progress.sh: a stage is required" >&2; exit 2; }
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
# A worktree's .claude/ is its own copy; the log belongs beside the main
# checkout, which is where the driver opened it. --git-common-dir is the
# main .git for a worktree and .git itself otherwise.
common=$(git rev-parse --git-common-dir 2>/dev/null || echo "$root/.git")
case "$common" in /*) ;; *) common="$root/$common" ;; esac
dir="$(dirname "$common")/.claude/loop"
mkdir -p "$dir"
line="$(date +%H:%M:%S) $item $stage"
printf '%s\n' "$line" >> "$dir/progress.log"
printf '%s\n' "$line"
