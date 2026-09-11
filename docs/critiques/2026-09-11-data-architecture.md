# Data architecture critique — 2026-09-11

**Critic:** `data-architecture-critic`, first run.
**Subject:** the *published dataset* at v2.21 — the committed `f1.db` (46 tables,
38 views, 119,256 rows), `f1-geometry.db`, `f1_compat.json`, and the JSON and
Parquet exports as contracts. Not the pipeline, except where it leaks into the
shape of the data.
**Brief:** `.claude/CRITIQUE-BRIEF.md`. **Prior read in full:**
`docs/critiques/2026-09-10-product-design.md`,
`docs/critiques/2026-09-10-information-architecture.md`,
`docs/critiques/2026-09-10-content-design.md`,
`docs/critiques/2026-09-11-code-review.md`, `docs/BACKLOG.md`,
`docs/DERIVED-CONFIDENCE.md`, `schema.sql`.
**Handed to me explicitly:** `CR-02` (the compat export's 2026 snapshot) and
`CR-15` (facts as positional tuples). `CR-02` is answered at `DA-01`; `CR-15` is
a code-shape finding and I have nothing to add to it that the code review did not
already say better.

**Status of the claims below.** Everything ran read-only. The working tree was
not modified; two experiments ran on copies under the session scratchpad. Every
number carries a tag: `queried the database` came out of the committed `f1.db`
or `f1-geometry.db` today; `ran it` came out of a command run today, including
comparisons against `git show v2.19:f1.db` and `v2.20:f1.db`; `read the schema`
is a reading of `schema.sql` with a line; `read the docs` is the project's prose;
`inference` is reasoned, not observed. Nothing here has been independently
re-checked.

**Re-checked by the author before filing, all exact:** 251 rows for the 1988 drivers' championship; Force India twice in the 2018 constructors' final table; four kinds of `as_of` value; `constructors.renault` at `first_entry 1977`, chain `enstone`; zero non-NULL `stationary_seconds` in 22,481 pit stops; zero `points = 0` rows against 8,107 classified finishers with NULL points; `anticlockwise` once beside `anti-clockwise` ten times; 1,136 pole rows citing the Wikipedia season article, 836 of them carrying F1DB's laps and points; `POLE MEANS` absent from every stored `CREATE` statement; four ids present in both `drivers` and `constructors`; `known_gaps` #5 calling `pit_stops` empty. The two-shared-drive arithmetic, the release-to-release id comparison and the unique-index experiment were not re-run and stand at the critic's stated evidence level.

**Findings are `DA-01` to `DA-20`.** Sizes are the backlog's: **S** one sitting,
**M** a few sittings shippable in pieces, **L** a decision to make before any
task starts. Where a finding overlaps something already filed I cite the ID and
say the overlap in one line.

---

## The three that matter

### 1. `standings` has no key, and the column that should carry the grain carries four different ideas (`DA-01`)

`standings` is 34,563 rows — 29% of the database — and it is the table behind the
single most common question anyone asks of Formula One data. Three things are
wrong with it at once, and they compound.

**Its only uniqueness constraint is inert for 69% of its rows.**
`UNIQUE (year, table_type, after_round, entity_id, engine_id, as_of)`
(`schema.sql:305`) contains four nullable columns. SQLite treats NULLs as
distinct in a UNIQUE index, and `engine_id` is NULL on all 23,199 driver rows
while `after_round` is NULL on all 2,436 end-of-season rows — so 23,931 of 34,563
rows are not constrained by it at all (`queried the database`). On a copy I
inserted a byte-for-byte duplicate of a 2020 final driver row and of a 2020
round-5 driver row; both were accepted (`ran it`). One real duplicate has already
shipped: 2018 constructors carries **Force India twice**, once at `EX` with 0
points and once at P7 with 52 (`queried the database`). That one is a genuine
fact — two entrants under one id — but nothing in the schema could have told the
difference between it and a loader running twice.

**`as_of` carries four kinds of value and `after_round IS NULL` carries three.**
Today: `'round N'` on 32,127 rows (redundant with `after_round`), `'final'` on
2,368, `'current'` on 34, and the date-string `'2026-09-04 (after round 12)'` on
34. The last three all sit at `after_round IS NULL`, so that predicate means
*end-of-season classification* for 1950–2025 and *a snapshot whose round nobody
recorded* for 2026. The 2026 leader therefore has two different point totals at
`after_round IS NULL` — Antonelli on 242 from the formula1.com row and 267 from
the F1DB one — and both say `position = 1` (`queried the database`).

**Consequences, all observable.** `SELECT * FROM standings WHERE year=1988 AND
table_type='drivers'` returns **251 rows for 30 entrants**; the answer is 17
(`ran it`). `export_json.py` asked the naive question and has shipped 333 rows
for 23 drivers in seven released versions — that is `CR-02`, and its root cause
is here, not in the exporter. `web/src/lib/standings.js` contains a ninety-line
function, `finalStandings`, whose entire job is to reconstruct at read time a
grain the schema does not express; its docstring is a careful, correct essay on
a problem that should not exist. And `verify.py` cannot use `as_of` either — its
standings checks scope by `source LIKE '%formula1.com%'` and `source LIKE
'%f1db%'` (`verify.py:228,262,1686`), using the provenance column as the
classification discriminator because the classification column cannot do it
(`read the source`).

There is also **no view over `standings`** — see `DA-14`. So every consumer meets
the raw table, and every consumer has to invent `finalStandings` again. One did
not, and shipped corruption.

Defect. The fix has four rungs and the first two are cheap:

- **S** — ship `v_standings_final`: one row per entity per season, encoding what
  `finalStandings` encodes. Point the compat exporter at it. This closes `CR-02`
  properly rather than with a `WHERE` clause that will drift again.
- **S** — make the constraint real without changing a column:
  `CREATE UNIQUE INDEX ux_standings ON standings(year, table_type,
  COALESCE(after_round,-1), entity_id, COALESCE(engine_id,''), as_of,
  COALESCE(position_text,''))`. I ran this on a copy: it is **refused** without
  `position_text` (the Force India pair) and **accepted** with it (`ran it`).
  Including `position_text` is not a fudge — it is the column that actually
  distinguishes the two 2018 entrants, and putting it in the key records that.
- **M** — add `basis TEXT NOT NULL CHECK (basis IN ('running','final'))` beside
  `as_of`, derived by the build, and fill `after_round` on every row including
  the snapshots (13 for the F1DB current row, 12 for the formula1.com one). Keep
  `as_of` for one release, deprecate it in the next.
- **L, and a decision** — retire `as_of`, make `after_round` NOT NULL, and let
  `basis` + `source_id` carry what it was doing. This breaks the declared UNIQUE,
  `finalStandings`, both exporters, four `verify.py` sections and any downstream
  consumer. Worth doing only if the M above proves insufficient.

### 2. The constructor-lineage link has no time dimension, so 283 race entries are attributed to an operation that did not exist (`DA-02`)

`constructor_lineage` is a good idea, correctly time-boxed: the Enstone chain
runs Toleman 1981–85, Benetton 1986–2001, Renault 2002–11, Lotus F1 2012–15,
Renault 2016–20, Alpine 2021– (`queried the database`). But the link from a
result to a chain does not run through that timeline. It runs through
`constructors.lineage_chain`, a single row-level column on a table that is **one
row per constructor name**, and a name in this sport gets reused by unrelated
operations.

So: `constructors.mercedes` has `first_entry = 1954` and `lineage_chain =
'brackley'`. `constructors.renault` has `first_entry = 1977` and `lineage_chain =
'enstone'`. `constructors.aston-martin` has `first_entry = 1959` and
`lineage_chain = 'silverstone'`. Counted through the chain, 283 race entries land
in a chain whose own timeline excludes them (`queried the database`):

| constructor | entries | years | attributed to | which was, then |
|---|---|---|---|---|
| `renault` | 232 | 1977–1985 | Enstone | Toleman, or nothing |
| `mercedes` | 40 | 1954–1955 | Brackley | nothing until Tyrrell, 1970 |
| `aston-martin` | 11 | 1959–1960 | Silverstone | nothing until Jordan, 1991 |

Concretely: `SELECT COUNT(*) FROM race_entries e JOIN constructors c ON
c.id = e.constructor_id WHERE c.lineage_chain='enstone' AND e.finish_position=1`
returns **65 wins, of which 15 are Renault's 1979–83 turbo wins at Viry** — a
team that had nothing to do with Enstone (`ran it`). The same query is what any
lineage page or downstream "history of this team" feature would run.

Two smaller defects sit underneath it. `constructor_lineage.entity_name` is a
display string, not an id: **12 of 66 rows match no `constructors.name`**
(`Jordan Grand Prix`, `Kick Sauber`, `Williams Grand Prix Engineering`,
`Virgin Racing`…), so the chain cannot be joined to results in the other
direction either (`queried the database`). And only 55 of 150 constructors carry
a chain at all, with no marker distinguishing "no chain researched" from "a
single-entity operation".

Defect. **M**, shippable in pieces: (1) **S** — add
`constructor_id TEXT REFERENCES constructors(id)` to `constructor_lineage`; 54 of
66 rows can be filled by the existing name match, 12 by hand. (2) **S** — add a
`verify.py` check that every `race_entries` row reached through a chain falls
inside that chain entry's `[from_year, to_year]`; it fails today on 283 rows,
which is what makes it worth having. (3) **M** — deprecate
`constructors.lineage_chain`, or redocument it honestly as *the chain this name
most recently belonged to*, which is all it can truthfully be. What this breaks:
anything that joins on `lineage_chain` today — which, since there is no lineage
page yet (`IA-01` territory), is nothing on the site.

### 3. "May I publish this row?" is not a query, though the schema says it is (`DA-03`)

`source_registry`'s own comment (`schema.sql:63-68`) states the goal exactly:

> These four are the same judgement in a form the BUILD can read, so that "may
> this row be published?" is a query rather than a memory.

It is not a query. There is **no `source_id` on any fact table**. Twenty-two
tables carry a free-text `source`; resolving one to a registry entry requires
longest-prefix matching against `source_registry.url` and then matching ten
**Python regular expressions** held as text in `source_patterns` — which SQLite
cannot evaluate. Fifteen further tables have no `source` at all and resolve via
`table_provenance`, a second and different mechanism. So the resolution rule is a
Python algorithm in `build.py` and `verify.py`; the database ships the inputs and
withholds the function (`read the schema`, `queried the database`).

The consequence for the audience this project says it wants: a data scientist
with the Parquet bundle, who never runs the pipeline, **cannot filter to the rows
they may redistribute**. The registry tells them `redistributable` per *source*;
nothing tells them which rows belong to which source. They can approximate it
with `LIKE '%f1db%'` — and `DA-12` below shows why that approximation is wrong on
1,136 rows.

This is also the cheapest unblocker in the whole confidence programme.
`DERIVED-CONFIDENCE.md` step 3 (`PM-14`, `claims`) needs a
`(table, row_key, field, source_id)` shape; a `source_id` column is the first
column of it and pays for itself immediately on its own.

Defect. **M**, with an **S** first slice: add
`source_id INTEGER REFERENCES source_registry(id)` to the 22 tables that already
have `source`, written by the build with the resolver it already runs, and add
the `verify.py` check that it is never NULL where `source` is not. Then add a
`v_row_licence` view over it. Nothing breaks — the column is additive, and
`source` stays. Cite `PM-14` when doing it: this is its precondition, and it is
worth shipping even if `PM-14` never happens.

---

## Seven questions, written as SQL

The brief asks for five. I wrote seven, because two of them are the ones the
model got right and they matter as much.

| # | Question | Worked? | Local knowledge needed |
|---|---|---|---|
| 1 | The 1988 drivers' championship | no — 251 rows for 30 entrants | `as_of='final'`, undocumented in the shipped DB |
| 2 | The 2026 championship as it stands | no — two rows per driver, 242 vs 267 points, both `position = 1` | which of two snapshots is current; written nowhere |
| 3 | Verstappen's 2023 points total | no — short by 21 | sprint points live in a second table; nothing says so |
| 4 | Ferrari's win count | no — `COUNT(*)` gives 251, the answer is 250 | shared drives; `v_wins_by_constructor` gets it right, the obvious query does not |
| 5 | The 2023 Belgian GP classification, with pole and fastest lap | **yes, first attempt** | none |
| 6 | Which rows may I redistribute | **not answerable in SQL at all** | see `DA-03` |
| 7 | Which layout was raced at Bahrain in 2020 | **yes, first attempt, and the view labelled its own confidence** | none |

Questions 5 and 7 are the model working. Question 5 is the payoff of the v2.4
race redesign: one join, one `WHERE`, the shared-drive and pit-lane cases
already lossless in `position_text` and `grid_text`. Question 7 is
`v_race_venues`, which resolves the layout through `races.layout_key`, then
`by_year = 1` and the year interval, and returns a `figures` column reading
`as raced` or `current layout` so the consumer knows which they got (483 and 689
races respectively). That is a view that documents its own limitation in its own
output, and it is the best thing in this schema.

Questions 1–4 all fail the same way: the correct query requires a fact that is
true of the data and is not in the data.

---

## The full set, by consequence

### `DA-01` — `standings` has no key, and `as_of` carries four meanings. *See above.* `queried the database`, `ran it`, `read the source`. Defect. **S** (view) + **S** (index) + **M** (`basis`) + **L** (a decision).

### `DA-02` — The lineage link has no time dimension. *See above.* `queried the database`, `ran it`. Defect. **M**, in three pieces.

### `DA-03` — A row's licence is not a query. *See above.* `read the schema`, `queried the database`. Defect. **M**, **S** first slice.

### `DA-04` — Surrogate ids are not stable between releases, and there is no way to tell what changed

Between `v2.20` and `v2.21`, **4,774 of 27,482 `race_entries` ids changed** while
the row's content — same race, same driver — did not. Between `v2.19` and
`v2.20`, zero did (`ran it`, `git show v2.19:f1.db` / `v2.20:f1.db` against the
committed copy). `discrepancies` lost 21 of 43 surviving ids in the same step.
`races`, `circuit_layouts` and `season_entrants` were stable across both.

So the ids are stable until a build-order change moves them, nothing declares
which are stable, and nothing announces when they move. `race_entries.id` is an
`INTEGER PRIMARY KEY` assigned in insert order; the pole split (`PM-05`) changed
the order. A downstream consumer who stored `race_entries.id` as a foreign key —
the obvious thing to do with a table called `id` — silently repointed 17% of
their rows on upgrade.

Two related absences. `meta.version` is one number for both the schema and the
data, so a consumer cannot ask "did the schema change?" without diffing; and
there is no changelog of *data* changes as distinct from releases — `PD-07`
moves the version log to `BUILD-NOTES.md`, which is a release log, not a data
one. And `known_gaps` ids are positional integers cited by number in `schema.sql`
comments ("see `known_gaps` #10", "`known_gaps` #1") and throughout `docs/`;
`PD-05` proposes filtering closed gaps out, at which point every one of those
references rots.

Defect, and a decision. **M**, or **?** if the decision goes the other way:

- **S** — publish an identifier policy in `README`/`meta`: natural keys
  (`(race_id, driver_id)`, `(year, round)`, `drivers.id`) are stable; surrogate
  `id`s are not, and may be renumbered by any release. Saying so costs nothing
  and is the honest state today.
- **S** — give `known_gaps` a stable `key` slug and reference that in comments.
- **M** — if surrogate stability is wanted instead, order the inserts
  deterministically by natural key and add a `verify.py` check comparing against
  the previous release's mapping. That is the harder promise and it is a real
  commitment for a project that says it wants to be depended on.

### `DA-05` — The confidence tier carries 0.16 bits, and its published definition is wrong for 96% of the rows that carry it

96,620 rows carry a `confidence` value. **98.3% of them are `reference`**
(`queried the database`). The Shannon entropy of the column across the whole
database is **0.158 bits** — knowing a row's tier tells a consumer almost nothing
they did not already know. `DERIVED-CONFIDENCE.md` says the tiers were "assigned
by table, not by row"; this is the number that says how much that costs.

Worse, the definition shipped alongside them is wrong. `provenance.definition`
for `reference` — which reaches the site, `f1_database.json` and
`verification_policy` in `f1_compat.json` — reads:

> Harvested from Wikipedia's season results tables, which are transcribed from
> FIA classifications. Every row was cross-checked on load against independently
> held season data.

Of the 94,957 `reference` rows, **91,407 came from F1DB and 3,547 from
Wikipedia** (`queried the database`). And the second sentence is false for
`engines` (424), `season_entrants` (1,925), `sprint_results` (590) and `chassis`
(1,153) — which is `DERIVED-CONFIDENCE.md`'s own Group 1, never carried back into
the definition the reader sees.

**On the brief's question — is a tier the right primitive at all?** No, not as
the *stored* primitive. But the answer is not `PM-15`/`PM-16` first: those are L
and M and their value only arrives together. The order that pays each week is
`DA-03`'s `source_id`, then `checks` (`PM-15`), then derivation (`PM-16`), with
the tier kept as a **view** over the evidence rather than a column. The ladder is
a good reader-facing abstraction and should survive; it is a bad storage
primitive and should stop being one.

Defect (the definition) and preference (the primitive). **S** for the definition
— rewrite it to say what the tier now means, and add the `verify.py` check that
the sources named in a definition are the sources the rows actually cite. The
rest is `PM-15`/`PM-16` and I am not re-filing them.

### `DA-06` — Two-thirds of the schema's prose does not reach the shipped database

SQLite stores a table's `CREATE` statement text in `sqlite_master`, comments and
all — which is why `f1.db` is unusually self-describing and why I could review it
without the repository. But SQLite stores the text **from the word `CREATE`**.
Every block comment written *above* a `CREATE TABLE` is discarded.

`schema.sql` has 448 whole-line comments. `f1.db` carries 150. **298 lines — 66%
— do not ship** (`ran it`). Among them:

- the entire **`WHAT 'POLE' MEANS HERE`** block (`schema.sql:669-709`), the most
  important piece of documentation this project wrote this week. The surviving
  inline comment on `race_entries.pole` reads *"Distinct from grid = 1 on
  purpose: see WHAT 'POLE' MEANS HERE, above"* — and in the shipped database
  there is no above (`queried the database`: `POLE MEANS` appears in no stored
  SQL);
- the race-model block stating that `race_entries` is one row per driver per
  race;
- the `qualifying` block explaining why `time` and `q1/q2/q3` are never both set;
- the `sprint_results` block explaining that emptiness before 2021 is a fact and
  not a gap;
- the `laps` block explaining why four tables are empty — the single thing a
  bulk-data consumer is most likely to misread;
- the confidence ladder at the head of the file.

Checking the constraint before flagging the absence: `schema.sql` **is** uploaded
with the GitHub release (`release.yml:96`), so a release consumer can get it.
This bites (a) anyone holding only `f1.db`, which is what the site serves and
what `IA-15` now tells every reader to download, (b) the direct
`lapledger.org/f1-parquet.zip` download, and (c) the browser's own SQL console,
where a reader inspecting the schema sees two-thirds of the reasoning missing.

Defect, and unusually cheap. **S**: move each block comment inside its
parentheses as the first lines after `(`. The text does not change; the build
does not change; `f1.db` gains 298 lines of the best documentation in the
project. Confirm byte-stability after, since the stored SQL text changes.

### `DA-07` — `pit_stops` ships 22,481 rows with no durations, and the gap register says the table is empty

`pit_stops` holds 22,481 rows covering 1994–2026, all `source = 'f1db'`, which is
exactly what `CLAUDE.md` permits. Every one of `stationary_seconds`,
`pit_lane_seconds` and `driver_code` is **NULL in all 22,481 rows**
(`queried the database`). What ships is (race, driver, stop number, lap) — real
and useful data, from which pit-stop *strategy* is derivable and pit-stop
*duration* is not.

Nothing says so. The table's schema comment (`schema.sql:1133-1136`) is entirely
about the distinction between stationary time and pit-lane time and ends
*"Storing the one we have in the column that names it, and leaving the other
NULL, is the difference between a figure and a wrong figure"* — which reads as a
promise that one of them is filled. And `known_gaps` #5 states, of the shipped
database: *"The laps, stints, **pit_stops**, race_control_messages and team_radio
tables are EMPTY in the distributed database."* Two of those five are not:
`pit_stops` has 22,481 rows and `team_radio` has 6 (`queried the database`).

The gap register is this project's honesty mechanism. `./f1 gaps` prints it, the
homepage counts it, and it makes a factually false statement about the shipped
artefact that one line of SQL disproves. `PD-05`/`CD-06` are about which gaps are
*closed*; this one is about a gap that is *wrong*.

Defect. **S**, and it should ride with `PD-05`: correct #5's text, correct the
`pit_stops` comment to describe what the column actually holds, and add the
`verify.py` check that every table `known_gaps` calls empty has zero rows. That
check is the `PD-07` pattern — derive the claim, then pin it — applied to the one
surface where being wrong costs the most.

### `DA-08` — Nothing scores zero, except in the one table where everything does

`race_entries.points` is NULL on 18,942 rows, of which **8,107 have a finish
position** — a classified finisher, outside the points-paying places. There is
**not one row in `race_entries` with `points = 0`** (`queried the database`).
`sprint_results` is the same: 373 NULLs, zero zeroes. Meanwhile
`standings.points = 0` on **3,489 rows**.

So one concept — *scored nothing* — is encoded two ways in one database, and the
NULL encoding collides head-on with the convention this project teaches its
readers on the homepage and enforces in `DataTable`'s footer: *a blank means not
established, never zero.* For 8,107 rows it means zero, and the database knows
it: a driver who finished twelfth in 1974 scored nothing, and that is a fact, not
an absence. `CD-01` landed exactly this fix for `status`; this is the same defect
one column over, and it is in the data rather than the renderer.

Defect. **S**, but it is a decision first, because it is a data change with a
downstream: write `0` where the era's points system says the position paid
nothing, and reserve NULL for positions the system cannot resolve. What it
breaks: any consumer summing with `COALESCE` is unaffected; any consumer
counting `points IS NOT NULL` as "has a result" changes by 8,107 rows. Add a
`verify.py` check that `points IS NULL` implies `finish_position IS NULL` once
done.

### `DA-09` — `discrepancies` is the least-modelled table in the database, and it is the one the project originates

45 rows. The project's distinguishing claim rests on this table — *where two
sources genuinely disagree the disagreement is recorded* — and it is the only
significant table with no keys, no vocabulary and no types
(`queried the database`):

- **`subject` holds four different key formats**: a car display name
  (`McLaren M23`), an *aggregate over rows* (`5 chassis quoting 500`), a race key
  (`1960 round 5`), a driver display name (`Sir Lewis Hamilton`), and a composite
  (`mclaren-m23 1976`). None of them is an id. `PD-04` landed a `verify.py` check
  that a subject joins to something — that logic lives in Python, so a consumer
  of the published data cannot join this table to anything.
- **`field` uses three vocabularies at once**: a column name (`weight_kg`,
  `fastest_laps`), a concept in prose (`fastest lap`, with a space), and a Python
  constant (`CAR_SEASONS`).
- **`status` is free-text prose** with six distinct values
  (`open - sources differ, reference record favours the stored value`,
  `resolved - claim not corroborated`, …). Filtering open from closed requires
  `LIKE 'open%'`. `PD-05` asks for a `state` column on `known_gaps`; the same
  problem here is unfiled and worse, because the count of open rows is a headline
  figure.
- **`derived_value` carries the literal string `'NULL'`** on 23 rows.

And the table is not applied consistently. `chassis.published_wins` differs from
the derived `wins` on **143 of 759 rows**, and `published_races` is *lower* than
the derived `races` on 9 — `minardi-ps04` at 0 published against 18 derived — and
none of the 152 appears in `discrepancies` (`queried the database`). The stated
policy is that a disagreement is recorded rather than resolved; here 152 are
neither.

Defect. **S**, and it is the best-value slice of `PM-14` available today: give
`discrepancies` `(tbl, row_key, field)` as three columns — 45 rows, one sitting —
and a `status` constrained to `open | resolved | explained` with the prose moved
into `assessment`. That shape is exactly the shape `claims` will need, so doing
it now is a rehearsal on 45 rows instead of 96,000, and it makes the table
joinable for `PD-04`'s component without Python.

### `DA-10` — `standings.entity_id` is a polymorphic key over two colliding namespaces

`entity_id` points at `drivers.id` when `table_type='drivers'` and
`constructors.id` when it is `'constructors'`. SQLite cannot declare that, so
`standings` has **no foreign key except `confidence`** (`queried the database`,
`PRAGMA foreign_key_list`). Integrity holds today — all 34,563 resolve — but it
holds because the pipeline is careful, not because the schema says so.

The trap is live: **four ids exist in both tables** — `brabham`, `fittipaldi`,
`amon`, `modena`. `standings JOIN drivers ON drivers.id = standings.entity_id`
without a `table_type` filter returns 23,716 rows instead of 23,199, silently
turning 517 constructor standings into driver ones (`ran it`).

Separately, `standings.entity` denormalises a display name that already exists
in `drivers.full_name` / `constructors.name`, and it disagrees: five entity_ids
carry two spellings (`Kimi Antonelli` / `Andrea Kimi Antonelli`, `Lewis Hamilton`
/ `Sir Lewis Hamilton`, `Sauber` / `Kick Sauber`). That reaches the published
`f1_compat.json`, where the 2026 snapshot lists both spellings as if they were
different people (`queried the database`, `ran it`).

Defect. **S**, rides with `DA-01`: replace `entity_id` with nullable
`driver_id REFERENCES drivers(id)` and
`constructor_id REFERENCES constructors(id)` plus
`CHECK ((driver_id IS NULL) <> (constructor_id IS NULL))`, keeping `entity_id`
as a generated or build-written compatibility column for one release. Then the
FK is declarable, the join is unambiguous, and `entity` can be dropped or
documented as a snapshot of the name at the time.

### `DA-11` — `standings.engine_id` is F1DB's namespace wearing this project's column name

The column exists for a good reason, stated well (`schema.sql:286-290`): the
constructors' championship is contested by a chassis-engine combination, and
without it Cooper-Climax and Cooper-Maserati collapse into one row. What the
comment does not say is **which vocabulary the values are in**. All 11,343 resolve
against `engines.f1db_manufacturer_id`; only 1,114 resolve against
`engine_manufacturers.id`, and those 1,114 resolve by coincidence, because
`climax` and `cosworth` happen to exist in both namespaces (`queried the
database`). The curated registry uses `-eng` suffixes: `ferrari-eng`, `brm-eng`,
`renault-eng`.

So `standings JOIN engine_manufacturers ON id = engine_id` returns a plausible,
arbitrary 10% of the constructors' championship and drops the rest without error.
This is the one place the project breaks its own naming convention — `chassis`
and `season_entrants` both spell it `f1db_constructor_id` precisely so this
cannot happen.

Defect. **S**: rename to `f1db_engine_manufacturer_id`, or add
`engine_manufacturer_id TEXT REFERENCES engine_manufacturers(id)` beside it. At
minimum, say in the column comment which namespace it is — one line, and it ships
inline so it reaches the database.

### `DA-12` — The pole / grid / qualifying split is the right model, and it made `race_entries.source` wrong on 1,136 rows

**First, the endorsement, because the brief asks the question directly.** The
three-way split that landed this week is correct and should not be reopened. The
cardinality is exactly right: all 1,162 completed races have exactly one `pole`
row, one `qualifying.position = 1`, and 1,160 have a `grid = 1` (the two missing
are the 1996 and 2021 pole-sitters who never started). The three names differ in
**16 races**, and I read all 16: every one is a real distinction — grid
penalties (2005 Monza, 2019 Mexico, 2023–24 Spa), sprint-set grids through 2021,
the 2022 São Paulo case where Magnussen holds pole and Russell starts first, and
Brooks/Allison at the 1959 Nürburgring (`queried the database`). There should
**not** be a first-class "credited pole" fact elsewhere. Pole is a per-driver
credit on a race, exactly like `fastest_lap`, and it belongs on the entry. The
alternative — a `race_credits`-style side table — is what v2.4 correctly
abolished, and the schema comment explaining why is right.

**Now the defect it exposed.** A `race_entries` row that holds pole has its
`source` overwritten with the Wikipedia season article: **1,136 of the 1,162 pole
rows** cite `en.wikipedia.org/wiki/YYYY_Formula_One_World_Championship`. But
every other column on those rows came from F1DB — 836 of them provably, because
they carry `laps_completed` and `points`, which only the F1DB harvest writes
(`queried the database`). The row immediately below in the same race, identical
in kind, cites `github.com/f1db/f1db`:

```
farina   grid 1  pole 1  P1  laps 70  9.0 pts  source: …/1950_Formula_One_World_Championship
fagioli  grid 2  pole 0  P2  laps 70  6.0 pts  source: https://github.com/f1db/f1db
```

The consequence is not cosmetic. A consumer filtering by source — to comply with
a licence, or to count coverage per source, which is the whole point of
`DA-03` — attributes every winner's row to the wrong place. This is the concrete,
already-shipped instance of the argument `DERIVED-CONFIDENCE.md` makes in the
abstract: **`source` is row-grain and sourcing is field-grain**, and the moment
two harvests write to one row the column starts lying. The document lists five
ad-hoc encodings of corroboration; this is a sixth, and it is the only one where
a stored value is simply wrong.

Defect. **S** as a stopgap: leave `source` naming the majority of the row and
record the pole credit's source once, per race, rather than overwriting 1,136
rows. **M** properly: this is the case that justifies `claims` (`PM-14`) with
`field` populated, and it is a better opening example than any in the document
because the harm is demonstrable.

### `DA-13` — One CHECK constraint in forty-six tables, and the vocabularies have already drifted

`schema.sql` contains exactly one `CHECK`:
`source_registry.redistributable IN ('yes','facts-only','no')` (`schema.sql:78`).
Every other controlled vocabulary in the database is enforced by the pipeline or
by nothing.

The project already knows the right pattern and uses it once: `confidence
REFERENCES provenance(confidence)` on 35 tables, which the code review verified
refuses a typo with foreign keys on. That pattern should have spread. What has
happened instead (`queried the database`):

- **`circuits.direction`** holds `anti-clockwise` (10), `clockwise` (69) and
  `anticlockwise` (1 — Jacarepaguá). A filter on direction already misses a
  circuit. This is exactly the failure the "one country vocabulary" rule in
  `CLAUDE.md` exists to prevent, applied to one column only.
- **`personnel.role`** is documented as `designer | team principal | official |
  founder` and holds **18 distinct values**, because it is quietly multi-valued
  (`founder / designer`, `team principal / official`).
- **`team_radio.speaker`** is documented as `driver | engineer | team` and holds
  six full sentences (`Rob Smedley (race engineer) to Felipe Massa
  [pit-to-car]`). Six rows, six values, none in the declared vocabulary.
- **`article_images.repository`** has a schema comment reading *"Must be
  'shared'. A file hosted locally on en.wikipedia.org is local BECAUSE it is
  non-free; linking one would be a licence violation"* — and no CHECK. That is a
  licence guard stated in prose and enforced nowhere.
- `races.status`, `standings.table_type`, `drivers.status`,
  `regulation_changes.category`, `circuits.circuit_type`, `cars.aspiration` and
  `source_registry.authority` are all clean today and all unconstrained.

Defect, small each, cumulative. **S**: eight `CHECK` clauses and one data fix
(Jacarepaguá). Where a vocabulary has a *definition* rather than just a list —
`authority`, `circuit_type` — a lookup table with the FK is better than a CHECK,
for the same reason `provenance` is.

**Two things I checked here and cleared.** SQLite's permissive typing is not
being exploited: across every non-empty table, **zero columns store a value whose
`typeof()` contradicts the declared type** (`ran it`). And referential integrity
holds everywhere it is undeclared — all 2,292 `+`-separated `chassis_ids` tokens
resolve to `chassis.id`, all 55 `constructors.lineage_chain` values resolve, and
every year column resolves to `seasons.year` (`queried the database`). The
pipeline's discipline is real; my point is only that a consumer who appends to
this database inherits none of it.

### `DA-14` — The view layer does not reach 71% of the rows, and does not ship at all in two of the three formats

Not one of the 38 views touches `standings`, `qualifying`, `sprint_results`,
`pit_stops`, `discrepancies`, `known_gaps`, `source_registry`,
`source_patterns` or `table_provenance` (`queried the database`, matching
`sqlite_master.sql`). Those nine tables hold **84,732 of 119,256 rows — 71%**.

What is there is good and is mostly shaped by what the CLI and the pages happened
to need: `v_race_venues`, `v_ambiguous_seasons`, `v_circuits` and
`v_chassis_coverage` are genuinely designed, and most of the rest are one
subcommand each. What is missing is precisely the set a stranger needs first:

- **a standings view** — the direct cause of `CR-02` (`DA-01`);
- **a race classification view** — `race_results` is a compat view returning
  winner, pole and fastest lap only; there is no view of the finishing order,
  which is the release headline of v2.15;
- **a provenance view** — nothing lets a consumer ask *how much should I trust
  this row* without reading `docs/`. That is the project's whole claim and it has
  no surface in the data (`DA-03`, `DA-05`).

And the views do not ship. `tools/parquet_export.py` iterates
`sqlite_master WHERE type='table'`: **41 Parquet files, no views**.
`export_json.py` does the same, and additionally omits `qualifying` and
`pit_stops` for size — **38 tables, no views, 49,478 fewer rows** than the
database. So the three published shapes have three different contents and nothing
tells a consumer which to choose or what each omits. A Parquet consumer who wants
"which layout was raced at Bahrain in 2020" must reinvent `v_race_venues`'s
three-way join from nothing, because the view is the only place that logic is
written down.

Defect. **M**, in pieces: (1) **S** — `v_standings_final` and
`v_race_classification`; (2) **S** — write the view SQL into the Parquet bundle
as a `views.sql` text file, which costs one `zipfile.writestr` and rides with
`PM-23`'s `README.txt`; (3) **S** — a short "which download, and what it omits"
table in `release.yml`'s body and on `/data` when `PD-11` lands.
Note `CR-11` overlaps: it asks that the views be *exercised*; this asks that they
be a designed interface. Both fixes touch the same loop.

### `DA-15` — `dates` is a display column for 2% of the rows and a duplicate for the other 98%

The two-column decision is recorded and the reasoning is sound in principle
(`schema.sql:718-727`): a Grand Prix is a weekend, a single ISO day cannot
express one, and a range cannot be parsed. In the data, `dates` is an ISO day
identical to `date_iso` on **1,149 of 1,172 rows**, and a human range on 23 —
every one of them a 2026 round (`queried the database`).

So the column a consumer is meant to render has a format that changes with the
row: `1950-05-13` for seventy-six seasons and `27-29 Mar 2026` for one. A
renderer written against it produces raw ISO dates for 98% of pages. And because
the range is unparsed text, no check can compare it to `date_iso` — which is why
Las Vegas 2026 carries `dates` `19-21 Nov 2026` and `date_iso` `2026-11-22`,
outside its own range (`AF-01` spotted the symptom; the structural cause is
here).

Defect, small. **S**, and two options, either honest: (a) make `dates` always a
formatted display string, derived from `date_iso` where no range is known, so
the type is uniform; or (b) replace it with `date_from` / `date_to`, both ISO,
and let the renderer format — which also makes the range checkable and closes
`AF-01`'s Las Vegas case. I prefer (b): it turns a string nothing can validate
into two dates everything can.

### `DA-16` — Declared columns that are never filled, and a gap register whose only number is zero

**Fourteen columns are NULL in every row of a non-empty table**
(`queried the database`): `constructors.entries` (0 of 150),
`cars.fuel_capacity_l`, `chassis.fuel_capacity_l`, `pit_stops.driver_code`,
`pit_stops.stationary_seconds`, `pit_stops.pit_lane_seconds` (`DA-07`),
`race_entries.note`, `races.note`, `sprint_results.note`, `season_entries.note`,
and four of `team_radio`'s seven value columns. Several more are under 5%:
`drivers.entries` 38/862, `drivers.starts` 31/862, `drivers.career_points`
38/862, `standings.team` 44/34,563.

A consumer cannot tell *empty because unknown* from *empty because never
implemented*, and the project's own convention insists the first reading. Three
consequences are already visible: `CD-03` found `races.note` is dead code in both
renderers; `PD-06` found the drivers register opening on two empty columns; and
`standings.team` renders as `"team": null` on 310 of 333 rows in the published
`f1_compat.json` (`ran it`).

`drivers` compounds it by mixing derived and stored figures with no marker.
`wins`, `poles`, `fastest_laps` and `podiums` are derived and complete on all 862
rows; `entries`, `starts`, `career_points` and `titles` are stored and sit in the
same block. Only a schema comment says which is which, and it names four of
eight. Nine of the 38 rows with a `career_points` value disagree with the sum of
that driver's race and sprint points — Hamilton by 8, Verstappen by 15, Fangio by
32.5 — and none is in `discrepancies` (`queried the database`). Fangio's is
correct and interesting (his official total is net of dropped scores); nothing in
the data says so, so a consumer sees two numbers and no explanation.

And `known_gaps.races_affected`, the register's only machine-readable field, is
**0 on 10 of its 11 rows** — including #3, whose own description says the winning
chassis is known for 874 of 1,161 races, and #5, which covers every race in the
database.

Defect. **S**: drop the columns that are structurally empty, or record in
`table_provenance`-style prose why they exist; mark derived columns in `drivers`
(a `_derived` suffix, or a comment naming all eight); fill `races_affected` or
delete it. `PD-06` and `CD-03` should ride with this — they are the same defect
seen from the page.

### `DA-17` — A season's points live in two tables and nothing says so

Summing `race_entries.points` for a driver-season disagrees with the final
standings for **40 driver-seasons between 1991 and 2025**. Adding
`sprint_results.points` closes **all 40** (`ran it`).

The modelling is right — a sprint is a separate race with its own grid and
classification, and the schema comment says so well. The problem is that nothing
a consumer reads tells them a championship total is a UNION of two tables. The
`sprint_results` comment explains why the table exists; it does not say that
omitting it makes every post-2021 points question wrong by up to 21 points
(Verstappen, 2023).

Defect of discoverability. **S**: one `v_driver_season_points` view, or one
sentence in the `race_entries.points` comment — which, being inline, would ship.

### `DA-18` — `points_systems` holds two grains under one interval

Ten rows. Eight describe Grand Prix scoring; two describe **sprint** scoring, and
the only thing distinguishing them is the string prefix `SPRINT: ` inside the
`scoring` text (`queried the database`). So the obvious query —
`WHERE from_year <= 2023 AND (to_year IS NULL OR to_year >= 2023)` — returns two
rows with overlapping intervals, and a consumer has to know to substring-match.

Within the same table, `fastest_lap` and `dropped_scores` carry the **string**
`'None'` on the GP rows and SQL NULL on the sprint rows. So "no fastest-lap point
that era" is a four-character string and "not applicable" is a NULL, in one
column, against a project convention that a blank means *not established*.

Defect, small. **S**: add
`session TEXT NOT NULL DEFAULT 'race' CHECK (session IN ('race','sprint'))`,
strip the prefix, and replace `'None'` with NULL (or, better, with `0`, per
`DA-08`).

### `DA-19` — `records` cannot be joined, compared or checked

`PD-03` already says derive it or drop it, and `IA-16` endorsed keeping the page.
My addition is about the rows that survive that decision. Even the records that
genuinely cannot be derived — youngest champion, most consecutive wins — are
unusable as data: `holder` is a display name and not a foreign key (`Lewis
Hamilton, Michael Schumacher` in one cell), `value` is free text (`over 400`,
`about 47%`, `7 each`, `23 years, 134 days`), and `as_of` is prose with **24
distinct forms** across 30 rows, including `career`, `end of 2025` and
`2026 season, in progress` (`queried the database`). Note that `as_of` here means
something different again from `standings.as_of` — same column name, third
meaning.

Preference, riding on a filed defect. **S**, and only worth doing *after*
`PD-03`: whatever survives needs `holder_id` with an FK, a numeric `value` beside
the `value_text`, and `as_of` as an ISO date.

### `DA-20` — Seven spellings of a validity interval, and two meanings of a NULL end

The same idea — *this thing was current between these years* — is spelled seven
ways across the schema (`read the schema`, `queried the database`):
`from_year`/`to_year` (8 tables), `first_year`/`last_year` (2),
`first_entry`/`last_entry`, `first_gp`/`last_gp`, `first_season`/`last_season`,
`first_held`/`last_held`, `active_from`/`active_to`.

Worse than the naming, the NULL end means two different things. In most tables
`to_year IS NULL` means *still current*. In `chassis` and `grands_prix` it never
occurs — those carry `2026` instead. And `constructors.last_entry` is commented
*"NULL = still competing"* while **10 constructors with a NULL `last_entry` last
raced between 1951 and 1997** — Talbot-Lago, Connaught, Gordini, Lola, Footwork
(`queried the database`). A consumer following the comment gets Talbot-Lago as a
current Formula One team. The `active` flag has it right for all ten, which means
the database holds two encodings of currency and they disagree on 10 of 150 rows.

`regulation_limits` is the counter-example and the model to copy:
`to_year INTEGER NOT NULL`, with a comment explaining that holes are deliberate
because carrying a limit across an unrecorded change would invent one. That is
the most careful temporal modelling in the schema.

Mostly preference; the `constructors.last_entry` comment is a defect. **S** for
the comment and the ten rows (fill `last_entry`, or change the comment to point
at `active`). **M**, and genuinely optional, for converging the seven names —
a grain-adjacent rename across eight tables, three exporters and the front end,
for consistency rather than correctness. I would not do it before anything else
in this list.

---

## Examined and cleared

Things worth the time to disprove, so nobody spends more on them.

- **The pole / grid / qualifying split is right.** Endorsed above at `DA-12`. All
  16 divergences are real distinctions; the cardinality is exact; there should be
  no separate "credited pole" table. The only defect is the `source` overwrite.
- **`race_entries` one row per driver per race is the right grain, and should not
  change.** The known loss is real and I measured it: the points arithmetic
  exposes exactly **two** positions in 77 seasons where a co-driver is missing
  because he already has a row in that race — the 1955 Argentine Grand Prix's
  third-place Ferrari (1.33 points stored against an award of 4, so two of three
  sharers absent) and the 1956 Monaco Grand Prix's fourth-place Ferrari (1.5
  against 3, so one of two absent, and the missing man is Fangio, already
  credited second) (`ran it`). Two rows in 27,482. Changing the grain to
  `(race, driver, car)` would touch every view, both exporters, `verify.py` and
  the front end to fix two rows. **Do not.** Record the two in `discrepancies`
  with the arithmetic attached, and move the grain statement out of
  `known_gaps` #2 — where it currently sits inside a gap whose first word is
  `CLOSED` — into an inline schema comment that ships (`DA-06`).
