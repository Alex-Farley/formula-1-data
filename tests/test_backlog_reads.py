"""What the queue scripts ask GitHub for, and what they do when it refuses.

WHY THIS FILE EXISTS
    GitHub's secondary rate limiter refused every GraphQL call in this
    checkout on 2026-09-14 and again on 2026-09-21, so no fork could read the
    board and none could choose an item `[D-27]`. Both incidents were the
    same cause: the queue read asked for far more than it used, on every run
    of every fork, and cost scales with queue size times forks per hour.

    The read is now written out rather than left to `gh project item-list`,
    which has no field selection and returned every field of every board item
    — each issue's body included — when `next.py` wanted two of them. That
    buys the cheapness at the price of parsing a paginated GraphQL reply by
    hand, and a hand-parsed board has a failure the old one could not have:
    returning *part* of the board and looking exactly like a whole one. An
    item missing from the board is an item no fork will ever be offered, and
    it would be silent. So the cases here are the ones where a short answer
    must become a loud one.

    The rest is the rule that a second attempt is the one thing that makes a
    refusal worse: one pattern for it, in one place, and an exit code that
    tells "the limiter is active" from "gh failed".
"""
import contextlib
import importlib.util
import io
import json
import os
import tempfile
import unittest
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_script(name):
    spec = importlib.util.spec_from_file_location(
        f"backlog_{name}", os.path.join(ROOT, ".claude", "skills", "backlog-loop", f"{name}.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


next_py = load_script("next")
file_py = load_script("file")
gh_preflight = next_py.gh_preflight


def page(nodes, has_next=False):
    """One `gh api graphql --paginate` document, as GitHub shapes it."""
    return json.dumps({"data": {"user": {"projectV2": {"items": {
        "pageInfo": {"hasNextPage": has_next, "endCursor": "c"},
        "nodes": nodes}}}}})


def issue(number, status):
    return {"content": {"__typename": "Issue", "number": number},
            "fieldValueByName": {"name": status}}


class TheBoardRead(unittest.TestCase):
    def reply(self, raw):
        return mock.patch.object(next_py, "run", lambda *a: raw)

    def test_every_page_of_a_paginated_reply_is_read(self):
        # `--paginate` concatenates one document per page rather than merging
        # them, so a reader that json.loads() the reply whole sees the first
        # page and raises on the second - and a reader that stopped at the
        # first would quietly hand back a board ending at item 100.
        raw = page([issue(1, "Now")], True) + "\n" + page([issue(2, "Next")])
        with self.reply(raw):
            self.assertEqual(next_py.board_rows(), [(1, "Now"), (2, "Next")])

    def test_the_boards_own_order_is_kept(self):
        # Not sorted, not by number: the order is what a person drags, and it
        # is the whole ranking `next.py` exists to read.
        raw = page([issue(9, "Now"), issue(3, "Now"), issue(7, "Next")])
        with self.reply(raw):
            self.assertEqual([n for n, _ in next_py.board_rows()], [9, 3, 7])

    def test_a_draft_or_a_pull_request_on_the_board_is_not_an_item(self):
        raw = page([{"content": {"__typename": "DraftIssue"}, "fieldValueByName": {"name": "Now"}},
                    {"content": {"__typename": "PullRequest", "number": 8},
                     "fieldValueByName": {"name": "Now"}},
                    issue(5, "Now")])
        with self.reply(raw):
            self.assertEqual(next_py.board_rows(), [(5, "Now")])

    def test_an_item_with_no_status_reads_as_no_status_not_as_a_crash(self):
        # An issue auto-added in the web UI has no Status, and `load()` files
        # it under *unplaced* rather than losing it.
        raw = page([{"content": {"__typename": "Issue", "number": 4}, "fieldValueByName": None}])
        with self.reply(raw):
            self.assertEqual(next_py.board_rows(), [(4, "")])

    def test_errors_beside_a_partial_page_stop_rather_than_shorten_the_board(self):
        # GraphQL answers 200 with `errors` alongside whatever `data` it
        # managed, and gh does not always exit non-zero on it. Half a board
        # is indistinguishable from a whole one in the output; a fork would
        # simply never be offered the items that fell off the end.
        raw = json.dumps({"data": {"user": {"projectV2": {"items": {
            "pageInfo": {"hasNextPage": False, "endCursor": None}, "nodes": [issue(1, "Now")]}}}},
            "errors": [{"message": "timeout"}]})
        with self.reply(raw), self.assertRaises(SystemExit) as caught:
            with contextlib.redirect_stderr(io.StringIO()):
                next_py.board_rows()
        self.assertIn("timeout", str(caught.exception))

    def test_a_board_that_is_not_there_stops_rather_than_reading_as_empty(self):
        # An empty queue and an unreachable project must not look alike: one
        # means the loop is done, the other means it cannot start.
        raw = json.dumps({"data": {"user": None}})
        with self.reply(raw), self.assertRaises(SystemExit) as caught:
            with contextlib.redirect_stderr(io.StringIO()):
                next_py.board_rows()
        self.assertIn("ProjectsV2", str(caught.exception))


class WhatTheIssueReadAsksFor(unittest.TestCase):
    """The bodies are three quarters of that read and most calls print none."""

    def setUp(self):
        self.asked = []
        # The fixture's queue must not land in the checkout's own
        # .claude/loop, where the next real `next.py` would read it back.
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.addCleanup(setattr, next_py.loop_cache, "DIR", next_py.loop_cache.DIR)
        next_py.loop_cache.DIR = self.dir.name
        self.addCleanup(setattr, next_py, "gh", next_py.gh)
        self.addCleanup(setattr, next_py, "board_rows", next_py.board_rows)
        next_py.gh = lambda *a: self.asked.append(a) or []
        next_py.board_rows = lambda: []

    def fields(self):
        return self.asked[-1][self.asked[-1].index("--json") + 1]

    def test_a_call_that_prints_no_body_does_not_fetch_one(self):
        next_py.load()
        self.assertNotIn("body", self.fields())

    def test_a_call_that_scores_a_group_fetches_every_body(self):
        next_py.load(bodies=True)
        self.assertIn("body", self.fields())

    def test_the_fields_choosing_needs_are_asked_for_either_way(self):
        # Dropping the body must not drop what ranks and labels an item.
        for bodies in (False, True):
            next_py.load(bodies=bodies)
            for field in ("number", "title", "labels", "url"):
                self.assertIn(field, self.fields())


class TheCachedPayloadCarriesWhetherItHasBodies(unittest.TestCase):
    """A cheaper call must not leave a snapshot that answers an expensive one.

    `--list` and a bare call now write a queue cache with no bodies in it.
    The next `next.py VD-33 AX-13` reads that cache, and before this it would
    have printed the item with an empty body - a fork working from a blank
    specification, and nothing to say it had happened.
    """

    def setUp(self):
        self.calls = []
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.addCleanup(setattr, next_py.loop_cache, "DIR", next_py.loop_cache.DIR)
        next_py.loop_cache.DIR = self.dir.name
        self.addCleanup(setattr, next_py, "gh", next_py.gh)
        self.addCleanup(setattr, next_py, "board_rows", next_py.board_rows)
        next_py.gh = lambda *a: []
        next_py.board_rows = lambda: self.calls.append("board") or []

    def test_a_body_free_snapshot_is_a_miss_for_a_call_that_needs_bodies(self):
        next_py.load(bodies=False)
        next_py.load(allow_cache=True, bodies=True)
        self.assertEqual(self.calls.count("board"), 2)

    def test_a_snapshot_with_bodies_serves_a_call_that_does_not_need_them(self):
        next_py.load(bodies=True)
        next_py.load(allow_cache=True, bodies=False)
        self.assertEqual(self.calls.count("board"), 1)

    def test_a_snapshot_from_before_this_change_is_a_miss_not_a_blank_body(self):
        # `.claude/loop` survives a branch switch, so a payload written by the
        # previous version of these scripts - which had no `bodies` key and
        # always held them - is read by the next one.
        next_py.loop_cache.write("queue", {"ranked": [], "in_progress": [], "unplaced": []})
        next_py.load(allow_cache=True, bodies=True)
        self.assertEqual(self.calls.count("board"), 1)


class ARefusalIsNotRetried(unittest.TestCase):
    def test_one_pattern_for_it_and_both_scripts_read_the_same_one(self):
        # It lived in file.py and next.py did not have it. Two copies of a
        # pattern this load-bearing is how one of them goes quietly stale.
        self.assertIs(file_py.REFUSED, gh_preflight.DO_NOT_RETRY)

    def test_the_wordings_that_actually_occur_are_matched(self):
        for said in ("You have exceeded a secondary rate limit",
                     "API rate limit exceeded for user ID 1",
                     "was submitted too quickly; abuse detection",
                     "HTTP 403: Resource not accessible (forbidden)"):
            self.assertTrue(gh_preflight.DO_NOT_RETRY.search(said), said)

    def test_an_ordinary_failure_is_not_read_as_a_refusal(self):
        for said in ("could not resolve host: api.github.com",
                     "GraphQL: Could not resolve to an Issue with the number 999"):
            self.assertIsNone(gh_preflight.DO_NOT_RETRY.search(said), said)

    def run_gh(self, stderr):
        done = mock.Mock(returncode=1, stdout="", stderr=stderr)
        with mock.patch.object(next_py.subprocess, "run", return_value=done), \
                mock.patch.object(gh_preflight, "unauthenticated",
                                  side_effect=AssertionError("spent a call on a refused API")), \
                contextlib.redirect_stderr(io.StringIO()) as said:
            with self.assertRaises(SystemExit) as caught:
                next_py.run("api", "graphql")
        return caught.exception.code, said.getvalue()

    def test_the_limiter_exits_3_and_says_which_refusal_it_was(self):
        # 2 means "gh failed", which reads as something to try again. Trying
        # again is the one thing that extends this `[D-27]`, so the loop needs
        # to tell the two apart without reading the prose.
        code, said = self.run_gh("You have exceeded a secondary rate limit")
        self.assertEqual(code, 3)
        self.assertIn("extends the refusal", said)

    def test_no_further_call_is_spent_asking_whether_it_was_the_credential(self):
        # `unauthenticated()` costs a `gh auth status`, the limiter counts it,
        # and it cannot tell a rejected token from an API it could not reach -
        # so against a limiter it answers "no credential" whatever the truth.
        # The mock above raises if it is called; reaching exit 3 is the proof.
        self.assertEqual(self.run_gh("secondary rate limit")[0], 3)

    def test_an_ordinary_gh_failure_still_exits_2(self):
        with mock.patch.object(gh_preflight, "unauthenticated", return_value=False), \
                mock.patch.object(next_py.subprocess, "run",
                                  return_value=mock.Mock(returncode=1, stdout="", stderr="boom")), \
                contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as caught:
                next_py.run("issue", "list")
        self.assertEqual(caught.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
