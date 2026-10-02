"""
The Parquet bundle's README.txt states the terms the data carries (PM-23).

It is written from f1.db and LICENSE-DATA rather than kept by hand, so the
test is that what it says is what they say: the licence's own title, every
CC BY column the database grants, every source it classifies, every table it
leaves out and the file the centrelines ship in. None of this needs pyarrow,
which the build and CI's Python job deliberately do not have.
"""
import os
import re
import shutil
import sqlite3
import sys
import tempfile
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

    def test_it_quotes_the_licence_title_and_attribution(self):
        title, attribution = P.licence_words()
        with open(P.LICENCE, encoding="utf-8") as f:
            self.assertEqual(title, f.readline().strip())
        self.assertTrue(title and attribution)
        self.assertIn(f"    {title}\n", self.text)
        # Wrapped, so compared with whitespace folded.
        self.assertIn(attribution, " ".join(self.text.split()))

    def test_it_states_the_grant_the_database_carries(self):
        (grant,) = self.con.execute(
            "SELECT value FROM meta WHERE key = 'project_prose'").fetchone()
        self.assertIn(" ".join(grant.split()), " ".join(self.text.split()))

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
        licence, url, credit = P.geometry_terms()
        folded = " ".join(self.text.split())
        for term in (licence, url, credit):
            self.assertIn(term, folded)

    def test_it_states_the_version_the_bundle_was_built_from(self):
        (version,) = self.con.execute(
            "SELECT value FROM meta WHERE key = 'version'").fetchone()
        self.assertIn(f"version {version},", self.text)
        self.assertIn(f"{len(self.written)} Parquet files", self.text)

    def test_it_names_the_views_file(self):
        n = len(P.views(self.con))
        self.assertIn(f"views.sql holds f1.db's {n} views", " ".join(self.text.split()))


class Views(unittest.TestCase):
    """views.sql is every view f1.db holds, as it holds it (DA-14)."""

    def setUp(self):
        self.con = sqlite3.connect(P.DB)
        self.addCleanup(self.con.close)
        self.text = P.views_sql(self.con)

    def test_it_carries_every_view_verbatim(self):
        held = self.con.execute(
            "SELECT name, sql FROM sqlite_master WHERE type = 'view'").fetchall()
        self.assertTrue(held)
        for name, sql in held:
            self.assertIn(f"{sql};\n", self.text, name)
        self.assertEqual(self.text.count("CREATE VIEW"), len(held))
        self.assertIn("v_race_classification", self.text)
        self.assertIn("v_driver_season_points", self.text)

    def test_a_view_comes_after_every_view_it_reads(self):
        # An engine that resolves names when the view is created - DuckDB -
        # needs the one it reads first, which is why the order is f1.db's.
        order = [name for name, _ in P.views(self.con)]
        seen = set()
        for name, sql in P.views(self.con):
            body = sql.split(" AS", 1)[1]
            reads = {v for v in order if v != name
                     and re.search(rf"(\bFROM|\bJOIN|,)\s*{v}\b", body)}
            self.assertLessEqual(reads, seen, f"{name} reads {reads - seen} first")
            seen.add(name)

    def test_it_states_the_version_and_the_dialect(self):
        (version,) = self.con.execute(
            "SELECT value FROM meta WHERE key = 'version'").fetchone()
        folded = " ".join(self.text.split())
        self.assertIn(f"version {version}:", folded)
        self.assertIn("The SQL is SQLite's.", folded)


class OneAttributionWording(unittest.TestCase):
    """LICENSE-DATA's Attribution section is ATTRIBUTION.md's *Attribution
    text*, links dropped (CR-55). Two statements of one credit were how
    the licence went on crediting Wikipedia for the race results after
    v2.15 took the classification from F1DB."""

    def attribution_text(self):
        path = os.path.join(os.path.dirname(P.LICENCE), "ATTRIBUTION.md")
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
        start = lines.index("## Attribution text") + 1
        end = next((i for i in range(start, len(lines))
                    if lines[i].startswith("## ")), len(lines))
        quoted = [ln[1:].strip() for ln in lines[start:end]
                  if ln.startswith(">")]
        self.assertTrue(quoted, "ATTRIBUTION.md's Attribution text has no "
                                "quoted block")
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", " ".join(quoted))
        return " ".join(text.split())

    def test_the_licence_states_the_attribution_text(self):
        _, attribution = P.licence_words()
        self.assertEqual(attribution, self.attribution_text())

    def test_it_credits_every_bulk_source(self):
        text = self.attribution_text()
        for name in ("Wikipedia", "F1DB", "Jules Roy", "OpenStreetMap",
                     "Wikidata", "Wikimedia Commons", "formula1.com",
                     "Formula One Licensing BV"):
            self.assertIn(name, text)


class NoticeFailures(unittest.TestCase):
    def setUp(self):
        self.con = sqlite3.connect(P.DB)
        self.addCleanup(self.con.close)
        self.written = [t for t in P.tables(self.con) if t not in P.NOT_EXPORTED]

    def test_no_licence_document_means_no_bundle(self):
        with mock.patch.object(P, "LICENCE", os.path.join(HERE, "no-such-file")):
            with self.assertRaises(SystemExit):
                P.notice(self.con, self.written)

    def test_an_empty_attribution_section_means_no_bundle(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        path = os.path.join(d, "LICENSE-DATA")
        with open(path, "w", encoding="utf-8") as f:
            f.write("Data licence\n\n## Attribution\n\n## Next\ntext\n")
        with mock.patch.object(P, "LICENCE", path):
            with self.assertRaises(SystemExit):
                P.notice(self.con, self.written)

    def test_no_geometry_file_means_no_bundle(self):
        with mock.patch.object(P, "GEOMETRY", os.path.join(HERE, "no-such-file")):
            with self.assertRaises(SystemExit):
                P.notice(self.con, self.written)


if __name__ == "__main__":
    unittest.main()
