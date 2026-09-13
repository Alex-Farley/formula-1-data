"""verify.py's licence gate, shown refusing what it exists to refuse.

WHY THIS FILE EXISTS
    `verify.py --redistribution-only` is the only thing between a loader
    that filled a FOM-owned table on a local copy and a commit that publishes
    it; ci.yml runs it against the committed database before every rebuild
    for exactly that reason. Until now nothing checked that the gate closes.
    Every run has been against a clean database, so a change that made a
    check pass whatever the table held — a query against the wrong table, a
    verdict that stopped reading its own result — would have read as a pass.

    Each test here copies f1.db, plants ONE row it must refuse, runs the gate
    as a separate process the way CI does, and asserts that it exits 1 and
    names the check. The last two show the F1_LOCAL_TIMING switch doing what
    the documentation says: the FOM checks become warnings, the unclassified-
    source check does not.

    python3 -m unittest tests.test_verify_refuses
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


def plant(con, table, **known):
    """Insert one row, filling every NOT NULL column without a default with a
    value of its declared type, so the row is legal to the schema and the
    only thing wrong with it is the thing the test says is wrong. Derived
    from PRAGMA table_info rather than a column list, for the reason
    CLAUDE.md gives."""
    row = dict(known)
    for _, name, ctype, notnull, default, pk in con.execute(f'PRAGMA table_info("{table}")'):
        if name in row or not notnull or default is not None or pk:
            continue
        ctype = (ctype or "").upper()
        row[name] = 1 if "INT" in ctype else 1.0 if "REAL" in ctype else "x"
    cols = ", ".join(f'"{c}"' for c in row)
    con.execute(f'INSERT INTO "{table}" ({cols}) VALUES ({",".join("?" * len(row))})', list(row.values()))


class TheGateRefuses(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="lapledger-verify-")
        cls.db = os.path.join(cls.tmp, "f1.db")
        shutil.copyfile(SOURCE_DB, cls.db)
        # No f1-geometry.db beside the copy: verify.py then reads
        # main.circuit_geometry, which is the table under test anyway.

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def run_gate(self, local_timing=False):
        env = {k: v for k, v in os.environ.items() if k != "F1_LOCAL_TIMING"}
        if local_timing:
            env["F1_LOCAL_TIMING"] = "1"
        proc = subprocess.run(
            [sys.executable, VERIFY, "--redistribution-only", "--quiet", "--db", self.db],
            cwd=ROOT, env=env, capture_output=True, text=True, timeout=120, check=False)
        return proc.returncode, proc.stdout + proc.stderr

    def planted(self, table, **known):
        """Plant a row for the duration of one test, then take it out again
        so the copy is clean for the next."""
        con = sqlite3.connect(self.db)
        con.execute("PRAGMA foreign_keys=OFF")
        before = con.execute(f'SELECT COALESCE(MAX(rowid), 0) FROM "{table}"').fetchone()[0]
        plant(con, table, **known)
        con.commit()
        con.close()
        self.addCleanup(self._unplant, table, before)

    def _unplant(self, table, before):
        con = sqlite3.connect(self.db)
        con.execute(f'DELETE FROM "{table}" WHERE rowid > ?', (before,))
        con.commit()
        con.close()

    def assertRefused(self, check_name, local_timing=False):
        code, out = self.run_gate(local_timing)
        self.assertEqual(code, 1, f"the gate passed a database it must refuse:\n{out}")
        self.assertIn(f"[FAIL] {check_name}", out)

    # -- the control: the committed database passes -------------------------

    def test_the_committed_database_passes(self):
        code, out = self.run_gate()
        self.assertEqual(code, 0, out)
        self.assertIn("All checks passed", out)

    # -- the four FOM-owned tables -------------------------------------------

    def test_a_lap_is_refused(self):
        self.planted("laps", race_id=1, driver_key="VER", lap_number=1)
        self.assertRefused("laps holds no FOM-owned per-lap timing")

    def test_a_stint_is_refused(self):
        self.planted("stints", race_id=1)
        self.assertRefused("stints holds no FOM-owned tyre stints")

    def test_a_race_timing_row_is_refused(self):
        self.planted("race_timing", race_id=1)
        self.assertRefused("race_timing holds no FOM-owned race timing summaries")

    def test_a_race_control_message_is_refused(self):
        self.planted("race_control_messages", race_id=1)
        self.assertRefused("race_control_messages holds no FOM-owned race control messages")

    # -- the two tables checked by source ------------------------------------

    def test_a_pit_stop_from_a_timing_source_is_refused(self):
        self.planted("pit_stops", race_id=1, driver_key="VER", source="jolpica")
        self.assertRefused("every pit stop comes from F1DB")

    def test_a_radio_row_from_the_live_timing_api_is_refused(self):
        self.planted("team_radio", source="fastf1")
        self.assertRefused("no team radio row was indexed from the live timing API")

    # -- ODbL geometry inside f1.db ------------------------------------------

    def test_a_centreline_inside_the_main_database_is_refused(self):
        self.planted("circuit_geometry", circuit_id="monza", wikidata_id="Q171400",
                     osm_relation=1, centreline="{}", measured_km=5.7, published_km=5.793,
                     delta_pct=-1.6)
        self.assertRefused("f1.db carries no ODbL geometry")

    # -- the general rule: every cited source resolves to a class ------------

    def test_a_row_citing_a_forbidden_source_is_refused(self):
        self.planted("race_entries", race_id=1, driver_id="senna",
                     source="https://api.jolpi.ca/ergast/f1/1988/results")
        self.assertRefused("no row cites a source that may not be redistributed")

    def test_a_row_citing_an_unclassified_source_is_refused(self):
        self.planted("race_entries", race_id=1, driver_id="senna",
                     source="https://stats.example.invalid/1988")
        self.assertRefused("every cited source is one the registry classifies")

    # -- the switch: what F1_LOCAL_TIMING does and does not relax ------------

    def test_local_timing_downgrades_a_lap_to_a_warning(self):
        self.planted("laps", race_id=1, driver_key="VER", lap_number=1)
        code, out = self.run_gate(local_timing=True)
        self.assertEqual(code, 0, out)
        self.assertIn("[WARN] laps holds no FOM-owned per-lap timing", out)

    def test_local_timing_does_not_relax_an_unclassified_source(self):
        self.planted("race_entries", race_id=1, driver_id="senna",
                     source="https://stats.example.invalid/1988")
        self.assertRefused("every cited source is one the registry classifies", local_timing=True)


if __name__ == "__main__":
    unittest.main()
