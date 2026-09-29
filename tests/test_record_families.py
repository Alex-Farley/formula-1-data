"""record_families(), shown refusing what it exists to refuse.

/records is built from `records.family` (WK-08), so a derived record with no
family would fall off the page without a word. build.py's record_families()
stops the build on that, on a key declared in two families, on a declared key
nothing derives, and on a headline that is not a derived record. Each branch
is planted here and must be named; the declarations as committed must pass.

    python3 -m unittest tests.test_record_families
"""
import os
import sys
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import build  # noqa: E402

FAMILIES = {"Wins": ("most-wins", "most-wins-in-a-season"), "Pole positions": ("most-poles",)}
HEADLINES = ("most-wins",)
DERIVED = ["most-wins", "most-poles", "most-wins-in-a-season"]


class RecordFamilies(unittest.TestCase):
    def run_with(self, derived, families=FAMILIES, headlines=HEADLINES):
        with mock.patch.object(build, "RECORD_FAMILIES", families), \
             mock.patch.object(build, "RECORD_HEADLINES", headlines):
            return build.record_families(derived)

    def refuses(self, what, key, **kw):
        derived = kw.pop("derived", DERIVED)
        with self.assertRaises(SystemExit) as caught:
            self.run_with(derived, **kw)
        message = str(caught.exception)
        self.assertIn(what, message)
        self.assertIn(key, message)

    def test_a_consistent_declaration_passes(self):
        self.assertEqual(self.run_with(DERIVED), {
            "most-wins": "Wins", "most-wins-in-a-season": "Wins", "most-poles": "Pole positions"})

    def test_a_derived_record_in_no_family(self):
        self.refuses("in no family", "most-podiums", derived=DERIVED + ["most-podiums"])

    def test_a_key_in_two_families(self):
        self.refuses("in two families", "most-poles",
                     families={**FAMILIES, "Podiums": ("most-poles",)})

    def test_a_declared_key_nothing_derives(self):
        self.refuses("in a family but not derived", "most-wins-in-a-season",
                     derived=["most-wins", "most-poles"])

    def test_a_headline_that_is_not_derived(self):
        self.refuses("a headline but not derived", "most-titles",
                     headlines=HEADLINES + ("most-titles",))

    def test_the_committed_declarations_are_consistent(self):
        # Every key the committed tables declare is taken as derived; the
        # build itself checks them against what derive_records() returns.
        derived = [k for keys in build.RECORD_FAMILIES.values() for k in keys]
        family_of = build.record_families(derived)
        self.assertTrue(set(build.RECORD_HEADLINES) <= set(family_of))


if __name__ == "__main__":
    unittest.main()
