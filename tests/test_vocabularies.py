"""The vocabularies DA-13 put in schema.sql, shown refusing what they exist to refuse.

WHY THIS FILE EXISTS
    A build proves a CHECK accepts every value the database holds; nothing
    in it proves the CHECK refuses anything. For an IN-list that is plain to
    read. personnel.role's is not: a CHECK cannot hold a subquery, so it
    strips each listed role out of the ' / '-joined column and requires
    nothing to be left, and a mistake in that chain would accept everything
    and still build. These tests load schema.sql into memory and insert the
    drifted spellings the columns held before DA-13.

    python3 -m unittest tests.test_vocabularies
"""
import os
import sqlite3
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def schema():
    con = sqlite3.connect(":memory:")
    with open(os.path.join(ROOT, "schema.sql"), encoding="utf-8") as f:
        con.executescript(f.read())
    # the rows here stand alone; what is under test is the CHECK, and a
    # refusal is only counted when it is the CHECK's (refused() below)
    con.execute("PRAGMA foreign_keys = OFF")
    return con


def refused(case):
    return case.assertRaisesRegex(sqlite3.IntegrityError, "CHECK constraint failed")


class PersonnelRole(unittest.TestCase):
    def setUp(self):
        self.con = schema()

    def insert(self, role):
        self.con.execute("INSERT INTO personnel (id, full_name, role) VALUES (?, ?, ?)",
                         (f"p{abs(hash(role))}", "Someone", role))

    def test_accepts_one_role_several_and_none(self):
        for role in ("designer", "founder / designer", "official / neurosurgeon",
                     "team owner / commercial rights holder", "designer / co-founder",
                     None):
            self.insert(role)

    def test_refuses_drift(self):
        for role in ("Designer", "founder/designer", "founder / ", "",
                     "founder / founder", "principal", "team principal / chef",
                     "founder, designer"):
            with self.subTest(role=role), refused(self):
                self.insert(role)


class Aspiration(unittest.TestCase):
    def setUp(self):
        self.con = schema()

    def test_chassis_refuses_harvested_spellings(self):
        ok = ("naturally aspirated", "turbocharged hybrid", "gas turbine", None)
        for i, v in enumerate(ok):
            self.con.execute("""INSERT INTO chassis (id, f1db_constructor_id, name,
                full_name, aspiration, source) VALUES (?, 'x', 'x', 'x', ?, 'x')""", (f"ok{i}", v))
        for i, v in enumerate(("NA", "N/A", "turbo", "Naturally aspirated",
                               "naturally aspirated, 18,000 RPM limited with KERS")):
            with self.subTest(v=v), refused(self):
                self.con.execute("""INSERT INTO chassis (id, f1db_constructor_id, name,
                    full_name, aspiration, source) VALUES (?, 'x', 'x', 'x', ?, 'x')""", (f"bad{i}", v))

    def test_engine_eras_refuses_the_old_capitals(self):
        for v in ("Both", "Naturally aspirated in practice", "Turbocharged"):
            with self.subTest(v=v), refused(self):
                self.con.execute("""INSERT INTO engine_eras (from_year, era_name, formula,
                    aspiration) VALUES (1950, 'x', 'x', ?)""", (v,))


class RadioChannel(unittest.TestCase):
    def test_refuses_a_channel_off_the_list(self):
        con = schema()
        con.execute("INSERT INTO team_radio (speaker, channel) VALUES ('x', 'pit-to-car')")
        for v in ("pit to car", "driver", "Rob Smedley (race engineer) to Felipe Massa [pit-to-car]"):
            with self.subTest(v=v), refused(self):
                con.execute("INSERT INTO team_radio (speaker, channel) VALUES ('x', ?)", (v,))


if __name__ == "__main__":
    unittest.main()
