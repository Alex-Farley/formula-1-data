# F1 Database — build notes

A running record of what changed in each version, what it exposed, and what
was deliberately not done. Newest first.

## v2.22 (2026-09-11) — the final championship table gets a key and a view

`standings`' `UNIQUE` constraint was inert for 69% of its rows — SQLite
treats NULLs as distinct, and `after_round` is NULL on every end-of-season
row — so a duplicate final row was accepted, and the end-of-season rows were
never one per entity: 2026 carries a formula1.com row and an F1DB row for
every driver and team, while 2018 genuinely holds Force India twice.
`v_standings_final` folds the first kind and keeps the second, with the same
columns as the table, and an expression index pins the NULLs so the key means
something.

The compat export had shipped 333 rows for 23 drivers in every release since
v2.15 — the running table after every round — and CI certified it seven
times, because it checks reproducibility and not sense; the exporter now
reads the view and refuses a snapshot that lists an entity twice. The site's
pages and the CLI read the view too, and the ninety lines of JavaScript that
reconstructed it at read time are gone.

Comparing the official round-12 snapshot with F1DB's table after the same
round found nine entities the two sources score differently — Gasly 44
against 35, McLaren 263 against 265 — and each is now an open row in
`discrepancies`, shown on the driver's or team's page, rather than a choice
the view made silently. The index costs 1.5 MB in `f1.db` and 373 KB in the
gzipped download — a key has to live in the file to be enforced when a row is
written.

---

## v2.21 (2026-09-11) — pole position gets its own column

`race_entries.grid = 1` had carried two meanings — the car that started from
the front of the grid and the driver credited with pole — and they are not the
same fact: in 1996 France and 2021 Monaco the pole-sitter never started and
grid 1 stayed empty, and at the 2022 São Paulo Grand Prix the sprint winner
started first while pole stayed with the fastest qualifier, which the old rule
could only record as a row with `grid = 1` and `grid_text = '8'`. `pole` now
says who the season record credits, `grid` says where every car started, and
`qualifying` still says who was quickest. `race_results` and every derived
pole total read `pole`; the thirteen races where the credited pole-sitter was
not the fastest qualifier are pinned by `verify.py` as a convention rather
than recorded as disagreements, because neither source was wrong about the
thing it describes. The race page names the car that started first where it
is not the pole-sitter, and no longer asserts "after a grid penalty" for a
cause the database does not hold.

### The fastest-lap disagreements, closed

The four open rows were two shared fastest laps the season tables render as
one name: the 1960 Belgian Grand Prix article credits Brabham, Ireland and
Phil Hill jointly at 3:51.9, and the 1969 Canadian Grand Prix article credits
Brabham alongside Ickx at 1:18.1. Restoring both takes Phil Hill to the 6 and
Brabham to the 12 of the reference record. The 1970 South African row stays
open, because that article records that sources differ. `discrepancies` went
from eighteen open rows to one.

### Also

The build now pins the SQLite version stamp in each database's header, so the
committed artefacts no longer depend on which SQLite the builder linked: a
copy built on a Mac and one built in CI differed in exactly those four bytes,
and CI compares bytes.

---

## v2.20 (2026-09-09) — the Parquet export

Changes no fact in the database and publishes it in a new shape.
`tools/parquet_export.py` writes every table as Parquet — 41 files, 119,271
rows, 1.5 MB against 20 MB of SQLite — and the release carries them as
`f1-parquet.zip`. It includes `qualifying` and `pit_stops`, which the JSON
export leaves out because they take that file from 12 MB to 44 MB: JSON is a
convenience export where size is the problem, and Parquet is a bulk one where
size is the point. The release body now also documents the
`/releases/latest/download/` URLs, which stay valid as versions come and go.

The exporter is a tool rather than part of the build, so `git clone && make
all` still needs nothing but the standard library; pyarrow is installed only
in the release job. It refuses outright to run on a database carrying
FOM-owned timing or the ODbL centrelines, because Parquet exists to be handed
to somebody and neither may be.

### Every page gets an h1

The app rendered its title as an h2 and its sections as h3, so no page had a
top-level heading at all and somebody navigating by heading found no title
for the document they were on — while the prerendered HTML, which had it
right, disagreed with the app about the shape of the same page. Fixing that
moved the floor under every heading below it, and a review caught four that
had not moved with it: two pages were skipping a level. All eleven pages
checked now carry exactly one h1 and skip nothing.

---

## v2.19 (2026-09-09) — the race date, split in two

One column was answering two questions and doing one of them badly. `dates`
is for a reader and may be a RANGE — "27-29 Mar 2026" — since a Grand Prix is
a weekend, and for a race still to be run that is the more useful fact.
`date_iso` is the day the race itself was held, always `YYYY-MM-DD`, for
anything that has to compute.

v2.18 filled only the empties, which left the 23 hand-written ranges without
a machine-readable day — and those 23 are all races still to come, which is
exactly where a search engine wants a date. `startDate` now comes from
`date_iso` and reaches **all 1,172 races** rather than 1,149. The ranges are
untouched: the site still shows the weekend, and the ISO day is the Sunday
inside it. `verify.py` checks that where `dates` is itself an ISO day the two
columns name the same day — they may differ in shape, never in fact.

---

## v2.18 (2026-09-09) — every race gets a date, and the last fastest-lap gap closes

1,149 of 1,172 races had no date, and the reason was structural rather than
factual: F1DB publishes a date for every race back to Silverstone on 13 May
1950, but it lives in the round's own `race.yml`, and the results loader only
ever opened `race-results.yml` beside it. The file was there the whole time
and nothing read it. Every prerendered race page showed "Dates —", and the
`SportsEvent` JSON-LD could not emit `startDate`, which is the one field a
search engine most wants from an event. The 23 dates already held were
entered by hand and are left alone, because some express a range a single ISO
day cannot represent.

