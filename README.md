# F1 Verified Facts Database — v2.12

An expansion of the original single-file JSON into a normalised, queryable
SQLite database covering 1950–2026, with the JSON kept as a generated export.

**v2.1** added every championship race result from 1950 to 2026 — 1,161 races —
harvested from Wikipedia's season tables under a new `reference` confidence tier.

**v2.2** added pole position and fastest lap for every race from 1950 to 2024.

**v2.4** is a structural release, not a data one. A per-entry race model
replaces the per-race one, every Grand Prix now has a canonical id, and
`audit.py` reports on the shape of the database rather than its contents.
See *Structure* below.

**v2.12** closes the **constructor register**: 65 rows to 150. Eighty-five
teams that entered a championship Grand Prix had no row here — Ensign started
133 races, Osella 172. Adding them exposed a defect nothing could previously
see, an entry credited to a constructor that was not racing that season, and
the new check found five teams that were really two: Alfa Romeo, ATS,
Williams, Wolf and Aston Martin. See *Cars and chassis* and the build notes.

**v2.11** adds `--timing`, which loads **628,454 race laps back to 1996** and
12,627 pit stops from 2011 out of the same dump — twenty-two seasons further
back than FastF1 reaches. The two sources can now hold the same race side by
side and be compared. The lap times re-derive each race's fastest lap, and it
matches the setter already stored from the pole harvest on **all 446 races**
where both exist. `./f1 laps` shows the coverage.

**v2.10** adds `tools/ergast_load.py --from-dump`, which loads the full
classification from Jolpica's hash-verified database dump rather than ~270
paged API requests. Not for speed: a dump is one consistent snapshot that can
be **pinned and reproduced**, and `--verify-dump` diffs it against the API
race by race to keep it honest. Both paths produce identical rows.

**v2.9** resolves the chassis **per round** rather than per season, using the
driver round-ranges inside F1DB's entry lists: chassis coverage 34% to 76%,
and the constructor — which the pole harvest never recorded — from 48% to
99%. That last figure is what lets a pole be attributed to a car at all, and
**nine cars now match their published career pole total exactly**, where
before none could be checked for more than not exceeding it. The first check
to run on it failed, correctly: McLaren ran the M23 and the M26 through
1976-77, so the blanket season claim had been giving the M23 sixteen poles
against a published fourteen. It also records the first live run of
`tools/ergast_load.py`, which works — and which was writing Wilson
Fittipaldi's Brabham results onto Emerson Fittipaldi until the constructor
reconciliation caught it. See *The finishing order* and *Cars and chassis*.

**v2.8** adds the **chassis register**: every chassis that has raced — 1,153
of them — with the engines, the per-season entry lists, and whatever
specification could be established from each car's own article. The entry
lists are the second, constraining source the abandoned chassis harvest was
missing, and the winning chassis is now known for 819 of 1,161 races. It also
adds `regulation_limits`, because most "weight" published for a modern car is
that season's regulation minimum and not a measurement of anything — a test
that found four such figures already sitting in the curated data. See *Cars
and chassis* below.

**v2.7** adds the **register and the loader for the full race
classification** — 62 podium-scoring drivers and 10 constructors that earlier
harvests never saw, the id mapping to the Jolpica-F1 API, and
`tools/ergast_load.py`, which fills every classified finisher, retirement
cause and grid position for 1950–2026. See *The finishing order* below, and
read it before touching that data by hand.

**v2.6** adds the **cars**: a register of 29 landmark chassis with full
technical specifications and design histories, linked to the races they won,
plus the schema and loader for per-lap timing, tyre stints, pit stops, race
control and team radio. See *Cars* and *Timing, telemetry and radio* below.

**v2.5** gives **every race a circuit**. The venue of all 1,161 championship
races was harvested from the same season tables and cross-checked three ways,
taking circuit coverage from 31% to 100%. Circuit configuration history became
a first-class, checked structure rather than a scattering of notes. See
*Venues* below.

**v2.3** closed pole and fastest lap to **every race, 1950 to 2026** — 1,161 poles and 1,160
fastest laps, the single exception being a race where none was set. Career wins,
poles and fastest laps are now **derived from the race records** rather than
hand-entered, and the externally sourced figures are kept alongside them for
comparison. Every headline record in the database now matches the official
figure exactly.

