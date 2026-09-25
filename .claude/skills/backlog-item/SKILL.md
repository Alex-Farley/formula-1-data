---
name: backlog-item
description: One item from the queue (GitHub Issues, ranked on the Lap Ledger project), start to merge, in a forked context - the per-item procedure of /backlog-loop. Arguments are <pace> and <next | ITEM-ID>. Invoked by the backlog-loop skill; a person may also run it directly for one item.
argument-hint: "<fast | balanced | thorough> <next | ITEM-ID>"
context: fork
# Probed 2026-09-16 and it appears to do nothing: a fork runs at the
# session's effort, and `effort: banana` here loads without a warning.
# Kept because deleting it would drop the fork's effort if it is live
# after all, which is the change nobody has evidence for. See D-35.
effort: high
---

# One backlog item

You are the forked context for one item. This file is the **only** normative
copy of the per-item procedure; `CLAUDE.md` and `CONTRIBUTING.md` carry the
repository's rules and point here for the loop's. Read `CLAUDE.md` and
`CONTRIBUTING.md` under *The queue* before touching anything. The reasons
behind the rules here are `docs/DECISIONS.md`, by `[D-nn]`; read an entry
only when you mean to change the rule that cites it.

Scripts are in `.claude/skills/backlog-loop/`.

**Ending your turn is returning.** Your context is discarded the moment you
stop, so nothing you launched and did not wait for — a reviewer, a CI wait —
ever reports back to you. Never end a turn to wait for something.

## Starting

Arguments: a pace (`fast`, `balanced`, `thorough`; default `balanced`) and a
target (`next` or an item id; default `next`), optionally `--skip A,B` for
ids this run has already skipped. If you were not invoked by the
`backlog-loop` driver, by the `backlog-manager` agent that runs its
procedure unattended `[D-42]`, or by a person typing `/backlog-item`, return
`STOP: not invoked by the loop` and do nothing.

First, `bash .claude/skills/backlog-loop/start-check.sh`. It prints the open
pull requests and the worktrees, and **refuses, exit 2, when the primary
checkout is on a branch other than `main` or has uncommitted changes to
tracked files**: a session worked in that checkout directly instead of in a
worktree and may still be, and a fork that starts anyway shares a working
tree with it. Return `STOP` on that refusal — whatever is on somebody else's
branch is theirs to settle, not a fork's to reset. Untracked files are a
warning, not a refusal.

An open `claude/` PR or a leftover worktree does **not** refuse: that is the
inheritance to finish from where it stopped, and **its comments are read
before anything else** — a recorded `FAIL` nobody has fixed is fixed, never
reviewed again on the same head `[D-23]`.

## Before an item

1. `python3 .claude/skills/backlog-loop/next.py --group` prints the first
   open item in the queue's own order — number, title, labels, body, the open
   decisions to work around — and under it the items that could ride with it.
   Use `--group` at every pace. `next.py <ID>` prints one item and
   `next.py <ID> <ID> <ID>` several, which is how a proposed group is read
   before it is taken; `--list <status>` prints one line per open item;
   `--skip A,B` passes over named ids, and an issue labelled `blocked` or
   `decision`, or at *In progress*, is passed over on its own.

   The order is the board's: *Now* before *Next* before *Someday*, top to
   bottom within a status, which is what a person drags. Where a person has
   ranked by hand that is the whole rule. Where nobody has, the tiebreak is
   correctness, then integrity and licensing, functional, security,
   architecture, accessibility, UX, throughput — read `--list` for that
   status, choose, and say in the PR why that item came first.

   **Never page through the issue list or the board.** `next.py` does it for
   a few hundred tokens, which is the point of it. Open an issue only to work
   on it. **A board position is a person's:** a fork's only board writes are
   `file.py status` changes, and it never runs `file.py rank` — that is for
   a person, or a session a person has told what order to put things in —
   nor moves an item to fit a theory of how it got there `[D-42]` `[D-43]`.
2. **Reread the item against the code as it is now.** It may be stale, landed
   under another id, or superseded — if so, `file.py decline <n> "<why>"` and
   move on. **A `**Decided (<date>):**` paragraph in the body is the
   ruling**, and a `**Was to decide:**` under it is history: work the
   option chosen, and do not re-file the question. `file.py decided` writes
   both. Only a body that still says `**To decide:**` and carries no
   `decision` label needs its comments read first — a ruling made before
   that command existed is a comment, and the body was never amended.
   A settled question is worked, not filed again `[D-42]` `[D-43]`.
3. **A fact needs a source before a line of code.** Never invent a value:
   NULL, a `discrepancies` row or a `known_gaps` row.