- **`circuit_layouts` + `races.layout_key` + `v_race_venues` is the best model in
  the database.** 49 `by_year` layouts forming complete non-overlapping
  timelines, 2 one-offs reachable only through `races.layout_key`, zero
  overlapping intervals, zero unresolved `layout_key`s, and a view that tells the
  consumer whether the figures it returned were as-raced or current
  (`queried the database`). Bahrain 2020's two layouts in one season resolve
  correctly. Do not touch this.
- **Declared types match stored types everywhere.** Zero violations across every
  non-empty table (`ran it`). This is rare in a SQLite dataset and it means the
  Parquet type contract is sound *today*. The latent risk is worth knowing:
  `tools/parquet_export.py:140-147` falls back to `string` for a whole column if
  one value does not fit, so the Parquet schema is a function of the data and can
  change between releases without any declaration. Nothing to do now; a
  `verify.py` assertion that no column ever triggers the fallback would keep it
  that way, and is part of `CR-11`'s loop.
- **Undeclared referential integrity holds.** All 2,292 `+`-separated
  `chassis_ids` tokens resolve; all `lineage_chain` values resolve; every year
  column resolves to `seasons`; all 34,563 `standings.entity_id` values resolve
  within their `table_type` (`queried the database`). The `confidence`
  foreign key to `provenance` on 35 tables is the pattern the rest of the schema
  should copy.
