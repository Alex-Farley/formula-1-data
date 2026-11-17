"""F1DB's repeated pit stops, counted as build.py counts them (LV-13, #1159).

WHY THIS FILE EXISTS
    pit_stops is keyed on (race, source, driver, stop), and until LV-13 an
    INSERT OR IGNORE dropped every row that repeated one, so nine of the 18
    rows F1DB holds for the 2026 Italian Grand Prix went without a word.
    build.py now stops on a repeat data/harvest.py does not declare, and on a
    declaration the rows no longer bear out. These hold the count to the
    declaration in both directions, and a repeat that differs from the row
    it repeats to a refusal, whatever is declared.

    python3 -m unittest tests.test_pit_stop_repeats
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import build  # noqa: E402


def row(driver="x", stop="1", lap="10", time="22.500", year="2026", rnd="13"):
    return {"year": year, "round": rnd, "driver_id": driver, "stop": stop,
            "lap": lap, "time": time, "time_millis": None}


class PitStopRepeats(unittest.TestCase):
    def test_a_declared_repeat_is_counted(self):
        rows = [row(), row(), row("y"), row("y"), row("z")]
        self.assertEqual(build._pit_stop_repeats(rows, {(2026, 13): 2}),
                         {(2026, 13): 2})

    def test_no_repeat_and_no_declaration_is_nothing(self):
        rows = [row(), row(stop="2", lap="30"), row("y")]
        self.assertEqual(build._pit_stop_repeats(rows, {}), {})

    def test_an_undeclared_repeat_stops_the_build(self):
        with self.assertRaises(SystemExit):
            build._pit_stop_repeats([row(), row()], {})

    def test_a_declaration_the_rows_no_longer_bear_out_stops_the_build(self):
        with self.assertRaises(SystemExit):
            build._pit_stop_repeats([row(), row("y")], {(2026, 13): 1})

    def test_a_count_other_than_the_declared_one_stops_the_build(self):
        rows = [row(), row(), row("y"), row("y")]
        for declared in (1, 3):
            with self.subTest(declared=declared), self.assertRaises(SystemExit):
                build._pit_stop_repeats(rows, {(2026, 13): declared})

    def test_a_repeat_in_another_race_is_not_the_declared_one(self):
        rows = [row(), row(), row(rnd="14"), row(rnd="14")]
        with self.assertRaises(SystemExit):
            build._pit_stop_repeats(rows, {(2026, 13): 2})

    def test_two_readings_of_one_stop_stop_the_build_even_declared(self):
        for other in (row(lap="11"), row(time="22.501")):
            with self.subTest(other=other), self.assertRaises(SystemExit):
                build._pit_stop_repeats([row(), other], {(2026, 13): 1})

    def test_a_row_with_no_stop_number_is_not_a_repeat(self):
        self.assertEqual(build._pit_stop_repeats([row(stop=""), row(stop="")], {}), {})


if __name__ == "__main__":
    unittest.main()
