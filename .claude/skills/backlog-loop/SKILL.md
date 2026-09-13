---
name: backlog-loop
description: Run the autonomous development loop through docs/BACKLOG.md - one item, a fresh independent review, merge on PASS and green CI, next item. Invoke as /backlog-loop next, /backlog-loop <ITEM-ID>, or /backlog-loop until-paused.
---

# The backlog loop

`docs/BACKLOG.md` is the queue and nothing else is. The rules are in
`CLAUDE.md` under *Working autonomously* and in `CONTRIBUTING.md`; this skill
is the procedure, with the scripts that were retyped by hand until they went
wrong. Read both rule sections before the first item.

Argument (passed through from `.claude/commands/backlog-loop.md`): `next`
takes the first open item by the queue's own order - everything under *Now*
before *Next* before *Someday*, and within a section correctness before
integrity and licensing, functional, security, architecture, accessibility,
UX, throughput; an item id takes that item; `until-paused` repeats `next`
until told to stop or a stop condition below fires. With no argument, behave
as `next`. The section order is a person's ranking and is not overridden.

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

## Before asking for review

Run `bash .claude/skills/backlog-loop/precheck.sh <ITEM-ID>` from the
worktree root. It refuses conflict markers, scripts that do not parse,
duplicated imports, a backlog entry that is open and landed at once and a
broken subsection heading, and warns about an artefact that moved without a
source change or a commit that does not name the item. Half the FAIL
rounds of the 2026-09-12 run were one of these; a reviewer pass costs
40,000-130,000 tokens and this costs a few hundred.

## Review

One fresh agent from `.claude/agents/`, pointed at the worktree path, using
`review-prompt.md` in this folder as the brief. Which one:

- `frontend-reviewer` for anything under `web/` - thoroughly, with a design
  eye: it drives the built pages and compares app and static output.
- `data-integrity-reviewer` for `build.py`, `verify.py`, `schema.sql`,
  `data/`, `harvest/`, `tools/`, `export_json.py`. The build itself refuses
  an unclassified source and verify.py fails on a forbidden one, which is
  why an ordinary data change does not also need the licence reviewer.
- `licence-reviewer` only when a change adds or reclassifies a source, touches
  a workflow, an export or a publishing path, or takes a whole dataset from
  one source. Two reviewers are the exception, not the rule.

Model, decided 2026-09-13 to control cost:
- **First pass: Opus** (`model: "opus"`), for front-end and data alike.
- **Confirming a fix, or reviewing a docs-only, backlog-only or wording-only
  change: Sonnet** (`model: "sonnet"`), as a fresh agent. A fresh Sonnet
  context satisfies the independent-review rule.
- A substantive rewrite after a FAIL gets a new fresh Opus agent, not a
  confirmation.

The brief stays inside the diff: name the specific ways the change could be
wrong; ask for one isolated rebuild only when an artefact changed; do not ask
for site-wide enumerations or live fetches unless the item is about them.
Ask for the verdict line and findings with file:line, nothing else - no
narrative of what was verified.

The agent returns exactly `PASS — safe to merge` or `FAIL — changes required`.

- FAIL: fix, run the precheck again, then confirm with a fresh Sonnet agent by
  commit range.
- PASS with findings: **merge the reviewed head as it is.** Non-blocking
  findings that change code are carried into the next PR, named in the PR
  comment, where the next first pass covers them at no extra cost; they are
  not fixed and re-confirmed on the PR that passed (decided 2026-09-13, after
  a run in which four confirmations bought nothing a later pass would not
  have). A fix that is only documentation wording, a blank line, a comment,
  a test or the removal of dead code may merge without a further pass, named
  in the PR comment. Anything else that changes code, data or a check before
  merge is confirmed.
- Silence, a rate limit or an unavailable account is not a PASS. If the agent
  dies on a session limit, relaunch after the reset.
- Record the verdict as a PR comment (reviewer and model, verdict, the FAIL
  rounds in one line each), then `gh pr merge N --merge` only with the PASS
  and `check (3.9)`, `check (3.12)` and `web` green. **Merging deploys
  lapledger.org**: Cloudflare builds every push to `main`, so a merge is a
  production change. The `review` check fails on an exhausted credential;
  ignore it, never edit it.

## Keeping the cost down

- One PR open at a time. Several open PRs each merge conflicts the others,
  which costs a re-merge, a rebuild, a CI run and a confirmation every time.
- Batch small items on one theme into one PR where the diff stays readable;
  a reviewer pays a fixed cost to orient itself on every PR. **The rungs of
  one M item are one PR**, not one each: the 2026-09-13 run spent four first
  passes and three confirmations on four rungs of `PD-02` whose diffs a
  single pass would have read for the price of one (decided 2026-09-13).
- Do not ask a reviewer to prove what the suite proves. `smoke.mjs` compares
  every static table with the app's, header and every shown row; the brief
  says so and asks the reviewer to check the SQL, the rendering and the
  cases the suite cannot reach, not to rebuild the comparison.
- Keep your own messages short and do not paste reviewer reports back into
  the conversation; the PR comment is the record.

## Waiting and merging

- CI: `bash .claude/skills/backlog-loop/ci-wait.sh <PR>` prints
  `PR N core checks: pass,pass,pass` and exits 0; exits 2 on a failed check,
  1 on a twenty-minute timeout, and 3 at once when the PR is CONFLICTING
  (no check registers, so CI never started - merge main first). Run it in
  the background and read its file; empty output from `gh` is pending.
- Main moved under a branch: `python3 .claude/skills/backlog-loop/merge-main.py`
  from the worktree. It resolves only what it can safely: both sides of
  `docs/BACKLOG.md`, main's copy of the generated artefacts with a rebuild,
  and a README or licence-statement conflict that is only figure spans
  moving. A conflict in any source file, or in prose, stops it with the file
  named, and a person resolves that one. Then rerun the web tests before
  pushing. Merge PRs one at a time; each merge conflicts the others.
- After the merge: remove the worktree, delete the branch, `git pull`.

## Stop conditions

Stop the loop and say why when: a change could corrupt data, breach a licence,
weaken a check or workflow, change production infrastructure other than by
merging, or lose history; when a decision is a person's; when the user asks
to pause. Skip and record an ordinary blocker (network, a service, a missing
non-critical credential). When you stop, end with a stock-take: merged, open,
decisions needed, what is next.
