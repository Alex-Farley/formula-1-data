"""The name matching the facts artefact's rebuild rests on (PD-53, #741).

verify.py's THE FACTS ARTEFACT section checks what the rebuild produces
against f1.db; this checks the matching that produces it, on cases small
enough to read.
"""
import os
import sqlite3
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

import facts_artefact as fa  # noqa: E402


class Register:
    """A grands_prix register of three events, and an F1DB of four."""

    def __init__(self):
        self.con = sqlite3.connect(":memory:")
        self.con.execute("CREATE TABLE grands_prix (id TEXT, name TEXT, aliases TEXT)")
        self.con.executemany("INSERT INTO grands_prix VALUES (?,?,?)", [
            ("brazilian", "Brazilian Grand Prix", "Sao Paulo Grand Prix"),
            ("emilia-romagna", "Emilia-Romagna Grand Prix", "Emilia Romagna Grand Prix"),
            ("mexican", "Mexican Grand Prix", "Mexico City Grand Prix"),
        ])
        self.gp_full = {"brazil": "Brazilian Grand Prix", "sao-paulo": "São Paulo Grand Prix",
                        "emilia-romagna": "Emilia Romagna Grand Prix",
                        "mexico": "Mexican Grand Prix", "nowhere": "Nowhere Grand Prix"}


class TheFold(unittest.TestCase):
    def test_accents_case_hyphens_and_word_order_aside(self):
        self.assertEqual(fa._fold("São Paulo Grand Prix"), fa._fold("sao paulo grand prix"))
        self.assertEqual(fa._fold("Emilia-Romagna"), fa._fold("Emilia Romagna"))
        self.assertEqual(fa._fold("Zhou Guanyu"), fa._fold("Guanyu Zhou"))
        self.assertNotEqual(fa._fold("Mexican Grand Prix"), fa._fold("Mexico City Grand Prix"))


class TheCrosswalk(unittest.TestCase):
    def setUp(self):
        self.reg = Register()
        self.walk, self.bad = fa.crosswalk(self.reg.con, self.reg)

    def test_sao_paulo_falls_under_the_brazilian_grand_prix(self):
        self.assertEqual(self.walk["sao-paulo"], ("brazilian", "Sao Paulo Grand Prix"))
        self.assertEqual(self.walk["brazil"], ("brazilian", "Brazilian Grand Prix"))

    def test_the_spelling_is_the_one_f1db_gives_where_the_register_holds_two(self):
        self.assertEqual(self.walk["emilia-romagna"],
                         ("emilia-romagna", "Emilia Romagna Grand Prix"))

    def test_a_grand_prix_the_register_does_not_hold_is_named_not_guessed(self):
        self.assertEqual(self.bad, ["nowhere"])

    def test_the_official_title_names_mexico_city(self):
        con = self.reg.con
        self.assertEqual(fa._name_from_title(
            con, "mexican", "Formula 1 Gran Premio de la Ciudad de México 2021"),
            "Mexico City Grand Prix")
        self.assertIsNone(fa._name_from_title(con, "mexican", "Gran Premio de México 2019"))
        # Only where the register holds the name for that event.
        self.assertIsNone(fa._name_from_title(
            con, "brazilian", "Gran Premio de la Ciudad de México"))


if __name__ == "__main__":
    unittest.main()
