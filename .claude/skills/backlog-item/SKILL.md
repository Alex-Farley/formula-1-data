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
ids this run has already skipped, and optionally `--max-size S`, which the
driver adds when its usage check leaves room only for a small item `[D-55]`. If you were not invoked by the
`backlog-loop` driver, by the `backlog-manager` agent that runs its
procedure unattended `[D-42]`, or by a person typing `/backlog-item`, return
`STOP: not invoked by the loop` and do nothing. The one other caller is
`fix-refresh.yml`, which follows *Unattended: the refresh fixer* below
instead of this section `[D-57]`.

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
   `decision`, at *In progress*, or blocked by an open issue (`[waits]`) is
   passed over on its own.

   The order is the board's: *Now* before *Next* before *Someday*, top to
   bottom within a status, which is what a person drags. Where a person has
   ranked by hand that is the whole rule. Where nobody has, the tiebreak is
   correctness, then integrity and licensing, functional, security,
   architecture, accessibility, UX, throughput — read `--list` for that
   status, choose, and say in the PR why that item came first.

   Given `--max-size S`, pass it to every `next.py` call that chooses —
   `--group` above all — which then passes over anything larger, and an
   unsized `?`, as head, companion or tidy item alike. When `next.py` exits
   1 under it, nothing in the queue is small enough: return
   `PAUSE: no open item at or under size S`, with nothing claimed. An open
   PR or worktree inherited from an earlier fork is finished whatever its
   size; the cap governs what is started, not what is already half-done.

   **Never page through the issue list or the board.** `next.py` does it for
   a few hundred tokens, which is the point of it. Open an issue only to work
   on it. **A board position is a person's:** a fork's only board writes are
   `file.py status` changes and what `file.py new` and `file.py flake` set
   when they file or record, and it never runs `file.py rank` — that is for
   a person, or a session a person has told what order to put things in —
   nor moves an item to fit a theory of how it got there `[D-42]` `[D-43]`.
2. **Reread the item against the code as it is now.** It may be stale, landed
   under another id, or superseded — if so, `file.py decline <n> "<why>"` and
   move on. **A `**Decided (<date>):**` paragraph in the body is the
   ruling**, and a `**Was to decide:**` under it is history: work the
   option chosen, and do not re-file the question. `file.py decided` writes
   both. Only a body with a line still opening `To decide:` and no
   `decision` label needs its comments read first — a ruling made before
   that command existed is a comment, and the body was never amended.
   A settled question is worked, not filed again `[D-42]` `[D-43]`.
3. **A fact needs a source before a line of code.** Never invent a value:
   NULL, a `discrepancies` row or a `known_gaps` row.
4. **Anything that is a person's decision** — a licence reading, a scope
   change, a trade the item does not settle — goes on the item with
   `file.py decision <n> "<what must be decided>"`, or is filed with
   `file.py new <prefix> "<title>" --size ? --decision --body "..."`, and the
   work continues around it. Do not take it. When the decision is the item's
   only way forward — nothing of it can land until a person answers — the
   item is **held**, not stopped: *Stop conditions* says how `[D-52]`.

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
| First-pass reviewer | `frontend-reviewer-quick` (Sonnet, 50 turns) for an S or XS item, or a tidy batch, under `web/` not touching `scripts/prerender.js` — in a group the largest item decides; the Opus reviewer for the area otherwise | the Opus reviewer for the area | the Opus reviewer for the area |
| Routes named for the reviewer to spot-check | 3 | 10, chosen for edge cases: a NULL, a tie, a shared drive, a season not yet run | every route the change touches |
| Confirming a fix that must land before merge | fresh Sonnet | fresh Sonnet | fresh Opus |
| Items per PR | the head and every item linked to it, at any size `[D-20]`; or, for an `XS` head, a tidy batch of up to five `XS` items `[D-54]` | the same | the same |
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

