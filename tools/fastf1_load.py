#!/usr/bin/env python3
"""
Load per-lap timing, stints, pit stops, race control messages and team radio
into f1.db from the Formula 1 live timing API, via FastF1.

WHY THIS IS A SEPARATE SCRIPT
    The database is built offline by build.py from the modules in data/.
    This data cannot be: it comes from an API that needs network access, it is
    large, and it only exists from 2018 onwards. So it is loaded afterwards,
    into tables that build.py has already created and left empty. A database
    with this data and one without are the same shape; run verify.py after
    loading and every check still applies.

    IMPORTANT: build.py DROPS AND REBUILDS f1.db from scratch. Anything loaded
    here is destroyed by the next build. Either load after every build, or
    keep the FastF1 cache (which is the expensive part) and re-run this.

WHAT F1 ACTUALLY PUBLISHES
    Lap times, sector times, speed traps, tyre compound and age, stint
    boundaries, pit in/out laps, track status and race control messages:
    all structured, all from 2018.
    Team radio: the AUDIO clips only. There are no official transcripts.
    Car telemetry (speed, throttle, brake, gear, RPM, DRS at ~4 Hz plus
    position at ~10 Hz) exists but is NOT loaded here - it is hundreds of
    megabytes per weekend and belongs in Parquet next to this file, not in
    it. --telemetry-parquet writes it there if you want it.

INSTALL
    pip install fastf1
    pip install openai-whisper      # optional, only for --transcribe

USE
    python3 tools/fastf1_load.py --years 2024              one season
    python3 tools/fastf1_load.py --years 2018-2026         everything
    python3 tools/fastf1_load.py --years 2024 --round 5    one race
    python3 tools/fastf1_load.py --years 2024 --radio      + radio clip index
    python3 tools/fastf1_load.py --years 2024 --radio --transcribe
    python3 tools/fastf1_load.py --years 2024 --telemetry-parquet out/

    --cache DIR   where FastF1 keeps its cache (default: .fastf1cache).
                  Keep this. Re-running against a warm cache is minutes
                  instead of hours, and it survives a rebuild of f1.db.

The first run of a full season fetches a few GB and takes a long time. It is
resumable: races already loaded are skipped unless you pass --force.
"""
import argparse
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(HERE, "f1.db")

FIRST_YEAR = 2018          # F1 live timing does not go back further


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def secs(v):
    """A pandas Timedelta (or NaT, or None) as seconds, or None."""
    if v is None:
        return None
    try:
        if v != v:                     # NaT / NaN
            return None
    except TypeError:
        pass
    try:
        return float(v.total_seconds())
    except AttributeError:
        try:
            return float(v)
        except (TypeError, ValueError):
            return None


def val(v):
    """A scalar that sqlite3 will accept, or None."""
    if v is None:
        return None
    try:
        if v != v:
            return None
    except TypeError:
        pass
    if hasattr(v, "item"):
        try:
            v = v.item()
        except (ValueError, AttributeError):
            pass
    if isinstance(v, (str, int, float, bool)):
        return int(v) if isinstance(v, bool) else v
    return str(v)


def race_id_for(cur, year, rnd):
    """The races.id for a season and round, or None if this build has no
    such race. A round that FastF1 has but the database does not is skipped,
    not invented: races come from the harvest, not from here."""
    row = cur.execute("SELECT id FROM races WHERE year=? AND round=?",
                      (year, rnd)).fetchone()
    return row[0] if row else None


