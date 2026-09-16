# Decisions and the reasons for them

Every rule in `CLAUDE.md`, `CONTRIBUTING.md` and the loop's skills carries a
one-clause reason inline. This file holds the rest of the story: what went
wrong, when, and what was measured.

**Read a `[D-nn]` entry before you propose changing the rule that cites it.**
That is the only time you need this file. An agent doing an item does not
read it; the clause in the rule is enough to work by, and the entry here is
what stops a tidying pass from erasing a decision it does not recognise.

Nothing here is deleted. A decision that was reversed says so, with the date
and the replacement, because the reversal is itself a decision.

---

## The build

### D-01 · `BUILT` is a constant, not `date.today()`
The database must be a pure function of its sources. CI compares the
committed artefact against a fresh build, and the browser caches on a digest;
a real timestamp breaks both. Re-proposed often enough to be listed under
*Measured and rejected*.

### D-02 · Never hardcode a column list against `circuit_geometry`
Three places wrote out twelve columns. `main` added three more, and every
copy would have silently dropped them. Derive from `PRAGMA table_info` or
`sqlite_master`, the way `build.py` does when it moves the geometry rows out.

### D-03 · `make all` before a commit, never `make check`
`check` does not run `export`, so it leaves `f1_compat.json` stale — and CI
compares the committed copy against a fresh one. Anything that changes
`VERSION` or the data changes that file too.

### D-04 · `make lint` belongs in the local order too
`make ci` is CI's *Python* job only. `lint` (Ruff, Biome, actionlint) is a
separate job, and a lint failure reached CI on `AF-12` because nothing local
ran it. A machine without ruff gets only a warning from the precheck, which
is why the rule names the step rather than trusting the tool to be present.

### D-05 · The declared-deviation count is not written in the rules
`CLAUDE.md` deliberately does not state how many declared deviations there
are. It said "14" for exactly one day, before two `fastest lap` rows were
filed, and nothing checks a number in that file. `verify.py` reports the live
figure.

---

## Licensing and redistribution

### D-06 · Four tables stay empty; two are checked by source
`laps`, `stints`, `race_timing` and `race_control_messages` hold FOM-owned
data. The empty `laps` table is a licence decision, not a missing feature —
`docs/TIMING-ARCHITECTURE.md` before reopening any of it. `F1_LOCAL_TIMING=1`
downgrades the failures to warnings for local work; never in CI, and never
commit a database built with it. `ci.yml` runs
`verify.py --redistribution-only` against the *committed* database before the
rebuild, because that is the only moment a bad commit is catchable.

### D-07 · ODbL geometry ships as a second database, never merged in
Two independent databases distributed together are a *Collective Database*
under ODbL and the share-alike does not reach across. Merging them makes a
*Derivative Database* and would put 117,000 unrelated rows under ODbL. A
merged local copy is fine to hold; it is simply not the file to publish.
Anything that publishes `f1.db` publishes `f1-geometry.db` beside it —
omitting it ships zero centrelines with no way to obtain them.

### D-08 · A licence class is required, and there is no default
`SOURCE_LICENCE` in `data/current.py` classifies all 16 sources. `build.py`
refuses an unclassified source where it assembles `source_registry`, and
`verify.py` fails on any row citing a `no` source. Adding a source means
classifying it.

---

## The front end and the deploy

### D-09 · Deploy-time steps go in the npm chain
There was a `tools/cloudflare-build.sh` and it is gone. The dashboard's
build-command field named it, the build log announced the npm chain, and
three deploys were spent putting a step into a file that never executed.
**A build step whose execution you cannot establish is worth less than no
build step.**

### D-10 · A non-fatal step must report where it can be read
Build logs are off for this project, so a silent failure is invisible. The
Parquet step's failure hid for three rounds because of it; it now writes
`public/build-status.txt`, served at `/build-status.txt`, on success as well
as failure.

### D-11 · CI is the gate, not the deploy
The deploy does not rebuild the database or re-run `verify.py`. `ci.yml` does
both on every push and compares the committed artefact against a fresh build.
Do not move that gate to the deploy.

### D-12 · Route-level code splitting: measured and rejected
The bundle is 398 KB raw / 118 KB gzipped, irrelevant beside the database the
browser downloads (4.4 MB gzipped, 20 MB raw).

### D-13 · An HTTP range-request VFS: measured and rejected
No source has lap times under a redistributable licence, and prerendering
already took the download off the first-paint path.

---

## The queue

