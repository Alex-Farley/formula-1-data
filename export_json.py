#!/usr/bin/env python3
"""
Export f1.db to JSON.

  python3 export_json.py                -> f1_database.json (everything)
  python3 export_json.py --compat       -> also writes f1_compat.json, which
                                           keeps the key names of the original
                                           v1 file so existing consumers of
                                           that file keep working.
"""
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "f1.db")


def history_baseline(con):
    """The v1 layout's headline facts, read off seasons and drivers."""
    first = con.execute("""SELECT s.year, d.full_name FROM seasons s
        JOIN drivers d ON d.id = s.drivers_champion
        WHERE s.drivers_champion IS NOT NULL ORDER BY s.year LIMIT 1""").fetchone()
    latest = con.execute("""SELECT s.year, d.full_name FROM seasons s
        JOIN drivers d ON d.id = s.drivers_champion
        WHERE s.drivers_champion IS NOT NULL ORDER BY s.year DESC LIMIT 1""").fetchone()
    top = con.execute("""SELECT full_name, titles FROM drivers
        WHERE titles = (SELECT MAX(titles) FROM drivers) ORDER BY full_name""").fetchall()
    # From seasons, the column verify.py cross-checks against the
    # constructors' title counts - not from standings, where one retrospective
    # pre-1958 row would move a fact stated as "started in".
    constructors_from = con.execute(
        "SELECT MIN(year) FROM seasons WHERE constructors_champion IS NOT NULL").fetchone()[0]
    # The v1 key names a year, so it keeps its name and its meaning - the
    # count as it stood at the end of 2025, derived - and the moving figure
    # gets keys of its own beside it.
    at_2025 = con.execute("""SELECT COUNT(DISTINCT drivers_champion) FROM seasons
        WHERE year <= 2025 AND drivers_champion IS NOT NULL""").fetchone()[0]
    return {
        "championship_start": str(first[0]),
        "first_world_champion": f"{first[1]} ({first[0]})",
        "drivers_champions_count_at_end_2025": at_2025,
        "drivers_champions_count": con.execute(
            "SELECT COUNT(*) FROM drivers WHERE titles > 0").fetchone()[0],
        "champions_count_as_of_season": latest[0],
        "constructors_championship_started": constructors_from,
        "most_driver_titles": " and ".join(r[0] for r in top) + f" — {top[0][1]} each"
        if len(top) > 1 else f"{top[0][0]} — {top[0][1]}",
        "most_recent_champion": f"{latest[1]} — {latest[0]}",
    }


def dump(con, table, order=None):
    q = f"SELECT * FROM {table}"
    if order:
        q += f" ORDER BY {order}"
    return [dict(r) for r in con.execute(q)]


# Tables deliberately left out of the export, with the reason. Anything not
# exported and not listed here fails the completeness check below, so a new
# table cannot go missing quietly - which is exactly what happened to the
# chassis register until someone counted.
NOT_EXPORTED = {
    "meta": "unwrapped into the top-level keys instead",
    "provenance": "nested inside verification_policy",
    "laps": "filled locally by tools/fastf1_load.py; FOM's data, never shipped",
    "stints": "as laps",
    "race_control_messages": "as laps",
    # Session-grain tables. race_entries is exported because the finishing
    # order IS the release; these two are the same data one level finer and
    # they take the file from 12 MB to 44 MB, which stops being a convenient
    # export and starts being a download. They are in f1.db, which ships in
    # this repository, and one SQL query away.
    "qualifying": "27k rows of session detail; query it in f1.db",
    "pit_stops": "22k rows; and FastF1 adds more locally",
    # The centreline of one circuit is tens of thousands of coordinates, and it
    # is the only ODbL-licensed data in the project. ODbL carries share-alike
    # AND a database right, so a database holding it is a Derivative Database
    # and must itself be published under ODbL. Rather than let that reach a
    # file whose whole point is being easy to reuse, the centrelines are not in
    # f1.db either: build.py writes them to f1-geometry.db, and the two ship
    # side by side as what ODbL calls a Collective Database. See ATTRIBUTION.md
    # and tools/geometry_overlay.py.
    "circuit_geometry": "ODbL geometry — ships as f1-geometry.db, not here",
}


