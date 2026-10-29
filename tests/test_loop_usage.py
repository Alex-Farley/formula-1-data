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
import contextlib
import datetime as dt
import importlib.util
import io
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
CONF = {"M_LEFT": 70.0, "SMALL_LEFT": 7.0, "SLACK": 10.0, "RESERVE": 10.0}
SESSION_RESET = dt.datetime(2026, 10, 14, 21, 59, tzinfo=UTC)
WEEK_RESET = dt.datetime(2026, 10, 19, 13, 59, tzinfo=UTC)


def report(session=25, week=15):
    return PROBED.replace("25% used", f"{session}% used").replace("15% used", f"{week}% used")


CONF_LOOK = dict(CONF, ALARM_LOOK=60.0)


def decide(session=25, week=15, race=None):
    """(word, until, why) with no alarm looked for, as before AF-130."""
    return lu.decide(lu.parse(report(session, week), NOW), NOW, race, CONF)[:3]


class ReadsOnlyWhatItCanReadWhole(unittest.TestCase):
    def test_the_probed_report(self):
        self.assertEqual(lu.parse(PROBED, NOW), {"session": (25, SESSION_RESET), "week": (15, WEEK_RESET)})

    def test_a_contributing_percentage_is_not_a_window(self):
        # "49% of your usage" is in the same text; only the two labelled
        # lines are windows.
        self.assertEqual(lu.parse("  49% of your usage was at >150k context\n", NOW), {})

    def test_a_line_missing_its_reset_is_not_read(self):
        self.assertEqual(lu.parse("Current session: 25% used\n", NOW), {})

    def test_an_hour_off_the_clock_is_not_read(self):
        self.assertEqual(lu.parse(report().replace("10:59pm", "13pm"), NOW).keys(), {"week"})
        self.assertIsNone(lu.reset_at("resets 0am (UTC)", NOW))

    def test_a_zone_that_does_not_resolve_is_not_read(self):
        self.assertEqual(lu.parse(report().replace("(Europe/London)", "(Mars/Base)", 1), NOW).keys(), {"week"})
        self.assertEqual(lu.parse("Current session: 5% used · resets 11pm\n", NOW), {})

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
        self.assertEqual(decide(session=0)[0], "GO")
        self.assertEqual(decide(session=30)[0], "GO")

    def test_under_m_left_is_small_and_names_the_reset(self):
        # 70 points left (30 used) is the first GO; 69 left is the top
        # of the band that is SMALL only, down to 7 left (93 used).
        word, until, why = decide(session=31)
        self.assertEqual((word, until), ("SMALL", SESSION_RESET))
        self.assertIn("under 70 points left: an XS or S item only", " ".join(why))
        self.assertEqual(decide(session=80)[0], "SMALL")
        self.assertEqual(decide(session=93)[0], "SMALL")

    def test_the_three_overruns_were_small(self):
        # AF-90 started at 55 % used, PM-75 at 63 %, AF-132 at 42 %: all
        # three were GO before AF-148 and all three ran out of session.
        for used in (55, 63, 42):
            self.assertEqual(decide(session=used)[0], "SMALL", used)

    def test_a_window_that_has_just_rolled_over_is_go_and_says_why(self):
        windows = lu.parse(report(), NOW)
        del windows["session"]
        word, _, why, _ = lu.decide(windows, NOW, None, CONF)
        self.assertEqual(word, "GO")
        self.assertIn("a window just rolled over shows none", " ".join(why))

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


