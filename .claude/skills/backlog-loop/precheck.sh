#!/usr/bin/env bash
# The self-check a change passes before it costs a reviewer anything. Run
# from the worktree root after `make ci`. Every check here is one a reviewer
# has failed a PR on in the 2026-09-12 run, at 40,000-130,000 tokens a pass.
#   bash .claude/skills/backlog-loop/precheck.sh [ITEM-ID]
set -u
item="${1:-}"
fail=0
say() { printf '  %-4s %s\n' "$1" "$2"; }
# 1. no conflict markers anywhere tracked
if git grep -nE '^(<<<<<<< |=======$|\|\|\|\|\|\|\| |>>>>>>> )' -- . ':!*.db' >/dev/null 2>&1; then
  say FAIL "conflict markers survive:"; git grep -nE '^(<<<<<<< |\|\|\|\|\|\|\| |>>>>>>> )' -- . ':!*.db' | head -5; fail=1
else say ok "no conflict markers"; fi
# 2. every changed script parses
for f in $(git diff --name-only origin/main...HEAD -- '*.js' '*.mjs' 2>/dev/null); do
  [ -f "$f" ] || continue
  if node --check "$f" >/dev/null 2>&1; then say ok "$f parses"; else say FAIL "$f does not parse"; fail=1; fi
done
for f in $(git diff --name-only origin/main...HEAD -- '*.py' 2>/dev/null); do
  [ -f "$f" ] || continue
  if python3 -c "import ast,sys;ast.parse(open('$f').read())" 2>/dev/null; then say ok "$f parses"; else say FAIL "$f does not parse"; fail=1; fi
done
# 3. no duplicated import line in a changed script
for f in $(git diff --name-only origin/main...HEAD -- '*.js' '*.mjs' '*.jsx' 2>/dev/null); do
  [ -f "$f" ] || continue
  # The bare opener of a multi-line import is not a repeated import; a file
  # with two of those (prerender.js has three) would fail here on every change.
  # Its closing "} from '...'" line is, so a repeated block is still caught.
  d=$(grep -E "^import |^\} from " "$f" | grep -vE '^import \{$' | sort | uniq -d)
  [ -n "$d" ] && { say FAIL "$f repeats an import: $d"; fail=1; }
done
# 4. the queue: the item is one open issue, and the PR (once it exists) closes it
if [ -n "$item" ]; then
  n=$(gh issue list --state open --search "\"$item:\" in:title" --json number,title --jq "[.[] | select(.title | startswith(\"$item: \"))] | .[0].number" 2>/dev/null)
  if [ -z "$n" ] || [ "$n" = null ]; then say FAIL "$item is not an open issue (landed, declined, or never filed - next.py $item)"; fail=1
  else
    say ok "$item is issue #$n"
    body=$(gh pr view --json body --jq .body 2>/dev/null)
    if [ -z "$body" ]; then say WARN "no PR yet for this branch - its body must carry 'Closes #$n' on its own line"
    elif printf '%s\n' "$body" | grep -qiE "^(closes|fixes|resolves) #$n\b"; then say ok "the PR closes #$n"
    else say FAIL "the PR body does not close #$n ('Closes #$n' on its own line)"; fail=1; fi
  fi
fi
# 5. generated artefacts moved only if the change touches what generates them
arts=$(git diff --name-only origin/main...HEAD -- f1.db f1-geometry.db f1_compat.json README.md docs/COMMERCIAL-READINESS.md | tr '\n' ' ')
src=$(git diff --name-only origin/main...HEAD -- build.py schema.sql data harvest tools export_json.py verify.py | wc -l | tr -d ' ')
if [ -n "$arts" ] && [ "$src" = 0 ]; then say WARN "artefacts changed ($arts) with no change under build.py/schema/data/harvest/tools - expected only after merging main"; fi
[ -z "$arts" ] && say ok "no artefact moved" || say ok "artefacts moved: $arts"
# 6. a commit message that does not mention the work
[ -n "$item" ] && { git log origin/main..HEAD --format=%B | grep -q "$item" && say ok "a commit names $item" || { say WARN "no commit message names $item"; }; }
if [ $fail = 0 ]; then echo "precheck: ready for review"; else echo "precheck: fix before asking a reviewer"; exit 1; fi
