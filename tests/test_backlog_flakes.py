"""file.py flake: one issue per flaky check, and every rerun of it on that
issue.

WHY THIS FILE EXISTS
    A check failed on #975, a pull request that changed only data, and a
    rerun passed. Nothing recorded it, so the next time it failed nobody
    would know it had failed before (AF-106). A rerun is still allowed, but
    it is written down first, on the one issue that check already has, and
    the third record moves that issue to Now. What is tested here is that a
    repeat finds its issue and not a neighbour's, that the count is right,
    and that the move happens at the third record and not before - all
    without GitHub.
"""
import contextlib
import importlib.util
import io
import json
import os
import unittest
from types import SimpleNamespace
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location(
    "backlog_file_flakes", os.path.join(ROOT, ".claude", "skills", "backlog-loop", "file.py"))
file_py = importlib.util.module_from_spec(spec)
spec.loader.exec_module(file_py)

RUN = "https://github.com/Alex-Farley/formula-1-data/actions/runs/123456/job/789"
OTHER = "https://github.com/Alex-Farley/formula-1-data/actions/runs/200000"
THIRD = "https://github.com/Alex-Farley/formula-1-data/actions/runs/300000/job/1"
CHECK = "and hands focus to the new heading rather than stranding it on <body>"


def issue(number, check, state="OPEN"):
    return {"number": number, "state": state,
            "body": f"{file_py.flake_marker(check)}\n\n{file_py.FLAKED} {RUN} - the first time.\n"}


class FindingTheIssue(unittest.TestCase):
    def test_the_same_check_finds_its_issue(self):
        self.assertEqual(file_py.flake_issue([issue(5, "other"), issue(7, CHECK)], CHECK)["number"], 7)

    def test_a_check_whose_text_starts_another_is_not_that_one(self):
        # "a" is the start of "a b": a substring match would land the
        # shorter check's rerun on the longer one's issue.
        self.assertIsNone(file_py.flake_issue([issue(5, "a b")], "a"))
        self.assertIsNone(file_py.flake_issue([issue(5, "a")], "a b"))

    def test_spacing_in_the_check_is_not_a_different_check(self):
        self.assertEqual(file_py.flake_issue([issue(7, CHECK)], "  " + CHECK.replace(" ", "\n  ", 1))["number"], 7)

    def test_an_open_issue_wins_over_a_closed_one(self):
        found = file_py.flake_issue([issue(3, CHECK, "CLOSED"), issue(9, CHECK)], CHECK)
        self.assertEqual(found["number"], 9)

    def test_a_check_holding_a_backtick_still_reads_as_one_span(self):
        self.assertEqual(file_py.flake_marker("the `--only` flag"), "**Check:** `` the `--only` flag ``")

    def test_nothing_recorded_is_none(self):
        self.assertIsNone(file_py.flake_issue([], CHECK))


class Counting(unittest.TestCase):
    def test_the_body_is_the_first_record_and_each_flaked_comment_one_more(self):
        body = issue(7, CHECK)["body"]
        self.assertEqual(len(file_py.flake_records(body, [])), 1)
        comments = [{"body": f"{file_py.FLAKED} {OTHER} - 2 times now."}, {"body": "a remark about it"},
                    {"body": f"{file_py.FLAKED} {THIRD} - 3 times now."}]
        self.assertEqual(len(file_py.flake_records(body, comments)), 3)


