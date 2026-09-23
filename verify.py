#!/usr/bin/env python3
"""
Integrity and consistency checks on the DATA. Exit code 1 if any FAIL.

This was 1,600 lines of top-level script: the connection opened at import,
every check ran on every invocation, and there was no way to ask for one
section. Working on a check meant re-running all of them to see it.

The checks are unchanged and run in the same order — each section below is
exactly the block that used to sit under its heading. What is new is that they
are named, so they can be listed and filtered:

    python3 verify.py                       every section, as before
    python3 verify.py --list                what the sections are called
    python3 verify.py --only pole           the sections matching "pole"
    python3 verify.py --only cars circuits  several

--only is for working on a check, never for deciding whether the data is
sound: a subset that passes says nothing about the rest, so the summary names
the scope and CI runs the lot.

For tests of the CODE — the name matching, the lap arithmetic — see tests/.
This file checks what came out; those check what does the work.
"""
import contextlib
import io
import os
import re
import sqlite3
import sys
from collections import Counter


def _lede_figures():
    """tools/lede_figures.py, imported from beside this file."""
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools"))
    import lede_figures
    return lede_figures


def _prose_figures():
    """tools/prose_figures.py, imported from beside this file."""
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools"))
    import prose_figures
    return prose_figures

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "f1.db")

# Set F1_LOCAL_TIMING=1 when you have deliberately loaded FOM-owned timing onto
# a LOCAL copy. It downgrades the licence section from failure to warning: the
# load is legitimate, the resulting file is simply not yours to publish. Never
# set it in CI, and never commit a database built with it.
LOCAL_TIMING = os.environ.get("F1_LOCAL_TIMING") == "1"

con = None

# The OpenStreetMap centrelines live in their own database beside this one —
# ODbL carries share-alike and a database right, and keeping them out of f1.db
# is what stops twenty-five rows setting the licence of 117,000. See
# split_geometry() in build.py. They still have to be CHECKED, so the overlay is
# attached when it exists and the geometry section reads through GEO.
GEO = "circuit_geometry"
fails, warns = [], []
passes = 0

# Four values used to be assigned in one section and read in a later one, so a
# section could only run after the ones above it. That was invisible while this
# was one script and becomes a crash the moment a section can be asked for on
# its own. They are recreated where they are needed and remembered here, so the
# whole run still does the work once.
_memo = {}


def _once(key, make):
    if key not in _memo:
        _memo[key] = make()
    return _memo[key]


def winners_in(year):
    """Driver -> wins for one season, counted from the entries."""
    return _once(f"winners{year}", lambda: Counter(
        r[0] for r in con.execute(
            """SELECT e.driver_id FROM race_entries e JOIN races r ON r.id = e.race_id
                WHERE r.year = ? AND e.finish_position = 1""", (year,))))


def season_in_progress():
    """The season being run: the latest with a round already completed.

    Not MAX(year), which stops being the same thing the moment a calendar is
    announced for a season that has not started. A season whose every round
    is still scheduled has run nothing, holds no entries and no standings,
    and must not be the yardstick any "how far has the current season got"
    check measures against.
    """
    return _once("in_progress", lambda: con.execute(
        "SELECT MAX(year) FROM races WHERE status = 'completed'").fetchone()[0])


def declared_season():
    """meta.current_season: the season data/current.py says is being run.

    A separate claim from season_in_progress(), which counts what the rows
    actually show, and the two are compared rather than one being derived
    from the other (CR-07). That comparison is what makes the constant safe
    to read everywhere else: a season rolled over in the data but not in
    data/current.py, or the reverse, fails the build instead of leaving half
    the file talking about last year.
    """
    row = _once("declared_season", lambda: con.execute(
        "SELECT value FROM meta WHERE key = 'current_season'").fetchone())
    return int(row[0]) if row else None


def recent_seasons():
    """The season being run and the one before it.

    The pair the hand-entered classification covers: last season's is final,
    this season's stands after a round. Several checks run over both, and
    each of them used to name the two years (CR-07).
    """
    current = season_in_progress()
    return (current - 1, current)


def last_season():
    """The last season the register holds, run or not."""
    return _once("last_season", lambda: con.execute(
        "SELECT MAX(year) FROM seasons").fetchone()[0])


def entry_count():
    return _once("entries", lambda: con.execute(
        "SELECT COUNT(*) FROM race_entries").fetchone()[0])


def harvest_module():
    from data import harvest
    return harvest


def cars_module():
    from data import cars
    return cars


# name -> (heading, function), in definition order, which is run order.
SECTIONS = {}


def section(title):
    def wrap(fn):
        SECTIONS[fn.__name__] = (title, fn)
        return fn
    return wrap


def check(name, ok, detail=""):
    global passes
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    if ok:
        passes += 1
    else:
        fails.append(name)


def value_or_none(key):
    """A `meta` value, or None where the build never wrote one — so a missing
    row reads as a failed check rather than a crash inside it."""
    row = con.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row[0] if row else None


def warn(name, ok, detail=""):
    print(f"  [{'ok  ' if ok else 'WARN'}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        warns.append(name)


@section('REFERENTIAL INTEGRITY')
def referential_integrity():
    fk = con.execute("PRAGMA foreign_key_check").fetchall()
    check("foreign keys resolve", not fk, f"{len(fk)} violations" if fk else "")

    for tbl, col, ref in [("seasons", "drivers_champion", "drivers"),
                          ("seasons", "runner_up", "drivers"),
                          ("seasons", "champion_team", "constructors"),
                          ("seasons", "constructors_champion", "constructors"),
                          ("season_entries", "driver_id", "drivers"),
                          ("season_entries", "constructor_id", "constructors"),
                          ("race_entries", "driver_id", "drivers"),
                          ("race_entries", "constructor_id", "constructors"),
                          ("races", "circuit_id", "circuits"),
                          ("races", "gp_id", "grands_prix"),
                          ("circuit_layouts", "circuit_id", "circuits")]:
        bad = con.execute(f"""SELECT COUNT(*) FROM {tbl} t WHERE t.{col} IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM {ref} r WHERE r.id = t.{col})""").fetchone()[0]
        check(f"{tbl}.{col} -> {ref}", bad == 0, f"{bad} orphans")


@section('COVERAGE')
def coverage():
    yrs = [r[0] for r in con.execute("SELECT year FROM seasons ORDER BY year")]
    last = last_season()
    missing = [y for y in range(1950, last + 1) if y not in yrs]
    check(f"every season 1950-{last} present", not missing, str(missing))
    # The one place the typed season and the built one are put beside each
    # other. Everything below reads season_in_progress(); this is what says
    # the constant data/current.py loaded the grid, the timetable and the
    # standings from is the same season those rows landed in (CR-07).
    current = season_in_progress()
    check("meta.current_season is the season the rows are in",
          declared_season() == current,
          f"meta says {declared_season()}, the races say {current}")
    # The two views read meta.current_season, so it has to name a season the
    # entry list actually covers. Deliberately "covers" and not "is the only
    # one": the register already carries next season's calendar, and an
    # announced grid should be an addition rather than a build failure.
    entry_years = [r[0] for r in con.execute(
        "SELECT DISTINCT year FROM season_entries ORDER BY year")]
    check("meta.current_season is a season the entry list covers",
          current in entry_years, f"entries for {entry_years}")
    # meta.coverage_seasons is derived in the same final stage, off the same
    # register. Until now nothing checked it directly - a skipped stage was
    # caught only through coverage_note, one transitive step away.
    lo, hi = con.execute("SELECT MIN(year), MAX(year) FROM seasons").fetchone()
    span = con.execute(
        "SELECT value FROM meta WHERE key = 'coverage_seasons'").fetchone()[0]
    check("meta.coverage_seasons is the span the register holds",
          span == f"{lo}-{hi}", f"meta says {span}, the register runs {lo}-{hi}")
    nochamp = [r[0] for r in con.execute(
        "SELECT year FROM seasons WHERE drivers_champion IS NULL AND year < ?",
        (current,))]
    check("every completed season has a champion", not nochamp, str(nochamp))
    nocc = [r[0] for r in con.execute(
        """SELECT year FROM seasons WHERE constructors_champion IS NULL
           AND year BETWEEN 1958 AND ?""", (current - 1,))]
    check("every season from 1958 has a constructors' champion", not nocc, str(nocc))
    pre58 = con.execute(
        "SELECT COUNT(*) FROM seasons WHERE year<1958 AND constructors_champion IS NOT NULL"
    ).fetchone()[0]
    check("no constructors' champion before 1958", pre58 == 0)


@section('CROSS-TABULATION: title counts vs season records')
def cross_tabulation_title_counts_vs_season_records():
    from_seasons = Counter(r[0] for r in con.execute(
        "SELECT drivers_champion FROM seasons WHERE drivers_champion IS NOT NULL"))
    mismatch = []
    for did, n in from_seasons.items():
        stored = con.execute("SELECT titles, full_name FROM drivers WHERE id=?", (did,)).fetchone()
        if stored["titles"] != n:
            mismatch.append(f"{stored['full_name']}: seasons say {n}, driver row says {stored['titles']}")
    check("driver title counts agree with the seasons table", not mismatch, "; ".join(mismatch))

    extra = con.execute("""SELECT full_name, titles FROM drivers WHERE titles>0
        AND id NOT IN (SELECT drivers_champion FROM seasons WHERE drivers_champion IS NOT NULL)"""
    ).fetchall()
    check("no driver claims a title with no season behind it", not extra,
          "; ".join(f"{r['full_name']} ({r['titles']})" for r in extra))

    ct = Counter(r[0] for r in con.execute(
        "SELECT constructors_champion FROM seasons WHERE constructors_champion IS NOT NULL"))
    cmis = []
    for cid, n in ct.items():
        row = con.execute("SELECT name, constructors_titles FROM constructors WHERE id=?",
                          (cid,)).fetchone()
        if row["constructors_titles"] != n:
            cmis.append(f"{row['name']}: seasons say {n}, row says {row['constructors_titles']}")
    check("constructor title counts agree with the seasons table", not cmis, "; ".join(cmis))


@section('TITLE-YEAR STRINGS')
def title_year_strings():
    bad = []
    for r in con.execute("SELECT id, full_name, titles, title_years FROM drivers WHERE titles>0"):
        yrs_listed = [int(y) for y in (r["title_years"] or "").split(",") if y.strip()]
        if len(yrs_listed) != r["titles"]:
            bad.append(f"{r['full_name']}: {r['titles']} titles, {len(yrs_listed)} years listed")
        for y in yrs_listed:
            got = con.execute("SELECT drivers_champion FROM seasons WHERE year=?", (y,)).fetchone()
            if not got or got[0] != r["id"]:
                bad.append(f"{r['full_name']} claims {y} but seasons disagree")
    check("title_years match the seasons table exactly", not bad, "; ".join(bad))


@section('DUPLICATES AND UNIQUENESS')
def duplicates_and_uniqueness():
    for tbl in ("drivers", "constructors", "circuits", "grands_prix", "personnel"):
        n = con.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
        u = con.execute(f"SELECT COUNT(DISTINCT id) FROM {tbl}").fetchone()[0]
        check(f"{tbl} ids unique", n == u, f"{n} rows, {u} ids")
    dupname = con.execute("""SELECT full_name, COUNT(*) n FROM drivers
        GROUP BY lower(full_name) HAVING n>1""").fetchall()
    warn("no duplicate driver names", not dupname,
         "; ".join(f"{r['full_name']} x{r['n']}" for r in dupname))


@section('ARITHMETIC')
def arithmetic():
    bad = con.execute("""SELECT year, champion_points, runner_up_points, margin FROM seasons
        WHERE champion_points IS NOT NULL AND runner_up_points IS NOT NULL
          AND ABS(margin - (champion_points - runner_up_points)) > 0.001""").fetchall()
    check("season margins equal champion minus runner-up", not bad,
          "; ".join(str(r["year"]) for r in bad))
    neg = con.execute("SELECT year FROM seasons WHERE margin < 0").fetchall()
    check("no champion scored fewer points than the runner-up", not neg,
          "; ".join(str(r["year"]) for r in neg))


@section('STANDINGS')
def standings():
    # Every check here is scoped to ONE classification. The table now holds the
    # standings after every round of every season back to 1950 as well as the
    # official end-of-season rows, so an unscoped query mixes 77 seasons of
    # running totals together and every position looks like a 1.
    #
    # `as_of` names the classification: 'final' for an end-of-season table,
    # 'round N' for a running one, a date for an official live snapshot. The
    # hand-entered rows are the ones with no after_round and a source of
    # formula1.com, and those are what these checks are about.
    # Scoped by SOURCE, not by shape. These checks are about the classification
    # formula1.com publishes, and F1DB now holds its own end-of-season row for
    # the same season - a correct second opinion, not a duplicate to trip over.
    OFFICIAL = ("SELECT position, points, entity_id FROM standings "
                "WHERE year=? AND table_type=? AND after_round IS NULL "
                "AND source LIKE '%formula1.com%' ORDER BY position")
    for y in recent_seasons():
        for t in ("drivers", "constructors"):
            rows = con.execute(OFFICIAL, (y, t)).fetchall()
            pos = [r[0] for r in rows]
            check(f"{y} {t} standings positions are 1..n with no gaps",
                  pos == list(range(1, len(pos) + 1)), str(pos[:5]))
            pts = [r[1] for r in rows]
            check(f"{y} {t} points are non-increasing down the order",
                  all(pts[i] >= pts[i + 1] for i in range(len(pts) - 1)))

    for y in recent_seasons():
        d = con.execute("""SELECT SUM(points) FROM standings WHERE year=?
            AND table_type='drivers' AND after_round IS NULL
            AND source LIKE '%formula1.com%'""", (y,)).fetchone()[0]
        c = con.execute("""SELECT SUM(points) FROM standings WHERE year=?
            AND table_type='constructors' AND after_round IS NULL
            AND source LIKE '%formula1.com%'""", (y,)).fetchone()[0]
        check(f"{y} driver points total equals constructor points total", d == c,
              f"drivers {d}, constructors {c}")

    # The check the whole per-round load is worth having. `seasons` holds the
    # champion, the runner-up and both their point totals for 76 of 77 seasons,
    # entered independently of F1DB. The final standings table must reproduce
    # all four, every year - which is a far stronger test than one season's.
    season_rows = con.execute("""SELECT year, drivers_champion, champion_points,
        runner_up, runner_up_points FROM seasons
        WHERE drivers_champion IS NOT NULL AND champion_points IS NOT NULL
        ORDER BY year""").fetchall()
    mismatch, compared = [], 0
    for sr in season_rows:
        top = con.execute("""SELECT entity_id, points FROM v_standings_final
            WHERE year=? AND table_type='drivers' AND position IS NOT NULL
            ORDER BY position LIMIT 2""", (sr["year"],)).fetchall()
        if len(top) < 2:
            continue
        compared += 1
        if (top[0]["entity_id"] != sr["drivers_champion"]
                or abs((top[0]["points"] or -1) - sr["champion_points"]) > 0.001):
            mismatch.append(f"{sr['year']} champion: seasons says "
                            f"{sr['drivers_champion']} on {sr['champion_points']}, "
                            f"standings says {top[0]['entity_id']} on "
                            f"{top[0]['points']}")
        elif (sr["runner_up"] and top[1]["entity_id"] != sr["runner_up"]):
            mismatch.append(f"{sr['year']} runner-up: seasons says "
                            f"{sr['runner_up']}, standings says "
                            f"{top[1]['entity_id']}")
    check("every season's champion and runner-up match the final standings",
          not mismatch, f"{compared} seasons compared"
          if not mismatch else "; ".join(mismatch[:3]))

    # v_standings_final is the answer to "who finished where" and is what the
    # exports and the pages read. Its one job is to fold two sources' rows for
    # one entity into one without folding one source's two entries; the first
    # check is that fold, the second that nothing fell out of it.
    two = con.execute("""SELECT COUNT(*) FROM (
        SELECT year, table_type, entity_id FROM v_standings_final
        GROUP BY 1, 2, 3 HAVING COUNT(DISTINCT source) > 1)""").fetchone()[0]
    check("v_standings_final shows each entity from one source", two == 0,
          f"{two} entity-seasons from two sources")
    lost = con.execute("""SELECT COUNT(*) FROM (
        SELECT DISTINCT year, table_type, entity_id FROM standings
        WHERE after_round IS NULL
        EXCEPT
        SELECT DISTINCT year, table_type, entity_id FROM v_standings_final)"""
        ).fetchone()[0]
    check("v_standings_final keeps every entity the final table holds", lost == 0,
          f"{lost} entity-seasons dropped")
    for y in recent_seasons():
        n, d = con.execute("""SELECT COUNT(*), COUNT(DISTINCT entity_id)
            FROM v_standings_final WHERE year=? AND table_type='drivers'""",
            (y,)).fetchone()
        check(f"{y} drivers' final table is one row per driver", n == d,
              f"{n} rows, {d} drivers")

    # WHICH row survives, not just how many: the one whose table has counted
    # the most rounds, and formula1.com's where both stand after the same
    # round. A front-end review flipped the view's ORDER BY on a copy and every
    # count-based check still passed while Antonelli showed 242 instead of 267.
    # The rule this replaced - "the larger total" - kept Gasly and Alpine on a
    # round-12 snapshot beside a round-14 table (AF-35), and this check passed
    # it, because it tested the rule rather than what the rule is for. So the
    # moment each row stands at is read here from as_of, independently of the
    # view's own reading of it, and a row whose moment cannot be read fails.
    last_run = dict(con.execute("SELECT year, MAX(round) FROM races GROUP BY year"))
    latest = {(y, s): n for y, s, n in con.execute(
        """SELECT year, source, MAX(after_round) FROM standings
            WHERE after_round IS NOT NULL GROUP BY year, source""")}

    def rounds_counted(year, source, as_of):
        m = re.search(r"\(after round (\d+)\)$", as_of or "")
        if m:
            return int(m.group(1))
        if as_of == "current":
            return latest.get((year, source))
        if as_of == "final":
            return last_run.get(year)
        return None

    counted, unread = {}, []
    for yr_, kind_, eid_, src_, as_of_ in con.execute(
            """SELECT DISTINCT year, table_type, entity_id, source, as_of
                 FROM standings WHERE after_round IS NULL"""):
        n_ = rounds_counted(yr_, src_, as_of_)
        if n_ is None:
            unread.append(f"{yr_} {kind_} {eid_} as_of {as_of_!r}")
        counted.setdefault((yr_, kind_, eid_), {})[src_] = n_
    check("every final standings row says which round it stands after",
          not unread, "; ".join(unread[:3]))
    stale = []
    for yr_, kind_, eid_, src_ in con.execute(
            "SELECT DISTINCT year, table_type, entity_id, source FROM v_standings_final"):
        by_src = counted.get((yr_, kind_, eid_), {})
        best = max((n for n in by_src.values() if n is not None), default=None)
        kept = by_src.get(src_)
        official = [s for s, n in by_src.items() if n == best and "formula1.com" in s]
        if best is not None and (kept != best or (official and src_ not in official)):
            stale.append(f"{yr_} {kind_} {eid_}: kept {src_} at round {kept}, "
                         f"another source stands after round {best}")
    check("v_standings_final keeps the source that has counted the most rounds",
          not stale, "; ".join(stale[:3]))
    # 'current' is read as the source's latest running table, so hold it to
    # that: a season-level file that lagged its own per-round file would make
    # the view's reading of it wrong.
    lagging = con.execute("""SELECT COUNT(*) FROM standings c
        WHERE c.after_round IS NULL AND c.as_of = 'current'
          AND NOT EXISTS (SELECT 1 FROM standings r
                WHERE r.year = c.year AND r.table_type = c.table_type
                  AND r.entity_id = c.entity_id AND r.source = c.source
                  AND r.after_round = (SELECT MAX(x.after_round) FROM standings x
                                        WHERE x.year = c.year AND x.source = c.source)
                  AND ABS(COALESCE(r.points, -1) - COALESCE(c.points, -1)) < 0.001)"""
        ).fetchone()[0]
    check("every 'current' standings row equals its source's latest round",
          lagging == 0, f"{lagging} rows differ from the source's own latest table")
    # And the fill: where either source has a position or a team, the view
    # row has it. The season being run is the one with two sources, so it is
    # the test.
    unfilled = con.execute("""SELECT COUNT(*) FROM v_standings_final f
        WHERE f.year = ? AND (f.position IS NULL OR f.team IS NULL)
          AND EXISTS (SELECT 1 FROM standings o
                      WHERE o.after_round IS NULL AND o.year = f.year
                        AND o.table_type = f.table_type AND o.entity_id = f.entity_id
                        AND ((f.position IS NULL AND o.position IS NOT NULL)
                          OR (f.team IS NULL AND o.team IS NOT NULL)))""",
        (season_in_progress(),)).fetchone()[0]
    check("v_standings_final fills position and team from the other source",
          unfilled == 0, f"{unfilled} rows left blank where a source had the value")

    # The other half of the contract. Folding two sources must not fold one
    # source's two entries: for every entity-season the view holds exactly as
    # many rows as the kept source holds in the table. A view rewritten to one
    # row per entity passes every check above and silently erases 2018 Force
    # India's excluded entry and two of Cooper's three 1960 engines; this is
    # the check that refuses it, and the two are pinned by name as well.
    folded = con.execute("""SELECT COUNT(*) FROM (
        SELECT f.year, f.table_type, f.entity_id, COUNT(*) AS in_view,
               (SELECT COUNT(*) FROM standings o
                 WHERE o.after_round IS NULL AND o.year = f.year
                   AND o.table_type = f.table_type AND o.entity_id = f.entity_id
                   AND o.source = MIN(f.source)) AS in_source
          FROM v_standings_final f
         GROUP BY f.year, f.table_type, f.entity_id
        HAVING in_view <> in_source)""").fetchone()[0]
    check("v_standings_final keeps every entry the kept source asserts",
          folded == 0, f"{folded} entity-seasons with a different row count")

    # The check that constrains the VALUE and not the rule. The fold assumes
    # the sources agree at any one round; where the official snapshot and
    # F1DB's table after the same round differ, that is a disagreement the
    # build must have filed, or a new one has arrived.
    unfiled = []
    pts_text = lambda v: str(int(v)) if float(v).is_integer() else str(v)  # noqa: E731
    for yr_, kind_, eid_, snap_, rnd_ in con.execute("""
        SELECT s.year, s.table_type, s.entity_id, s.points,
               CAST(SUBSTR(s.as_of, INSTR(s.as_of, 'after round ') + 12) AS INTEGER)
          FROM standings s
         WHERE s.after_round IS NULL AND s.as_of LIKE '%(after round %'"""):
        f1db_ = con.execute("""SELECT points FROM standings
            WHERE year=? AND table_type=? AND entity_id=? AND after_round=?
              AND source LIKE '%f1db%'""", (yr_, kind_, eid_, rnd_)).fetchone()
        if f1db_ and f1db_[0] is not None and abs(f1db_[0] - snap_) > 0.001:
            subj_ = con.execute(
                "SELECT full_name FROM drivers WHERE id=?" if kind_ == "drivers"
                else "SELECT name FROM constructors WHERE id=?", (eid_,)).fetchone()
            # Open, and about this entity: a tidying pass that marked one
            # resolved would take it off the page, and this is what says so.
            filed = con.execute("""SELECT 1 FROM discrepancies
                WHERE subject = ? AND field = ? AND stored_value = ?
                  AND derived_value = ? AND status LIKE 'open%'""",
                (subj_[0] if subj_ else eid_,
                 f"{yr_} championship points, after round {rnd_}",
                 pts_text(snap_), pts_text(f1db_[0]))).fetchone()
            if not filed:
                unfiled.append(f"{yr_} {kind_} {eid_} {snap_} v {f1db_[0]}")
    check("every points disagreement between the official snapshot and F1DB is filed",
          not unfiled, "; ".join(unfiled[:3]))
    # Its counterpart (AF-34). Drivers' disagreements that net to zero are a
    # reclassification, not a scoring difference: points moved between
    # drivers in some race. Such a set must cite one race, and that race must
    # carry the open finishing-order disagreement - otherwise the cause is
    # filed nine times over as season totals and nowhere on the race.
    uncaused = []
    groups = {}
    for field_, stored_, derived_, text_, is_driver_ in con.execute("""
            SELECT d.field, d.stored_value, d.derived_value, d.assessment,
                   EXISTS (SELECT 1 FROM drivers x WHERE x.full_name = d.subject)
              FROM discrepancies d
             WHERE d.field LIKE '____ championship points, after round %'
               AND d.status LIKE 'open%'"""):
        groups.setdefault(field_, []).append((stored_, derived_, text_, is_driver_))
    for field_, rows_ in sorted(groups.items()):
        yr_ = field_[:4]
        driver_rows = [r for r in rows_ if r[3]]
        net = sum(float(r[0]) - float(r[1]) for r in driver_rows)
        cited = {m for r in rows_
                 for m in re.findall(rf"'({yr_} round \d+)'", r[2] or "")}
        if abs(net) < 0.001 and driver_rows:
            if len(cited) != 1 or any(f"'{next(iter(cited))}'" not in (r[2] or "")
                                      for r in rows_):
                uncaused.append(f"{field_}: nets to zero and cites "
                                f"{sorted(cited) or 'no race'}")
                continue
        for race_ in cited:
            rn_ = int(race_.rsplit(" ", 1)[1])
            if rn_ > int(field_.rsplit(" ", 1)[1]) or not con.execute(
                    """SELECT 1 FROM discrepancies WHERE subject = ?
                         AND field LIKE 'finishing order%' AND status LIKE 'open%'""",
                    (race_,)).fetchone():
                uncaused.append(f"{field_}: cites {race_}, which carries no open "
                                f"finishing-order disagreement")
    check("a points disagreement caused by one race is filed on that race",
          not uncaused, "; ".join(uncaused[:3]))
    # The view is a classification: positions 1..n, points non-increasing.
    for y in recent_seasons():
        for t in ("drivers", "constructors"):
            rows = con.execute("""SELECT position, points FROM v_standings_final
                WHERE year=? AND table_type=? AND position IS NOT NULL
                ORDER BY position""", (y, t)).fetchall()
            pos = [r[0] for r in rows]
            check(f"v_standings_final {y} {t} positions are 1..n with no gaps",
                  pos == list(range(1, len(pos) + 1)), str(pos[:5]))
            pts_ = [r[1] for r in rows]
            check(f"v_standings_final {y} {t} points are non-increasing",
                  all(pts_[i] >= pts_[i + 1] for i in range(len(pts_) - 1)))
    # A season built from two sources need not balance where they disagree;
    # it is worth knowing when it does not.
    for y in recent_seasons():
        d_, c_ = (con.execute("""SELECT SUM(points) FROM v_standings_final
            WHERE year=? AND table_type=?""", (y, t)).fetchone()[0]
                  for t in ("drivers", "constructors"))
        warn(f"{y} published drivers' and constructors' totals agree",
             d_ == c_, "" if d_ == c_ else
             f"drivers {d_}, constructors {c_} - the sources disagree, see discrepancies")
    # The new unique index makes INSERT OR IGNORE able to drop a row silently;
    # the floor under standings in the_full_classification is what would say so.
    for yr_, eid_, want_ in ((2018, "force-india", 2), (1960, "cooper", 3)):
        got_ = con.execute("""SELECT COUNT(*) FROM v_standings_final
            WHERE year=? AND table_type='constructors' AND entity_id=?""",
            (yr_, eid_)).fetchone()[0]
        check(f"{yr_} {eid_} keeps its {want_} entries in the final table",
              got_ == want_, f"{got_} rows")


@section('STANDINGS ARE THE SUM OF THE RESULTS')
def standings_are_the_sum_of_the_results():
    """A running championship total is what the entrant scored in the rounds
    up to it. It is the only cross-check that can see a standings file which
    was not updated - comparing one source's table with another source's
    table cannot, and for 2026 round 14 did not: F1DB published round 13's
    constructor totals under round 14 and the site showed Mercedes on 468
    while their drivers held 503 between them.

    What this constrains, said plainly, because the honest answer is not the
    flattering one. `build.py` corrects a round that repeats the one before
    it and stops the build on any other disagreement, so a database this
    build produced cannot fail the first check here: it either agrees or the
    build never finished. Its work is against an artefact edited by hand or
    merged rather than rebuilt - which `CLAUDE.md` forbids and `ci.yml`
    compares for - and against the rule being weakened later, which the
    declaration checks below are the whole point of. The count of rows
    compared is printed rather than written down, because a figure typed into
    a docstring is one nobody re-measures.

    The floors, the six declared adjustments, the one alias and the
    multi-engine exemption are in `data/current.py`. An entity whose results
    cannot be found at all stops the build rather than being skipped: 104
    rows sat in that state under the first version of this check and could
    not have failed it however wrong they were.
    """
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools"))
    import standings_rule

    from data.current import (STANDINGS_ACCUMULATE_FROM,
                              STANDINGS_ADJUSTMENTS)

    try:
        bad = standings_rule.violations(con)
    except standings_rule.Unmappable as e:
        check("every championship table joins to the results it is the sum of",
              False, str(e))
        return
    compared = con.execute(
        """SELECT COUNT(*) FROM standings s WHERE s.after_round IS NOT NULL
             AND s.points IS NOT NULL AND s.entity_id IS NOT NULL
             AND s.year >= (CASE s.table_type WHEN 'drivers' THEN ? ELSE ? END)""",
        (STANDINGS_ACCUMULATE_FROM["drivers"],
         STANDINGS_ACCUMULATE_FROM["constructors"])).fetchone()[0]
    check("every championship table joins to the results it is the sum of", True,
          f"{compared:,} rows in the rule's scope")
    check("every championship total is the sum of what the cars scored",
          not bad,
          ("; ".join(standings_rule.describe(v) for v in bad[:4])
           + (f" (+{len(bad) - 4} more)" if len(bad) > 4 else "")) if bad else "")

    # A declaration is only worth something while it still describes
    # something. An adjustment nobody needs is a claim about this database
    # that has quietly stopped being true, and the next one is written by
    # copying it.
    # One derivation for all six: with no adjustments declared, every row an
    # adjustment exists for must appear. Six separate runs asked the same
    # question six times and cost 40 seconds of the build's gate.
    undeclared = standings_rule.violations(con, adjustments={})
    needed = {(v["table_type"], v["year"], v["entity_id"]) for v in undeclared}
    unused = [f"{t} {y} {e}" for (t, y, e) in STANDINGS_ADJUSTMENTS
              if (t, y, e) not in needed]
    check("every declared adjustment is still one", not unused, ", ".join(unused))

    # The one exemption with nothing above it to keep it honest: a
    # constructor that takes a second engine mid-season leaves the rule for
    # its whole season, and nothing would say so. Pinned to its measured size
    # so that growing it is a decision (review finding, #583).
    from data.current import STANDINGS_MULTI_ENGINE_UNCHECKED as unchecked
    seasons, rows = con.execute(
        """WITH multi AS (
             SELECT year, entity_id FROM standings
              WHERE table_type='constructors' AND after_round IS NOT NULL
              GROUP BY year, entity_id
             HAVING COUNT(DISTINCT COALESCE(engine_id, '')) > 1)
           SELECT (SELECT COUNT(*) FROM multi),
                  (SELECT COUNT(*) FROM standings s JOIN multi m
                     ON m.year = s.year AND m.entity_id = s.entity_id
                    WHERE s.table_type='constructors'
                      AND s.after_round IS NOT NULL)""").fetchone()
    check("the multi-engine exemption is the size it is declared to be",
          (seasons, rows) == (unchecked["entity_seasons"], unchecked["rows"]),
          f"{seasons} entity-seasons and {rows} rows against "
          f"{unchecked['entity_seasons']} and {unchecked['rows']} declared")

    # And the floors, the same way round: the season before each one must hold
    # a row the rule would refuse, or the floor is later than its evidence.
    for table, floor in STANDINGS_ACCUMULATE_FROM.items():
        below = standings_rule.violations(con, floors={table: 0}, adjustments={})
        earlier = [v for v in below
                   if v["table_type"] == table and v["year"] < floor]
        check(f"{table} standings are the plain sum from {floor} and not before",
              bool(earlier),
              f"nothing before {floor} disagrees, so the floor is later than "
              f"the evidence for it" if not earlier
              else f"last is {max(v['year'] for v in earlier)}")


@section('RACE RESULTS')
def race_results():
    w26 = winners_in(season_in_progress())
    # The last season in the database is the one still being run, and how many of
    # its rounds have happened is a fact that changes every other weekend. Asserting
    # a number here would mean a hand-edit stood between a harvest refresh and the
    # season moving on, so what is asserted instead is the SHAPE the season must
    # have whatever week it is: rounds are completed in order, from the first, and
    # never more of them than the calendar holds.
    # The season still being run, which is not necessarily the last one in
    # the database: a calendar announced for a season that has not started
    # has run none of its rounds and would fail every shape check below.
    CURRENT = season_in_progress()
    for y in (CURRENT - 1, CURRENT):
        got = con.execute("""SELECT COUNT(*) FROM races
            WHERE year=? AND status='completed'""", (y,)).fetchone()[0]
        scheduled = con.execute("SELECT rounds FROM seasons WHERE year=?",
                                (y,)).fetchone()[0]
        if y == CURRENT:
            check(f"{y} has run no more rounds than its calendar holds",
                  got <= scheduled, f"{got} completed of {scheduled}")
        else:
            check(f"{y} has {scheduled} completed races", got == scheduled,
                  f"got {got}")
        rounds = [r[0] for r in con.execute("""SELECT round FROM races
            WHERE year=? AND status='completed' ORDER BY round""", (y,))]
        check(f"{y} completed rounds run 1..{got} with no gaps",
              rounds == list(range(1, got + 1)))

    # The season before the one being run: complete, so its tally is a fixed
    # number, and 24 stays written out because it is the fact being checked.
    PREVIOUS = CURRENT - 1
    w25 = winners_in(PREVIOUS)
    check(f"{PREVIOUS} win tally sums to 24", sum(w25.values()) == 24)
    print(f"        {PREVIOUS} winners:", ", ".join(f"{k} {v}" for k, v in w25.most_common()))
    print(f"        {CURRENT} winners:", ", ".join(f"{k} {v}" for k, v in w26.most_common()))

    # the previous season's champion must have won at least one race that year
    c25id = con.execute("SELECT drivers_champion FROM seasons WHERE year=?",
                        (PREVIOUS,)).fetchone()[0]
    check(f"{PREVIOUS} champion appears in the {PREVIOUS} race winners", c25id in w25)


@section('HARVESTED RACE RESULTS')
def harvested_race_results():
    yrs = [r[0] for r in con.execute("SELECT DISTINCT year FROM races ORDER BY year")]
    last = last_season()
    check(f"races cover every season 1950-{last}",
          yrs == list(range(1950, last + 1)), f"{len(yrs)} seasons")

    bad = []
    for y, n in con.execute("""SELECT year, COUNT(*) FROM races
        WHERE status='completed' GROUP BY year"""):
        stored = con.execute("SELECT rounds FROM seasons WHERE year=?", (y,)).fetchone()[0]
        # A finished season must match the calendar it ran. A season still
        # being run is checked against itself — it can be short of its calendar,
        # never past it — because "how many rounds have been run by now" is not a
        # constant and does not belong in a source file. Asked of the year
        # rather than of MAX(year), so an announced calendar sitting above it
        # does not turn the season in progress into a finished one.
        unrun = con.execute("""SELECT COUNT(*) FROM races
            WHERE year = ? AND status != 'completed'""", (y,)).fetchone()[0]
        if unrun:
            expected = n if n <= stored else stored
        else:
            expected = stored
        if n != expected:
            bad.append(f"{y}: {n} completed vs {expected} rounds")
    check("completed race count per season matches the rounds recorded",
          not bad, "; ".join(bad))

    bad = []
    for y in yrs:
        rs = [r[0] for r in con.execute(
            "SELECT round FROM races WHERE year=? ORDER BY round", (y,))]
        if rs != list(range(1, len(rs) + 1)):
            bad.append(str(y))
    check("rounds are contiguous 1..n in every season", not bad, "; ".join(bad))

    orphan = con.execute("""SELECT COUNT(*) FROM races r WHERE r.status='completed'
        AND NOT EXISTS (SELECT 1 FROM race_entries e
                        WHERE e.race_id=r.id AND e.finish_position=1)""").fetchone()[0]
    check("every completed race has a winner", orphan == 0, f"{orphan} without")

    nocons = con.execute("""SELECT COUNT(*) FROM race_entries e
        WHERE e.finish_position=1 AND e.constructor_id IS NULL""").fetchone()[0]
    check("only the Indianapolis 500 winners lack a constructor", nocons == 11,
          f"{nocons} (expected 11: Indy 1950-1960)")
    indy = con.execute("""SELECT COUNT(*) FROM race_entries e JOIN races r ON r.id=e.race_id
        WHERE e.finish_position=1 AND e.constructor_id IS NULL
          AND r.gp_id='indianapolis-500'""").fetchone()[0]
    check("all constructor-less winners are Indianapolis 500s", indy == nocons)

    # Shared drives. This used to assert a count of exactly 3, which was the
    # number the winner harvest happened to record - a constant, not a property.
    # The full classification finds 42 races with a shared car, which is correct:
    # sharing was routine in the 1950s and only died out in the 1960s. So check
    # what is actually true of a shared drive instead of how many there are.
    shared_races = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
        WHERE shared_drive = 1""").fetchone()[0]
    late = con.execute("""SELECT r.year, r.name_used FROM races r
        JOIN race_entries e ON e.race_id = r.id AND e.shared_drive = 1
        WHERE r.year > 1964 GROUP BY r.id ORDER BY r.year""").fetchall()
    check("no shared drive after 1964, when the practice ended", not late,
          "; ".join(f"{r[0]} {r[1]}" for r in late))
    noplace = con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE shared_drive = 1 AND finish_position IS NULL""").fetchone()[0]
    check("every shared drive is a classified finish", noplace == 0,
          f"{noplace} with no position")
    print(f"  [info] {shared_races} races have a shared car. The two drivers are "
          f"not always both present: this register holds a few hundred of the "
          f"~780 who have started a Grand Prix, so a co-driver outside it is "
          f"skipped rather than invented")


