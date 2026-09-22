#!/usr/bin/env python3
"""The championship table only ever goes up.

A running total is cumulative: an entrant's points after round N are its
points after round N-1 plus whatever its cars scored in round N. So a round
it scored in must move its total. Nothing about that depends on a points
system, which is what makes it the cross-check worth having - a standings
figure compared only with another standings figure cannot show a source file
that was not updated, and that is exactly what 2026 round 14 was.

The rule, its two starting seasons and its three exceptions are declared in
`data/current.py`; this module is only how they are applied, so that
`build.py` and `verify.py` ask the same question of the same rows.

    python3 tools/standings_rule.py            # violations in f1.db
    python3 tools/standings_rule.py --survey   # every violation, all seasons,
                                               # ignoring the floors: the
                                               # measurement the floors are set
                                               # from
"""
import argparse
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.current import (STANDINGS_ACCUMULATE_FROM,  # noqa: E402
                          STANDINGS_ACCUMULATION_EXCEPTIONS)

# A constructor that ran two engines in one season has two championship
# entries, and `race_entries` names no engine, so a round's points cannot be
# split between them: Tyrrell 1985 (Cosworth, then Renault) and Williams and
# Benetton in 1995 are the cases. Their rows are not checked, and saying so
# here is the whole of the exemption - it is not a list of seasons that can
# rot.
_ROUND_POINTS = {
    "drivers": """
        SELECT r.year y, r.round rnd, e.driver_id ent, SUM(COALESCE(e.points,0)) p
          FROM race_entries e JOIN races r ON r.id = e.race_id GROUP BY 1,2,3
        UNION ALL
        SELECT r.year, r.round, s.driver_id, SUM(COALESCE(s.points,0))
          FROM sprint_results s JOIN races r ON r.id = s.race_id GROUP BY 1,2,3""",
    "constructors": """
        SELECT r.year y, r.round rnd, e.constructor_id ent, SUM(COALESCE(e.points,0)) p
          FROM race_entries e JOIN races r ON r.id = e.race_id GROUP BY 1,2,3
        UNION ALL
        SELECT r.year, r.round, s.constructor_id, SUM(COALESCE(s.points,0))
          FROM sprint_results s JOIN races r ON r.id = s.race_id GROUP BY 1,2,3""",
}

_SINGLE_ENTRY = """
    SELECT year, entity_id FROM standings
     WHERE table_type = ? AND after_round IS NOT NULL
     GROUP BY year, entity_id
    HAVING COUNT(DISTINCT COALESCE(engine_id, '')) = 1"""


def violations(con, floors=None, exceptions=None):
    """Every standings row whose total did not move when its cars scored, or
    moved down. One dict per row, oldest first."""
    floors = STANDINGS_ACCUMULATE_FROM if floors is None else floors
    exceptions = (STANDINGS_ACCUMULATION_EXCEPTIONS if exceptions is None
                  else exceptions)
    out = []
    for table in ("constructors", "drivers"):
        floor = floors.get(table)
        single = {(y, e) for y, e in con.execute(_SINGLE_ENTRY, (table,))}
        scored = {}
        for y, rnd, ent, p in con.execute(
                f"SELECT y, rnd, ent, SUM(p) FROM ({_ROUND_POINTS[table]}) "
                "GROUP BY y, rnd, ent"):
            scored[(y, rnd, ent)] = p or 0.0
        rows = con.execute(
            """SELECT year, entity_id, after_round, points FROM standings
                WHERE table_type = ? AND after_round IS NOT NULL
                  AND points IS NOT NULL AND entity_id IS NOT NULL
                ORDER BY year, entity_id, after_round""", (table,))
        previous = {}
        for year, ent, rnd, pts in rows:
            prev = previous.get((year, ent))
            previous[(year, ent)] = (rnd, pts)
            if floor is None or year < floor:
                continue
            if (year, ent) not in single:
                continue                      # two engines: see above
            if prev is None or prev[0] != rnd - 1:
                continue                      # no round to compare with
            if (table, year, ent) in exceptions:
                continue
            this_round = scored.get((year, rnd, ent), 0.0)
            went_down = pts < prev[1] - 0.001
            flat = this_round > 0.001 and pts <= prev[1] + 0.001
            if went_down or flat:
                out.append({
                    "table_type": table, "year": year, "entity_id": ent,
                    "after_round": rnd, "previous": prev[1], "points": pts,
                    "scored": this_round,
                    "kind": "went down" if went_down else "scored but flat",
                    "derived": round(prev[1] + this_round, 3),
                })
    out.sort(key=lambda v: (v["year"], v["after_round"], v["entity_id"]))
    return out


def describe(v):
    return (f"{v['year']} round {v['after_round']} {v['table_type'][:-1]} "
            f"{v['entity_id']}: {v['previous']:g} -> {v['points']:g} "
            f"with {v['scored']:g} scored ({v['kind']})")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default="f1.db")
    ap.add_argument("--survey", action="store_true",
                    help="ignore the starting seasons and the exceptions, and "
                         "print everything: the measurement behind both")
    args = ap.parse_args(argv)
    con = sqlite3.connect(args.db)
    found = violations(con)
    if args.survey:
        found = violations(con, floors={"constructors": 0, "drivers": 0},
                           exceptions={})
    for v in found:
        print(" ", describe(v))
    print(f"{len(found)} row(s)")
    return 1 if found and not args.survey else 0


if __name__ == "__main__":
    sys.exit(main())
