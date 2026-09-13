# -*- coding: utf-8 -*-
"""
The SVG path arithmetic behind the circuit outlines, tested directly.

WHY THIS FILE EXISTS
    An outline is stored as bare path data and drawn into a 500-unit box.
    One F1DB asset positioned its path with a translate() on the element,
    and stored as written it drew an empty, credited figure on two pages
    (PR #273's review). data/harvest.py now applies a translate at the
    fetch and verify.py checks every outline's extent lies inside the box.
    Both rest on one small parser, and a parser that misread "a1 1 0 011 1"
    as one number, or moved a relative segment, would pass every row today
    and fail on the next asset. These give it inputs whose right answer is
    known by construction.

    python3 -m unittest discover -s tests
"""
import unittest

from data import harvest as H


def segments(d):
    return [(c, [round(v, 3) for v in a]) for c, a in H.svg_path_segments(d)]


class Segments(unittest.TestCase):
    def test_implicit_repeats_become_lines(self):
        self.assertEqual(segments("M1 2 3 4"), [("M", [1, 2]), ("L", [3, 4])])
        self.assertEqual(segments("m1 2 3 4z"), [("m", [1, 2]), ("l", [3, 4]), ("z", [])])

    def test_compact_numbers_and_arc_flags(self):
        # "4.365-1.493.08" is three numbers; an arc's flags are single digits
        # even when nothing separates them from the coordinate that follows.
        self.assertEqual(segments("M0 0c4.365-1.493.08 1 2 3"), [("M", [0, 0]), ("c", [4.365, -1.493, 0.08, 1, 2, 3])])
        self.assertEqual(segments("M0 0a17.9 17.9 0 011.5 2"), [("M", [0, 0]), ("a", [17.9, 17.9, 0, 0, 1, 1.5, 2])])

    def test_refuses_what_the_grammar_does_not_allow(self):
        for bad in ("M1", "M1 2 z 3", "X1 2", "M0 0a1 1 0 2 0 1 1", "1 2"):
            with self.assertRaises(ValueError, msg=bad):
                list(H.svg_path_segments(bad))


class Translate(unittest.TestCase):
    def test_moves_absolute_coordinates_only(self):
        self.assertEqual(H.svg_path_translate("M1 2l3 4L5 6z", 10, 20), "M11 22 l3 4 L15 26 z")
        self.assertEqual(H.svg_path_translate("M1 2H3V4h5v6", 10, 20), "M11 22 H13 V24 h5 v6")

    def test_first_lowercase_m_is_absolute(self):
        self.assertEqual(H.svg_path_translate("m1 2 3 4", 10, 20), "m11 22 l3 4")

    def test_arc_moves_its_endpoint_and_nothing_else(self):
        self.assertEqual(H.svg_path_translate("M0 0A1 2 30 0 1 5 6", 10, 20), "M10 20 A1 2 30 0 1 15 26")
        self.assertEqual(H.svg_path_translate("M0 0a1 2 30 0 1 5 6", 10, 20), "M10 20 a1 2 30 0 1 5 6")

    def test_the_result_is_still_path_data(self):
        import re
        moved = H.svg_path_translate("M1221.178 1253.377c-21.387 1.87-42.861 3.232-64.268 4.365z", -1074.322, -900.61)
        self.assertTrue(re.fullmatch(H.SVG_PATH_DATA, moved))
        self.assertEqual(moved, "M146.856 352.767 c-21.387 1.87 -42.861 3.232 -64.268 4.365 z")


class Extent(unittest.TestCase):
    def test_control_points_bound_a_curve(self):
        self.assertEqual(H.svg_path_extent("M10 20c0 0 0 0 10 10z"), (10, 20, 20, 30))
        self.assertEqual(H.svg_path_extent("M10 20C40 50 60 70 20 30"), (10, 20, 60, 70))

    def test_relative_segments_accumulate(self):
        self.assertEqual(H.svg_path_extent("M10 10l5 0 0 5-5 0z l100 100"), (10, 10, 110, 110))
        self.assertEqual(H.svg_path_extent("M10 10h-5v-5"), (5, 5, 10, 10))

    def test_an_arc_is_bounded_by_the_arc_not_its_radii(self):
        x0, y0, x1, y1 = H.svg_path_extent("M0 0A1 1 0 0 1 2 0")
        self.assertEqual((round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)), (0, -1, 2, 0))
        # A near-straight arc with a huge radius stays near its chord.
        x0, y0, x1, y1 = H.svg_path_extent("M0 0a10000 10000 0 0 1 10 0")
        self.assertLess(abs(y0), 0.01)
        self.assertEqual((round(x0, 3), round(x1, 3), round(y1, 3)), (0, 10, 0))

    def test_in_box_catches_a_transform_left_unapplied(self):
        inside = "M146.856 352.767c-21.387 1.87-42.861 3.232-64.268 4.365z"
        self.assertTrue(H.svg_path_in_box(inside))
        self.assertFalse(H.svg_path_in_box("M1221.178 1253.377c-21.387 1.87-42.861 3.232-64.268 4.365z"))
        self.assertFalse(H.svg_path_in_box("not a path"))
        # Within the margin is inside; past it is not.
        self.assertTrue(H.svg_path_in_box("M-2 0L500 504"))
        self.assertFalse(H.svg_path_in_box("M-6 0L500 500"))


if __name__ == "__main__":
    unittest.main()
