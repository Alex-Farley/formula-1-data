# Deriving confidence, rather than declaring it

A sketch, first written against v2.15. **Steps 1 and 2 of the order of work
are now implemented in v2.16, and step 3 after v2.24** — see *What shipped*
at the end. The rest is still a sketch; `tools/confidence_rule.py` runs the
whole rule read-only and reports what it would change.

## The problem

`confidence` is currently a **literal**. Every fact table declares a default
in `schema.sql` — `race_entries` defaults to `reference`, `article_images` to
`unverified`, `records` to `high` — and `build.py` carries a per-row value up
from `data/*.py` or the loader. The values are *good*, because they were
chosen carefully by someone who knew what had been checked. But the database
cannot say **why** any row has the tier it has.

That has three consequences, and they get worse the more data arrives:

1. **It does not scale.** 96,645 rows carry a confidence value today. They
   were assigned by table, not by row, so a tier describes a *harvest* rather
   than a *fact*. The 36 `race_entries` rows at `verified` and the 27,446 at
   `reference` differ by which loader wrote them, not by what is known about
   them.
2. **It cannot be checked.** `verify.py` runs its checks and not one of them
   tests a confidence value, because there is nothing to test it against. A
   tier cannot be wrong if nothing derives it.
3. **It hides its own soft spots.** See *What the rule says today* below: 335
   rows sit at `high` — `may_publish = 1`, "safe to rely on" — in tables with
   no `source` column at all.

The project already has the ingredients. What it does not have is one shape
for them.

## The governing idea

**A tier is a claim about what could have gone wrong and did not.**

That is already how this database earns trust, everywhere it earns it. The OSM
centrelines are believable *not* because OpenStreetMap is careful but because
`published_km` was held here first and rejects a trace that measures twelve
per cent long. The full classification is believable because the winner of all
1,161 races was already stored from an independent harvest and F1DB agreed
with every one. `article_images` sits at `unverified` despite coming from a
well-run API, because — as `known_gaps` #10 says plainly — nothing here
constrains what a photograph shows.

So the tier is not a property of the source. It is the product of two things:

- **A — authority.** What kind of source stands behind the value.
- **C — constraint.** Whether something that could have falsified the value
  ran, and passed.

Corroboration is *not* a third axis. Two independent sources agreeing **is** a
check — the cheapest one available, and the only one that scales with new
sources. That is the whole argument for adding sources: not more rows, more
constraint on the rows already here.

## The rule

```
tier(row) =
    REJECT AT LOAD   if A = forbidden
    unverified       if A is null                  -- no registry source
    unverified       if a check failed and the row was kept anyway
    medium           if a disagreement is open against this row
    verified         if A = official   and C = cross
    high             if A = official   and C in (internal, none)
    reference        if A = reference  and C = cross
    medium           if A = reference  and C in (internal, none)
```

Five outputs, the same five in `provenance`, so every existing query, view and
export keeps working unchanged.

Read as a table it is small enough to hold in your head:

|                        | no independent source | another source agreed |
|------------------------|-----------------------|-----------------------|
| **official**           | `high`                | `verified`            |
| **reference**          | `medium`              | `reference`           |
| **no registry source** | `unverified`          | `unverified`          |

**Authority picks the pair. Only a cross-source check picks which of the
pair.** That second sentence is the whole rule, and it is worth being precise
about why.

### Internal consistency cannot raise a tier

Of the checks in `verify.py`, the great majority are *internal*: they test
the database against itself. Rounds are contiguous. A driver appears at most
once per race. Nobody died before they were born. Careers run forwards. Every
foreign key resolves.

These are essential and they catch real defects — the constructor
reconciliation caught Wilson Fittipaldi's Brabham results being written onto
Emerson. But they cannot raise confidence in a *value*, because *a
self-consistent database can be uniformly wrong*. If a harvest mis-read the
same column the same way 1,161 times, every internal check still passes.

