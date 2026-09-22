# Lap Ledger — v<!-- fig:version -->2.24<!-- /fig -->

An expansion of the original single-file JSON into a normalised, queryable
SQLite database covering <!-- fig:season_span -->1950–2027<!-- /fig -->, with
the JSON kept as a generated export.

**The latest release, v<!-- fig:version -->2.24<!-- /fig -->,** derives the
`records` table instead of publishing it. Thirty rows had been typed from
general knowledge, at `medium`, with nothing in `verify.py` reading them —
one said Hamilton had 105 wins beside a `drivers.wins` of 106 the same build
had computed. Every row is now one query over the tables the leaderboards
read, with its rule, exclusions and every holder of a tie in `detail`, a
machine key for the holder, a numeric value with its unit, and one ISO
`as_of` read off the last completed race; `verify.py` recomputes a sample by
a different route. The five records the database cannot derive are declared
in `known_gaps` rather than kept. v2.22 gave the final championship table a
key and a view (`v_standings_final`), after the compat export had shipped the
running table rather than the final one in every release since v2.15.

**What changed in every version**, what each one exposed, and what was
deliberately not done, is in [`docs/BUILD-NOTES.md`](docs/BUILD-NOTES.md).
The queue of work is [GitHub Issues](https://github.com/Alex-Farley/formula-1-data/issues),
ranked on the [Lap Ledger project](https://github.com/users/Alex-Farley/projects/1);
what has landed and what was declined, with the reason, is in
[`docs/LANDED.md`](docs/LANDED.md).

```bash
git clone https://github.com/Alex-Farley/formula-1-data.git && cd formula-1-data
make all          # rebuild, verify, export — no dependencies
./f1              # list the query commands
./f1 car mp4/4
./f1 chassis lotus
```

Built <!-- fig:built -->2026-09-16<!-- /fig -->; `meta.verification_date` is
<!-- fig:verified_on -->2026-09-16<!-- /fig -->. The last race with a
classification is the <!-- fig:last_race -->2026 Madrid Grand Prix<!-- /fig -->.
The chassis, engine, entrant and results registers are F1DB
<!-- fig:f1db_version -->v2026.14.0<!-- /fig -->.

Every figure in this file that describes the current database is generated
from it — `tools/readme_figures.py` computes each one from `f1.db` (and
`f1-geometry.db` for the centrelines), `make all` writes them in, and
`verify.py` fails when the text and the database disagree. A number you read
here is a number the build checked.

---

## Files

| File | What it is |
|---|---|
| `f1.db` | The SQLite database. <!-- fig:tables -->48<!-- /fig --> tables, <!-- fig:views -->41<!-- /fig --> views, <!-- fig:rows -->119,835<!-- /fig --> rows. This is the artefact. |
| `f1-geometry.db` | The OpenStreetMap circuit centrelines (ODbL), shipped beside `f1.db` and never merged into it. See *Illustration*. |
| `f1` | Command-line query tool. `./f1` with no arguments prints the commands. |
| `f1_database.json` | Full JSON export of every table. **Not committed** — `make export` writes it in about a second, and each release carries a copy. |
| `f1_compat.json` | JSON in the *original* v1 key layout, so anything already consuming that file keeps working. |
| `schema.sql` | The schema, commented. Served at `lapledger.org/schema.sql`, so a downloader can read what the tables mean. |
| `build.py` | Rebuilds `f1.db` and `f1-geometry.db` from the data modules. Idempotent, and byte-for-byte reproducible. <!-- fig:stages -->37<!-- /fig --> named stages; `STAGES` is the schedule. |
| `verify.py` | Integrity, cross-tabulation and sanity checks on the DATA. Exit code 1 on failure. |
| `tests/` | Unit tests for the CODE — name matching, lap-closure arithmetic — plus `test_conventions.py`, the reviewer checklists' mechanical items as tests, and `test_verify_refuses.py`, the licence gate shown refusing each thing it exists to refuse. `make test`, stdlib only. |
| `ruff.toml`, `web/biome.jsonc` | The linters CI runs on the Python and the front end, and every rule left out with its reason. `make lint`. Neither is a dependency of the build. |
| `audit.py` | Structural health check: fill rates, coverage, keys, redundancy, readiness. |
| `export_json.py` | Regenerates the JSON exports from the database. |
| `data/*.py` | The source data, as readable Python literals. **Edit here, then rebuild.** |
| `harvest/races.txt` | The raw race-winner harvest, one race per line. Human-readable and diffable. |
| `harvest/poles.txt` | The raw pole / fastest-lap harvest, same format. |
| `harvest/venues.txt` | The raw race-venue harvest, same format. |
| `harvest/append.py` | Appends rows to a harvest file, checking shape and flagging duplicates. |
| `harvest/chassis.txt` | Every chassis that has raced. **Generated** by `tools/f1db_fetch.py` — do not edit. |
| `harvest/engines.txt` | Every engine, with capacity, configuration and aspiration. **Generated.** |
| `harvest/entrants.txt` | Season → entrant → constructor → chassis/engine/tyre. **Generated.** |
| `harvest/f1db_constructors.txt` | Constructor names, for the specification cross-check. **Generated.** |
| `harvest/race_results.txt`, `qualifying.txt`, `standings.txt`, `sprint_results.txt`, `f1db_pit_stops.txt` | The full classification, qualifying, standings after every round, sprint classifications and pit stops. **Generated** by `tools/f1db_fetch.py`. |
| `harvest/circuit_outlines.txt`, `race_layouts.txt` | The SVG outline of every F1DB circuit layout (drawn by Jules Roy, CC BY 4.0) and the layout each race ran. **Generated** by `tools/f1db_fetch.py`. |
| `harvest/car_specs.txt` | Chassis specifications off the per-car articles. **Generated** by `tools/wikispec_fetch.py`. |
| `harvest/car_specs.log` | Every chassis that was refused, and the reason. **Generated.** |
| `harvest/article_images.txt`, `.log` | The photograph of each car article and its licence; every article refused, and why. **Generated** by `tools/wikimedia_images.py`. |
| `harvest/category_images.txt`, `.log` | For a chassis with no article, a photograph from the Commons category named for it; every such chassis refused, and why. **Generated** by `tools/wikimedia_images.py --route category`. |
| `harvest/circuit_geometry.txt`, `.log` | The OSM centrelines and every relation refused. **Generated** by `tools/osm_geometry.py`. |
| `tools/f1db_fetch.py` | Pulls the registers, the classification, qualifying, standings and pit stops from F1DB (CC BY 4.0) into the generated harvest files. Needs network; not part of the build. |
| `tools/wikispec_fetch.py` | Harvests chassis specifications from the `{{Racing car}}` infobox on each car's article, refusing any page that disagrees with the register. Needs network; not part of the build. |
| `tools/ergast_load.py` | Loads the Jolpica-F1 classification onto a local copy and records where it disagrees with what is stored. Needs network; not part of the build. |
| `tools/fastf1_load.py` | Loads per-lap timing, stints, pit stops, race control and radio onto a **local** copy from the F1 live timing API. Needs network; never committed — see *Timing*. |
| `tools/parquet_export.py` | Writes every table as Parquet for the release bundle. Refuses a database carrying FOM timing or ODbL geometry. |
| `tools/geometry_overlay.py` | Merges `f1-geometry.db` into a local `f1.db` (`--apply`) or takes it out again (`--remove`). |
| `tools/readme_figures.py` | Computes every figure this file states and rewrites it (`--write`) or checks it (`--check`). |
| `docs/BUILD-NOTES.md` | What changed in each version, what it exposed, what was deliberately not done. |
| `docs/LANDED.md` | What has landed and what was declined, with the reason. The open queue is GitHub Issues. |
| `docs/LOCAL-SETUP.md` | Getting `/backlog-loop` running on your own machine, from nothing. |
| `CONTRIBUTING.md` | How to add data without breaking the checks. Read before editing. |
| `ATTRIBUTION.md` | Where the data came from, and the licensing that follows from it. Served at `lapledger.org/ATTRIBUTION.md`, beside the data it covers. |
| `LICENSE-DATA`, `LICENSE` | The terms the data is offered under (CC BY-SA 4.0) and the terms the code is. `LICENSE-DATA` is served at `lapledger.org/LICENSE-DATA`. |
| `CITATION.cff` | The citation for the database, in Citation File Format. GitHub renders a *Cite this repository* button from it; its `version` is checked against `build.py` by `tests/test_conventions.py`, and the licence and release date it deliberately does not state are argued in the file. |
| `Makefile` | `make all` = build, regenerate the README figures, verify, export. |
| `requirements.txt` | Empty for the database itself; `fastf1` only for the loader. |

Workflow for any change: edit `data/*.py` → `python3 build.py` → `python3 verify.py`
→ `python3 export_json.py --compat`. Or `make all`.

**No dependencies.** Everything except `tools/fastf1_load.py` is Python 3.9+
standard library.

**What the site publishes.** lapledger.org serves `f1.db`, `f1-geometry.db`
and `f1-parquet.zip`, and beside them `schema.sql`, `ATTRIBUTION.md` and
`LICENSE-DATA` — what the tables mean, where the data came from, and the
terms it is offered under. The obligation follows the file rather than the
repository, so a licence notice has to be reachable from where the data was
taken; `web/scripts/prepare-assets.js` stages all three and refuses to build
without them. The centrelines are ODbL instead, stated in `f1-geometry.db`'s
own `meta` and in `LICENSE-DATA`'s *Circuit geometry* section. `LICENSE-DATA`
enumerates the files it covers and `f1-parquet.zip` is not among them — `SD-22`
(#410) has that gap.

**Citing it.** `CITATION.cff` at the repository root is the citation for
the database, and GitHub renders a *Cite this repository* button from it in
BibTeX and APA. Its `version` is not copied by hand: `tests/test_conventions.py`
fails the build when it drifts from `VERSION`. It states no licence, because
the Citation File Format reads a list of them as *or* — naming all three this
repository holds would offer every part of it under any one, MIT included —
and the terms are in `LICENSE`, `LICENSE-DATA` and `ATTRIBUTION.md` already.
To cite a figure read on the site, use the line at the foot of that page
instead: it names the first sixteen hex digits of the SHA-256 of the exact
database file the page was built from, and a version and a build date
together can name more than one. There is no DOI — nobody has minted one,
and `CITATION.cff` will carry it when somebody does.

**What no licence allows.** Nobody publishes Formula One race timing under a
licence that permits passing it on, so this database holds none: `laps`,
`stints`, `race_timing`
and `race_control_messages` are empty on purpose, and everything that *is*
here may be passed on under the licence shown beside it. That is a statement
about the licences on offer rather than about what anyone may lawfully do,
and about race timing rather than lap times — the qualifying table holds lap
times, because F1DB publishes those under CC BY 4.0. *Timing, telemetry and
radio* below states the position at length, and
`docs/TIMING-ARCHITECTURE.md` is the decision in full.

**Found something wrong in the data?** Open an issue with the *Something on
the site is wrong* form. Two sources that disagree are recorded in
`discrepancies` and published rather than quietly reconciled, and a fact
nobody has established goes in `known_gaps`.

---

## What's in it

**Championship history** — all <!-- fig:seasons -->78<!-- /fig --> seasons
<!-- fig:season_span -->1950–2027<!-- /fig -->: champion, points, wins,
runner-up, margin, constructors' champion, engine formula, tyre suppliers and a
paragraph of context on each, plus **<!-- fig:standings -->34,597<!-- /fig -->
championship standings rows** — the table after every round of every season
and the end-of-season classification for each.

**Every race** — <!-- fig:races -->1,196<!-- /fig --> championship Grands
Prix on the calendar, <!-- fig:races_run -->1,163<!-- /fig --> of them run,
from the <!-- fig:first_race -->1950 British Grand Prix<!-- /fig --> to the
<!-- fig:last_race -->2026 Madrid Grand Prix<!-- /fig -->, each with its
circuit, date, pole position, fastest lap, winner, constructor and entrant, and
the **full classification of every run race** — <!-- fig:race_entries -->27,504<!-- /fig -->
race entries with position, grid, laps, retirement cause and points, and
<!-- fig:qualifying -->27,017<!-- /fig --> qualifying rows beside them. The
<!-- fig:races_without_fastest_lap -->1<!-- /fig --> run race without a fastest
lap is the 2021 Belgian Grand Prix, where none was set: two laps behind the
safety car, half points, no racing lap completed. Shared drives carry both
drivers. The <!-- fig:indy -->11<!-- /fig --> Indianapolis 500s that counted
towards the championship (1950–60) are included and flagged, with no
constructor attributed, because their chassis were never Formula One
constructors. Sprint classifications are held for all
<!-- fig:sprint_races -->29<!-- /fig --> sprints since 2021
(<!-- fig:sprint_results -->590<!-- /fig --> rows), and
<!-- fig:pit_stops -->22,506<!-- /fig --> pit stops — lap and order, no
durations, because no source publishes those under a licence that permits
passing them on.

**Drivers** — <!-- fig:drivers -->862<!-- /fig --> rows: every driver in the
full classification, with the World Champions and the current grid carrying
full career figures, and the complete
<!-- fig:season_entries_year -->2026<!-- /fig --> entry list
(<!-- fig:season_entries -->23<!-- /fig --> seats).

Their wins, poles, fastest laps and podiums are **computed from the race
records**, so they are internally consistent by construction and cannot drift.
The figures that were hand-entered or checked against an external source are
preserved in the `*_external` columns so the two can always be compared.

**Constructors** — <!-- fig:constructors -->150<!-- /fig --> rows, plus a
`constructor_lineage` table that tracks
<!-- fig:lineage_chains -->36<!-- /fig --> continuous racing operations
through their name changes. Enstone is Toleman → Benetton → Renault → Lotus →
Renault → Alpine; Brackley is Tyrrell → BAR → Honda → Brawn → Mercedes. This
is the thing most F1 databases get wrong.

**Circuits** — <!-- fig:circuits -->80<!-- /fig --> circuits, from Bremgarten
and Pescara to the Madring. Every race is linked to one
(<!-- fig:circuits_raced -->79<!-- /fig --> have held a championship race; the
Nürburgring Südschleife is in the register and says why it has not), and
<!-- fig:layout_circuits -->13<!-- /fig --> of them carry a complete, checked
timeline of the configurations actually raced.

**Cars** — <!-- fig:cars -->29<!-- /fig --> landmark chassis from the Alfetta
to the RB19, each with engine, chassis, gearbox, suspension, weight and
dimensions where published, plus what the car introduced and what it actually
achieved. Linked to the races they won, so the win counts are derived rather
than asserted. Beneath them, **<!-- fig:chassis -->1,153<!-- /fig -->
chassis** — every one that has raced — with engines and per-season entry
lists. See *Cars and chassis*.

**Technical and regulatory** — <!-- fig:regulation_changes -->60<!-- /fig -->
regulation changes by year and category,
<!-- fig:innovations -->26<!-- /fig --> landmark innovations (with the year
each was banned, where it was), <!-- fig:engine_eras -->11<!-- /fig --> engine
eras, <!-- fig:safety_milestones -->26<!-- /fig --> safety milestones, tyre
suppliers, <!-- fig:points_systems -->10<!-- /fig --> points systems, and
<!-- fig:eras -->10<!-- /fig --> defined eras of the sport.

**Also** — <!-- fig:personnel -->32<!-- /fig --> non-driving figures
(designers, principals, officials), <!-- fig:records -->29<!-- /fig -->
records, <!-- fig:glossary -->44<!-- /fig --> glossary terms and
<!-- fig:governance -->18<!-- /fig --> governance milestones.

---

## Querying

```bash
./f1 season 1976            # everything about one season
./f1 driver hamilton        # career record and current entry
./f1 team ferrari           # record, lineage, titles won
./f1 lineage enstone        # a team's name changes over time
./f1 circuit spa            # a circuit: layouts, events held, its winners
./f1 circuits               # every circuit by races held, then by country
./f1 circuits italy         # every circuit in one country
./f1 venues 1976            # where each round of a season was held
./f1 lost                   # circuits dropped from the calendar
./f1 car mp4/4              # a car: spec, design story, every race it won
./f1 cars                   # the register, ordered by wins
./f1 cars lotus             # one constructor's cars
./f1 chassis lotus          # every Lotus chassis in the register
./f1 evolution              # how the technology moved, car by car
./f1 telemetry              # what per-lap and radio data is loaded
./f1 rules 1994             # regulation changes in a year
./f1 rules safety           # or by category
./f1 tech                   # innovation timeline
./f1 search senna           # free text across every table
./f1 standings 2025         # a season's standings
./f1 races 1988             # every race and winner in a season
./f1 gp monaco              # every winner of one Grand Prix, with a tally
./f1 wins                   # career win leaders, derived from race results
./f1 poles                  # career pole leaders
./f1 fastest                # career fastest-lap leaders
./f1 slams                  # grand slams: pole + win + fastest lap in one race
./f1 gaps                   # what the data is missing, and open discrepancies
./f1 events                 # every Grand Prix, how often held, and where
./f1 unverified             # everything not yet officially verified
./f1 licences               # what may be published, and under what terms
./f1 sql "SELECT ..."       # arbitrary SQL
./f1 schema                 # tables, columns, row counts
```

Or hit it directly — it's a plain SQLite file:

```sql
-- Which constructors won a title with an engine they didn't build?
SELECT year, c.name, engine_formula FROM seasons s
JOIN constructors c ON c.id = s.constructors_champion;

-- Every rule change that followed a fatality
SELECT r.year, r.title, sm.trigger_event
FROM regulation_changes r
JOIN safety_milestones sm ON sm.year = r.year
WHERE r.category = 'safety';

-- Title margins, closest first
SELECT year, margin FROM seasons WHERE margin IS NOT NULL ORDER BY margin LIMIT 10;

-- Champions who did NOT win the most races that season
SELECT s.year, d.full_name AS champion, s.champion_wins,
       (SELECT COUNT(*) FROM race_results r
        WHERE r.year = s.year GROUP BY r.winner_id
        ORDER BY COUNT(*) DESC LIMIT 1) AS most_wins
FROM seasons s JOIN drivers d ON d.id = s.drivers_champion
WHERE s.champion_wins < most_wins;

-- Every constructor's first and last victory
SELECT * FROM v_wins_by_constructor;

-- Which circuits has a driver won at most often?
SELECT gp_name, COUNT(*) n FROM v_race_winners
WHERE winner = 'Ayrton Senna' GROUP BY gp_name ORDER BY n DESC;

-- How often does pole convert to a win, by decade?
SELECT (year/10)*10 AS decade, SUM(pole_converted) * 100 / SUM(races) AS pct
FROM v_pole_to_win GROUP BY decade ORDER BY decade;

-- Drivers who took a pole but never won a race
SELECT full_name, poles FROM drivers
WHERE poles > 0 AND wins = 0 ORDER BY poles DESC;

-- Stored career figures against the figures derived from the race records
SELECT * FROM v_stat_reconciliation WHERE stored_poles != derived_poles;

-- Which circuits has one driver won at most often?
SELECT circuit, wins, first_win, last_win FROM v_circuit_winners
WHERE driver = 'Ayrton Senna' ORDER BY wins DESC;

-- Countries ranked by championship races held
SELECT country, circuits, races FROM v_circuits_by_country ORDER BY races DESC;

-- Venues that have dropped off the calendar, most recent first
SELECT * FROM v_lost_circuits;

-- The configuration actually raced, race by race
SELECT year, round, circuit, layout_name, length_km, figures
FROM v_race_venues WHERE circuit_id = 'silverstone';

-- Power and weight across the landmark cars
SELECT from_year, car, aspiration, capacity_cc, power_bhp, weight_kg
FROM v_car_evolution;

-- Every race a given car won
SELECT year, round, gp_name, circuit, driver
FROM v_car_races WHERE car_id = 'lotus-79' AND won = 1;

-- Design lineages: what descended from what
SELECT * FROM v_car_lineage WHERE root = 'lotus-25';

-- The final championship table, one row per entity
SELECT * FROM v_standings_final WHERE year = 1960;
```

---

## Structure

The core is two tables:

```
races          one row per championship event
race_entries   one row per driver per race
```

Every per-driver fact about a race is an attribute of an **entry**: pole is
`pole = 1`, a start from the front of the grid is `grid = 1` (not always the
same driver), a win is `finish_position = 1`, a fastest lap is a flag. Wins,
poles, fastest laps and podiums per driver are derived from this at build
time, so they cannot drift from the races they come from.

Until v2.4 those three facts were columns on the *race* row plus a separate
credits table. That meant a shared win and a shared fastest lap were modelled
two different ways, and neither could extend to a full finishing order without
changing shape again. The restructure was done before adding the finishing
order rather than after, so the harvest landed in a shape that did not have to
move — and when the full classification arrived in v2.15 it did not.

`race_results`, `race_credits` and `calendar` still exist as **views** over the
new tables, so anything written against the old schema keeps working.

### Identifiers

Which `id` you may keep, and which you may not.

A text id — `hamilton`, `monza`, `lotus-79` — is derived from the thing itself
and does not move. An integer `id` is a **surrogate**: the build hands it out
in insert order, so a source read in a different order shifts every id after
the row it added. That is what happened between v2.20 and v2.21, when 17% of
`race_entries.id` changed — and nothing in the database or in this file said
whether a reader had been entitled to rely on them.

Now it does, inside the database itself:

```sql
SELECT key, value FROM meta WHERE key LIKE 'id_stability%';
```

An integer id is **unstable between releases** unless its table is named in
`meta.id_stability_stable` — the <!-- fig:stable_id_tables -->7<!-- /fig -->
tables this release undertakes not to renumber. That is an undertaking and not
yet a measurement: nothing in the build compares a release with the one before
it, so what keeps it is whoever next changes a loader. Comparing a release with
its predecessor, and making the unstable tables' insert order deterministic so
they could be promised too, is separate open work.

Everywhere else the id is the build's business: join on the **natural key**,
the columns that identify the fact rather than the row. `verify.py` checks on
every build that each published key identifies exactly one row, because a key
that does not is worse than no key at all — a reader joining on it silently
doubles their rows instead of failing.

<!-- fig:id_keys -->
| Table | `id` | Natural key |
|---|---|---|
| `circuit_layouts` | stable | `(circuit_id, layout_key)` |
| `constructor_lineage` | unstable | — |
| `discrepancies` | unstable | — |
| `engine_eras` | unstable | — |
| `eras` | unstable | — |
| `governance` | unstable | — |
| `known_gaps` | unstable | — |
| `laps` | unstable | — |
| `pit_stops` | stable | `(race_id, source, driver_key, stop_number)` |
| `points_systems` | unstable | — |
| `qualifying` | stable | `(race_id, driver_id)` |
| `race_control_messages` | unstable | — |
| `race_entries` | stable | `(race_id, driver_id)` |
| `races` | stable | `(year, round)` |
| `records` | unstable | `(key)` |
| `regulation_changes` | unstable | — |
| `regulation_limits` | unstable | — |
| `safety_milestones` | unstable | — |
| `season_entrants` | stable | `(year, entrant_id, f1db_constructor_id, engine_manufacturer_id)` |
| `season_entries` | unstable | — |
| `sessions` | unstable | — |
| `source_patterns` | unstable | — |
| `source_registry` | unstable | — |
| `sprint_results` | stable | `(race_id, driver_id)` |
| `standings` | unstable | `(year, table_type, after_round?, entity_id, engine_id?, as_of, position_text?)` |
| `stints` | unstable | — |
| `team_radio` | unstable | — |
| `technical_innovations` | unstable | — |
| `tyre_suppliers` | unstable | — |
<!-- /fig -->

A `?` marks a key column that holds NULL on some rows. SQLite's `=` is not
null-safe, so join those with `IS`: `standings.engine_id` is NULL on every
drivers' row — a driver has no engine, while the constructors' championship is
contested by a chassis-engine combination — and joining that key with `=`
silently drops every drivers' row and reports no error at all.

`standings` is the one to watch in general: it is the table a reader is most
likely to have joined to by id, and a running season's table is reloaded whole,
so every id in it moves. Its key carries `position_text` because 2018 holds
Force India twice in the constructors' final classification — the excluded
entity on nought points and the re-entered one on 52 — which is a fact and not
a duplicate.

`records` is the cautionary one. Its ids look permanent — a small table,
rebuilt whole every time — and they are a position in a derived list, so most
of them moved between v2.21 and v2.23 when a record was added in the middle.
It is published unstable, with `records.key` as the thing to hold.

A table listed with no natural key has none published yet; treat its ids as
unstable and read the table whole. `build.py` refuses a table with a surrogate
id that the policy does not classify, so a new table cannot quietly arrive
outside it.

### What the restructure fixed

Running the audit against v2.3 found real defects, not cosmetic ones:

- **The same event existed twice.** `gp_name` was free text, so "Emilia Romagna
  Grand Prix" and "Emilia-Romagna Grand Prix" were different races. There is now
  a canonical register of <!-- fig:grands_prix -->53<!-- /fig --> Grands Prix;
  every race carries a `gp_id`, and the name it raced under is kept separately
  for display. All <!-- fig:race_name_strings -->56<!-- /fig --> name strings
  in the data resolve, and `verify.py` fails if one does not.
- **Tyrrell's lineage pointed at `faenza-no`** — a placeholder that leaked in as
  a value. Tyrrell is in fact sequence 1 of the Brackley chain. Half the
  constructors pointed at chains that did not exist; every one now resolves.
- **`VERIFIED_STATS` had been silently dropped** by an earlier edit, so the
  officially checked entries, podiums and points were no longer being applied.
- **A shared drive gave the constructor zero wins.** Introduced during the
  restructure and caught by the win-total check within minutes — Ferrari, Alfa
  Romeo and Vanwall were each one short.
- **The compatibility view was 0.73s per scan** and two checks ran it once per
  driver, which took `verify.py` from seconds to over three minutes. Composite
  indexes and base-table queries brought it back to 0.07s.
- Four columns that could never be filled were dropped, and eight that are
  derivable are now derived.

### Readiness

`audit.py` ends by checking whether the schema can absorb a full finishing
order. When that check was written the four columns a full order needs —
`classified`, `status`, `laps_completed`, `points` — were declared and empty;
since v2.15 they are filled for every run race, and the check stays as the
record that adding them was pure INSERT: no table, column, key or view had to
change.

---

## Venues

Before v2.5 a race was linked to a circuit only when the event had used exactly
one venue in its whole history — 365 of the 1,161 races then held, 31%. Events that moved
around, which are the interesting ones, had no circuit at all: you could not
ask where the 1976 French Grand Prix was held, or how many races Watkins Glen
hosted.

The venue of every race is now harvested and stored. The harvest used the same
method as the results and pole harvests: read the season table, take the
circuit **and** the winner, and reject any row whose winner does not match the
one already stored. On top of that, two structural checks ran on every row:

- where the Grand Prix has only ever used one circuit, the harvested venue must
  be that circuit;
- where a circuit was already stored from the verified 2026 calendar, the
  harvest must agree with it.

Every row of that harvest passed all three, and its eighty-six distinct venue
strings resolved to the circuit register with none left over.

### Configurations

A circuit's length and corner count describe its *current* shape. Quoting those
against a 1976 race is wrong — Silverstone in 1976 was 4.719 km, not today's
5.891 km. `circuit_layouts` holds the configurations, and where a circuit
appears there at all, the rows now form a **complete, non-overlapping timeline**
of what was actually raced. `verify.py` enforces both properties, so a layout
cannot be added that leaves a season uncovered or claims one twice.
<!-- fig:layout_circuits -->13<!-- /fig --> circuits have that timeline;
<!-- fig:as_raced -->493<!-- /fig --> races
(<!-- fig:as_raced_pct -->41%<!-- /fig -->) therefore report the layout as
raced, and `v_race_venues.figures` says of every row whether it is `as raced`
or a fallback to `current layout`. The rest is a declared gap, not silence.

Every layout also has a **drawing**. F1DB ships an outline of each of its
<!-- fig:circuit_outlines -->160<!-- /fig --> circuit layouts across
<!-- fig:outline_circuits -->79<!-- /fig --> of the circuits here — SVG assets
drawn by Jules Roy, CC BY 4.0 like the rest of F1DB — and names the layout
every race ran. `circuit_outlines` holds the path data, keyed by F1DB's layout
id, with the circuit derived from the races that ran it; `races.f1db_layout_id`
names the layout each race ran, so every race can be drawn whether or not its
circuit has a timeline here; and `circuit_layouts.f1db_layout_id` names the
outline that draws a timeline row wherever its span ran exactly one. An
outline is a drawing, not a measurement — no scale, no position, no direction
of travel. The traced centrelines under *Illustration* have all three and
exist only for layouts on the ground today. The rule the site prints wherever
a shape appears: *the outline is F1DB's, for every layout; the trace is
OpenStreetMap's, where it exists.*

Filling this in exposed two errors and one modelling failure:

- **The Österreichring and Magdalena Mixhuca existed twice** — once as circuits
  in their own right and once as layouts of the Red Bull Ring and the Autódromo
  Hermanos Rodríguez. The register now holds one row per *site*, with
  reconfigurations as layouts, which is how Spa, Monza and Silverstone were
  already modelled.
- **The Nürburgring Südschleife was credited with a championship race.** The
  1960 German Grand Prix ran there to Formula Two regulations and did not count
  towards the championship. It is the one circuit in the register with no races,
  and it says why.
- **A year cannot always identify a layout.** In December 2020 Bahrain ran the
  Grand Prix circuit and, a week later, the Outer circuit. A year-range table
  reported both races at 3.543 km. Layouts now carry a `by_year` flag: the
  timeline rows are resolved by year, one-offs are reachable only through an
  explicit `races.layout_key`. The 2010 Bahrain Grand Prix, run on the
  60th-anniversary Endurance loop, is the other one.

---

## Cars and chassis

There are two layers here and they are deliberately not merged.

**`cars` is a curated set of <!-- fig:cars -->29<!-- /fig -->.** A car in
that table is a *design family*: the Lotus 79 raced in 1978 and 1979 and is
one row; the Ferrari 312T through 312T5 is one row, because that is how the
results were published and how the reference pages treat it. Each carries
engine, chassis construction, gearbox, suspension, brakes, weight and
dimensions as published, plus three things a spec sheet does not — the
**concept** in one line, what the car **introduced**, and what it actually
**achieved**.

**`chassis` is the register: <!-- fig:chassis -->1,153<!-- /fig --> rows,
every chassis that has raced.** It is loaded from
[F1DB](https://github.com/f1db/f1db) (CC BY 4.0) by `tools/f1db_fetch.py` — a
scale at which nobody types anything — and
<!-- fig:chassis_with_spec -->804<!-- /fig --> of them carry a specification
`tools/wikispec_fetch.py` established off that chassis's own Wikipedia
article. `chassis.car_id` joins the two.

<!-- fig:chassis_published_wins -->784<!-- /fig --> chassis carry a published
career win total. The wins this database derives independently, from its own
race records through the linkage below, **agree exactly for
<!-- fig:chassis_wins_match -->634<!-- /fig --> of them and exceed for
<!-- fig:chassis_wins_exceed -->0<!-- /fig -->**; the rest are lower bounds
where a season could not be linked.

Where both layers hold the same figure the build **compares them instead of
picking one**: a value derived twice by different routes is the strongest
evidence this database has, and a disagreement goes to `discrepancies`.

```
./f1 cars                # the curated designs
./f1 chassis lotus       # every Lotus chassis in the register
./f1 ambiguous           # the constructor-seasons that cannot be resolved
./f1 limits              # what each season's rules capped
```

### Where the specifications come from, and what refuses them

There is no unified specification dataset for Formula One cars anywhere.
F1DB's chassis register is complete and carries **no technical data at all**;
the numbers live in the `{{Racing car}}` infobox on each car's own article,
whose fields map almost one-for-one onto this schema.

Guessing that "Ferrari 312T2" is the article for the chassis F1DB calls
`ferrari-312t2` is inference, and inference is what put an invented "Ferrari
125 F2" into the abandoned 1952 harvest. So a title is only a candidate, and a
page is read only if it agrees with three things established elsewhere:

1. the **constructor** its infobox names must be the one F1DB gives that
   chassis;
2. the **years** it reports must fall inside the seasons F1DB records that
   chassis as entered;
3. the **title** must be a form of the constructor followed by the
   chassis's designation — "Ferrari Tipo 500", "Red Bull Racing RB19" and
   "Mercedes-Benz W196" all qualify, and Wikipedia documents families on one
   page, so "Lotus 72C" legitimately redirects to "Lotus 72". A different car
   is refused: searching for "Ferrari 312/66" offers "Ferrari 312T" first,
   and 312T is not the 312/66. Only filler such as "Tipo" or "Racing", or a
   word of the constructor as the page's own infobox spells it, may stand
   between the name and the designation, so "Lotus 18/21" is not the 21 and
   "Lotus Elan 25" is not the 25. Words are compared whole, so "Barcelona"
   is not BAR. A title that lists models, "Alfa Romeo 158/159 Alfetta",
   counts for each car it lists, and only when every item is one of the
   constructor's own designations and the joined word is not; F1DB holds a
   Lotus 18/21, so that page is still not the 21.

A page failing any of the three is refused whole and logged in
`harvest/car_specs.log` with the reason. Nothing is partially accepted and a
near miss is never nudged into a match.

### Regulation limits are not measurements

**Modern cars are documented far more thinly than historic ones**, and going
backwards yields much richer rows than starting at 2026. This is not a
harvesting failure: current-era specifications are competitive secrets, so a
team publishes a power-unit badge, a suspension layout and very little else.

Most "weight" quoted for a recent car is simply that season's regulation
minimum. The 2026 figures in circulation — 768 kg, a 3,400 mm wheelbase,
1,900 mm of width — are **limits in the rules that every car on the grid is
built to**, not measurements of any one of them. Putting one in a per-car
field would be inference presented as fact.

So they live in `regulation_limits`, where a rule belongs, and the harvest
drops a car figure that only restates one. `verify.py` then checks that no
regulation limit has leaked into a car's own field. The 2026 rows in `chassis`
are thin, and the database says so rather than padding them.

### Linking a race to a chassis, and where that stops

`data/cars.py` has a `CAR_SEASONS` list. A `(car, year)` pair asserts that
every race this constructor won, took pole for or set fastest lap in that
season was in this car — a strong claim, so it is not made where a team ran
two cars in one year, and since v2.12 it is only honoured where F1DB's entry
list for that season corroborates it.

The claim is **checked rather than trusted**. `EXPECTED` holds each car's
published career wins and poles; the build derives the same two figures from
the race records, and `verify.py` fails if any car has *more* wins than its
published total, or if a car whose seasons are all linked does not match
*exactly*. <!-- fig:cars_checked -->19<!-- /fig --> cars carry a published
total and <!-- fig:cars_fully_linked -->10<!-- /fig --> of them are fully
linked, so for those ten the derived and the published figure must be equal,
and are. That check found a real error when it was first written: Vanwall's
figure had been entered as 6, the 1958 season total, not the career 9.

Since v2.8 the same thing is done at chassis resolution, from a second source.
F1DB's per-season entry lists record which chassis a constructor ran in a
season — the constraint the abandoned chassis harvest was missing, because the
race winner tells you which race a row describes and nothing whatever about
what he drove. The winning chassis is now known for
**<!-- fig:races_with_winning_chassis -->876<!-- /fig --> of
<!-- fig:races_run -->1,163<!-- /fig --> races**.

The limit is hard and it decides the shape of the whole result:

> **F1DB records which chassis a constructor ran in a SEASON. It does not
> record which chassis ran in which ROUND.**

Where a team used more than one design in a year, the entry list names them
all with no round attribution, so the season constrains nothing and those
entries stay NULL. Ferrari in 1952 entered five different chassis — the 500
Ascari won everything in, plus a 125, a 166, a 212 and a 375S in other
people's hands — and gets no link at all. That is the correct answer for 1952,
and it is the answer the abandoned harvest should have given.

The consequence is that coverage is not spread evenly over time. It tracks how
teams actually operated:

| Decade | Entries linked to a chassis |
|---|---|
| 1950s | <!-- fig:linked_1950s -->76%<!-- /fig --> |
| 1960s | <!-- fig:linked_1960s -->51%<!-- /fig --> |
| 1970s | <!-- fig:linked_1970s -->49%<!-- /fig --> |
| 1980s | <!-- fig:linked_1980s -->64%<!-- /fig --> |
| 1990s | <!-- fig:linked_1990s -->77%<!-- /fig --> |
| 2000s | <!-- fig:linked_2000s -->83%<!-- /fig --> |
| 2010s | <!-- fig:linked_2010s -->99%<!-- /fig --> |
| 2020s | <!-- fig:linked_2020s -->100%<!-- /fig --> |

A modern team runs one car all season and the entry list settles it. A 1960s
"constructor" was a name several privateers entered several different chassis
under, and the season settles nothing. `./f1 ambiguous` lists all
<!-- fig:ambiguous_seasons -->321<!-- /fig --> unresolvable
constructor-seasons; the remaining work is in `known_gaps`.

Poles were once a lower bound by construction, because the pole harvest
recorded who took pole but not what they drove. The entry lists now supply the
constructor for almost all of them: <!-- fig:poles_without_constructor -->11<!-- /fig -->
of <!-- fig:poles -->1,163<!-- /fig --> pole entries still carry none.

---

## Illustration

Two tables hold pointers to things this repository does not contain.

### Photographs — `article_images`

**No image is stored.** A row records which file a car's article carries,
who took it, and under what licence; the pixels are fetched from
`upload.wikimedia.org` by whatever renders the page. `f1.db` does not grow.

The claim is deliberately narrow and it *is* checkable: the article already
passed the constructor, seasons and name checks in `tools/wikispec_fetch.py`,
so what is recorded is "the article proved to describe this chassis carries
this file". That is the article's lead image, or — where it has none — a
photograph in its body whose own file name names the car; a body image that
does not is refused, because the first picture on a page can be a driver,
an engine or a road car. Rerunning the harvest re-establishes it.
<!-- fig:images -->623<!-- /fig --> of the
<!-- fig:chassis_with_spec -->804<!-- /fig --> articles yield one.

Three things are enforced at harvest and again on every build. The file must
be on **Commons** — a file uploaded locally to en.wikipedia.org is local
*because* it is non-free, so linking one would be a licence violation that
looks like a working feature. It must state a **free licence**, matched
against a list rather than a pattern, because `CC BY-NC` and `CC BY-ND` both
begin "CC BY". And it must name **someone to attribute**: attribution is a
condition of CC BY and CC BY-SA, not a courtesy. A file failing any of the
three is refused and logged in `harvest/article_images.log` with the reason.

There is no single licence covering these.
<!-- fig:image_licences -->16<!-- /fig --> distinct licence strings appear
across the <!-- fig:images -->623<!-- /fig --> rows, so every row carries its
own and any display must show it. The web app's smoke test asserts this: if
the image renders and the credit does not, the test fails, because that is not
an ugly page, it is an infringing one.

What **cannot** be checked is whether the photograph shows the car. Testing
whether the file name mentions the chassis finds
<!-- fig:images_named -->277<!-- /fig --> of
<!-- fig:images -->623<!-- /fig --> — most correct images are filed under the
driver, and `File:Jos_Verstappen_2000_Monza_(cropped).jpg` really is an
Arrows A21 — so the test would discard half the good rows if it were a rule.
It is stored as `name_matches` and enforced nowhere. The failure it
half-detects is real: the ATS D5 article leads with a photograph of officials
and police. Every row sits at `unverified`.

**A second, weaker route.**
<!-- fig:chassis_without_article -->349<!-- /fig --> chassis have no article
of their own — Wikipedia covers them on the team's page — so the route above
never reaches them. For those, `tools/wikimedia_images.py --route category`
looks for a Wikimedia Commons category named for the chassis, such as
`Category:Vanwall VW5`, and takes a photograph filed under it.
<!-- fig:images_catalogued -->119<!-- /fig --> rows come from it. The claim is
only that a Commons editor filed the file there, and a category also holds
replicas and show cars, so these rows sit a rung *below* `unverified`, at
`catalogued`, and the `route` column keeps them apart. A category is taken
only when its title is the chassis's name exactly, Commons files it as a
Formula One car, and no other chassis claims it. The same licence and
attribution checks apply; the Commons check is restated rather than dropped,
because Commons says `local` about its own files — the harvest checks
instead that Commons answered, for a page in the File namespace. The site
does not show these photographs.

### Centrelines — `circuit_geometry`

A circuit's shape as OpenStreetMap maps it, stored as GeoJSON and drawn as
inline SVG with no map library and no tiles. Relation ids come from Wikidata
(CC0); the geometry is **ODbL 1.0**, which is share-alike and carries a
database right that reaches the whole database its data lands in. So it is
not in `f1.db`: it ships as **`f1-geometry.db`** beside it, which ODbL treats
as a Collective Database rather than a derivative one.
`tools/geometry_overlay.py --apply` merges it into a local copy, and the
website merges it in your browser. See `ATTRIBUTION.md`.

The reason it belongs here rather than anywhere else is that this database can
reject it. A circuit relation is not an ordered ring — its members include the
pit lane — so summing them naively gives, for the first circuit the harvest
tried:

    Monaco, OSM relation 148194
      all 42 member ways                   3.745 km   +12.2%
      excluding role=pit_lane (0.357 km)   3.388 km    +1.5%
      published, already held here         3.337 km

Nothing about 3.745 looks wrong on its own. `length_km` is what says
otherwise. Anything outside 2% is refused rather than stored with a caveat,
and the measurement is re-run in `build.py` from the stored coordinates using
its own copy of the arithmetic — sharing the tool's would check nothing.

Measuring the right length does not make it a lap. The members are unordered,
so whether they form one is a separate question, and the length cannot answer
it: Las Vegas is missing a way and still measures inside 2%. `build.py` walks
the ways end to end when the row is admitted and stores what it found —
`segment_count`, `loose_ends`, `closes` — and `verify.py` re-derives all three
from the geometry on every build.

<!-- fig:centrelines_closed -->22<!-- /fig --> of
<!-- fig:centrelines -->25<!-- /fig --> stitch into a closed lap. The ones
that do not:

<!-- fig:open_centrelines -->
| Circuit | Loose ends | Ways in the relation |
|---|---|---|
| `las-vegas` | 1 | 81 |
| `monaco` | 4 | 41 |
| `montjuic` | 2 | 31 |
<!-- /fig -->

A join is not "close", it is **identical**: ways in a relation share their
junction nodes, so nearly every way end here sits at 0.000 m from another end,
and the few that do not are metres apart and every one is a real hole. The
check used to allow 30 m, which is wide enough that the Monaco and Montjuïc
holes read as joins — it reported only Las Vegas, and passed two broken traces
for several versions. One metre is above serialisation noise and below the
smallest real gap.

The front end does not draw from it. `/circuits/:id` prints what the build
measured — the relation, the points, the measured length against the published
one, and whether the walk closes — under F1DB's outlines, which are the picture
of a circuit. `web/src/lib/lap.js` still holds a second implementation of
the stitch, and `web/test/units.mjs` holds its metre to the figure `_haversine`
returns here; since AF-23 no page imports it, so it ships in no bundle and that
test is the whole of what exercises it (CR-32).

Geometry attaches to a **layout**, never to a circuit alone, wherever a layout
timeline exists. Monza 1955 is not Monza 2026 and `circuit_layouts` already
keeps them apart. A trace can only ever be the current configuration, so it is
never attached to a layout whose timeline has closed; `verify.py` fails the
build if one is.

## Timing, telemetry and radio

Being blunt about what exists, because most of what people imagine is
available is not — and about what this database may carry, because that is
the tighter limit.

**Formula 1 publishes per-lap data from 2018 and nothing before it.** Lap
times, sector times, speed traps, tyre compound and age, stint boundaries, pit
in/out, track status and race control messages all come off the live timing
API and all start in 2018. There is no lap-by-lap record of the 1988 season in
any retrievable form, and there is no prospect of one.

**Team radio is published as audio, not text.** There are no official
transcripts. F1 puts the clips on the same API, also from 2018.

**Car telemetry — speed, throttle, brake, gear, RPM, DRS — exists from 2018**,
at about 4 Hz plus position at 10 Hz. It is hundreds of megabytes per race
weekend. It does not belong in a SQLite file and it is not in one.

**None of it is offered on terms that let this project pass it on.** The live
timing API is Formula One Management's data; the one other source of race lap
times, Jolpica-F1, is CC BY-NC-SA, and this project publishes under terms that
permit reuse. FOM and its licensees redistribute timing every weekend — the
constraint is the licences available here, not the law. So the split is:

| Table | Covers | In the committed database |
|---|---|---|
| `race_timing` | pole / fastest lap / race time per race | empty — a licence decision, see `known_gaps` |
| `laps` | per-lap timing, sectors, tyres, track status | **empty, and `verify.py` fails if it is not** |
| `stints` | tyre stints | empty, same |
| `race_control_messages` | flags, safety cars, penalties, deleted laps | empty, same |
| `pit_stops` | lap and order of every stop | <!-- fig:pit_stops -->22,506<!-- /fig --> rows from F1DB (CC BY 4.0); no durations, and only that source is permitted |
| `team_radio` | clip index and optional transcripts | <!-- fig:notable_radio -->6<!-- /fig --> curated exchanges, quoted from a written source |

`docs/TIMING-ARCHITECTURE.md` is the decision in full. The empty tables are
not an unfinished feature: they are the correct answer until a source
publishes lap times under a licence that permits passing them on, and
`ci.yml` checks the *committed* database for them before every rebuild
because that is the only moment a bad commit is catchable.

For **your own copy**, `tools/fastf1_load.py` reads the live timing API
through FastF1 and fills all of it, 2018 onwards. It is a **separate script,
not part of the build**, because the build is offline and this data is not;
`--results` also fills the finishing order it reads and refuses any race whose
winner is not the one already stored. Car telemetry can be dumped alongside
with `--telemetry-parquet DIR`, which writes Parquet files next to the
database rather than into it. `F1_LOCAL_TIMING=1` tells `verify.py` that the
rows are there on purpose — the load is legitimate, the file is simply not
yours to publish.

```bash
pip install fastf1
python3 tools/fastf1_load.py --years 2018-2026 --results --radio
```

**`build.py` drops and rebuilds `f1.db` from scratch**, so anything the loader
put there is destroyed by the next build. Keep the FastF1 cache — that is the
expensive part — and re-run the loader after a rebuild.

### Notable radio

<!-- fig:notable_radio -->6<!-- /fig --> exchanges are held as text with
`notable = 1`, transcribed from broadcast and each checked against a written
source: Smedley's "Fernando is faster than you", Horner's "This is silly,
Seb", Alonso's "GP2 engine", and the three-way Wolff / Horner / Masi exchange
that decided the 2021 championship. The set is small deliberately — an
exchange only belongs there if the exact words can be cited rather than
remembered, and several famous ones are missing for exactly that reason.

---

## The finishing order

`race_entries` holds **<!-- fig:race_entries -->27,504<!-- /fig --> rows —
every entry of every one of the <!-- fig:races_classified -->1,163<!-- /fig -->
run races**, <!-- fig:season_span -->1950–2027<!-- /fig -->, in the committed
database. Position, grid, laps, retirement cause and points. Alongside it sit
**<!-- fig:qualifying -->27,017<!-- /fig --> qualifying rows** and
**<!-- fig:standings -->34,597<!-- /fig --> championship standings rows**: the
table after every round of every season, and the end-of-season classification
for each, which `v_standings_final` returns one row per entity.

### It was a licence, not a harvest

This gap stood for seven versions and `known_gaps` #2 described it as a
licensing decision. That was accurate but incomplete. The rows came from
[Jolpica-F1](https://api.jolpi.ca), whose Ergast lineage is CC BY-**NC**-SA —
a non-commercial clause more restrictive than anything else here — so they
could be loaded onto your copy and never committed.

[F1DB](https://github.com/f1db/f1db) has the same facts under **CC BY 4.0**:
attribution only, no share-alike, no non-commercial clause. It was already a
source in this project, supplying the chassis, engine and entrant registers.
Nothing had to be fetched from anywhere new. The gap was a reading of one
licence, and it closed the moment someone looked at the other.

### What checks it

Four things, all held independently before F1DB was consulted:

1. **The winner of every race.** All were already stored from the Wikipedia
   harvest. A race whose winner disagrees is refused *whole* — never partly
   accepted. None was. The comparison is on **sets**, because a shared drive
   puts two drivers on position 1 and both are winners; taking "the" winner
   made 1956 Argentina and 1957 Britain look like disagreements when both
   sources said the same thing.
2. **The champion and runner-up of every completed season**, with both point
   totals, already in `seasons`. The final standings must reproduce all four,
   every year. They do.
3. **The pole-sitter of every race.** Qualifying position 1 is checked against
   it. The races where the credited pole-sitter was not the fastest qualifier
   — grid penalties and sprint weekends — are, since v2.21, pinned by
   `verify.py` as a convention rather than recorded as disagreements, because
   neither source is wrong about the thing it describes: `pole` says who the
   season record credits, `grid` says where every car started, `qualifying`
   says who was quickest.
4. **Jolpica, still.** `tools/ergast_load.py` no longer writes over anything.
   It loads alongside and records every disagreement. Its first run against
   the committed classification, at v2.15, reported:

```bash
python3 tools/ergast_load.py --from-dump
#   26,082 entries across 1,160 races
#   118 finishing positions where Jolpica disagrees with the stored value
#   - recorded in discrepancies, nothing overwritten
```

118 of 26,082 is 0.45%, and the pattern is worth knowing: **F1DB leaves a
disqualified driver's position vacant; Jolpica promotes everyone below.** The
1983 Brazilian Grand Prix has no second place in one reading and Lauda second
in the other, after Rosberg was disqualified for a push start. Neither source
is wrong, so neither is overwritten.

### What the results model had to learn

Three things the old two-column model could not say, each found by a check
failing:

- **A result is not always a number.** <!-- fig:dnf -->8,719<!-- /fig -->
  retirements, <!-- fig:dnq -->1,041<!-- /fig --> failures to qualify,
  <!-- fig:dnpq -->337<!-- /fig --> failures to *pre*-qualify,
  <!-- fig:dns -->378<!-- /fig --> non-starts,
  <!-- fig:dsq -->160<!-- /fig --> disqualifications. `position_text` keeps
  the source's own vocabulary; `finish_position` stays a clean integer, NULL
  where there is none. Collapsing them loses the late 1980s entirely.
- **The constructors' championship is contested by a chassis-ENGINE pair.**
  In 1960 that is seven entries for five constructors: Cooper-Climax won it
  with 48 points while Cooper-Maserati and Cooper-Castellotti tied for fifth
  on 3. Keying standings on the constructor alone silently handed Cooper the
  wrong total — 22 seasons looked like source disagreements until
  `standings.engine_id` existed.
- **A championship entry can have points and no position.** Michael
  Schumacher scored 78 in 1997 and was excluded from the classification after
  Jerez. Storing that as position 0 made him sort first, and the check that
  compares `seasons` to the standings reported him as the 1997 champion.

Two genuine errors in the curated data were caught the same way. The 1963
runner-up was recorded as Ginther; he and Graham Hill both finished on 29 and
**Hill takes it on countback**. And Matra's first entry was 1967; the 1966
German Grand Prix classified Formula Two cars alongside the Formula One field
and **Matra entered four of them**, Beltoise finishing eighth.

### Career figures, now derived

With the classification committed, podiums are derived rather than trusted.
<!-- fig:podiums_compared -->7<!-- /fig --> drivers hold an official podium
count and <!-- fig:podiums_match -->4<!-- /fig --> match it exactly; the
others have stood on the podium since their external figure's `stats_as_of`,
and the pairs are in `v_stat_reconciliation`.

`drivers.entries`, `starts` and `career_points` remain stored rather than
derived — see *What it deliberately doesn't have*.


## The confidence model

Your v1 policy was "official sources only, never invent". That's the right
instinct but it caps the database at whatever can be fetched in a session. So
every fact table now carries a `confidence` column instead:

| Level | Meaning | Safe to publish? |
|---|---|---|
| `verified` | Checked against fia.com or formula1.com during construction | Yes, with citation |
| `high` | Long-established record, consistently published officially for decades | Yes |
| `reference` | Harvested from Wikipedia's season results tables or F1DB, cross-checked on load | Yes, but cite the FIA/F1 archive |
| `medium` | Correct in substance; an exact figure or date may have drifted or moves with the season | Confirm first |
| `unverified` | Placeholder or disputed | No |
| `catalogued` | Not checked by anyone: a photograph filed by Commons editors under a category named for the chassis | No |

Since v2.16 the tier is **traceable**: every row's `source` resolves through
`source_patterns` to a `source_registry` entry, the tables without a `source`
column are covered by `table_provenance`, and anything **authored** for this
project from general knowledge is capped at `medium` because nothing outside
the project constrains it. See `docs/DERIVED-CONFIDENCE.md`, and `./f1
licences` for what each source permits.

### On admitting Wikipedia

Wikipedia is admitted for **structured race results only**. Its season tables are
transcribed from FIA classifications and are heavily cross-checked; they are the
right tool for this job. It is *not* admitted for narrative, attribution or
contested claims, where those pages drift and carry unsourced assertions — none
of the history notes in this database come from it.

Nothing was taken on trust. Every harvested row was validated on load against
data already in the database, and that caught three real errors:

- **1982 Brazilian Grand Prix.** The harvest credited Piquet. Piquet finished
  first but he and Rosberg were disqualified for underweight cars, and Prost was
  the classified winner. Confirmed against the race article and corrected — this
  also reconciled Prost to 51 wins and Piquet to 23.
- **1951 French Grand Prix.** The harvest recorded Fangio alone. It was a shared
  drive with Fagioli, who at 53 remains the oldest winner of a championship race.
  Both are now credited.
- **Bill Vukovich.** Recorded with one Indianapolis win; he won in 1953 *and*
  1954. The derived count was right and the hand-entered figure wrong.

It also exposed three category errors in the existing data: Rob Walker Racing's
victories belong to the Cooper and Lotus chassis it entered, not to Walker as a
constructor; and the wins credited to Racing Bulls and Sauber belong to Toro
Rosso, AlphaTauri and BMW Sauber, the names in use at the time. All three are
now recorded correctly with the lineage table carrying the connection.

The v2.2 pole harvest was validated the same way, and harder: **every harvested
row also carried the race winner, which had to equal the winner already stored.**
All matched, which is strong evidence that the pole and fastest-lap values in
those same rows are sound. Reconciling the derived pole counts against the
hand-entered career totals then found two more errors, both in 2012:

- **2012 Spanish Grand Prix.** Recorded Hamilton on pole. Hamilton set the fastest
  qualifying time but was excluded for a fuel infringement, and Pastor Maldonado
  inherited pole. Confirmed and corrected.
- **2012 European Grand Prix.** Recorded Alonso on pole; it was Vettel.

Neither was guesswork. Four independent career totals — Hamilton's 104, Vettel's
57, Alonso's 22 and Maldonado's 1 — reconcile exactly under those two corrections
and under no other combination. Both were then confirmed against the race
articles before being applied.

The v1 rule survives intact: **nothing is promoted to `verified` without an
official source.** `./f1 unverified` lists the rows currently sitting at
`medium` — that's your work queue, and every one of them can be promoted by
fetching the relevant official page and editing the source module.

### Derived figures, and what happens when sources disagree

Because the race records cover every championship race, career wins, poles
and fastest laps are **computed from them**. That makes those three fields
self-consistent by construction, always current, and impossible to drift. The
previously hand-entered or externally checked values are kept in
`wins_external`, `poles_external` and `fastest_laps_external`.

The two are compared on every build. Across the
**<!-- fig:drivers_with_external -->234<!-- /fig --> drivers that hold an
official figure — <!-- fig:external_comparisons -->393<!-- /fig -->
comparisons — there are <!-- fig:external_differences -->5<!-- /fig --> live
differences**, and `verify.py` fails the build on any that is not declared in
`discrepancies`. Two earlier differences were errors in the external figure,
found the same way and since corrected, which is why they no longer appear:
John Surtees's fastest laps were entered as 11 where the reference record
says 10, matching the race data; George Russell's poles came back as 12 from
a formula1.com fetch that also returned internally inconsistent 2026 figures,
and Wikipedia's infobox independently gave 11, matching the derived count.

**Where two sources disagree and neither can be checked against an official
source, the disagreement is itself the fact worth storing.** `discrepancies`
holds <!-- fig:discrepancies -->58<!-- /fig --> rows:
<!-- fig:discrepancies_open -->11<!-- /fig --> open,
<!-- fig:discrepancies_explained -->8<!-- /fig --> explained — an external
figure older than the race it lacks, or two readings of a career span that
are each right about something — and the rest resolved — corrected,
withdrawn or not corroborated — with the outcome on the row. Each open one is
shown on the page of the driver, team or race it is about. `./f1 gaps` prints
them.

As a further guard, `verify.py` asserts a fixed set of headline career records
against their known official figures — Hamilton 106/104/69, Schumacher
91/68/77, Senna 41/65/19, Fangio 24/29/23 among them — and fails if one moves.

---

## What it deliberately doesn't have

Being straight about the gaps, because a database that hides them is worse than
one that doesn't:

These are also in the database, as the `known_gaps` table — so they can be
queried, not just read here. `./f1 gaps` prints them with the fix for each.

- **Entries, starts and career points per driver.** Wins, poles, fastest laps
  and podiums are derived from the race records and reconciled against the
  official figures. These three are still stored: an "entry" is not the same
  as a `race_entries` row once practice-only and withdrawn entries are
  counted, and points need every season's scoring system applied, including
  the best-N rules that ran until 1990.
- **What a photograph shows.** <!-- fig:images -->623<!-- /fig --> cars carry
  a photograph from Wikimedia Commons with its licence and photographer. The
  *article* is well constrained; what the picture depicts is not, and there is
  no second source to disagree with it. This is the only part of the database
  with no cross-check available at all. A further
  <!-- fig:images_catalogued -->119<!-- /fig --> chassis with no article have
  one only from a Commons category, held a rung lower at `catalogued` and not
  shown. `./f1 images` lists the
  <!-- fig:images_unnamed -->346<!-- /fig --> whose file name does not even
  name the car.
- **Historic circuit geometry.** Centrelines are traced from OpenStreetMap,
  which maps what is on the ground. Spa's 14.1 km road course and Monza's
  banking are unmapped and unmappable; Wikidata's own historic-layout
  entities carry a length and a date range but no coordinates.
- **Lap times, sector times, tyre stints, race control messages.** Held empty
  by licence, not by omission — see *Timing, telemetry and radio* and
  `docs/TIMING-ARCHITECTURE.md`. Grid positions, retirements and qualifying,
  which an earlier version of this list said were absent, have been held for
  every run race since v2.15.
- **Circuit configuration for most venues.**
  <!-- fig:layout_circuits -->13<!-- /fig --> circuits have a complete
  configuration timeline. Everywhere else a race carries the circuit's current
  length and corner count, which for Kyalami or Zandvoort is not what was
  raced. `v_race_venues.figures` labels every row `as raced` or `current
  layout`, so the fallback is visible rather than silently wrong.
- **Entry lists before the current season.** `season_entries` covers
  <!-- fig:season_entries_year -->2026<!-- /fig --> only. The historical
  equivalent is `season_entrants` — constructor, chassis, engine and tyre per
  season from F1DB — and `standings` covers every season, so the full points
  table for 1982 is there; the driver-by-seat list for it is not.
- **Most cars, as designs.** `cars` holds <!-- fig:cars -->29<!-- /fig -->
  landmark chassis, not the several hundred that have started a Grand Prix,
  and <!-- fig:entries_with_car -->1,635<!-- /fig --> of
  <!-- fig:race_entries -->27,504<!-- /fig --> race entries reach one. The
  `chassis` register covers the rest at the level of the entry list, and the
  schema says which entries are unlinked rather than guessing.
- **Lap-by-lap anything before 2018.** Not a gap that can be filled — it was
  never recorded in a form anyone can retrieve. See *Timing, telemetry and
  radio* above.

The `known_gaps` table holds <!-- fig:known_gaps -->16<!-- /fig --> entries,
of which <!-- fig:known_gaps_open -->10<!-- /fig --> are open gaps — the figure
the site's homepage and `/data` state, counted from the same `v_open_gaps`
view. The rest are either closed, and kept so the closure is on record, or
positions: a deliberate absence rather than a gap, such as the race timing
nobody publishes under a licence that permits passing it on, or the 2021
Belgian Grand Prix's fastest lap, which
does not exist because none was set. `./f1 gaps` prints them all with the fix
for each.

---

## Staying current

The results, qualifying, standings, pit stops and sprint classifications come
from [F1DB](https://github.com/f1db/f1db), and `harvest/*.txt` is a **snapshot**
of it rather than a live feed. Until the snapshot is refreshed the database
still describes the world as it was when somebody last ran the fetch tool — a
race that has been run keeps showing as scheduled.

Refreshing it is one command:

```bash
pip install pyyaml                 # the fetch tool needs it; the build does not
python3 tools/f1db_fetch.py        # rewrites harvest/ from the current F1DB
python3 build.py && python3 verify.py
```

`.github/workflows/refresh.yml` does exactly that every day at 06:00 UTC,
and commits the result **only if every check still passes**. A refresh that
breaks a cross-check is thrown away rather than committed, so an unattended
job can never replace a good database with a broken one. It can also be run
by hand from the Actions tab for a race that lands out of step with the
schedule.

`docs/UPSTREAM.md` records what depends on F1DB, table by table, and what
happens if it stops, changes shape or changes licence.

Two things do not arrive with a refresh. Pole position and fastest lap are
separate harvests, so a race that has just been run appears with its full
finishing order and neither of those until those harvests catch up; F1DB
fills the vacancy and only the vacancy, and `verify.py` warns about any
affected rounds by name rather than failing. And the calendar status is no
longer hand-authored: `build.py` promotes a round to `completed` when a
classification exists for it, in that direction only, because a missing
result is far more often an un-harvested race than a race that did not happen.

## Verification

`python3 verify.py` runs every check and prints the live count; nothing else
states one. What it checks, in outline: referential integrity across every
foreign-key relationship; every season <!-- fig:season_span -->1950–2027<!-- /fig -->
present with a champion; constructors' champions only from 1958; driver and
constructor title counts cross-tabulated against the seasons table (and
`title_years` strings checked year by year against it); margins recomputed;
standings positions contiguous and points monotonic; driver and constructor
points totals reconciled against each other; race-winner tallies summed
against round counts; the current grid checked for unique car numbers; and
timeline sanity — nobody dying before they were born, no career running
backwards, nobody starting a Grand Prix aged 15.

The race harvest adds its own layer: race count per season reconciled against
the independently recorded round count for all
<!-- fig:seasons -->78<!-- /fig --> seasons; rounds contiguous with no
duplicates; every winner and constructor resolving to a known id; the only
constructor-less races being the <!-- fig:indy -->11<!-- /fig --> Indianapolis
500s; and — the strongest check in the file — **every driver and constructor
win total in the database equal to the number of races they are actually
recorded as winning.** That check is what caught all three data errors listed
above.

Poles and fastest laps get the same discipline: a pole recorded for every run
race; the only race without a fastest lap being the one where none was set;
every credit resolving to both a driver and a race; no driver credited twice
for the same race; shared fastest laps recorded as shared; every driver's
wins, poles and fastest laps equalling the race records exactly; no
external-vs-derived difference that is not declared; and the headline career
records asserted against their known official figures.

The full classification, the registers, the chassis linkage, the images, the
geometry and the licence position each have a section of their own;
`python3 verify.py --list` names them, and `--only` runs one while you work on
it. The last section checks this file: every figure above is recomputed from
the database and the build fails if the text disagrees.