def check_complete(con, out):
    """Every table is either exported or declared unexportable."""
    tables = {r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%'")}
    missing = tables - set(out) - set(NOT_EXPORTED)
    if missing:
        sys.exit(f"export_json.py: {len(missing)} table(s) are neither "
                 f"exported nor declared in NOT_EXPORTED: "
                 f"{', '.join(sorted(missing))}")
    stale = set(NOT_EXPORTED) - tables
    if stale:
        sys.exit(f"export_json.py: NOT_EXPORTED names table(s) that no longer "
                 f"exist: {', '.join(sorted(stale))}")


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    meta = {r["key"]: r["value"] for r in con.execute("SELECT * FROM meta")}

    out = {
        "database_name": meta.get("database_name"),
        "version": meta.get("version"),
        "built": meta.get("built"),
        "verification_policy": {
            "confidence_ladder": dump(con, "provenance", "rank"),
            "missing_fact_policy": meta.get("missing_fact_policy"),
            "promotion_rule": meta.get("promotion_rule"),
            "allowed_sources": [r["source"] for r in con.execute(
                "SELECT source FROM source_registry WHERE authority='official'")],
            "forbidden_as_authority": [r["source"] for r in con.execute(
                "SELECT source FROM source_registry WHERE authority='forbidden'")],
        },
        "coverage": meta.get("coverage_note"),
        "seasons": dump(con, "seasons", "year"),
        "drivers": dump(con, "drivers", "titles DESC, wins DESC, full_name"),
        "constructors": dump(con, "constructors", "constructors_titles DESC, name"),
        "constructor_lineage": dump(con, "constructor_lineage", "chain_id, sequence"),
        "engine_manufacturers": dump(con, "engine_manufacturers", "first_year"),
        "engine_eras": dump(con, "engine_eras", "from_year"),
        "cars": dump(con, "cars", "wins DESC, from_year"),
        "chassis": dump(con, "chassis", "first_year, full_name"),
        "engines": dump(con, "engines", "full_name"),
        "season_entrants": dump(con, "season_entrants", "year, entrant_id"),
        "regulation_limits": dump(con, "regulation_limits", "field, from_year"),
        "car_seasons": dump(con, "car_seasons", "car_id, year"),
        "circuits": dump(con, "circuits", "country, name"),
        "circuit_layouts": dump(con, "circuit_layouts", "circuit_id, from_year"),
        "circuit_outlines": dump(con, "circuit_outlines", "circuit_id, f1db_layout_id"),
        # References and credits, never images. Exporting them is the whole
        # point: a consumer of the JSON needs the licence and the photographer
        # as much as the file name, because showing one without the other is
        # not allowed.
        # Two routes, each keyed on its own column (AF-42); the other is NULL.
        "article_images": dump(con, "article_images",
                               "route, article, chassis_id"),
        "grands_prix": dump(con, "grands_prix", "first_held"),
        "eras": dump(con, "eras", "from_year"),
        "regulation_changes": dump(con, "regulation_changes", "year, category"),
        "technical_innovations": dump(con, "technical_innovations", "year"),
        "safety_milestones": dump(con, "safety_milestones", "year"),
        "tyre_suppliers": dump(con, "tyre_suppliers", "from_year"),
        "points_systems": dump(con, "points_systems", "from_year"),
        "governance": dump(con, "governance", "year"),
        "personnel": dump(con, "personnel", "full_name"),
        "records": dump(con, "records", "category"),
        "glossary": dump(con, "glossary", "term"),
        "races": dump(con, "races", "year, round"),
        # The current season's timetable (LV-02): starts in UTC with the
        # circuit's zone, keyed to races by race_id.
        "sessions": dump(con, "sessions", "race_id, start_utc"),
        "race_entries": dump(con, "race_entries", "race_id, id"),
        # A separate race with its own grid, classification and points, not a
        # session of the grand prix beside it — so its own array, ordered the
        # way the grand prix entries are.
        "sprint_results": dump(con, "sprint_results", "race_id, id"),
        "race_timing": dump(con, "race_timing", "race_id"),
        "team_radio": dump(con, "team_radio", "notable DESC, race_id"),
        "known_gaps": dump(con, "known_gaps", "id"),
        "discrepancies": dump(con, "discrepancies", "status, subject"),
        # The END-OF-SEASON classification for every year, not the running
        # total after all 1,161 rounds - that is 34,000 rows and 10 MB, and
        # it is a different question than "who won the championship".
        "standings": [dict(r) for r in con.execute(
            """SELECT * FROM v_standings_final
               ORDER BY year DESC, table_type, position""")],
        "calendar": dump(con, "calendar", "year, round"),
        "grands_prix_register": dump(con, "grands_prix", "first_held"),
        "season_entries": dump(con, "season_entries", "year, id"),
        "source_registry": dump(con, "source_registry", "priority"),
        # How a row's free-text `source` resolves to one of those entries, and
        # where a table with no `source` column gets its provenance from.
        # Without these the registry names sources nothing can be traced to.
        "source_patterns": dump(con, "source_patterns", "id"),
        "table_provenance": dump(con, "table_provenance", "tbl"),
        "fia_regulation_issues_2026": {
            k.split("::", 1)[1]: v for k, v in meta.items() if k.startswith("fia_issue::")},
    }

    # laps, stints, pit_stops and race_control_messages are deliberately NOT
    # exported: they are empty in the distributed build and, once
    # tools/fastf1_load.py has run, run to hundreds of thousands of rows.
    # Query them in SQLite, or export them yourself.

    check_complete(con, out)

    path = os.path.join(HERE, "f1_database.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"wrote {path}  ({os.path.getsize(path) / 1024:.0f} KB)")

    if "--compat" in sys.argv:
        # The season this file's keys name. FROZEN, and deliberately not
        # meta.current_season: README calls f1_compat.json "the original v1
        # key layout, so anything already consuming that file keeps working",
        # and `teams_2026` is part of that layout. Following the season would
        # rename four keys at rollover, and CI - which compares the committed
        # file against a fresh build of the same code - would agree with
        # itself and say nothing while an outside consumer's lookup returned
        # nothing. web/test/conventions.mjs holds meta.database_name short of
        # this file for the same reason; PM-22 (#165) carries both, with the
        # version bump that makes a key change announceable. Named once here
        # so the number is declared rather than typed nine times (CR-07).
        SEASON = 2026
        teams = [dict(r) for r in con.execute("""
            SELECT c.name, c.full_name, c.base, c.first_entry,
                   s.position, s.points
            FROM constructors c
            JOIN v_standings_final s ON s.entity_id=c.id AND s.year=?
                            AND s.table_type='constructors'
            ORDER BY s.position""", (SEASON,))]
        for t in teams:
            t["drivers"] = [r[0] for r in con.execute("""
                SELECT d.full_name FROM season_entries e JOIN drivers d ON d.id=e.driver_id
                JOIN constructors c ON c.id=e.constructor_id
                WHERE e.year=? AND e.role='race' AND c.name=?""",
                (SEASON, t["name"]))]
        compat = {
            "database_name": out["database_name"],
            "version": out["version"],
            "verification_date": meta.get("verification_date"),
            "verification_policy": out["verification_policy"],
            f"teams_{SEASON}": teams,
            f"drivers_{SEASON}": {
                "full_season_entry_set": [dict(r) for r in con.execute("""
                    SELECT d.full_name AS name, d.nationality_code, e.car_number AS number,
                           c.name AS team
                    FROM season_entries e JOIN drivers d ON d.id=e.driver_id
                    JOIN constructors c ON c.id=e.constructor_id
                    WHERE e.year=? AND e.role='race'""", (SEASON,))],
                "in_season_reserve_or_substitute": [dict(r) for r in con.execute("""
                    SELECT d.full_name AS name, d.nationality_code, e.car_number AS number,
                           c.name AS team_context, e.role AS status
                    FROM season_entries e JOIN drivers d ON d.id=e.driver_id
                    JOIN constructors c ON c.id=e.constructor_id
                    WHERE e.year=? AND e.role!='race'""", (SEASON,))],
            },
            f"driver_standings_snapshot_{SEASON}": [dict(r) for r in con.execute("""
                SELECT position, entity AS driver, team, points FROM v_standings_final
                WHERE year=? AND table_type='drivers' ORDER BY position""",
                (SEASON,))],
            f"calendar_{SEASON}_current": [dict(r) for r in con.execute("""
                SELECT round, country, city, dates, circuit_name, circuit_id, sprint, status
                FROM calendar WHERE year=? ORDER BY round""", (SEASON,))],
            # Derived, every one. These were typed strings in a file whose CI
            # check compares it only against a fresh build of the same code,
            # so "most_recent_champion" would have read 2025 on the day the
            # 2026 title was decided and nothing would have said so.
            "history_baseline": history_baseline(con),
            "source_registry": out["source_registry"],
        }
        # A snapshot is one row per entity. This file shipped 333 rows for 23
        # drivers in seven releases - the running table after every round,
        # taken by a query with no after_round clause - and the CI check that
        # compares the committed file against a fresh build certified it each
        # time, because it checks reproducibility and not sense. This checks
        # sense.
        for key, rows_ in ((f"driver_standings_snapshot_{SEASON}",
                            compat[f"driver_standings_snapshot_{SEASON}"]),
                           (f"teams_{SEASON}", teams)):
            names = [r["driver"] if "driver" in r else r["name"] for r in rows_]
            if len(names) != len(set(names)):
                raise SystemExit(f"compat: {key} lists an entity twice")
        p2 = os.path.join(HERE, "f1_compat.json")
        with open(p2, "w", encoding="utf-8") as f:
            json.dump(compat, f, indent=2, ensure_ascii=False)
        print(f"wrote {p2}  ({os.path.getsize(p2) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
