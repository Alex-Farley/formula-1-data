"""The substitute check, shown refusing what it exists to refuse (AF-151).

WHY THIS FILE EXISTS
    A substitute's row in ENTRIES_2026 is typed in from a result, and nothing
    else reads its number, team or car. Run only against the database the
    same build just wrote, the check would pass however it was written, so
    each test copies f1.db, plants one wrong value, runs verify.py's ENTRIES
    section as a separate process and asserts it exits 1 and names the check.
    The first test runs the untouched copy, so a section that refused
    everything could not pass either.

    python3 -m unittest tests.test_entries_rule
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
CHECK = r"\[FAIL\] every \d+ substitute raced for its team, in its number and car"


class TheSubstituteCheck(unittest.TestCase):
    def setUp(self):
        if not os.path.exists(SOURCE_DB):
            self.skipTest("f1.db has not been built")
        self.tmp = tempfile.mkdtemp(prefix="lapledger-entries-")
        self.db = os.path.join(self.tmp, "f1.db")
        shutil.copyfile(SOURCE_DB, self.db)
        # A database with no substitute in it passes on an empty set, so
        # every test works on a row planted here rather than on a committed
        # one, which a later season will not have.
        con = sqlite3.connect(self.db)
        self.season = con.execute(
            "SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'current_season'"
        ).fetchone()[0]
        self.driver, self.team, self.number = con.execute("""
            SELECT x.driver_id, x.constructor_id, p.driver_number
              FROM race_entries x
              JOIN races r ON r.id = x.race_id AND r.year = ?1
              JOIN practice p ON p.race_id = x.race_id AND p.driver_id = x.driver_id
             WHERE x.constructor_id = p.constructor_id
               AND x.driver_id IN (SELECT driver_id FROM season_entries
                                    WHERE year = ?1 AND role = 'race')
             LIMIT 1""", (self.season,)).fetchone()
        con.execute("DELETE FROM season_entries WHERE role = 'substitute'")
        con.execute("""UPDATE season_entries SET role = 'substitute'
                        WHERE driver_id = ? AND year = ?""",
                    (self.driver, self.season))
        con.execute("""INSERT INTO season_entries (year, constructor_id, driver_id,
            car, car_number, role, confidence) SELECT year, constructor_id,
            'hamilton', car, 90, 'race', confidence FROM season_entries
            WHERE driver_id = ? AND year = ?""", (self.driver, self.season))
        con.commit()
        con.close()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_section(self):
        proc = subprocess.run(
            [sys.executable, VERIFY, "--only", "entries", "--quiet", "--db", self.db],
            cwd=ROOT, capture_output=True, text=True, timeout=120, check=False)
        return proc.stdout + proc.stderr

    def plant(self, column, value):
        con = sqlite3.connect(self.db)
        con.execute(f"""UPDATE season_entries SET {column} = ?
                         WHERE driver_id = ? AND year = ? AND role = 'substitute'""",
                    (value, self.driver, self.season))
        con.commit()
        con.close()

    def test_a_substitute_true_to_the_records_passes(self):
        self.assertNotRegex(self.run_section(), CHECK)

    def test_a_wrong_number_is_refused(self):
        self.plant("car_number", 999)
        self.assertRegex(self.run_section(), CHECK)

    def test_a_wrong_team_is_refused(self):
        self.plant("constructor_id", "ferrari" if self.team != "ferrari" else "haas")
        self.assertRegex(self.run_section(), CHECK)

    def test_a_wrong_car_is_refused(self):
        self.plant("car", "no such car")
        self.assertRegex(self.run_section(), CHECK)


if __name__ == "__main__":
    unittest.main()