### Fastest lap, closed the way pole was in v2.16

`race_entries.fastest_lap` came only from the hand-written pole harvest while
everything else about a finished race refreshed from F1DB on a schedule, so
for a week after each Grand Prix a completed race carried every other field
and a blank fastest lap. F1DB now fills that vacancy and *only* that vacancy:
where the harvest already names someone it keeps the slot, and a disagreement
is recorded rather than resolved quietly. Two are — 1960 round 5 and 1970
round 1 — and both are open for somebody to look at. The one completed race
still without a fastest lap is 2021 Belgium, where no racing lap was ever set
behind the safety car: the true null the gap always excluded.

---

## v2.17 (2026-09-09) — release the geometry, and digest what is actually shipped

The release the previous four branches earned, and it exists because the
merge that brought them together left a gap none of them could see on its
own. The ODbL split moved every centreline out of `f1.db` into
`f1-geometry.db`; the release workflow was written on a branch that did not
know the split had happened. Between them they would have published a
database whose `circuit_geometry` is deliberately empty alongside no geometry
file at all — twenty-five centrelines reachable only by cloning the
repository. `SHA256SUMS` had the same shape of fault: it digested the
uncompressed `f1_database.json` while the release shipped the `.gz`, so the
one file a reader could not verify was the one they received. Both are fixed,
and the workflow now refuses a tag that disagrees with `VERSION` — the check
that would have caught a `v2.17` tag publishing artefacts reporting
themselves as 2.16, silently, because nothing downstream reads that field.

This release also carries the work of the merges themselves: 32 unit tests
and 35 front-end ones, prerendered HTML for all 2,385 routes,
machine-readable licence classes with build and verify guards, the FOM-owned
tables held empty, and one attribution rule for Commons images. See
`CLAUDE.md` for the conventions all of that depends on.

---

## v2.16 (2026-09-09) — the confidence tiers become traceable

Demotes 333 rows in doing it. `source_patterns` resolves every row's `source`
to a `source_registry` entry — 4,691 rows previously resolved to none,
because a registry `url` is one example page and not a namespace — and the
build now fails if one does not. `table_provenance` gives a source to the
fifteen tables that carry `confidence` and no `source` column. Most of those
turned out to be **authored**: written for this project from general
knowledge, with no external source and no check in `verify.py` that
constrains a value. They sat at `high`, which is `may_publish = 1` and
promises a citable official record that does not exist; eight sat at
`verified`, against this project's own rule that nothing reaches `verified`
without an official source. `authored` is now a named authority and
everything carrying it is capped at `medium` — the first confidence value
here that is *derived* rather than declared. `records` is the sharpest case:
nothing in `verify.py` reads that table at all, while the career records it
duplicates are checked on `drivers`. See `docs/DERIVED-CONFIDENCE.md`.

---

## v2.15 (2026-09-05) — the gap that was a licence

`race_entries` was 2,424 rows: the winner, the pole-sitter and the fastest-lap
setter of each race, about 2.1 rows against a real field of 15 to 22. It is
now **27,555 — every entry of every one of the 1,161 races**, in the
committed database, with **26,975 qualifying rows**, **34,495 standings rows**
and 22,472 pit stops beside it.

    race_entries               2,424 -> 27,555
    qualifying                     0 -> 26,975
    standings                     65 -> 34,495
    pit stops (committed)          0 -> 22,472
    podium reconciliation    untestable -> 6 of 7 exact, in the shipped build

`known_gaps` #1 called this a licensing decision for seven versions, and that
was true but incomplete. The rows came from Jolpica-F1, whose Ergast lineage
is CC BY-**NC**-SA, so they could be loaded onto your copy and never
committed. F1DB has the same facts under **CC BY 4.0** — attribution only, no
share-alike, no non-commercial clause — and F1DB was **already a source in
this project**, supplying the chassis, engine and entrant registers since
v2.9. Nothing had to be fetched from anywhere new. The gap was a reading of
one licence that survived because nobody looked at the other.

### What proves it

Four checks, all held here independently before F1DB was read:

1. **Every winner.** All 1,161 already stored from the Wikipedia harvest; a
   race whose winner disagreed is refused whole. None was. The comparison is
   on SETS — a shared drive puts two drivers on position 1 and both are
   winners, and taking "the" winner made 1956 Argentina and 1957 Britain look
   like disagreements when both sources said the same thing. That was my first
   reported result and it was wrong.
2. **76 seasons of champion and runner-up**, with both point totals, already
   in `seasons`. The final standings reproduce all four every year.
3. **Every pole-sitter.** Qualifying P1 is checked against it. 13 races differ
   and every one is a grid penalty or a sprint weekend.
4. **Jolpica, still loading.** `ergast_load.py` no longer writes over
   anything: it compares and records. 118 disagreements in 26,082 entries.

### Three things the model could not say

Each found by a check failing, not by reading the schema.

**A result is not always a number.** 8,769 DNFs, 1,041 DNQs, 338 DNPQs, 381
DNSs, 161 DSQs, 200 NCs. `position_text` keeps the source's vocabulary and
`finish_position` stays a clean integer. Collapsing them loses the late
1980s, when failing to pre-qualify was most of a small team's season.

**The constructors' championship is contested by a chassis-ENGINE pair.** The
1960 table is seven entries for five constructors: Cooper-Climax 48,
Cooper-Maserati 3, Cooper-Castellotti 3. Keying standings on the constructor
alone made 22 seasons look like source disagreements — I reported them as
such before checking, and every one was my own model collapsing two
championship entries into one.

**An entry can have points and no position.** Michael Schumacher scored 78 in
1997 and was EXCLUDED from the classification after Jerez. Stored as position
0 he sorted first, and the check comparing `seasons` to the standings duly
reported him as that year's champion.

### Two errors in the curated data

Both caught by the new cross-checks, both in rows that had been there for
versions:

