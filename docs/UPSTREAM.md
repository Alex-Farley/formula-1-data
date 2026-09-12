# The upstream dependency

**Status:** recorded. Nothing changes today; this page exists so that the
day F1DB stops, changes shape or changes licence is met with a plan that was
written while nothing was wrong.

## What comes from it

[F1DB](https://github.com/f1db/f1db) is a versioned, openly licensed
(CC BY 4.0) database of Formula One results and registers, re-released after
every race with a public commit history. Since v2.15 it is this project's
primary source for results as well as registers. At v2.23 it is the cited
source of 115,162 of the database's 119,279 table rows — about 96 per cent —
and every row of these tables:

| Table | Rows | What F1DB supplies |
|---|---|---|
| `standings` | 34,498 of 34,563 | championship standings after every round |
| `qualifying` | 26,997 | every qualifying sheet |
| `race_entries` | 26,318 of 27,482 | the full classification of every race |
| `pit_stops` | 22,481 | lap and order of every stop |
| `season_entrants` | 1,925 | who entered what, season by season |
| `chassis` | 1,153 | every chassis that has raced |
| `sprint_results` | 590 | every sprint classification |
| `engines` | 424 | the engine register |
| `drivers` | 680 of 862 | rows admitted to the register from F1DB's |
| `constructors` | 95 of 150 | likewise |

The figures are a query, not a fact to maintain:

```sql
SELECT COUNT(*) FROM race_entries WHERE source LIKE '%f1db%';
```

What does **not** come from it, and stands on its own: the winner, pole and
fastest lap of every race (`harvest/races.txt`, `poles.txt`, hand-written
from Wikipedia and cross-checked against F1DB, not replaced by it); the
seasons table with every champion and runner-up; the circuits; the car
specifications (`tools/wikispec_fetch.py`, from each chassis's own article);
the regulation limits (FIA documents); the centrelines (OpenStreetMap, shipped
separately); and every derived table, `records` among them.

## How it arrives

`tools/f1db_fetch.py` clones F1DB, reads its YAML and rewrites the generated
files in `harvest/` — pipe-delimited text, one row per line, with the F1DB
version and commit in the header of every file. The build reads those files
and never the network. **The repository holds a snapshot**, and the snapshot
is what `build.py` turns into `f1.db`; the version in play is stated in
`README.md` and in `meta`.

`.github/workflows/refresh.yml` runs the fetch daily at 06:00 UTC. If the
harvest has not changed it stops there. If it has, it rebuilds, runs
`verify.py`, the loader unit tests, the JSON export, the site build and the
site's tests, and commits the refreshed harvest and artefacts to `main` only
when every one of them passes. A refresh that fails commits nothing and the
site keeps the last good snapshot.

## What refuses a bad load

Four cross-checks hold facts this project held before F1DB was read, and a
load that disagrees with them fails the build rather than overwriting them:

1. the winner of every one of the 1,161 races, from the hand-written harvest
   — a race whose classification disagrees is refused whole;
2. the champion, the runner-up and both point totals for every season in
   `seasons`, which the final standings must reproduce;
3. qualifying position 1 against the pole-sitter already stored — the 13
   races that differ are grid penalties and sprint weekends, each recorded;
4. the (constructor, season) → chassis mapping against the `CAR_SEASONS`
   assertions proved against published win totals.

A change in F1DB's shape — a renamed field, a moved file — stops the fetch
tool, which reads fields by name; a change in its content that these four
cannot see would land, which is why `discrepancies` exists and why the
standings are compared with formula1.com's after every round.

## If F1DB stops

Nothing breaks. The snapshot builds forever, offline, and the committed
database stays exactly as redistributable as it was. What happens is
**staleness**: the daily refresh fails at the clone, commits nothing, and
the site goes on showing the last race in the snapshot as the most recent,
and the next one as still to come. That is visible — the calendar page and
the season page both date the build — but nobody is told; a failing
scheduled workflow is an email to the repository owner and nothing more.

The replacements, in order of how much they cost:

- **Jolpica-F1** (the Ergast successor) holds the same facts under
  CC BY-NC-SA. The non-commercial clause means its rows may be loaded onto a
  local copy and never into the committed database — the position
  `known_gaps` #1 stood in for seven versions. A fallback for a private
  build, not for the published one.
- **formula1.com** is classified facts-only: the results are facts and may
  be re-stated, its text and images may not. A loader would have to be
  written; the four cross-checks above would gate it as they gate F1DB.
- **The hand-written harvest** already carries the winner, pole and fastest
  lap of every race and the champion of every season, so the register of
  what happened never depends on F1DB; only the full classification does.

## If F1DB changes licence

The licence a snapshot was received under does not change under it.
CC BY 4.0 is irrevocable for material already received (its section 6(a)),
so the committed harvest stays redistributable with attribution whatever a
later release is licensed as. What must not happen is a *later* release
being fetched under the old assumption: the fetch tool stamps every header
"CC BY 4.0" from a constant, not from F1DB's licence file, so a relicensed
release would be fetched, stamped with the old licence, rebuilt, and — if the
four cross-checks passed — committed and deployed by the refresh workflow
before anyone read it. That is the one path by which this project could
publish something it may not, and it is filed (`PM-27`): the fetch tool
should read F1DB's licence and stop when it is not the one classified in
`SOURCE_LICENCE`.

## Who to tell

F1DB is maintained in the open at github.com/f1db/f1db; a data error found
here that traces to it is theirs to fix upstream, and is reported there
rather than corrected by hand in a generated file — a hand edit lasts until
the next fetch. `known_gaps` records the one case so far where F1DB's
classification omits entries its own qualifying sheet holds (the two 2011
Melbourne 107 per cent exclusions).
