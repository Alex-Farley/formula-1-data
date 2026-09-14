#!/usr/bin/env bash
# The self-check a change passes before it costs a reviewer anything. Run
# from the worktree root after `make ci`. Every check here is one a reviewer
# has failed a PR on in the 2026-09-12 run, at 40,000-130,000 tokens a pass.
#   bash .claude/skills/backlog-loop/precheck.sh [ITEM-ID...]
# Several ids are a group landing in one PR: each must be one open issue and
# each must have its own `Closes #n` line, or the merge closes some of them
# and silently leaves the rest open on the board.
set -u
fail=0
# gh's stderr, so a call that failed can be told from one that found nothing.
# An empty answer from a working gh means the item is not filed, which is a
# FAIL; an empty answer from a gh that could not run means nothing at all.
errf=$(mktemp)
trap 'rm -f "$errf"' EXIT
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
# 3b. the changed Python passes the linter. `make ci` is ci.yml's *Python*
# job; `lint` is a separate job, so nothing the fork runs locally sees a lint
# failure. That is how PLW1510 reached CI on this very branch.
pyfiles=$(git diff --name-only origin/main...HEAD -- '*.py' f1 2>/dev/null)
if [ -n "$pyfiles" ]; then
  if command -v ruff >/dev/null 2>&1; then
    if ruff check --quiet $pyfiles >/dev/null 2>&1; then say ok "ruff clean on the changed Python"
    else
      say FAIL "ruff finds what CI's lint job will fail on:"
      ruff check --output-format concise $pyfiles 2>&1 | head -5
      fail=1
    fi
  else say WARN "ruff not installed, so CI's lint job is unchecked here (pip install ruff)"; fi
fi
# 4. the queue: each item is one open issue, and the PR (once it exists) closes each
if [ $# -gt 0 ]; then
  body=$(gh pr view --json body --jq .body 2>"$errf"); prrc=$?
  # `gh pr view` exits non-zero when the branch has no PR at all, so that is
  # the "not yet" case; a zero exit with an empty body is a PR someone opened
  # with nothing in it, which is a different thing to say.
  if [ $prrc -ne 0 ]; then say WARN "no PR read for this branch (none yet, or gh failed: $(head -1 "$errf" | cut -c1-56)) - its body must carry a 'Closes #n' line for every item"
  elif [ -z "$body" ]; then say FAIL "this branch's PR has an empty body; it must carry a 'Closes #n' line for every item"; fail=1; fi
  unresolved=0
  for item in "$@"; do
    [ -n "$item" ] || continue
    ns=$(gh issue list --state open --search "\"$item:\" in:title" --json number,title --jq "[.[] | select(.title | startswith(\"$item: \")) | .number] | join(\" \")" 2>"$errf"); rc=$?
    n=${ns%% *}
    if [ $rc -ne 0 ]; then
      # Not a missing issue. Saying so sends a fork to file one that exists,
      # and a group multiplies that by its own size.
      say WARN "$item unchecked, gh failed: $(head -1 "$errf" | cut -c1-72)"
      unresolved=1
    elif [ -z "$n" ]; then say FAIL "$item is not an open issue (landed, declined, or never filed - next.py $item)"; fail=1
    elif [ "$ns" != "$n" ]; then say FAIL "$item is more than one open issue (#${ns// /, #}); ids are never reused - close the duplicate"; fail=1
    else
      say ok "$item is issue #$n"
      if [ -n "$body" ]; then
        if printf '%s\n' "$body" | grep -qiE "^(closes|fixes|resolves) #$n\b"; then say ok "the PR closes #$n"
        else say FAIL "the PR body does not close #$n ('Closes #$n' on its own line)"; fail=1; fi
      fi
    fi
  done
  # An item whose number `gh` would not tell us still has to be closed by
  # something. Without this the gate falls silent in exactly the outage it
  # was written for: a body closing nothing passed while the API was down.
  if [ "$unresolved" = 1 ] && [ $prrc -eq 0 ] && [ -n "$body" ]; then
    if printf '%s\n' "$body" | grep -qiE "^(closes|fixes|resolves) #[0-9]+\b"; then
      say WARN "the PR closes an issue, but which items those are went unverified"
    else say FAIL "the PR body closes no issue at all, and the ids could not be checked"; fail=1; fi
  fi
fi
# 5. generated artefacts moved only if the change touches what generates them
arts=$(git diff --name-only origin/main...HEAD -- f1.db f1-geometry.db f1_compat.json README.md docs/COMMERCIAL-READINESS.md | tr '\n' ' ')
src=$(git diff --name-only origin/main...HEAD -- build.py schema.sql data harvest tools export_json.py verify.py | wc -l | tr -d ' ')
if [ -n "$arts" ] && [ "$src" = 0 ]; then say WARN "artefacts changed ($arts) with no change under build.py/schema/data/harvest/tools - expected only after merging main"; fi
[ -z "$arts" ] && say ok "no artefact moved" || say ok "artefacts moved: $arts"
# 6. a commit message that does not mention the work
if [ $# -gt 0 ]; then
  log=$(git log origin/main..HEAD --format=%B)
  for item in "$@"; do
    [ -n "$item" ] || continue
    printf '%s\n' "$log" | grep -q "$item" && say ok "a commit names $item" || say WARN "no commit message names $item"
  done
fi
if [ $fail = 0 ]; then echo "precheck: ready for review"; else echo "precheck: fix before asking a reviewer"; exit 1; fi