def build_driver_map(cur, session):
    """Map FastF1's three-letter codes to driver ids in this database, and
    car numbers to those codes.

    Matched on full name first, then surname. A code that does not match is
    left unmapped rather than guessed: the row still loads, carrying
    driver_code, and driver_id stays NULL. `f1 sql` can find those later.

    Returns (code -> driver_id, car_number -> code).
    """
    out, nums = {}, {}
    try:
        info = session.results
    except Exception:
        return out, nums
    if info is None:
        return out, nums
    for _, r in info.iterrows():
        code = val(r.get("Abbreviation"))
        if not code:
            continue
        num = val(r.get("DriverNumber"))
        if num is not None:
            nums[str(num)] = code
        surname = (val(r.get("LastName")) or "").strip()
        full = (val(r.get("FullName")) or "").strip()
        did = None
        for q, args in (
                ("SELECT id FROM drivers WHERE LOWER(full_name)=LOWER(?)", (full,)),
                ("SELECT id FROM drivers WHERE full_name LIKE ?", (f"% {surname}",)),
                ("SELECT id FROM drivers WHERE id LIKE ?", (f"%{surname.lower()}%",)),
        ):
            if not args[0]:
                continue
            hits = cur.execute(q, args).fetchall()
            if len(hits) == 1:
                did = hits[0][0]
                break
        out[code] = did
    return out, nums


# --------------------------------------------------------------------------
# loaders, one per table
# --------------------------------------------------------------------------
def load_laps(cur, rid, session, dmap):
    n = 0
    for _, lap in session.laps.iterrows():
        code = val(lap.get("Driver"))
        num = val(lap.get("LapNumber"))
        if code is None or num is None:
            continue
        cur.execute("""INSERT OR REPLACE INTO laps (race_id, driver_id, driver_key, driver_code,
            lap_number, position, lap_seconds, sector1_seconds, sector2_seconds,
            sector3_seconds, speed_trap_kph, compound, tyre_life, fresh_tyre,
            stint, is_personal_best, deleted, deleted_reason, track_status, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'fastf1')""",
            (rid, dmap.get(code), code, code, int(num), val(lap.get("Position")),
             secs(lap.get("LapTime")), secs(lap.get("Sector1Time")),
             secs(lap.get("Sector2Time")), secs(lap.get("Sector3Time")),
             val(lap.get("SpeedST")), val(lap.get("Compound")),
             val(lap.get("TyreLife")),
             1 if val(lap.get("FreshTyre")) else 0,
             val(lap.get("Stint")),
             1 if val(lap.get("IsPersonalBest")) else 0,
             1 if val(lap.get("Deleted")) else 0,
             val(lap.get("DeletedReason")) or None,
             val(lap.get("TrackStatus"))))
        n += 1
    return n


def load_stints(cur, rid, session, dmap):
    """Stints are derived from the laps, because FastF1 does not publish them
    as a table. A stint is a run of laps on one Stint number."""
    n = 0
    laps = session.laps
    if laps is None or laps.empty:
        return 0
    grp = laps.groupby(["Driver", "Stint"], dropna=True)
    for (code, stint), g in grp:
        code, stint = val(code), val(stint)
        if code is None or stint is None:
            continue
        compounds = [c for c in g["Compound"].dropna().unique()]
        cur.execute("""INSERT OR REPLACE INTO stints (race_id, driver_id,
            driver_code, stint, compound, lap_start, lap_end, laps_run, source)
            VALUES (?,?,?,?,?,?,?,?,'fastf1')""",
            (rid, dmap.get(code), code, int(stint),
             val(compounds[0]) if compounds else None,
             val(g["LapNumber"].min()), val(g["LapNumber"].max()), int(len(g))))
        n += 1
    return n


def load_pit_stops(cur, rid, session, dmap):
    """FastF1 gives pit in and out times per lap, so what is recorded is the
    PIT LANE time, not the stationary time. The stationary_seconds column is
    left NULL rather than filled with a number that means something else."""
    n = 0
    laps = session.laps
    if laps is None or laps.empty:
        return 0
    for code, g in laps.groupby("Driver"):
        code = val(code)
        if code is None:
            continue
        g = g.sort_values("LapNumber")
        stop = 0
        for _, lap in g.iterrows():
            pit_in = lap.get("PitInTime")
            if secs(pit_in) is None:
                continue
            stop += 1
            ln = val(lap.get("LapNumber"))
            nxt = g[g["LapNumber"] == (ln + 1 if ln else None)]
            lane = None
            if not nxt.empty:
                out = secs(nxt.iloc[0].get("PitOutTime"))
                inn = secs(pit_in)
                if out is not None and inn is not None and out > inn:
                    lane = out - inn
            cur.execute("""INSERT OR REPLACE INTO pit_stops (race_id, driver_id,
                driver_key, driver_code, stop_number, lap_number, stationary_seconds,
                pit_lane_seconds, source) VALUES (?,?,?,?,?,?,NULL,?,'fastf1')""",
                (rid, dmap.get(code), code, code, stop, ln, lane))
            n += 1
    return n


