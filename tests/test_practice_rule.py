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

    def test_a_repeated_place_is_refused(self):
        # Every row loaded, so no warning explains it: two drivers on one
        # place is the sheet itself wrong.
        self.edit("""UPDATE practice SET position = 2 WHERE id = (SELECT MIN(id)
                     FROM practice WHERE position = 3)""")
        self.refused("no practice session puts two drivers on one place")

    def test_sprint_qualifying_on_a_grand_prix_only_weekend_is_refused(self):
        self.edit("""UPDATE races SET sprint = 0 WHERE id =
                     (SELECT MIN(race_id) FROM sprint_qualifying)""")
        self.refused("sprint qualifying is held only on a sprint weekend")

    def test_a_session_the_timetable_does_not_hold_is_refused(self):
        # A 2026 weekend has a timetable, and none of them ran an FP4: one
        # there is a session nobody ran.
        self.edit("""UPDATE practice SET session = 'fp4' WHERE id = (SELECT MIN(p.id)
                     FROM practice p WHERE EXISTS (SELECT 1 FROM sessions s
                     WHERE s.race_id = p.race_id))""")
        self.refused("every practice session on a timetabled weekend is on its timetable")

    def test_a_time_on_the_wrong_driver_is_refused(self):
        # The winner of a session given a lap slower than everyone's: the
        # shape still holds, the order does not.
        self.edit("""UPDATE practice SET time = '9:59.999' WHERE id = (SELECT MIN(id)
                     FROM practice WHERE position = 1 AND time IS NOT NULL)""")
        self.refused("within every practice session a later place is never quicker")

    def test_a_gap_that_is_not_the_lap_minus_the_leaders_is_refused(self):
        self.edit("""UPDATE practice SET gap = '+9.999' WHERE id = (SELECT MIN(id)
                     FROM practice WHERE position = 2 AND gap LIKE '+%')""")
        self.refused("every practice gap is the lap minus the leader's")

    def test_a_team_the_race_does_not_give_the_driver_is_refused(self):
        self.edit("""UPDATE practice SET constructor_id = 'minardi' WHERE id = (SELECT MIN(p.id)
                     FROM practice p JOIN race_entries e ON e.race_id = p.race_id
                     AND e.driver_id = p.driver_id WHERE e.constructor_id != 'minardi')""")
        self.refused("every practice driver's team is their team in that weekend's race")

    def test_a_friday_driver_not_yet_listed_warns_and_does_not_fail(self):
        # The refresh case: a rookie runs FP1 before anyone has added their
        # line, so the build skips their row and leaves a hole in the places.
        # That holds up nothing - the section passes, and names the session.
        self.edit("""DELETE FROM practice WHERE id = (SELECT MAX(p.id) FROM practice p
                     WHERE p.position = 10)""")
        code, out = run_section(self.db)
        self.assertEqual(code, 0, out)
        self.assertIn("[WARN] every practice row in the harvest is loaded", out)

    def test_an_interval_that_is_not_the_lap_minus_the_car_aheads_is_refused(self):
        self.edit("""UPDATE practice SET interval = '+9.999' WHERE id = (SELECT MIN(id)
                     FROM practice WHERE position = 3 AND interval LIKE '+%')""")
        self.refused("every practice interval is the lap minus the car ahead's")

    def test_a_short_session_still_refuses_a_repeated_place(self):
        # The warning excuses the hole a skipped driver leaves, and nothing
        # else: two drivers on one place in the same session still fails.
        self.edit("""DELETE FROM practice WHERE id = (SELECT MAX(id) FROM practice
                     WHERE position = 10)""")
        self.edit("""UPDATE practice SET position = 2 WHERE id = (SELECT MAX(id)
                     FROM practice WHERE position = 3)""")
        self.refused("no practice session puts two drivers on one place")

    def test_a_friday_drivers_team_that_was_not_entered_is_refused(self):
        # Brawn, which entered one season, 2009: the first Friday driver's
        # row is Bas Leinders for Minardi in 2004, whose real team would pass.
        self.edit("""UPDATE practice SET constructor_id = 'brawn' WHERE id = (SELECT MIN(p.id)
                     FROM practice p JOIN drivers d ON d.id = p.driver_id
                     JOIN races r ON r.id = p.race_id
                     WHERE d.practice_only = 1 AND r.year != 2009)""")
        self.refused("every practice team was entered for that weekend")

    def test_a_weekend_caught_on_friday_is_not_held_to_a_list_that_does_not_exist(self):
        # The refresh after FP1 and before qualifying: practice is loaded,
        # and nobody is yet entered in anything, so there is no team list to
        # hold the sheet to.
        self.edit("""DELETE FROM race_entries WHERE race_id = (SELECT id FROM races
                     WHERE year = 2026 AND round = 15)""")
        self.edit("""DELETE FROM qualifying WHERE race_id = (SELECT id FROM races
                     WHERE year = 2026 AND round = 15)""")
        code, out = run_section(self.db)
        self.assertNotIn("[FAIL] every practice team was entered for that weekend", out)

    def test_a_sprint_qualifying_time_on_the_wrong_driver_is_refused(self):
        self.edit("""UPDATE sprint_qualifying SET q3 = '9:59.999' WHERE id = (SELECT MIN(id)
                     FROM sprint_qualifying WHERE position = 1)""")
        self.refused("within SQ3 a later place is never quicker")

    def test_a_reordered_sprint_qualifying_sheet_is_refused(self):
        # P1 and P15 exchanged: an SQ2-only driver now heads the sheet.
        self.edit("""UPDATE sprint_qualifying SET position = CASE position WHEN 1 THEN 15 ELSE 1 END
                     WHERE race_id = (SELECT MIN(race_id) FROM sprint_qualifying)
                       AND position IN (1, 15)""")
        self.refused("every sprint qualifying sheet is knockout-shaped, SQ3 first")

    def test_a_reordered_sq2_band_is_refused(self):
        # P11 and P12 exchanged: both knocked out in SQ2, so the shape holds
        # and only the order within the band says the sheet is wrong.
        self.edit("""UPDATE sprint_qualifying SET position = CASE position WHEN 11 THEN 12 ELSE 11 END
                     WHERE race_id = (SELECT id FROM races WHERE year = 2026 AND round = 12)
                       AND position IN (11, 12)""")
        self.refused("within the SQ2 and SQ1 bands a later place is never quicker")

    def test_an_sq3_interval_that_is_not_the_lap_minus_the_car_aheads_is_refused(self):
        self.edit("""UPDATE sprint_qualifying SET interval = '+9.999' WHERE id = (SELECT MIN(id)
                     FROM sprint_qualifying WHERE position = 3)""")
        self.refused("every SQ3 interval is the lap minus the car ahead's")

    def test_a_team_with_a_car_too_many_is_refused(self):
        # A 2020 driver moved onto another team's sheet in one session: that
        # team now runs three cars on two race entries.
        self.edit("""UPDATE practice SET constructor_id = (SELECT e.constructor_id FROM race_entries e
                       WHERE e.race_id = practice.race_id AND e.constructor_id != practice.constructor_id LIMIT 1)
                     WHERE id = (SELECT MIN(p.id) FROM practice p JOIN races r ON r.id = p.race_id
                                 WHERE r.year = 2020)""")
        self.refused("no team ran more cars in a practice session than it entered")

    def test_two_drivers_on_one_number_is_refused(self):
        self.edit("""UPDATE practice SET driver_number = (SELECT q.driver_number FROM practice q
                       WHERE q.race_id = practice.race_id AND q.session = practice.session
                         AND q.position = 1)
                     WHERE id = (SELECT MIN(p.id) FROM practice p JOIN races r ON r.id = p.race_id
                                 WHERE r.year = 2020 AND p.position = 2)""")
        self.refused("no two drivers carry one number in a practice session")

    def test_a_number_the_qualifying_sheet_does_not_give_is_refused(self):
        self.edit("""UPDATE practice SET driver_number = 99 WHERE id = (SELECT MIN(p.id)
                     FROM practice p JOIN races r ON r.id = p.race_id WHERE r.year = 2019)""")
        self.refused("a driver's practice number is their qualifying number that weekend")

    def test_a_timed_row_with_no_laps_is_refused(self):
        self.edit("""UPDATE practice SET laps = 0 WHERE id = (SELECT MIN(p.id) FROM practice p
                     JOIN races r ON r.id = p.race_id WHERE r.year = 2019 AND p.time IS NOT NULL)""")
        self.refused("every timed practice row from 1994 ran at least one lap")

    def test_an_sq3_driver_slower_in_sq2_than_an_eliminee_is_refused(self):
        # The SQ3 pole-sitter's SQ2 lap made the slowest of the sheet: the
        # bands and SQ3 still read true, only the cut does not.
        self.edit("""UPDATE sprint_qualifying SET q2 = '9:59.999' WHERE id = (SELECT q.id
                     FROM sprint_qualifying q JOIN races r ON r.id = q.race_id
                     WHERE r.year = 2026 AND r.round = 12 AND q.position = 1)""")
        self.refused("every SQ3 driver's SQ2 lap beats every SQ2 eliminee's")

    def test_the_spa_2023_exception_still_holds_albon(self):
        # Only Alonso is excepted there, so the three above him are held.
        self.edit("""UPDATE sprint_qualifying SET q1 = '9:59.999' WHERE id = (SELECT q.id
                     FROM sprint_qualifying q JOIN races r ON r.id = q.race_id
                     WHERE r.year = 2023 AND r.round = 12 AND q.driver_id = 'albon')""")
        self.refused("within the SQ2 and SQ1 bands a later place is never quicker")

    def test_a_declared_cut_excepts_its_driver_and_not_the_sheet(self):
        # Qatar 2023 is declared for Alonso alone: a driver who went through
        # given an SQ2 lap slower than the next eliminee is still refused.
        self.edit("""UPDATE sprint_qualifying SET q2 = '9:59.999' WHERE id = (SELECT q.id
                     FROM sprint_qualifying q JOIN races r ON r.id = q.race_id
                     WHERE r.year = 2023 AND r.round = 17 AND q.position = 1)""")
        self.refused("every SQ3 driver's SQ2 lap beats every SQ2 eliminee's")

    def test_a_declared_number_excepts_its_session_and_not_the_weekend(self):
        # Glock's Friday number is declared; his Saturday number is not.
        self.edit("""UPDATE practice SET driver_number = 99 WHERE driver_id = 'glock'
                     AND session = 'fp3' AND race_id = (SELECT id FROM races
                     WHERE year = 2004 AND round = 8)""")
        self.refused("a driver's practice number is their qualifying number that weekend")

    def test_the_third_car_allowance_is_friday_only(self):
        # A third car on a 2005 Saturday sheet: the allowance is FP1 and FP2.
        self.edit("""UPDATE practice SET constructor_id = (SELECT e.constructor_id FROM race_entries e
                       WHERE e.race_id = practice.race_id AND e.constructor_id != practice.constructor_id LIMIT 1)
                     WHERE id = (SELECT MIN(p.id) FROM practice p JOIN races r ON r.id = p.race_id
                                 WHERE r.year = 2005 AND p.session = 'fp3')""")
        self.refused("no team ran more cars in a practice session than it entered")

    def test_a_declared_hole_excepts_its_place_and_not_the_sheet(self):
        # The 1984 Portuguese warm-up is declared for its missing P18 alone:
        # a second hole on the same sheet is refused.
        self.edit("""UPDATE practice SET position = 28, position_text = '28' WHERE id = (SELECT p.id
                     FROM practice p JOIN races r ON r.id = p.race_id
                     WHERE r.year = 1984 AND r.round = 16 AND p.session = 'warm_up' AND p.position = 27)""")
        self.refused("every practice session's places run from 1 with no gap")

    def test_a_pre_qualifying_sheet_with_its_drivers_swapped_is_refused(self):
        # Blundell went through at Monza 1991 and Chaves did not; swapping
        # who holds P1 and P8 keeps every lap in order and puts a driver with
        # no qualifying row above one who went through.
        # Through a placeholder id, since the sheet is UNIQUE on the driver.
        where = ("session = 'pre_qualifying' AND race_id = "
                 "(SELECT id FROM races WHERE year = 1991 AND round = 10)")
        self.edit(f"UPDATE practice SET driver_id = 'swap' WHERE driver_id = 'blundell' AND {where}")
        self.edit(f"UPDATE practice SET driver_id = 'blundell' WHERE driver_id = 'pedro-chaves' AND {where}")
        self.edit(f"UPDATE practice SET driver_id = 'pedro-chaves' WHERE driver_id = 'swap' AND {where}")
        self.refused("in pre-qualifying, nobody who failed it sits above a driver who went through")

    def test_a_non_qualifier_on_a_warm_up_sheet_is_refused(self):
        # A driver who did not qualify, put on that race's warm-up sheet.
        self.edit("""UPDATE practice SET driver_id = (SELECT e.driver_id FROM race_entries e
                       WHERE e.race_id = practice.race_id AND e.position_text = 'DNQ' LIMIT 1)
                     WHERE id = (SELECT MIN(p.id) FROM practice p WHERE p.session = 'warm_up'
                       AND EXISTS (SELECT 1 FROM race_entries e WHERE e.race_id = p.race_id
                                   AND e.position_text = 'DNQ'))""")
        self.refused("everyone on a warm-up sheet qualified for that race")

    def test_a_place_below_one_is_refused(self):
        self.edit("""UPDATE practice SET position = 0, position_text = '0' WHERE id = (SELECT MAX(p.id)
                     FROM practice p JOIN races r ON r.id = p.race_id WHERE r.year = 2020)""")
        self.refused("every practice session's places run from 1 with no gap")

    def test_a_flag_on_a_driver_who_raced_is_refused(self):
        self.edit("UPDATE drivers SET practice_only = 1 WHERE id = "
                  "(SELECT driver_id FROM race_entries LIMIT 1)")
        self.refused("practice_only is exactly the drivers with a practice session, no race entry and no qualifying row")

    def test_a_practice_only_driver_without_the_flag_is_refused(self):
        self.edit("UPDATE drivers SET practice_only = 0 WHERE id = 'colton-herta'")
        self.refused("practice_only is exactly the drivers with a practice session, no race entry and no qualifying row")

    def test_a_practice_only_driver_held_active_is_refused(self):
        self.edit("UPDATE drivers SET status = 'active' WHERE id = 'colton-herta'")
        self.refused("no practice-only driver is held active")


if __name__ == "__main__":
    unittest.main()
