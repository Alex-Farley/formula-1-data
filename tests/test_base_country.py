"""constructors.base held to the country registry (CR-77), shown refusing.

WHY THIS FILE EXISTS
    verify.py checks every constructor's base on every build, but every build
    since the check was added has been against bases that pass it, so a check
    that passed whatever it was given would read exactly like one that works.
    These tests give base_country_faults the spellings the column held before
    CR-77 and see them refused, and hold the committed data/*.py rows - not
    f1.db - to it.

    python3 -m unittest tests.test_base_country
"""
import unittest

import verify
from data import harvest as HV
from data import results as RS
from data import teams as T

REGISTRY = {name for _cid, name, _a3, _dem in HV.load_f1db_countries()}


class BaseCountry(unittest.TestCase):
    def test_registry_is_loaded(self):
        # an empty registry would refuse everything and prove nothing below
        self.assertIn("United Kingdom", REGISTRY)
        self.assertIn("United States of America", REGISTRY)

    def test_accepts_registry_countries_and_null(self):
        rows = [("ferrari", "Maranello, Italy"),
                ("connaught", "Send, Surrey, United Kingdom"),
                ("haas", "Kannapolis, United States of America"),
                ("unknown", None)]
        self.assertEqual(verify.base_country_faults(rows, REGISTRY), [])

    def test_refuses_the_spellings_cr77_found(self):
        for base in ("Send, Surrey, UK", "Huntingdon, UK",
                     "Kannapolis, United States", "Rye, United States",
                     "Maranello", "Maranello, Italian", "Maranello, "):
            with self.subTest(base=base):
                self.assertEqual(verify.base_country_faults([("x", base)], REGISTRY),
                                 [f"x: {base!r}"])

    def test_the_committed_rows_pass(self):
        rows = [(r[0], r[4]) for r in T.CONSTRUCTORS]
        rows += [(r[0], r[3]) for r in RS.NEW_CONSTRUCTORS]
        self.assertGreater(len(rows), 60)
        self.assertEqual(verify.base_country_faults(rows, REGISTRY), [])


if __name__ == "__main__":
    unittest.main()