4. **Anything that is a person's decision** — a licence reading, a scope
   change, a trade the item does not settle — goes on the item with
   `file.py decision <n> "<what must be decided>"`, or is filed with
   `file.py new <prefix> "<title>" --size ? --decision --body "..."`, and the
   work continues around it. Do not take it.

## The pace

**Never slides, at any pace:** a fresh independent review before merge;
`make all`; the precheck; `check (3.9)`, `check (3.12)`, `web` **and `lint`**
green; the licence-reviewer triggers; the stop conditions; an Opus **first
pass** for any change under `data/`, `harvest/`, `build.py`, `verify.py`,
`schema.sql`, the exporters, `web/scripts/prerender.js` or a workflow
`[D-19]`. The confirmation of a fix to one follows the pace table's
*Confirming* row like any other `[D-41]`.

| | `fast` | `balanced` | `thorough` |
|---|---|---|---|
| First-pass reviewer | `frontend-reviewer-quick` (Sonnet, 50 turns) for an S item under `web/` not touching `scripts/prerender.js` — in a group the largest item decides; the Opus reviewer for the area otherwise | the Opus reviewer for the area | the Opus reviewer for the area |
| Routes named for the reviewer to spot-check | 3 | 10, chosen for edge cases: a NULL, a tie, a shared drive, a season not yet run | every route the change touches |
| Confirming a fix that must land before merge | fresh Sonnet | fresh Sonnet | fresh Opus |
| Items per PR | the head and every item linked to it, at any size `[D-20]` | the same | the same |
| Pipelining | none — the review and the CI wait are foreground, so a fork holds one item at a time | none | none |

Reviewer effort and turn caps are frontmatter in `.claude/agents/`. The caps
are runaway stops, not budgets: a reviewer that hits one returns without
recording a verdict, and that is not a PASS. It gets the one respawn *Review*
gives any pass that recorded no verdict, and no more.

## Grouping

A reviewer pays a fixed cost on every pull request — the rules, the
surroundings of the diff, the build — before it reads a line of the change.
Two items that touch the same file pay it twice for nothing. `next.py
--group` is how a group is found.

**The head is the queue's next item, always.** Grouping decides what rides
with it, never which item comes first.

**What a companion must earn:** it is cheaper *because* it rides with the
head — the same file, query, component or test, so one reading of the
surrounding code serves both. A shared `source:` label or subject is not a
theme. If you cannot write the one sentence saying why these are one change,
they are not one change, and that sentence goes in the pull request.

- **How many is whatever is linked to the head**, at any size and at every
  pace `[D-20]`. The bound is the diff, not a number.
- **Size is a cost to weigh, not a gate.** An `M` companion is worth having.
  An `L` is the one to look at twice: `CONTRIBUTING.md` sizes it as needing a
  plan first, and if that plan is not the head's it is a head of its own. A
  `?` is sized by the reread — if it is an `L` in disguise, treat it as one
  and label it on the way past. **The rungs of one M item are still one PR**
  `[D-21]`.
- `--group`'s score is a hint: it reads titles and bodies, not code. Read the
  full bodies before taking any.
- **A companion from the status below the head** is being promoted past
  everything between. Say in the pull request why.
- **Two items that are the same defect** — one PR closes both and says they
  were one finding. That is a good outcome.
- **Drop, never grow.** If the diff stops reading as one change, drop the
  last companion added and **put its status back**. A group is an economy,
  not a target.
- A companion that does not survive the reread is declined like any other
  item; one that turns into a blocker is dropped and recorded on its own
  issue, status back, and the head carries on. Only the head being blocked is
  a `SKIPPED`.

**Every issue set to *In progress* leaves it by exactly one of four routes**,
and a group accounts for each of its own: merged (`Done`), blocked (status
back), stopped or skipped (status back), or dropped from the group (status
back). An issue left at *In progress* is one `next.py` never returns, so it
is out of the queue until a person moves it by hand.

There are two exceptions, and both leave the group *at* *In progress* on
purpose. A usage limit: a `LIMIT:` return leaves it there because the next
fork picks the work up from the open PR and needs to see it is taken. And
**the secondary rate limiter refusing the board**: there the status cannot be
put back, because putting it back *is* a board write and the board is what is
being refused. Say so in the `STOP:` line, so a person reading it knows the
item is claimed and why nothing moved it.

Until a PR exists the only record of the group is the board — the branch is
named for the head alone — so a fork inheriting a worktree reads `next.py`'s
*In progress elsewhere* footer first, and `start-check.sh` prints the open
PRs and worktrees before that.

