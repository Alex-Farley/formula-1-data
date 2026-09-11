# Working on this repository

A SQLite database of Formula One, 1950–2026, built from Python literals in
`data/*.py` plus pipe-delimited files in `harvest/`, with a React front end
that queries `f1.db` in the browser via sql.js. The build has no third-party
dependencies.

`make check` is build + verify + unit tests, and is what CI runs. The front
end has its own: `cd web && npm test`.

**Before committing, run `make all`, not `make check`.** `check` does not
run `export`, so it leaves `f1_compat.json` stale — and CI compares the
committed copy against a fresh one. Anything that changes `VERSION` or the
data changes that file too.

The conventions below are not style preferences. Each one exists because
something went wrong without it, and most are enforced by the build or by
`verify.py`. The pattern underneath all of them: **every deviation is
declared, with a reason, and the build refuses anything undeclared.**

## The build is the test

Never edit `f1.db` by hand. Edit `data/*.py`, run `python3 build.py`, and let
`verify.py` gate it. A fact that cannot survive the cross-checks does not go
in.

`BUILT` in `build.py` is deliberately a constant, not `date.today()`. The
database must be a pure function of its sources so CI can compare the
committed artefact against a fresh build, and so the browser can cache on a
digest. Do not "fix" it.

## Generated artefacts are regenerated, never merged

Three are committed: **`f1.db`**, **`f1-geometry.db`**, **`f1_compat.json`**.
(`f1_database.json` is *not* — it is gitignored and published as a release
asset instead. It is 21 MB and does not delta-compress.)

`f1.db` and `f1-geometry.db` come from `build.py`; **`f1_compat.json` comes
from `export_json.py --compat`**, which is why a rebuild alone does not
refresh it.

On any merge conflict in a committed artefact: **take either side, rebuild,
commit the rebuild.** Never resolve one by hand. Both databases are
byte-stable across rebuilds, and `ci.yml` checks the committed copies against
a fresh build.

## Never hardcode a column list against `circuit_geometry`

This has already bitten the project once: three places wrote out twelve
columns, `main` added three more, and every copy would have silently dropped
them. Derive the columns from `PRAGMA table_info` or `sqlite_master`, the way
`build.py` does when it moves the geometry rows out.

## Licence classes are machine-readable

`SOURCE_LICENCE` in `data/current.py` classifies all 16 sources as `yes`,
`facts-only`, or `no`. The build **refuses an unclassified source**
(`build.py`, where it assembles `source_registry`), and `verify.py` fails on
any row citing a `no` source. `./f1 licences` prints the current position.

Adding a source means classifying it. There is no default.

## Four tables stay empty; two are checked by source

`laps`, `stints`, `race_timing` and `race_control_messages` hold FOM-owned
data and must contain **zero rows**. `pit_stops` may only carry `f1db`;
`team_radio` may not carry `fastf1` (the six committed exchanges are quoted
from Wikipedia).

`F1_LOCAL_TIMING=1` downgrades these failures to warnings for local work with
the timing loaders. **Never in CI, and never commit a database built with
it.** `ci.yml` runs `verify.py --redistribution-only` against the *committed*
database before the rebuild, because that is the only moment a bad commit is
catchable.

See `docs/TIMING-ARCHITECTURE.md` before reopening any of this — the empty
`laps` table is a licence decision, not a missing feature.

## ODbL geometry ships separately

`f1.db` must contain **no OpenStreetMap data**; `circuit_geometry` in it is
deliberately empty. The centrelines ship as `f1-geometry.db` alongside it.

Two independent databases distributed together are a *Collective Database*
under ODbL and the share-alike does not reach across; merging them makes a
*Derivative Database* and would put 117,000 unrelated rows under ODbL.

For local work: `tools/geometry_overlay.py --apply` / `--remove`. A merged
local copy is fine to hold — it is simply not the file to publish. The browser
merges the overlay at runtime.

