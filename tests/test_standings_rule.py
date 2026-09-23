"""The standings rule, shown refusing what it exists to refuse.

WHY THIS FILE EXISTS
    /seasons/2026 published Mercedes on 468 constructors' points after round
    14 while the drivers' table on the same page gave their two drivers 503
    between them. F1DB v2026.14.0 had shipped round 13's constructor totals
    under round 14, and nothing in the build could tell: standings were
    cross-checked only against another source's standings, which cannot see a
    file that was not updated.

    The first version of the rule asked only whether a total MOVED, and the
    review of #583 got three things past it — a table frozen for a whole
    season under an id the derivation could not see, two consecutive stale
    rounds converging on a figure no source published, and that figure then
    being filed in `discrepancies` as though a source had published it. Each
    of those is a test here.

    Every test copies f1.db, plants what must be refused, and asserts the rule
    names it. A guard nobody has watched fail is a guard nobody knows the
    shape of.

    python3 -m unittest tests.test_standings_rule
"""
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB = os.path.join(ROOT, "f1.db")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))

import standings_rule  # noqa: E402

import build  # noqa: E402


class PlantedInACopy(unittest.TestCase):
    def setUp(self):
        if not os.path.exists(DB):
            self.skipTest("f1.db has not been built")
        fd, self.db = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        shutil.copy(DB, self.db)
        self.con = sqlite3.connect(self.db)

    def tearDown(self):
        self.con.close()
        os.unlink(self.db)

    def freeze(self, year, table, rnd, onto):
        """Write round `onto`'s totals under round `rnd`: the exact shape of
        the F1DB file that caused this."""
        rows = self.con.execute(
            "SELECT entity_id, points FROM standings WHERE year=? AND "
            "table_type=? AND after_round=?", (year, table, onto)).fetchall()
        for entity, pts in rows:
            self.con.execute(
                "UPDATE standings SET points=? WHERE year=? AND table_type=? "
                "AND entity_id=? AND after_round=?",
                (pts, year, table, entity, rnd))
        self.con.commit()
        return len(rows)


class TheRuleCatchesAStaleFile(PlantedInACopy):
    def test_a_round_repeating_the_one_before_it_is_named(self):
        self.freeze(2026, "constructors", 14, 13)
        bad = standings_rule.violations(self.con)
        self.assertTrue(bad, "a frozen round 14 was not refused")
        named = {v["entity_id"] for v in bad}
        self.assertIn("mercedes", named)
        mercedes = next(v for v in bad if v["entity_id"] == "mercedes")
        self.assertAlmostEqual(mercedes["expected"], 503.0, places=3,
                               msg="the rule did not put Mercedes back on the "
                                   "sum of their drivers' points")

    def test_the_replacement_is_the_results_and_not_the_previous_row(self):
        """Two consecutive stale rounds.

        The first version computed a correction as `previous + this round`,
        so when round 13 was stale too the round 14 answer was built on a
        wrong number and settled somewhere no result supports. The expected
        figure must depend only on the results.
        """
        self.freeze(2026, "constructors", 13, 12)
        self.freeze(2026, "constructors", 14, 13)
        bad = {(v["entity_id"], v["after_round"]): v
               for v in standings_rule.violations(self.con)}
        self.assertIn(("ferrari", 14), bad)
        self.assertAlmostEqual(bad[("ferrari", 14)]["expected"], 358.0, places=3)
        self.assertAlmostEqual(bad[("ferrari", 13)]["expected"], 346.0, places=3)

    def test_a_table_frozen_for_a_whole_season_of_the_hinwil_team(self):
        """The team that raced as Alfa Romeo in 2019-2023 is `sauber` in both
        tables since DA-28. Before, the standings said `alfa-romeo`, the
        derivation needed an alias to see any points at all, and without it a
        table frozen for eighteen rounds read as correct."""
        self.freeze(2022, "constructors", 20, 4)
        bad = [v for v in standings_rule.violations(self.con)
               if v["entity_id"] == "sauber"]
        self.assertTrue(bad, "a frozen 2022 Sauber table was not refused")