What raises a tier is a **cross-source** check: something held here
independently had the chance to disagree, and did not. Those are the ones this
project actually leans on —

- the winner of every race, from the Wikipedia harvest, against F1DB's, on
  load, with the race *refused* rather than mis-attributed when they differ;
- `published_km` against a centreline measured from OSM, which rejects
  Monaco's relation at twelve per cent long;
- `published_wins` / `published_poles` on a chassis against the figures
  derived from the race records, which caught the M23 holding sixteen poles
  against a published fourteen;
- career totals from formula1.com against totals recomputed from 27,555
  entries.

So `checks.kind` below is not decoration. It is the column the rule reads.

Two riders keep it honest:

- **Disagreement caps the tier.** Where two sources hold the same fact and
  differ, the row is capped at `medium` and a `discrepancies` row is written,
  until a person resolves it. This is exactly `known_gaps` #1: F1DB leaves a
  disqualified driver's position vacant, Jolpica promotes everyone below, they
  differ on 118 of 26,082 entries, and *neither is wrong*. A rule that picked
  a winner there would be lying.
- **`verified` still needs an official source.** The v1 rule survives intact,
  and now as a consequence of the table rather than as a note in a comment.

## What the schema needs

Three changes. The first is the one that matters; the other two follow from it.

### 1. A fact can have more than one source

This is the blocker. `source` is a single free-text column, so the schema
**cannot represent "two sources agree"** — which is why corroboration has been
encoded five different ways, once per place it was needed:

| Where | How agreement is encoded today |
|---|---|
| `drivers` | `wins_external`, `poles_external`, `podiums_external`, `external_source` |
| `chassis` | `published_races`, `published_wins`, `published_poles` vs derived `races`, `wins` |
| `car_seasons` | `corroborated` 0/1, plus `other_chassis` |
| `circuit_geometry` | `measured_km` vs `published_km`, plus `delta_pct` |
| `article_images` | `name_matches`, "recorded and enforced nowhere" |

Every one of those is the same statement — *a second source holds this value,
and here is whether it agrees* — in a different shape. One table replaces
them:

```sql
CREATE TABLE claims (
    id            INTEGER PRIMARY KEY,
    tbl           TEXT NOT NULL,        -- 'drivers'
    row_key       TEXT NOT NULL,        -- 'juan-manuel-fangio'
    field         TEXT,                 -- 'wins'; NULL = the row as a whole
    source_id     INTEGER NOT NULL REFERENCES source_registry(id),
    value_given   TEXT,                 -- as that source gave it, before any coercion
    fetched       TEXT,                 -- ISO date
    UNIQUE (tbl, row_key, field, source_id)
);
```

K — how many independent sources hold a value, and whether they agree — is
then a `GROUP BY` rather than a column somebody remembered to add. The five
existing encodings stay as views over `claims` so nothing downstream breaks.

`source_registry` also needs to be **joinable**, which it currently is not: its
`url` is one example page, not a namespace. `https://en.wikipedia.org/wiki/List_of_Formula_One_polesitters`
does not prefix-match `https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship`,
so 4,691 rows — 4.9% — have a source that resolves to no registry entry at
all. Add `url_pattern` and match on it.

### 2. Checks become data

Each `verify.py` check is an English string printed to stdout:

```python
check("every driver's wins, poles and fastest laps equal the race records", ...)
```

Nothing records **which rows that check covered**. A rule needs exactly that,
so the check has to declare it:

```sql
CREATE TABLE checks (
    id            TEXT PRIMARY KEY,     -- 'drivers.wins.vs_race_records'
    name          TEXT NOT NULL,        -- the string already printed
    tbl           TEXT NOT NULL,
    field         TEXT,
    kind          TEXT NOT NULL,        -- 'cross' (an independent source agreed)
                                        -- or 'internal' (self-consistency:
                                        -- referential | coverage | arithmetic
                                        -- | temporal). The rule reads this.
    constrains    TEXT NOT NULL,        -- SQL returning the row_keys it covered
    last_run      TEXT,
    passed        INTEGER
);
```