@section('WIN TALLIES: stored figures vs figures derived from race results')
def win_tallies_stored_figures_vs_figures_derived_from_r():
    bad = []
    for r in con.execute("""SELECT id, full_name, wins FROM drivers WHERE wins IS NOT NULL"""):
        d = con.execute("""SELECT COUNT(*) FROM race_entries
            WHERE driver_id=? AND finish_position=1""", (r["id"],)).fetchone()[0]
        if r["wins"] != d:
            bad.append(f"{r['full_name']}: stored {r['wins']}, derived {d}")
    check("every driver win total equals the number of races they won", not bad,
          "; ".join(bad))

    bad = []
    for r in con.execute("""SELECT id, name, wins FROM constructors WHERE wins IS NOT NULL"""):
        d = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
            WHERE constructor_id=? AND finish_position=1""", (r["id"],)).fetchone()[0]
        if r["wins"] != d:
            bad.append(f"{r['name']}: stored {r['wins']}, derived {d}")
    check("every constructor win total equals the number of races it won", not bad,
          "; ".join(bad))

    # A race entry's constructor must have been entering races that season. This
    # check did not exist until the constructor register was extended, and its
    # absence is why Zhou Guanyu's fastest laps at Suzuka 2022 and Bahrain 2023
    # sat against Alfa Romeo - a constructor whose last entry was 1985 - for as
    # long as they did. F1DB's `alfa-romeo` covers the 1950-51 works team, the
    # 1979-85 works return, and the name Sauber raced under from 2019; this
    # register's covers only the first two.
    era = con.execute("""SELECT r.year, c.name, c.first_entry, c.last_entry,
            COUNT(*) n
        FROM race_entries e JOIN races r ON r.id = e.race_id
        JOIN constructors c ON c.id = e.constructor_id
        WHERE c.first_entry IS NOT NULL
          AND (r.year < c.first_entry
               OR (c.last_entry IS NOT NULL AND r.year > c.last_entry))
        GROUP BY r.year, c.id ORDER BY r.year""").fetchall()
    check("no entry is credited to a constructor that was not racing that season",
          not era,
          "; ".join(f"{r[0]}: {r[1]} ({r[2]}-{r[3]}) x{r[4]}" for r in era[:5]))

    # And the championship table names the same entrant the results do. The
    # two are loaded from different F1DB files through the same mapping, and
    # for 2019-2023 they disagreed: standings said `alfa-romeo`, the results
    # `sauber`, because the standings loader cached the mapping on the id
    # alone and whichever season came first answered for all of them. A
    # reader saw Alfa Romeo in the table and Sauber in the results of the
    # same season, and a join on the id found nothing (DA-28). Every row, in
    # every season and both tables, and no exceptions to declare. A row with
    # no id at all joins nothing either, so it fails here rather than being
    # passed over: the F1DB loader skips what it cannot resolve, but a
    # hand-entered row could still arrive without one (review finding, #594).
    split = con.execute("""SELECT s.year, s.table_type,
               COALESCE(s.entity_id, '(no id: ' || s.entity || ')'), COUNT(*)
        FROM standings s
        WHERE NOT EXISTS (
              SELECT 1 FROM race_entries e JOIN races r ON r.id = e.race_id
              WHERE r.year = s.year
                AND (CASE s.table_type WHEN 'drivers' THEN e.driver_id
                                       ELSE e.constructor_id END) = s.entity_id)
        GROUP BY s.year, s.table_type, s.entity_id
        ORDER BY s.year""").fetchall()
    check("every championship-table entrant has a race entry under the same id "
          "that season", not split,
          "; ".join(f"{r[0]} {r[1]} {r[2]} x{r[3]}" for r in split[:5]))

    total = con.execute("SELECT COUNT(*) FROM races WHERE status='completed'").fetchone()[0]
    credits = con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE finish_position = 1""").fetchone()[0]
    print(f"        {total} races, {credits} win credits, "
          f"{con.execute('SELECT COUNT(DISTINCT driver_id) FROM race_entries WHERE finish_position=1').fetchone()[0]}"
          " distinct winners")


