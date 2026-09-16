"""When tools/release_due.py speaks up, and when it stays out of the way.

WHY THIS FILE EXISTS
    The reminder is only worth having if it fires on the gap that went wrong
    and stays quiet through ordinary work. A reminder that cries every build
    is one nobody reads, and this project already carries seven warnings a
    maintainer is expected to scan - an eighth that is always on would cost
    the other seven their meaning.

    So the cases here are the states the repository actually passes through,
    each asserted on the decision rather than on the wording: freshly tagged,
    a few commits in, bumped and awaiting its tag, a long silent stretch, and
    a season arriving in a short one. The git plumbing is not exercised - it
    is three subprocess calls - but `verdict` is the whole judgement, and it
    is a pure function of five values.

    The 141-commit case is AF-39 as it actually stood, and it is here so the
    threshold can never be raised past the thing it was chosen to catch.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.release_due import REMIND_AFTER, verdict  # noqa: E402

# The database's shape at some tag, and the same thing unchanged.
AT_TAG = {"rows": 119_398, "tables": 48, "views": 41, "seasons": 77}


def same(**moved):
    """AT_TAG with the named figures moved."""
    return {**AT_TAG, **{k: AT_TAG[k] + v for k, v in moved.items()}}


class ReleaseDue(unittest.TestCase):
    def test_just_tagged_is_quiet(self):
        line, due = verdict("2.23", "v2.23", 0, AT_TAG, AT_TAG)
        self.assertFalse(due)
        self.assertIn("0 commit(s) since v2.23", line)
        self.assertIn("database unchanged", line)

    def test_ordinary_work_is_quiet(self):
        # 13 and 45 commits both carried a release in this project's history,
        # so neither is by itself a reason to be told about one.
        for commits in (1, 13, 45, REMIND_AFTER - 1):
            _, due = verdict("2.23", "v2.23", commits, same(rows=+120), AT_TAG)
            self.assertFalse(due, f"{commits} commits should not remind")

    def test_the_gap_that_went_wrong_reminds(self):
        # AF-39: 141 commits, a season and 292 rows, no release.
        line, due = verdict("2.23", "v2.23", 141, same(rows=+292, seasons=+1, tables=+1), AT_TAG)
        self.assertTrue(due)
        self.assertIn("141 commit(s) since v2.23", line)
        self.assertIn("+1 season", line)
        self.assertIn("+292 rows", line)

    def test_length_alone_reminds(self):
        # Three of six past releases carried no new data. Length has to be a
        # way in on its own, or those releases would never have been prompted.
        line, due = verdict("2.23", "v2.23", REMIND_AFTER, AT_TAG, AT_TAG)
        self.assertTrue(due)
        self.assertIn("database unchanged", line)
        self.assertIn(f"{REMIND_AFTER} commits or fewer", line)

    def test_a_season_reminds_however_short_the_gap(self):
        line, due = verdict("2.23", "v2.23", 3, same(seasons=+1), AT_TAG)
        self.assertTrue(due)
        self.assertIn("a season or table has arrived", line)

    def test_a_table_reminds_however_short_the_gap(self):
        _, due = verdict("2.23", "v2.23", 1, same(tables=+1), AT_TAG)
        self.assertTrue(due)

    def test_rows_alone_never_remind(self):
        # A Monday harvest moves rows every week. If that were enough, the
        # reminder would be permanent.
        _, due = verdict("2.23", "v2.23", 2, same(rows=+5_000), AT_TAG)
        self.assertFalse(due)

    def test_bumped_and_untagged_says_so_and_does_not_nag(self):
        line, due = verdict("2.24", "v2.23", 141, same(rows=+292, seasons=+1), AT_TAG)
        self.assertFalse(due, "the bump is the reminder, and it is already done")
        self.assertIn("git tag v2.24", line)

    def test_no_tag_is_not_an_error(self):
        line, due = verdict("2.24", None, None, AT_TAG, None)
        self.assertFalse(due)
        self.assertIn("no v* tag", line)

    def test_a_shallow_clone_still_judges_on_length(self):
        # `then` is None where the tag's blob is not in the checkout. The
        # commit count still answers the question, and must still fire.
        line, due = verdict("2.23", "v2.23", 141, AT_TAG, None)
        self.assertTrue(due)
        self.assertIn("141 commit(s)", line)

    def test_uncountable_commits_are_reported_not_guessed(self):
        line, due = verdict("2.23", "v2.23", None, AT_TAG, AT_TAG)
        self.assertFalse(due)
        self.assertIn("could not count", line)


if __name__ == "__main__":
    unittest.main()
