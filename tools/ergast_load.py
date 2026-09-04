#!/usr/bin/env python3
"""
Load the full race classification into f1.db from the Jolpica-F1 API, the
maintained successor to Ergast.

WHY THIS IS A SCRIPT AND NOT PART OF THE BUILD
    26,137 result rows, 1950-2026: every classified finisher and retirement,
    with grid position, laps completed, retirement cause and points. That is
    an API job, not something a human can transcribe. An earlier attempt to
    relay these rows by hand introduced fabricated results into four of five
    sampled 2008 rows before the podium reconciliation caught it. Do not
    hand-edit harvest/podiums.txt; run this instead.

WHAT IT FILLS
    race_entries      one row per driver per race - position, grid, status,
                      laps, points, classified
    drivers.podiums   derived afterwards by build.py, and reconciled against
                      the official figures held in drivers.podiums_external

SELF-VALIDATING, like every other loader here
    * the race must already exist in this database (races come from the
      Wikipedia harvest, never from this source);
    * the winner this source reports must equal the winner already stored,
      or the race is refused outright rather than half-written;
    * a driver must resolve to a register entry - the script will not invent
      one. Unresolved ids are reported and their rows skipped.

INSTALL
    Nothing. Standard library only.

USE
    python3 tools/ergast_load.py                    # everything, 1950-2026
    python3 tools/ergast_load.py --years 1976       # one season
    python3 tools/ergast_load.py --years 2000-2010
    python3 tools/ergast_load.py --positions 1-3    # podiums only (fast)
    python3 tools/ergast_load.py --dry-run          # fetch and check, no write

    --db PATH     default ../f1.db
    --sleep N     seconds between requests (default 0.4; be polite)

A full load is about 270 requests and takes a few minutes.

EXIT CODE
    0 only when the run fetched everything it set out to. It exits 1 if any
    season could not be fetched, or if any row was skipped because its driver
    is not in the register - either leaves the classification incomplete, and
    verify.py has no completeness test that would catch it afterwards. The
    rows that did load are committed either way; this loader is idempotent,
    so the fix is to address what it reports and run it again.

IMPORTANT: build.py drops and rebuilds f1.db from scratch, so run this after
any rebuild. It is idempotent - rerunning replaces rows rather than
duplicating them.
"""
import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
DB = os.path.join(HERE, "f1.db")
BASE = "https://api.jolpi.ca/ergast/f1"
PAGE = 100

from data import results as RS          # noqa: E402  (id maps live here)


