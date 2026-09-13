---
name: backlog-item
description: One backlog item from docs/BACKLOG.md, start to merge, in a forked context - the per-item procedure of /backlog-loop. Arguments are <pace> and <next | ITEM-ID>. Invoked by the backlog-loop skill; a person may also run it directly for one item.
argument-hint: "<fast | balanced | thorough> <next | ITEM-ID>"
context: fork
effort: high
---

# One backlog item

You are the forked context for one item. `docs/BACKLOG.md` is the queue and
nothing else is. The rules are in `CLAUDE.md` under *Working autonomously*
and in `CONTRIBUTING.md`; read both rule sections before touching anything.
The scripts are in `.claude/skills/backlog-loop/`. Your result is read by
the driver, which sees only its first line and a five-line stock-take, so
end exactly as *The result* says below.

Arguments: a pace - `fast`, `balanced` or `thorough`, default `balanced` -
and a target - `next` or an item id, default `next` - optionally followed by
`--skip A,B`, the ids this run has already skipped. This skill is
model-invocable because the driver has to invoke it; it is not for a
session to pick up from its description. If you were not invoked by the
`backlog-loop` driver or by a person typing `/backlog-item`, return
`STOP: not invoked by the loop` and do nothing. Before starting, run
`gh pr list --state open` and `git worktree list`: an open `claude/` PR or
a leftover worktree from a fork the limit ended is finished first, from
where it stopped.

## Before an item