### D-14 · GitHub Issues is the queue — 2026-09-13 (`PM-37`)
Until then it was `docs/BACKLOG.md`. What landed and what was declined before
the move is `docs/LANDED.md`, unchanged, and a later critique still argues
against a *Declined* entry there before re-raising it. A backlog file
reappearing is a second queue; `tests/test_conventions.py` fails on one.

### D-15 · A review finding is not discovered work — 2026-09-14
A defect in the diff under review is fixed on the diff under review: filing
it converts a fix into a backlog item, and the item that found it is the
cheapest place it will ever be fixed. A fact the item turned up, a question
for a person, or a defect elsewhere in the codebase *is* an issue. On
2026-09-14 three items landed and filed seven issues between them; four were
discovered work and three were findings against their own diffs.

---

## The loop

### D-16 · One fork per item — 2026-09-13
Measured from the session transcripts: the session driving the loop was
75–85 % of the loop's tokens, not the reviewers. It ran 190–440 turns per
session at a median context of 230,000–356,000 tokens a turn, peaking at
612,000, because every slice of the backlog, every build log and every
reviewer report it had ever read stayed in context for the rest of the run.
The reviewers ran at 46,000–67,000. A fork per item is what makes the driving
context stop growing.

### D-17 · The fork writes a progress line at every stage — 2026-09-13
The fork's context is invisible from the driver, on purpose. From there the
whole run is one tool call sitting for many minutes showing no token use, and
the maintainer interrupted it three times believing it had stalled, killing
the fork each time. One line per stage in `.claude/loop/progress.log` is the
replacement for the visibility the fork took away.

### D-18 · Run the loop with connectors off
Every connected MCP server's tool schemas sit in the fixed prefix of every
turn. The loop uses none of them.

**Who actually pays, measured 2026-09-16** — the earlier wording here said the
schemas ride on "the fork and on every reviewer it launches", and the reviewer
half of that is wrong. All 13 agents in `.claude/agents/` carry
`tools: Read, Grep, Glob, Bash`, which is an allowlist, so a connected MCP
server costs a reviewer nothing. `backlog-item/SKILL.md` names no
`allowed-tools`, so the **fork** inherits the whole session tool set — and the
fork is the longest-running context in the loop. That is where the cost lands,
and restricting it is filed rather than done here, because getting the list
wrong breaks the loop silently.

The 74,000-token figure came from sessions measured on 2026-09-13 and should
not be read as a constant. On 2026-09-16 this machine had 48 connected MCP
tools across four servers — 31 of them one plugin — with the four Google and
Slack connectors already disabled. Measure before quoting it.

### D-19 · The pace — 2026-09-13 (`PM-36`)
`fast`, `balanced`, `thorough`. It may relax the first-pass reviewer for a
small front-end change and how many routes the brief names. It may never
relax the review itself, `make all`, the precheck, green CI, the licence
triggers or the stop conditions.

### D-20 · Grouping is not a pace setting — 2026-09-14
Replaces an S-only rule and a per-pace count of four, two and none. What
rides with the head is what is linked to it, at any size and at every pace.
An item held back because it was sized M comes back to the same file as its
own pull request with the whole fixed cost paid again, which is the outcome
grouping exists to prevent and the reason the queue was not reducing. The
bound is the diff, not a number.

### D-21 · The rungs of one item are one PR — 2026-09-13
The 2026-09-13 run spent four first passes and three confirmations on four
rungs of `PD-02` whose diffs a single pass would have read for the price of
one.

### D-22 · A PASS with findings is fixed in one batch, with one confirmation — revised 2026-09-14
What 2026-09-13 measured and rejected was four confirmations buying nothing a
later pass would not have. One confirmation covering four fixes is not that,
and it is cheaper than the orientation a later reviewer pays to read the same
code again.

### D-23 · Record the verdict as a PR comment the moment it arrives
A fork can die between the verdict and the merge — a limit, an interrupt —
and the comment is what the next fork reads to fix rather than re-review. On
2026-09-13 a fork that inherited PR #273 with three unrecorded FAILs launched
three more reviewers on the unchanged commit.

### D-24 · The precheck exists because half the FAIL rounds were mechanical
Half the FAIL rounds of the 2026-09-12 run were a conflict marker, a script
that did not parse, a duplicated import or a PR body that did not close its
issue. A reviewer pass costs 40,000–130,000 tokens; `precheck.sh` costs a few
hundred.

### D-25 · Quiet forms, always
The verbose run is thirteen hundred lines for `make ci` and five hundred for
the smoke test — about 25,000 tokens read back per iteration. `QUIET=1` and
`--quiet` keep every exit code and print failures, warnings and a count of
what passed.

