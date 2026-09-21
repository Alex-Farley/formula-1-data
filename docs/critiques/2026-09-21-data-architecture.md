# Data architecture critique — 2026-09-21

**Critic:** `data-architecture-critic`, second run. **Subject:** the published
dataset at `main` / `dda5afb`: the committed `f1.db` (48 tables, 41 views,
119,832 rows, `meta.version = 2.24`), `f1-geometry.db`, `f1_compat.json`, the
JSON export, the Parquet bundle, and the release assets as a contract. Not the
pipeline, except where it leaks into the shape of the artefact.

**Prior read in full:** `docs/critiques/2026-09-11-data-architecture.md`
(`DA-01`–`DA-20`), `docs/DERIVED-CONFIDENCE.md`, `docs/COMMERCIAL-READINESS.md`,
`schema.sql` entire, `export_json.py`, `tools/parquet_export.py`,
`LICENSE-DATA`, `.github/workflows/release.yml`, the 180 open issues and the
three board columns.

**Instructions for this run:** report only; no issues filed, nothing in the
repository modified. Everything below ran read-only against the committed
databases and against `git show <tag>:f1.db` copies in a scratch directory.

**Evidence tags.** `queried the database` — the committed `f1.db` /
`f1-geometry.db` today. `ran it` — a command run today, including comparisons
across `v2.21`, `v2.23`, `v2.24` and `HEAD`. `read the schema` — `schema.sql`
with a line. `read the docs` — the project's prose. `inference` — reasoned,
not observed.

**Numbering.** New findings continue the sequence at `DA-21`. Where a 2026-09-11
finding is still live I cite its existing ID rather than re-file it, and say
whether it has got better, worse or stayed put.

---

## The three that matter

### 1. One version number, twelve databases — and one of them has a different schema (`DA-21`)

`meta.version` is the only identifier the published artefact carries, and it
does not identify the artefact.

In the last sixty commits that touched `f1.db`, **`2.23` was worn by 36
distinct database files and `2.24` by 12** (`ran it`, hashing each blob and
reading its `meta`). That alone is `SD-07`, filed and still true. What is new
and worse is what the twelve differ by. Comparing the tagged `v2.24:f1.db`
against the committed `f1.db` at `dda5afb`, both of which report
`version = 2.24` and `built = 2026-09-16`:

| | |
|---|---|
| `article_images` | gained three columns — `route`, `chassis_id`, `category` — and a two-branch `CHECK` |
| `points_systems` | gained two columns — `win_points`, `fastest_lap_points` |
| rows differing | 452 row-hashes across `chassis` (144), `standings` (130), `races` (94), `race_entries` (72), `known_gaps` (4), `source_registry` (2), `table_provenance` (2), `discrepancies` (2), `provenance` (1), `meta` (1) |

(`ran it`.) **A schema change shipped under an unchanged version number, and
`built` did not move either** — because `BUILT` is a constant by design
(`[D-01]`, which is right for reproducibility and wrong as an identity). Eleven
commits have rewritten `f1.db` since the tag.

Both of those files are live right now. `lapledger.org` serves the `main` build
(Cloudflare runs on every push); the GitHub release serves the tag. A consumer
who downloaded "v2.24" from the release and a consumer who downloaded "v2.24"
from the site hold databases whose `article_images` table has a different
column count, and nothing in either file says so.

The project has already solved this once and did not carry it into the
artefact: `web/public/db-manifest.json` carries `digest`, `bytes`, `staged` and
a per-file geometry digest, and `web/src/data/worker.js:77` fetches it
`no-cache` and uses the digest as a cache-buster. The browser can tell two
v2.24 databases apart. **The database cannot tell you about itself.**

Defect, and the single biggest obstacle to anyone depending on this — paying or
not. Three rungs:

- **S** — write `meta.content_digest` and `meta.staged` (the commit date, or
  the digest of everything but `meta`) at build time, and put `content_digest`
  in the citation block, the release body and `SHA256SUMS`'s header. This is
  the honest state today and costs almost nothing; `prepare-assets.js` already
  computes a digest for the site.
- **S** — separate `meta.schema_version` from `meta.version`. A consumer's
  first question is "will my code still run", and today it needs a diff.
  `article_images` gaining three columns under an unchanged `2.24` is exactly
  the case.
- **M** — a data changelog: one row per release naming tables touched, rows
  added, rows *changed*, and columns added or removed. `BUILD-NOTES.md` is a
  release log written by hand; this is derivable by diffing the previous
  release's database, which CI already has. Without it "what changed since
  v2.20" is unanswerable, and it is the second question every data customer
  asks.

**Costing.** Rungs one and two break nothing — `meta` is a key/value table and
`export_json.py` unwraps it into top-level keys, so two new keys appear in the
JSON and nothing disappears. The changelog needs the previous release's `.db`
at build time, which `ci.yml` can fetch from the release.

### 2. The licence boundary in this database runs down columns, and nothing in the schema runs down columns (`DA-03` sharpened, `DA-22`)

`LICENSE-DATA` argues the whole data release under CC BY-SA 4.0 with one
sentence: *"Rather than draw a line field-by-field, the whole data release is
licensed CC BY-SA 4.0."* That was a reasonable call for a free release. For a
commercial one it is the whole problem, because share-alike propagates to any
derivative database a customer builds, and most commercial buyers cannot accept
that. So it is worth knowing what it is buying.

I measured the line the licence declines to draw (`queried the database`). Of
**8,878,058 characters of TEXT** in `f1.db`, the prose — the material that can
carry copyright, in 26 columns across 16 tables — is **144,532 characters, 1.6
per cent**:

