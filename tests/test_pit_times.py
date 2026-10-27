"""F1DB's pit-stop time, read as build.py reads it (AF-140).

WHY THIS FILE EXISTS
    Until AF-140 every F1DB stop went into `pit_stops` with
    `pit_lane_seconds` NULL: build.py read `time_millis`, which F1DB's YAML
    leaves empty, and never `time`, which holds the figure. verify.py's
    floor on the column catches the whole column going missing again; these
    catch the parse getting a format wrong, which a floor would not see.

    python3 -m unittest tests.test_pit_times
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import build  # noqa: E402


def row(time, millis=""):
    return {"year": "2025", "round": "1", "driver_id": "x",
            "time": time, "time_millis": millis}


class PitMillis(unittest.TestCase):
    def test_each_format_f1db_writes(self):
        self.assertEqual(build._pit_millis(row("13.341")), 13341)
        self.assertEqual(build._pit_millis(row("08.757")), 8757)
        self.assertEqual(build._pit_millis(row("1:09.764")), 69764)
        self.assertEqual(build._pit_millis(row("1:01:47.606")), 3707606)

    def test_time_millis_is_the_fallback_and_never_overrides_time(self):
        self.assertEqual(build._pit_millis(row("", "13341")), 13341)
        self.assertEqual(build._pit_millis(row("13.341", "99999")), 13341)

    def test_no_time_at_all_is_null(self):
        self.assertIsNone(build._pit_millis(row("")))

    def test_a_time_that_does_not_parse_stops_the_build(self):
        for bad in ("13.3", "13", "+1 lap", "1:2:3:04.000", "13.341s"):
            with self.subTest(bad=bad), self.assertRaises(SystemExit):
                build._pit_millis(row(bad))


if __name__ == "__main__":
    unittest.main()