class AnEntityTheResultsDoNotHoldStopsTheRule(PlantedInACopy):
    def test_one_entrant_under_two_ids_is_raised_and_not_skipped(self):
        """The split DA-28 closed, put back in a copy: the 2022 table under
        F1DB's `alfa-romeo` while the results say `sauber`."""
        self.con.execute(
            "UPDATE standings SET entity_id='alfa-romeo' "
            "WHERE year=2022 AND table_type='constructors' "
            "AND entity_id='sauber'")
        self.con.commit()
        with self.assertRaises(standings_rule.Unmappable) as caught:
            standings_rule.violations(self.con)
        self.assertIn("alfa-romeo", str(caught.exception))

    def test_a_new_unmappable_entity_stops_it_too(self):
        self.con.execute(
            "UPDATE standings SET entity_id='a-team-that-never-raced' "
            "WHERE year=2026 AND table_type='constructors' AND entity_id='haas'")
        self.con.commit()
        with self.assertRaises(standings_rule.Unmappable):
            standings_rule.violations(self.con)


class TheDeclarationsAreRead(PlantedInACopy):
    def test_a_declared_adjustment_is_not_a_violation(self):
        self.assertEqual(
            [v for v in standings_rule.violations(self.con)
             if (v["year"], v["entity_id"]) in
             {(2007, "mclaren"), (2018, "force-india"), (2020, "racing-point"),
              (1995, "benetton"), (1995, "williams"), (2000, "mclaren")}],
            [])

    def test_without_its_declaration_each_one_is(self):
        for key in standings_rule.STANDINGS_ADJUSTMENTS:
            table, year, entity = key
            without = {k: v for k, v in
                       standings_rule.STANDINGS_ADJUSTMENTS.items() if k != key}
            bad = standings_rule.violations(self.con, adjustments=without)
            self.assertTrue(
                any(v["year"] == year and v["entity_id"] == entity for v in bad),
                f"{year} {entity} is declared and nothing needs the declaration")

    def test_the_floors_have_something_below_them(self):
        for table, floor in standings_rule.STANDINGS_ACCUMULATE_FROM.items():
            bad = standings_rule.violations(self.con, floors={table: 0},
                                            adjustments={})
            self.assertTrue(
                [v for v in bad if v["table_type"] == table and v["year"] < floor],
                f"{table}'s floor of {floor} is later than the evidence for it")