def fetch(url, tries=4):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "f1db/2.7 (+github)"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            wait = 2 ** attempt
            code = getattr(e, "code", None)
            if code == 429:
                wait = max(wait, 10)
            if attempt == tries - 1:
                raise
            print(f"  ! {e} - retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)


def season_results(year, sleep):
    """Every result row for one season, following pagination to the end."""
    out, offset = [], 0
    while True:
        d = fetch(f"{BASE}/{year}/results/?limit={PAGE}&offset={offset}")
        md = d["MRData"]
        races = md["RaceTable"]["Races"]
        for race in races:
            for res in race["Results"]:
                out.append({
                    "year": int(race["season"]),
                    "round": int(race["round"]),
                    "position": int(res["position"]),
                    "position_text": res["positionText"],
                    "driver": res["Driver"]["driverId"],
                    "constructor": res["Constructor"]["constructorId"],
                    "grid": int(res.get("grid") or 0),
                    "laps": int(res.get("laps") or 0),
                    "status": res.get("status"),
                    "points": float(res.get("points") or 0),
                })
        offset += PAGE
        if offset >= int(md["total"]):
            return out
        time.sleep(sleep)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", default="1950-2026",
                    help="a season, or a range like 2000-2010")
    ap.add_argument("--positions", default=None,
                    help="only these finishing positions, e.g. 1-3")
    ap.add_argument("--db", default=DB)
    ap.add_argument("--sleep", type=float, default=0.4)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    lo, _, hi = a.years.partition("-")
    lo, hi = int(lo), int(hi or lo)
    pmin, pmax = 1, 99
    if a.positions:
        x, _, y = a.positions.partition("-")
        pmin, pmax = int(x), int(y or x)

    con = sqlite3.connect(a.db)
    con.execute("PRAGMA foreign_keys=ON")
    cur = con.cursor()

    resolve = RS.make_resolver(cur)
    unresolved = set()

    known_cons = {r[0] for r in cur.execute("SELECT id FROM constructors")}
    totals = dict(rows=0, races=0, skipped_race=0, skipped_driver=0, refused=0)
    missing_cons = set()

    failed_years = []
    for year in range(lo, hi + 1):
        try:
            rows = season_results(year, a.sleep)
        except Exception as e:                                   # noqa: BLE001
            print(f"{year}: {e}", file=sys.stderr)
            failed_years.append(year)
            continue
        if not rows:
            continue

        by_race = {}
        for r in rows:
            by_race.setdefault(r["round"], []).append(r)

        loaded = refused = 0
        for rnd, entries in sorted(by_race.items()):
            hit = cur.execute("SELECT id FROM races WHERE year=? AND round=?",
                              (year, rnd)).fetchone()
            if hit is None:
                totals["skipped_race"] += 1
                continue
            rid = hit[0]

            # winner cross-check, before anything is written for this race
            stored = cur.execute("""SELECT driver_id FROM race_entries
                WHERE race_id=? AND finish_position=1 ORDER BY id LIMIT 1""",
                (rid,)).fetchone()
            theirs = [e for e in entries if e["position"] == 1]
            if stored and theirs:
                got = {resolve(e["driver"]) for e in theirs}
                if stored[0] not in got:
                    print(f"  REFUSED {year} r{rnd}: winner mismatch - "
                          f"source says {sorted(x for x in got if x)}, "
                          f"stored is {stored[0]}", file=sys.stderr)
                    refused += 1
                    totals["refused"] += 1
                    continue

            share = {}
            for e in entries:
                share.setdefault(e["position"], []).append(e["driver"])

            for e in entries:
                if not (pmin <= e["position"] <= pmax):
                    continue
                did = resolve(e["driver"])
                if did is None:
                    unresolved.add(e["driver"])
                    totals["skipped_driver"] += 1
                    continue
                cid = RS._resolve_constructor(e["constructor"])
                if cid and cid not in known_cons:
                    missing_cons.add(e["constructor"])
                    cid = None
                # Pole belongs to the pole harvest: this source hands the
                # car's grid slot to every driver who shared it, so accepting
                # grid 1 here invents poles for co-drivers.
                grid = e["grid"] if e["grid"] > 1 else None
                classified = 1 if e["position_text"].isdigit() else 0
                shared = 1 if len(share[e["position"]]) > 1 else 0
                if a.dry_run:
                    loaded += 1
                    continue
                cur.execute("""INSERT INTO race_entries (race_id, driver_id,
                        constructor_id, finish_position, grid, classified,
                        status, laps_completed, points, shared_drive,
                        confidence, source)
                    VALUES (?,?,?,?,?,?,?,?,?,?,'reference',?)
                    ON CONFLICT (race_id, driver_id) DO UPDATE SET
                        constructor_id  = COALESCE(excluded.constructor_id,
                                                   constructor_id),
                        finish_position = MIN(COALESCE(finish_position, 99),
                                              excluded.finish_position),
                        grid            = COALESCE(grid, excluded.grid),
                        classified      = excluded.classified,
                        status          = excluded.status,
                        laps_completed  = excluded.laps_completed,
                        points          = excluded.points,
                        shared_drive    = MAX(shared_drive,
                                              excluded.shared_drive)""",
                    (rid, did, cid, e["position"], grid, classified,
                     e["status"], e["laps"], e["points"], shared,
                     f"{BASE}/{year}/results/"))
                loaded += 1
            totals["races"] += 1

        if not a.dry_run:
            con.commit()
        totals["rows"] += loaded
        print(f"{year}: {loaded} entries across {len(by_race)} races"
              + (f", {refused} refused" if refused else ""))
        time.sleep(a.sleep)

    # Podiums are derivable ONLY from a complete classification. On a partial
    # load they are not: race_entries already holds a winner for all 1,161
    # races, so counting finish_position 1-3 after loading one season returns
    # that driver's win count plus the handful of podiums just fetched, and
    # writes it over the authored figure - Lauda 54 becomes 25, Hamilton 207
    # becomes 106. build.py guards the same derivation for the same reason;
    # this has to as well, because --years and --positions are documented
    # above as ordinary ways to run it.
    #
    # Completeness is measured from the rows, not from the flags: a run over
    # the full range that refused most of its races is just as partial as a
    # one-season one, and only the data can tell the two apart.
    held = cur.execute(
        "SELECT COUNT(*) FROM races WHERE status='completed'").fetchone()[0]
    covered = cur.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
        WHERE finish_position = 2""").fetchone()[0]
    whole = covered >= held and pmin <= 1 and pmax >= 3
    if not a.dry_run and whole:
        cur.execute("""UPDATE drivers SET podiums = (
                SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                WHERE e.driver_id = drivers.id
                  AND e.finish_position BETWEEN 1 AND 3)""")
        con.commit()
        derived = True
    else:
        derived = False

    print("\n" + "-" * 62)
    print(f"  {totals['rows']} entries across {totals['races']} races"
          + ("  (dry run, nothing written)" if a.dry_run else ""))
    if totals["refused"]:
        print(f"  {totals['refused']} races REFUSED on a winner mismatch")
    if totals["skipped_race"]:
        print(f"  {totals['skipped_race']} races not in this database, skipped")
    if totals["skipped_driver"]:
        print(f"  {totals['skipped_driver']} rows skipped, driver not in the "
              f"register: {', '.join(sorted(unresolved)[:20])}")
        print(f"  Add them to PODIUM_ONLY_DRIVERS in data/results.py, rebuild, "
              f"and rerun.")
    if missing_cons:
        print(f"  constructors not in the register, stored as NULL: "
              f"{', '.join(sorted(missing_cons))}")
    if not a.dry_run and not derived:
        print(f"  drivers.podiums LEFT ALONE: {covered} of {held} races have "
              f"a second place, and positions {pmin}-{pmax} were in scope. "
              f"Deriving podiums from a partial classification would write "
              f"each driver's win count over the authored figure. Load every "
              f"season, then rerun.")
    elif not a.dry_run:
        print(f"  drivers.podiums rederived from all {covered} races")
    print("\n  Now run:  python3 verify.py")
    print("  The podium reconciliation there compares the derived counts")
    print("  against the official figures and is what proves this load.")

    # An incomplete load must not exit 0. A caller chaining this into
    # `... && python3 verify.py` would otherwise treat a run that dropped
    # whole seasons, or every row belonging to a driver the register does not
    # hold, as a load worth checking - and verify.py has no completeness test
    # for the classification, only a warning when none of it is present.
    #
    # Skipped drivers are reported rather than invented: registering a driver
    # from the results feed is what this loader exists to prevent, and the
    # register is authored with provenance per driver. The documented loop is
    # to add them to PODIUM_ONLY_DRIVERS, rebuild and rerun; a non-zero exit
    # is what makes that loop visible instead of optional.
    problems = []
    if failed_years:
        problems.append(f"{len(failed_years)} season(s) could not be fetched: "
                        + ", ".join(str(y) for y in failed_years))
    if unresolved:
        problems.append(f"{totals['skipped_driver']} row(s) skipped for "
                        f"{len(unresolved)} driver(s) not in the register")
    if problems:
        print("\n  INCOMPLETE LOAD - this run did not fetch the whole "
              "classification:")
        for problem in problems:
            print(f"    - {problem}")
        print("  Rows that did load are committed, and this loader is "
              "idempotent, so fix the above and rerun.")
        sys.exit(1)


if __name__ == "__main__":
    main()
