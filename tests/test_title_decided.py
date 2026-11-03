"""A title decided with rounds to run: the arithmetic, and verify.py on it.

LV-15. A season can have its champion before its last round, and the database
then holds that name while every final figure stays NULL. `tools/title_decided.py`
is the arithmetic; the second half copies f1.db, puts a finished season back
to rounds to run, moves one thing and runs the section as a separate process,
as test_verify_refuses does, so a check that stopped reading its own result
would show.

    python3 -m unittest tests.test_title_decided
"""
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from title_decided import decided, leader_beyond_reach, still_running  # noqa: E402

VERIFY = os.path.join(ROOT, "verify.py")
SOURCE_DB = os.path.join(ROOT, "f1.db")
SCALE = "[25,18,15,12,10,8,6,4,2,1]"
EVERY = "Every result counts"


def season(rounds=5, run=3, sprints=(), dropped=EVERY, after=3, drivers=None, teams=None,
           scale=SCALE):
    """An in-memory season: `rounds` on the calendar and `run` of them run,
    with the tables title_decided.py reads and nothing else."""
    con = sqlite3.connect(":memory:")
    con.executescript("""
        CREATE TABLE races (year, round, status, sprint);
        CREATE TABLE points_systems (session, from_year, to_year, win_points,
                                     fastest_lap_points, dropped_scores, scale);
        CREATE TABLE standings (year, basis, after_round);
        CREATE TABLE v_standings_final (year, table_type, position, driver_id,
                                        constructor_id, points);
    """)
    for n in range(1, rounds + 1):
        con.execute("INSERT INTO races VALUES (2026, ?, ?, ?)",
                    (n, "completed" if n <= run else "scheduled", int(n in sprints)))
    con.execute("INSERT INTO points_systems VALUES ('race', 2025, NULL, 25, 0, ?, ?)",
                (dropped, scale))
    con.execute("INSERT INTO points_systems VALUES ('sprint', 2022, NULL, 8, 0, ?, ?)",
                (EVERY, "[8,7,6]"))
    con.execute("INSERT INTO standings VALUES (2026, 'running', ?)", (after,))
    for i, (who, points) in enumerate(drivers or [("a", 110), ("b", 30)], 1):
        con.execute("INSERT INTO v_standings_final VALUES (2026, 'drivers', ?, ?, NULL, ?)",
                    (i, who, points))
    for i, (who, points) in enumerate(teams or [("x", 200), ("y", 120)], 1):
        con.execute("INSERT INTO v_standings_final VALUES (2026, 'constructors', ?, NULL, ?, ?)",
                    (i, who, points))
    return con


class TheArithmetic(unittest.TestCase):
    def test_a_rival_who_can_only_draw_level_is_still_in(self):
        self.assertEqual(leader_beyond_reach([("a", 100), ("b", 49)], 50), "a")
        self.assertIsNone(leader_beyond_reach([("a", 100), ("b", 50)], 50))

    def test_the_table_need_not_arrive_in_order(self):
        self.assertEqual(leader_beyond_reach([("b", 10), ("a", 100), ("c", 40)], 50), "a")

    def test_nobody_to_beat_or_nothing_to_measure_against_decides_nothing(self):
        self.assertIsNone(leader_beyond_reach([("a", 100)], 50))
        self.assertIsNone(leader_beyond_reach([("a", 100), ("b", 0)], None))

    def test_a_season_decided_before_its_last_round(self):
        # Two rounds left: 50 to a driver, 86 to a team a one-two in each.
        self.assertEqual(decided(season(), 2026), {"drivers": "a", "constructors": None})

    def test_both_titles_at_once(self):
        con = season(teams=[("x", 300), ("y", 120)])
        self.assertEqual(decided(con, 2026), {"drivers": "a", "constructors": "x"})

    def test_a_sprint_still_to_run_counts(self):
        # 50 and a sprint win of 8 against a lead of 55: decided without it.
        con = season(drivers=[("a", 85), ("b", 30)], sprints=(5,))
        self.assertIsNone(decided(con, 2026)["drivers"])
        con = season(drivers=[("a", 85), ("b", 30)])
        self.assertEqual(decided(con, 2026)["drivers"], "a")

    def test_a_season_the_arithmetic_cannot_price_declines(self):
        self.assertIsNone(decided(season(dropped="Best 11 results"), 2026))
        self.assertIsNone(decided(season(after=2), 2026), "standings behind the calendar")
        self.assertIsNone(decided(season(run=5, after=5), 2026), "no round left")

    def test_a_scale_short_of_two_places_declines_the_team_title_alone(self):
        answer = decided(season(scale="[25]", teams=[("x", 300), ("y", 120)]), 2026)
        self.assertEqual(answer, {"drivers": "a", "constructors": None})

    def test_only_a_season_part_run_is_being_run(self):
        con = season()
        con.execute("INSERT INTO races VALUES (2025, 1, 'completed', 0)")
        con.execute("INSERT INTO races VALUES (2027, 1, 'scheduled', 0)")
        self.assertEqual(still_running(con), [2026])


class TheGate(unittest.TestCase):
    """verify.py over a copy of f1.db with 2023 put back to round 19 of 22,
    with Verstappen out of everyone's reach, so the cases do not depend on
    which season the committed database happens to be running."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="lapledger-title-")
        cls.db = os.path.join(cls.tmp, "f1.db")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def run_section(self, change="SELECT 1", *args):
        shutil.copyfile(SOURCE_DB, self.db)
        con = sqlite3.connect(self.db)
        con.execute("UPDATE races SET status = 'scheduled' WHERE year = 2023 AND round > 19")
        con.execute("""DELETE FROM standings WHERE year = 2023
                        AND (basis = 'final' OR after_round > 19)""")
        con.execute("""UPDATE seasons SET champion_points = NULL, champion_wins = NULL,
                         runner_up = NULL, runner_up_points = NULL, margin = NULL,
                         constructors_points = NULL WHERE year = 2023""")
        con.execute(change, args)
        con.commit()
        con.close()
        proc = subprocess.run(
            [sys.executable, VERIFY, "--db", self.db, "--only", "decided before"],
            cwd=ROOT, capture_output=True, text=True, timeout=120, check=False)
        return proc.stdout + proc.stderr

    def test_a_decided_champion_and_null_figures_pass(self):
        out = self.run_section()
        self.assertIn("[PASS] a champion recorded before the last round", out)
        self.assertIn("[PASS] a season's final figures wait", out)

    def test_a_champion_within_a_rivals_reach_is_refused(self):
        out = self.run_section("UPDATE seasons SET drivers_champion = 'perez' WHERE year = 2023")
        self.assertIn("[FAIL] a champion recorded before the last round", out)
        self.assertIn("perez recorded, the arithmetic has verstappen", out)

    def test_a_final_figure_before_the_last_round_is_refused(self):
        out = self.run_section("UPDATE seasons SET champion_points = 575 WHERE year = 2023")
        self.assertIn("[FAIL] a season's final figures wait", out)
        self.assertIn("2023 champion_points", out)

    def test_a_decided_title_left_unrecorded_warns_and_does_not_fail(self):
        out = self.run_section("UPDATE seasons SET drivers_champion = NULL WHERE year = 2023")
        self.assertIn("[WARN] every title the arithmetic has decided", out)
        self.assertIn("2023 drivers: verstappen - record it in data/seasons.py", out)
        self.assertNotIn("[FAIL]", out)


if __name__ == "__main__":
    unittest.main()
