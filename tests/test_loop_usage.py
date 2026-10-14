"""What loop_usage.py reads out of /usage, and what it decides from it.

WHY THIS FILE EXISTS
    The usage check decides, with nobody watching, whether the unattended
    loop starts an item, starts only a small one, or sleeps (D-55). Its input
    is text written for people, which may change wording; a misread that
    produced a number would pace the loop on a figure nobody gave it. So the
    cases here are, first, that anything not read whole is not read at all,
    and then that each threshold, the weekly pace and the race-weekend
    reserve decide what the docstring says they do.
"""
import datetime as dt
import importlib.util
import json
import os
import sqlite3
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, ".claude", "skills", "backlog-loop", "loop_usage.py")
spec = importlib.util.spec_from_file_location("backlog_loop_usage", PATH)
lu = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lu)

UTC = dt.timezone.utc
# Wednesday 14 October 2026, 13:00 in London. The week below resets on
# Monday the 19th at 14:59 London, so it began on Monday the 12th at 14:59:
# 1 day 22 hours of 7 are gone, about 27 %.
NOW = dt.datetime(2026, 10, 14, 12, 0, tzinfo=UTC)
PROBED = ("You are currently using your subscription to power your Claude Code usage\n\n"
          "Current session: 25% used · resets Oct 14, 10:59pm (Europe/London)\n"
          "Current week (all models): 15% used · resets Oct 19, 2:59pm (Europe/London)\n\n"
          "What's contributing to your limits usage?\n  49% of your usage was at >150k context\n")
CONF = {"ANY_LEFT": 20.0, "SMALL_LEFT": 7.0, "SLACK": 10.0, "RESERVE": 10.0}
SESSION_RESET = dt.datetime(2026, 10, 14, 21, 59, tzinfo=UTC)
WEEK_RESET = dt.datetime(2026, 10, 19, 13, 59, tzinfo=UTC)


def report(session=25, week=15):
    return PROBED.replace("25% used", f"{session}% used").replace("15% used", f"{week}% used")


def decide(session=25, week=15, race=None):
    return lu.decide(lu.parse(report(session, week), NOW), NOW, race, CONF)


class ReadsOnlyWhatItCanReadWhole(unittest.TestCase):
    def test_the_probed_report(self):
        self.assertEqual(lu.parse(PROBED, NOW), {"session": (25, SESSION_RESET), "week": (15, WEEK_RESET)})

    def test_a_contributing_percentage_is_not_a_window(self):
        # "49% of your usage" is in the same text; only the two labelled
        # lines are windows.
        self.assertEqual(lu.parse("  49% of your usage was at >150k context\n", NOW), {})

    def test_a_line_missing_its_reset_is_not_read(self):
        self.assertEqual(lu.parse("Current session: 25% used\n", NOW), {})

    def test_a_percentage_out_of_range_is_not_read(self):
        self.assertNotIn("session", lu.parse(report(session=250), NOW))

    def test_a_reworded_report_reads_as_nothing(self):
        self.assertEqual(lu.parse("5-hour window: 25 percent used, back at 10:59pm\n", NOW), {})
        self.assertEqual(lu.decide({}, NOW, None, CONF)[0], "UNKNOWN")

    def test_a_per_model_week_is_not_the_all_models_week(self):
        text = "Current week (Opus): 80% used · resets Oct 19, 2:59pm (Europe/London)\n"
        self.assertEqual(lu.parse(text, NOW), {})


class TheSessionWindow(unittest.TestCase):
    def test_plenty_left_is_go(self):
        self.assertEqual(decide(session=80)[0], "GO")

    def test_getting_close_is_small_and_names_the_reset(self):
        word, until, _ = decide(session=81)
        self.assertEqual((word, until), ("SMALL", SESSION_RESET))
        self.assertEqual(decide(session=93)[0], "SMALL")

    def test_too_little_for_any_item_waits_for_the_reset(self):
        word, until, _ = decide(session=94)
        self.assertEqual((word, until), ("WAIT", SESSION_RESET))


class TheWeeklyPace(unittest.TestCase):
    # 27 % elapsed: the pace allows 0.27 * 100 + 10 = 37 with no race held,
    # and 0.27 * 90 + 10 = 35 with the reserve held.

    def test_within_the_pace_is_go(self):
        self.assertEqual(decide(week=36)[0], "GO")

    def test_ahead_of_the_pace_waits_until_it_catches_up(self):
        word, until, why = decide(week=45)
        self.assertEqual(word, "WAIT")
        # (45 - 10) / 100 of the week from its start on the 12th at 13:59 UTC.
        self.assertEqual(until, WEEK_RESET - lu.WEEK + lu.WEEK * 0.35)
        self.assertIn("ahead of the weekly pace", why)

    def test_the_allowance_spent_waits_for_the_weekly_reset(self):
        self.assertEqual(decide(week=100)[1], WEEK_RESET)

    def test_the_later_of_two_waits(self):
        word, until, _ = decide(session=99, week=60)
        self.assertEqual(word, "WAIT")
        self.assertGreater(until, SESSION_RESET)

    def test_a_weekly_wait_overrides_a_small(self):
        self.assertEqual(decide(session=85, week=60)[0], "WAIT")