```bash
git clone <your-repo-url> && cd f1db
make all          # rebuild, verify, export — no dependencies
./f1              # list the query commands
./f1 car mp4/4
./f1 chassis lotus
```

Built 2026-09-05. Current 2026 data verified against formula1.com on
2026-09-04 (after round 12, Zandvoort). The chassis register is F1DB
v2026.12.0.

---

## Files

| File | What it is |
|---|---|
| `f1.db` | The SQLite database. 39 tables, 34 views, ~8,400 rows. This is the artefact. |
| `f1` | Command-line query tool. `./f1` with no arguments prints the commands. |
| `f1_database.json` | Full JSON export of every table. |
| `f1_compat.json` | JSON in the *original* v1 key layout, so anything already consuming that file keeps working. |
| `schema.sql` | The schema, commented. |
| `build.py` | Rebuilds `f1.db` from the data modules. Idempotent. |
| `verify.py` | 147 integrity, cross-tabulation and sanity checks. Exit code 1 on failure. |
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
| `harvest/car_specs.txt` | Chassis specifications off the per-car articles. **Generated** by `tools/wikispec_fetch.py`. |
| `harvest/car_specs.log` | Every chassis that was refused, and the reason. **Generated.** |
| `tools/f1db_fetch.py` | Pulls the chassis, engine, constructor and entrant register from F1DB (CC BY 4.0) into the four generated harvest files. Needs network; not part of the build. |
| `tools/wikispec_fetch.py` | Harvests chassis specifications from the `{{Racing car}}` infobox on each car's article, refusing any page that disagrees with the register. Needs network; not part of the build. |
| `tools/ergast_load.py` | Loads the full race classification — every finisher, retirement, grid position and per-race points, 1950–2026 — from the Jolpica-F1 API. Needs network; not part of the build. |
| `tools/fastf1_load.py` | Loads per-lap timing, stints, pit stops, race control, radio and the 2018– finishing order from the F1 live timing API. Needs network; not part of the build. |
| `docs/BUILD-NOTES.md` | What changed in each version, what it exposed, what was deliberately not done. |
| `CONTRIBUTING.md` | How to add data without breaking the checks. Read before editing. |
| `ATTRIBUTION.md` | Where the data came from, and the licensing that follows from it. **Read before making this public.** |
| `Makefile` | `make all` = build, verify, export. |
| `requirements.txt` | Empty for the database itself; `fastf1` only for the loader. |

Workflow for any change: edit `data/*.py` → `python3 build.py` → `python3 verify.py`
→ `python3 export_json.py --compat`. Or `make all`.

**No dependencies.** Everything except `tools/fastf1_load.py` is Python 3.9+
standard library.

---

## What's in it

**Championship history** — all 77 seasons 1950–2026: champion, points, wins,
runner-up, margin, constructors' champion, engine formula, tyre suppliers and a
paragraph of context on each.

**Every race** — 1,161 championship Grands Prix from Silverstone 1950 to
Zandvoort 2026, each with pole position, fastest lap, winner, constructor and
entrant. The one race without a fastest lap is the 2021 Belgian Grand Prix,
where none was set: two laps behind the safety car, half points, no racing lap
completed. Shared drives carry both
drivers. The eleven Indianapolis 500s that counted towards the championship
(1950–60) are included and flagged, with no constructor attributed, because
their chassis were never Formula One constructors.

**Drivers** — 244 rows: **every driver ever to win a championship race, take a
pole, set a fastest lap, or finish on a podium**, 1950 to 2026, plus every
World Champion with full
career figures and the complete 2026 entry list. Chris Amon, Nick Heidfeld and
Andrea de Cesaris are here on their poles and fastest laps alone.

Their wins, poles and fastest laps are **computed from the race records**, so
they are internally consistent by construction and cannot drift. The figures
that were hand-entered or checked against an external source are preserved in
the `*_external` columns so the two can always be compared.

**Constructors** — 55 rows, plus a `constructor_lineage` table that tracks the ten
continuous racing operations through their name changes. Enstone is Toleman →
Benetton → Renault → Lotus → Renault → Alpine; Brackley is Tyrrell → BAR → Honda →
Brawn → Mercedes. This is the thing most F1 databases get wrong.

