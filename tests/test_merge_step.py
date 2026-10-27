"""What merge-step.py decides around a loop merge.

WHY THIS FILE EXISTS
    `after` is the only thing between a refused `gh pr merge` and a deleted
    branch, a closed PR and an issue marked Done for work that never landed
    (AF-99). `before` is what keeps a loop merge from conflicting a refresh
    that carries a race's results (AF-105). Both decide from what GitHub
    says, so these tests give them GitHub's answers and watch what they do.
"""
import datetime as dt
import importlib.util
import io
import os
import unittest
from contextlib import redirect_stdout

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, ".claude", "skills", "backlog-loop", "merge-step.py")
spec = importlib.util.spec_from_file_location("backlog_merge_step", PATH)
ms = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ms)

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 14, 12, 0, tzinfo=UTC)


def refresh(number, minutes_ago):
    stamp = (NOW - dt.timedelta(minutes=minutes_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"number": number, "url": "u", "createdAt": "2026-10-10T00:00:00Z",
            "commits": [{"committedDate": "2026-10-10T00:00:00Z"}, {"committedDate": stamp}]}


class Fake:
    """Stands in for gh and for every command `after` would run."""

    def __init__(self, state="OPEN", merge_state="CLEAN", refreshes=(), body="", labels=None):
        self.state, self.merge_state = state, merge_state
        self.refreshes, self.body = list(refreshes), body
        self.labels = labels or {}
        self.ran = []

    def gh(self, *args):
        if args[:2] == ("pr", "list"):
            return self.refreshes
        if args[:2] == ("pr", "view") and "comments" in args[-1]:
            return {"comments": []}
        if args[:2] == ("pr", "view"):
            return {"state": self.state, "mergeStateStatus": self.merge_state, "isDraft": False,
                    "headRefName": "claude/x", "body": self.body}
        if args[:2] == ("issue", "view"):
            n = int(args[2])
            return {"state": "OPEN", "labels": [{"name": x} for x in self.labels.get(n, [])]}
        raise AssertionError(args)

    def run(self, cmd, cwd=None):
        self.ran.append(cmd)
        if cmd[:3] == ["git", "worktree", "list"]:
            return 0, "worktree /main\nHEAD a\nbranch refs/heads/main\n\nworktree /wt\nHEAD b\nbranch refs/heads/claude/x\n"
        if cmd[:2] == ["git", "symbolic-ref"]:
            return 0, "main"
        return 0, ""


def patched(fake, fn, *args, wait=540, **kw):
    saved = ms.gh, ms.run, ms.WAIT
    ms.gh, ms.run, ms.WAIT = fake.gh, fake.run, wait
    try:
        with redirect_stdout(io.StringIO()):
            return fn(*args, **kw)
    finally:
        ms.gh, ms.run, ms.WAIT = saved


class ReadsThePullRequestBody(unittest.TestCase):
    def test_closing_and_referring_lines(self):
        body = "Text.\n\nCloses #982\ncloses #988\nRefs #846\nFixes #12 and more\nNot Closes #5"
        self.assertEqual(ms.issues_in(body), ([12, 982, 988], [846]))

    def test_a_reference_with_a_colon_or_mid_line(self):
        self.assertEqual(ms.issues_in("Refs: #846\nThe alarm (refs #847) waits."), ([], [846, 847]))

    def test_an_issue_both_closed_and_referred_to_is_closed(self):
        self.assertEqual(ms.issues_in("Closes #3\nRefs #3"), ([3], []))

    def test_no_body(self):
        self.assertEqual(ms.issues_in(None), ([], []))


class AfterRefusesAnUnmergedPullRequest(unittest.TestCase):
    """AF-99: the cleanup ran after a refused merge and closed a green PR."""

    def test_open_and_closed_touch_nothing(self):
        for state in ("OPEN", "CLOSED"):
            fake = Fake(state=state, body="Closes #1\nRefs #2", labels={2: ["refresh-failing"]})
            self.assertEqual(patched(fake, ms.after, 7), 1, state)
            self.assertEqual(fake.ran, [], f"after ran {fake.ran} on a PR that is {state}")

    def test_merged_is_cleaned_up_and_never_deletes_the_remote_branch(self):
        fake = Fake(state="MERGED", body="Closes #1\nRefs #2\nRefs #3",
                    labels={2: ["refresh-failing"], 3: ["size: S"]})
        self.assertEqual(patched(fake, ms.after, 7), 0)
        statuses = [c[2:] for c in fake.ran if c[1:2] and c[1].endswith("file.py")]
        self.assertEqual(statuses, [["status", "1", "Done"], ["status", "2", "Now"]])
        self.assertIn(["gh", "workflow", "run", "refresh.yml"], fake.ran)
        self.assertIn(["git", "worktree", "remove", "/wt"], fake.ran)
        self.assertFalse([c for c in fake.ran if "push" in c or "--delete" in c],
                         "after deleted a remote branch: the repository does that on merge")

    def test_every_closed_issue_is_one_status_call(self):
        # PM-45: file.py sends a group's statuses as one request.
        fake = Fake(state="MERGED", body="Closes #4\nCloses #1")
        patched(fake, ms.after, 7)
        statuses = [c[2:] for c in fake.ran if c[1:2] and c[1].endswith("file.py")]
        self.assertEqual(statuses, [["status", "1", "4", "Done"]])

    def test_no_alarm_no_refresh_run(self):
        fake = Fake(state="MERGED", body="Closes #1")
        patched(fake, ms.after, 7)
        self.assertNotIn(["gh", "workflow", "run", "refresh.yml"], fake.ran)


class BeforeLetsTheRefreshGoFirst(unittest.TestCase):
    """AF-105: a loop merge conflicted a refresh carrying a race's results."""

    def test_clear(self):
        self.assertEqual(patched(Fake(), ms.before, 7, now=NOW, sleep=lambda s: None), 0)

    def test_main_moved(self):
        for state in ("BEHIND", "DIRTY"):
            self.assertEqual(patched(Fake(merge_state=state), ms.before, 7, now=NOW,
                                     sleep=lambda s: None), 3, state)

    def test_blocked_is_not_clear(self):
        self.assertEqual(patched(Fake(merge_state="BLOCKED"), ms.before, 7, now=NOW,
                                 sleep=lambda s: None), 1)

    def test_a_fresh_refresh_is_waited_on(self):
        fake = Fake(refreshes=[refresh(975, 20)])
        self.assertEqual(patched(fake, ms.before, 7, now=NOW, sleep=lambda s: None, wait=0), 5)

    def test_a_refresh_that_merges_while_waiting_leaves_main_moved(self):
        fake = Fake(refreshes=[refresh(975, 20)])

        def merged(_):
            fake.refreshes, fake.merge_state = [], "BEHIND"
        self.assertEqual(patched(fake, ms.before, 7, now=NOW, sleep=merged), 3)

    def test_a_stuck_refresh_is_not_waited_on(self):
        # Pushed 61 minutes ago, though the PR itself is days old: the age is
        # the last push's, because refresh.yml reuses one branch and one PR.
        fake = Fake(refreshes=[refresh(975, 61)])
        self.assertEqual(patched(fake, ms.before, 7, now=NOW, sleep=lambda s: None), 0)

    def test_the_age_is_the_last_push(self):
        self.assertFalse(ms.stuck(refresh(1, 59), NOW))
        self.assertTrue(ms.stuck(refresh(1, 60), NOW))


class FindsTheWorktree(unittest.TestCase):
    def test_primary_and_branch(self):
        text = ("worktree /p\nHEAD a\nbranch refs/heads/main\n\n"
                "worktree /w\nHEAD b\ndetached\n\nworktree /x\nHEAD c\nbranch refs/heads/claude/y\n")
        self.assertEqual(ms.worktree_of("claude/y", text), ("/p", "/x"))
        self.assertEqual(ms.worktree_of("claude/z", text), ("/p", None))


if __name__ == "__main__":
    unittest.main()
