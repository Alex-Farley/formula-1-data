#!/usr/bin/env python3
"""A championship total is the sum of what the cars scored.

The running total after round N is what the entrant scored in rounds 1..N.
Nothing in that depends on a points system, which is what makes it the
cross-check worth having: a standings figure compared only with another
standings figure cannot show a source file that was not updated, and for 2026
round 14 did not.

The rule compares a STORED figure with one derived from `race_entries` and
`sprint_results`, which are different rows from a different part of the same
source. Where `build.py` has corrected a figure the two agree by
construction - that is what a correction is - and the record of what the
source published is the `discrepancies` row it files. For every figure the
build did not touch, this constrains the value and not merely its direction.

The floors, the six adjustments, the alias and the multi-engine exemption are
declared in `data/current.py`; this module is only how they are applied, so
that `build.py` and `verify.py` ask one question of the same rows.

    python3 tools/standings_rule.py            # violations in f1.db
    python3 tools/standings_rule.py --survey   # every row that is not the
                                               # plain sum, ignoring the
                                               # floors and the adjustments:
                                               # the measurement both are set
                                               # from
"""
import argparse
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.current import (STANDINGS_ACCUMULATE_FROM,  # noqa: E402
                          STANDINGS_ADJUSTMENTS,
                          STANDINGS_ENTITY_ALIASES)

TOLERANCE = 0.001

_ROUND_POINTS = {
    "drivers": """
        SELECT r.year y, r.round rnd, e.driver_id ent, COALESCE(e.points,0) p
          FROM race_entries e JOIN races r ON r.id = e.race_id
        UNION ALL
        SELECT r.year, r.round, s.driver_id, COALESCE(s.points,0)
          FROM sprint_results s JOIN races r ON r.id = s.race_id""",
    "constructors": """
        SELECT r.year y, r.round rnd, e.constructor_id ent, COALESCE(e.points,0) p
          FROM race_entries e JOIN races r ON r.id = e.race_id
        UNION ALL
        SELECT r.year, r.round, s.constructor_id, COALESCE(s.points,0)
          FROM sprint_results s JOIN races r ON r.id = s.race_id""",
}

_MULTI_ENGINE = """
    SELECT year, entity_id FROM standings
     WHERE table_type = 'constructors' AND after_round IS NOT NULL
     GROUP BY year, entity_id
    HAVING COUNT(DISTINCT COALESCE(engine_id, '')) > 1"""


class Unmappable(Exception):
    """A standings entity with no results under its own id and no alias.

    Raised rather than skipped: an entity the derivation cannot see is one
    this check can never fail for, whatever its figures say, and 104 rows sat
    in exactly that state (review finding, #583).
    """


def _running_totals(con, table):
    """(year, entity, round) -> the sum of rounds 1..round."""
    per_round = {}
    for y, rnd, ent, p in con.execute(
            f"SELECT y, rnd, ent, SUM(p) FROM ({_ROUND_POINTS[table]}) "
            "GROUP BY y, rnd, ent"):
        if ent is not None:
            per_round[(y, rnd, ent)] = p or 0.0
    rounds = sorted({(y, rnd) for (y, rnd, _) in per_round})
    totals, seen = {}, {}
    for y, rnd in rounds:
        for (yy, rr, ent), p in list(per_round.items()):
            if (yy, rr) != (y, rnd):
                continue
            seen[(y, ent)] = seen.get((y, ent), 0.0) + p
        for (yy, ent), tot in seen.items():
            if yy == y:
                totals[(y, rnd, ent)] = tot
    return totals


def expected(derived, adjustment, rnd):
    """What the table should read, given the sum and any declared decision."""
    if adjustment is None:
        return derived
    from_round, how, _why = adjustment
    if rnd < from_round:
        return derived
    return 0.0 if how == "zero" else derived + how


def violations(con, floors=None, adjustments=None, aliases=None):
    """Every standings row that is not what the results make it. One dict per
    row, oldest first. Raises Unmappable before checking anything."""
    floors = STANDINGS_ACCUMULATE_FROM if floors is None else floors
    adjustments = STANDINGS_ADJUSTMENTS if adjustments is None else adjustments
    aliases = STANDINGS_ENTITY_ALIASES if aliases is None else aliases
    multi = {(y, e) for y, e in con.execute(_MULTI_ENGINE)}
    out = []
    for table in ("constructors", "drivers"):
        floor = floors.get(table)
        if floor is None:
            continue
        totals = _running_totals(con, table)
        scored_in = {(y, ent) for (y, _r, ent) in totals}
        for year, ent, engine, rnd, pts in con.execute(
                """SELECT year, entity_id, engine_id, after_round, points
                     FROM standings
                    WHERE table_type = ? AND after_round IS NOT NULL
                      AND points IS NOT NULL AND entity_id IS NOT NULL
                    ORDER BY year, entity_id, after_round""", (table,)):
            if year < floor or (table == "constructors" and (year, ent) in multi):
                continue
            who = aliases.get((table, year, ent), ent)
            if (year, who) not in scored_in:
                raise Unmappable(
                    f"{year} {table} '{ent}' has a championship table and no "
                    f"result rows under that id. Either the results name it "
                    f"something else - add it to STANDINGS_ENTITY_ALIASES in "
                    f"data/current.py with the reason - or the results are "
                    f"missing, which is the larger problem.")
            derived = totals.get((year, rnd, who))
            if derived is None:
                continue                  # the round itself has no results yet
            want = expected(derived, adjustments.get((table, year, ent)), rnd)
            if abs(pts - want) > TOLERANCE:
                out.append({
                    "table_type": table, "year": year, "entity_id": ent,
                    "engine_id": engine, "after_round": rnd, "points": pts,
                    "derived": round(derived, 3), "expected": round(want, 3),
                })
    out.sort(key=lambda v: (v["year"], v["after_round"], v["entity_id"]))
    return out


def describe(v):
    return (f"{v['year']} round {v['after_round']} {v['table_type'][:-1]} "
            f"{v['entity_id']}: table says {v['points']:g}, the results make "
            f"it {v['expected']:g}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default="f1.db")
    ap.add_argument("--survey", action="store_true",
                    help="ignore the floors and the adjustments and print "
                         "every row that is not the plain sum: the "
                         "measurement behind both")
    args = ap.parse_args(argv)
    con = sqlite3.connect(args.db)
    try:
        if args.survey:
            found = violations(con, floors={"constructors": 0, "drivers": 0},
                               adjustments={})
        else:
            found = violations(con)
    except Unmappable as e:
        print(f"  {e}")
        return 1
    for v in found:
        print(" ", describe(v))
    print(f"{len(found)} row(s)")
    return 1 if found and not args.survey else 0


if __name__ == "__main__":
    sys.exit(main())
