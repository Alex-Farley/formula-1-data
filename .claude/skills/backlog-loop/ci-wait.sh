#!/usr/bin/env bash
# Wait for a PR's three core checks. Prints "PR N core checks: a,b,c" when
# none is pending - exit 0 when all three pass, 2 when any failed - or
# "PR N timeout: ..." with exit 1 after ~20 minutes. Empty output from gh
# (API hiccup, checks not yet registered) counts as pending. Exit 4 is a gh
# that cannot do this job at all - absent, unauthenticated, or too old for
# `pr checks --json` - and is deliberately not 2: a caller gating on the
# exit status would read 2 as a failed check and go looking for a defect in
# the diff that is not there.
#   bash ci-wait.sh 123
# In the foreground, with the Bash tool's maximum timeout, run again if the
# tool times out first (PM-39): a fork that backgrounds this and ends its
# turn has returned, and the result lands where nothing acts on it.
set -u
n="${1:?pr number}"
here=$(dirname "$0")
# An unusable gh is twenty minutes of silence here, not an error: its empty
# answer reads as '?,?,?', which the loop below treats as "no check has
# registered yet" and sleeps on forty times. Stop on the first call instead.
python3 "$here/gh_preflight.py" || exit 4
for i in $(seq 1 40); do
  out=$(gh pr checks "$n" --json name,bucket 2>/dev/null | python3 -c '
import json, sys
d = json.load(sys.stdin)
c = {x["name"]: x["bucket"] for x in d}
print(",".join(c.get(k, "?") for k in ["check (3.9)", "check (3.12)", "web"]))' 2>/dev/null)
  # An empty or all-unknown first answer is either a gh that cannot do this
  # job - absent, unauthenticated, or too old for `pr checks --json` - or a
  # PR whose checks have not registered. Only the second is worth waiting
  # twenty minutes for, and until 2026-09-14 both waited.
  if [ "$i" = 1 ]; then
    case "$out" in
      ""|'?,?,?') python3 "$here/gh_preflight.py" --diagnose || exit 4 ;;
    esac
  fi
  case "$out" in
    '?,?,?')
      # No check registered: usually the PR is CONFLICTING and CI never
      # started. Say so at once rather than after twenty minutes.
      if [ "$(gh pr view "$n" --json mergeable -q .mergeable 2>/dev/null)" = "CONFLICTING" ]; then
        echo "PR $n is CONFLICTING - merge main into the branch first"; exit 3
      fi
      sleep 30 ;;
    ""|*pending*|*'?'*) sleep 30 ;;
    pass,pass,pass) echo "PR $n core checks: $out"; exit 0 ;;
    *) echo "PR $n core checks: $out"; exit 2 ;;
  esac
done
echo "PR $n timeout: ${out:-no output}"
exit 1
