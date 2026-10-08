# Sources, attribution and licensing

Read this before passing any of it on. The code and the data are in different
positions, and the data has an obligation attached to it. The repository has
been public since 2026-09-14 and lapledger.org serves this file beside the
data it covers, because the obligation follows the file rather than the
repository.

It covers every file the data is published as. `f1.db`, its compressed copy
`f1.db.gz`, the Parquet bundle `f1-parquet.zip`, and the two JSON exports —
`f1_database.json`, released as `f1_database.json.gz`, and `f1_compat.json` —
are the same data in different formats, under the same terms, which
`LICENSE-DATA` states. The Parquet bundle carries a `README.txt` saying so,
written from the database it describes. `f1-geometry.db` is the one file on
other terms: ODbL, under *OpenStreetMap* below.

`docs/COMMERCIAL-READINESS.md` is the companion to this file: where this one
records what each source requires, that one records which rows were read
against those requirements, what they were found to hold, and which of those
findings the build now enforces rather than trusting. `./f1 licences` prints
the current position from the rows themselves.

## Where the data came from

| Part | Source | Roughly how much |
|---|---|---|
| Race winners 1950–2026 | Wikipedia season articles | 1,161 races |
| Pole position and fastest lap 1950–2026 | Wikipedia season articles | 1,161 / 1,160 |
| Race venues 1950–2026 | Wikipedia season articles | 1,161 |
| Car specifications and design histories | Wikipedia per-car articles | 29 curated cars |
| Chassis specifications | Wikipedia per-car articles, `{{Racing car}}` infobox | see `harvest/car_specs.txt` |
| **Full race classification 1950–2026** | [F1DB](https://github.com/f1db/f1db) | 27,555 entries, 1,161 races |
| **Qualifying 1950–2026** | [F1DB](https://github.com/f1db/f1db) | 26,975 rows |
| **Championship standings, every round** | [F1DB](https://github.com/f1db/f1db) | 34,495 rows |
| Pit stops | [F1DB](https://github.com/f1db/f1db) | 22,472 |
| Chassis, engine and season-entrant register | [F1DB](https://github.com/f1db/f1db) | 1,153 chassis, 424 engines, 1,925 entrant rows |
| Circuit outlines, and the layout each race ran | [F1DB](https://github.com/f1db/f1db), SVG assets drawn by [Jules Roy](https://github.com/julesr0y) | 160 layouts, 1,172 races |
| Circuit register and layout timelines | Wikipedia per-circuit articles | 80 circuits, 49 layouts |
| Car photographs (references and credits, not images) | [Wikimedia Commons](https://commons.wikimedia.org/) | 623 articles |
| Circuit centrelines | [OpenStreetMap](https://www.openstreetmap.org/), ids via [Wikidata](https://www.wikidata.org/) | see `v_geometry_coverage` |
| Notable team radio transcripts | Wikipedia per-race articles | 6 |
| Why a finisher inside the paid places scored nothing | Wikipedia per-race articles, cited row by row in `claims`; the notes are written for this project | <!-- fig:wp_entry_notes -->13<!-- /fig --> entries |
| 2026 season, entry list, standings, calendar | formula1.com | current season |
| How each grid was set, from 1996 | The FIA Sporting Regulations of each season from 2009, and formula1.com's history of qualifying formats before that; the facts only, with notes written for this project | every season from 1996 |
| Career totals (entries, starts, podiums, points) | formula1.com driver pages | 7 drivers at `verified` |
| Background lines for the drivers who only ran in Friday practice | Each driver's own Wikipedia article, cited row by row in `driver_note_sources`; the lines are written for this project, and labelled in `docs/prose_pass.tsv` | <!-- fig:wp_note_sources -->53<!-- /fig --> drivers |
| Regulations, safety, technical, glossary, eras | Written for this project from general knowledge. Since v2.16 this is a named provenance — `authored`, `source_registry` entry 18 — and everything carrying it sits at `medium`, because nothing here can contradict it | 13 tables, 357 rows |

Every row carries a `confidence` value and most carry a `source` URL. The
`source_registry` table records which sources are treated as authoritative.
`./f1 unverified` lists everything still sitting at `medium`.

Since v2.16 the provenance is traceable rather than only described here.
`source_patterns` resolves a row's `source` to a registry entry — the build
fails if one does not resolve, and stores the answer as the row's `source_id`
— and `table_provenance` gives a source to the
fifteen tables that carry `confidence` and no `source` column of their own.
So the table above is now checkable against the database rather than a claim
about it. See `docs/DERIVED-CONFIDENCE.md`.

## The obligation

There are two, from two different licences, and they are not the same shape.

### F1DB — CC BY 4.0

`harvest/chassis.txt`, `harvest/engines.txt`, `harvest/f1db_constructors.txt`
and `harvest/entrants.txt` are generated from
[F1DB](https://github.com/f1db/f1db), which is licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). So is
`harvest/f1db_driver_totals.txt`, F1DB's published career wins, poles and
fastest laps per driver, which `tools/f1db_totals_fetch.py` reads from an
F1DB release rather than from its source tree. That is
**attribution only — there is no share-alike**, so it places no condition on
how the rest of this database is licensed. It does require attribution, which
is given here, in the header of every generated file, in `source_registry`,
and in `tools/f1db_fetch.py` and `tools/f1db_totals_fetch.py`.

`harvest/circuit_outlines.txt`, and the `circuit_outlines` table built from it,
hold F1DB's SVG outline of every circuit layout — drawn by
[Jules Roy](https://github.com/julesr0y) and credited to him in F1DB's README,
under the same CC BY 4.0. The site gives that credit in its footer and on
`/data/sources` as *Circuit outlines from F1DB (CC BY 4.0), drawn by Jules
Roy*. An outline is a drawing, not a measurement; the traced centrelines
below are OpenStreetMap's and carry a different obligation.

Two changes are made to the drawings, stated here as CC BY 4.0 asks. One
asset (`ain-diab-1.svg`) positions its path with a `translate()` on the
element; `tools/f1db_fetch.py` applies that to the path data so every
outline is stored bare in the same 500-unit box, and stops on any other
transform. The site then draws every outline in its own ink at a constant
stroke width, with nothing added; F1DB's black 20-unit stroke is not kept.

This is the most permissive licence of any bulk source used here, and since
v2.15 it is the single most important fact about this repository's data.

**The absence of a non-commercial clause is why the full classification
ships.** `race_entries`, `qualifying`, `standings` and F1DB's `pit_stops` —
111,497 rows between them — are built from `harvest/race_results.txt`,
`harvest/qualifying.txt`, `harvest/standings.txt` and
`harvest/f1db_pit_stops.txt`, all generated from F1DB. The same facts are
available from Jolpica-F1 under CC BY-NC-SA and were loaded locally and never
committed for seven versions on exactly that basis. Nothing about the data
changed; the licence did.

### Wikipedia — CC BY-SA 4.0

**Wikipedia text is licensed CC BY-SA 4.0.** Bare facts — who won a race, how
long a circuit is — are not copyrightable, and a database of those facts is
yours to license as you wish. But this database also contains *prose taken
from or closely following* Wikipedia articles: the car design histories, the
circuit descriptions and some notes. That is expression, not
fact, and it carries CC BY-SA's attribution and **share-alike** requirements
with it.

In practice that means one of:

1. **License the data CC BY-SA 4.0** and attribute Wikipedia. Simplest, and
   what the content actually is today. Code can stay under a permissive
   licence separately — see below.
2. **Rewrite the prose fields in your own words** (`cars.story`,
   `cars.concept`, `cars.outcome`, `circuits.notes`, `circuits.characteristics`,
   `regulation_changes.detail`, `technical_innovations.description`, and the
   notes elsewhere — `docs/prose_pass.tsv` labels, field by field, which
   follow an article) — note that the harvested `chassis` specification
   fields are short factual values copied verbatim from an infobox
   ("Aluminium monocoque", "5-speed manual"), which is much closer to fact
   than to expression, but they were
   still taken from a CC BY-SA source
   and then license the remaining factual data however you like. This is real
   work but it is not enormous — it is a few hundred fields.
3. **Keep the repository private**, in which case none of this applies.

Until `PM-49` option 2 also listed `glossary.definition` and
`technical_innovations.*`, which `source_registry` entry 18 has classified
the opposite way since v2.16: *"Written for this project from general
knowledge"*, the twelve tables the build caps at `medium` on exactly that
basis. `PM-17` (#249), the prose pass, settled the disagreement by measuring
the written fields against Wikipedia: of the 381 fields in those twelve
tables, one is paraphrased and none is close to source
(`docs/COMMERCIAL-READINESS.md`, *Measured: the prose pass*;
`docs/prose_pass.tsv` line by line). Across the whole database it found one
field close to source and ten paraphrased out of 1,208, and one of the ten
has since been reworded as original (`CR-60`, #693). On that evidence the
maintainer ruled table by table (`PM-49`, #573): a table takes CC BY 4.0
only if every prose field in it reads original. Ten of the twelve now do,
under *What this project wrote* below. `technical_innovations` stays CC BY-SA
because its fan-car description is paraphrased, until that field is
rewritten (`PM-62`, #692). The glossary stays CC BY-SA too: all 55 of its
definitions read original, but the ruling expected it to stay, and a grant
that cannot be withdrawn waits on that being settled (`PM-67`, #835).

The database also quotes six team radio exchanges verbatim. They are short,
attributed, and used to document historical events, which is the ordinary
case for quotation — but they are quotations, not facts. Keeping them was a
decision rather than an oversight; `docs/COMMERCIAL-READINESS.md` records what
was weighed, and when it would be worth revisiting.

*This is a description of the licences involved, not legal advice.*

### Wikimedia Commons — sixteen different licences, one per file

`article_images` records the photograph of each accepted car article: its
lead image, or a photograph in its body whose file name names the car.
**No image is stored in this repository or in `f1.db`.** The row is a
*reference and its credit*: which file the article carries, who took it,
and under what licence. The pixels are fetched from `upload.wikimedia.org` by
whatever renders the page, under Wikimedia's terms.

A second set of rows (`route = 'category'`) covers chassis with no article of
their own: a photograph filed on Commons under a category named for the
chassis. They are held under the same rules — Commons-hosted, a free licence,
someone to credit — and are not shown on the site.

A third (`route = 'circuit'`) covers circuits: an aerial photograph in the
body of the Wikipedia article the List of Formula One circuits links for the
circuit, whose file name names it. The same rules hold, and the files are
asked of en.wikipedia.org as the article route's are. Which article that is
(`circuits.article`) is a fact taken from one revision of the list, cited per
circuit in `claims`; no text of the list or the articles is copied.

A fourth (`route = 'race'`) covers races: up to twelve photographs filed on
Commons under the category named for the race — `Category:1967 Dutch Grand
Prix` — taken only where Commons files that category as the season's Formula
One. The same rules hold, asked of Commons itself as the category route's
are, and a file whose name carries a copyright mark is refused whatever
licence it states, as on the circuit route. So is a file whose credit
claims it was uploaded on somebody else's permission, and one whose only
credit is Commons' own boilerplate ("Own work"), which names nobody. The category's title is a fact
about where Commons files things; nothing of Commons' text is copied.

There is **no single licence** covering these files. Across the 623 article rows there are
sixteen distinct licence strings — CC BY-SA at 1.0, 2.0, 2.5, 3.0 and 4.0,
CC BY at 2.0, 2.5, 3.0 and 4.0, CC0, public domain, and national variants such
as CC BY-SA 2.0 de and CC BY-SA 3.0 nl. So there is no blanket credit line you
can write once. Each row carries its own `licence`, `licence_url` and `artist`,
and **any display must show them**: attribution is a condition of CC BY and
CC BY-SA, not a courtesy.

Three things are enforced, at harvest time and again on every build:

- the file must be on **Commons**, never a local en.wikipedia.org upload — a
  file is uploaded locally *because* it is non-free, so linking one would be a
  licence violation that looks like a working feature;
- it must state a licence, checked against a list of what is actually free
  (`CC BY-NC` and `CC BY-ND` both begin "CC BY" and neither qualifies);
- it must name someone to attribute. Eight files were refused on the run that
  produced the committed data: seven name no author, one states no licence.

### OpenStreetMap — ODbL 1.0, and why it ships in a file of its own

`circuit_geometry` holds circuit centrelines traced from OpenStreetMap, which
is licensed
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). ODbL is
**share-alike and carries a database right** — a different and stronger
obligation than anything else here, and notably stronger than the CC BY that
made F1DB attractive.

Stronger in a specific way that matters: ODbL reaches the **whole database**
its data lands in. A database derived from an ODbL one is a *Derivative
Database* and must itself be published under ODbL. Confining the rows to one
table is not enough, because the table is inside the database — twenty-five
centrelines would set the licence of 117,000 rows that have nothing to do
with them.

So they are **not in `f1.db` at all**. `build.py` writes them to
**`f1-geometry.db`**, and the two files are published side by side. ODbL
draws exactly this line: two independent databases distributed alongside each
other are a *Collective Database*, which it explicitly does not treat as
derivative, so the obligation follows the file it belongs to and no further.

- **Want the maps?** `python3 tools/geometry_overlay.py --apply` merges them
  into your copy. That copy is then a Derivative Database under ODbL — fine
  to hold, not the file to redistribute, and `verify.py` says so.
- **Don't want ODbL at all?** Use `f1.db` and ignore the other file. Nothing
  else in the project derives from OpenStreetMap.
- The website merges the two **in your browser**, which is why the track maps
  work without `f1.db` ever containing the data.

The centrelines are still checked on every build — the re-measurement that
catches Monaco's relation reading 12% long runs against the overlay.

Any use of the geometry must credit **© OpenStreetMap contributors** and share
derived geometry under ODbL. The relation ids come from
[Wikidata](https://www.wikidata.org/), which is **CC0** and places no
obligation on anything at all.

## What this project wrote — CC BY 4.0

These columns are this project's own writing, offered under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) rather than under
the share-alike above. First, its account of its own sources and state:

| Column | What it holds | Chars |
|---|---|---:|
| `discrepancies.assessment` | this project's reading of a disagreement between two sources — which figure it takes, and why | <!-- fig:prose_assessment -->32,334<!-- /fig --> |
| `known_gaps.reader` | what a reader is shown about a gap | <!-- fig:prose_gap_reader -->5,747<!-- /fig --> |
| `known_gaps.description` | the maintainer's note on it | <!-- fig:prose_gap_description -->14,457<!-- /fig --> |
| `known_gaps.resolution` | what would close it, or what did | <!-- fig:prose_gap_resolution -->5,531<!-- /fig --> |
| `known_gaps.area` | the part of the database it falls in | <!-- fig:prose_gap_area -->1,016<!-- /fig --> |

Second, the prose of ten of the twelve reference tables `source_registry`
entry 18 records as written for this project (`PM-49`, #573):

| Columns | What they hold |
|---|---|
| `eras.summary`, `eras.defining_features` | each era of the championship, summarised, and what defined it |
| `engine_eras.notes` | notes on each engine era |
| `governance.detail`, `governance.significance` | what each turn in the sport's governance was, and what it changed |
| `safety_milestones.trigger_event`, `safety_milestones.description` | what prompted each safety measure, and what it was |
| `points_systems.notes` | notes on each points system |
| `tyre_suppliers.notes` | notes on each tyre supplier |
| `constructor_lineage.note` | a note on each team in a lineage chain |
| `grands_prix.notes` | notes on each grand prix |
| `personnel.significance` | why each person in the register matters |
| `engine_manufacturers.notes` | notes on each engine manufacturer |

Every figure here is a span this build rewrites from the database itself:
<!-- fig:prose_kb -->79 KB<!-- /fig --> between all of them, of which
<!-- fig:prose_authored_kb -->21 KB<!-- /fig --> is the ten tables' prose.

The share-alike on everything else comes from Wikipedia, and
none of Wikipedia's text is in these columns. A disagreement between two
sources is found here, by the build, and written up here; a gap is this
project's account of what it does not hold. The ten tables were written here
from general knowledge, and the prose pass measured every field in them
against the Wikipedia articles a writer would have reached for and found
none of their expression. There is no upstream to owe anything to, and the
whole-file licence covered them by the convenience LICENSE-DATA records —
*"rather than draw a line field-by-field"* — rather than by any obligation.

So: attribute Lap Ledger, and build what you like on them. The remaining
columns of the tables they sit in — the subject and field of a disagreement,
the stored and derived values, a gap's state and the number of races it
affects, an era's name and dates, a points scale, a grand prix's aliases —
hold facts, identifiers and headings rather than expression.

The grant is in the database as well as here, as `meta.project_prose` and
`meta.project_prose_columns`, so a copy of `f1.db` carries its own terms;
`verify.py` fails a build where the database, `data/current.py`,
`LICENSE-DATA` and this file do not name the same columns, and fails one
where a granted field of the ten tables is not the text the prose pass read
as original. A CC BY grant cannot be withdrawn from a copy already taken,
which is why the list is exactly this long, why a rewritten field of the ten
tables waits for the pass to read it again, and why the glossary and
`technical_innovations` are not on it.

## Suggested arrangement

Two licences, which is normal for a data project:

- **Code** — `build.py`, `verify.py`, `audit.py`, `export_json.py`, `f1`,
  `tools/`, `schema.sql`, and `views.sql` in `f1-parquet.zip` — under MIT,
  or whatever you prefer. `views.sql` is the views' statements as `schema.sql`
  writes them, so it is offered on the same terms (`PM-64`).
- **Data** — `data/`, `harvest/`, `f1.db`, `f1.db.gz`, `f1-parquet.zip`,
  `f1_database.json` — under CC BY-SA 4.0, with attribution to Wikipedia
  contributors, except the columns under *What this project wrote*,
  which are CC BY 4.0. `views.sql` is also offered under MIT, as above.

Add a `LICENSE` for the code and a `LICENSE-DATA` for the data, and say which
covers what in the README. I have deliberately not chosen for you.

## Attribution text

This is the credit the data carries, and it has one wording.
LICENSE-DATA's *Attribution* section is this text without its links, word
for word, and the Parquet bundle's `README.txt` quotes that section, so a
change here is a change to both; `tests/test_parquet_notice.py` fails if
the two drift apart.

> Car and circuit data in this repository, each race's winner, pole position
> and fastest lap, some driver records and six team radio quotations are
> derived from [Wikipedia](https://en.wikipedia.org/), licensed under
> [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Most driver
> and constructor records, the full race classification, sprint results,
> practice, qualifying and sprint qualifying, championship standings, pit
> stops, and the chassis, engine and season-entrant register are derived from
> [F1DB](https://github.com/f1db/f1db), which its authors publish under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), as are F1DB's
> circuit outlines, drawn by [Jules Roy](https://github.com/julesr0y). Circuit
> centrelines, published separately as `f1-geometry.db`, are © OpenStreetMap
> contributors, licensed under
> [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); their relation
> ids come from [Wikidata](https://www.wikidata.org/) (CC0). Car, circuit and
> race photographs are hosted on Wikimedia Commons, and each carries its own
> licence and credit, recorded per file in `article_images`. Current-season
> data, and the other driver and constructor records, are from formula1.com.
> Formula 1, F1 and Grand Prix are trademarks of Formula One Licensing BV;
> this project is unaffiliated with and unendorsed by Formula One or the FIA.

## Jolpica-F1 — CC BY-NC-SA 4.0, and why those rows are not committed

`tools/ergast_load.py` fills the full race classification from
[Jolpica-F1](https://github.com/jolpica/jolpica-f1), the maintained successor
to Ergast. Ergast's data was published under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — the
**non-commercial** clause makes it the most restrictive source used here, more
restrictive than the rest of this repository.

The same applies to the **database dumps** at
`https://api.jolpi.ca/data/dumps/download/`, which `tools/ergast_load.py
--from-dump` uses. The free tier needs no authentication and is delayed 14
days; it is explicitly **non-commercial**. Commercial use requires a
supporter API key. Using a dump instead of the API changes the mechanics of
the fetch and nothing about the licence.

Since v2.15 that restriction costs nothing. The classification itself comes
from F1DB under CC BY, so `race_entries` ships complete; `tools/ergast_load.py`
now runs as a **cross-check** rather than a source, recording where Jolpica
reads a race differently and overwriting nothing. Its rows are still never
committed — the build rule holds, and a row no fresh build could reproduce
does not belong in the distributed artefact — but nothing is missing without
them. What Jolpica still supplies uniquely is 628,454 lap times back to 1996,
which F1DB does not carry.

## Live timing data

`tools/fastf1_load.py` reads the Formula 1 live timing API through
[FastF1](https://github.com/theOehrly/Fast-F1) (MIT). That data is Formula One
Management's. FastF1's own guidance is that it is for personal and
non-commercial use, and this project neither redistributes it nor ships it.
`laps`, `stints`, `race_timing` and `race_control_messages` are empty in the
committed database and are filled only when *you* run the loader.

`pit_stops` and `team_radio` are **not** empty, and the difference matters.
Both hold rows from elsewhere — 22,472 pit stops from F1DB under CC BY 4.0,
and six radio exchanges quoted from Wikipedia race articles — so the rule for
them is by SOURCE, not by emptiness: a `pit_stops` row from anything but
`f1db`, or a `team_radio` row sourced `fastf1`, is FOM's and may not be
committed.

Do not commit any of them back. This is no longer only a request:
`verify.py` has a REDISTRIBUTION section that fails on all six conditions,
and CI runs it against the *committed* database before the rebuild, which is
the only moment such a commit can be caught. If you have deliberately loaded
timing onto a local copy, `F1_LOCAL_TIMING=1` downgrades those failures to
warnings so the rest of the suite is still usable — the load is legitimate,
the resulting file is simply not yours to publish.