- **The ODbL split, and `f1-geometry.db`'s `meta`.** Eight keys naming the
  licence, the attribution, the companion file and the command that merges them.
  This is the most self-describing artefact the project publishes and the model
  for what `f1.db`'s `meta` should look like (`PM-22` is already queued on one of
  its keys). The dangling `REFERENCES circuits(id)` in the standalone geometry
  database is unavoidable under the Collective Database requirement and the
  `companion` key handles it.
- **`season_entrants`'s `+`-separated lists and the `chassis_count = 1` rule.**
  The schema argues that splitting them into rows would invent an attribution the
  source never made, and it is right. This is the clearest example in the project
  of refusing to model beyond the evidence, and `v_ambiguous_seasons` lists the
  321 cases rather than hiding them.
- **`position_text` and `grid_text` beside the integers.** Lossless, and the
  reason the late 1980s survive at all — 1,041 `DNQ` and 378 `DNS` that an
  integer column would have destroyed. Keep.
- **Committing `f1.db` rather than generating it** — the code review already
  cleared this on pack size; from a data point of view it is also what made
  `DA-04` measurable at all.

---

## What is genuinely good, briefly

- **The inline schema comments in `f1.db`.** 150 lines of reasoning ship inside
  the artefact, with cases attached (Schumacher's 1997 exclusion, Cooper-Maserati
  in 1960, 236 pit-lane starts). I reviewed a 46-table schema without opening the
  repository because of them. `DA-06` is a complaint that there are not more.