- **1963 runner-up.** Recorded as Ginther. He and Graham Hill both finished on
  29 points; Hill takes it on countback and is the official runner-up.
- **Matra's first entry.** Recorded as 1967. The 1966 German Grand Prix
  classified Formula Two cars alongside the Formula One field, Matra entered
  four, and Beltoise finished eighth.

A third was a check that had been wrong rather than data: `no entry falls
outside its car's years` conflated a car's DESIGN life with its RACING life.
The Ferrari 500 is a 1952-53 works car that privateers entered until 1957.
The check now runs against the chassis register, which is the source that
knows when a chassis actually raced, and the 17 privateer entries are counted
rather than fatal.

### Also

- `tools/ergast_load.py` is now a **checker**. Where Jolpica disagrees with
  the stored value it writes a `discrepancies` row and leaves the data alone.
  The pattern in the 118: F1DB leaves a disqualified driver's position vacant,
  Jolpica promotes everyone below. The 1983 Brazilian Grand Prix has no second
  place in one reading and Lauda second in the other.
- `data/harvest.py: _read_named()` learned that a generated header can carry a
  trailing note after its last column — `entrants.txt` has done so since v2.9,
  and only positional readers had ever read it.
- f1.db is 20 MB, from 3.2. `build.py` now VACUUMs; the web app fetches the
  file whole and it gzips to about 5 MB. `f1_database.json` keeps
  `race_entries` and the end-of-season standings; qualifying, pit stops and
  the per-round standings are in f1.db and one query away.
- `verify.py` 158 -> 170 checks, in a new *The full classification* section.

## v2.14 (2026-09-05) — pictures, and the number that rejected one

Two additions that both point at things this repository does not contain, for
opposite reasons.

### Photographs: the one place with no cross-check

`article_images` records the lead image of 602 of the 645 accepted car
articles — file, licence, photographer, description page. **No image is
stored.** The pixels come from Wikimedia at render time and `f1.db` does not
grow by a byte.

I nearly did not do this, on the grounds that a photograph is not a fact with
a source. That was too broad. *"The article proved to describe this chassis
leads with this file, CC BY-SA 3.0 by Morio"* **is** a fact about Wikipedia,
and rerunning the harvest re-establishes it. The article was already
constrained — it passed the constructor, seasons and name checks in
`wikispec_fetch.py` — so these are not images found by searching for a car's
name, which is the inference that put an invented "Ferrari 125 F2" into the
abandoned 1952 harvest.

Three checks refuse a row, at harvest and again at build:

- **Commons only.** All 610 files on the measured run were `shared`, which
  makes the check look redundant. It is not: a file uploaded locally to
  en.wikipedia.org is local *because* it is non-free, and the lead image of an
  article is whatever an editor last put there.
- **A free licence**, matched against a list of prefixes rather than a pattern
  over "cc". `CC BY-NC` and `CC BY-ND` both start "CC BY" and neither is free
  enough to display.
- **An author to attribute.** Seven files name none and were refused; one more
  states no licence at all.

There is no blanket credit line. **Sixteen distinct licence strings** appear
across 602 rows — CC BY-SA at five versions, CC BY at four, CC0, public
domain, and national variants like `CC BY-SA 2.0 de`. Each row carries its
own, and the web smoke test asserts the caption renders with both author and
licence, because an image shown without its credit is not an ugly page, it is
an infringing one.

**What cannot be checked is whether the photograph shows the car.** Nothing
here constrains the content of an image and there is no second source to
disagree. Testing whether the file name mentions the chassis finds 265 of 602,
because most correct images are filed under the driver —
`File:Jos_Verstappen_2000_Monza_(cropped).jpg` really is an Arrows A21 — so as
a rule it would throw away half the good rows. It is stored as `name_matches`
and **enforced nowhere**. The failure it half-detects is real: the ATS D5
article leads with

    File:Grand_Prix_van_NL_op_circuit_van_Zandvoort_nr._10_,_11_officials_en_politie...

which is a photograph of officials and police. Every row is `unverified`, and
`./f1 images` lists the 337 for someone to look at.

### Centrelines: the check fired on the first circuit tried

`circuit_geometry` stores a circuit's shape as GeoJSON, traced from
OpenStreetMap, drawn as inline SVG with no tiles and no map library.

Overpass is unreachable from here — `overpass-api.de`, `overpass.kumi.systems`
and `overpass.private.coffee` all fail the same way — so a circuit is
addressed by **relation id** through the plain OSM API instead. That is the
better shape anyway: a bounding box returns whatever is inside a rectangle, a
relation id names one object. The ids come from Wikidata (P402), which is CC0.

Then the point of doing it here at all. A circuit relation is not an ordered
ring; its members include the pit lane:

    Monaco, OSM relation 148194
      all 42 member ways                   3.745 km   +12.2%
      excluding role=pit_lane (0.357 km)   3.388 km    +1.5%
      published, already in this database  3.337 km

A naive implementation stores 3.745 and is wrong by 408 metres, and **nothing
about that number looks wrong on its own**. `length_km` is the only thing that
says otherwise, and this database held it long before OSM was consulted. Rows
outside 2% are refused, not stored with a caveat. The measurement is then
re-run in `build.py` from the stored coordinates with its own copy of the
haversine — deliberately duplicated, because sharing the tool's arithmetic
would check nothing.

Two things stay absent on purpose. **Historic geometry does not exist
anywhere**: OSM maps what is on the ground, and Wikidata's historic-layout
entities — `Q66712049`, "Circuit de Monaco Grand Prix Circuit (1929-1972)" —
carry a length and a date range but no coordinates. So Spa's 14.1 km Ardennes
course and Monza's banking have no row rather than a modern shape standing in
for them, and `verify.py` fails the build if a trace is ever attached to a
layout whose timeline has closed. And **ODbL 1.0** — share-alike plus a
database right, a stronger obligation than anything else here — is confined to
this one table, so dropping it drops the obligation.

