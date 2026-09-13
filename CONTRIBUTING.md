# Working on this database

## The one rule

**Never edit `f1.db` directly.** It is generated. `build.py` drops and rebuilds
it from scratch every run, so a hand-edit lasts until the next build and then
vanishes silently.

The source of truth is `data/*.py` and `harvest/*.txt`. Edit there.

```
data/*.py  +  harvest/*.txt          the sources you edit
        |
        v  python3 build.py          drops and rebuilds f1.db
     f1.db
        |
        v  python3 verify.py         the checks; exit 1 on failure
        v  python3 audit.py          structural health report
        v  python3 export_json.py --compat
     f1_compat.json
```

Or just `make all`.

## Where things live

| File | Holds |
|---|---|
| `data/seasons.py` | Champions, runners-up, season summaries |
| `data/drivers.py` | Driver register, verified career figures |
| `data/teams.py` | Constructors and lineage chains |
| `data/circuits.py` | Circuit register, layout timelines, race-layout overrides |
| `data/cars.py` | Car register, specs, `CAR_SEASONS`, `EXPECTED` |
| `data/events.py` | The canonical 53 Grands Prix, aliases, single-circuit map |
| `data/technical.py` | Regulations, innovations, engine eras, safety, points systems |
| `data/current.py` | The current season: entry list, standings, calendar |
| `data/people.py` | Designers, principals, officials |
| `data/radio.py` | The curated notable team radio |
| `data/harvest.py` | Loaders and name-resolution for the harvest files |
| `harvest/races.txt` | `year\|round\|gp\|winner\|constructor` |
| `harvest/poles.txt` | `year\|round\|pole\|fastest_lap\|winner` |
| `harvest/venues.txt` | `year\|round\|venue\|winner` |

Four more harvest files are **generated, not written**. They carry a header
saying so, and editing one by hand is the same mistake as editing `f1.db`:

| File | Holds | Written by |
|---|---|---|
| `harvest/chassis.txt` | Every chassis that has raced | `tools/f1db_fetch.py` |
| `harvest/engines.txt` | Every engine, with capacity/config/aspiration | `tools/f1db_fetch.py` |
| `harvest/f1db_constructors.txt` | Constructor names, for the spec cross-check | `tools/f1db_fetch.py` |
| `harvest/entrants.txt` | Season → entrant → constructor → chassis/engine/tyre | `tools/f1db_fetch.py` |
| `harvest/car_specs.txt` | Chassis specifications off the per-car articles | `tools/wikispec_fetch.py` |
| `harvest/car_specs.log` | Every chassis refused, and why | `tools/wikispec_fetch.py` |

`python3 tools/f1db_fetch.py --check` regenerates in memory and tells you
whether the committed files still match F1DB.

Harvest files are plain pipe-delimited text on purpose: they diff cleanly, so
a data correction shows up as one readable line in a pull request.
`harvest/append.py` adds rows, checks the field count and flags duplicate
`(year, round)` pairs:

```bash
python3 harvest/append.py venues.txt 4 < new_rows.txt
```

## Adding data

**Every fact needs a `confidence` and, where there is one, a `source`.** The
ladder is `verified` > `high` > `reference` > `medium` > `unverified`.
`verified` means an official FIA or formula1.com source — nothing is promoted
to it without one.

If you cannot establish a figure, leave it `None`. A NULL means "not
established". It never means zero, and it is always better than a guess.

## Harvesting

The method that has caught every error in this project:

1. Harvest a structured table that **also contains a fact you already hold** —
   the race winner.
2. Reject any row whose known fact disagrees with what is stored. The build
   fails; it does not warn.
3. Reconcile the derived aggregates against independently held totals.

**The cross-checked fact must actually constrain the value you are
harvesting.** The winner constrains which race a row describes. It does not
constrain the chassis: a trial harvest of 1952 returned "Ferrari 125 F2" for
races Ascari won in a Ferrari 500, and every winner matched. Where your check
does not constrain the value, find a second table that does, or do not store
the value.

That is what F1DB's per-season entry lists now provide for the chassis, and
they show what a constraining check looks like in practice — including where
it stops. They say which chassis a constructor ran in a *season*, never which
it ran in a *round*, so they settle a constructor-season that used one design
and settle nothing at all about one that used two. Ferrari in 1952 entered
five different chassis and gets no link. **A check that constrains the value
in some cases and not others must be applied case by case, not in aggregate**
— the temptation to link 1952 anyway, because you happen to know Ascari drove
a 500, is exactly the inference the rule exists to stop.

The same rule kills a whole class of modern figure. A weight quoted for a
2023 car is almost always the season's regulation minimum: it describes the
rule, not the car, and no cross-check can turn it into a measurement. Those
go in `regulation_limits`, and the car field stays NULL.

## Never move bulk data by hand

Harvest files are for data you can read and check line by line. Thousands of
rows from an API are not that, and must come through a loader —
`tools/ergast_load.py` or `tools/fastf1_load.py` — which fetches and writes
without a human in the middle.

This is not a style preference. During v2.7 an API harvest was relayed by
hand and rows were typed from memory to fill gaps between paged requests.
Four of five sampled 2008 third places were fabricated. The only reason it
was caught is that the derived podium counts were reconciled against official
figures and Hamilton came out one short. If you find yourself typing result
rows into a heredoc, stop and write a loader.

## Adding checks