### D-26 · A mechanical check is a test, not a review item
`tests/test_conventions.py` and `web/test/conventions.mjs` hold what a
pattern can decide. Every check that moves there is one a reviewer never
spends a turn on again, so the brief stays on judgement.

### D-32 · A skill's frontmatter cannot restrict a forked context's tools — 2026-09-16 (`AF-32`, #341, declined)
`backlog-item/SKILL.md` names no `allowed-tools`, so the fork was thought to
inherit the session's MCP tool schemas where the reviewers, whose agent files
carry `tools: Read, Grep, Glob, Bash`, do not. The proposed fix was to declare
the fork's tools in its frontmatter. **It does not work.** Probed directly on
2026-09-16 with a throwaway forked skill: `allowed-tools: Read, Bash` left the
fork holding all 41 loaded schemas, and `disallowed-tools` naming `Artifact`
and two browser tools removed none of them. Both keys parse and both are
inert for a `context: fork` skill in this build.

**The two probes as actually run**, so this is reproducible rather than taken
on trust. Each is a `SKILL.md` written to `.claude/skills/tool-probe/`, invoked
with the Skill tool, read, and deleted.

*Probe A — does `allowed-tools` narrow the fork?* This is the run that
produced the 41-schema figure below.

```
---
name: tool-probe
description: Throwaway probe - reports which tools its forked context has.
context: fork
allowed-tools: Read, Bash
---
List the exact names of every tool you can call here, including any beginning
`mcp__`. If you can see tools beyond Read and Bash, say so and name three.
```

Answer: the fork listed all 41 loaded schemas and named browser, session and
terminal MCP tools. `allowed-tools` narrowed nothing.

*Probe B — does `disallowed-tools` remove one?*

```
---
name: tool-probe
description: Throwaway probe - reports which tools its forked context has.
context: fork
disallowed-tools: Artifact, mcp__Claude_Browser__navigate, mcp__Claude_Browser__computer
---
Answer only: can you call `Artifact`? Can you call
`mcp__Claude_Browser__navigate`? Roughly how many tools have full schemas here?
```

Answer: both still callable, 41 schemas. `disallowed-tools` removed nothing.
Note that the frontmatter named three tools and the prompt asked about two:
`mcp__Claude_Browser__computer` was declared and never tested, so this
transcript establishes two of the three. It is left as it was run rather than
tidied into a probe nobody performed.

**What neither probe settled, and how to settle it.** Both asked only what the
fork could *see*, and a context listing a tool is not proof it could call one.
The decisive form disallows a tool and then calls **that same tool** — the
earlier draft of this entry got that wrong, disallowing `navigate` and calling
`tabs_context`, which was never restricted and so could only ever succeed:

```
---
name: tool-probe-call
description: Throwaway probe - calls a tool its frontmatter forbids.
context: fork
disallowed-tools: mcp__Claude_Browser__tabs_context
---
Call `mcp__Claude_Browser__tabs_context` exactly once - it is read-only and
harmless. Report whether it returned a result, and if it did not, quote the
error text exactly. Do not summarise or classify it. Nothing else.
```

A result proves the key is inert. A refusal naming the tool as disallowed
proves it works. **Quote the error rather than classifying it**, because a
tool can also fail for an unrelated reason - no browser attached in the
environment running the probe - and a fork reporting that as "refused" would
look exactly like the key working when it does not. **This has not
been run**, for a reason worth passing on: **skill registration is not
reliable mid-session.** Observed on 2026-09-16, in this order — a skill
created early in a session was found and invoked twice; after it was deleted,
a recreation under the same name returned *Unknown skill*; and so did a
creation under a name never used before, despite the file being correct and
the session announcing it. Two attempts at the calling probe were lost that
way. No mechanism is offered here because none was established: the usable
fact is simply that a probe wants **its own fresh session**, written before
the session starts rather than during it.

So: treat the inertness of these keys as well-evidenced and **not proven**,
and run the calling probe before acting either way, in either direction.

What the probe did establish, and what the earlier estimate got wrong in both
directions: a fork carries **41 tools with full schemas** — 13 built-ins and
28 MCP — of which the **Claude Browser pane alone is 19**. The long tail is
*deferred*, costing a name each until something fetches it: gitkraken's 25,
session-management's 20, pdf-viewer's 9 and about 130 in total. So the loaded
cost is smaller than the "48 tools / 74,000 tokens" figure implied, and it is
concentrated in one server rather than spread across the plugins. The fork
also has **no `Grep` and no `Glob`** — its file search is Bash-only, which is
worth knowing when reading its transcripts.

