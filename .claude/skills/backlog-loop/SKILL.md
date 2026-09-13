---
name: backlog-loop
description: Run the autonomous development loop through docs/BACKLOG.md - one item, a fresh independent review, merge on PASS and green CI, next item. Invoke as /backlog-loop next, /backlog-loop <ITEM-ID>, or /backlog-loop until-paused.
---

# The backlog loop

`docs/BACKLOG.md` is the queue and nothing else is. The rules are in
`CLAUDE.md` under *Working autonomously* and in `CONTRIBUTING.md`; this skill
is the procedure, with the scripts that were retyped by hand until they went
wrong. Read both rule sections before the first item.

Argument: `$ARGUMENTS`. `next` takes the highest-priority open item
(correctness > integrity and licensing > functional > security > architecture
> accessibility > UX > throughput); an item id takes that item; `until-paused`
repeats `next` until told to stop or a stop condition below fires. With no
argument, behave as `next`.

## Before an item

1. Reread the item against the code as it is now. It may be stale, landed
   under another id, or superseded. If so, correct the backlog and move on.
2. A fact needs a source before a line of code: official FIA, Formula 1, team,
   power-unit or circuit sources first, then the classified secondary ones.
   Never invent a value - NULL, a `discrepancies` row or a `known_gaps` row.
3. Anything that is a person's decision - a licence reading, a scope change,
   a trade the item does not settle - goes under *Decisions needed* at the top
   of the backlog, and the work continues around it. Do not take it.

## Doing the item

- Worktree: `git worktree add -b claude/<slug> <scratchpad>/wt-<slug> origin/main`.
  For web work, `npm ci` inside it (never symlink `node_modules`). Node is
  at `~/.local/node/bin`.
- Edit through a Python script whose every replacement asserts it matched
  exactly once. Never write a shell-quoting sequence inside a quoted heredoc;
  apostrophes in JS strings go in double-quoted strings.
- Gate each step on the previous one's exit status, never on the output of a
  `| grep`. Order: `make all` -> `cd web && npm run build && npm test` (one
  smoke run at a time; kill any listener on 4179 first and check the log does
  not say "Reusing the server") -> `git add -A && make ci` -> commit -> push
  -> `gh pr create`. Commit and PR text end with the attribution lines the
  session was given.
- Backlog: move the item to *Landed* with its id, source and the PR number;
  file anything discovered as a new item under the conventions. Never leave
  discovered work in a note or a comment.

## Review

Launch a fresh agent from `.claude/agents/` - `frontend-reviewer` for
`web/`, `data-integrity-reviewer` for `build.py`, `verify.py`, `data/`,
`harvest/`, `tools/`, `licence-reviewer` for anything touching sources,
licences, workflows or publishing paths; two agents when a change spans them
- always with `model: "opus"`, pointed at the worktree path, using
`review-prompt.md` in this folder as the brief. It returns exactly
`PASS — safe to merge` or `FAIL — changes required`.

- FAIL: fix, then ask the same agent (SendMessage) to confirm the delta by
  commit range. A substantive rewrite gets a new fresh agent.
- PASS with findings: take the cheap ones, confirm the delta the same way.
- Silence, a rate limit or an unavailable account is not a PASS. If the agent
  dies on a session limit, relaunch after the reset.
- Record the verdict as a PR comment (which reviewer, what it verified, what
  the FAIL rounds were), then `gh pr merge N --merge` only with the PASS and
  `check (3.9)`, `check (3.12)` and `web` green. The `review` check fails on
  an exhausted credential; ignore it, never edit it.

## Waiting and merging

- CI: `bash .claude/skills/backlog-loop/ci-wait.sh <PR>` prints
  `PR N core checks: pass,pass,pass` or a timeout. Run it in the background
  and read its file; empty output from `gh` is pending. `?,?,?` means the PR
  is CONFLICTING and CI never started.
- Main moved under a branch: `python3 .claude/skills/backlog-loop/merge-main.py`
  from the worktree. It merges `origin/main`, concatenates both sides of
  `docs/BACKLOG.md`, takes main's copy of every generated artefact and
  rebuilds, dedupes import lines, and runs `node --check` on every touched
  script. Then rerun the web tests before pushing. Merge PRs one at a time;
  each merge conflicts the others.
- After the merge: remove the worktree, delete the branch, `git pull`.

## Stop conditions

Stop the loop and say why when: a change could corrupt data, breach a licence,
weaken a check or workflow, change production infrastructure other than by
merging, or lose history; when a decision is a person's; when the user asks
to pause. Skip and record an ordinary blocker (network, a service, a missing
non-critical credential). When you stop, end with a stock-take: merged, open,
decisions needed, what is next.