`verify.py` is the point of the project. If you add data that can be
cross-checked against something else in the database, add the check. Use
`check()` for a hard failure and `warn()` for something to keep an eye on.

The strongest checks here compare two things derived by different routes:
every driver's wins against the race records, every car's derived wins against
its published career total, every circuit's authored first/last GP against the
races stored at it.

## When sources disagree

Do not pick one silently. Record the disagreement in
`data/harvest.py: DECLARED_DISCREPANCIES`, and if you resolve it, record the
resolution in `CORRECTIONS` with the reasoning. `./f1 gaps` prints both.

## Before opening a pull request

```bash
make all        # build, verify, export
python3 audit.py
make lint       # Ruff, Biome, actionlint — what CI's lint job runs; see ruff.toml
```

Add `QUIET=1` to any make target — `make ci QUIET=1` — for failures, warnings
and a count instead of one line per check; the front end's equivalents are
`npm test -- --quiet` and, for one page's smoke sections, `npm run test:page
-- /drivers`. Same checks, same exit codes, a fortieth of the output.

`verify.py` must exit 0. Commit the regenerated `f1.db` and `f1_compat.json` —
CI fails if the committed export does not match a fresh build. `f1_database.json`
is **not** committed: it is 21 MB, it does not delta-compress, and it
regenerates in about a second, so it goes out as a release asset instead.

## Working autonomously

The same rules apply when an agent works through the backlog unattended.
These are the ones that exist because the person is not there.

**The queue.** `docs/BACKLOG.md` is the canonical list of work, and its own
header says how an item is written, sized, landed and declined. Before
starting one, reassess it against the repository as it is now: the code it
names may have moved, the fix may have landed under a different ID, a later
critique may have superseded it, or a smaller change may now do. Work
discovered along the way is filed back into the backlog under the existing
ID, source and size conventions. There is no second list.

**Facts.** A factual or data change is verified against an authoritative
source before it is made — official FIA, Formula 1, team, driver, power-unit
manufacturer or circuit/promoter publications first, then the sources
`SOURCE_LICENCE` already classifies. A source that is not classified is not
used. A value nobody can establish stays NULL. Two sources that disagree are
declared in `DECLARED_DISCREPANCIES`, which lands in `discrepancies`, never
chosen between silently; a fact nobody holds is recorded in `known_gaps`.
Never invent one.

**Artefacts.** `make all` — not `make check` — before any commit that touches
`data/`, `harvest/`, `build.py`, `schema.sql`, `verify.py` or an exporter, so
`f1.db`, `f1-geometry.db` and `f1_compat.json` are regenerated together.
Inspect the artefact diff before committing. Nothing generated is edited.

**Review.** Every autonomous pull request receives an independent review
from a fresh context before it merges, using the relevant definitions in
`.claude/agents/` — `licence-reviewer`, `data-integrity-reviewer` and
`frontend-reviewer` for a diff; the critics for a whole area. The reviewer is
given the task, the rules that apply, the diff, the provenance of any fact,
and the test and validation results, and is asked to disprove the work. It
returns `PASS — safe to merge` or `FAIL — changes required`, with blocking
findings named. The agent that made the change does not approve it. A FAIL
is corrected, `make all` is run again, and a fresh-context review of the
fix is obtained; this repeats until PASS. Silence, an interrupted reviewer
or an unavailable review account is not a PASS. Which model reviews what,
and the one case in which a post-PASS fix merges without a further pass -
a fix that is only documentation wording, a blank line or a comment, named
in the PR comment - were decided by the maintainer on 2026-09-13 to control
review cost and are set in `.claude/skills/backlog-loop/SKILL.md`: Opus for
a first pass, a fresh Sonnet context to confirm a fix or review a
wording-only change.

`.github/workflows/review.yml` runs the same kind of review on GitHub, on a
credential that is at present exhausted. Its red check is an infrastructure
condition, not a defect in the pull request, and it is never retried, edited,
weakened or bypassed to make the loop succeed. Its protection against
reviewing a pull request that edits it stays.

**Merging.** A pull request merges only when the change is complete, the
tests pass, `make all` succeeded, the fresh-context review returned PASS and
the required CI checks are green. Merging `main` deploys lapledger.org through
Cloudflare Workers Builds, so a merge is a production change. Afterwards the
backlog is updated the way its header says: landed items move to *Landed*
with the commit, declined items to *Declined* with the reason, nothing is
deleted.

**Blockers.** An ordinary one — a network failure, a service outage, a
missing non-critical credential, an environment-specific failure — is
recorded, the repository is left in a safe state, and work moves to the next
viable item rather than retrying the same operation. A dangerous one stops
the loop: anything that could corrupt data, compromise security, breach a
licence, make a destructive or irreversible production change, or lose
repository history. A CI or test failure is distinguished from an
environmental, credential or external-service failure before it is acted on.

**What is never changed to make the loop succeed:** production
infrastructure, Cloudflare DNS, credentials, branch protection, repository
visibility, billing, licence controls, the source classification, the
redistribution checks, or `review.yml`.

## What not to commit

Anything from `tools/fastf1_load.py`. The `laps`, `stints`, `pit_stops`,
`race_control_messages` and non-notable `team_radio` rows are Formula One
Management's data, they are large, and they are meant to be loaded locally.
`.gitignore` covers the cache and the Parquet dumps; the tables themselves are
empty in a fresh build, so as long as you rebuild before committing, you are
fine.