1. `python3 .claude/skills/backlog-loop/next.py` prints the first open item
   in the queue's own order, with its section and the open decisions to
   work around; `next.py <ID>` prints one item; `next.py --list Now` prints
   one line per open item in a section, for batching; `--skip A,B` passes
   over ids the driver names. The order is the file's: *Now* before *Next*
   before *Someday*, top to bottom. Within a section a person has ranked by
   hand (*Now* and *Next*, since #100) that is the whole rule. In a
   section nobody has ranked - a subsection filed straight from a critique
   - the tiebreak stands: correctness before integrity and licensing,
   functional, security, architecture, accessibility, UX, throughput; read
   `--list` for that section, choose, and say in the PR why that item came
   first. **Never read the
   backlog file itself** to find an item: it is 145 KB, half of it history,
   and reading it in slices is what filled the driving context before this
   skill existed. Open the file only to edit it.
2. Reread the item against the code as it is now. It may be stale, landed
   under another id, or superseded. If so, correct the backlog and move on.
3. A fact needs a source before a line of code: official FIA, Formula 1, team,
   power-unit or circuit sources first, then the classified secondary ones.
   Never invent a value - NULL, a `discrepancies` row or a `known_gaps` row.
4. Anything that is a person's decision - a licence reading, a scope change,
   a trade the item does not settle - goes under *Decisions needed* at the top
   of the backlog, and the work continues around it. Do not take it.

## The pace

Decided 2026-09-13 by the maintainer (`PM-36`). The pace changes how much
review depth and batching an item gets. It changes nothing in the next list.

**Never slides, at any pace:** a fresh independent review before merge;
`make all`; the precheck; `check (3.9)`, `check (3.12)` and `web` green; the
licence-reviewer triggers; the stop conditions; Opus for any change under
`data/`, `harvest/`, `build.py`, `verify.py`, `schema.sql`, the exporters,
`web/scripts/prerender.js` or a workflow.

| | `fast` | `balanced` | `thorough` |
|---|---|---|---|
| First-pass reviewer | `frontend-reviewer-quick` (Sonnet, 50 turns) for an S item under `web/` that does not touch `scripts/prerender.js`; the Opus reviewer for the area otherwise | the Opus reviewer for the area | the Opus reviewer for the area |
| Routes named in the brief for the reviewer to spot-check | 3 | 10, chosen for edge cases: a NULL, a tie, a shared drive, a season not yet run | every route the change touches |
| Confirming a fix that must land before merge | fresh Sonnet | fresh Sonnet | fresh Opus |
| Items per PR | S items on one theme, up to four, where the diff stays readable | one M (all its rungs), or two S on a theme | one |
| Pipelining | start item N+1 in its own worktree while N is under review; hold its PR until N merges, then `merge-main.py` | none | none |

The reviewers' effort and turn caps are frontmatter in `.claude/agents/`:
the standard reviewers run at effort high with a cap of 90 turns, the quick
variant at effort high with 50. The caps are runaway stops, not budgets - a
reviewer that hits one returns without a verdict line, and that is not a
PASS. The Agent tool overrides a model per call and not an effort, which is
why a pace picks an agent rather than a setting.

## Doing the item

- Worktree: `git worktree add -b claude/<slug> <scratchpad>/wt-<slug> origin/main`.
  For web work, `npm ci` inside it (never symlink `node_modules`). Node is
  at `~/.local/node/bin`.
- Edit through a Python script whose every replacement asserts it matched
  exactly once. Never write a shell-quoting sequence inside a quoted heredoc;
  apostrophes in JS strings go in double-quoted strings.
- Gate each step on the previous one's exit status, never on the output of a
  `| grep`. Order: `make all QUIET=1` -> `cd web && npm run build && npm test
  -- --quiet` (one smoke run at a time; kill any listener on 4179 first and
  check the log does not say "Reusing the server") -> `git add -A && make ci
  QUIET=1` -> commit -> push -> `gh pr create`. Commit and PR text end with
  the attribution lines the session was given.
- **Quiet forms, always.** `QUIET=1` and `--quiet` run every check and keep
  every exit code; they print failures, warnings and a count of what passed
  instead of one line per check. The verbose run is thirteen hundred lines
  for `make ci` and five hundred for the smoke test — about 25,000 tokens
  read back per iteration. While iterating on one page,
  `npm run test:page -- /drivers` runs only the smoke sections whose heading
  names it (two seconds; `node test/smoke.mjs --list` shows the headings),
  then the full `npm test -- --quiet` before the commit — a passing subset
  is not a passing site.
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

The reviewer checklists' mechanical items are tests now, not review:
`tests/test_conventions.py` (the build constant, the timing switch, geometry
column lists, both databases in every publishing path, workflow permissions,
the agents' and skills' frontmatter) runs in `make ci`, and
`web/test/conventions.mjs` (the attribution rule, declared zero fallbacks,
the wordmark, `display: contents`, the router) runs in `npm test`. Each
agent's file names the items it no longer reads for. Do not ask a reviewer
to confirm one of these; the brief stays on judgement.

## Review

One fresh agent from `.claude/agents/`, pointed at the worktree path, using
`.claude/skills/backlog-loop/review-prompt.md` as the brief. Which one:

- `frontend-reviewer` for anything under `web/` - thoroughly, with a design
  eye: it drives the built pages and compares app and static output. At
  `fast`, `frontend-reviewer-quick` where the pace table allows it.
- `data-integrity-reviewer` for `build.py`, `verify.py`, `schema.sql`,
  `data/`, `harvest/`, `tools/`, `export_json.py`, `tests/` and the loop's
  own scripts and skills. The build itself refuses an unclassified source
  and verify.py fails on a forbidden one, which is why an ordinary data
  change does not also need the licence reviewer.
- `licence-reviewer` only when a change adds or reclassifies a source, touches
  a workflow, an export or a publishing path, or takes a whole dataset from
  one source. Two reviewers are the exception, not the rule.

Model, decided 2026-09-13 to control cost:
- **First pass: Opus** (`model: "opus"`), for front-end and data alike,
  except where the pace table names the quick variant.
- **Confirming a fix, or reviewing a docs-only, backlog-only or wording-only
  change: Sonnet** (`model: "sonnet"`), as a fresh agent. A fresh Sonnet
  context satisfies the independent-review rule.
- A substantive rewrite after a FAIL gets a new fresh Opus agent, not a
  confirmation.

The brief stays inside the diff: name the specific ways the change could be
wrong; name the routes the pace allows and no more; ask for one isolated
rebuild only when an artefact changed; do not ask for site-wide enumerations
or live fetches unless the item is about them. Ask for the verdict line and
findings with file:line, nothing else - no narrative of what was verified.

The agent returns exactly `PASS — safe to merge` or `FAIL — changes required`.

- FAIL: fix, run the precheck again, then confirm with a fresh agent by
  commit range - Sonnet, or Opus at `thorough`.
- PASS with findings: **merge the reviewed head as it is.** Non-blocking
  findings that change code are carried into the next PR, named in the PR
  comment, where the next first pass covers them at no extra cost; they are
  not fixed and re-confirmed on the PR that passed (decided 2026-09-13, after
  a run in which four confirmations bought nothing a later pass would not
  have). A fix that is only documentation wording, a blank line, a comment,
  a test or the removal of dead code may merge without a further pass, named
  in the PR comment. Anything else that changes code, data or a check before
  merge is confirmed.
- Silence, a rate limit, a reviewer that hit its turn cap, a quick-variant
  verdict without its `Applied:` line, or an unavailable account is not a
  PASS. If the agent dies on a session limit, relaunch
  after the reset.
- Record the verdict as a PR comment (reviewer and model, verdict, the FAIL
  rounds in one line each), then `gh pr merge N --merge` only with the PASS
  and `check (3.9)`, `check (3.12)` and `web` green. **Merging deploys
  lapledger.org**: Cloudflare builds every push to `main`, so a merge is a
  production change. The `review` check fails on an exhausted credential;
  ignore it, never edit it.

## Keeping the cost down

- One PR open at a time, except the one item of pipelining `fast` allows.
  Several open PRs each merge conflicts the others, which costs a re-merge,
  a rebuild, a CI run and a confirmation every time.
- Batch small items on one theme into one PR where the diff stays readable;
  a reviewer pays a fixed cost to orient itself on every PR. **The rungs of
  one M item are one PR**, not one each: the 2026-09-13 run spent four first
  passes and three confirmations on four rungs of `PD-02` whose diffs a
  single pass would have read for the price of one (decided 2026-09-13).
- Do not ask a reviewer to prove what the suite proves. `smoke.mjs` compares
  every static table on the routes it visits with the app's, header, row count
  and every shown row - name the routes in the brief; the brief
  says so and asks the reviewer to check the SQL, the rendering and the
  cases the suite cannot reach, not to rebuild the comparison.
- Keep your own messages short and do not paste reviewer reports into your
  context twice; the PR comment is the record. Read build and test output
  in its quiet form and never `cat` a log you have already checked the exit
  status of.

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

Stop and say why when: a change could corrupt data, breach a licence,
weaken a check or workflow, change production infrastructure other than by
merging, or lose history; when a decision is a person's; when the user asks
to pause. Skip and record an ordinary blocker (network, a service, a missing
non-critical credential) as a backlog note on the item, and leave the
repository clean: no worktree, no open PR, no half-edited file.

## The result

The last thing you write is the result the driver reads. Its first line is
exactly one of:

    MERGED #<N> <ID>
    SKIPPED <ID>: <reason in one clause>      (the driver passes the id to the next fork's --skip)
    STOP: <reason in one clause>
    LIMIT: resets <time as the limit message gave it>

followed by a stock-take of at most five lines: what merged, what is open,
decisions filed, what `next.py` now prints as next. No reviewer report, no
build output, no narrative of the work - the PR and its comment hold those.