class TheReserveGoesOnAnAlarmAlone(unittest.TestCase):
    """AF-130: while the reserve is held, it may be spent on a refresh alarm
    `next.py --alarm` names, and on nothing else."""
    RACE = dt.datetime(2026, 10, 18, 19, 0, tzinfo=UTC)

    def decide(self, session=25, week=36, race=RACE, found=None):
        asked = []

        def alarm():
            asked.append(True)
            return (found, None) if found else (None, "no refresh alarm to spend it on")
        out = lu.decide(lu.parse(report(session, week), NOW), NOW, race, CONF_LOOK, alarm)
        return out, bool(asked)

    def test_an_alarm_at_the_head_with_the_reserve_binding_is_allowed(self):
        # 36 % is within the pace with no race and past it with the reserve held.
        (word, until, why, target), asked = self.decide(found="AF-150")
        self.assertTrue(asked)
        self.assertEqual((word, target), ("ALARM", "AF-150"))
        # The time ordinary work may start again: the pace catching up.
        self.assertEqual(until, WEEK_RESET - lu.WEEK + lu.WEEK * (26 / 90))
        self.assertTrue(lu.line(word, until, why, target).startswith("ALARM AF-150 until 2026-10-"))
        self.assertEqual(lu.EXIT[word], 4)

    def test_past_the_reserve_line_but_under_the_whole_week_too(self):
        (word, _, _, target), _ = self.decide(week=95, found="AF-150 #1160")
        self.assertEqual((word, target), ("ALARM", "AF-150 #1160"))

    def test_an_ordinary_item_with_the_reserve_binding_waits_and_looks_again(self):
        (word, until, why, target), asked = self.decide()
        self.assertTrue(asked)
        self.assertEqual((word, target), ("WAIT", None))
        # Not the pace's catch-up, which is days off: the next look.
        self.assertEqual(until, NOW + dt.timedelta(minutes=60))
        self.assertIn("no refresh alarm to spend it on", why)

    def test_an_alarm_with_the_session_window_too_low_waits(self):
        (word, until, _, _), asked = self.decide(session=94, found="AF-150")
        self.assertFalse(asked)
        self.assertEqual((word, until), ("WAIT", SESSION_RESET))

    def test_an_alarm_starts_on_the_small_rung(self):
        (word, _, _, target), _ = self.decide(session=85, found="AF-150")
        self.assertEqual((word, target), ("ALARM", "AF-150"))

    def test_an_unread_session_window_starts_no_alarm(self):
        windows = lu.parse(report(25, 36), NOW)
        del windows["session"]
        asked = []
        word, _, why, target = lu.decide(windows, NOW, self.RACE, CONF_LOOK,
                                         lambda: asked.append(True) or ("AF-150", None))
        self.assertEqual((word, target, asked), ("WAIT", None, []))
        self.assertTrue(any(w.startswith("session window not readable") for w in why), why)

    def test_the_look_is_never_under_its_floor(self):
        for value in ("0", "-5", "3"):
            self.assertEqual(lu.settings({"LOOP_USAGE_ALARM_LOOK": value})["ALARM_LOOK"],
                             lu.ALARM_LOOK_FLOOR)
        self.assertEqual(lu.settings({"LOOP_USAGE_ALARM_LOOK": "30"})["ALARM_LOOK"], 30.0)
        # Not a number of minutes at all: the default, as for any threshold.
        for value in ("nan", "inf", "-inf"):
            self.assertEqual(lu.settings({"LOOP_USAGE_ALARM_LOOK": value})["ALARM_LOOK"], 60.0)

    def test_the_whole_week_spent_spends_nothing(self):
        (word, until, _, _), asked = self.decide(week=100, found="AF-150")
        self.assertFalse(asked)
        # No shorter look either: the reset, as before AF-130.
        self.assertEqual((word, until), ("WAIT", WEEK_RESET))

    def test_ahead_of_the_pace_with_no_reserve_held_spends_nothing(self):
        (word, _, _, _), asked = self.decide(week=45, race=None, found="AF-150")
        self.assertFalse(asked)
        self.assertEqual(word, "WAIT")

    def test_within_the_pace_looks_for_nothing(self):
        (word, _, _, _), asked = self.decide(week=20, found="AF-150")
        self.assertFalse(asked)
        self.assertEqual(word, "GO")

    def test_the_lookup_reads_next_py_and_fails_towards_none(self):
        def ran(stdout, code):
            with mock.patch.object(lu.subprocess, "run", return_value=mock.Mock(stdout=stdout, returncode=code)):
                return lu.reserve_alarm()
        self.assertEqual(ran("AF-150\n", 0), ("AF-150", None))
        self.assertEqual(ran("AF-150 #1160\n", 0), ("AF-150 #1160", None))
        self.assertEqual(ran("", 1)[0], None)
        self.assertIn("exit 3", ran("", 3)[1])
        self.assertEqual(ran("AF-150; rm -rf /\n", 0)[0], None)
        with mock.patch.object(lu.subprocess, "run", side_effect=lu.subprocess.TimeoutExpired("x", 1)):
            self.assertEqual(lu.reserve_alarm()[0], None)


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
        text, code = self.run_with(json.dumps({"result": report(session=60), "is_error": False}))
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
        self.assertEqual(lu.settings({"LOOP_USAGE_M_LEFT": "lots"})["M_LEFT"], 70.0)
        self.assertEqual(lu.settings({"LOOP_USAGE_M_LEFT": "30"})["M_LEFT"], 30.0)

    def test_the_bands_follow_the_setting(self):
        conf = dict(CONF, M_LEFT=30.0)
        windows = lu.parse(report(session=70), NOW)
        self.assertEqual(lu.decide(windows, NOW, None, conf)[0], "GO")
        self.assertEqual(lu.decide(lu.parse(report(session=71), NOW), NOW, None, conf)[0], "SMALL")


