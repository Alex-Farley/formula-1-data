"""What supervise.py decides from what a manager session returns.

WHY THIS FILE EXISTS
    The supervisor is the only part of the unattended loop that acts without
    a model reading anything: it chooses between starting the manager again,
    sleeping until a usage limit resets, and stopping. A misread there either
    restarts a run a person was meant to stop, or sits out a reset it could
    have used - and nobody is watching, which is the point of it (D-42).
"""
import datetime as dt
import importlib.util
import json
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, ".claude", "skills", "backlog-loop", "supervise.py")
spec = importlib.util.spec_from_file_location("backlog_supervise", PATH)
sup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sup)

UTC = dt.timezone.utc


def result(text, is_error=False):
    return json.dumps({"type": "result", "result": text, "is_error": is_error, "session_id": "s"})


class ReadsTheContractLine(unittest.TestCase):
    def test_each_contract_line(self):
        for line, kind in (("MERGED #664 DA-36", "MERGED"), ("MERGED #12 VD-33+AX-13", "MERGED"),
                           ("SKIPPED AF-9: gh unreachable", "SKIPPED"), ("STOP: two consecutive skips", "STOP"),
                           ("LIMIT: resets 1:30pm (Europe/London)", "LIMIT")):
            self.assertEqual(sup.classify(result(line + "\nstock-take"), 0)[0], kind, line)

    def test_the_first_line_decides_not_a_later_one(self):
        # A stock-take that mentions a merge is not a merge.
        self.assertEqual(sup.classify(result("Waiting on CI.\nMERGED #1 AF-1 earlier"), 0)[0], "NONE")

    def test_a_limit_error_with_no_contract_line_is_a_limit(self):
        text = "You've hit your session limit · resets 1:30pm (Europe/London)"
        self.assertEqual(sup.classify(result(text, is_error=True), 1)[0], "LIMIT")

    def test_an_error_naming_no_limit_is_not_a_limit(self):
        self.assertEqual(sup.classify(result("Not logged in · Please run /login", is_error=True), 1)[0], "NONE")

    def test_output_that_is_not_json(self):
        self.assertEqual(sup.classify("", 1)[0], "NONE")

    def test_the_skip_list_comes_back(self):
        kind, _, skips = sup.classify(result("LIMIT: resets 3am\nSkipped: AF-9, PD-2\nmore"), 0)
        self.assertEqual((kind, skips), ("LIMIT", ["AF-9", "PD-2"]))

    def test_only_item_ids_are_skipped(self):
        _, _, skips = sup.classify(result("STOP: x\nSkipped: AF-9 (gh down), none"), 0)
        self.assertEqual(skips, ["AF-9"])

    def test_a_manager_that_repeats_the_error_is_still_a_limit(self):
        # Found in review: the manager's final message, not a CLI error, so
        # is_error is false - and it must still resume, not end the run.
        text = "You've hit your session limit · resets 1:30pm (Europe/London)\nstock-take"
        self.assertEqual(sup.classify(result(text), 0)[0], "LIMIT")

    def test_an_error_naming_a_limit_with_no_time_is_a_limit(self):
        self.assertEqual(sup.classify(result("Claude AI usage limit reached", is_error=True), 1)[0], "LIMIT")

    def test_a_github_rate_limit_in_a_stock_take_is_not_a_usage_limit(self):
        self.assertEqual(sup.classify(result("Waiting.\nGitHub rate limit resets 3pm"), 0)[0], "NONE")


class ReadsTheResetTime(unittest.TestCase):
    NOW = dt.datetime(2026, 9, 25, 12, 0, tzinfo=UTC)  # 13:00 in London

    def test_later_today_in_the_named_zone(self):
        when = sup.reset_at("resets 1:30pm (Europe/London)", self.NOW)
        self.assertEqual(when.astimezone(UTC), dt.datetime(2026, 9, 25, 12, 30, tzinfo=UTC))

    def test_a_time_already_past_is_tomorrow(self):
        when = sup.reset_at("resets 10am (Europe/London)", self.NOW)
        self.assertEqual(when.astimezone(UTC), dt.datetime(2026, 9, 26, 9, 0, tzinfo=UTC))

    def test_a_time_just_past_is_now_not_tomorrow(self):
        when = sup.reset_at("resets 12:50pm (Europe/London)", self.NOW)
        self.assertEqual(when, self.NOW)

    def test_just_past_across_midnight(self):
        # Found in review: 11:50pm read at 00:02 slept 23h 48m.
        now = dt.datetime(2026, 9, 25, 23, 2, tzinfo=UTC)  # 00:02 on the 26th in London
        self.assertEqual(sup.reset_at("resets 11:50pm (Europe/London)", now), now)

    def test_an_epoch_reset(self):
        when = sup.reset_at("Claude AI usage limit reached|1790344800", self.NOW)
        self.assertEqual(when, dt.datetime.fromtimestamp(1790344800, UTC))

    def test_midnight_and_noon(self):
        self.assertEqual(sup.reset_at("resets 12am (UTC)", self.NOW).hour, 0)
        self.assertEqual(sup.reset_at("resets 12pm (UTC)", self.NOW).hour, 12)
        self.assertEqual(sup.reset_at("resets 11am (UTC)", self.NOW).day, 26)

    def test_a_dated_reset(self):
        when = sup.reset_at("resets Sep 27, 3am (Europe/London)", self.NOW)
        self.assertEqual(when.astimezone(UTC), dt.datetime(2026, 9, 27, 2, 0, tzinfo=UTC))

    def test_unreadable_or_implausible_is_none(self):
        self.assertIsNone(sup.reset_at("resets soon", self.NOW))
        self.assertIsNone(sup.reset_at("no time here", self.NOW))
        self.assertIsNone(sup.reset_at("resets Dec 25, 3am (UTC)", self.NOW))  # three months out


class TheCommandItRuns(unittest.TestCase):
    def test_the_manager_headless_without_mcp(self):
        cmd = sup.command("claude", "until-paused", "fast", ["AF-9"])
        self.assertEqual(cmd[:3], ["claude", "--agent", "backlog-manager"])
        self.assertIn("until-paused fast --skip AF-9", cmd)
        self.assertIn("--strict-mcp-config", cmd)
        self.assertNotIn("--strict-mcp-config", sup.command("claude", "next", "balanced", [], keep_mcp=True))

    def test_always_auto_mode(self):
        # Auto mode's refusal to merge an unreviewed PR is a control; no
        # setting chooses another mode (D-42).
        cmd = sup.command("claude", "next", "balanced", [])
        self.assertEqual(cmd[cmd.index("--permission-mode") + 1], "auto")
        self.assertNotIn("LOOP_PERMISSION_MODE", open(PATH).read())

    def test_the_agent_it_names_exists(self):
        self.assertTrue(os.path.exists(os.path.join(ROOT, ".claude", "agents", f"{sup.AGENT}.md")))

    def test_arguments_either_order(self):
        self.assertEqual(sup.parse_args(["fast", "AF-12"]), ("AF-12", "fast"))
        self.assertEqual(sup.parse_args([]), ("next", "balanced"))
        with self.assertRaises(SystemExit):
            sup.parse_args(["quickly"])


if __name__ == "__main__":
    unittest.main()
