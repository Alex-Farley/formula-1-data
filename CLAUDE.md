# Working on this repository

A SQLite database of Formula One, 1950–2026, built from Python literals in
`data/*.py` plus pipe-delimited files in `harvest/`, with a React front end
that queries `f1.db` in the browser via sql.js. The build has no third-party
dependencies.

Every rule below carries a one-clause reason. The full story — what went
wrong, when, what was measured — is `docs/DECISIONS.md`, entry by entry.
**Read the `[D-nn]` entry before proposing a change to the rule that cites
it, and not otherwise.** The pattern underneath all of them: *every deviation
is declared, with a reason, and the build refuses anything undeclared.*

## Commands

`make all` before every commit, never `make check`: `check` skips `export`,
so it leaves `f1_compat.json` stale, and CI compares the committed copy
against a fresh one `[D-03]`. Then `make ci` on the staged result — that is
what CI's Python job runs, in its order, including the comparison of the
committed artefacts against a fresh build, so run it after staging a rebuild,
not before.

`make lint` (Ruff, Biome, actionlint) is a **separate CI job that nothing
else here runs** `[D-04]`. It belongs in the local order too. Ruff is not on
`PATH` on this machine; use `python3 -m ruff check`.

The front end has its own: `cd web && npm test`. Use the quiet forms —
`QUIET=1`, `--quiet` — which keep every exit code and print failures and a
count rather than a line per check `[D-25]`.

## The build is the test

Never edit `f1.db` by hand. Edit `data/*.py`, run `python3 build.py`, and let
`verify.py` gate it. A fact that cannot survive the cross-checks does not go
in.

`BUILT` in `build.py` is deliberately a constant, not `date.today()`: the
database must be a pure function of its sources `[D-01]`. Do not "fix" it.

## Generated artefacts are regenerated, never merged

Three are committed: **`f1.db`**, **`f1-geometry.db`**, **`f1_compat.json`**.
(`f1_database.json` is *not* — it is gitignored and published as a release
asset instead, being 21 MB that does not delta-compress.)

`f1.db` and `f1-geometry.db` come from `build.py`; **`f1_compat.json` comes
from `export_json.py --compat`**, which is why a rebuild alone does not
refresh it.

A fourth is half-generated: every count **`README.md`** states about the
database is a marked span that `tools/readme_figures.py --write` rewrites
from `f1.db` (`make all` runs it) and `verify.py` checks. Edit the prose,
never a figure inside a span; a figure that disagrees with the database fails
the build, which is the point.

**Never type a figure into database prose.** Prose in `data/*.py` that states
a count of this database's own rows writes it as a `{{fig:name}}` token;
`build.py` expands it off the counts in its final stage and `verify.py`
re-expands the literal and compares whole `[D-39]`. Adding a figure means
adding its one expression to `FIGURES` in `tools/prose_figures.py`. A figure
about another source's holdings, or one `verify.py` already pins as an
invariant, stays typed where it is checked.

**Inspect the artefact diff before committing.** A rebuild that moved more
than the change explains is the first sign something else moved with it.

On any merge conflict in a committed artefact: **take either side, rebuild,
commit the rebuild.** Never resolve one by hand. Both databases are
byte-stable across rebuilds, and `ci.yml` checks the committed copies against
a fresh build.

## Never hardcode a column list against `circuit_geometry`

Derive the columns from `PRAGMA table_info` or `sqlite_master`, the way
`build.py` does when it moves the geometry rows out. Writing them out has
already silently dropped three columns once `[D-02]`.

## Licence classes are machine-readable

`SOURCE_LICENCE` in `data/current.py` classifies all 16 sources as `yes`,
`facts-only` or `no`. The build **refuses an unclassified source**, and
`verify.py` fails on any row citing a `no` source `[D-08]`. `./f1 licences`
prints the current position. Adding a source means classifying it; there is
no default.

## Four tables stay empty; two are checked by source

`laps`, `stints`, `race_timing` and `race_control_messages` hold FOM-owned
data and must contain **zero rows**. `pit_stops` may only carry `f1db`;
`team_radio` may not carry `fastf1` (the six committed exchanges are quoted
from Wikipedia).

`F1_LOCAL_TIMING=1` downgrades these failures to warnings for local work with
the timing loaders. **Never in CI, and never commit a database built with
it** `[D-06]`. The empty `laps` table is a licence decision, not a missing
feature — `docs/TIMING-ARCHITECTURE.md` before reopening any of it.

## ODbL geometry ships separately

`f1.db` must contain **no OpenStreetMap data**; `circuit_geometry` in it is
deliberately empty. The centrelines ship as `f1-geometry.db` alongside it,
because two databases distributed together are a *Collective Database* under
ODbL and merging them would put 117,000 unrelated rows under share-alike
`[D-07]`.