def load_results(cur, rid, session, dmap):
    """Fill the full classified finishing order into race_entries.

    This is the same table build.py populates from the Wikipedia harvest, so
    it is written as an UPSERT: an existing row (the winner, the pole-sitter,
    the fastest-lap setter) is filled in, not duplicated.

    SELF-VALIDATING, like every other loader in this project: the winner
    FastF1 reports must equal the winner already stored. If it does not, the
    race is refused outright rather than half-written - a mismatch means the
    session is not the race the database thinks it is.

    Returns (rows written, error message or None).
    """
    res = getattr(session, "results", None)
    if res is None or res.empty:
        return 0, "no results in session"

    stored = cur.execute("""SELECT driver_id FROM race_entries
        WHERE race_id=? AND finish_position=1 ORDER BY id LIMIT 1""",
        (rid,)).fetchone()
    if stored is None:
        return 0, "no winner stored for this race"

    winner_row = res[res["Position"] == 1]
    if winner_row.empty:
        return 0, "no winner in the FastF1 results"
    code = val(winner_row.iloc[0].get("Abbreviation"))
    if dmap.get(code) != stored[0]:
        return 0, (f"winner mismatch: FastF1 says {code} "
                   f"({dmap.get(code)}), stored is {stored[0]}")

    n = 0
    for _, r in res.iterrows():
        code = val(r.get("Abbreviation"))
        did = dmap.get(code)
        if did is None:
            continue            # unmapped driver: skip rather than invent an id
        pos = val(r.get("Position"))
        cls = val(r.get("ClassifiedPosition"))
        grid = val(r.get("GridPosition"))
        cur.execute("""INSERT INTO race_entries (race_id, driver_id,
                finish_position, grid, classified, status, laps_completed,
                points, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,'reference','f1 live timing via FastF1')
            ON CONFLICT (race_id, driver_id) DO UPDATE SET
                finish_position = COALESCE(excluded.finish_position, finish_position),
                grid            = COALESCE(excluded.grid, grid),
                classified      = excluded.classified,
                status          = excluded.status,
                laps_completed  = excluded.laps_completed,
                points          = excluded.points""",
            (rid, did, int(pos) if pos else None,
             int(grid) if grid else None,
             1 if (cls or "").isdigit() else 0,
             val(r.get("Status")), val(r.get("Laps")), val(r.get("Points"))))
        n += 1
    return n, None


def load_race_control(cur, rid, session, kind="race"):
    n = 0
    msgs = getattr(session, "race_control_messages", None)
    if msgs is None or msgs.empty:
        return 0
    for _, m in msgs.iterrows():
        cur.execute("""INSERT OR IGNORE INTO race_control_messages (race_id,
            session, utc_time, lap_number, category, flag, scope, sector,
            driver_number, message, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,'fastf1')""",
            (rid, kind, val(m.get("Time")), val(m.get("Lap")),
             val(m.get("Category")), val(m.get("Flag")), val(m.get("Scope")),
             val(m.get("Sector")), val(m.get("RacingNumber")),
             val(m.get("Message")) or ""))
        n += 1
    return n


