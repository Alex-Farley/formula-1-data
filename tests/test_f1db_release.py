"""
The fetch tool reads F1DB at a release, and stamps the release's tag.

The version in every harvest header is what tools/f1db_totals_fetch.py
fetches the career totals by, and what verify.py holds the totals to (CR-69).
It used to be read off the subject of the last commit on F1DB's default
branch, which named a release only until the next fix was pushed (#830).
These test what replaced it, offline: the tag read from the latest-release
redirect, the refusal to roll back to an older one, and the tag on the commit
checked out.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import f1db_fetch as F  # noqa: E402

TAG_PAGE = "https://github.com/f1db/f1db/releases/tag/"


def git(path, *args):
    subprocess.run(["git", "-C", path, "-c", "user.name=t", "-c", "user.email=t@t",
                    *args], check=True, capture_output=True)


class LatestRelease(unittest.TestCase):
    def test_the_release_page_names_the_tag(self):
        self.assertEqual(F.release_from_url(TAG_PAGE + "v2026.16.0"), "v2026.16.0")

    def test_a_beta_is_not_a_release(self):
        with self.assertRaises(SystemExit):
            F.release_from_url(TAG_PAGE + "v2026.0.0.beta3")

    def test_a_page_that_is_not_a_release_is_refused(self):
        for url in ("https://github.com/f1db/f1db/releases",
                    "https://github.com/f1db/f1db",
                    "https://github.com/other/f1db/releases/tag/v2026.16.0"):
            with self.subTest(url=url), self.assertRaises(SystemExit):
                F.release_from_url(url)


class NeverBackwards(unittest.TestCase):
    def test_an_older_latest_release_is_refused(self):
        with self.assertRaises(SystemExit):
            F.refuse_older("v2026.15.1", "v2026.16.0")

    def test_versions_compare_as_numbers_not_text(self):
        with self.assertRaises(SystemExit):
            F.refuse_older("v2026.9.0", "v2026.10.0")
        F.refuse_older("v2026.10.0", "v2026.9.0")

    def test_the_same_or_a_newer_release_goes_ahead(self):
        F.refuse_older("v2026.16.0", "v2026.16.0")
        F.refuse_older("v2026.16.1", "v2026.16.0")

    def test_a_header_that_names_no_release_is_not_compared(self):
        # A header that names no release gives nothing to roll back from.
        F.refuse_older("v2026.16.0", None)
        F.refuse_older("v2026.16.0", "updated")


class CheckedOutRelease(unittest.TestCase):
    def setUp(self):
        self.path = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.path)
        os.makedirs(os.path.join(self.path, "src", "data"))
        git(self.path, "init", "-q")
        git(self.path, "commit", "-q", "--allow-empty", "-m", "release: v2026.16.0")

    def test_the_tag_on_head_is_the_version(self):
        git(self.path, "tag", "-a", "v2026.16.0", "-m", "v2026.16.0")
        path, version, commit = F.checkout(self.path)
        self.assertEqual(version, "v2026.16.0")
        self.assertTrue(commit)

    def test_a_commit_after_the_release_is_refused(self):
        # The case #830 found: the tip of F1DB's branch three fixes past
        # v2026.16.0, whose subject names no release at all.
        git(self.path, "tag", "v2026.16.0")
        git(self.path, "commit", "-q", "--allow-empty",
            "-m", "fix: updated incorrect per-round standings (#165)")
        with self.assertRaises(SystemExit):
            F.checkout(self.path)

    def test_a_beta_tag_is_not_a_release(self):
        git(self.path, "tag", "v2026.0.0.beta3")
        with self.assertRaises(SystemExit):
            F.release_at(self.path)

    def test_two_releases_on_one_commit_are_refused(self):
        git(self.path, "tag", "v2026.16.0")
        git(self.path, "tag", "v2026.16.1")
        with self.assertRaises(SystemExit):
            F.release_at(self.path)


if __name__ == "__main__":
    unittest.main()
