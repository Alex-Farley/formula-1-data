"""
The Wikipedia race-winners credit stops on a winner it does not cover (CR-121).

ATTRIBUTION.md credits Wikipedia's season articles with the winners of every
race that cites one, sized by the wp_races figure. These cases build a two-race
database in memory, so they hold whatever the committed f1.db says: the figure
is written while every winner cites registry entry 8, and refused when one
cites another source, cites none, or is missing.
"""
import os
import sqlite3
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
from readme_figures import Figures  # noqa: E402

SEASON = "https://en.wikipedia.org/wiki/1960_Formula_One_season"


def database():
    con = sqlite3.connect(":memory:")
    con.executescript("""
        CREATE TABLE source_registry (id INTEGER PRIMARY KEY, priority INTEGER,
            domains TEXT, redistributable TEXT, source TEXT);
        INSERT INTO source_registry VALUES (8, 1, 'en.wikipedia.org', 'yes', NULL),
                                           (10, 2, 'github.com,f1db', 'yes', NULL);
        CREATE TABLE races (id INTEGER PRIMARY KEY, year INTEGER, source TEXT);
        CREATE TABLE race_entries (id INTEGER PRIMARY KEY, race_id INTEGER,
            finish_position INTEGER, source TEXT, source_id INTEGER);
    """)
    con.executemany("INSERT INTO races VALUES (?, 1960, ?)", [(1, SEASON), (2, SEASON)])
    con.executemany("INSERT INTO race_entries VALUES (?, ?, ?, ?, 8)",
                    [(1, 1, 1, SEASON), (2, 1, 2, SEASON), (3, 2, 1, SEASON)])
    return con


class WinnerCredit(unittest.TestCase):
    def test_every_winner_citing_the_articles_is_counted(self):
        self.assertEqual(Figures(database()).wp_races(), "2")

    def test_a_refusal(self):
        for change, named in (
                ("UPDATE race_entries SET source_id = 10 WHERE id = 3", "source_registry 10"),
                ("UPDATE race_entries SET source_id = NULL WHERE id = 3", "source_registry None"),
                ("UPDATE race_entries SET finish_position = 3 WHERE id = 3", "no winner")):
            with self.subTest(named=named):
                con = database()
                con.execute(change)
                with self.assertRaises(SystemExit) as stop:
                    Figures(con).wp_races()
                self.assertIn(named, str(stop.exception))

    def test_a_loser_citing_another_source_is_not_refused(self):
        con = database()
        con.execute("UPDATE race_entries SET source_id = 10 WHERE id = 2")
        self.assertEqual(Figures(con).wp_races(), "2")


if __name__ == "__main__":
    unittest.main()
