"""export_json.py reads its arguments before it opens or writes anything.

WHY THIS FILE EXISTS
    `python3 export_json.py --help` once ignored the flag and ran the whole
    export, writing f1_database.json - some 25 MB, gitignored - into the
    checkout of whoever asked for the usage text (CR-107). The script is run
    here from a copy in an empty directory, with no f1.db beside it: had it
    got as far as sqlite3.connect, that call would have created an empty f1.db
    there, so "nothing was written" is checked on the directory itself.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class ArgumentsComeFirst(unittest.TestCase):
    def run_copy(self, *args):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copy(os.path.join(ROOT, "export_json.py"), tmp)
            done = subprocess.run([sys.executable, os.path.join(tmp, "export_json.py"), *args],
                                  capture_output=True, text=True, check=False)
            return done, sorted(os.listdir(tmp))

    def test_help_prints_the_usage_and_writes_nothing(self):
        done, left = self.run_copy("--help")
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("usage: export_json.py", done.stdout)
        self.assertIn("--compat", done.stdout)
        self.assertEqual(left, ["export_json.py"])

    def test_an_argument_it_does_not_take_is_refused_before_any_write(self):
        done, left = self.run_copy("--compact")
        self.assertEqual(done.returncode, 2)
        self.assertIn("unrecognized arguments: --compact", done.stderr)
        self.assertEqual(left, ["export_json.py"])


if __name__ == "__main__":
    unittest.main()
