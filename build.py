#!/usr/bin/env python3
"""
Build f1.db from schema.sql and the data modules.

    python3 build.py

Idempotent: deletes and rebuilds the database each run.
"""
import json
import math
import os
import re
import sqlite3
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from data import seasons as S      # noqa: E402
from data import drivers as D      # noqa: E402
from data import teams as T        # noqa: E402
from data import circuits as C     # noqa: E402
from data import technical as X    # noqa: E402
from data import current as N      # noqa: E402
from data import people as P       # noqa: E402
from data import harvest as HV     # noqa: E402
from data import events as EV      # noqa: E402
from data import cars as CR        # noqa: E402
from data import radio as RA       # noqa: E402
from data import results as RS     # noqa: E402

DB = os.path.join(HERE, "f1.db")
VERSION = "2.22"

# The build date, as a CONSTANT and deliberately not date.today().
#
# f1.db is a pure function of these sources: the same inputs rebuild to the
# same bytes, which is what lets CI check that the committed artefacts match a
# fresh build, and what stops a rebuild that changed nothing from evicting
# every reader's cached copy of a twenty-megabyte file. A clock in the build
# would break all of that, and it would make the JSON exports differ every day.
#
# The cost is that somebody has to move it, and until this comment existed
# nobody did: it sat stranded in the middle of the geometry helpers and went
# four days stale, which the sitemap then published as lastmod on all 2,385
# pages. So the refresh workflow now bumps it whenever it commits a new
# harvest — the only time the data actually changes — and a hand edit to
# data/*.py should bump it too.
BUILT = "2026-09-09"


