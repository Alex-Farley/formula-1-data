"""When tools/release_due.py says a release is due, and when it stays quiet.

WHY THIS FILE EXISTS
    At v2.26 the published database fell three races, four tables and a
    month behind main while both said version 2.26 (AF-183). The check
    compares the two databases on four criteria, and each fails quietly in
    one of two directions: a criterion that never fires is the silence it
    was written to end, and one that fires on a rebuild that changed nothing
    - a surrogate id renumbered, the build date moved - keeps an issue open
    that nobody can close by releasing.

WHY DATABASES OF THEIR OWN
    The real f1.db moves with every refresh, so a test that read it for
    "nothing has changed" would fail the first refresh that changed
    something, and refresh.yml runs this suite as a gate. The criteria are
    tested on a few tables written here, and the git plumbing - three
    subprocess calls - is not exercised; compare() and criteria() are the
    whole judgement, and neither reads the clock.

    python3 -m unittest tests.test_release_due
"""
import contextlib
import io
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools import release_due  # noqa: E402

SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE source_registry (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE races (id INTEGER PRIMARY KEY, year INTEGER, round INTEGER);
CREATE TABLE race_entries (
    id INTEGER PRIMARY KEY,
    race_id INTEGER REFERENCES races(id),
    driver_id TEXT,
    finish_position INTEGER,
    source_id INTEGER REFERENCES source_registry(id));
CREATE TABLE standings (id INTEGER PRIMARY KEY, year INTEGER, driver_id TEXT, points REAL);
CREATE TABLE glossary (term TEXT PRIMARY KEY, definition TEXT);
"""

META = [("id_stability_stable", "races, race_entries"), ("version", "2.26"),
        ("built", "2030-03-10"), ("verification_date", "2030-03-10"),
        ("current_season", "2030")]
SOURCES = [(1, "F1DB"), (2, "Wikipedia")]
RACES = [(1, 2030, 1), (2, 2030, 2), (3, 2030, 3)]
ENTRIES = [(1, 1, "alpha", 1, 1), (2, 1, "beta", 2, 1), (3, 2, "alpha", 2, 1), (4, 2, "beta", 1, 2)]
STANDINGS = [(1, 2030, "alpha", 43.0), (2, 2030, "beta", 43.0)]
GLOSSARY = [("pole", "First on the grid.")]
# Six tables in SCHEMA, all shared by the two copies unless a test adds one.
SHARED = 6


class Fixture(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.old = self.write("old.db")

    def write(self, name, schema="", meta=META, sources=SOURCES, races=RACES,
              entries=ENTRIES, standings=STANDINGS, glossary=GLOSSARY):
        path = os.path.join(self.dir.name, name)
        con = sqlite3.connect(path)
        con.executescript(SCHEMA + schema)
        con.executemany("INSERT INTO meta (key, value) VALUES (?, ?)", meta)
        con.executemany("INSERT INTO source_registry (id, name) VALUES (?, ?)", sources)
        con.executemany("INSERT INTO races (id, year, round) VALUES (?, ?, ?)", races)
        con.executemany("INSERT INTO race_entries (id, race_id, driver_id, finish_position, "
                        "source_id) VALUES (?, ?, ?, ?, ?)", entries)
        con.executemany("INSERT INTO standings (id, year, driver_id, points) VALUES (?, ?, ?, ?)", standings)
        con.executemany("INSERT INTO glossary (term, definition) VALUES (?, ?)", glossary)
        con.commit()
        con.close()
        return path

    def judge(self, age=1, **new):
        diff = release_due.compare(self.old, self.write("new.db", **new))
        found = release_due.criteria(diff, age)
        self.assertEqual([name for name, _, _ in found], list(release_due.CRITERIA))
        return diff, {name: (fired, what) for name, fired, what in found}

    def fired(self, found):
        return sorted(name for name, (hit, _) in found.items() if hit)


class NothingChanged(Fixture):
    def test_the_same_database_fires_nothing_however_old(self):
        diff, found = self.judge(age=400)
        self.assertEqual(self.fired(found), [])
        self.assertEqual(diff["changed"], [])
        self.assertEqual(diff["shared"], SHARED)

    def test_a_dated_build_and_a_bumped_version_are_not_a_change(self):
        # BUILT is moved by the refresh ([D-01]) and VERSION by a release;
        # neither is the data moving.
        meta = [(k, {"version": "2.27", "built": "2030-04-01",
                     "verification_date": "2030-04-01"}.get(k, v)) for k, v in META]
        diff, found = self.judge(age=400, meta=meta)
        self.assertEqual(self.fired(found), [])
        self.assertEqual(diff["changed"], [])

    def test_any_other_meta_row_is(self):
        meta = [(k, "2031" if k == "current_season" else v) for k, v in META]
        diff, found = self.judge(age=29, meta=meta)
        self.assertEqual(diff["changed"], ["meta"])
        self.assertEqual(self.fired(found), ["age"])


class NewResults(Fixture):
    def test_a_race_with_results_fires_it(self):
        entries = ENTRIES + [(5, 3, "alpha", 1, 1), (6, 3, "beta", 2, 1)]
        diff, found = self.judge(entries=entries)
        self.assertEqual(diff["results"], (2, 3))
        self.assertEqual(self.fired(found), ["new results"])
        self.assertIn("3 races with results, 2 in the release (+1)", found["new results"][1])

    def test_more_entries_in_a_race_already_resulted_do_not(self):
        diff, found = self.judge(entries=ENTRIES + [(5, 2, "gamma", 3, 1)])
        self.assertEqual(diff["results"], (2, 2))
        self.assertFalse(found["new results"][0])


class Schema(Fixture):
    def test_a_new_table_fires_it_and_is_named(self):
        _, found = self.judge(schema="CREATE TABLE tie_breaks (key TEXT PRIMARY KEY);")
        self.assertEqual(self.fired(found), ["schema"])
        self.assertIn("+1 table (tie_breaks)", found["schema"][1])

    def test_a_removed_table_fires_it(self):
        self.old = self.write("older.db", schema="CREATE TABLE eras (id TEXT PRIMARY KEY);")
        _, found = self.judge()
        self.assertEqual(self.fired(found), ["schema"])
        self.assertIn("-1 table (eras)", found["schema"][1])

    def test_a_new_column_fires_it_and_is_named(self):
        _, found = self.judge(schema="ALTER TABLE race_entries ADD COLUMN note TEXT;")
        self.assertEqual(self.fired(found), ["schema"])
        self.assertIn("+1 column (race_entries.note)", found["schema"][1])

    def test_a_removed_column_fires_it(self):
        self.old = self.write("older.db", schema="ALTER TABLE glossary ADD COLUMN seen TEXT;")
        _, found = self.judge()
        self.assertEqual(self.fired(found), ["schema"])
        self.assertIn("-1 column (glossary.seen)", found["schema"][1])

    def test_a_table_whose_shape_moved_is_still_compared_on_what_it_shares(self):
        entries = [e if e[0] != 3 else (3, 2, "alpha", 3, 1) for e in ENTRIES]
        _, found = self.judge(schema="ALTER TABLE race_entries ADD COLUMN note TEXT;",
                              entries=entries)
        self.assertEqual(self.fired(found), ["corrections", "schema"])


class Corrections(Fixture):
    def test_a_changed_result_fires_it(self):
        entries = [e if e[0] != 3 else (3, 2, "alpha", 3, 1) for e in ENTRIES]
        diff, found = self.judge(entries=entries)
        self.assertEqual(diff["corrections"], {"race_entries": 1})
        self.assertEqual(self.fired(found), ["corrections"])
        self.assertIn("race_entries 1", found["corrections"][1])

    def test_a_removed_row_fires_it(self):
        diff, found = self.judge(standings=STANDINGS[:1])
        self.assertEqual(diff["corrections"], {"standings": 1})
        self.assertEqual(self.fired(found), ["corrections"])

    def test_new_rows_alone_do_not(self):
        diff, found = self.judge(standings=STANDINGS + [(3, 2030, "gamma", 1.0)])
        self.assertEqual(diff["corrections"], {})
        self.assertEqual(diff["changed"], ["standings"])
        self.assertEqual(self.fired(found), [])

    def test_a_renumbered_surrogate_id_is_not_a_correction(self):
        # standings is not in meta.id_stability_stable: a row inserted first
        # renumbers every row after it, and none of them has changed.
        renumbered = [(1, 2030, "gamma", 1.0)] + [(i + 1, *rest) for i, *rest in STANDINGS]
        diff, _ = self.judge(standings=renumbered)
        self.assertEqual(diff["corrections"], {})
        self.assertEqual(diff["changed"], ["standings"])

    def test_a_stable_id_renumbered_is(self):
        # race_entries is in the list: its ids are an undertaking, and moving
        # one is a change a consumer joining on it would see.
        entries = [(10 + i, *rest) for i, *rest in ENTRIES]
        diff, _ = self.judge(entries=entries)
        self.assertEqual(diff["corrections"], {"race_entries": len(ENTRIES)})

    def test_a_reference_to_a_renumbered_surrogate_is_not_a_correction(self):
        # A source inserted ahead of the others moves every source_id that
        # points past it; the rows still cite the same source.
        sources = [(1, "FIA")] + [(i + 1, name) for i, name in SOURCES]
        entries = [(i, r, d, p, s + 1) for i, r, d, p, s in ENTRIES]
        diff, _ = self.judge(sources=sources, entries=entries)
        self.assertEqual(diff["corrections"], {})
        self.assertEqual(diff["changed"], ["source_registry"])

    def test_a_table_outside_core_is_never_a_correction(self):
        diff, found = self.judge(glossary=[("pole", "Fastest in qualifying.")])
        self.assertEqual(diff["changed"], ["glossary"])
        self.assertEqual(diff["corrections"], {})
        self.assertEqual(self.fired(found), [])


class Age(Fixture):
    GLOSS = [("pole", "Fastest in qualifying.")]

    def test_past_the_limit_with_a_change_fires(self):
        _, found = self.judge(age=release_due.MAX_AGE_DAYS + 1, glossary=self.GLOSS)
        self.assertEqual(self.fired(found), ["age"])
        self.assertIn(f"1 of {SHARED} shared tables changed", found["age"][1])

    def test_at_the_limit_it_does_not(self):
        _, found = self.judge(age=release_due.MAX_AGE_DAYS, glossary=self.GLOSS)
        self.assertEqual(self.fired(found), [])

    def test_a_schema_change_alone_counts_as_a_change(self):
        _, found = self.judge(age=release_due.MAX_AGE_DAYS + 1,
                              schema="CREATE TABLE tie_breaks (key TEXT PRIMARY KEY);")
        self.assertEqual(self.fired(found), ["age", "schema"])

    def test_an_unreadable_age_is_quiet_and_says_so(self):
        _, found = self.judge(age=None, glossary=self.GLOSS)
        self.assertEqual(found["age"], (False, "the release's age could not be read; "
                                               f"1 of {SHARED} shared tables changed"))


class TheVersionToBumpTo(unittest.TestCase):
    def test_the_next_one_after_the_tag(self):
        self.assertEqual(release_due.next_version("2.26", "v2.26"), "2.27")
        self.assertEqual(release_due.next_version("2.9", "v2.9"), "2.10")

    def test_a_version_already_bumped_is_the_one_to_tag(self):
        self.assertEqual(release_due.next_version("2.27", "v2.26"), "2.27")
        advice = release_due.advice("2.27", "v2.26")
        self.assertIn("VERSION is already 2.27 and the last tag is v2.26", advice)
        self.assertIn("git tag v2.27", advice)

    def test_the_advice_names_it(self):
        self.assertIn("bump VERSION in build.py to 2.27", release_due.advice("2.26", "v2.26"))

    def test_version_is_read_from_build_py(self):
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            f.write('X = 1\nVERSION = "3.04"\nBUILT = "2030-01-01"\n')
        self.addCleanup(os.unlink, f.name)
        self.assertEqual(release_due.version_in(f.name), "3.04")

    def test_and_from_the_real_one(self):
        # The workflow reads it this way, with nothing build.py imports
        # checked out; a reformat of the line would otherwise read as None.
        self.assertIsNotNone(release_due.version_in(os.path.join(release_due.ROOT, "build.py")))


class TheExitStatus(unittest.TestCase):
    def run_main(self, found):
        with mock.patch.object(release_due, "check", return_value=("2.26", "v2.26", found)), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            status = release_due.main([])
        return status, out.getvalue()

    def test_due_is_one(self):
        status, out = self.run_main([("new results", True, "x"), ("age", False, "y")])
        self.assertEqual(status, 1)
        self.assertIn("new results  fires: x", out)
        self.assertIn("age          quiet: y", out)
        self.assertIn("release due: bump VERSION in build.py to 2.27", out)

    def test_not_due_is_zero(self):
        status, out = self.run_main([("new results", False, "x")])
        self.assertEqual(status, 0)
        self.assertIn("release: not due", out)

    def test_nothing_to_compare_against_is_two(self):
        status, out = self.run_main("no v* tag in this checkout")
        self.assertEqual(status, 2)
        self.assertIn("no v* tag", out)


if __name__ == "__main__":
    unittest.main()
