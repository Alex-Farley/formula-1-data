# F1 Database — build notes

A running record of what changed in each version, what it exposed, and what
was deliberately not done. Newest first.

## v2.6 (2026-09-04) — cars, and the timing/radio layer

Depth on car technical specifications, plus "any available telemetry".
Delivered: register + published specs + landmark deep dive; the timing schema;
a FastF1 loader; radio comms.

### Cars
`data/cars.py`, `cars` table, `race_entries.car_id`. **29 landmark chassis**,
Alfetta to RB19, each with engine (config/capacity/aspiration/power/revs),
chassis type, gearbox, suspension, brakes, weight, wheelbase, track - plus
`concept`, `innovations`, `story`, `outcome`. All researched from the cars'
own reference pages; spec NULLs mean "not established", never zero.

A car is a **chassis design, not a season** (Lotus 79 = one row for 1978-79).
Revised-and-renamed series (312T...312T5) are one row with variants in the
notes.

**The linkage, and how it proves itself** - this is the part worth keeping:

- `CAR_SEASONS` asserts per (car, year) that the constructor ran one chassis.
  Deliberately absent where a team ran two (Lotus 1970, Cooper 1960, Williams
  1982); those entries stay unlinked rather than guessed.
- `EXPECTED` holds each car's published career wins/poles.
- verify.py: derived wins may never EXCEED published; and where CAR_SEASONS
  covers every year of the car's life, derived must EQUAL published.
- **11 cars fully linked, all 11 match exactly** - MP4/4 15, F2004 15, RB19 21,
  312T 27, W05 16, FW14 17, R25 8, BGP001 8, RB6 9, W11 13, W196 9.
- It caught a real error during the build: Vanwall entered as 6 wins (the 1958
  season) when the career figure is 9. The derived figure was right.
- Poles are a lower bound only: 655 of 1,161 pole entries carry no
  constructor, because the v2.2 pole harvest recorded who but not what.

262 of 2,424 entries linked (11%).

### Timing / telemetry / radio
Schema for `race_timing`, `laps`, `stints`, `pit_stops`,
`race_control_messages`, `team_radio`. All empty in the distributed build.

**What actually exists:**

- F1 live timing publishes per-lap data **from 2018 only**. Nothing before, no
  prospect of any.
- Team radio is **audio, no transcripts**. Also 2018+.
- Car telemetry (speed/throttle/brake/gear ~4 Hz, position 10 Hz) exists 2018+
  but is hundreds of MB per weekend - deliberately NOT in the database; the
  loader writes it to Parquet alongside via `--telemetry-parquet`.

`tools/fastf1_load.py` - separate from the build because the build is offline
and this data is not. Written against FastF1 3.8; **every column verified
against the library's real `_COLUMNS` schema**, not assumed. Not run against
live data (the build environment has no network access to the API) - the first
run is the test. Notable finding: `Session.team_radio` does **not exist**;
radio comes from `fastf1.api.fetch_page(session.api_path, 'team_radio')`, with
audio URL = `api.base_url + api_path + capture['Path']`.

`--results` also fills the **full classified finishing order for 2018-2026**
into race_entries (position, grid, status, laps, points) - the biggest
outstanding gap, self-validating on the stored winner. `SessionResults` carries
it, which was not obvious.

`--transcribe` uses a **local** Whisper model only; nothing goes to a
third-party service.

**6 notable radio exchanges** curated as text, each verified verbatim against a
written source: Smedley/Massa 2010, Horner/Vettel 2013 (note: "Multi 21, Seb"
was the cool-down room, not radio - the radio line is "This is silly, Seb"),
Alonso "GP2 engine" 2015, and the Horner/Wolff/Masi three-way 2021. Kept small
on purpose: only exchanges whose exact words can be cited.

### The harvest that was refused
Winning-chassis-per-race harvest **abandoned, for two reasons**:

1. Wikipedia season articles went cache-only intermittently throughout.
2. More important: a trial fetch of 1952 returned "Ferrari 125 F2" for races
   Ascari won in a **Ferrari 500** - inferred, not read. **The winner
   cross-check does not catch a wrong chassis**, so the existing
   self-validating method is insufficient here. The harvested chassis must
   also be checked against that season's entry-list table before storage.

Do not resume this harvest without that second check. It is in `known_gaps`.

### New
Views: `v_cars`, `v_car_races`, `v_car_evolution`, `v_car_lineage`,
`v_lap_coverage`. CLI: `./f1 car <x>`, `./f1 cars [constructor]`,
`./f1 evolution`, `./f1 telemetry`. audit.py section 7.

