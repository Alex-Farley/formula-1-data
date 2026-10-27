#!/usr/bin/env bash
# The self-check a change passes before it costs a reviewer anything. Run
# from the worktree root after `make ci`. Every check here is one a reviewer
# has failed a PR on in the 2026-09-12 run, at 40,000-130,000 tokens a pass.
#   bash .claude/skills/backlog-loop/precheck.sh [ITEM-ID | #n ...]
# Several ids are a group landing in one PR: each must be one open issue and
# each must have its own `Closes #n` line, or the merge closes some of them
# and silently leaves the rest open on the board.
# An item with no id - an issue filed without one, which next.py names `#n` -
# is given as `#n` or `n`, and checked by number (CR-75).
# refresh.yml's alarm issues (labelled refresh-failing or results-late) are
# the one kind a PR must NOT close: the workflow closes them on the first run
# that proves the fix, so the PR names one `Refs #n` and a closing keyword
# anywhere in the body is a FAIL (AF-89).
set -u
fail=0
# Every diff-based check below is against origin/main. Without that ref they
# all compare nothing and pass in silence - which is what a CI checkout at
# fetch-depth 1 looks like, and how a green precheck could mean "checked
# nothing at all".
git rev-parse --verify -q origin/main >/dev/null 2>&1 || \
  echo "  WARN no origin/main here, so every diff-based check below sees nothing"
# gh's stderr, so a call that failed can be told from one that found nothing.
# An empty answer from a working gh means the item is not filed, which is a
# FAIL; an empty answer from a gh that could not run means nothing at all.
errf=$(mktemp)
trap 'rm -f "$errf"' EXIT
# The PR body, read once by whichever check needs it first (4 or 7), and why
# it could not be read; set here so `set -u` never meets them unset.
body=""; prrc=0; bodyread=0; bodyerr=""
readbody() {
  [ "$bodyread" = 1 ] && return
  body=$(gh pr view --json body --jq .body 2>"$errf"); prrc=$?
  bodyerr=$(head -1 "$errf" | cut -c1-56); bodyread=1
}
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
# Only files that still exist. `git diff --name-only` lists both sides of a
# rename, and ruff exits 1 with E902 on a path it cannot read, so without this
# every rename of a Python file would fail the precheck for a file that is
# supposed to be gone. (Checked against ruff 0.16.7: a missing path is E902
# and exit 1, not the silent 0 the first version of this comment claimed.)
pyfiles=""
for f in $(git diff --name-only origin/main...HEAD -- '*.py' f1 2>/dev/null); do
  [ -f "$f" ] && pyfiles="$pyfiles $f"
done
# Which Ruff, in the order `make lint` resolves it: $RUFF if set; else a
# binary on PATH, where pipx and brew put it; else the module, which is how a
# pip install that never reached PATH is found. $PYTHON names the interpreter
# for that last probe, as the Makefile's PYTHON does.
ruff="${RUFF:-}"
if [ -z "$ruff" ]; then
  if command -v ruff >/dev/null 2>&1; then ruff="ruff"
  elif ${PYTHON:-python3} -m ruff --version >/dev/null 2>&1; then ruff="${PYTHON:-python3} -m ruff"; fi
fi
if [ -n "$pyfiles" ]; then
  if [ -n "$ruff" ]; then
    if $ruff check --quiet $pyfiles >/dev/null 2>&1; then say ok "ruff clean on the changed Python"
    else
      say FAIL "ruff finds what CI's lint job will fail on:"
      $ruff check --output-format concise $pyfiles 2>&1 | head -5
      fail=1
    fi
  else say WARN "ruff not installed, so CI's lint job is unchecked here (pip install ruff)"; fi
