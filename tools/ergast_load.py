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

TWO WAYS IN
    The API pages through ~270 requests. The database dump is one
    hash-verified zip. Both produce identical rows - `--verify-dump` proves
    it - and everything downstream, including the winner cross-check, is
    shared rather than written twice.

    Prefer the dump for history. The reason is not speed: it is that a dump
    is one consistent snapshot with a SHA256, so a load can be pinned and
    reproduced, where paging a live API for minutes leaves a seam between
    pages if the data moves under you. That seam is where v2.7's hand-relayed
    rows were fabricated.

    The free tier lags 14 days, which costs nothing for 1950-2025 and does
    matter for the current season - a race run since the dump was cut simply
    is not in it, and the winner cross-check cannot fire on rows that never
    arrived. The loader detects that and says so rather than exiting clean.

    The licence is unchanged either way: Ergast data is CC BY-NC-SA and the
    free dump tier is explicitly non-commercial. These rows are never
    committed to this repository. See ATTRIBUTION.md.

USE
    python3 tools/ergast_load.py                    # everything, 1950-2026
    python3 tools/ergast_load.py --from-dump        # the same, from one zip
    python3 tools/ergast_load.py --verify-dump 8    # diff the two, load none
    python3 tools/ergast_load.py --from-dump \
        --dump-sha256 617bd037...                   # pin an exact snapshot
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

DUMP_INDEX = "https://api.jolpi.ca/data/dumps/download/"
DUMP_CACHE = os.path.join(HERE, ".jolpicadump")

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
                    # The id alone is not enough to identify a person. Jolpica
                    # gives Emerson Fittipaldi the id `emerson_fittipaldi` and
                    # his brother Wilson the bare `fittipaldi`, and a resolver
                    # matching on surname hands Wilson's Brabham results to
                    # Emerson. Carry the name the source actually states.
                    "driver_name": " ".join(x for x in (
                        res["Driver"].get("givenName"),
                        res["Driver"].get("familyName")) if x),
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


# =====================================================================
# The database dump, an alternative to 270 paginated requests.
#
# https://api.jolpi.ca/data/dumps/download/ advertises a zipped set of CSVs
# with a SHA256 and an upload timestamp. The free tier is delayed 14 days and
# needs no authentication; the latest dump needs a supporter key.
#
# The reason to prefer it is NOT that it is one request instead of 270. It is
# that a dump is a snapshot with a hash: the whole load comes from one
# consistent state of their database, it can be pinned, and it can be
# re-verified. Paging through a live API for several minutes cannot promise
# any of that - a mid-load update leaves a seam between pages, and the seam
# between pages is exactly where v2.7's hand-relayed rows were fabricated.
#
# For history the 14-day delay costs nothing: 1950-2025 does not change.
#
# What it does NOT change is the licence. Ergast's data is CC BY-NC-SA and
# the free dump tier is explicitly non-commercial, so these rows still are
# not committed to this repository. See ATTRIBUTION.md.
#
# One thing that turned out better than expected: `sessionentry.detail` holds
# the same human-readable status text the API returns ("Finished", "+1 Lap",
# "Engine"), so nothing here has to decode Jolpica's integer status enum
# against a definition that lives in their model source. The integer is
# carried too, and the two are checked against each other.
# =====================================================================

# sessionentry.status is an integer enum whose meaning lives in Jolpica's
# model source. It is NOT used to fill anything - `detail` supplies the text -
# but a row whose integer contradicts its text means the dump's shape has
# changed underneath this script, and that is worth failing on.
STATUS_CLASS = {
    "0": "finished", "1": "lapped", "10": "accident", "11": "mechanical",
    "20": "disqualified", "30": "did not participate", "40": "other",
}


def dump_index():
    return json.loads(fetch_bytes(DUMP_INDEX).decode("utf-8"))


