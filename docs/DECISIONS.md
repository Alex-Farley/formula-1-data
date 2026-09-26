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

### D-39 · A figure in database prose is a token, not a number — 2026-09-22 (`CD-38`, #498)
`source_registry` prose is rendered straight onto `/data/sources`, and its
figures were typed. On 2026-09-22 it said the full classification covered
1,161 races in 27,555 entries against 1,163 and 27,504 held, and qualifying,
standings, pit stops and the two Commons totals were stale beside them —
26,975 against 27,017, 34,495 against 34,597, 22,472 against 22,506, 602
against 742. Nothing read them, so they drifted one race weekend at a time,
exactly as the README's counts had before `[D-03]`'s `readme_figures.py` and
as `races.note` had under `AF-63`.

The remedy is that file's idea pointed at the database's own prose, and it
retires the class rather than reporting it: a figure is a `{{fig:name}}`
token in `data/*.py`, `build.py` expands it off the counts in its final
stage — after every loader, because the tables it counts are filled by the
stages above — and `verify.py` re-expands the literal and compares the stored
prose whole, the way it already does `meta.coverage_note`. A token that
survived into any text column of any table is refused, scanned from `PRAGMA`
rather than a list for the reason `[D-02]` gives. `tests/test_prose_figures.py`
plants a stale figure and a stray token in a copy and shows the gate closing,
because a check that only ever runs against the database the same build wrote
would read as a pass however it was written.

Three things stay typed, and the rule says so. A figure about another
source's holdings — Jolpica's 628,454 lap times, its 118 of 26,082 readings —
counts rows that are not here to count. A figure `verify.py` already pins as
an invariant, like the 13 races where the credited pole-sitter was not the
fastest qualifier, is checked where it is pinned; a second place to state it
is a second place to be wrong. And a figure house style spells out —
"sixteen distinct licence strings", which `web/src/queries/sources.js` and
`schema.sql` also spell — stays spelled, because the mechanism writes digits.

The scope is `source_registry`, the table `/data/sources` renders, and the
rule in `CLAUDE.md` says so rather than claiming the whole database:
`known_gaps` prose carries the same typed figures on `/data/quality`, `PROSE`
is built to take a second accessor, and that sweep is its own item because
each of its figures needs a reading of what the sentence around it claims —
one is a harvest file's row count, one a past state in the past tense, two
are Jolpica's. A rule stated more broadly than it is enforced is the kind
nobody can rely on.

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

### D-36 · Filing is not ranking — 2026-09-21 (`AF-65`)
`file.py new` put a fresh item under *Next*. The loop takes *Now*, then
*Next*, then *Someday*, so every item a fork discovered mid-run outranked
every item a person had deliberately dragged to *Someday* — on the strength
of an argparse default. On 2026-09-21 the board was *Now* 2 (both parked, one
`decision` and one `blocked`), *Next* 64, *Someday* 105: the loop was falling
through an empty *Now* into a 64-item pile held in arrival order, which is
not a ranking, while the ranking a person had actually done sat underneath
it. The default is now *Someday*. An item arrives where nobody has judged it;
promoting it is a person's act, and `--status Next` is still there for a
caller that means it.

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

**Who pays** is the **fork**. `backlog-item/SKILL.md` names no
`allowed-tools`, so it inherits the whole session tool set, and it is the
longest-running context in the loop. The reviewers do not: all 13 agents in
`.claude/agents/` carry `tools: Read, Grep, Glob, Bash`, which is an
allowlist, so a connected MCP server costs a reviewer nothing. The wording
here once said the schemas ride on "the fork and on every reviewer it
launches", and the reviewer half of that was wrong.

**What it costs is now measured, not estimated.** Counted on 2026-09-16 in a
desktop-app session with the connectors on — this machine, four servers, the
four Google and Slack connectors already disabled — the fixed prefix was
system tools 33,402 tokens, MCP tools 20,868, skills 9,941, the system prompt
4,360 and memory files 3,872.

Those five lines total 72,443, which is 1,557 short of the 74,000 this entry
used to quote — **for MCP alone**. That is what the old figure got
wrong: not the size of the fixed prefix but what was in it. MCP is a little
over a quarter of it, and the **built-in tool schemas cost more than every
connector combined**. Turning the connectors off is still worth doing — about
21,000 tokens off every turn of the longest context in the loop — but it is
one lever among several rather than the lever, and the other 52,000 does not
move when a server is switched off. How much of the 9,941 of skills is this
repository's own two is not known: the count was taken whole and never broken
down by owner, and this machine carries a great many skills from plugins.

