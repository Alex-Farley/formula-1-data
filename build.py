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
from datetime import date

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
from data import sessions as SS    # noqa: E402


def _prose_figures():
    """tools/prose_figures.py, imported from beside this file."""
    sys.path.insert(0, os.path.join(HERE, "tools"))
    import prose_figures
    return prose_figures


def _standings_rule():
    """tools/standings_rule.py, imported from beside this file."""
    sys.path.insert(0, os.path.join(HERE, "tools"))
    import standings_rule
    return standings_rule


DB = os.path.join(HERE, "f1.db")
# The build writes here and moves the file into place only when every stage
# has run. It used to drop f1.db and build in place, so a stage that failed
# left a 581 KB fragment with 46 tables and no drivers where the committed
# 20 MB file had been - observed on 2026-09-11, and committed by a step that
# should have been gated on the build. The fragment is what verify.py would
# then check and what git status would then offer.
BUILD_DB = DB + ".tmp"

# Bumping this for a release means bumping `version` in CITATION.cff too:
# that is the citation GitHub hands a reader, nothing downstream reads it
# back, and a citation naming a version this repository does not build is
# invisible. tests/test_conventions.py fails `make ci` and CI's check job
# when the two drift.

VERSION = "2.24"

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
BUILT = "2026-09-16"


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
    current_season = None   # stage 03 only: the latest year anybody entered


def _stage_00_open_the_database(b):
    """open the database"""
    con = b.con
    cur = b.cur

    if os.path.exists(BUILD_DB):
        os.remove(BUILD_DB)
    con = sqlite3.connect(BUILD_DB)
    con.executescript(open(os.path.join(HERE, "schema.sql"), encoding="utf-8").read())
    cur = con.cursor()

    b.con = con
    b.cur = cur


def surrogate_id_tables(con):
    """Every table whose whole primary key is an INTEGER `id` — the ids the
    build hands out in insert order, and the ones that move when an insert
    order does. Read off the schema rather than written out: a list typed by
    hand is the thing that silently leaves a new table outside the identifier
    policy, the way a typed column list once dropped three columns of
    circuit_geometry."""
    out = set()
    for (name,) in con.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
            " AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall():
        pk = [c for c in con.execute("PRAGMA table_info(%s)" % name) if c[5]]
        if len(pk) == 1 and pk[0][1] == "id" and pk[0][2].upper() == "INTEGER":
            out.add(name)
    return out


def _identifier_policy(con):
    """(the stable tables, the declared natural keys) as the strings meta
    carries, having refused anything the policy does not account for."""
    surrogate = surrogate_id_tables(con)
    undeclared = sorted(surrogate - set(N.ID_STABILITY))
    if undeclared:
        raise SystemExit(
            f"no identifier policy for {', '.join(undeclared)}: add each to "
            f"ID_STABILITY in data/current.py as 'stable' or 'unstable' before "
            f"the build can say whether a reader may keep its ids.")
    gone = sorted(set(N.ID_STABILITY) - surrogate)
    if gone:
        raise SystemExit(
            f"ID_STABILITY names {', '.join(gone)}, which has no surrogate "
            f"`id` in schema.sql: remove the entry, or correct the name.")

    stable, keys = [], []
    for table in sorted(N.ID_STABILITY):
        stability, key = N.ID_STABILITY[table]
        if stability not in ("stable", "unstable"):
            raise SystemExit(f"ID_STABILITY['{table}'] is {stability!r}; it must "
                             f"be 'stable' or 'unstable'.")
        if stability == "stable":
            stable.append(table)
        if key:
            columns = {c[1] for c in con.execute("PRAGMA table_info(%s)" % table)}
            absent = [c for c in key if c not in columns]
            if absent:
                raise SystemExit(
                    f"ID_STABILITY['{table}'] names {', '.join(absent)} as part "
                    f"of the natural key, and {table} has no such column.")
            keys.append(f"{table}({', '.join(key)})")
    return ", ".join(stable), "; ".join(keys)


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
    # Which ids a reader may keep (DA-04). Same shape as the licence classes
    # above: the build refuses a table nobody has classified rather than
    # assuming one, because the assumption is what goes unnoticed. The two
    # strings are what verify.py checks the declaration against, and what
    # tools/readme_figures.py builds the README's table from.
    stable_ids, id_keys = _identifier_policy(b.con)

    cur.executemany("INSERT INTO meta VALUES (?,?)", [
        ("database_name", "F1 Verified Facts Project Memory Database"),
        ("version", VERSION),
        ("built", BUILT),
        ("verification_date", BUILT),
        ("missing_fact_policy", "Mark UNVERIFIED / NOT FOUND IN OFFICIAL SOURCES; never invent."),
        ("promotion_rule", "Never promote a fact to 'verified' without an official FIA or Formula 1 source."),
        # Both are overwritten in the final stage - the span off the season
        # register, the note off the row counts - and a typed value here is
        # only ever the one that goes stale (SD-12, CR-07).
        ("coverage_seasons", "derived at the end of the build"),
        # The season in progress, from the one place it is written down. The
        # artefact carries it so verify.py, export_json.py and the renderers
        # read it rather than each repeating it (CR-07).
        ("current_season", str(N.CURRENT_SEASON)),
        # Overwritten from the row counts in the final stage; a typed sentence
        # here said "qualifying ... (not held)" beside 26,997 qualifying rows
        # for seven releases, and a bulk-data consumer reads this before
        # anything else.
        ("coverage_note", "derived at the end of the build"),
        ("id_stability", N.ID_STABILITY_NOTE),
        ("id_stability_stable", stable_ids),
        ("id_stability_keys", id_keys),
        # PM-47. The one part of this file that is not CC BY-SA, and the
        # columns it covers. A reader holding f1.db and nothing else can read
        # the grant off the file rather than having to find LICENSE-DATA.
        ("project_prose", N.PROJECT_PROSE_NOTE),
        ("project_prose_columns", ", ".join(N.PROJECT_PROSE_COLUMNS)),
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

    # notes is the page's lede and its meta description, so it holds only what
    # is said about the driver; how the row got here goes in provenance.
    for did, name, nat, code, note in HV.POLE_ONLY_DRIVERS:
        cur.execute("""INSERT INTO drivers (id, full_name, nationality,
            nationality_code, wins, titles, notes, provenance, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, 0, 0, note or None, HV.POLE_ONLY_PROVENANCE,
             "medium",
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
            nationality_code, born, wins, titles, provenance, confidence, source)
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
    # The season in progress is the latest one anybody entered, read from the
    # entry lists rather than typed. A constant here said 2026, and stood
    # still: after the 2027 opener a driver whose last entry was 2026 would
    # have stayed active - `max(yrs) >= 2026` - until someone edited the
    # number, and verify.py's grid check would have named the stale rows
    # without being able to name the cause (PM-29, from the review of #84).
    # This is the drivers' anchor, and nothing else's. Constructors read it
    # too until CR-07 made meta.current_season the one anchor for "this
    # season"; stage 08 reads that constant directly now (CR-35). It rests on F1DB writing
    # `rounds` only for rounds actually run - a pre-season entry list carries
    # none, so the filter above drops it - which keeps this equal to the
    # latest completed season verify.py reads; the pin below fails the build
    # the day that stops being true, rather than flipping a grid to retired
    # in pre-season and letting verify.py's warn window pass it.
    b.current_season = max(y for ys in drv_years.values() for y in ys)
    _raced = max(int(r["year"]) for r in HV.load_race_results())
    if b.current_season > _raced:
        raise SystemExit(
            f"the entry lists reach {b.current_season} but the classification "
            f"reaches {_raced}: F1DB has published rounds for a season with no "
            f"race run, and the season in progress can no longer be read from "
            f"the entry lists. Decide what it means before building.")
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
        _id, name, _first, _last, born, died, _abbr, nat_id = meta[:8]
        nat, code = f1db_ctry.get(nat_id, (None, None))
        cur.execute("""INSERT INTO drivers (id, full_name, nationality,
            nationality_code, born, died, first_season, last_season, titles,
            status, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,0,?,?,?)""",
            (f1db_id, name, nat, code, born, died, min(yrs), max(yrs),
             "deceased" if died else
             ("active" if max(yrs) >= b.current_season else "retired"),
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))
        known_drv.add(f1db_id)

    # The wins / poles / fastest_laps just inserted are hand-entered from
    # reference records. Move them to the *_external columns now, before the
    # derived figures overwrite the main ones.
    cur.execute("""UPDATE drivers SET
        wins_external = wins, poles_external = poles,
        fastest_laps_external = fastest_laps,
        external_source = 'hand-entered from reference records'""")
    # The same figures as claims, one per figure (PM-14). The reference
    # records they were typed from were never named, so each claim cites the
    # one source this database has ever named for them: its row's. That is
    # the row-grain position restated per figure and not a new reading of
    # where they came from - which is a question for a person, not the build.
    for field in ("wins", "poles", "fastest_laps"):
        cur.execute(f"""INSERT INTO claims (tbl, row_key, field, value_given,
            source) SELECT 'drivers', id, '{field}_external',
            CAST({field} AS TEXT), source FROM drivers
            WHERE {field} IS NOT NULL""")
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
        cur.execute("""INSERT INTO claims (tbl, row_key, field, value_given,
            source) VALUES ('drivers', ?, 'fastest_laps_external', ?, ?)""",
            (did_, str(fl_), src_))


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
             min(yrs), max(yrs),
             # N.CURRENT_SEASON, not the highest year in the entry lists:
             # CR-07 made meta.current_season the one anchor for anything
             # meaning "this season", and schema.sql says in as many words
             # that it is NOT a MAX() over them, because the register already
             # carries next season's calendar. The two are the same number
             # today, which is why this went unread; the day they part, a
             # MAX() calls a constructor retired in a season still being run.
             # verify.py now holds the flag to that season's entry list,
             # which constrains the hand-typed flags in data/teams.py as
             # well as these (CR-35).
             1 if max(yrs) >= N.CURRENT_SEASON else 0,
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

    def _power_note(v):
        """A harvested power note that names no number is not a power figure.

        The infobox `power` field the harvest reads is meant to hold one, and
        number() already refuses to take a bhp figure out of a value with no
        digit in it. Where the article leaves the {{Racing car}} template's
        unfilled `NNN hp` placeholder in place, or answers with a
        cross-reference ("See Table") that does not travel with the value,
        the page states no power - so storing the text as a note contradicts
        the NULL beside it and puts "NNN hp" on the car's page. 45 chassis
        carried one when this was written.

        It is refused here rather than in tools/wikispec_fetch.py because the
        harvest file records what the page said and the build records what
        survived the checks, and because this check needs no network: the
        harvest can be re-run by anyone, and this cannot be skipped.

        The digit is an ASCII one, because verify.py restates this rule as a
        GLOB and SQLite's character classes are ASCII. str.isdigit() is not:
        it is true of a superscript two and of full-width and Arabic-Indic
        digits, so using it here would admit a note verify.py then refuses.
        """
        return v if v and re.search(r"[0-9]", v) else None

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
             _power_note(sp.get("power_note")), _float(sp.get("weight_kg")),
             _int(sp.get("wheelbase_mm")), _int(sp.get("track_front_mm")),
             _int(sp.get("track_rear_mm")), _int(sp.get("fuel_l")),
             sp.get("predecessor"), sp.get("successor"),
             _int(sp.get("races")), _int(sp.get("wins")), _int(sp.get("poles")),
             HV.F1DB_CONFIDENCE,
             ("https://en.wikipedia.org/wiki/" +
              sp["article"].replace(" ", "_")) if sp.get("article") else None,
             HV.F1DB_SOURCE))

    # The published figures as claims (PM-14), citing the article that gave
    # them. The claim is what the column already is - the career the article
    # publishes for its subject, which for a family article is the family's -
    # and not that this chassis raced that often: the register cannot tell a
    # family article from a single-chassis one (two spellings of one title;
    # variants with no article of their own), so it does not try. What the
    # claim adds is the column's source: an F1DB row carrying Wikipedia's
    # figures, which the row's own source_id cannot say.
    for field in ("races", "wins", "poles"):
        cur.execute(f"""INSERT INTO claims (tbl, row_key, field, value_given,
            source) SELECT 'chassis', id, 'published_{field}',
                CAST(published_{field} AS TEXT), spec_source
            FROM chassis WHERE published_{field} IS NOT NULL""")

    b.entrants = entrants


def _stage_11_the_lead_image_of_each_accepted(b):
    """the photograph of each accepted car article, and its credit"""
    cur = b.cur

    # --- the photograph of each accepted car article, and its credit
    #
    # No image is stored. What is stored is which file an article carries
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
            thumb_url, width, height, name_matches, confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (article, im["file_name"], im["repository"], im["licence"],
             im.get("licence_url"), im.get("artist"), im.get("credit"),
             im["description_url"], im.get("thumb_url") or None,
             int(im["width"]) if im.get("width") else None,
             int(im["height"]) if im.get("height") else None,
             1 if im.get("name_matches") == "1" else 0,
             "unverified"))
        img_rows += 1
    if img_rows:
        named = cur.execute("SELECT COUNT(*) FROM article_images "
                            "WHERE route = 'article' AND name_matches = 1"
                            ).fetchone()[0]
        print(f"  article images: {img_rows} rows, {img_skipped} for "
              f"articles no chassis claims; {named} name the car in the "
              f"file name and {img_rows - named} do not")

    # --- the category route (AF-42): a chassis no article describes
    #
    # Keyed on the chassis, and held at 'catalogued', below 'unverified':
    # the claim is only that a Commons editor filed the file under a
    # category named for it. The same licence checks as above. A chassis
    # that has an article is the article route's, whatever its article
    # carries - two routes for one chassis would make the weaker one a
    # fallback nobody chose.
    bare_chassis = {r[0] for r in cur.execute(
        "SELECT id FROM chassis WHERE article IS NULL")}
    cat_rows = cat_skipped = 0
    for im in HV.load_category_images():
        cid = im.get("chassis_id")
        if cid not in bare_chassis:
            cat_skipped += 1
            continue
        # Commons answers 'local' about its own file; the harvest wrote
        # 'commons' only after checking the answer came from Commons for a
        # page in the File namespace. Anything else is not that check.
        if im.get("repository") != "commons":
            raise SystemExit(
                f"category_images: {cid} carries repository "
                f"{im.get('repository')!r}, not 'commons'. Rerun "
                f"tools/wikimedia_images.py --route category.")
        if not (im.get("category") or "").startswith("Category:"):
            raise SystemExit(f"category_images: {cid} names no category.")
        if not im.get("licence"):
            raise SystemExit(f"category_images: {cid} states no licence.")
        if not (im.get("artist") or im.get("credit")):
            raise SystemExit(
                f"category_images: {cid} names no author for "
                f"{im.get('file_name')}. Rerun tools/wikimedia_images.py "
                f"--route category.")
        if not im.get("description_url"):
            raise SystemExit(f"category_images: {cid} has no description page.")
        cur.execute("""INSERT INTO article_images (route, chassis_id,
            category, file_name, repository, licence, licence_url, artist,
            credit, description_url, thumb_url, width, height, name_matches,
            confidence)
            VALUES ('category',?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, im["category"], im["file_name"], im["repository"],
             im["licence"], im.get("licence_url"), im.get("artist"),
             im.get("credit"), im["description_url"],
             im.get("thumb_url") or None,
             int(im["width"]) if im.get("width") else None,
             int(im["height"]) if im.get("height") else None,
             1 if im.get("name_matches") == "1" else 0,
             "catalogued"))
        cat_rows += 1
    if cat_rows or cat_skipped:
        print(f"  category images: {cat_rows} rows at 'catalogued', "
              f"{cat_skipped} for chassis that are not without an article")


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
        # where the row is admitted, and store the answer - the circuit's own
        # page prints it as "closes into one lap" or as the count of loose
        # way ends, and says the length is the ways added up rather than a lap.
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
            # Not fatal: an incomplete trace still has an honest length, and
            # that length is still published beside the stated one. It just
            # cannot be walked round as a lap, and the page says so.
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
            win_points, fastest_lap, fastest_lap_points, dropped_scores, notes)
            VALUES (?,?,?,?,?,?,?,?,?)""", (i,) + r)

    # A sprint row has no fastest-lap point of its own - no sprint has ever
    # carried one - so its fastest_lap_points is 0 rather than NULL, and
    # verify.py checks that against the NULL `fastest_lap` beside it.
    off = len(X.POINTS)
    for i, (fy, ty, scoring, win, note) in enumerate(X.SPRINT_POINTS, off + 1):
        cur.execute("""INSERT INTO points_systems (id, from_year, to_year, scoring,
            win_points, fastest_lap, fastest_lap_points, dropped_scores, notes)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (i, fy, ty, "SPRINT: " + scoring, win, None, 0, None, note))

    # `records` is no longer loaded here: it is DERIVED in stage 31, after the
    # career figures it is computed from exist. See derive_records().

    for i, r in enumerate(X.ERAS, 1):
        cur.execute("""INSERT INTO eras (id, from_year, to_year, era_name, summary,
            dominant_teams, defining_features) VALUES (?,?,?,?,?,?,?)""", (i,) + r)

    cur.executemany("INSERT INTO glossary (term, category, definition) VALUES (?,?,?)",
                    X.GLOSSARY)

    for i, r in enumerate(X.GOVERNANCE, 1):
        cur.execute("""INSERT INTO governance (id, year, event, detail, significance)
            VALUES (?,?,?,?,?)""", (i,) + r)


