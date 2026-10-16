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


if __name__ == "__main__":
    unittest.main()