### Also

- `data/harvest.py` gains `_read_named()`, one header-driven reader shared by
  three harvests. Positional reads of a generated file are the trap that cost
  two full re-harvests in v2.9.
- `verify.py` 150 → 158 checks, in a new *Illustration and geometry* section.
- `./f1 images`, and a geometry line on `./f1 circuit`.

## v2.13 (2026-09-05) — the driver register, and a flag that means the wrong thing

618 drivers who entered a championship Grand Prix had no row here. The
register held 244 of roughly 860, and that was the binding constraint on
everything downstream: `ergast_load.py` skipped **5,490 classification rows**
because the driver could not be resolved, and it refuses to invent one.
Pierluigi Martini entered 124 Grands Prix, Philippe Alliot 116, Piercarlo
Ghinzani 111. None of them existed in this database.

    drivers                     244 -> 862
    rows skipped, no driver   5,490 -> 33
    race_entries on a load   20,555 -> 25,995
    podium reconciliation    6 of 7 -> 7 of 7 exact

The 7-of-7 is the part that matters. Russell derived one podium more than his
official figure for two versions; the check tolerated it because he is an
active driver whose published total is older. With the register complete the
derived figure matches exactly, so the tolerance is no longer carrying
anything.

Same shape as the constructor register in v2.12: the ids are authored one per
line in `data/drivers.py: F1DB_DRIVERS` with the seasons and entry count that
justify each, and every attribute comes from the generated harvest files.
Nobody typed six hundred names.

### Why Indianapolis drivers are admitted when Indianapolis constructors are not

73 of these entered nothing but the Indianapolis 500. The constructor
register excludes the Indianapolis *chassis makers* because they were never
Formula One constructors. Drivers are the opposite case and this project
settled it in v2.1: the ten Indianapolis winners have been in the register
since then, because the official record counts an Indianapolis start in
1950-60 as a World Championship start. Johnnie Parsons never contested a
European Grand Prix and is here. Excluding the other 73 would contradict
that.

### A flag that means the wrong thing

The first admission list was 616, and it was wrong. The test skipped F1DB's
`testDriver` flag - and **that flag records a driver's ROLE in the team, not
whether they raced.** Jack Aitken is a Williams test driver for 2020 and
carries `rounds: 16`, because he started the Sakhir Grand Prix in Russell's
place. Franck Montagny is flagged the same for 2006 and raced rounds 5-11 for
Super Aguri. The test is `rounds`, nothing else: a driver with rounds entered
those rounds; a test driver with none never entered. The same wrong filter was
in the per-round chassis resolution from v2.11 and is fixed there too.

### What the winner cross-check caught

Admitting 618 drivers **broke the classification loader**, and the winner
cross-check refused a race rather than mis-attributing it. `moss` had always
resolved on its surname because Stirling was the only Moss in the register.
Admitting **Bill Moss** made the lookup ambiguous, the fallback gave up, and
the 1955 British Grand Prix was refused - the source's winner resolved to
nobody. Duncan Hamilton and the other Brabhams did the same to Lewis Hamilton
and Jack Brabham.

Nothing was corrupted. A race was declined whole, which is what that check is
for. The fix is that the surname fallback now *narrows* by the name the
source states rather than giving up: "Stirling Moss" is a subset of "Sir
Stirling Moss" and not of "Bill Moss", so it resolves to one driver. It still
refuses a namesake - "Wilson Fittipaldi" is a subset of neither Emerson nor
anyone else.

Wilson Fittipaldi now has his own row, which closes the v2.9 defect at the
root rather than by refusing to resolve him.

### Sources disagreeing, declared rather than resolved

- **14 drivers** Jolpica records with championship entries that F1DB does not
  hold at all - Prince Bira, Geoff Duke, Ken Miles, Gary Hocking and others,
  33 rows between them. Declared in `DRIVER_NON_MAPPING`; the loader now
  reports them as a decision rather than a gap, and no longer counts them as
  an incomplete load.
- **BMW.** Jolpica records BMW as a constructor for six 1952-53 entries. F1DB
  holds a BMW constructor for 1969 only and records the 1952-53 cars as
  Veritas and AFM chassis with BMW *engines*. Those entries keep a NULL
  rather than being credited to a constructor seventeen years early. Handled
  by a year-scoped refusal - a mapping target of None.
- **Nine name-form disagreements** resolved by declared alias, each checked
  against the seasons and entries the two sources agree on: Alessandro/Alex
  Zanardi, Alessandro/Alejandro de Tomaso, Hernando/Hermano da Silva Ramos,
  Geoff/Geoffrey Crossley and the rest. One is a plain Jolpica error - it
  records Boy Hayje's forename against Brett Lunger's surname, as "Boy
  Lunger".

**Emilio de Villota** now has his own row. He entered fifteen Grands Prix and
was previously kept out of the resolver entirely, because this register's
`de-villota` is **Maria** de Villota - his daughter, who tested for Marussia
and never entered a race. Two rows under two ids, and the resolver still
refuses to join them.

### New checks

150 total. Every driver F1DB records entering a championship race must be in
the register; no two F1DB drivers may normalise onto one register entry; and
no two register rows may share a full name.

## v2.12 (2026-09-05) — the constructor register, and five teams that were two

Eighty-five constructors that entered a championship Grand Prix had no row in
this database. Both loaders had been reporting them for two versions -
`ergast_load.py` as "constructors not in the register, stored as NULL", the
chassis work as 593 entrant rows and 256 chassis that could not join to
anything. **Ensign started 133 Grands Prix and Osella 172; neither existed
here.**

The register goes from 65 to 150. Unmapped chassis fall from 256 to 59,
unmapped entrant rows from 593 to 345, and the classification load now leaves
one constructor unresolved instead of fifty-two.

### What is authored and what is not

