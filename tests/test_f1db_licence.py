"""
The fetch tool refuses an F1DB checkout whose licence is not CC BY 4.0.

The four cross-checks the build applies to an F1DB load test facts, not
terms: a relicensed release with the same results would pass all of them.
This is the only place a change of licence is seen before the refresh
workflow commits and deploys it, so the test is of the refusal (PM-27).
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import f1db_fetch as F  # noqa: E402

CC_BY = """Attribution 4.0 International

=======================================================================

Creative Commons Attribution 4.0 International Public License

By exercising the Licensed Rights (defined below), You accept and agree
"""


class LicenceCheck(unittest.TestCase):
    def _tree(self, name=None, text=None):
        d = tempfile.mkdtemp()
        if name:
            with open(os.path.join(d, name), "w", encoding="utf-8") as f:
                f.write(text)
        return d

    def test_the_deed_f1db_ships_passes(self):
        self.assertEqual(F.licence_check(self._tree("LICENSE", CC_BY)), "LICENSE")

    def test_any_of_the_usual_file_names_is_read(self):
        self.assertEqual(F.licence_check(self._tree("LICENSE.md", CC_BY)), "LICENSE.md")

    def test_no_licence_file_refuses(self):
        with self.assertRaises(SystemExit) as cm:
            F.licence_check(self._tree())
        self.assertIn("no licence file", str(cm.exception))

    def test_a_different_deed_refuses(self):
        nc = CC_BY.replace("Attribution 4.0 International", "Attribution-NonCommercial 4.0 International")
        with self.assertRaises(SystemExit) as cm:
            F.licence_check(self._tree("LICENSE", nc))
        self.assertIn("licence has changed", str(cm.exception))

    def test_an_element_hidden_in_the_body_refuses(self):
        # Right title, wrong body: the deed has been edited or is not the one
        # its first line claims.
        sa = CC_BY + "\nShareAlike. If You Share Adapted Material You produce...\n"
        with self.assertRaises(SystemExit) as cm:
            F.licence_check(self._tree("LICENSE", sa))
        self.assertIn("ShareAlike", str(cm.exception))

    def test_the_header_states_the_licence_the_check_requires(self):
        self.assertIn("CC BY 4.0", F.HEADER)
        self.assertEqual(F.LICENCE, "Attribution 4.0 International")


if __name__ == "__main__":
    unittest.main()
