"""tools/refresh_hold.py and the held.txt it writes: what a refresh may hold
back, and what it must not (AF-90, [D-56]).

The decisions are pure functions of text, tested on lines written here. Not
on the committed harvest or f1.db: refresh.yml runs this suite after a
refresh has rebuilt, and a test that read the committed held.txt would fail
the very refresh that holds something.

    python3 -m unittest tests.test_refresh_hold
"""
import collections
import os
import sys
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))
import refresh_hold as RH  # noqa: E402
from data import harvest as HV  # noqa: E402

HEAD = "# Generated\n# year|round|position|driver_id\n"
R16 = ["2030|16|1|a", "2030|16|2|b"]
R17 = ["2030|17|1|a", "2030|17|2|b"]


def text(*lines):
    return HEAD + "".join(f"{line}\n" for line in lines)


class WhatIsACandidate(unittest.TestCase):
    def test_a_race_the_fetch_adds_is_one(self):
        found = RH.candidates(text(*R16), text(*R16, *R17))
        self.assertEqual([race for race, _ in found], [(2030, 17)])
        self.assertEqual(found[0][1], collections.Counter(R17))

    def test_rows_added_to_a_race_already_held_are_one_and_only_those_rows(self):
        # Practice arrives a session at a time: FP1 is on main, FP2 is new.
        found = RH.candidates(text("2030|17|fp1|a"), text("2030|17|fp1|a", "2030|17|fp2|a"))
        self.assertEqual(found, [((2030, 17), collections.Counter(["2030|17|fp2|a"]))])

    def test_a_race_whose_committed_rows_changed_is_not(self):
        self.assertEqual(RH.candidates(text(*R16), text("2030|16|1|b", "2030|16|2|a")), [])

    def test_a_race_that_gained_a_row_and_lost_one_is_not(self):
        self.assertEqual(RH.candidates(text(*R16), text("2030|16|1|a", "2030|16|3|c")), [])

    def test_a_race_the_fetch_only_took_rows_from_is_not(self):
        self.assertEqual(RH.candidates(text(*R16, *R17), text(*R16)), [])

    def test_an_unchanged_file_has_none(self):
        self.assertEqual(RH.candidates(text(*R16), text(*R16)), [])

    def test_a_line_with_no_round_belongs_to_no_race(self):
        # standings.txt's end-of-season classification has an empty round.
        self.assertEqual(RH.candidates(text(*R16), text(*R16, "2030||drivers|1|a")), [])

    def test_a_header_change_is_not_a_row(self):
        self.assertEqual(RH.candidates(text(*R16), "# v2\n" + text(*R16)), [])


class LeavingRowsOut(unittest.TestCase):
    def test_only_the_added_rows_go_and_the_rest_keep_their_order(self):
        fetched = text(*R16, *R17)
        self.assertEqual(RH.without(fetched, collections.Counter(R17)), text(*R16))

    def test_a_repeated_line_goes_only_as_often_as_it_was_added(self):
        fetched = text("2030|17|x", "2030|17|x")
        self.assertEqual(RH.without(fetched, collections.Counter(["2030|17|x"])),
                         text("2030|17|x"))

    def test_a_header_is_never_taken_for_a_row(self):
        self.assertEqual(RH.without("# 2030|17|x\n2030|17|x\n",
                                    collections.Counter(["2030|17|x"])), "# 2030|17|x\n")

    def test_a_row_that_is_not_there_is_refused(self):
        with self.assertRaises(ValueError):
            RH.without(text(*R16), collections.Counter(R17))


