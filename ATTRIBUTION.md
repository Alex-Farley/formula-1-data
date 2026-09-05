# Sources, attribution and licensing

Read this before making the repository public. The code and the data are in
different positions, and the data has an obligation attached to it.

## Where the data came from

| Part | Source | Roughly how much |
|---|---|---|
| Race winners 1950–2026 | Wikipedia season articles | 1,161 races |
| Pole position and fastest lap 1950–2026 | Wikipedia season articles | 1,161 / 1,160 |
| Race venues 1950–2026 | Wikipedia season articles | 1,161 |
| Car specifications and design histories | Wikipedia per-car articles | 29 curated cars |
| Chassis specifications | Wikipedia per-car articles, `{{Racing car}}` infobox | see `harvest/car_specs.txt` |
| Chassis, engine and season-entrant register | [F1DB](https://github.com/f1db/f1db) | 1,153 chassis, 424 engines, 1,925 entrant rows |
| Circuit register and layout timelines | Wikipedia per-circuit articles | 80 circuits, 49 layouts |
| Notable team radio transcripts | Wikipedia per-race articles | 6 |
| 2026 season, entry list, standings, calendar | formula1.com | current season |
| Career totals (entries, starts, podiums, points) | formula1.com driver pages | 7 drivers at `verified` |
| Regulations, safety, technical, glossary, eras | Written for this project from general knowledge, at `medium`/`high` confidence | — |

Every row carries a `confidence` value and most carry a `source` URL. The
`source_registry` table records which sources are treated as authoritative.
`./f1 unverified` lists everything still sitting at `medium`.

## The obligation

There are two, from two different licences, and they are not the same shape.

### F1DB — CC BY 4.0

`harvest/chassis.txt`, `harvest/engines.txt`, `harvest/f1db_constructors.txt`
and `harvest/entrants.txt` are generated from
[F1DB](https://github.com/f1db/f1db), which is licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). That is
**attribution only — there is no share-alike**, so it places no condition on
how the rest of this database is licensed. It does require attribution, which
is given here, in the header of every generated file, in `source_registry`,
and in `tools/f1db_fetch.py`.

This is the most permissive licence of any bulk source used here, and it is
part of why F1DB was chosen.

### Wikipedia — CC BY-SA 4.0

**Wikipedia text is licensed CC BY-SA 4.0.** Bare facts — who won a race, how
long a circuit is — are not copyrightable, and a database of those facts is
yours to license as you wish. But this database also contains *prose taken
from or closely following* Wikipedia articles: the car design histories, the
circuit descriptions, some notes and glossary entries. That is expression, not
fact, and it carries CC BY-SA's attribution and **share-alike** requirements
with it.

In practice that means one of:

1. **License the data CC BY-SA 4.0** and attribute Wikipedia. Simplest, and
   what the content actually is today. Code can stay under a permissive
   licence separately — see below.
2. **Rewrite the prose fields in your own words** (`cars.story`,
   `cars.concept`, `cars.outcome`, `circuits.notes`, `circuits.characteristics`,
   `regulation_changes.detail`, `glossary.definition`, `technical_innovations.*`)
   — note that the harvested `chassis` specification fields are short factual
   values copied verbatim from an infobox ("Aluminium monocoque", "5-speed
   manual"), which is much closer to fact than to expression, but they were
   still taken from a CC BY-SA source
   and then license the remaining factual data however you like. This is real
   work but it is not enormous — it is a few hundred fields.
3. **Keep the repository private**, in which case none of this applies.

The database also quotes six team radio exchanges verbatim. They are short,
attributed, and used to document historical events, which is the ordinary
case for quotation — but they are quotations, not facts.

*This is a description of the licences involved, not legal advice.*

## Suggested arrangement

Two licences, which is normal for a data project:

- **Code** — `build.py`, `verify.py`, `audit.py`, `export_json.py`, `f1`,
  `tools/`, `schema.sql` — under MIT, or whatever you prefer.
- **Data** — `data/`, `harvest/`, `f1.db`, `f1_database.json` — under
  CC BY-SA 4.0, with attribution to Wikipedia contributors.

Add a `LICENSE` for the code and a `LICENSE-DATA` for the data, and say which
covers what in the README. I have deliberately not chosen for you.

## Attribution text

If you go with CC BY-SA, something like this in the README covers it:

> Race results, driver, constructor, circuit and car data in this repository
> are derived from Wikipedia and are licensed under
> [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
> The chassis, engine and season-entrant register is derived from
> [F1DB](https://github.com/f1db/f1db), licensed
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
> Current-season data is from formula1.com. Formula 1, F1 and Grand Prix are
> trademarks of Formula One Licensing BV; this project is unaffiliated with
> and unendorsed by Formula One or the FIA.

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

That is one of the reasons those 26,137 rows are loaded locally by you and are
not committed: `race_entries` in the distributed build holds only what the
Wikipedia harvest established. The other reason is the build rule — the
database is a function of the sources in this repository, and a row no fresh
build could reproduce does not belong in the committed artefact.

## Live timing data

`tools/fastf1_load.py` reads the Formula 1 live timing API through
[FastF1](https://github.com/theOehrly/Fast-F1) (MIT). That data is Formula One
Management's. FastF1's own guidance is that it is for personal and
non-commercial use, and this project neither redistributes it nor ships it:
the `laps`, `stints`, `pit_stops`, `race_control_messages` and `team_radio`
tables are empty in the committed database and are filled only when *you* run
the loader. Do not commit them back.