class TheRaceWeekendReserve(unittest.TestCase):
    RACE = dt.datetime(2026, 10, 18, 19, 0, tzinfo=UTC)

    def test_a_race_before_the_reset_holds_the_reserve(self):
        self.assertEqual(decide(week=36)[0], "GO")
        self.assertEqual(decide(week=36, race=self.RACE)[0], "WAIT")

    def test_a_race_after_the_reset_holds_nothing(self):
        self.assertEqual(decide(week=36, race=WEEK_RESET + dt.timedelta(days=6))[0], "GO")

    def test_an_unreadable_calendar_keeps_the_reserve(self):
        word, _, why = decide(week=36, race=False)
        self.assertEqual(word, "WAIT")
        self.assertTrue(any("f1.db not readable" in w for w in why))

    def test_the_wait_ends_no_later_than_the_reserve_is_released(self):
        # 95 % used with the reserve held is past the whole allowance, which
        # would wait for the reset - but two days after the race the reserve
        # is released, and the check is made again then.
        race = dt.datetime(2026, 10, 15, 12, 0, tzinfo=UTC)
        self.assertEqual(decide(week=95, race=race)[1], race + lu.RACE_TAIL)

    def test_the_calendar_is_read_from_the_sessions_table(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = os.path.join(tmp, "f1.db")
            con = sqlite3.connect(db)
            con.execute("CREATE TABLE sessions (kind TEXT, start_utc TEXT)")
            con.executemany("INSERT INTO sessions VALUES (?, ?)",
                            [("race", "2026-10-11T19:00Z"), ("qualifying", "2026-10-17T21:00Z"),
                             ("race", "2026-10-18T19:00Z"), ("race", "2026-10-25T20:00Z")])
            con.commit()
            con.close()
            self.assertEqual(lu.next_race(NOW, db), self.RACE)
            # The race of the 11th is still inside its two-day tail on the 13th.
            self.assertEqual(lu.next_race(dt.datetime(2026, 10, 13, 12, 0, tzinfo=UTC), db),
                             dt.datetime(2026, 10, 11, 19, 0, tzinfo=UTC))
        self.assertIs(lu.next_race(NOW, os.path.join(tmp, "missing.db")), False)


class TheCommand(unittest.TestCase):
    def run_with(self, stdout, returncode=0):
        done = mock.Mock(stdout=stdout, returncode=returncode)
        with mock.patch.object(lu.subprocess, "run", return_value=done), \
                mock.patch.object(lu, "next_race", return_value=None):
            return lu.check(NOW, "claude")

    def test_the_report_decides(self):
        text, code = self.run_with(json.dumps({"result": report(session=95), "is_error": False}))
        self.assertTrue(text.startswith("WAIT until 2026-10-14T21:59+00:00 - "), text)
        self.assertEqual(code, 5)
        text, code = self.run_with(json.dumps({"result": report(session=85), "is_error": False}))
        self.assertTrue(text.startswith("SMALL --max-size S, session resets 2026-10-14T21:59+00:00"), text)
        self.assertEqual(code, 3)

    def test_anything_unreadable_carries_on_and_says_so(self):
        for stdout, rc in (("", 1), ("not json", 0), (json.dumps({"is_error": True, "result": "x"}), 1),
                           (json.dumps({"result": "You are using an API key", "is_error": False}), 0)):
            text, code = self.run_with(stdout, rc)
            self.assertTrue(text.startswith("UNKNOWN - "), text)
            self.assertEqual(code, 0)

    def test_no_cli_is_unknown_without_running_anything(self):
        with mock.patch.object(lu.subprocess, "run") as run, \
                mock.patch.object(lu.shutil, "which", return_value=None), \
                mock.patch.dict(os.environ, {"CLAUDE_BIN": ""}):
            text, code = lu.check(NOW)
        run.assert_not_called()
        self.assertEqual((text.split()[0], code), ("UNKNOWN", 0))

    def test_a_threshold_in_the_environment_that_is_not_a_number_is_the_default(self):
        self.assertEqual(lu.settings({"LOOP_USAGE_ANY_LEFT": "lots"})["ANY_LEFT"], 20.0)
        self.assertEqual(lu.settings({"LOOP_USAGE_ANY_LEFT": "30"})["ANY_LEFT"], 30.0)


if __name__ == "__main__":
    unittest.main()
