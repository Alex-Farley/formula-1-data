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

### D-51 · The Wikipedia-cited race rows are bare facts; the prose stays share-alike — 2026-09-30 (`PD-41`, #481; recorded by `PD-52`, #740)
**What was decided.** The rows citing a Wikipedia season article — every
championship race the season harvest covers in `races`, and its winner in
`race_entries` — are bare facts, on the reading
`docs/COMMERCIAL-READINESS.md` already gave the formula1.com rows: results,
dates and positions are not the expression CC BY-SA protects. The ruling's
count also took in the other rows citing Wikipedia outside `claims` and
`driver_note_sources` — in `drivers`, `cars`, `regulation_limits` and
`team_radio` — and the document says how it breaks down; the radio rows
among them are quotations, which stay share-alike as expression. The
Wikipedia-derived prose fields are not facts and keep CC BY-SA 4.0. A CC BY
4.0 facts artefact is to be published beside `f1.db` on the pattern of
[D-07], leaving out the prose and anything else that stays share-alike — the
six radio quotations among them, on the reading; `f1.db` itself stays CC
BY-SA 4.0. The figures are spans in that document, written
from the database, and are not repeated here.

**Why.** Nearly every sourced row cites F1DB under CC BY 4.0, yet the
share-alike on the Wikipedia-cited minority reached the whole release, so a
builder found this project strictly less usable than its principal upstream —
and the part worth having, the cross-checks, `discrepancies` and
`known_gaps`, was the part they could not take cleanly. The reading written
for the decision (`PD-51`, #662) found no prose, expression, selection or
arrangement of Wikipedia's on those rows: a result is the sport's, not an
editor's, and database copyright needs selection or arrangement that is its
author's own intellectual creation (CDPA 1988 s.3A; *Football Dataco v
Yahoo!*, C-604/10). F1DB states every one of the same facts, and the winner
cross-check refuses a race where the two disagree.