| where | chars |
|---|---|
| `discrepancies.assessment` | 16,786 |
| `drivers.notes` | 16,687 |
| `known_gaps.description` + `.reader` | 15,959 |
| `cars.story/concept/innovations/outcome` | 19,647 |
| `circuits.notes` + `.characteristics` | 16,693 |
| `seasons.notes`, `constructors.notes`, `glossary.definition`, `regulation_changes.detail/impact`, `personnel.significance`, `chassis.power_note`, and eleven more | 58,760 |

**Roughly 33 KB of that — `discrepancies.assessment` and `known_gaps` — is the
project's own writing and carries no upstream obligation at all.** The rest is
the Wikipedia-derived prose the licence is for. Meanwhile, resolving every
sourced row to its registry entry: **92,916 rows cite a `share_alike = 0`
source (F1DB, CC BY 4.0) and 2,368 cite a `share_alike = 1` one** (`ran it`,
reimplementing the build's prefix-then-pattern resolver).

So the position a commercial customer needs argued — *the facts are not
copyrightable, the F1DB-derived rows are CC BY, the share-alike attaches to
about 110 KB of prose in 26 named columns, and here is the view that excludes
them* — is **true, is already implicit in the data, and cannot be expressed**,
because:

- there is **no `source_id` on any fact table** (`DA-03`, unchanged: the only
  two `source_id` columns in the database are on `source_patterns` and
  `table_provenance`);
- resolution runs through longest-prefix matching on `source_registry.url` and
  then **ten Python regular expressions held as text** in `source_patterns`,
  which SQLite cannot evaluate;
- `source` is row-grain and the licence question is field-grain. The schema
  says so itself, at `race_entries.pole`: *"`source` names who established the
  row's FINISHING POSITION, and the pole and fastest-lap flags are the one
  thing on a row that can come from elsewhere. Field-grain sourcing is what
  `claims` would carry"* (`read the schema`). That is the honest declaration of
  a model that does not fit.

**This reframes `PM-14`.** `claims` has been sitting in Someday as a tidying
exercise that retires five ad-hoc encodings. Its `field` column is the thing
that lets a licence be argued per column, and a licence argued per column is
the difference between a dataset a company can build a product on and one it
cannot. That is the strongest business case the confidence programme has, and
it is not the case the document makes.

Defect for the commercial goal; preference otherwise. In pieces:

- **S** — a `column_licence` table: `(tbl, col, origin, licence, share_alike)`,
  26 rows for the prose and a default for everything else, written by hand once
  and checked by `verify.py` against `source_registry`. This is a two-hour job
  and it is the artefact a lawyer reads. It also makes a *facts-only edition*
  expressible: one `SELECT` list.
- **S/M** — `DA-03`'s `source_id` on the 24 tables that already carry `source`,
  written by the build with the resolver it already runs. Additive; `source`
  stays; nothing breaks.
- **M** — `PM-14`'s `claims` with `field` populated, seeded from the five
  existing encodings and from the pole-source exception above.

### 3. Surrogate ids still move, and the one table whose ids move most is the one the project originates (`DA-04`, got worse in a new place)

`DA-04` measured 4,774 `race_entries` ids moving between v2.20 and v2.21.
Re-run across the three releases since (`ran it`, natural-key → surrogate-id
maps compared pairwise):

| | v2.21 → v2.23 | v2.23 → v2.24 | v2.24 → `HEAD` |
|---|---|---|---|
| `race_entries` | 0 moved | 0 moved | 0 moved |
| `races`, `qualifying`, `sprint_results`, `season_entrants`, `circuit_layouts`, `pit_stops`, `records` | 0 | 0 | 0 |
| **`standings`** | 0 | **2,371 moved** (6.9%) | 0 |
| **`discrepancies`** | **20 of 44** | **22 of 55** | 0 |

`race_entries` has been stable for three releases, which is good news nobody has
written down. `standings` moved 2,371 ids on unchanged natural keys in one
release. And `discrepancies` — 58 rows, the table carrying the project's
distinguishing claim, the one cited by id in `verify.py` messages and in
`docs/` — **renumbers roughly 40% of its rows every release**.

The project knows. `verify.py` carries checks 114–116, including *"the
explained span rows are the last discrepancies written, so adding one moves no
id"* (`read the source`). That is a build-order pin for one class of row, and it
demonstrates both that the hazard is understood and that the answer chosen was
a per-case workaround rather than a policy.

Defect, and a decision that has been open since 11 September. **S** either way
and it should be taken now, because everything in finding 1 depends on it:

- **Publish the policy.** Natural keys (`(race_id, driver_id)`, `(year, round)`,
  `drivers.id`, `records.key`, `circuit_outlines.f1db_layout_id`) are stable;
  integer `id` columns are not, and may be renumbered by any release. Put it in
  `meta`, in the README and in the release body. Saying so costs nothing and is
  true today.
- **Or promise stability** for the four tables that already have it by accident
  — `race_entries`, `races`, `qualifying`, `pit_stops` — with a `verify.py`
  check against the previous release's map. That is a real commitment and it is
  the one a data customer actually wants.
- **Either way, give `discrepancies` and `known_gaps` a stable slug `key`**, the
  way `records.key` already has one. `records` is the model: `key TEXT NOT NULL
  UNIQUE` and 0 ids moved in three releases.

---

## Five questions, written as SQL

The 2026-09-11 run wrote seven. I wrote five different ones, chosen for a
third party rather than a page.

| # | Question | Worked? | What I had to know that is not in the data |
|---|---|---|---|
| 1 | The 2024 drivers' championship final table | **yes** — `v_standings_final`, 24 rows | that the view exists; the raw table also gives 24 here, and 251 for 1988 |
| 2 | Verstappen's 2023 championship total | no — `race_entries` gives 530, the answer is 575 | that sprint points live in a second table (`DA-17`); and that his id is `verstappen`, not `max-verstappen` |
| 3 | Which rows may I redistribute, and under what licence | **not answerable in SQL at all** | `DA-03`; the resolver is ten Python regexes |
| 4 | What changed between the database I have and this one | **not answerable at all** | `DA-21`; the two artefacts have the same version string |
| 5 | The 2023 Belgian GP classification with pole and fastest lap | **yes, first attempt** | none |

Question 5 remains the model — one join, one `WHERE`, `position_text` and
`grid_text` lossless, pole and fastest lap as per-entry flags. Question 1 is a
real improvement over the last run and `v_standings_final`'s header comment is
the best piece of documentation added since. Question 2 cost me two attempts
for a reason worth its own finding (`DA-24`). Questions 3 and 4 are the two a
paying customer asks first, and neither has an answer.

---

## The full set, by consequence

### `DA-21` — One version number, twelve databases. *See above.* `ran it`. **Defect. S + S + M.** Absorbs `SD-07`.

### `DA-22` — The licence boundary runs down columns. *See above.* `queried the database`, `ran it`, `read the docs`. **Defect (commercial), preference (otherwise). S + S/M + M.** Reframes `DA-03` and `PM-14`.

### `DA-04` — Surrogate ids, re-measured. *See above.* `ran it`. **Defect + decision. S.**

### `DA-02` — Lineage still has no time dimension, and it has acquired a fourth victim

Re-measured (`ran it`). 66 lineage rows; **54 of 66 `entity_name` values match a
`constructors.name`, 12 do not**; no `constructor_id` column; 55 of 150
constructors carry a chain. Race entries reached through a chain that falls
outside the chain's own timeline:

| constructor | entries | years | attributed to | which was, then |
|---|---|---|---|---|
| `renault` | 76 | 1977–1980 | Enstone | Toleman, or nothing |
| **`honda-works`** | **46** | **1964–1968** | **Brackley** | nothing until Tyrrell, 1970 |
| `mercedes` | 40 | 1954–1955 | Brackley | as above |
| `aston-martin` | 11 | 1959–1960 | Silverstone | nothing until Jordan, 1991 |

173 entries, down from 283 — but `honda-works` is **new since September 11**, so
the defect is not shrinking, it is being fed. The Enstone chain still returns
**65 wins including Renault's 1979–83 turbo wins at Viry** (`ran it`, 15 of them
before 1986).