class OnlyARepeatedRoundIsCorrected(PlantedInACopy):
    """The build path, which is where the correction lives.

    The first version of these tests called `violations()` only, which by
    construction never reads a stored previous row - so the test named for
    the previous-row defect could not have caught it (review finding, #583).
    These drive `build.py`'s own function against a planted database.
    """

    class _Build:
        """What the correction reads of the build: a cursor and a connection."""

        def __init__(self, con):
            self.con = con
            self.cur = con.cursor()

    def correct(self):
        return build._correct_standings_the_results_contradict(self._Build(self.con))

    def points(self, year, table, entity, rnd):
        return self.con.execute(
            "SELECT points FROM standings WHERE year=? AND table_type=? AND "
            "entity_id=? AND after_round=?", (year, table, entity, rnd)).fetchone()[0]

    def test_a_repeated_round_is_put_back_on_the_results(self):
        self.freeze(2026, "constructors", 14, 13)
        self.assertGreaterEqual(self.correct(), 7)
        self.assertAlmostEqual(self.points(2026, "constructors", "mercedes", 14),
                               503.0, places=3)

    def test_two_stale_rounds_are_each_their_own_sum(self):
        """The defect the previous-row arithmetic produced: round 14 built on
        a corrected round 13 rather than on the results, and Ferrari settled
        on 350 where the results give 358."""
        self.freeze(2026, "constructors", 13, 12)
        self.freeze(2026, "constructors", 14, 13)
        self.correct()
        self.assertAlmostEqual(self.points(2026, "constructors", "ferrari", 13),
                               346.0, places=3)
        self.assertAlmostEqual(self.points(2026, "constructors", "ferrari", 14),
                               358.0, places=3)

    def test_the_published_figure_is_filed_once_and_as_published(self):
        # The copy already carries the row this build filed for real, so it
        # is what the correction ADDS that is counted.
        self.con.execute("DELETE FROM discrepancies WHERE subject='2026 round 14'")
        self.con.commit()
        self.freeze(2026, "constructors", 14, 13)
        self.correct()
        rows = self.con.execute(
            "SELECT stored_value, derived_value FROM discrepancies "
            "WHERE subject='2026 round 14'").fetchall()
        self.assertEqual(len(rows), 1, "the round was filed more than once")
        self.assertIn("mercedes 468", rows[0][0])
        self.assertIn("mercedes 503", rows[0][1])

    def test_an_undeclared_deduction_stops_the_build(self):
        """A points deduction arriving without a declaration is somebody's
        decision, not a stale file. The first version overwrote it with this
        build's arithmetic and filed the real figure as the error."""
        self.con.execute(
            "UPDATE standings SET points = points - 10 WHERE year=2026 AND "
            "table_type='constructors' AND entity_id='ferrari' AND after_round=14")
        self.con.commit()
        with self.assertRaises(SystemExit) as stop:
            self.correct()
        self.assertIn("ferrari", str(stop.exception))
        self.assertIn("STANDINGS_ADJUSTMENTS", str(stop.exception))

    def test_a_current_row_that_is_ahead_is_not_pulled_backwards(self):
        """The carry follows a `current` row that repeated the same stale
        figure. Any other value is left alone and said out loud - writing the
        latest round over it in either direction would turn a build stop into
        a silently shipped stale figure."""
        self.freeze(2026, "constructors", 14, 13)
        self.con.execute(
            "UPDATE standings SET points = 999 WHERE year=2026 AND "
            "table_type='constructors' AND entity_id='mercedes' "
            "AND after_round IS NULL AND as_of='current'")
        self.con.commit()
        self.correct()
        self.assertEqual(
            self.con.execute(
                "SELECT points FROM standings WHERE year=2026 AND "
                "table_type='constructors' AND entity_id='mercedes' "
                "AND after_round IS NULL AND as_of='current'").fetchone()[0],
            999.0, "a 'current' row that was not the stale figure was overwritten")

    def test_a_round_the_results_do_not_reach_stops_it(self):
        """A table published ahead of the results cannot be checked against
        them, and a round that cannot be checked is one the rule can never
        refuse."""
        self.con.execute("DELETE FROM race_entries WHERE race_id IN "
                         "(SELECT id FROM races WHERE year=2026 AND round=14)")
        self.con.execute("DELETE FROM sprint_results WHERE race_id IN "
                         "(SELECT id FROM races WHERE year=2026 AND round=14)")
        self.con.commit()
        with self.assertRaises(SystemExit) as stop:
            self.correct()
        self.assertIn("round 14", str(stop.exception))


class TheToolSaysSo(PlantedInACopy):
    def test_it_exits_1_and_names_the_rows(self):
        self.freeze(2026, "constructors", 14, 13)
        r = subprocess.run(
            [sys.executable, os.path.join(ROOT, "tools", "standings_rule.py"),
             "--db", self.db],
            capture_output=True, text=True, cwd=ROOT, check=False)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("mercedes", r.stdout)
        self.assertIn("503", r.stdout)

    def test_a_clean_database_exits_0(self):
        r = subprocess.run(
            [sys.executable, os.path.join(ROOT, "tools", "standings_rule.py"),
             "--db", self.db],
            capture_output=True, text=True, cwd=ROOT, check=False)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