**Circuits** — 80 circuits, from Bremgarten and Pescara to the Madring. Every
race is linked to one, and thirteen of them carry a complete, checked timeline
of the configurations actually raced.

**Cars** — 29 landmark chassis from the Alfetta to the RB19, each with engine,
chassis, gearbox, suspension, weight and dimensions where published, plus what
the car introduced and what it actually achieved. Linked to the races they won,
so the win counts are derived rather than asserted.

**Technical and regulatory** — 58 regulation changes by year and category, 26
landmark innovations (with the year each was banned, where it was), 11 engine
eras, 26 safety milestones, tyre suppliers, every points system, and 10 defined
eras of the sport.

**Also** — 32 non-driving figures (designers, principals, officials), 30 records,
44 glossary terms, 18 governance milestones, race winners for 2025–26, and both
seasons' standings.

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

-- Cars whose derived win count is a lower bound (seasons not fully linked)
SELECT id, wins, from_year, to_year FROM cars WHERE races > 0;
```

---

## Structure

The core is two tables:

```
races          one row per championship event
race_entries   one row per driver per race
```

Every per-driver fact about a race is an attribute of an **entry**: pole is
`grid = 1`, a win is `finish_position = 1`, a fastest lap is a flag. Wins,
poles and fastest laps per driver are derived from this at build time, so they
cannot drift from the races they come from.

Until v2.4 those three facts were columns on the *race* row plus a separate
credits table. That meant a shared win and a shared fastest lap were modelled
two different ways, and neither could extend to a full finishing order without
changing shape again. The restructure was done before adding finishing order
rather than after, so the harvest lands in a shape that does not have to move.

`race_results`, `race_credits` and `calendar` still exist as **views** over the
new tables, so anything written against the old schema keeps working.

### What the restructure fixed

Running the audit against v2.3 found real defects, not cosmetic ones:

- **The same event existed twice.** `gp_name` was free text, so "Emilia Romagna
  Grand Prix" and "Emilia-Romagna Grand Prix" were different races. There is now
  a canonical register of 53 Grands Prix; every race carries a `gp_id`, and the
  name it raced under is kept separately for display. All 56 name strings in the
  data resolve, and `verify.py` fails if one does not.
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
order. `race_entries` already has the identity and position columns; the four
that a full order needs — `classified`, `status`, `laps_completed`, `points` —
are declared and empty. Adding the rest of the field is pure INSERT: no table,
column, key or view has to change.

---

## Venues

Before v2.5 a race was linked to a circuit only when the event had used exactly
one venue in its whole history — 365 of 1,172 races, 31%. Events that moved
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

All 1,161 rows passed all three. Eighty-six distinct venue strings resolved to
80 circuits with none left over.

### Configurations

A circuit's length and corner count describe its *current* shape. Quoting those
against a 1976 race is wrong — Silverstone in 1976 was 4.719 km, not today's
5.891 km. `circuit_layouts` holds the configurations, and where a circuit
appears there at all, the rows now form a **complete, non-overlapping timeline**
of what was actually raced. `verify.py` enforces both properties, so a layout
cannot be added that leaves a season uncovered or claims one twice. Thirteen
circuits have that timeline; 483 races (41%) therefore report the layout as
raced, and `v_race_venues.figures` says of every row whether it is `as raced` or
a fallback to `current layout`. The rest is a declared gap, not silence.

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

**`cars` is a curated set of 29.** A car in that table is a *design family*:
the Lotus 79 raced in 1978 and 1979 and is one row; the Ferrari 312T through
312T5 is one row, because that is how the results were published and how the
reference pages treat it. Each carries engine, chassis construction, gearbox,
suspension, brakes, weight and dimensions as published, plus three things a
spec sheet does not — the **concept** in one line, what the car
**introduced**, and what it actually **achieved**.

**`chassis` is the register: 1,153 rows, every chassis that has raced.** It is
loaded from [F1DB](https://github.com/f1db/f1db) (CC BY 4.0) by
`tools/f1db_fetch.py` — a scale at which nobody types anything — and 779 of
them carry a specification `tools/wikispec_fetch.py` established off that
chassis's own Wikipedia article. `chassis.car_id` joins the two.

132 of those articles publish a career win total. The wins this database
derives independently, from its own race records through the linkage below,
**agree exactly for 97 of them and exceed for none**.

Where both layers hold the same figure the build **compares them instead of
picking one**: a value derived twice by different routes is the strongest
evidence this database has, and a disagreement goes to `discrepancies`.

```
./f1 cars                # the 29 curated designs
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
3. the **title** must be a form of the chassis's own name — Wikipedia
   documents families on one page, so "Lotus 72C" legitimately redirects to
   "Lotus 72", but a namesake is refused. Searching for "Ferrari 312/66"
   offers "Ferrari 312T" first, and that is not a form of the same name.

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
two cars in one year.

