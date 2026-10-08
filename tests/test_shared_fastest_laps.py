# -*- coding: utf-8 -*-
"""
The shared fastest laps that are still inserted early (DA-39), pinned.

WHY THIS FILE EXISTS
    build.py credits a name a restored share adds to the row the
    classification creates, so restoring a share moves no race_entries id.
    SHARED_FASTEST_LAPS_INSERTED exempts the two shares that were built the
    old way, because their rows already hold the ids they were given. Adding
    a share to it would skip the deferral and renumber race_entries silently,
    since nothing in the build compares one release's ids with the last. This
    test makes growing the set a deliberate edit.

    python3 -m unittest discover -s tests
"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from data import harvest as H  # noqa: E402


class TheEarlyInsertsAreTheTwoTheyWere(unittest.TestCase):
    def test_only_1960_belgium_and_1969_canada(self):
        self.assertEqual(set(H.SHARED_FASTEST_LAPS_INSERTED),
                         {(1960, 5), (1969, 9)})

    def test_each_is_a_restored_share(self):
        self.assertLessEqual(set(H.SHARED_FASTEST_LAPS_INSERTED),
                             set(H.SHARED_FASTEST_LAPS))


if __name__ == "__main__":
    unittest.main()