The **ids** are the register decision and are written out one per line in
`data/teams.py: F1DB_CONSTRUCTORS`, each with the seasons and entry count
that justify it. The **attributes** - name, full name, country, first and
last entry - are read at build time from the generated harvest files.

That split is the point. CONTRIBUTING.md forbids inventing a register entry
from a bulk feed; it does not forbid a person deciding which entities exist
and letting the machine supply their spelling. Nobody typed eighty-five team
names, and no team appears without a line someone read. `wins` is left NULL,
which build.py reads as "derive it" - and none of the eighty-five ever won.

### The admission test, and the one deliberate exclusion

A constructor is admitted when it entered at least one championship race that
was **not** the Indianapolis 500. That test, not a judgement about stature,
separates these from the thirty-one Indianapolis chassis makers this project
has always excluded.

Kurtis Kraft is the case that fails cleanly on neither side. 185 of its 186
entries are Indianapolis; the exception is Rodger Ward's midget at Sebring in
1959, a genuine Grand Prix entry. Admitting the constructor to capture that
one entry would drag the other 185 roadsters into the constructor statistics,
so it stays out and the cost is recorded rather than hidden.

### The check that found the rest

Adding the register exposed a defect nothing had been able to see: **an entry
credited to a constructor that was not racing that season.** Zhou Guanyu's
fastest laps at Suzuka 2022 and Bahrain 2023 sat against Alfa Romeo, whose
last entry as a constructor was 1985 - thirty-seven years earlier. F1DB's
`alfa-romeo` covers the 1950-51 works team, the 1979-85 return, and the name
Sauber raced under from 2019; this register's covers only the first two.

`verify.py` now refuses any such entry, and both id mappings take a season.
The check then found four more of exactly the same shape, none of them
previously visible because the earlier entity had no row to land on:

| Season | Was credited to | Actually |
|---|---|---|
| 2019-23 | Alfa Romeo (last entry 1985) | Sauber, under Alfa Romeo branding |
| 1978-84 | ATS (1963) | ATS the wheel manufacturer, a different team |
| 1975 | Williams (from 1977) | Frank Williams Racing Cars |
| 1976 | Walter Wolf Racing (from 1977) | Wolf-Williams |
| 1959-60 | *nothing* | Aston Martin's DBR4/DBR5 spell |

### Two register corrections it forced

**Aston Martin's first entry is 1959, not 2021.** It entered the DBR4 and
DBR5 as a constructor in 1959-60. Two spells under one marque is how this
register already treats Mercedes and Alfa Romeo, so the row now spans both
and the seven 1959-60 entries have somewhere to go.

**Penske's last entry is 1977, not 1976.** The team withdrew after 1976, but
the PC4 was entered through 1977 by ATS Racing and Interscope - and the
constructor credit for a chassis belongs to whoever built it, not whoever
entered it.

### One disagreement left standing

Jolpica records Scuderia Milano as a constructor for two 1950 entries. F1DB
records the same entries as Scuderia Milano *entering Maseratis* and holds no
Milano constructor at all. The sources disagree about whether a constructor
existed, neither can be checked against an official 1950 entry list here, and
this project does not pick one silently. The constructor is not created, the
two entries keep a NULL, and the disagreement is declared in
`CONSTRUCTOR_NON_MAPPING` so the loader reports it as a decision rather than
a gap.

### New checks

Every constructor F1DB records entering a non-Indianapolis race must now be
in the register, aliased, or declared - so a future F1DB release cannot
reintroduce the gap quietly. Plus: every alias points at a team that exists,
nothing is both admitted and excluded, and no entry is credited to a
constructor that was not racing that season.

## v2.11 (2026-09-05) — lap times back to 1996

`--timing` loads the dump's per-lap times and pit stops:
**628,454 race laps covering 1996-2026** and **12,627 pit stops from 2011**.
FastF1 starts at 2018, so this reaches twenty-two seasons further back than
anything previously in the project's reach, and the whole load takes about
fifteen seconds.

Both tables stay empty in the distributed build. Same licence as the rest of
the Jolpica data - CC BY-NC-SA, non-commercial - so they are loaded locally.

### The two sources are allowed to disagree, so they can be compared

`laps` was keyed `(race_id, driver_code, lap_number)`, which is FastF1's key:
it identifies a driver by three-letter code. Jolpica resolves to a register
id and mostly has no abbreviation before the 2000s, so that key would have
collided on NULL and quietly duplicated rows on a rerun.

Rather than overload one column with two meanings, each loader now writes
what it keys on into `driver_key`, and uniqueness is
`(race_id, source, driver_key, lap_number)`. Both sources can therefore hold
the same race at once - and verify.py checks that where they do, they agree
on each driver's lap count.

### What the lap data proves

The strongest check here re-derives a fact the database already holds, by a
route sharing nothing with how it was established. `race_entries.fastest_lap`
came from the Wikipedia pole and fastest-lap harvest; the laps came from
Jolpica's dump. Take the quickest lap flagged as an entry's fastest, and the
driver it names must be the driver already stored.

**446 races, no disagreement.**

That only works using the flag rather than the raw minimum, and the reason is
a good one. At the 2021 Portuguese Grand Prix, Verstappen's 1:19.849 is the
quickest time in the file and Bottas's 1:19.865 is the one flagged, because
Verstappen's was struck for track limits. Ranking on time alone reports five
disagreements - 2001 Japan, 2012 and 2015 Britain, 2021 Portugal, 2025 China
- and every one is this. Jolpica does not mark the lap deleted; it declines
to flag it as the entry's fastest, and that flag is the authoritative field.

### A check that was too naive to survive real data

`lap times are plausible` rejected anything over 900 seconds. The 2011
Canadian Grand Prix, the longest race in the sport's history, has a lap 25 of
**two hours and five minutes** - the red-flag suspension is recorded inside
the lap it interrupted. 41 races contain such a lap and all 41 are genuine
stoppages.

