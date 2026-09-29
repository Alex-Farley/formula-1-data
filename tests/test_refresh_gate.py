"""refresh.yml's gate, against the real timetable.

WHY THIS FILE EXISTS
    The refresh is scheduled every three hours and this gate stops most of
    those runs. A gate that always said no would stop the daily check too,
    and nothing else would notice until the check date on the site went
    stale; a gate that always said yes would only cost minutes. So the
    tests are mostly about when it must say yes. They read the real
    `sessions` table, with the 2026 Azerbaijan weekend (round 15, race
    2026-09-26 11:00 UTC) as the case the gate was written for.

    python3 -m unittest tests.test_refresh_gate
"""
import datetime as dt
import importlib.util
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "f1.db")
spec = importlib.util.spec_from_file_location(
    "refresh_gate", os.path.join(ROOT, ".github", "scripts", "refresh_gate.py"))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def at(stamp):
    return dt.datetime.fromisoformat(stamp).replace(tzinfo=dt.timezone.utc)


class TheDailyCheckIsNeverSkipped(unittest.TestCase):
    def test_the_first_run_of_a_quiet_day_goes_ahead(self):
        self.assertIsNotNone(gate.decide("schedule", "2026-08-11", at("2026-08-12T23:47"), 0))

    def test_a_later_run_of_a_quiet_day_stops(self):
        self.assertIsNone(gate.decide("schedule", "2026-08-12", at("2026-08-12T08:47"), 0))

    def test_a_run_by_hand_always_goes_ahead(self):
        self.assertIsNotNone(gate.decide("workflow_dispatch", "2026-08-12",
                                         at("2026-08-12T08:47"), 0))

    def test_the_file_the_workflow_stamps_still_parses(self):
        self.assertRegex(gate.last_checked(os.path.join(ROOT, "web", "src", "lib", "refresh.js")),
                         r"^\d{4}-\d{2}-\d{2}$")


class ARaceWeekendIsFollowed(unittest.TestCase):
    def setUp(self):
        if not os.path.exists(DB):
            self.skipTest("f1.db has not been built")

    def started(self, stamp):
        return gate.sessions_started(DB, at(stamp))

    def test_from_the_first_practice(self):
        self.assertEqual(self.started("2026-09-24T08:29"), 0)
        self.assertGreater(self.started("2026-09-24T08:30"), 0)

    def test_to_seventy_two_hours_after_the_race(self):
        self.assertGreater(self.started("2026-09-29T10:59"), 0)
        self.assertEqual(self.started("2026-09-29T11:00"), 0)

    def test_a_stamped_day_inside_the_window_still_runs(self):
        now = at("2026-09-27T14:47")
        self.assertIsNotNone(gate.decide("schedule", "2026-09-27", now,
                                         gate.sessions_started(DB, now)))

    def test_a_stamped_day_between_weekends_stops(self):
        now = at("2026-09-30T14:47")
        self.assertIsNone(gate.decide("schedule", "2026-09-30", now,
                                      gate.sessions_started(DB, now)))


if __name__ == "__main__":
    unittest.main()