fi
# 4. the queue: each item is one open issue, and the PR (once it exists) closes each
if [ $# -gt 0 ]; then
  readbody
  # `gh pr view` exits non-zero when the branch has no PR at all, so that is
  # the "not yet" case; a zero exit with an empty body is a PR someone opened
  # with nothing in it, which is a different thing to say.
  if [ $prrc -ne 0 ]; then say WARN "no PR read for this branch (none yet, or gh failed: $bodyerr) - its body must carry a 'Closes #n' line for every item"
  elif [ -z "$body" ]; then say FAIL "this branch's PR has an empty body; it must carry a 'Closes #n' line for every item"; fail=1; fi
  unresolved=0
  # Each issue found is printed as its number, with "!" after it when it
  # carries an alarm label.
  alarm='any(.labels[].name; . == "refresh-failing" or . == "results-late")'
  for item in "$@"; do
    [ -n "$item" ] || continue
    num=${item#\#}
    if [[ "$num" =~ ^[0-9]+$ ]]; then
      # By number. `gh issue view` answers for a pull request too, with its
      # state, so a merged or open PR number is told apart by its URL.
      ns=$(gh issue view "$num" --json number,state,url,labels --jq "if .state == \"OPEN\" and (.url | test(\"/issues/\")) then \"\(.number)\(if $alarm then \"!\" else \"\" end)\" else \"\" end" 2>"$errf"); rc=$?
      # The one refusal that means the number is not an issue at all.
      if [ $rc -ne 0 ] && grep -q "Could not resolve to an issue" "$errf"; then ns=""; rc=0; fi
    else
      ns=$(gh issue list --state open --search "\"$item:\" in:title" --json number,title,labels --jq "[.[] | select(.title | startswith(\"$item: \")) | \"\(.number)\(if $alarm then \"!\" else \"\" end)\"] | join(\" \")" 2>"$errf"); rc=$?
    fi
    first=${ns%% *}
    n=${first%!}
    if [ $rc -ne 0 ]; then
      # Not a missing issue. Saying so sends a fork to file one that exists,
      # and a group multiplies that by its own size.
      say WARN "$item unchecked, gh failed: $(head -1 "$errf" | cut -c1-72)"
      unresolved=1
    elif [ -z "$n" ]; then say FAIL "$item is not an open issue (landed, declined, or never filed - next.py $item)"; fail=1
    elif [ "$ns" != "$first" ]; then say FAIL "$item is more than one open issue (#${ns// /, #}); ids are never reused - close the duplicate"; fail=1
    elif [ "$first" != "$n" ]; then
      say ok "$item is issue #$n, a refresh.yml alarm that the workflow closes"
      if [ -n "$body" ]; then
        # GitHub closes on a keyword anywhere in the body, not only at the
        # start of a line, and on `owner/repo#n` or the issue's URL as well
        # as `#n`, so the refusal reads the whole of it in all three forms.
        if printf '%s\n' "$body" | grep -qiE "\b(close[sd]?|fix(e[sd])?|resolve[sd]?):?[[:space:]]+([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+#|https?://[^[:space:]]*/issues/|#)$n\b"; then
          say FAIL "the PR body would close alarm #$n on merge; refresh.yml closes it - say 'Refs #$n' instead"; fail=1
        elif printf '%s\n' "$body" | grep -qE "(#|/issues/)$n\b"; then say ok "the PR refers to #$n without closing it"
        else say FAIL "the PR body does not name alarm #$n ('Refs #$n' on its own line)"; fail=1; fi
      fi
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
# 7. a floor in verify.py lowered or removed names the maintainer's ruling
# (AF-103). The floors - rows a bulk table holds, times a harvested column is
# filled - are raised when a harvest legitimately adds and never lowered
# without one; #935 lowered one, 3911 to 3910, and only the reviewer saw it.
# floors.py says which; this compares the branch's verify.py with the one at
# the commit it left main at, so a floor main has raised since does not read
# as this branch lowering it. The PR body carries a line per floor holding
# the word "floor", the floor as `<key> <old> -> <new>` (`removed` for a floor
# deleted) and the ruling, an issue or a decision:
#   Floor lowered: article_images.race_id 3916 -> 3910, ruled on #838
# That the ruling exists and says so is for the reviewer; this makes sure one
# is named. A floor floors.py cannot read fails it, rather than passing unseen.
vchanged=$(git diff --name-only origin/main...HEAD -- verify.py 2>/dev/null)
if [ -n "$vchanged" ]; then
  oldv=$(mktemp); newv=$(mktemp); bodyf=$(mktemp)
  trap 'rm -f "$errf" "$oldv" "$newv" "$bodyf"' EXIT
  git show "$(git merge-base origin/main HEAD):verify.py" >"$oldv" 2>/dev/null
  # Absent at HEAD is every floor gone, which is what an empty file says.
  git show HEAD:verify.py >"$newv" 2>/dev/null
  floors="$(dirname "${BASH_SOURCE[0]}")/floors.py"
  low=$(python3 "$floors" "$oldv" "$newv" 2>"$errf"); frc=$?
  if [ $frc -ne 0 ]; then
    say FAIL "verify.py's floors could not be compared: $(head -1 "$errf" | cut -c1-72)"; fail=1
  elif [ -z "$low" ]; then say ok "no verify.py floor lowered"
  else
    readbody
    printf '%s\n' "$body" >"$bodyf"
    why=""
    [ "$prrc" -ne 0 ] && why=" (no PR body read: $bodyerr)"
    if ! low=$(python3 "$floors" "$oldv" "$newv" --body "$bodyf" 2>"$errf"); then
      say FAIL "the PR body could not be read for floor rulings: $(head -1 "$errf" | cut -c1-60)"; fail=1; low=""
    fi
    [ -n "$low" ] && while read -r key was now verdict; do
      [ "$now" = "removed" ] && what="removed (was $was)" || what="lowered $was -> $now"
      if [ "$verdict" = ruled ]; then
        say ok "verify.py floor $key $what, and the PR body names its ruling"
      else
        say FAIL "verify.py floor $key $what with no ruling named$why - a PR body line with 'floor', '$key $was -> $now' and the ruling (#n or D-nn), or put it back"; fail=1
      fi
    done <<<"$low"
  fi
fi
# 8. a pull request implemented on Sonnet under the AF-144 trial touches no
# protected path (D-60). The fork checks the item before claiming it; this
# checks the diff, which is what the rule is about. Sonnet is known two ways,
# the PR's label and LOOP_IMPLEMENTER=sonnet, which backlog-item-sonnet runs
# this under; either one checks the diff, and the variable without the label
# is a FAIL, since an unlabelled PR is lost to the trial's count. The rule is
# implementer.py as origin/main has it, so a diff cannot rewrite the rule it
# is checked against (the branch's copy only until main first carries it).
# --no-renames: a file moved out of a protected path lists both sides.
labels=$(gh pr view --json labels --jq '.labels[].name' 2>"$errf"); lrc=$?
labelled=0
[ $lrc -eq 0 ] && printf '%s\n' "$labels" | grep -qx 'implementer: sonnet' && labelled=1
if [ "${LOOP_IMPLEMENTER:-}" = sonnet ] || [ $labelled = 1 ]; then
  impl=$(mktemp)
  trap 'rm -f "$errf" "$impl" ${oldv:+"$oldv"} ${newv:+"$newv"} ${bodyf:+"$bodyf"}' EXIT
  if ! git show origin/main:.claude/skills/backlog-loop/implementer.py >"$impl" 2>/dev/null; then
    cp "$(dirname "${BASH_SOURCE[0]}")/implementer.py" "$impl"
    say WARN "origin/main has no implementer.py yet, so the Sonnet trial's paths are read from this branch"
  fi
  if hits=$(git diff --no-renames --name-only origin/main...HEAD | python3 "$impl"); then
    say ok "implemented on Sonnet, and no protected path changed"
  else
    say FAIL "implemented on Sonnet and changes a protected path, which AF-144 keeps on Opus: $(printf '%s' "$hits" | tr '\n' ' ')"; fail=1
  fi
  if [ $labelled = 0 ]; then
    if [ $lrc -ne 0 ]; then say FAIL "implemented on Sonnet, and the PR's label could not be read (none yet, or gh failed: $(head -1 "$errf" | cut -c1-56))"
    else say FAIL "implemented on Sonnet and the PR is not labelled 'implementer: sonnet' - the trial counts by the label"; fi
    fail=1
  fi
elif [ $lrc -ne 0 ]; then
  say WARN "the PR's labels were not read (none yet, or gh failed: $(head -1 "$errf" | cut -c1-56))"
fi
if [ $fail = 0 ]; then echo "precheck: ready for review"; else echo "precheck: fix before asking a reviewer"; exit 1; fi
