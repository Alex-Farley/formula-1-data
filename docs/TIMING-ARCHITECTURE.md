# Where the timing data goes, and why the answer is "nowhere, yet"

**Status:** decided. No code changes follow from it today, which is the point of
writing it down — the decision that nothing should change is worth as much as
the other kind, and it is the one most likely to be quietly reversed by someone
who has not checked.

`laps`, `stints`, `race_timing` and `race_control_messages` are empty in the
committed database, and the front end has no lap chart. It would be easy to
read that as an unfinished feature, and easy to reach for an architecture — a
range-request VFS, a second database, a lazy fetch — to make room for it.

Before reaching for any of that, check the licences. They settle it first.

## The binding constraint is a licence, not a byte count

There is no redistributable source of Formula One lap times.

| Source | Lap times | Licence | Can this project ship it? |
|---|---|---|---|
| **Jolpica-F1** | 628,454 laps, 1996– | CC BY-**NC**-SA 4.0 | **No.** Non-commercial. |
| **FastF1** | 2018–, with sectors | FOM's data; personal, non-commercial use | **No.** |
| **OpenF1** | 2023–, telemetry | FOM's data | **No.** |
| **F1DB** | none | CC BY 4.0 | Nothing to ship. |

F1DB is the one source here whose licence permits redistribution, and it is why
the full classification, qualifying, standings and **22,481 pit stops** are in
the committed database. It does not publish lap times.

So the empty tables are not a gap in the harvest. They are the correct and
permanent state until a source appears that both has the data and permits
passing it on. `tools/ergast_load.py --from-dump --timing` fills them **on your
own machine**, which is exactly what it is for and all it is for.

## What follows for the front end: nothing

The whole-download design — fetch `f1.db` once, keep it in IndexedDB, query it
in a worker — has been carrying an unstated worry that timing data would one day
make the file too big to download and force a rewrite. It will not, because the
data cannot ship. There is no ceiling approaching, and no reason to trade a
design that works offline for one that needs a live server.

Prerendering removed the other half of the argument. A first visit no longer
waits on the 4.5 MB download to show anything: the page is already there in
static HTML and the app replaces it when the database is open. The remaining
cost is paid behind something the reader can read.

**Do not rebuild the data layer.** If someone proposes it, the question to ask
is which of these two facts has changed.

## If a redistributable source ever appears

The likeliest change is F1DB adding lap times, since it already carries pit
stops under CC BY 4.0. If that happens, the design question becomes live, and
the measurement is done — a synthetic table at the real row count (628,454) and
the real column types:

| | raw | gzipped |
|---|---|---|
| Today's whole database (`f1.db`) | 20.1 MB | 4.5 MB |
| Timing, with sector times and speed traps | **75.4 MB** | 33.7 MB |
| Timing, lap times only | 55.9 MB | 15.1 MB |

And the number that decides it. Laps for one race are contiguous on disk,
because they are inserted in race order under an index of
`(race_id, lap_number)`:

| One race's laps | ~900–1,400 rows |
|---|---|
| Bytes they occupy | **~110 KB**, contiguous |
| Share of the file | **0.15%** |

**The answer would be a second database, served over HTTP range requests, not a
bigger `f1.db`.** Adding 75 MB to the core file to give every reader a lap chart
most will never open is eight times the current site's payload; fetching 110 KB
when they do open one is three hundred times less work. Two other constraints
point the same way and each is sufficient on its own:

- **The repository.** `f1.db` is committed and refreshes weekly. SQLite files do
  not delta-compress — four commits in one session took `.git` from 13 MB to
  34 MB — so a 75 MB file refreshed weekly is gigabytes a year in a repository
  people clone. Same reasoning that moved `f1_database.json` to a release asset.
- **The build.** `f1.db` is a pure function of its sources: the same inputs
  rebuild to the same bytes. CI checks the committed artefacts on that basis and
  the reader's cache is keyed on a digest of the file, which is why `BUILT` is a
  constant and not a clock. Timing changes on its own cadence and would
  otherwise invalidate every reader's copy of the registers whenever a lap
  arrived.

Practical notes for whoever builds it:

- **Serve it uncompressed.** You cannot range into a gzip stream. The 75 MB sits
  on the host; ~110 KB per race crosses the wire.
- **Page size 8192.** A race's laps span 28 pages at 4 KB, 14 at 8 KB, 2 at
  64 KB. The bytes are identical, so this is round trips against read
  amplification on small lookups, and 8 KB is the sensible middle.
- **Index for locality, not only for speed.** The 110 KB figure holds *only*
  because a race's laps are contiguous. Any load order that interleaves races
  turns one range request into hundreds. Insert in race order, then `VACUUM`.
- **Keep the manifest pattern.** `db-manifest.json` already carries a content
  digest that makes a year-long immutable cache safe. A timing file needs its
  own entry, its own digest and the same cache rules.
- **Degrade to nothing.** A missing or unreachable timing database must leave
  every existing page working. It is an addition to the site, never a dependency
  of it.
- **Check the host serves ranges.** Cloudflare's static assets do. Verify
  anywhere else before relying on it.

## Before any of that is worth starting

1. A source with lap times **and** a licence that permits redistribution.
2. A build stage writing them to a **separate** reproducible file. `build.py` is
   34 named stages now, so this is another entry in `STAGES`, not surgery.
3. That file published as a release asset, never committed.

Until (1), the tables stay empty and the database says so, which is what
`known_gaps` #5 and #6 records and what `./f1 gaps` prints.
