"""file.py decided and file.py rank: where a ruling is written, and where an
item lands when a person asks for it to be moved.

WHY THIS FILE EXISTS
    A ruling kept only in a comment was re-filed as undecided three times,
    because next.py prints the body and not the comments (D-43). So the
    ruling has to land in the body, in a form that no longer reads as an
    open question. And a rank that lands one place off, or across a status,
    quietly rewrites the order a person chose.

    Ranking a run of about 35 items one call at a time read the whole board
    three times per move and tripped GitHub's secondary limiter three times
    (AF-81, D-27). So a run is one read and one write per move that changes
    anything, spaced, and the plan is tested here without GitHub.
"""
import contextlib
import importlib.util
import io
import os
import unittest
from types import SimpleNamespace
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location(
    "backlog_file_rulings", os.path.join(ROOT, ".claude", "skills", "backlog-loop", "file.py"))
file_py = importlib.util.module_from_spec(spec)
spec.loader.exec_module(file_py)

DAY = "2026-09-25"
BODY = ("Measured: 23 of 29 ids moved.\n\n**To decide:** confirm that reading, or reinstate it.\n\n"
        "**Where:** data/current.py.")


class WritingARuling(unittest.TestCase):
    def test_the_question_becomes_history_under_the_ruling(self):
        out = file_py.decided_body(BODY, "confirm it; reinstating needs a stable order first", DAY)
        self.assertNotIn("**To decide:**", out)
        self.assertIn(f"**Decided ({DAY}):** confirm it; reinstating needs a stable order first\n\n"
                      "**Was to decide:** confirm that reading", out)
        self.assertTrue(out.startswith("Measured: 23 of 29"))
        self.assertTrue(out.endswith("**Where:** data/current.py."))

    def test_a_body_with_no_question_gets_the_ruling_at_the_top(self):
        out = file_py.decided_body("Some item.\n", "do B", DAY)
        self.assertEqual(out, f"**Decided ({DAY}):** do B\n\nSome item.\n")

    def test_a_second_ruling_goes_above_the_first(self):
        once = file_py.decided_body(BODY, "do A", "2026-09-20")
        twice = file_py.decided_body(once, "do B instead", DAY)
        self.assertLess(twice.index("do B instead"), twice.index("do A"))

    def test_an_empty_ruling_is_refused(self):
        with self.assertRaises(SystemExit):
            file_py.decided_body(BODY, "   ", DAY)

    def test_no_open_question_is_left_behind(self):
        self.assertIsNone(file_py.DECIDED.search(file_py.decided_body(BODY, "do A", DAY)))

    def test_a_question_mentioned_in_prose_is_not_the_question(self):
        # Found in review, on this item's own body.
        body = "It turns **To decide:** into **Was to decide:**.\n\n**To decide:** A or B."
        out = file_py.decided_body(body, "A", DAY)
        self.assertTrue(out.startswith("It turns **To decide:** into **Was to decide:**.\n\n"
                                       f"**Decided ({DAY}):** A\n\n**Was to decide:** A or B."), out)

    def test_a_code_span_or_a_quote_is_not_the_question(self):
        for body in ("The fork greps for `**To decide:**` lines.\n\n**To decide:** A or B.",
                     "> From #12: **To decide:** X\n\n**To decide:** A or B."):
            out = file_py.decided_body(body, "A", DAY)
            self.assertIn(f"**Decided ({DAY}):** A\n\n**Was to decide:** A or B.", out)
            self.assertEqual(out.split("\n\n")[0], body.split("\n\n")[0])

    def test_two_questions_are_both_settled(self):
        body = "**To decide:** A or B.\n\nMore.\n\n**To decide:** C or D."
        out = file_py.decided_body(body, "A, and C", DAY)
        self.assertEqual(out.count("**Was to decide:**"), 2)
        self.assertIsNone(file_py.DECIDED.search(out))

    def test_the_plain_spelling_older_bodies_use(self):
        out = file_py.decided_body("Item.\n\nTo decide: A or B.", "A", DAY)
        self.assertIn(f"**Decided ({DAY}):** A\n\n**Was to decide:** A or B.", out)

    def test_the_same_ruling_twice_changes_nothing(self):
        once = file_py.decided_body(BODY, "do A", DAY)
        self.assertEqual(file_py.decided_body(once, "do  A", DAY), once)


ROWS = [(10, "Now"), (11, "Now"), (12, "Now"), (20, "Next"), (21, "Next")]


class Ranking(unittest.TestCase):
    def test_top_and_bottom(self):
        self.assertIsNone(file_py.rank_after(ROWS, 12, "top"))
        self.assertEqual(file_py.rank_after(ROWS, 10, "bottom"), 12)

    def test_after_and_before(self):
        self.assertEqual(file_py.rank_after(ROWS, 10, "after", 12), 12)
        self.assertEqual(file_py.rank_after(ROWS, 12, "before", 11), 10)
        # Before the first item of the status is the top of it.
        self.assertIsNone(file_py.rank_after(ROWS, 12, "before", 10))

    def test_before_skips_the_item_being_moved(self):
        # Moving 10 before 12: its neighbour above 12, once 10 is lifted out, is 11.
        self.assertEqual(file_py.rank_after(ROWS, 10, "before", 12), 11)

    def test_bottom_of_a_status_holding_only_the_item(self):
        self.assertIsNone(file_py.rank_after([(10, "Now"), (20, "Next")], 10, "bottom"))

    def test_across_statuses_is_refused(self):
        with self.assertRaises(SystemExit):
            file_py.rank_after(ROWS, 10, "after", 20)

    def test_against_itself_or_off_the_board_is_refused(self):
        with self.assertRaises(SystemExit):
            file_py.rank_after(ROWS, 10, "after", 10)
        with self.assertRaises(SystemExit):
            file_py.rank_after(ROWS, 99, "top")


