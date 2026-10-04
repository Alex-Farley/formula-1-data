"""
A row a local loader changed cites the loader, and the exports refuse it (CR-61).

tools/ergast_load.py and tools/fastf1_load.py upsert race_entries rows the
build wrote. Before this, an overwritten row kept F1DB's citation, and every
guard that reads a row's licence off its citation passed it. Each test works
on an in-memory copy of the committed f1.db, so the artefact is never touched
and no network or FastF1 is needed.
"""
import os
import sqlite3
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import loader_citation as L  # noqa: E402
import parquet_export as P  # noqa: E402

JOLPICA = "https://api.jolpi.ca/ergast/f1/2024/results/"
KEY = "race_id=? AND driver_id=?"


class LoaderCitation(unittest.TestCase):
    def setUp(self):
        src = sqlite3.connect(P.DB)
        self.con = sqlite3.connect(":memory:")
        src.backup(self.con)
        src.close()
        self.addCleanup(self.con.close)
        self.cur = self.con.cursor()
        # Two F1DB rows from one race: one the "loader" changes, one it
        # writes back as it was.
        rows = self.cur.execute("""SELECT e.race_id, e.driver_id FROM race_entries e
            JOIN source_registry s ON s.id = e.source_id
            WHERE s.source = 'F1DB' AND e.points IS NOT NULL
            ORDER BY e.race_id DESC, e.driver_id LIMIT 2""").fetchall()
        self.assertEqual(len(rows), 2)
        self.changed, self.same = rows

    def cited(self, key):
        return self.cur.execute(
            f"SELECT source, source_id FROM race_entries WHERE {KEY}", key).fetchone()

    def upsert(self, key, points_from_old):
        """The shape both loaders write: an upsert that overwrites points."""
        before = L.snapshot(self.cur, "race_entries", KEY, key)
        self.cur.execute(f"""UPDATE race_entries SET points = {points_from_old}
                             WHERE {KEY}""", key)
        return L.cite_changed(self.cur, "race_entries", before, JOLPICA, KEY, key)

    def test_a_changed_row_cites_the_loader_with_no_source_id(self):
        self.assertEqual(self.upsert(self.changed, "points + 1"), 1)
        self.assertEqual(self.cited(self.changed), (JOLPICA, None))

    def test_a_row_written_back_unchanged_keeps_its_citation(self):
        held = self.cited(self.same)
        self.assertEqual(self.upsert(self.same, "points"), 0)
        self.assertEqual(self.cited(self.same), held)

    def test_a_whole_table_snapshot_recites_only_what_moved(self):
        before = L.snapshot(self.cur, "drivers")
        self.cur.execute("UPDATE drivers SET podiums = COALESCE(podiums, 0) + 1 "
                         "WHERE id = (SELECT MIN(id) FROM drivers)")
        self.assertEqual(L.cite_changed(self.cur, "drivers", before, JOLPICA), 1)
        self.assertEqual(self.cur.execute(
            "SELECT id, source_id FROM drivers WHERE source = ?", (JOLPICA,)).fetchall(),
            [(min(before), None)])

    def test_the_committed_database_passes_the_parquet_refusal(self):
        P.refuse_unpublishable(self.con)

    def test_the_parquet_export_refuses_a_row_a_loader_changed(self):
        self.upsert(self.changed, "points + 1")
        with self.assertRaises(SystemExit) as e:
            P.refuse_unpublishable(self.con)
        self.assertIn("race_entries", str(e.exception.code))

    def test_the_parquet_export_refuses_a_row_citing_a_source_classed_no(self):
        self.cur.execute("""UPDATE race_entries SET source_id =
                (SELECT id FROM source_registry WHERE redistributable = 'no' LIMIT 1)
            WHERE id = (SELECT MIN(id) FROM race_entries)""")
        with self.assertRaises(SystemExit) as e:
            P.refuse_unpublishable(self.con)
        self.assertIn("race_entries", str(e.exception.code))


if __name__ == "__main__":
    unittest.main()