**Rejected.** Relicensing `f1.db` whole, because it waits on the prose pass
(`PM-17`, #249). Stating CC BY-SA as permanent, because it leaves the project
strictly less usable than its upstream.

**Not decided here.** The database right: whether one reaching these rows
subsists is unsettled and turns on facts about Wikipedia's makers that nobody
holds, so whether the artefact stores the race rows as they are or rebuilds
them from F1DB is open, as is which other Wikipedia-touched sets (`claims`,
`driver_note_sources`, the column-level values the document lists) it may
carry. Those are measured first under `PD-53` (#741). **Nothing is offered
under CC BY 4.0 until `PD-53`, `PD-54` (#742) and `PD-55` (#743) ship**;
until then `LICENSE-DATA` is unchanged and every row ships CC BY-SA 4.0.

An unattended run's attempt to write this down, on 2026-10-03, was refused by
the permission classifier as weakening a control. Recording a ruling the
maintainer has made is not that, but the classifier cannot tell a ruling from
a fork's own reading, which is the point of it; the maintainer approved the
record on 2026-10-05 (#740) and it was made then.

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

### D-50 · The stall watchdog watches the model, not the tools — 2026-10-03 (`AF-84`, #760)
Four forks were stopped with `Agent stalled: no progress for 600s (stream
watchdog did not recover)`: on 2026-09-30 (DA-13), twice on 2026-10-01
(AF-78, CR-62) and on 2026-10-02 (CR-55, after its first review). Three were
near a slow `make all`, and AF-84 proposed that a fork run builds in the
background and check on them with short foreground calls, measuring first
that a short call resets the watchdog.

The measurement said the watchdog is not about tool calls at all. Across the
142 fork transcripts then on disk (4,491 tool calls), 81 foreground calls ran
past 600 s, the longest 1,270 s, and none of them was followed by a kill. In
all four kills the last thing in the transcript is a tool result that had
already come back — a 1.5 s `gh issue view`, a 0.6 s `tail`, a 0.6 s
background launch, and a 6-minute wait loop that had finished — followed by
10 to 17 minutes of nothing until the kill. What stalled was the model
request after the tool, not the tool. A slow model phase is not itself fatal:
one fork went 1,134 s between a tool result and its next message, longer
than any of the four silences before a kill, and carried on, so the watchdog
fires on a stream that delivers nothing, not one that is slow. Why the stream
delivered nothing is not established. On 2026-10-02 the Mac running the loop
had 10.3 of 11.2 GB of swap in use, and another fork that day logged `Your
computer went to sleep mid-response`; 26 long tool calls overran their own
600 s timeout by more than a minute, which a suspended machine would also
explain. Memory pressure, sleep or the network, it is outside the fork, and
the two rules below hold for each.

So short foreground checks would not have saved any of the four, and the
item skill says the opposite: wait on a slow build in the foreground, as on
CI. What the loop can do is not lose the item. The driver treats a stall as
the environment and invokes the fork once more with the same arguments; the
new fork's `start-check.sh` shows the stalled one's worktree, and the
inheritance rule finishes it. A second stall in a row stops the loop.

### D-52 · A fork holds an item on a person's decision rather than stopping the loop — 2026-10-05 (`AF-85`, #780)
On 2026-10-03 the permission classifier refused PD-52's (#740) edits to the
licence record as weakening security. The fork returned `STOP`, so the whole
loop ended although nothing was half-done, and it put #740 back at *Next*
without the `decision` label, so `next.py` would have handed the same item
to every restart until a person labelled it by hand. Two rules in the item
skill pulled against each other: a person's decision goes on the item "and
the work continues around it", and the fork stops "when a decision is a
person's".

The ruling is one sentence: stop on a decision only when it cannot be held.
A hold is the refused change not happening, the question on the issue with
`file.py decision`, the items that build on it made to wait, the repository
left clean with nothing lost, and a `DECIDE <ID>: <question>` line back. The
driver carries on with `next`. Nothing routes around the classifier: the
edit it refused is not made by another path, and the question waits for a
person, which is where a refusal of that kind belongs anyway. `STOP` stays
for danger a hold cannot leave behind — something already merged or
published, a state that cannot be left clean, a question whose record could
not be written.

A hold is not a skip. Two skips of unrelated items in a row are the
environment; two holds are two questions. But a classifier, or a rule,
that refuses every item would label the queue `decision` one fork at a time,
which is a broken environment wearing the clothes of a decision, so three
holds with no merge between them stop the loop.

The dependants are GitHub's own *blocked by* relationship rather than a
label. PD-53 to PD-55 build on PD-52, and the next fork could have taken
PD-53 and met the same question. A `decision` label on each would have to
come off by hand once PD-52 was ruled on and had landed, and a person ruling
on one item would not know three others carried its label. A dependency
lifts on its own when the item it waits on closes. `next.py` reads it as
`issueDependenciesSummary { blockedBy }` in the board query it already
makes — a scalar beside the number rather than a `blockedBy` connection
under each of the board's items, which is the expensive kind of read
`[D-27]` — and `file.py blocked-by` writes it with `addBlockedBy`.

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

### D-49 · A security review, on a path list rather than on all code — 2026-09-29
The maintainer asked for a `security-reviewer` beside the other conformance
reviewers, to run on changes that touch code, workflows, dependencies or
config and to skip data-only ones. Nothing on the merge path read for it: the
licence reviewer reads a workflow for what it publishes, not for what its
token can do, and no reviewer read a lockfile at all.

Taken literally, "code" is nearly every pull request, and that would put a
second Opus reviewer at `effort: high` on almost every item — against *Two
reviewers are the exception, not the rule*, and roughly doubling the review
cost of an item. The maintainer chose a path list instead, the way the
licence reviewer's trigger is written: the workflows, the dependency
manifests and lockfiles, `wrangler.jsonc`, the headers `prepare-assets.js`
writes, the SQL worker and `lib/sql.js`, the `Makefile` and the Claude
settings — plus any diff that adds an HTML sink, or network, subprocess or
environment access to the build, which a grep of the diff settles. The list
is in `.claude/skills/backlog-item/SKILL.md` and nowhere else.

It runs at `effort: high` for the D-33 reason: the private key `refresh.yml`
holds and the `contents: write` token `release.yml` holds are used by
whoever gets them before anybody notices, and a merge to `main` deploys.
It FAILs only on a blocker, and a finding it could not establish is never
one, so an item does not stall on a possibility.

Four things the survey for it found against `main` were filed as issues
rather than folded into the change: no Content-Security-Policy is set
anywhere (`AF-76`, #719); every action is pinned to a major tag rather
than a commit (`AF-77`, #720); `refresh.yml` leaves the App's token in
`.git/config` while `npm ci` runs (`AF-78`, #723); and `release.yml`
interpolates its dispatch input into a shell script (`AF-79`, #724).

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

### D-45 · The refresh lands by pull request, not by push — 2026-09-28
`refresh.yml` committed straight to `main` with `GITHUB_TOKEN`. Once the
repository went public, branch protection on `main` began to require
`ci.yml`'s four checks with admins included, and a push can't carry checks.
From 2026-09-22 every run built, verified and passed everything, and was then
refused at the push (GH006). The 2026-09-26 Azerbaijan Grand Prix sat in
F1DB, unpublished, behind it. (On 2026-09-27 a second fault surfaced as
well: tests with round 14 typed in, fixed in #690.)

The maintainer chose between two fixes on 2026-09-28. **Chosen:** the refresh
commits to one fixed branch, `refresh/f1db`, opens a pull request and enables
auto-merge, so it merges when the required checks pass and not before
(`.github/scripts/land-refresh.sh`). **Declined:** letting the workflow
bypass the protection. That would remove the gate from the one change that
arrives unattended.

What it costs. The pull request has to be opened with a GitHub App's token,
because GitHub starts no workflow from `GITHUB_TOKEN`'s pushes and the
required checks would never report. That token is one credential the
maintainer holds (`REFRESH_APP_ID`, `REFRESH_APP_PRIVATE_KEY`). The daily
heartbeat (`SD-25`) is now also a pull request, one a day. Repository
auto-merge is on for this purpose. It merges nothing a person could not, and
nothing before the checks pass.

The same change moved the schedule to every three hours. A gate job stops
every run except the day's first, a run started by hand, and runs within 72
hours of a session in the `sessions` table, so a race weekend is followed
without anyone editing a cron line (`.github/scripts/refresh_gate.py`).

### D-46 · Practice comes from F1DB, and its Friday drivers join the register — 2026-09-28
`LV-03` (#185) asked for each session of a weekend as soon as it has run. Three
sources were looked at, in the order the maintainer asked:

- **formula1.com's results pages.** FOM's site; `facts-only` under the
  condition of no substantial extraction, and a whole season's sessions is the
  nearest thing to extracting FOM's results database. Not used.
- **The FIA's classification PDFs.** Read on 2026-09-28 (Baku FP1, qualifying
  and race; Australia FP1; the Dutch sprint and sprint qualifying). The FIA
  supplies only the covering sheet: every classification page is "© 2026
  Formula One World Championship Limited" with a notice that no part may be
  reproduced or stored without permission, press within 90 days excepted. The
  same owner as formula1.com, stated more plainly. Not used, and the copies
  read were deleted.
- **F1DB.** Publishes every practice session from 1986 and sprint qualifying
  from 2023 under CC BY 4.0, in the repository the refresh already clones, and
  had Baku FP1 in it under six hours after the session began. Used.

The practice sheets name 53 drivers who never started a race. The maintainer
ruled the same day that they go in the register and are shown as never having
started. They are admitted from an authored list (`F1DB_PRACTICE_DRIVERS`),
one reviewed line each, because "nothing is created from a bulk feed" is the
register's rule; `drivers.practice_only` is derived from the tables rather
than stamped on the list, so it also marks Susie Wolff, in the register since
before; and every figure the site labels "drivers" counts those who entered a race.

What this rests on, and is the maintainer's to confirm: F1DB's practice sheets
are almost certainly compiled from the same FOM classifications the two
declined sources publish. Taking them through F1DB relies on the reading the
`qualifying` table already rests on — that F1DB's provenance is F1DB's to
represent, and is represented by its licence (`COMMERCIAL-READINESS.md`) —
and this takes F1DB-carried session classifications from about 27,000 rows
to about 69,000. The licence review of #185 passed the diff and asked that
this be read once by a person rather than assumed.

Cost: 31% on the compressed database the site sends (4.97 MB to 6.53 MB).

*2026-09-29.* The warm-up (1984-2003) and pre-qualifying (1977-1992) joined
`practice` as two more sessions, from the same F1DB files, as the maintainer
asked when the gaps were listed. `practice_only` now also requires no
qualifying row. Not for the drivers who went no further than pre-qualifying,
as first written: `race_entries` holds their DNPQ rows, which already keep
them out, and the flagged set is the same 54 either way (review of #714). It
is for a driver on a debut weekend caught between qualifying and the race,
with a qualifying row and no race entry yet, who is not a Friday driver.

The reliance above was confirmed by the maintainer on 2026-09-28, in the
session that merged #707. With these two sessions it covers about 77,000
F1DB-carried session rows - qualifying from 1950, sprint qualifying from
2023, and practice, warm-up and pre-qualifying from 1977 - under the same
CC BY 4.0 licence.

### D-47 · The site serves f1.db.gz, and the raw file is the repository's — 2026-09-28
Cloudflare Workers will not host a single static file over 25 MiB
(26,214,400 bytes), and a deploy carrying one fails whole. The site staged
the raw `f1.db` beside `f1.db.gz` as a fallback for a browser without
`DecompressionStream`; it was 23.8 MB, and `LV-03` (#707) took it to 30.6 MB.
Every check in CI was green, #707 merged, and the Cloudflare build failed —
nothing new could deploy, refreshes included, while the site kept serving the
last good build. Nothing in the repository knew the limit.

The maintainer chose, the same day, to stop hosting the raw file rather than
to trim practice to recent seasons or revert. So: `prepare-assets.js` stages
`f1.db.gz` only; the loader tells a browser without `DecompressionStream` —
none since early 2023 — what it lacks instead of fetching a fallback; the
data and SQL pages offer `f1.db.gz` with one `gunzip`, and the uncompressed
file from the repository (`RAW_DATABASE_URL`), which is the committed copy
`main` deploys from. The workflows' `cmp` of `dist/f1.db` becomes the
existing proof that `dist/f1.db.gz` decompresses to the built database — now
in `refresh.yml` too — and a new check that no file in `dist` exceeds 25 MiB,
which is the check that would have stopped #707.

The limit binds `f1.db.gz` too, at about four times today's 6.5 MB.

### D-48 · The API is static JSON, written at build time — 2026-09-29
The maintainer asked for API access on 2026-09-28, alongside D-47, and chose
static JSON over a live endpoint. `web/scripts/api.mjs` runs last in
`npm run build` and writes `/api/v1/…` beside the pages from the same
`f1.db`: an index, a list and one file each for drivers, constructors,
circuits and seasons, and one file per race weekend carrying every session's
sheet. Every file carries the licence, the version and the database's
SHA-256, because a file is read far from the page that explains it.

Why not a live endpoint: every query on this site runs in the reader's
browser, and there is no server. One would be a running service with a cost,
a rate limit and an abuse problem, for data that moves a few times a week.
Files cannot disagree with the pages, because they are written from the same
database in the same build.

What it costs: about 2,400 files and 84 MB per deploy. Cloudflare allows
20,000 files per deployment, and the workflows now check that number beside
the 25 MiB per-file limit of D-47. The rows are `SELECT *`, so a column added
to a table arrives without an edit — and a column removed disappears from the
API without one, which is why the path is versioned.