**121 verify checks pass, 2 warnings. 4,614 rows, 35 tables, 30 views.**

---

## v2.5 - every race has a circuit

Coverage 31% -> 100%. `harvest/venues.txt`, 1,161 rows, 86 venue strings -> 80
circuits. Three checks on every row: winner cross-check, single-circuit-event
check, verified-2026-calendar check. All passed.

Exposed three things:

1. **Osterreichring and Magdalena Mixhuca existed twice** - as circuits AND as
   layouts. Rule now consistent: one row per site, reconfigurations as
   layouts; physically separate roads (Nordschleife vs GP-Strecke) stay
   separate.
2. **Sudschleife had a phantom race** - the 1960 German GP ran to F2 rules and
   was not a championship round.
3. **A year cannot always identify a layout** - Bahrain ran the GP circuit and
   the Outer circuit a fortnight apart in December 2020. Fixed with
   `circuit_layouts.by_year` + `races.layout_key` + `RACE_LAYOUTS`. Also fixed
   Monza (banking used 1955-56 and 1960-61, not 1957-59).

Layout timelines now enforced complete and non-overlapping where present.
13 circuits have one, covering 41% of races; `v_race_venues.figures` labels
every row `as raced` or `current layout`.

---

## v2.4 - structural review before the next expansion

Per-entry race model: `races` (one row per event) + `race_entries` (one per
driver). Pole = `grid=1`, win = `finish_position=1`, FL = flag. Career totals
derived at build. `race_results`/`race_credits`/`calendar` kept as views.

Defects the audit found: duplicate events from free-text `gp_name` (now a
canonical 53-GP register in `data/events.py`); Tyrrell lineage = `faenza-no`
placeholder (27 of 55 constructors pointed at non-existent chains);
`VERIFIED_STATS` silently dropped by an earlier edit; shared drives giving the
constructor zero wins (fixed with `COUNT(DISTINCT race_id)`); Italian GP
wrongly pinned to Monza (Imola hosted it in 1980); verify.py timing out at
3min+ (compat view 0.73s/scan x 237 iterations -> composite indexes -> 0.07s).

---

## v2.3 - pole/FL complete 1950-2026; career stats derived
1,161 poles, 1,160 fastest laps (2021 Belgium: a true null). 546 comparisons,
7 differences, all accounted for. Corrections: Surtees FL 11->10, Russell poles
12->11.

## v2.2 - pole and fastest lap 1950-2024
Driver register 133->181. Found the 2012 Spanish GP (Maldonado inherited pole
after Hamilton's fuel exclusion) and the 2012 European GP (Vettel, not Alonso)
by arithmetic across four career totals, then confirmed both.

## v2.1 - race harvest
1,161 races. Found the 1982 Brazilian GP (Prost, not Piquet - Piquet and
Rosberg were disqualified), the 1951 French shared drive, and Vukovich's two
Indy wins.

## v2.0 - relational rebuild
Single-file JSON -> normalised SQLite.
`data/*.py` -> `build.py` -> `verify.py` -> `audit.py` -> `export_json.py --compat`.

---

## The method

Harvest a structured table that includes a fact already known, reject any row
that disagrees, then reconcile the derived aggregates against independently
held totals. Every data error found in this project came out of one of those
two steps.

**v2.6 amendment:** the cross-checked fact must be one that actually
*constrains* the value being harvested. The winner constrains which race a row
describes. It does not constrain the chassis. Where the check does not
constrain the value, find a second table that does - or do not store the value.

Where two sources disagree and neither can be checked officially, record the
disagreement in `discrepancies` rather than picking one silently.

---

## Next, in order

1. **Run `tools/fastf1_load.py --years 2018-2026 --results --radio`** somewhere
   with network access. Fills the 2018-2026 finishing order, laps, stints, pit
   stops, race control and the radio index in one go. Untested against live
   data.
2. **Finishing order 1950-2017** - still manual; the schema is ready and
   adding it is pure INSERT.
3. **Chassis-per-race harvest** - only with the entry-list cross-check above.
4. Historical standings and season entries (currently 2025-26 only).
5. Configuration timelines for the remaining circuits (Kyalami, Zandvoort,
   Suzuka, Imola, Jerez, Estoril, Paul Ricard, Zolder, Brands Hatch, Buenos
   Aires).
6. Constructor on pole/FL entries, which would let car pole counts become
   exact rather than lower bounds.
7. Sprint results (2021- ); driver register tail (182 of ~780 starters); two
   open FL discrepancies (Brabham, Phil Hill).