The inflated figure was not free. It made the connectors look like the whole
of the fixed cost and sent a round of work at them: `AF-32` (#341), declaring
the fork's tools in its own frontmatter, which was then declined because the
keys are inert `[D-32]`. Re-measure before quoting any of these. They move
with what the machine has connected and with the build, and the 74,000 came
from sessions measured on 2026-09-13 that nobody re-counted for three days.

### D-19 · The pace — 2026-09-13 (`PM-36`)
`fast`, `balanced`, `thorough`. It may relax the first-pass reviewer for a
small front-end change and how many routes the brief names. It may never
relax the review itself, `make all`, the precheck, green CI, the licence
triggers or the stop conditions.

*Clarified on 2026-09-24 by `[D-41]`: the Opus rule for a data, build, verify,
schema, exporter, prerender or workflow change governs the first pass; a
confirmation follows the pace table.*

### D-41 · Opus reviews a data change first; its confirmation follows the pace — 2026-09-24 (`CR-45`, #590)
*Never slides* said "Opus for any change under `data/`, `build.py`,
`verify.py`" and the rest, while the pace table, the FAIL bullet and
`review-prompt.md`'s follow-up brief all confirmed a fix with a fresh Sonnet
at `fast` and `balanced`. A fork confirming a fix to a data change had two
instructions and no rule for choosing; the 2026-09-23 audit of the
context-loaded instruction files found it.

The maintainer ruled for the cheaper reading. The first pass is where a data
change is judged whole — the cross-checks it could slip, the figure it could
copy rather than compute — and that pass stays Opus at every pace. A
confirmation reads a commit range against findings already written down, and
a fresh Sonnet context satisfies the independent-review rule for that job, as
it does on the front end. `thorough` still confirms with Opus. The rule is
stated once: *Never slides* names the first pass and points at the pace
table's *Confirming* row, and the FAIL bullet, the *Model* paragraph and
`review-prompt.md`'s follow-up brief name that row instead of restating it.

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

### D-40 · The verdict is a command the reviewer runs, not a line it writes — 2026-09-23
`[D-37]` and `[D-38]` both tried to make a reviewer put its verdict on the
first line of its reply, first by writing the contract into each agent file,
then by asking the respawn for the verdict alone. Neither held. On 2026-09-23
PD-49 (#586) was finished, green and fixed against all four findings of its
first pass, and was skipped anyway: the Sonnet confirmation put a summary
sentence above its verdict, and its respawn — briefed for one line and nothing
else — put a paragraph above it. With #407, #409 and #427 under `[D-37]` and #541,
#548 and #551 under `[D-38]`, that is seven pull requests held up by the same
formatting. The first three merged on substance with the deviation recorded,
which `[D-37]` then ruled out; since then each has cost a respawn, often a
fork, and tokens for a review whose substance was never in doubt.
Wording is the wrong lever: the layout of a model's final message is not
something a prompt reliably controls.

So the verdict leaves the reply. The fork opens each pass with
`verdict.sh new <PR> <sha>`, which prints a pass id; the reviewer runs
`verdict.sh record <id> PASS|FAIL` from the worktree; the fork runs
`verdict.sh read <id>` and takes the verdict from its output and exit status.
The script accepts the two words and nothing else, refuses a second verdict
for a pass, refuses a checkout at another head, and for
`frontend-reviewer-quick` refuses a verdict without the applied items that
used to be its `Applied:` line.

The gate is no looser, and on the case `[D-37]` exists for it is tighter. A
reply is never read for a verdict, so `PASS — no. Findings below; one requires
a change.` — the FAIL that opens with the word PASS — can no longer be taken
for one either way; only a recorded FAIL or PASS counts. No recorded verdict is
still not a PASS, still gets one respawn, and the second pass still settles the
item. What goes is `[D-38]`'s cost: a respawn no longer has to be asked for a
bare verdict, so its findings come back like any pass's, and a non-blocking
finding is no longer lost to the retry. The reply's layout stops mattering
because nothing depends on it.

`tests/test_conventions.py` keeps the command in each merge-path reviewer's
*How to report* and in every half of the brief, and runs the script in a
scratch repository to show each refusal holding.

### D-38 · The respawn asks for the verdict alone — 2026-09-22 (`PM-48`, #542)
*The report contract here was superseded on 2026-09-23 by `[D-40]`: the verdict is recorded by command, and a respawn is sent the same brief. The measurement stands.*

`[D-37]`'s remedy — the contract in each merge-path reviewer's *How to
report*, kept there by `tests/test_conventions.py` — is in place and did not
stop the preambles. Three items in the 2026-09-22 run stalled on it — of
seventeen, carried by fifteen pull requests — UR-07 (#541), PD-40 (#548) and
SD-24 (#551), each a finished, green,
genuinely reviewed change the loop was not allowed to merge. Two were rescued
only because the next fork inherited the open PR and drew a clean confirmation
on a fresh respawn budget; the third stopped the loop.

Four results on #541 are the measurement. The one that matters is the fourth:
a Sonnet confirmation briefed with the format requirement restated in
capitals, the exact strings given and the consequence spelled out, which
opened with a summary sentence anyway. **Restating the format does not work**,
so the third option in #542 — change what the respawn asks for — is the one
taken.

The respawn now asks for the verdict line and nothing else: no findings, no
summary, nothing above or below. A reply with nothing to summarise has nothing
to put a summary in front of. It is **the same brief with its last paragraph
replaced** rather than a new, thinner one — the worktree, the task, the
routes, the "try to disprove" list and the constraints (`Do NOT run npm test`
among them, the smoke port being shared) all go across, because the respawn is
the pass that settles the item and must not be the worse-briefed of the two.
`frontend-reviewer-quick` is asked for two lines, keeping the `Applied:` line
that is the loop's evidence the rules were read; without that carve-out the
brief and the agent file would have asked it for contradictory things and its
respawn could not have succeeded at all. The brief also says in terms that it
overrides the agent file's *How to report* for that pass, since handing a
model two report contracts is the same class of prompt that produced the
preambles. `[D-37]` is untouched — the gate is exactly as strict, a verdict on
the second line is still refused, and the respawn is still one. The widening that was *not* taken is #542's second option,
accepting a verdict as the first line of the last paragraph: it would have
admitted all four of #541's results, including `PASS — no. Findings below; one
requires a change.`, which is a FAIL that opens with the word PASS and is the
reason `[D-37]` exists.

Two costs, named rather than hidden, because a respawned pass returns no
findings at all and the discarded result's may not be read back. On a `FAIL`,
a fresh full pass is needed to learn what is wrong — that falls on a
confirmation of a fix that was expected to pass, which is rare. On a `PASS`,
there is nothing to fix under `[D-22]` and nothing to list under `[D-23]`, so
a non-blocking finding that pass would have made is lost, and unlike the
`FAIL` case nothing signals that it existed. That is the real price: the
second attempt settles the item, and a respawned first pass buys its verdict
by giving up its findings. It is still the better trade than a finished,
reviewed, green change that cannot be merged.

### D-37 · A result that does not lead with its verdict is refused, not read — 2026-09-21 (`PM-41`, #428)
*The refusal stands; where the verdict is read from was changed on 2026-09-23 by `[D-40]`, which takes it from a command rather than the reply's first line.*

Four occurrences in two days, across three forks — a confirmation agent
putting a summary sentence above its verdict line, on #407, twice on #409 (one
fork, two fresh contexts) and on #427. Each merged on substance and recorded the deviation, which was right
in the moment and wrong to keep doing: the contract was being held up by a
fork's reading rather than by the rule, and the next fork to read past a
preamble is the one that reads past a `FAIL` phrased as a sentence.

Two causes, both fixed here. The contract was stated in `SKILL.md`,
`CONTRIBUTING.md` and the brief the fork composes, and in no agent file at
all, so a reviewer reading its own definition found nothing about a verdict — it is now in each merge-path reviewer's *How to
report*, and `tests/test_conventions.py` keeps it there `[D-26]`. And the
confirmation brief asked for "one line", which is satisfied by a line
anywhere; it now asks for the first line and says nothing goes above it.

The rule itself is a refusal rather than an interpretation, which is the only
version that cannot rot: discard the result, spawn the pass again, take the
second one's first line. A respawn costs one review; a misread verdict costs
the merge gate.

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
concentrated in one server rather than spread across the plugins. The count
was later put in tokens `[D-18]`: about 21,000 for the MCP schemas, against
33,000 for the built-in tools, which the fork carries regardless of what is
connected.
The fork also has **no `Grep` and no `Glob`** — its file search is Bash-only,
which is worth knowing when reading its transcripts.

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

*Superseded in part on 2026-09-23: the maintainer ruled that the CI review
stays off, and the loop never adds `ci-review` or re-enables the workflow —
`[D-42]`. Reversed in full on 2026-09-26: the workflow was removed —
`[D-44]`.*

**A green `review` check now means findings were posted** (`AF-27`, #313).
The #312 run had not timed out and had not been cut off at its turn cap: it
stopped after 19 of 40 turns with a `success` result and five tool calls
refused by its allow-list, and the action exits SUCCESS on any result that is
not an error — so the check had never been conditioned on a review being
posted. The prompt now closes the comment with a line naming the head
commit, and the job's last step goes red unless a bot's comment has it on a
line of its own — not merely quoted, since the progress checklist shares the
comment and can quote it as a to-do. The tools refused are named in the run
summary, since the log hides the model's output. It is still not a required
check and still gates nothing.

### D-27 · GitHub's secondary rate limiter is not in `gh api rate_limit`
On 2026-09-14 every reported bucket read full while the limiter refused every
GraphQL call. A `gh` failure naming a limit while the buckets look untouched
is that limiter — not a defect and not your quota. Retrying extends it; a
poll every 45 seconds keeps it closed. Since `AF-14` the precheck tells the
two apart: a call that failed is a WARN naming the API, and the FAIL saying
an item "is not an open issue" now only happens when `gh` answered and found
nothing.

**It recurred on 2026-09-21** after a fourteen-item run, against a board
grown to 273 items, and `PM-44` (#451) measured why and what the rule should
be. The cache built in 2026-09-14's answer had not failed; the load it covers
had grown, on queue size and on forks per hour together. The reads themselves
were the lever: `gh project item-list --format json` has **no field
selection**, so it returned every field of every board item — each issue's
body included — and `next.py` used two of them. A hand-written GraphQL query
for number and status returns byte-identical numbers, order and statuses over
the same three pages, at **23 KB in 3.4 s against 468 KB in 6.5 s**. Time is
what matters rather than bytes: the limiter counts processing time as well as
calls, and fourteen forks spent about ninety seconds of board time on the old
query alone. The issue read now asks for bodies only where one is printed or
scored, which is most of its payload again. Nothing was cached that was not
cached before — choosing an item still always reads GitHub, because a stale
board is how two forks take the same item.

Two rule changes came with it. `next.py` exits **3**, not 2, when a refusal
matches the do-not-retry pattern, so "the limiter is active" is
distinguishable from "gh failed"; and the pattern now lives in
`gh_preflight.py` as one copy that both `next.py` and `file.py` read. And the
limiter refusing the **board** read is a `STOP` for the loop rather than an
ordinary blocker to skip: recording a blocker is itself a board write, so the
skip path needs the call that is being refused.

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

### D-35 · A skill's frontmatter does not set a fork's effort either — 2026-09-16
`backlog-item/SKILL.md` carries `effort: high`, and the fork is both the
longest-running context in the loop and its implementer, so effort costs more
there than anywhere else. The obvious experiment is to run an item at
`medium` and see whether the FAIL rounds rise. **It cannot be run by changing
that key**, because the key does not appear to do anything — the same finding
as `[D-32]`, one frontmatter key over.

Note that `backlog-loop/SKILL.md` has said all along that "the implementer's
effort is the session's", and names `CLAUDE_CODE_EFFORT_LEVEL` and
`effortLevel` as the way to set it. The `effort: high` line is what
contradicts it, and on the probe evidence it is the line that is wrong. The
probes cannot prove that much: if the key is live, the wrong document is the
other one.

**The two probes, as run**, each a throwaway `SKILL.md` written to
`.claude/skills/`, invoked, read and deleted. A probe wants a retry after it
is written: both were *Unknown skill* on the first invocation and registered a
minute later, which is `[D-32]`'s registration lag and not a result.

*Probe A — does the fork run at the effort its frontmatter names?*
`context: fork` with `effort: low`, invoked from a session running at `high`,
asked to report `mcp__ccd_session_mgmt__get_session` on `self` and to quote
anything in its own context stating a reasoning budget. It reported
`effort: "high"` and said nothing in its context stated a level at all.

*Probe B — is the key parsed?* The same shape with `effort: banana`, which is
not a valid level. It loaded and ran normally, with no error and no warning
about the value anywhere in its context or its invocation.

Probe B is consistent with the key being inert and **settles nothing on its
own**. This build ignores frontmatter it cannot use without saying a word, on
live keys as much as dead ones, which is precisely why
`tests/test_conventions.py` guards the spelling of `effort:` in an agent file
— "a misspelt key in an agent's frontmatter is ignored silently". Silence is
the expected observation either way.

So: **not proven**, to the same standard `[D-32]` sets. `get_session` reports
the session's metadata and a fork shares its id, so probe A cannot see a
sampling budget that was lowered without the metadata following it.

The probe that would settle it is behavioural, not metadata — probe A has
already shown the fork cannot read its own budget. Invoke the same fork twice
on one task that is heavy in reasoning and light in tools, identical but for
`effort:`, and compare the thinking tokens the Agent tool reports for each.
Run that before acting either way, in either direction.

So the line stays in the frontmatter rather than being deleted — if the key
turns out to be live, removing it would silently drop the fork's effort, which
is the change nobody has evidence for — and it is annotated where it sits.

**The baseline is recorded here so the real experiment has its control.** The
items in `.claude/loop/progress.log` whose review history the log holds in
full: `VD-26` FAIL then PASS, `VD-27` PASS,
`VD-25` FAIL then PASS, `AF-04` FAIL then FAIL then PASS, `AX-07` FAIL then
PASS, `AF-09` FAIL then PASS, `AF-15` PASS then PASS, `AF-16` PASS then FAIL
then PASS, `AF-17+VD-34` FAIL then PASS, `AF-23+VD-44+IX-31` PASS then PASS.
**Compare on a fixed denominator.** Of the ten first passes, **6 FAILed**; the
ten items took **8 FAIL rounds** between them. Those are the two figures a
later run is measured against, because each has a denominator that does not
move: ten items either way. The pooled 8 of 21 rounds — 38 % — is a remark,
not a control. A round exists only because an earlier round failed or passed
with findings, so that denominator is partly the numerator again, and a change
of confirmation policy alone would move it. The two populations differ anyway:
6 of 10 first passes FAILed, 2 of 11 confirmations did.

A round is a pass, whether it launched one reviewer or two, and it counts only
if it returned a verdict. `AF-15` spent one that did not, the fork having died
before recording it `[D-23]`; a later comparison must leave its equivalent out
the same way. `PM-39`, `AF-03` and `AF-10` are excluded: the log holds only
`progress.sh`'s own smoke-test lines for the first, no first pass for the
second, and the third was never run at all — "skipped: item is itself an open
maintainer decision".

**Two things about this control that a later run must hold or state.** The
session effort is written down nowhere: `progress.log` has no effort field, so
"high" is stated from the run and not read off a log, and a run meaning to
compare should record its own. And the instrument moved inside the baseline —
`[D-33]` dropped `frontend-reviewer` to medium on 2026-09-16, after nine of
these ten items and before `AF-23+VD-44+IX-31`. The front-end reviewer judged
most of these rounds, so a comparison either holds the reviewer configuration
fixed and says which it used, or compares only against post-`[D-33]` rounds.

Both remaining steps are `AF-37` (#352), which stays open: this entry records
what was probed, not a finished experiment. The one that would settle it is a
session started at `CLAUDE_CODE_EFFORT_LEVEL=medium` running several items,
compared against 6
first-pass FAILs in 10 and 8 FAIL rounds over 10 items — and run only after
the behavioural probe above says the effort is reaching the fork at all. One
item cannot tell 6 in 10 from 5 in 10, so it is several or it is nothing.

### D-42 · The loop runs from the repository, not from an account — 2026-09-25
Until this the loop's manager was whichever interactive session typed
`/backlog-loop`, and two things that kept it going lived outside the
repository. The restart after a usage limit was a `CronCreate` task, which is
scoped to the session that made it — it is gone when that session ends and
does not exist in another account. And five rules the loop had learned by
failing were written only in one maintainer's Claude auto-memory, which no
other account reads: a fork re-filing a decided item as needing a decision,
three times, because the ruling was in a comment and the body still said
"To decide" (#384, #378, #138); a board position diagnosed as a tooling bug
and moved, when a person had dragged it (2026-09-21); auto mode refusing
`gh pr merge` as *Merge Without Review* on a green PR with no verdict comment
(#552, 2026-09-22); the maintainer's ruling of 2026-09-23 that the CI review
stays off and is not relabelled on; and the restart itself. A run in another
account would have met each of them again.

So the rules moved into `backlog-item/SKILL.md`, the restart moved into
`.claude/skills/backlog-loop/supervise.py`, a plain process — the one thing
that outlives a session hitting its limit — and the manager became an agent
definition, `.claude/agents/backlog-manager.md`, run as a session's main
thread (`claude --agent`) rather than a skill somebody has to type.
`make loop` runs it headless.

- **The manager carries no `tools:` and no `model:`.** The fork it invokes
  needs `Agent`, `Edit` and `Write`, and whether a forked skill inherits a
  main-thread agent's allowlist was not probed — the CLI available when this
  was written was not signed in. An allowlist could have taken the fork's
  reviewers away, which is the failure that costs most. A model named there
  becomes the session's, which is the one the fork implements on. Probe the
  first before adding either.
- **It reads the driver's procedure rather than restating it.** `backlog-loop`
  is `disable-model-invocation`, so a headless session cannot invoke it; the
  agent reads `backlog-loop/SKILL.md` and follows it, and says only where it
  differs — it schedules nothing, and its result leads with a contract line a
  script can read.
- **`supervise.py` runs with no MCP servers** (`--strict-mcp-config`) for
  `[D-18]`'s reason, and **only in auto mode**, with no setting to change it.
  Auto mode's refusal to merge an unreviewed PR is a control; refusing only
  `bypassPermissions` was not enough, since any other mode can meet an allow
  rule in the account's own settings that skips the refusal, and a supervisor
  that could switch a control off to keep going would be the loop weakening
  a control (found in review, #666).
- **What a headless session returns when a limit kills it was not probed**,
  for the same reason as the allowlist. The supervisor reads the interactive
  wording of 2026-09-13 and an epoch form; an error naming a limit with no
  readable reset waits thirty minutes, and one naming no limit ends the run.
  A session that meets a limit within five minutes of starting did no work,
  and those — not limits in general — are what its restart cap counts, each
  doubling the wait, so a long run is not ended by its ordinary resets and a
  late one is not retried every minute (both found in review, #666). Probe
  the headless form on the first real limit and correct `supervise.py` to it.

### D-43 · A ruling goes in the body; ranking is a person's command — 2026-09-25
Two of the rules `[D-42]` moved out of one account's memory had a cheaper
fix than a rule. A fork re-filed three decided items as needing a decision
(#384, #378, #138) because the ruling was a comment while the body still said
**To decide**, and `next.py` prints the body and not the comments. The
maintainer's first thought was a label saying the item was settled; a label
says *that* it was decided and not *what*, so a fork would still open the
comments to find out. `file.py decided` writes the ruling into the body
instead — a `**Decided (<date>):**` paragraph above the question, which
becomes `**Was to decide:**` — and removes the `decision` label, so one
command settles the item and the fork pays nothing extra to read it. The
comment is still posted, for the record.

Board order stays a person's (`[D-36]`, and the 2026-09-21 case in `[D-42]`).
What changed is that a person may now ask a session to rank: `file.py rank`
moves an item within its status, to the top, the bottom, or beside another
item, by `updateProjectV2ItemPosition`. A fork never calls it — choosing the
order and taking the first item are separate jobs, and the second must not
be able to do the first.

### D-44 · The CI review is removed — 2026-09-26
`.github/workflows/review.yml` ran `anthropics/claude-code-action` with a
credential from a second Claude account of the maintainer's. It was made
opt-in on 2026-09-16 `[D-28]`, disabled in the repository the same day, and on
2026-09-23 the maintainer ruled it stays off and is not to be deleted (#614).
On 2026-09-26 the maintainer asked for it to be removed altogether, which
reverses the "not deleted" half of that ruling.

What it was for is done elsewhere and was already the control: a fresh,
independent review from `.claude/agents/` before every merge, recorded by
`verdict.sh` `[D-40]`. What it left behind was cost with no return — a
credential on an account with no allowance, a label that started nothing, a
file of 300-odd lines that `CLAUDE.md` asked every change to leave alone, and
a rule telling the loop not to use it. It was never a required check on
`main`, so removing it changes no merge gate. The conformance reviewers it
ran are unchanged; the loop and a terminal still use them.

The workflow's history is in git and in its runs. The `ci-review` label and
the repository's Claude secrets are settings, not files, and go with the
maintainer's say-so rather than with this change.
