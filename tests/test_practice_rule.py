"""The practice checks, shown refusing what they exist to refuse (LV-03).

WHY THIS FILE EXISTS
    verify.py's PRACTICE AND SPRINT QUALIFYING section holds the two new
    tables to their source, their shape and their weekend, and holds
    `drivers.practice_only` to the fact it names. Run only against the
    database the same build just wrote, every one of those checks would read
    as a pass however it was written. So each test copies f1.db, plants ONE
    thing a check must refuse, runs verify.py on that section as a separate
    process, and asserts it exits 1 and names the check. The first test runs
    the untouched copy, so a section that refused everything could not pass
    either.

    python3 -m unittest tests.test_practice_rule
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


def run_section(db):
    proc = subprocess.run(
        [sys.executable, VERIFY, "--only", "practice_and_sprint_qualifying",
         "--quiet", "--db", db],
        cwd=ROOT, capture_output=True, text=True, timeout=120, check=False)
    return proc.returncode, proc.stdout + proc.stderr


class TheSectionRefuses(unittest.TestCase):
    def setUp(self):
        if not os.path.exists(SOURCE_DB):
            self.skipTest("f1.db has not been built")
        self.tmp = tempfile.mkdtemp(prefix="lapledger-practice-")
        self.db = os.path.join(self.tmp, "f1.db")
        shutil.copyfile(SOURCE_DB, self.db)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def edit(self, sql, *args):
        con = sqlite3.connect(self.db)
        con.execute(sql, args)
        con.commit()
        con.close()

    def refused(self, name):
        code, out = run_section(self.db)
        self.assertEqual(code, 1, out)
        self.assertIn(name, out)

    def test_the_database_as_built_passes(self):
        code, out = run_section(self.db)
        self.assertEqual(code, 0, out)

    def test_a_row_from_another_source_is_refused(self):
        self.edit("UPDATE practice SET source = 'fastf1' WHERE id = "
                  "(SELECT MIN(id) FROM practice)")
        self.refused("every practice row cites F1DB")

    def test_a_gap_in_a_session_is_refused(self):
        # The winner of one session taken off the sheet: the places now run
        # from 2, which is a driver the build skipped.
        self.edit("""DELETE FROM practice WHERE id = (SELECT MIN(id) FROM practice
                     WHERE position = 1)""")
        self.refused("every practice session's places run from 1 with no gap or repeat")

    def test_sprint_qualifying_on_a_grand_prix_only_weekend_is_refused(self):
        self.edit("""UPDATE races SET sprint = 0 WHERE id =
                     (SELECT MIN(race_id) FROM sprint_qualifying)""")
        self.refused("sprint qualifying is held only on a sprint weekend")

    def test_a_session_the_timetable_does_not_hold_is_refused(self):
        # Baku 2026 is a conventional weekend with a timetable: an FP4 there
        # is a session nobody ran.
        self.edit("""UPDATE practice SET session = 'fp4' WHERE id = (SELECT MIN(p.id)
                     FROM practice p WHERE EXISTS (SELECT 1 FROM sessions s
                     WHERE s.race_id = p.race_id))""")
        self.refused("every practice session on a timetabled weekend is on its timetable")

    def test_a_flag_on_a_driver_who_raced_is_refused(self):
        self.edit("UPDATE drivers SET practice_only = 1 WHERE id = "
                  "(SELECT driver_id FROM race_entries LIMIT 1)")
        self.refused("practice_only is exactly the drivers with a practice session and no race")

    def test_a_practice_only_driver_without_the_flag_is_refused(self):
        self.edit("UPDATE drivers SET practice_only = 0 WHERE id = 'colton-herta'")
        self.refused("practice_only is exactly the drivers with a practice session and no race")

    def test_a_practice_only_driver_held_active_is_refused(self):
        self.edit("UPDATE drivers SET status = 'active' WHERE id = 'colton-herta'")
        self.refused("no practice-only driver is held active")


if __name__ == "__main__":
    unittest.main()
