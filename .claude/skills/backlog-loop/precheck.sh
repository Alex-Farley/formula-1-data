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
  d=$(grep -E '^import ' "$f" | sort | uniq -d)
  [ -n "$d" ] && { say FAIL "$f repeats an import: $d"; fail=1; }
done
# 4. the backlog: the item is landed once, open nowhere, one Declined heading
if [ -n "$item" ]; then
  o=$(grep -c "^- \[ \] \`$item\`" docs/BACKLOG.md); l=$(grep -c "^- \[x\] \`$item\`" docs/BACKLOG.md)
  if [ "$o" = 0 ] && [ "$l" = 1 ]; then say ok "$item landed once, open nowhere"; else say FAIL "$item: $o open, $l landed"; fail=1; fi
fi
d=$(grep -c '^## Declined' docs/BACKLOG.md); [ "$d" = 1 ] && say ok "one Declined heading" || { say FAIL "$d Declined headings"; fail=1; }
# a bold subsection heading (a line that is only **...**) must follow a blank line
bad=$(awk 'prev != "" && /^\*\*[^*]+\*\*$/ {print NR": "$0} {prev=$0}' docs/BACKLOG.md)
[ -n "$bad" ] && { say FAIL "a bold subsection heading in BACKLOG follows a non-blank line: $bad"; fail=1; } || say ok "backlog headings are paragraphs"
# 5. generated artefacts moved only if the change touches what generates them
arts=$(git diff --name-only origin/main...HEAD -- f1.db f1-geometry.db f1_compat.json README.md docs/COMMERCIAL-READINESS.md | tr '\n' ' ')
src=$(git diff --name-only origin/main...HEAD -- build.py schema.sql data harvest tools export_json.py verify.py | wc -l | tr -d ' ')
if [ -n "$arts" ] && [ "$src" = 0 ]; then say WARN "artefacts changed ($arts) with no change under build.py/schema/data/harvest/tools - expected only after merging main"; fi
[ -z "$arts" ] && say ok "no artefact moved" || say ok "artefacts moved: $arts"
# 6. a commit message that does not mention the work
[ -n "$item" ] && { git log origin/main..HEAD --format=%B | grep -q "$item" && say ok "a commit names $item" || { say WARN "no commit message names $item"; }; }
if [ $fail = 0 ]; then echo "precheck: ready for review"; else echo "precheck: fix before asking a reviewer"; exit 1; fi