class WhatFailed(unittest.TestCase):
    def test_verify_names_its_failed_checks(self):
        out = "\nSECTION\n  [FAIL] x — d\n\n====\n2 CHECK(S) FAILED:\n   - first\n   - second\n"
        self.assertEqual(RH.failures("verify.py", 1, out, ""), ["first", "second"])

    def test_a_verify_that_crashed_says_so(self):
        self.assertEqual(RH.failures("verify.py", 1, "", "Traceback"), ["verify.py exited 1"])

    def test_a_build_refusal_is_named_and_never_quoted(self):
        # Its message can quote harvest values; this text is granted prose.
        got = RH.failures("build.py", 1, "loading\n", "standings: max-verstappen 25\n")
        self.assertEqual(got, ["build.py refused the harvest (exit 1; the run's log has why)"])

    def test_a_field_carries_no_pipe_and_no_line_break(self):
        self.assertEqual(RH.one_line("a|b\nc  d"), "a/b c d")
        self.assertLessEqual(len(RH.one_line("x" * 900, 50)), 50)


class TheHeldFile(unittest.TestCase):
    def held(self, *lines):
        tmp = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
        tmp.write(RH.HEADER + "".join(lines))
        tmp.close()
        self.addCleanup(os.unlink, tmp.name)
        return mock.patch.object(HV, "HELD_FILE", tmp.name)

    def test_what_the_tool_writes_the_build_reads(self):
        line = RH.held_line("sprint_qualifying.txt", (2030, 17), collections.Counter(R17),
                            ["one check", "a|nother"])
        with self.held(line):
            self.assertEqual(HV.load_held(),
                             [("sprint_qualifying.txt", 2030, 17, 2, "one check; a/nother")])

    def test_an_empty_file_holds_nothing(self):
        with self.held():
            self.assertEqual(HV.load_held(), [])

    def test_a_file_no_race_can_be_held_from_is_refused(self):
        with self.held("race_dates.txt|2030|17|1|x\n"), self.assertRaises(SystemExit):
            HV.load_held()

    def test_a_hold_of_no_rows_is_refused(self):
        with self.held("qualifying.txt|2030|17|0|x\n"), self.assertRaises(SystemExit):
            HV.load_held()

    def test_a_hold_with_no_reason_is_refused(self):
        with self.held("qualifying.txt|2030|17|3|\n"), self.assertRaises(SystemExit):
            HV.load_held()

    def test_two_holds_are_refused(self):
        with self.held("qualifying.txt|2030|17|3|x\n", "practice.txt|2030|17|3|x\n"), \
                self.assertRaises(SystemExit):
            HV.load_held()

    def test_every_holdable_file_is_one_the_fetch_writes_per_race(self):
        for f in HV.HOLDABLE:
            with open(os.path.join(ROOT, "harvest", f), encoding="utf-8") as fh:
                header = [line for line in fh if line.startswith("# year|round|")]
            self.assertTrue(header, f"{f} is not keyed year|round")


class TheGapRow(unittest.TestCase):
    def test_it_names_the_race_and_the_rows_and_is_open(self):
        gap = HV.held_gap(21, ("f1db_pit_stops.txt", 2030, 17, 1, "a check"), "Test Grand Prix")
        self.assertEqual(gap[:5], (21, "held-2030-17-f1db-pit-stops", "pit_stops",
                                   "the pit stops of the 2030 Test Grand Prix", "open"))
        self.assertIn("the 1 row F1DB", gap[6])
        self.assertIn("The pit stops of the 2030 Test Grand Prix are held back", gap[5])
        self.assertIn("added once they pass.", gap[5])

    def test_a_single_thing_held_reads_in_the_singular(self):
        gap = HV.held_gap(21, ("qualifying.txt", 2030, 17, 2, "a check"), "Test Grand Prix")
        self.assertIn("classification of the 2030 Test Grand Prix is held back", gap[5])
        self.assertIn("added once it passes.", gap[5])
        self.assertIn("What they failed: a check", gap[6])

    def test_its_key_is_one_a_reader_can_type(self):
        for f in HV.HOLDABLE:
            key = HV.held_gap(1, (f, 2030, 17, 2, "x"), "G")[1]
            self.assertRegex(key, r"^[a-z0-9]+(-[a-z0-9]+)*$")


if __name__ == "__main__":
    unittest.main()