@section('POLE POSITION AND FASTEST LAP')
def pole_position_and_fastest_lap():
    done = con.execute("SELECT COUNT(*) FROM races WHERE status='completed'").fetchone()[0]
    # Not a literal. Two independent definitions of "this race happened" — the
    # calendar's status, and the existence of a classification — have to agree,
    # which is a stronger statement than a number somebody remembered to update,
    # and it survives the season moving on.
    classified = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
        WHERE finish_position IS NOT NULL""").fetchone()[0]
    check("every completed race has a classification, and vice versa",
          done == classified, f"{done} completed, {classified} with results")
    # Pole and fastest lap do NOT arrive with the classification. The result
    # harvest is F1DB; pole and fastest lap are their own harvests, so a race that
    # has just been run lands here with a full finishing order and neither of
    # those two facts until the next harvest catches up. That is a lag, not a
    # defect, and it is confined to the season in progress — so the assertion is
    # that every OLDER race has them, and the current season's stragglers are
    # named in a warning rather than failing a build.
    # The season being run, not MAX(year) FROM races: the lag this warning
    # exists to tolerate is in the season being harvested, and a calendar
    # announced above it holds no completed race to straggle. Read from the
    # calendar, the window would close on the season that needs it - the next
    # current-season race to land without its pole harvest would fail the build instead
    # of being named here.
    CURRENT_YEAR = season_in_progress()

    def _missing(column):
        return [(r[0], r[1]) for r in con.execute(f"""
            SELECT r.year, r.round FROM races r WHERE r.status = 'completed'
              AND NOT EXISTS (SELECT 1 FROM race_entries e
                              WHERE e.race_id = r.id AND e.{column} = 1)
            ORDER BY r.year, r.round""")]

    nopole = _missing("pole")
    settled = [x for x in nopole if x[0] != CURRENT_YEAR]
    check("pole recorded for every completed race before the current season",
          not settled, "; ".join(f"{y} r{r}" for y, r in settled[:5]))
    warn(f"pole recorded for every {CURRENT_YEAR} race run so far",
         not [x for x in nopole if x[0] == CURRENT_YEAR],
         "; ".join(f"r{r}" for y, r in nopole if y == CURRENT_YEAR))

    # 2021 Belgium is the one settled race with no fastest lap: two laps behind
    # the safety car, no racing lap set, so there is nothing to record. It is
    # declared in known_gaps and that declaration is what this counts against.
    nofl = _missing("fastest_lap")
    settled_fl = [x for x in nofl if x[0] != CURRENT_YEAR]
    declared_gap = con.execute("""SELECT SUM(races_affected) FROM known_gaps
        WHERE field = 'fastest_lap'""").fetchone()[0]
    check("races without a fastest lap equal the declared gaps",
          len(settled_fl) == declared_gap,
          f"{len(settled_fl)} missing, {declared_gap} declared")
    check("the only settled race without a fastest lap is 2021 Belgium",
          settled_fl == [(2021, 12)], str(settled_fl))
    warn(f"fastest lap recorded for every {CURRENT_YEAR} race run so far",
         not [x for x in nofl if x[0] == CURRENT_YEAR],
         "; ".join(f"r{r}" for y, r in nofl if y == CURRENT_YEAR))

    orph = con.execute("""SELECT COUNT(*) FROM race_entries e
        WHERE NOT EXISTS (SELECT 1 FROM drivers d WHERE d.id = e.driver_id)""").fetchone()[0]
    check("every entry resolves to a driver", orph == 0, f"{orph} orphans")
    orph = con.execute("""SELECT COUNT(*) FROM race_entries e
        WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.id = e.race_id)""").fetchone()[0]
    check("every entry resolves to a race", orph == 0, f"{orph} orphans")
    orph = con.execute("""SELECT COUNT(*) FROM races r
        WHERE NOT EXISTS (SELECT 1 FROM grands_prix g WHERE g.id = r.gp_id)""").fetchone()[0]
    check("every race resolves to a grand prix", orph == 0, f"{orph} orphans")
    orph = con.execute("""SELECT COUNT(*) FROM races r WHERE r.circuit_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM circuits c WHERE c.id = r.circuit_id)""").fetchone()[0]
    check("every race circuit resolves", orph == 0, f"{orph} orphans")

    dup = con.execute("""SELECT race_id, driver_id, COUNT(*) n FROM race_entries
        GROUP BY 1,2 HAVING n > 1""").fetchall()
    check("a driver appears at most once per race", not dup, f"{len(dup)} duplicates")

    multi = con.execute("""SELECT race_id, COUNT(*) n FROM race_entries
        WHERE pole = 1 GROUP BY race_id HAVING n > 1""").fetchall()
    check("no race has two drivers on pole", not multi, f"{len(multi)} races")
    front = con.execute("""SELECT race_id, COUNT(*) n FROM race_entries
        WHERE grid = 1 GROUP BY race_id HAVING n > 1""").fetchall()
    check("no race has two cars at grid 1", not front, f"{len(front)} races")

    # race_results.pole_id is a VIEW over race_entries.pole = 1, so a completed
    # race with no credited pole has no pole at all -- not a blank waiting to be
    # filled but a race the site publishes with the field empty, which every
    # pole cross-check silently skips. The pole harvest is hand-written and lags
    # F1DB by about a week after each Grand Prix; build.py credits F1DB's grid 1
    # into that vacancy, and this is the check that it did.
    nopole = con.execute("""SELECT r.year, r.round FROM races r
        WHERE r.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM race_entries e
                          WHERE e.race_id = r.id AND e.pole = 1)
        ORDER BY r.year, r.round""").fetchall()
    check("every completed race has a credited pole-sitter",
          not nopole, "; ".join(f"{y} r{r}" for y, r in nopole[:5]))

    # Pole and grid 1 are two columns because they are two facts, and they name
    # different drivers in exactly three completed races, each for a reason the
    # schema states: 1996 r9 and 2021 r5, where the pole-sitter never started
    # and grid 1 stayed empty; and 2022 r21, a sprint weekend where the season
    # record credits the fastest qualifier while the sprint winner started
    # first. Pinned so that a fourth arrives as a question.
    nogrid = [tuple(r) for r in con.execute("""SELECT r.year, r.round FROM races r
        WHERE r.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM race_entries e
                          WHERE e.race_id = r.id AND e.grid = 1)
        ORDER BY r.year, r.round""")]
    check("grid 1 is empty only where the pole-sitter did not start",
          nogrid == [(1996, 9), (2021, 5)],
          "; ".join(f"{y} r{r}" for y, r in nogrid[:5]))
    apart = [tuple(r) for r in con.execute("""SELECT r.year, r.round FROM races r
        JOIN race_entries e ON e.race_id = r.id AND e.pole = 1
        WHERE e.grid IS NOT NULL AND e.grid != 1
        ORDER BY r.year, r.round""")]
    check("the credited pole-sitter started elsewhere only in the one known race",
          apart == [(2022, 21)], "; ".join(f"{y} r{r}" for y, r in apart[:5]))
    # `apart` skips a NULL grid, which is what lets those two through - so a
    # pole-sitter with no grid at all, in a race where someone else holds
    # grid 1, would slip both checks. Pinned to the same two races.
    nullgrid = [tuple(r) for r in con.execute("""SELECT r.year, r.round FROM races r
        JOIN race_entries e ON e.race_id = r.id AND e.pole = 1
        WHERE e.grid IS NULL ORDER BY r.year, r.round""")]
    check("the pole-sitter has no grid slot only where they did not start",
          nullgrid == [(1996, 9), (2021, 5)],
          "; ".join(f"{y} r{r}" for y, r in nullgrid[:5]))

    # A pole the build credited from F1DB's grid 1 because the hand-written
    # harvest had not reached the race yet: a pole in a race harvest/poles.txt
    # has no row for. The count is printed, and one outside the current
    # season fails, so the harvest still has to catch up rather than the gap
    # filling itself for good.
    # Races the harvest actually credits a pole for: a row with '?' in the
    # pole field is in the file and credits nobody, and would otherwise hide
    # an inferred pole in plain sight.
    harvested = {(h["year"], h["round"]) for h in harvest_module().load_poles() if h["pole"]}
    inferred = [tuple(r) for r in con.execute("""SELECT r.year, r.round FROM races r
        JOIN race_entries e ON e.race_id = r.id AND e.pole = 1
        ORDER BY r.year, r.round""") if tuple(r) not in harvested]
    current = season_in_progress()
    settled_inferred = [x for x in inferred if x[0] != current]
    check("a pole credited from grid 1 rather than the season record is only ever in the current season",
          not settled_inferred, "; ".join(f"{y} r{r}" for y, r in settled_inferred[:5]))
    warn("every pole comes from the season record",
         not inferred,
         f"{len(inferred)} credited from F1DB's grid 1 awaiting the harvest: "
         + "; ".join(f"{y} r{r}" for y, r in inferred[:5]))

    # The 13 races where the credited pole-sitter was not the fastest qualifier.
    # Every one is a penalty or a grid set by a sprint, and both columns are
    # true of what they describe; the race page shows both. Not a disagreement
    # between sources, so not in `discrepancies` -- the count is pinned here
    # instead, so a fourteenth arrives as a question rather than as noise.
    split = con.execute("""SELECT COUNT(*) FROM (
        SELECT r.id FROM races r
         WHERE r.status = 'completed'
           AND (SELECT e.driver_id FROM race_entries e
                 WHERE e.race_id = r.id AND e.pole = 1) IS NOT NULL
           AND (SELECT q.driver_id FROM qualifying q
                 WHERE q.race_id = r.id AND q.position = 1) IS NOT NULL
           AND (SELECT e.driver_id FROM race_entries e
                 WHERE e.race_id = r.id AND e.pole = 1)
            != (SELECT q.driver_id FROM qualifying q
                 WHERE q.race_id = r.id AND q.position = 1))""").fetchone()[0]
    check("pole and the fastest qualifier part company only where they should",
          split == 13, f"{split} races (13 known: penalties and sprint-set grids)")

    multi = con.execute("""SELECT race_id, COUNT(*) n FROM race_entries
        WHERE finish_position = 1 GROUP BY race_id HAVING n > 1""").fetchall()
    bad = [m for m in multi if con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE race_id=? AND finish_position=1 AND shared_drive=0""",
        (m[0],)).fetchone()[0] > 1]
    check("a race has one winner, unless the drive was shared", not bad, f"{len(bad)} races")
    check("the shared drives are the three known ones", len(multi) == 3, f"{len(multi)}")

    # Six from the season tables, and two the tables rendered as one name until
    # the race articles were read: 1960 Belgium (three drivers) and 1969 Canada
    # (two). See SHARED_FASTEST_LAPS in data/harvest.py.
    shared = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
        WHERE fastest_lap = 1 AND fastest_lap_shared > 1""").fetchone()[0]
    check("shared fastest laps are recorded as such", shared == 8, f"{shared} races")

    # the name a race carried must be a known name for the event it points at
    bad = []
    import sys as _s; _s.path.insert(0, os.path.dirname(DB))
    from data import events as _EV
    _m = _EV.name_to_id()
    for r in con.execute("SELECT year, round, name_used, gp_id FROM races"):
        if _m.get(r["name_used"]) != r["gp_id"]:
            bad.append(f"{r['year']} r{r['round']} {r['name_used']}")
    check("every race name resolves to the event it is linked to", not bad,
          "; ".join(bad[:5]))

    # Every declared gap's count must still be the count. A gap that has been
    # filled is marked closed and kept on the record, never removed.
    stale = []
    for g in con.execute("SELECT field, area, races_affected FROM known_gaps"):
        if g["races_affected"] is None or g["races_affected"] == 0:
            continue
        actual = con.execute(
            f"SELECT COUNT(*) FROM races WHERE {g['field']} IS NULL").fetchone()[0] \
            if g["field"] in ("circuit_id", "dates") else None
        if actual is not None and actual != g["races_affected"]:
            stale.append(f"{g['field']}: declared {g['races_affected']}, actual {actual}")
    check("declared gaps match the actual gaps", not stale, "; ".join(stale))

    # The register carries three states and the site counts one of them. Every
    # row must say which it is in and give a reader the one-paragraph version;
    # a closed row must say when it closed - a version or a pull request - so
    # the closure is on the record rather than the row quietly gone. The
    # homepage, /data and the README's open-gaps figure all read v_open_gaps,
    # so the view is checked against the table it filters, and the README span
    # that states the figure is checked against the same count in
    # readme_figures() below.
    gaps_ = con.execute("SELECT id, state, reader, resolution FROM known_gaps").fetchall()
    bad = [str(g["id"]) for g in gaps_ if not (g["reader"] or "").strip()]
    check("every known gap has a reader sentence", not bad, ", ".join(f"#{b}" for b in bad))
    bad = [str(g["id"]) for g in gaps_ if g["state"] == "closed"
           and not re.search(r"\bv\d+\.\d+\b|#\d+", g["resolution"] or "")]
    check("every closed gap's resolution says which version or PR closed it",
          not bad, ", ".join(f"#{b}" for b in bad))
    # The four tables the redistribution gate keeps empty cannot be open gaps:
    # an absence by decision is a position. Pins the classification to the
    # rule that makes it, rather than to a count.
    fom = ("laps", "stints", "race_timing", "race_control_messages")
    bad = [f"#{g['id']} {g['field']}" for g in con.execute(
        "SELECT id, field, state FROM known_gaps") if g["field"] in fom and g["state"] != "position"]
    check("a gap about a table kept empty by licence is filed as a position, not as open",
          not bad, ", ".join(bad))
    # The closed rows must be closed in the data too: the thing each says was
    # missing is present. Two are closed today, and each has its own test.
    fl_missing = con.execute("""SELECT COUNT(*) FROM races r WHERE r.status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM race_entries e WHERE e.race_id = r.id AND e.fastest_lap = 1)
        AND NOT (r.year = 2021 AND r.round = 12)""").fetchone()[0]
    no_entries = con.execute("""SELECT COUNT(*) FROM races r WHERE r.status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM race_entries e WHERE e.race_id = r.id)""").fetchone()[0]
    # Pinned to the two fields tested above: a third row marked closed without
    # a test of its own fails here, which is the point.
    closed_fields = {r[0] for r in con.execute("SELECT field FROM known_gaps WHERE state = 'closed'")}
    check("the closed gaps are closed in the data: fastest laps and entries cover every completed race",
          fl_missing == 0 and no_entries == 0 and closed_fields <= {"fastest_lap", "finish_position"},
          f"{fl_missing} races without a fastest lap, {no_entries} without entries; closed: {sorted(closed_fields)}")
    # The ids are written in data/harvest.py, not counted from the list
    # (PM-30): they must be 1..N with no gap or repeat, and every
    # `known_gaps #N` written anywhere in the tree - code, schema, docs, the
    # site - must name a row that exists. A citation that names the wrong
    # existing row is still a human's to catch; a citation of a row that is
    # not there is not.
    _ids = [r[0] for r in con.execute("SELECT id FROM known_gaps ORDER BY id")]
    check("known_gaps ids are 1..N, written and contiguous",
          _ids == list(range(1, len(_ids) + 1)), ", ".join(map(str, _ids)))
    _here = os.path.dirname(os.path.abspath(__file__))
    _cited = {}
    for root, dirs, files in os.walk(_here):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "dist", ".f1dbcache", "__pycache__")]
        for fn in files:
            if not fn.endswith((".py", ".sql", ".md", ".js", ".jsx", ".mjs", ".yml", ".txt")):
                continue
            path = os.path.join(root, fn)
            try:
                with open(path, encoding="utf-8") as fh:
                    text = fh.read()
            except (UnicodeDecodeError, OSError):
                continue
            for m in re.finditer(r"known_gaps\s*#(\d+)", text):
                _cited.setdefault(int(m.group(1)), set()).add(os.path.relpath(path, _here))
    _dangling = {n: files for n, files in _cited.items() if n not in set(_ids)}
    check("every known_gaps #N cited in the tree names a row that exists",
          not _dangling, "; ".join(f"#{n} in {', '.join(sorted(f))}" for n, f in sorted(_dangling.items())))
    print(f"  [info] known_gaps cited by number in {sum(len(f) for f in _cited.values())} places across the tree")
    open_ = con.execute("SELECT COUNT(*) FROM v_open_gaps").fetchone()[0]
    print(f"  [info] known_gaps: {open_} open, "
          + ", ".join(f"{n} {s}" for s, n in con.execute(
              "SELECT state, COUNT(*) FROM known_gaps WHERE state != 'open' GROUP BY state"))
          + f", {len(gaps_)} rows; the README's open figure is checked in readme_figures()")


@section('STRUCTURE')
def structure():
    u = con.execute("""SELECT COUNT(*) FROM (SELECT year, round FROM races
        GROUP BY year, round HAVING COUNT(*) > 1)""").fetchone()[0]
    check("(year, round) is unique across races", u == 0, f"{u} duplicates")
    bad = con.execute("""SELECT COUNT(*) FROM constructors c
        WHERE c.lineage_chain IS NOT NULL AND NOT EXISTS
          (SELECT 1 FROM constructor_lineage l WHERE l.chain_id = c.lineage_chain)"""
    ).fetchone()[0]
    check("every constructor resolves to a lineage chain", bad == 0, f"{bad} dangling")
    bad = con.execute("""SELECT COUNT(*) FROM seasons s WHERE s.champion_wins IS NOT NULL
      AND s.champion_wins != (SELECT COUNT(*) FROM race_entries e JOIN races r
          ON r.id = e.race_id WHERE r.year = s.year AND e.finish_position = 1
          AND e.driver_id = s.drivers_champion)""").fetchone()[0]
    check("champion_wins matches the race records in every season", bad == 0,
          f"{bad} seasons")


@section('IDENTIFIER STABILITY')
def identifier_stability():
    """Which ids a reader may keep (DA-04). The policy is declared in
    data/current.py and published in `meta`; this checks it against the
    database it describes. A published natural key that does not identify one
    row is worse than none at all — a reader joining on it silently doubles
    their rows instead of failing."""
    import build
    from data import current as _N

    surrogate = build.surrogate_id_tables(con)
    undeclared = sorted(surrogate - set(_N.ID_STABILITY))
    check("every surrogate id is classified stable or unstable", not undeclared,
          f"{', '.join(undeclared)} not in ID_STABILITY" if undeclared
          else f"{len(surrogate)} tables")

    # The artefact's own claim, against the declaration it was built from: a
    # database whose meta named a table the policy no longer does would be
    # promising stability on nobody's behalf.
    declared = ", ".join(sorted(t for t, (s, _k) in _N.ID_STABILITY.items()
                                if s == "stable"))
    published = value_or_none("id_stability_stable")
    check("meta.id_stability_stable names exactly the tables declared stable",
          published == declared,
          "" if published == declared else
          f"meta says {published!r}, ID_STABILITY says {declared!r}")

    keys = {t: k for t, (_s, k) in _N.ID_STABILITY.items() if k}
    declared_keys = "; ".join(f"{t}({', '.join(keys[t])})" for t in sorted(keys))
    published_keys = value_or_none("id_stability_keys")
    check("meta.id_stability_keys publishes every declared natural key",
          published_keys == declared_keys,
          "" if published_keys == declared_keys else
          f"meta says {published_keys!r}, ID_STABILITY says {declared_keys!r}")

    check("meta.id_stability states the policy",
          value_or_none("id_stability") == _N.ID_STABILITY_NOTE)

    # GROUP BY treats two NULLs as one group, which is the comparison a reader
    # joining on a key with a nullable column in SQLite would have to make;
    # `=` would not, so this is the stricter of the two readings.
    for table in sorted(keys):
        cols = ", ".join(keys[table])
        dup = con.execute(f"""SELECT COUNT(*) FROM (SELECT {cols} FROM {table}
            GROUP BY {cols} HAVING COUNT(*) > 1)""").fetchone()[0]
        check(f"{table} natural key ({cols}) identifies one row", dup == 0,
              "" if not dup else f"{dup} key(s) on more than one row")


@section('EXTERNAL FIGURES VS THE RACE RECORDS')
def external_figures_vs_the_race_records():
    bad = con.execute("""SELECT COUNT(*) FROM discrepancies
        WHERE status = 'undeclared'""").fetchone()[0]
    check("every external-vs-derived difference is accounted for", bad == 0,
          f"{bad} undeclared")

    # wins, poles and fastest laps must equal what the race records say, for
    # every driver, without exception - they are derived from them
    derived = {r["driver_id"]: (r["w"], r["p"], r["f"]) for r in con.execute("""
        SELECT driver_id,
               SUM(CASE WHEN finish_position = 1 THEN 1 ELSE 0 END) AS w,
               SUM(CASE WHEN pole = 1 THEN 1 ELSE 0 END) AS p,
               SUM(fastest_lap) AS f
        FROM race_entries GROUP BY driver_id""")}
    bad = []
    for r in con.execute("SELECT id, full_name, wins, poles, fastest_laps FROM drivers"):
        w, p, f = derived.get(r["id"], (0, 0, 0))
        if (r["wins"], r["poles"], r["fastest_laps"]) != (w, p, f):
            bad.append(f"{r['full_name']} ({r['wins']},{r['poles']},{r['fastest_laps']}"
                       f" vs {w},{p},{f})")
    check("every driver's wins, poles and fastest laps equal the race records",
          not bad, "; ".join(bad[:6]))

    n = con.execute("SELECT COUNT(*) FROM drivers WHERE wins_external IS NOT NULL").fetchone()[0]
    d = con.execute("SELECT COUNT(*) FROM discrepancies").fetchone()[0]
    print(f"        {n} drivers compared on three fields; {d} differences, all accounted for")

    openn = con.execute("SELECT COUNT(*) FROM discrepancies WHERE status LIKE 'open%'").fetchone()[0]
    warn("no open discrepancies awaiting an official check", openn == 0,
         f"{openn} open - see the discrepancies table")

    # `subject` is free text, and the front end joins on it: a race page asks for
    # the subject 'YYYY round N' it builds from its own year and round, a driver
    # page for the driver's full_name. Those queries fail SAFE - a subject whose
    # shape changed yields no rows rather than wrong ones - and that is exactly
    # the problem, because the disagreement would simply stop being shown and
    # nothing would say so. This is the check that makes the quiet join safe to
    # rely on: a subject that names no race, or no driver, is refused here.
    unresolved = []
    for did, subject in con.execute(
            "SELECT id, subject FROM discrepancies WHERE status LIKE 'open%' "
            "OR status LIKE 'explained - each side%'"):
        m = re.fullmatch(r"(\d{4}) round (\d+)", subject or "")
        if m:
            if not con.execute("SELECT 1 FROM races WHERE year=? AND round=?",
                               (int(m.group(1)), int(m.group(2)))).fetchone():
                unresolved.append(f"#{did} '{subject}' names no race")
        elif con.execute("SELECT 1 FROM drivers WHERE full_name=?",
                         (subject,)).fetchone():
            pass
        elif con.execute("SELECT 1 FROM constructors WHERE name=?",
                         (subject,)).fetchone():
            pass
        else:
            unresolved.append(f"#{did} '{subject}' joins to nothing a reader can reach")
    check("every recorded disagreement the site shows can be shown beside the fact it is about",
          not unresolved, "; ".join(unresolved[:4]))

    # spot-check a sample of headline career records against the known official figures
    KNOWN = {"Sir Lewis Hamilton": (106, 104, 69), "Michael Schumacher": (91, 68, 77),
             "Ayrton Senna": (41, 65, 19), "Alain Prost": (51, 33, 41),
             "Juan Manuel Fangio": (24, 29, 23), "Jim Clark": (25, 33, 28),
             "Sebastian Vettel": (53, 57, 38), "Max Verstappen": (71, 48, 37),
             "Nigel Mansell": (31, 32, 30), "Sir Jackie Stewart": (27, 17, 15)}
    bad = []
    for name, (w, p, f) in KNOWN.items():
        r = con.execute("""SELECT wins, poles, fastest_laps FROM drivers
            WHERE full_name = ?""", (name,)).fetchone()
        if r is None or tuple(r) != (w, p, f):
            bad.append(f"{name}: expected {(w, p, f)}, got {tuple(r) if r else None}")
    check("headline career records match the known official figures", not bad,
          "; ".join(bad))

    slams = con.execute("SELECT COUNT(*) FROM v_grand_slams").fetchone()[0]
    check("grand slams (pole + win + fastest lap) found", slams > 100, f"{slams}")


@section('RECORDS ARE DERIVED, AND RECOMPUTED HERE BY ANOTHER ROUTE')
def records_are_derived():
    # Thirty authored rows sat here at 'medium' with nothing reading them, and
    # one said Hamilton had 105 wins beside a drivers.wins of 106. Every row is
    # now derived in build.py; this section is what makes that claim checkable.
    # Each recomputation below deliberately takes a DIFFERENT route from the
    # build's - the race_results view instead of race_entries, the stored
    # drivers.titles column instead of a count over seasons, seasons.margin
    # instead of the standings - because re-running the same query would only
    # prove SQLite is deterministic.
    rows = {r["key"]: r for r in con.execute("SELECT * FROM records")}
    FLOOR = 29   # the number shipped at v2.23; a derivation that silently drops one fails here
    check(f"the records table holds at least {FLOOR} derived rows", len(rows) >= FLOOR,
          f"{len(rows)}")

    as_of = con.execute(
        "SELECT MAX(date_iso) FROM races WHERE status = 'completed'").fetchone()[0]
    stale = [k for k, r in rows.items() if r["as_of"] != as_of]
    check("every record is as of the last completed race the database holds",
          not stale, f"coverage ends {as_of}; " + ", ".join(stale[:4]))

    off_ladder = con.execute("""SELECT COUNT(*) FROM records
        WHERE confidence NOT IN (SELECT confidence FROM provenance)""").fetchone()[0]
    check("no record carries a confidence outside the ladder", off_ladder == 0)
    above = con.execute("""SELECT COUNT(*) FROM records r JOIN provenance p ON p.confidence = r.confidence
        WHERE p.rank < (SELECT rank FROM provenance WHERE confidence = 'reference')""").fetchone()[0]
    check("no record outranks the race records it is computed from", above == 0,
          f"{above} above 'reference'")

    # A tie holds every holder and names none as THE holder; a single holder is
    # always keyed. holder_id must be a row in the table it says it is.
    mis = [k for k, r in rows.items()
           if (r["holder_id"] is None) != (", " in r["holder"])]
    check("holder_id is NULL exactly when the record is shared", not mis, ", ".join(mis))
    dangling = []
    for k, r in rows.items():
        if r["holder_id"] is not None and not con.execute(
                f'SELECT 1 FROM "{r["holder_table"]}" WHERE id = ?', (r["holder_id"],)).fetchone():
            dangling.append(f"{k} -> {r['holder_table']}.{r['holder_id']}")
    check("every holder_id is a row in its holder_table", not dangling, "; ".join(dangling))

    def same(key, derived_value, derived_holder=None, what=""):
        r = rows.get(key)
        if r is None:
            check(f"records.{key} is present", False, "no such key")
            return
        ok = abs(r["value_num"] - derived_value) < 1e-9
        detail = f"stored {r['value_num']:g}, recomputed {derived_value:g}"
        if derived_holder is not None:
            ok = ok and r["holder_id"] == derived_holder
            detail += f"; holder {r['holder_id']} vs {derived_holder}"
        check(f"records.{key} agrees with {what}", ok, detail)

    # 1. Most wins, via the race_results view (winner and co-winner columns).
    w = con.execute("""SELECT d, COUNT(*) n FROM (
            SELECT winner_id d FROM race_results WHERE winner_id IS NOT NULL
            UNION ALL SELECT co_winner_id FROM race_results WHERE co_winner_id IS NOT NULL)
        GROUP BY d ORDER BY n DESC LIMIT 1""").fetchone()
    same("most-wins", w["n"], w["d"], "the race_results view")

    # 2/3. Most titles, via the stored per-driver and per-constructor columns.
    t = con.execute("SELECT MAX(titles) m FROM drivers").fetchone()["m"]
    holders = sorted(r[0] for r in con.execute(
        "SELECT full_name FROM drivers WHERE titles = ?", (t,)))
    r = rows.get("most-drivers-titles")
    check("records.most-drivers-titles agrees with drivers.titles",
          r is not None and r["value_num"] == t
          and sorted(r["holder"].split(", ")) == holders,
          f"{t}: {', '.join(holders)}")
    ct = con.execute("""SELECT id, constructors_titles FROM constructors
        ORDER BY constructors_titles DESC LIMIT 1""").fetchone()
    same("most-constructors-titles", ct["constructors_titles"], ct["id"],
         "constructors.constructors_titles")

    # 4. Most wins in a season, via race_results grouped by year.
    # WHERE winner_id IS NOT NULL: race_results carries a row for a race that
    # has not been run, so without it a calendar long enough - 24 announced
    # rounds - wins this ordering as a season of NULLs.
    sw = con.execute("""SELECT winner_id, year, COUNT(*) n FROM race_results
        WHERE winner_id IS NOT NULL
        GROUP BY year, winner_id ORDER BY n DESC LIMIT 1""").fetchone()
    same("most-wins-in-a-season", sw["n"], sw["winner_id"], "race_results by season")

    # 5. Closest title margin, via the stored seasons.margin column.
    m = con.execute("""SELECT year, margin, drivers_champion FROM seasons
        WHERE margin IS NOT NULL ORDER BY margin LIMIT 1""").fetchone()
    same("closest-championship-margin", m["margin"], m["drivers_champion"], "seasons.margin")

    # 6. Consecutive constructors' titles, as a gaps-and-islands query.
    run = con.execute("""SELECT constructors_champion c, COUNT(*) n FROM (
            SELECT year, constructors_champion,
                   year - ROW_NUMBER() OVER (PARTITION BY constructors_champion ORDER BY year) grp
              FROM seasons WHERE constructors_champion IS NOT NULL)
        GROUP BY c, grp ORDER BY n DESC LIMIT 1""").fetchone()
    same("most-consecutive-constructors-titles", run["n"], run["c"], "a window query over seasons")

    # 7. Fewest classified, counting numeric position_text rather than the flag.
    fc = con.execute("""SELECT race_id, SUM(position_text GLOB '[0-9]*') n FROM race_entries
        GROUP BY race_id ORDER BY n LIMIT 1""").fetchone()
    same("fewest-classified-finishers", fc["n"], str(fc["race_id"]), "position_text")

    # 8. Lowest grid for a winner, through race_results.winner_id.
    g = con.execute("""SELECT rr.winner_id, e.grid FROM race_results rr
        JOIN races r ON r.year = rr.year AND r.round = rr.round
        JOIN race_entries e ON e.race_id = r.id AND e.driver_id = rr.winner_id
        WHERE e.grid IS NOT NULL ORDER BY e.grid DESC LIMIT 1""").fetchone()
    same("lowest-grid-position-for-a-winner", g["grid"], g["winner_id"], "race_results and the grid")

    # 9. Longest circuit, from circuits alone (the build also reads the layouts).
    c = con.execute("""SELECT id, length_km FROM circuits WHERE gp_count > 0
        ORDER BY length_km DESC LIMIT 1""").fetchone()
    same("longest-circuit", c["length_km"], c["id"], "circuits.length_km")

    # 10. The win-rate floor the detail states is the one that was applied.
    r = rows.get("highest-win-rate")
    if r:
        m_ = re.search(r"at least (\d+) entries", r["detail"])
        floor = int(m_.group(1)) if m_ else None
        best = con.execute("""SELECT d.id, ROUND(100.0 * d.wins / COUNT(*), 2) pct
            FROM race_entries e JOIN drivers d ON d.id = e.driver_id
            GROUP BY d.id HAVING COUNT(*) >= ? ORDER BY pct DESC LIMIT 1""",
            (floor or 0,)).fetchone()
        check("records.highest-win-rate applies the floor its detail states",
              floor is not None and best["id"] == r["holder_id"]
              and abs(best["pct"] - r["value_num"]) < 1e-9,
              f"floor {floor}, {best['id']} at {best['pct']}")

    dist = con.execute("""SELECT category, COUNT(*) n FROM records
        GROUP BY category ORDER BY category""").fetchall()
    print("        " + ", ".join(f"{d['category']}={d['n']}" for d in dist)
          + f"; as of {as_of}")


@section('CALENDAR')
def calendar():
    # The year comes from the data; the shape of the season - 23 rounds, six
    # sprints - stays written out, because that is the fact being checked and
    # a new season has to be read off a source and re-typed, not inherited.
    CURRENT = season_in_progress()
    w26 = winners_in(CURRENT)
    rounds = [r[0] for r in con.execute(
        "SELECT round FROM races WHERE year=? ORDER BY round", (CURRENT,))]
    check(f"{CURRENT} calendar rounds are 1..23", rounds == list(range(1, 24)))
    sprints = con.execute(
        "SELECT COUNT(*) FROM races WHERE year=? AND sprint=1",
        (CURRENT,)).fetchone()[0]
    check(f"{CURRENT} has six sprint events", sprints == 6, f"got {sprints}")
    completed = con.execute("""SELECT COUNT(*) FROM races
        WHERE year=? AND status='completed'""", (CURRENT,)).fetchone()[0]
    check(f"completed {CURRENT} rounds match the recorded results",
          completed == sum(w26.values()),
          f"completed {completed}, results {sum(w26.values())}")

    for y in recent_seasons():
        cw = con.execute("SELECT drivers_champion, champion_wins FROM seasons WHERE year=?",
                         (y,)).fetchone()
        if cw["drivers_champion"] and cw["champion_wins"] is not None:
            actual = con.execute("""SELECT COUNT(*) FROM race_entries e
                JOIN races r ON r.id=e.race_id
                WHERE r.year=? AND e.driver_id=? AND e.finish_position=1""",
                (y, cw["drivers_champion"])).fetchone()[0]
            check(f"{y} champion_wins matches the race records",
                  cw["champion_wins"] == actual, f"stored {cw['champion_wins']}, counted {actual}")
    nocirc = con.execute(
        "SELECT COUNT(*) FROM races WHERE year=? AND circuit_id IS NULL",
        (CURRENT,)).fetchone()[0]
    check(f"every {CURRENT} round maps to a circuit", nocirc == 0, f"{nocirc} unmapped")

    # A race that has been run happened on a day, and until v2.18 this
    # database could not say which for 1,149 of them: F1DB publishes a date
    # for every race back to 1950-05-13, but it lives in the round's own
    # race.yml and the results loader only ever read race-results.yml beside
    # it. Every race page showed "Dates -" and the SportsEvent JSON-LD could
    # not emit startDate, which is the one field a search engine most wants
    # from an event.
    #
    # Checked against having a WINNER rather than status='completed',
    # because that is the same definition the fastest-lap check above uses
    # and it cannot be satisfied by a status field alone.
    undated = con.execute("""SELECT COUNT(*) FROM races r
        WHERE (r.dates IS NULL OR TRIM(r.dates) = '')
          AND EXISTS (SELECT 1 FROM race_entries e
                      WHERE e.race_id = r.id AND e.finish_position = 1)""").fetchone()[0]
    check("every completed race has a date", undated == 0,
          f"{undated} completed races carry none")

    # date_iso is the machine-readable half of the pair and is set for every
    # race F1DB knows, run or not - which is the point of splitting it from
    # `dates`. A scheduled race is exactly where a search engine wants a
    # startDate, and those are the 23 whose display value is a weekend range
    # that no parser can read.
    noiso = con.execute(
        "SELECT COUNT(*) FROM races WHERE date_iso IS NULL").fetchone()[0]
    check("every race has an ISO date", noiso == 0, f"{noiso} carry none")

    badiso = con.execute("""SELECT COUNT(*) FROM races
        WHERE date_iso IS NOT NULL
          AND date_iso NOT GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'""").fetchone()[0]
    check("every ISO race date is a well-formed day", badiso == 0,
          f"{badiso} malformed")

    # The two columns may differ in SHAPE but never in FACT. Where `dates`
    # is itself an ISO day, it is the same day date_iso holds; a divergence
    # would mean the display and the structured data disagree about when a
    # race happened, which is worse than either being absent.
    disagree = con.execute("""SELECT COUNT(*) FROM races
        WHERE dates GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'
          AND dates <> date_iso""").fetchone()[0]
    check("the display date and the ISO date never disagree", disagree == 0,
          f"{disagree} disagree")

    # `note` is the standfirst of a race's page and part of its meta
    # description (CD-03), which is the job drivers.notes does on a driver's,
    # so it is held to the driver's rule: a figure the page derives - its
    # entry count, the classified count beside it, the count on every section
    # heading - belongs to the strip of tiles under the lede, where it is
    # recomputed from the records every build and cannot go stale. Amon's note
    # said 96 starts beside a strip that counted 108 (CD-21, CD-23), and
    # nothing applied that rule to the largest page type until now (AF-63).
    # The pattern is tools/lede_figures.py, the one compiled expression the
    # driver check reads, proved by tests/test_lede_figures.py on both of CI's
    # interpreters; the subset-figure machinery beside it totals a career and
    # has no subset to count here. It is a driver's vocabulary applied to race
    # prose, so it is the conservative way round, and wider than a race page's
    # own figures on two axes: "races" is one of its nouns, so "one of three
    # races held at Sebring" is caught; and it allows two words between the
    # number and the noun, which on a driver note always describes the driver
    # and on a race note need not - "six drivers scored points" is caught as
    # "six drivers scored points". Both fail loudly at build time and both
    # cost a rewording, which is the right way for this to be wrong.
    _rfigure = _lede_figures().FIGURE
    _rtyped = [f"{r[1]} r{r[2]} ({_m.group(0)})" for r in con.execute(
        "SELECT id, year, round, note FROM races WHERE note IS NOT NULL ORDER BY id")
        if (_m := _rfigure.search(r[3]))]
    check("no race note states a figure the page derives",
          not _rtyped, "; ".join(_rtyped[:6]))


@section('ENTRIES')
def entries():
    # Same rule as CALENDAR: the year is read, 22 seats and 11 teams are not.
    CURRENT = season_in_progress()
    n = con.execute("""SELECT COUNT(*) FROM season_entries WHERE year=?
        AND role='race'""", (CURRENT,)).fetchone()[0]
    check(f"{CURRENT} has 22 race seats", n == 22, f"got {n}")
    teams = con.execute("""SELECT COUNT(DISTINCT constructor_id) FROM season_entries
        WHERE year=? AND role='race'""", (CURRENT,)).fetchone()[0]
    check(f"{CURRENT} has 11 teams", teams == 11, f"got {teams}")
    percar = con.execute("""SELECT constructor_id, COUNT(*) n FROM season_entries
        WHERE year=? AND role='race' GROUP BY constructor_id HAVING n != 2""",
        (CURRENT,)).fetchall()
    check(f"every {CURRENT} team has exactly two race drivers", not percar,
          "; ".join(r["constructor_id"] for r in percar))
    dupnum = con.execute("""SELECT car_number, COUNT(*) n FROM season_entries
        WHERE year=? AND role='race' GROUP BY car_number HAVING n>1""",
        (CURRENT,)).fetchall()
    check(f"{CURRENT} car numbers are unique", not dupnum)
    missing = con.execute("""SELECT entity FROM standings WHERE year=?1
        AND table_type='drivers' AND entity_id NOT IN
        (SELECT driver_id FROM season_entries WHERE year=?1)""",
        (CURRENT,)).fetchall()
    check(f"every {CURRENT} driver in the standings has an entry", not missing,
          "; ".join(r[0] for r in missing))