**Anything that publishes `f1.db` must publish `f1-geometry.db` beside it.**
Omitting it ships zero centrelines with no way to obtain them.

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
here: it said "14" for exactly one day before two `fastest lap` rows were
filed, and nothing checks a number in this file. `verify.py` reports the live
figure. `discrepancies` and `known_gaps` are where a fact that does not fit
goes; adding a row there is a legitimate outcome.

## Deploy-time steps go in the npm chain

`web/package.json` -> `prepare-assets.js`, `parquet-bundle.mjs`, vite,
prerender. That chain is what Cloudflare demonstrably runs; it is what puts
`f1.db.gz` on the site.

There was a `tools/cloudflare-build.sh` and it is gone. The dashboard's
build-command field named it, the build log announced the npm chain, and three
deploys were spent putting a step into a file that never executed. **A build
step whose execution you cannot establish is worth less than no build step.**

The deploy does **not** rebuild the database or re-run `verify.py`. `ci.yml`
does both on every push and compares the committed artefact against a fresh
build, so CI is the gate. Do not move that gate to the deploy.

Anything non-fatal in that chain must report where it can be read: the Parquet
step writes `public/build-status.txt`, served at `/build-status.txt`, on
success as well as failure. Build logs are off for this project, so a silent
failure is invisible — that is what hid this one for three rounds.

## Working autonomously

An agent working through the backlog without a person watching follows the
rules above and these. The full process is in `CONTRIBUTING.md` under
*Working autonomously*; this is the part that has to be in front of you.

- **`docs/BACKLOG.md` is the queue.** Nothing else is. Before starting an
  item, reread it against the code as it is now — an item can be stale,
  already landed under another ID, or superseded by a later finding. Work
  you discover goes back into the backlog under its ID, source and size
  conventions, not into a note, a TODO or a second list.
- **A fact needs a source before it needs a line of code.** Official FIA,
  Formula 1, team, driver, power-unit or circuit sources first; then the
  classified secondary sources. Never invent a missing value: NULL means
  *not established*, and a fact two sources disagree on goes in
  `discrepancies`, a fact nobody holds in `known_gaps`.
- **`make all` before every commit**, as the top of this file already says
  — never `make check`, which leaves `f1_compat.json` stale. Generated
  artefacts are rebuilt, never edited.
- **Every autonomous PR gets an independent review from a fresh context**
  before it merges, and returns an explicit `PASS — safe to merge` or
  `FAIL — changes required`. The agent that wrote the change is not its
  approver. The reviewer gets the task, the rules, the diff and the
  validation results, and tries to disprove the work. A FAIL is fixed and
  reviewed again, fresh. Silence, a rate limit or an unavailable review
  account is not a PASS.
- **`review.yml` failing is infrastructure, not a defect.** It runs on a
  credential that is currently exhausted. Do not retry it, do not edit it
  to make it pass, and do not treat its red check as a code failure or its
  absence as approval — run the equivalent reviewer from
  `.claude/agents/` yourself.
- **Merging `main` deploys lapledger.org.** Cloudflare Workers Builds runs
  on every push to `main`. A merge is a production change.
- **Skip an ordinary blocker; stop on a dangerous one.** A network failure,
  an unavailable service or a missing non-critical credential is recorded
  and worked around. Anything that could corrupt data, breach a licence,
  weaken a safeguard, change production infrastructure — as distinct from
  deploying through it by merging — or lose history stops the loop.
- **Never weaken a control to keep going.** Not the checks, not the
  workflows, not branch protection, not repository visibility, not the
  licence classification, and not `review.yml`'s refusal to review a PR
  that edits it.

## Measured and rejected — do not re-propose

- **Route-level code splitting** in the front end. The bundle is 398 KB raw /
  118 KB gzipped, irrelevant beside the database the browser downloads
  (4.4 MB gzipped, 20 MB raw).
- **An HTTP range-request VFS** for the data layer. No source has lap times
  under a redistributable licence, and prerendering already took the download
  off the first-paint path.
- **`BUILT` as a real timestamp.** See above.