Unchanged in kind. **M in three pieces**, exactly as filed. What it breaks:
nothing on the site, because there is still no lineage page (`IA-01`).

### `DA-05` — The `reference` tier's published definition is still wrong, for more rows than before

**95,237 rows sit at `reference`** — 98.0% of the 97,157 rows carrying a
confidence value. Column entropy across the database: **0.183 bits**
(`queried the database`). `provenance.definition` for `reference`, which reaches
the site, `f1_database.json` and `verification_policy` in `f1_compat.json`,
still reads:

> Harvested from Wikipedia's season results tables, which are transcribed from
> FIA classifications. Every row was cross-checked on load against
> independently held season data.

Resolving every `reference` row's source: **92,906 cite F1DB and 2,284 cite
Wikipedia** (`ran it`). The sentence is wrong about the source of 98% of the
rows it describes, and the second clause is false for `season_entrants` (1,925),
`sprint_results` (590) and `engines` (424) by `DERIVED-CONFIDENCE.md`'s own
Group 1.

This is the one finding where the project's distinguishing claim actively
misleads. **Defect. S** — rewrite the definition, and add the `verify.py` check
that the sources a definition names are the sources its rows cite. Do not wait
for `PM-15`/`PM-16`.

### `DA-24` — The natural keys have no stated form, and the three registers a consumer joins most carry no F1DB id *(new)*

`drivers.id` is a slug with no rule (`queried the database`): **222 of 862 are a
bare surname, 585 are two tokens, 48 three, 7 four.** `hamilton` is Sir Lewis;
`duncan-hamilton` is Duncan. `verstappen` is Max; `jos-verstappen` is Jos. The
rule is *the famous one gets the short form*, which is arrival-order and is not
derivable from anything in the database. A consumer cannot construct an id; the
obvious guess (`max-verstappen`, from the pattern `juan-manuel-fangio`) returns
nothing, silently, with no error — which is what happened to me at question 2
above.

Worse, **four ids exist in both `drivers` and `constructors`** — `amon`,
`brabham`, `fittipaldi`, `modena` — and 23 exist in both `cars` and `chassis`.
In `standings` the collision is live in one column: `entity_id = 'brabham'`
names *Sir Jack Brabham* on 121 rows and *Brabham* the constructor on 424, told
apart only by `table_type` (`queried the database`). That is `DA-10`, and this
is the evidence for why it should be done.

And the join a bulk consumer most wants is missing. `chassis`, `engines`,
`season_entrants`, `circuit_outlines` and `races` all carry an explicit
`f1db_*_id` — the convention exists and is good. **`drivers`, `constructors`,
`circuits`, `cars` and `grands_prix` carry none**, so anyone reconciling this
database against F1DB (its largest single source, and the thing a data scientist
already has) has to match on names.