Every issue in the group gets `file.py status <n> "In progress"` when the
worktree opens and a `Closes #<n>` line of its own in the PR body. The branch
is named for the head (`claude/vd-33-photographs`); progress lines and the
result line name the group (`VD-33+AX-13`). The PR body has a short section
per item.

## Progress lines

    bash .claude/skills/backlog-loop/progress.sh <ITEM-ID> "<stage>"

appends one line to `.claude/loop/progress.log`. It is the only view of you a
person has, and a fork that looks stalled gets killed `[D-17]`. Write one — a
few words, never a report — at each of: item chosen; group formed (ids, or
none); worktree open; `make all` green; web tests green; PR opened; reviewer
launched (agent, model); verdict; fix pushed; confirmation launched; CI wait
entered; CI green; merged; and any skip or stop with its reason. Before the
item is known, use the target you were given as the id. It exits 1 if the
line could not be written; say so in the stock-take and carry on.

## Doing the item

- **Worktree:** `git worktree add -b claude/<slug> <scratchpad>/wt-<slug>
  origin/main`. For web work, `npm ci` inside it — never symlink
  `node_modules`. Node is whatever is on `PATH`; `which node` gives the path
  if you need it. It is not in the same place on every machine — a container,
  nvm and Homebrew each put it somewhere different `[D-30]`.
- **Edit through a Python script whose every replacement asserts it matched
  exactly once.** Never write a shell-quoting sequence inside a quoted
  heredoc; apostrophes in JS strings go in double-quoted strings.
- **Gate each step on the previous one's exit status**, never on the output
  of a `| grep`.
- **Order:** `make all QUIET=1` → `make lint` → `cd web && npm run build &&
  npm test -- --quiet` (one smoke run at a time; kill any listener on 4179
  first and check the log does not say "Reusing the server") → `git add -A &&
  make ci QUIET=1` → commit → push → `gh pr create`. Commit and PR text end
  with the attribution lines the session was given.
- **Quiet forms, always** `[D-25]`. While iterating on one page, `npm run
  test:page -- /drivers` runs only the smoke sections whose heading names it
  (`node test/smoke.mjs --list` shows them), then the full `npm test
  -- --quiet` before the commit — a passing subset is not a passing site.
- **The issue:** `file.py status <n> "In progress"` for every issue in the
  group when the worktree opens; `Closes #<n>` on its own line for each in
  the PR body, which is the record of what was done and what was left.
  Anything discovered is filed as its own issue — `file.py new <prefix>
  "<title>" --size <S|M|L|?> --body "..."` — never left in a note, a PR
  comment or a TODO.

## Before asking for review

`bash .claude/skills/backlog-loop/precheck.sh <ITEM-ID> [<ITEM-ID>...]` from
the worktree root, naming every id in the group. It refuses conflict markers,
scripts that do not parse, duplicated imports and a PR body that does not
close every item's issue, and warns about an artefact that moved without a
source change. Half the FAIL rounds it was written for were one of these, and
it costs a few hundred tokens against a reviewer's tens of thousands `[D-24]`.

The reviewer checklists' mechanical items are **tests now, not review**:
`tests/test_conventions.py` in `make ci` and `web/test/conventions.mjs` in
`npm test` `[D-26]`. Each agent's file names what it no longer reads for. Do
not ask a reviewer to confirm one of these; the brief stays on judgement.

## Review

One fresh agent from `.claude/agents/`, pointed at the worktree path, briefed
with `.claude/skills/backlog-loop/review-prompt.md`. **Launch it with
`run_in_background: false` and wait for it** — the Agent tool backgrounds by
default, and a fork that backgrounds a reviewer and ends its turn has
returned. Two reviewers on one PR are launched in one message, both
foreground.

Which one:

- `frontend-reviewer` for anything under `web/`. At `fast`,
  `frontend-reviewer-quick` where the pace table allows it.
- `data-integrity-reviewer` for `build.py`, `verify.py`, `schema.sql`,
  `data/`, `harvest/`, `tools/`, `export_json.py`, `tests/` and the loop's
  own scripts and skills.
- `licence-reviewer` **only** when a change adds or reclassifies a source,
  touches a workflow, an export or a publishing path, or takes a whole
  dataset from one source. The build already refuses an unclassified source
  and `verify.py` fails on a forbidden one, which is why an ordinary data
  change does not also need it. **Two reviewers are the exception, not the
  rule.**

