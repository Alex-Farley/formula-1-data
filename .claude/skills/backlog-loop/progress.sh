#!/usr/bin/env bash
# One line of progress from the backlog-item fork, for a person to watch.
#   bash .claude/skills/backlog-loop/progress.sh <ITEM-ID> "<stage>"
# Appends "HH:MM:SS ITEM stage" to .claude/loop/progress.log (gitignored;
# the driver opens it before the fork starts) and prints the same line. The
# fork's own context is discarded when it returns, so this file is the only
# view of the fork a person has while it runs. A stage is a few words: the
# item chosen, the worktree open, the build green, the PR opened, a reviewer
# launched and which, its verdict, the CI wait entered, CI green, merged.
# Never a report. A line that cannot be written is an error on stderr and
# exit 1, never a silent success: a log that stays empty while the script
# reports success would be the failure this script exists to prevent.
set -u
item="${1:?item id}"
shift
stage="$*"
[ -n "$stage" ] || { echo "progress.sh: a stage is required" >&2; exit 2; }
# A worktree's .claude/ is its own copy; the log belongs beside the main
# checkout, which is where the driver opened it. --git-common-dir is the
# main .git for a worktree and .git itself otherwise, and when relative it
# is relative to the current directory, not to the toplevel.
common=$(git rev-parse --git-common-dir 2>/dev/null || echo ".git")
case "$common" in /*) ;; *) common="$PWD/$common" ;; esac
dir="$(dirname "$common")/.claude/loop"
line="$(date +%H:%M:%S) $item $stage"
if ! mkdir -p "$dir" 2>/dev/null || ! printf '%s\n' "$line" >> "$dir/progress.log" 2>/dev/null; then
  echo "progress.sh: could not write $dir/progress.log" >&2
  exit 1
fi
printf '%s\n' "$line"