def _haversine(a, b):
    """Metres between two (lat, lon) pairs on the IUGG mean-radius sphere.

    Deliberately duplicated from tools/osm_geometry.py rather than imported.
    The point of re-measuring geometry at build time is to check the tool's
    arithmetic; sharing the tool's arithmetic would check nothing.
    """
    R = 6371008.8
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = (math.sin(dp / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(h))



def _lap_topology(lines, join_m=1.0):
    """Does this bag of ways form one closed lap?

    An OSM relation's members are UNORDERED, so the question cannot be asked by
    comparing the first coordinate to the last - that compares two arbitrary way
    ends. What a lap actually guarantees is that every way END meets another
    way's end, and that walking from any way returns to the start having used
    all of them.

    WHY ONE METRE. Ways in a relation share their junction nodes, so a real join
    is not "close", it is identical: across the 25 traces held here, 1,201 of
    1,208 way ends sit at exactly 0.000 m from another end. The seven that do
    not are 5.4 m to 63.4 m away, and every one of them is a genuine hole in the
    trace. A metre is far above serialisation noise and far below the smallest
    real gap, so it separates the two cleanly. A looser figure does not measure
    the same thing: at 30 m the Monaco and Montjuic holes read as joins.

    Returns (closes, loose_ends, used, walked_m).
    """
    def near(a, b):
        return _haversine((a[1], a[0]), (b[1], b[0])) <= join_m

    # Index by POSITION IN THIS LIST, not by way: a circuit traced as one
    # closed way is met by its own other end, and comparing way indices would
    # exclude exactly that pair and call a perfectly good loop two loose ends.
    ends = [l[0] for l in lines] + [l[-1] for l in lines]
    loose = sum(1 for i, p in enumerate(ends)
                if not any(j != i and near(p, q) for j, q in enumerate(ends)))

    # Walk: from the tail of the chain, take any unused way that starts or ends
    # there, reversing it if it is the far end that meets.
    used = [False] * len(lines)
    ring = list(lines[0])
    used[0] = True
    while True:
        tail = ring[-1]
        step = None
        for i, line in enumerate(lines):
            if used[i]:
                continue
            if near(tail, line[0]):
                step = (i, line)
                break
            if near(tail, line[-1]):
                step = (i, list(reversed(line)))
                break
        if step is None:
            break
        used[step[0]] = True
        ring.extend(step[1][1:])

    walked = sum(_haversine((a[1], a[0]), (b[1], b[0]))
                 for a, b in zip(ring, ring[1:]))
    closes = (loose == 0 and all(used) and near(ring[0], ring[-1]))
    return closes, loose, sum(used), walked

class _Build:
    """What passes from one stage of the build to the next.

    build() was one function of about nineteen hundred lines. Everything in it
    shared a single scope, so there were no seams: a stage could not be read on
    its own, moved, or reasoned about without holding the whole thing in your
    head, and the only way to learn what a stage depended on was to try taking
    it out.

    Splitting it needed one measurement — which names actually cross a stage
    boundary — and the answer is much shorter than the size of the function
    suggests. It is this list. Each stage pulls what it needs off this object
    and puts back what later stages read, which is precisely what the flat
    function did implicitly; the difference is that it is now written down and
    a stage's inputs and outputs can be seen from its first and last lines.

    The proof that the split changed nothing is that f1.db still builds to the
    same bytes.
    """

    con = None
    cur = None
    race_key = None
    known_cons = None
    f1db_drivers = None
    entrants = None
    lookup = None
    seen_cars = None
    driver_id = None


def _stage_00_open_the_database(b):
    """open the database"""
    con = b.con
    cur = b.cur

    if os.path.exists(DB):
        os.remove(DB)
    con = sqlite3.connect(DB)
    con.executescript(open(os.path.join(HERE, "schema.sql"), encoding="utf-8").read())
    cur = con.cursor()

    b.con = con
    b.cur = cur


def _stage_01_meta(b):
    """meta"""
    cur = b.cur

    # ---------------------------------------------------------- meta
    cur.executemany("INSERT INTO provenance VALUES (?,?,?,?)", N.PROVENANCE)
    # Each registry entry carries its licence twice: as the prose in
    # `licence`, written for a person, and as the machine-readable class in
    # SOURCE_LICENCE, which is what lets verify.py answer "may this row be
    # published?" without anyone reading a paragraph. An entry with no class
    # is a source nobody has judged, and that is a build failure rather than
    # a default, because the safe default is the one you never notice.
    registry = []
    for entry in N.SOURCE_REGISTRY:
        priority = entry[0]
        if priority not in N.SOURCE_LICENCE:
            raise SystemExit(
                f"source_registry entry {priority} ({entry[1]}) has no licence "
                f"class in SOURCE_LICENCE. Classify it before the build can "
                f"say what may be published.")
        registry.append(tuple(entry) + N.SOURCE_LICENCE[priority])
    cur.executemany(
        "INSERT INTO source_registry (priority, source, url, use, authority,"
        " licence, cadence, checkability, redistributable, share_alike,"
        " attribution_required, domains) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        registry)
    cur.executemany(
        "INSERT INTO source_patterns (source_id, pattern, note) VALUES (?,?,?)",
        N.SOURCE_PATTERNS)
    cur.executemany(
        "INSERT INTO table_provenance (tbl, source_id, unconstrained, note)"
        " VALUES (?,?,?,?)",
        N.TABLE_PROVENANCE)
    cur.executemany("INSERT INTO meta VALUES (?,?)", [
        ("database_name", "F1 Verified Facts Project Memory Database"),
        ("version", VERSION),
        ("built", BUILT),
        ("verification_date", BUILT),
        ("missing_fact_policy", "Mark UNVERIFIED / NOT FOUND IN OFFICIAL SOURCES; never invent."),
        ("promotion_rule", "Never promote a fact to 'verified' without an official FIA or Formula 1 source."),
        ("coverage_seasons", "1950-2026"),
        ("coverage_note",
         "Complete for: the chassis register (every chassis that has raced), engines, "
         "per-season entry lists, season champions, race-by-race winners 1950-2026, pole position "
         "1950-2024, fastest lap 1950-2024 bar 12 races, the circuit of every race "
         "1950-2026, constructor lineage, engine formulae, regulation changes, safety "
         "milestones, points systems. "
         "Partial by design for: full driver register (every race winner, pole-sitter and "
         "fastest-lap setter, not all ~780 starters); full finishing order; qualifying, "
         "grid and lap-by-lap data (not held); chassis specifications, which exist only "
         "on the per-car articles and are thin for the modern era because teams do not "
         "publish them. The chassis a race was won in is known where the season's entry "
         "list names one chassis for the constructor and NULL where it names several. "
         "See the known_gaps table."),
    ])


def _stage_02_drivers(b):
    """drivers"""
    cur = b.cur

    # ------------------------------------------------------- drivers
    for r in D.CHAMPIONS:
        (did, name, nat, code, born, died, first, last, entries, starts, wins,
         podiums, poles, fl, pts, titles, tyears, status, notes, conf) = r
        cur.execute("""INSERT INTO drivers (id, full_name, nationality, nationality_code,
            born, died, first_season, last_season, entries, starts, wins, podiums, poles,
            fastest_laps, career_points, titles, title_years, status, notes, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, born, died, first, last, entries, starts, wins, podiums,
             poles, fl, pts, titles, tyears, status, notes, conf,
             "https://www.formula1.com/en/drivers"))

    for r in D.OTHER_DRIVERS:
        (did, name, nat, code, born, died, first, last, wins, poles, titles, status, notes, conf) = r
        cur.execute("""INSERT INTO drivers (id, full_name, nationality, nationality_code,
            born, died, first_season, last_season, wins, poles, titles, status, notes,
            confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, born, died, first, last, wins, poles, titles, status,
             notes, conf, "https://www.formula1.com/en/drivers"))

    for r in HV.NEW_DRIVERS:
        (did, name, nat, code, born, died, first, last, wins, poles, titles,
         status, notes, conf) = r
        cur.execute("""INSERT INTO drivers (id, full_name, nationality, nationality_code,
            born, died, first_season, last_season, wins, poles, titles, status, notes,
            confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, born, died, first, last, wins, poles, titles, status,
             notes, conf, HV.SOURCE.format(year=first)))

    for did, name, nat, code, year in HV.INDY_WINNERS:
        cur.execute("""INSERT INTO drivers (id, full_name, nationality, nationality_code,
            first_season, last_season, wins, titles, status, notes, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, year, year, None, 0, "deceased", HV.INDY_NOTE,
             "reference", HV.SOURCE.format(year=year)))

    for did, name, nat, code, extra in HV.POLE_ONLY_DRIVERS:
        note = HV.POLE_ONLY_NOTE + ((" " + extra) if extra else "")
        cur.execute("""INSERT INTO drivers (id, full_name, nationality,
            nationality_code, wins, titles, notes, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, 0, 0, note, "medium",
             "https://en.wikipedia.org/wiki/List_of_Formula_One_polesitters"))

    # Drivers who reached a podium but never won, took pole or set a fastest
    # lap, so no earlier harvest had reason to add them.
    #
    # Their names and dates were first read from Jolpica. They are SOURCED to
    # F1DB, which holds all sixty-two under CC BY 4.0 where Jolpica's Ergast
    # lineage is CC BY-NC-SA, and the citation has to name where a
    # redistributable fact actually comes from. The mapping is not taken on
    # trust: F1DB must hold the driver and must give the same date of birth,
    # or the build stops. See PODIUM_ONLY_F1DB in data/results.py.
    f1db_drv = {r[0]: r for r in HV.load_f1db_drivers()}
    for lid, eid, name, nat, code, born in RS.PODIUM_ONLY_DRIVERS:
        f1db_id = RS.PODIUM_ONLY_F1DB.get(lid)
        if f1db_id is None:
            raise SystemExit(
                f"PODIUM_ONLY_DRIVERS holds {lid}, which PODIUM_ONLY_F1DB does "
                f"not map to an F1DB driver. Every row in the committed "
                f"database must cite a source that permits redistribution.")
        meta = f1db_drv.get(f1db_id)
        if meta is None:
            raise SystemExit(
                f"PODIUM_ONLY_F1DB maps {lid} to {f1db_id}, which is not in "
                f"harvest/f1db_drivers.txt. Rerun tools/f1db_fetch.py.")
        # The date of birth is what proves the two registers mean the same
        # person. The name cannot do it: F1DB files Jyrki Jarvilehto under his
        # racing name, and this register does not.
        if (meta[4] or None) != (born or None):
            raise SystemExit(
                f"PODIUM_ONLY_F1DB maps {lid} to {f1db_id}, but this register "
                f"has {born or 'no date'} and F1DB has {meta[4] or 'no date'}. "
                f"One of them is the wrong person.")
        cur.execute("""INSERT INTO drivers (id, full_name, nationality,
            nationality_code, born, wins, titles, notes, confidence, source)
            VALUES (?,?,?,?,?,0,0,?,?,?)""",
            (lid, name, nat, code, born or None,
             "Added to the register from the podium harvest: reached a podium "
             "without ever winning a race, taking pole or setting a fastest lap.",
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))


def _stage_03_drivers_admitted_from_the_f1db_register(b):
    """drivers admitted from the F1DB register (data/drivers.py"""
    cur = b.cur

    # --- drivers admitted from the F1DB register (data/drivers.py
    # F1DB_DRIVERS). The ids are authored there; every attribute comes from
    # the generated harvest files, so nobody types six hundred names and no
    # driver appears without a reviewed line.
    known_drv = {r[0] for r in cur.execute("SELECT id FROM drivers")}
    f1db_drv = {r[0]: r for r in HV.load_f1db_drivers()}
    f1db_ctry = {r[0]: (r[1], r[2]) for r in HV.load_f1db_countries()}
    drv_years = {}
    for year, _e, _c, _em, f1db_id, rounds, test in HV.load_entrant_drivers():
        # `rounds` is the test, NOT the testDriver flag. F1DB's flag records
        # the driver's ROLE in the team, not whether they raced: Jack Aitken
        # is a Williams test driver for 2020 and has `rounds: 16`, because he
        # started the Sakhir Grand Prix in Russell's place. Franck Montagny
        # is flagged the same for 2006 and raced rounds 5-11 for Super Aguri.
        # A driver with rounds entered those rounds; a test driver with none
        # never entered.
        if not rounds:
            continue
        drv_years.setdefault(f1db_id, set()).add(year)
    for f1db_id in D.F1DB_DRIVERS:
        if f1db_id in known_drv:
            raise SystemExit(
                f"F1DB_DRIVERS admits {f1db_id}, which the register already "
                f"holds. Remove it from the list.")
        meta = f1db_drv.get(f1db_id)
        if meta is None:
            raise SystemExit(f"F1DB_DRIVERS admits {f1db_id}, which is not in "
                             f"harvest/f1db_drivers.txt. Rerun "
                             f"tools/f1db_fetch.py.")
        yrs = drv_years.get(f1db_id)
        if not yrs:
            raise SystemExit(f"F1DB_DRIVERS admits {f1db_id}, which the entry "
                             f"lists show entering no championship race")
        _id, name, _first, _last, born, died, abbr, nat_id = meta
        nat, code = f1db_ctry.get(nat_id, (None, None))
        cur.execute("""INSERT INTO drivers (id, full_name, nationality,
            nationality_code, born, died, first_season, last_season, titles,
            status, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,0,?,?,?)""",
            (f1db_id, name, nat, code, born, died, min(yrs), max(yrs),
             "deceased" if died else
             ("active" if max(yrs) >= 2026 else "retired"),
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))
        known_drv.add(f1db_id)

    # The wins / poles / fastest_laps just inserted are hand-entered from
    # reference records. Move them to the *_external columns now, before the
    # derived figures overwrite the main ones.
    cur.execute("""UPDATE drivers SET
        wins_external = wins, poles_external = poles,
        fastest_laps_external = fastest_laps,
        external_source = 'hand-entered from reference records'""")
    # Fastest-lap totals for drivers whose hand-entered row carries none,
    # declared with their source so the derived figure has something to be
    # checked against. Fills a blank only.
    for did_, (fl_, src_) in sorted(HV.EXTERNAL_FASTEST_LAPS.items()):
        n = cur.execute("""UPDATE drivers SET fastest_laps_external = ?,
            external_source = COALESCE(external_source || '; ', '')
                              || 'fastest laps from ' || ?
            WHERE id = ? AND fastest_laps_external IS NULL""",
            (fl_, src_, did_)).rowcount
        if n != 1:
            raise SystemExit(f"external fastest laps: {did_} not applied")


def _stage_04_constructors(b):
    """constructors"""
    cur = b.cur

    # -------------------------------------------------- constructors
    for r in T.CONSTRUCTORS:
        (cid, name, full, country, base, first, last, wins, ct, dt, tyears,
         chain, active, notes, conf) = r
        cur.execute("""INSERT INTO constructors (id, name, full_name, country, base,
            first_entry, last_entry, wins, constructors_titles, drivers_titles, title_years,
            lineage_chain, active, notes, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, name, full, country, base, first, last, wins, ct, dt, tyears, chain,
             active, notes, conf, "https://www.formula1.com/en/teams"))

    # Constructors that reached a podium but are not in the main register:
    # short-lived teams, and the pre-1961 marques that never won.
    #
    # Sourced to F1DB for the reason given against the podium-only drivers
    # above: these ten marques cited Jolpica, and F1DB holds every one of them
    # under a licence that permits redistribution. A marque has no date of
    # birth, so the build can only check that F1DB holds the id at all.
    f1db_cons = {r[0]: r for r in HV.load_f1db_constructors()}
    for cid, name, full, base, first, nat, notes, conf in RS.NEW_CONSTRUCTORS:
        f1db_id = RS.PODIUM_ONLY_CONSTRUCTORS_F1DB.get(cid)
        if f1db_id is None or f1db_id not in f1db_cons:
            raise SystemExit(
                f"NEW_CONSTRUCTORS holds {cid}, which PODIUM_ONLY_CONSTRUCTORS_F1DB "
                f"does not map to a constructor in harvest/f1db_constructors.txt. "
                f"Every row in the committed database must cite a source that "
                f"permits redistribution.")
        cur.execute("""INSERT INTO constructors (id, name, full_name, country,
            base, first_entry, wins, constructors_titles, drivers_titles,
            active, notes, confidence, source)
            VALUES (?,?,?,?,?,?,0,0,0,0,?,?,?)""",
            (cid, name, full, nat, base, first, notes, conf, HV.F1DB_SOURCE))

    for i, (chain, cname, seq, ent, fy, ty, note) in enumerate(T.LINEAGE, 1):
        cur.execute("""INSERT INTO constructor_lineage
            (id, chain_id, chain_name, sequence, entity_name, from_year, to_year, note)
            VALUES (?,?,?,?,?,?,?,?)""", (i, chain, cname, seq, ent, fy, ty, note))

    # Every constructor must resolve to a lineage chain. Teams that never
    # changed identity get a chain of one, generated from their own row, so
    # the link is never dangling and `lineage` works for all of them.
    have = {r[0] for r in cur.execute("SELECT DISTINCT chain_id FROM constructor_lineage")}
    nid = cur.execute("SELECT COALESCE(MAX(id), 0) FROM constructor_lineage").fetchone()[0]
    for c in cur.execute("""SELECT id, name, lineage_chain, first_entry, last_entry
                             FROM constructors WHERE lineage_chain IS NOT NULL""").fetchall():
        if c[2] in have:
            continue
        nid += 1
        cur.execute("""INSERT INTO constructor_lineage (id, chain_id, chain_name,
            sequence, entity_name, from_year, to_year, note)
            VALUES (?,?,?,?,?,?,?,?)""",
            (nid, c[2], f"{c[1]}", 1, c[1], c[3], c[4],
             "Raced under a single identity throughout."))
        have.add(c[2])

    for r in T.ENGINES:
        cur.execute("""INSERT INTO engine_manufacturers (id, name, country, first_year,
            last_year, wins, constructors_titles, drivers_titles, notes, confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?)""", r)

    for r in X_engine_eras():
        cur.execute("""INSERT INTO engine_eras (id, from_year, to_year, era_name, formula,
            aspiration, typical_config, approx_power_bhp, rev_limit, notes)
            VALUES (?,?,?,?,?,?,?,?,?,?)""", r)

    cur.executemany("""INSERT INTO personnel (id, full_name, nationality, role,
        active_from, active_to, associated_with, significance, confidence)
        VALUES (?,?,?,?,?,?,?,?,?)""", P.PERSONNEL)


def _stage_05_seasons(b):
    """seasons"""
    cur = b.cur

    # ------------------------------------------------------- seasons
    for r in S.SEASONS:
        (yr, rounds, champ, team, cpts, cwins, ru, rupts, cc, ccpts,
         formula, tyres, notes, conf) = r
        margin = round(cpts - rupts, 2) if (cpts is not None and rupts is not None) else None
        cur.execute("""INSERT INTO seasons (year, rounds, drivers_champion, champion_team,
            champion_points, champion_wins, runner_up, runner_up_points, margin,
            constructors_champion, constructors_points, engine_formula, tyre_suppliers,
            notes, confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (yr, rounds, champ, team, cpts, cwins, ru, rupts, margin, cc, ccpts,
             formula, tyres, notes, conf, S.SEASON_NOTES_SOURCE))


def _stage_06_circuits(b):
    """circuits"""
    cur = b.cur

    # ------------------------------------------------------ circuits
    for r in C.CIRCUITS:
        (cid, name, official, loc, country, ctype, first, last, length, turns,
         direction, chars, notes, conf) = r
        cur.execute("""INSERT INTO circuits (id, name, official_name, locality, country,
            circuit_type, first_gp, last_gp, length_km, turns, direction, characteristics,
            notes, confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, name, official, loc, country, ctype, first, last, length, turns,
             direction, chars, notes, conf, "https://www.formula1.com/en/racing"))

    for i, (cid, key, lname, fy, ty, byyear, length, turns, reason) in \
            enumerate(C.LAYOUTS, 1):
        cur.execute("""INSERT INTO circuit_layouts (id, circuit_id, layout_key,
            layout_name, from_year, to_year, by_year, length_km, turns,
            change_reason) VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (i, cid, key, lname, fy, ty, byyear, length, turns, reason))


def _stage_07_cars_inserted_in_file_order_so(b):
    """cars. Inserted in file order so that a car can reference the one it"""
    cur = b.cur
    known_cons = b.known_cons
    seen_cars = b.seen_cars

    # --- cars. Inserted in file order so that a car can reference the one it
    # supersedes, which is always listed before it.
    seen_cars = set()
    for c in CR.CARS:
        (cid, cons, desig, full, fy, ty, sup, designers, eng_id, eng_name, tyres,
         cfg, cc, asp, bhp, pnote, rev, ctype, gbox, susp, brakes,
         wt, wb, tf, tr, fuel, concept, innov, story, outcome,
         dt, ct, landmark, conf, sconf, src) = c
        if cid in seen_cars:
            raise SystemExit(f"duplicate car id {cid}")
        if sup and sup not in seen_cars:
            raise SystemExit(f"car {cid} supersedes {sup}, which is not listed above it")
        seen_cars.add(cid)
        cur.execute("""INSERT INTO cars (id, constructor_id, designation, full_name,
            from_year, to_year, supersedes_id, designers, engine_id, engine_name,
            tyres, engine_config, capacity_cc, aspiration, power_bhp, power_note,
            rev_limit_rpm, chassis_type, gearbox, suspension, brakes, weight_kg,
            wheelbase_mm, track_front_mm, track_rear_mm, fuel_capacity_l,
            concept, innovations, story, outcome, drivers_titles,
            constructors_titles, landmark, confidence, spec_confidence, source)
            VALUES (""" + ",".join("?" * 36) + ")",
            (cid, cons, desig, full, fy, ty, sup, designers, eng_id, eng_name,
             tyres, cfg, cc, asp, bhp, pnote, rev, ctype, gbox, susp, brakes,
             wt, wb, tf, tr, fuel, concept, innov, story, outcome, dt, ct,
             landmark, conf, sconf, src))

    # A figure withdrawn because it described the regulations rather than the
    # car must actually be gone, and the reason must be on the record.
    for car_id, field, old, reason in CR.WITHDRAWN:
        row = cur.execute(f"SELECT {field} FROM cars WHERE id=?",
                          (car_id,)).fetchone()
        if row is None:
            raise SystemExit(f"WITHDRAWN names unknown car {car_id}")
        if row[0] is not None:
            raise SystemExit(
                f"{car_id}.{field} is declared withdrawn but still holds "
                f"{row[0]}. Set it to None in data/cars.py.")
        cur.execute("""INSERT INTO discrepancies (subject, field, stored_value,
            derived_value, assessment, status)
            SELECT full_name, ?, ?, 'NULL', ?, 'resolved - withdrawn'
            FROM cars WHERE id = ?""", (field, str(old), reason, car_id))

    known_cons = {r[0] for r in cur.execute("SELECT id FROM constructors")}

    b.known_cons = known_cons
    b.seen_cars = seen_cars


def _stage_08_constructors_admitted_from_the_f1db_register(b):
    """constructors admitted from the F1DB register (data/teams.py"""
    cur = b.cur
    known_cons = b.known_cons

    # --- constructors admitted from the F1DB register (data/teams.py
    # F1DB_CONSTRUCTORS). The ids are authored there; every attribute comes
    # from the generated harvest files, so nobody types eighty-five team
    # names and no team appears without a reviewed line.
    f1db_names = {r[0]: (r[1], r[2], r[3]) for r in HV.load_f1db_constructors()}
    f1db_country = {r[0]: r[1] for r in HV.load_f1db_countries()}
    cons_years = {}
    for year, _e, f1db_cons, _em, _d, rounds, test in HV.load_entrant_drivers():
        # `rounds` is the test, NOT the testDriver flag. F1DB's flag records
        # the driver's ROLE in the team, not whether they raced: Jack Aitken
        # is a Williams test driver for 2020 and has `rounds: 16`, because he
        # started the Sakhir Grand Prix in Russell's place. Franck Montagny
        # is flagged the same for 2006 and raced rounds 5-11 for Super Aguri.
        # A driver with rounds entered those rounds; a test driver with none
        # never entered.
        if not rounds:
            continue
        cons_years.setdefault(f1db_cons, set()).add(year)
    for f1db_id in T.F1DB_CONSTRUCTORS:
        if f1db_id in known_cons:
            raise SystemExit(
                f"F1DB_CONSTRUCTORS admits {f1db_id}, which the register "
                f"already holds. Remove it from the list or rename the id.")
        if f1db_id in T.F1DB_CONSTRUCTOR_NON_MAPPING:
            raise SystemExit(f"{f1db_id} is both admitted and declared "
                             f"deliberately excluded")
        meta = f1db_names.get(f1db_id)
        if meta is None:
            raise SystemExit(f"F1DB_CONSTRUCTORS admits {f1db_id}, which is "
                             f"not in harvest/f1db_constructors.txt. Rerun "
                             f"tools/f1db_fetch.py.")
        yrs = cons_years.get(f1db_id)
        if not yrs:
            raise SystemExit(f"F1DB_CONSTRUCTORS admits {f1db_id}, which the "
                             f"entry lists show entering no championship race")
        name, full, country_id = meta
        cur.execute("""INSERT INTO constructors (id, name, full_name, country,
            first_entry, last_entry, wins, constructors_titles,
            drivers_titles, active, confidence, source)
            VALUES (?,?,?,?,?,?,NULL,0,0,?,?,?)""",
            (f1db_id, name, full, f1db_country.get(country_id),
             min(yrs), max(yrs), 1 if max(yrs) >= 2026 else 0,
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))
        known_cons.add(f1db_id)


def _stage_09_regulation_limits_loaded_before_the_chassis(b):
    """regulation limits. Loaded before the chassis register so the"""
    cur = b.cur

    # --- regulation limits. Loaded before the chassis register so the
    # register's weights can be measured against them.
    for i, (fy, ty, field, value, unit, note, conf, src) in \
            enumerate(X.REGULATION_LIMITS, 1):
        cur.execute("""INSERT INTO regulation_limits (id, from_year, to_year,
            field, value, unit, note, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (i, fy, ty, field, value, unit, note, conf, src))


def _stage_10_the_chassis_engine_and_entrant_register(b):
    """the chassis, engine and entrant register (F1DB, via"""
    cur = b.cur
    known_cons = b.known_cons
    entrants = b.entrants
    seen_cars = b.seen_cars

    # --- the chassis, engine and entrant register (F1DB, via
    # tools/f1db_fetch.py). Bulk rows: no person has touched them.
    known_eng = {r[0] for r in cur.execute("SELECT id FROM engine_manufacturers")}

    for eid, man, name, full, cap, cfg, asp in HV.load_engines():
        our_man = HV.constructor_for_f1db(man)
        cur.execute("""INSERT INTO engines (id, manufacturer_id,
            f1db_manufacturer_id, name, full_name, capacity_l, configuration,
            aspiration, confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (eid, our_man if our_man in known_eng else None, man, name, full,
             float(cap) if cap else None, cfg,
             asp.replace("_", " ").lower() if asp else None,
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))

    entrants = HV.load_entrants()
    # seasons a chassis was entered, from the entry lists
    chassis_years = {}
    for year, _entrant, _cons, _eman, ch_ids, _eng, _tyres in entrants:
        for ch in ch_ids:
            chassis_years.setdefault(ch, set()).add(year)

    # chassis -> the curated car that covers it, from CAR_CHASSIS
    chassis_car = {}
    for car_id, ch_ids in CR.CAR_CHASSIS.items():
        for ch in ch_ids:
            if ch in chassis_car:
                raise SystemExit(
                    f"chassis {ch} is claimed by both {chassis_car[ch]} "
                    f"and {car_id}")
            chassis_car[ch] = car_id

    specs = {}
    for row in HV.load_car_specs():
        for ch in (row["chassis_ids"] or "").split("+"):
            if ch:
                specs[ch] = row

    def _int(v):
        return int(float(v)) if v else None

    def _float(v):
        return float(v) if v else None

    for ch_id, f1db_cons, name, full in HV.load_chassis():
        if ch_id in chassis_car and chassis_car[ch_id] not in seen_cars:
            raise SystemExit(f"CAR_CHASSIS names unknown car "
                             f"{chassis_car[ch_id]}")
        yrs = chassis_years.get(ch_id) or set()
        # The season matters here too: the Alfa Romeo C42 and C43 are F1DB
        # `alfa-romeo` chassis and Sauber cars.
        #
        # Every season the chassis raced must agree about which constructor
        # it belongs to. Taking one of them - the first, say - would silently
        # pick the wrong entity for a chassis that raced across a rename.
        # None does today; the build refuses rather than wait for one.
        _cands = {HV.constructor_for_f1db(f1db_cons, y) for y in yrs} or \
                 {HV.constructor_for_f1db(f1db_cons)}
        if len(_cands) > 1:
            raise SystemExit(
                f"chassis {ch_id} raced {min(yrs)}-{max(yrs)}, which spans a "
                f"constructor rename: {sorted(_cands)}. Split the chassis or "
                f"the mapping; do not let one season decide.")
        our_cons = _cands.pop()
        sp = specs.get(ch_id, {})
        cur.execute("""INSERT INTO chassis (id, constructor_id,
            f1db_constructor_id, name, full_name, car_id, first_year,
            last_year, seasons, article, designers, chassis_type, susp_front,
            susp_rear, engine_name, engine_config, aspiration,
            engine_position, gearbox, gears, brakes, fuel, tyres, capacity_cc,
            power_bhp, power_note, weight_kg, wheelbase_mm, track_front_mm,
            track_rear_mm, fuel_capacity_l, predecessor, successor,
            published_races, published_wins, published_poles, confidence,
            spec_source, source) VALUES (""" + ",".join("?" * 39) + ")",
            (ch_id, our_cons if our_cons in known_cons else None, f1db_cons,
             name, full, chassis_car.get(ch_id),
             min(yrs) if yrs else None, max(yrs) if yrs else None, len(yrs),
             sp.get("article"), sp.get("designers"), sp.get("chassis_type"),
             sp.get("susp_front"), sp.get("susp_rear"), sp.get("engine_name"),
             sp.get("engine_config"), sp.get("aspiration"),
             sp.get("engine_position"), sp.get("gearbox"), sp.get("gears"),
             sp.get("brakes"), sp.get("fuel"), sp.get("tyres"),
             _int(sp.get("capacity_cc")), _int(sp.get("power_bhp")),
             sp.get("power_note"), _float(sp.get("weight_kg")),
             _int(sp.get("wheelbase_mm")), _int(sp.get("track_front_mm")),
             _int(sp.get("track_rear_mm")), _int(sp.get("fuel_l")),
             sp.get("predecessor"), sp.get("successor"),
             _int(sp.get("races")), _int(sp.get("wins")), _int(sp.get("poles")),
             HV.F1DB_CONFIDENCE,
             ("https://en.wikipedia.org/wiki/" +
              sp["article"].replace(" ", "_")) if sp.get("article") else None,
             HV.F1DB_SOURCE))

    b.entrants = entrants


def _stage_11_the_lead_image_of_each_accepted(b):
    """the lead image of each accepted car article, and its credit"""
    cur = b.cur

    # --- the lead image of each accepted car article, and its credit
    #
    # No image is stored. What is stored is which file an article leads with
    # and who must be credited for it. The harvest applied these checks
    # already; they run again here because a harvest file is an input like
    # any other, and a check belongs where the row is admitted rather than
    # only where it was written.
    known_articles = {r[0] for r in cur.execute(
        "SELECT DISTINCT article FROM chassis WHERE article IS NOT NULL")}
    img_rows = img_skipped = 0
    for im in HV.load_article_images():
        article = im.get("article")
        # An image for an article no chassis claims describes nothing this
        # database holds. That is not an error in the file - the spec harvest
        # may have accepted an article the chassis linkage later dropped -
        # but it is not a row either.
        if article not in known_articles:
            img_skipped += 1
            continue
        # A local en.wikipedia.org upload is local BECAUSE it is non-free.
        if im.get("repository") != "shared":
            raise SystemExit(
                f"article_images: {article} points at a file hosted "
                f"{im.get('repository')!r}, not Wikimedia Commons. Only "
                f"Commons files may be linked; rerun "
                f"tools/wikimedia_images.py.")
        if not im.get("licence"):
            raise SystemExit(f"article_images: {article} states no licence.")
        # CC BY and CC BY-SA attribution is not optional. A file with no one
        # to attribute cannot be displayed, so it cannot be stored either.
        if not (im.get("artist") or im.get("credit")):
            raise SystemExit(
                f"article_images: {article} names no author for "
                f"{im.get('file_name')}. Rerun tools/wikimedia_images.py.")
        cur.execute("""INSERT INTO article_images (article, file_name,
            repository, licence, licence_url, artist, credit, description_url,
            width, height, name_matches, confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (article, im["file_name"], im["repository"], im["licence"],
             im.get("licence_url"), im.get("artist"), im.get("credit"),
             im["description_url"],
             int(im["width"]) if im.get("width") else None,
             int(im["height"]) if im.get("height") else None,
             1 if im.get("name_matches") == "1" else 0,
             "unverified"))
        img_rows += 1
    if img_rows:
        named = cur.execute("SELECT COUNT(*) FROM article_images "
                            "WHERE name_matches = 1").fetchone()[0]
        print(f"  article images: {img_rows} rows, {img_skipped} for "
              f"articles no chassis claims; {named} name the car in the "
              f"file name and {img_rows - named} do not")


def _stage_12_circuit_centrelines_re_measured_before_they(b):
    """circuit centrelines, re-measured before they are admitted"""
    cur = b.cur

    # --- circuit centrelines, re-measured before they are admitted
    #
    # The harvest compared its own measurement against the published length.
    # This measures the stored geometry AGAIN, here, offline, from the
    # coordinates actually being written. That is not belt and braces: the
    # tool could have measured one thing and serialised another, and the
    # failure this guards against - a naive member sum that puts Monaco 12%
    # long - looks perfectly reasonable in isolation.
    geom_tolerance = 0.02
    geom_rows = 0
    unclosed = []
    for g in HV.load_circuit_geometry():
        cid = g["circuit_id"]
        if not cur.execute("SELECT 1 FROM circuits WHERE id = ?",
                           (cid,)).fetchone():
            raise SystemExit(f"circuit_geometry: no circuit {cid!r}.")
        key = g.get("layout_key") or None
        if key and not cur.execute(
                "SELECT 1 FROM circuit_layouts WHERE circuit_id = ? "
                "AND layout_key = ?", (cid, key)).fetchone():
            raise SystemExit(
                f"circuit_geometry: {cid} names layout {key!r}, which is not "
                f"in circuit_layouts.")

        geo = json.loads(g["centreline"])
        if geo.get("type") != "MultiLineString":
            raise SystemExit(
                f"circuit_geometry: {cid} centreline is "
                f"{geo.get('type')!r}, expected MultiLineString.")
        # GeoJSON is lon,lat. Reading it as lat,lon would measure the same
        # length and put every circuit in the wrong place, so the order is
        # asserted rather than assumed.
        measured_m = 0.0
        for line in geo["coordinates"]:
            for a, b in zip(line, line[1:]):
                measured_m += _haversine((a[1], a[0]), (b[1], b[0]))
        measured = measured_m / 1000.0
        published = float(g["published_km"])
        delta = (measured - published) / published
        if abs(delta) > geom_tolerance:
            raise SystemExit(
                f"circuit_geometry: {cid} measures {measured:.3f} km against "
                f"a published {published:.3f} km ({delta * 100:+.1f}%), "
                f"outside {geom_tolerance * 100:.0f}%. The trace and the "
                f"length disagree; do not store it.")

        # Whether the ways form a lap is a different question from whether
        # they measure the right length, and the length cannot answer it: Las
        # Vegas is missing a way and still measures within 2%. Ask it here,
        # where the row is admitted, and store the answer - the front end
        # offers to walk a lap only where one exists.
        closes, loose, used, walked = _lap_topology(geo["coordinates"])
        if not closes:
            unclosed.append(
                f"{cid} ({loose} loose end{'s' if loose != 1 else ''}, "
                f"{used}/{len(geo['coordinates'])} ways walked, "
                f"{(measured_m - walked) / 1000:.2f} km unaccounted)")

        cur.execute("""INSERT INTO circuit_geometry (circuit_id, layout_key,
            wikidata_id, osm_relation, centreline, measured_km, published_km,
            delta_pct, node_count, segment_count, loose_ends, closes,
            osm_timestamp, licence, confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, key, g["wikidata_id"], int(g["osm_relation"]),
             g["centreline"], round(measured, 4), published,
             round(delta * 100, 2),
             int(g["node_count"]) if g.get("node_count") else None,
             len(geo["coordinates"]), loose, 1 if closes else 0,
             g.get("osm_timestamp"), "ODbL-1.0", "reference"))
        geom_rows += 1
    if geom_rows:
        worst = cur.execute("SELECT MAX(ABS(delta_pct)) "
                            "FROM circuit_geometry").fetchone()[0]
        laps = cur.execute("SELECT COUNT(*) FROM circuit_geometry "
                           "WHERE closes = 1").fetchone()[0]
        print(f"  circuit geometry: {geom_rows} centrelines, all within "
              f"{geom_tolerance * 100:.0f}% of the published length "
              f"(worst {worst:+.2f}%)")
        print(f"    {laps} of {geom_rows} stitch into a closed lap")
        for line in unclosed:
            # Not fatal: an incomplete trace is still the best shape anyone
            # has for that circuit, and it is drawn. It just cannot be walked.
            print(f"    does not close: {line}")


def _stage_13_a_regulation_figure_is_not_a(b):
    """a regulation figure is not a measurement, part one"""
    cur = b.cur

    # --- a regulation figure is not a measurement, part one
    #
    # Drop any harvested figure that exactly restates a limit this database
    # has a source for. tools/wikispec_fetch.py already does this, but it
    # does it per chassis, and a family article carries one row for several
    # chassis - so the Ferrari F2004 and F2004M share a row whose span is
    # 2004-2005, and whichever chassis was read first decided which seasons
    # were tested. Doing it here, against the span actually stored, closes
    # that. The build is where the guarantee belongs anyway: the harvest can
    # be re-run by anyone, and this cannot be skipped.
    reg_by_year = {}
    for lo_, hi_, field_, val_, _u, _n, _c, _s in X.REGULATION_LIMITS:
        for y in range(lo_, (hi_ or lo_) + 1):
            reg_by_year.setdefault(y, {})[field_] = val_
    for col, field_, what in (("weight_kg", "minimum_weight_kg", "minimum"),
                              ("wheelbase_mm", "maximum_wheelbase_mm", "maximum")):
        for cid_, val, lo_, hi_ in cur.execute(
                f"""SELECT id, {col}, first_year, last_year FROM chassis
                    WHERE {col} IS NOT NULL AND first_year IS NOT NULL""").fetchall():
            hit = [y for y in range(lo_, (hi_ or lo_) + 1)
                   if reg_by_year.get(y, {}).get(field_) == val]
            if hit:
                cur.execute(f"UPDATE chassis SET {col}=NULL WHERE id=?", (cid_,))
                cur.execute("""INSERT INTO discrepancies (subject, field,
                    stored_value, derived_value, assessment, status)
                    SELECT full_name, ?, ?, 'NULL', ?, 'resolved - withdrawn'
                    FROM chassis WHERE id = ?""",
                    (col, str(val),
                     f"{val:g} is the {hit[0]} regulation {what}, which every "
                     f"car that season was built to. It describes the rules, "
                     f"not this car.", cid_))


def _stage_14_a_regulation_figure_is_not_a(b):
    """a regulation figure is not a measurement, part two"""
    cur = b.cur
    known_cons = b.known_cons
    entrants = b.entrants

    # --- a regulation figure is not a measurement, part two
    #
    # regulation_limits catches only the years a limit has actually been
    # sourced for, and that series is full of holes on purpose: carrying a
    # value across a change no source records would invent one. Whole eras
    # are uncovered.
    #
    # The data closes them from the other direction. A figure that is
    # genuinely a measurement of one car is that car's alone; a figure that
    # three or more DIFFERENT CONSTRUCTORS all quote for cars racing in the
    # same season is the rule they were built to.
    #
    # Both qualifications are load-bearing, and each was learned by getting
    # it wrong:
    #
    #   * Constructors, not cars. The BRM P126, P133 and P138 share a
    #     wheelbase because they are one car evolved. Three cars from one
    #     constructor is evidence of nothing.
    #   * Per season, not per group. A minimum stays in force for years, so
    #     the cars quoting it need not overlap each other - 600 kg covers
    #     1995 to 2003. Requiring one year common to all of them made the
    #     test fire almost never. Counting per season also stops the reverse
    #     error: 620 kg is quoted by fourteen constructors, but thirteen of
    #     them are 2010 and the fourteenth is a 1955 Lancia, which keeps its
    #     figure because in 1955 nobody else shared it.
    #   * Weight only. The test says "a figure a whole grid shares is the
    #     rule", which is sound only where a rule actually fixes that figure.
    #     Minimum weight has been fixed for the whole grid continuously since
    #     1961. Wheelbase has never been capped at all except for 2026, which
    #     regulation_limits already covers - so a shared wheelbase cannot be
    #     a regulation and must be something else. Running the test on it
    #     dropped 2,540 mm, 2,692 mm and 2,794 mm from fifteen cars, which
    #     are 100, 106 and 110 inches exactly: designers of that era worked
    #     in imperial and rounded to the same numbers. Those are real
    #     measurements and they are kept.
    for col, what in (("weight_kg", "minimum weight"),):
        rows_ = cur.execute(
            f"""SELECT id, {col}, f1db_constructor_id, first_year, last_year
                FROM chassis
                WHERE {col} IS NOT NULL AND first_year IS NOT NULL""").fetchall()
        # (value, season) -> constructors quoting it, and the chassis doing so
        by_year = {}
        for cid_, val, cons_, lo_, hi_ in rows_:
            for y in range(lo_, (hi_ or lo_) + 1):
                cons, ids = by_year.setdefault((val, y), (set(), set()))
                cons.add(cons_)
                ids.add(cid_)
        drop, evidence = set(), {}
        for (val, y), (cons, ids) in by_year.items():
            if len(cons) < 3:
                continue
            drop |= ids
            best = evidence.get(val)
            if best is None or len(cons) > best[1]:
                evidence[val] = (y, len(cons), len(ids))
        if drop:
            cur.executemany(f"UPDATE chassis SET {col}=NULL WHERE id=?",
                            [(c,) for c in sorted(drop)])
            for val, (y, ncons, nids) in sorted(evidence.items()):
                cur.execute("""INSERT INTO discrepancies (subject, field,
                    stored_value, derived_value, assessment, status)
                    VALUES (?,?,?,?,?,?)""",
                    (f"{nids} chassis quoting {val:g}", col, str(val), "NULL",
                     f"{ncons} different constructors racing in {y} all quote "
                     f"{val:g} for this field. A figure a whole grid shares is "
                     f"the season's {what}, not a measurement of any one car, "
                     f"so it is not stored per chassis. The rule itself "
                     f"belongs in regulation_limits.",
                     "resolved - withdrawn"))

    known_years = {r[0] for r in cur.execute("SELECT year FROM seasons")}
    for i, (year, entrant, f1db_cons, eng_man, ch_ids, eng_ids, tyres) in \
            enumerate(entrants, 1):
        if year not in known_years:
            raise SystemExit(f"entrants.txt: season {year} is not in the "
                             f"season register")
        our_cons = HV.constructor_for_f1db(f1db_cons, year)
        cur.execute("""INSERT INTO season_entrants (id, year, entrant_id,
            f1db_constructor_id, constructor_id, engine_manufacturer_id,
            chassis_ids, chassis_count, engine_ids, tyre_ids, confidence,
            source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (i, year, entrant, f1db_cons,
             our_cons if our_cons in known_cons else None, eng_man,
             "+".join(ch_ids) or None, len(ch_ids),
             "+".join(eng_ids) or None, "+".join(tyres) or None,
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))

    for gid, name, country, aliases, notes in EV.GRANDS_PRIX:
        cur.execute("""INSERT INTO grands_prix (id, name, country, aliases, notes,
            confidence) VALUES (?,?,?,?,?,?)""",
            (gid, name, country, ", ".join(aliases) or None, notes or None, "high"))


def _stage_15_rules_tech_safety(b):
    """rules / tech / safety"""
    cur = b.cur

    # ------------------------------------------- rules / tech / safety
    for i, (yr, cat, title, detail, impact) in enumerate(X.REGULATIONS, 1):
        cur.execute("""INSERT INTO regulation_changes (id, year, category, title, detail,
            impact, source) VALUES (?,?,?,?,?,?,?)""",
            (i, yr, cat, title, detail, impact, "https://www.fia.com/regulations/formula-1"))

    for i, r in enumerate(X.INNOVATIONS, 1):
        cur.execute("""INSERT INTO technical_innovations (id, year, innovation, originator,
            description, legacy, banned_year) VALUES (?,?,?,?,?,?,?)""", (i,) + r)

    for i, r in enumerate(X.SAFETY, 1):
        cur.execute("""INSERT INTO safety_milestones (id, year, milestone, trigger_event,
            description) VALUES (?,?,?,?,?)""", (i,) + r)

    for i, r in enumerate(X.TYRES, 1):
        cur.execute("""INSERT INTO tyre_suppliers (id, supplier, from_year, to_year,
            exclusive, notes) VALUES (?,?,?,?,?,?)""", (i,) + r)

    for i, r in enumerate(X.POINTS, 1):
        cur.execute("""INSERT INTO points_systems (id, from_year, to_year, scoring,
            fastest_lap, dropped_scores, notes) VALUES (?,?,?,?,?,?,?)""", (i,) + r)

    off = len(X.POINTS)
    for i, (fy, ty, scoring, note) in enumerate(X.SPRINT_POINTS, off + 1):
        cur.execute("""INSERT INTO points_systems (id, from_year, to_year, scoring,
            fastest_lap, dropped_scores, notes) VALUES (?,?,?,?,?,?,?)""",
            (i, fy, ty, "SPRINT: " + scoring, None, None, note))

    for i, r in enumerate(X.RECORDS, 1):
        cat, rec, holder, val, detail, asof = r
        cur.execute("""INSERT INTO records (id, category, record, holder, value, detail,
            as_of) VALUES (?,?,?,?,?,?,?)""", (i, cat, rec, holder, val, detail, asof))

    for i, r in enumerate(X.ERAS, 1):
        cur.execute("""INSERT INTO eras (id, from_year, to_year, era_name, summary,
            dominant_teams, defining_features) VALUES (?,?,?,?,?,?,?)""", (i,) + r)

    cur.executemany("INSERT INTO glossary (term, category, definition) VALUES (?,?,?)",
                    X.GLOSSARY)

    for i, r in enumerate(X.GOVERNANCE, 1):
        cur.execute("""INSERT INTO governance (id, year, event, detail, significance)
            VALUES (?,?,?,?,?)""", (i,) + r)


def _stage_16_current_season(b):
    """current season"""
    cur = b.cur
    race_key = b.race_key
    lookup = b.lookup
    driver_id = b.driver_id

    # -------------------------------------------------- current season
    for i, (cid, did, car, pu, num, role) in enumerate(N.ENTRIES_2026, 1):
        cur.execute("""INSERT INTO season_entries (id, year, constructor_id, driver_id,
            car, power_unit, car_number, role, confidence)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (i, 2026, cid, did, car, pu, num, role, "verified"))

    sid = 0
    for year, tbl, rows, asof in (
            (2026, "drivers", N.DRIVER_STANDINGS_2026, "2026-09-04 (after round 12)"),
            (2026, "constructors", N.TEAM_STANDINGS_2026, "2026-09-04 (after round 12)"),
            (2025, "drivers", N.DRIVER_STANDINGS_2025, "final"),
            (2025, "constructors", N.TEAM_STANDINGS_2025, "final")):
        for row in rows:
            sid += 1
            if tbl == "drivers":
                pos, eid, disp, team, pts = row
            else:
                pos, eid, disp, pts = row
                team = None
            cur.execute("""INSERT INTO standings (id, year, table_type, position, entity,
                entity_id, team, points, as_of, confidence, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (sid, year, tbl, pos, disp, eid, team, pts, asof, "verified", N.SOURCE_F1))

    # =================================================================
    # Races and race entries
    # =================================================================
    gp_map = EV.name_to_id()
    # Built with collision detection. Two drivers whose names normalise to the
    # same string would otherwise overwrite each other silently, and the
    # harvest would credit one with the other's results.
    lookup, _clash = {}, {}
    for _did, _name in cur.execute("SELECT id, full_name FROM drivers"):
        _k = HV._norm(_name)
        if _k in lookup:
            _clash.setdefault(_k, [lookup[_k]]).append(_did)
        lookup[_k] = _did
    _clash = {k: v for k, v in _clash.items() if k not in HV.DRIVER_ALIASES}
    if _clash:
        raise SystemExit("driver names collide under _norm(): " + "; ".join(
            f"{k!r} -> {v}" for k, v in _clash.items()))
    lookup.update(HV.DRIVER_ALIASES)

    def driver_id(name, where):
        did = lookup.get(HV._norm(name))
        if did is None:
            raise SystemExit(f"unmapped driver {name!r} at {where}")
        return did

    # one dict per race, from the two winner sources
    races = []
    for h in HV.load():
        races.append({
            "year": h["year"], "round": h["round"], "gp_name": h["gp_name"],
            "winners": [h["winner_name"]] + ([h["co_winner_name"]]
                                             if h["co_winner_name"] else []),
            "chassis": h["chassis"], "entrant": h["entrant"],
            "confidence": h["confidence"], "source": h["source"],
        })
    for (yr, rnd, gp, win, cons) in N.RACE_RESULTS:
        races.append({
            "year": yr, "round": rnd, "gp_name": gp, "winners": None,
            "winner_id": win, "constructor_id": cons, "chassis": None,
            "entrant": None, "confidence": "verified", "source": N.SOURCE_F1,
        })

    cal = {r[0]: r for r in N.CALENDAR_2026}
    race_key = {}
    rid = 0
    for r in races:
        rid += 1
        gid = gp_map.get(r["gp_name"])
        if gid is None:
            raise SystemExit(f"unmapped grand prix {r['gp_name']!r}")
        circuit = EV.SINGLE_CIRCUIT.get(gid)
        dates = sprint = None
        if r["year"] == 2026 and r["round"] in cal:
            c = cal[r["round"]]
            circuit, dates, sprint = c[4], c[5], c[6]
        cur.execute("""INSERT INTO races (id, year, round, gp_id, name_used,
            circuit_id, dates, sprint, status, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, r["year"], r["round"], gid, r["gp_name"], circuit, dates,
             sprint or 0, "completed", r["confidence"], r["source"]))
        race_key[(r["year"], r["round"])] = rid

        # winner entries
        if r["winners"] is not None:
            cons = HV.constructor_id_for(r["chassis"], r["year"])
            if cons is None and HV._norm(r["chassis"]) not in HV.INDY_CHASSIS:
                raise SystemExit(f"unmapped constructor {r['chassis']!r}")
            shared = 1 if len(r["winners"]) > 1 else 0
            for nm in r["winners"]:
                cur.execute("""INSERT INTO race_entries (race_id, driver_id,
                    constructor_id, entrant, finish_position, shared_drive,
                    confidence, source) VALUES (?,?,?,?,?,?,?,?)""",
                    (rid, driver_id(nm, f"{r['year']} r{r['round']}"), cons,
                     r["entrant"], 1, shared, r["confidence"], r["source"]))
        else:
            cur.execute("""INSERT INTO race_entries (race_id, driver_id,
                constructor_id, finish_position, confidence, source)
                VALUES (?,?,?,?,?,?)""",
                (rid, r["winner_id"], r["constructor_id"], 1,
                 r["confidence"], r["source"]))

    # 2026 rounds not yet run: the event exists, with no entries
    for c in N.CALENDAR_2026:
        if (2026, c[0]) in race_key:
            continue
        rid += 1
        gid = gp_map.get(c[1])
        if gid is None:
            raise SystemExit(f"unmapped grand prix {c[1]!r}")
        cur.execute("""INSERT INTO races (id, year, round, gp_id, name_used,
            circuit_id, dates, sprint, status, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, 2026, c[0], gid, c[1], c[4], c[5], c[6], c[7],
             "verified", N.SOURCE_F1))
        race_key[(2026, c[0])] = rid

    # A calendar row whose country field carries a parenthesis is a declared
    # oddity - "Bahrain (hosted at Sepang, Malaysia)" - and the page rendered
    # a Bahrain Grand Prix at a Malaysian circuit with no explanation, because
    # this was the one authored field nothing read. It becomes the race's note,
    # which both renderers already show as the lede.
    for c in N.CALENDAR_2026:
        if "(" in c[2] and c[2].endswith(")"):
            aside = c[2][c[2].index("(") + 1:-1]
            cur.execute("""UPDATE races SET note = ? WHERE year = 2026 AND round = ?
                           AND note IS NULL""",
                        (f"The {c[1]} of 2026 is {aside}.", c[0]))

    b.race_key = race_key
    b.lookup = lookup
    b.driver_id = driver_id

    # Every F1DB loader looks a harvest row's (year, round) up here. A round
    # inside a season this database holds but has no race for is F1DB
    # reaching the current season before the calendar does, and is skipped
    # and counted. A YEAR the season register does not hold is a different
    # thing: it is next season arriving, and skipping it silently is how the
    # Monday refresh would move BUILT and deploy a fresh build date over
    # frozen data - a synthetic 2027 result once rebuilt green with zero
    # 2027 rows. So that is refused, with the fix named.
    known_years = {r[0] for r in cur.execute("SELECT year FROM seasons")}
    skipped_rounds = {}

    def race_for(year, rnd, what):
        year, rnd = int(year), int(rnd)
        rid = race_key.get((year, rnd))
        if rid is None:
            if year not in known_years:
                raise SystemExit(
                    f"{what}: {year} round {rnd} is in the harvest but {year} is "
                    f"not in the season register. Add the season to data/ "
                    f"(seasons, calendar) before loading its results.")
            skipped_rounds[what] = skipped_rounds.get(what, 0) + 1
        return rid

    b.race_for = race_for
    b.skipped_rounds = skipped_rounds


def _stage_17_pole_position_and_fastest_lap_as(b):
    """pole position and fastest lap, as attributes of an entry"""
    cur = b.cur
    race_key = b.race_key
    lookup = b.lookup
    driver_id = b.driver_id

    # --- pole position and fastest lap, as attributes of an entry
    # Each harvested row also carries the race winner, which must equal the
    # winner already recorded. A mismatch means the row describes a different
    # race and is rejected outright.
    applied = 0
    restored = []
    for h in HV.load_poles():
        rid = race_key.get((h["year"], h["round"]))
        if rid is None:
            raise SystemExit(f"pole harvest: no race at {h['year']} r{h['round']}")
        stored = cur.execute("""SELECT driver_id FROM race_entries
            WHERE race_id=? AND finish_position=1 ORDER BY id LIMIT 1""",
            (rid,)).fetchone()
        got = lookup.get(HV._norm(h["winner_check"].split("/")[0].strip()))
        if stored is None or got != stored[0]:
            raise SystemExit(
                f"pole harvest: winner mismatch at {h['year']} r{h['round']}: "
                f"harvest {h['winner_check']!r} vs stored "
                f"{stored[0] if stored else None!r}")

        def upsert(did, source=None, **fields):
            row = cur.execute("""SELECT id FROM race_entries
                WHERE race_id=? AND driver_id=?""", (rid, did)).fetchone()
            if row:
                sets = ", ".join(f"{k}=?" for k in fields)
                cur.execute(f"UPDATE race_entries SET {sets} WHERE id=?",
                            (*fields.values(), row[0]))
            else:
                cols = ", ".join(fields)
                qs = ",".join("?" * len(fields))
                cur.execute(f"""INSERT INTO race_entries (race_id, driver_id,
                    confidence, source, {cols}) VALUES (?,?,?,?,{qs})""",
                    (rid, did, "reference", source or h["source"],
                     *fields.values()))

        pole_names = HV.split_names(h["pole"])
        fl_names = HV.split_names(h["fastest_lap"])
        # `pole`, not `grid = 1`. The season record credits pole position;
        # where the car started is F1DB's grid, loaded later, and the two are
        # not the same fact (see WHAT 'POLE' MEANS HERE in schema.sql).
        if pole_names:
            upsert(driver_id(pole_names[0], f"pole {h['year']} r{h['round']}"), pole=1)
        for nm in fl_names:
            upsert(driver_id(nm, f"fastest lap {h['year']} r{h['round']}"),
                   source=h["fastest_lap_source"],
                   fastest_lap=1, fastest_lap_shared=len(fl_names))
        if h["shared_override"]:
            restored.append((h["year"], h["round"]))
        applied += 1
    if applied != 1161:
        raise SystemExit(f"pole harvest: expected 1161 rows, applied {applied}")

    # The shared fastest laps load_poles() restored are a change to what the
    # harvest said, so each goes on the record as a resolved disagreement:
    # the single name the season table gave against the names the race
    # article gives, with the source.
    for yr_, rnd_ in sorted(restored):
        held_, names_, src_, why_ = HV.SHARED_FASTEST_LAPS[(yr_, rnd_)]
        cur.execute("""INSERT INTO discrepancies (subject, field, stored_value,
            derived_value, assessment, status) VALUES (?,?,?,?,?,?)""",
            (f"{yr_} round {rnd_}", "fastest lap", held_, names_,
             f"{why_} Source: {src_}", "resolved - shared fastest lap restored"))


def _stage_18_race_venue_as_circuit_id_on(b):
    """race venue, as circuit_id on the event"""
    cur = b.cur
    race_key = b.race_key
    lookup = b.lookup

    # --- race venue, as circuit_id on the event
    # Harvested from the same season articles, again carrying the winner so
    # each row self-validates. Two further checks apply: where the Grand Prix
    # has only ever used one circuit the harvested venue must be that circuit,
    # and where a circuit is already stored from the verified 2026 calendar
    # the harvest must agree with it.
    applied = 0
    for h in HV.load_venues():
        rid = race_key.get((h["year"], h["round"]))
        if rid is None:
            raise SystemExit(f"venue harvest: no race at {h['year']} r{h['round']}")
        if h["circuit_id"] is None:
            raise SystemExit(
                f"venue harvest: unresolved venue {h['venue']!r} "
                f"at {h['year']} r{h['round']}")
        stored = cur.execute("""SELECT driver_id FROM race_entries
            WHERE race_id=? AND finish_position=1 ORDER BY id LIMIT 1""",
            (rid,)).fetchone()
        got = lookup.get(HV._norm(h["winner_check"].split("/")[0].strip()))
        if stored is None or got != stored[0]:
            raise SystemExit(
                f"venue harvest: winner mismatch at {h['year']} r{h['round']}: "
                f"harvest {h['winner_check']!r} vs stored "
                f"{stored[0] if stored else None!r}")
        gid, prior = cur.execute(
            "SELECT gp_id, circuit_id FROM races WHERE id=?", (rid,)).fetchone()
        single = EV.SINGLE_CIRCUIT.get(gid)
        if single and single != h["circuit_id"]:
            raise SystemExit(
                f"venue harvest: {h['year']} r{h['round']} {gid} is a "
                f"single-circuit event at {single} but harvest gives "
                f"{h['circuit_id']} ({h['venue']!r})")
        if prior and prior != h["circuit_id"]:
            raise SystemExit(
                f"venue harvest: {h['year']} r{h['round']} already stored as "
                f"{prior} but harvest gives {h['circuit_id']} ({h['venue']!r})")
        cur.execute("""UPDATE races SET circuit_id=?,
            source=COALESCE(source, ?) WHERE id=?""",
            (h["circuit_id"], h["source"], rid))
        applied += 1
    if applied != 1161:
        raise SystemExit(f"venue harvest: expected 1161 rows, applied {applied}")


def _stage_19_races_that_used_a_layout_other(b):
    """races that used a layout other than the circuit's for that season"""
    cur = b.cur

    # --- races that used a layout other than the circuit's for that season
    for cid, key, yr, rnd in C.RACE_LAYOUTS:
        if not cur.execute("""SELECT 1 FROM circuit_layouts
                WHERE circuit_id=? AND layout_key=?""", (cid, key)).fetchone():
            raise SystemExit(f"race layout override: no layout {cid}:{key}")
        n = cur.execute("""UPDATE races SET layout_key=? WHERE year=? AND round=?
            AND circuit_id=?""", (key, yr, rnd, cid)).rowcount
        if n != 1:
            raise SystemExit(
                f"race layout override: no {cid} race at {yr} round {rnd}")


def _stage_20_second_and_third_place_from_the(b):
    """second and third place, from the Jolpica-F1 API"""
    cur = b.cur
    race_key = b.race_key

    # --- second and third place, from the Jolpica-F1 API
    # Checked three ways before anything is written:
    #   1. the race must exist in this database;
    #   2. the driver must resolve to a register entry - no invented drivers;
    #   3. the row must not claim a position the winner already holds, and no
    #      two drivers may claim the same position in the same race.
    # A driver who already has an entry (as pole-sitter or fastest-lap setter)
    # is UPDATED, not duplicated.
    dmap, unresolved = RS.build_driver_map(cur)
    if unresolved:
        raise SystemExit("podiums: unresolved driver ids: " + ", ".join(unresolved))

    claimed = {}
    applied = 0
    for h in RS.load():
        rid = race_key.get((h["year"], h["round"]))
        if rid is None:
            raise SystemExit(f"podiums: no race at {h['year']} r{h['round']}")
        did = dmap[h["driver_ergast"]]
        # Two drivers may legitimately share a position: they shared a car.
        # A shared drive has the same constructor and the same lap count -
        # Serafini and Ascari, second at Monza in 1950, are the first of them.
        # Anything else claiming a taken position is an error, not a share.
        key = (rid, h["position"])
        prev = claimed.get(key)
        shared = 0
        if prev:
            if prev["driver"] == did:
                raise SystemExit(
                    f"podiums: {h['year']} r{h['round']} lists {did} twice "
                    f"at position {h['position']}")
            if (prev["constructor"] != h["constructor_ergast"]
                    or prev["laps"] != h["laps"]):
                raise SystemExit(
                    f"podiums: {h['year']} r{h['round']} position "
                    f"{h['position']} claimed by {prev['driver']} and {did} "
                    f"in different cars - not a shared drive")
            shared = 1
            cur.execute("""UPDATE race_entries SET shared_drive=1
                WHERE race_id=? AND driver_id=?""", (rid, prev["driver"]))
        claimed[key] = {"driver": did, "constructor": h["constructor_ergast"],
                        "laps": h["laps"]}

        winner = cur.execute("""SELECT driver_id FROM race_entries
            WHERE race_id=? AND finish_position=1 ORDER BY id LIMIT 1""",
            (rid,)).fetchone()
        if winner and winner[0] == did:
            raise SystemExit(
                f"podiums: {h['year']} r{h['round']} says {did} finished "
                f"{h['position']}, but this database has him as the winner")

        # Grid is taken from this source EXCEPT where it is 1. Pole is
        # established for all 1,161 races by the pole harvest, and it is a
        # single fact per race; this source hands the car's grid slot to every
        # driver who shared it, so accepting grid 1 here gave Farina a pole in
        # 1955 for a car Gonzalez had qualified.
        grid = h["grid"] if h["grid"] and h["grid"] > 1 else None

        cur.execute("""INSERT INTO race_entries (race_id, driver_id,
                constructor_id, finish_position, grid, classified, status,
                laps_completed, points, shared_drive, confidence, source)
            VALUES (?,?,?,?,?,1,?,?,?,?,?,?)
            ON CONFLICT (race_id, driver_id) DO UPDATE SET
                constructor_id  = COALESCE(excluded.constructor_id, constructor_id),
                -- A driver who shared two cars that both finished on the
                -- podium keeps the better result: race_entries is one row per
                -- driver per race and cannot hold two. The 1955 Argentine
                -- Grand Prix, run in extreme heat with drivers swapping cars,
                -- is the only race where this happens. It is in known_gaps.
                finish_position = MIN(COALESCE(finish_position, 99),
                                      excluded.finish_position),
                grid            = COALESCE(grid, excluded.grid),
                classified      = 1,
                status          = excluded.status,
                laps_completed  = excluded.laps_completed,
                points          = excluded.points,
                shared_drive    = MAX(shared_drive, excluded.shared_drive)""",
            (rid, did, h["constructor_id"], h["position"], grid,
             h["status"], h["laps"], h["points"], shared, h["confidence"],
             h["source"]))
        applied += 1
    # harvest/podiums.txt is empty in the distributed build: the full
    # classification comes from tools/ergast_load.py, which writes to the
    # database directly. The file path is kept so a harvested subset can be
    # loaded the same way, and so this loader's checks apply either way.
    if applied:
        print(f"  podiums: {applied} rows from harvest/podiums.txt")


def _stage_21_the_full_classification_qualifying_and_stand(b):
    """the full classification, qualifying and standings, from F1DB"""
    cur = b.cur
    race_key = b.race_key
    f1db_drivers = b.f1db_drivers

    # --- the full classification, qualifying and standings, from F1DB
    #
    # This is the block that closed known_gaps #1. The facts are the same ones
    # tools/ergast_load.py fetches from Jolpica, and the difference is the
    # licence: F1DB is CC BY 4.0, attribution only, so these rows can live in
    # the repository and ship in the built database. Jolpica's Ergast lineage
    # is CC BY-NC-SA, and a non-commercial clause is why the distributed
    # build held 2.1 rows per race for seven versions.
    #
    # Jolpica is not retired by this. It now loads on top and DISAGREES where
    # it disagrees, which is worth more than a second copy of the same rows.
    f1db_drivers, drv_collisions = HV.resolve_f1db_drivers(
        {r[0]: r[1] for r in cur.execute("SELECT id, full_name FROM drivers")})
    if drv_collisions:
        raise SystemExit(
            f"race results: {len(drv_collisions)} of our drivers are claimed "
            f"by more than one F1DB id, e.g. {list(drv_collisions.items())[:2]}")

    results_by_race = {}
    for row in HV.load_race_results():
        results_by_race.setdefault(
            (int(row["year"]), int(row["round"])), []).append(row)

    res_rows = res_skipped_driver = res_races = 0
    unknown_drivers = set()
    for (yr, rnd), rows in sorted(results_by_race.items()):
        rid = b.race_for(yr, rnd, "race results")
        if rid is None:
            continue

        # THE CHECK. The winner of this race is already established, from a
        # different source, for all 1,161 races. If F1DB disagrees the race is
        # refused whole - never partially accepted, never nudged into a match.
        # A shared drive puts two drivers on position 1 and both are winners,
        # so this compares SETS: taking "the" winner would have made the 1956
        # Argentine and 1957 British Grands Prix look like disagreements when
        # both sources say the same thing.
        ours = {r[0] for r in cur.execute(
            "SELECT driver_id FROM race_entries WHERE race_id=? "
            "AND finish_position=1", (rid,))}
        theirs = set()
        for r in rows:
            if r["position"] == "1":
                did = f1db_drivers.get(r["driver_id"])
                if did:
                    theirs.add(did)
        if ours and theirs and ours != theirs:
            raise SystemExit(
                f"race results: {yr} r{rnd} - this database has "
                f"{sorted(ours)} as the winner, F1DB has {sorted(theirs)}. "
                f"The race is refused; resolve the disagreement before "
                f"loading it.")

        res_races += 1
        for r in rows:
            did = f1db_drivers.get(r["driver_id"])
            if not did:
                res_skipped_driver += 1
                unknown_drivers.add(r["driver_id"])
                continue
            cons = HV.constructor_for_f1db(r["constructor_id"], yr)
            if cons and not cur.execute("SELECT 1 FROM constructors WHERE id=?",
                                        (cons,)).fetchone():
                cons = None
            pos = int(r["position"]) if r["position"] else None
            # "PL" is a pit-lane start and is not a number; it is kept as text
            # rather than discarded.
            #
            # Grid 1 is taken as it comes. It used to be refused whenever the
            # pole harvest had already put a driver there, because `grid = 1`
            # then meant pole and a second claimant would have made
            # race_results emit the race twice. Pole is its own flag now, so
            # this column can say where every car started - including 2022
            # round 21, where the credited pole-sitter started eighth and the
            # sprint winner first, which the old rule recorded as a row with
            # grid = 1 and grid_text = '8'. verify.py holds the invariant
            # that at most one car starts from grid 1.
            grid_text = r["grid"] or None
            grid = int(r["grid"]) if r["grid"] and r["grid"].isdigit() else None
            cur.execute("""INSERT INTO race_entries (race_id, driver_id,
                    constructor_id, entrant, grid, grid_text,
                    finish_position, position_text, shared_drive, classified,
                    status, laps_completed, points, confidence, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT (race_id, driver_id) DO UPDATE SET
                    constructor_id  = COALESCE(constructor_id, excluded.constructor_id),
                    grid            = COALESCE(grid, excluded.grid),
                    grid_text       = COALESCE(grid_text, excluded.grid_text),
                    -- The winner check above has already passed, so a
                    -- position from here cannot contradict a stored one; it
                    -- can only fill a gap or agree.
                    finish_position = COALESCE(finish_position, excluded.finish_position),
                    position_text   = COALESCE(position_text, excluded.position_text),
                    shared_drive    = MAX(shared_drive, excluded.shared_drive),
                    classified      = COALESCE(classified, excluded.classified),
                    status          = COALESCE(status, excluded.status),
                    laps_completed  = COALESCE(laps_completed, excluded.laps_completed),
                    points          = COALESCE(points, excluded.points)""",
                (rid, did, cons, None, grid, grid_text, pos,
                 r["position_text"], 1 if r["shared_drive"] == "1" else 0,
                 1 if pos is not None else 0,
                 r["reason_retired"] or (r["position_text"]
                                         if pos is None else None),
                 int(r["laps"]) if r["laps"] else None,
                 float(r["points"]) if r["points"] else None,
                 HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))
            res_rows += 1

    if res_rows:
        print(f"  race results: {res_rows} entries over {res_races} races "
              f"from F1DB; {res_skipped_driver} rows skipped for "
              f"{len(unknown_drivers)} unresolvable drivers; "
              f"{b.skipped_rounds.get('race results', 0)} rounds not yet on "
              f"the calendar")

    b.f1db_drivers = f1db_drivers


def _stage_22_the_sprint_races(b):
    """the sprint races"""
    cur = b.cur
    race_key = b.race_key
    f1db_drivers = b.f1db_drivers

    # --- the sprint races
    #
    # A sprint is a separate race on the weekend, not a session of the grand
    # prix, so it lands in its own table rather than as columns on the entry.
    # Its points count towards the championship, which is why the standings
    # already reflected sprints while nothing here recorded that they had
    # happened.
    #
    # The round is also FLAGGED here rather than being authored by hand. The
    # calendar carried sprint=1 for 2026 alone, so every sprint from 2021 to
    # 2025 was recorded as an ordinary weekend. Deriving the flag from the
    # presence of a classification means it cannot drift again: a round has a
    # sprint exactly when a sprint was run there.
    sprint_by_race = {}
    for row in HV.load_sprint_results():
        sprint_by_race.setdefault(
            (int(row["year"]), int(row["round"])), []).append(row)

    spr_rows = spr_races = spr_skipped = 0
    for (yr, rnd), rows in sorted(sprint_by_race.items()):
        rid = b.race_for(yr, rnd, "sprint results")
        if rid is None:
            continue
        spr_races += 1
        cur.execute("UPDATE races SET sprint=1 WHERE id=?", (rid,))
        for r in rows:
            did = f1db_drivers.get(r["driver_id"])
            if not did:
                spr_skipped += 1
                continue
            cons = HV.constructor_for_f1db(r["constructor_id"], yr)
            if cons and not cur.execute("SELECT 1 FROM constructors WHERE id=?",
                                        (cons,)).fetchone():
                cons = None
            pos = int(r["position"]) if r["position"] else None
            cur.execute("""INSERT INTO sprint_results (race_id, driver_id,
                    constructor_id, grid, finish_position, position_text,
                    status, laps_completed, time, gap, points, confidence,
                    source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT (race_id, driver_id) DO NOTHING""",
                (rid, did, cons,
                 int(r["grid"]) if r["grid"] and r["grid"].isdigit() else None,
                 pos, r["position_text"],
                 r["reason_retired"] or (r["position_text"]
                                         if pos is None else None),
                 int(r["laps"]) if r["laps"] else None,
                 r["time"] or None, r["gap"] or None,
                 float(r["points"]) if r["points"] else None,
                 HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))
            spr_rows += 1

    # Deriving it means clearing it too. Setting the flag and never unsetting
    # it leaves a hand-authored sprint=1 on a round that turns out not to have
    # held one, which is the drift this is supposed to make impossible.
    # Completed rounds only: a 2026 round flagged before it has been run is
    # legitimately flagged and has no classification yet.
    cleared = cur.execute("""UPDATE races SET sprint = 0
        WHERE COALESCE(sprint, 0) = 1 AND status = 'completed'
          AND id NOT IN (SELECT DISTINCT race_id FROM sprint_results)""").rowcount
    if cleared:
        print(f"  sprint flag: {cleared} completed round(s) cleared - no sprint "
              f"classification exists for them")

    if spr_rows:
        flagged = cur.execute(
            "SELECT COUNT(*) FROM races WHERE sprint=1").fetchone()[0]
        print(f"  sprint races: {spr_rows} entries over {spr_races} sprints "
              f"from F1DB ({flagged} rounds flagged); {spr_skipped} rows "
              f"skipped for an unresolvable driver")


def _stage_23_a_round_that_has_a_result(b):
    """a round that has a result has been run"""
    cur = b.cur

    # --- a round that has a result has been run
    #
    # The calendar in data/current.py authors a status per round, which is
    # right for a season that has not happened yet: "scheduled" is a claim
    # about the future and nothing else can supply it. But it goes stale the
    # moment a race is run, and a hand-edit is what stands between a result
    # arriving in the harvest and the site admitting the race took place.
    # That is a whole class of staleness the sources can settle themselves:
    # a round with a classification has been run, whatever the calendar was
    # authored to say.
    #
    # Only ever in that direction. A round with no result stays exactly as it
    # was authored, because the absence of a result is not evidence that a
    # race did not happen — it is far more often evidence that nobody has
    # harvested it yet.
    promoted = cur.execute("""UPDATE races SET status = 'completed'
        WHERE status != 'completed'
          AND EXISTS (SELECT 1 FROM race_entries e
                      WHERE e.race_id = races.id
                        AND e.finish_position IS NOT NULL)""").rowcount
    if promoted:
        print(f"  calendar: {promoted} round(s) promoted to completed "
              f"because a classification arrived for them")
    # The round just promoted is also the round the pole harvest has not
    # reached - harvest/poles.txt is hand-written and F1DB refreshes on a
    # schedule - so it has a classification and no credited pole, and the
    # site would publish a finished race with the field blank while every
    # pole cross-check silently skipped it (2026 round 13 sat in that state).
    # Credit the car F1DB puts at grid 1, which is what the season record
    # credits for every race since 1950 bar one. Only into a vacancy, and
    # only where exactly one car holds grid 1. It scans every completed race
    # rather than the promoted one, and sits here because a race is not
    # completed until this stage says so. A pole credited this way is
    # distinguishable - the entry carries F1DB's source where a harvested
    # pole carries the season table's - and verify.py refuses one in any
    # season but the current, so the harvest still has to catch up.
    cur.execute("""UPDATE race_entries SET pole = 1
        WHERE grid = 1
          AND race_id IN (SELECT id FROM races WHERE status = 'completed')
          AND NOT EXISTS (SELECT 1 FROM race_entries p
                          WHERE p.race_id = race_entries.race_id AND p.pole = 1)
          AND (SELECT COUNT(*) FROM race_entries g
               WHERE g.race_id = race_entries.race_id AND g.grid = 1) = 1""")
    pole_filled = cur.rowcount
    if pole_filled:
        print(f"  calendar: {pole_filled} pole(s) credited from grid 1 where "
              f"the harvest is silent")



def _stage_24_qualifying_checked_against_the_pole_already(b):
    """qualifying, checked against the pole already established"""
    cur = b.cur
    race_key = b.race_key
    f1db_drivers = b.f1db_drivers

    # --- qualifying, checked against the pole already established
    qual_rows = qual_skipped = 0
    pole_disagreements = []
    quali_by_race = {}
    for row in HV.load_qualifying():
        quali_by_race.setdefault(
            (int(row["year"]), int(row["round"])), []).append(row)

    for (yr, rnd), rows in sorted(quali_by_race.items()):
        rid = b.race_for(yr, rnd, "qualifying")
        if rid is None:
            continue
        for r in rows:
            did = f1db_drivers.get(r["driver_id"])
            if not did:
                qual_skipped += 1
                continue
            cons = HV.constructor_for_f1db(r["constructor_id"], yr)
            if cons and not cur.execute("SELECT 1 FROM constructors WHERE id=?",
                                        (cons,)).fetchone():
                cons = None
            pos = int(r["position"]) if r["position"] else None
            cur.execute("""INSERT OR IGNORE INTO qualifying (race_id,
                    driver_id, constructor_id, position, position_text,
                    driver_number, time, q1, q2, q3, gap, interval, laps,
                    confidence, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (rid, did, cons, pos, r["position_text"],
                 int(r["driver_number"]) if r["driver_number"] else None,
                 r["time"], r["q1"], r["q2"], r["q3"], r["gap"],
                 r["interval"], int(r["laps"]) if r["laps"] else None,
                 HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))
            qual_rows += cur.rowcount

        # The cross-check this table brings with it. Pole is held for all
        # 1,161 races from the Wikipedia harvest, independently of F1DB, and
        # the fastest qualifier is usually that driver. Where they differ
        # nothing is recorded: a grid penalty or a sprint-set grid moves the
        # quickest driver off pole without making either source wrong about
        # the thing it describes, so this is a convention, not a
        # disagreement. verify.py pins the count and the race page shows both.
        stored_pole = cur.execute(
            "SELECT driver_id FROM race_entries WHERE race_id=? AND pole=1",
            (rid,)).fetchone()
        qp1 = cur.execute("SELECT driver_id FROM qualifying WHERE race_id=? "
                          "AND position=1", (rid,)).fetchone()
        if stored_pole and qp1 and stored_pole[0] != qp1[0]:
            pole_disagreements.append((yr, rnd, stored_pole[0], qp1[0]))

    if qual_rows:
        print(f"  qualifying: {qual_rows} rows over "
              f"{len(quali_by_race)} races; {qual_skipped} skipped for an "
              f"unresolvable driver; {len(pole_disagreements)} races where "
              f"the fastest qualifier is not the stored pole-sitter")


def _points_text(v):
    """A points figure as a discrepancy row shows it: 104, not 104.0."""
    return str(int(v)) if float(v).is_integer() else str(v)


def _stage_25_championship_standings_after_every_round_and(b):
    """championship standings, after every round and at season end"""
    cur = b.cur
    f1db_drivers = b.f1db_drivers

    # --- championship standings, after every round and at season end
    #
    # The hand-entered rows are loaded first and at 'verified' because they
    # come from formula1.com. F1DB fills everything they do not cover, and
    # where the two meet the F1DB row is not stored twice - it is CHECKED,
    # which is what makes the overlap worth having.
    std_rows = std_skipped = 0
    std_checked = std_conflicts = 0
    f1db_cons = {}
    known_engines = {r[0] for r in cur.execute(
        "SELECT id FROM engine_manufacturers")}
    completed_seasons = {r[0] for r in cur.execute(
        """SELECT year FROM races GROUP BY year
           HAVING SUM(CASE WHEN status <> 'completed' THEN 1 ELSE 0 END) = 0""")}
    known_years = {r[0] for r in cur.execute("SELECT year FROM seasons")}
    for (yr, rnd, kind, pos, entity, engine, points) in (
            (r["year"], r["round"], r["table_type"], r["position"],
             r["entity_id"], r["engine_manufacturer_id"], r["points"])
            for r in HV.load_standings()):
        if int(yr) not in known_years:
            raise SystemExit(
                f"standings: {yr} is in the harvest but not in the season "
                f"register. Add the season to data/ before loading it.")
        yr = int(yr)
        after = int(rnd) if rnd else None
        if kind == "drivers":
            eid = f1db_drivers.get(entity)
        else:
            if entity not in f1db_cons:
                f1db_cons[entity] = HV.constructor_for_f1db(entity, yr)
            eid = f1db_cons[entity]
            if eid and not cur.execute("SELECT 1 FROM constructors WHERE id=?",
                                       (eid,)).fetchone():
                eid = None
        if not eid:
            std_skipped += 1
            continue
        # The engine is part of the constructors' championship entry, not a
        # decoration on it. It is resolved through the same map the engine
        # register uses, and kept as F1DB's own id where we hold no
        # manufacturer - losing it would merge two championship entries.
        engine_id = None
        if kind == "constructors" and engine:
            mapped = HV.constructor_for_f1db(engine, yr)
            engine_id = mapped if mapped in known_engines else engine
        pts = float(points) if points not in (None, "") else None
        # A season-level file for a season still being run is not a FINAL
        # classification, it is the current one. Calling both 'final' put two
        # rows on the same key for 2026 and doubled every points total.
        if after:
            as_of = f"round {after}"
        else:
            as_of = "final" if yr in completed_seasons else "current"

        # The hand-entered rows predate this column and carry no engine, so
        # the overlap check matches on entity alone and only for the single
        # highest-placed entry - which is the one those rows describe.
        # ...and a mid-season snapshot is compared with F1DB's running table
        # AFTER THE SAME ROUND, which is the only like-for-like there is: the
        # snapshot's as_of says which round it stood after. Points only
        # accumulate, so a difference here is two sources disagreeing about
        # one classification, and it is recorded rather than resolved - the
        # view that publishes one row picks the larger figure, and the
        # discrepancy is what makes that choice visible on the page.
        existing = None
        if after is None:
            existing = cur.execute("""SELECT points FROM standings
                WHERE year=? AND table_type=? AND entity_id=?
                  AND after_round IS NULL AND as_of='final'
                  AND engine_id IS NULL""", (yr, kind, eid)).fetchone()
        else:
            existing = cur.execute("""SELECT points FROM standings
                WHERE year=? AND table_type=? AND entity_id=?
                  AND after_round IS NULL AND engine_id IS NULL
                  AND as_of LIKE ?""",
                (yr, kind, eid, f"%(after round {after})")).fetchone()
        if existing is not None:
            std_checked += 1
            if (existing[0] is not None and pts is not None
                    and abs(existing[0] - pts) > 0.001):
                std_conflicts += 1
                # Subject is the display name, which is how a race page or a
                # driver page finds its disagreements; a constructor's page
                # does the same on constructors.name.
                subj = cur.execute(
                    "SELECT full_name FROM drivers WHERE id=?" if kind == "drivers"
                    else "SELECT name FROM constructors WHERE id=?", (eid,)).fetchone()
                stage = "final" if after is None else f"after round {after}"
                cur.execute("""INSERT INTO discrepancies (subject, field,
                    stored_value, derived_value, assessment, status)
                    VALUES (?,?,?,?,?,?)""",
                    (subj[0] if subj else eid, f"{yr} championship points, {stage}",
                     _points_text(existing[0]), _points_text(pts),
                     "formula1.com and F1DB give different championship points "
                     "for the same entity at the same point in the season. The "
                     "stored figure is 'verified' from the official archive and "
                     "is not overwritten; where one row has to be published, "
                     "v_standings_final takes the larger total, and this row is "
                     "what makes that choice visible.", "open"))
            if after is None:
                continue

        name = cur.execute(
            "SELECT full_name FROM drivers WHERE id=?" if kind == "drivers"
            else "SELECT name FROM constructors WHERE id=?", (eid,)).fetchone()
        cur.execute("""INSERT OR IGNORE INTO standings (year, table_type,
                position, position_text, entity, entity_id, engine_id, points,
                after_round, as_of, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (yr, kind,
             int(pos) if str(pos).isdigit() else None, str(pos) if pos else None,
             name[0] if name else eid, eid, engine_id, pts, after, as_of,
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))
        std_rows += cur.rowcount

    if std_rows:
        print(f"  standings: {std_rows} rows from F1DB; {std_checked} "
              f"end-of-season rows already held and checked "
              f"({std_conflicts} disagreed); {std_skipped} skipped for an "
              f"unresolvable entity")


def _stage_26_pit_stops_from_f1db_under_their(b):
    """pit stops from F1DB, under their own source"""
    cur = b.cur
    race_key = b.race_key
    f1db_drivers = b.f1db_drivers

    # --- pit stops from F1DB, under their own source
    #
    # The table is keyed on (race, source, driver, stop) precisely so that
    # F1DB, Jolpica and FastF1 can hold the same stop side by side and be
    # compared, rather than the last loader to run winning.
    pit_rows = pit_skipped = 0
    for r in HV.load_f1db_pit_stops():
        rid = b.race_for(r["year"], r["round"], "pit stops")
        did = f1db_drivers.get(r["driver_id"])
        if rid is None or not did:
            pit_skipped += 1
            continue
        millis = r["time_millis"]
        cur.execute("""INSERT OR IGNORE INTO pit_stops (race_id, driver_id,
                driver_key, stop_number, lap_number, pit_lane_seconds, source)
            VALUES (?,?,?,?,?,?,'f1db')""",
            (rid, did, did, int(r["stop"]) if r["stop"] else None,
             int(r["lap"]) if r["lap"] else None,
             round(int(millis) / 1000.0, 3) if millis else None))
        pit_rows += cur.rowcount
    if pit_rows:
        print(f"  pit stops: {pit_rows} rows from F1DB "
              f"({pit_skipped} skipped)")


def _stage_27_notable_team_radio_a_small_curated(b):
    """notable team radio. A small curated set, each checked against a"""
    cur = b.cur
    race_key = b.race_key

    # --- notable team radio. A small curated set, each checked against a
    # written source. The bulk radio index for 2018- is loaded separately by
    # tools/fastf1_load.py and is flagged notable=0.
    for (yr, rnd, did, speaker, channel, text, ctx, conf, src) in RA.NOTABLE_RADIO:
        rid = race_key.get((yr, rnd))
        if rid is None:
            raise SystemExit(f"notable radio: no race at {yr} r{rnd}")
        if did and not cur.execute("SELECT 1 FROM drivers WHERE id=?",
                                   (did,)).fetchone():
            raise SystemExit(f"notable radio: unknown driver {did}")
        cur.execute("""INSERT INTO team_radio (race_id, driver_id, speaker,
            transcript, context, notable, confidence, source)
            VALUES (?,?,?,?,?,1,?,?)""",
            (rid, did, f"{speaker} [{channel}]", text, ctx, conf, src))


def _stage_29_career_figures_checked_against_the_official(b):
    """career figures checked against the official driver pages."""
    cur = b.cur

    # --- career figures checked against the official driver pages.
    # Entries, starts and points are not derivable from the race records this
    # database holds, so they are stored directly. Wins, poles and - since
    # v2.7, when second and third place were harvested for every race -
    # PODIUMS are derivable, so the official figures go to the external
    # columns to be compared against the derived ones.
    for did, (entries, starts, wins, podiums, poles, pts) in D.VERIFIED_STATS.items():
        n = cur.execute("""UPDATE drivers SET entries=?, starts=?,
            podiums_external=?, career_points=?, stats_as_of=?,
            wins_external=?, poles_external=?,
            external_source=?, confidence='verified' WHERE id=?""",
            (entries, starts, podiums, pts, D.STATS_AS_OF, wins, poles,
             "formula1.com driver page, " + D.STATS_AS_OF, did)).rowcount
        if n != 1:
            raise SystemExit(f"VERIFIED_STATS: no driver row for {did!r}")


def _stage_30_derived_win_totals(b):
    """derived win totals"""
    cur = b.cur

    # --- derived win totals
    # Fill constructor win counts that were previously unknown, and correct
    # rows where the stored figure counted something other than constructor
    # wins. Every other stored figure was reconciled against the derived
    # count during construction; see verify.py.
    cur.execute("""UPDATE constructors SET wins = (
            SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
              WHERE e.constructor_id = constructors.id AND e.finish_position = 1)
        WHERE wins IS NULL""")
    cur.execute("""UPDATE constructors SET wins = NULL,
        notes = notes || ' Its Grand Prix victories are credited to the Cooper and Lotus '
                      || 'chassis it entered, so it holds no constructor win total of its own.'
        WHERE id = 'rob-walker'""")
    for cid, msg in (
        ("racing-bulls", " The Faenza team's two wins are credited to the constructor names "
                         "it raced under at the time, Toro Rosso (2008) and AlphaTauri (2020)."),
        ("sauber", " Its single victory is credited to BMW Sauber, the constructor name in "
                   "use in 2008.")):
        cur.execute("UPDATE constructors SET wins = 0, notes = notes || ? WHERE id = ?",
                    (msg, cid))

    cur.execute("""UPDATE drivers SET wins = (
            SELECT COUNT(*) FROM race_entries e
            WHERE e.driver_id = drivers.id AND e.finish_position = 1)""")

    # The race records now cover every championship race, 1950-2026, so the
    # derived counts are the authoritative internal figure. Preserve whatever
    # was hand-entered or externally checked in the *_external columns first,
    # then overwrite the main columns from the race data.
    # Corrections to external figures that were checked and found wrong.
    for did, field, old, new, reason in HV.CORRECTIONS:
        n = cur.execute(f"""UPDATE drivers SET {field}_external = ?
            WHERE id = ? AND {field}_external = ?""", (new, did, old)).rowcount
        if n != 1:
            raise SystemExit(f"correction did not apply: {did} {field} {old}->{new}")

    cur.execute("""UPDATE drivers SET poles = (
            SELECT COUNT(*) FROM race_entries e
            WHERE e.driver_id = drivers.id AND e.pole = 1)""")
    cur.execute("""UPDATE drivers SET fastest_laps = (
            SELECT COUNT(*) FROM race_entries e
            WHERE e.driver_id = drivers.id AND e.fastest_lap = 1)""")
    # Podiums are derivable ONLY when second and third places are present.
    # Without them, counting finish_position 1-3 would just be the win count
    # wearing a different name, so the authored figure is left alone and
    # drivers.podiums stays hand-entered, as it was before v2.7.
    have_podiums = cur.execute("""SELECT COUNT(*) FROM race_entries
        WHERE finish_position IN (2, 3)""").fetchone()[0]
    if have_podiums:
        cur.execute("""UPDATE drivers SET podiums = (
                SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                WHERE e.driver_id = drivers.id
                  AND e.finish_position BETWEEN 1 AND 3)""")
    else:
        cur.execute("UPDATE drivers SET podiums = podiums_external "
                    "WHERE podiums_external IS NOT NULL")
    for did, *_ in HV.POLE_ONLY_DRIVERS:
        cur.execute("""UPDATE drivers SET
            first_season = (SELECT MIN(r.year) FROM race_entries e
                JOIN races r ON r.id=e.race_id WHERE e.driver_id=?),
            last_season  = (SELECT MAX(r.year) FROM race_entries e
                JOIN races r ON r.id=e.race_id WHERE e.driver_id=?)
            WHERE id = ? AND first_season IS NULL""", (did, did, did))

    # Indianapolis winners: their championship span is exactly the years they
    # won, so take it from the race data rather than asserting it.
    for did, *_ in HV.INDY_WINNERS:
        cur.execute("""UPDATE drivers SET
            first_season = (SELECT MIN(r.year) FROM race_entries e
                JOIN races r ON r.id=e.race_id WHERE e.driver_id=?),
            last_season  = (SELECT MAX(r.year) FROM race_entries e
                JOIN races r ON r.id=e.race_id WHERE e.driver_id=?)
            WHERE id = ?""", (did, did, did))

    for i, (field, area, desc, n, res) in enumerate(HV.KNOWN_GAPS, 1):
        cur.execute("""INSERT INTO known_gaps (id, field, area, description,
            races_affected, resolution) VALUES (?,?,?,?,?,?)""",
            (i, field, area, desc, n, res))
    # the circuit gap is measured, not asserted
    cur.execute("""UPDATE known_gaps SET races_affected =
        (SELECT COUNT(*) FROM races WHERE circuit_id IS NULL)
        WHERE field = 'circuit_id'""")

    # Record every stored-vs-derived difference, and assert that each one is
    # either explained by a known gap (the driver was still racing in a season
    # the harvest could not reach) or explicitly declared above.
    for i, (did, field, old, new, reason) in enumerate(HV.CORRECTIONS, 1):
        cur.execute("""INSERT INTO discrepancies (subject, field, stored_value,
            derived_value, assessment, status)
            SELECT full_name, ?, ?, ?, ?, 'resolved - corrected'
            FROM drivers WHERE id = ?""", (field, str(old), str(new), reason, did))

    # Compare the externally sourced career figure against the figure derived
    # from the race records. Any difference must be declared; a new one fails
    # the build.
    declared = {(d, f): a for d, f, a in HV.DECLARED_DISCREPANCIES}
    for r in cur.execute("""SELECT id, full_name, wins, wins_external,
        poles, poles_external, fastest_laps, fastest_laps_external,
        last_season FROM drivers""").fetchall():
        for field, derived, external in (("wins", r[2], r[3]),
                                         ("poles", r[4], r[5]),
                                         ("fastest_laps", r[6], r[7])):
            if external is None or external == derived:
                continue
            key = (r[0], field)
            if key in declared:
                assessment, status = declared[key], "open - needs official check"
            elif r[8] is None and external < derived:
                # still racing: the external figure was true on its as-of date
                # and the driver has added to it since
                assessment = ("Driver is still competing. The external figure was "
                              "correct on its as-of date; the derived figure includes "
                              "races run since. Not an error.")
                status = "explained - external figure is older"
            else:
                raise SystemExit(
                    f"UNEXPLAINED discrepancy: {r[1]} {field} "
                    f"external {external}, derived {derived}")
            cur.execute("""INSERT INTO discrepancies (subject, field,
                stored_value, derived_value, assessment, status)
                VALUES (?,?,?,?,?,?)""",
                (r[1], field, str(external), str(derived), assessment, status))


def _stage_31_figures_derivable_from_the_race_records(b):
    """figures derivable from the race records"""
    # --- figures derivable from the race records


def _stage_32_link_race_entries_to_the_chassis(b):
    """link race entries to the CHASSIS that scored them"""
    cur = b.cur
    known_cons = b.known_cons
    entrants = b.entrants

    # --- link race entries to the CHASSIS that scored them
    #
    # known_gaps #1 has stood since v2.6: the chassis-per-race harvest was
    # abandoned because the winner cross-check does not constrain the
    # chassis. A 1952 trial returned "Ferrari 125 F2" for races Ascari won in
    # a Ferrari 500 and every winner still matched, because the winner says
    # which race a row describes and nothing at all about what he drove.
    #
    # The entry lists are the constraint that was missing. They are also not
    # a complete answer, and that limit is the whole design of this block:
    #
    #   F1DB records which chassis a constructor ran in a SEASON. It does not
    #   record which chassis ran in which ROUND.
    #
    # So a constructor-season constrains the chassis only when the entry
    # lists name exactly one for it across every entrant. Ferrari in 1952
    # names five - the 500 Ascari won everything in, plus a 125, a 166, a 212
    # and a 375S in other people's hands - and gets no link at all. That is
    # the correct answer for 1952 and it is the answer the abandoned harvest
    # should have given.
    season_chassis = {}
    for year, _entrant, f1db_cons, _eman, ch_ids, _eng, _tyres in entrants:
        our = HV.constructor_for_f1db(f1db_cons, year)
        if our in known_cons:
            season_chassis.setdefault((our, year), set()).update(ch_ids)
    unambiguous = {k: next(iter(v)) for k, v in season_chassis.items()
                   if len(v) == 1}

    # The check, before anything is written. CAR_SEASONS + CAR_CHASSIS are a
    # fact this database already holds, asserted by hand and already proved
    # against published win totals. Where F1DB's entry lists resolve the same
    # constructor-season to a single chassis, it must be one this database
    # already assigns to that car. A disagreement is not reconciled quietly;
    # it stops the build.
    for car_id, yr in CR.CAR_SEASONS:
        cons = cur.execute("SELECT constructor_id FROM cars WHERE id=?",
                           (car_id,)).fetchone()[0]
        found = unambiguous.get((cons, yr))
        if found and found not in CR.CAR_CHASSIS.get(car_id, ()):
            raise SystemExit(
                f"chassis linkage: the {yr} entry lists give {cons} exactly "
                f"one chassis, {found}, but CAR_SEASONS says that season "
                f"belongs to {car_id}, whose chassis are "
                f"{CR.CAR_CHASSIS.get(car_id)}")

    for (cons, yr), ch_id in unambiguous.items():
        cur.execute("""UPDATE race_entries SET chassis_id=?
            WHERE constructor_id=? AND race_id IN
                  (SELECT id FROM races WHERE year=?)""", (ch_id, cons, yr))


def _stage_33_rule_two_resolve_through_the_driver(b):
    """rule two: resolve through the driver and the round"""
    cur = b.cur
    known_cons = b.known_cons
    entrants = b.entrants

    # --- rule two: resolve through the driver and the round
    #
    # The rule above asks what a CONSTRUCTOR ran in a SEASON, and gives up
    # whenever the answer is more than one. That is most of the 1950s and
    # 1960s, where a "constructor" was a name several privateers entered
    # several different chassis under.
    #
    # The drivers inside an entrant block carry rounds, though, and that is a
    # far sharper question: what did THIS ENTRANT run for THIS DRIVER in THIS
    # ROUND. Lotus in 1970 ran a 49C, a 72B and a 72C and settles nothing as a
    # constructor - but Garvey Team Lotus entered a 49C for Soler-Roig in
    # round 2 and nothing else, and that resolves. Only Rindt's entries stay
    # ambiguous, correctly: he moved from the 49C to the 72 mid-season.
    #
    # This rule never contradicts the first - a constructor-season with one
    # chassis has that chassis in every one of its entrant blocks - and the
    # build asserts as much rather than assuming it.
    drivers_by_f1db, collisions = HV.resolve_f1db_drivers(
        dict(cur.execute("SELECT id, full_name FROM drivers")))
    if collisions:
        raise SystemExit(
            "two F1DB drivers normalise onto one register entry: "
            + "; ".join(f"{k} <- {v}" for k, v in collisions.items()))

    # (year, entrant, constructor, engine manufacturer) -> its chassis list
    block_chassis = {}
    for year, entrant, f1db_cons, eng_man, ch_ids, _e, _t in entrants:
        block_chassis[(year, entrant, f1db_cons, eng_man)] = ch_ids

    # (year, round, our driver id) -> {chassis}, {our constructor id}
    per_round = {}
    for (year, entrant, f1db_cons, eng_man, f1db_driver, rounds,
         test) in HV.load_entrant_drivers():
        # `rounds` is the test, NOT the testDriver flag. F1DB's flag records
        # the driver's ROLE in the team, not whether they raced: Jack Aitken
        # is a Williams test driver for 2020 and has `rounds: 16`, because he
        # started the Sakhir Grand Prix in Russell's place. Franck Montagny
        # is flagged the same for 2006 and raced rounds 5-11 for Super Aguri.
        # A driver with rounds entered those rounds; a test driver with none
        # never entered.
        if not rounds:
            continue                    # a test driver did not enter a race
        our_driver = drivers_by_f1db.get(f1db_driver)
        if our_driver is None:
            continue                    # not in this register; never created
        ch = block_chassis.get((year, entrant, f1db_cons, eng_man), [])
        our_cons = HV.constructor_for_f1db(f1db_cons, year)
        for rnd in rounds:
            slot = per_round.setdefault((year, rnd, our_driver), (set(), set()))
            slot[0].update(ch)
            if our_cons in known_cons:
                slot[1].add(our_cons)

    # The check that has to pass before any of this is trusted.
    #
    # 1,164 race entries already carry a constructor, established by a
    # different route entirely - the Wikipedia race harvest. For every one of
    # them F1DB must agree. This is the constraining cross-check: it is the
    # entrant lists' answer to a question this database already knows the
    # answer to, on a thousand rows, before their answer is taken on the
    # rows where it does not.
    agreed = conflict = 0
    conflicts = []
    for eid_, year, rnd, did_, cons_ in cur.execute(
            """SELECT e.id, r.year, r.round, e.driver_id, e.constructor_id
               FROM race_entries e JOIN races r ON r.id = e.race_id
               WHERE e.constructor_id IS NOT NULL""").fetchall():
        found = per_round.get((year, rnd, did_))
        if not found or not found[1]:
            continue
        if cons_ in found[1]:
            agreed += 1
        else:
            conflict += 1
            if len(conflicts) < 8:
                conflicts.append(f"{year} r{rnd} {did_}: stored {cons_}, "
                                 f"entry list {sorted(found[1])}")
    if conflict:
        raise SystemExit(
            f"entrant lists disagree with the stored constructor on "
            f"{conflict} of {agreed + conflict} checked entries:\n  "
            + "\n  ".join(conflicts))
    if agreed < 800:
        raise SystemExit(
            f"only {agreed} race entries could be checked against the entry "
            f"lists; that is too few to trust the rest. Rerun "
            f"tools/f1db_fetch.py.")

    filled_cons = filled_chassis = 0
    for eid_, year, rnd, did_, cons_, ch_ in cur.execute(
            """SELECT e.id, r.year, r.round, e.driver_id, e.constructor_id,
                      e.chassis_id
               FROM race_entries e JOIN races r ON r.id = e.race_id""").fetchall():
        found = per_round.get((year, rnd, did_))
        if not found:
            continue
        chassis_set, cons_set = found
        if cons_ is None and len(cons_set) == 1:
            cur.execute("UPDATE race_entries SET constructor_id=? WHERE id=?",
                        (next(iter(cons_set)), eid_))
            filled_cons += 1
        if len(chassis_set) == 1:
            one = next(iter(chassis_set))
            if ch_ is not None and ch_ != one:
                raise SystemExit(
                    f"the two chassis rules disagree for {year} round {rnd} "
                    f"{did_}: season says {ch_}, entry list says {one}")
            if ch_ is None:
                cur.execute("UPDATE race_entries SET chassis_id=? WHERE id=?",
                            (one, eid_))
                filled_chassis += 1
    print(f"  entry lists: {agreed} stored constructors confirmed, "
          f"{filled_cons} filled, {filled_chassis} chassis resolved by round")


def _stage_34_link_race_entries_to_the_curated(b):
    """link race entries to the curated car that scored them"""
    con = b.con
    cur = b.cur
    known_cons = b.known_cons
    entrants = b.entrants
    driver_id = b.driver_id

    # --- link race entries to the curated car that scored them
    #
    # Two routes, and the precise one goes first.
    #
    # 1. Through the chassis. Where the entry lists resolved a chassis and
    #    that chassis belongs to a curated car, the car follows with no
    #    assumption at all.
    #
    # 2. CAR_SEASONS, the authored claim that every race a constructor won,
    #    took pole for or set fastest lap in that season was in this car.
    #    That claim is now CHECKED rather than trusted: it is applied only
    #    where the season's entry lists name no chassis outside the ones the
    #    car covers. Twelve of the forty-one pairs fail that test, and the
    #    cost of having trusted them shows up the moment poles can be
    #    attributed at all - McLaren ran the M23 and the M26 through 1976 and
    #    1977, and the blanket claim handed every one of Hunt's sixteen poles
    #    to the M23 against a published career fourteen.
    #
    # Where the claim is not corroborated and the chassis did not resolve,
    # the entry keeps no car. "We do not know whether that pole was an M23 or
    # an M26" is the true answer.
    cur.execute("""UPDATE race_entries SET car_id = (
        SELECT c.car_id FROM chassis c WHERE c.id = race_entries.chassis_id)
        WHERE chassis_id IS NOT NULL""")

    season_all = {}
    for year, _entrant, f1db_cons, _eman, ch_ids, _e, _t in entrants:
        our = HV.constructor_for_f1db(f1db_cons, year)
        if our in known_cons:
            season_all.setdefault((our, year), set()).update(ch_ids)

    uncorroborated = []
    for cid, yr in CR.CAR_SEASONS:
        row = cur.execute("""SELECT constructor_id, from_year, to_year
                             FROM cars WHERE id=?""", (cid,)).fetchone()
        if row is None:
            raise SystemExit(f"car season: unknown car {cid}")
        cons, fy, ty = row
        if (fy is not None and yr < fy) or (ty is not None and yr > ty):
            raise SystemExit(
                f"car season: {cid} asserted for {yr}, outside its {fy}-{ty} life")
        others = sorted(season_all.get((cons, yr), set())
                        - set(CR.CAR_CHASSIS.get(cid, ())))
        cur.execute("""INSERT INTO car_seasons (car_id, year, corroborated,
            other_chassis) VALUES (?,?,?,?)""",
            (cid, yr, 0 if others else 1, "+".join(others) or None))
        if others:
            uncorroborated.append((cid, yr, others))
            continue
        # Zero entries is legitimate: a car can race a season without winning,
        # taking pole or setting a fastest lap, and race_entries only holds
        # those. Lotus scored none of the three in 1971.
        cur.execute("""UPDATE race_entries SET car_id=? WHERE constructor_id=?
            AND car_id IS NULL
            AND race_id IN (SELECT id FROM races WHERE year=?)""",
            (cid, cons, yr))
    for cid, yr, others in uncorroborated:
        cur.execute("""INSERT INTO discrepancies (subject, field, stored_value,
            derived_value, assessment, status) VALUES (?,?,?,?,?,?)""",
            (f"{cid} {yr}", "CAR_SEASONS", "one chassis", "+".join(others),
             f"CAR_SEASONS claims every {yr} result for this constructor was "
             f"in {cid}, but the season's entry lists also name "
             f"{', '.join(others)}. The blanket link is not applied; entries "
             f"that season get a car only where the entry lists resolved the "
             f"chassis itself.", "resolved - claim not corroborated"))
    print(f"  car linkage: {len(CR.CAR_SEASONS) - len(uncorroborated)} of "
          f"{len(CR.CAR_SEASONS)} CAR_SEASONS claims corroborated by the "
          f"entry lists")

    # A car's DESIGN life and its RACING life are different facts, and this
    # check used to conflate them. cars.from_year/to_year describe the works
    # car - the Ferrari 500 is 1952-1953, the two seasons it won everything.
    # The chassis register, built from the entry lists, records that the same
    # chassis was entered until 1957: Ecurie Francorchamps ran one in 1954,
    # Scarlatti in 1956, de Tomaso in 1957. Privateers racing last year's car
    # is not a data error, it is most of the 1950s and 1960s.
    #
    # So the hard check is against the CHASSIS register, which is the source
    # that actually knows when a chassis raced, and the gap against the
    # curated years is counted rather than fatal.
    bad = cur.execute("""SELECT r.year, e.driver_id, e.chassis_id,
            ch.first_year, ch.last_year
        FROM race_entries e
        JOIN chassis ch ON ch.id = e.chassis_id
        JOIN races r ON r.id = e.race_id
        WHERE ch.first_year IS NOT NULL
          AND (r.year < ch.first_year
               OR (ch.last_year IS NOT NULL AND r.year > ch.last_year))
        LIMIT 3""").fetchall()
    if bad:
        raise SystemExit(
            "chassis linkage: an entry is dated outside the seasons the "
            f"entry lists record that chassis as entered - {list(bad)}")

    privateer = cur.execute("""SELECT COUNT(*) FROM race_entries e
        JOIN cars c ON c.id = e.car_id
        JOIN races r ON r.id = e.race_id
        WHERE r.year < c.from_year
           OR (c.to_year IS NOT NULL AND r.year > c.to_year)""").fetchone()[0]
    if privateer:
        print(f"  car linkage: {privateer} entries run a car after its "
              f"curated years, inside the seasons the chassis register "
              f"allows - privateers on last year's machinery")


    # A chassis may not be credited with a race run outside the seasons the
    # entry lists record it in. This cannot fail given how the links are
    # made; it is here so that it cannot start failing silently later.
    bad = cur.execute("""SELECT e.id FROM race_entries e
        JOIN chassis c ON c.id = e.chassis_id JOIN races r ON r.id = e.race_id
        WHERE r.year < c.first_year OR r.year > c.last_year LIMIT 1""").fetchone()
    if bad:
        raise SystemExit("chassis linkage: an entry falls outside its "
                         "chassis's entered seasons")

    cur.execute("""UPDATE chassis SET
        races = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                 WHERE e.chassis_id = chassis.id),
        wins = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                WHERE e.chassis_id = chassis.id AND e.finish_position = 1)""")

    # The reconciliation. `wins` is counted from this database's own race
    # records through the linkage above; `published_wins` was read off the
    # car's Wikipedia article by a different route entirely. A chassis cannot
    # have won more races than its published career total, and one that has
    # means the linkage is wrong.
    over = cur.execute("""SELECT id, full_name, wins, published_wins
        FROM chassis WHERE published_wins IS NOT NULL AND wins > published_wins
        ORDER BY wins - published_wins DESC""").fetchall()
    for cid_, full_, derived_, published_ in over:
        # A family article publishes the family's total, so a single chassis
        # in a family can only ever come in under it. Exceeding it is a real
        # linkage error.
        raise SystemExit(
            f"chassis linkage: {full_} is credited with {derived_} wins from "
            f"the race records but its article publishes {published_}")

    cur.execute("""UPDATE cars SET
        races = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                 WHERE e.car_id = cars.id),
        wins = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                WHERE e.car_id = cars.id AND e.finish_position = 1),
        poles = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                 WHERE e.car_id = cars.id AND e.pole = 1),
        fastest_laps = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                        WHERE e.car_id = cars.id AND e.fastest_lap = 1)""")

    cur.execute("""UPDATE circuits SET gp_count = (
        SELECT COUNT(*) FROM races r WHERE r.circuit_id = circuits.id
                                      AND r.status = 'completed')""")
    cur.execute("""UPDATE grands_prix SET
        editions = (SELECT COUNT(*) FROM races r
                    WHERE r.gp_id = grands_prix.id AND r.status = 'completed'),
        first_held = (SELECT MIN(year) FROM races r WHERE r.gp_id = grands_prix.id),
        last_held  = (SELECT MAX(year) FROM races r WHERE r.gp_id = grands_prix.id),
        circuits_used = (SELECT GROUP_CONCAT(DISTINCT c.name) FROM races r
                         JOIN circuits c ON c.id = r.circuit_id
                         WHERE r.gp_id = grands_prix.id)""")
    cur.execute("""UPDATE constructors SET poles = (
        SELECT COUNT(*) FROM race_entries e
        WHERE e.constructor_id = constructors.id AND e.pole = 1)""")

    normalise_countries(cur)

    # The coverage claim inside the artefact is read off the season register,
    # so a new season cannot leave it saying last year's range (SD-12).
    lo, hi = cur.execute("SELECT MIN(year), MAX(year) FROM seasons").fetchone()
    cur.execute("UPDATE meta SET value = ? WHERE key = 'coverage_seasons'",
                (f"{lo}-{hi}",))

    # ------------------------------------------- the authored ceiling
    #
    # The first instalment of the rule in docs/DERIVED-CONFIDENCE.md, and the
    # first place in this build where a confidence value is DERIVED rather
    # than carried up from data/*.py.
    #
    # Content with authority 'authored' has no external source to be compared
    # against and no check in verify.py that constrains a value, so it cannot
    # honestly sit above 'medium' - the tier that says "correct in substance,
    # confirm the figure before publication". Until v2.16 most of it sat at
    # 'high', which is may_publish = 1 and promised a citable official record
    # that does not exist. Two rows even sat at 'verified', against the
    # standing rule that nothing reaches 'verified' without an official
    # source.
    #
    # This runs last, after every loader, so it cannot be undone by one.
    authored = [r[0] for r in cur.execute(
        """SELECT tp.tbl FROM table_provenance tp
           JOIN source_registry s ON s.id = tp.source_id
           WHERE s.authority = 'authored'""")]
    lowered = 0
    for tbl in authored:
        cur.execute(f"""UPDATE {tbl} SET confidence = 'medium'
            WHERE confidence IN ('verified', 'high', 'reference')""")
        lowered += cur.rowcount
    print(f"  authored ceiling: {lowered} rows capped at 'medium' across "
          f"{len(authored)} tables")

    con.commit()

    # The ODbL centrelines leave f1.db here, before the VACUUM reclaims the
    # pages they occupied. Everything that checks them has already run.
    moved = split_geometry(con)
    if moved:
        print(f"  circuit geometry: {moved} centrelines moved to "
              f"{os.path.basename(GEOMETRY_DB)} — f1.db carries no "
              f"OpenStreetMap data")

    # The build writes and rewrites rows as sources layer on top of each
    # other, which leaves free pages behind. The web app fetches this file
    # whole, so reclaiming them is not housekeeping.
    con.execute("VACUUM")
    con.commit()
    return con


GEOMETRY_DB = os.path.join(HERE, "f1-geometry.db")
# --------------------------------------------------------------- countries
#
# Three tables name a country - drivers.nationality, constructors.country and
# circuits.country - and until now they did not agree on how. The register
# held 116 drivers from the "United States of America" and 42 from the
# "United States", which are the same place; seven countries were coded twice
# (Germany as GER and DEU, the Netherlands as NED and NLD); and ten
# constructors had a DEMONYM where a country name belongs - "British",
# "French", "Italian", "Brazilian".
#
# That was visible, not cosmetic. The drivers page builds its nationality
# filter from the distinct values, so a reader got two United States to choose
# between, showing 42 drivers and 116. Grouped, the United States is the
# second-largest nationality in the sport at 158 - ahead of Italy - and the
# split hid it in second AND sixth place.
#
# WHY THE F1DB REGISTRY DECIDES IT
#     Either spelling would fix the split. What settles the direction is that
#     only one of them can be CHECKED: harvest/f1db_countries.txt is a real
#     registry of 249 countries under CC BY, so "is this a country?" has an
#     answer the build can compute. The sporting codes - GER, SUI, NED - are
#     what a broadcast uses and what a reader may expect, but they were typed
#     by hand and trace to nothing, so nothing could ever tell you one was
#     wrong. A vocabulary nothing can verify is how the split happened.
#
# Aliases are the values that MEAN a registry country and are spelled
# otherwise. Every one is a rename, never a reinterpretation.
COUNTRY_ALIASES = {
    "United States": "United States of America",
    # Demonyms found in constructors.country, where a country name belongs.
    "British": "United Kingdom",
    "French": "France",
    "Italian": "Italy",
    "Brazilian": "Brazil",
}

# Values that are NOT in the registry and must not be forced into it. Each is
# a deliberate answer to a question the registry cannot express, and each says
# why, so the next pass over this data does not quietly erase it.
COUNTRY_EXCEPTIONS = {
    "Rhodesia":
        "John Love raced for Rhodesia, which no longer exists. F1DB records "
        "him as Zimbabwean, which is the modern state and the wrong answer "
        "for the era he raced in. Held deliberately since the podium-only "
        "register was re-sourced to F1DB; see PODIUM_ONLY_F1DB.",
    "Italy/UK":
        "A constructor based in two countries at once. The registry names "
        "one country per row and cannot say this.",
    "United States/UK":
        "As Italy/UK.",
    "Germany/Switzerland":
        "As Italy/UK.",
}


def normalise_countries(cur):
    """Put every country name into the F1DB registry's vocabulary.

    Renames the aliases, then sets each driver's nationality_code from the
    registry rather than from whoever typed the row. A value that is neither
    in the registry, an alias, nor a declared exception stops the build: it is
    either a new spelling of a country already here, which is the defect this
    function exists to prevent coming back, or a country nobody has looked at.
    """
    registry = {name: alpha3 for _cid, name, alpha3, _dem in HV.load_f1db_countries()}
    renamed = coded = 0

    for table, column in (("drivers", "nationality"),
                          ("constructors", "country"),
                          ("circuits", "country")):
        for (value,) in cur.execute(
                f'SELECT DISTINCT "{column}" FROM "{table}" '
                f'WHERE "{column}" IS NOT NULL').fetchall():
            if value in COUNTRY_EXCEPTIONS or value in registry:
                continue
            target = COUNTRY_ALIASES.get(value)
            if target is None:
                raise SystemExit(
                    f"{table}.{column} holds {value!r}, which is not a country "
                    f"in harvest/f1db_countries.txt, not an alias in "
                    f"COUNTRY_ALIASES, and not a declared exception in "
                    f"COUNTRY_EXCEPTIONS. Add it to one of them - a country "
                    f"spelled a second way is how the register split before.")
            if target not in registry:
                raise SystemExit(
                    f"COUNTRY_ALIASES maps {value!r} to {target!r}, which is "
                    f"not in the registry either.")
            cur.execute(f'UPDATE "{table}" SET "{column}" = ? '
                        f'WHERE "{column}" = ?', (target, value))
            renamed += cur.rowcount

    # The code comes from the registry, so the same country cannot be coded
    # two ways. Declared exceptions keep whatever they were given: the
    # registry has no row for Rhodesia and RHO is the right code for it.
    for (nationality,) in cur.execute(
            "SELECT DISTINCT nationality FROM drivers "
            "WHERE nationality IS NOT NULL").fetchall():
        if nationality in COUNTRY_EXCEPTIONS:
            continue
        cur.execute("UPDATE drivers SET nationality_code = ? "
                    "WHERE nationality = ? AND nationality_code IS NOT ?",
                    (registry[nationality], nationality, registry[nationality]))
        coded += cur.rowcount

    print(f"  countries: {renamed} value(s) renamed into the registry's "
          f"vocabulary, {coded} driver code(s) reset from it, "
          f"{len(COUNTRY_EXCEPTIONS)} declared exception(s)")



def split_geometry(con):
    """Move the OpenStreetMap centrelines out of f1.db and into their own file.

    WHY THEY DO NOT SHIP IN f1.db
        OpenStreetMap is ODbL 1.0, which carries share-alike AND a database
        right. That is a different obligation from every other source here:
        CC BY (F1DB) asks only for credit, CC BY-SA (Wikipedia) reaches the
        prose taken from it, and neither says anything about the shape of the
        database around it. ODbL does. A database derived from an ODbL one is
        a Derivative Database, and publishing it means publishing the whole
        thing under ODbL.

        Twenty-five centrelines would then set the licence of 117,000 rows
        they have nothing to do with. So they are not in that database at all.

        ODbL draws the line this build relies on: a Collective Database - two
        independent databases distributed alongside each other - is NOT a
        Derivative Database, and the share-alike does not reach across. f1.db
        carries no OpenStreetMap data of any kind; f1-geometry.db carries
        nothing else, and is offered under ODbL. Take one, take both, and the
        obligation follows only the file it belongs to.

    WHY THE ROWS ARE BUILT AND THEN MOVED, RATHER THAN NEVER LOADED
        Everything that checks the geometry runs against the loaded rows -
        the re-measurement that catches Monaco's relation reading 12% long
        because it includes the pit lane, the layout_key resolution, the
        historic-layout refusal. Loading them, checking them and then moving
        them keeps every one of those checks exactly where it was.
    """
    columns = [c[1] for c in con.execute("PRAGMA table_info(circuit_geometry)")]
    rows = con.execute("SELECT * FROM circuit_geometry "
                       "ORDER BY circuit_id, layout_key").fetchall()
    if not rows:
        return 0

    if os.path.exists(GEOMETRY_DB):
        os.remove(GEOMETRY_DB)
    # The overlay's table is DERIVED from this build's schema, never restated
    # here. A hardcoded column list is a silent truncation waiting for the next
    # column: `segment_count`, `loose_ends` and `closes` were added to
    # circuit_geometry while this function had twelve columns written out, and
    # a copy that drops a column looks exactly like a copy that worked.
    #
    # The REFERENCES clauses go, because the overlay stands alone - there is no
    # circuits table beside it and no provenance ladder to point at.
    ddl = con.execute("SELECT sql FROM sqlite_master WHERE type='table' "
                      "AND name='circuit_geometry'").fetchone()[0]
    ddl = re.sub(r"\s+REFERENCES\s+\w+\s*\([^)]*\)", "", ddl)

    geo = sqlite3.connect(GEOMETRY_DB)
    geo.executescript("""
        -- The circuit centrelines, traced from OpenStreetMap.
        --
        -- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
        -- (c) OpenStreetMap contributors.
        --
        -- This file is a database in its own right, distributed ALONGSIDE
        -- f1.db rather than inside it. f1.db contains no OpenStreetMap data,
        -- so it is not a Derivative Database of this one and does not carry
        -- ODbL. Merging the two - which tools/geometry_overlay.py will do to
        -- a local copy - produces a database that does.
        --
        -- circuit_id matches circuits.id in f1.db. There is deliberately no
        -- foreign key: this file must stand on its own.
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    """)
    geo.execute(ddl)
    placeholders = ",".join("?" * len(columns))
    geo.executemany(f"INSERT INTO circuit_geometry VALUES ({placeholders})", rows)
    geo.executemany("INSERT INTO meta VALUES (?,?)", [
        ("database_name", "F1 circuit centrelines (OpenStreetMap overlay)"),
        ("version", VERSION),
        ("built", BUILT),
        ("licence", "ODbL 1.0"),
        ("licence_url", "https://opendatacommons.org/licenses/odbl/1-0/"),
        ("attribution", "(c) OpenStreetMap contributors"),
        ("companion", "f1.db, which contains no OpenStreetMap data"),
        ("apply", "python3 tools/geometry_overlay.py --apply"),
    ])
    geo.commit()
    geo.execute("VACUUM")
    geo.commit()
    geo.close()

    con.execute("DELETE FROM circuit_geometry")
    con.commit()
    return len(rows)


def X_engine_eras():
    return T.ENGINE_ERAS


def build():
    """Rebuild f1.db from schema.sql and the data modules, one stage at a time.

    STAGES is the build. Order matters throughout — a register has to exist
    before anything can reference it, and a harvest that fills a gap has to run
    after whatever might already have filled it — so the list is the schedule
    and not merely a collection.
    """
    b = _Build()
    for stage in STAGES:
        stage(b)
    return b.con


# In order, because the build is a sequence.
def _stage_28_race_dates_and_the_fastest_lap_where(b):
    """race dates, and the fastest lap where the harvest has none"""
    cur = b.cur
    race_key = b.race_key
    f1db_drivers = b.f1db_drivers

    # --- the date each race was held
    #
    # 1,149 of 1,172 races carried no date, and the reason was structural
    # rather than factual: F1DB publishes one for every race back to
    # 1950-05-13, but it lives in the round's own race.yml and the results
    # loader only ever opened race-results.yml beside it. The file was there
    # the whole time and nothing read it. Every prerendered race page showed
    # "Dates -", and the SportsEvent JSON-LD could not emit startDate, which
    # is the one field a search engine most wants from an event.
    #
    # ONLY A RACE WITH NO DATE IS FILLED. The 23 already held were written by
    # hand and some express a RANGE - a meeting run over several days - which
    # a single ISO day cannot represent. Overwriting them would trade a
    # richer fact for a uniform one.
    # date_iso is set for EVERY race, dates only where it is empty. The two
    # columns answer different questions and the split is deliberate: a
    # Grand Prix is a weekend, so the 23 hand-written ranges ("27-29 Mar
    # 2026") are the better fact for a reader and are kept, while date_iso
    # gives every race a machine-readable day. Storing only `dates` left
    # those 23 - all of them races still to come, which is exactly where a
    # search engine wants a date - unable to emit startDate at all.
    dated = 0
    iso = 0
    for h in HV.load_race_dates():
        rid = b.race_for(h["year"], h["round"], "race dates")
        if rid is None:
            continue
        cur.execute("UPDATE races SET date_iso=? WHERE id=?", (h["date"], rid))
        iso += cur.rowcount
        cur.execute("""UPDATE races SET dates=? WHERE id=?
            AND (dates IS NULL OR TRIM(dates)='')""", (h["date"], rid))
        dated += cur.rowcount

    # --- the fastest lap, where the pole harvest has none
    #
    # Mirrors how grid 1 is handled above, and for the same reason.
    # race_entries.fastest_lap comes only from hand-written harvest/poles.txt
    # while the rest of a completed race refreshes from F1DB on a schedule,
    # so for a week after every Grand Prix a finished race has every other
    # field and a blank fastest lap. 2026 round 13 was sitting in exactly
    # that state.
    #
    # F1DB fills the VACANCY only. Where the harvest already names someone,
    # it keeps the slot - it is the older, hand-checked source - and a
    # disagreement is recorded rather than resolved quietly.
    fl_filled = 0
    fl_no_entry = 0
    fl_disagreements = []
    for h in HV.load_fastest_laps():
        rid = b.race_for(h["year"], h["round"], "fastest laps")
        if rid is None:
            continue
        did = f1db_drivers.get(h["driver_id"])
        if not did:
            continue
        held = [r[0] for r in cur.execute(
            "SELECT driver_id FROM race_entries WHERE race_id=? AND "
            "fastest_lap=1", (rid,))]
        if held:
            if did not in held:
                fl_disagreements.append(
                    (h["year"], h["round"], held[0], did))
            continue
        row = cur.execute("SELECT id FROM race_entries WHERE race_id=? AND "
                          "driver_id=?", (rid, did)).fetchone()
        if row is None:
            # F1DB names a driver this database has no entry for in that
            # race. Inventing the entry to hang a fastest lap on it would be
            # asserting a start nothing here supports, so it is counted and
            # skipped.
            fl_no_entry += 1
            continue
        cur.execute("UPDATE race_entries SET fastest_lap=1, "
                    "fastest_lap_shared=1 WHERE id=?", (row[0],))
        fl_filled += 1

    for yr_, rnd_, ours_, theirs_ in fl_disagreements:
        status_, assessment_ = HV.FASTEST_LAP_DISAGREEMENTS.get(
            (int(yr_), int(rnd_)),
            ("open",
             "The pole harvest and F1DB name different drivers as setting "
             "the fastest lap of the race. Both are describing the same "
             "thing, so one of them is wrong. The harvest keeps the slot "
             "because it is hand-checked and older; the other reading is "
             "recorded here so somebody can look at it."))
        cur.execute("""INSERT INTO discrepancies (subject, field,
            stored_value, derived_value, assessment, status)
            VALUES (?,?,?,?,?,?)""",
            (f"{yr_} round {rnd_}", "fastest lap", ours_, theirs_,
             assessment_, status_))

    print(f"  race dates: {iso} ISO days, {dated} display values filled "
          f"from F1DB; fastest laps: "
          f"{fl_filled} filled, {len(fl_disagreements)} disagreements, "
          f"{fl_no_entry} with no matching entry")


STAGES = [
    _stage_00_open_the_database,
    _stage_01_meta,
    _stage_02_drivers,
    _stage_03_drivers_admitted_from_the_f1db_register,
    _stage_04_constructors,
    _stage_05_seasons,
    _stage_06_circuits,
    _stage_07_cars_inserted_in_file_order_so,
    _stage_08_constructors_admitted_from_the_f1db_register,
    _stage_09_regulation_limits_loaded_before_the_chassis,
    _stage_10_the_chassis_engine_and_entrant_register,
    _stage_11_the_lead_image_of_each_accepted,
    _stage_12_circuit_centrelines_re_measured_before_they,
    _stage_13_a_regulation_figure_is_not_a,
    _stage_14_a_regulation_figure_is_not_a,
    _stage_15_rules_tech_safety,
    _stage_16_current_season,
    _stage_17_pole_position_and_fastest_lap_as,
    _stage_18_race_venue_as_circuit_id_on,
    _stage_19_races_that_used_a_layout_other,
    _stage_20_second_and_third_place_from_the,
    _stage_21_the_full_classification_qualifying_and_stand,
    _stage_22_the_sprint_races,
    _stage_23_a_round_that_has_a_result,
    _stage_24_qualifying_checked_against_the_pole_already,
    _stage_25_championship_standings_after_every_round_and,
    _stage_26_pit_stops_from_f1db_under_their,
    _stage_27_notable_team_radio_a_small_curated,
    _stage_28_race_dates_and_the_fastest_lap_where,
    _stage_29_career_figures_checked_against_the_official,
    _stage_30_derived_win_totals,
    _stage_31_figures_derivable_from_the_race_records,
    _stage_32_link_race_entries_to_the_chassis,
    _stage_33_rule_two_resolve_through_the_driver,
    _stage_34_link_race_entries_to_the_curated,
]

def report(con):
    cur = con.cursor()
    tables = [r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    total = 0
    print(f"{'table':28} rows")
    print("-" * 36)
    for t in tables:
        n = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        total += n
        print(f"{t:28} {n:>5}")
    print("-" * 36)
    print(f"{'TOTAL':28} {total:>5}")
    views = [r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")]
    print("\nviews:", ", ".join(views))


# The SQLite library that last wrote a database stamps its own version number
# into the file header, at bytes 96-99. Nothing reads it back, but it makes
# the artefact depend on which SQLite the builder happened to link: a copy
# built on a Mac against 3.51 and one built in CI against 3.45 differ in
# exactly those bytes and nothing else, and ci.yml compares the committed
# copy against a fresh build byte for byte. Pinned to the value every
# committed copy has carried, for the same reason BUILT is a constant - the
# database is a pure function of its sources, not of the machine.
SQLITE_HEADER_VERSION = 3045001


def pin_sqlite_header(path):
    with open(path, "r+b") as f:
        f.seek(96)
        f.write(struct.pack(">I", SQLITE_HEADER_VERSION))


if __name__ == "__main__":
    c = build()
    report(c)
    c.close()
    for path in (DB, GEOMETRY_DB):
        pin_sqlite_header(path)
    print(f"\nWrote {DB}")