@section('TIMELINE SANITY')
def timeline_sanity():
    bad = con.execute("""SELECT full_name, born, died FROM drivers
        WHERE born IS NOT NULL AND died IS NOT NULL AND died < born""").fetchall()
    check("nobody died before they were born", not bad)
    bad = con.execute("""SELECT full_name, first_season, last_season FROM drivers
        WHERE last_season IS NOT NULL AND first_season IS NOT NULL
        AND last_season < first_season""").fetchall()
    check("driver careers run forwards", not bad,
          "; ".join(r["full_name"] for r in bad))
    bad = con.execute("""SELECT name, first_entry, last_entry FROM constructors
        WHERE last_entry IS NOT NULL AND last_entry < first_entry""").fetchall()
    check("constructor entries run forwards", not bad,
          "; ".join(r["name"] for r in bad))
    bad = con.execute("""SELECT name, first_gp, last_gp FROM circuits
        WHERE last_gp IS NOT NULL AND last_gp < first_gp""").fetchall()
    check("circuit usage runs forwards", not bad, "; ".join(r["name"] for r in bad))
    bad = con.execute("""SELECT full_name, born, first_season FROM drivers
        WHERE born IS NOT NULL AND first_season IS NOT NULL
        AND CAST(substr(born,1,4) AS INTEGER) + 16 > first_season""").fetchall()
    check("nobody started before turning 16", not bad,
          "; ".join(f"{r['full_name']} b.{r['born']} debut {r['first_season']}" for r in bad))
    bad = con.execute("""SELECT id, from_year, to_year FROM constructor_lineage
        WHERE to_year IS NOT NULL AND to_year < from_year""").fetchall()
    check("lineage periods run forwards", not bad)


@section('POINTS SYSTEMS: THE FIGURES AGAINST THE PROSE')
def points_systems_figures():
    """`win_points` and `fastest_lap_points` say as numbers what `scoring` and
    `fastest_lap` say as sentences, so that a query can add a season's maximum
    up (known_gaps #12). Nothing but this section stops the two drifting: the
    season page's "who can still win" is arithmetic on these figures, and a
    reworded sentence that left them behind would publish a wrong claim about
    a live championship rather than merely look untidy."""
    rows = con.execute("""SELECT id, from_year, to_year, scoring, win_points,
        fastest_lap, fastest_lap_points FROM points_systems ORDER BY id""").fetchall()

    bad = []
    for r in rows:
        head = r["scoring"][len("SPRINT: "):] if r["scoring"].startswith("SPRINT: ") else r["scoring"]
        lead = re.match(r"\d+", head)
        said = int(lead.group()) if lead else None
        if said != r["win_points"]:
            bad.append(f"#{r['id']} {r['scoring']!r} opens on "
                       f"{said if said is not None else 'no figure'}, win_points is {r['win_points']}")
    check("win_points is the leading figure of the scoring rule it sits beside",
          not bad, "; ".join(bad))

    # 'None' is the string these rows carry where there was no fastest-lap
    # point, and NULL is what a sprint row carries; neither is a point.
    bad = [f"#{r['id']} fastest_lap={r['fastest_lap']!r} but fastest_lap_points={r['fastest_lap_points']}"
           for r in rows
           if (r["fastest_lap"] not in (None, "None")) != (r["fastest_lap_points"] > 0)]
    check("fastest_lap_points is set exactly where a fastest-lap rule is named",
          not bad, "; ".join(bad))

    bad = [f"#{r['id']}" for r in rows if r["fastest_lap_points"] not in (0, 1)]
    check("no fastest lap has ever been worth more than a point", not bad, "; ".join(bad))

    bad = [f"#{r['id']}" for r in rows
           if r["scoring"].startswith("SPRINT: ") and r["fastest_lap_points"] != 0]
    check("no sprint carries a fastest-lap point", not bad, "; ".join(bad))

    # The season page picks one system per season with ORDER BY from_year DESC
    # LIMIT 1. That is the right row only while the periods neither overlap nor
    # leave a hole, which is what these two check for every season the register
    # holds - including the seasons scheduled but not yet run.
    # The figures above are checked against the sentence beside them, which is
    # the same tuple said twice. This one is not: it asks the race records what
    # a win was actually paid, which is the only check here that could catch an
    # authored pair where both halves are wrong together. The cap is the win
    # plus the fastest lap because a winner can take both.
    #
    # 2014 is the one season over it, and deliberately: Abu Dhabi paid double
    # points that year, a one-race rule the period table has no row shape for
    # and `scoring` has never mentioned. It is declared here rather than
    # smoothed away, and it is why win_points is a maximum for a normal race
    # and not a promise about every race of the period.
    DOUBLE_POINTS = {2014: 50.0}
    over = []
    for r in con.execute("""SELECT r.year AS year, MAX(e.points) AS most
        FROM race_entries e JOIN races r ON r.id = e.race_id
        WHERE e.finish_position = 1 AND e.points IS NOT NULL
        GROUP BY r.year ORDER BY r.year"""):
        cap = con.execute("""SELECT win_points + fastest_lap_points FROM points_systems
            WHERE scoring NOT LIKE 'SPRINT:%' AND from_year <= ? AND (to_year IS NULL OR to_year >= ?)
            ORDER BY from_year DESC LIMIT 1""", (r["year"], r["year"])).fetchone()
        if cap is None:
            over.append(f"{r['year']}: no points system covers it")
        elif r["most"] > cap[0] and DOUBLE_POINTS.get(r["year"]) != r["most"]:
            over.append(f"{r['year']}: a winner scored {r['most']}, the system pays at most {cap[0]}")
    check("no winner scored more than the season's win and fastest-lap points, "
          "bar 2014's double-points finale", not over, "; ".join(over))
    check("2014 Abu Dhabi is still the double-points race the exception is for",
          con.execute("""SELECT MAX(e.points) FROM race_entries e JOIN races r ON r.id = e.race_id
              WHERE r.year = 2014 AND e.finish_position = 1""").fetchone()[0] == DOUBLE_POINTS[2014])

    for kind, want in (("grand prix", 1), ("sprint", None)):
        gaps = []
        for year in range(1950, last_season() + 1):
            n = sum(1 for r in rows
                    if r["scoring"].startswith("SPRINT: ") == (kind == "sprint")
                    and r["from_year"] <= year
                    and (r["to_year"] is None or r["to_year"] >= year))
            if n > 1 or (want is not None and n != want):
                gaps.append(f"{year}: {n}")
        check(f"every season is covered by at most one {kind} points system"
              + (" and no fewer" if want else ""),
              not gaps, "; ".join(gaps))


@section('FINISHING ORDER AND PODIUMS')
def finishing_order_and_podiums():
    n_pod = con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE finish_position IN (2, 3)""").fetchone()[0]
    n_field = con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE finish_position > 3""").fetchone()[0]
    races_with_pod = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
        WHERE finish_position IN (2, 3)""").fetchone()[0]
    held = con.execute("SELECT COUNT(*) FROM races WHERE status='completed'").fetchone()[0]
    print(f"  [info] {n_pod} second/third places across {races_with_pod} of "
          f"{held} races; {n_field} finishers below third")
    if not n_pod:
        print("  [info] no classification loaded - run tools/ergast_load.py")

    # Structural checks. All hold whether the classification is loaded or not.
    bad = con.execute("""SELECT COUNT(*) FROM (
        SELECT race_id, finish_position FROM race_entries
        WHERE finish_position IS NOT NULL
        GROUP BY race_id, finish_position
        HAVING COUNT(*) > SUM(shared_drive) + 1)""").fetchone()[0]
    check("no finishing position is claimed twice except by a shared drive",
          bad == 0, f"{bad} positions")

    bad = con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE finish_position IS NOT NULL AND finish_position < 1""").fetchone()[0]
    check("finishing positions are positive", bad == 0, f"{bad} bad")

    bad = con.execute("""SELECT COUNT(*) FROM race_entries e JOIN races r
        ON r.id = e.race_id WHERE r.status != 'completed'
        AND e.finish_position IS NOT NULL""").fetchone()[0]
    check("no result is recorded against an unrun race", bad == 0, f"{bad} rows")

    # Every race that has a second place must have a first.
    bad = con.execute("""SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
        WHERE e.finish_position = 2 AND NOT EXISTS (
            SELECT 1 FROM race_entries w WHERE w.race_id = e.race_id
              AND w.finish_position = 1)""").fetchone()[0]
    check("every race with a second place has a winner", bad == 0, f"{bad} races")

    # THE reconciliation. Derived podium counts against the official figures.
    # This is the check that caught fabricated rows during the v2.7 harvest, and
    # it is the reason the podium data can be trusted at all.
    if n_pod:
        rows = con.execute("""SELECT full_name, podiums, podiums_external, status
            FROM drivers WHERE podiums_external IS NOT NULL
            ORDER BY podiums_external DESC""").fetchall()
        over, under = [], []
        for r in rows:
            d = r["podiums"] - r["podiums_external"]
            if d < 0:
                under.append(f"{r['full_name']} {r['podiums']} vs {r['podiums_external']}")
            elif d > 0 and r["status"] != "active":
                over.append(f"{r['full_name']} {r['podiums']} vs {r['podiums_external']}")
        # A retired driver's total cannot move; an active driver's can only grow
        # past a figure captured earlier in the season.
        check("no driver has fewer podiums than the official figure", not under,
              "; ".join(under))
        check("no retired driver has more podiums than the official figure",
              not over, "; ".join(over))
        exact = sum(1 for r in rows if r["podiums"] == r["podiums_external"])
        print(f"  [info] {exact} of {len(rows)} drivers match their official "
              f"podium count exactly")
    else:
        warn("podium reconciliation ran", False,
             "no classification loaded, so the strongest check on this data "
             "is not running - see tools/ergast_load.py")

    bad = con.execute("""SELECT COUNT(*) FROM drivers d
        WHERE NOT EXISTS (SELECT 1 FROM race_entries e WHERE e.driver_id = d.id)"""
        ).fetchone()[0]
    print(f"  [info] {bad} drivers in the register have no race entry yet "
          f"(they gain one when the classification loads)")


@section('CARS')
def cars():
    _CR = cars_module()
    tot = entry_count()
    # The (car, year) pairs the season entry lists actually corroborate, which is
    # what decides whether a car's derived win count must EQUAL its published one
    # or merely not exceed it.
    _corroborated = {(r[0], r[1]) for r in con.execute(
        "SELECT car_id, year FROM car_seasons WHERE corroborated = 1")}
    nc = con.execute("SELECT COUNT(*) FROM cars").fetchone()[0]
    lm = con.execute("SELECT COUNT(*) FROM cars WHERE landmark=1").fetchone()[0]
    print(f"  [info] {nc} cars in the register, {lm} with a full deep dive")

    bad = con.execute("""SELECT c.id FROM cars c WHERE c.supersedes_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM cars p WHERE p.id = c.supersedes_id)""").fetchall()
    check("every supersedes_id resolves", not bad, ", ".join(r[0] for r in bad))

    bad = con.execute("""SELECT c.id FROM cars c JOIN cars p ON p.id = c.supersedes_id
        WHERE c.from_year < p.from_year""").fetchall()
    check("a car does not predate the one it supersedes", not bad,
          ", ".join(r[0] for r in bad))

    bad = con.execute("""SELECT COUNT(*) FROM cars
        WHERE to_year IS NOT NULL AND to_year < from_year""").fetchone()[0]
    check("car years run forwards", bad == 0, f"{bad} reversed")

    # An entry can only carry a car the constructor actually built, in a year the
    # car existed.
    bad = con.execute("""SELECT COUNT(*) FROM race_entries e JOIN cars c ON c.id=e.car_id
        WHERE e.constructor_id IS NOT NULL AND e.constructor_id != c.constructor_id"""
        ).fetchone()[0]
    check("linked cars belong to the entry's constructor", bad == 0, f"{bad} wrong")

    # A car's DESIGN life is not its RACING life. cars.from_year/to_year describe
    # the works car; privateers ran the same chassis for years afterwards, and the
    # chassis register - built from the entry lists - is the source that knows it.
    # The Ferrari 500 is a 1952-53 car that was still entered in 1957.
    bad = con.execute("""SELECT r.year, e.driver_id, e.chassis_id,
            ch.first_year, ch.last_year
        FROM race_entries e
        JOIN chassis ch ON ch.id = e.chassis_id
        JOIN races r ON r.id = e.race_id
        WHERE ch.first_year IS NOT NULL
          AND (r.year < ch.first_year
               OR (ch.last_year IS NOT NULL AND r.year > ch.last_year))
        LIMIT 5""").fetchall()
    check("no entry is dated outside the seasons its chassis was entered", not bad,
          "; ".join(f"{r[0]} {r[1]} ({r[2]}-{r[3]})" for r in bad))

    # The strongest car check. A car cannot have won more races than the number
    # published on its own reference page; and where every year it raced is
    # linked, the derived total must EQUAL the published one.
    #
    # Poles used to be a lower bound and nothing more. The pole harvest recorded
    # who took pole but not what they drove, so 1,260 entries carried no
    # constructor and could not reach a car at all. The season entry lists supply
    # that constructor now, and a fully linked car's pole count must match its
    # published figure exactly, on the same terms as its wins.
    over, neq, npeq, checked = [], [], [], 0
    for cid, (ew, ep) in _CR.EXPECTED.items():
        row = con.execute("""SELECT wins, poles, from_year, to_year FROM cars
                             WHERE id=?""", (cid,)).fetchone()
        if row is None:
            over.append(f"{cid}: not in the register")
            continue
        w, p, fy, ty = row
        complete = _CR.seasons_complete(cid, fy, ty, _corroborated)
        if ew is not None:
            checked += 1
            if w > ew:
                over.append(f"{cid}: derived {w} wins, published {ew}")
            elif complete and w != ew:
                neq.append(f"{cid}: all seasons linked but {w} wins, published {ew}")
        if ep is not None:
            if p > ep:
                over.append(f"{cid}: derived {p} poles, published {ep}")
            elif complete and p != ep:
                npeq.append(f"{cid}: all seasons linked but {p} poles, "
                            f"published {ep}")
    check("no car has more wins or poles than its published total", not over,
          "; ".join(over))
    check("fully linked cars match their published win total exactly", not neq,
          "; ".join(neq))
    check("fully linked cars match their published pole total exactly", not npeq,
          "; ".join(npeq))
    pmatch = sum(1 for cid, (_w, ep) in _CR.EXPECTED.items() if ep is not None
                 and (con.execute("SELECT poles FROM cars WHERE id=?",
                                  (cid,)).fetchone() or [None])[0] == ep)
    print(f"  [info] {pmatch} cars match their published pole total exactly; "
          f"before the entry lists supplied the missing constructors, none could")
    ncomplete = sum(1 for cid in _CR.EXPECTED
                    if (lambda r: r and _CR.seasons_complete(
                            cid, r[0], r[1], _corroborated))(
                        con.execute("SELECT from_year,to_year FROM cars WHERE id=?",
                                    (cid,)).fetchone()))
    uncorr = con.execute(
        "SELECT COUNT(*) FROM car_seasons WHERE corroborated = 0").fetchone()[0]
    print(f"  [info] {uncorr} of "
          f"{con.execute('SELECT COUNT(*) FROM car_seasons').fetchone()[0]} "
          f"CAR_SEASONS claims are not corroborated by the entry lists, so the "
          f"blanket link is withheld for those seasons")
    print(f"  [info] {checked} cars compared against published figures, "
          f"{ncomplete} of them fully linked")

    linked = con.execute("SELECT COUNT(*) FROM race_entries WHERE car_id IS NOT NULL"
                         ).fetchone()[0]
    print(f"  [info] {linked} of {tot} race entries linked to a car "
          f"({100 * linked / tot:.0f}%)")


@section('THE DRIVER REGISTER')
def the_driver_register():
    _HV = harvest_module()
    from data import results as _RS
    _drv_years = {}
    for _y, _e, _c, _em, _d, _rounds, _t in _HV.load_entrant_drivers():
        if _rounds:
            _drv_years.setdefault(_d, set()).add(_y)
    _ourd = {r[0] for r in con.execute("SELECT id FROM drivers")}
    _dmap, _dcoll = _HV.resolve_f1db_drivers(
        dict(con.execute("SELECT id, full_name FROM drivers")))
    check("no two F1DB drivers normalise onto one register entry", not _dcoll,
          "; ".join(f"{k} <- {v}" for k, v in list(_dcoll.items())[:4]))

    # Every driver F1DB records entering a championship race must be in the
    # register. Unlike constructors there is no Indianapolis exclusion: this
    # project has counted an Indianapolis start in 1950-60 as a World
    # Championship start since v2.1, when the ten Indianapolis winners were
    # added, and 73 of the drivers admitted here entered nothing else.
    _dgap = [d for d in _drv_years if d not in _dmap]
    check("every driver that entered a championship race is in the register",
          not _dgap, "; ".join(sorted(_dgap)[:6]))
    _admitted_d = con.execute("""SELECT COUNT(*) FROM drivers
        WHERE confidence = 'reference' AND source LIKE '%f1db%'""").fetchone()[0]
    print(f"  [info] {len(_ourd)} drivers, {_admitted_d} of them admitted from "
          f"the F1DB register; {len(_RS.DRIVER_NON_MAPPING)} Jolpica drivers are "
          f"declared as a source disagreement rather than created")

    # --- what the register keeps from F1DB about the person (PD-17). The id
    # first: a stored key that no longer agrees with the match it was written
    # from is worse than no key at all, because nothing about it looks wrong.
    _stored = dict(con.execute(
        "SELECT id, f1db_id FROM drivers WHERE f1db_id IS NOT NULL"))
    _resolved = {_our: _f1 for _f1, _our in _dmap.items()}
    _differ = sorted(d for d in set(_stored) | set(_resolved)
                     if _stored.get(d) != _resolved.get(d))
    check("every driver the F1DB match resolves stores the id it resolved to",
          not _differ,
          "; ".join(f"{d}: stored {_stored.get(d)}, resolves to {_resolved.get(d)}"
                    for d in _differ[:4]))

    _abbr_bad = [r[0] for r in con.execute("""SELECT id FROM drivers
        WHERE abbreviation IS NOT NULL
          AND (LENGTH(abbreviation) != 3 OR abbreviation != UPPER(abbreviation))""")]
    check("every three-letter code is three capital letters",
          not _abbr_bad, ", ".join(_abbr_bad[:6]))

    _num_bad = [f"{r[0]}: {r[1]}" for r in con.execute("""SELECT id, permanent_number
        FROM drivers WHERE permanent_number IS NOT NULL
          AND (permanent_number < 1 OR permanent_number > 99)""")]
    check("every permanent number is one a car may carry",
          not _num_bad, ", ".join(_num_bad[:6]))

    # Two drivers cannot race the same number, so two rows cannot hold it.
    # F1DB clears the field when a driver stops racing - Daniel Ricciardo has
    # none - which is what keeps this true upstream as numbers are reassigned.
    _num_dupe = [f"{r[0]} ({r[1]})" for r in con.execute("""SELECT permanent_number,
        GROUP_CONCAT(id, ', '), COUNT(*) n FROM drivers
        WHERE permanent_number IS NOT NULL
        GROUP BY permanent_number HAVING n > 1""")]
    check("no two drivers hold the same permanent number",
          not _num_dupe, "; ".join(_num_dupe[:4]))

    # The number F1DB publishes against the number the entry list gives, with
    # the one exception the rule itself names: the REIGNING champion may carry
    # 1. Lando Norris is entered as 1 for 2026 and his permanent number is 4.
    # Read from title_years and not from titles > 0, or the one driver the
    # escape covers has a number nothing constrains. build.py stops on
    # anything else; this is the gate that says so.
    _num_vs_entry = [f"{_r[0]} has {_r[1]}, entered as {_r[3]} in {_r[2]}"
                     for _r in con.execute("""SELECT d.id, d.permanent_number,
            e.year, e.car_number, d.title_years
        FROM drivers d JOIN season_entries e ON e.driver_id = d.id
        WHERE d.permanent_number IS NOT NULL AND e.car_number IS NOT NULL
          AND e.car_number != d.permanent_number
        ORDER BY e.year, d.id""")
                     if not (_r[3] == 1
                             and str(_r[2] - 1) in (_r[4] or "").split(","))]
    check("every entry number is the driver's permanent number, or the "
          "reigning champion's 1",
          not _num_vs_entry, "; ".join(_num_vs_entry[:4]))

    _keyed, _coded, _numbered, _placed = con.execute("""SELECT COUNT(f1db_id),
        COUNT(abbreviation), COUNT(permanent_number), COUNT(place_of_birth)
        FROM drivers""").fetchone()
    print(f"  [info] {_keyed} drivers keyed to F1DB, {_coded} with a "
          f"three-letter code, {_placed} with a place of birth, "
          f"{_numbered} with a permanent number")
    _dupe = con.execute("""SELECT full_name, COUNT(*) n FROM drivers
        GROUP BY LOWER(full_name) HAVING n > 1""").fetchall()
    check("no two register rows share a driver's full name", not _dupe,
          "; ".join(f"{r[0]} x{r[1]}" for r in _dupe[:4]))

    # notes is read as the page's lede and its meta description. How the row
    # entered the register belongs in provenance, and a figure the page
    # derives belongs to the strip beside the lede, where it cannot go stale:
    # Amon's note said 96 starts beside a strip that counted 108.
    _prov = [r[0] for r in con.execute("""SELECT id FROM drivers
        WHERE notes LIKE 'Added %' OR notes LIKE '% harvest%' ORDER BY id""")]
    check("no driver note opens with how the row entered the register",
          not _prov, "; ".join(_prov[:6]))
    # The figure the note must not state - what it is, and why - is
    # tools/lede_figures.py, one pattern with its own unit test, so both of
    # CI's interpreters prove what it matches rather than merely that it
    # compiles (CD-21, CD-23).
    _figure = _lede_figures().FIGURE
    _typed = [f"{r[0]} ({_m.group(0)})" for r in con.execute(
        "SELECT id, notes FROM drivers WHERE notes IS NOT NULL ORDER BY id")
        if (_m := _figure.search(r[1]))]
    check("no driver note states a figure the page derives",
          not _typed, "; ".join(_typed[:6]))
    # The figures that check leaves alone on purpose - "Six Monaco wins" - name
    # a subset of a career, and nothing totalled them until now (CD-24). Where
    # the place is a Grand Prix the race records count it, from race_entries,
    # the table the strip beside the note derives from; where no Grand Prix
    # carries the name (Le Mans is not a championship race; "three Imola wins"
    # names a circuit, and is reworded to the Grand Prix instead), the note
    # declares it here, and an undeclared place fails rather than riding
    # along. The map is the Grand Prix name minus "Grand Prix", so a plain
    # adjective - "European", "Pacific" - is read as that Grand Prix and
    # nothing else.
    _gps = {}
    for gp_id, gp_name in con.execute("SELECT DISTINCT gp_id, gp_name FROM race_results"):
        _gps[gp_id.lower()] = gp_id
        _gps[re.sub(r"\s+grand prix$", "", gp_name.lower())] = gp_id
    _no_grand_prix_counts_it = {("ickx", "Le Mans")}
    _subset_count = {
        "wins": "e.finish_position = 1", "victories": "e.finish_position = 1",
        "poles": "e.pole = 1", "podiums": "e.finish_position <= 3",
    }
    _lf = _lede_figures()
    _wrong, _undeclared, _seen = [], [], 0
    for did, note in con.execute("SELECT id, notes FROM drivers WHERE notes IS NOT NULL ORDER BY id"):
        for n, place, noun in _lf.subset_figures(note):
            _seen += 1
            gp = _gps.get(re.sub(r"\s+(grand prix|gp)$", "", place.lower()))
            if gp is None:
                if (did, place) not in _no_grand_prix_counts_it:
                    _undeclared.append(f"{did}: {n} {place} {noun}")
                continue
            got = con.execute(f"""SELECT COUNT(*) FROM race_entries e JOIN races r ON r.id = e.race_id
                WHERE r.gp_id = :gp AND e.driver_id = :driver AND {_subset_count[noun]}""",
                {"gp": gp, "driver": did}).fetchone()[0]
            if got != n:
                _wrong.append(f"{did}: note says {n} {place} {noun}, the records count {got}")
    check("every subset figure in a driver note counts against the race records",
          not _wrong, "; ".join(_wrong[:4]))
    check("every subset figure in a driver note names a Grand Prix or is declared",
          not _undeclared, "; ".join(_undeclared[:4]))
    print(f"  [info] {_seen} subset figures in driver notes, "
          f"{len(_no_grand_prix_counts_it)} declared with no Grand Prix to count them")
    # The register's first and last season against the race records'. They
    # differ for two drivers, and each side is right about something: Cevert's
    # first entry is the 1969 German Grand Prix, driven in a Formula 2 Tecno,
    # and the register's 1970 is his Formula One debut; Rossi's 2014 was
    # practice only, and the records' first entry is 2015. The driver page
    # shows both where they differ (CD-22); a third case must be read the same
    # way before it rides along. A NULL last_season is an open span - still
    # driving - and makes no claim about the last year, the same predicate
    # seasonsNote() applies in web/src/queries/driver.js.
    _span = {r[0] for r in con.execute("""SELECT d.id FROM drivers d
        JOIN (SELECT e.driver_id, MIN(r.year) fy, MAX(r.year) ly FROM race_entries e
                JOIN races r ON r.id = e.race_id GROUP BY e.driver_id) x ON x.driver_id = d.id
        WHERE (d.first_season IS NOT NULL AND d.first_season != x.fy)
           OR (d.last_season IS NOT NULL AND d.last_season != x.ly)""")}
    # The declaration is the discrepancies row that explains it (CD-25), so
    # the pin and the reader's explanation cannot drift apart; the row's two
    # figures must also be the register's and the records'.
    # Either end of the span may be declared (CD-26): a row's field names
    # the end, and its two figures must be that end's register value and
    # the records' MIN or MAX year.
    _explained = {}
    for did, field, sv, dv in con.execute("""SELECT d.id, x.field, x.stored_value, x.derived_value
        FROM discrepancies x JOIN drivers d ON d.full_name = x.subject
        WHERE x.field IN ('first_season', 'last_season')
          AND x.status = 'explained - each side is right about something'"""):
        _explained.setdefault(did, []).append((field, sv, dv))
    _declared = set(_explained)
    _agg = {"first_season": "MIN", "last_season": "MAX"}
    _bad_rows = [f"{d} {field}: row says {sv}/{dv}" for d, rows_ in _explained.items()
                 for field, sv, dv in rows_
                 if con.execute(f"""SELECT NOT (d.{field} = ? AND
                        (SELECT {_agg[field]}(r.year) FROM race_entries e JOIN races r ON r.id = e.race_id
                          WHERE e.driver_id = d.id) = ?) FROM drivers d WHERE d.id = ?""",
                     (int(sv), int(dv), d)).fetchone()[0]]
    _top = con.execute("SELECT MAX(id) FROM discrepancies").fetchone()[0]
    _exp_ids = sorted(r[0] for r in con.execute("""SELECT id FROM discrepancies
        WHERE status = 'explained - each side is right about something'"""))
    _n_exp = len(harvest_module().EXPLAINED_SPANS)
    check("the explained span rows are the last discrepancies written, so adding one moves no id",
          len(_exp_ids) == _n_exp and _exp_ids == list(range(_top - _n_exp + 1, _top + 1)),
          f"ids {_exp_ids} of {_n_exp} declared, max {_top}")
    check("each explained span row carries the register's and the records' figure for its end",
          not _bad_rows, "; ".join(_bad_rows))
    # The register's `active` against the grid the drivers page derives - an
    # entry in the latest completed season (IX-17). In season, an active
    # driver with no entry is a stale register row and fails. In pre-season -
    # a later year on the calendar with nothing completed yet - the register
    # describes a grid the race records cannot confirm (Bottas, Perez and
    # Lindblad were signed for 2026 before its opener), so the same comparison
    # is only reported; the rule is derived from the calendar, not from a list
    # of names. A driver who entered and is no longer active is a mid-season
    # replacement (Doohan in 2025) and is reported in either window, because
    # the data is right both ways.
    _latest = con.execute("SELECT MAX(year) FROM races WHERE status = 'completed'").fetchone()[0]
    _calendar = con.execute("SELECT MAX(year) FROM races").fetchone()[0]
    _active = {r[0] for r in con.execute("SELECT id FROM drivers WHERE status = 'active'")}
    _grid = {r[0] for r in con.execute("""SELECT DISTINCT e.driver_id FROM race_entries e
        JOIN races r ON r.id = e.race_id WHERE r.year = ?""", (_latest,))}
    # In season while the season being run still has rounds to run. The test
    # was _calendar == _latest alone, which said the same thing only while the
    # last calendar in the register WAS that season: announce the next one and
    # every mid-season build reads as pre-season, downgrading this check to a
    # warning for the rest of the year. The pre-season window is the gap
    # between a season's last race and the next season's first, and it opens
    # when the season being run has finished, not when the next is published.
    _unrun = con.execute("""SELECT COUNT(*) FROM races
        WHERE year = ? AND status != 'completed'""", (_latest,)).fetchone()[0]
    _in_season = _calendar == _latest or _unrun > 0
    (check if _in_season else warn)(
        f"every active driver has an entry in {_latest}"
        + ("" if _in_season else f" (pre-season: {_calendar} has no completed race yet)"),
        _active <= _grid,
        "active without an entry: " + (", ".join(sorted(_active - _grid)) or "none"))
    warn(f"every driver entered in {_latest} is still active", _grid <= _active,
         "entered, no longer active: " + (", ".join(sorted(_grid - _active)) or "none"))
    check("the register's seasons differ from the race records' only for the drivers with an explained row",
          _span == _declared,
          "undeclared: " + (", ".join(sorted(_span - _declared)) or "none")
          + "; no longer differing: " + (", ".join(sorted(_declared - _span)) or "none"))


