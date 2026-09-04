# Working on this database

## The one rule

**Never edit `f1.db` directly.** It is generated. `build.py` drops and rebuilds
it from scratch every run, so a hand-edit lasts until the next build and then
vanishes silently.

The source of truth is `data/*.py` and `harvest/*.txt`. Edit there.

```
data/*.py  +  harvest/*.txt          the sources you edit
        |
        v  python3 build.py          drops and rebuilds f1.db
     f1.db
        |
        v  python3 verify.py         121 checks; exit 1 on failure
        v  python3 audit.py          structural health report
        v  python3 export_json.py --compat
     f1_database.json, f1_compat.json
```

Or just `make all`.

## Where things live

| File | Holds |
|---|---|
| `data/seasons.py` | Champions, runners-up, season summaries |
| `data/drivers.py` | Driver register, verified career figures |
| `data/teams.py` | Constructors and lineage chains |
| `data/circuits.py` | Circuit register, layout timelines, race-layout overrides |
| `data/cars.py` | Car register, specs, `CAR_SEASONS`, `EXPECTED` |
| `data/events.py` | The canonical 53 Grands Prix, aliases, single-circuit map |
| `data/technical.py` | Regulations, innovations, engine eras, safety, points systems |
| `data/current.py` | The current season: entry list, standings, calendar |
| `data/people.py` | Designers, principals, officials |
| `data/radio.py` | The curated notable team radio |
| `data/harvest.py` | Loaders and name-resolution for the harvest files |
| `harvest/races.txt` | `year\|round\|gp\|winner\|constructor` |
| `harvest/poles.txt` | `year\|round\|pole\|fastest_lap\|winner` |
| `harvest/venues.txt` | `year\|round\|venue\|winner` |

Harvest files are plain pipe-delimited text on purpose: they diff cleanly, so
a data correction shows up as one readable line in a pull request.
`harvest/append.py` adds rows, checks the field count and flags duplicate
`(year, round)` pairs:

```bash
python3 harvest/append.py venues.txt 4 < new_rows.txt
```

## Adding data

**Every fact needs a `confidence` and, where there is one, a `source`.** The
ladder is `verified` > `high` > `reference` > `medium` > `unverified`.
`verified` means an official FIA or formula1.com source — nothing is promoted
to it without one.

If you cannot establish a figure, leave it `None`. A NULL means "not
established". It never means zero, and it is always better than a guess.

## Harvesting

The method that has caught every error in this project:

1. Harvest a structured table that **also contains a fact you already hold** —
   the race winner.
2. Reject any row whose known fact disagrees with what is stored. The build
   fails; it does not warn.
3. Reconcile the derived aggregates against independently held totals.

**The cross-checked fact must actually constrain the value you are
harvesting.** The winner constrains which race a row describes. It does not
constrain the chassis: a trial harvest of 1952 returned "Ferrari 125 F2" for
races Ascari won in a Ferrari 500, and every winner matched. Where your check
does not constrain the value, find a second table that does, or do not store
the value. This is why the chassis-per-race harvest is still an open gap.

## Adding checks

`verify.py` is the point of the project. If you add data that can be
cross-checked against something else in the database, add the check. Use
`check()` for a hard failure and `warn()` for something to keep an eye on.

The strongest checks here compare two things derived by different routes:
every driver's wins against the race records, every car's derived wins against
its published career total, every circuit's authored first/last GP against the
races stored at it.

## When sources disagree

Do not pick one silently. Record the disagreement in
`data/harvest.py: DECLARED_DISCREPANCIES`, and if you resolve it, record the
resolution in `CORRECTIONS` with the reasoning. `./f1 gaps` prints both.

## Before opening a pull request

```bash
make all        # build, verify, export
python3 audit.py
```

`verify.py` must exit 0. Commit the regenerated `f1_database.json` and
`f1_compat.json` — CI fails if the committed exports do not match a fresh
build.

## What not to commit

Anything from `tools/fastf1_load.py`. The `laps`, `stints`, `pit_stops`,
`race_control_messages` and non-notable `team_radio` rows are Formula One
Management's data, they are large, and they are meant to be loaded locally.
`.gitignore` covers the cache and the Parquet dumps; the tables themselves are
empty in a fresh build, so as long as you rebuild before committing, you are
fine.