class TheLog(unittest.TestCase):
    def test_a_run_by_hand_is_filed_as_manual(self):
        self.assertEqual(lu.log_id([]), "usage (manual)")
        self.assertEqual(lu.log_id(["--loop"]), "usage")

    def run_main(self, argv):
        with mock.patch.object(lu, "check", return_value=("GO - fine", 0)), \
                mock.patch.object(lu.subprocess, "run") as run, \
                contextlib.redirect_stdout(io.StringIO()):
            code = lu.main(argv)
        return code, run.call_args[0][0]

    def test_main_passes_the_id_to_progress_sh(self):
        code, cmd = self.run_main(["--loop"])
        self.assertEqual((code, cmd[-2:]), (0, ["usage", "GO - fine"]))
        code, cmd = self.run_main([])
        self.assertEqual((code, cmd[-2:]), (0, ["usage (manual)", "GO - fine"]))

    def test_any_other_argument_is_refused(self):
        with self.assertRaises(SystemExit):
            lu.main(["--manual"])


def usage_json(session=25, week=15, text=None):
    return mock.Mock(stdout=json.dumps({"result": report(session, week) if text is None else text,
                                        "is_error": False}), returncode=0)


class TheForkLines(unittest.TestCase):
    """A fork's own start and end readings (AF-150): the window either side
    of a reset named in one line, and nothing guessed."""
    LATER = dt.datetime(2026, 10, 14, 23, 30, tzinfo=UTC)  # after the 21:59 reset
    NEXT = "Current session: 12% used · resets Oct 15, 3:30am (Europe/London)\n"

    def fork(self, argv, reply, now=NOW, lines=()):
        """fork_main with /usage answering `reply`; (printed, progress.sh command)."""
        with mock.patch.object(lu.subprocess, "run", side_effect=[reply, mock.Mock()]) as run, \
                mock.patch.object(lu, "read_log", return_value=list(lines)), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(lu.fork_main(argv, now, "claude", "unused"), 0)
        return out.getvalue().strip(), run.call_args_list[-1][0][0]

    def start_line(self, session=25):
        printed, _ = self.fork(["--start", "AF-1", "--size", "S", "--implementer", "sonnet"],
                               usage_json(session))
        return "12:00:00 " + printed

    def test_the_start_line(self):
        printed, cmd = self.fork(["--start", "AF-1", "--size", "S", "--implementer", "sonnet"], usage_json())
        self.assertEqual(printed, "AF-1 usage start: size S, implementer sonnet, "
                                  "session 25% resets 2026-10-14T21:59+00:00")
        self.assertEqual(cmd[-2:], ["AF-1", printed.split(" ", 1)[1]])

    def test_within_one_window_the_cost_is_the_difference(self):
        printed, _ = self.fork(["--end", "AF-1", "MERGED", "--size", "S", "--implementer", "sonnet"],
                               usage_json(41), lines=[self.start_line(25)])
        self.assertEqual(printed, "AF-1 usage end: MERGED, size S, implementer sonnet; "
                                  "from session 25% resets 2026-10-14T21:59+00:00; "
                                  "to session 41% resets 2026-10-14T21:59+00:00; cost 16 points")

    def test_a_reset_mid_item_names_both_windows_and_a_range(self):
        printed, _ = self.fork(["--end", "AF-1", "MERGED", "--size", "S", "--implementer", "sonnet"],
                               usage_json(text=self.NEXT), now=self.LATER, lines=[self.start_line(25)])
        self.assertIn("from session 25% resets 2026-10-14T21:59+00:00; "
                      "to session 12% resets 2026-10-15T02:30+00:00; cost 12-87 points; "
                      "the window reset mid-item", printed)
        # What the report makes of the line it wrote.
        self.assertIn("AF-1", lu.costs(["12:30:00 " + printed]))
        self.assertIn("12-87", lu.costs(["12:30:00 " + printed]))

    def test_more_than_one_reset_is_a_lower_bound(self):
        start = (25, SESSION_RESET)
        self.assertEqual(lu.cost(start, (12, SESSION_RESET + dt.timedelta(hours=5, minutes=3))), (12, 87))
        self.assertEqual(lu.cost(start, (12, SESSION_RESET + dt.timedelta(hours=10))), (12, None))
        self.assertEqual(lu.show(12, None), "at least 12")

    def test_the_same_window_read_a_minute_apart_is_one_window(self):
        self.assertEqual(lu.cost((19, SESSION_RESET), (33, SESSION_RESET + dt.timedelta(minutes=1))), (14, 14))

    def test_readings_that_cannot_both_be_true_are_unreadable(self):
        self.assertEqual(lu.cost((40, SESSION_RESET), (30, SESSION_RESET)), (None, None))
        self.assertEqual(lu.cost((40, SESSION_RESET), (30, SESSION_RESET - dt.timedelta(hours=5))), (None, None))

    def test_a_window_just_rolled_over_is_written_unreadable_never_zero(self):
        week_only = "Current week (all models): 15% used · resets Oct 19, 2:59pm (Europe/London)\n"
        printed, _ = self.fork(["--start", "AF-1", "--size", "XS", "--implementer", "opus"],
                               usage_json(text=week_only))
        self.assertEqual(printed, "AF-1 usage start: size XS, implementer opus, session unreadable "
                                  "(no session line, as a window just rolled over shows)")
        printed, _ = self.fork(["--end", "AF-1", "STOP", "--size", "XS", "--implementer", "opus"],
                               usage_json(30), lines=["12:00:00 " + printed])
        self.assertIn("; from session unreadable; to session 30% resets 2026-10-14T21:59+00:00; "
                      "cost unreadable", printed)
        self.assertNotIn("points", printed)

    def test_an_unanswered_usage_at_the_end_is_unreadable(self):
        printed, _ = self.fork(["--end", "AF-1", "LIMIT", "--size", "S", "--implementer", "sonnet"],
                               mock.Mock(stdout="", returncode=1), lines=[self.start_line(25)])
        self.assertIn("to session unreadable (/usage printed no JSON (exit 1)); cost unreadable", printed)

    def test_the_start_is_this_forks_own(self):
        start = self.start_line(25)
        earlier_end = ("12:10:00 AF-1 usage end: LIMIT, size S, implementer sonnet; from session 25% resets "
                       "2026-10-14T21:59+00:00; to session 99% resets 2026-10-14T21:59+00:00; cost 74 points")
        # An end after the only start: that start was an earlier fork's.
        printed, _ = self.fork(["--end", "AF-1", "MERGED", "--size", "S", "--implementer", "sonnet"],
                               usage_json(41), lines=[start, earlier_end])
        self.assertIn("; from start not logged; ", printed)
        self.assertIn("cost unreadable", printed)
        # A group's end pairs with its head's start, and no other item's.
        printed, _ = self.fork(["--end", "AF-1+AF-2", "MERGED", "--size", "S", "--implementer", "sonnet"],
                               usage_json(41), lines=[start, start.replace("AF-1", "AF-11")])
        self.assertIn("cost 16 points", printed)

    def test_arguments_are_refused_whole(self):
        for argv in (["--start", "AF-1", "--size", "XL", "--implementer", "opus"],
                     ["--start", "AF-1", "--size", "S", "--implementer", "haiku"],
                     ["--start", "AF-1", "--size", "S"],
                     ["--end", "AF-1", "DONE", "--size", "S", "--implementer", "opus"],
                     ["--end", "AF-1", "MERGED", "--size", "S", "--implementer", "opus", "--x", "y"],
                     ["--start", "AF 1", "--size", "S", "--implementer", "opus"]):
            with mock.patch.object(lu.subprocess, "run") as run, self.assertRaises(SystemExit):
                lu.fork_main(argv, NOW, "claude", "unused")
            run.assert_not_called()