`constrains` is the real work and it is mechanical: most checks already build
the row set they test, they just throw it away after counting. Two
consequences worth naming:

- A check that passes *vacuously* — it covered no rows — stops counting as
  constraint. Today that is invisible.
- Partial coverage stops being rounded up. The fastest-lap re-derivation
  matches the stored setter on **446 races**, which is a strong check and is
  not 1,161 races. Under a row-level rule the other 715 do not get the credit.

### 3. `confidence` is written by the rule, never by hand

Keep the column — everything reads it. Add one beside it:

```sql
ALTER TABLE <each fact table> ADD COLUMN confidence_basis TEXT;
-- 'official × constrained: checks drivers.wins.vs_race_records, drivers.titles.vs_seasons'
```

`build.py` computes both from `claims` and `checks` as its last step, after
every loader has run. `data/*.py` stops carrying confidence values. And
`verify.py` gains check 134, which is the one that keeps the whole thing
honest:

> no stored confidence differs from the confidence the rule derives

## What the rule says today

`tools/confidence_rule.py` runs it read-only against v2.15. Authority is
resolved from `source` plus the URL patterns the sketch proposes; constraint
is seeded by hand from the checks that demonstrably exist, and marked `cross`
or `internal` by reading what each one actually compares.

```
TOTAL   96,645 rows   92,869 agree   3,776 differ   96.1% of stored tiers reproduced
```

**96.1% is the important number.** It says the tiers in the database today are
very nearly what a rule would have produced anyway — which is the case for
deriving them rather than an argument against. The judgement encoded by hand
over fifteen versions is reproducible. The remaining 3.9% is where it is worth
looking, and it falls into three groups.

### Group 1 — single-source rows that read as corroborated (2,939 rows)

| rows | table | stored | derived |
|---|---|---|---|
| 1,925 | `season_entrants` | `reference` | `medium` |
| 590 | `sprint_results` | `reference` | `medium` |
| 424 | `engines` | `reference` | `medium` |

All three come from F1DB alone, and nothing here can contradict them. They sit
at `reference`, whose definition promises "cross-checked on load against
independently held season data" — which is true of `race_entries` and
`qualifying`, and is not true of these.

`season_entrants` is the sharpest case. It is the table that *constrains*
another one — "no entry is credited to a constructor that was not racing that
season" is checked against it — while nothing constrains `season_entrants`
itself. It is doing the work of a witness without having been examined.

### Group 2 — rows that have earned more than they are given (273 rows)

| rows | table | stored | derived |
|---|---|---|---|
| 75 | `seasons` | `high` | `verified` |
| 67 | `drivers` | `high` | `verified` |
| 44 | `drivers` | `medium` | `verified` |
| 49 | `drivers` | `medium` | `reference` |
| 38 | `constructors` | `high` | `verified` |

These are official-sourced rows carrying a cross-source check that passes. The
seasons are the clearest: the champion, the runner-up and both point totals
reproduce from F1DB's standings for **76 of 77 seasons**, which the README
treats as the strongest result in the project — and the rows are still marked
`high`, meaning "well-established, safe to rely on", rather than `verified`.
Hand-assignment is conservative in a way that costs the database credit it
has actually earned.

### Group 3 — `high` with nothing behind it (325 rows)

431 rows across 15 tables have no `source` column at all, and 325 of them sit
at `high` — `may_publish = 1`, "safe to rely on":

| table | rows | table | rows |
|---|---|---|---|
| `constructor_lineage` | 66 | `governance` | 18 |
| `grands_prix` | 53 | `engine_eras` | 11 |
| `glossary` | 44 | `eras` | 10 |
| `records` | 30 | `points_systems` | 10 |
| `technical_innovations` | 26 | `tyre_suppliers` | 9 |
| `safety_milestones` | 26 | `personnel` | 20 of 32 |