def _calendar_date_iso(dates):
    """The race day of an announced weekend, as ISO.

    A Grand Prix is a weekend and the calendar states it as a span - "12-14
    Mar 2027", or "30 Apr-02 May 2027" where it crosses a month. The race is
    the last day of that span, which is the same relationship verify.py
    already checks between a weekend's timetable and races.dates. F1DB
    publishes a date_iso for every round it holds and overwrites this later;
    a season F1DB has not reached yet - a calendar announced but not started
    - would otherwise carry no machine-readable day at all, which is exactly
    where a search engine wants a startDate.

    Strict on purpose: a span this cannot read is a typo in the calendar, not
    a date to guess at.
    """
    m = re.match(r"^(\d{1,2})(?:\s+([A-Za-z]{3}))?-(\d{1,2})\s+([A-Za-z]{3})"
                 r"\s+(\d{4})$", dates.strip())
    if not m:
        raise SystemExit(f"calendar: cannot read a race day from {dates!r}")
    day, mon, year = m.group(3), m.group(4), m.group(5)
    months = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
    if mon not in months:
        raise SystemExit(f"calendar: unknown month {mon!r} in {dates!r}")
    return f"{year}-{months.index(mon) + 1:02d}-{int(day):02d}"


def _stage_16_current_season(b):
    """current season"""
    cur = b.cur
    race_key = b.race_key
    lookup = b.lookup

    # -------------------------------------------------- current season
    for i, (cid, did, car, pu, num, role) in enumerate(N.ENTRIES_2026, 1):
        cur.execute("""INSERT INTO season_entries (id, year, constructor_id, driver_id,
            car, power_unit, car_number, role, confidence)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (i, N.CURRENT_SEASON, cid, did, car, pu, num, role, "verified"))

    sid = 0
    for year, tbl, rows, asof in (
            (N.CURRENT_SEASON, "drivers", N.DRIVER_STANDINGS_2026,
             "2026-09-04 (after round 12)"),
            (N.CURRENT_SEASON, "constructors", N.TEAM_STANDINGS_2026,
             "2026-09-04 (after round 12)"),
            (N.PREVIOUS_SEASON, "drivers", N.DRIVER_STANDINGS_2025, "final"),
            (N.PREVIOUS_SEASON, "constructors", N.TEAM_STANDINGS_2025, "final")):
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
                (sid, year, tbl, pos, disp, eid, team, pts, asof, "verified",
                 N.f1_source(year, tbl)))

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
            "entrant": None, "confidence": "verified",
            "source": N.f1_source(yr, "races"),
        })

    # {year: {round: calendar row}} for every season data/current.py holds a
    # calendar for. Nothing below names a year: the next season arrives by
    # being added to N.CALENDARS, not by being written into this loader.
    cal = {yr: {r[0]: r for r in rows}
           for yr, (rows, _src) in sorted(N.CALENDARS.items())}
    race_key = {}
    rid = 0
    for r in races:
        rid += 1
        gid = gp_map.get(r["gp_name"])
        if gid is None:
            raise SystemExit(f"unmapped grand prix {r['gp_name']!r}")
        circuit = EV.SINGLE_CIRCUIT.get(gid)
        dates = sprint = None
        if r["round"] in cal.get(r["year"], {}):
            c = cal[r["year"]][r["round"]]
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

    # Calendar rounds not yet run: the event exists, with no entries. A
    # season announced but not started - 2027 as this is written - is all of
    # its rounds and nothing else.
    for year, (rows, src) in sorted(N.CALENDARS.items()):
        for c in rows:
            if (year, c[0]) in race_key:
                continue
            rid += 1
            gid = gp_map.get(c[1])
            if gid is None:
                raise SystemExit(f"unmapped grand prix {c[1]!r}")
            cur.execute("""INSERT INTO races (id, year, round, gp_id, name_used,
                circuit_id, dates, date_iso, sprint, status, confidence, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (rid, year, c[0], gid, c[1], c[4], c[5],
                 _calendar_date_iso(c[5]), c[6], c[7], "verified", src))
            race_key[(year, c[0])] = rid

    # The weekend timetable, keyed to the races just written (LV-02). Every
    # session names its round, and a round with no race row is a typo here,
    # not a session to store.
    for rnd, kind, start_utc, zone in SS.SESSIONS_2026:
        rid = race_key.get((N.CURRENT_SEASON, rnd))
        if rid is None:
            raise SystemExit(
                f"sessions: {N.CURRENT_SEASON} round {rnd} has no race row")
        cur.execute("""INSERT INTO sessions (race_id, kind, name, start_utc, zone,
            confidence, source) VALUES (?,?,?,?,?,?,?)""",
            (rid, kind, SS.SESSION_NAMES[kind], start_utc, zone, "verified",
             SS.SESSIONS_SOURCE.format(slug=SS.WEEKENDS_2026[rnd][0])))

    # A calendar row whose country field carries a parenthesis is a declared
    # oddity - "Bahrain (hosted at Sepang, Malaysia)" - and the page rendered
    # a Bahrain Grand Prix at a Malaysian circuit with no explanation, because
    # this was the one authored field nothing read. It becomes the race's note,
    # which both renderers already show as the lede.
    for year, (rows, _src) in sorted(N.CALENDARS.items()):
        for c in rows:
            if "(" in c[2] and c[2].endswith(")"):
                aside = c[2][c[2].index("(") + 1:-1]
                cur.execute("""UPDATE races SET note = ? WHERE year = ? AND round = ?
                               AND note IS NULL""",
                            (f"The {c[1]} of {year} is {aside}.", year, c[0]))

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
    # loader name -> the set of (year, round) it skipped: a set, because
    # three loaders look a round up once per row.
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
            skipped_rounds.setdefault(what, set()).add((year, rnd))
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
    restored = []
    pole_rows = HV.load_poles()
    for h in pole_rows:
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
    harvest_covers_every_completed_race(cur, race_key, pole_rows, "pole harvest")

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
    venue_rows = HV.load_venues()
    for h in venue_rows:
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
    harvest_covers_every_completed_race(cur, race_key, venue_rows, "venue harvest")


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
    f1db_drivers = b.f1db_drivers

    # --- the full classification, qualifying and standings, from F1DB
    #
    # This is the block that closed known_gaps #2. The facts are the same ones
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
                    points          = COALESCE(points, excluded.points),
                    -- `source` names who established the FINISHING
                    -- POSITION. The pole harvest ran first and created a
                    -- bare row - a pole or fastest-lap flag and nothing
                    -- else - citing the season article; every other column
                    -- then arrived from here, and 1,136 pole rows cited
                    -- Wikipedia for F1DB's whole classification while the
                    -- row beneath them cited F1DB. A row with no position
                    -- yet takes this source with the position; a winner the
                    -- season harvest established keeps its own, and F1DB's
                    -- laps and points on it are the cross-checked detail.
                    -- The pole and fastest-lap credits' provenance is
                    -- stated on their columns in schema.sql.
                    source          = CASE WHEN finish_position IS NULL
                                                AND laps_completed IS NULL
                                           THEN excluded.source ELSE source END""",
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
              f"{len(b.skipped_rounds.get('race results', ()))} rounds not yet "
              f"on the calendar")

    b.f1db_drivers = f1db_drivers


def _stage_22_the_sprint_races(b):
    """the sprint races"""
    cur = b.cur
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
    # distinguishable as a pole in a race harvest/poles.txt has no row for,
    # and verify.py refuses one in any season but the current, so the
    # harvest still has to catch up.
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


def _race_seconds(text):
    """'2:24:01.612' or '1:23.456' as seconds; None for anything else."""
    try:
        parts = [float(p) for p in (text or "").split(":")]
    except ValueError:
        return None
    if not 1 < len(parts) <= 3:
        return None
    total = 0.0
    for p in parts:
        total = total * 60 + p
    return total


def _race_clock(seconds):
    h, rest = divmod(round(seconds * 1000), 3600000)
    m, rest = divmod(rest, 60000)
    return f"{h}:{m:02d}:{rest // 1000:02d}.{rest % 1000:03d}"


def _one_penalty_explains(cur, yr, after, observed, f1db_drivers):
    """The one race whose reclassification accounts for every points
    disagreement between an official snapshot and F1DB after the same round.

    `observed` maps (table_type, entity_id) to official minus F1DB. For each
    time penalty F1DB applied in a round up to `after`, the race is reordered
    without that one penalty - the finishers on the same lap re-sorted by
    time, each position keeping the points F1DB gave it - and the change in
    every driver's and constructor's points is compared with `observed`. Only
    an exact match on every entity is an explanation, and only a unique one
    is returned: this names a cause the build has checked, never a guess
    (AF-34). Returns a dict describing the race, or None.
    """
    by_round = {}
    for r in HV.load_race_results():
        if int(r["year"]) == yr and int(r["round"]) <= after:
            by_round.setdefault(int(r["round"]), []).append(r)

    def points(r):
        return float(r["points"]) if r["points"] not in (None, "") else 0.0

    def constructor(cid):
        mapped = HV.constructor_for_f1db(cid, yr)
        if mapped and cur.execute("SELECT 1 FROM constructors WHERE id=?",
                                  (mapped,)).fetchone():
            return mapped
        return None

    found = []
    for rnd, rows in sorted(by_round.items()):
        for pen in rows:
            if not pen["time_penalty"] or not str(pen["position"]).isdigit():
                continue
            timed = [r for r in rows if str(r["position"]).isdigit()
                     and r["laps"] == pen["laps"]
                     and _race_seconds(r["time"]) is not None]
            timed.sort(key=lambda r: int(r["position"]))
            if pen not in timed or [_race_seconds(r["time"]) for r in timed] != sorted(
                    _race_seconds(r["time"]) for r in timed):
                continue
            unpenalised = _race_seconds(pen["time"]) - float(pen["time_penalty"])
            reordered = sorted(timed, key=lambda r: unpenalised if r is pen
                               else _race_seconds(r["time"]))
            if reordered == timed:
                continue
            slots = [int(r["position"]) for r in timed]
            at = {int(r["position"]): points(r) for r in timed}
            predicted = {}
            moved = []
            for slot, r in zip(slots, reordered):
                delta = at[slot] - points(r)
                if slot != int(r["position"]):
                    # Every driver who moves is named in the filed row, so an
                    # unresolvable one declines the explanation rather than
                    # failing the build later.
                    if not f1db_drivers.get(r["driver_id"]):
                        predicted = None
                        break
                    moved.append((r, slot))
                if not delta:
                    continue
                did = f1db_drivers.get(r["driver_id"])
                cid = constructor(r["constructor_id"])
                if not did or not cid:
                    predicted = None
                    break
                for key in (("drivers", did), ("constructors", cid)):
                    predicted[key] = predicted.get(key, 0.0) + delta
            if predicted is None:
                continue
            predicted = {k: v for k, v in predicted.items() if abs(v) > 0.001}
            if predicted.keys() == observed.keys() and all(
                    abs(predicted[k] - observed[k]) < 0.001 for k in observed):
                found.append({"round": rnd, "penalised": pen,
                              "penalty": float(pen["time_penalty"]),
                              "unpenalised": unpenalised, "moved": moved})
    return found[0] if len(found) == 1 else None


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
    # Keyed on the season as well as the id, because the answer depends on
    # it: F1DB's `alfa-romeo` is this register's Alfa Romeo until 1985 and
    # Sauber from 2019. Keyed on the id alone, whichever season was read
    # first decided every other one, and all 109 constructors' rows of
    # 2019-2023 went in as `alfa-romeo` while the results of the same races
    # said `sauber` - one entrant under two ids in two tables (DA-28).
    f1db_cons = {}
    known_engines = {r[0] for r in cur.execute(
        "SELECT id FROM engine_manufacturers")}
    completed_seasons = {r[0] for r in cur.execute(
        """SELECT year FROM races GROUP BY year
           HAVING SUM(CASE WHEN status <> 'completed' THEN 1 ELSE 0 END) = 0""")}
    known_years = {r[0] for r in cur.execute("SELECT year FROM seasons")}
    conflicts = []
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
            if (entity, yr) not in f1db_cons:
                f1db_cons[(entity, yr)] = HV.constructor_for_f1db(entity, yr)
            eid = f1db_cons[(entity, yr)]
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
        # one classification, and it is recorded rather than resolved - after
        # the loop, where the disagreements of one snapshot can be read
        # together and traced to the race that causes them.
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
                conflicts.append((yr, kind, eid, after, existing[0], pts))
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

    _file_points_disagreements(cur, conflicts, f1db_drivers)
    std_corrected = _correct_standings_the_results_contradict(b)

    if std_rows:
        print(f"  standings: {std_rows} rows from F1DB; {std_checked} "
              f"end-of-season rows already held and checked "
              f"({std_conflicts} disagreed); {std_skipped} skipped for an "
              f"unresolvable entity"
              + (f"; {std_corrected} corrected against the results"
                 if std_corrected else ""))


def _correct_standings_the_results_contradict(b):
    """A standings round that repeats the round before it is a file that was
    not updated. That, and nothing else, is corrected here.

    2026 round 14: F1DB v2026.14.0 published round 13's constructor totals
    under round 14, all eleven of them, while its driver standings for the
    same round were current. Stored as published, the site said Mercedes had
    468 points when their two drivers had 503 between them.

    ONLY THE REPEAT IS CORRECTED. The first version corrected any figure the
    results contradicted, which meant an undeclared points deduction - a real
    decision by somebody, arriving without warning - would have been
    overwritten with this build's arithmetic and filed as though the source
    were wrong (review finding, #583). A disagreement that is not a repeated
    round stops the build and asks for a declaration, the same way an entity
    the results cannot reach does.

    What replaces a repeated figure is the sum of that entrant's race and
    sprint points over rounds 1..N, plus any decision declared in
    `data/current.py` - computed from the RESULTS and never from the previous
    round's stored total, so two consecutive stale rounds are each corrected
    to their own sum rather than one being built on the other.

    The published figure goes on the record in `discrepancies`. If correcting
    a round would reorder it, nothing is written: a position is a countback
    this build cannot do, and a person has to look.
    """
    cur = b.cur
    rule = _standings_rule()
    try:
        found = rule.violations(b.con)
    except rule.Unmappable as e:
        raise SystemExit(f"standings: {e}") from None
    if not found:
        return 0
    repeats, others = [], []
    for v in found:
        previous = cur.execute(
            """SELECT points FROM standings
                WHERE year=? AND table_type=? AND entity_id=? AND after_round=?""",
            (v["year"], v["table_type"], v["entity_id"],
             v["after_round"] - 1)).fetchone()
        if (previous and previous[0] is not None
                and abs(previous[0] - v["points"]) < 0.001):
            repeats.append(v)
        else:
            others.append(v)
    if others:
        raise SystemExit(
            "standings: "
            + "; ".join(rule.describe(v) for v in others[:4])
            + (f" (+{len(others) - 4} more)" if len(others) > 4 else "")
            + ". That is not a round repeating the one before it, so it is "
              "not a file that failed to update, and this build will not "
              "overwrite a figure a source published on its own arithmetic. "
              "A deduction, an exclusion or a re-entry is declared in "
              "STANDINGS_ADJUSTMENTS in data/current.py, with the round it "
              "took effect and why.")
    for v in repeats:
        cur.execute(
            """UPDATE standings SET points = ?
                WHERE year=? AND table_type=? AND entity_id=? AND after_round=?
                  AND engine_id IS ?""",
            (v["expected"], v["year"], v["table_type"], v["entity_id"],
             v["after_round"], v["engine_id"]))
    corrected = len(repeats)
    for year, table, rnd in sorted({(v["year"], v["table_type"], v["after_round"])
                                    for v in repeats}):
        _refuse_a_reordered_round(cur, year, table, rnd)
        _file_a_standings_correction(
            cur, year, table, rnd,
            [v for v in repeats
             if (v["year"], v["table_type"], v["after_round"]) == (year, table, rnd)])
    corrected += _carry_a_correction_to_the_current_row(cur, repeats)
    left = rule.violations(b.con)
    if left:
        raise SystemExit(
            "standings: correcting against the results left "
            f"{len(left)} row(s) still wrong, beginning "
            f"{rule.describe(left[0])}. That is a fault in the correction "
            "itself, not a stale file; nothing further is written.")
    return corrected


def _refuse_a_reordered_round(cur, year, table, rnd):
    """The corrected points must leave the source's own order intact."""
    rows = cur.execute("""SELECT entity_id, position, points FROM standings
        WHERE year=? AND table_type=? AND after_round=? AND position IS NOT NULL
        ORDER BY position""", (year, table, rnd)).fetchall()
    by_points = sorted(rows, key=lambda r: -r[2] if r[2] is not None else 0)
    if [r[0] for r in rows] != [r[0] for r in by_points]:
        raise SystemExit(
            f"standings: correcting {year} {table} round {rnd} against the "
            "results puts the table in a different order from the one the "
            "source published. A position is a countback this build cannot "
            "do; a person has to look at it.")


def _file_a_standings_correction(cur, year, table, rnd, rows):
    """One discrepancies row per corrected round, naming what was published.

    Filed once, from the one pass, so `stored_value` is always what the source
    said and never an intermediate of this build's own (review finding, #583).
    """
    published = ", ".join(f"{v['entity_id']} {v['points']:g}" for v in rows)
    now = ", ".join(f"{v['entity_id']} {v['expected']:g}" for v in rows)
    cur.execute("""INSERT INTO discrepancies (subject, field, stored_value,
            derived_value, assessment, status)
        VALUES (?,?,?,?,?,?)""",
        (f"{year} round {rnd}",
         f"{table}' championship points repeated from round {rnd - 1}",
         published, now,
         "F1DB's standings file for this round repeated the round before it "
         "while its own results for the round awarded points, so the table "
         "did not move for any entrant that scored. A running total is the "
         "sum of what the cars scored, so a repeated round cannot be right "
         "whatever the points system: what is stored is that sum, computed "
         "from this database's race and sprint results, and what the file "
         "said is the stored_value here. Expected to resolve itself upstream "
         "when the file is regenerated.",
         "open"))


def _carry_a_correction_to_the_current_row(cur, repeats):
    """The season-level file lags the same way the per-round one does.

    A season still being run also has a row with no after_round and
    `as_of = 'current'`, read as the source's latest running table - and
    verify.py holds it to exactly that, so correcting only the round rows
    left the two disagreeing and failed the build.

    It follows the round rows ONLY where it carries the same stale figure
    they did. The first version compared magnitudes and would have written
    the latest round's total over a `current` row in either direction, so a
    season file AHEAD of its own per-round files would have been pulled
    backwards - and, because verify.py would otherwise have stopped the
    build on that state, quietly shipped (review finding, #583). Anything
    else is left alone and said out loud.
    """
    moved = 0
    latest = {}
    for v in repeats:
        key = (v["year"], v["table_type"], v["entity_id"])
        if key not in latest or v["after_round"] > latest[key]["after_round"]:
            latest[key] = v
    for (year, table, entity), v in sorted(latest.items()):
        row = cur.execute(
            """SELECT points FROM standings
                WHERE year=? AND table_type=? AND entity_id=?
                  AND after_round IS NULL AND as_of = 'current'""",
            (year, table, entity)).fetchone()
        if row is None or row[0] is None:
            continue
        if abs(row[0] - v["points"]) > 0.001:
            print(f"  standings: {year} {table} {entity}'s 'current' row says "
                  f"{row[0]:g}, which is neither the figure the round rows "
                  f"repeated ({v['points']:g}) nor a lag this build corrects. "
                  f"Left as published.")
            continue
        cur.execute(
            """UPDATE standings SET points = ?
                WHERE year=? AND table_type=? AND entity_id=?
                  AND after_round IS NULL AND as_of = 'current'""",
            (v["expected"], year, table, entity))
        moved += cur.rowcount
    return moved


def _file_points_disagreements(cur, conflicts, f1db_drivers):
    """One discrepancy per entity whose official and F1DB points differ, and
    - where one race accounts for all of a snapshot's differences - one on
    that race, which the points rows cite rather than restate (AF-34)."""
    def name_of(kind, eid):
        row = cur.execute(
            "SELECT full_name FROM drivers WHERE id=?" if kind == "drivers"
            else "SELECT name FROM constructors WHERE id=?", (eid,)).fetchone()
        return row[0] if row else eid

    causes = {}
    for yr, after in sorted({(c[0], c[3]) for c in conflicts if c[3] is not None}):
        observed = {(kind, eid): official - f1db
                    for (y, kind, eid, a, official, f1db) in conflicts
                    if (y, a) == (yr, after) and official is not None
                    and f1db is not None}
        cause = _one_penalty_explains(cur, yr, after, observed, f1db_drivers)
        if cause:
            causes[(yr, after)] = cause

    generic = ("formula1.com and F1DB give different championship points for "
               "the same entity at the same point in the season. The official "
               "figure is 'verified' and is not overwritten; v_standings_final "
               "shows whichever source's table has counted the most rounds, "
               "formula1.com's where both stand after the same round, and this "
               "row is what makes the difference visible.")
    for (yr, kind, eid, after, official, f1db) in conflicts:
        cause = causes.get((yr, after))
        if cause:
            race = cur.execute("SELECT name_used FROM races WHERE year=? AND round=?",
                               (yr, cause["round"])).fetchone()
            pen = cause["penalised"]
            who = name_of("drivers", f1db_drivers[pen["driver_id"]])
            text = (f"formula1.com's table after round {after} and F1DB's after the "
                    f"same round differ here, and the cause is one race: reclassifying "
                    f"the {yr} {race[0]} (round {cause['round']}) without {who}'s "
                    f"{_points_text(cause['penalty'])}-second time penalty reproduces "
                    f"formula1.com's table for every driver and constructor it lists. The "
                    f"disagreement is filed on that race, '{yr} round "
                    f"{cause['round']}'; this row is its effect on the season total. "
                    f"The official figure is 'verified' and is not overwritten; "
                    f"v_standings_final shows whichever source's table has counted "
                    f"the most rounds.")
        else:
            text = generic
        stage = "final" if after is None else f"after round {after}"
        # Subject is the display name, which is how a race page or a driver
        # page finds its disagreements; a constructor's page does the same on
        # constructors.name.
        cur.execute("""INSERT INTO discrepancies (subject, field,
            stored_value, derived_value, assessment, status)
            VALUES (?,?,?,?,?,?)""",
            (name_of(kind, eid), f"{yr} championship points, {stage}",
             _points_text(official), _points_text(f1db), text, "open"))

    for (yr, after), cause in sorted(causes.items()):
        pen = cause["penalised"]
        moved = sorted(cause["moved"], key=lambda m: int(m[0]["position"]))
        lo, hi = min(m[1] for m in moved), max(m[1] for m in moved)
        f1db_order = [name_of("drivers", f1db_drivers[r["driver_id"]]) for r, _ in moved]
        official_order = [name_of("drivers", f1db_drivers[r["driver_id"]])
                          for r, _ in sorted(moved, key=lambda m: m[1])]
        who = name_of("drivers", f1db_drivers[pen["driver_id"]])
        others = [n for n in f1db_order if n != who]
        slot = next(s for r, s in moved if r is pen)
        way = "down" if slot < int(pen["position"]) else "up"
        n_points = sum(1 for c in conflicts if (c[0], c[3]) == (yr, after))
        cur.execute("""INSERT INTO discrepancies (subject, field,
            stored_value, derived_value, assessment, status)
            VALUES (?,?,?,?,?,?)""",
            (f"{yr} round {cause['round']}",
             f"finishing order, {_ordinal(lo)} to {_ordinal(hi)}",
             ", ".join(f1db_order), ", ".join(official_order),
             f"F1DB classifies {who} {_ordinal(int(pen['position']))} on "
             f"{pen['time']}, which includes a "
             f"{_points_text(cause['penalty'])}-second time penalty. Without it the "
             f"time is {_race_clock(cause['unpenalised'])}, "
             f"{_ordinal(slot)}, and "
             f"{', '.join(others[:-1]) + ' and ' + others[-1] if len(others) > 1 else others[0]} "
             f"each move {way} a place among the finishers timed on that lap. "
             f"Reclassifying this race that way, and nothing else, reproduces "
             f"formula1.com's championship table after round {after} for every "
             f"driver and constructor it lists, so the {n_points} points "
             f"disagreements filed against that table are this one. The race "
             f"entries hold F1DB's order. Neither source says whether the penalty "
             f"stood - the FIA decision document for the event would - so this "
             f"stays open until it is read.", "open"))


def _stage_26_pit_stops_from_f1db_under_their(b):
    """pit stops from F1DB, under their own source"""
    cur = b.cur
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
        # The claims follow the columns: the three figures this fetch gave
        # replace the hand-entered ones they overwrote, and the fastest-lap
        # total, which it did not give, keeps the claim it had. That one
        # column is the case external_source cannot express.
        for field, value in (("wins_external", wins), ("poles_external", poles),
                             ("podiums_external", podiums)):
            cur.execute("""DELETE FROM claims WHERE tbl = 'drivers'
                AND row_key = ? AND field = ?""", (did, field))
            if value is not None:
                cur.execute("""INSERT INTO claims (tbl, row_key, field,
                    value_given, as_of, source) VALUES ('drivers',?,?,?,?,?)""",
                    (did, field, str(value), D.STATS_AS_OF,
                     "https://www.formula1.com/en/drivers"))


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
    for did, field, old, new, reason, new_source in HV.CORRECTIONS:
        n = cur.execute(f"""UPDATE drivers SET {field}_external = ?
            WHERE id = ? AND {field}_external = ?""", (new, did, old)).rowcount
        if n != 1:
            raise SystemExit(f"correction did not apply: {did} {field} {old}->{new}")
        # The claim moves with the column. A new source replaces the old one,
        # and the old value is on the record in `discrepancies` below; no new
        # source means the old one was mistyped and keeps its claim.
        n = cur.execute("""UPDATE claims SET value_given = ?,
                source = COALESCE(?, source),
                as_of = CASE WHEN ? IS NULL THEN as_of END
            WHERE tbl = 'drivers' AND row_key = ? AND field = ?
              AND value_given = ?""",
            (str(new), new_source, new_source, did, f"{field}_external",
             str(old))).rowcount
        if n != 1:
            raise SystemExit(f"correction: no claim backs {did} {field} = {old}")

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

    for i, field, area, state, reader, desc, n, res in HV.KNOWN_GAPS:
        cur.execute("""INSERT INTO known_gaps (id, field, area, state, reader,
            description, races_affected, resolution) VALUES (?,?,?,?,?,?,?,?)""",
            (i, field, area, state, reader, desc, n, res))
    # the circuit gap is measured, not asserted
    cur.execute("""UPDATE known_gaps SET races_affected =
        (SELECT COUNT(*) FROM races WHERE circuit_id IS NULL)
        WHERE field = 'circuit_id'""")

    # Record every stored-vs-derived difference, and assert that each one is
    # either explained by a known gap (the driver was still racing in a season
    # the harvest could not reach) or explicitly declared above.
    for i, (did, field, old, new, reason, _src) in enumerate(HV.CORRECTIONS, 1):
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
    cur = b.cur

    # --- the records table, derived (PD-03, DA-19)
    # Thirty rows were authored here from general knowledge, at 'medium',
    # with twenty-four spellings of as_of, and nothing in verify.py read them.
    # The page said Hamilton had 105 wins while drivers.wins, two tables over,
    # said 106. Each row is now a query over the tables the site's leaderboards
    # read - drivers.wins, seasons, race_entries, v_standings_final - and runs
    # here, after stage 30 has filled the derived career columns. as_of is the
    # last completed race the database holds, read off `races`, so a typed date
    # can never go stale; every row carries the tier of the race records it is
    # computed from, because a derivation cannot outrank its inputs.
    as_of = cur.execute(
        "SELECT MAX(date_iso) FROM races WHERE status = 'completed'").fetchone()[0]
    if not as_of:
        raise SystemExit("records: no completed race has a date; as_of cannot be derived")
    rows = derive_records(cur)
    for i, r in enumerate(rows, 1):
        cur.execute("""INSERT INTO records (id, key, category, record, holder,
            holder_table, holder_id, value, value_num, unit, detail, as_of, confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'reference')""",
            (i, r["key"], r["category"], r["record"], r["holder"], r["holder_table"],
             r["holder_id"], r["value"], r["value_num"], r["unit"], r["detail"], as_of))
    # Every holder_id must be a row in the table it names, now, not in verify -
    # a record that points at nothing is a build defect, not a data finding.
    for r in cur.execute("""SELECT key, holder_table, holder_id FROM records
                            WHERE holder_id IS NOT NULL""").fetchall():
        if not cur.execute(f"SELECT 1 FROM {r[1]} WHERE id = ?", (r[2],)).fetchone():
            raise SystemExit(f"records: {r[0]} names {r[1]}.{r[2]}, which does not exist")
    print(f"  records: {len(rows)} derived, as of {as_of}")


def _stage_32_link_race_entries_to_the_chassis(b):
    """link race entries to the CHASSIS that scored them"""
    cur = b.cur
    known_cons = b.known_cons
    entrants = b.entrants

    # --- link race entries to the CHASSIS that scored them
    #
    # known_gaps #3 has stood since v2.6: the chassis-per-race harvest was
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


def _stage_35_link_race_entries_to_the_curated(b):
    """link race entries to the curated car that scored them"""
    con = b.con
    cur = b.cur
    known_cons = b.known_cons
    entrants = b.entrants

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
        # The remainder is F1DB's: the entry lists name those chassis for the
        # constructor that season (PM-14). A NULL claim is the list naming
        # none beyond the car's, which is what `corroborated` = 1 means.
        cur.execute("""INSERT INTO claims (tbl, row_key, field, value_given,
            source) VALUES ('car_seasons', ?, 'other_chassis', ?, ?)""",
            (f"{cid}|{yr}", "+".join(others) or None, HV.F1DB_SOURCE))
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

    # The two register spans the race records read differently, with the
    # reason beside the fact (CD-25). Not open: nothing is waiting to be
    # settled, both readings stand. This is the last discrepancies write in
    # STAGES - verify.py holds that - so a row added here appends and moves
    # no existing id (the PM-30 lesson).
    for did, field, stored, derived, why in HV.EXPLAINED_SPANS:
        cur.execute("""INSERT INTO discrepancies (subject, field, stored_value,
            derived_value, assessment, status)
            SELECT full_name, ?, ?, ?, ?, 'explained - each side is right about something'
            FROM drivers WHERE id = ?""", (field, str(stored), str(derived), why, did))
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

    # constructors.last_entry is documented as "NULL = still competing", and
    # ten constructors that last raced between 1951 and 1997 carried NULL, so
    # a consumer following the comment got Talbot-Lago as a current team. For
    # a constructor the register marks inactive, the last season it has a race
    # entry in is the figure; an active one keeps NULL, which is now true.
    cur.execute("""UPDATE constructors SET last_entry = (
            SELECT MAX(r.year) FROM race_entries e JOIN races r ON r.id = e.race_id
             WHERE e.constructor_id = constructors.id)
        WHERE last_entry IS NULL AND active = 0
          AND EXISTS (SELECT 1 FROM race_entries e WHERE e.constructor_id = constructors.id)""")

    normalise_countries(cur)

    # The coverage claim inside the artefact is read off the season register,
    # so a new season cannot leave it saying last year's range (SD-12).
    lo, hi = cur.execute("SELECT MIN(year), MAX(year) FROM seasons").fetchone()
    cur.execute("UPDATE meta SET value = ? WHERE key = 'coverage_seasons'",
                (f"{lo}-{hi}",))
    if cur.rowcount != 1:
        raise SystemExit("meta.coverage_seasons is missing; the coverage claim "
                         "would silently keep whatever was typed")

    # The coverage note, from the counts, so it cannot say the database lacks
    # what it holds (CR-08, PD-24). One function, so verify.py rebuilds the
    # same string and compares it whole.
    cur.execute("UPDATE meta SET value = ? WHERE key = 'coverage_note'",
                (coverage_note(cur),))
    if cur.rowcount != 1:
        raise SystemExit("meta.coverage_note is missing")

    # The same discipline for the prose the database carries about itself.
    # `source_registry` is read straight onto /data/sources, and its figures
    # were typed: 1,161 races and 27,555 entries against 1,163 and 27,504
    # held, with qualifying, standings and pit stops stale beside them,
    # because nothing recomputed them (CD-38, AF-63). Each is now a
    # {{fig:name}} token in data/current.py that this expands off the counts,
    # here and not at insert time because the tables it counts are loaded by
    # the stages above. verify.py re-expands the literals and compares whole,
    # and refuses a token that survived into any text column.
    pf = _prose_figures()
    rewritten = pf.apply(cur)
    left = pf.survivors(con)
    if left:
        raise SystemExit(
            "a figure token reached the built database in "
            + "; ".join(f"{t}.{c} ({n} row(s))" for t, c, n in left)
            + ". Expand it by naming the column in tools/prose_figures.py PROSE.")
    print(f"  prose figures: {rewritten} row(s) rewritten from the counts")
    # Every loader's skipped rounds, in one place, so a round F1DB has and
    # the calendar does not is visible whichever loader met it first.
    for what, rounds in sorted(b.skipped_rounds.items()):
        print(f"  {what}: {len(rounds)} round(s) not yet on the calendar: "
              + ", ".join(f"{y} r{r}" for y, r in sorted(rounds)))

    resolved = store_source_ids(con)
    print(f"  source_id: {resolved} rows across the tables carrying `source` "
          f"resolved to a registry entry")
    undeclared = [f"{t}.{f}" for t, f in cur.execute(
        "SELECT DISTINCT tbl, field FROM claims ORDER BY 1, 2")
        if (t, f) not in N.CLAIM_FIELDS]
    if undeclared:
        raise SystemExit(
            "claims holds " + ", ".join(undeclared) + ", which CLAIM_FIELDS in "
            "data/current.py does not declare. Name the column it backs.")
    print("  claims: " + ", ".join(
        f"{t} {n}" for t, n in cur.execute(
            "SELECT tbl, COUNT(*) FROM claims GROUP BY tbl ORDER BY tbl")))

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


def store_source_ids(con):
    """Give every table carrying `source` a `source_id`, and fill it (DA-03).

    Until this, which registry entry a row belonged to - and so under what
    licence it may be redistributed - was answerable only in Python: a
    longest-prefix match on source_registry.url and then the regular
    expressions in source_patterns, which SQLite cannot evaluate. Storing the
    answer makes it a join.

    The tables are read from sqlite_master rather than listed, so a table
    that gains `source` gains this with it. source_registry is left out: its
    `source` is a source's name, not a citation. A value that resolves to
    nothing stops the build, because a row whose source nobody has assessed
    is a row whose licence nobody knows. verify.py re-resolves every value by
    its own copy of the rule and compares.
    """
    registry = con.execute(
        "SELECT id, url FROM source_registry WHERE url IS NOT NULL "
        "AND url <> ''").fetchall()
    patterns = [(re.compile(p), sid) for sid, p in con.execute(
        "SELECT source_id, pattern FROM source_patterns ORDER BY id")]

    def resolve(text):
        best = None
        for sid, url in registry:
            if text.startswith(url.rstrip("/")) and (
                    best is None or len(url) > len(best[1])):
                best = (sid, url)
        if best:
            return best[0]
        return next((sid for rx, sid in patterns if rx.match(text)), None)

    tables = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' "
        "AND name <> 'source_registry' ORDER BY name")]
    written, unresolved = 0, []
    for table in tables:
        columns = [c[1] for c in con.execute(f'PRAGMA table_info("{table}")')]
        if "source" not in columns:
            continue
        if "source_id" not in columns:
            con.execute(f'ALTER TABLE "{table}" ADD COLUMN source_id '
                        f'INTEGER REFERENCES source_registry(id)')
        for (text,) in con.execute(
                f'SELECT DISTINCT source FROM "{table}" WHERE source IS NOT NULL '
                f"AND TRIM(source) <> ''").fetchall():
            sid = resolve(text)
            if sid is None:
                unresolved.append(f"{table}: {text}")
                continue
            written += con.execute(
                f'UPDATE "{table}" SET source_id = ? WHERE source = ?',
                (sid, text)).rowcount
    if unresolved:
        raise SystemExit(
            f"{len(unresolved)} source value(s) resolve to no registry entry, "
            f"e.g. {'; '.join(unresolved[:3])}. Add a pattern to "
            f"SOURCE_PATTERNS in data/current.py, or correct the citation.")
    return written


