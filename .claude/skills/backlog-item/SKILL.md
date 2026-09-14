---
name: backlog-item
description: One item from the queue (GitHub Issues, ranked on the Lap Ledger project), start to merge, in a forked context - the per-item procedure of /backlog-loop. Arguments are <pace> and <next | ITEM-ID>. Invoked by the backlog-loop skill; a person may also run it directly for one item.
argument-hint: "<fast | balanced | thorough> <next | ITEM-ID>"
context: fork
effort: high
---

# One backlog item

You are the forked context for one item. GitHub Issues, ranked on the Lap
Ledger project board, is the queue and nothing else is; the conventions -
id, source, size, status, how an item lands, is declined or is blocked - are
in `CONTRIBUTING.md` under *The queue*. The rules are in `CLAUDE.md` under *Working autonomously*
and in `CONTRIBUTING.md`; read both rule sections before touching anything.
The scripts are in `.claude/skills/backlog-loop/`. Your result is read by
the driver, which sees only its first line and a five-line stock-take, so
end exactly as *The result* says below. **Ending your turn is returning:**
your context is discarded the moment you stop, so nothing you launched and
did not wait for - a reviewer, a CI wait - ever reports back to you. Its
result lands in the driver, which may not act on it. Never end a turn to
wait for something.

Arguments: a pace - `fast`, `balanced` or `thorough`, default `balanced` -
and a target - `next` or an item id, default `next` - optionally followed by
`--skip A,B`, the ids this run has already skipped. This skill is
model-invocable because the driver has to invoke it; it is not for a
session to pick up from its description. If you were not invoked by the
`backlog-loop` driver or by a person typing `/backlog-item`, return
`STOP: not invoked by the loop` and do nothing. Before starting, run
`gh pr list --state open` and `git worktree list`: an open `claude/` PR or
a leftover worktree from a fork the limit ended is finished first, from
where it stopped. Read the PR's comments before anything else: a recorded
`FAIL` nobody has fixed is fixed, never reviewed again on the same head.
(2026-09-13: a fork that inherited PR #273 with three unrecorded FAILs
launched three more reviewers on the unchanged commit.)

## Before an item