There is no source to cite and no check to fail. `ATTRIBUTION.md` is already
straight about what this content is: *"Regulations, safety, technical,
glossary, eras — Written for this project from general knowledge."*

`records` is the sharpest case, and it is worse than "no source": **nothing in
`verify.py` reads that table at all**. The 30 headline records in it are
unconstrained in every sense. The career records they duplicate *are* checked
— on `drivers`, against the race records — which is exactly the trap: the
database looks like it verifies its records, and the table called `records` is
not the one it verifies.

*(Overtaken in v2.23: `records` is now derived in `build.py` from the race
records, every row states its rule, and `verify.py` recomputes a sample by a
different route. The paragraph above describes the table as it was, and why
the derivation was the fix.)*

So the rule surfaces something real: **`high` is currently doing two jobs.**
It means "a well-established official record" for `seasons` and `circuits`,
and it means "authored here and believed" for `glossary` and `eras`. Those are
different claims and a reader cannot tell them apart — which matters most
precisely because `may_publish = 1` invites them not to.

The mechanical answer — demote all 325 to `unverified`, since they have no
registry source — is correct in kind and too harsh in degree. The better fix
is to make the second job explicit: a `source_registry` entry for authored
content at a new authority `authored`. It has no external source, so nothing
can ever corroborate it and its pair collapses to a single tier: `medium`,
which is precisely what that tier already says — *"correct in substance, an
exact figure may have drifted, confirm before publication."* Then the ladder
tells the truth in both directions.

**This is what shipped in v2.16.** 333 rows moved: the 325 at `high`, plus 8
that were sitting at `verified` in authored tables against the project's own
standing rule that nothing reaches `verified` without an official source.

### What the prototype cannot yet say

Constraint is seeded per *table*, not measured per *row*, so a table is
treated as constrained or not as a whole. That is coarser than the rule
intends and it flatters the result: `qualifying` counts as cross-checked on
the strength of a fastest-lap re-derivation that covers 446 races, not 1,161.
The `checks` table with a real `constrains` clause is what closes that gap,
and it is why step 4 below is the expensive one.

Two of the 3,776 differences are also mine rather than the database's: the
`cross`/`internal` split is my reading of what each check compares, and a
check I misread moves thousands of rows. `race_entries` alone swings 27,446
rows on that judgement. That is an argument for the `kind` column being
declared by the check's author rather than inferred later.

## Order of work

1. ~~**`url_pattern` on `source_registry`**~~ — **done in v2.16**, as a
   `source_patterns` child table rather than a column: one source needs
   several patterns (Wikipedia needs three).
2. ~~**The `authored` authority**, and the honest re-rating~~ — **done in
   v2.16**, together with `table_provenance` for the fifteen tables that
   carry `confidence` and no `source`.
3. ~~**`claims`**, back-filled from the five existing encodings~~ — **done
   after v2.24** (`PM-14`), with `source_id` on every sourced row (`DA-03`).
   Three of the five encodings are back-filled; the other two are declared
   out, with the reason — see *What shipped after v2.24* below.
4. **`checks`**, with `kind` and `constrains`. The largest piece, and
   mechanical: each check declares whether it compares against an independent
   source, and which rows it actually covered.
5. **Derivation in `build.py`**, `confidence_basis`, and the check that says
   no stored confidence differs from the derived one.

Steps 4–5 are still ahead. Step 3 was worth doing whether or not 4 and 5 ever
happen: it retires five ad-hoc encodings of the same idea and makes
corroboration expressible at all, which is the precondition for a new source
adding *constraint* rather than only rows — and that, rather than breadth, is
the case for adding one.

## What shipped in v2.16

**`source_patterns`** — a row's free-text `source` now resolves to a registry
entry by longest-prefix match on `source_registry.url`, then by pattern. The
4,691 rows that resolved to nothing now all resolve, and `verify.py` fails the
build if one ever does not. That check is worth more than the tidying: it
means a new loader cannot quietly introduce a source nobody assessed.