def load_radio(cur, rid, session, dmap, nmap, transcribe=False):
    """Index the team radio clips.

    FastF1 has no team_radio property, so this reads the TeamRadio page off the
    live timing API directly through fastf1.api. F1 publishes AUDIO, not text,
    so `transcript` stays NULL unless --transcribe is given AND openai-whisper
    is installed locally; nothing is ever sent to a third-party service.
    """
    from fastf1 import api
    try:
        entries = api.fetch_page(session.api_path, "team_radio")
    except Exception as e:                                       # noqa: BLE001
        print(f"  ! team radio: {e}", file=sys.stderr)
        return 0
    if not entries:
        return 0

    model = None
    if transcribe:
        try:
            import whisper
            model = whisper.load_model("base.en")
        except ImportError:
            print("  ! whisper not installed; indexing clips without transcripts",
                  file=sys.stderr)

    base = api.base_url + session.api_path
    n = 0
    seen = set()
    for entry in entries:
        # a jsonStream entry is [timestamp, content]
        content = entry[1] if isinstance(entry, (list, tuple)) and len(entry) > 1 else entry
        if not isinstance(content, dict):
            continue
        caps = content.get("Captures")
        if isinstance(caps, dict):
            caps = list(caps.values())
        elif not isinstance(caps, list):
            continue
        for c in caps:
            if not isinstance(c, dict):
                continue
            rel = c.get("Path")
            if not rel or rel in seen:
                continue
            seen.add(rel)
            num = val(c.get("RacingNumber"))
            code = nmap.get(str(num)) if num is not None else None
            url = base + rel
            text = None
            if model:
                try:
                    import tempfile
                    import urllib.request
                    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                        tmp = f.name
                    urllib.request.urlretrieve(url, tmp)
                    text = model.transcribe(tmp).get("text", "").strip() or None
                    os.unlink(tmp)
                except Exception as e:                           # noqa: BLE001
                    print(f"  ! transcribe {rel}: {e}", file=sys.stderr)
            cur.execute("""INSERT INTO team_radio (race_id, driver_id, driver_code,
                utc_time, lap_number, speaker, transcript, audio_url, notable,
                confidence, source)
                VALUES (?,?,?,?,NULL,NULL,?,?,0,'reference','fastf1')""",
                (rid, dmap.get(code) if code else None, code,
                 val(c.get("Utc")), text, url))
            n += 1
    return n


