#!/usr/bin/env python3
"""Whether a title is decided while rounds are still to run (LV-15).

The arithmetic of titleAnswer() in web/src/queries/season.js, for verify.py:
what a driver can still win is a win and any fastest lap in every round left
and a sprint win in every sprint left; what a team can is a one-two in each.
A title is decided here only where no rival can even draw level, so a tie on
points never comes into it. A season the arithmetic cannot price answers
None, as the page declines: scores dropped, standings behind the calendar, a
scale that does not hold two places, or fewer than two on the table.

    python3 tools/title_decided.py        # the seasons being run, from f1.db
"""
import json
import os
import sqlite3

EVERY_RESULT_COUNTS = "Every result counts"
CONSTRUCTORS_FROM = 1958
EVERY_CAR_COUNTS_FROM = 1979


def leader_beyond_reach(table, available):
    """The id at the top of `table`, a list of (id, points), where nobody
    below it can reach or equal it with `available` still to be won; else
    None. Strict by design: a rival who can only draw level is still in."""
    if available is None or len(table) < 2:
        return None
    first, second = sorted(table, key=lambda row: -row[1])[:2]
    return first[0] if first[1] - second[1] > available else None


def _one_two(scale):
    """A points scale's first two places added, or None where it does not
    hold two numbers."""
    try:
        places = json.loads(scale)
    except (TypeError, ValueError):
        return None
    if not isinstance(places, list) or len(places) < 2:
        return None
    if not all(isinstance(p, (int, float)) for p in places[:2]):
        return None
    return places[0] + places[1]


def _system(con, year, session):
    return con.execute(
        """SELECT win_points, fastest_lap_points, dropped_scores, scale
             FROM points_systems
            WHERE session = ? AND from_year <= ?
              AND (to_year IS NULL OR to_year >= ?)
            ORDER BY from_year DESC LIMIT 1""", (session, year, year)).fetchone()


def _table(con, year, kind, column):
    return [(ident, points) for ident, points in con.execute(
        f"""SELECT {column}, points FROM v_standings_final
             WHERE year = ? AND table_type = ? AND points IS NOT NULL
               AND position IS NOT NULL""", (year, kind))]


def still_running(con):
    """The years with a round run and a round to run."""
    return [row[0] for row in con.execute(
        """SELECT year FROM races GROUP BY year
            HAVING SUM(status = 'completed') > 0
               AND SUM(status <> 'completed') > 0 ORDER BY year""")]


def decided(con, year):
    """{'drivers': id or None, 'constructors': id or None} for a season being
    run, or None where the arithmetic declines the whole season."""
    run, races, sprints = con.execute(
        """SELECT SUM(status = 'completed'), SUM(status <> 'completed'),
                  SUM(CASE WHEN status <> 'completed' THEN sprint ELSE 0 END)
             FROM races WHERE year = ?""", (year,)).fetchone()
    after = con.execute(
        """SELECT MAX(after_round) FROM standings
            WHERE year = ? AND basis = 'running'""", (year,)).fetchone()[0]
    race = _system(con, year, "race")
    if not races or after != run or race is None:
        return None
    win, lap, dropped, scale = race
    if dropped != EVERY_RESULT_COUNTS or win is None or lap is None:
        return None
    sprint = _system(con, year, "sprint")
    if sprints and sprint is None:
        return None

    driver_most = races * (win + lap) + (sprints * sprint[0] if sprints else 0)
    answer = {
        "drivers": leader_beyond_reach(
            _table(con, year, "drivers", "driver_id"), driver_most),
        "constructors": None,
    }
    race_pair = _one_two(scale)
    sprint_pair = _one_two(sprint[3]) if sprints else 0
    if (year >= max(CONSTRUCTORS_FROM, EVERY_CAR_COUNTS_FROM)
            and race_pair is not None and sprint_pair is not None):
        answer["constructors"] = leader_beyond_reach(
            _table(con, year, "constructors", "constructor_id"),
            races * (race_pair + lap) + sprints * sprint_pair)
    return answer


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    con = sqlite3.connect(os.path.join(root, "f1.db"))
    for year in still_running(con):
        print(year, decided(con, year))


if __name__ == "__main__":
    main()