GEOMETRY_DB = os.path.join(HERE, "f1-geometry.db")
BUILD_GEOMETRY_DB = GEOMETRY_DB + ".tmp"
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

    # Four columns name a country, not three: a driver's country of birth
    # joined them with PD-17 and is held to the same vocabulary, because
    # "United States of America" on one column and "United States" on another
    # is the same split this function exists to prevent, one table further in.
    for table, column in (("drivers", "nationality"),
                          ("drivers", "country_of_birth"),
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

    if os.path.exists(BUILD_GEOMETRY_DB):
        os.remove(BUILD_GEOMETRY_DB)
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

    geo = sqlite3.connect(BUILD_GEOMETRY_DB)
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



def _stage_34_circuit_outlines_from_f1db(b):
    """circuit outlines: F1DB's drawing of every layout, and the layout each race ran"""
    cur = b.cur

    # --- the layout each race ran, and the outline of every layout
    #
    # Two files from the same fetch. race_layouts.txt names the F1DB layout
    # each race ran; circuit_outlines.txt carries one SVG path per layout.
    # F1DB's circuit ids are not this register's - ten venues are spelt
    # differently and its one `nurburgring` is three circuits here - so an
    # outline's circuit_id is never read from F1DB. It is derived from the
    # races that ran the layout, which already carry the register's
    # circuit_id from the venue harvest, and a layout whose races sit at two
    # circuits here is refused rather than guessed.
    #
    # The outline is a drawing and the trace in circuit_geometry is a
    # measurement: different facts, different tables, and nothing here checks
    # one against the other.
    race_layouts = HV.load_race_layouts()
    outlines = HV.load_circuit_outlines()
    if not race_layouts or not outlines:
        print("  circuit outlines: harvest absent, nothing loaded")
        return

    ran = {}        # layout id -> the register's circuit ids of the races that ran it
    race_ids = {}   # layout id -> the ids of those races
    for h in race_layouts:
        rid = b.race_for(h["year"], h["round"], "race layouts")
        if rid is None:
            continue
        cid = cur.execute("SELECT circuit_id FROM races WHERE id=?", (rid,)).fetchone()[0]
        ran.setdefault(h["layout_id"], set()).add(cid)
        race_ids.setdefault(h["layout_id"], []).append(rid)

    inserted, unplaced = 0, []
    for o in outlines:
        lid = o["layout_id"]
        # The path is written into a `d` attribute on every page that draws
        # it. The fetch refused anything outside path syntax; so does this.
        if not re.fullmatch(HV.SVG_PATH_DATA, o["path"] or ""):
            raise SystemExit(
                f"circuit outline {lid}: the path holds a character outside SVG "
                f"path data and will not be stored")
        circuits = ran.get(lid, set()) - {None}
        if len(circuits) > 1:
            raise SystemExit(
                f"circuit outline {lid} (F1DB circuit {o['circuit_id']}) was run by "
                f"races at {', '.join(sorted(circuits))}: one F1DB layout, two "
                f"circuits here. Decide which before it is stored.")
        if not circuits:
            # Only races this register does not hold have run it.
            unplaced.append(lid)
            continue
        cur.execute("""INSERT INTO circuit_outlines (f1db_layout_id, circuit_id,
            f1db_circuit_id, length_km, turns, path, confidence, source)
            VALUES (?,?,?,?,?,?,?,?)""",
            (lid, circuits.pop(), o["circuit_id"],
             float(o["length_km"]) if o["length_km"] else None,
             int(o["turns"]) if o["turns"] else None,
             o["path"], HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))
        inserted += 1
        cur.executemany("UPDATE races SET f1db_layout_id=? WHERE id=?",
                        [(lid, rid) for rid in race_ids[lid]])
    tagged = cur.execute(
        "SELECT COUNT(*) FROM races WHERE f1db_layout_id IS NOT NULL").fetchone()[0]

    # --- which outline draws each of this register's layouts
    #
    # circuit_layouts is finer than F1DB's list in places (three Monza road
    # courses where F1DB has one) and coarser in others (one chicane era where
    # F1DB has two). Where every race in a row's span ran one F1DB layout, that
    # outline draws it. Where the span crosses two, nothing is chosen and the
    # column stays NULL - a race page draws the outline its own row names, so
    # the NULL costs a reader nothing. A one-off row (by_year = 0) is matched
    # through the races that name it; a timeline row through its years, less
    # any race that names a one-off, or Bahrain's 2010 endurance loop would
    # sit inside the Grand Prix circuit's span.
    drawn, split = 0, []
    for lid_, cid, key, fy, ty, by_year in cur.execute("""SELECT id, circuit_id,
            layout_key, from_year, to_year, by_year FROM circuit_layouts""").fetchall():
        if by_year:
            ids = cur.execute("""SELECT DISTINCT f1db_layout_id FROM races
                WHERE circuit_id=? AND layout_key IS NULL AND f1db_layout_id IS NOT NULL
                  AND year >= ? AND year <= COALESCE(?, 9999)""", (cid, fy, ty)).fetchall()
        else:
            ids = cur.execute("""SELECT DISTINCT f1db_layout_id FROM races
                WHERE circuit_id=? AND layout_key=? AND f1db_layout_id IS NOT NULL""",
                (cid, key)).fetchall()
        if len(ids) == 1:
            cur.execute("UPDATE circuit_layouts SET f1db_layout_id=? WHERE id=?",
                        (ids[0][0], lid_))
            drawn += 1
        elif len(ids) > 1:
            split.append(f"{cid}:{key}")
    print(f"  circuit outlines: {inserted} layouts from F1DB, {tagged} races name theirs, "
          f"{drawn} of this register's layouts drawn by one outline"
          + (f", {len(split)} span several ({', '.join(split)})" if split else "")
          + (f"; {len(unplaced)} outlines no race here ran, skipped: "
             f"{', '.join(unplaced)}" if unplaced else ""))


def _stage_36_what_f1db_publishes_about_a_driver_and(b):
    """what F1DB publishes about a driver, and the id it publishes it under"""
    cur = b.cur

    # --- what F1DB publishes about a driver, and the id it publishes it under
    #
    # The harvest read eight columns out of F1DB's driver register and the
    # build used seven. The abbreviation was fetched on every run and dropped
    # on the floor; the place of birth, the country of birth and the permanent
    # number were never fetched at all (PD-17). They are facts about a person
    # from one CC BY 4.0 source, and the three-letter code and the car number
    # are what a grid or a standings table is written with.
    #
    # This runs late and updates rather than inserting, because it has to
    # reach every driver the register holds and not only the ones admitted
    # from F1DB: `norris` was authored here and is `lando-norris` there, and
    # b.f1db_drivers - resolved in stage 21, which refuses a collision rather
    # than guessing - is what joins the two.
    #
    # f1db_id is the reconciliation key. Until now the only link between this
    # register and the largest source for it was a name match recomputed on
    # every read. Storing what it resolved to means a reader lining the two up
    # does not repeat the match, and means the schema's UNIQUE constraint
    # stands behind the one-to-one-ness that resolve_f1db_drivers checks.
    f1db_drv = {r[0]: r for r in HV.load_f1db_drivers()}
    f1db_ctry = {r[0]: r[1] for r in HV.load_f1db_countries()}
    keyed = numbered = coded = 0
    for f1db_id, our_id in sorted(b.f1db_drivers.items()):
        meta = f1db_drv.get(f1db_id)
        if meta is None:
            raise SystemExit(
                f"the driver map resolves {our_id} to {f1db_id}, which is not "
                f"in harvest/f1db_drivers.txt. Rerun tools/f1db_fetch.py.")
        (_id, _name, _first, _last, _born, _died, abbr, _nat,
         place, born_country_id, number) = meta
        country = None
        if born_country_id:
            country = f1db_ctry.get(born_country_id)
            if country is None:
                raise SystemExit(
                    f"F1DB gives {f1db_id} a country of birth "
                    f"{born_country_id!r} that is not in "
                    f"harvest/f1db_countries.txt. Rerun tools/f1db_fetch.py.")
        cur.execute("""UPDATE drivers SET f1db_id = ?, abbreviation = ?,
            place_of_birth = ?, country_of_birth = ?, permanent_number = ?
            WHERE id = ?""",
            (f1db_id, abbr, place, country,
             int(number) if number else None, our_id))
        keyed += cur.rowcount
        numbered += 1 if number else 0
        coded += 1 if abbr else 0

    # THE CHECK on the number, and the reason it is worth storing. A permanent
    # number is the number the driver races under, so it has to be the number
    # the entry list gives them - with one exception the rule itself names:
    # the REIGNING champion may carry 1 instead. Lando Norris is entered as 1
    # for 2026 and his permanent number is 4, and that is the whole of the
    # divergence in the register. Anything else means the two sources disagree
    # about who is driving which car, which is not a thing to publish.
    #
    # "Reigning" is the whole of the escape, and it is read from title_years
    # rather than from titles > 0. Any title-holder would leave the one driver
    # the escape covers with a number nothing constrains in either direction -
    # a 1992 champion entered as 1 in 2026 would pass - which is a check that
    # stops checking exactly where it is used.
    #
    # One thing it cannot constrain, and the limit is in the data rather than
    # here: a driver actually carrying 1 has no entry number to check their
    # permanent number against, because the entry list records the 1. Their
    # number is held only by F1DB until they carry it again.
    for our_id, number, year, entered, title_years in cur.execute("""
            SELECT d.id, d.permanent_number, e.year, e.car_number, d.title_years
            FROM drivers d JOIN season_entries e ON e.driver_id = d.id
            WHERE d.permanent_number IS NOT NULL
              AND e.car_number IS NOT NULL
              AND e.car_number != d.permanent_number
            ORDER BY e.year, d.id""").fetchall():
        if entered == 1 and str(year - 1) in (title_years or "").split(","):
            continue
        raise SystemExit(
            f"{our_id} is entered with car number {entered} in {year} and "
            f"F1DB gives the permanent number {number}. Only the champion of "
            f"the season before may carry 1, and this driver's titles are "
            f"{title_years or 'none'}: one of the two numbers is wrong.")

    print(f"  f1db ids: {keyed} driver(s) keyed to the F1DB register, "
          f"{coded} with a three-letter code, {numbered} with a permanent number")


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
    _stage_34_circuit_outlines_from_f1db,
    _stage_36_what_f1db_publishes_about_a_driver_and,
    # Last on purpose: it closes the build - the authored ceiling, the
    # geometry split and the VACUUM live at its end - so a loader after it
    # would write into a connection nothing commits.
    _stage_35_link_race_entries_to_the_curated,
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


def harvest_covers_every_completed_race(cur, race_key, rows, what):
    """A hand-written harvest must have one row for every completed race it has
    reached, and no race twice.

    This replaced `applied != 1161`: a literal that had to be bumped by hand
    after every Grand Prix, in two places, or the build refused - and that
    caught a truncated file only by accident of its being the right number.
    The rule it was standing in for is the one stated here. A race after the
    harvest's last row is the week it has not caught up yet; that is what the
    vacancy fills in the F1DB loaders are for, and verify.py counts it.
    """
    seen = {}
    for h in rows:
        key = (int(h["year"]), int(h["round"]))
        seen[key] = seen.get(key, 0) + 1
    twice = sorted(k for k, n in seen.items() if n > 1)
    if twice:
        raise SystemExit(f"{what}: {len(twice)} race(s) appear twice, e.g. {twice[:3]}")
    if not seen:
        raise SystemExit(f"{what}: the harvest file is empty")
    last = max(seen)
    completed = {(y, r) for (y, r), rid in race_key.items()
                 if cur.execute("SELECT status FROM races WHERE id=?", (rid,)).fetchone()[0]
                 == "completed"}
    missing = sorted(k for k in completed if k <= last and k not in seen)
    if missing:
        raise SystemExit(f"{what}: no row for {len(missing)} completed race(s) before "
                         f"its last row {last}, e.g. {missing[:3]}")


def coverage_note(cur):
    """What the database holds, read off the tables it describes.

    Prose only where nothing can drift; every figure is a count, including
    the fastest laps - 2021 Belgium has none, by declaration in known_gaps,
    and a note that said "of each" contradicted that two tables over.
    """
    def n(sql):
        return cur.execute(sql).fetchone()[0]
    lo, hi = cur.execute("SELECT MIN(year), MAX(year) FROM seasons").fetchone()
    completed = n("SELECT COUNT(*) FROM races WHERE status = 'completed'")
    classified = n("""SELECT COUNT(DISTINCT race_id) FROM race_entries
                      WHERE finish_position IS NOT NULL""")
    with_fl = n("""SELECT COUNT(DISTINCT race_id) FROM race_entries WHERE fastest_lap = 1""")
    with_pole = n("""SELECT COUNT(DISTINCT race_id) FROM race_entries WHERE pole = 1""")
    return (
        f"Held, {lo}-{hi}: {n('SELECT COUNT(*) FROM races'):,} championship races "
        f"({completed:,} run), with the winner of every run race, a pole for {with_pole:,} "
        f"and a fastest lap for {with_fl:,} of them; the full classification of "
        f"{classified:,} races in {n('SELECT COUNT(*) FROM race_entries'):,} race entries; "
        f"{n('SELECT COUNT(*) FROM qualifying'):,} qualifying rows; "
        f"{n('SELECT COUNT(*) FROM standings'):,} championship standings rows after every round; "
        f"{n('SELECT COUNT(*) FROM sprint_results'):,} sprint classifications; "
        f"{n('SELECT COUNT(*) FROM pit_stops'):,} pit stops (lap and order, no durations); "
        f"{n('SELECT COUNT(*) FROM drivers'):,} drivers, "
        f"{n('SELECT COUNT(*) FROM constructors'):,} constructors, "
        f"{n('SELECT COUNT(*) FROM chassis'):,} chassis, "
        f"{n('SELECT COUNT(*) FROM circuits'):,} circuits; the circuit of every race; "
        f"constructor lineage, engine formulae, regulation changes, points systems. "
        f"Not held: lap times, stints, race timing and race control messages - no source "
        f"publishes them under a licence that permits passing them on, see known_gaps. "
        f"Chassis specifications are thin for the modern era because teams do not "
        f"publish them. Every disagreement between sources is in discrepancies."
    )


# An entry counts as a start unless the source's result says it never did.
STARTED = ("COALESCE(e.position_text, '') NOT IN ('DNQ', 'DNPQ', 'DNS', 'DNP', 'EX')")
STARTED_RULE = ("An entry counts as a start unless its result is DNQ, DNPQ, DNS, DNP "
                "or EX - did not qualify, pre-qualify, start or practise, or excluded "
                "before the start - so a pit-lane start counts and so does a "
                "retirement on the first lap.")


def _age(born, on):
    """Whole years and remaining days between two ISO dates, by the calendar."""
    b, d = date.fromisoformat(born), date.fromisoformat(on)
    years = d.year - b.year - ((d.month, d.day) < (b.month, b.day))
    try:
        anniversary = b.replace(year=b.year + years)
    except ValueError:            # born on 29 February
        anniversary = b.replace(year=b.year + years, day=28)
    return years, (d - anniversary).days


def _age_text(born, on):
    y, d = _age(born, on)
    return f"{y} years, {d} day{'s' if d != 1 else ''}"


def _ordinal(n):
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def _plural(n, word):
    return f"{n} {word}{'' if n == 1 else 's'}"


def _num(x):
    """A figure for display: 860.0 -> '860', 71.5 -> '71.5', 25.579 -> '25.579'."""
    if isinstance(x, float) and x.is_integer():
        x = int(x)
    return f"{x:,}" if isinstance(x, int) else f"{x:g}"


def _leaders(rows, biggest=True):
    """Every row sharing the best value; rows are (value, ...) tuples."""
    if not rows:
        return []
    best = max(r[0] for r in rows) if biggest else min(r[0] for r in rows)
    return [r for r in rows if r[0] == best]


def _rest(rows, leaders, limit=3):
    """The rows after the leaders, for the detail's 'Next:'."""
    return [r for r in rows if r not in leaders][:limit]


def _also(rows, leaders, name_index, limit=3):
    """'Next: X on 91, Y on 71' - the rows after the leaders, for the detail."""
    seen = {r[name_index] for r in leaders}
    rest = [r for r in rows if r[name_index] not in seen][:limit]
    return ", ".join(f"{r[name_index]} on {_num(r[0])}" for r in rest)


def derive_records(cur):
    """The rows of `records`, each one a query over the tables the site's
    leaderboards read, so the two cannot disagree.

    Every record here is one SQL query, or a short walk over one, with a stable
    `key`. The rule for each is in its `detail`, including what was excluded
    and why, so a reader can dispute the definition rather than the arithmetic.
    A tie holds every holder; one is never picked. What the database CANNOT
    derive - the youngest champion needs the clinching round, the closest
    finish needs race times it does not hold - is not here, and is declared in
    known_gaps rather than typed in from memory.

    Returns the rows in the order they are numbered, as dicts."""
    q = lambda sql, *a: cur.execute(sql, a).fetchall()   # noqa: E731
    out = []

    def add(key, category, record, holders, table, value_num, unit, value, detail):
        # holders: [(name, id)], every holder of a tie, never one picked
        names = ", ".join(h[0] for h in holders)
        out.append(dict(key=key, category=category, record=record, holder=names,
                        holder_table=table,
                        holder_id=str(holders[0][1]) if len(holders) == 1 else None,
                        value_num=value_num, unit=unit, value=value, detail=detail))

    lo, hi = q("SELECT MIN(year), MAX(year) FROM seasons")[0]
    completed = q("SELECT COUNT(*) FROM races WHERE status = 'completed'")[0][0]
    decided = q("SELECT COUNT(*) FROM seasons WHERE drivers_champion IS NOT NULL")[0][0]
    race_name = lambda year, name: f"{year} {name}"                       # noqa: E731

    # ------------------------------------------------------------ drivers
    rows = q("""SELECT COUNT(*) n, d.full_name, d.id,
                       GROUP_CONCAT(s.year, ', ') yrs
                  FROM seasons s JOIN drivers d ON d.id = s.drivers_champion
                 GROUP BY d.id ORDER BY n DESC, d.full_name""")
    lead = _leaders(rows)
    add("most-drivers-titles", "drivers", "Most drivers' championships",
        [(r[1], r[2]) for r in lead], "drivers", lead[0][0], "titles",
        _num(lead[0][0]) + (" each" if len(lead) > 1 else ""),
        f"seasons.drivers_champion counted per driver over the {decided} decided "
        f"championships, {lo}-{q('SELECT MAX(year) FROM seasons WHERE drivers_champion IS NOT NULL')[0][0]}. "
        + "; ".join(f"{r[1]}: {r[3]}" for r in lead)
        + (f". Next: {_also(rows, lead, 1)}." if _also(rows, lead, 1) else "."))

    for key, col, record, unit, rule in (
        ("most-wins", "wins", "Most Grand Prix wins", "wins",
         "drivers.wins, which the build counts as the driver's race_entries rows with "
         "finish_position = 1, so a shared drive counts for both drivers"),
        ("most-poles", "poles", "Most pole positions", "poles",
         "drivers.poles, the count of race_entries rows with pole = 1: the driver the "
         "season record credits with pole, not always the car at grid 1"),
        ("most-podiums", "podiums", "Most podium finishes", "podiums",
         "drivers.podiums, the count of distinct races in which the driver was "
         "classified first, second or third"),
        ("most-fastest-laps", "fastest_laps", "Most fastest laps", "fastest laps",
         "drivers.fastest_laps, the count of race_entries rows with fastest_lap = 1; "
         "a fastest lap shared between drivers counts for each of them"),
    ):
        rows = q(f"SELECT {col}, full_name, id FROM drivers WHERE {col} IS NOT NULL "
                 f"ORDER BY {col} DESC, full_name")
        lead = _leaders(rows)
        add(key, "drivers", record, [(r[1], r[2]) for r in lead], "drivers",
            lead[0][0], unit, _num(lead[0][0]) + (" each" if len(lead) > 1 else ""),
            f"{rule}. verify.py holds the column equal to the race records for every "
            f"driver. Next: {_also(rows, lead, 1)}.")

    rows = q("""SELECT COUNT(*) n, d.full_name, d.id
                  FROM race_entries e JOIN drivers d ON d.id = e.driver_id
                 GROUP BY d.id ORDER BY n DESC, d.full_name""")
    lead = _leaders(rows)
    add("most-race-entries", "drivers", "Most championship race entries",
        [(r[1], r[2]) for r in lead], "drivers", lead[0][0], "entries",
        _num(lead[0][0]) + (" each" if len(lead) > 1 else ""),
        "One row per driver per championship race in race_entries, including entries "
        "that did not qualify, pre-qualify or start. Entries, not starts: drivers.starts "
        "is held only where formula1.com published it and is not derived here. "
        f"Next: {_also(rows, lead, 1)}.")

    FLOOR = 30
    rows = q("""SELECT ROUND(100.0 * d.wins / COUNT(*), 2) pct, d.full_name, d.id,
                       d.wins, COUNT(*) n
                  FROM race_entries e JOIN drivers d ON d.id = e.driver_id
                 GROUP BY d.id HAVING n >= ? ORDER BY pct DESC, d.full_name""", FLOOR)
    lead = _leaders(rows)
    add("highest-win-rate", "drivers", "Highest win rate", [(r[1], r[2]) for r in lead],
        "drivers", lead[0][0], "per cent",
        f"{lead[0][0]:.2f}% ({_num(lead[0][3])} wins from {_num(lead[0][4])} entries)",
        f"drivers.wins over the driver's race_entries rows, for drivers with at least "
        f"{FLOOR} entries. The floor is a choice, stated so it can be argued with: below "
        f"it a handful of races decides the figure. Next: {_also(rows, lead, 1)}.")

    races_in = dict(q("SELECT year, COUNT(*) FROM races WHERE status = 'completed' GROUP BY year"))
    rows = q("""SELECT COUNT(*) n, d.full_name, d.id, r.year
                  FROM race_entries e JOIN races r ON r.id = e.race_id
                  JOIN drivers d ON d.id = e.driver_id
                 WHERE e.finish_position = 1
                 GROUP BY r.year, d.id ORDER BY n DESC, r.year, d.full_name""")
    lead = _leaders(rows)
    add("most-wins-in-a-season", "drivers", "Most wins in a season",
        [(r[1], r[2]) for r in lead], "drivers", lead[0][0], "wins",
        (f"{_num(lead[0][0])} of the {races_in[lead[0][3]]} races in {lead[0][3]}"
         if len(lead) == 1 else f"{_num(lead[0][0])} each"),
        "race_entries rows with finish_position = 1 per driver per season. "
        + "; ".join(f"{r[1]}, {r[3]}: {r[0]} of {races_in[r[3]]}" for r in lead)
        + ". Next: " + ", ".join(f"{r[1]} {r[0]} ({r[3]})" for r in _rest(rows, lead)) + ".")

    # consecutive wins: every completed race in date order
    winners = {}
    for rid, did in q("SELECT race_id, driver_id FROM race_entries WHERE finish_position = 1"):
        winners.setdefault(rid, set()).add(did)
    streak, best, holders = {}, 0, []
    for rid, year, name in q("""SELECT id, year, name_used FROM races WHERE status = 'completed'
                                ORDER BY date_iso, year, round"""):
        won = winners.get(rid, set())
        for did in list(streak):
            if did not in won:
                del streak[did]
        for did in won:
            n, start = streak.get(did, (0, (year, name)))
            streak[did] = (n + 1, start)
            if n + 1 > best:
                best, holders = n + 1, []
            # One entry per driver: a second record-length streak by the
            # same driver would otherwise list the name twice.
            if n + 1 == best and all(h[0] != did for h in holders):
                holders.append((did, start, (year, name)))
    names = dict(q("SELECT id, full_name FROM drivers"))
    add("most-consecutive-wins", "drivers", "Most consecutive wins",
        [(names[h[0]], h[0]) for h in holders], "drivers", best, "wins",
        (f"{best}, {race_name(*holders[0][1])} to {race_name(*holders[0][2])}"
         if len(holders) == 1 else f"{best} each"),
        "Every completed championship race in date order (races.date_iso, then round), "
        "the Indianapolis 500 of 1950-60 included. A streak carries over a winter and "
        "ends at the first race the driver did not win, whether or not they entered it. "
        + "; ".join(f"{names[h[0]]}: {race_name(*h[1])} to {race_name(*h[2])}" for h in holders)
        + ".")

    rows = q("""WITH first_win AS (
                  SELECT e.driver_id, MIN(r.date_iso) d
                    FROM race_entries e JOIN races r ON r.id = e.race_id
                   WHERE e.finish_position = 1 GROUP BY e.driver_id)
                SELECT (SELECT COUNT(*) FROM race_entries e2 JOIN races r2 ON r2.id = e2.race_id
                         WHERE e2.driver_id = f.driver_id AND r2.date_iso < f.d) n,
                       d.full_name, d.id, r.year, r.name_used
                  FROM first_win f JOIN drivers d ON d.id = f.driver_id
                  JOIN races r ON r.date_iso = f.d
                  JOIN race_entries w ON w.race_id = r.id AND w.driver_id = f.driver_id
                                     AND w.finish_position = 1
                 ORDER BY n DESC, d.full_name""")
    lead = _leaders(rows)
    add("most-entries-before-first-win", "drivers", "Most race entries before a first win",
        [(r[1], r[2]) for r in lead], "drivers", lead[0][0], "entries",
        (f"{_num(lead[0][0])}, before the {race_name(lead[0][3], lead[0][4])}"
         if len(lead) == 1 else f"{_num(lead[0][0])} each"),
        "For every driver with a win: the race_entries rows dated before the driver's "
        "first finish_position = 1, failures to qualify or start included. "
        f"Next: {_also(rows, lead, 1)}.")

    for key, record, where, biggest, verb in (
        ("youngest-winner", "Youngest race winner", "e.finish_position = 1", False, "won"),
        ("oldest-winner", "Oldest race winner", "e.finish_position = 1", True, "won"),
        ("youngest-starter", "Youngest driver to start a race", STARTED, False, "started"),
        ("oldest-starter", "Oldest driver to start a race", STARTED, True, "started"),
    ):
        rows = q(f"""SELECT CAST(julianday(r.date_iso) - julianday(d.born) AS INTEGER) days,
                            d.full_name, d.id, r.year, r.name_used, d.born, r.date_iso
                       FROM race_entries e JOIN races r ON r.id = e.race_id
                       JOIN drivers d ON d.id = e.driver_id
                      WHERE {where} AND d.born IS NOT NULL AND r.date_iso IS NOT NULL
                      ORDER BY days {'DESC' if biggest else 'ASC'}, d.full_name""")
        lead = _leaders(rows, biggest)
        excluded = q(f"""SELECT COUNT(DISTINCT e.driver_id) FROM race_entries e
                          JOIN drivers d ON d.id = e.driver_id
                         WHERE {where} AND d.born IS NULL""")[0][0]
        add(key, "drivers", record, [(r[1], r[2]) for r in lead], "drivers",
            lead[0][0], "days",
            (f"{_age_text(lead[0][5], lead[0][6])}, {race_name(lead[0][3], lead[0][4])}"
             if len(lead) == 1 else f"{_num(lead[0][0])} days each"),
            f"drivers.born against races.date_iso for every entry that {verb}. "
            + (STARTED_RULE + " " if where == STARTED else "")
            + f"value_num is the age in days. {_plural(excluded, 'such driver')} "
              f"{'has' if excluded == 1 else 'have'} no birth date held and cannot be placed. "
            + "; ".join(f"{r[1]}: born {r[5]}, {verb} {r[6]}" for r in lead) + ".")

    rows = q("""SELECT s.year, d.full_name, d.id, d.died,
                       (SELECT MAX(date_iso) FROM races r
                         WHERE r.year = s.year AND r.status = 'completed') last_race
                  FROM seasons s JOIN drivers d ON d.id = s.drivers_champion
                 WHERE d.died IS NOT NULL
                   AND d.died < (SELECT MAX(date_iso) FROM races r
                                  WHERE r.year = s.year AND r.status = 'completed')
                 ORDER BY s.year""")
    add("posthumous-champion", "drivers",
        "Champion crowned posthumously" + ("s" if len(rows) > 1 else ""),
        [(r[1], r[2]) for r in rows], "drivers", len(rows), "champions",
        f"{len(rows)} ({', '.join(str(r[0]) for r in rows)})",
        "seasons.drivers_champion whose drivers.died falls before the date of the last "
        f"completed race of the title season. {len(rows)} in {decided} championships: "
        + "; ".join(f"{r[1]} died {r[3]}, the {r[0]} season ended {r[4]}" for r in rows) + ".")

    # ------------------------------------------------------- constructors
    rows = q("""SELECT COUNT(*) n, c.name, c.id, GROUP_CONCAT(s.year, ', ') yrs
                  FROM seasons s JOIN constructors c ON c.id = s.constructors_champion
                 GROUP BY c.id ORDER BY n DESC, c.name""")
    lead = _leaders(rows)
    first_cc = q("SELECT MIN(year) FROM seasons WHERE constructors_champion IS NOT NULL")[0][0]
    add("most-constructors-titles", "constructors", "Most constructors' championships",
        [(r[1], r[2]) for r in lead], "constructors", lead[0][0], "titles",
        _num(lead[0][0]) + (" each" if len(lead) > 1 else ""),
        f"seasons.constructors_champion counted per constructor since the title began "
        f"in {first_cc}. " + "; ".join(f"{r[1]}: {r[3]}" for r in lead)
        + f". Next: {_also(rows, lead, 1)}.")

    run, best, holders = None, 0, []
    for year, cid, name in q("""SELECT s.year, c.id, c.name FROM seasons s
                                JOIN constructors c ON c.id = s.constructors_champion
                                ORDER BY s.year"""):
        if run and run[0] == cid and run[2] == year - 1:
            run = (cid, run[1], year, name)
        else:
            run = (cid, year, year, name)
        n = run[2] - run[1] + 1
        # A run is appended the year it reaches the record length, and the
        # list is emptied the year any run passes it, so a run appears once.
        if n > best:
            best, holders = n, []
        if n == best and all(h[0] != cid for h in holders):
            holders.append(run)
    add("most-consecutive-constructors-titles", "constructors",
        "Most consecutive constructors' championships",
        [(h[3], h[0]) for h in holders], "constructors", best, "titles",
        (f"{best}, {holders[0][1]}-{holders[0][2]}" if len(holders) == 1 else f"{best} each"),
        "seasons.constructors_champion in year order; a run is unbroken while the same "
        "constructor id wins in consecutive seasons. "
        + "; ".join(f"{h[3]}: {h[1]}-{h[2]}" for h in holders) + ".")

    rows = q("SELECT wins, name, id FROM constructors WHERE wins IS NOT NULL ORDER BY wins DESC, name")
    lead = _leaders(rows)
    add("most-constructor-wins", "constructors", "Most Grand Prix wins by a constructor",
        [(r[1], r[2]) for r in lead], "constructors", lead[0][0], "wins",
        _num(lead[0][0]) + (" each" if len(lead) > 1 else ""),
        "constructors.wins: distinct races with a finish_position = 1 entry under the "
        "constructor name raced under. Lineage is not merged, so a team's wins under an "
        f"earlier name stay with that name. Next: {_also(rows, lead, 1)}.")

    rows = q("""SELECT COUNT(DISTINCT e.race_id) n, c.name, c.id, r.year
                  FROM race_entries e JOIN races r ON r.id = e.race_id
                  JOIN constructors c ON c.id = e.constructor_id
                 WHERE e.finish_position = 1
                 GROUP BY r.year, c.id ORDER BY n DESC, r.year, c.name""")
    lead = _leaders(rows)
    add("most-constructor-wins-in-a-season", "constructors", "Most wins in a season by a constructor",
        [(r[1], r[2]) for r in lead], "constructors", lead[0][0], "wins",
        (f"{_num(lead[0][0])} of the {races_in[lead[0][3]]} races in {lead[0][3]}"
         if len(lead) == 1 else f"{_num(lead[0][0])} each"),
        "Distinct races with a finish_position = 1 entry per constructor per season, so a "
        "one-two counts once. "
        + "; ".join(f"{r[1]}, {r[3]}: {r[0]} of {races_in[r[3]]}" for r in lead)
        + ". Next: " + ", ".join(f"{r[1]} {r[0]} ({r[3]})" for r in _rest(rows, lead)) + ".")

    rows = q("""SELECT ROUND(100.0 * COUNT(DISTINCT e.race_id) /
                             (SELECT COUNT(*) FROM races x WHERE x.year = r.year
                                 AND x.status = 'completed'), 2) pct,
                       c.name, c.id, r.year, COUNT(DISTINCT e.race_id) w
                  FROM race_entries e JOIN races r ON r.id = e.race_id
                  JOIN constructors c ON c.id = e.constructor_id
                  JOIN seasons s ON s.year = r.year
                 WHERE e.finish_position = 1 AND s.drivers_champion IS NOT NULL
                 GROUP BY r.year, c.id ORDER BY pct DESC, r.year, c.name""")
    lead = _leaders(rows)
    add("highest-season-win-share-constructor", "constructors",
        "Highest share of a season's races won by a constructor",
        [(r[1], r[2]) for r in lead], "constructors", lead[0][0], "per cent",
        (f"{lead[0][0]:.2f}% ({lead[0][4]} of {races_in[lead[0][3]]}, {lead[0][3]})"
         if len(lead) == 1 else f"{lead[0][0]:.2f}% each"),
        "Distinct races won by the constructor over the completed races of the season, "
        "the Indianapolis 500 of 1950-60 counted as a race; seasons still in progress are "
        "excluded. Next: "
        + ", ".join(f"{r[1]} {r[0]:.2f}% ({r[4]} of {races_in[r[3]]}, {r[3]})"
                    for r in _rest(rows, lead)) + ".")

    rows = q("""SELECT MAX(points) pts, entity, entity_id, year FROM v_standings_final
                 WHERE table_type = 'constructors' AND points IS NOT NULL
                 GROUP BY year, entity_id ORDER BY pts DESC, year""")
    lead = _leaders(rows)
    add("most-constructor-points-in-a-season", "constructors",
        "Most points in a season by a constructor",
        [(r[1], r[2]) for r in lead], "constructors", lead[0][0], "points",
        (f"{_num(lead[0][0])}, {lead[0][3]}" if len(lead) == 1 else f"{_num(lead[0][0])} each"),
        "The final constructors' table of every season (v_standings_final). Points systems "
        "differ across the years, so this is the nominal figure the official table "
        "shows, not a like-for-like measure. Next: "
        + ", ".join(f"{r[1]} {_num(r[0])} ({r[3]})" for r in _rest(rows, lead)) + ".")

    rows = q("""SELECT COUNT(DISTINCT e.race_id) n, c.name, c.id,
                       MIN(r.year) fy, MAX(r.year) ly
                  FROM race_entries e JOIN races r ON r.id = e.race_id
                  JOIN constructors c ON c.id = e.constructor_id
                 GROUP BY c.id
                HAVING SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) = 0
                 ORDER BY n DESC, c.name""")
    lead = _leaders(rows)
    add("most-races-without-a-win-constructor", "constructors",
        "Most Grands Prix entered without a win by a constructor",
        [(r[1], r[2]) for r in lead], "constructors", lead[0][0], "races",
        (f"{_num(lead[0][0])}, {lead[0][3]}-{lead[0][4]}" if len(lead) == 1
         else f"{_num(lead[0][0])} each"),
        "Distinct races with a race_entries row under the constructor id and no "
        "finish_position = 1 under it. Counted under the constructor name raced under, as "
        "constructors.wins is: a name change starts a new count, and a win under an "
        "earlier or later name of the same team does not end this one. Next: "
        + ", ".join(f"{r[1]} {r[0]} ({r[3]}-{r[4]})" for r in _rest(rows, lead)) + ".")

    rows = q("""WITH debut AS (
                  SELECT e.constructor_id, MIN(r.date_iso) d
                    FROM race_entries e JOIN races r ON r.id = e.race_id
                   WHERE e.constructor_id IS NOT NULL GROUP BY e.constructor_id)
                SELECT r.year, c.name, c.id, r.name_used
                  FROM debut f JOIN races r ON r.date_iso = f.d
                  JOIN race_entries e ON e.race_id = r.id AND e.constructor_id = f.constructor_id
                                     AND e.finish_position = 1
                  JOIN constructors c ON c.id = f.constructor_id
                 GROUP BY c.id ORDER BY r.date_iso""")
    first_race = q("SELECT MIN(date_iso) FROM races WHERE status = 'completed'")[0][0]
    no_cons = q("SELECT COUNT(*) FROM race_entries WHERE constructor_id IS NULL")[0][0]
    add("won-on-debut-constructor", "constructors", "Won on championship debut",
        [(r[1], r[2]) for r in rows], "constructors", len(rows), "constructors",
        f"{len(rows)} constructors",
        "A constructor id whose earliest race_entries row, by races.date_iso, is in a race "
        "it won. " + "; ".join(f"{r[1]}: {race_name(r[0], r[3])}" for r in rows)
        + f". The {race_name(*q('SELECT year, name_used FROM races WHERE date_iso = ?', first_race)[0])} "
          f"was the championship's first race, at which every constructor debuted. "
          f"{no_cons:,} entries carry no constructor id, most of them Indianapolis 500 "
          f"cars, and cannot count.")

    # -------------------------------------------------------------- races
    rows = q("""SELECT a.points - b.points m, a.entity, a.entity_id, a.year,
                       a.points, b.entity, b.points
                  FROM v_standings_final a
                  JOIN v_standings_final b ON b.year = a.year AND b.table_type = 'drivers'
                                          AND b.position = 2
                  JOIN seasons s ON s.year = a.year
                 WHERE a.table_type = 'drivers' AND a.position = 1
                   AND s.drivers_champion IS NOT NULL
                 ORDER BY m, a.year""")
    lead = _leaders(rows, biggest=False)
    add("closest-championship-margin", "races", "Closest drivers' championship margin",
        [(r[1], r[2]) for r in lead], "drivers", lead[0][0], "points",
        (f"{_num(lead[0][0])} point{'s' if lead[0][0] != 1 else ''}, {lead[0][3]}"
         if len(lead) == 1 else f"{_num(lead[0][0])} points each"),
        "First minus second in the final drivers' table of every decided season "
        "(v_standings_final), with dropped scores as the official table applied them. "
        + "; ".join(f"{r[3]}: {r[1]} {_num(r[4])}, {r[5]} {_num(r[6])}" for r in lead)
        + ". Next: " + ", ".join(f"{r[3]} ({_num(r[0])}: {r[1]} over {r[5]})"
                                  for r in _rest(rows, lead)) + ".")

    rows = q("""SELECT CAST(SUBSTR(q.gap, 2) AS REAL) g, r.year || ' ' || r.name_used, r.id,
                       (SELECT d.full_name FROM qualifying p JOIN drivers d ON d.id = p.driver_id
                         WHERE p.race_id = r.id AND p.position = 1) p1,
                       d2.full_name p2, r.year, r.name_used
                  FROM qualifying q JOIN races r ON r.id = q.race_id
                  JOIN drivers d2 ON d2.id = q.driver_id
                 WHERE q.position = 2 AND q.gap GLOB '+[0-9]*.[0-9]*'
                   AND CAST(SUBSTR(q.gap, 2) AS REAL) > 0
                 ORDER BY g, r.date_iso""")
    lead = _leaders(rows, biggest=False)
    held = q("SELECT COUNT(*) FROM qualifying WHERE position = 2 AND gap GLOB '+[0-9]*.[0-9]*'")[0][0]
    ties = q("""SELECT COUNT(*) FROM qualifying WHERE position = 2
                  AND gap GLOB '+[0-9]*.[0-9]*' AND CAST(SUBSTR(gap, 2) AS REAL) = 0""")[0][0]
    add("closest-pole-margin", "races", "Closest pole position margin",
        [(r[1], r[2]) for r in lead], "races", lead[0][0], "seconds",
        f"{lead[0][0]:.3f} s" + (" each" if len(lead) > 1 else ""),
        f"The gap recorded against second place on the qualifying sheet (qualifying.gap), "
        f"held for {held:,} of the {completed:,} completed races and compared at the "
        f"precision the sheet published. {ties} sheets record an identical time for first "
        f"and second - a margin of zero at that precision - and are set aside as ties. "
        + "; ".join(f"{race_name(r[5], r[6])}: {r[3]} over {r[4]}" for r in lead) + ".")

    rows = q("""SELECT MAX(u.len) km, u.name, u.id FROM (
                  SELECT c.length_km len, c.name, c.id FROM circuits c
                  UNION ALL
                  SELECT l.length_km, c.name, c.id FROM circuit_layouts l
                    JOIN circuits c ON c.id = l.circuit_id) u
                 WHERE u.len IS NOT NULL
                   AND EXISTS (SELECT 1 FROM races r WHERE r.circuit_id = u.id
                                  AND r.status = 'completed')
                 GROUP BY u.id ORDER BY km DESC, u.name""")
    lead = _leaders(rows)
    add("longest-circuit", "races", "Longest circuit used for a championship race",
        [(r[1], r[2]) for r in lead], "circuits", lead[0][0], "km",
        f"{_num(lead[0][0])} km" + (" each" if len(lead) > 1 else ""),
        "The greatest length_km held for a circuit that has staged a completed championship "
        "race, over circuits (the current figures) and circuit_layouts (historic "
        f"configurations, where held). Next: {_also(rows, lead, 1)}.")

    rows = q("""SELECT e.grid, d.full_name, d.id, r.year, r.name_used
                  FROM race_entries e JOIN races r ON r.id = e.race_id
                  JOIN drivers d ON d.id = e.driver_id
                 WHERE e.finish_position = 1 AND e.grid IS NOT NULL
                 ORDER BY e.grid DESC, r.date_iso""")
    lead = _leaders(rows)
    pl = q("""SELECT COUNT(*) FROM race_entries WHERE finish_position = 1
                AND grid IS NULL AND grid_text = 'PL'""")[0][0]
    nogrid = q("SELECT COUNT(*) FROM race_entries WHERE finish_position = 1 AND grid IS NULL")[0][0]
    add("lowest-grid-position-for-a-winner", "races", "Lowest grid position for a race winner",
        [(r[1], r[2]) for r in lead], "drivers", lead[0][0], "grid position",
        (f"{_ordinal(lead[0][0])}, {race_name(lead[0][3], lead[0][4])}" if len(lead) == 1
         else f"{_ordinal(lead[0][0])} each"),
        "race_entries.grid of every finish_position = 1 entry. A pit-lane start "
        "(grid_text 'PL') has no grid slot and could not place; "
        + ("every winning entry has a grid slot held. " if nogrid == 0 else
           f"{_plural(pl, 'winner')} started from the pit lane and "
           f"{nogrid} winning {'entry lacks' if nogrid == 1 else 'entries lack'} a grid "
           f"slot, so cannot place. ")
        + "; ".join(f"{r[1]}: {race_name(r[3], r[4])}" for r in lead) + ".")

    rows = q("""SELECT SUM(e.classified = 1) n, r.year || ' ' || r.name_used, r.id
                  FROM race_entries e JOIN races r ON r.id = e.race_id
                 WHERE r.status = 'completed'
                 GROUP BY r.id ORDER BY n, r.date_iso""")
    lead = _leaders(rows, biggest=False)
    add("fewest-classified-finishers", "races", "Fewest classified finishers in a race",
        [(r[1], r[2]) for r in lead], "races", lead[0][0], "cars",
        f"{lead[0][0]} classified" + (" each" if len(lead) > 1 else ""),
        "race_entries.classified = 1 counted per completed race. A car still running at "
        "the flag but too far behind to be classified (NC) is not counted. "
        f"Next: {_also(rows, lead, 1)}.")

    rows = q(f"""SELECT SUM({STARTED}) n, r.year || ' ' || r.name_used, r.id
                   FROM race_entries e JOIN races r ON r.id = e.race_id
                  WHERE r.status = 'completed'
                  GROUP BY r.id ORDER BY n, r.date_iso""")
    lead = _leaders(rows, biggest=False)
    add("fewest-starters", "races", "Fewest starters in a race",
        [(r[1], r[2]) for r in lead], "races", lead[0][0], "cars",
        f"{lead[0][0]} starters" + (" each" if len(lead) > 1 else ""),
        f"{STARTED_RULE} Counted per completed race, {lo}-{hi}, not only the modern era. "
        f"Next: {_also(rows, lead, 1)}.")

    return out


def pin_sqlite_header(path):
    with open(path, "r+b") as f:
        f.seek(96)
        f.write(struct.pack(">I", SQLITE_HEADER_VERSION))


if __name__ == "__main__":
    c = build()
    report(c)
    c.close()
    # Pin, then move into place: a build that raised anywhere above never
    # reaches this line and the committed files are as they were.
    # Both or neither: CLAUDE.md's rule is that the two files ship together,
    # and a geometry stage that produced nothing would otherwise leave a
    # fresh f1.db beside the previous build's overlay.
    for tmp in (BUILD_DB, BUILD_GEOMETRY_DB):
        if not os.path.exists(tmp):
            raise SystemExit(f"{os.path.basename(tmp)} was not written; "
                             f"neither database has been replaced")
    for tmp, final in ((BUILD_DB, DB), (BUILD_GEOMETRY_DB, GEOMETRY_DB)):
        pin_sqlite_header(tmp)
        os.replace(tmp, final)
    print(f"\nWrote {DB}")