Replaced with two checks that are actually true: a lap time must be positive,
and no driver may have more long laps in one race than any race has had red
flags. The observed maximum is three, at races stopped three times.

`no lap data claims to predate live timing` had the same problem - it
asserted 2018 because FastF1 was the only source. It is now per source:
FastF1 laps may not predate 2018, Jolpica laps 1996, Jolpica pit stops 2011.

### Two smaller things

Pit stop `duration` is around 20-30 seconds, so it is **pit lane** time, not
the two or three the car is stationary. It goes in `pit_lane_seconds` and
`stationary_seconds` stays NULL, which is the difference between a figure and
a wrong figure.

`zhou` needed declaring in `DRIVER_ALIASES`. This register lists him family
name first, as he is usually written, so the surname index holds "guanyu" and
a source saying "Guanyu Zhou" found nothing. Declared rather than fixed by
matching names order-insensitively, which would start joining genuinely
different people.

## v2.10 (2026-09-05) — loading from the database dump

`tools/ergast_load.py --from-dump` reads Jolpica's database dump instead of
paging ~270 API requests. Both paths produce identical rows and share every
downstream check.

**The reason is not speed.** A dump is one consistent snapshot with a SHA256
and an upload timestamp: a load can be pinned to an exact state and
reproduced. Paging a live API for several minutes cannot promise that, and
the seam between pages is precisely where v2.7's hand-relayed rows were
fabricated. The `source` column now records the dump's hash and date, so a
row names the snapshot it came from.

`--verify-dump N` loads nothing and instead reads N seasons both ways and
diffs them row by row. The API stays the reference implementation, because a
second fetch is a second place to be wrong. 1955, 1976, 1983, 1999, 2003,
2008, 2012, 2015 and 2023 all come back identical, position, grid, status,
laps, points and shared-drive flag included.

### One concern that turned out smaller than expected

The worry about adopting dumps was the integer status enum, whose meaning
lives only in Jolpica's model source. It is not a problem:
`sessionentry.detail` carries the same human-readable text the API returns -
"Finished", "+1 Lap", "Engine" - so nothing here decodes an enum to fill a
column. The integer is read only to assert it agrees with the text, and the
load fails if it stops doing so.

### Two that turned out real

**The free tier is fourteen days behind, and a stale dump loads clean.** The
delayed dump was cut on 2026-08-21; round 12 was raced on the 23rd. Those
rows simply are not in the file, and none of the existing checks can see
that - the winner cross-check cannot fire on a row that never arrived. The
loader now compares the completed races in range against the races that got
rows, and reports any that got none, naming the dump's date. For 1950-2025
the lag costs nothing.

**Two columns needed care.** `round.number` is the round within its season;
`race_number` is a global counter across all history, so the 1951 Swiss Grand
Prix is round 1 and race 8. Using the wrong one would have put every row
against the wrong race. And one round - the cancelled 2026 Saudi Arabian
Grand Prix - has no number at all, so cancelled rounds and sessions are
skipped rather than defaulted.

Every column is addressed by name. Jolpica guarantees the names and
explicitly does not guarantee their order, and reading a generated file by
position has now cost this project two full re-harvests in one day.

The licence is unchanged: the free dump tier is non-commercial, exactly like
the API, so these rows are still never committed.

## v2.9 (2026-09-05) — the round, and the first live run of both loaders

Two things the previous release left on the table: F1DB's per-round driver
data, which v2.8 fetched and then threw away, and running `ergast_load.py`
against the live API for the first time. Both paid, and both exposed a defect
that only a live run could find.

### Rule two: resolve through the driver and the round

v2.8 asked what a CONSTRUCTOR ran in a SEASON and gave up whenever the answer
was more than one — which is most of the 1950s and 1960s. But the drivers
inside an entrant block carry rounds, and that is a far sharper question:
what did **this entrant** run for **this driver** in **this round**.

Lotus in 1970 ran a 49C, a 72B and a 72C, so the constructor-season settles
nothing. Garvey Team Lotus entered a 49C for Soler-Roig in round 2 and
nothing else; Pete Lovely a 49B; Team Gunston a 49. All resolve. Only Rindt's
own entries stay ambiguous — correctly, because he moved from the 49C to the
72 mid-season.

| | v2.8 | v2.9 |
|---|---|---|
| entries with a chassis | 821 (34%) | **1,849 (76%)** |
| entries with a constructor | 1,164 (48%) | **2,395 (99%)** |
| winning chassis known | 819 races | **874 races** |
| 1960s entries with a chassis | 4% | **31%** |

**The check first, as always.** 1,153 entries already carried a constructor
established by a different route — the Wikipedia race harvest. F1DB agreed
with every one of them. Only then were its answers taken on the 1,243 entries
that had none, and the build refuses outright on a single disagreement.

### What that unlocked, and the error it exposed

The pole harvest recorded who took pole but not what they drove, so 1,260
entries carried no constructor and could not reach a car at all. `cars.poles`
has been a lower bound since v2.6 for exactly that reason. With the
constructor supplied, poles can be attributed, and **nine cars now match their
published career pole total exactly** — MP4/4 15, W05 18, W11 15, FW14 21,
RB6 15, F2004 12, R25 7, BGP001 5, Cooper T51 6. Before this, none could be.

The first thing that check did was fail. **The McLaren M23 derived 16 poles
against a published 14.** `CAR_SEASONS` claims every race a constructor won,
took pole for or set fastest lap in a season was in one named car — and
McLaren ran the M23 and the M26 through 1976 and 1977, so the blanket claim
handed the M23 every one of Hunt's poles. The claim was only ever safe for
wins, by luck rather than by construction, and nothing could see it until
poles could be attributed.