The claim is **checked rather than trusted**. `EXPECTED` holds each car's
published career wins and poles; the build derives the same two figures from
the race records, and `verify.py` fails if any car has *more* wins than its
published total, or if a car whose seasons are all linked does not match
*exactly*. Eleven cars are fully linked and all eleven match to the race —
MP4/4 on 15, F2004 on 15, RB19 on 21, 312T on 27. That found a real error:
Vanwall's figure had been entered as 6, the 1958 season total, not the career 9.

Since v2.8 the same thing is done at chassis resolution, from a second source.
F1DB's per-season entry lists record which chassis a constructor ran in a
season — the constraint the abandoned chassis harvest was missing, because the
race winner tells you which race a row describes and nothing whatever about
what he drove. The winning chassis is now known for **819 of 1,161 races**.

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
| 1950s | 21% |
| 1960s | 4% |
| 1970s | 11% |
| 1980s | 35% |
| 1990s | 42% |
| 2000s | 41% |
| 2010s | 47% |
| 2020s | 49% |

A modern team runs one car all season and the entry list settles it. A 1960s
"constructor" was a name several privateers entered several different chassis
under, and the season settles nothing. `./f1 ambiguous` lists all 321
unresolvable constructor-seasons; the remaining work is in `known_gaps`.

Poles are a lower bound by construction and are only checked for *not
exceeding* the published figure: the pole harvest recorded who took pole but
not what they drove, so 655 of 1,161 pole entries carry no constructor.

---

## Timing, telemetry and radio

Being blunt about what exists, because most of what people imagine is
available is not.

**Formula 1 publishes per-lap data from 2018 and nothing before it.** Lap
times, sector times, speed traps, tyre compound and age, stint boundaries, pit
in/out, track status and race control messages all come off the live timing
API and all start in 2018. There is no lap-by-lap record of the 1988 season in
any retrievable form, and there is no prospect of one.

**Team radio is published as audio, not text.** There are no official
transcripts. F1 puts the clips on the same API, also from 2018.

**Car telemetry — speed, throttle, brake, gear, RPM, DRS — exists from 2018**,
at about 4 Hz plus position at 10 Hz. It is hundreds of megabytes per race
weekend. It does not belong in a 1.5 MB SQLite file and it is not in one.

So the split is:

| Table | Covers | Filled by |
|---|---|---|
| `race_timing` | pole / fastest lap / race time per race | empty — see `known_gaps` |
| `laps` | per-lap timing, sectors, tyres, track status | `tools/fastf1_load.py`, 2018– |
| `stints` | tyre stints | same |
| `pit_stops` | pit lane times | same |
| `race_control_messages` | flags, safety cars, penalties, deleted laps | same |
| `team_radio` | clip index and optional transcripts | same, plus 6 curated |

`tools/fastf1_load.py` reads the live timing API through FastF1. It is a
**separate script, not part of the build**, because the build is offline and
this data is not. It is written against FastF1 3.8 and every column it reads
was checked against that library's actual schema, but it has **not been run
against live data from here** — this environment has no network access to that
API. Treat the first run as the test.

```bash
pip install fastf1
python3 tools/fastf1_load.py --years 2018-2026 --results --radio
```

