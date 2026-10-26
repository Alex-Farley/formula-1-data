"""What `next.py` makes of the board: which open issues are in the queue,
and under which status.

The rows are built by `queue_rows()`, a pure function of the board read and
the issue read, so these tests need no GitHub. The case they exist for is
refresh.yml's alarm (AF-89): the workflow opens it as an item but cannot
write the board, so an alarm with no status - or not on the board at all -
has to reach the queue at the top of *Now*, where the next fork takes it
(AF-111). So does one at *Now*, whoever set it, because the loop writes *Now*
on an alarm it has touched and the board cannot tell that from a person
(AF-112); *Next*, *Someday* and *In progress* are obeyed.
"""
import importlib.util
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOOP = os.path.join(ROOT, ".claude", "skills", "backlog-loop")
SCRIPTS = os.path.join(ROOT, ".github", "scripts")


def load(name, where):
    spec = importlib.util.spec_from_file_location(name, os.path.join(where, f"{name}.py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


nxt = load("next", LOOP)


def issue(n, title, *labels):
    return dict(number=n, title=title, url=f"https://example.invalid/issues/{n}",
                labels=[dict(name=lb) for lb in labels])


class QueueRows(unittest.TestCase):
    def rows(self, board, issues):
        return nxt.queue_rows(board, {i["number"]: i for i in issues})

    def ranked(self, rows):
        return [r["number"] for s in nxt.QUEUE for r in rows if r["status"] == s]

    def test_an_alarm_with_no_status_heads_now_above_what_a_person_placed(self):
        rows = self.rows([(1, "Now", 0), (3, "Now", 0), (2, "", 0)],
                         [issue(1, "AF-01: a"), issue(2, "AF-94: alarm", "refresh-failing"),
                          issue(3, "AF-03: c")])
        # Auto-added, so at the foot of the board, and still first.
        self.assertEqual(self.ranked(rows), [2, 1, 3])
        self.assertEqual((rows[0]["status"], rows[0]["ident"]), ("Now", "AF-94"))

    def test_an_alarm_off_the_board_heads_now(self):
        rows = self.rows([(1, "Now", 0), (3, "Next", 0)],
                         [issue(1, "AF-01: a"), issue(3, "AF-03: c"),
                          issue(9, "Results are behind the calendar", "results-late")])
        self.assertEqual([(r["number"], r["status"]) for r in rows],
                         [(9, "Now"), (1, "Now"), (3, "Next")])
        # No id in the title - the id read failed when it opened - so it is
        # named by number, the form precheck.sh accepts (CR-75).
        self.assertEqual(rows[0]["ident"], "#9")

    def test_alarms_head_now_board_held_in_board_order_then_off_board(self):
        # The numbers follow neither the promised order nor its reverse, so
        # sorting the alarms by number either way fails: on the board #6 then
        # #9, off it #4.
        rows = self.rows([(1, "Now", 0), (6, "", 0), (9, "", 0)],
                         [issue(1, "AF-01: a"), issue(4, "AF-95: alarm", "results-late"),
                          issue(6, "AF-96: alarm", "refresh-failing"),
                          issue(9, "AF-94: alarm", "refresh-failing")])
        self.assertEqual(self.ranked(rows), [6, 9, 4, 1])

    def test_an_alarm_at_now_heads_now_whoever_set_it(self):
        # merge-step.py writes *Now* on an alarm after a fix merges, and the
        # issue is auto-added, so it sits at the foot of *Now*; if the next
        # refresh fails again it must still be taken first (AF-112).
        rows = self.rows([(1, "Now", 0), (3, "Now", 0), (2, "Now", 0)],
                         [issue(1, "AF-01: a"), issue(2, "AF-94: alarm", "refresh-failing"),
                          issue(3, "AF-03: c")])
        self.assertEqual(self.ranked(rows), [2, 1, 3])
        self.assertEqual(rows[0]["status"], "Now")

    def test_alarms_at_now_and_with_no_status_head_now_in_board_order(self):
        rows = self.rows([(1, "Now", 0), (7, "", 0), (2, "Now", 0)],
                         [issue(1, "AF-01: a"), issue(2, "AF-94: alarm", "refresh-failing"),
                          issue(7, "AF-97: alarm", "results-late")])
        self.assertEqual(self.ranked(rows), [7, 2, 1])

    def test_a_status_other_than_now_on_an_alarm_is_obeyed(self):
        rows = self.rows([(1, "Next", 0), (5, "Next", 0), (3, "Someday", 0),
                          (2, "Someday", 0), (4, "In progress", 0)],
                         [issue(1, "AF-01: a"), issue(5, "AF-96: alarm", "refresh-failing"),
                          issue(3, "AF-03: c"), issue(2, "AF-94: alarm", "refresh-failing"),
                          issue(4, "AF-95: alarm", "results-late")])
        self.assertEqual([(r["number"], r["status"]) for r in rows],
                         [(1, "Next"), (5, "Next"), (3, "Someday"), (2, "Someday"),
                          (4, "In progress")])

    def test_an_ordinary_issue_with_no_status_stays_unplaced(self):
        rows = self.rows([(5, "", 0)], [issue(5, "AF-05: filed in the web UI")])
        self.assertEqual(rows[0]["status"], "")
        # And one off the board is not the queue's at all.
        self.assertEqual(self.rows([], [issue(6, "AF-06: x", "bug")]), [])

    def test_a_closed_issue_on_the_board_is_not_a_row(self):
        self.assertEqual(self.rows([(7, "", 0)], []), [])

    def test_the_labels_are_the_ones_refresh_alarm_writes(self):
        # Two copies of one pair of names, in two scripts that never import
        # each other: the workflow's checks out none of the loop's files.
        alarm = load("refresh_alarm", SCRIPTS)
        self.assertEqual(nxt.ALARMS, {alarm.FAILING["label"], alarm.LATE["label"]})
        with open(os.path.join(LOOP, "precheck.sh"), encoding="utf-8") as f:
            precheck = f.read()
        for label in nxt.ALARMS:
            self.assertIn(f'"{label}"', precheck)


def sc(n, title, *labels, author="app/github-actions"):
    """An issue as security.yml opens it: `source: security`, by the
    workflow's token as `gh issue list --json author` names it."""
    i = issue(n, title, "source: security", *labels)
    i["author"] = dict(login=author, is_bot=author == "app/github-actions")
    return i


class SecurityRows(unittest.TestCase):
    """security.yml's issues reach the board with no status too, and are
    read by their severity label until a person gives them one (AF-121)."""
    def rows(self, board, issues):
        return nxt.queue_rows(board, {i["number"]: i for i in issues})

    def ranked(self, rows):
        return [(r["number"], r["status"]) for s in nxt.QUEUE for r in rows if r["status"] == s]

    def test_each_severity_goes_where_the_ruling_says(self):
        rows = self.rows([(1, "Now", 0), (2, "Next", 0), (3, "Someday", 0),
                          (10, "", 0), (11, "", 0), (12, "", 0), (13, "", 0)],
                         [issue(1, "AF-01: a"), issue(2, "AF-02: b"), issue(3, "AF-03: c"),
                          sc(10, "SC-01: low", "security: low"),
                          sc(11, "SC-02: high", "security: high"),
                          sc(12, "SC-03: medium", "security: medium"),
                          issue(13, "AF-94: alarm", "refresh-failing")])
        # The alarm first, then the high alert above what a person placed in
        # *Now*; medium and low at the foot of theirs.
        self.assertEqual(self.ranked(rows), [(13, "Now"), (11, "Now"), (1, "Now"),
                                             (2, "Next"), (12, "Next"),
                                             (3, "Someday"), (10, "Someday")])

    def test_off_the_board_is_read_by_its_label_too(self):
        rows = self.rows([(1, "Now", 0)],
                         [issue(1, "AF-01: a"), sc(7, "SC-04: x", "security: high"),
                          sc(8, "SC-05: y", "security: low")])
        self.assertEqual(self.ranked(rows), [(7, "Now"), (1, "Now"), (8, "Someday")])

    def test_the_highest_label_decides(self):
        rows = self.rows([(4, "", 0)],
                         [sc(4, "SC-06: z", "security: low", "security: high")])
        self.assertEqual(self.ranked(rows), [(4, "Now")])

    def test_a_status_is_obeyed(self):
        rows = self.rows([(1, "Now", 0), (5, "Someday", 0), (6, "Now", 0)],
                         [issue(1, "AF-01: a"), sc(5, "SC-07: x", "security: high"),
                          sc(6, "SC-08: y", "security: low")])
        self.assertEqual(self.ranked(rows), [(1, "Now"), (6, "Now"), (5, "Someday")])

    def test_only_an_issue_security_yml_opened_is_placed_by_its_label(self):
        # A stranger's issue, and one of the job's without `source: security`,
        # are ordinary rows: off the board they are not in the queue, and on
        # it with no status they are unplaced - neither heads *Now*.
        stranger = sc(20, "SC-09: x", "security: high", author="someone")
        unsourced = issue(21, "SC-10: y", "security: high")
        unsourced["author"] = dict(login="app/github-actions", is_bot=True)
        rows = self.rows([(1, "Now", 0), (21, "", 0)],
                         [issue(1, "AF-01: a"), stranger, unsourced])
        self.assertEqual(self.ranked(rows), [(1, "Now")])
        self.assertEqual([(r["number"], r["status"]) for r in rows if r["number"] == 21],
                         [(21, "")])
        # The same issue by the job is placed.
        rows = self.rows([(1, "Now", 0)], [issue(1, "AF-01: a"), sc(20, "SC-09: x", "security: high")])
        self.assertEqual(self.ranked(rows), [(20, "Now"), (1, "Now")])

    def test_the_labels_are_the_ones_security_alarm_writes(self):
        alarm = load("security_alarm", SCRIPTS)
        self.assertEqual({label for label, _ in nxt.SEVERITY},
                         {name for name, *_ in alarm.SEVERITY_LABELS.values()})
        self.assertEqual([status for _, status in nxt.SEVERITY], list(nxt.QUEUE))



class ReserveAlarm(unittest.TestCase):
    """`next.py --alarm`: the one item the race-weekend reserve may be spent
    on (AF-130) - an alarm fork's open pull request, else an alarm at the
    head of the queue with no refresh run under way."""

    def row(self, n, ident, status, *labels):
        return dict(number=n, ident=ident, status=status, labels=sorted(labels), waits=0)

    def find(self, ranked, in_progress=(), prs=(), runs=(), skip=()):
        def gh(*args):
            if args[:2] == ("pr", "list"):
                return list(prs)
            if args[:2] == ("run", "list"):
                self.assertIn("refresh.yml", args)
                return list(runs)
            raise AssertionError(args)
        saved, nxt.gh = nxt.gh, gh
        try:
            return nxt.reserve_alarm(list(ranked), list(in_progress), set(skip))
        finally:
            nxt.gh = saved

    ALARM = property(lambda self: self.row(150, "AF-150", "Now", "refresh-failing", "size: ?"))
    ITEM = property(lambda self: self.row(9, "AF-09", "Now", "size: S"))

    def test_an_alarm_at_the_head_with_no_run_under_way(self):
        found = self.find([self.ALARM, self.ITEM], runs=[{"status": "completed"}])
        self.assertEqual((found[0]["ident"], found[1]), ("AF-150", None))

    def test_an_ordinary_item_at_the_head_is_none(self):
        self.assertIsNone(self.find([self.ITEM, self.ALARM]))

    def test_a_refresh_run_under_way_is_waited_for(self):
        for status in ("queued", "in_progress", "waiting"):
            self.assertIsNone(self.find([self.ALARM], runs=[{"status": status}, {"status": "completed"}]))

    def test_a_blocked_or_skipped_alarm_is_not_the_head(self):
        blocked = self.row(150, "AF-150", "Now", "refresh-failing", "blocked")
        self.assertIsNone(self.find([blocked, self.ITEM]))
        self.assertIsNone(self.find([self.ALARM, self.ITEM], skip={"AF-150"}))

    def test_an_alarm_fork_s_open_pull_request_is_landed_first(self):
        held = self.row(151, "AF-151", "In progress", "results-late")
        prs = [{"number": 1159, "headRefName": "claude/af-09-x", "body": "Closes #9"},
               {"number": 1160, "headRefName": "claude/af-151-late", "body": "Why.\n\nRefs #151\n"}]
        found = self.find([self.ALARM], in_progress=[held], prs=prs, runs=[{"status": "in_progress"}])
        self.assertEqual((found[0]["ident"], found[1]), ("AF-151", 1160))

    def test_a_pull_request_not_the_loop_s_or_not_naming_it_lands_nothing(self):
        held = self.row(151, "AF-151", "In progress", "results-late")
        prs = [{"number": 1161, "headRefName": "someone/fix", "body": "Refs #151"},
               {"number": 1162, "headRefName": "claude/x", "body": "Refs #1510"}]
        self.assertIsNone(self.find([self.ITEM], in_progress=[held], prs=prs))


if __name__ == "__main__":
    unittest.main()