class RankingARun(unittest.TestCase):
    def test_a_run_goes_where_the_first_goes_in_the_order_given(self):
        rows = [(10, "Now"), (11, "Now"), (12, "Now"), (13, "Now")]
        self.assertEqual(file_py.rank_plan(rows, [13, 11], "top"), [(13, None), (11, 13)])

    def test_a_run_sent_to_the_bottom_ends_at_the_bottom(self):
        # 13 is last now and is in the run, so it is lifted out with it: the
        # bottom is after 12, and the run 11, 13 lands there in one write.
        rows = [(10, "Now"), (11, "Now"), (12, "Now"), (13, "Now")]
        self.assertEqual(file_py.rank_after(rows, 11, "bottom", moving=[13]), 12)
        self.assertEqual(file_py.rank_plan(rows, [11, 13], "bottom"), [(11, 12)])

    def test_before_an_issue_lands_the_whole_run_above_it(self):
        rows = [(10, "Now"), (11, "Now"), (12, "Now"), (13, "Now")]
        self.assertEqual(file_py.rank_plan(rows, [13, 12], "before", 11), [(13, 10), (12, 13)])

    def test_what_already_sits_in_place_is_not_written(self):
        # So a run cut short by a refusal is finished by running it again.
        rows = [(10, "Now"), (11, "Now"), (12, "Now"), (13, "Now")]
        self.assertEqual(file_py.rank_plan(rows, [10, 11, 13], "top"), [(13, 11)])
        self.assertEqual(file_py.rank_plan(rows, [10, 11, 12], "top"), [])

    def test_one_issue_is_the_move_it_always_was(self):
        for how, other in (("top", None), ("bottom", None), ("after", 12), ("before", 11), ("before", 12)):
            after = file_py.rank_after(ROWS, 10, how, other)
            plan = file_py.rank_plan(ROWS, [10], how, other)
            self.assertIn(plan, ([], [(10, after)]), (how, other))
        self.assertEqual(file_py.rank_plan(ROWS, [10], "after", 12), [(10, 12)])

    def test_other_statuses_are_left_where_they_are(self):
        rows = [(10, "Now"), (20, "Next"), (11, "Now")]
        self.assertEqual(file_py.rank_plan(rows, [11], "top"), [(11, None)])

    def test_a_run_across_statuses_a_repeat_or_an_anchor_inside_it_is_refused(self):
        for numbers, how, other in (([10, 20], "top", None), ([10, 11, 10], "top", None),
                                    ([10, 11], "after", 11), ([10, 99], "top", None)):
            with self.assertRaises(SystemExit, msg=(numbers, how, other)):
                file_py.rank_plan(ROWS, numbers, how, other)


class ARankRun(unittest.TestCase):
    """What `rank` sends GitHub: one read, then one write per planned move."""

    ITEMS = [(10, "Now", "I10"), (11, "Now", "I11"), (12, "Now", "I12"), (20, "Next", "I20")]

    def run_rank(self, numbers, refuse_at=None, **flags):
        reads, writes, sleeps = [], [], []

        def board_items(ids=False):
            reads.append(ids)
            return "P", self.ITEMS

        def gh_try(*args):
            writes.append(args)
            if refuse_at is not None and len(writes) == refuse_at:
                return False, "API rate limit exceeded"
            return True, ""

        a = SimpleNamespace(numbers=numbers, top=False, bottom=False, after=None, before=None)
        vars(a).update(flags)
        with mock.patch.object(file_py.next_py, "board_items", board_items), \
                mock.patch.object(file_py, "gh_try", gh_try), \
                mock.patch.object(file_py.time, "sleep", sleeps.append), \
                mock.patch.object(file_py.loop_cache, "drop", lambda *_: None), \
                mock.patch.object(file_py, "board", side_effect=AssertionError("board() read")), \
                mock.patch.object(file_py, "item_ids", side_effect=AssertionError("item_ids() read")), \
                contextlib.redirect_stdout(io.StringIO()) as out:
            file_py.rank(a)
        return reads, writes, sleeps, out.getvalue()

    def test_one_read_with_ids_and_spaced_writes(self):
        reads, writes, sleeps, out = self.run_rank([12, 11], top=True)
        self.assertEqual(reads, [True])
        self.assertEqual(len(writes), 2)
        self.assertIn("item=I12", writes[0])
        self.assertFalse(any(w.startswith("after=") for w in writes[0]))
        self.assertIn("after=I12", writes[1])
        self.assertIn("project=P", writes[1])
        self.assertEqual(sleeps, [file_py.RANK_SPACING])
        self.assertEqual(out, "#12 ranked first\n#11 ranked after #12\n")

    def test_a_run_already_in_order_writes_nothing(self):
        reads, writes, sleeps, out = self.run_rank([10, 11], top=True)
        self.assertEqual((writes, sleeps), ([], []))
        self.assertIn("nothing moved", out)

    def test_a_refusal_stops_the_run_and_names_what_was_not_placed(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as caught:
            self.run_rank([12, 11, 10], refuse_at=2, top=True)
        self.assertIn("rate limit", str(caught.exception.code))
        # 12 first, then 11 after it is refused; 10 then already sits after 11
        # in the plan, so the plan was two writes and one is left.
        self.assertIn("not placed: #11;", str(caught.exception.code))


if __name__ == "__main__":
    unittest.main()