def dump_telemetry(session, outdir, year, rnd):
    """Car telemetry to Parquet, beside the database rather than in it."""
    import pandas as pd                                          # noqa: F401
    os.makedirs(outdir, exist_ok=True)
    frames = []
    for code in session.laps["Driver"].dropna().unique():
        try:
            t = session.laps.pick_drivers(code).get_telemetry()
        except Exception as e:                                   # noqa: BLE001
            print(f"  ! telemetry {code}: {e}", file=sys.stderr)
            continue
        t = t.copy()
        t["Driver"] = code
        frames.append(t)
    if not frames:
        return None
    import pandas as pd
    df = pd.concat(frames, ignore_index=True)
    path = os.path.join(outdir, f"telemetry_{year}_{rnd:02d}.parquet")
    df.to_parquet(path, index=False)
    return path


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", required=True,
                    help="2024, or a range like 2018-2026")
    ap.add_argument("--round", type=int, help="a single round")
    ap.add_argument("--db", default=DB)
    ap.add_argument("--cache", default=os.path.join(HERE, ".fastf1cache"))
    ap.add_argument("--radio", action="store_true", help="index team radio clips")
    ap.add_argument("--results", action="store_true",
                    help="also fill the full classified finishing order into "
                         "race_entries (checked against the stored winner)")
    ap.add_argument("--transcribe", action="store_true",
                    help="transcribe radio with a LOCAL whisper model")
    ap.add_argument("--qualifying", action="store_true",
                    help="also load qualifying race control messages")
    ap.add_argument("--telemetry-parquet", metavar="DIR",
                    help="dump car telemetry to Parquet in DIR (large)")
    ap.add_argument("--force", action="store_true",
                    help="reload races that already have laps")
    a = ap.parse_args()

    try:
        import fastf1
    except ImportError:
        sys.exit("fastf1 is not installed.  pip install fastf1")

    os.makedirs(a.cache, exist_ok=True)
    fastf1.Cache.enable_cache(a.cache)

    if "-" in a.years:
        lo, hi = (int(x) for x in a.years.split("-"))
    else:
        lo = hi = int(a.years)
    if lo < FIRST_YEAR:
        print(f"note: F1 live timing starts at {FIRST_YEAR}; "
              f"{lo}-{FIRST_YEAR - 1} will be skipped", file=sys.stderr)
        lo = max(lo, FIRST_YEAR)

    con = sqlite3.connect(a.db)
    cur = con.cursor()
    con.execute("PRAGMA foreign_keys=ON")

    totals = dict(laps=0, stints=0, pits=0, rcm=0, radio=0, results=0,
                  races=0, skipped=0)

    for year in range(lo, hi + 1):
        rounds = [a.round] if a.round else [
            r[0] for r in cur.execute(
                "SELECT round FROM races WHERE year=? AND status='completed' "
                "ORDER BY round", (year,))]
        for rnd in rounds:
            rid = race_id_for(cur, year, rnd)
            if rid is None:
                print(f"{year} r{rnd}: not in this database, skipped")
                totals["skipped"] += 1
                continue
            if not a.force:
                # Per source. Since v2.11 ergast_load.py --timing can hold
                # the same race from Jolpica, and a bare race_id count would
                # make this skip every 2018+ race after such a load - so the
                # sectors, compounds, stints and race control that only
                # FastF1 has would never arrive, and the cross-source checks
                # would have nothing to compare.
                have = cur.execute("""SELECT COUNT(*) FROM laps
                    WHERE race_id=? AND source='fastf1'""",
                                   (rid,)).fetchone()[0]
                if have:
                    print(f"{year} r{rnd}: already loaded ({have} laps)")
                    continue
            try:
                s = fastf1.get_session(year, rnd, "R")
                s.load(laps=True, telemetry=bool(a.telemetry_parquet),
                       weather=False, messages=True)
            except Exception as e:                               # noqa: BLE001
                print(f"{year} r{rnd}: {e}", file=sys.stderr)
                totals["skipped"] += 1
                continue

            dmap, nmap = build_driver_map(cur, s)
            nl = load_laps(cur, rid, s, dmap)
            ns = load_stints(cur, rid, s, dmap)
            np_ = load_pit_stops(cur, rid, s, dmap)
            nres, err = (load_results(cur, rid, s, dmap) if a.results else (0, None))
            if err:
                print(f"  ! results not loaded: {err}", file=sys.stderr)
            nr = load_race_control(cur, rid, s, "race")
            nrad = load_radio(cur, rid, s, dmap, nmap, a.transcribe) if a.radio else 0

            if a.qualifying:
                try:
                    q = fastf1.get_session(year, rnd, "Q")
                    q.load(laps=False, telemetry=False, weather=False, messages=True)
                    nr += load_race_control(cur, rid, q, "qualifying")
                except Exception as e:                           # noqa: BLE001
                    print(f"  ! qualifying messages: {e}", file=sys.stderr)

            if a.telemetry_parquet:
                p = dump_telemetry(s, a.telemetry_parquet, year, rnd)
                if p:
                    print(f"  telemetry -> {p}")

            con.commit()
            unmapped = sorted(c for c, d in dmap.items() if d is None)
            print(f"{year} r{rnd}: {nl} laps, {ns} stints, {np_} stops, "
                  f"{nr} messages, {nrad} radio"
                  + (f", {nres} classified" if a.results else "")
                  + (f"  [unmapped drivers: {', '.join(unmapped)}]" if unmapped else ""))
            totals["laps"] += nl
            totals["stints"] += ns
            totals["pits"] += np_
            totals["rcm"] += nr
            totals["radio"] += nrad
            totals["results"] += nres
            totals["races"] += 1

    con.commit()
    con.close()
    print("\n" + "-" * 60)
    print(f"  {totals['races']} races loaded, {totals['skipped']} skipped")
    print(f"  {totals['laps']} laps, {totals['stints']} stints, "
          f"{totals['pits']} pit stops")
    print(f"  {totals['rcm']} race control messages, {totals['radio']} radio clips")
    if totals["results"]:
        print(f"  {totals['results']} classified finishing positions")
    print("\n  Run verify.py to confirm the database is still consistent.")
    print("  Remember: build.py rebuilds f1.db from scratch and will drop all")
    print("  of this. Re-run against the warm cache after any rebuild.")


if __name__ == "__main__":
    main()