The remaining lever is disabling servers at the application level, which is a
maintainer's action in the desktop app and not a repository change.

### D-33 · Front-end review runs at medium effort — 2026-09-16
`frontend-reviewer` and `frontend-reviewer-quick` drop from `effort: high` to
`effort: medium`; `data-integrity-reviewer` and `licence-reviewer` stay high.
The consequences are asymmetric, so the review is asymmetric. A missed
front-end finding is a cosmetic regression on a site we control, caught by the
next item, by the 384 smoke assertions, or by `web/test/conventions.mjs`,
which is organised by `frontend-reviewer` item number and mechanises much of
that checklist. A missed licence or data finding is a published database that
cannot be withdrawn, and `verify.py` cannot catch a judgement.

No line count is given for that suite on purpose: an earlier draft of this
entry said 766, which was true at `44218a4` and false by the time it was
written, because `AF-21` removed the track atlas in between. Nothing checks a
figure in this file — the same reason `CLAUDE.md` refuses to state how many
declared deviations there are `[D-05]`.

The turn caps are deliberately **not** changed with this. They are runaway
stops, not budgets `[D-19]`, and a reviewer that hits one returns without a
verdict — so a cap set too low does not save a pass, it wastes one. Lowering
them wants turn-count evidence per reviewer, which the Agent tool reports on
every call; the two data-integrity passes on #340 used 44 and 37 of their 90.
There is no such figure yet for the page-driving front-end reviewer, and
guessing one is how a cap starts truncating passes.

### D-31 · Critics never run on a pull request — 2026-09-16
`.claude/agents/README.md` already said critics are "invoked deliberately, not
on a diff", but nothing the loop read said so, and on 2026-09-14 `AF-16`
launched `accessibility-critic` alongside `frontend-reviewer` on PR #303. The
front-end reviewer returned PASS with four findings; the critic's arrival
turned that into a fix, a confirmation that FAILed on a wording judgement, a
second fix and a second confirmation — five agent launches on one item, on a
change the merge-path reviewer had already passed.

A critic's job is to find things, and it will always find something, because
that is what it is for. That is the right posture against `main`, where what
it finds becomes issues and gets ranked against everything else. It is the
wrong posture inside a merge gate, where it converts a sound change into
rounds. Keep the families apart, which is what the README asks for.

### D-29 · The track atlas was cut — 2026-09-14 (`AF-20`/`AF-21`, #302/#304)
`/circuits/atlas` was a walkable, turn-rate-coloured lap compared across all
25 traced circuits. The walk never worked — no play, no keyboard repeat,
disabled on the three traces that do not close — and the colour read nothing
the traced shape did not already show. No usage number justified keeping
either; none was obtainable, and it was cut without one, on the design
argument, rather than left standing on an unanswered question.
`/circuits/:id` still draws the traced centreline through the same
`LapFigure`.

### D-30 · Node is wherever `PATH` says — 2026-09-15 (`AF-30`)
The rules named `~/.local/node/bin`. It is not in the same place on every
machine: a container, nvm and Homebrew each put it somewhere different, and a
fixed path sends an agent looking in the wrong one. `which node` answers it.