@section('THE WEEKEND TIMETABLE')
def the_weekend_timetable():
    """sessions: the current season's timetable against the calendar it hangs from."""
    import datetime as _dt
    import zoneinfo as _zi
    CURRENT = season_in_progress()
    stray = con.execute("""SELECT COUNT(*) FROM sessions
        WHERE race_id NOT IN (SELECT id FROM races WHERE year = ?)""",
        (CURRENT,)).fetchone()[0]
    check("sessions holds the season in progress and nothing else", stray == 0,
          f"{stray} rows outside {CURRENT}")
    unz = con.execute("SELECT COUNT(*) FROM sessions WHERE start_utc NOT GLOB '????-??-??T??:??Z'").fetchone()[0]
    check("every session start is YYYY-MM-DDTHH:MMZ, so a browser reads it as UTC", unz == 0, f"{unz} rows")
    rows = con.execute("""SELECT r.round, r.sprint, r.dates, s.kind, s.start_utc, s.zone
        FROM sessions s JOIN races r ON r.id = s.race_id WHERE r.year = ?
        ORDER BY r.round, s.start_utc""", (CURRENT,)).fetchall()
    by_round = {}
    for rnd, sprint, dates, kind, start, zone in rows:
        by_round.setdefault(rnd, []).append((sprint, dates, kind, start, zone))
    rounds = {r[0] for r in con.execute(
        "SELECT round FROM races WHERE year = ?", (CURRENT,))}
    check(f"every {CURRENT} round has a timetable", set(by_round) == rounds,
          "missing: " + (", ".join(map(str, sorted(rounds - set(by_round)))) or "none"))
    # The set of sessions is what the sprint flag says it is: a weekend that
    # says sprint and has three practices, or the reverse, is a flag or a
    # timetable copied from the wrong page.
    SPRINT = {"fp1", "sprint_qualifying", "sprint", "qualifying", "race"}
    PLAIN = {"fp1", "fp2", "fp3", "qualifying", "race"}
    bad = [f"r{rnd}" for rnd, ss in by_round.items()
           if {k for _, _, k, _, _ in ss} != (SPRINT if ss[0][0] else PLAIN)]
    check("each weekend's sessions are the five its sprint flag implies", not bad, ", ".join(bad))
    # In running order, and every start parses.
    order = [f"r{rnd}" for rnd, ss in by_round.items()
             if [k for _, _, k, _, _ in ss] != (["fp1", "sprint_qualifying", "sprint", "qualifying", "race"]
                                                 if ss[0][0] else ["fp1", "fp2", "fp3", "qualifying", "race"])]
    check("each weekend's sessions run in the order they are named", not order, ", ".join(order))
    # The race's local day is the last day of the weekend the calendar states,
    # which is what proves the UTC reading and the zone together: Las Vegas
    # races on a Saturday evening that is Sunday in UTC.
    _MON = {m: i for i, m in enumerate(
        ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}
    wrong, badzone = [], []
    for rnd, ss in by_round.items():
        for sprint, dates, kind, start, zone in ss:
            if kind != "race":
                continue
            try:
                tz = _zi.ZoneInfo(zone)
            except Exception:
                badzone.append(f"r{rnd} {zone}"); continue
            local = _dt.datetime.fromisoformat(start.rstrip("Z")).replace(tzinfo=_dt.timezone.utc).astimezone(tz)
            m = re.search(r"(\d{1,2}) (\w{3}) (\d{4})$", dates or "")
            if not m:
                wrong.append(f"r{rnd}: races.dates {dates!r} does not end in a day"); continue
            last = _dt.date(int(m.group(3)), _MON[m.group(2)], int(m.group(1)))
            if local.date() != last:
                wrong.append(f"r{rnd}: race {start}Z is {local.date()} in {zone}, the weekend ends {last}")
    check("every zone is an IANA tz database name", not badzone, ", ".join(badzone))
    check("each race's local day is the last day of its weekend", not wrong, "; ".join(wrong[:4]))
    print(f"  [info] {len(rows)} sessions across {len(by_round)} weekends")


@section('THE CONSTRUCTOR REGISTER')
def the_constructor_register():
    _HV = harvest_module()
    from data import teams as _T
    import collections as _coll
    _indy = {(y, r) for y, r in con.execute(
        "SELECT year, round FROM races WHERE gp_id='indianapolis-500'")}
    _ent = _coll.defaultdict(set)
    for _y, _e, _c, _em, _d, _rounds, _test in _HV.load_entrant_drivers():
        # rounds, not the testDriver flag - see the note in build.py
        for _r in _rounds:
            _ent[_c].add((_y, _r))
    _ours = {r[0] for r in con.execute("SELECT id FROM constructors")}

    # The admission test, asserted rather than assumed. Every constructor F1DB
    # records entering a championship race that was NOT the Indianapolis 500 must
    # be in this register, aliased to a team that is, or declared as a deliberate
    # exclusion. Nothing may simply be absent - which is how Ensign started 133
    # Grands Prix without a row here.
    # Every SEASON must resolve, not just one of them. An id whose meaning
    # changes part-way - `alfa-romeo` is the register's own constructor until
    # 1985 and Sauber's branding from 2019 - can have one season land in the
    # register while another lands nowhere. Testing only the last season would
    # pass on that.
    _gap = []
    for _c, _slots in _ent.items():
        if not (_slots - _indy):
            continue                       # Indianapolis-only, correctly excluded
        if _c in _T.F1DB_CONSTRUCTOR_ALIASES or _c in _T.F1DB_CONSTRUCTOR_NON_MAPPING:
            continue
        _unresolved = sorted({_y for _y, _ in _slots
                              if _HV.constructor_for_f1db(_c, _y) not in _ours})
        if _unresolved:
            _gap.append(f"{_c} ({len(_unresolved)} season(s): "
                        f"{_unresolved[0]}-{_unresolved[-1]})")
    check("every constructor that entered a non-Indianapolis race is in the "
          "register, aliased, or declared", not _gap, "; ".join(sorted(_gap)[:6]))

    _bad_alias = [k for k, v in _T.F1DB_CONSTRUCTOR_ALIASES.items() if v not in _ours]
    check("every constructor alias points at a team in the register",
          not _bad_alias, "; ".join(_bad_alias))
    _both = set(_T.F1DB_CONSTRUCTORS) & set(_T.F1DB_CONSTRUCTOR_ALIASES)
    _both |= set(_T.F1DB_CONSTRUCTORS) & set(_T.F1DB_CONSTRUCTOR_NON_MAPPING)
    check("no constructor is both admitted and aliased or excluded", not _both,
          "; ".join(sorted(_both)))
    _admitted = con.execute("""SELECT COUNT(*) FROM constructors
        WHERE confidence = 'reference' AND source LIKE '%f1db%'""").fetchone()[0]
    print(f"  [info] {len(_ours)} constructors, {_admitted} of them admitted from "
          f"the F1DB register; {len(_T.F1DB_CONSTRUCTOR_ALIASES)} aliases and "
          f"{len(_T.F1DB_CONSTRUCTOR_NON_MAPPING)} declared exclusion(s)")
    _unmapped = con.execute("""SELECT COUNT(DISTINCT f1db_constructor_id)
        FROM season_entrants WHERE constructor_id IS NULL""").fetchone()[0]
    print(f"  [info] {_unmapped} F1DB constructors remain unmapped; all but the "
          f"declared exclusion are Indianapolis 500 chassis makers, which this "
          f"project has never counted as Formula One constructors")


@section('THE CHASSIS REGISTER')
def the_chassis_register():
    _CR = cars_module()
    tot = entry_count()
    nch = con.execute("SELECT COUNT(*) FROM chassis").fetchone()[0]
    neng = con.execute("SELECT COUNT(*) FROM engines").fetchone()[0]
    nent = con.execute("SELECT COUNT(*) FROM season_entrants").fetchone()[0]
    nspec = con.execute("SELECT COUNT(*) FROM chassis WHERE article IS NOT NULL").fetchone()[0]
    print(f"  [info] {nch} chassis, {neng} engines, {nent} season entrant rows; "
          f"{nspec} chassis carry harvested specifications")

    # Every chassis id in CAR_CHASSIS must exist, belong to the car's constructor,
    # be claimed by only one car, not have raced before the car existed, and
    # not have raced after it except in the declared privateer cases. A typo
    # cannot survive all five.
    reg = {r["id"]: r for r in con.execute("SELECT * FROM chassis")}
    missing, wrongcons, outside, late, twice = [], [], [], [], []
    claimed = {}
    for car_id, ch_ids in _CR.CAR_CHASSIS.items():
        car = con.execute("SELECT constructor_id, from_year, to_year FROM cars "
                          "WHERE id=?", (car_id,)).fetchone()
        for ch in ch_ids:
            if ch not in reg:
                missing.append(f"{car_id}:{ch}")
                continue
            if ch in claimed:
                twice.append(f"{ch} ({claimed[ch]} and {car_id})")
            claimed[ch] = car_id
            if reg[ch]["constructor_id"] != car["constructor_id"]:
                wrongcons.append(f"{ch} is {reg[ch]['constructor_id']}, "
                                 f"{car_id} is {car['constructor_id']}")
            fy, ly = reg[ch]["first_year"], reg[ch]["last_year"]
            if fy is not None and fy < car["from_year"]:
                outside.append(f"{ch} was entered in {fy}, before {car_id} "
                               f"existed ({car['from_year']})")
            if ly is not None and ly > (car["to_year"] or car["from_year"]):
                late.append(f"{ch} last entered {ly}, {car_id} lived "
                            f"{car['from_year']}-{car['to_year']}")
    check("every chassis a car claims is in the register", not missing,
          "; ".join(missing))
    check("a claimed chassis belongs to the car's constructor", not wrongcons,
          "; ".join(wrongcons))
    check("no chassis is claimed by two cars", not twice, "; ".join(twice))
    check("no claimed chassis was entered before its car existed", not outside,
          "; ".join(outside))
    # A chassis outliving the car's authored life is normal and not an error. The
    # two fields mean different things: `cars.to_year` is the works career, and
    # the entry lists record every entry including the privateers who bought the
    # thing afterwards. Ferrari 500s were still being entered in 1957, four years
    # after the works team moved on. This was a warning for three versions
    # (PM-20) before the register rows were read: de Tomaso's Ferrari 500 in
    # 1957, Dochnal's and Blokdyk's Cooper T51s in 1963, Courage's and Irwin's
    # Lotus 25s in 1967 are all real entries. Pinned by identity, so a fourth
    # case - a privateer, or a CAR_CHASSIS typo pointing at a chassis raced
    # after the works career, which `outside` cannot see - is read before it
    # rides along.
    # The year is pinned with the chassis: a register harvest that moved
    # lotus-25's last entry to 1985 would otherwise pass unread.
    _late_cars = {(m.group(1), int(m.group(2))) for m in
                  (re.match(r"(\S+) last entered (\d{4})", entry) for entry in late) if m}
    _late_declared = {("ferrari-500", 1957), ("cooper-t51", 1963), ("lotus-25", 1967)}
    _fmt_late = lambda pairs: ", ".join(f"{c} {y}" for c, y in sorted(pairs)) or "none"
    check("the chassis entered after their car's works career are the three declared privateer cases",
          _late_cars == _late_declared,
          f"undeclared: {_fmt_late(_late_cars - _late_declared)}; "
          f"no longer late: {_fmt_late(_late_declared - _late_cars)}")
    print(f"  [info] the 29 curated cars cover {len(claimed)} register chassis")

    bad = con.execute("""SELECT COUNT(*) FROM chassis c WHERE c.car_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM cars x WHERE x.id = c.car_id)""").fetchone()[0]
    check("chassis.car_id -> cars", bad == 0, f"{bad} orphans")
    bad = con.execute("""SELECT COUNT(*) FROM race_entries e WHERE e.chassis_id
        IS NOT NULL AND NOT EXISTS
        (SELECT 1 FROM chassis c WHERE c.id = e.chassis_id)""").fetchone()[0]
    check("race_entries.chassis_id -> chassis", bad == 0, f"{bad} orphans")
    bad = con.execute("""SELECT COUNT(*) FROM race_entries e
        JOIN chassis c ON c.id = e.chassis_id
        WHERE c.constructor_id IS NOT NULL
          AND c.constructor_id <> e.constructor_id""").fetchone()[0]
    check("a linked chassis belongs to the entry's constructor", bad == 0,
          f"{bad} wrong")
    bad = con.execute("""SELECT COUNT(*) FROM race_entries e
        JOIN chassis c ON c.id = e.chassis_id JOIN races r ON r.id = e.race_id
        WHERE r.year < c.first_year OR r.year > c.last_year""").fetchone()[0]
    check("a linked chassis was entered in that season", bad == 0,
          f"{bad} outside")

    # Whichever rule made a link, the chassis must be one the entry lists
    # actually record for that constructor in that season. Rule one resolves a
    # constructor-season that names exactly one chassis; rule two resolves a
    # (season, round, driver) whose entrant names exactly one, which reaches into
    # seasons the first cannot. Neither may ever produce a chassis the source
    # does not put in that constructor's hands that year.
    # Where the entry names a constructor this register holds, the chassis must
    # be in THAT constructor's list. Where it does not - an Indianapolis chassis
    # maker, or one of the 67 F1 constructors this register still lacks - the
    # chassis must at least be in some entry list for that season, because the
    # entry that resolved it was matched on driver and round rather than on a
    # constructor id.
    stray = con.execute("""
        SELECT COUNT(*) FROM race_entries e JOIN races r ON r.id = e.race_id
        WHERE e.chassis_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM season_entrants se
            WHERE se.year = r.year
              AND (se.constructor_id = e.constructor_id
                   OR e.constructor_id IS NULL)
              AND ('+' || se.chassis_ids || '+') LIKE ('%+' || e.chassis_id || '+%'))
        """).fetchone()[0]
    check("every linked chassis is in an entry list for that season, and for "
          "that constructor where one is known", stray == 0, f"{stray} entries")

    # Rule two fills constructor_id on entries the pole and fastest-lap harvests
    # left blank. It is trusted there only because it was checked where the
    # answer was already known: the constructor F1DB gives must equal the one
    # the Wikipedia race harvest established, on every entry that has one.
    # build.py fails outright on a disagreement; this counts the agreement.
    nocons = con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE constructor_id IS NULL""").fetchone()[0]
    print(f"  [info] {tot - nocons} of {tot} race entries carry a constructor; "
          f"{nocons} still do not")

    # The reconciliation: derived from this database's race records, against the
    # figure published on the car's own article and read by a different route.
    over = con.execute("""SELECT full_name, wins, published_wins FROM chassis
        WHERE published_wins IS NOT NULL AND wins > published_wins""").fetchall()
    check("no chassis has more derived wins than its article publishes", not over,
          "; ".join(f"{r[0]} {r[1]}>{r[2]}" for r in over))
    cmp_ = con.execute("""SELECT COUNT(*) FROM chassis
        WHERE published_wins IS NOT NULL AND wins > 0""").fetchone()[0]
    exact = con.execute("""SELECT COUNT(*) FROM chassis
        WHERE published_wins IS NOT NULL AND wins > 0
          AND wins = published_wins""").fetchone()[0]
    print(f"  [info] {cmp_} chassis have both a derived and a published win "
          f"count; {exact} agree exactly")

    # A car and the chassis it covers hold some of the same figures, reached by
    # different routes. Where both are present they must agree.
    dis = con.execute("""SELECT c.full_name, ch.full_name, c.capacity_cc,
            ch.capacity_cc FROM cars c JOIN chassis ch ON ch.car_id = c.id
        WHERE c.capacity_cc IS NOT NULL AND ch.capacity_cc IS NOT NULL
          AND ABS(c.capacity_cc - ch.capacity_cc) > 5""").fetchall()
    warn("the curated and harvested engine capacities agree", not dis,
         "; ".join(f"{r[0]}: {r[2]} vs {r[1]} {r[3]}" for r in dis[:4]))

    lk = con.execute("SELECT COUNT(*) FROM race_entries WHERE chassis_id IS NOT NULL"
                     ).fetchone()[0]
    wonk = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
        WHERE chassis_id IS NOT NULL AND finish_position = 1""").fetchone()[0]
    nrace = con.execute("SELECT COUNT(*) FROM races WHERE status='completed'"
                        ).fetchone()[0]
    print(f"  [info] {lk} of {tot} race entries linked to a chassis "
          f"({100 * lk / tot:.0f}%); the winning chassis is known for "
          f"{wonk} of {nrace} races ({100 * wonk / nrace:.0f}%)")

    # A regulation limit may not be sitting in a per-car field pretending to be a
    # measurement. This is the check the 2026 rows exist to make possible.
    lim = {}
    for r in con.execute("SELECT from_year, to_year, field, value FROM regulation_limits"):
        for y in range(r[0], r[1] + 1):
            lim.setdefault(y, {})[r[2]] = r[3]
    leaked = []
    for tbl, wcol, bcol in (("cars", "weight_kg", "wheelbase_mm"),
                            ("chassis", "weight_kg", "wheelbase_mm")):
        yl = "from_year" if tbl == "cars" else "first_year"
        yh = "to_year" if tbl == "cars" else "last_year"
        for r in con.execute(f"""SELECT id, {yl}, {yh}, {wcol}, {bcol} FROM {tbl}
                WHERE {yl} IS NOT NULL AND ({wcol} IS NOT NULL OR {bcol} IS NOT NULL)"""):
            for y in range(r[1], (r[2] or r[1]) + 1):
                if r[3] is not None and lim.get(y, {}).get("minimum_weight_kg") == r[3]:
                    leaked.append(f"{tbl}.{r[0]} weight {r[3]} = the {y} minimum")
                if r[4] is not None and lim.get(y, {}).get("maximum_wheelbase_mm") == r[4]:
                    leaked.append(f"{tbl}.{r[0]} wheelbase {r[4]} = the {y} maximum")
    check("no regulation limit is stored as a car's own figure", not leaked,
          "; ".join(leaked[:4]))
    # The harvested power note is the article's own `power` field, which is
    # meant to state a figure. One with no digit in it states none - the
    # {{Racing car}} template's unfilled `NNN hp` placeholder, or a "See
    # Table" pointing at a section of the article that does not come with the
    # value - and power_bhp beside it is already NULL, because number()
    # refuses the same string. build.py drops it; this is what says so.
    # cars.power_note is curated prose, not a harvested field, and is not
    # held to this: "peak power was never published" is a good note.
    empty = [r[0] for r in con.execute(
        """SELECT full_name FROM chassis WHERE power_note IS NOT NULL
             AND power_note NOT GLOB '*[0-9]*'""")]
    check("no harvested power note names a power without a number", not empty,
          f"{len(empty)}: " + "; ".join(empty[:4]))
    overlaps = []
    for field in [r[0] for r in con.execute("SELECT DISTINCT field FROM regulation_limits")]:
        spans = con.execute("SELECT from_year, to_year FROM regulation_limits WHERE field = ? "
                            "ORDER BY from_year", (field,)).fetchall()
        for (a0, a1), (b0, b1) in zip(spans, spans[1:]):
            if b0 <= a1:
                overlaps.append(f"{field} {a0}-{a1} and {b0}-{b1}")
    check("no two spans of one regulation limit overlap", not overlaps, "; ".join(overlaps[:4]))
    # The regulations set a cap before the year is raced, so one year beyond
    # the register may carry a figure; none before 2021, none further on. The
    # two bounds were one MAX(year) FROM seasons while the last season in the
    # register was also the one being run. A calendar announced above it parts
    # them: read from the register alone, next year's OPTIONAL figure becomes
    # a required one the moment its calendar lands, which is the reverse of
    # what this check says. Required runs to the season being RUN; the slack
    # runs one year past whatever the register holds.
    run = season_in_progress()
    ahead = con.execute("SELECT MAX(year) FROM seasons").fetchone()[0]
    capped = {y for y in lim if "cost_cap_usd" in lim[y]}
    required, allowed = set(range(2021, run + 1)), set(range(2021, ahead + 2))
    check("the cost cap has a figure for every year from 2021 to the current season",
          required <= capped <= allowed,
          f"missing {sorted(required - capped)}, unexpected {sorted(capped - allowed)}")
    # The one other place a cap figure is written is the 2026 regulation_changes
    # row, in prose. It has to agree with the schedule, or one of them is wrong.
    prose = con.execute("SELECT detail FROM regulation_changes WHERE year = 2026 "
                        "AND category = 'financial'").fetchone()
    cap26 = lim.get(2026, {}).get("cost_cap_usd")
    cap25 = lim.get(2025, {}).get("cost_cap_usd")
    per26 = lim.get(2026, {}).get("cost_cap_per_competition_usd")
    check("the 2026 cost cap prose repeats the schedule's figures",
          bool(prose) and cap26 and cap25 and per26
          and all(f"US${v:,.0f}" in prose[0] for v in (cap26, cap25, per26)),
          (prose or ("no row",))[0][:80])
    # The season grid view: one row per season, and its figures pinned to
    # direct counts the view could get wrong - a year offset, a dropped
    # population - rather than to bounds it satisfies by construction. The
    # review of #73 showed the first cut's bounds were identities.
    nseasons = con.execute("SELECT COUNT(*) FROM seasons").fetchone()[0]
    ngrid = con.execute("SELECT COUNT(*) FROM v_season_grid").fetchone()[0]
    check("v_season_grid has one row per season", ngrid == nseasons, f"{ngrid} vs {nseasons}")
    wrong = []
    SAMPLE = (1950, 1959, 1994, season_in_progress())
    for year in SAMPLE:
        g = con.execute("SELECT * FROM v_season_grid WHERE year = ?", (year,)).fetchone()
        direct = con.execute("""SELECT
            (SELECT COUNT(DISTINCT e.driver_id) FROM race_entries e JOIN races r ON r.id = e.race_id
              WHERE r.year = ?1),
            (SELECT COUNT(DISTINCT f1db_constructor_id) FROM season_entrants WHERE year = ?1),
            (SELECT COUNT(DISTINCT engine_manufacturer_id) FROM season_entrants
              WHERE year = ?1 AND engine_manufacturer_id IS NOT NULL),
            (SELECT COUNT(*) FROM races WHERE year = ?1 AND status = 'completed')""",
            (year,)).fetchone()
        got = (g["drivers"], g["constructors"], g["engine_manufacturers"], g["races_run"])
        if got != tuple(direct):
            wrong.append(f"{year}: view {got}, direct {tuple(direct)}")
    check("v_season_grid agrees with direct counts for "
          + ", ".join(map(str, SAMPLE[:-1])) + f" and {SAMPLE[-1]}",
          not wrong, "; ".join(wrong))
    # And the one fact about the Indianapolis era the first cut got wrong: in
    # 1950 more constructors entered than the curated register names.
    g50 = con.execute("SELECT constructors FROM v_season_grid WHERE year = 1950").fetchone()[0]
    check("1950's grid counts the Indianapolis builders among its constructors", g50 >= 20, f"{g50}")
    bad = [f"{r[0]}: {r[1]} engine makers, {r[2]} constructors" for r in con.execute(
        "SELECT year, engine_manufacturers, constructors FROM v_season_grid "
        "WHERE engine_manufacturers > constructors * 2")]
    check("no season shows more than twice as many engine makers as constructors", not bad, "; ".join(bad[:4]))
    # One of the weekend limits the race records can test: no classified
    # finisher in a season the rule covers completed less than 90% of the
    # winner's laps. The rule is read from the table, so a wrong figure fails.
    pct = con.execute("SELECT value, from_year, to_year FROM regulation_limits "
                      "WHERE field = 'classification_min_distance_pct'").fetchall()
    under = 0
    for value, y0, y1 in pct:
        under += con.execute("""SELECT COUNT(*) FROM race_entries e JOIN races r ON r.id = e.race_id
            JOIN race_entries w ON w.race_id = r.id AND w.finish_position = 1
            WHERE r.year BETWEEN ? AND ? AND e.finish_position IS NOT NULL
              AND e.laps_completed IS NOT NULL AND w.laps_completed IS NOT NULL
              AND e.laps_completed < CAST(w.laps_completed * ? / 100 AS INTEGER)""",
            (y0, y1, value)).fetchone()[0]
    check("no classified finisher fell below the season's classification threshold",
          pct and under == 0, f"{under} classified below the threshold in {len(pct)} span(s)")
    nlim = con.execute("SELECT COUNT(*) FROM regulation_limits").fetchone()[0]
    print(f"  [info] {nlim} regulation limits recorded, covering "
          + ", ".join(str(r[0]) for r in con.execute(
              "SELECT DISTINCT field FROM regulation_limits ORDER BY field")))


