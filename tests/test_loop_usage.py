"""What loop_usage.py reads out of /usage, and what it decides from it.

WHY THIS FILE EXISTS
    The usage check decides, with nobody watching, whether the unattended
    loop starts an item, starts only a small one, or sleeps (D-55). Its input
    is text written for people, which may change wording; a misread that
    produced a number would pace the loop on a figure nobody gave it. So the
    cases here are, first, that anything not read whole is not read at all,
    and then that each threshold, the weekly pace and the race-weekend
    reserve decide what the docstring says they do, and then that a size
    starts only when the week covers what an item of it costs (AF-162).
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
# The pace alone, with an item of any size taken to cost the week nothing:
# the rules before AF-162, which the pace and reserve cases are about. The
# size gate's own cases (TheSizeGate) take the floors or a log of their own.
PACE = lu.needs([], dict(CONF, XS_WEEK=0, S_WEEK=0, M_WEEK=0, L_WEEK=0))


def decide(session=25, week=15, race=None, need=PACE):
    """(word, until, why) with no alarm looked for, as before AF-130."""
    return lu.decide(lu.parse(report(session, week), NOW), NOW, race, CONF, need=need)[:3]


def setUpModule():
    # check() reads progress.log for what each size costs; a test reads the
    # log it is given, never the one in the checkout it runs from.
    patcher = mock.patch.object(lu, "read_log", return_value=[])
    patcher.start()
    unittest.addModuleCleanup(patcher.stop)


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
        word, _, why, args = lu.decide(windows, NOW, None, CONF)
        self.assertEqual((word, args), ("GO", "--large-first"))
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

    def calendar(self, tmp, results=()):
        """An f1.db holding three races and a qualifying session, with a
        finish position stored for each race id in `results`."""
        db = os.path.join(tmp, "f1.db")
        con = sqlite3.connect(db)
        con.execute("CREATE TABLE races (id INTEGER, name_used TEXT)")
        con.execute("CREATE TABLE sessions (id INTEGER, race_id INTEGER, kind TEXT, start_utc TEXT)")
        con.execute("CREATE TABLE race_entries (race_id INTEGER, finish_position INTEGER)")
        con.executemany("INSERT INTO races VALUES (?, ?)",
                        [(1, "Mexico City Grand Prix"), (2, "Sao Paulo Grand Prix"), (3, None)])
        con.executemany("INSERT INTO sessions VALUES (?, ?, ?, ?)",
                        [(1, 1, "race", "2026-10-11T19:00Z"), (2, 2, "qualifying", "2026-10-17T21:00Z"),
                         (3, 2, "race", "2026-10-18T19:00Z"), (4, 3, "race", "2026-10-25T20:00Z")])
        # An entry list with no finish position yet is not a result.
        con.executemany("INSERT INTO race_entries VALUES (?, ?)",
                        [(1, None), (2, None)] + [(r, 1) for r in results])
        con.commit()
        con.close()
        return db

    def test_the_calendar_is_read_from_the_sessions_table(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = self.calendar(tmp)
            self.assertEqual(lu.next_race(NOW, db), (self.RACE, "Sao Paulo Grand Prix"))
            # The race of the 11th is still inside its two-day tail on the 13th.
            self.assertEqual(lu.next_race(dt.datetime(2026, 10, 13, 12, 0, tzinfo=UTC), db),
                             (dt.datetime(2026, 10, 11, 19, 0, tzinfo=UTC), "Mexico City Grand Prix"))
        self.assertIs(lu.next_race(NOW, os.path.join(tmp, "missing.db")), False)

    def test_a_race_in_its_tail_with_results_in_passes_the_hold_on(self):
        # On the 13th the race of the 11th is in its tail; once its results
        # are in, the hold moves to the race of the 18th (AF-155).
        on_13th = dt.datetime(2026, 10, 13, 12, 0, tzinfo=UTC)
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(lu.next_race(on_13th, self.calendar(tmp, results=(1,))),
                             (self.RACE, "Sao Paulo Grand Prix"))
        with tempfile.TemporaryDirectory() as tmp:
            # With the 18th resulted as well, the 25th is next, and a race
            # with no name in the calendar is still a race.
            self.assertEqual(lu.next_race(on_13th, self.calendar(tmp, results=(1, 2))),
                             (dt.datetime(2026, 10, 25, 20, 0, tzinfo=UTC), None))
        with tempfile.TemporaryDirectory() as tmp:
            self.assertIsNone(lu.next_race(on_13th, self.calendar(tmp, results=(1, 2, 3))))

    def test_a_resulted_tail_race_releases_the_reserve_when_the_next_falls_after_the_reset(self):
        # On the 14th a race of the 13th is in its tail and the next is on
        # the 25th, after the reset of the 19th. Without results the reserve
        # is held and 36 % is past the pace; with them in, nothing is held.
        def run(results):
            with tempfile.TemporaryDirectory() as tmp:
                db = os.path.join(tmp, "f1.db")
                con = sqlite3.connect(db)
                con.execute("CREATE TABLE races (id INTEGER, name_used TEXT)")
                con.execute("CREATE TABLE sessions (id INTEGER, race_id INTEGER, kind TEXT, start_utc TEXT)")
                con.execute("CREATE TABLE race_entries (race_id INTEGER, finish_position INTEGER)")
                con.executemany("INSERT INTO sessions VALUES (?, ?, 'race', ?)",
                                [(1, 1, "2026-10-13T19:00Z"), (2, 2, "2026-10-25T20:00Z")])
                con.executemany("INSERT INTO race_entries VALUES (?, ?)", results)
                con.commit()
                con.close()
                start, name = lu.next_race(NOW, db)
            return lu.decide(lu.parse(report(week=36), NOW), NOW, start, CONF, name=name, need=PACE)
        held, released = run([(1, None)]), run([(1, 3)])
        self.assertEqual(held[0], "WAIT")
        self.assertTrue(any("held for the race weekend of 2026-10-13T19:00+00:00)" in w for w in held[2]), held[2])
        self.assertEqual(released[0], "GO")
        self.assertFalse(any("held for" in w for w in released[2]), released[2])

    def test_the_line_names_the_race_the_reserve_is_held_for(self):
        why = lu.decide(lu.parse(report(week=36), NOW), NOW, self.RACE, CONF, name="Sao Paulo Grand Prix")[2]
        self.assertTrue(any("held for the race weekend of 2026-10-18T19:00+00:00, the Sao Paulo Grand Prix"
                            in w for w in why), why)
        why = decide(week=36, race=self.RACE)[2]
        self.assertTrue(any(w.endswith("held for the race weekend of 2026-10-18T19:00+00:00)") for w in why), why)

    def test_an_unreadable_results_table_keeps_the_reserve(self):
        # A calendar without race_entries cannot say whether the results are
        # in, so it is not read at all: the cautious side.
        with tempfile.TemporaryDirectory() as tmp:
            db = os.path.join(tmp, "f1.db")
            con = sqlite3.connect(db)
            con.execute("CREATE TABLE races (id INTEGER, name_used TEXT)")
            con.execute("CREATE TABLE sessions (id INTEGER, race_id INTEGER, kind TEXT, start_utc TEXT)")
            con.execute("INSERT INTO sessions VALUES (1, 1, 'race', '2026-10-18T19:00Z')")
            con.commit()
            con.close()
            self.assertIs(lu.next_race(NOW, db), False)

    def test_the_command_passes_the_name_through(self):
        done = mock.Mock(stdout=json.dumps({"result": report(week=36), "is_error": False}), returncode=1)
        with mock.patch.object(lu.subprocess, "run", return_value=done), \
                mock.patch.object(lu, "next_race", return_value=(self.RACE, "Sao Paulo Grand Prix")):
            text, _ = lu.check(NOW, "claude")
        self.assertIn("of 2026-10-18T19:00+00:00, the Sao Paulo Grand Prix)", text)


class TheReserveGoesOnAnAlarmAlone(unittest.TestCase):
    """AF-130: while the reserve is held, it may be spent on a refresh alarm
    `next.py --alarm` names, and on nothing else."""
    RACE = dt.datetime(2026, 10, 18, 19, 0, tzinfo=UTC)

    def decide(self, session=25, week=36, race=RACE, found=None):
        asked = []

        def alarm():
            asked.append(True)
            return (found, None) if found else (None, "no refresh alarm to spend it on")
        out = lu.decide(lu.parse(report(session, week), NOW), NOW, race, CONF_LOOK, alarm, need=PACE)
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
                                         lambda: asked.append(True) or ("AF-150", None), need=PACE)
        self.assertEqual((word, target, asked), ("WAIT", None, []))
        self.assertTrue(any(w.startswith("session window not readable") for w in why), why)

    def test_an_idle_window_that_rolled_over_is_fresh_and_starts_an_alarm(self):
        # AF-158: the week line and no other "Current" line is a window with
        # nothing used in it, not a window unread.
        week_only = ("Current week (all models): 36% used · resets Oct 19, 2:59pm "
                     "(Europe/London)\n")
        windows = lu.parse(week_only, NOW)
        self.assertTrue(lu.fresh_session(week_only, windows))
        windows["session"] = (0, None)
        asked = []
        word, _, why, target = lu.decide(windows, NOW, self.RACE, CONF_LOOK,
                                         lambda: asked.append(True) or ("AF-150", None), need=PACE)
        self.assertEqual((word, target, asked), ("ALARM", "AF-150", [True]))
        self.assertIn("session: none yet (fresh window)", why)

    def test_only_a_report_known_to_leave_the_session_out_is_fresh(self):
        week = "Current week (all models): 36% used · resets Oct 19, 2:59pm (Europe/London)\n"
        for text in (
                # a session line that is there and cannot be read whole
                "Current session: 25% used\n" + week,
                # a window reworded, or one this does not know
                "Current 5-hour window: 25% used · resets 11pm (Europe/London)\n" + week,
                # the same, in a case or a decoration the parser does not know
                "current session: 95% used · resets 3pm (Europe/London)\n" + week,
                "5-hour session: 95% used · resets 3pm (Europe/London)\n" + week,
                "• Current session: 95% used · resets 3pm (Europe/London)\n" + week,
                # nothing the week could be read from
                "Current session: 25% used\n",
                "",
                # a whole report is not a fresh one
                report()):
            self.assertFalse(lu.fresh_session(text, lu.parse(text, NOW)), text)

    def check(self, text, env, alarm):
        # `claude -p /usage --output-format json` prints the report as `result`.
        stdout = text if "LOOP_USAGE_CMD" in env else json.dumps({"result": text})
        done = mock.Mock(stdout=stdout, returncode=0)
        with mock.patch.dict(os.environ, env, clear=True), \
                mock.patch.object(lu.subprocess, "run", return_value=done), \
                mock.patch.object(lu, "next_race", return_value=(self.RACE, "Sao Paulo Grand Prix")), \
                mock.patch.object(lu, "reserve_alarm", **alarm):
            return lu.check(NOW, "claude")

    def test_check_starts_an_alarm_idle_and_says_the_window_is_fresh(self):
        week = ("Current week (all models): 36% used · resets Oct 19, 2:59pm "
                "(Europe/London)\n")
        found = {"return_value": ("AF-150", None)}
        looked = {"side_effect": AssertionError("looked for an alarm")}
        text, code = self.check(week, {}, found)
        self.assertTrue(text.startswith("ALARM AF-150 until "), text)
        self.assertIn("session: none yet (fresh window)", text)
        self.assertEqual(code, 4)
        # A garbled session line beside it stays unread: no alarm is looked for.
        text, code = self.check("Current session: 25% used\n" + week, {}, looked)
        self.assertTrue(text.startswith("WAIT until "), text)
        self.assertIn("session window not readable", text)
        # An adapter that leaves the session out has no figure for it.
        text, code = self.check(week, {"LOOP_USAGE_CMD": "r"}, looked)
        self.assertTrue(text.startswith("WAIT until "), text)
        self.assertIn("session window not readable", text)

    def test_a_fresh_window_survives_a_threshold_over_100(self):
        windows = {"session": (0, None), "week": (15, WEEK_RESET)}
        for key in ("M_LEFT", "SMALL_LEFT"):
            word, until, why, args = lu.decide(windows, NOW, None, dict(CONF, **{key: 101.0}))
            self.assertEqual((word, until), ("GO", None))
            self.assertTrue(lu.line(word, until, why, args).startswith("GO --large-first - session: none yet"))

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
        self.assertTrue(text.startswith("SMALL --max-size S until 2026-10-14T21:59+00:00 - "), text)
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


class TheAdapter(unittest.TestCase):
    """LOOP_USAGE_CMD (AF-118): another agent's reader, in the format /usage
    prints, and the default when it is not set."""

    def check(self, env, run=None, which="/bin/claude"):
        with mock.patch.dict(os.environ, env, clear=True), \
                mock.patch.object(lu.subprocess, "run", **({"return_value": run} if run else {})) as ran, \
                mock.patch.object(lu.shutil, "which", return_value=which), \
                mock.patch.object(lu, "next_race", return_value=None):
            return lu.check(NOW), ran

    def test_the_adapters_two_lines_decide_as_usages_do(self):
        out = mock.Mock(stdout=report(session=60), returncode=0)
        (text, code), ran = self.check({"LOOP_USAGE_CMD": "my-reader --agent 'two words'"}, out)
        self.assertTrue(text.startswith("SMALL --max-size S until 2026-10-14T21:59+00:00 - "), text)
        self.assertEqual(code, 3)
        # Split like a shell would, run without one, and not through claude.
        self.assertEqual(ran.call_args[0][0], ["my-reader", "--agent", "two words"])
        self.assertNotIn("shell", ran.call_args[1])

    def test_an_adapter_printing_only_what_it_knows_is_read_for_that(self):
        week_only = mock.Mock(stdout="Current week (all models): 15% used · resets Oct 19, 2:59pm "
                                     "(Europe/London)\n", returncode=0)
        (text, code), _ = self.check({"LOOP_USAGE_CMD": "r"}, week_only)
        self.assertEqual((text.split()[0], code), ("GO", 0))

    def test_an_adapter_that_fails_or_prints_nothing_readable_is_unknown_and_named(self):
        for out in (mock.Mock(stdout=report(), returncode=2), mock.Mock(stdout="", returncode=0),
                    mock.Mock(stdout="session 25 of 100\n", returncode=0),
                    mock.Mock(stdout="Current session: 140% used · resets 3pm (Europe/London)\n",
                              returncode=0)):
            (text, code), _ = self.check({"LOOP_USAGE_CMD": "r"}, out)
            self.assertTrue(text.startswith("UNKNOWN - LOOP_USAGE_CMD "), text)
            self.assertEqual(code, 0)
        with mock.patch.object(lu.subprocess, "run", side_effect=FileNotFoundError("r")), \
                mock.patch.dict(os.environ, {"LOOP_USAGE_CMD": "r"}, clear=True):
            self.assertEqual(lu.read_text("claude"), (None, "LOOP_USAGE_CMD did not answer (FileNotFoundError)"))
        with mock.patch.object(lu.subprocess, "run", side_effect=lu.subprocess.TimeoutExpired("r", 1)), \
                mock.patch.dict(os.environ, {"LOOP_USAGE_CMD": "r"}, clear=True):
            self.assertIn("TimeoutExpired", lu.read_text("claude")[1])
        with mock.patch.dict(os.environ, {"LOOP_USAGE_CMD": "r 'unclosed"}, clear=True):
            self.assertIn("split", lu.read_text("claude")[1])

    def test_an_adapter_printing_bytes_that_are_not_text_is_unknown_not_a_crash(self):
        env = {"LOOP_USAGE_CMD": "printf '\\377\\376 Current session: 25%% used\\n'"}
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(lu, "next_race", return_value=None):
            text, code = lu.check(NOW)
            self.assertEqual(lu.session_reading(NOW, None)[0], None)
        self.assertTrue(text.startswith("UNKNOWN - LOOP_USAGE_CMD "), text)
        self.assertEqual(code, 0)
        with mock.patch.object(lu.subprocess, "run", side_effect=UnicodeDecodeError("utf-8", b"\xff", 0, 1, "x")), \
                mock.patch.dict(os.environ, {"LOOP_USAGE_CMD": "r"}, clear=True):
            self.assertIn("UnicodeDecodeError", lu.read_text("claude")[1])

    def test_set_but_empty_is_no_reader_and_never_falls_back_to_claude(self):
        for empty in ("", "   "):
            (text, code), ran = self.check({"LOOP_USAGE_CMD": empty})
            ran.assert_not_called()
            self.assertTrue(text.startswith("UNKNOWN - LOOP_USAGE_CMD is empty"), text)
            self.assertEqual(code, 0)

    def test_the_forks_readings_use_the_adapter_too(self):
        out = mock.Mock(stdout=report(session=33), returncode=0)
        with mock.patch.dict(os.environ, {"LOOP_USAGE_CMD": "r"}, clear=True), \
                mock.patch.object(lu.subprocess, "run", return_value=out):
            self.assertEqual(lu.session_reading(NOW, None), ((33, SESSION_RESET), None))

    def test_unset_is_the_default_adapter_claude_p_usage(self):
        out = mock.Mock(stdout=json.dumps({"result": report(session=60), "is_error": False}), returncode=0)
        (text, _), ran = self.check({}, out)
        self.assertEqual(ran.call_args[0][0][:3], ["/bin/claude", "-p", "/usage"])
        self.assertTrue(text.startswith("SMALL"), text)


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

    def fork(self, argv, reply, now=NOW, lines=(), written=0):
        """fork_main with /usage answering `reply` and progress.sh exiting
        `written`; (printed, progress.sh command)."""
        with mock.patch.object(lu.subprocess, "run", side_effect=[reply, mock.Mock(returncode=written)]) as run, \
                mock.patch.object(lu, "read_log", return_value=list(lines)), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(lu.fork_main(argv, now, "claude", "unused"), 1 if written else 0)
        return out.getvalue().strip(), run.call_args_list[-1][0][0]

    def start_line(self, session=25, item="AF-1", implementer="sonnet", text=None, now=NOW):
        printed, _ = self.fork(["--start", item, "--size", "S", "--implementer", implementer],
                               usage_json(session, text=text), now=now)
        return "12:00:00 " + printed

    def test_the_start_line(self):
        printed, cmd = self.fork(["--start", "AF-1", "--size", "S", "--implementer", "sonnet"], usage_json())
        self.assertEqual(printed, "AF-1 usage start: size S, implementer sonnet, "
                                  "session 25% resets 2026-10-14T21:59+00:00; "
                                  "week 15% resets 2026-10-19T13:59+00:00")
        self.assertEqual(cmd[-2:], ["AF-1", printed.split(" ", 1)[1]])

    def test_within_one_window_the_cost_is_the_difference(self):
        printed, _ = self.fork(["--end", "AF-1", "MERGED", "--size", "S", "--implementer", "sonnet"],
                               usage_json(41), lines=[self.start_line(25)])
        self.assertEqual(printed, "AF-1 usage end: MERGED, size S, implementer sonnet; "
                                  "from session 25% resets 2026-10-14T21:59+00:00; "
                                  "to session 41% resets 2026-10-14T21:59+00:00; cost 16 points; "
                                  "week from 15% resets 2026-10-19T13:59+00:00 "
                                  "to 15% resets 2026-10-19T13:59+00:00, cost 0 points")

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
                                  "(no session line, as a window just rolled over shows); "
                                  "week 15% resets 2026-10-19T13:59+00:00")
        printed, _ = self.fork(["--end", "AF-1", "STOP", "--size", "XS", "--implementer", "opus"],
                               usage_json(30), lines=["12:00:00 " + printed])
        self.assertIn("; from session unreadable; to session 30% resets 2026-10-14T21:59+00:00; "
                      "cost unreadable", printed)
        self.assertNotIn("points", printed.split("; week ")[0])

    def test_an_unanswered_usage_at_the_end_is_unreadable(self):
        printed, _ = self.fork(["--end", "AF-1", "LIMIT", "--size", "S", "--implementer", "sonnet"],
                               mock.Mock(stdout="", returncode=1), lines=[self.start_line(25)])
        self.assertIn("to session unreadable (/usage printed no JSON (exit 1)); cost unreadable", printed)

    def test_a_start_an_end_has_closed_is_not_paired_again(self):
        start = self.start_line(25)
        earlier_end = ("12:10:00 AF-1 usage end: LIMIT, size S, implementer sonnet; from session 25% resets "
                       "2026-10-14T21:59+00:00; to session 99% resets 2026-10-14T21:59+00:00; cost 74 points")
        printed, _ = self.fork(["--end", "AF-1", "MERGED", "--size", "S", "--implementer", "sonnet"],
                               usage_json(41), lines=[start, earlier_end])
        self.assertIn("; from start not logged; ", printed)
        self.assertIn("cost unreadable", printed)

    def test_a_group_pairs_with_its_heads_start_and_no_other_items(self):
        lines = [self.start_line(25), self.start_line(35, item="AF-11"), self.start_line(30, implementer="opus")]
        printed, _ = self.fork(["--end", "AF-1+AF-2", "MERGED", "--size", "S", "--implementer", "sonnet"],
                               usage_json(41), lines=lines)
        self.assertIn("from session 25% resets", printed)
        self.assertIn("cost 16 points", printed)

    def test_a_fork_killed_before_its_end_line_stays_in_the_range(self):
        # AF-132's shape: a fork starts at 42 %, the session limit kills it
        # with no end line, and the fork that inherits the PR starts at 3 %
        # in the next window and ends at 30 %. Its own 27 is not the cost.
        killed = self.start_line(42)
        inherited = self.start_line(text=self.NEXT.replace("12%", "3%"), now=self.LATER)
        printed, _ = self.fork(["--end", "AF-1", "MERGED", "--size", "S", "--implementer", "sonnet"],
                               usage_json(text=self.NEXT.replace("12%", "30%")), now=self.LATER,
                               lines=[killed, inherited])
        self.assertIn("from session 42% resets 2026-10-14T21:59+00:00 (the earliest of 2 starts); "
                      "to session 30% resets 2026-10-15T02:30+00:00; cost 30-88 points", printed)
        report = lu.costs([killed, inherited, "12:30:00 " + printed])
        # The inheriting fork's window shows no week, so the week is not read.
        self.assertRegex(report, r"AF-1 +S +sonnet +MERGED +30-88 +week unreadable\n")
        self.assertNotIn("Started, with no end line", report)
        self.assertIn("Started, with no end line yet - running, or killed before it wrote one: AF-1 (sonnet)",
                      lu.costs([killed, inherited]))

    def test_a_line_that_could_not_be_written_exits_1(self):
        self.fork(["--start", "AF-1", "--size", "S", "--implementer", "sonnet"], usage_json(), written=1)

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
        self.assertNotIn("AF-6 ", out.split("By size")[0])
        self.assertTrue(out.endswith("killed before it wrote one: AF-6 (opus)"), out)
        self.assertIn("XS  sonnet  1 item: 0 exact; 0 across a reset; 1 unreadable", out)
        self.assertIn("S   opus    4 items: 2 exact, median 25, mean 25.0; 1 across a reset (5-75); 1 unreadable",
                      out)
        self.assertLess(out.index("  XS  sonnet  1 item"), out.index("  S   opus    4 items"))

    def test_a_rerouted_item_is_counted_under_each_implementer(self):
        a, b = "session 10% resets 2026-10-14T21:59+00:00", "session 14% resets 2026-10-14T21:59+00:00"
        out = lu.costs([self.end("AF-1", "REROUTE", "S", "sonnet", a, b),
                        self.end("AF-1", "MERGED", "S", "opus", b, "session 34% resets 2026-10-14T21:59+00:00")])
        self.assertRegex(out, r"AF-1 +S +sonnet +REROUTE +4\n")
        self.assertRegex(out, r"AF-1 +S +opus +MERGED +20\n")

    def test_an_empty_log_says_so(self):
        self.assertTrue(lu.costs(["10:00:00 usage GO - fine"]).startswith("No fork end lines"))


def end_line(item, size, implementer="opus", word="MERGED", session=(10, 30), week=(40, 48),
             week_reset="2026-10-19T13:59+00:00"):
    """An end line as fork_line writes one since AF-162: `session` and `week`
    are (from, to) percentages, each within one window, or None for a week
    the line did not log."""
    text = (f"10:00:00 {item} usage end: {word}, size {size}, implementer {implementer}; "
            f"from session {session[0]}% resets 2026-10-14T21:59+00:00; "
            f"to session {session[1]}% resets 2026-10-14T21:59+00:00; cost {session[1] - session[0]} points")
    if week is not None:
        text += (f"; week from {week[0]}% resets {week_reset} to {week[1]}% resets {week_reset}, "
                 f"cost {week[1] - week[0]} points")
    return text


class TheSizeGate(unittest.TestCase):
    """AF-162: a size starts only when the week's headroom, under the pace
    and under the allowance, covers what an item of that size costs it. At
    27.4 % elapsed with no race held the pace allows 37.4; the floors are XS 2,
    S 3, M 5 and L 10."""

    def decide(self, session=25, week=15, race=None, need=None, now=NOW, windows=None):
        windows = windows or lu.parse(report(session, week), now)
        return lu.decide(windows, now, race, CONF, need=need)

    def test_an_m_refused_for_weekly_headroom_takes_an_s_instead(self):
        # 33 used: 4.4 points of headroom, an S's 3 and not an M's 5.
        word, until, why, args = self.decide(week=33)
        self.assertEqual((word, args), ("SMALL", "--max-size S"))
        self.assertIn("weekly headroom 4.4: under an M item's 5 (floor, 0 of 5 read)", why)
        # The pause, if nothing that small is open: the pace covering an M.
        self.assertEqual(until, WEEK_RESET - lu.WEEK + lu.WEEK * ((33 + 5 - 10) / 100))
        self.assertTrue(lu.line(word, until, why, args).startswith("SMALL --max-size S until 2026-10-14T"))
        # Two points of headroom is an XS's and not an S's.
        self.assertEqual(self.decide(week=35)[3], "--max-size XS")

    def test_headroom_too_small_for_any_item_waits_for_the_pace_to_cover_an_xs(self):
        word, until, why, _ = self.decide(week=36)
        self.assertEqual(word, "WAIT")
        self.assertEqual(until, WEEK_RESET - lu.WEEK + lu.WEEK * ((36 + 2 - 10) / 100))
        self.assertIn("weekly headroom 1.4: under an XS item's 2 (floor, 0 of 5 read)", why)

    def test_the_week_of_2026_11_09_waits_for_the_reset(self):
        # 99 % used with 98 % of the week gone, the pace allowing 100: SMALL
        # before AF-162, and an XS item started at 11:19 and was killed by
        # the weekly limit at 11:27. One point covers no item.
        now = WEEK_RESET - lu.WEEK * 0.02
        windows = {"session": (55, now + dt.timedelta(hours=3)), "week": (99, WEEK_RESET)}
        word, until, _, _ = self.decide(now=now, windows=windows)
        self.assertEqual((word, until), ("WAIT", WEEK_RESET))
        # The pace alone, as before AF-162, read the same report as SMALL.
        self.assertEqual(self.decide(now=now, windows=windows, need=PACE)[:2],
                         ("SMALL", now + dt.timedelta(hours=3)))

    def test_an_m_but_not_an_l_is_go_capped_at_m(self):
        word, until, why, args = self.decide(week=30)
        self.assertEqual((word, args), ("GO", "--max-size M --large-first"))
        self.assertEqual(until, WEEK_RESET - lu.WEEK + lu.WEEK * ((30 + 10 - 10) / 100))
        self.assertIn("weekly headroom 7.4: under an L item's 10 (floor, 0 of 5 read)", why)
        self.assertTrue(lu.line(word, until, why, args).startswith("GO --max-size M --large-first until "))

    def test_room_for_an_l_is_go_with_the_first_claim(self):
        word, until, why, args = self.decide(week=15)
        self.assertEqual((word, until, args), ("GO", None, "--large-first"))
        self.assertTrue(lu.line(word, until, why, args).startswith("GO --large-first - session 25% used"))

    def test_a_week_not_read_is_go_in_queue_order_as_before(self):
        windows = lu.parse(report(), NOW)
        del windows["week"]
        word, until, why, args = self.decide(windows=windows)
        self.assertEqual((word, until, args), ("GO", None, None))
        self.assertTrue(lu.line(word, until, why, args).startswith("GO - session 25% used"))

    def test_the_session_and_the_week_each_cap_and_the_later_release_wins(self):
        # The session under M_LEFT and the week under an M: the pause is the
        # later of the session's reset and the pace covering an M.
        word, until, _, args = self.decide(session=40, week=33)
        self.assertEqual((word, args), ("SMALL", "--max-size S"))
        self.assertEqual(until, max(SESSION_RESET, WEEK_RESET - lu.WEEK + lu.WEEK * 0.28))
        # The session alone holds it back: its reset.
        self.assertEqual(self.decide(session=40, week=15)[1], SESSION_RESET)

    def test_one_window_unread_and_the_other_capping_is_no_crash(self):
        # The week holds an M back and the session is unread, as a window
        # that has just rolled over is: the pause is the week's alone.
        windows = lu.parse(report(week=33), NOW)
        del windows["session"]
        word, until, _, args = self.decide(windows=windows)
        self.assertEqual((word, args, until), ("SMALL", "--max-size S",
                                               WEEK_RESET - lu.WEEK + lu.WEEK * 0.28))
        windows = lu.parse(report(week=30), NOW)
        del windows["session"]
        self.assertEqual(self.decide(windows=windows)[:2], ("GO", WEEK_RESET - lu.WEEK + lu.WEEK * 0.30))
        # The session holds it back and the week is unread: the session's reset.
        windows = lu.parse(report(session=40), NOW)
        del windows["week"]
        self.assertEqual(self.decide(windows=windows)[:2], ("SMALL", SESSION_RESET))
        need = lu.needs(self.recorded("L", 5, session=(5, 90)), CONF)
        windows = lu.parse(report(session=20), NOW)
        del windows["week"]
        self.assertEqual(self.decide(windows=windows, need=need)[:2], ("GO", SESSION_RESET))

    def test_a_held_reserve_comes_off_the_headroom(self):
        race = dt.datetime(2026, 10, 18, 19, 0, tzinfo=UTC)
        # 0.27 * 90 + 10 = 34.3 with the reserve held: 30 used leaves 4.3.
        self.assertEqual(self.decide(week=30, race=race)[3], "--max-size S")

    def recorded(self, size, n, week=(40, 48), session=(10, 30), **kw):
        return [end_line(f"AF-{i}", size, week=week, session=session, **kw) for i in range(n)]

    def test_the_floor_stands_until_five_landed_items_are_read(self):
        conf = dict(CONF)
        self.assertEqual(lu.needs(self.recorded("M", 4), conf)["week"]["M"], (5.0, "floor, 4 of 5 read"))
        self.assertEqual(lu.needs(self.recorded("M", 5), conf)["week"]["M"], (8.0, "median of 5"))
        # Not landed, not Opus, crossing a weekly reset, or with no week
        # logged: none of them is a reading.
        for lines in (self.recorded("M", 5, word="LIMIT"), self.recorded("M", 5, implementer="sonnet"),
                      self.recorded("M", 5, week=None)):
            self.assertEqual(lu.needs(lines, conf)["week"]["M"][1], "floor, 0 of 5 read")
        # A group is several items under one size, not one item's cost.
        groups = [end_line(f"AF-{i}+AF-{i + 10}", "M") for i in range(5)]
        self.assertEqual(lu.needs(groups, conf)["week"]["M"][1], "floor, 0 of 5 read")
        crossed = [line.replace("to 48% resets 2026-10-19T13:59", "to 8% resets 2026-10-26T13:59")
                   for line in self.recorded("M", 5)]
        self.assertEqual(lu.needs(crossed, conf)["week"]["M"][1], "floor, 0 of 5 read")

    def test_a_recorded_cost_moves_the_gate(self):
        # Five M items that landed at 8 points each: 7.4 points of headroom
        # (30 used) is no longer enough for an M.
        need = lu.needs(self.recorded("M", 5), CONF)
        word, _, why, args = self.decide(week=30, need=need)
        self.assertEqual((word, args), ("SMALL", "--max-size S"))
        self.assertIn("weekly headroom 7.4: under an M item's 8 (median of 5)", why)

    def test_an_l_needs_a_fresh_session_and_its_recorded_share_of_it(self):
        # Until five L items are read, an L needs M_LEFT, as an M does.
        self.assertEqual(lu.needs([], CONF)["l_left"], (70.0, "M_LEFT, 0 of 5 L items read"))
        self.assertEqual(self.decide(session=20, need=PACE)[3], "--large-first")
        # Five that cost 85 points of a window each: 80 left is an M's, not an L's.
        need = lu.needs(self.recorded("L", 5, session=(5, 90)), CONF)
        self.assertEqual(need["l_left"], (85.0, "L median of 5, M_LEFT at least"))
        word, until, why, args = self.decide(session=20, need=need)
        self.assertEqual((word, until, args), ("GO", SESSION_RESET, "--max-size M --large-first"))
        self.assertIn("under 85 points left: no L item (L median of 5, M_LEFT at least)", why)
        # A recorded share under M_LEFT does not lower the bar below it.
        need = lu.needs(self.recorded("L", 5, session=(5, 45)), CONF)
        self.assertEqual(need["l_left"][0], 70.0)

    def test_check_takes_the_costs_from_the_log(self):
        done = mock.Mock(stdout=json.dumps({"result": report(week=30), "is_error": False}), returncode=0)
        with mock.patch.object(lu.subprocess, "run", return_value=done), \
                mock.patch.object(lu, "next_race", return_value=None), \
                mock.patch.object(lu, "read_log", return_value=self.recorded("M", 5)), \
                mock.patch.dict(os.environ, {}, clear=True):
            text, code = lu.check(NOW, "claude")
        self.assertTrue(text.startswith("SMALL --max-size S until "), text)
        self.assertIn("under an M item's 8 (median of 5)", text)
        self.assertEqual(code, 3)

    def test_the_floors_follow_the_setting(self):
        self.assertEqual(lu.settings({"LOOP_USAGE_M_WEEK": "9"})["M_WEEK"], 9.0)
        need = lu.needs([], dict(CONF, M_WEEK=2.0))
        self.assertEqual(self.decide(week=33, need=need)[3], "--max-size M --large-first")


class SavingTheWeek(unittest.TestCase):
    """AF-164: with an M or L holding the first claim and the week's headroom
    under its cost, the line is WAIT until the pace covers it, and not SMALL
    or a GO capped below it - the S items that filled the gap spent what the
    pace added for the M. The session holding an item back saves nothing."""

    def decide(self, session=25, week=15, large=None, calls=None):
        def lookup():
            if calls is not None:
                calls.append(1)
            return large or (None, None)
        return lu.decide(lu.parse(report(session, week), NOW), NOW, None, CONF, large=lookup)

    def test_an_m_waiting_keeps_the_headroom_an_s_would_have_spent(self):
        # 33 used: 4.4 points of headroom, an S's and not an M's - SMALL before.
        word, until, why, args = self.decide(week=33, large=("WK-15", "M"))
        self.assertEqual((word, args), ("WAIT", None))
        self.assertEqual(until, WEEK_RESET - lu.WEEK + lu.WEEK * ((33 + 5 - 10) / 100))
        self.assertIn("saving the week for WK-15 (M, 5 points): nothing smaller starts until the pace covers it", why)
        # With no M or L to save for, the gap is filled as before.
        self.assertEqual(self.decide(week=33)[::3], ("SMALL", "--max-size S"))

    def test_an_l_waiting_keeps_an_m_out_too(self):
        # 30 used: 7.4 points, an M's 5 and not an L's 10 - GO capped at M before.
        word, until, _, _ = self.decide(week=30, large=("AF-99", "L"))
        self.assertEqual(word, "WAIT")
        self.assertEqual(until, WEEK_RESET - lu.WEEK + lu.WEEK * ((30 + 10 - 10) / 100))
        # An M with the first claim is covered there, and starts.
        self.assertEqual(self.decide(week=30, large=("WK-15", "M"))[::3], ("GO", "--max-size M --large-first"))

    def test_room_for_an_l_asks_nothing(self):
        calls = []
        self.assertEqual(self.decide(week=15, large=("AF-99", "L"), calls=calls)[0], "GO")
        self.assertEqual(calls, [])

    def test_the_session_holding_an_m_back_is_not_saved_for(self):
        # 40 left of the 5-hour window: an S only. At 30 used the week covers
        # an M, so with the M named it is the session alone that keeps it
        # out, and its end goes on small items as before.
        calls = []
        word, _, why, args = self.decide(session=60, week=30, large=("WK-15", "M"), calls=calls)
        self.assertEqual((word, args), ("SMALL", "--max-size S"))
        self.assertEqual(calls, [1])
        self.assertFalse(any(w.startswith("saving the week") for w in why))
        # At 33 the week keeps the M out too, and is saved for it.
        self.assertEqual(self.decide(session=60, week=33, large=("WK-15", "M"))[0], "WAIT")

    def test_the_lookup_fails_towards_filling_the_gap(self):
        with mock.patch.object(lu.subprocess, "run", side_effect=OSError("no python")):
            self.assertEqual(lu.large_waiting(), (None, None))
        for out, code in (("WK-15 M\n", 1), ("nothing", 0), ("WK-15 S", 0)):
            done = mock.Mock(returncode=code, stdout=out)
            with mock.patch.object(lu.subprocess, "run", return_value=done):
                self.assertEqual(lu.large_waiting(), (None, None))
        # next.py's own idents: an id, one with its Ø, and `#<n>` for an
        # issue whose title carries none.
        for out, want in (("WK-15 M\n", ("WK-15", "M")), ("TL-\u00d81 L", ("TL-\u00d81", "L")),
                          ("#1234 M\n", ("#1234", "M"))):
            with mock.patch.object(lu.subprocess, "run", return_value=mock.Mock(returncode=0, stdout=out)):
                self.assertEqual(lu.large_waiting(), want)


class TheWeekInTheForkLines(unittest.TestCase):
    """AF-162: each fork reading names the week too, and the end line its
    weekly cost, so the gate above can be read from what items cost."""
    LATER_WEEK = ("Current session: 12% used · resets Oct 20, 3:30am (Europe/London)\n"
                  "Current week (all models): 6% used · resets Oct 26, 2:59pm (Europe/London)\n")

    def fork(self, argv, reply, now=NOW, lines=()):
        with mock.patch.object(lu.subprocess, "run", side_effect=[reply, mock.Mock(returncode=0)]), \
                mock.patch.object(lu, "read_log", return_value=list(lines)), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            lu.fork_main(argv, now, "claude", "unused")
        return "12:00:00 " + out.getvalue().strip()

    def test_the_weekly_cost_within_one_week(self):
        start = self.fork(["--start", "AF-1", "--size", "M", "--implementer", "opus"], usage_json(10, 40))
        end = self.fork(["--end", "AF-1", "MERGED", "--size", "M", "--implementer", "opus"],
                        usage_json(30, 46), lines=[start])
        self.assertTrue(end.endswith("; week from 40% resets 2026-10-19T13:59+00:00 "
                                     "to 46% resets 2026-10-19T13:59+00:00, cost 6 points"), end)
        self.assertRegex(lu.costs([start, end], CONF), r"AF-1 +M +opus +MERGED +20 +week 6\n")
        self.assertIn("M   opus    1 item: 1 exact, median 20, mean 20.0; 0 across a reset; 0 unreadable; "
                      "week 1 exact, median 6", lu.costs([start, end], CONF))

    def test_a_weekly_reset_mid_item_is_a_range(self):
        start = self.fork(["--start", "AF-1", "--size", "M", "--implementer", "opus"], usage_json(10, 90))
        later = dt.datetime(2026, 10, 19, 20, 0, tzinfo=UTC)
        end = self.fork(["--end", "AF-1", "MERGED", "--size", "M", "--implementer", "opus"],
                        usage_json(text=self.LATER_WEEK), now=later, lines=[start])
        self.assertIn("; week from 90% resets 2026-10-19T13:59+00:00 to 6% resets 2026-10-26T14:59+00:00, "
                      "cost 6-16 points", end)

    def test_a_start_written_before_the_week_was_logged(self):
        old = "12:00:00 AF-1 usage start: size S, implementer opus, session 25% resets 2026-10-14T21:59+00:00"
        end = self.fork(["--end", "AF-1", "MERGED", "--size", "S", "--implementer", "opus"],
                        usage_json(30), lines=[old])
        self.assertIn("cost 5 points; week from start not logged to 15% resets 2026-10-19T13:59+00:00, "
                      "cost unreadable", end)
        self.assertFalse(end.endswith("points"), end)

    def test_an_unread_week_is_unreadable_never_zero(self):
        session_only = "Current session: 25% used · resets Oct 14, 10:59pm (Europe/London)\n"
        start = self.fork(["--start", "AF-1", "--size", "S", "--implementer", "opus"],
                          usage_json(text=session_only))
        self.assertTrue(start.endswith("; week unreadable"), start)
        end = self.fork(["--end", "AF-1", "MERGED", "--size", "S", "--implementer", "opus"],
                        usage_json(30), lines=[start])
        self.assertIn("; week from unreadable to 15% resets 2026-10-19T13:59+00:00, cost unreadable", end)


class TheMix(unittest.TestCase):
    """AF-162: how many items of each size landed in each week, so whether
    the big items are getting done is read from the log."""

    def test_landed_items_are_counted_by_week_and_size(self):
        lines = [end_line("AF-1", "M"), end_line("AF-2", "S"),
                 # the same week read a minute apart
                 end_line("AF-3", "S", week_reset="2026-10-19T14:00+00:00"),
                 end_line("AF-4", "L", week_reset="2026-10-26T13:59+00:00"),
                 # landed in no week this can name, and one that did not land
                 end_line("AF-5", "XS", week=None), end_line("AF-6", "M", word="SKIPPED"),
                 # a group is one item, at its end line's size
                 end_line("AF-7+AF-8", "S")]
        out = lu.costs(lines, CONF)
        self.assertIn("  week not logged                  XS 1  S 0  M 0  L 0  ? 0\n"
                      "  week to 2026-10-19T13:59+00:00   XS 0  S 3  M 1  L 0  ? 0\n"
                      "  week to 2026-10-26T13:59+00:00   XS 0  S 0  M 0  L 1  ? 0", out)

    def test_the_report_names_what_the_check_takes_each_size_to_cost(self):
        out = lu.costs([end_line(f"AF-{i}", "M") for i in range(5)], CONF)
        self.assertIn("XS 2 (floor, 0 of 5 read), S 3 (floor, 0 of 5 read), M 8 (median of 5), "
                      "L 10 (floor, 0 of 5 read); and an L, 70 points of the session (M_LEFT, 0 of 5 L items read)",
                      out)


if __name__ == "__main__":
    unittest.main()
