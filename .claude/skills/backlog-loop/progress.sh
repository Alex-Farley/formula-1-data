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
#
# Each line is also stamped with what the item has cost so far - "work 412k
# review 0 driver 12k", thousands of new tokens by role, from tokens.py. That
# is the only LIVE view of cost anyone gets: the driver is blocked inside the
# Skill call for as long as the fork runs and cannot poll for anything, so a
# person tailing this file is where it has to appear. The scan takes about a
# second over the transcripts and the fork never reads the result back, so it
# costs the fork nothing. It degrades to a plain line rather than failing -
# a missing figure must not cost a stage line. LOOP_NO_TOKENS=1 turns it off.
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
# Cost first, so the figure lands on the line it describes. On the very first
# call for an item there are no lines yet to take a window from, so tokens.py
# finds nothing and says nothing, which is correct: nothing has been spent.
cost=""
if [ "${LOOP_NO_TOKENS:-0}" != "1" ]; then
  cost=$(python3 "$(dirname "$0")/tokens.py" --item "$item" --brief 2>/dev/null) || cost=""
fi
line="$(date +%H:%M:%S) $item $stage"
[ -n "$cost" ] && line="$line | $cost"
if ! mkdir -p "$dir" 2>/dev/null || ! printf '%s\n' "$line" >> "$dir/progress.log" 2>/dev/null; then
  echo "progress.sh: could not write $dir/progress.log" >&2
  exit 1
fi
printf '%s\n' "$line"