For local work: `tools/geometry_overlay.py --apply` / `--remove`. A merged
local copy is fine to hold — it is simply not the file to publish. The
browser merges the overlay at runtime. **Anything that publishes `f1.db` must
publish `f1-geometry.db` beside it.**

## One attribution rule

`attribution()` and `canShow()` in `web/src/lib/commons.js`. Any surface
showing a Commons file imports `CommonsCredit` or `CommonsImage`, and fails
closed — no attribution, no image. `web/test/smoke.mjs` enforces this and has
already caught one real regression.

## One country vocabulary

The F1DB registry, with `COUNTRY_ALIASES` and `COUNTRY_EXCEPTIONS` in
`build.py`. Three tables name a country and they must agree; the drivers page
builds its filter from the distinct values, so a split vocabulary is visible
to readers, not cosmetic.

## Releases

`VERSION` in `build.py` becomes `meta.version` in both databases. A tag must
match it — `release.yml` checks this before building, because nothing
downstream reads that field and a mismatch would publish silently. Bump
`VERSION`, rebuild so `meta.version` agrees, then tag `v<VERSION>`.

`SHA256SUMS` must digest the files actually uploaded, including the
compressed export rather than the original.

## Declared deviations — do not quietly erase them

Rhodesia, the three dual-country constructors, the six radio quotations, and
every open row in `discrepancies` are each a decision on the record, not an
oversight a tidying pass should remove. The count is deliberately not written
here `[D-05]`; `verify.py` reports the live figure. `discrepancies` and
`known_gaps` are where a fact that does not fit goes, and adding a row there
is a legitimate outcome.

## Deploy-time steps go in the npm chain

`web/package.json` -> `prepare-assets.js`, `parquet-bundle.mjs`, vite,
prerender. That chain is what Cloudflare demonstrably runs; it is what puts
`f1.db.gz` on the site. **A build step whose execution you cannot establish
is worth less than no build step** `[D-09]`.

Anything non-fatal in that chain must report where it can be read — build
logs are off for this project, so a silent failure is invisible `[D-10]`. The
Parquet step writes `public/build-status.txt`, served at `/build-status.txt`,
on success as well as failure.

The deploy does **not** rebuild the database or re-run `verify.py`; `ci.yml`
does both on every push, so CI is the gate. Do not move it to the deploy
`[D-11]`.

## Working autonomously

GitHub Issues, ranked on the Lap Ledger project board, **is the queue and
nothing else is** `[D-14]`. The conventions — id, source, size, how an item
lands, is declined or is blocked — are in `CONTRIBUTING.md` under *The
queue*. `docs/LANDED.md` is the record of what landed and what was declined
before the queue moved.

**The whole per-item procedure lives in one place:
`.claude/skills/backlog-item/SKILL.md`.** The review policy, the pace table,
grouping, the stop conditions and what never slides are set there and are not
restated anywhere else. The loop is a skill, invoked on purpose rather than
run by default: `/backlog-loop next`, `/backlog-loop <ITEM-ID>` or
`/backlog-loop until-paused`, with an optional pace. Every item runs in a
forked context, because the driving session — not the reviewers — was 75–85 %
of the loop's tokens `[D-16]`.

Four things are worth having in front of you before you start, because each
one has cost this project an item:

- **A fact needs a source before it needs a line of code.** Official FIA,
  Formula 1, team, driver, power-unit or circuit sources first, then the
  classified secondary ones. Never invent a missing value: NULL means *not
  established*, a fact two sources disagree on goes in `discrepancies`, and a
  fact nobody holds goes in `known_gaps`.
- **Work you discover is filed as an issue**, under the conventions in
  `CONTRIBUTING.md`, never into a note, a TODO or a second list. A finding
  against the diff in hand is not discovered work — it is fixed on that diff
  `[D-15]`.
- **Merging `main` deploys lapledger.org.** Cloudflare Workers Builds runs on
  every push to `main`, so a merge is a production change.
- **Skip an ordinary blocker; stop on a dangerous one.** A network failure,
  an unavailable service or a missing non-critical credential is recorded and
  worked around. Anything that could corrupt data, breach a licence, weaken a
  safeguard, change production infrastructure — as distinct from deploying
  through it by merging — or lose history stops the loop.

**Never weaken a control to keep going.** Not the checks, not the workflows,
not branch protection, not repository visibility, not the licence
classification, and not `review.yml`'s refusal to review a pull request that
edits it. Changing one of those is a maintainer's decision, taken
deliberately and in the open — never a step on the way to something else.

## Measured and rejected — do not re-propose

Route-level code splitting `[D-12]`. An HTTP range-request VFS `[D-13]`.
`BUILT` as a real timestamp `[D-01]`. The track atlas `[D-29]`. Raising
`NOISE` in `next.py` to group on a hot file `[D-34]`. Restricting the fork's
tools through skill frontmatter `[D-32]`, and lowering its effort the same way
`[D-35]` — for both, re-probe before re-proposing; the keys were inert when
tested, and `[D-35]` names the probe that would settle it.
