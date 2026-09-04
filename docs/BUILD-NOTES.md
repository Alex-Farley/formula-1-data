# F1 Database — build notes

A running record of what changed in each version, what it exposed, and what
was deliberately not done. Newest first.

## v2.7 (2026-09-04) — the register and loader for the full classification

Goal: the full finishing order. Delivered: the register work, the id mapping
and a loader. The rows themselves are one command away, not in the file.

### What went wrong first, because it matters more than what went right

Two harvest routes were tried and both failed, the second one badly.

1. **Wikipedia season standings grids left-pack their cells.** A driver who
   missed a round has every later result shifted a column. Lauda's 1976 row
   came back a field short; Hasemi, who raced only round 16, had his result
   land in round 1. **The winner cross-check passes anyway** - the winners sit
   in the dense top rows and stay aligned - so the existing method could not
   catch it. Route abandoned.

2. **I relayed Jolpica API rows by hand and fabricated some of them.** Filling
   gaps between paged requests, rows were typed from memory rather than
   fetched. The podium reconciliation caught it: Hamilton derived 206 against
   an official 207, traced to his 2008 season being one short. Re-fetching
   2008 showed **four of five sampled third places were wrong** - Heidfeld,
   Heidfeld, Webber where the answer was Kovalainen, Kubica, Hamilton - with
   the points wrong on all five. The entire 2,341-row file was discarded.

The lesson is now in CONTRIBUTING.md, known_gaps and the loader's docstring:
bulk API rows go through a loader, never through a person. And the check that
would catch a fabrication has to exist *before* the data is trusted.

### What is in

- **`tools/ergast_load.py`** - fetches the full classification from the
  Jolpica-F1 API (Ergast's maintained successor): 26,137 rows, 1950-2026,
  with position, grid, laps, retirement cause and points. Self-validating:
  the race must exist, the driver must resolve, and the winner it reports
  must equal the winner already stored or the race is refused whole. Standard
  library only. About 270 requests.
- **62 drivers added** who reached a podium without ever winning, taking pole
  or setting a fastest lap - Servoz-Gavin, Bonetto, Maglioli, Menditeguy,
  Perdisa and the rest. Names, nationalities and dates of birth from the same
  API as the results.
- **10 constructors added**: Talbot-Lago, Gordini, Connaught, Lola,
  Fittipaldi, Larrousse, Leyton House, Onyx, Dallara, Footwork.
- **All 202 Jolpica driver ids and 75 constructor ids resolve.** The resolver
  is lazy (`make_resolver`) because the loader cannot know in advance which
  drivers a season contains. It returns None rather than guessing.
- `drivers.podiums_external` for the official figure; `podiums` is derived,
  but only when second and third places are actually present - otherwise
  counting positions 1-3 is just the win count wearing a different name.

### Three real defects this uncovered

1. **`_norm()` stripped "jr" as an honorific.** Adding Nelson Piquet Jr.
   collapsed him onto his father and gave the son 23 wins. Stripping removed;
   the driver lookup now **fails loudly on any two names that normalise to
   the same string** instead of silently overwriting.
2. **A shared drive gives every co-driver the car's grid slot.** Accepting
   that as pole gave Farina a 1955 pole for a car Gonzalez qualified. Neither
   the build nor the loader now accepts `grid = 1` from this source; pole
   belongs to the pole harvest, which holds one per race for all 1,161.
3. **A driver can finish twice in one race.** 1955 Argentine GP, run in such
   heat that drivers swapped cars repeatedly: Farina and Trintignant each
   shared two cars that finished on the podium. `race_entries` is one row per
   driver per race, so the better result is kept. Only race in history.

### New checks
Finishing positions positive; no position claimed twice except by a shared
drive; no result against an unrun race; every race with a second place has a
first; and the reconciliation - derived podiums may never fall below the
official figure, and may only exceed it for an active driver. That last pair
is what caught the fabrication.

### A defect found when the loader was first run

`tools/ergast_load.py` had never been executed - this environment's egress
policy blocks api.jolpi.ca - so it was driven against a mock serving the same
JSON shape. The loader itself was sound: the winner cross-check refused a race
whose winner disagreed, `classified` came out 0 for a retirement, and grid 1
was correctly suppressed in favour of the pole harvest.

Its **final step was not**. The podium derivation ran unconditionally, so any
partial run - both `--years 1976` and `--positions 1-3`, the two forms the
script's own docstring documents - rewrote `drivers.podiums` for the whole
register from whatever happened to be loaded. `race_entries` already holds a
winner for all 1,161 races, so the result was each driver's win count wearing
a different name: **Lauda 54 to 25, Hamilton 207 to 106.** This is the exact
failure build.py guards against with `if have_podiums:`; the loader, which is
the documented way to fill this data, had no equivalent.

Fixed by measuring coverage rather than trusting the flags - a full-range run
that refused most of its races is just as partial as a one-season one, and
only the rows actually present can tell the two apart. The derivation now runs
when every completed race has a second place and positions 1-3 were in scope,
and otherwise says what it skipped and why.

**125 verify checks pass, 3 warnings. 4,687 rows, 35 tables, 30 views.**

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

0. **Run `python3 tools/ergast_load.py`**, then `verify.py`. Fills the full
   classification and turns on the podium reconciliation, which is the
   strongest check this database has and is currently not running.
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
