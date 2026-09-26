"""
The Parquet bundle's README.txt states the terms the data carries (PM-23).

It is written from f1.db and LICENSE-DATA rather than kept by hand, so the
test is that what it says is what they say: the licence's own title, every
CC BY column the database grants, every source it classifies, every table it
leaves out and the file the centrelines ship in. None of this needs pyarrow,
which the build and CI's Python job deliberately do not have.
"""
import os
import sqlite3
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import parquet_export as P  # noqa: E402


class Notice(unittest.TestCase):
    def setUp(self):
        self.con = sqlite3.connect(P.DB)
        self.addCleanup(self.con.close)
        self.written = [t for t in P.tables(self.con) if t not in P.NOT_EXPORTED]
        self.text = P.notice(self.con, self.written)

    def test_it_quotes_the_licence_title(self):
        with open(P.LICENCE, encoding="utf-8") as f:
            title = f.readline().strip()
        self.assertIn(title, self.text)

    def test_it_names_every_column_the_database_grants_under_cc_by(self):
        (cols,) = self.con.execute(
            "SELECT value FROM meta WHERE key = 'project_prose_columns'").fetchone()
        for col in (c.strip() for c in cols.split(",")):
            self.assertIn(f"    {col}\n", self.text)

    def test_it_names_every_source_with_its_class(self):
        for source, cls in self.con.execute(
                "SELECT source, redistributable FROM source_registry"):
            self.assertIn(f"  {source} [{cls}]\n", self.text)

    def test_it_names_what_is_left_out_and_where_the_centrelines_are(self):
        for table in P.NOT_EXPORTED:
            self.assertIn(f"  {table} - ", self.text)
        self.assertIn("f1-geometry.db", self.text)
        self.assertIn("ODbL 1.0", self.text)

    def test_it_states_the_version_the_bundle_was_built_from(self):
        (version,) = self.con.execute(
            "SELECT value FROM meta WHERE key = 'version'").fetchone()
        self.assertIn(f"version {version},", self.text)
        self.assertIn(f"{len(self.written)} Parquet files", self.text)

    def test_no_licence_document_means_no_bundle(self):
        with mock.patch.object(P, "LICENCE", os.path.join(HERE, "no-such-file")):
            with self.assertRaises(SystemExit):
                P.notice(self.con, self.written)


if __name__ == "__main__":
    unittest.main()