- **Refusing rather than repairing.** A whole race refused on one disagreement;
  `chassis` never over-attributing a win to a design (0 rows where derived
  exceeds published); `table_provenance.unconstrained` flooring `article_images`
  at `unverified` because a well-run source does not make a row checkable. That
  last one is the sharpest piece of data thinking in the project.
- **`v_race_venues` returning a `figures` column.** A view that tells you the
  confidence of its own answer. Three more views like it would be worth more than
  the other thirty-five.
- **`regulation_limits`**: a rule modelled as a rule, with `to_year NOT NULL` and
  deliberate holes, so nothing invents a limit across an unrecorded change.
- **`known_gaps` and `discrepancies` existing at all.** The modelling criticisms
  above are severe precisely because the idea is right and rare, and 45 badly
  keyed rows of recorded disagreement are worth more than a clean database that
  resolved them silently.

---

## What I did not examine

The front end beyond `web/src/lib/standings.js` and enough of `prerender.js` to
check `AF-01`'s claim; the Parquet files themselves (pyarrow was not exercised —
the exporter's behaviour is read from `tools/parquet_export.py`, not observed);
`f1_database.json`, which is gitignored and was not in the tree; the
harvest files under `harvest/` and the loaders in `tools/`; whether any *fact* in
the database is true, other than the two shared drives and the three lineage
cases where the arithmetic or the timeline contradicted itself; the `laps`,
`stints`, `race_timing` and `race_control_messages` schemas beyond confirming
they are empty and consistently shaped; the 2,385 prerendered pages; the SQL
console's behaviour against any of the traps above. I did not build the site.