@section('TIMING AND RADIO')
def timing_and_radio():
    for t in ("race_timing", "laps", "stints", "pit_stops",
              "race_control_messages", "team_radio"):
        n_ = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"  [info] {t:<22} {n_} rows")
    # These tables are filled by tools/fastf1_load.py, which needs network access.
    # Every check below holds whether they are empty or full.
    bad = con.execute("""SELECT COUNT(*) FROM laps l WHERE NOT EXISTS
        (SELECT 1 FROM races r WHERE r.id = l.race_id)""").fetchone()[0]
    check("every lap belongs to a race", bad == 0, f"{bad} orphans")
    bad = con.execute("""SELECT COUNT(*) FROM laps
        WHERE lap_seconds IS NOT NULL AND lap_seconds <= 0""").fetchone()[0]
    check("lap times are positive", bad == 0, f"{bad} at or below zero")

    # A lap over fifteen minutes is not implausible, it is a red flag: the
    # suspension is recorded inside the lap it happened on. The 2011 Canadian
    # Grand Prix, the longest race in the sport's history, has a lap 25 of two
    # hours and five minutes. What WOULD be implausible is a driver having many
    # of them in one race, because that would mean the race was stopped more
    # times than any race ever has been.
    worst = con.execute("""SELECT MAX(n) FROM (SELECT COUNT(*) n FROM laps
        WHERE lap_seconds > 900 GROUP BY race_id, driver_key)""").fetchone()[0] or 0
    check("no driver has more long laps than a race has had red flags",
          worst <= 4, f"one driver has {worst} laps over 15 minutes in one race")
    longr = con.execute("""SELECT COUNT(DISTINCT race_id) FROM laps
        WHERE lap_seconds > 900""").fetchone()[0]
    if longr:
        print(f"  [info] {longr} races contain a lap over 15 minutes; every one "
              f"is a red flag recorded inside the lap it interrupted")

    # Each source reaches back as far as it reaches and no further. FastF1 reads
    # the F1 live timing API, which begins in 2018 and for which nothing earlier
    # exists. Jolpica's dump has per-lap times from 1996 - twenty-two seasons
    # further back - and pit stops from 2011.
    for src, first, what in (("fastf1", 2018, "the live timing API"),
                             ("jolpica", 1996, "Jolpica's dump")):
        bad = con.execute("""SELECT COUNT(*) FROM laps l JOIN races r
            ON r.id = l.race_id WHERE l.source = ? AND r.year < ?""",
            (src, first)).fetchone()[0]
        check(f"no {src} lap predates {first}, where {what} starts", bad == 0,
              f"{bad} rows")
    bad = con.execute("""SELECT COUNT(*) FROM pit_stops p JOIN races r
        ON r.id = p.race_id WHERE p.source = 'jolpica' AND r.year < 2011"""
        ).fetchone()[0]
    check("no jolpica pit stop predates 2011", bad == 0, f"{bad} rows")

    # Where two independent sources cover the same race, they must agree about
    # how many laps each driver ran. This is the reason both are allowed to hold
    # the same race rather than one overwriting the other.
    disagree = con.execute("""
        SELECT COUNT(*) FROM (
            SELECT l.race_id, l.driver_id
            FROM laps l WHERE l.driver_id IS NOT NULL
            GROUP BY l.race_id, l.driver_id
            HAVING COUNT(DISTINCT l.source) > 1
               AND COUNT(*) FILTER (WHERE l.source = 'fastf1')
                 <> COUNT(*) FILTER (WHERE l.source = 'jolpica'))""").fetchone()[0]
    check("where two sources hold the same race they agree on the lap count",
          disagree == 0, f"{disagree} driver-races differ")
    both = con.execute("""SELECT COUNT(*) FROM (SELECT race_id FROM laps
        GROUP BY race_id HAVING COUNT(DISTINCT source) > 1)""").fetchone()[0]
    print(f"  [info] {both} races are covered by both FastF1 and Jolpica and can "
          f"be compared lap for lap")

    # The strongest thing the lap data does: it re-derives a fact this database
    # already holds, by a route that shares nothing with how it was established.
    #
    # race_entries.fastest_lap came from the Wikipedia pole and fastest-lap
    # harvest. The laps came from Jolpica's dump. Take the quickest lap each
    # source FLAGS as an entry's fastest, and the driver it names must be the
    # driver already stored.
    #
    # Use the flag, not the raw minimum. At the 2021 Portuguese Grand Prix
    # Verstappen's 1:19.849 is the quickest time in the file and Bottas's
    # 1:19.865 is the one flagged - because Verstappen's was struck for track
    # limits. Ranking on time alone reports five disagreements, all of which are
    # this. Ranking on the flag reports none.
    fl_bad = con.execute("""
        WITH flagged AS (
            SELECT race_id, driver_id, lap_seconds,
                   ROW_NUMBER() OVER (PARTITION BY race_id ORDER BY lap_seconds) rn
            FROM laps WHERE is_fastest_lap = 1 AND lap_seconds IS NOT NULL
                        AND driver_id IS NOT NULL)
        SELECT r.year, r.name_used, f.driver_id, e.driver_id
        FROM flagged f JOIN races r ON r.id = f.race_id
        JOIN race_entries e ON e.race_id = f.race_id AND e.fastest_lap = 1
        WHERE f.rn = 1 AND f.driver_id <> e.driver_id
        ORDER BY r.year""").fetchall()
    # Exactly the population the check above compares - same three conditions.
    # Counting a wider one would let the "they agree on all of them" line below
    # include races the check never looked at, and that line is quoted in the
    # README and the build notes.
    fl_n = con.execute("""SELECT COUNT(DISTINCT l.race_id) FROM laps l
        JOIN race_entries e ON e.race_id = l.race_id AND e.fastest_lap = 1
        WHERE l.is_fastest_lap = 1 AND l.lap_seconds IS NOT NULL
          AND l.driver_id IS NOT NULL""").fetchone()[0]
    check("the fastest lap derived from lap times matches the one already stored",
          not fl_bad,
          "; ".join(f"{r[0]} {r[1]}: laps say {r[2]}, stored {r[3]}"
                    for r in fl_bad[:5]))
    if fl_n:
        print(f"  [info] {fl_n} races have both a stored fastest-lap setter and "
              f"per-lap times; the two agree on all of them")
    bad = con.execute("""SELECT COUNT(*) FROM stints
        WHERE lap_end IS NOT NULL AND lap_start IS NOT NULL AND lap_end < lap_start"""
        ).fetchone()[0]
    check("stints run forwards", bad == 0, f"{bad} reversed")
    bad = con.execute("""SELECT COUNT(*) FROM team_radio
        WHERE notable = 0 AND audio_url IS NULL AND transcript IS NULL""").fetchone()[0]
    check("every radio row has a clip or a transcript", bad == 0, f"{bad} empty")
    bad = con.execute("""SELECT COUNT(*) FROM race_timing t WHERE
        (t.pole_seconds IS NOT NULL AND t.fastest_lap_seconds IS NOT NULL
         AND t.fastest_lap_seconds < t.pole_seconds * 0.9)""").fetchone()[0]
    check("a race fastest lap is not wildly quicker than pole", bad == 0, f"{bad} suspect")


@section('CIRCUITS AND VENUES')
def circuits_and_venues():
    n, nul = con.execute(
        "SELECT COUNT(*), SUM(circuit_id IS NULL) FROM races").fetchone()
    check("every race has a circuit", nul == 0, f"{nul} of {n} races with no circuit")

    # The authored first_gp/last_gp on a circuit must agree with the race records.
    # last_gp NULL means "still in use", so the last race there must be recent.
    bad = []
    for r in con.execute("""SELECT c.id, c.first_gp, c.last_gp,
            MIN(r.year) mn, MAX(r.year) mx, COUNT(r.id) n
        FROM circuits c LEFT JOIN races r ON r.circuit_id = c.id
        GROUP BY c.id ORDER BY c.id"""):
        # races here include rounds already on a published calendar
        if r["n"] == 0:
            if r["first_gp"] is not None or r["last_gp"] is not None:
                bad.append(f"{r['id']}: no races but dated {r['first_gp']}-{r['last_gp']}")
            continue
        if r["first_gp"] != r["mn"]:
            bad.append(f"{r['id']}: first_gp {r['first_gp']} vs first race {r['mn']}")
        # Open-ended means still in use: on this season's calendar or the
        # previous one. Counted back from the season being run, not from a
        # typed year that would have quietly let a lapsed venue stay open
        # (CR-07).
        if r["last_gp"] is None and r["mx"] < season_in_progress() - 1:
            bad.append(f"{r['id']}: open-ended but last race {r['mx']}")
        if r["last_gp"] is not None and r["last_gp"] != r["mx"]:
            bad.append(f"{r['id']}: last_gp {r['last_gp']} vs last race {r['mx']}")
    check("circuit first/last GP agree with the race records", not bad, "; ".join(bad))

    bad = con.execute("""SELECT COUNT(*) FROM circuits c WHERE c.gp_count !=
        (SELECT COUNT(*) FROM races r WHERE r.circuit_id = c.id
                                      AND r.status = 'completed')""").fetchone()[0]
    check("circuits.gp_count equals the races held there", bad == 0, f"{bad} wrong")

    held, sched = con.execute("""SELECT SUM(gp_count),
        (SELECT COUNT(*) FROM races WHERE status != 'completed') FROM circuits""").fetchone()
    check("circuit race counts sum to the race table", held + sched == n,
          f"{held} held + {sched} scheduled vs {n} races")

    # Where a circuit has layout rows at all, they must form a complete,
    # non-overlapping timeline of the configurations used for championship races.
    bad = con.execute("""SELECT COUNT(*) FROM circuit_layouts a
        JOIN circuit_layouts b ON a.circuit_id = b.circuit_id AND a.id < b.id
        WHERE a.by_year = 1 AND b.by_year = 1
          AND a.from_year <= COALESCE(b.to_year, 9999)
          AND b.from_year <= COALESCE(a.to_year, 9999)""").fetchone()[0]
    check("the by-year layout timelines do not overlap", bad == 0,
          f"{bad} overlapping pairs")

    bad = con.execute("""SELECT r.year, r.round, r.circuit_id FROM races r
        WHERE r.circuit_id IN (SELECT circuit_id FROM circuit_layouts)
          AND NOT EXISTS (SELECT 1 FROM circuit_layouts l
              WHERE l.circuit_id = r.circuit_id AND l.by_year = 1
                AND r.year >= l.from_year
                AND (l.to_year IS NULL OR r.year <= l.to_year))""").fetchall()
    check("every race at a multi-layout circuit falls in the timeline", not bad,
          "; ".join(f"{r['year']} r{r['round']} {r['circuit_id']}" for r in bad[:6]))

    # Every race must resolve to exactly one layout, whether by its override key
    # or by the timeline. v_race_venues would silently duplicate a race otherwise.
    dup = con.execute("""SELECT COUNT(*) FROM (SELECT race_id FROM v_race_venues
        GROUP BY race_id HAVING COUNT(*) > 1)""").fetchone()[0]
    check("v_race_venues returns one row per race", dup == 0, f"{dup} duplicated")
    check("v_race_venues covers every race",
          con.execute("SELECT COUNT(*) FROM v_race_venues").fetchone()[0] == n)

    bad = con.execute("""SELECT circuit_id, layout_key FROM circuit_layouts l
        WHERE by_year = 0 AND NOT EXISTS (SELECT 1 FROM races r
            WHERE r.circuit_id = l.circuit_id AND r.layout_key = l.layout_key)""").fetchall()
    check("every one-off layout is claimed by a race", not bad,
          "; ".join(f"{r[0]}:{r[1]}" for r in bad))

    bad = con.execute("""SELECT COUNT(*) FROM races r WHERE r.layout_key IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM circuit_layouts l
            WHERE l.circuit_id = r.circuit_id AND l.layout_key = r.layout_key)""").fetchone()[0]
    check("every race layout override resolves", bad == 0, f"{bad} dangling")

    bad = con.execute("""SELECT COUNT(*) FROM circuit_layouts l WHERE by_year = 1
        AND NOT EXISTS (SELECT 1 FROM races r WHERE r.circuit_id = l.circuit_id
           AND r.year >= l.from_year
           AND (l.to_year IS NULL OR r.year <= l.to_year))""").fetchone()[0]
    warn("every layout hosted at least one championship race", bad == 0,
         f"{bad} unused layouts")

    # --- the F1DB outlines (AF-03). A drawing of every layout, keyed by
    # F1DB's id, with circuit_id derived in build.py from the races that ran
    # it. The trace in circuit_geometry is a different fact and is not
    # compared with it; F1DB's length for the layout is compared with the
    # register's, below, because that is what catches the wrong layout. The
    # path goes into an attribute on every page that draws it, so its syntax
    # is checked here as well as at the fetch.
    completed, undrawn = con.execute("""SELECT COUNT(*), SUM(f1db_layout_id IS NULL)
        FROM races WHERE status = 'completed'""").fetchone()
    check("every completed race names the F1DB layout it ran", not undrawn,
          f"{undrawn} of {completed} without one")
    sched, sched_undrawn = con.execute("""SELECT COUNT(*), SUM(f1db_layout_id IS NULL)
        FROM races WHERE status != 'completed'""").fetchone()
    warn("every scheduled race names the F1DB layout it will run", not sched_undrawn,
         f"{sched_undrawn} of {sched} without one; F1DB publishes a round's layout "
         f"with its calendar, so this closes on a refresh")
    bad = con.execute("""SELECT COUNT(*) FROM races r JOIN circuit_outlines o
        ON o.f1db_layout_id = r.f1db_layout_id WHERE o.circuit_id <> r.circuit_id""").fetchone()[0]
    check("no race is drawn with another circuit's outline", bad == 0, f"{bad} races")
    bad = con.execute("""SELECT COUNT(*) FROM circuit_layouts l JOIN circuit_outlines o
        ON o.f1db_layout_id = l.f1db_layout_id WHERE o.circuit_id <> l.circuit_id""").fetchone()[0]
    check("no layout is drawn with another circuit's outline", bad == 0, f"{bad} layouts")
    paths = con.execute("SELECT f1db_layout_id, path FROM circuit_outlines").fetchall()
    bad = [lid for lid, d in paths if not re.fullmatch(harvest_module().SVG_PATH_DATA, d or "")]
    check("every outline is SVG path data and nothing else", not bad, ", ".join(bad[:5]))
    # A path is stored bare, and one F1DB asset positioned its path with a
    # transform on the element: stored as written it drew an empty, credited
    # figure on two pages, and no check saw it (PR #273). The fetch applies
    # the translate; this is where a drawing that landed outside its box
    # would show.
    bad = [lid for lid, d in paths if not harvest_module().svg_path_in_box(d or "")]
    check("every outline lies inside its 500-unit box", not bad, ", ".join(bad[:5]))
    bad = con.execute("""SELECT COUNT(*) FROM circuits c WHERE EXISTS
        (SELECT 1 FROM races r WHERE r.circuit_id = c.id) AND NOT EXISTS
        (SELECT 1 FROM circuit_outlines o WHERE o.circuit_id = c.id)""").fetchone()[0]
    check("every circuit that has hosted a race has an outline", bad == 0,
          f"{bad} circuits without one")
    bad = con.execute("""SELECT COUNT(*) FROM circuit_outlines o WHERE NOT EXISTS
        (SELECT 1 FROM races r WHERE r.f1db_layout_id = o.f1db_layout_id)""").fetchone()[0]
    check("every outline was run by a race here", bad == 0, f"{bad} outlines")
    # The wrong layout of the right circuit passes everything above: one
    # race_layouts.txt row moved from spa-francorchamps-1 to -4 built clean
    # and drew the 7 km Spa for 1955 (PR #273's review). Where the register
    # knows the length actually raced - v_race_venues, figures = 'as raced' -
    # F1DB's figure for the layout the race names must agree with it. 483
    # races today, the worst 0.087 km apart (Interlagos 7.960 v 7.873), so
    # 0.15 km lets two measurements of one circuit through and stops a
    # layout of another length. It constrains no more than that: the 689
    # races reported at the current layout are not reached, and two F1DB
    # layouts of one circuit at the same length (montreal-1 and -2) swap
    # unseen. The id itself is F1DB's own circuitLayoutId, refreshed with
    # the calendar.
    bad = con.execute("""SELECT r.year, r.round, r.f1db_layout_id, v.length_km, o.length_km
        FROM races r JOIN v_race_venues v ON v.race_id = r.id
        JOIN circuit_outlines o ON o.f1db_layout_id = r.f1db_layout_id
        WHERE v.figures = 'as raced' AND v.length_km IS NOT NULL AND o.length_km IS NOT NULL
          AND ABS(v.length_km - o.length_km) > 0.15""").fetchall()
    check("every race's F1DB layout is the length the register says it raced, within 0.15 km",
          not bad, "; ".join(f"{y} r{rd} {lid}: {a} v {b} km" for y, rd, lid, a, b in bad[:4]))
    outlines, drawn, split = con.execute("""SELECT
        (SELECT COUNT(*) FROM circuit_outlines),
        SUM(f1db_layout_id IS NOT NULL), SUM(f1db_layout_id IS NULL) FROM circuit_layouts""").fetchone()
    print(f"  [info] {outlines} F1DB outlines; {drawn} of this register's {drawn + split} "
          f"layouts are drawn by one, {split} span several F1DB layouts")

    # A Grand Prix that has only ever run at one circuit must not have picked up
    # a second one; the register in data/events.py depends on that staying true.
    bad = con.execute("""SELECT gp_id, COUNT(DISTINCT circuit_id) n,
            GROUP_CONCAT(DISTINCT circuit_id) ids FROM races
        GROUP BY gp_id HAVING n > 1""").fetchall()
    print(f"  [info] {len(bad)} Grands Prix have used more than one circuit")

    bad = con.execute("""SELECT COUNT(*) FROM circuits c WHERE NOT EXISTS
        (SELECT 1 FROM races r WHERE r.circuit_id = c.id)""").fetchone()[0]
    warn("every circuit in the register has hosted a race", bad == 0,
         f"{bad} with none (expected: 1, the Nurburgring Sudschleife, "
         f"plus any venue on a future calendar)")


@section('OVERLAP CHECKS')
def overlap_checks():
    rows = con.execute("""SELECT chain_id, entity_name, from_year, to_year
        FROM constructor_lineage ORDER BY chain_id, sequence""").fetchall()
    overlap = []
    prev = None
    for r in rows:
        if prev and prev["chain_id"] == r["chain_id"]:
            pend = prev["to_year"] or 9999
            if r["from_year"] < pend:
                overlap.append(f"{r['chain_id']}: {prev['entity_name']} ends {pend}, "
                               f"{r['entity_name']} starts {r['from_year']}")
        prev = r
    warn("lineage periods do not overlap", not overlap, "; ".join(overlap))


@section('CONFIDENCE DISTRIBUTION')
def confidence_distribution():
    for tbl in ("drivers", "constructors", "circuits", "seasons"):
        dist = con.execute(f"""SELECT confidence, COUNT(*) n FROM {tbl}
            GROUP BY confidence ORDER BY n DESC""").fetchall()
        print(f"  {tbl:<14}" + "  ".join(f"{r['confidence']}={r['n']}" for r in dist))
    bad = con.execute("""SELECT COUNT(*) FROM drivers
        WHERE confidence NOT IN (SELECT confidence FROM provenance)""").fetchone()[0]
    check("all confidence values are in the provenance ladder", bad == 0)

    # ---------------------------------------------------------------------------
    # ---------------------------------------------------------------------------


@section('PROVENANCE RESOLVES')
def provenance_resolves():
    # A tier is only worth anything if the database can say where the row came
    # from. These checks are the v2.16 instalment of
    # docs/DERIVED-CONFIDENCE.md: every row must reach a registry entry, by its
    # own `source` or by its table's, and authored content must stay at or
    # below 'medium' because nothing can contradict it.
    reg = con.execute("SELECT id, url, authority FROM source_registry").fetchall()
    pat = con.execute("""SELECT p.pattern, p.source_id, s.authority
        FROM source_patterns p JOIN source_registry s ON s.id = p.source_id
        ORDER BY p.id""").fetchall()

    def resolve(url):
        """The longest matching registry url wins, then the patterns in order."""
        best = None
        for r in reg:
            if r["url"] and url.startswith(r["url"].rstrip("/")):
                if best is None or len(r["url"]) > len(best["url"]):
                    best = r
        if best:
            return best["id"], best["authority"]
        for p in pat:
            if re.match(p["pattern"], url):
                return p["source_id"], p["authority"]
        return None, None

    conf_tables = []
    for (t,) in con.execute("""SELECT name FROM sqlite_master WHERE type='table'
                               AND name <> 'provenance' ORDER BY name"""):
        cols = [c[1] for c in con.execute(f'PRAGMA table_info("{t}")')]
        if "confidence" in cols:
            conf_tables.append((t, "source" in cols))

    unresolved, seen_forbidden = [], []
    for t, has_source in conf_tables:
        if not has_source:
            continue
        for r in con.execute(f'SELECT DISTINCT source FROM "{t}" WHERE source IS NOT NULL'):
            sid, auth = resolve(r[0])
            if sid is None:
                unresolved.append(f"{t}: {r[0]}")
            elif auth == "forbidden":
                seen_forbidden.append(f"{t}: {r[0]}")
    check("every source resolves to a registry entry", not unresolved,
          f"{len(unresolved)} unresolved, e.g. " + "; ".join(unresolved[:3]))
    check("no row cites a forbidden source", not seen_forbidden,
          "; ".join(seen_forbidden[:3]))

    nosource = [t for t, has_source in conf_tables if not has_source
                and not con.execute("SELECT 1 FROM table_provenance WHERE tbl=?",
                                    (t,)).fetchone()]
    check("every table carrying confidence declares a provenance", not nosource,
          "; ".join(nosource))

    over = []
    for (t,) in con.execute("""SELECT tp.tbl FROM table_provenance tp
            JOIN source_registry s ON s.id = tp.source_id
            WHERE s.authority = 'authored'"""):
        n = con.execute(f"""SELECT COUNT(*) FROM "{t}" WHERE confidence IN
            (SELECT confidence FROM provenance WHERE rank < 4)""").fetchone()[0]
        if n:
            over.append(f"{t}: {n}")
    check("no authored row sits above 'medium'", not over, "; ".join(over))

    auth = con.execute("""SELECT s.authority, COUNT(*) n FROM table_provenance tp
        JOIN source_registry s ON s.id = tp.source_id
        GROUP BY 1 ORDER BY n DESC""").fetchall()
    print("        table provenance: " +
          ", ".join(f"{r['authority']}={r['n']}" for r in auth))

    # DA-03. The build now STORES what a row's source resolves to, so "which
    # source, under what licence" is a join. The checks above read only the
    # tables carrying `confidence`, which is how pit_stops' 22,506 rows sat
    # unresolved behind a passing check: it has `source` and no `confidence`.
    # These read every table carrying `source`, and hold the stored answer to
    # this section's own copy of the rule.
    sourced = []
    for (t,) in con.execute("""SELECT name FROM sqlite_master WHERE type='table'
                               AND name <> 'source_registry' ORDER BY name"""):
        cols = [c[1] for c in con.execute(f'PRAGMA table_info("{t}")')]
        if "source" in cols:
            sourced.append((t, "source_id" in cols))
    missing = [t for t, has in sourced if not has]
    check("every table carrying `source` carries `source_id`", not missing,
          ", ".join(missing))

    # Rows a local loader added after the build have a source and no id,
    # which is the same state F1_LOCAL_TIMING already downgrades: the copy
    # is fine to hold and not the file to publish.
    verdict = warn if LOCAL_TIMING else check
    wrong, blank, spurious, total = [], [], [], 0
    for t, has in sourced:
        if not has:
            continue
        for r in con.execute(f"""SELECT source, source_id, COUNT(*) n FROM "{t}"
                                 GROUP BY source, source_id"""):
            text = (r["source"] or "").strip()
            if not text:
                if r["source_id"] is not None:
                    spurious.append(f"{t}: {r['n']} row(s)")
                continue
            total += r["n"]
            if r["source_id"] is None:
                blank.append(f"{t}: {r['n']} row(s) cite {text}")
            elif r["source_id"] != resolve(r["source"])[0]:
                wrong.append(f"{t}: {text} stored as {r['source_id']}, "
                             f"resolves to {resolve(r['source'])[0]}")
    verdict("every row with a source has its source_id", not blank,
            "; ".join(blank[:3]))
    # This copy of the rule is the build's, restated, so what it catches is
    # drift: a `source` written after store_source_ids ran, or the two copies
    # diverging. The independent route to a row's terms is the host reading
    # in REDISTRIBUTION, which is held to the stored id there.
    check("every stored source_id is the entry its source resolves to",
          not wrong, "; ".join(wrong[:3]))
    check("no row without a source carries a source_id", not spurious,
          "; ".join(spurious[:3]))
    print(f"        source_id: {total:,} sourced rows across "
          f"{sum(1 for _, has in sourced if has)} tables")

    # The use the column was stored for. f1.db carries no OpenStreetMap data
    # - the centrelines ship beside it as f1-geometry.db, under ODbL - and
    # with source_id that is one query over every sourced table, not a
    # property of circuit_geometry alone.
    osm = [r[0] for r in con.execute(
        "SELECT id FROM source_registry "
        "WHERE ',' || domains || ',' LIKE '%,openstreetmap.org,%'")]
    cite = []
    for t, has in sourced:
        if has and osm:
            n = con.execute(
                f'SELECT COUNT(*) FROM "{t}" WHERE source_id IN '
                f'({",".join("?" * len(osm))})', osm).fetchone()[0]
            if n:
                cite.append(f"{t}: {n}")
    check("no sourced row in f1.db cites OpenStreetMap", bool(osm) and not cite,
          "; ".join(cite) if osm else "the registry names no OpenStreetMap entry")


# ---------------------------------------------------------------------------
# CLAIMS
#
# PM-14. `claims` holds, per column of a row, the value each source gave -
# the one shape for what the encodings recorded several ways. Three things
# make it worth trusting: every kind of claim is declared, every column it
# backs is exactly its claims in both directions, and the source each claim
# cites is held to the data module that says where the value came from, not
# only to the build that copied it.
# ---------------------------------------------------------------------------
def claim_key_columns(table):
    """The columns a claim's row_key joins, in key order, or None.

    The primary key, unless it is a bare INTEGER id: those are the build's
    business and may be renumbered (README, "which ids a reader may keep"),
    and a claim keyed on one would silently re-point at another row.
    """
    info = con.execute(f'PRAGMA table_info("{table}")').fetchall()
    pk = [r["name"] for r in sorted(info, key=lambda r: r["pk"]) if r["pk"]]
    if not pk:
        return None
    if len(pk) == 1 and next(r for r in info if r["name"] == pk[0])["type"].upper() == "INTEGER":
        return None
    return pk


