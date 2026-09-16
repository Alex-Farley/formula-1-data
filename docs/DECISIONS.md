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
Every MCP server's tool schemas sit in the fixed prefix of every turn — about
74,000 tokens before any work in the measured sessions — and they ride on the
fork and on every reviewer it launches. The loop uses none of them.

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