class TheCostReport(unittest.TestCase):
    def end(self, item, word, size, impl, start, finish):
        return (f"10:00:00 {item} usage end: {word}, size {size}, implementer {impl}; from {start}; "
                f"to {finish}; cost whatever")

    def test_forks_are_summed_per_item_and_grouped_by_size_and_implementer(self):
        a, b = "session 10% resets 2026-10-14T21:59+00:00", "session 30% resets 2026-10-14T21:59+00:00"
        c = "session 5% resets 2026-10-15T02:59+00:00"
        lines = [
            self.end("AF-1", "LIMIT", "S", "opus", a, b),          # 20
            self.end("AF-1", "MERGED", "S", "opus", a, b),         # and 20 more: 40
            self.end("AF-2", "MERGED", "S", "opus", a, "session 20% resets 2026-10-14T21:59+00:00"),
            self.end("AF-3", "MERGED", "S", "opus", b, c),         # across a reset: 5-75
            self.end("AF-4", "MERGED", "S", "opus", "start not logged", b),
            self.end("AF-5", "SKIPPED", "XS", "sonnet", "session unreadable", b),
            "10:00:00 usage GO - session 19% used, resets 2026-10-29T01:59+00:00",
            "10:00:00 AF-6 usage start: size M, implementer opus, " + a,
        ]
        out = lu.costs(lines)
        self.assertRegex(out, r"AF-1 +S +opus +LIMIT\+MERGED +40\n")
        self.assertRegex(out, r"AF-3 +S +opus +MERGED +5-75\n")
        self.assertRegex(out, r"AF-4 .* unreadable\n")
        self.assertNotIn("AF-6", out)
        self.assertIn("XS  sonnet  1 item: 0 exact; 0 across a reset; 1 unreadable", out)
        self.assertIn("S   opus    4 items: 2 exact, median 25, mean 25.0; 1 across a reset (5-75); 1 unreadable",
                      out)
        self.assertLess(out.index("  XS  sonnet  1 item"), out.index("  S   opus    4 items"))

    def test_an_empty_log_says_so(self):
        self.assertTrue(lu.costs(["10:00:00 usage GO - fine"]).startswith("No fork end lines"))


if __name__ == "__main__":
    unittest.main()