@section('CLAIMS')
def claims():
    from data import current as _N
    from data import drivers as _D
    harvest = harvest_module()

    held = {(r[0], r[1]): r[2] for r in con.execute(
        "SELECT tbl, field, COUNT(*) FROM claims GROUP BY tbl, field")}
    undeclared = sorted(f"{t}.{f}" for t, f in held if (t, f) not in _N.CLAIM_FIELDS)
    check("every claim is of a kind CLAIM_FIELDS declares", not undeclared,
          ", ".join(undeclared))
    empty = sorted(f"{t}.{f}" for t, f in _N.CLAIM_FIELDS if (t, f) not in held)
    check("every kind CLAIM_FIELDS declares holds a claim", not empty,
          ", ".join(empty))

    # A claim names a column of a row. One that names no column, no row, or
    # two rows is worse than none.
    unkeyed, nocolumn, dangling = [], [], []
    for t, f in sorted(_N.CLAIM_FIELDS):
        exists = con.execute("SELECT 1 FROM sqlite_master WHERE type='table' "
                             "AND name=?", (t,)).fetchone()
        key = claim_key_columns(t) if exists else None
        if key is None:
            unkeyed.append(t)
            continue
        if f not in [c[1] for c in con.execute(f'PRAGMA table_info("{t}")')]:
            nocolumn.append(f"{t}.{f}")
            continue
        expr = " || '|' || ".join(f'CAST(x."{c}" AS TEXT)' for c in key)
        n = con.execute(f"""SELECT COUNT(*) FROM claims c WHERE c.tbl = ?
            AND c.field = ?
            AND (SELECT COUNT(*) FROM "{t}" x WHERE {expr} = c.row_key) <> 1""",
            (t, f)).fetchone()[0]
        if n:
            dangling.append(f"{t}.{f}: {n}")
            continue

        # The column is exactly its claims: no row holds two, no claim
        # disagrees with the value the row holds, and no value is held
        # without one. A NULL claim may stand for a NULL value - a source
        # consulted that named nothing - and matches it by IS.
        two = con.execute("""SELECT COUNT(*) FROM (SELECT 1 FROM claims
            WHERE tbl = ? AND field = ? GROUP BY row_key HAVING COUNT(*) > 1)""",
            (t, f)).fetchone()[0]
        differ = con.execute(f"""SELECT COUNT(*) FROM claims c JOIN "{t}" x
            ON {expr} = c.row_key WHERE c.tbl = ? AND c.field = ?
            AND c.value_given IS NOT CAST(x."{f}" AS TEXT)""", (t, f)).fetchone()[0]
        bare = con.execute(f"""SELECT COUNT(*) FROM "{t}" x WHERE x."{f}" IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM claims c WHERE c.tbl = ? AND c.field = ?
                            AND c.row_key = {expr})""", (t, f)).fetchone()[0]
        check(f"{t}.{f} is exactly its claims", not (two or differ or bare),
              f"{two} rows with two, {differ} disagreeing, {bare} values with none")
    check("every declared column's table has a key a claim can name",
          not unkeyed, ", ".join(unkeyed))
    check("every declared kind names a column of its table", not nocolumn,
          ", ".join(nocolumn))
    check("every claim's row_key names exactly one row", not dangling,
          "; ".join(dangling))

    # Where each driver figure came from, from the modules that say so rather
    # than from the build that copied them: the row's own source for a figure
    # typed into data/*.py, then the two fetched fastest-lap totals, then
    # formula1.com for the three figures its driver pages gave, then the
    # correction that replaced a figure with another source's.
    expected = {}
    for r in con.execute("SELECT id, source FROM drivers"):
        for f in ("wins", "poles", "fastest_laps"):
            expected[(r["id"], f"{f}_external")] = r["source"]
    for did, (_n, src) in harvest.EXTERNAL_FASTEST_LAPS.items():
        expected[(did, "fastest_laps_external")] = src
    for did in _D.VERIFIED_STATS:
        for f in ("wins", "poles", "podiums"):
            expected[(did, f"{f}_external")] = "https://www.formula1.com/en/drivers"
    for did, f, *_rest, src in harvest.CORRECTIONS:
        if src is not None:
            expected[(did, f"{f}_external")] = src
    stray = [f"{r['row_key']}.{r['field']} cites {r['source']}" for r in con.execute(
        "SELECT row_key, field, source FROM claims WHERE tbl = 'drivers' "
        "ORDER BY row_key, field")
        if expected.get((r["row_key"], r["field"])) != r["source"]]
    check("every driver claim cites the source its data module names", not stray,
          "; ".join(stray[:3]))

    wrong_source = con.execute("""SELECT COUNT(*) FROM claims cl
        JOIN chassis c ON c.id = cl.row_key
        WHERE cl.tbl = 'chassis' AND cl.source IS NOT c.spec_source""").fetchone()[0]
    check("every chassis claim cites the article its figures came from",
          wrong_source == 0, f"{wrong_source} do not")

    # The car-season claims against the entry lists themselves, as f1.db holds
    # them in season_entrants - the check that the claimed remainder is what
    # F1DB named, not only that the columns agree with a list written in the
    # same loop.
    bad = []
    rows = con.execute("""SELECT s.car_id, s.year, c.constructor_id, cl.value_given
        FROM car_seasons s JOIN cars c ON c.id = s.car_id
        LEFT JOIN claims cl ON cl.tbl = 'car_seasons' AND cl.field = 'other_chassis'
             AND cl.row_key = s.car_id || '|' || s.year""").fetchall()
    for r in rows:
        named = set()
        for (ids,) in con.execute("""SELECT chassis_ids FROM season_entrants
                WHERE constructor_id = ? AND year = ?""", (r["constructor_id"], r["year"])):
            named.update(filter(None, (ids or "").split("+")))
        covered = {c[0] for c in con.execute(
            "SELECT id FROM chassis WHERE car_id = ?", (r["car_id"],))}
        if r["value_given"] != ("+".join(sorted(named - covered)) or None):
            bad.append(f"{r['car_id']} {r['year']}")
    uncorroborated = con.execute("""SELECT COUNT(*) FROM car_seasons
        WHERE corroborated IS NOT (other_chassis IS NULL)""").fetchone()[0]
    check("car_seasons' remainders are what season_entrants names beyond the car",
          bool(rows) and not bad, "; ".join(bad[:3]) or f"{len(rows)} seasons")
    check("car_seasons.corroborated is 1 exactly where the remainder is empty",
          uncorroborated == 0, f"{uncorroborated} disagree")

    by_source = con.execute("""SELECT s.source, COUNT(*) n FROM claims c
        JOIN source_registry s ON s.id = c.source_id
        GROUP BY s.id ORDER BY n DESC""").fetchall()
    print("        claims by source: " +
          "; ".join(f"{r['source']} {r['n']}" for r in by_source))


@section('THE FULL CLASSIFICATION')
def the_full_classification():
    # race_entries is no longer the winner, the pole-sitter and the fastest-lap
    # setter. It is every entry of every race, in the COMMITTED build, because
    # F1DB is CC BY and Jolpica is CC BY-NC-SA.
    ncls = con.execute("SELECT COUNT(*) FROM race_entries").fetchone()[0]
    nqual = con.execute("SELECT COUNT(*) FROM qualifying").fetchone()[0]
    nstand = con.execute("SELECT COUNT(*) FROM standings").fetchone()[0]

    # `source` names who established the FINISHING POSITION. The season
    # harvest (and formula1.com for 2025-26) establishes race winners, and
    # F1DB then fills their laps and points as a cross-checked detail; every
    # other row's position is F1DB's, so a non-winner carrying F1DB's laps
    # must cite F1DB. 1,136 pole rows cited the season article for F1DB's
    # whole classification until the upsert took the source with the
    # position. The pole and fastest-lap flags are the declared exception.
    # Stated as the rule itself: the only rows not F1DB's are winners.
    mixed = con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE source <> ? AND finish_position IS NOT 1""",
        (harvest_module().F1DB_SOURCE,)).fetchone()[0]
    check("every race entry that is not a winner's cites F1DB", mixed == 0,
          f"{mixed} non-winner rows cite another source")

    # known_gaps names the tables that are EMPTY in the distributed database.
    # #5 named pit_stops and team_radio while they held 22,481 and 6 rows; the
    # register that exists to be honest about absence was wrong about
    # presence. In every gap, every table named in a sentence carrying the
    # word EMPTY must be empty.
    tables_ = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    named, full = set(), set()
    for (desc,) in con.execute("SELECT description FROM known_gaps"):
        for sentence in re.split(r"(?<=[.;])\s+", desc or ""):
            if "EMPTY" not in sentence:
                continue
            for t in re.findall(r"[A-Za-z_]+", sentence):
                if t in tables_:
                    named.add(t)
                    if con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]:
                        full.add(t)
    check("every table known_gaps calls empty is empty", bool(named) and not full,
          f"{', '.join(sorted(named))} named; {', '.join(sorted(full)) or 'none'} not empty")

    # meta.coverage_note is the build's coverage_note() over the counts. It is
    # rebuilt here and compared whole, so a note whose eleven other figures
    # were wrong could not pass on the strength of one.
    import build as _build
    note_ = con.execute("SELECT value FROM meta WHERE key = 'coverage_note'").fetchone()[0]
    check("meta.coverage_note is what the counts say", note_ == _build.coverage_note(con.cursor()),
          note_[:80])

    # known_gaps says qualifying is held for every completed race; hold it.
    noqual = con.execute("""SELECT COUNT(*) FROM races r WHERE r.status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM qualifying q WHERE q.race_id = r.id)""").fetchone()[0]
    check("every completed race has a qualifying classification", noqual == 0,
          f"{noqual} completed races without one")

    # The controlled vocabularies are CHECK constraints in schema.sql since
    # v2.22, so a drifted value is refused at insert; this only confirms the
    # one that drifted is gone, because it had a filter miss a circuit.
    check("every circuit's direction is one of the two spellings",
          con.execute("""SELECT COUNT(*) FROM circuits WHERE direction IS NOT NULL
              AND direction NOT IN ('clockwise', 'anti-clockwise')""").fetchone()[0] == 0)

    # constructors.last_entry: NULL means still competing, so no inactive
    # constructor with a race entry may carry it, and no active one may not.
    bad_last = con.execute("""SELECT COUNT(*) FROM constructors c
        WHERE (c.active = 0 AND c.last_entry IS NULL
               AND EXISTS (SELECT 1 FROM race_entries e WHERE e.constructor_id = c.id))
           OR (c.active = 1 AND c.last_entry IS NOT NULL)""").fetchone()[0]
    check("constructors.last_entry is NULL exactly for the still-competing", bad_last == 0,
          f"{bad_last} constructors disagree with their active flag")

    # constructors.active against the season the build declares it is in -
    # the same statement the drivers' register gets above, which constructors
    # never had. Without it `active` was only as good as the number whoever
    # wrote the row had in mind: the eleven current entrants type it by hand
    # in data/teams.py, the rest take it from stage 08, and nothing compared
    # either with the grid. The comparator is season_entries at
    # meta.current_season, the anchor CR-07 settled on and the one
    # /constructors' "on the grid" chip reads; a MAX() over season_entries
    # would move to next season's grid the day one is carried.
    #
    # Both directions are hard, unlike the drivers' pair: season_entries is
    # the declared entry list rather than the race records, so a constructor
    # in it that is not active, or active and not in it, is a register row
    # nobody moved when the season did (CR-35).
    _cur = declared_season()
    _act = {r[0] for r in con.execute("SELECT id FROM constructors WHERE active = 1")}
    _ent = {r[0] for r in con.execute(
        "SELECT DISTINCT constructor_id FROM season_entries WHERE year = ?",
        (_cur,)) if r[0] is not None}
    check(f"constructors.active is exactly the {_cur} entry list",
          _act == _ent,
          "active without an entry: " + (", ".join(sorted(_act - _ent)) or "none")
          + "; entered but not active: " + (", ".join(sorted(_ent - _act)) or "none"))

    # A FLOOR UNDER EVERY BULK TABLE. data/harvest.py's _read_named returns []
    # for a missing generated file by design, from when those files were a
    # local extra; they are now 93% of the rows, and the checks below are
    # guarded on the table being non-empty, so a database built with
    # standings.txt deleted - 34,498 rows gone - passed every gate. Each
    # figure is the count at v2.22; raise one when a harvest legitimately adds
    # rows, never lower it. A harvest that shrinks has to be looked at.
    FLOORS = (
        ("race_entries", 27482), ("qualifying", 26997), ("standings", 34563),
        ("pit_stops", 22481), ("sprint_results", 590), ("season_entrants", 1925),
        ("chassis", 1153), ("engines", 424),
    )
    for table, floor in FLOORS:
        n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        check(f"{table} holds at least the {floor:,} rows of the last release",
              n >= floor, f"{n:,} rows")
    # Two harvests fill COLUMNS rather than tables, so a row floor does not
    # see them. When the review of CR-01 filed this (CR-21), deleting
    # harvest/car_specs.txt or harvest/article_images.txt built and verified
    # clean; since #60 the README's figure spans catch it indirectly, which
    # invites "fixing" the README. A floor names the harvest. Same rule: the
    # count at v2.22, raised when a harvest legitimately adds, never lowered.
    COLUMN_FLOORS = (
        ("chassis", "weight_kg", 204, "harvest/car_specs.txt"),
        ("chassis", "wheelbase_mm", 346, "harvest/car_specs.txt"),
        # `article` is filled only on the article route, `chassis_id` only on
        # the category route (AF-42), so each floor names one harvest.
        ("article_images", "article", 623, "harvest/article_images.txt"),
        ("article_images", "chassis_id", 119, "harvest/category_images.txt"),
    )
    for table, column, floor, source in COLUMN_FLOORS:
        n = con.execute(f"SELECT COUNT({column}) FROM {table}").fetchone()[0]
        check(f"{table}.{column} is filled at least {floor:,} times, as {source} fills it",
              n >= floor, f"{n:,} filled")
    # Fastest laps live in a column, and the F1DB file fills vacancies only,
    # so a floor on the count is one row wide. Per race instead: every
    # completed race carries a credit, bar the one known_gaps declares (2021
    # Belgium, where no racing lap was run).
    uncredited = [tuple(r) for r in con.execute("""SELECT r.year, r.round FROM races r
        WHERE r.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM race_entries e
                          WHERE e.race_id = r.id AND e.fastest_lap = 1)
        ORDER BY r.year, r.round""")]
    check("every completed race carries a fastest-lap credit, bar 2021 Belgium",
          uncredited == [(2021, 12)], "; ".join(f"{y} r{r}" for y, r in uncredited[:4]))
    print(f"  [info] {ncls} race entries, {nqual} qualifying rows, "
          f"{nstand} standings rows")

    races_done = con.execute(
        "SELECT COUNT(*) FROM races WHERE status='completed'").fetchone()[0]
    covered = con.execute("""SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
        JOIN races r ON r.id = e.race_id WHERE r.status='completed'
          AND e.finish_position IS NOT NULL""").fetchone()[0]
    check("every completed race has a classified finisher",
          covered == races_done, f"{covered} of {races_done}")

    # An integer result and a code are mutually exclusive by construction. If one
    # ever drifts from the other, every count of finishers is wrong.
    bad = con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE (finish_position IS NOT NULL
               AND position_text IS NOT NULL
               AND position_text <> CAST(finish_position AS TEXT))
           OR (finish_position IS NULL AND position_text GLOB '[0-9]*')""").fetchone()[0]
    check("finish_position and position_text never contradict each other", bad == 0)

    # A position can only be held twice when the car was shared, and the schema
    # has no other way to say it.
    dup = con.execute("""SELECT r.year, r.round, e.finish_position, COUNT(*) n
        FROM race_entries e JOIN races r ON r.id = e.race_id
        WHERE e.finish_position IS NOT NULL
        GROUP BY e.race_id, e.finish_position HAVING n > 1
          AND SUM(e.shared_drive) < n""").fetchall()
    check("no two drivers hold one finishing position unless they shared the car",
          not dup, "; ".join(f"{d[0]} r{d[1]} P{d[2]}" for d in dup[:3]))

    nshared = con.execute("SELECT COUNT(*) FROM race_entries "
                          "WHERE shared_drive=1").fetchone()[0]
    late = con.execute("""SELECT COUNT(*) FROM race_entries e
        JOIN races r ON r.id = e.race_id
        WHERE e.shared_drive=1 AND r.year > 1964""").fetchone()[0]
    check("no shared drive is recorded after the practice ended in 1964",
          late == 0, f"{nshared} shared entries, all 1950-1964")

    # The vocabulary is closed. A new code appearing means the source changed its
    # mind about how to say something, which is worth knowing before it is stored.
    codes = {r[0] for r in con.execute(
        "SELECT DISTINCT position_text FROM race_entries "
        "WHERE position_text IS NOT NULL AND position_text NOT GLOB '[0-9]*'")}
    check("every non-numeric result code is one this database knows",
          codes <= {"NC", "DNF", "DNQ", "DNPQ", "DNP", "DNS", "DSQ", "EX"},
          ", ".join(sorted(codes)))

    if nqual:
        # A qualifying row with no race entry is a car that took part in the
        # weekend and is missing from the classification. Two are declared:
        # the HRTs that failed the 107 per cent rule at Melbourne in 2011,
        # which F1DB's qualifying holds and its classification omits
        # (known_gaps, race_entries). Pinned by identity, not by count, so a
        # third such row fails rather than riding along.
        orphan = {(r[0], r[1], r[2]) for r in con.execute("""
            SELECT r.year, r.round, q.driver_id FROM qualifying q
              JOIN races r ON r.id = q.race_id
             WHERE NOT EXISTS (SELECT 1 FROM race_entries e
                               WHERE e.race_id = q.race_id
                                 AND e.driver_id = q.driver_id)""")}
        declared = {(2011, 1, "vitantonio-liuzzi"), (2011, 1, "narain-karthikeyan")}
        _fmt = lambda rows: ", ".join(f"{y} r{r} {d}" for y, r, d in sorted(rows)) or "none"
        # The detail says which way it failed: a new orphan is a regression to
        # read; the declared pair gaining entries is F1DB closing the gap, and
        # the row's state, this set and the closed-gap test in known_gaps()
        # then move together.
        check("every qualifying row without a race entry is the declared 2011 Melbourne pair",
              orphan == declared,
              f"unexpected: {_fmt(orphan - declared)}; no longer orphaned, close the gap: "
              f"{_fmt(declared - orphan)}")
        # Pinned to the row itself, not to a count: a second, unrelated open
        # race_entries gap is not a failure, and a different row swapped in is.
        gap_declared = con.execute("""SELECT COUNT(*) FROM known_gaps
            WHERE field = 'race_entries' AND state = 'open'
              AND area LIKE '%2011 Australian Grand Prix%107 per cent%'""").fetchone()[0]
        check("the 2011 Melbourne pair is an open row in known_gaps", gap_declared == 1,
              f"{gap_declared} matching open row{'' if gap_declared == 1 else 's'}")

        # Pre-knockout qualifying is one time; the knockout era is three segments
        # and no single time. Neither is back-filled from the other, and a row
        # carrying both would mean it had been.
        both = con.execute("""SELECT COUNT(*) FROM qualifying
            WHERE time IS NOT NULL AND q1 IS NOT NULL""").fetchone()[0]
        check("no qualifying row invents a single time for a knockout session",
              both == 0)

    if nstand:
        # The championship is contested by a chassis-ENGINE combination, and
        # 1960 is the case that proves it: Cooper-Climax won with 48 points while
        # Cooper-Maserati and Cooper-Castellotti tied for fifth on 3.
        multi = con.execute("""SELECT COUNT(*) FROM (
            SELECT year, entity_id FROM standings
            WHERE table_type='constructors' AND after_round IS NULL
              AND engine_id IS NOT NULL
            GROUP BY year, entity_id HAVING COUNT(DISTINCT engine_id) > 1)"""
            ).fetchone()[0]
        multi_view = con.execute("""SELECT COUNT(*) FROM (
            SELECT year, entity_id FROM v_standings_final
            WHERE table_type='constructors' AND engine_id IS NOT NULL
            GROUP BY year, entity_id HAVING COUNT(DISTINCT engine_id) > 1)"""
            ).fetchone()[0]
        check("constructors entered under more than one engine are kept apart",
              multi > 0 and multi == multi_view,
              f"{multi} constructor-seasons in the table, {multi_view} in the view")

        # A points total that rises as you go down the order is a sorting error,
        # and it is the failure mode that hid an excluded champion.
        bad_order = []
        for yr, tt in con.execute("""SELECT DISTINCT year, table_type
                FROM standings WHERE after_round IS NULL
                  AND source LIKE '%f1db%' ORDER BY year"""):
            rows = con.execute("""SELECT points FROM standings
                WHERE year=? AND table_type=? AND after_round IS NULL
                  AND position IS NOT NULL AND source LIKE '%f1db%'
                ORDER BY position""", (yr, tt)).fetchall()
            pts = [r[0] for r in rows if r[0] is not None]
            if any(pts[i] < pts[i + 1] - 0.001 for i in range(len(pts) - 1)):
                bad_order.append(f"{yr} {tt}")
        check("every final standings table runs from most points to fewest",
              not bad_order, "; ".join(bad_order[:3]))


# ---------------------------------------------------------------------------
# REDISTRIBUTION
#
# Six tables can hold data this project is not permitted to publish. Per-lap
# timing, stints, pit stops, race control and the team radio index come from
# the Formula 1 live timing API via FastF1, whose guidance is personal and
# non-commercial use, or from Jolpica, whose Ergast lineage is CC BY-NC-SA.
# Both are loaded onto a LOCAL copy by tools/ and neither is committed. See
# LICENSE-DATA and ATTRIBUTION.md.
#
# That policy has always been true and was never enforced. It lived in a
# sentence in a licence file and in the habit of not running the loaders
# before a commit, which is not a control - `git add f1.db` after an
# afternoon with --timing is an ordinary mistake with a licence breach on the
# other side of it. This section is the control.
#
# The empty tables are checked for being EMPTY. pit_stops and team_radio are
# checked by SOURCE, because both legitimately hold rows from elsewhere:
# 22,472 pit stops from F1DB under CC BY, and six radio exchanges quoted from
# Wikipedia articles.
# ---------------------------------------------------------------------------
@section('REDISTRIBUTION')
def redistribution():
    verdict = warn if LOCAL_TIMING else check
    if LOCAL_TIMING:
        print("  [info] F1_LOCAL_TIMING=1 - this database may hold FOM-owned "
              "timing. It is not publishable and must not be committed.")

    for table, what in (
            ("laps", "per-lap timing"),
            ("stints", "tyre stints"),
            ("race_timing", "race timing summaries"),
            ("race_control_messages", "race control messages")):
        n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        verdict(f"{table} holds no FOM-owned {what}", n == 0, f"{n} rows")

    # 'f1db' is the only pit stop source that may be published. The loaders
    # write 'jolpica' and 'fastf1', and both are barred.
    bad = con.execute("""SELECT source, COUNT(*) n FROM pit_stops
        WHERE source IS NOT NULL AND source <> 'f1db'
        GROUP BY source""").fetchall()
    verdict("every pit stop comes from F1DB", not bad,
            "; ".join(f"{r['n']} from {r['source']}" for r in bad))

    # The six committed exchanges are quoted from Wikipedia race articles.
    # A radio row indexed from the live timing API is FOM's audio.
    bad = con.execute("""SELECT COUNT(*) FROM team_radio
        WHERE source = 'fastf1'""").fetchone()[0]
    verdict("no team radio row was indexed from the live timing API",
            bad == 0, f"{bad} rows")

    # OpenStreetMap is ODbL: share-alike AND a database right. A database
    # derived from it is a Derivative Database and must itself be published
    # under ODbL, which would let twenty-five centrelines set the licence of
    # 117,000 rows that have nothing to do with them. So f1.db carries none
    # of it, and the centrelines ship as f1-geometry.db beside it - two
    # independent databases, which ODbL calls a Collective Database and
    # explicitly does not treat as derivative.
    #
    # A local copy with the overlay merged in (tools/geometry_overlay.py
    # --apply) is a Derivative Database and is fine to hold; it is simply not
    # the file to publish. F1_LOCAL_TIMING says this copy is one of those.
    n = con.execute("SELECT COUNT(*) FROM main.circuit_geometry").fetchone()[0]
    verdict("f1.db carries no ODbL geometry — it ships as f1-geometry.db",
            n == 0, f"{n} rows")

    # ---------------------------------------------------------------- classes
    #
    # The tables above are the ones a loader can fill by accident. This is the
    # general rule underneath them: EVERY row that cites a source at all must
    # cite one the registry says may be published.
    #
    # It is the rule that item 1 of the commercial-readiness pass applied by
    # hand. Seventy-two rows cited Jolpica, whose Ergast lineage is
    # CC BY-NC-SA, and nothing could see it - knowing the licence of a row
    # meant reading a paragraph in source_registry and recognising which of
    # sixteen sources a URL belonged to. Fixing the instances is worth little
    # if the next one arrives the same way, so the class is now a column and
    # this resolves every row against it.
    #
    # 'facts-only' passes. This database cites the official sources as the
    # AUTHORITY for a fact - a race winner, a circuit length, a points total -
    # and holds none of their prose. Facts are not copyrightable and restating
    # them is not redistribution. What that class forbids is copying their
    # expression, which no row here does; docs/COMMERCIAL-READINESS.md records
    # the reading that established it.
    registry = con.execute(
        "SELECT priority, source, redistributable, share_alike, "
        "attribution_required, domains FROM source_registry "
        "WHERE domains IS NOT NULL").fetchall()

    # Several entries may share a host - five of them are formula1.com, two
    # are en.wikipedia.org. Where they do, they must agree, or the class a row
    # resolves to would depend on which entry was read first.
    seen, disagree = {}, []
    for row in registry:
        for domain in (d.strip() for d in row["domains"].split(",")):
            if not domain:
                continue
            terms = (row["redistributable"], row["share_alike"],
                     row["attribution_required"])
            if seen.setdefault(domain, (terms, row["source"]))[0] != terms:
                disagree.append(f"{domain}: {row['source']} vs {seen[domain][1]}")
    check("registry entries sharing a host agree on what it permits",
          not disagree, "; ".join(disagree))
    classes = {domain: terms for domain, (terms, _) in seen.items()}

    def resolve(value):
        """The licence class a row's `source` falls under, or None."""
        text = str(value).strip()
        host = re.match(r"https?://([^/]+)", text)
        key = host.group(1).lower() if host else text.lower()
        if key in classes:
            return classes[key]
        # www.formula1.com -> formula1.com, api.openstreetmap.org -> ...
        return next((terms for domain, terms in classes.items()
                     if key.endswith("." + domain)), None)

    unknown, forbidden = [], []
    for (table,) in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name <> 'source_registry' ORDER BY name").fetchall():
        columns = [c[1] for c in con.execute('PRAGMA table_info("%s")' % table)]
        if "source" not in columns:
            continue
        rows = con.execute(
            'SELECT source, COUNT(*) FROM "%s" WHERE source IS NOT NULL '
            "AND TRIM(source) <> '' GROUP BY source" % table).fetchall()
        for value, n in rows:
            terms = resolve(value)
            if terms is None:
                unknown.append(f"{table}: {n} row(s) cite {value}")
            elif terms[0] == "no":
                forbidden.append(f"{table}: {n} row(s) cite {value}")

    # An unrecognised source is not a pass. It is a row whose licence nobody
    # has decided, which is the state every problem this pass fixed began in.
    check("every cited source is one the registry classifies",
          not unknown, "; ".join(unknown[:4]))

    # Two routes to a row's licence now exist - the host its citation names,
    # read here, and the source_id the build stored by prefix and pattern
    # (DA-03) - and a reader may take either. They must give the same terms,
    # or which one was read would decide what a reader may do with the row.
    terms_of = {r[0]: (r[1], r[2], r[3]) for r in con.execute(
        "SELECT id, redistributable, share_alike, attribution_required "
        "FROM source_registry")}
    split = []
    for (table,) in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name <> 'source_registry' ORDER BY name").fetchall():
        columns = [c[1] for c in con.execute('PRAGMA table_info("%s")' % table)]
        if "source" not in columns or "source_id" not in columns:
            continue
        for value, sid, n in con.execute(
                'SELECT source, source_id, COUNT(*) FROM "%s" WHERE source_id '
                "IS NOT NULL GROUP BY source, source_id" % table).fetchall():
            if resolve(value) != terms_of.get(sid):
                split.append(f"{table}: {n} row(s) cite {value}")
    check("every stored source_id carries the licence its citation's host does",
          not split, "; ".join(split[:4]))
    verdict("no row cites a source that may not be redistributed",
            not forbidden, "; ".join(forbidden[:4]))