def fetch_bytes(url, tries=4):
    req = urllib.request.Request(url, headers={
        "User-Agent": "formula-1-data/2.9 (+https://github.com/Alex-Farley/"
                      "formula-1-data)"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except Exception as e:                                   # noqa: BLE001
            if attempt == tries - 1:
                raise
            wait = 2 ** (attempt + 1)
            print(f"  ! {e} - retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)


def get_dump(tier, expect_hash=None):
    """Download (or reuse) the dump and return its path.

    The advertised SHA256 is checked on every use, cached copy included. A
    dump that does not match what the index says it is gets deleted rather
    than read: half a download and a tampered file look the same from here.
    """
    import hashlib
    index = dump_index()
    key = f"{tier}_dumps"
    if key not in index or "csv" not in index[key]:
        sys.exit(f"the dump index offers no {tier} csv dump; it lists "
                 f"{sorted(index.get('available_types', []))}")
    meta = index[key]["csv"]
    want = expect_hash or meta["file_hash"]
    os.makedirs(DUMP_CACHE, exist_ok=True)
    path = os.path.join(DUMP_CACHE, f"jolpica-{want[:12]}.zip")

    def digest(p):
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()

    if os.path.exists(path) and digest(path) == want:
        print(f"  dump {want[:12]} already cached ({os.path.getsize(path) / 1e6:.1f} MB)")
        return path, meta
    print(f"  fetching the {tier} dump, {meta['file_size'] / 1e6:.1f} MB, "
          f"uploaded {meta['uploaded_at'][:10]}")
    blob = fetch_bytes(meta["download_url"])
    got = hashlib.sha256(blob).hexdigest()
    if got != want:
        sys.exit(f"dump hash mismatch: the index advertises {want}, the "
                 f"download is {got}. Not reading it.")
    with open(path, "wb") as f:
        f.write(blob)
    print(f"  sha256 {got[:12]} verified against the index")
    return path, meta


def dump_table(z, name, *cols):
    """Rows of one CSV in the dump, as dicts, checking the columns exist.

    Shared by both readers so neither can drift into trusting a layout the
    other checks. Columns are addressed by name throughout: Jolpica
    guarantees the names and explicitly not their order.
    """
    import csv
    import io

    want = f"formula_one_{name}.csv"
    if want not in z.namelist():
        sys.exit(f"the dump has no {want}; its layout has changed")
    with z.open(want) as f:
        r = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8"))
        missing = [c for c in cols if c not in (r.fieldnames or [])]
        if missing:
            sys.exit(f"{want} is missing column(s) {missing}; the dump's "
                     f"layout has changed. Columns are addressed by name on "
                     f"purpose - Jolpica guarantees the names but explicitly "
                     f"not their order.")
        for row in r:
            yield row


def dump_results(path):
    """Every race result in the dump, as {year: [row, ...]}.

    Rows come out in the same shape season_results() produces from the API,
    so everything downstream - the winner cross-check, the driver resolution,
    the insert - is shared between the two paths rather than written twice.
    """
    import zipfile

    z = zipfile.ZipFile(path)

    def table(name, *cols):
        return dump_table(z, name, *cols)

    season = {r["id"]: int(r["year"]) for r in table("season", "id", "year")}
    # `number` is the round within its season, which is what races.round
    # holds. `race_number` is a global counter across all history - the 1951
    # Swiss Grand Prix is round 1 and race 8 - and using it would put every
    # row against the wrong race.
    #
    # A cancelled round has no number at all: the 2026 Saudi Arabian Grand
    # Prix is the only one, and it is skipped rather than defaulted.
    rounds = {}
    for r in table("round", "id", "season_id", "number", "is_cancelled"):
        if r["is_cancelled"] == "t" or not r["number"]:
            continue
        rounds[r["id"]] = (r["season_id"], int(r["number"]))
    # Race sessions only. The dump also carries qualifying, practice and
    # sprints; a sprint is a race but it is not a Grand Prix result and this
    # database keeps them apart.
    sessions = {r["id"]: r["round_id"]
                for r in table("session", "id", "round_id", "type",
                               "is_cancelled")
                if r["type"] == "R" and r["is_cancelled"] != "t"}
    drivers = {r["id"]: (r["reference"],
                         " ".join(x for x in (r["forename"], r["surname"]) if x))
               for r in table("driver", "id", "reference", "forename", "surname")}
    teams = {r["id"]: r["reference"] for r in table("team", "id", "reference")}
    team_driver = {r["id"]: (r["driver_id"], r["team_id"])
                   for r in table("teamdriver", "id", "driver_id", "team_id")}
    round_entry = {r["id"]: r["team_driver_id"]
                   for r in table("roundentry", "id", "team_driver_id")}

    out, bad_status = {}, []
    for r in table("sessionentry", "session_id", "round_entry_id", "position",
                   "grid", "laps_completed", "points", "status", "detail",
                   "is_classified", "round_entry_id"):
        rid = sessions.get(r["session_id"])
        if rid is None or rid not in rounds or not r["position"]:
            continue
        td = team_driver.get(round_entry.get(r["round_entry_id"], ""), None)
        if td is None:
            continue
        ref, name = drivers.get(td[0], (None, None))
        if ref is None:
            continue
        season_id, number = rounds[rid]
        # The integer enum and the text must agree about whether the car
        # finished. They are two encodings of one fact and a disagreement
        # means the dump's shape has moved.
        if r["status"] == "0" and r["detail"] and r["detail"] != "Finished":
            bad_status.append((r["status"], r["detail"]))
        out.setdefault(season[season_id], []).append({
            "year": season[season_id],
            "round": number,
            "position": int(r["position"]),
            # The API's positionText is "1", "R", "D" and so on; the dump
            # says the same thing in a boolean, which is what it is used for.
            "position_text": "1" if r["is_classified"] == "t" else "R",
            "driver": ref,
            "driver_name": name,
            "constructor": teams.get(td[1], ""),
            "grid": int(r["grid"] or 0),
            "laps": int(r["laps_completed"] or 0),
            "status": r["detail"] or None,
            "points": float(r["points"] or 0),
        })
    if bad_status:
        sys.exit(f"the dump's status enum and its detail text disagree on "
                 f"{len(bad_status)} rows, e.g. {bad_status[:3]}. Jolpica's "
                 f"encoding has changed; check STATUS_CLASS before trusting "
                 f"this load.")
    return out


def compare_dump_to_api(a, lo, hi):
    """Read the same races from the dump and from the API and diff them.

    The dump is faster, hashable and consistent, but it is a second
    implementation of the same fetch and a second implementation is a second
    place to be wrong. The API resolves the status enum, names the driver and
    the constructor, and has been the reference here since v2.7 - so it is
    what the dump is checked against, not the other way round.

    Returns a message on disagreement and None when they match.
    """
    import random
    path, meta = get_dump(a.dump_tier, a.dump_sha256)
    dumped = dump_results(path)
    years = [y for y in range(lo, hi + 1) if dumped.get(y)]
    if not years:
        return "the dump holds no races in that range"

    def key(rows):
        return {(r["year"], r["round"], r["driver"]): (
            r["position"], r["position_text"].isdigit(), r["constructor"],
            r["grid"], r["laps"], r["status"], r["points"]) for r in rows}

    random.seed(0)                     # a repeatable sample, not a lucky one
    picks = random.sample(years, min(a.verify_dump, len(years)))
    bad = 0
    for year in sorted(picks):
        api = key(season_results(year, a.sleep))
        dmp = key(dumped[year])
        if api == dmp:
            print(f"  {year}: {len(api)} rows identical")
            continue
        bad += 1
        only_api = sorted(set(api) - set(dmp))
        only_dmp = sorted(set(dmp) - set(api))
        differ = [k for k in set(api) & set(dmp) if api[k] != dmp[k]]
        print(f"  {year}: DIFFERS - {len(only_api)} only in the API, "
              f"{len(only_dmp)} only in the dump, {len(differ)} disagree")
        for k in (only_api[:3] + only_dmp[:3]):
            print(f"      {k}")
        for k in differ[:3]:
            print(f"      {k}\n        api  {api[k]}\n        dump {dmp[k]}")
    if bad:
        return (f"{bad} of {len(picks)} sampled seasons disagree between the "
                f"dump and the API. Do not load from the dump until this is "
                f"understood.")
    print(f"\n  {len(picks)} seasons sampled, every row identical. "
          f"dump {meta['file_hash'][:12]}, uploaded {meta['uploaded_at'][:10]}")
    return None


def dump_timing(path, want_years):
    """Race laps and pit stops from the dump.

    Only the dump has these: the Ergast-compatible API this loader otherwise
    uses does not expose per-lap timing at all. 628,454 race laps covering
    1996-2026, and 12,627 pit stops covering 2011-2026 - which reaches
    twenty-two seasons further back than FastF1's 2018 floor.

    Returns (laps, stops) keyed by (year, round).
    """
    import zipfile

    z = zipfile.ZipFile(path)

    def table(name, *cols):
        return dump_table(z, name, *cols)

    def secs(t):
        if not t:
            return None
        h, m, rest = t.split(":")
        return int(h) * 3600 + int(m) * 60 + float(rest)

    season = {r["id"]: int(r["year"]) for r in table("season", "id", "year")}
    rounds = {}
    for r in table("round", "id", "season_id", "number", "is_cancelled"):
        if r["is_cancelled"] != "t" and r["number"]:
            rounds[r["id"]] = (season[r["season_id"]], int(r["number"]))
    sessions = {r["id"]: rounds[r["round_id"]]
                for r in table("session", "id", "round_id", "type",
                               "is_cancelled")
                if r["type"] == "R" and r["is_cancelled"] != "t"
                and r["round_id"] in rounds}
    drivers = {r["id"]: (r["reference"], r["abbreviation"] or None,
                         " ".join(x for x in (r["forename"], r["surname"]) if x))
               for r in table("driver", "id", "reference", "abbreviation",
                              "forename", "surname")}
    team_driver = {r["id"]: r["driver_id"]
                   for r in table("teamdriver", "id", "driver_id")}
    round_entry = {r["id"]: r["team_driver_id"]
                   for r in table("roundentry", "id", "team_driver_id")}
    # session entry -> (year, round, driver reference, abbreviation, name)
    entry = {}
    for r in table("sessionentry", "id", "session_id", "round_entry_id"):
        where = sessions.get(r["session_id"])
        if where is None or where[0] not in want_years:
            continue
        d = drivers.get(team_driver.get(round_entry.get(r["round_entry_id"], ""), ""))
        if d:
            entry[r["id"]] = (where, d)

    laps, stops, lap_row, unnumbered = {}, {}, {}, []
    for r in table("lap", "id", "session_entry_id", "number", "position",
                   "time", "is_deleted", "is_entry_fastest_lap"):
        e = entry.get(r["session_entry_id"])
        if e is None or not r["number"]:
            continue
        where, d = e
        rec = {
            "driver_ref": d[0], "code": d[1], "driver_name": d[2],
            "lap": int(r["number"]),
            "position": int(r["position"]) if r["position"] else None,
            "seconds": secs(r["time"]),
            "deleted": 1 if r["is_deleted"] == "t" else 0,
            "fastest": 1 if r["is_entry_fastest_lap"] == "t" else 0,
        }
        laps.setdefault(where, []).append(rec)
        lap_row[r["id"]] = (where, rec["lap"])

    for r in table("pitstop", "session_entry_id", "lap_id", "number",
                   "duration"):
        e = entry.get(r["session_entry_id"])
        if e is None:
            continue
        where, d = e
        # A stop with no number cannot be keyed. pit_stops is unique on
        # (race, source, driver, stop_number), and SQLite treats NULLs as
        # distinct in a unique index - so a NULL stop_number would make
        # INSERT OR REPLACE append instead of replace, and every rerun would
        # add another copy. The dump has no such row today; skipping keeps
        # the loader idempotent if that ever changes.
        if not r["number"]:
            unnumbered.append((where, d[0]))
            continue
        ln = lap_row.get(r["lap_id"])
        stops.setdefault(where, []).append({
            "driver_ref": d[0], "code": d[1], "driver_name": d[2],
            "stop": int(r["number"]),
            "lap": ln[1] if ln else None,
            # Around 20-30 seconds: this is pit LANE time, entry to exit, not
            # the two or three the car is stationary. It goes in the column
            # that says so.
            "lane_seconds": secs(r["duration"]),
        })
    if unnumbered:
        print(f"  {len(unnumbered)} pit stop(s) in the dump have no stop "
              f"number and cannot be keyed; skipped", file=sys.stderr)
    return laps, stops


def load_timing(cur, path, lo, hi, resolve, dry_run):
    """Write the dump's laps and pit stops, and report what could not be."""
    want = set(range(lo, hi + 1))
    laps, stops = dump_timing(path, want)
    races = {(y, r): rid for rid, y, r in cur.execute(
        "SELECT id, year, round FROM races")}
    n_lap = n_stop = 0
    skipped_race, skipped_driver = set(), set()
    for where, rows in sorted(laps.items()):
        rid = races.get(where)
        if rid is None:
            skipped_race.add(where)
            continue
        for r in rows:
            did = resolve(r["driver_ref"], r["driver_name"])
            if did is None:
                skipped_driver.add(r["driver_ref"])
                continue
            if dry_run:
                n_lap += 1
                continue
            cur.execute("""INSERT OR REPLACE INTO laps (race_id, driver_id,
                driver_key, driver_code, lap_number, position, lap_seconds,
                deleted, is_fastest_lap, source)
                VALUES (?,?,?,?,?,?,?,?,?,'jolpica')""",
                (rid, did, did, r["code"], r["lap"], r["position"],
                 r["seconds"], r["deleted"], r["fastest"]))
            n_lap += 1
    for where, rows in sorted(stops.items()):
        rid = races.get(where)
        if rid is None:
            skipped_race.add(where)
            continue
        for r in rows:
            did = resolve(r["driver_ref"], r["driver_name"])
            if did is None:
                skipped_driver.add(r["driver_ref"])
                continue
            if dry_run:
                n_stop += 1
                continue
            cur.execute("""INSERT OR REPLACE INTO pit_stops (race_id, driver_id,
                driver_key, driver_code, stop_number, lap_number,
                stationary_seconds, pit_lane_seconds, source)
                VALUES (?,?,?,?,?,?,NULL,?,'jolpica')""",
                (rid, did, did, r["code"], r["stop"], r["lap"],
                 r["lane_seconds"]))
            n_stop += 1
    return n_lap, n_stop, skipped_race, skipped_driver


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
    ap.add_argument("--from-dump", action="store_true",
                    help="load from the database dump instead of 270 paged "
                         "API requests: one hash-verified snapshot, so the "
                         "whole load comes from one consistent state")
    ap.add_argument("--dump-tier", choices=("delayed", "latest"),
                    default="delayed",
                    help="'delayed' (default) is free, needs no key and lags "
                         "14 days, which costs nothing for history; 'latest' "
                         "needs a supporter API key")
    ap.add_argument("--verify-dump", metavar="N", type=int, nargs="?",
                    const=8,
                    help="load nothing; instead read N races from the dump "
                         "AND from the API and compare them row by row. The "
                         "API is the reference implementation - this is what "
                         "keeps the dump path honest as their schema moves.")
    ap.add_argument("--timing", action="store_true",
                    help="also load per-lap times and pit stops. Dump only - "
                         "the Ergast-compatible API does not expose them. "
                         "628k race laps from 1996 and 12.6k pit stops from "
                         "2011, which reaches 22 seasons further back than "
                         "FastF1. NOT committed: same non-commercial licence "
                         "as the rest.")
    ap.add_argument("--timing-only", action="store_true",
                    help="load the laps and pit stops and nothing else")
    ap.add_argument("--dump-sha256",
                    help="require this exact dump. Pins a load to one "
                         "snapshot so it can be reproduced byte for byte.")
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
    conflicts = []
    totals = dict(rows=0, races=0, skipped_race=0, skipped_driver=0,
                  conflicts=0,
                  skipped_declared=0, refused=0)
    missing_cons, declared_cons, declared_drv = set(), set(), set()

    if a.verify_dump:
        sys.exit(compare_dump_to_api(a, lo, hi))
    if (a.timing or a.timing_only) and not a.from_dump:
        sys.exit("--timing needs --from-dump: per-lap timing exists only in "
                 "the database dump, not in the Ergast-compatible API.")

    from_dump = None
    source_note = f"{BASE}/{{year}}/results/"
    if a.from_dump:
        path, meta = get_dump(a.dump_tier, a.dump_sha256)
        from_dump = dump_results(path)
        source_note = (f"{DUMP_INDEX} {a.dump_tier} csv "
                       f"{meta['file_hash'][:12]} ({meta['uploaded_at'][:10]})")
        print(f"  {sum(len(v) for v in from_dump.values())} race results "
              f"across {len(from_dump)} seasons in the dump")

    failed_years = []
    for year in ([] if a.timing_only else range(lo, hi + 1)):
        if from_dump is not None:
            rows = from_dump.get(year, [])
        else:
            try:
                rows = season_results(year, a.sleep)
            except Exception as e:                               # noqa: BLE001
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
                got = {resolve(e["driver"], e.get("driver_name"))
                       for e in theirs}
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
                did = resolve(e["driver"], e.get("driver_name"))
                if did is None:
                    if e["driver"] in RS.DRIVER_NON_MAPPING:
                        declared_drv.add(e["driver"])
                        totals["skipped_declared"] += 1
                    else:
                        unresolved.add(e["driver"])
                        totals["skipped_driver"] += 1
                    continue
                cid = RS._resolve_constructor(e["constructor"], e["year"])
                if cid and cid not in known_cons:
                    if e["constructor"] not in RS.CONSTRUCTOR_NON_MAPPING:
                        missing_cons.add(e["constructor"])
                    else:
                        declared_cons.add(e["constructor"])
                    cid = None
                # This source hands the car's grid slot to every driver who
                # shared it, so accepting grid 1 here puts two cars at the
                # front of the same grid. Pole is its own flag and belongs to
                # the pole harvest.
                grid = e["grid"] if e["grid"] > 1 else None
                classified = 1 if e["position_text"].isdigit() else 0
                shared = 1 if len(share[e["position"]]) > 1 else 0
                if a.dry_run:
                    loaded += 1
                    continue

                # Since v2.15 the committed build already holds the full
                # classification, from F1DB, which is CC BY. So the common
                # case here is no longer an empty row waiting to be filled -
                # it is a SECOND OPINION on a row that already exists, and a
                # second opinion is worth more than a second copy.
                #
                # Where the two disagree on a finishing position the
                # disagreement is recorded and the stored value is left
                # alone. Overwriting would destroy the only evidence that
                # anything was ever in doubt, and this database's rule is
                # that a source conflict neither side can settle goes on the
                # record rather than to whichever loader ran last.
                held = cur.execute("""SELECT finish_position, source
                    FROM race_entries WHERE race_id=? AND driver_id=?""",
                    (rid, did)).fetchone()
                if (held and held[0] is not None and e["position"] is not None
                        and held[0] != e["position"]
                        and "f1db" in (held[1] or "").lower()):
                    conflicts.append((year, rnd, did, held[0], e["position"]))
                    cur.execute("""INSERT OR IGNORE INTO discrepancies
                        (subject, field, stored_value, derived_value,
                         assessment, status) VALUES (?,?,?,?,?,?)""",
                        (f"{year} round {rnd}, {did}", "finish_position",
                         str(held[0]), str(e["position"]),
                         "F1DB and Jolpica-F1 give different finishing "
                         "positions for the same driver in the same race. "
                         "The F1DB value is the one stored, because it is "
                         "what the committed build is a function of; this "
                         "row is the evidence that the two sources differ.",
                         "open"))
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
                     source_note.format(year=year)
                     if "{year}" in source_note else source_note))
                loaded += 1
            totals["races"] += 1

        if not a.dry_run:
            con.commit()
        totals["rows"] += loaded
        totals["conflicts"] = len(conflicts)
        print(f"{year}: {loaded} entries across {len(by_race)} races"
              + (f", {refused} refused" if refused else ""))
        if from_dump is None:
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
    if totals["conflicts"]:
        # Not an error. The committed build holds F1DB's classification; this
        # is where Jolpica reads the same race differently, recorded in
        # `discrepancies` and left for a person rather than resolved by
        # whichever loader ran last.
        print(f"  {totals['conflicts']} finishing positions where Jolpica "
              f"disagrees with the stored F1DB value - recorded in "
              f"discrepancies, nothing overwritten")
        for c in conflicts[:5]:
            print(f"     {c[0]} r{c[1]} {c[2]}: stored P{c[3]}, "
                  f"Jolpica P{c[4]}")
    if totals["skipped_race"]:
        print(f"  {totals['skipped_race']} races not in this database, skipped")
    if unresolved:
        print(f"  {totals['skipped_driver']} rows skipped, driver not in the "
              f"register: {', '.join(sorted(unresolved)[:20])}")
        print("  Add them to PODIUM_ONLY_DRIVERS in data/results.py, rebuild, "
              "and rerun.")
    if declared_drv:
        print(f"  {totals['skipped_declared']} row(s) skipped for "
              f"{len(declared_drv)} driver(s) this register deliberately does "
              f"not hold: {', '.join(sorted(declared_drv))} "
              f"(see data/results.py DRIVER_NON_MAPPING). A declared "
              f"disagreement, not a gap.")
    if declared_cons:
        print(f"  constructors deliberately not held, stored as NULL: "
              f"{', '.join(sorted(declared_cons))} "
              f"(see data/results.py CONSTRUCTOR_NON_MAPPING)")
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
    timing_problems = []
    if a.timing or a.timing_only:
        n_lap, n_stop, sk_race, sk_driver = load_timing(
            cur, path, lo, hi, resolve, a.dry_run)
        if not a.dry_run:
            con.commit()
        print(f"\n  timing: {n_lap} laps and {n_stop} pit stops")
        if sk_race:
            timing_problems.append(
                f"{len(sk_race)} race(s) with timing in the dump are not in "
                f"this database: "
                + ", ".join(f"{y} r{r}" for y, r in sorted(sk_race)[:6])
                + (" ..." if len(sk_race) > 6 else ""))
        if sk_driver:
            timing_problems.append(
                f"timing skipped for {len(sk_driver)} driver(s) not in the "
                f"register")

    problems = list(timing_problems)
    # A dump is a snapshot, and the free tier's is fourteen days old. Races
    # run since it was cut simply are not in it, and the load looks clean:
    # the winner cross-check cannot fire on rows that never arrived. For
    # history that costs nothing - 1950-2025 does not change - but for the
    # current season it is a silent partial load, so name it.
    # Not in --timing-only: that mode deliberately loads no classification
    # rows, so every race would look empty and the warning would be noise.
    if from_dump is not None and not a.dry_run and not a.timing_only:
        empty = cur.execute("""SELECT year, round FROM races
            WHERE status = 'completed' AND year BETWEEN ? AND ?
              AND NOT EXISTS (SELECT 1 FROM race_entries e
                              WHERE e.race_id = races.id
                                AND e.status IS NOT NULL)
            ORDER BY year, round""", (lo, hi)).fetchall()
        if empty:
            problems.append(
                f"{len(empty)} completed race(s) got no rows at all: "
                + ", ".join(f"{y} r{r}" for y, r in empty[:8])
                + (" ..." if len(empty) > 8 else "")
                + f". This dump was cut on {meta['uploaded_at'][:10]}; the "
                  f"free tier lags {dump_index().get('delay_days', 14)} days, "
                  f"so anything raced since is not in it. Use --dump-tier "
                  f"latest (needs a supporter key) or the API for those.")
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