**`table_provenance`** — the fifteen tables carrying `confidence` with no
`source` column now say where their content came from. Thirteen are authored;
`circuit_layouts` came from Wikipedia per-circuit articles (a source the
registry had never named, now entry 17), `season_entries` from formula1.com,
and `article_images` and `circuit_geometry` from registry entries that already
existed. The provenance was previously only in `ATTRIBUTION.md`, where nothing
could read it.

**The `authored` authority** — registry entry 18, and the ceiling that follows
from it. `build.py` now caps every authored table at `medium` as its last
step, which is the first confidence value in this database that is *derived*
rather than carried up from `data/*.py`. 333 rows moved.

**`table_provenance.unconstrained`** — one flag, set for `article_images`,
that floors a table at `unverified` regardless of its source's standing.
Without it the rule *promoted* those 602 rows to `medium` on the strength of
the MediaWiki API being well run, which is exactly the reasoning
`known_gaps` #10 exists to refuse. A good source does not make a row
checkable.

**Four new checks** in `verify.py`: every source resolves to a registry entry;
no row cites a `forbidden` source; every table carrying `confidence` declares
a provenance; no authored row sits above `medium`.

The rule now reproduces **96.5%** of stored tiers, up from 96.1%. The
remaining 3,343 differences are the backlog steps 3–5 exist to work through,
and `tools/confidence_rule.py` prints them ranked. The largest is still
`season_entrants`: 1,925 rows at `reference`, single-source, and the table
that *constrains* `race_entries` while nothing constrains it.

## What shipped after v2.24

**`source_id`** on every table carrying `source` (`DA-03`). The build's last
stage adds the column wherever `source` is — read from `sqlite_master`, not
listed — and fills it by the resolution `source_patterns` describes, so which
registry entry a row belongs to, and under what licence it may be
redistributed, is a join rather than ten regular expressions SQLite cannot
run. `verify.py` re-resolves every value by its own copy of the rule and
compares, and holds the stored id to the licence the citation's host carries,
so the two routes to a row's terms cannot give two answers. It found one gap
on the way in: `pit_stops`' bare `f1db` token resolved to no entry, and the
v2.16 check never saw it because it read only the tables carrying
`confidence`. The token now has a pattern.

**`claims`** (`PM-14`): per fact, the value each source gave for it, with the
source, as text. The shape the sketch above proposed, less its nullable
`field` — the row as a whole is what `source_id` now answers — and with
`as_of` for the one source that dates its figures.

|  | back-filled | how |
|---|---|---|
| `drivers.*_external` | yes | one claim per figure, citing where *that* figure came from |
| `chassis.published_*` | yes, for a single-chassis article | a family article's total is the family's, and no one chassis's |
| `car_seasons` | yes | the chassis F1DB's entry lists name; `corroborated` and `other_chassis` are that list read against the car |
| `circuit_geometry` | **no** | `measured_km` is OpenStreetMap's, and `f1.db` carries no OpenStreetMap data |
| `article_images.name_matches` | **no** | a string test of a row's own file name, not a second source |

The encodings stay where they were, so nothing reading them changes, and
`verify.py` holds each back-filled one to be reproducible from the claims in
both directions. `CLAIM_FIELDS` in `data/current.py` declares every kind of
claim and the columns it backs; the build refuses any other.

The first thing the field grain showed is the thing it exists for. Four
current drivers' fastest-lap totals were attributed to formula1.com by the
row's `external_source`, and were typed in by hand; Russell's pole total is
Wikipedia's 11, the figure that corrected formula1.com's 12. The row-grain
column could say neither. A claim says both.

Still ahead on this step: the pole and fastest-lap credits on `race_entries`,
which come from the Wikipedia season tables whatever the row's `source` says,
are the next field-grain case, and retiring the `*_external` and
`published_*` columns onto views over `claims` is a schema change for every
reader of them. They are `PM-55` (#620) and `PM-56` (#621).
