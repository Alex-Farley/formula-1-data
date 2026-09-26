"""file.py decided and file.py rank: where a ruling is written, and where an
item lands when a person asks for it to be moved.

WHY THIS FILE EXISTS
    A ruling kept only in a comment was re-filed as undecided three times,
    because next.py prints the body and not the comments (D-43). So the
    ruling has to land in the body, in a form that no longer reads as an
    open question. And a rank that lands one place off, or across a status,
    quietly rewrites the order a person chose.
"""
import importlib.util
import os
import unittest

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


if __name__ == "__main__":
    unittest.main()