Twelve of the forty-one `CAR_SEASONS` pairs turn out to cover a season the
constructor also ran other chassis in. The claim is now **checked rather than
trusted**: the new `car_seasons` table records which pairs the entry lists
corroborate, the blanket link is applied only to those, and an entry in an
uncorroborated season gets a car only where the chassis itself resolved.
Ferrari's 312T consequently derives 21 wins against a published 27, because
1975 is uncorroborated — Ferrari ran the 312B3-74 alongside it and F1DB does
not say which race used which. That is the honest number.

### The first live run of ergast_load.py, and what it fabricated

21,017 entries across all 1,161 races, no race refused on a winner mismatch.
The podium reconciliation — the strongest check in this project and one that
has never actually run — now passes: no driver below the official figure, six
of seven exact, Russell one over as an active driver whose published total is
older.

It also silently corrupted the database, and the reconciliation is what
caught it. **Jolpica gives Emerson Fittipaldi the id `emerson_fittipaldi` and
his brother Wilson the bare `fittipaldi`.** This register holds only Emerson,
under the id `fittipaldi`. The resolver's surname fallback matched Wilson's
id onto Emerson and overwrote his 1972-73 Lotus entries with Wilson's
Brabham ones:

```
every constructor win total equals the number of races it won
  Team Lotus: stored 79, derived 71      <- eight wins moved
  Brabham:    stored 35, derived 43         from Lotus to Brabham
  Fittipaldi: stored 0,  derived 2       <- a constructor that never won
```

This is the same failure as `_norm()` stripping "jr" and giving Piquet Jr his
father's 23 wins — in a second resolver, written after that lesson, which had
never been run against live data. Two independent checks caught it: the
constructor win reconciliation, and the chassis linkage noticing that entries
now claimed a Lotus 72 for a Brabham entry.

The fix is that a bare surname is accepted only where the name the source
supplies alongside it agrees. The API sends `givenName` and `familyName` on
every result and the loader was discarding both. It now carries them, and
`fittipaldi` arriving as "Wilson Fittipaldi" resolves to nothing and is
skipped, which is correct — Wilson is not in this register. The subset test
allows "Lewis Hamilton" to match "Sir Lewis Hamilton" while refusing
"Wilson Fittipaldi" against "Emerson Fittipaldi".

### A check that was a constant

`shared drives are recorded with both drivers` asserted `len(shared) == 3`.
Three was the number the winner harvest happened to record, not a property of
anything. The full classification finds 42 races with a shared car, which is
right: sharing was routine in the 1950s and died out in the 1960s. Replaced
with what is actually true — no shared drive after 1964, and every shared
drive is a classified finish.

### Still open

- **577 drivers are not in the register**, so 5,558 classification rows are
  skipped. The loader exits non-zero and names them, which is the designed
  behaviour, but the register tail is now the binding constraint on the full
  classification rather than the API.
- **67 F1 constructors are missing** — Ensign, Osella, De Tomaso, ATS,
  Coloni, AGS, Zakspeed, Theodore, Marussia, Simtek, Pacific and the rest.
  Both loaders report them independently. 593 entrant rows and 256 chassis
  cannot join to a constructor because of it.
- The classification itself is **not committed**: Ergast's data is
  CC BY-NC-SA, and the build is a function of what is in this repository.
  Run the loader locally.

## v2.8 (2026-09-05) — the chassis register, and what a constraining check is

Goal: technical data on the cars, working backwards. `cars` held 29 landmark
chassis against 2,424 race records; the balance was wrong.

### What is in