1. `python3 .claude/skills/backlog-loop/next.py --group` prints the first
   open item in the queue's own order - its issue number, title, labels and
   body, with the open decisions to work around - and under it the `size: S`
   items that could ride with it in one pull request. Use `--group` at every
   pace but `thorough`, which takes one item and never groups; *Grouping*
   below is how a proposal becomes a group. `next.py <ID>` prints one item
   and `next.py <ID> <ID> <ID>` several in full, which is how a proposed
   group is read before it is taken; `next.py --list Now` prints one line
   per open item in a status; `--skip A,B` passes over ids the driver
   names, and an issue
   labelled `blocked` or `decision`, or with status *In progress*, is
   passed over on its own. The order is the board's: status *Now* before
   *Next* before *Someday*, top to bottom within a status, which is what a
   person drags. Where a person has ranked by hand (*Now* and *Next*, since
   #100) that is the whole rule. Where nobody has - a batch filed straight
   from a critique lands at the foot of *Next* in filing order - the
   tiebreak stands: correctness before integrity and licensing, functional,
   security, architecture, accessibility, UX, throughput; read `--list` for
   that status, choose, and say in the PR why that item came first. **Never
   page through the issue list or the board** to find an item: `next.py`
   does it for a few hundred tokens, which is the point of it. Open an
   issue only to work on it.
2. Reread the item against the code as it is now. It may be stale, landed
   under another id, or superseded. If so, close it with the reason -
   `python3 .claude/skills/backlog-loop/file.py decline <n> "<landed in
   #m>"` or `"<superseded by ID>"` - and move on.
3. A fact needs a source before a line of code: official FIA, Formula 1, team,
   power-unit or circuit sources first, then the classified secondary ones.
   Never invent a value - NULL, a `discrepancies` row or a `known_gaps` row.
4. Anything that is a person's decision - a licence reading, a scope change,
   a trade the item does not settle - is put on the item with
   `file.py decision <n> "<what must be decided>"`, or filed as its own
   issue with `file.py new <prefix> "<title>" --size ? --decision --body
   "..."` when it is a new question, and the work continues around it. Do
   not take it. `next.py` lists the open decisions under every item it
   prints.

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
| Items per PR (*Grouping*) | S items on one theme, up to four, where the diff stays readable | one M (all its rungs), or two S on a theme | one |
| Pipelining | none (PM-39: the review and the CI wait are foreground, so a fork holds one item at a time; batching is the `fast` saving) | none | none |

## Grouping

A reviewer pays a fixed cost on every pull request - the rules, the
surroundings of the diff, the build - before it reads a line of the change.
Two items that touch the same file pay it twice for nothing. Grouping is how
that is avoided; `python3 .claude/skills/backlog-loop/next.py --group` is how
a group is found.

**The head is the queue's next item, always.** Grouping decides what rides
with it, never which item comes first. A person's ranking is not
renegotiated by a script's score.

**What a companion has to earn:** it is cheaper *because* it rides with the
head - the same file, the same query, the same component, the same test - so
that one reading of the surrounding code serves both. Two items that share a
`source:` label, or a subject, are not a theme. If you cannot write the one
sentence saying why these are one change, they are not one change, and the
sentence goes in the pull request.

`--group` lists candidates with the signal each was proposed on and a score.
The score is a hint and no more: it reads titles and bodies, not code, and
the same path in two bodies can be two unrelated functions. Read the full
bodies - `next.py <head> <candidate> <candidate>` - before taking any.

- **How many** is the pace's *Items per PR* row: up to four S at `fast`, two
  S at `balanced`, none at `thorough`. An M or L item is never grouped - the
  rungs of one M are already one PR.
- **A companion from the status below the head** is being promoted past
  everything between, which only a shared file pays for. Say in the pull
  request why it came up.
- **Two items that are the same defect** turn up - two critiques found it
  from different angles (`IX-18` and `AX-18`, both sticky headers). One pull
  request closes both and says they were one finding. That is a good
  outcome, not a bookkeeping problem.
- **Drop, never grow.** If the diff stops reading as one change, drop the
  last companion added and **put its status back** - `file.py status <n>
  Next`, or whichever status it came from. Only then does it stay ranked
  where it was; a companion dropped while still marked *In progress* has
  left the queue. A group is an economy, not a target.
- **A companion that does not survive the reread** - stale, landed under
  another id, superseded - is declined like any other item
  (`file.py decline <n> "<why>"`) and does not join.
- **A companion that turns into a blocker** is dropped from the group and
  recorded on its own issue (`file.py blocked`), with its status set back;
  the head carries on. Only the head being blocked is a `SKIPPED`.

**Every issue set to *In progress* leaves that status by exactly one of
four routes**, and a group has to account for each of its own: merged
(`Done`), blocked (`file.py blocked`, status back), stopped or skipped
(status back), or dropped from the group (status back). An issue left at
*In progress* is one `next.py` never returns as next, so it is out of the
queue until a person moves it by hand.

The one exception is a usage limit: a `LIMIT:` return leaves every issue of
the group *at* *In progress* on purpose, because the next fork picks the
work up from the open PR and worktree and needs to see it is taken. A limit
is not a stop. Until that PR exists, the only record of which issues are in
the group is the board itself - the branch is named for the head alone - so
a fork inheriting a worktree reads `next.py`'s *In progress elsewhere*
footer, which lists every one of them, before it decides what it inherited.

Every issue in the group gets `file.py status <n> "In progress"` when the
worktree opens and a `Closes #<n>` line of its own in the pull request body.
The branch is named for the head (`claude/vd-33-photographs`); the progress
lines and the result line name the group (`VD-33+AX-13`). The pull request
body has a short section per item saying what was done for it.

The reviewers' effort and turn caps are frontmatter in `.claude/agents/`:
the standard reviewers run at effort high with a cap of 90 turns, the quick
variant at effort high with 50. The caps are runaway stops, not budgets - a
reviewer that hits one returns without a verdict line, and that is not a
PASS. The Agent tool overrides a model per call and not an effort, which is
why a pace picks an agent rather than a setting.

## What the person sees

Your context is invisible to the person who started the loop, on purpose:
keeping it out of the driver is what made the loop affordable. From the
driver your whole run is one tool call that sits there for many minutes
showing no token use, and on 2026-09-13 the maintainer interrupted it three
times believing it had stalled, killing the fork each time. The replacement
for the visibility the fork took away is one line per stage:

    bash .claude/skills/backlog-loop/progress.sh <ITEM-ID> "<stage>"

appends `HH:MM:SS ITEM stage` to `.claude/loop/progress.log` beside the
main checkout, which the driver created and pointed the person at before
invoking you. It exits 1 if the line could not be written; say so in your
result's stock-take and carry on.
Write one at each of these, in a few words each and never as a report: the
item chosen (`next.py` gave #n); group formed (the ids, or none); worktree
open; `make all` green; web tests green; PR opened (#N); reviewer launched
(which agent, which model); verdict (PASS or FAIL, one clause); fix pushed;
confirmation launched; CI wait entered (the longest silence, up to twenty
minutes); CI green; merged; and any skip or stop with its reason. Before
the item is known, use the target you were given as the id. A stage costs a few
tokens; a fork killed as stalled costs the item.

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
- The issue: when the worktree opens, `file.py status <n> "In progress"` for
  every issue in the group, so a second fork or a person sees they are taken.
  The PR body carries `Closes #<n>` on its own line for each of them, so the
  merge closes them and the board moves them to *Done*; the PR body says
  what was done and what was left, and is the record. Anything discovered
  is filed as its own issue -
  `file.py new <prefix> "<title>" --size <S|M|L|?> --body "<what is wrong,
  where, and what would fix it>"` - under the conventions in
  `CONTRIBUTING.md`; the prefix continues its critique's sequence on its
  own. Never leave discovered work in a note, a PR comment or a TODO.

## Before asking for review

Run `bash .claude/skills/backlog-loop/precheck.sh <ITEM-ID> [<ITEM-ID>...]`
from the worktree root, naming every id in the group. It refuses conflict
markers, scripts that do not parse, duplicated imports and, once the PR
exists, a PR body that does not close every item's issue with `Closes #n`,
and warns about an artefact that moved without a source change or a commit
that does not name the item. Half the FAIL
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
`.claude/skills/backlog-loop/review-prompt.md` as the brief. **Launch it
with `run_in_background: false` and wait for it**: the Agent tool runs in
the background by default, and a fork that launches a reviewer in the
background and ends its turn has returned - its context is gone, the
verdict lands in the driver, and the driver's contract forbids acting on
it. Two reviewers on one PR are launched in one message, both foreground.
Which one:

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
- **Confirming a fix, or reviewing a docs-only or wording-only
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
- FAIL against one item of a group: fix it as usual if the fix is small. If
  it is not, drop that item from the PR - its commits, its `Closes` line,
  its section, **and its *In progress* status**, which nothing else on this
  path puts back: the run ends in a merge, so the stop-and-skip rule never
  fires and the post-merge `Done` covers only what the PR closed. Then
  confirm the smaller change. A group never holds the rest of itself
  hostage to its worst member.
- PASS with findings: **fix what belongs to this diff, then merge.** A
  finding is fixed on the PR that found it when it is in a file this PR
  already changes and the diff still reads as one change; all of them go in
  one batch with **one** confirmation. What 2026-09-13 measured and rejected
  was four confirmations buying nothing a later pass would not have - one
  confirmation covering four fixes is not that, and it is cheaper than the
  orientation a later reviewer pays to read the same code again (revised
  2026-09-14 by the maintainer, on the count below).
  Carry a finding only when it needs a decision this item does not settle,
  when it touches code this PR does not, or when fixing it would make the
  diff unreadable - then name it in the PR comment and file it. A fix that is
  only documentation wording, a blank line, a comment, a test or the removal
  of dead code needs no further pass at all.
- **A review finding is not discovered work, and only one of them is an
  issue.** A fact the item turned up, a question for a person, a defect
  somewhere else in the codebase - those are issues, and filing them is the
  queue doing its job. A defect in the diff under review is not: filing it
  converts a fix into a backlog item, and the item that found it is the
  cheapest place it will ever be fixed. On 2026-09-14 three items landed and
  filed seven issues between them; four were discovered work and three were
  findings against the diff in hand.
- Silence, a rate limit, a reviewer that hit its turn cap, a quick-variant
  verdict without its `Applied:` line, or an unavailable account is not a
  PASS. If the agent dies on a session limit, return `LIMIT: resets
  <time>` at once; the driver schedules the wake-up and a fresh fork
  picks the PR up. You cannot outlive the reset.
- **Record the verdict as a PR comment the moment it arrives**, before the
  fix, the confirmation or anything else: reviewer and model, verdict, the
  blocking findings in one line each. A fork can die between the verdict
  and the merge - a limit, an interrupt - and the comment is what the next
  fork reads to fix rather than re-review. Then `gh pr merge N --merge` only with the PASS
  and `check (3.9)`, `check (3.12)` and `web` green. **Merging deploys
  lapledger.org**: Cloudflare builds every push to `main`, so a merge is a
  production change. The `review` check fails on an exhausted credential;
  ignore it, never edit it.

## Keeping the cost down

- One PR open at a time, except the one item of pipelining `fast` allows.
  Several open PRs each merge conflicts the others, which costs a re-merge,
  a rebuild, a CI run and a confirmation every time.
- Group small items that share a file into one PR, as *Grouping* says;
  a reviewer pays a fixed cost to orient itself on every PR. **The rungs of
  one M item are one PR**, not one each: the 2026-09-13 run spent four first
  passes and three confirmations on four rungs of `PD-02` whose diffs a
  single pass would have read for the price of one (decided 2026-09-13).
- Do not ask a reviewer to prove what the suite proves. `smoke.mjs` compares
  every static table on the routes it visits with the app's, header, row count
  and every shown row - name the routes in the brief; the brief
  says so and asks the reviewer to check the SQL, the rendering and the
  cases the suite cannot reach, not to rebuild the comparison.
- **GitHub is a budget too.** `next.py` reads the board and every open issue
  on each run - a ProjectsV2 query is the expensive kind - and every issue of
  a group needs a status on the way in and another on the way out. The
  scripts cache what is safe to cache, so `next.py --group` followed by
  `next.py <head> <companion>` costs one board read and not two; calling
  `next.py` repeatedly to browse still costs one each time, so do not.
- **A rate limit is an ordinary blocker, and retrying extends it.** GitHub's
  secondary limiter is not one of the buckets `gh api rate_limit` reports -
  on 2026-09-14 every one of those read full while it refused every GraphQL
  call - so a `gh` failure saying a limit is exceeded while the buckets look
  untouched is that limiter, not a defect and not your quota. Record it, stop
  calling, and come back; a poll every 45 seconds keeps it closed. A
  `precheck.sh` FAIL saying an item "is not an open issue" while the API is
  refusing calls is this, not a missing issue: check before you file it again.
- Keep your own messages short and do not paste reviewer reports into your
  context twice; the PR comment is the record. Read build and test output
  in its quiet form and never `cat` a log you have already checked the exit
  status of.

## Waiting and merging

- CI: `bash .claude/skills/backlog-loop/ci-wait.sh <PR>` prints
  `PR N core checks: pass,pass,pass` and exits 0; exits 2 on a failed check,
  1 on a twenty-minute timeout, and 3 at once when the PR is CONFLICTING
  (no check registers, so CI never started - merge main first). Run it in
  the foreground with the Bash tool's maximum timeout (600000 ms) and run it
  again if the tool times out first; never in the background, for the
  reason the review section gives. Empty output from `gh` is pending.
- Main moved under a branch: `python3 .claude/skills/backlog-loop/merge-main.py`
  from the worktree. It resolves only what it can safely: main's copy of
  the generated artefacts with a rebuild, and a README or licence-statement
  conflict that is only figure spans moving. A conflict in any source file, or in prose, stops it with the file
  named, and a person resolves that one. Then rerun the web tests before
  pushing. Merge PRs one at a time; each merge conflicts the others.
- After the merge: `file.py status <n> Done` for every issue in the group
  (the board's *Item closed*
  workflow does the same when it is switched on; the issue itself is closed
  by `Closes #n`), remove the worktree, delete the branch, `git pull`.

## Stop conditions

Stop and say why when: a change could corrupt data, breach a licence,
weaken a check or workflow, change production infrastructure other than by
merging, or lose history; when a decision is a person's; when the user asks
to pause. Skip and record an ordinary blocker (network, a service, a missing
non-critical credential) on the item - `file.py blocked <n> "<what>"`
labels it so `next.py` passes over it and the comment says why - and leave
the repository clean: no worktree, no open PR, no half-edited file.

**Put every issue's status back before you stop or skip**, the head and each
companion: an item left at *In progress* is one `next.py` never returns as
next, so it leaves the queue until a person moves it by hand. That is the
one way this loop loses work, and grouping multiplied it by the size of the
group.

## The result

The last thing you write is the result the driver reads. Its first line is
exactly one of:

    MERGED #<N> <ID>                          (a group is one PR: VD-33+AX-13)
    SKIPPED <ID>: <reason in one clause>      (the driver passes the id to the next fork's --skip)
    STOP: <reason in one clause>
    LIMIT: resets <time as the limit message gave it>

followed by a stock-take of at most five lines: what merged, what is open,
issues filed, decisions filed, what `next.py` now prints as next. No
reviewer report, no build output, no narrative of the work - the PR, its
comment and the issues hold those. A result that says it is waiting for
anything is not a result: nothing waits for a fork that has returned.
