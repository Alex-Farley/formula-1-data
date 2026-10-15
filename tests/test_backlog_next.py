"""What `next.py` makes of the board: which open issues are in the queue,
and under which status.

The rows are built by `queue_rows()`, a pure function of the board read and
the issue read, so these tests need no GitHub. The case they exist for is
refresh.yml's alarm (AF-89): the workflow opens it as an item but cannot
write the board, so an alarm with no status - or not on the board at all -
has to reach the queue at the top of *Now*, where the next fork takes it
(AF-111), and a status a person gives it has to win.
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
        # Numbers run against the order promised, so sorting the alarms by
        # number instead would fail: on the board #9 then #6, off it #4.
        rows = self.rows([(1, "Now", 0), (9, "", 0), (6, "", 0)],
                         [issue(1, "AF-01: a"), issue(4, "AF-95: alarm", "results-late"),
                          issue(6, "AF-96: alarm", "refresh-failing"),
                          issue(9, "AF-94: alarm", "refresh-failing")])
        self.assertEqual(self.ranked(rows), [9, 6, 4, 1])

    def test_an_alarm_a_person_put_in_now_keeps_its_place(self):
        rows = self.rows([(1, "Now", 0), (2, "Now", 0), (3, "Now", 0)],
                         [issue(1, "AF-01: a"), issue(2, "AF-94: alarm", "refresh-failing"),
                          issue(3, "AF-03: c")])
        self.assertEqual(self.ranked(rows), [1, 2, 3])

    def test_a_status_a_person_gave_an_alarm_is_obeyed(self):
        rows = self.rows([(2, "Someday", 0), (4, "In progress", 0)],
                         [issue(2, "AF-94: alarm", "refresh-failing"),
                          issue(4, "AF-95: alarm", "results-late")])
        self.assertEqual([r["status"] for r in rows], ["Someday", "In progress"])

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