- **`chassis`, 1,153 rows** — every chassis that has raced, from
  [F1DB](https://github.com/f1db/f1db) (CC BY 4.0) via
  `tools/f1db_fetch.py`. Plus **`engines` (424)**, **`season_entrants`
  (1,925)** and the constructor names, all generated into `harvest/`, all
  diffable, none touched by a person.
- **`tools/wikispec_fetch.py`** — chassis specifications off the
  `{{Racing car}}` infobox on each car's own article. There is no unified
  Formula One car specification dataset anywhere; F1DB's register carries
  **no technical data at all**, and this is where the numbers live.
- **`regulation_limits`** — the numeric limits the rules put on a whole grid.
- **819 of 1,161 races now have a known winning chassis**, up from a car
  linkage that covered 267 of 2,424 entries. 779 chassis carry harvested
  specifications; 132 of them publish a career win total, and the wins this
  database derives independently from its own race records agree exactly for
  97 and never exceed for any.

### The gap that was closed, and the half that was not

`known_gaps` #1 had stood since v2.6: the chassis-per-race harvest was
abandoned because the winner cross-check does not constrain the chassis. A
1952 trial returned "Ferrari 125 F2" for races Ascari won in a Ferrari 500 and
every winner matched, because the winner tells you which race a row describes
and nothing whatever about what he drove.

F1DB's per-season entry lists are the second source that check was missing.
They are also not a complete answer, and saying so is the point:

> **F1DB records which chassis a constructor ran in a SEASON. It does not
> record which chassis ran in which ROUND.**

Where a team ran two designs the entry list names both with no round
attribution. So a constructor-season constrains the chassis only when it names
exactly one. Ferrari in 1952 names five — the 500, plus a 125, a 166, a 212
and a 375S in privateers' hands — and gets no link at all. That is the correct
answer for 1952 and it is the answer the abandoned harvest should have given.

321 constructor-seasons are in that position; `v_ambiguous_seasons` lists
them. Coverage therefore tracks how teams operated rather than spreading
evenly: 4 per cent for the 1960s, 49 per cent for the 2020s.

**The check ran against 41 assertions this database already held** —
`CAR_SEASONS`, already proved against published win totals — and none
disagreed.

### Three checks before a specification page is read

Guessing that "Ferrari 312T2" is the article for `ferrari-312t2` is inference,
and inference is what produced the invented Ferrari 125. A title is only a
candidate; a page is read only if it agrees with facts established elsewhere:
the **constructor** its infobox names must be the one F1DB gives the chassis;
the **years** it reports must fall inside the seasons F1DB records it entered;
and the **title** must be a form of the chassis's own name.

Refusals are logged with reasons in `harvest/car_specs.log`. The constructor
check caught five real modelling disagreements — the Lola THL1 is a Haas
(USA) car on Wikipedia, the Williams FW is an Iso-Marlboro, the Venturi LC92 a
Fomet — none of which were resolved by force.

### The finding that changed the plan, and the defect it exposed here

**Modern cars are documented far more thinly than historic ones.** Current-era
specifications are competitive secrets; most "weight" quoted for a recent car
is that season's regulation minimum, and the 2026 figures in circulation —
768 kg, 3,400 mm, 1,900 mm — are limits every car on the grid is built to.
Storing one in a per-car field is inference presented as fact.

Applying that test to the **existing hand-curated data** found four:

```
mclaren-m23    575 kg = the 1973 minimum
lotus-88       585 kg = the 1981 minimum
mclaren-mp4-4  540 kg = the 1988 minimum
ferrari-f2004  605 kg = the 2004 minimum
```

All four are now NULL, with the reason recorded in `data/cars.py: WITHDRAWN`
and in `discrepancies`. Six more curated weights are almost certainly the same
thing — R25 605, RB6 620, W05 691, W11 746, RB19 798 — but this project does
not withdraw a figure on a suspicion, and no *sourced* limit for those seasons
exists yet. They stay, flagged, as open work.

### A test the data does on itself

`regulation_limits` only covers the years a source actually states a limit
for; carrying a value across an unrecorded change would invent one, so the
series has holes by design and whole eras are uncovered.

The harvest closes them from the other direction. A figure that is genuinely a
measurement of one car is that car's alone; **a figure that three or more
different constructors all quote for cars racing in the same season is the
rule they were built to.** Run in `build.py` over the harvested rows, that
test recovered the whole modern minimum-weight series without being told any
of it — 500, 505, 515, 540, 550, 580, 585, 595, 600, 605, 620, 640, 691, 702,
733, 743, 770 kg — from the fact that whole grids share each figure. It took
the chassis weight fill from 346 down to 199, which is the honest number.

**It was wrong three times before it was right, and each correction is a rule
worth keeping:**

1. *Constructors, not cars.* The first version required three cars and
   dropped the BRM P126, P133 and P138 wheelbase, because those three share
   one — they are the same car evolved. Three cars from one constructor is
   evidence of nothing.
2. *Per season, not per group.* The second required one year common to every
   car quoting the value. But a minimum stays in force for years, so the cars
   need not overlap each other — 600 kg covers 1995 to 2003 — and the test
   fired almost never. Counting per season also fixes the reverse error:
   620 kg is quoted by fourteen constructors, thirteen of them in 2010 and
   the fourteenth a 1955 Lancia, which keeps its figure because in 1955
   nobody else shared it.
3. *Weight only.* "A figure a whole grid shares is the rule" holds only where
   a rule actually fixes that figure. Minimum weight has been fixed
   continuously since 1961; **wheelbase has never been capped at all except
   for 2026**. Run on wheelbase the test dropped 2,540 mm, 2,692 mm and
   2,794 mm from fifteen cars — 100, 106 and 110 inches exactly. Designers of
   that era worked in imperial and rounded to the same round numbers. Those
   are real measurements, and they are kept.

The sweep also moved out of the fetcher into the build, so the harvest file
records what the page said and the database records what survived the checks.
That move exposed a fourth defect: the fetcher applied the *sourced* limit
drop per chassis, but a family article is one row covering several — the
Ferrari F2004 and F2004M share a row spanning 2004-2005 — so whichever
chassis happened to be read first decided which seasons were tested, and the
F2004's 605 kg survived. The check now runs in the build against the span
actually stored.

### Sources, assessed

`source_registry` gained `licence`, `cadence` and `checkability`, and every
source used by this project is now judged on those three rather than on how
much data it has. The last one matters most: a source nothing here can
contradict is a source being trusted, not checked, and this project has twice
paid for trusting one.

That assessment is why F1DB was chosen — CC BY 4.0, attribution only, no
share-alike, re-released after every race with a public commit history — and
why Jolpica's rows are loaded locally rather than committed: the Ergast data
it continues is CC BY-**NC**-SA, the most restrictive licence in use here.

### Still open

- The specification harvest's name check is too strict in one direction. It
  refuses "Alfa Romeo 158/159 Alfetta" for `alfa-romeo-159` and "Alfa Romeo
  Racing C38" for `alfa-romeo-c38`, both of which are the right article. The
  fix is to allow the chassis name as a token subsequence of the title rather
  than a strict prefix; the constructor and year checks would still gate it.
- Six curated weights await a sourced limit for their season.
- `tools/ergast_load.py` still has not completed a full live run.

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
12->11. Every headline record in the database matched the official figure
exactly.

## v2.2 - pole and fastest lap 1950-2024
Driver register 133->181. Found the 2012 Spanish GP (Maldonado inherited pole
after Hamilton's fuel exclusion) and the 2012 European GP (Vettel, not Alonso)
by arithmetic across four career totals, then confirmed both.

## v2.1 - race harvest
1,161 races, harvested from Wikipedia's season tables under a new `reference`
confidence tier. Found the 1982 Brazilian GP (Prost, not Piquet - Piquet and
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

## Next

There is no list here any more. `docs/BACKLOG.md` is the only queue: every
item from a critique, from this file's own *still open* notes, from a
`verify.py` warning or from an idea has an ID, a source and a size there, and
they are ranked against each other rather than by who raised them. The list
that used to sit here had been overtaken twice — its first two items by
v2.15's licence finding and the timing decision in
`docs/TIMING-ARCHITECTURE.md` — and a second queue that can go stale is worse
than none. What is still open from any entry above is filed there under
`PM-n`.
