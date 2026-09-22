"""The figure gate on the database's own prose, shown refusing what it exists
to refuse.

WHY THIS FILE EXISTS
    `source_registry` prose is rendered straight onto /data/sources, and its
    figures were typed: 1,161 races and 27,555 entries against 1,163 and
    27,504 held, stale through several releases because nothing read them
    (CD-38, AF-63). build.py now expands a {{fig:name}} token off the counts
    and verify.py compares the stored prose whole - but a check that runs
    only against a database the same build just wrote would read as a pass
    however it was written. A query against the wrong row, a comparison that
    stopped reading its own result, a scan that looked at no column: each
    would be invisible.

    So each test here copies f1.db, plants ONE thing the gate must refuse,
    runs verify.py as a separate process, and asserts that it exits 1 and
    names the check. The first test runs the untouched copy, so a gate that
    refused everything could not pass either.

    python3 -m unittest tests.test_prose_figures
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
sys.path.insert(0, os.path.join(ROOT, "tools"))
import prose_figures as pf  # noqa: E402 - tools/ has to be on the path first


def run_gate(db):
    proc = subprocess.run(
        [sys.executable, VERIFY, "--only", "prose_figures", "--quiet", "--db", db],
        cwd=ROOT, capture_output=True, text=True, timeout=120, check=False)
    return proc.returncode, proc.stdout + proc.stderr


class TheGateRefuses(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="lapledger-prose-")
        self.db = os.path.join(self.tmp, "f1.db")
        shutil.copyfile(SOURCE_DB, self.db)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def edit(self, sql, *args):
        con = sqlite3.connect(self.db)
        con.execute(sql, args)
        con.commit()
        con.close()

    def test_the_database_as_built_passes(self):
        code, out = run_gate(self.db)
        self.assertEqual(code, 0, out)

    def test_a_stale_figure_in_the_prose_is_refused(self):
        # The defect this exists for: a count that moved and prose that did
        # not. One digit, in one row, in the sentence /data/sources leads with.
        self.edit("UPDATE source_registry SET use = REPLACE(use, ?, ?) WHERE priority = 10",
                  "1,163 races", "1,161 races")
        code, out = run_gate(self.db)
        self.assertEqual(code, 1, out)
        self.assertIn("source_registry.use", out)

    def test_a_token_that_survived_into_a_column_PROSE_does_not_name_is_refused(self):
        # A token in a column nobody declared would render to the reader as
        # itself. The scan reads every text column from PRAGMA for this
        # reason, so plant it somewhere PROSE has never heard of.
        self.edit("UPDATE meta SET value = ? WHERE key = 'database_name'",
                  "{{fig:races_completed}}")
        code, out = run_gate(self.db)
        self.assertEqual(code, 1, out)
        self.assertIn("meta.value", out)

    def test_a_figure_nobody_computes_is_refused_at_expansion(self):
        # Not a database state but a prose state: a token naming a figure
        # FIGURES has not got. It fails at build, before a row is written.
        with self.assertRaises(SystemExit) as caught:
            pf.expand("all {{fig:races_run_backwards}} of them", {"races_completed": "1"},
                      "a test")
        self.assertIn("races_run_backwards", str(caught.exception))


    def test_a_shifted_SOURCE_REGISTRY_tuple_is_refused(self):
        # The accessor reads indices 3/5/6/7. A field inserted into the tuple
        # would shift build.py and verify.py IDENTICALLY - cadence text
        # written into `licence` and compared against cadence text - so the
        # comparison would pass on prose in the wrong column and only the
        # artefact diff would show it. The arity and the one field with a
        # controlled vocabulary are checked where the indices are written.
        from data import current as N
        good = N.SOURCE_REGISTRY
        shifted = [("inserted",) + e for e in good]
        try:
            N.SOURCE_REGISTRY = shifted
            with self.assertRaises(SystemExit) as caught:
                pf._source_registry_literals()
        finally:
            N.SOURCE_REGISTRY = good
        self.assertIn("positional", str(caught.exception))


class TheFiguresAreWhatTheProseUses(unittest.TestCase):
    def test_every_figure_computed_is_stated_in_some_prose(self):
        # A figure computed and named nowhere is a dead expression. verify.py
        # checks this against the built database; here it is checked against
        # the literals in data/*.py, which is where the drift would start.
        con = sqlite3.connect(SOURCE_DB)
        self.assertEqual(pf.unused(con.cursor()), [])

    def test_every_figure_the_prose_names_is_one_the_tool_computes(self):
        named = set()
        for spec in pf.PROSE:
            for columns in spec["literals"]().values():
                for literal in columns.values():
                    named.update(pf.names(literal))
        self.assertEqual(sorted(named - set(pf.FIGURES)), [])


if __name__ == "__main__":
    unittest.main()