**Never launch a critic on a pull request** `[D-31]`. The nine critics in
`.claude/agents/` — accessibility, interaction, visual, content, information
architecture, data architecture, service, product, and the user-research
simulator — assess the whole project from outside and exist to *find things*,
which is what refills the queue. On a diff they turn design opinions into
fix-and-confirm rounds against a change that was already sound. They run
deliberately against `main`, and what they find is filed as issues. The
merge path has exactly the four agents named above and no others.

Model: **Opus for a first pass**, front-end and data alike, except where the
pace table names the quick variant. **A confirmation of a fix is the
model the pace table's *Confirming* row names** `[D-41]`; **Sonnet, fresh,
for reviewing a docs-only or wording-only change** — a fresh Sonnet context
satisfies the independent-review rule. A substantive rewrite after a FAIL
gets a new fresh Opus agent, not a confirmation.

The brief stays inside the diff: name the specific ways the change could be
wrong; name the routes the pace allows and no more; ask for one isolated
rebuild only when an artefact changed; never ask for site-wide enumerations
or live fetches unless the item is about them. Ask for the findings with
file:line, nothing else.

**The verdict is recorded by a command, never read from the reply** `[D-40]`.
Before each pass — first pass, confirmation or respawn — open it with
`bash .claude/skills/backlog-loop/verdict.sh new <PR> <sha>` (add `quick` for
`frontend-reviewer-quick`), which prints a pass id, and put that id in the
brief. The reviewer runs `verdict.sh record <id> PASS` or `FAIL` from the
worktree; the script accepts nothing else, refuses a second verdict and
refuses a checkout at another head, and for a quick pass refuses a verdict
without the applied items. When the agent returns, run `verdict.sh read <id>`:
its printed word and exit status are the verdict, and **nothing in the reply
is read for one** — not a PASS in its first line, not a FAIL in its last. The
reply is read for findings only, in whatever layout it arrives. Both
directions of disagreement settle on the command: a reply that sounds like a
PASS over a recorded FAIL is a FAIL, and a reply of any kind over a pass that
recorded nothing is no review. **Only the reviewer runs `record`.** A fork
that records a verdict on a reviewer's behalf — because the reply plainly
said PASS — has read the reply for a verdict by another route.

**One respawn when a pass records no verdict**, whatever the reason — it ran
out of turns, forgot the command, or the command refused it. Open a new pass
id and send the **same brief** to a fresh agent of the same kind with only the
id changed; everything else goes across, so the pass that settles the item is
briefed no more thinly than the one it replaces. The respawn's findings are
read like any pass's. If it records nothing either, the item has no review and
the *Not a PASS* rule below applies. Interpreting a reply instead is how the
rule rots: the fork that reads a verdict out of prose today is the fork that
reads past a FAIL phrased as a sentence tomorrow `[D-37]`. Then:

- **FAIL:** fix, run the precheck again, confirm with a fresh agent by commit
  range, on the model the pace table's *Confirming* row names — whatever the
  change touches `[D-41]`.
- **FAIL against one item of a group:** fix it if the fix is small. If not,
  drop that item from the PR — its commits, its `Closes` line, its section,
  **and its *In progress* status**, which nothing else on this path puts
  back. Then confirm the smaller change. A group never holds the rest of
  itself hostage to its worst member.
- **PASS with findings:** fix what belongs to this diff, then merge — all of
  them in one batch with **one** confirmation `[D-22]`. A finding is fixed on
  the PR that found it when it is in a file this PR already changes and the
  diff still reads as one change. Carry one only when it needs a decision
  this item does not settle, touches code this PR does not, or would make the
  diff unreadable — then name it in the PR comment and file it. A fix that is
  only documentation wording, a blank line, a comment, a test or the removal
  of dead code needs **no further pass at all**.
- **A review finding is not discovered work, and only one of them is an
  issue** `[D-15]`. A defect in the diff under review is fixed, not filed.
- **Not a PASS**, and no respawn is owed: a rate limit or an unavailable
  account. Retrying a limit extends it `[D-27]`.
- **Not a PASS after its one respawn**, and one respawn is the whole of it:
  a pass for which `verdict.sh read` exits 1 — silence, a reviewer that hit
  its turn cap, one that never ran the command, or one whose command was
  refused. The second pass settles the item, whichever of those the first
  was.
  If the agent dies on a session limit, return `LIMIT: resets <time>` at
  once; you cannot outlive the reset.
- **Record the verdict as a PR comment the moment it arrives**, before the
  fix or anything else — reviewer and model, verdict, blocking findings one
  line each `[D-23]`.