Defect. **S + S**: (1) publish the id rule — or, better, state that ids are
opaque and must be looked up, and add a `drivers.f1db_id` /
`constructors.f1db_id` / `circuits.f1db_id` so they need not be; (2) namespace
or prefix the four colliding ids, or do `DA-10`'s split of `entity_id`, which
fixes the only place the collision can bite.

### `DA-14` — Sharpened: the views are not an interface, three of them have no reader at all, and none of them ships

Re-measured (`ran it`). 41 views, 48 tables, 119,832 rows. **26 tables are
touched by no view**, holding 28,794 rows (24%) — better than the 71% of
September, because `v_standings_final` landed. But the list of what is missing
is unchanged in kind: **`qualifying` (27,017 rows) and `sprint_results` (590)
are still untouched, so there is still no race-classification view**, which is
the release headline of v2.15 and the one query a stranger writes first.

Three views are read by nothing anywhere — not `web/src`, not `web/scripts`, not
`./f1`, not `audit.py`, not `tools/`:

| view | rows |
|---|---|
| `v_car_lineage` | 29 |
| `v_constructor_titles` | 17 |
| `v_season_timeline` | 78 |

and `race_credits` (2,339 rows) is a compat view with no reader in the front end.

Neither exporter ships a view. `tools/parquet_export.py:tables()` selects
`type='table'`; `export_json.py` names tables explicitly and substitutes
`v_standings_final` for one of them. So the three published shapes have three
different contents, and a Parquet consumer who wants "which layout was raced at
Bahrain in 2020" must reinvent `v_race_venues`'s three-way join, because the
view is the only place that logic is written down.

Defect. **S + S**: (1) `v_race_classification` over
`races` + `race_entries` + `qualifying` + `sprint_results`; (2) write the view
SQL into the Parquet zip as `views.sql` — one `zipfile.writestr`, riding with
`PM-23`.

### `DA-23` — No machine-readable schema and no data dictionary ships *(new)*

There is no `datapackage.json`, no JSON Schema, no `columns` table and no
column-description surface anywhere in the release (`ran it`; the release
carries `f1.db`, `f1-geometry.db`, `f1_database.json.gz`, `f1_compat.json`,
`f1-parquet.zip`, `schema.sql`, `SHA256SUMS`). The only description of a column
is a `--` comment in `schema.sql`, and **396 of 593 comment lines — 67% — are
not in the shipped database** (`ran it`), because SQLite stores a `CREATE`
statement from the word `CREATE` and every block comment above one is lost.
`DA-06` measured 66% in September; it has not moved. Still absent from `f1.db`:
the race-model block stating that `race_entries` is one row per driver per race;
the `sprint_results` block explaining that emptiness before 2021 is a fact;
the `laps` block explaining why four tables are empty; the confidence ladder at
the head of the file. The phrase `POLE MEANS` now *does* appear in the stored
SQL — but only in `race_entries.pole`'s inline cross-reference *"see WHAT 'POLE'
MEANS HERE, above"*, and in the shipped database there is still no above.

For a paying customer this is the same gap as `DA-21`: they cannot introspect
the product. **The two fix together, and cheaply.** One build step reads
`schema.sql`, attaches each comment block to the object it precedes, and writes
a `data_dictionary (tbl, col, grain, description, derived, source_of_truth)`
table into `f1.db`. That table then exports to JSON and Parquet for free, gives
the SQL console something to render, gives `SD-11`'s `schema.org/Dataset` markup
its `variableMeasured`, and makes `DA-06`'s 396 lines reachable without touching
the comment placement at all.

Defect. **M**, shippable as: **S** the table with hand-written grain statements
for the 12 core tables only (grain is the thing most worth having and there are
only twelve); **S** the generator that pulls the rest from `schema.sql`; **S** a
`verify.py` check that every table has a row.

### `DA-01` — Half landed, and the remaining half is the half that misleads

Endorsement first: **`v_standings_final` is right, and `CR-02` is properly
closed.** 2024 returns 24 rows; the compat export ships 23 driver rows, not
333 (`queried the database`). `ux_standings_identity` exists with the
`COALESCE` pins and `position_text` in the key, exactly as proposed. Its header
comment is 34 lines and is the best-written thing in the schema. Do not reopen
either.

What did not land is still live and still wrong for a consumer meeting the raw
table:

- `SELECT * FROM standings WHERE year=1988 AND table_type='drivers'` still
  returns **251 rows for 30 entrants** (`queried the database`).
- `as_of` still carries four kinds of value — `'round N'` (32,161), `'final'`
  (2,368), `'current'` (34), `'2026-09-04 (after round 12)'` (34) — and
  `after_round IS NULL` still means two different things.
- No `basis` column.

**M**, unchanged. But note that `v_standings_final` has absorbed most of the
consumer harm, so this should be **re-sized to M and re-ranked below `DA-21`,
`DA-03` and `DA-02`**, which is a change from how it was filed.

### `DA-26` — `races.dates` now has three formats, not two *(extends `DA-15`)*

`dates` is identical to `date_iso` on 1,149 of 1,196 rows. Of the 47 that
differ (`ran it`):

- 44 are `DD-DD Mon YYYY` — `19-21 Nov 2026`;
- **3 are `DD Mon-DD Mon YYYY`** — `30 Oct-01 Nov 2026` (Mexico City),
  `30 Apr-02 May 2027` (Miami), `30 Jul-01 Aug 2027` (Hungary). This third form
  defeats a hand-written parser written against the second.

And **Las Vegas 2026 still has `dates = '19-21 Nov 2026'` with `date_iso =
'2026-11-22'`** — the race day is outside the weekend the same row states. That
is `AF-01`'s symptom, unfixed, and it is unfixable by a check while the range is
unparsed text.

