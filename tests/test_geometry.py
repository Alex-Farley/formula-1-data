# -*- coding: utf-8 -*-
"""
The lap-closure arithmetic, tested directly.

WHY THIS FILE EXISTS
    _lap_topology decides whether a traced circuit forms one closed lap, and
    verify.py reports its answer for 25 circuits. That report is the only thing
    standing between the front end's traced-centreline drawing and a trace
    with a hole in it — and the report is a count, so a change that quietly
    made everything "close" would read as an improvement. These tests give
    the function inputs whose right answer is known by construction.

    _haversine is checked against a figure that does not come from the same
    arithmetic: a degree of latitude on the sphere it names.

    python3 -m unittest discover -s tests
"""
import math
import unittest

import build

# A square, about 111 m on a side, as [lon, lat] — the order OSM uses and the
# order _lap_topology reads.
P0 = [0.0, 0.0]
P1 = [0.001, 0.0]
P2 = [0.001, 0.001]
P3 = [0.0, 0.001]
FAR = [0.5, 0.5]

DEGREE_M = math.radians(1) * 6371008.8   # ~111 194.9 m


class Haversine(unittest.TestCase):
    def test_a_degree_of_latitude(self):
        self.assertAlmostEqual(build._haversine((0, 0), (1, 0)), DEGREE_M, places=3)

    def test_it_is_symmetric(self):
        self.assertAlmostEqual(
            build._haversine((51.1, -1.03), (44.34, 11.71)),
            build._haversine((44.34, 11.71), (51.1, -1.03)),
            places=6,
        )

    def test_no_distance_to_itself(self):
        self.assertEqual(build._haversine((45.62, 9.28), (45.62, 9.28)), 0.0)

    def test_longitude_shrinks_with_latitude(self):
        """A degree of longitude is a degree of latitude only at the equator."""
        at_equator = build._haversine((0, 0), (0, 1))
        at_sixty = build._haversine((60, 0), (60, 1))
        self.assertAlmostEqual(at_equator, DEGREE_M, places=3)
        self.assertAlmostEqual(at_sixty / at_equator, 0.5, places=3)


class LapTopology(unittest.TestCase):
    def test_one_closed_way_is_a_lap(self):
        """A circuit traced as a single closed way.

        This is the case the naive index-by-way check got wrong: the way is met
        by its OWN other end, and excluding that pair reports two loose ends on
        a perfectly good loop.
        """
        closes, loose, used, walked = build._lap_topology([[P0, P1, P2, P3, P0]])
        self.assertTrue(closes)
        self.assertEqual(loose, 0)
        self.assertEqual(used, 1)
        self.assertAlmostEqual(walked, 4 * DEGREE_M / 1000, places=1)

    def test_four_ways_end_to_end(self):
        closes, loose, used, _ = build._lap_topology(
            [[P0, P1], [P1, P2], [P2, P3], [P3, P0]])
        self.assertTrue(closes)
        self.assertEqual(loose, 0)
        self.assertEqual(used, 4)

    def test_a_way_pointing_the_wrong_way_is_reversed(self):
        """[P2, P1] runs against the direction of travel and must still join."""
        closes, loose, used, _ = build._lap_topology(
            [[P0, P1], [P2, P1], [P2, P3], [P3, P0]])
        self.assertTrue(closes)
        self.assertEqual(used, 4)

    def test_the_members_are_unordered(self):
        """An OSM relation lists its ways in no particular order.

        That is the entire reason this function exists rather than a comparison
        of the first coordinate with the last, so it is asserted rather than
        assumed.
        """
        shuffled = [[P2, P3], [P0, P1], [P3, P0], [P1, P2]]
        closes, loose, used, _ = build._lap_topology(shuffled)
        self.assertTrue(closes)
        self.assertEqual(used, 4)

    def test_a_detached_way_leaves_four_loose_ends(self):
        """Monaco's failure, in miniature.

        A way that reaches nothing is loose at BOTH its ends, and it also
        orphans the two ends it should have met — four, not two. Counting two
        here would mean the function had started pairing ends it cannot see.
        """
        closes, loose, used, _ = build._lap_topology(
            [[P0, P1], [P1, P2], [P2, P3], [FAR, [0.5001, 0.5]]])
        self.assertFalse(closes)
        self.assertEqual(loose, 4)
        self.assertLess(used, 4)

    def test_one_hole_in_an_otherwise_whole_lap_is_two_loose_ends(self):
        """The last way starts 3.3 m from where the previous one ended."""
        gap = [0.0, 0.00097]           # ~3.3 m short of P3
        closes, loose, used, _ = build._lap_topology(
            [[P0, P1], [P1, P2], [P2, P3], [gap, P0]])
        self.assertFalse(closes)
        self.assertEqual(loose, 2)

    def test_an_open_chain_does_not_close(self):
        """Every end meets another, but the walk does not return to the start."""
        closes, _, used, _ = build._lap_topology([[P0, P1], [P1, P2], [P2, P3]])
        self.assertFalse(closes)
        self.assertEqual(used, 3)

    def test_the_join_tolerance_separates_a_join_from_a_hole(self):
        """One metre, and why it is one metre.

        Ways in a relation share their junction nodes, so a real join is
        identical rather than close. The smallest genuine hole in the traces
        held here is 5.4 m. A gap between those two figures must read as a
        hole at the default and as a join only if somebody loosens it.
        """
        gap = [0.0, 0.00003]           # ~3.3 m from P0
        lines = [[gap, P1], [P1, P2], [P2, P3], [P3, P0]]
        self.assertFalse(build._lap_topology(lines)[0])
        self.assertTrue(build._lap_topology(lines, join_m=30)[0])


if __name__ == "__main__":
    unittest.main()