Then `gh pr merge N --merge`, only with the PASS and `check (3.9)`,
`check (3.12)` and `web` green. **Merging deploys lapledger.org.** In auto
mode the merge is refused as *Merge Without Review* until a verdict is a
comment on the PR, which `[D-23]` already puts there; a refusal means the
record is missing, and the answer is to record it, never to route around it.
Never add the `ci-review` label or re-enable `review.yml`: the loop's own
review is the control, and the CI review is the maintainer's to turn back on
`[D-42]`.

## Keeping the cost down

- **One PR open at a time.** Several open PRs each merge-conflict the others,
  which costs a re-merge, a rebuild, a CI run and a confirmation every time.
- **Group items that share a file**, whatever their size.
- **Do not ask a reviewer to prove what the suite proves.** `smoke.mjs`
  compares every static table on the routes it visits with the app's — header,
  row count and every shown row. Name the routes in the brief and ask for the
  SQL, the rendering and the cases the suite cannot reach.
- **GitHub is a budget too.** `next.py` reads the board and every open issue
  on each run — a ProjectsV2 query is the expensive kind. The scripts cache
  what is safe to cache, so `--group` followed by `next.py <head>
  <companion>` costs one board read and not two; calling `next.py` to browse
  costs one each time, so do not.
- **A rate limit is an ordinary blocker, and retrying extends it** `[D-27]`.
  A `gh` failure naming a limit while `gh api rate_limit` looks untouched is
  the secondary limiter. Record it, stop calling, come back. `precheck.sh`
  tells it from a real "not an open issue" FAIL, which you can trust.
- **The limiter refusing the board read is a `STOP`, not a skip.** `next.py`
  exits **3** on it and names it, distinctly from the 2 that means `gh`
  failed for some other reason. Recording a blocker is itself a board write,
  so the skip path needs the call that is being refused; and no fork can
  choose an item while the board is unreadable. Do not poll it — a poll every
  45 seconds keeps it closed `[D-27]`. Return `STOP` and let the run be
  picked up later.
- **Keep your own messages short.** Do not paste reviewer reports into your
  context twice; the PR comment is the record. Read build and test output in
  its quiet form and never `cat` a log you have already checked the exit
  status of.

## Waiting and merging

- **CI:** `bash .claude/skills/backlog-loop/ci-wait.sh <PR>` exits 0 on pass,
  2 on a failed check, 1 on a twenty-minute timeout, 3 at once when the PR is
  CONFLICTING (no check registers, so CI never started — merge main first),
  and 4 at once when `gh` itself cannot answer — absent, unauthenticated, or
  too old for `pr checks --json`. **A 4 is never a defect in the diff:** fix
  the environment, do not go looking through the change. Run it in the
  foreground with the Bash tool's maximum timeout
  (600000 ms) and run it again if the tool times out first. Empty output from
  `gh` is pending.
- **Main moved under the branch:** `python3
  .claude/skills/backlog-loop/merge-main.py` from the worktree. It resolves
  only what it can safely — the generated artefacts with a rebuild, and a
  README or licence-statement conflict that is only figure spans moving. A
  conflict in a source file or in prose stops it with the file named, for a
  person. Rerun the web tests before pushing. Merge PRs one at a time.
- **After the merge:** `file.py status <n> Done` for every issue in the
  group, remove the worktree, delete the branch, `git pull`.

## Stop conditions

Stop and say why when a change could corrupt data, breach a licence, weaken a
check or workflow, change production infrastructure other than by merging, or
lose history; when a decision is a person's; when the user asks to pause.

Stop, too, when `start-check.sh` refuses the primary checkout, and when
`next.py` exits 3 because the secondary limiter is refusing the board: both
are conditions no fork can work around, and the second cannot even be
recorded.

Skip and record an ordinary blocker — network, a service, a missing
non-critical credential — with `file.py blocked <n> "<what>"`, and leave the
repository clean: no worktree, no open PR, no half-edited file.

**Put every issue's status back before you stop or skip**, the head and each
companion — except on the two returns that declare otherwise above, a
`LIMIT:` and the limiter refusing the board, where the call that would put it
back is the call being refused. An item left at *In progress* for any other
reason is one `next.py` never returns, and that is the one way this loop
loses work.

## The result

The last thing you write. Its first line is exactly one of:

    MERGED #<N> <ID>                          (a group is one PR: VD-33+AX-13)
    SKIPPED <ID>: <reason in one clause>
    STOP: <reason in one clause>
    LIMIT: resets <time as the limit message gave it>

then a stock-take of at most five lines: what merged, what is open, issues
filed, decisions filed, what `next.py` now prints as next. No reviewer
report, no build output, no narrative — the PR, its comment and the issues
hold those. A result that says it is waiting for anything is not a result.