Defect, small. **S**, and I still prefer option (b): `date_from` / `date_to`,
both ISO, and let the renderer format. That turns a string nothing can validate
into two dates everything can, and closes `AF-01` structurally.

### `DA-09` — `discrepancies` has grown and got no better; the unrecorded disagreements have grown too

58 rows (was 45). Still no keys, still three vocabularies in `field`
(`weight_kg`, `fastest lap`, `CAR_SEASONS`, `2026 championship points, after
round 12`), still five key formats in `subject`, still **eight distinct
free-text `status` values** requiring `LIKE 'open%'` to filter, still 23 rows
carrying the literal string `'NULL'` in `derived_value` (`queried the
database`).

And the table is still not applied consistently, by a larger margin than before:
**`chassis.published_wins` differs from the derived `wins` on 150 of 1,153
rows**, `published_races` is *lower* than derived `races` on 9, and **10 drivers'
`career_points` disagree with the sum of their race and sprint points** — 169
disagreements, none of them in `discrepancies` (`queried the database`).
`verify.py` has 255 checks and three of them (#104, #105, #136) test the
*direction* of the chassis disagreement; none records it. The honesty mechanism
has a one-sided guard.

Defect. **S**, and it is still the best-value rehearsal for `PM-14` available:
`(tbl, row_key, field)` as three columns on 58 rows, a `status` constrained to
`open | resolved | explained` with the prose moved to `assessment`, and a
stable `key` slug (see `DA-04`).

### `DA-13` — Landed in part; the pattern should now be finished

Genuine progress, and worth naming: `schema.sql` had **one** `CHECK` in
September and now has **14 across 9 tables** (`queried the database`).
`circuits.direction` is constrained and Jacarepaguá is fixed;
`known_gaps.state`, `records.holder_table`, `sessions.kind`,
`article_images.route` + `repository` + the two-branch route check, and
`drivers.status` are all in. `article_images`'s route CHECK — *exactly one key
per route, and each route's repository with it* — is the best constraint in the
database.

Still unconstrained and still drifting: `personnel.role` (documented as four
values, holds 18, because it is quietly multi-valued), `team_radio.speaker`
(documented as three, holds six full sentences on six rows),
`chassis.aspiration` (`AF-66`, ~15 spellings), and `source_registry.authority`,
which has a CHECK but would be better as a lookup table with an FK, for the
same reason `provenance` is. (Verified against `v2.21:f1.db`: **exactly one
CHECK token then, fourteen now.**)

**Re-size to S and re-scope**: the remaining work is three CHECKs and
`AF-66`. `DA-13` and `AF-66` should merge.

### `DA-16` / `DA-08` / `DA-17` / `DA-18` / `DA-20` — status, briefly

- **`DA-16`** — **13 columns are NULL in every row** of a non-empty table
  (`constructors.entries`, `cars.fuel_capacity_l`, `chassis.fuel_capacity_l`,
  `race_entries.note`, `sprint_results.note`, `season_entries.note`,
  `pit_stops.driver_code/stationary_seconds/pit_lane_seconds`, and four of
  `team_radio`'s columns). `races.note` now has 2 of 1,196 (`AF-63`).
  **`known_gaps.races_affected` is 0 on 13 of 16 rows and NULL on 1** — the
  register's only machine-readable magnitude, and it is false for #3 (which its
  own text says covers ~287 races) and #5. Unchanged. **S.**
- **`DA-08`** — **still zero rows with `points = 0` in `race_entries`**, against
  **8,115 classified finishers with NULL points** and 3,493 `standings` rows at
  0 (`queried the database`). One concept, two encodings, and the NULL encoding
  contradicts the convention the homepage teaches. Unchanged. **M, decision
  first.**
- **`DA-17`** — confirmed exactly: Verstappen 2023 is 530 from `race_entries`,
  45 from `sprint_results`, 575 in the standings. Nothing tells a consumer. **S**
  — one `v_driver_season_points` view, which should ride with `DA-14`'s
  classification view.
- **`DA-18`** — unchanged and now slightly worse: rows 8 (GP, 2025–) and 10
  (sprint, 2022–) both have `to_year IS NULL`, so the obvious interval query
  returns two overlapping rows for any year from 2025, told apart only by the
  string prefix `SPRINT: `. `'None'` as a string still sits beside SQL NULL in
  `fastest_lap` and `dropped_scores`. **S.**
- **`DA-20`** — the defect half **landed**: `constructors.last_entry` is now
  NULL for exactly the still-competing (0 violations, and `verify.py` check #184
  pins it). The seven spellings of a validity interval remain
  (`from_year`/`to_year` × 8 tables, `first_year`/`last_year` × 2,
  `first_entry`, `first_gp`, `first_held`, `first_season`, `active_from`).
  **Preference. Re-size from S to M, and I would still not do it before anything
  else here.**

---

## Examined and cleared

Things I spent time disproving, so nobody spends more.

- **`v_standings_final` and `ux_standings_identity`.** Both landed as proposed,
  both correct, and the view's header comment — including the AF-35 note about
  *the freshest row, not the largest* — is a model of documenting a rule in the
  place a consumer meets it. Do not touch.
- **`records` is now a well-modelled table**, and the September critique's
  unfiled `DA-19` is fully answered without ever having been filed: `key TEXT
  UNIQUE` (stable across three releases, 0 ids moved), `value_num REAL NOT
  NULL` + `unit` beside the display `value`, `holder_table` with a CHECK,
  `holder_id` NULL only on ties, `as_of` an ISO date, `detail` stating the
  derivation rule. This is the best remodelling the project has done. **`DA-19`
  needs no issue.**
- **The `article_images` two-route model.** One table, two keys, a CHECK that
  admits exactly one shape per route, `repository` constrained per route with
  the reasoning inline, `catalogued` added as a rung *below* `unverified` rather
  than stretching an existing tier. This is how a domain's awkward part should
  be modelled.
- **`f1-geometry.db`'s `meta`.** Eight keys — licence, licence_url,
  attribution, companion, apply — and the three non-closing traces recorded as
  `closes = 0` rather than dropped. Still the most self-describing artefact the
  project publishes and still the model for what `f1.db`'s `meta` should be
  (`DA-21`).
- **The ODbL split, and both exporters' refusal to run on a merged database.**
  `tools/parquet_export.py:refuse_unpublishable()` checks the four FOM tables
  *and* `circuit_geometry` at the moment the data would leave, with the reason
  in the error. Correct, and the belt-and-braces against `verify.py` is right
  because a local build is the failure mode.
- **`NOT_EXPORTED` in both exporters, with a completeness check.** A new table
  cannot go missing from an export quietly. Rare, and it should be copied to the
  view layer: nothing today stops a view being added that no export knows about.
- **Declared types match stored types.** Re-checked; still zero violations.
- **The empty tables.** `laps`, `stints`, `race_timing`,
  `race_control_messages` all at zero, `pit_stops` all `f1db`, `team_radio` with
  six rows and no `fastest` source. Correct, permanent, and out of scope by the
  brief.
- **`race_entries` one row per driver per race.** Still the right grain; the
  two shared drives it cannot express are still two rows in 27,504. Do not
  change.
- **`circuit_layouts` + `races.layout_key` + `v_race_venues`.** Still the best
  model in the database, and `v_race_venues`'s `figures` column — a view that
  reports the confidence of its own answer — is still the thing three more views
  should copy.
- **The browser's cache story.** I went looking for a stale-database defect:
  `/f1.db` is served `immutable, max-age=31536000`, which would pin a reader to
  one build for a year. It does not, because `web/src/data/worker.js` fetches
  `db-manifest.json` with `cache: 'no-cache'` and passes `manifest.digest` as a
  cache-buster to every content request. Correct, and the reasoning is in the
  comment. No finding.

---

## What is genuinely good

- **`v_standings_final`'s header.** Thirty-four lines that state the grain, name
  the two reasons a duplicate can appear, explain why source tells them apart,
  and record the AF-35 correction to its own rule. If the `data_dictionary` in
  `DA-23` ever happens, this is the target quality.
- **`records`, remodelled.** Derived, keyed, typed, with the rule in `detail`.
- **255 checks, and the ones that pin a cardinality rather than a value** —
  *"no two drivers hold one finishing position unless they shared the car"*,
  *"every one-off layout is claimed by a race"*, *"registry entries sharing a
  host agree on what it permits"*. The last is a licence guard expressed as a
  data constraint and it is exactly right.
- **`table_provenance.unconstrained`.** One flag that floors a table at
  `unverified` regardless of its source's standing, because a well-run source
  does not make a row checkable. Still the sharpest piece of data thinking here.
- **The CHECK count went 1 → 14 in ten days**, with the reasoning inline in each
  case. That is the vocabulary rule spreading, which is what `DA-13` asked for.

---

## Engagement: data the site holds and does not surface

Not my discipline, but cheap features fall out of the inventory
(`ran it`, grepping `web/src` and `web/scripts` for every table and view name):

| holds | rows | state |
|---|---|---|
| `regulation_limits` + `v_regulation_limits` | 33 | a view exists; **no page reads either** |
| `v_car_lineage` | 29 | design descent, recursive CTE; **no reader anywhere** |
| `v_season_timeline` | 78 | **no reader anywhere** |
| `v_constructor_titles` | 17 | **no reader anywhere** |
| `race_credits` | 2,339 | compat view; **no reader in the front end** |
| `grands_prix` + `v_grands_prix` | 53 | `IA-01`, already filed |
| `sessions` | 115 | the current season's timetable with IANA zones — a countdown nobody renders |
| `engines` | 424 | no view, no page |
| `personnel` | 32 | no view, no page |
| `points_systems` | 10 | now carries `win_points` and `fastest_lap_points`, which is the input to "who can still win the title" |

The cheapest of these is `regulation_limits`: 33 rows, already a view, already
the most carefully modelled temporal table in the database, and it answers "how
heavy was a 1961 car allowed to be" which nothing else on the internet answers
cleanly. `v_car_lineage` is a drawing waiting to happen. `points_systems`'
two new integer columns plus `v_standings_final` is the title-permutation
feature (`PD-28`) with no new data at all.

---

## Backlog verdicts

### The twenty DA items collapse to six

Seventeen DA issues are open (`DA-07`, `DA-12` and `DA-19` were never filed; all
three are now answered — see *Examined and cleared*). They are all in Someday.
They are mostly one-sitting fixes to one table, which is why they read as a
wall. Grouped by the artefact they change, they are six shippable pieces:

| piece | absorbs | size | column |
|---|---|---|---|
| **A. Identity and the changelog** | `DA-21` (new), `DA-04`, `SD-07` | S+S+M | **Now** |
| **B. Provenance and licence as a query** | `DA-03`, `DA-22` (new), `DA-05`, `PM-14` | S+S/M+M | **Next** |
| **C. `standings` finished** | `DA-01` (remainder), `DA-10`, `DA-11` | M | **Next** |
| **D. Self-description** | `DA-23` (new), `DA-06`, `DA-16`, `DA-17`, part of `DA-14` | M in S slices | **Next** |
| **E. Small corrections** | `DA-13`+`AF-66`, `DA-15`+`DA-26`+`AF-01`, `DA-18`, `DA-09` | 4 × S | **Next** |
| **F. Lineage** | `DA-02`, `DA-24` (new) | M | **Next** |
| *(dropped from the set)* | `DA-20` | M, preference | **Someday** |
| *(dropped from the set)* | `DA-08` | M, decision | **Someday** |

### Per-issue verdicts

| # | ID | verdict |
|---|---|---|
| 197 | DA-01 | **keep, Next**, re-size M (the S+S rungs landed). Merge `DA-10` and `DA-11` into it — all three are one table and one sitting's thinking. |
| 198 | DA-02 | **keep, Next.** Got worse (`honda-works`, 46 entries, new). Merge `DA-24`'s constructor half. |
| 199 | DA-03 | **keep, re-rank to Next, re-size M.** The precondition for B, and now the commercial case, not the tidying case. Absorb the new `DA-22`. |
| 200 | DA-04 | **keep, re-rank to Now**, re-size S. Merge with `SD-07` (#216) and the new `DA-21` — they are the same decision about what identifies a row and a file. |
| 201 | DA-05 | **keep, Next, S.** Standalone, one sitting, and it is a published falsehood. Do not let it wait on `PM-15`. |
| 202 | DA-06 | **merge into `DA-23`** (new). Moving comments inside parentheses is one way to ship the prose; a generated `data_dictionary` ships it *and* gives a customer something machine-readable. Do the second and the first becomes optional. |
| 203 | DA-08 | **keep, Someday, M.** Real, but it is a data change with 8,115 rows downstream and it needs the em-dash convention's owner. Not before A–F. |
| 204 | DA-09 | **keep, Next, S.** Now 58 rows and 169 unrecorded disagreements. Add the stable `key` slug from `DA-04` while the table is open. |
| 205 | DA-10 | **merge into `DA-01`.** |
| 206 | DA-11 | **merge into `DA-01`.** The minimum — one line in the column comment naming the namespace — costs nothing and ships inline. |
| 207 | DA-13 | **keep, Next, S.** Two-thirds landed; re-scope the body to the three remaining vocabularies. **Merge `AF-66` (#463) into it.** |
| 208 | DA-14 | **keep, Next, re-size M→S+S.** Re-scope: (1) `v_race_classification` + `v_driver_season_points`; (2) `views.sql` in the Parquet zip. Drop the "which download" table — that is `CD-07`/`PD-11`'s. |
| 209 | DA-15 | **keep, Next, S.** Merge the new `DA-26` (the third date format) and `AF-01` (#184) into it — same column, same fix. |
| 210 | DA-16 | **keep, Next, S.** Split off `known_gaps.races_affected` as its own line: it is a wrong published number, not untidiness. |
| 211 | DA-17 | **merge into `DA-14`.** It is one view, and `DA-14` is where views go. |
| 212 | DA-18 | **keep, Next, S.** Unchanged and now has an overlapping open interval. |
| 213 | DA-20 | **re-size S→M, keep Someday.** The defect half landed. What remains is a rename across eight tables, three exporters and the front end, for consistency. Legitimate, last. |
| 164 | PM-14 | **keep, re-rank Someday→Next, re-size M.** Rewrite the body around `field`-grain licence (`DA-22`), which is the case that pays this week. Absorb `DA-03` as its first column. |
| 247 | PM-15 | **keep, Someday, L.** Right, and its value only arrives with `PM-16`. Do not start it before B ships. `CR-03` (#193, "nothing tests the checks") is the same programme approached from the other end and should be noted on both. |
| 248 | PM-16 | **keep, Someday, M — blocked on `PM-15`.** Mark it blocked so it stops reading as startable. |
| 240 | PM-06 | **keep, Someday, M.** 118 real disagreements needing a person; genuinely valuable and genuinely not automatable. Note on it that `DA-09`'s reshape should land first so the output has somewhere keyed to go. |
| 165 | PM-22 | **merge into `DA-21`.** `meta.database_name` is a `meta` change needing a version bump and an announceable key change — which is exactly what `DA-21` builds. Doing them separately spends the version bump twice. |
| 216 | SD-07 | **merge into `DA-21`** (or rename `DA-21` to `SD-07` and keep the older id; either, but not both open). |
| 263 | CR-15 | **decline.** Positional tuples in `data/*.py` are a pipeline-shape concern, not an artefact one, and the artefact has 255 checks standing between a swapped field and the database. Reconsider only if a swap ever reaches `f1.db`; nothing suggests one has. |
| 262 | CR-12 | **keep, Someday.** Not mine. No data consequence. |
| 463 | AF-66 | **merge into `DA-13`.** |
| 363 | AF-39 | **keep, Next, M.** This is a real gap in the *declaration* mechanism: a class of disagreement with no route into `discrepancies` short of changing code. That is the same problem `DA-09` and `PM-14` are about, and it should be sequenced right after `DA-09`. |
| 441 | AF-63 | **keep, Now** (already there), S. Right call: `races.note` is 2 rows today and a lede on 1,196 pages. |
| 456 | CR-36 | **keep, Next, S.** A citation right by construction and unasserted. Cheap, and it is the check that would have caught the defect it came from. |
| 457 | CR-37 | **merge into `CR-36`.** Same file, same class (a season hardcoded outside the registry), same sitting. |
| 458 | CR-38 | **keep, Next, M, and re-frame.** This is not a citation bug; it is `DA-03`/`PM-14`'s field-grain sourcing meeting a second real case. Cross-reference both, and use it as `claims`'s second worked example after the pole overwrite. |
| 185 | LV-03 | **keep, Someday, M.** New data, new grain (`session_results`), new checks. It will not fit in a burst and it does not unblock anything. After A–F. |
| 186 | WK-01 | **keep, Someday, M.** `qualifying_formats` shaped like `points_systems` is the right model — but `points_systems` has `DA-18`'s two-grains defect, so **do `DA-18` first** or the new table inherits it. Note that dependency on both. |
| 187 | WK-03 | **keep, Next, S.** `regulation_limits` is the best-modelled table here, the rows are sourced, and the surface exists and is unread. Cheapest real content addition in the queue. |
| 188 | WK-06 | **keep, Next, S.** `records` is derived and keyed now, so a survey has a good place to land. |
| 120 | PD-17 | **keep, Next, S, re-rank up.** `abbreviation` and `permanentNumber` are fine, but the finding that matters is that the harvest sees F1DB's driver ids and discards them — see `DA-24`. Re-scope to include `drivers.f1db_id` and the same for constructors and circuits. That turns an S nicety into the join key a bulk consumer needs. |
| 158 | PD-35 | **split.** The grid-penalty column (`race_entries.grid` vs `qualifying.position`) and the team-mate head-to-head are derivable today from data already held — two S items, **Next**. The rest points at `WK-01`, `WK-03`, `PD-28` and `LV-03` and should be **declined as an item**, since a list of pointers is not a task. |

---

## Ranked top ten for the project, from this discipline

| # | item | size | new? | why |
|---|---|---|---|---|
| 1 | **`meta.content_digest` + `meta.schema_version` + `meta.staged`** (`DA-21`+`SD-07`+`PM-22`) | S | new | Twelve databases answer to "2.24", one of them with a different schema. Nothing else on this list can be depended on until a file can name itself. |
| 2 | **Publish the identifier policy** (`DA-04`) | S | existing | One paragraph in `meta` and the README. 2,371 `standings` ids moved in one release and nothing says which ids are safe. A decision, not a task — take it. |
| 3 | **Rewrite `provenance.definition` for `reference`** (`DA-05`) | S | existing | The published definition is wrong about the source of 98% of the rows it describes, on the site, in two exports and in the compat file. The one claim the project is built on. |
| 4 | **`data_dictionary` table, generated at build** (`DA-23`, absorbing `DA-06`) | M in S slices | new | 67% of the schema's prose does not ship, and there is no machine-readable schema at all. One table fixes both, exports for free, and feeds `SD-11`. Start with grain statements for the 12 core tables. |
| 5 | **`source_id` on the 24 sourced tables, + a `column_licence` table** (`DA-03`+`DA-22`) | S/M + S | existing/new | Makes "may I publish this row" a query, and makes the CC BY-SA position arguable per column rather than per database. The commercial unlock, and useful the week it ships. |
| 6 | **`v_race_classification` + `v_driver_season_points`, and `views.sql` in the Parquet zip** (`DA-14`+`DA-17`) | S + S | existing | The first query a stranger writes has no view, and no view ships in two of three formats. |
| 7 | **`discrepancies` gets `(tbl, row_key, field)`, a constrained `status` and a stable `key`** (`DA-09`) | S | existing | 58 rows, one sitting, and it rehearses `PM-14` at 1/1600 scale on the table the project's claim rests on. 169 unrecorded disagreements are waiting for somewhere to go. |
| 8 | **`constructor_lineage.constructor_id` + the timeline check** (`DA-02`) | S then S | existing | 173 entries attributed to an operation that did not exist, and growing. The check fails today, which is what makes it worth having. |
| 9 | **`drivers.f1db_id` / `constructors.f1db_id` / `circuits.f1db_id`** (`DA-24`, via `PD-17`) | S | new | The convention already exists on five tables. Without it, reconciling against the project's largest source means matching on names. |
| 10 | **A data changelog per release** (`DA-21` rung three) | M | new | "What changed since v2.20" is the second question every data customer asks and it has no answer. Derivable by diffing the previous release's `.db`, which CI can fetch. |

Items 1–3 are a single sitting between them and they are the ones that change
what this dataset *is* to a stranger. Items 4–5 are the commercial ones. If only
one thing happens, make it item 1.

---

## What I did not examine

The front end beyond `web/src/data/worker.js`, `web/scripts/prepare-assets.js`
and grepping `web/src` for table and view names; the 2,385 prerendered pages;
the SQL console's behaviour against any trap above; `build.py` beyond reading
the resolver's inputs and the stage names (I did not run it, per instruction);
`verify.py` beyond its 255 check strings and four cited sections; the Parquet
files themselves — pyarrow was not exercised, so the exporter's behaviour is
read from `tools/parquet_export.py`, not observed, and the string-fallback
hazard at lines 140–147 remains unmeasured; `f1_database.json`, which is
gitignored and was not in the tree; the `harvest/` files and the loaders in
`tools/`; whether any *fact* is true, other than the arithmetic that
contradicted itself; the geometry database beyond its `meta`, row count and
`closes` distribution. I did not build the site and I did not run `npm`.

One thing seen in passing and handed on rather than filed: `export_json.py`'s
`NOT_EXPORTED` guard, which is good, has no counterpart for views — a view added
tomorrow is silently absent from all three published shapes and nothing fails.
That is `CR-11`'s loop rather than a finding of its own.