**The tidy lane** `[D-54]` is the one place unrelated items share a pull
request. When the head is labelled `size: XS` — about thirty changed lines
or fewer: a wording fix, a comment, one data row, one declared exception —
up to four more `XS` items from the head's status or the one below ride with
it in a *tidy batch*, five at most, linked to it or not. `next.py --group`
lists them under the head's companions, in queue order. The rest of this
section still applies to a batch except the one-change test, which a batch
replaces with this:

- **Every gate is unchanged.** One review pass for the batch, by the
  reviewer *Review* and the pace table name for what the whole diff touches:
  the Opus first pass where any item is in an area that needs one, a fresh
  Sonnet where the whole batch is docs or wording, `frontend-reviewer-quick`
  at `fast` where every item is under `web/` and none touches
  `scripts/prerender.js`. A batch that spans `web/` and `data/` gets both
  areas' reviewers, launched in one message. The licence and security
  triggers are read against the whole diff, the precheck names every id, and
  all four checks are green before the merge.
- **The diff reads as a list of separate small changes**, one section per
  item in the PR body, each with its own `Closes` line. It does not have to
  read as one change; it does have to read item by item.
- **An item that grows past the limit leaves the batch**, status back, and
  is relabelled with its real size on the way past. So does one that turns
  out to need a decision or a source the batch cannot wait for. The batch
  never waits for its slowest member.
- **A linked `XS` item is simply a member of the batch.** A linked
  companion larger than `XS` still rides with an `XS` head under `[D-20]`,
  and then the PR is a group and not a tidy batch, because a batch is only
  `XS` items: take the group, and leave the unlinked `XS` items in the queue.

**Every issue set to *In progress* leaves it by exactly one of five routes**,
and a group accounts for each of its own: merged (`Done`, or *Now* for an
alarm, which is still open — *After the merge* says why), blocked (status
back), held on a decision (status back), stopped or skipped (status back), or
dropped from the group (status back). An issue left at *In progress* is one `next.py` never returns, so it
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
  npm run test:units && npm run test:page -- <route> [--only <route>...]`
  for the pages the change reaches — `--only` again before each further
  route, because each one reads only the word after it (one smoke run at a time; kill any listener on
  4179 first and check the log does not say "Reusing the server") → `git add
  -A && make ci QUIET=1` → commit → push → `gh pr create`. Commit and PR text end
  with the attribution lines the session was given.
- **Web work follows the design system** `[D-53]`. An item under `web/`
  reads the sections of `docs/design-system.md` that its components and
  tokens fall under before building, holds itself to those marked built, and
  extends the system in the same PR, under its §8, where it needs what the
  system lacks.
- **Quiet forms, always** `[D-25]`. `npm run test:page -- /drivers` runs
  only the smoke sections whose heading names it (`node test/smoke.mjs
  --list` shows them).
- **The pages a change reaches are what it tests locally; CI tests the
  site** `[D-54]`. Before the push, run the smoke sections of the pages the
  change can reach — the routes it edits, and for a change that moves
  `f1.db`, the pages that show what moved. Run the full `npm test -- --quiet`
  locally only when the change touches `web/scripts/prerender.js`, a shared
  component or library (`web/src/components/`, `web/src/lib/`), the styles
  (`web/src/styles/`, any `.css`), or anything else every page passes
  through — `web/src/App.jsx`, `web/src/main.jsx`, `web/src/data/`,
  `web/scripts/prepare-assets.js`, `web/vite.config.js`, `web/index.html` —
  or when the pages it reaches cannot be named. A change that reaches no page — the loop's own scripts, docs,
  `tests/` — runs `npm run test:units` alone. CI's `web` job always runs the
  whole suite, and it is still one of the four checks that never slide.
- **The issue:** `file.py status <n> "In progress"` for every issue in the
  group when the worktree opens; `Closes #<n>` on its own line for each in
  the PR body, which is the record of what was done and what was left.
  **Except an alarm** — an issue labelled `refresh-failing` or
  `results-late`, which refresh.yml opens as an item and closes itself on
  the first run that proves the fix: the PR says `Refs #<n>`, never a
  closing keyword, and its body says how to work it `AF-89`.
  Anything discovered is filed as its own issue — `file.py new <prefix>
  "<title>" --size <XS|S|M|L|?> --body "..."` — never left in a note, a PR
  comment or a TODO.