### D-28 · The CI review is opt-in, by the `ci-review` label — 2026-09-16
`review.yml` ran on every pull request and on every push to one. It
duplicated the review the loop already runs before merging, with the *same*
three agent definitions; `CLAUDE.md` told the loop to ignore its result and
run those agents locally, so it was a review nobody read; and a green check
was not evidence a review had happened — on PR #312 it reported SUCCESS with
its sticky comment two steps short of posting findings (#313 / AF-27, open).
Firing on `synchronize` meant four runs on the AF-29 pull request and four on
AF-31/AF-30, each delegating to up to three sub-agents.

It never gated a pull request and still does not. The control that protects
`main` is the loop's own rule — a fresh independent review from
`.claude/agents/` before every merge — and that is untouched. This removed a
duplicate, not a safeguard. Label a pull request `ci-review` for a second
opinion from CI.

### D-27 · GitHub's secondary rate limiter is not in `gh api rate_limit`
On 2026-09-14 every reported bucket read full while the limiter refused every
GraphQL call. A `gh` failure naming a limit while the buckets look untouched
is that limiter — not a defect and not your quota. Retrying extends it; a
poll every 45 seconds keeps it closed. Since `AF-14` the precheck tells the
two apart: a call that failed is a WARN naming the API, and the FAIL saying
an item "is not an open issue" now only happens when `gh` answered and found
nothing.

### D-34 · An item's body says where the work lands — 2026-09-16 (`AF-36`, #350)
A reviewer pays its orientation cost once per pull request, not once per
item, so the average group size is what sets the review cost per item.
`next.py --group` proposes a companion on a shared file path, a shared route
or a cross-referenced id — and on 2026-09-16, **99 of the 166 open items
named no path at all** beyond the footer every issue carries. The signal the
grouping was built on was mostly absent, so the proposals were riding on
cross-references and rank adjacency.

The 99 bodies were read and given the paths the work would touch, checked
against `git ls-files`, added as one `**Where:**` line above the footer and
nothing else: the item keeps its own words. Filling them in also exposed a
second defect and it is fixed here. `prerender.js` and
`web/scripts/prerender.js` were two signals that never matched each other —
ten items wrote the first, seventeen the second, and neither count was whole.
There were 32 such splits. `signals()` now resolves a bare name against
`git ls-files` when the tree holds exactly one file by that name, so the two
spellings are one signal; `README.md` is three different files and stays
three, because guessing which one an item meant proposes a group on a file it
never mentioned. Matching a bare name against the tree also surfaced an older
defect it would otherwise have inherited: the normaliser was
`lstrip("./")`, which strips a character *set*, so every path under
`.claude/` and `.github/` had its leading dot removed. Harmless while both
sides of a comparison were mangled alike; not harmless against `git
ls-files`, which keeps the dot.

Measured over the 164 heads `--group` will actually score — the 166 open
items less the two carrying `decision` or `blocked`, which it never returns —
companions proposed rose from 182 to 247, the mean per head from 1.11 to
1.51, and the heads with no companion at all fell from 69 to 55.

**It cost 27 directed pairings, and that is the rule working.** `NOISE` in
`next.py` drops a path more than four open items name, so `build.py` (4 items
before, 46 after), `web/scripts/prerender.js` (4, then 27 once the spellings
were joined) and `web/src/styles/app.css` (3, then 13) stopped scoring, and
fourteen pairs whose only shared signal was one of those lost it. The count
is odd rather than twice fourteen because `bands()` is asymmetric: a pair
split across two statuses is proposed in one direction only. Some of them —
`AF-07` with `AF-08`, `IX-29` with `VD-42` — are pairs a person would group.
They were riding on an artefact of a queue whose bodies were empty, and the
way to propose one deliberately is the cross-reference, which outscores any
path.

**Raising `NOISE` was measured and rejected**, and the entry's own figures
settle it without the sweep. A path scores while the items naming it are
`NOISE` or fewer, so recovering a pair that shared only `app.css` needs 13,
only `prerender.js` needs 27, and only `build.py` needs **46** — which is a
path a quarter of the open queue names, scoring as though it said something
about two items in particular. The sweep agrees: against the filled-in bodies
4 gives a mean of 1.51 and a largest proposal of 9; 10 gives 3.06 and 14; 25
gives 7.46 and **43**, the crowd the constant exists to stop and the reason
it was set after five `prerender.js` items were proposed as one.

Re-running it needs no GitHub call. `next.py --list` always refetches and
rewrites the queue snapshot at `.claude/loop/queue-cache.json` — not
`items-cache.json`, which is `file.py`'s issue-number to board-id map;
scoring every open item as a head against
that snapshot, with `next.py`'s `NOISE` overridden in the calling process, is
what produced every figure above, and the snapshot is what makes it
repeatable while the live queue moves under it.

What is **not** settled is the shape of the rule. The comment beside the
constant reasons that "a file is named by the few items about it however long
the queue grows", and filling the bodies in falsified exactly that: `build.py`
is named by 28 % of the queue. Raising a cliff was the wrong axis to test, and
a signal that costs nothing below the cliff and everything above it may be the
wrong instrument — a threshold relative to the queue, or a weight that falls
with a path's commonness, would not have this entry's 27 pairings to pay. That
is filed rather than decided here, and the constant stays at 4 until it is.

The durable half is at the point of filing. The issue form asks where the work
lands as its own required field, `file.py new` takes `--where` and warns on
any token the checkout does not track that is not prose, and `CONTRIBUTING.md`
says so under *Filing*. Required is not the same as answered: *not known yet* is an accepted
answer, and costs only the grouping. The `**Where:**` spelling is this
project's house style and not something the grouping requires — `signals()`
reads a path wherever it appears in a body and looks for no marker, which is
what lets an item filed through the form, where the heading comes from the
field label, group exactly as well.