`--results` also fills the **full classified finishing order** for 2018–2026
into `race_entries` — position, grid, status, laps, points — which is the
largest outstanding gap in this database, for the seasons where it can be had
automatically. It is self-validating in the same way as every other loader
here: if the winner FastF1 reports is not the winner already stored, the race
is refused rather than half-written.

Car telemetry can be dumped alongside with `--telemetry-parquet DIR`, which
writes Parquet files next to the database rather than into it.

**`build.py` drops and rebuilds `f1.db` from scratch**, so anything the loader
put there is destroyed by the next build. Keep the FastF1 cache — that is the
expensive part — and re-run the loader after a rebuild.

### Notable radio

Six exchanges are held as text with `notable = 1`, transcribed from broadcast
and each checked against a written source: Smedley's "Fernando is faster than
you", Horner's "This is silly, Seb", Alonso's "GP2 engine", and the three-way
Wolff / Horner / Masi exchange that decided the 2021 championship. The set is
small deliberately — an exchange only belongs there if the exact words can be
cited rather than remembered, and several famous ones are missing for exactly
that reason.

---

---

## The finishing order

`race_entries` holds about **2.1 rows per race**: the winner, the pole-sitter
and the fastest-lap setter. A real field is 15 to 22. That one number is why
there are no podium counts, no retirements, no per-race points and no grid
positions beyond pole — they are all the same gap wearing different hats.