## Before asking for review

**First, read your own diff once against what first passes fail on most**
`AF-104`. It is a self-check, not a review: the fresh independent review
still runs on every PR, and nothing here is recorded as a verdict. Each
question is a class that failed more than one first pass, with PRs where it
did; each answered here is a fix, a push, a CI run and a confirmation not
spent.
The list is re-derived now and then from the verdicts `[D-23]` puts on each
PR as a comment, kept to ten, and a class leaves it when a test or the
precheck comes to cover it — as a lowered `verify.py` floor (#935) did.

1. **Does any sentence I wrote state more than its source, or the code,
   says?** An "every", a "never", a cause, a date, an article read for what
   it does not say. #912, #915, #681, #689.
2. **Does every comment, docstring, doc line and PR-body claim about what I
   changed still hold** — the ones I did not touch included? Search for the
   old wording and the fact. #905, #829, #754, #899, #769, #836.
3. **Can each check and test I added fail?** One that reuses the predicate
   it checks, reads the wrong element, asserts the exit but not the effect,
   or passes on an empty set guards nothing. #735, #730, #815, #813, #783.
4. **Can a figure I show or store be NULL, and does it then read as not
   established** — an em dash, "none recorded" — not 0 or "did not happen"?
   A `COALESCE`, a `?? 0` and `IN (NULL)` included. #779, #831, #932, #737.
5. **Where I cut, rank or take the first row, what does a tie do?** #825,
   #932.
6. **Does the static page say, and order, what the app does**, so nothing
   moves or vanishes at the handover? #808, #821, #832, #906.
7. **Does it hold at 320 to 400 px** — a clipped label, a box out of its
   figure, an offset right only on a desktop? #948, #817, #828, #875.
8. **Have I read every ruling on the item and on each item it names** — a
   `Decided` paragraph, the maintainer's comments — and done what it says?
   #686, #769.
9. **Is every figure in my prose one the database or its own sums bear
   out**, and a `{{fig:name}}` where it counts this database's rows
   `[D-39]`? #932, #682.
10. **Does it keep the build's other promises** — ids that are not
    renumbered, `F1_LOCAL_TIMING=1` warning where the rule says warn, a test
    that does not depend on the committed `f1.db` or on where it runs?
    #937, #739, #805.

Then `bash .claude/skills/backlog-loop/precheck.sh <ITEM-ID> [<ITEM-ID>...]`
from the worktree root, naming every id in the group; an item with no id,
which `next.py` names `#<n>`, is given as `#<n>` `CR-75`. It refuses conflict
markers, scripts that do not parse, duplicated imports, a PR body that does
not close every item's issue, and a `verify.py` floor lowered or removed
without a PR-body line naming it, its change and its ruling — `Floor lowered:
article_images.race_id 3916 -> 3910, ruled on #838` `AF-103` — and warns
about an artefact that moved without a source change. Half the FAIL rounds
it was written for were one of these, and it costs a few hundred tokens
against a reviewer's tens of thousands `[D-24]`.

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
  change does not also need it.
- `security-reviewer` **only** when a change touches `.github/workflows/`,
  `web/package.json`, `web/package-lock.json`, `requirements.txt`,
  `wrangler.jsonc`, `web/scripts/prepare-assets.js`, `web/src/data/`,
  `web/src/lib/sql.js`, the `Makefile` or `.claude/settings*.json`, or its
  diff adds an HTML sink (`innerHTML`, `dangerouslySetInnerHTML`,
  `insertAdjacentHTML`, `document.write`) or network, subprocess or
  environment access to `build.py`, `verify.py`, `data/` or `harvest/`
  (`git diff origin/main...HEAD | grep` settles it). A change to data values,
  harvest rows or docs alone never needs it `[D-49]`.

**Two reviewers are the exception, not the rule.**

**Never launch a critic on a pull request** `[D-31]`. The nine critics in
`.claude/agents/` — accessibility, interaction, visual, content, information
architecture, data architecture, service, product, and the user-research
simulator — assess the whole project from outside and exist to *find things*,
which is what refills the queue. On a diff they turn design opinions into
fix-and-confirm rounds against a change that was already sound. They run
deliberately against `main`, and what they find is filed as issues. The
merge path has exactly the five agents named above and no others.

Model: **Opus for a first pass**, front-end and data alike, except where the
pace table names the quick variant. **A confirmation of a fix is the
model the pace table's *Confirming* row names** `[D-41]`; **Sonnet, fresh,
for reviewing a docs-only or wording-only change** — a fresh Sonnet context
satisfies the independent-review rule. A substantive rewrite after a FAIL
gets a new fresh Opus agent, not a confirmation.

The brief stays inside the diff: name the specific ways the change could be
wrong; name the routes the pace allows and no more; for a front-end
reviewer, name the components and tokens the diff touches and the sections
of `docs/design-system.md` they fall under; ask for one isolated
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

Then the merge, only with the PASS and `check (3.9)`, `check (3.12)`, `web`
**and `lint`** green — the four *Never slides* names. It is three commands,
each gated on the one before:

    python3 .claude/skills/backlog-loop/merge-step.py before N
    gh pr merge N --merge
    python3 .claude/skills/backlog-loop/merge-step.py after N

`before` lets an open refresh PR merge first — fresh data outranks any loop
item — waiting up to nine minutes a call, exit 5 to call it again; a refresh
not merged an hour after its last push is stuck, and is not waited on
`AF-105`. It exits 3 when main has moved under the branch, a refresh having
merged included: that is *Main moved under the branch* below, then CI again,
then `before` again. **A refused `gh pr merge` is not a merge**, and the
answer to one is never the post-merge steps: `after` reads the PR's state
back from GitHub and does nothing unless it is `MERGED` `AF-99`. Never delete
a PR's remote branch by hand — the repository deletes it on merge, and a
hand deletion closes the PR unmerged. **Merging deploys lapledger.org.** In auto
mode the merge is refused as *Merge Without Review* until a verdict is a
comment on the PR, which `[D-23]` already puts there; a refusal means the
record is missing, and the answer is to record it, never to route around it.
There is no CI review to ask for: `review.yml` was removed, and the review
above is the only one `[D-44]`.

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
- **A 2 on a check the diff cannot reach is rerun once, and recorded first**
  `AF-106`: `file.py flake "<the failing test's line, as the job printed
  it>" <the failed run's URL>`, then `gh run rerun <run-id> --failed`, then
  `ci-wait.sh` again. The record names the test that failed — a smoke
  check's `FAIL [Section] message` line, a unit test's name — never the job
  (`web`, `check (3.12)`) it failed in. `CONTRIBUTING.md` under *The queue*
  says what the record does. A check the diff can reach is not a flake but a
  finding, and a second failure on the rerun is read as one too.
- **A slow build is waited on the same way**, in the foreground. A tool call
  past 600 s does not trip the `no progress for 600s` watchdog, which watches
  the model's response stream, not your tools: every kill so far came after a
  tool had returned, and 81 foreground calls past 600 s did not cause one
  `[D-50]`. A command the Bash tool moves to the background at its timeout is
  waited on with a foreground loop on its output file, never by ending the
  turn.
- **Main moved under the branch:** `python3
  .claude/skills/backlog-loop/merge-main.py` from the worktree. It resolves
  only what it can safely — the generated artefacts with a rebuild, and a
  README or licence-statement conflict that is only figure spans moving. A
  conflict in a source file or in prose stops it with the file named, for a
  person. Rerun the web tests before pushing. Merge PRs one at a time.
- **After the merge:** `merge-step.py after <PR>`, and only once `gh pr
  merge` has returned. It refuses, exit 1, unless the PR reads `MERGED`;
  then it sets every issue the body closes to *Done*, removes the worktree
  and the local branch, and pulls `main` in the primary checkout. An alarm
  is still open, so it is not *Done*: for a `Refs #<n>` naming an open
  alarm it puts the status back to *Now*, where it waits to be closed by the
  run that proves the fix or taken again from a later failing one, and
  starts that run with `gh workflow run refresh.yml`. Exit 2 names a step
  that failed after the merge; run it again, which repeats nothing but a
  refresh run, and that only queues behind the first.

## Stop conditions, and holding instead

**Stop on a decision only when it cannot be held.** Where rule 4 and this
section seem to pull apart, that sentence settles it `[D-52]`.

**Hold** the item when the only thing in its way is a person's call: a
licence reading, a scope change, a trade the item does not settle, a change
that would weaken a check or a workflow if it were made, or the permission
classifier refusing an edit — on a licence record or a control, say. A hold
is five steps, in this order:

1. **The change does not happen.** Nothing routes around a refusal: not the
   same edit reworded, split, made with another tool or through another
   file. The question waits on the issue, and a person answers it.
2. `file.py decision <n> "<what must be decided, and what the item does
   under each answer>"`.
3. **Its dependants wait for it.** The candidates are the items `--group`
   printed as naming the head or named by it, and — because `--group` looks
   only at the head's status and the one below, and leaves out a `blocked`
   item — any line of `next.py --list Now`, `Next` and `Someday` whose
   title names the head. Read their bodies with `next.py <ID>...`; each that
   says it builds on the head's outcome gets `file.py blocked-by <n>
   [<n>...] --on <head>`. `next.py` passes over an item blocked by an open
   one, and the block lifts on its own when the head closes. An item that
   only mentions the head does not wait.
4. **The repository is left clean, and nothing is lost:** no worktree, no
   open PR, no half-edited file. Commits worth keeping are pushed to their
   branch and the branch is named in a comment on the issue; an open PR is
   closed with a comment saying why, never merged.
5. Status back, for the head and each companion. Return
   `DECIDE <ID>: <the question in one clause>`.

A companion that needs a decision is dropped from the group and held on its
own issue by steps 1 to 3, status back, and the head carries on. Only the
head being held is a `DECIDE`.

**Stop**, and say why, when the danger is one a hold cannot leave behind:
something already done — merged, on `main`, written to a published artefact
— that could corrupt data, breach a licence, weaken a check or lose history;
a change to production infrastructure other than by merging; a state that
cannot be left clean, such as a conflict in a source file or in prose that
`merge-main.py` hands to a person; a hold whose own record could not be
written, because a question that exists only in this context is lost with
it; and when the user asks to pause.

Stop, too, when `start-check.sh` refuses the primary checkout, and when
`next.py` exits 3 because the secondary limiter is refusing the board: both
are conditions no fork can work around, and the second cannot even be
recorded.

Skip and record an ordinary blocker — network, a service, a missing
non-critical credential — with `file.py blocked <n> "<what>"`, and leave the
repository clean: no worktree, no open PR, no half-edited file.

**Put every issue's status back before you stop, skip or hold**, the head and each
companion — except on the two returns that declare otherwise above, a
`LIMIT:` and the limiter refusing the board, where the call that would put it
back is the call being refused. An item left at *In progress* for any other
reason is one `next.py` never returns, and that is the one way this loop
loses work.

## The result

The last thing you write. Its first line is exactly one of:

    MERGED #<N> <ID>                          (a group is one PR: VD-33+AX-13)
    SKIPPED <ID>: <reason in one clause>
    PAUSE: no open item at or under size <S>  (only under --max-size)
    DECIDE <ID>: <the question in one clause>
    STOP: <reason in one clause>
    LIMIT: resets <time as the limit message gave it>

then a stock-take of at most five lines: what merged, what is open, issues
filed, decisions filed, what `next.py` now prints as next. No reviewer
report, no build output, no narrative — the PR, its comment and the issues
hold those. A result that says it is waiting for anything is not a result.

## Unattended: the refresh fixer

`.github/workflows/fix-refresh.yml` runs this procedure headless on one open
`refresh-failing` alarm, the item its prompt names `[D-57]`. Where this
section and the rest of the file differ, this section wins; the rest holds
as written - a fact needs a source, the self-check under *Before asking for
review*, never weaken a control. There is no *Starting*, no *Before an
item* step 1, no grouping, no pace and no result line: the item is given.

**What the job does for you, and so what you never do.** Your job holds a
GitHub token that only reads. So: no `file.py`, no board, no
`progress.sh`, no worktree - the checkout is yours - and no commit, push or
`gh` write. Edit the tree and leave it uncommitted. You launch no reviewer.
Once you finish, the workflow puts the harvest back, rebuilds, checks what
you changed with `.github/scripts/fix_refresh.py`, opens the pull request
with `Refs #<n>`, has a fresh `data-integrity-reviewer` review it in a job
you never see, comments the verdict and, on a PASS, turns on auto-merge,
which waits for the four required checks. Do not run npm: nothing is
installed for it, and CI's `web` and `lint` jobs gate the merge.

**What an unattended fix may change** - what a refresh failure warrants,
and nothing that is a check's logic, a workflow's control or the licence
classification. `fix_refresh.py` refuses the rest:

- `verify.py`: its comments, and the literal values of its `*_EXCEPTIONS`
  sets, which only grow. A declared exception is a set member with its
  source in the comment above it, as AF-88's was.
- `data/*.py` other than `data/harvest.py`; `data/current.py` anywhere but
  `SOURCE_LICENCE`. A `discrepancies` or `known_gaps` row is here.
- `tools/f1db_fetch.py` and `tools/f1db_totals_fetch.py`, for a fetch fault.
- `tests/test_*.py` for a test fault, except the tests that guard a control:
  the conventions, the refresh's job boundary, the fixer's own, the loop's
  and `verify.py`'s refusals.
- The rebuilt artefacts and the README's figure spans, which the workflow
  regenerates.

No new file. A fix that needs anything else is held.

**The order.**

1. Read the alarm, `gh issue view <n>`, and the run it names, `gh run view
   <id> --log-failed`. A refresh pull request CI refused fails in `ci.yml`'s
   run on `refresh/f1db`, not in `refresh.yml`.
2. Reproduce it: `python3 tools/f1db_fetch.py && python3
   tools/f1db_totals_fetch.py`, then `make all QUIET=1`, which fails as the
   run did. Keep scratch files in `$RUNNER_TEMP`, never in the checkout.
3. Find the source before the line of code: rule 3 of *Before an item*.
4. Fix, within the list above.
5. Prove it against the harvest you fetched: `make all QUIET=1` and `python3
   -m unittest discover -s tests` pass. Then `python3
   .github/scripts/fix_refresh.py check` reports nothing an unattended fix
   may not land.
6. Write `pr.md` in the outcome directory the prompt names: a title line that
   opens with the alarm's id, a blank line, then the body - what failed, the
   source and what it says, what changed, file by file. No closing keyword:
   the alarm closes on the run that proves the fix (`AF-89`).

**Holding.** When no source settles the fact, or the fix needs a path or a
change outside the list, or anything a person must decide: write `hold.md`
instead - what must be decided, and what the item does under each answer.
Nothing of the tree is packed. The workflow posts it on the alarm as
**Decision needed:** and labels it `decision`, which the fixer and the
loop both pass over until a person answers. Never both files.

The review is held to the same rule as the loop's: a recorded FAIL, or no
verdict, leaves the pull request open and unmerged for the loop or a person,
whose fork reads its comments first and fixes the FAIL `[D-23]`.
