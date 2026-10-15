"""The writer of the facts artefact (PD-54, #742): the schema it cuts down
from f1.db's, and the release that publishes it.

tools/facts_export.py checks the file it writes against the declaration
every time it runs, and CI builds it twice and compares; this checks the
schema surgery on statements small enough to read.
"""
import os
import re
import sqlite3
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
sys.path.insert(0, ROOT)

import facts_export as fx  # noqa: E402

TABLE = """CREATE TABLE entries (
    id      INTEGER PRIMARY KEY,
    -- the race, which the artefact carries; a comment's comma, and its (paren
    race_id INTEGER NOT NULL REFERENCES races(id),
    car_id  TEXT REFERENCES cars(id),   -- a table the artefact leaves out
    note    TEXT,                       -- prose: it's left out
    pole    INTEGER NOT NULL DEFAULT 0 CHECK (pole IS NOT NULL AND pole IN (0, 1)),
    label   TEXT DEFAULT 'a--b, c',
    UNIQUE (race_id, car_id),
    CHECK (note IS NULL OR length(note) > 0),
    CHECK (label <> '')
)"""
COLUMNS = ["id", "race_id", "car_id", "note", "pole", "label"]
KEEP = ["id", "race_id", "pole", "label"]


class TheSchema(unittest.TestCase):
    def setUp(self):
        self.ddl = fx.table_ddl(TABLE, COLUMNS, KEEP, ["entries", "races"], ["pole"])

    def test_it_creates_a_table_of_the_kept_columns(self):
        con = sqlite3.connect(":memory:")
        con.execute(self.ddl)
        self.assertEqual([c[1] for c in con.execute("PRAGMA table_info(entries)")], KEEP)

    def test_every_comment_goes_and_no_string_is_touched(self):
        self.assertNotIn("--", self.ddl.replace("'a--b, c'", ""))
        self.assertNotIn("prose", self.ddl)
        self.assertIn("'a--b, c'", self.ddl)

    def test_a_constraint_naming_a_column_left_out_goes_and_the_others_stay(self):
        self.assertNotIn("UNIQUE", self.ddl)
        self.assertNotIn("length(note)", self.ddl)
        self.assertIn("CHECK (label <> '')", self.ddl)

    def test_a_nullable_column_loses_its_own_not_null_and_keeps_the_rest(self):
        pole = next(line for line in self.ddl.splitlines() if line.strip().startswith("pole"))
        self.assertEqual(pole.strip(), "pole INTEGER DEFAULT 0 CHECK (pole IS NOT NULL "
                                       "AND pole IN (0, 1)),")
        race = next(line for line in self.ddl.splitlines() if "race_id INTEGER" in line)
        self.assertIn("NOT NULL", race)

    def test_a_carried_column_keyed_to_a_table_left_out_is_refused(self):
        with self.assertRaises(SystemExit):
            fx.table_ddl(TABLE, COLUMNS, KEEP + ["car_id"], ["entries", "races"])

    def test_a_column_to_carry_that_the_table_does_not_define_is_refused(self):
        with self.assertRaises(SystemExit):
            fx.table_ddl(TABLE, COLUMNS, KEEP + ["nowhere"], ["entries", "races"])


class TheRows(unittest.TestCase):
    """rebuild() keys a rebuilt row by its id and a claimed cell by the
    claim's TEXT row_key; both reach the same row."""

    def setUp(self):
        self.src = sqlite3.connect(":memory:")
        self.src.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, a TEXT, b TEXT)")
        self.src.executemany("INSERT INTO t VALUES (?,?,?)", [(1, "x", "claimed"), (2, "y", "z")])
        self.dst = sqlite3.connect(":memory:")
        self.dst.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, a TEXT, b TEXT)")
        self.decl = {"columns": ["id", "a", "b"], "where": None}

    def test_a_claimed_null_and_a_rebuilt_value_on_one_row_both_apply(self):
        fx.copy_rows(self.src, self.dst, "t", self.decl, {"t": {1: {"a": "r"}, "1": {"b": None}}})
        self.assertEqual(self.dst.execute("SELECT a, b FROM t WHERE id = 1").fetchone(), ("r", None))

    def test_two_values_for_one_cell_are_refused(self):
        with self.assertRaises(SystemExit):
            fx.copy_rows(self.src, self.dst, "t", self.decl,
                         {"t": {1: {"b": "r"}, "1": {"b": None}}})

    def test_a_value_for_a_row_not_carried_is_refused(self):
        with self.assertRaises(SystemExit):
            fx.copy_rows(self.src, self.dst, "t", dict(self.decl, where="id = 2"),
                         {"t": {1: {"a": "r"}}})


class TheRecords(unittest.TestCase):
    def test_a_record_with_no_guard_cannot_be_left_out(self):
        import build
        with self.assertRaises(SystemExit):
            build.derive_records(None, leave_out={"most-wins"})


class TheRelease(unittest.TestCase):
    """PD-54 publishes the file beside f1.db, digested in SHA256SUMS."""

    def test_release_builds_uploads_and_digests_it(self):
        with open(os.path.join(ROOT, ".github", "workflows", "release.yml")) as f:
            yml = f.read()
        self.assertIn("python3 tools/facts_export.py", yml)
        files = re.search(r"files: \|\n((?:\s+\S.*\n)+)", yml)
        self.assertIn("f1-facts.db", files.group(1).split())
        digest = re.search(r"sha256sum ([^>]+)> SHA256SUMS", yml, re.S)
        self.assertIn("f1-facts.db", digest.group(1).split())


if __name__ == "__main__":
    unittest.main()