The data exists. **26,137 rows covering 1950–2026** sit behind the
[Jolpica-F1 API](https://api.jolpi.ca), the maintained successor to Ergast,
with position, grid, laps, retirement cause and points for every entry.
`tools/ergast_load.py` fetches and loads them:

```bash
python3 tools/ergast_load.py            # about 270 requests, a few minutes
python3 verify.py
```

It is self-validating in the same way as everything else here: the race must
already exist, the driver must already resolve to a register entry, and **the
winner it reports must equal the winner already stored or the race is refused
outright** rather than half-written.

v2.7 does the part that cannot be automated — the register and the mapping:

- **62 drivers added** who reached a podium without ever winning a race,
  taking pole or setting a fastest lap, so no earlier harvest had a reason to
  create them. Names, nationalities and dates of birth come from the same API
  as the results, so a result can never reference a driver this database had
  to invent.
- **10 constructors added** — Talbot-Lago, Gordini, Connaught, Lola,
  Fittipaldi, Larrousse, Leyton House, Onyx, Dallara, Footwork.
- **All 202 Jolpica driver ids and all 75 constructor ids resolve**, including
  the ones surname matching cannot: Graham vs Phil vs Damon Hill, Keke vs
  Nico Rosberg, Jacques vs Gilles Villeneuve, Jim vs Dick Rathmann.
- Indianapolis chassis builders (Kurtis Kraft, Kuzma, Deidt and the rest) map
  to no constructor at all, because the Indy 500 entries of 1950–60 were not
  Formula One constructors. That is the same rule the race harvest already
  applied to the Indy winners.

### Why there is a script and not a harvest file

An earlier attempt at this filled `harvest/podiums.txt` by relaying API
responses by hand. The podium reconciliation caught it: Hamilton came out at
206 podiums against an official 207, and tracing that one row back showed
**four of five sampled 2008 third places were fabricated** — Heidfeld,
Heidfeld, Webber where the answer was Kovalainen, Kubica, Hamilton. The whole
file was discarded.

The lesson is in `CONTRIBUTING.md` and in `known_gaps`: thousands of rows
cannot be moved by hand, and the check that catches it must exist before the
data is trusted, not after.

### Two things the load will surface

Both were found while building it, and both are handled:

- **A shared drive gives every co-driver the car's grid slot.** Accepting
  that as pole gave Farina a 1955 pole for a car González had qualified, so
  neither the loader nor the build accepts `grid = 1` from this source. Pole
  belongs to the pole harvest, which holds one per race for all 1,161.
- **A driver can finish twice in one race.** At the 1955 Argentine Grand
  Prix, run in such heat that drivers swapped cars repeatedly, Farina and
  Trintignant each shared two cars that finished on the podium.
  `race_entries` is one row per driver per race and cannot hold both, so the
  better result is kept. It is the only race in history where this happens.

### A latent bug this uncovered

`_norm()`, the name matcher, stripped `"jr"` as an honorific. Adding Nelson
Piquet Jr. therefore collapsed him onto his father and handed the son 23
wins. The stripping is gone, and the driver lookup now **fails loudly on any
two names that normalise to the same string** instead of letting one silently
overwrite the other.

## The confidence model

Your v1 policy was "official sources only, never invent". That's the right
instinct but it caps the database at whatever can be fetched in a session. So
every fact table now carries a `confidence` column instead:

| Level | Meaning | Safe to publish? |
|---|---|---|
| `verified` | Checked against fia.com or formula1.com during construction | Yes, with citation |
| `high` | Long-established record, consistently published officially for decades | Yes |
| `reference` | Harvested from Wikipedia's season results tables, cross-checked on load | Yes, but cite the FIA/F1 archive |
| `medium` | Correct in substance; an exact figure or date may have drifted or moves with the season | Confirm first |
| `unverified` | Placeholder or disputed | No |

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
All 1,125 matched, which is strong evidence that the pole and fastest-lap values
in those same rows are sound. Reconciling the derived pole counts against the
hand-entered career totals then found two more errors, both in 2012:

- **2012 Spanish Grand Prix.** Recorded Hamilton on pole. Hamilton set the fastest
  qualifying time but was excluded for a fuel infringement, and Pastor Maldonado
  inherited pole. Confirmed and corrected.
- **2012 European Grand Prix.** Recorded Alonso on pole; it was Vettel.

Neither was guesswork. Four independent career totals — Hamilton's 104, Vettel's
57, Alonso's 22 and Maldonado's 1 — reconcile exactly under those two corrections
and under no other combination. Both were then confirmed against the race
articles before being applied. Poles now reconcile **exactly** for every retired
driver in the database.

The v1 rule survives intact: **nothing is promoted to `verified` without an
official source.** `./f1 unverified` lists the rows currently sitting at
`medium` — that's your work queue, and every one of them can be promoted by
fetching the relevant official page and editing the source module.

### Derived figures, and what happens when sources disagree

Because the race records now cover every championship race, career wins, poles
and fastest laps are **computed from them**. That makes those three fields
self-consistent by construction, always current, and impossible to drift. The
previously hand-entered or externally checked values are kept in
`wins_external`, `poles_external` and `fastest_laps_external`.

The two are compared on every build. Across the **234 drivers that hold an
official figure — 391 comparisons — there are 5 live differences**, and every
one is accounted for. Two more were errors in the external figure, found the
same way and since corrected, which is why they no longer appear as
differences:

- **2 were errors in the external figure, now corrected.** John Surtees's
  fastest laps were entered as 11; the reference record says 10, matching the
  race data. George Russell's poles came back as 12 from a formula1.com fetch
  that also returned internally inconsistent 2026 figures; Wikipedia's infobox
  independently gives 11 poles and 7 wins, both matching the derived counts.
- **3 are staleness, not error.** Hamilton, Verstappen and Norris have added
  fastest laps since their external figure's as-of date.
- **2 remain genuinely open.** Jack Brabham and Phil Hill are each credited with
  one more fastest lap than the race records contain. Every race of their careers
  now has a fastest lap recorded, so the missing one must be a race they shared
  and where the season table prints only one name. That is a hypothesis, not a
  fact, so it is recorded as *open — needs official check* rather than resolved.

**Where two sources disagree and neither can be checked against an official
source, the disagreement is itself the fact worth storing.** `./f1 gaps` prints
the corrections and the open items. `verify.py` fails the build on any
difference that is not declared.

As a further guard, `verify.py` asserts ten headline career records against their
known official figures — Hamilton 106/104/69, Schumacher 91/68/77, Senna
41/65/19, Fangio 24/29/23 and so on. All ten match.

Current distribution: seasons 75 high / 2 verified; constructors 38 high /
25 medium / 2 verified; race results 1,125 reference / 36 verified; 2,332 pole
and fastest-lap credits, all reference.

---

## What it deliberately doesn't have

Being straight about the gaps, because a database that hides them is worse than
one that doesn't:

These are also in the database, as the `known_gaps` table — so they can be
queried, not just read here. `./f1 gaps` prints them with the fix for each.

- **Full finishing order.** Only the winner is recorded per race, not the points
  scorers behind them. This is now much the largest remaining expansion, and it
  would also make podium counts checkable the same way wins, poles and fastest
  laps now are.
- **The full driver register.** Roughly 780 people have started a championship
  Grand Prix; 244 are here. Everyone who ever won a race, took a pole, set a
  fastest lap or finished on a podium is now included, so what remains is the
  tail who did none of those.
- **Lap times, grid positions, retirements, qualifying.** Not held at all.
- **Podiums and career points** remain hand-entered. Wins, poles and fastest laps
  are now derived and self-consistent; podiums are not.
- **Sprint results.** The sprint races from 2021 onwards are not held as results,
  only as a format note on the calendar.
- **Circuit configuration for most venues.** Thirteen circuits have a complete
  configuration timeline. Everywhere else a race carries the circuit's current
  length and corner count, which for Kyalami or Zandvoort is not what was raced.
  `v_race_venues.figures` labels every row `as raced` or `current layout`, so the
  fallback is visible rather than silently wrong.
- **Historical standings and entry lists.** `standings` and `season_entries`
  cover 2025–26 only. Champions and runners-up for every season are held on
  `seasons`, but the full points table for, say, 1982 is not.

- **Most cars.** The register holds 29 landmark chassis, not the several
  hundred that have started a Grand Prix. 262 of 2,424 race entries carry a
  car; the rest do not, and the schema is honest about it rather than guessing.
- **Lap-by-lap anything before 2018.** Not a gap that can be filled — it was
  never recorded in a form anyone can retrieve. See *Timing, telemetry and
  radio* above.

The `known_gaps` table holds six entries and `./f1 gaps` prints them with the
fix for each. One is not a gap in the usual sense: the 2021 Belgian Grand Prix
has no fastest lap because none was set. That is a true null, and it is
recorded as one.

---

## Verification

`python3 verify.py` runs 80+ checks and currently passes all of them:
referential integrity across ten foreign-key relationships; every season
1950–2026 present with a champion; constructors' champions only from 1958;
driver and constructor title counts cross-tabulated against the seasons table
(and `title_years` strings checked year by year against it); margins recomputed;
standings positions contiguous and points monotonic; driver and constructor
points totals reconciled against each other for both 2025 and 2026; race-winner
tallies summed against round counts; 2026 grid checked for 11 teams × 2 seats
with unique car numbers; and timeline sanity — nobody dying before they were
born, no career running backwards, nobody starting a Grand Prix aged 15.

The race harvest adds its own layer: race count per season reconciled against
the independently recorded round count for all 77 seasons; rounds contiguous
with no duplicates; every winner and constructor resolving to a known id; the
only constructor-less races being the eleven Indianapolis 500s; and — the
strongest check in the file — **every driver and constructor win total in the
database equal to the number of races they are actually recorded as winning.**
That check is what caught all three data errors listed above.

v2.2 and v2.3 add the same discipline to poles and fastest laps: a pole recorded
for all 1,161 races; the only race without a fastest lap being the one where
none was set; every credit resolving to both a driver and a race; no driver
credited twice for the same race; the primary pole always among that race's pole
credits; shared fastest laps recorded as shared; every driver's wins, poles and
fastest laps equalling the race records exactly; no external-vs-derived
difference that is not declared; and ten headline career records asserted
against their known official figures.

The race harvest adds its own layer: race count per season reconciled against
the independently recorded round count for all 77 seasons; rounds contiguous
with no duplicates; every winner and constructor resolving to a known id; the
only constructor-less races being the eleven Indianapolis 500s; and — the
strongest check in the file — **every driver and constructor win total in the
database equal to the number of races they are actually recorded as winning.**
That check is what caught all three data errors listed above.

v2.2 and v2.3 add the same discipline to poles and fastest laps: a pole recorded
for all 1,161 races; the only race without a fastest lap being the one where
none was set; every credit resolving to both a driver and a race; no driver
credited twice for the same race; the primary pole always among that race's pole
credits; shared fastest laps recorded as shared; every driver's wins, poles and
fastest laps equalling the race records exactly; no external-vs-derived
difference that is not declared; and ten headline career records asserted
against their known official figures.
