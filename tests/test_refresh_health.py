"""refresh.yml's `report` job: is the data behind, and what the issues do (SD-35).

WHY THIS FILE EXISTS
    From 2026-10-02 every refresh failed for three days and nothing said so.
    The two halves of the fix fail quietly in opposite directions: a check
    that never finds a race late is the silence it was written to end, and
    one that alarms through a winter break, or for ever over a cancelled
    race, is an alarm people learn to ignore. So these tests are mostly
    about where the line falls. They read the real f1.db, with the 2026
    Bahrain Grand Prix (round 16, 2026-10-04, no result in this snapshot)
    as the late race, and the real harvest/race_dates.txt as F1DB's calendar.

    python3 -m unittest tests.test_refresh_health
"""
import datetime as dt
import importlib.util
import os
import sqlite3
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, ".github", "scripts")
DB = os.path.join(ROOT, "f1.db")
CALENDAR = os.path.join(ROOT, "harvest", "race_dates.txt")


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(SCRIPTS, f"{name}.py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


health = load("refresh_health")
alarm = load("refresh_alarm")


def day(stamp):
    return dt.date.fromisoformat(stamp)


class ARaceIsLateAfterThreeDays(unittest.TestCase):
    def setUp(self):
        if not os.path.exists(DB):
            self.skipTest("f1.db has not been built")
        self.con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        self.calendar = health.f1db_calendar(CALENDAR)

    def tearDown(self):
        self.con.close()

    def late(self, stamp, calendar=None):
        late, unlisted = health.late_races(
            self.con, self.calendar if calendar is None else calendar, day(stamp))
        return [(r["year"], r["round"]) for r in late], [(r["year"], r["round"]) for r in unlisted]

    def test_not_on_the_third_day(self):
        self.assertEqual(self.late("2026-10-07"), ([], []))

    def test_on_the_fourth(self):
        self.assertEqual(self.late("2026-10-08"), ([(2026, 16)], []))

    def test_a_race_with_a_result_is_never_late(self):
        # Azerbaijan, round 15, has its classification: nine days on, still fine.
        self.assertNotIn((2026, 15), self.late("2026-10-05")[0])

    def test_a_break_raises_nothing(self):
        # Between round 11 (2026-07-26) and round 12 (2026-08-23) no race
        # date passes, so four weeks without a refresh say nothing - which is
        # right, as there was nothing to report.
        self.assertEqual(self.late("2026-08-22"), ([], []))

    def test_a_round_f1db_has_dropped_is_not_late(self):
        # The same season, with F1DB's calendar no longer listing 4 October:
        # taken as cancelled or moved, said as a note, and never an alarm.
        dropped = self.calendar - {(2026, "2026-10-04")}
        self.assertEqual(self.late("2026-10-08", dropped), ([], [(2026, 16)]))

    def test_a_season_f1db_does_not_hold_counts_on_its_typed_dates(self):
        # F1DB has no 2027 calendar in this harvest. That is a season the
        # harvest has not reached, not a season of cancellations - a refresh
        # that died over the winter would never reach it.
        self.assertFalse(any(year == 2027 for year, _ in self.calendar))
        self.assertIn((2027, 1), self.late("2027-03-18")[0])

    def test_the_calendar_is_read_whole(self):
        self.assertIn((2026, "2026-10-04"), self.calendar)
        self.assertIn((1950, "1950-05-13"), self.calendar)


class ASeasonNeedsACalendarByFebruary(unittest.TestCase):
    def setUp(self):
        if not os.path.exists(DB):
            self.skipTest("f1.db has not been built")
        self.con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)

    def tearDown(self):
        self.con.close()

    def test_on_the_first_of_february(self):
        self.assertEqual(health.season_without_calendar(self.con, day("2028-02-01")), 2028)

    def test_not_on_the_last_of_january(self):
        self.assertIsNone(health.season_without_calendar(self.con, day("2028-01-31")))

    def test_not_for_a_season_that_has_one(self):
        self.assertIsNone(health.season_without_calendar(self.con, day("2027-02-01")))


class TheReport(unittest.TestCase):
    def setUp(self):
        if not os.path.exists(DB):
            self.skipTest("f1.db has not been built")

    def test_a_problem_keeps_its_key_as_the_days_go_by(self):
        one, _ = health.check(DB, CALENDAR, day("2026-10-08"))
        two, _ = health.check(DB, CALENDAR, day("2026-10-09"))
        self.assertEqual([k for k, _ in one], ["2026/16"])
        self.assertEqual([k for k, _ in one], [k for k, _ in two])
        self.assertNotEqual(one[0][1], two[0][1])

    def test_it_names_the_race_and_the_day(self):
        problems, notes = health.check(DB, CALENDAR, day("2026-10-08"))
        text = health.report(problems, notes, day("2026-10-08"))
        self.assertIn("Bahrain Grand Prix", text)
        self.assertIn("2026-10-04, 4 days ago", text)


class TheIssues(unittest.TestCase):
    def results(self, gate="success", refresh="success", land="success"):
        return dict(gate=gate, refresh=refresh, land=land)

    def test_a_failed_job_opens_one_and_then_only_updates_it(self):
        failed = self.results(refresh="failure", land="skipped")
        self.assertEqual(alarm.failure_action(failed, False), "open")
        self.assertEqual(alarm.failure_action(failed, True), "update")

    def test_a_gate_that_cannot_mint_a_token_is_a_failure(self):
        self.assertEqual(alarm.failure_action(
            self.results("failure", "skipped", "skipped"), False), "open")

    def test_a_timed_out_job_is_a_failure(self):
        self.assertEqual(alarm.failure_action(
            self.results(refresh="cancelled", land="skipped"), False), "open")

    def test_only_a_run_that_lands_closes_it(self):
        self.assertEqual(alarm.failure_action(self.results(), True), "close")
        self.assertIsNone(alarm.failure_action(self.results(), False))
        stopped = self.results(refresh="skipped", land="skipped")
        self.assertIsNone(alarm.failure_action(stopped, True))

    def test_freshness_follows_the_check(self):
        late = [("2026/16", "- late")]
        self.assertEqual(alarm.freshness_action(late, False), "open")
        self.assertEqual(alarm.freshness_action(late, True), "update")
        self.assertEqual(alarm.freshness_action([], True), "close")
        self.assertIsNone(alarm.freshness_action([], False))

    def test_the_state_survives_a_round_trip_through_the_body(self):
        state = dict(signature="`refresh`: Rebuild and verify", count=16, first="2026-10-02")
        body = alarm.with_mark(alarm.failure_body(["x"], "u", "w", 16, "2026-10-02"), state)
        self.assertEqual(alarm.read_mark(body), state)

    def test_a_body_without_state_reads_as_none(self):
        self.assertEqual(alarm.read_mark("edited by hand"), {})
        self.assertEqual(alarm.read_mark("<!-- refresh-alarm {broken -->"), {})
        self.assertEqual(alarm.read_mark(None), {})


if __name__ == "__main__":
    unittest.main()