# ---------------------------------------------------------------------------
# THE PROJECT'S OWN PROSE
#
# PM-47. One part of this file is not CC BY-SA: the columns named in
# PROJECT_PROSE_COLUMNS, which were written here and owe share-alike to
# nobody. A licence grant is only as good as its list of what it covers, and
# a CC BY grant cannot be taken back from a copy already made — so what this
# section checks is that the list, the database and the two licence documents
# say the same thing, and that nothing sourced has drifted onto the list.
# ---------------------------------------------------------------------------
@section("THE PROJECT'S OWN PROSE")
def project_prose():
    from data import current as _N

    declared = list(_N.PROJECT_PROSE_COLUMNS)

    # A grant naming a column that does not exist grants nothing, and a
    # renamed column would leave it pointing at nothing without a word.
    missing, sourced = [], []
    for name in declared:
        table, _, column = name.partition(".")
        cols = [c[1] for c in con.execute(f'PRAGMA table_info("{table}")')]
        if column not in cols:
            missing.append(name)
        # Deliberately strict: a table that cites a source may hold prose
        # somebody else wrote, and telling which is the prose pass (PM-17,
        # #249). Until it has run, only a table with no external source at
        # all may be granted, so adding one to the list is a decision a
        # person has to take rather than a line somebody slips in.
        elif "source" in cols or con.execute(
                "SELECT 1 FROM table_provenance WHERE tbl = ?", (table,)).fetchone():
            sourced.append(name)
    check("every column offered under CC BY 4.0 exists", not missing,
          ", ".join(missing))
    check("no column offered under CC BY 4.0 sits in a table that cites a source",
          not sourced, ", ".join(sourced))

    # The grant travels inside the file: a reader with f1.db and no repository
    # still holds the terms.
    published = value_or_none("project_prose_columns")
    expected = ", ".join(declared)
    check("meta.project_prose_columns publishes every column granted",
          published == expected,
          "" if published == expected else f"meta says {published!r}")
    check("meta.project_prose states the grant",
          value_or_none("project_prose") == _N.PROJECT_PROSE_NOTE)

    # And it is named where a reader looks for a licence. LICENSE-DATA is
    # served at lapledger.org/LICENSE-DATA; ATTRIBUTION.md beside it. These
    # two documents are what a reader takes the grant FROM, so they are
    # checked in both directions: a column granted here and missing there
    # would leave a reader unable to find the terms, and a column offered
    # there and not granted here would widen the grant in prose alone, which
    # is the direction nobody could see and no build could refuse.
    here = os.path.dirname(os.path.abspath(__file__))
    columns = {t: [c[1] for c in con.execute(f'PRAGMA table_info("{t}")')]
               for (t,) in con.execute(
                   "SELECT name FROM sqlite_master WHERE type = 'table'")}
    for doc, heading in (("LICENSE-DATA", "## The project's own writing"),
                         ("ATTRIBUTION.md", "## What this project wrote")):
        try:
            with open(os.path.join(here, doc), encoding="utf-8") as f:
                text = f.read()
        except OSError as e:
            check(f"{doc} is readable", False, str(e))
            continue
        absent = [c for c in declared if c not in text]
        check(f"{doc} names every column offered under CC BY 4.0",
              not absent, ", ".join(absent))

        # The section is found by its heading, and a heading that has been
        # renamed fails here rather than leaving the section unread: a check
        # that cannot find its subject passes on everything.
        found = text.count(heading)
        check(f"{doc} states the grant under one heading", found == 1,
              "" if found == 1 else f"{found} headings matching {heading!r}")
        if found != 1:
            continue
        section_ = text.split(heading, 1)[1].split("\n## ", 1)[0]
        # `table.column` in that section, and only where both halves are real
        # - `meta.project_prose` names a key, not a column, and is not one of
        # these.
        offered = [f"{t}.{c}" for t, c in
                   re.findall(r"`([a-z_]+)\.([a-z_]+)`", section_)
                   if c in columns.get(t, ())]
        wider = sorted(set(offered) - set(declared))
        check(f"{doc} offers no column that PROJECT_PROSE_COLUMNS does not",
              not wider, ", ".join(wider))


@section('ILLUSTRATION AND GEOMETRY')
def illustration_and_geometry():
    # Two tables that hold pointers to things this repository does not contain:
    # a photograph on Wikimedia Commons, and a shape in OpenStreetMap. Neither
    # stores the thing itself, so what has to hold is that the pointer is legal
    # to follow and that the shape agrees with a number held independently.

    nimg = con.execute("SELECT COUNT(*) FROM article_images").fetchone()[0]
    ngeo = con.execute(f"SELECT COUNT(*) FROM {GEO}").fetchone()[0]
    print(f"  [info] {nimg} article images, {ngeo} circuit centrelines")

    if nimg:
        # A file hosted locally on en.wikipedia.org is local BECAUSE it is
        # non-free; that is what local upload is for. Linking one would be a
        # licence violation that looks exactly like a working feature.
        #
        # The category route (AF-42) asks Commons itself, which answers
        # 'local' about its own files; its harvest checks the answering host
        # and the File namespace instead and records 'commons'. The pairing is
        # also a CHECK in schema.sql; this is where a loosened schema shows.
        local = con.execute("""SELECT COUNT(*) FROM article_images
            WHERE NOT ((route = 'article' AND repository = 'shared')
                    OR (route = 'category' AND repository = 'commons'))"""
                            ).fetchone()[0]
        check("every linked image is on Wikimedia Commons, not a local upload",
              local == 0, f"{nimg} files")

        # Attribution is a condition of CC BY and CC BY-SA, which is what almost
        # all of these are. No author means no permission.
        anon = con.execute("""SELECT COUNT(*) FROM article_images
            WHERE COALESCE(NULLIF(TRIM(COALESCE(artist, '')), ''),
                           NULLIF(TRIM(COALESCE(credit, '')), '')) IS NULL"""
                           ).fetchone()[0]
        check("every image names someone to attribute it to", anon == 0)

        nolic = con.execute("SELECT COUNT(*) FROM article_images "
                            "WHERE licence IS NULL OR TRIM(licence) = ''"
                            ).fetchone()[0]
        # The stored thumbnail address (VD-23) is followed by every reader's
        # browser without anything checking it on the way, so it has to be
        # the file the row credits and not merely a Wikimedia URL. Commons
        # files its pixels under the MD5 of the file's own name - /a/ab/Name
        # - so the address is checked against the row's file_name here,
        # which the harvest cannot have got right by accident. An original
        # narrower than the width asked is served as itself (/a/ab/Name); a
        # thumbnail carries the width after it (/thumb/a/ab/Name/960px-Name),
        # and a vector or TIFF original a rendered extension after that. The
        # last segment is held to that shape too, so a thumb path whose tail
        # names another file, or nothing, does not pass on the folder alone.
        import hashlib as _hashlib
        import urllib.parse as _up
        misaddressed, nthumb = [], 0
        for key, file_name, url in con.execute(
                """SELECT COALESCE(article, chassis_id), file_name, thumb_url
                   FROM article_images WHERE thumb_url IS NOT NULL"""):
            nthumb += 1
            name = file_name.removeprefix("File:").replace(" ", "_")
            md5 = _hashlib.md5(name.encode("utf-8")).hexdigest()
            parts = _up.urlsplit(url)
            path = _up.unquote(parts.path)
            shard = f"/wikipedia/commons/{md5[0]}/{md5[:2]}/{name}"
            thumb = f"/wikipedia/commons/thumb/{md5[0]}/{md5[:2]}/{name}/"
            tail = re.compile(r"\d+px-" + re.escape(name)
                              + r"(\.(png|jpg))?")
            ok = (parts.scheme == "https" and not parts.query
                  and parts.netloc in ("upload.wikimedia.org",
                                       "thumb.wikimedia.org")
                  and (path == shard or (path.startswith(thumb)
                                         and tail.fullmatch(
                                             path[len(thumb):]))))
            if not ok:
                misaddressed.append(f"{key}: {url}")
        check("every stored thumbnail address is its own row's file on "
              "Wikimedia's media servers", not misaddressed,
              f"{nthumb} of {nimg} carry one" if not misaddressed
              else "; ".join(misaddressed[:3]))

        check("every image states its own licence", nolic == 0,
              f"{con.execute('SELECT COUNT(DISTINCT licence) FROM article_images').fetchone()[0]} distinct licences in use")

        # An image keyed on an article no chassis claims describes nothing here.
        orphan = con.execute("""SELECT COUNT(*) FROM article_images i
            WHERE i.route = 'article' AND NOT EXISTS
                  (SELECT 1 FROM chassis c WHERE c.article = i.article)"""
                             ).fetchone()[0]
        check("every image belongs to an article a chassis claims", orphan == 0)

        # A category-route image belongs to a chassis with NO article: where
        # there is one, the stronger route governs and the weaker is not a
        # fallback anyone chose.
        stray = con.execute("""SELECT COUNT(*) FROM article_images i
            WHERE i.route = 'category' AND NOT EXISTS
                  (SELECT 1 FROM chassis c WHERE c.id = i.chassis_id
                                             AND c.article IS NULL)"""
                            ).fetchone()[0]
        check("every category image belongs to a chassis no article describes",
              stray == 0)

        # The two routes make different claims and sit on different rungs.
        # An article-route row at 'catalogued' would blur exactly the line
        # the rung was added to draw.
        blurred = con.execute("SELECT COUNT(*) FROM article_images "
                              "WHERE route = 'article' "
                              "AND confidence = 'catalogued'").fetchone()[0]
        check("no article-route image sits at 'catalogued'", blurred == 0)

        # These rows are 'unverified' because nothing in this database can
        # confirm a photograph shows the car. If one ever climbs the ladder it
        # will be because a person looked, and this is where that shows up.
        narticle = con.execute("SELECT COUNT(*) FROM article_images "
                               "WHERE route = 'article'").fetchone()[0]
        promoted = con.execute("SELECT COUNT(*) FROM article_images "
                               "WHERE route = 'article' "
                               "AND confidence <> 'unverified'").fetchone()[0]
        unnamed = con.execute("SELECT COUNT(*) FROM article_images "
                              "WHERE route = 'article' "
                              "AND name_matches = 0").fetchone()[0]
        warn("no image has been promoted above 'unverified' without a person",
             promoted == 0,
             f"{unnamed} of {narticle} do not name the car in the file name; "
             f"see v_images_to_check")
        ncat = nimg - narticle
        lifted = con.execute("SELECT COUNT(*) FROM article_images "
                             "WHERE route = 'category' "
                             "AND confidence <> 'catalogued'").fetchone()[0]
        warn("no category image has left 'catalogued' without a person",
             lifted == 0, f"{ncat} rows from a Commons category (AF-42)")

    if ngeo:
        # The check that matters, re-run from the stored coordinates rather than
        # from a column. A naive sum of a circuit relation's members includes the
        # pit lane and puts Monaco 12% long; nothing about 3.745 km looks wrong
        # on its own, and published_km is the only thing that says otherwise.
        import json as _json
        import math as _math

        def _hav(a, b):
            R = 6371008.8
            p1, p2 = _math.radians(a[0]), _math.radians(b[0])
            dp = p2 - p1
            dl = _math.radians(b[1] - a[1])
            h = (_math.sin(dp / 2) ** 2
                 + _math.cos(p1) * _math.cos(p2) * _math.sin(dl / 2) ** 2)
            return 2 * R * _math.asin(_math.sqrt(h))

        bad_len, unclosed, bad_layout, worst = [], [], [], 0.0
        bad_topo = []
        for r in con.execute(f"SELECT * FROM {GEO}"):
            geo = _json.loads(r["centreline"])
            metres = 0.0
            for line in geo["coordinates"]:
                for a, b in zip(line, line[1:]):
                    metres += _hav((a[1], a[0]), (b[1], b[0]))
            km = metres / 1000.0
            delta = abs(km - r["published_km"]) / r["published_km"]
            worst = max(worst, delta)
            if delta > 0.02:
                bad_len.append(f"{r['circuit_id']} {km:.3f} vs "
                               f"{r['published_km']:.3f} ({delta * 100:+.1f}%)")
            # A circuit is a loop, but an OSM relation's members are NOT ordered,
            # so comparing the first coordinate to the last says nothing - it
            # compares two arbitrary way ends and flagged five perfectly good
            # street circuits. What a closed loop actually guarantees is that
            # every way END meets another way's end. A dangling end is a missing
            # member, and a trace can be short by one segment and still measure a
            # plausible length.
            #
            # THE TOLERANCE WAS 30 m AND THAT WAS TOO LOOSE. Ways in a relation
            # share their junction nodes exactly: 1,201 of the 1,208 way ends here
            # sit at 0.000 m from another end, and the seven that do not are 5.4 m
            # to 63.4 m away - every one a real hole. At 30 m the Monaco and
            # Montjuic holes read as joins and only Las Vegas was reported, so the
            # check passed two broken traces for versions. One metre is above
            # serialisation noise and below the smallest real gap.
            ends = [line[0] for line in geo["coordinates"]] + \
                   [line[-1] for line in geo["coordinates"]]
            dangling = 0
            for i, a in enumerate(ends):
                if not any(i != j and _hav((a[1], a[0]), (b[1], b[0])) <= 1.0
                           for j, b in enumerate(ends)):
                    dangling += 1
            if dangling:
                unclosed.append(f"{r['circuit_id']} ({dangling} loose ends)")
            # The stored verdict is a build-time finding; recompute it here from
            # the geometry rather than trusting the column.
            if (r["loose_ends"] is None) or (r["loose_ends"] != dangling):
                bad_topo.append(f"{r['circuit_id']} stores {r['loose_ends']} "
                                f"loose ends, geometry has {dangling}")
            if bool(r["closes"]) != (dangling == 0):
                bad_topo.append(f"{r['circuit_id']} stores closes="
                                f"{r['closes']} with {dangling} loose ends")
            if r["segment_count"] != len(geo["coordinates"]):
                bad_topo.append(f"{r['circuit_id']} stores "
                                f"{r['segment_count']} segments, geometry has "
                                f"{len(geo['coordinates'])}")
            if r["layout_key"]:
                ok = con.execute("""SELECT 1 FROM circuit_layouts
                    WHERE circuit_id = ? AND layout_key = ?""",
                    (r["circuit_id"], r["layout_key"])).fetchone()
                if not ok:
                    bad_layout.append(f"{r['circuit_id']}/{r['layout_key']}")

        check("every centreline re-measures to its published length",
              not bad_len,
              f"worst {worst * 100:.2f}% over {ngeo} circuits"
              if not bad_len else "; ".join(bad_len[:3]))
        warn("every centreline closes into a loop", not unclosed,
             "; ".join(unclosed[:5]) if unclosed else "")
        # The warning above is the finding; this is the guarantee behind the
        # verdict the pages print from `closes` and `loose_ends`: the circuit
        # page's "The walk" field and the list's "does not close".
        check("the stored lap topology matches the geometry", not bad_topo,
              "; ".join(bad_topo[:3]) if bad_topo else
              f"{con.execute('SELECT COUNT(*) FROM circuit_geometry WHERE closes = 1').fetchone()[0]}"
              f" of {ngeo} stitch into a closed lap")
        check("every geometry layout_key names a real layout", not bad_layout,
              "; ".join(bad_layout[:3]))

        # OSM maps what is on the ground. A trace cannot be of a configuration
        # that no longer exists, so it may never be attached to a layout whose
        # timeline has closed.
        historic = con.execute(f"""SELECT COUNT(*) FROM {GEO} g
            JOIN circuit_layouts l ON l.circuit_id = g.circuit_id
                                  AND l.layout_key = g.layout_key
            WHERE l.to_year IS NOT NULL""").fetchone()[0]
        check("no centreline claims to be a historic layout", historic == 0)


@section('VIEWS')
def views():
    for v in ("v_champions", "v_title_count", "v_constructor_titles",
              "v_current_grid", "v_season_timeline", "v_unverified",
              "v_standings_final"):
        n = con.execute(f"SELECT COUNT(*) FROM {v}").fetchone()[0]
        check(f"view {v} returns rows", n > 0, f"{n} rows")

    # SQLite accepts CREATE VIEW over a column that does not exist and only
    # fails on SELECT, so a view nothing reads can be broken for a release
    # without a check noticing. Every view is selected from here; the four that
    # are empty until a harvest has run are exercised for being well formed
    # rather than populated, which is the most a check can ask of them.
    broken = []
    for (v,) in con.execute(
            "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name"):
        try:
            con.execute(f"SELECT * FROM {v} LIMIT 1").fetchall()
        except Exception as e:  # noqa: BLE001 - the message is the finding
            broken.append(f"{v}: {e}")
    check("every view can be selected from", not broken, "; ".join(broken[:3]))

    # ------------------------------------------------------------------ sprints
    #
    # A sprint is a separate race with its own grid, its own classification and
    # its own points. These checks are about the two ways that can go wrong: a
    # result attached to a round that does not claim to have held a sprint, and a
    # round flagged as holding one with nothing to show for it.

    spr_total = con.execute("SELECT COUNT(*) FROM sprint_results").fetchone()[0]
    spr_races = con.execute(
        "SELECT COUNT(DISTINCT race_id) FROM sprint_results").fetchone()[0]
    check("sprint results are held", spr_total > 0,
          f"{spr_total} entries over {spr_races} sprints")

    # The first sprint was at Silverstone in 2021. A row before that is not a
    # gap in the data, it is a row that cannot be true.
    early = con.execute("""SELECT COUNT(*) FROM sprint_results s
        JOIN races r ON r.id = s.race_id WHERE r.year < 2021""").fetchone()[0]
    check("no sprint result before 2021", early == 0, f"{early} rows")

    # Every sprint result belongs to a round that says it held a sprint. build.py
    # derives the flag from these rows, so this is checking that the derivation
    # actually happened rather than trusting that it did.
    unflagged = [f"{r[0]} r{r[1]}" for r in con.execute("""
        SELECT DISTINCT r.year, r.round FROM sprint_results s
        JOIN races r ON r.id = s.race_id
        WHERE COALESCE(r.sprint, 0) != 1 ORDER BY r.year, r.round""")]
    check("every sprint result sits on a round flagged as a sprint",
          not unflagged, "; ".join(unflagged[:5]))

    # The other direction is a warning, not a failure: a round on a future
    # calendar is legitimately flagged before it has been run.
    empty = [f"{r[0]} r{r[1]} ({r[2]})" for r in con.execute("""
        SELECT r.year, r.round, r.status FROM races r
        WHERE r.sprint = 1
          AND NOT EXISTS (SELECT 1 FROM sprint_results s WHERE s.race_id = r.id)
        ORDER BY r.year, r.round""")]
    warn("every round flagged as a sprint has a classification", not empty,
         "; ".join(empty[:5]))

    # One winner per sprint, and every sprint has one. A sprint with two firsts
    # would mean the loader has double-counted a round; one with none would mean
    # the classification arrived without its result.
    bad_winner = [f"{r[0]} r{r[1]}: {r[2]} winners" for r in con.execute("""
        SELECT r.year, r.round, SUM(s.finish_position = 1)
        FROM sprint_results s JOIN races r ON r.id = s.race_id
        GROUP BY s.race_id HAVING SUM(s.finish_position = 1) != 1
        ORDER BY r.year, r.round""")]
    check("every sprint has exactly one winner", not bad_winner,
          "; ".join(bad_winner[:5]))

    # Sprint points are part of the championship, so they have to look like
    # championship points: never negative, and awarded only to a finisher.
    bad_points = con.execute("""SELECT COUNT(*) FROM sprint_results
        WHERE points < 0 OR (points > 0 AND finish_position IS NULL)""").fetchone()[0]
    check("sprint points are non-negative and go to classified finishers",
          bad_points == 0, f"{bad_points} rows")


@section('THE README STATES WHAT THE DATABASE HOLDS')
def readme_figures():
    # The README claimed 39 tables, 34 views and ~8,400 rows against 46, 39 and
    # 119,265, and said qualifying was "not held at all" over 26,997 rows of
    # it, because nothing read the prose. meta.coverage_note is derived and
    # compared whole; this gives the README the same treatment. Every figure
    # it states is a span - <!-- fig:name -->value<!-- /fig --> - and
    # tools/readme_figures.py computes each name from this database with one
    # expression. `make all` rewrites them; here they are recomputed and the
    # text has to agree. A stale README is a failed build, not a footnote.
    import importlib.util
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location(
        "readme_figures", os.path.join(here, "tools", "readme_figures.py"))
    rf = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(rf)

    # Every document in rf.DOCUMENTS - the README and, since PM-31,
    # docs/COMMERCIAL-READINESS.md, whose class table said 539 facts-only
    # rows against 552 held while nothing read it.
    text = ""
    for path in rf.DOCUMENTS:
        with open(path, encoding="utf-8") as f:
            text += f.read() + "\n"
    try:
        said = rf.stated(text)
    except ValueError as e:
        check("no figure is stated twice with different values", False, str(e))
        return
    check("no figure is stated twice with different values", True,
          f"{len(said)} spans across {len(rf.DOCUMENTS)} documents")

    values = rf.compute(con, GEO)
    unknown = sorted(set(said) - set(values))
    check("every figure a document states is one the tool computes", not unknown,
          ", ".join(unknown))
    unused = sorted(set(values) - set(said))
    check("every figure the tool computes is stated somewhere", not unused,
          ", ".join(unused))
    for name in rf.NAMES:
        if name in said:
            s, a = said[name], values[name]
            detail = a if "\n" not in a else "table"
            check(f"fig:{name} = {detail}", s == a,
                  "" if s == a else f"the document says {s!r}")


@section('THE DATABASE STATES WHAT IT HOLDS IN ITS OWN PROSE')
def prose_figures():
    # The README's discipline, turned on the prose inside the artefact.
    # `source_registry` is what /data/sources renders, and its figures were
    # typed by hand: 1,161 races and 27,555 entries where 1,163 and 27,504
    # are held, with qualifying, standings, pit stops and the Commons
    # totals stale beside them, because nothing read them (CD-38, AF-63).
    # Each is now a {{fig:name}} token in data/*.py; build.py expands it off
    # the counts in its final stage. Here the literals are re-expanded from
    # the same tables and the stored prose is compared WHOLE, the way
    # meta.coverage_note is, so a row whose other figures were wrong could
    # not pass on the strength of one.
    pf = _prose_figures()
    cur = con.cursor()

    for (table, keycol, key, column), want in pf.expected(cur).items():
        row = con.execute(f"SELECT {column} FROM {table} WHERE {keycol} = ?",
                          (key,)).fetchone()
        where = f"{table}.{column} ({keycol} {key})"
        if row is None:
            check(f"{where} is a row this database has", False, "no such row")
            continue
        check(f"{where} is what the counts say", row[0] == want,
              "" if row[0] == want else "the stored prose is not the expanded literal")

    # A token in a column PROSE does not name would ship to the page as
    # itself. Every text column of every table, from PRAGMA rather than a
    # list, because the ones worth catching are the ones nobody listed.
    left = pf.survivors(con)
    check("no figure token survived into the database", not left,
          "; ".join(f"{t}.{c} ({n} row(s))" for t, c, n in left))

    # A figure computed and stated nowhere is a dead expression, the same
    # rule readme_figures.py applies to a figure no document names.
    spare = pf.unused(cur)
    check("every figure computed is stated in some prose", not spare, ", ".join(spare))



def main(argv):
    global con, GEO, DB
    # --db PATH checks a database other than the one beside this file. CI uses
    # it to check the COMMITTED f1.db before build.py overwrites it, which is
    # the only moment a database carrying non-redistributable rows can be
    # caught.
    if "--db" in argv:
        i = argv.index("--db") + 1
        if i >= len(argv):
            print("--db needs a path to a database", file=sys.stderr)
            return 2
        DB = argv[i]

    if "--list" in argv:
        for name, (title, _) in SECTIONS.items():
            print(f"  {name:52} {title}")
        return 0

    # --quiet prints a section only if something in it failed or warned, and
    # then only those lines, plus a summary with the count of what passed.
    # The full run prints one line per check — about 400 PASS lines — which
    # is the right record for CI's log and the wrong thing to hand an agent
    # that runs this after every edit and reads the output back: at roughly
    # twenty thousand tokens a run it cost more than the change it checked.
    # The exit code is identical either way; nothing is skipped.
    quiet = "--quiet" in argv or "-q" in argv

    wanted = None
    # --redistribution-only runs the licence section and nothing else. It is a
    # second of work against any database, so it can run in places the full
    # suite would be too slow for.
    if "--redistribution-only" in argv:
        wanted = ["redistribution"]
    elif "--only" in argv:
        terms = [a.lower() for a in argv[argv.index("--only") + 1:] if not a.startswith("-")]
        if not terms:
            print("--only needs a name, or a fragment of one.", file=sys.stderr)
            return 2
        wanted = [n for n, (t, _) in SECTIONS.items()
                  if any(term in n or term in t.lower() for term in terms)]
        if not wanted:
            print(f"Nothing matches {' '.join(terms)}. Try --list.", file=sys.stderr)
            return 2

    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")

    # A merged local copy (tools/geometry_overlay.py) is checked exactly as it
    # always was; a split one reads the centrelines through the attachment.
    geo_db = os.path.join(os.path.dirname(os.path.abspath(DB)), "f1-geometry.db")
    if os.path.exists(geo_db) and not con.execute(
            "SELECT COUNT(*) FROM circuit_geometry").fetchone()[0]:
        con.execute("ATTACH DATABASE ? AS geo", (geo_db,))
        GEO = "geo.circuit_geometry"

    for name, (title, fn) in SECTIONS.items():
        if wanted is not None and name not in wanted:
            continue
        if not quiet:
            print(f"\n{title}")
            fn()
            continue
        # Run the section against a buffer; show it only if it said FAIL or
        # WARN, and then only those lines. The [info] lines and the passes
        # are in the buffer and are dropped with it.
        before = (len(fails), len(warns))
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            fn()
        if (len(fails), len(warns)) != before:
            print(f"\n{title}")
            for line in buf.getvalue().splitlines():
                if "[FAIL]" in line or "[WARN]" in line:
                    print(line)

    print("\n" + "=" * 60)
    if fails:
        print(f"{len(fails)} CHECK(S) FAILED:")
        for f in fails:
            print("   -", f)
        return 1
    # A subset that passes is not a database that passes; the summary says so
    # rather than reading like a clean bill of health.
    scope = "" if wanted is None else f" ({len(wanted)} of {len(SECTIONS)} sections)"
    ran = f" {passes} checks passed," if quiet else ""
    print(f"All checks passed{scope}.{ran} {len(warns)} warning(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