One thing seen in passing and handed on rather than filed: `verify.py:1978`
reports *"the stored lap topology matches the geometry — 0 of 25 stitch into a
closed lap"* while the WARN two lines earlier correctly names the three that do
not close. `circuit_geometry` in `f1-geometry.db` has `closes = 1` on 22 of 25
rows (`queried the database`); the PASS message queries `main.circuit_geometry`,
which is empty, instead of the attached `GEO`. The data is right and the report
is wrong — a message defect, and `CR-18`'s territory rather than mine.

---

## Which findings belong to somebody else

- `DA-07`'s `known_gaps` text and `DA-16`'s empty columns want a **content**
  pass on the register's wording; the *check* that a gap's claim is true is mine
  and is the durable half.
- `DA-08` (nothing scores zero) changes what a table cell says on 8,107 rows, so
  it should ship with whoever owns the em-dash convention — `CD-01`'s author.
- `DA-14`'s "which download, and what it omits" table is a **service design**
  artefact as much as a data one: it is the same gap-between-channels problem the
  code review handed to `service-design-critic`.

## Suggested order, if the time is bursty

Four sittings, each worth having on its own:

1. `DA-01` rungs one and two (the `v_standings_final` view and the expression
   unique index) — closes `CR-02` at the root, and makes the table's only
   constraint mean something. **S + S.**
2. `DA-06` (move the block comments inside the parentheses) — 298 lines of the
   project's best writing start shipping, for a mechanical edit. **S.**
3. `DA-03` first slice (`source_id` on 22 tables) — makes the licence a query,
   and is `PM-14`'s first column. **S/M.**
4. `DA-09` (`discrepancies` gets `(tbl, row_key, field)`) — 45 rows, one sitting,
   and it is `PM-14` rehearsed at 1/2000 scale. **S.**

`DA-02` is the largest thing here that is plainly wrong rather than merely
under-modelled, and it is an **M** with an **S** first step. `DA-04` is the one
that needs a decision before any code: either promise identifier stability or
publish that you do not.
