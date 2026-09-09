# -*- coding: utf-8 -*-
"""
The name matching, tested directly.

WHY THIS FILE EXISTS
    verify.py checks the DATABASE. It is thorough about it, and it has caught
    real defects — but it can only speak after a full rebuild, and only about
    outcomes it can see in a table. The functions below are where the subtle
    mistakes actually live, and the project's own history says so: stripping
    'Jr' gave Nelson Piquet Jr his father's 23 wins, admitting Bill Moss made
    'Moss' ambiguous and stopped the 1955 British Grand Prix resolving, and a
    constructor lookup put Wilson Fittipaldi's Brabham results onto Emerson.

    Every one of those is a pure function with a known right answer, and every
    one of them was found downstream instead of here.

STDLIB ONLY
    unittest, not pytest. The build has no dependencies and this must not be
    the thing that gives it one.

    python3 -m unittest discover -s tests
"""
import unittest

import data.harvest as HV


class Norm(unittest.TestCase):
    """_norm folds a name for matching. What it drops is the whole design."""

    def test_accents_are_folded(self):
        self.assertEqual(HV._norm("Kimi Räikkönen"), "kimi raikkonen")
        self.assertEqual(HV._norm("José Froilán González"), "jose froilan gonzalez")

    def test_case_and_spacing_are_folded(self):
        self.assertEqual(HV._norm("  Ayrton   SENNA  "), "ayrton senna")

    def test_punctuation_is_dropped(self):
        self.assertEqual(HV._norm("Jean-Pierre Jarier"), "jean pierre jarier")
        self.assertEqual(HV._norm("A.J. Foyt"), "aj foyt")
        self.assertEqual(HV._norm("Jacques O'Brien"), "jacques obrien")

    def test_the_honorific_goes(self):
        self.assertEqual(HV._norm("Sir Jackie Stewart"), HV._norm("Jackie Stewart"))
        self.assertEqual(HV._norm("Sir Lewis Hamilton"), HV._norm("Lewis Hamilton"))

    def test_but_jr_stays(self):
        """The one that cost 23 wins.

        'Jr' is not an honorific, it is the only thing separating two drivers.
        Folding it hands the son his father's record, and nothing downstream
        can tell that it happened — both names resolve, to the same row.
        """
        self.assertNotEqual(HV._norm("Nelson Piquet"), HV._norm("Nelson Piquet Jr"))
        self.assertNotEqual(HV._norm("Nelson Piquet"), HV._norm("Nelson Piquet Jr."))

    def test_sir_only_goes_as_a_prefix(self):
        """A name that merely contains the letters must survive intact."""
        self.assertIn("sirotkin", HV._norm("Sergey Sirotkin"))


class SplitNames(unittest.TestCase):
    """A shared pole or fastest lap arrives as 'A / B'."""

    def test_one_name(self):
        self.assertEqual(HV.split_names("Stirling Moss"), ["Stirling Moss"])

    def test_a_shared_lap(self):
        self.assertEqual(
            HV.split_names("Stirling Moss / Bruce McLaren"),
            ["Stirling Moss", "Bruce McLaren"],
        )

    def test_seven_of_them(self):
        """The 1954 British Grand Prix, where seven drivers tied on 1:50.0."""
        self.assertEqual(len(HV.split_names("A / B / C / D / E / F / G")), 7)

    def test_nothing_is_not_one_empty_name(self):
        self.assertEqual(HV.split_names(""), [])
        self.assertEqual(HV.split_names(None), [])
        self.assertEqual(HV.split_names(" / "), [])


class VenueNorm(unittest.TestCase):
    """_vnorm folds a venue. It must NOT fold what _norm folds."""

    def test_hyphens_are_kept(self):
        """Reims-Gueux and Dijon-Prenois are hyphenated names, not two words.

        _norm turns a hyphen into a space; doing that here would collide real
        venues, which is why there are two functions and not one.
        """
        self.assertIn("-", HV._vnorm("Reims-Gueux"))
        self.assertNotEqual(HV._vnorm("Reims-Gueux"), HV._vnorm("Reims Gueux"))

    def test_a_trailing_town_is_dropped(self):
        self.assertEqual(HV._vnorm("Hungaroring, Mogyorod"), HV._vnorm("Hungaroring"))

    def test_accents_still_go(self):
        self.assertEqual(HV._vnorm("Montjuïc"), "montjuic")


class ParseRounds(unittest.TestCase):
    """Round ranges out of F1DB's entry lists. Chassis coverage rides on these."""

    def test_a_single_round(self):
        self.assertEqual(HV.parse_rounds("3"), {3})

    def test_a_range_includes_both_ends(self):
        self.assertEqual(HV.parse_rounds("1-4"), {1, 2, 3, 4})

    def test_a_mixture(self):
        self.assertEqual(HV.parse_rounds("1,4-5"), {1, 4, 5})

    def test_whitespace_is_tolerated(self):
        self.assertEqual(HV.parse_rounds(" 2 , 6 - 7 "), {2, 6, 7})

    def test_nothing_is_an_empty_set_not_a_full_season(self):
        """An empty spec must not read as 'every round'.

        These sets decide which rounds a chassis is credited with, so the
        difference between {} and {1..24} is a season of results.
        """
        self.assertEqual(HV.parse_rounds(""), set())
        self.assertEqual(HV.parse_rounds(None), set())
        self.assertEqual(HV.parse_rounds(" , "), set())


class DriverAliases(unittest.TestCase):
    """The declared exceptions, which exist to stop a widened match eating them."""

    def test_the_aliases_are_the_three_declared(self):
        self.assertEqual(
            set(HV.F1DB_DRIVER_ALIASES),
            {"jj-lehto", "carlos-sainz-jr", "guanyu-zhou"},
        )

    def test_emilio_de_villota_is_never_maria(self):
        """Father and daughter. Joining them is the failure this guards.

        Maria de Villota tested for Marussia and never entered a Grand Prix;
        Emilio entered fifteen. A name-based resolver will happily merge them,
        so the non-mapping is declared and asserted rather than assumed.
        """
        self.assertIn("emilio-de-villota", HV.F1DB_DRIVER_NON_MAPPING)
        self.assertNotIn("emilio-de-villota", HV.F1DB_DRIVER_ALIASES)


if __name__ == "__main__":
    unittest.main()