class Recording(unittest.TestCase):
    def run_it(self, issues, comments=(), run=RUN, check=CHECK, prefix="PM", board=None):
        self.calls, self.statuses, self.filed = [], [], []
        board = {7, 1001} if board is None else board

        def gh(*args, as_json=False):
            self.calls.append(args)
            if args[0] == "api":
                # The REST listing, one issue a line, state in lower case.
                return "\n".join(json.dumps({**i, "state": i["state"].lower()}) for i in issues)
            if args[:2] == ("issue", "view"):
                return {"comments": list(comments)}
            return ""

        def new(a):
            self.filed.append(a)
            return 1001

        a = SimpleNamespace(check=check, run=run, prefix=prefix, where=None)
        out = io.StringIO()
        with mock.patch.object(file_py, "gh", gh), \
                mock.patch.object(file_py, "new", new), \
                mock.patch.object(file_py, "item_ids", lambda fresh=False: dict.fromkeys(board, "ID")), \
                mock.patch.object(file_py, "set_status", lambda n, s: self.statuses.append((n, s))), \
                contextlib.redirect_stdout(out):
            file_py.flake(a)
        return out.getvalue()

    def writes(self):
        return [c for c in self.calls if c[:2] in (("issue", "comment"), ("issue", "reopen"))]

    def test_the_listing_is_the_rest_one_and_not_search(self):
        # `gh issue list --label` goes through the search index, which can
        # miss an issue filed minutes ago and so file the same check twice.
        self.run_it([issue(7, CHECK)])
        self.assertEqual(self.calls[0][0], "api")
        self.assertIn("labels=flaky", self.calls[0][2])
        self.assertIn("state=all", self.calls[0][2])

    def test_a_first_flake_files_one_issue_labelled_flaky_under_someday(self):
        said = self.run_it([])
        self.assertEqual(len(self.filed), 1)
        filed = self.filed[0]
        self.assertEqual((filed.prefix, filed.status, filed.labels), ("PM", "Someday", ["flaky"]))
        self.assertIn(file_py.flake_marker(CHECK), filed.body.splitlines())
        self.assertIn(RUN, filed.body)
        self.assertEqual(self.writes(), [])
        self.assertEqual(self.statuses, [])
        self.assertIn("#1001 flaked 1 time", said)

    def test_the_fail_word_in_front_of_a_check_is_not_part_of_it(self):
        self.run_it([issue(7, CHECK)], check="FAIL  " + CHECK, run=OTHER)
        self.assertEqual(self.filed, [])
        self.assertEqual(self.writes()[0][:3], ("issue", "comment", "7"))

    def test_a_second_flake_comments_on_the_same_issue_and_moves_nothing(self):
        said = self.run_it([issue(7, CHECK)], run=OTHER)
        self.assertEqual(self.filed, [])
        (write,) = self.writes()
        self.assertEqual(write[:3], ("issue", "comment", "7"))
        self.assertTrue(write[-1].startswith(f"{file_py.FLAKED} {OTHER} - 2 times now."))
        self.assertEqual(self.statuses, [])
        self.assertIn("#7 flaked 2 times", said)

    def test_the_third_moves_it_to_now(self):
        self.run_it([issue(7, CHECK)], comments=[{"body": f"{file_py.FLAKED} {OTHER} - 2 times now."}],
                    run=THIRD)
        self.assertIn("3 times now", self.writes()[0][-1])
        self.assertEqual(self.statuses, [(7, "Now")])

    def test_the_same_run_recorded_again_writes_no_second_record(self):
        # A fork restarted between the record and the rerun meets the same
        # failed run again. The job's address, an attempt's, or the run's own
        # with ?pr= are all the same run.
        for again in (RUN, "https://github.com/Alex-Farley/formula-1-data/actions/runs/123456?pr=975",
                      "https://github.com/Alex-Farley/formula-1-data/actions/runs/123456/attempts/1"):
            said = self.run_it([issue(7, CHECK)], run=again)
            self.assertEqual((self.writes(), self.filed, self.statuses), ([], [], []), again)
            self.assertIn("#7 flaked 1 times, this run already recorded", said)

    def test_a_run_whose_id_starts_another_is_a_new_record(self):
        self.run_it([issue(7, CHECK)], run="https://github.com/Alex-Farley/formula-1-data/actions/runs/12345")
        self.assertEqual(len(self.writes()), 1)

    def test_a_third_record_whose_status_write_was_refused_is_finished_on_the_next_call(self):
        comments = [{"body": f"{file_py.FLAKED} {OTHER} - 2 times now."},
                    {"body": f"{file_py.FLAKED} {THIRD} - 3 times now."}]
        self.run_it([issue(7, CHECK)], comments=comments, run=THIRD)
        self.assertEqual(self.writes(), [])
        self.assertEqual(self.statuses, [(7, "Now")])

    def test_an_issue_off_the_board_is_put_back_under_someday(self):
        # A first record whose Someday write was refused: the issue exists
        # but no status will ever find it until a third record.
        self.run_it([issue(7, CHECK)], board=set())
        self.assertEqual(self.statuses, [(7, "Someday")])
        self.assertEqual(self.writes(), [])

    def test_a_flake_after_the_issue_closed_reopens_it_at_now(self):
        said = self.run_it([issue(7, CHECK, "CLOSED")], run=OTHER)
        (write,) = self.writes()
        self.assertEqual(write[:3], ("issue", "reopen", "7"))
        self.assertTrue(write[-1].startswith(f"{file_py.FLAKED} {OTHER} - 2 times now."))
        self.assertEqual(self.statuses, [(7, "Now")])
        self.assertIn("reopened", said)

    def test_a_run_that_is_not_this_repositorys_writes_nothing(self):
        for bad in ("https://example.com/runs/1",
                    "https://github.com/someone/else/actions/runs/1",
                    "https://github.com/Alex-Farley/formula-1-data/pull/975",
                    "https://github.com/Alex-Farley/formula-1-data/actions/runs/1x"):
            with self.assertRaises(SystemExit):
                self.run_it([], run=bad)
            self.assertEqual((self.calls, self.filed), ([], []))

    def test_an_empty_check_or_an_unknown_prefix_writes_nothing(self):
        for kwargs in ({"check": "   "}, {"check": "FAIL  "}, {"prefix": "ZZ"}):
            with self.assertRaises(SystemExit):
                self.run_it([], **kwargs)
            self.assertEqual((self.calls, self.filed), ([], []))


class Filing(unittest.TestCase):
    def test_new_carries_the_flaky_label_and_returns_the_number(self):
        # The label is what a later record finds the issue by; without it
        # every flake of the same check would file an issue of its own.
        calls = []

        def gh(*args, as_json=False):
            calls.append(args)
            return "https://github.com/Alex-Farley/formula-1-data/issues/1001"

        ran = SimpleNamespace(stdout="PM-99\n")
        a = SimpleNamespace(prefix="PM", title="Flaky check: x", size="?", status="Someday", body="b",
                            body_file=None, where=None, decision=False, labels=["flaky"])
        with mock.patch.object(file_py, "gh", gh), \
                mock.patch.object(file_py.subprocess, "run", lambda *_a, **_k: ran), \
                mock.patch.object(file_py, "set_status", lambda *_: None), \
                contextlib.redirect_stdout(io.StringIO()):
            number = file_py.new(a)
        self.assertEqual(number, 1001)
        (create,) = calls
        labels = [create[i + 1] for i, x in enumerate(create) if x == "--label"]
        self.assertEqual(labels, ["source: project record", "size: ?", "flaky"])


if __name__ == "__main__":
    unittest.main()
