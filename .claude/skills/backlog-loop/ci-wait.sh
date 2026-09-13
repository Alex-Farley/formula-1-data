#!/usr/bin/env bash
# Wait for a PR's three core checks. Prints "PR N core checks: a,b,c" when
# none is pending - exit 0 when all three pass, 2 when any failed - or
# "PR N timeout: ..." with exit 1 after ~20 minutes. Empty output from gh
# (API hiccup, checks not yet registered) counts as pending.
#   bash ci-wait.sh 123 > scratchpad/ci123.txt 2>&1 &
set -u
n="${1:?pr number}"
for _ in $(seq 1 40); do
  out=$(gh pr checks "$n" --json name,bucket 2>/dev/null | python3 -c '
import json, sys
d = json.load(sys.stdin)
c = {x["name"]: x["bucket"] for x in d}
print(",".join(c.get(k, "?") for k in ["check (3.9)", "check (3.12)", "web"]))' 2>/dev/null)
  case "$out" in
    ""|*pending*|*'?'*) sleep 30 ;;
    pass,pass,pass) echo "PR $n core checks: $out"; exit 0 ;;
    *) echo "PR $n core checks: $out"; exit 2 ;;
  esac
done
echo "PR $n timeout: ${out:-no output}"
exit 1
