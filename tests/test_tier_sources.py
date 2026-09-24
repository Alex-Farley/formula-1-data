"""verify.py's tier-definition check, shown refusing what it exists to refuse.

WHY THIS FILE EXISTS
    The `reference` tier's definition named Wikipedia's season tables for a
    tier F1DB supplied almost entirely (DA-05), and nothing could notice. The
    check in `tier_sources` holds a definition to the sources its rows cite,
    in both directions. A check that passed whatever the database held would
    read exactly like one that works against a clean build, so each test here
    copies f1.db, breaks ONE thing, runs that section as a separate process
    and asserts that it exits 1 and names the check.

    python3 -m unittest tests.test_tier_sources
"""
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERIFY = os.path.join(ROOT, "verify.py")
SOURCE_DB = os.path.join(ROOT, "f1.db")


class TheTierCheckRefuses(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="lapledger-tiers-")
        self.db = os.path.join(self.tmp, "f1.db")
        shutil.copyfile(SOURCE_DB, self.db)
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def alter(self, sql, params=()):
        con = sqlite3.connect(self.db)
        con.execute("PRAGMA foreign_keys=OFF")
        con.execute(sql, params)
        con.commit()
        con.close()

    def run_section(self):
        env = {k: v for k, v in os.environ.items() if k != "F1_LOCAL_TIMING"}
        proc = subprocess.run(
            [sys.executable, VERIFY, "--only", "tier_sources", "--quiet", "--db", self.db],
            cwd=ROOT, env=env, capture_output=True, text=True, timeout=120, check=False)
        return proc.returncode, proc.stdout + proc.stderr

    def assertRefused(self, check_name):
        code, out = self.run_section()
        self.assertEqual(code, 1, f"the check passed a database it must refuse:\n{out}")
        self.assertIn(f"[FAIL] {check_name}", out)

    def test_the_committed_database_passes(self):
        code, out = self.run_section()
        self.assertEqual(code, 0, out)

    def test_a_definition_that_stops_naming_a_source_is_refused(self):
        # The definition as it stood before DA-05.
        self.alter("UPDATE provenance SET definition = ? WHERE confidence = 'reference'",
                   ("Harvested from Wikipedia's season results tables.",))
        self.assertRefused("every source a tier declares is named in its definition")

    def test_rows_from_a_source_the_definition_does_not_name_are_refused(self):
        jolpica = sqlite3.connect(self.db).execute(
            "SELECT id FROM source_registry WHERE source LIKE 'Jolpica%'").fetchone()[0]
        self.alter("UPDATE qualifying SET source_id = ? WHERE rowid = "
                   "(SELECT MIN(rowid) FROM qualifying WHERE confidence = 'reference')",
                   (jolpica,))
        self.assertRefused("every source a tier's rows cite is named in its definition")

    def test_a_source_no_row_at_the_tier_cites_is_refused(self):
        self.alter("UPDATE regulation_limits SET confidence = 'medium' "
                   "WHERE confidence = 'reference' AND source LIKE 'https://en.wikipedia.org/%'")
        self.assertRefused("every source a tier's definition names is cited at that tier")

    def test_a_row_at_the_tier_that_cites_nothing_is_refused(self):
        self.alter("UPDATE qualifying SET source_id = NULL WHERE rowid = "
                   "(SELECT MIN(rowid) FROM qualifying WHERE confidence = 'reference')")
        self.assertRefused("every row at a tier that names its sources cites one")


if __name__ == "__main__":
    unittest.main()
