"""tools/id_ledger.py: the ids a release published, kept by the next (DA-55).

Every case builds its own small table in memory, so nothing here reads the
committed f1.db or the committed ledgers.
"""
import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import id_ledger  # noqa: E402
import release_due  # noqa: E402

KEY = ("race_id", "driver_id")


def table(*rows):
    """A qualifying-shaped table, its rows inserted in the order given, so
    the ids are what a loader's insert order would hand out."""
    con = sqlite3.connect(":memory:")
    con.execute("CREATE TABLE q (id INTEGER PRIMARY KEY, race_id INTEGER, "
                "driver_id TEXT, UNIQUE (race_id, driver_id))")
    con.executemany("INSERT INTO q (race_id, driver_id) VALUES (?, ?)", rows)
    return con


def ids(con):
    return {(r, d): i for i, r, d in con.execute("SELECT id, race_id, driver_id FROM q")}


RELEASED = {(1, "a"): 1, (1, "b"): 2, (2, "a"): 3, (2, "b"): 4}


class Assign(unittest.TestCase):
    def test_a_row_removed_mid_table_moves_nothing_after_it(self):
        con = table((1, "a"), (2, "a"), (2, "b"))
        self.assertEqual(id_ledger.assign(con, "q", KEY, RELEASED), 2)
        self.assertEqual(ids(con), {(1, "a"): 1, (2, "a"): 3, (2, "b"): 4})

    def test_a_row_added_mid_table_goes_above_every_published_id(self):
        con = table((1, "a"), (1, "b"), (1, "c"), (2, "a"), (2, "b"))
        id_ledger.assign(con, "q", KEY, RELEASED)
        self.assertEqual(ids(con), {**RELEASED, (1, "c"): 5})

    def test_a_removed_id_is_not_handed_to_a_new_row(self):
        released = {**RELEASED, (3, "a"): 5}
        con = table((1, "a"), (1, "b"), (2, "a"), (2, "b"), (3, "z"))
        id_ledger.assign(con, "q", KEY, released)
        self.assertEqual(ids(con)[(3, "z")], 6)

    def test_new_rows_keep_their_insert_order(self):
        con = table((1, "x"), (1, "a"), (1, "y"))
        id_ledger.assign(con, "q", KEY, {(1, "a"): 1})
        self.assertEqual(ids(con), {(1, "a"): 1, (1, "x"): 2, (1, "y"): 3})

    def test_a_row_that_comes_back_gets_its_id_back(self):
        con = table((2, "b"), (1, "b"))
        id_ledger.assign(con, "q", KEY, RELEASED)
        self.assertEqual(ids(con), {(1, "b"): 2, (2, "b"): 4})

    def test_rows_already_in_place_are_not_counted(self):
        con = table((1, "a"), (1, "b"), (2, "a"), (2, "b"))
        self.assertEqual(id_ledger.assign(con, "q", KEY, RELEASED), 0)
        self.assertEqual(ids(con), RELEASED)

    def test_a_key_on_two_rows_is_refused(self):
        con = sqlite3.connect(":memory:")
        con.execute("CREATE TABLE q (id INTEGER PRIMARY KEY, race_id INTEGER, driver_id TEXT)")
        con.executemany("INSERT INTO q (race_id, driver_id) VALUES (?, ?)", [(1, "a"), (1, "a")])
        with self.assertRaises(SystemExit):
            id_ledger.assign(con, "q", KEY, RELEASED)


class Departures(unittest.TestCase):
    def test_a_renumbered_table_is_moved(self):
        con = table((1, "a"), (2, "a"), (2, "b"))
        moved, reused = id_ledger.departures(id_ledger.held(con, "q", KEY), RELEASED)
        self.assertEqual([k for _, k, _ in moved], [(2, "a"), (2, "b")])
        self.assertEqual([k for _, k, _ in reused], [(2, "a"), (2, "b")])

    def test_a_new_row_on_a_retired_id_is_reused(self):
        con = table((1, "a"), (1, "z"))
        moved, reused = id_ledger.departures(id_ledger.held(con, "q", KEY), RELEASED)
        self.assertEqual(moved, [])
        self.assertEqual(reused, [(2, (1, "z"), (1, "b"))])

    def test_the_build_assignment_departs_from_nothing(self):
        con = table((1, "c"), (1, "a"), (2, "b"))
        id_ledger.assign(con, "q", KEY, RELEASED)
        self.assertEqual(id_ledger.departures(id_ledger.held(con, "q", KEY), RELEASED),
                         ([], []))

    def test_a_null_in_the_key_is_matched(self):
        con = sqlite3.connect(":memory:")
        con.execute("CREATE TABLE q (id INTEGER PRIMARY KEY, race_id INTEGER, driver_id TEXT)")
        con.executemany("INSERT INTO q (race_id, driver_id) VALUES (?, ?)", [(1, None), (2, "a")])
        id_ledger.assign(con, "q", KEY, {(2, "a"): 1, (1, None): 2})
        self.assertEqual(id_ledger.departures(id_ledger.held(con, "q", KEY),
                                              {(2, "a"): 1, (1, None): 2}), ([], []))


class Merge(unittest.TestCase):
    def test_a_release_adds_its_new_rows_and_keeps_retired_ones(self):
        merged = id_ledger.merge("q", RELEASED, [(1, (1, "a")), (5, (3, "a"))])
        self.assertEqual(merged, {**RELEASED, (3, "a"): 5})

    def test_a_release_that_renumbered_is_refused(self):
        with self.assertRaises(SystemExit):
            id_ledger.merge("q", RELEASED, [(2, (1, "a"))])

    def test_a_release_that_reused_an_id_is_refused(self):
        with self.assertRaises(SystemExit):
            id_ledger.merge("q", RELEASED, [(4, (9, "z"))])


class TheFile(unittest.TestCase):
    def test_it_reads_back_what_it_wrote(self):
        where = tempfile.mkdtemp()
        held = {(1, "a"): 1, (1, None): 7, (2, "é"): 3}
        id_ledger.write("q", "2.26", KEY, held, where=where)
        self.assertEqual(id_ledger.read("q", where=where), ("2.26", KEY, held))

    def test_an_id_twice_is_refused(self):
        where = tempfile.mkdtemp()
        with open(os.path.join(where, "q.txt"), "w", encoding="utf-8") as f:
            f.write('# release: 2.26\n# key: race_id, driver_id\n1|[1,"a"]\n1|[1,"b"]\n')
        with self.assertRaises(SystemExit):
            id_ledger.read("q", where=where)

    def test_no_ledger_is_none(self):
        self.assertIsNone(id_ledger.read("q", where=tempfile.mkdtemp()))


class TheReleaseAdvice(unittest.TestCase):
    def test_it_names_the_step_after_the_tag(self):
        for version in ("2.26", "2.27"):
            self.assertIn("python3 tools/id_ledger.py --write",
                          release_due.advice(version, "v2.26"))


if __name__ == "__main__":
    unittest.main()
