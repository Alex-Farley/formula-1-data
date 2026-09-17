# -*- coding: utf-8 -*-
"""
The two harvest rules that decide which Wikipedia page and which file
describe a chassis, tested directly.

WHY THIS FILE EXISTS
    Both rules run only against the live API, so the committed harvest is
    the only other place their behaviour shows - and a harvest file records
    what was accepted, not what was refused for the right reason. Every case
    below is one the committed logs actually met.

    python3 -m unittest discover -s tests
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), "tools"))

import wikimedia_images as WI  # noqa: E402
import wikispec_fetch as WS  # noqa: E402

FERRARI = ("Ferrari", "Scuderia Ferrari")


class NameIsForm(unittest.TestCase):
    """Check 3 in tools/wikispec_fetch.py."""

    def accepts(self, title, full, name, cons):
        self.assertTrue(WS.name_is_form(title, full, name, cons),
                        f"{title!r} should be a form of {full!r}")

    def refuses(self, title, full, name, cons):
        self.assertFalse(WS.name_is_form(title, full, name, cons),
                         f"{title!r} should not be a form of {full!r}")

    def test_a_word_between_constructor_and_designation(self):
        self.accepts("Ferrari Tipo 500", "Ferrari 500", "500", FERRARI)
        self.accepts("Red Bull Racing RB19", "Red Bull RB19", "RB19",
                     ("Red Bull", "Red Bull Racing"))
        self.accepts("Scuderia Toro Rosso STR13", "Toro Rosso STR13", "STR13",
                     ("Toro Rosso", "Scuderia Toro Rosso"))

    def test_the_constructor_spelled_differently(self):
        # "Benz" is taken from the page's own infobox, not assumed.
        self.assertTrue(WS.name_is_form(
            "Mercedes-Benz W196", "Mercedes W196", "W196",
            ("Mercedes", "Mercedes AMG F1"), "Mercedes-Benz"))
        self.refuses("Mercedes-Benz W196", "Mercedes W196", "W196",
                     ("Mercedes", "Mercedes AMG F1"))
        # The head matches in either direction: HRT's full name is longer.
        self.accepts("Hispania F110", "HRT F110", "F110",
                     ("HRT", "Hispania Racing Team"))

    def test_a_suffix_after_the_designation(self):
        self.accepts("Mercedes-AMG F1 W11 EQ Performance", "Mercedes F1 W11",
                     "F1 W11", ("Mercedes", "Mercedes AMG F1"))

    def test_the_family_pages_the_old_rule_accepted(self):
        self.accepts("Lotus 72", "Lotus 72C", "72C", ("Lotus", "Team Lotus"))
        self.accepts("Toro_Rosso_STR2", "Toro Rosso STR2B", "STR2B",
                     ("Toro Rosso", "Scuderia Toro Rosso"))
        self.accepts("AGS JH25B", "AGS JH25", "JH25", ("AGS", "AGS"))
        self.accepts("Ferrari 150º Italia", "Ferrari 150° Italia",
                     "150° Italia", FERRARI)

    def test_the_title_is_the_full_name(self):
        self.accepts("Adams", "Adams", "Adams", ("Adams", "Adams"))

    def test_a_different_car_of_the_same_constructor(self):
        # The case the check was written for.
        self.refuses("Ferrari 312T", "Ferrari 312/66", "312/66", FERRARI)
        self.refuses("Brabham BT46", "Brabham BT16", "BT16",
                     ("Brabham", "Motor Racing Developments"))

    def test_a_different_constructor(self):
        self.refuses("BAR 01", "Boro 001", "1", ("Boro", "Boro"))
        self.refuses("ATA 100", "ATS 100", "100",
                     ("ATS", "Automobili Turismo e Sport"))
        self.refuses("Vanwall Grand Prix", "Vanwall VW 5", "VW 5",
                     ("Vanwall", "Vanwall"))

    def test_a_namesake(self):
        self.refuses("Ansel Adams", "Adams", "Adams", ("Adams", "Adams"))
        self.refuses("Lou Diamond Phillips", "Phillips", "Phillips",
                     ("Phillips", "Phillips"))

    def test_a_short_designation_is_not_read_into_a_word(self):
        self.refuses("English Racing Automobiles", "ERA A", "A",
                     ("ERA", "English Racing Automobiles"))
        # F1DB's short name is "1"; the full name's "001" is what is matched.
        self.refuses("Boron-11 nuclear magnetic resonance spectroscopy",
                     "Boro 001", "1", ("Boro", "Boro"))

    def test_only_filler_stands_between_constructor_and_designation(self):
        lotus = ("Lotus", "Team Lotus")
        self.refuses("Lotus 18/21", "Lotus 21", "21", lotus)
        self.refuses("Lotus 25/33", "Lotus 33", "33", lotus)
        self.refuses("Lotus Elan 25", "Lotus 25", "25", lotus)
        self.refuses("Lotus Seven 21", "Lotus 21", "21", lotus)
        self.refuses("March 701 721", "March 721", "721", ("March", "March"))
        alfa = ("Alfa Romeo", "Alfa Romeo Racing")
        self.accepts("Alfa Romeo 158/159 Alfetta", "Alfa Romeo 158", "158",
                     alfa)
        self.refuses("Era of Hope A", "ERA A", "A",
                     ("ERA", "English Racing Automobiles"))
        self.refuses("Connaught Place C", "Connaught C", "C",
                     ("Connaught", "Connaught Engineering"))
        self.accepts("Connaught Type C", "Connaught C", "C",
                     ("Connaught", "Connaught Engineering"))
        # A digit in the infobox's constructor is never filler.
        self.assertFalse(WS.name_is_form(
            "Lotus 18 21", "Lotus 21", "21", lotus, "Lotus 18"))

    def test_a_list_of_models_counts_for_each_car_it_lists(self):
        alfa = ("Alfa Romeo", "Alfa Romeo Racing")
        alfas = {"158", "159", "177", "179"}
        for car in ("158", "159"):
            self.assertTrue(WS.name_is_form(
                "Alfa Romeo 158/159 Alfetta", "Alfa Romeo " + car, car, alfa,
                None, alfas), car)
        # Without the constructor's designations nothing is a list.
        self.refuses("Alfa Romeo 158/159 Alfetta", "Alfa Romeo 159", "159",
                     alfa)
        # An item that is not one of the constructor's cars: not a list.
        self.assertFalse(WS.name_is_form(
            "Alfa Romeo 105/115 Series Coupes", "Alfa Romeo 115", "115",
            alfa, None, alfas | {"115"}))
        # The joined word is itself a car: it names that car, not a list.
        lotus = ("Lotus", "Team Lotus")
        lotuses = {"18", "21", "1821", "25"}
        self.assertFalse(WS.name_is_form(
            "Lotus 18/21", "Lotus 21", "21", lotus, None, lotuses))
        self.assertTrue(WS.name_is_form(
            "Lotus 18/21", "Lotus 18/21", "18/21", lotus, None, lotuses))
        # A listed car is matched exactly, never as a family cut.
        self.assertFalse(WS.name_is_form(
            "Ferrari 312/158", "Ferrari 312T", "312T", FERRARI, None,
            {"312", "158", "312t"}))
        # The list does not loosen the head: filler rules still apply.
        self.assertFalse(WS.name_is_form(
            "Alfa Romeo Giulia 158/159", "Alfa Romeo 159", "159", alfa,
            None, alfas))

    def test_a_family_is_cut_only_where_digits_meet_letters(self):
        # Real titles the first draft of this rule admitted; check 2 refused
        # each, but check 3 must hold on its own.
        for f10 in ("Ferrari 156 F1", "Ferrari 246 F1", "Ferrari 375 F1"):
            self.refuses(f10, "Ferrari F10", "F10", FERRARI)
        self.refuses("Ferrari SF-24", "Ferrari 246", "246", FERRARI)
        self.refuses("Ferrari Dino 2", "Ferrari 246", "246", FERRARI)
        self.refuses("Lotus 1-2-3", "Lotus 33", "33", ("Lotus", "Team Lotus"))
        self.refuses("Ferrari 156 F1", "Ferrari F1-75", "F1-75", FERRARI)
        self.refuses("Ferrari 125 S", "Ferrari SF-23", "SF-23", FERRARI)
        # The cost: a family cut after a longer head is refused even where
        # the family is right. Check 2 refused this page anyway (debut 1939).
        self.refuses("Maserati 4CL and 4CLT", "Maserati 4CLT/48", "4CLT/48",
                     ("Maserati", "Officine Alfieri Maserati"))
        self.accepts("Ferrari 312T", "Ferrari 312T2", "312T2", FERRARI)
        # Cut at a break the designation itself has, or between letters.
        self.accepts("Ferrari 312", "Ferrari 312/66", "312/66", FERRARI)
        self.accepts("Lotus 18", "Lotus 18/21", "18/21",
                     ("Lotus", "Team Lotus"))
        self.accepts("Ferrari 126C", "Ferrari 126CK", "126CK", FERRARI)
        self.accepts("Spyker F8-VII", "Spyker F8-VIIB", "F8-VIIB",
                     ("Spyker", "Spyker F1 Team"))

    def test_the_constructor_is_compared_in_whole_words(self):
        self.refuses("Barcelona 007", "BAR 007", "007",
                     ("BAR", "British American Racing"))
        self.accepts("British American Racing 007", "BAR 007", "007",
                     ("BAR", "British American Racing"))

    def test_no_constructor_names_refuses_all_but_the_full_name(self):
        self.refuses("Ferrari Tipo 500", "Ferrari 500", "500", ())


class BodyCandidates(unittest.TestCase):
    """Which body image may stand in for a missing lead image."""

    def test_only_a_file_that_names_the_car(self):
        files = ["File:Flag of the United Kingdom (1-2).svg",
                 "File:EXPO 67 British Racing Motors display.jpg",
                 "File:BRM H16 engine.jpg"]
        self.assertEqual(WI.body_candidates(files, "BRM P115", "brm-p115"), [])
        self.assertEqual(
            WI.body_candidates(["File:Renault 4 1961.jpg"], "Cooper T58",
                               "cooper-t58"), [])

    def test_a_named_photograph_is_taken(self):
        files = ["File:Flag of Brazil.svg", "File:Andrea Moda S921.jpg"]
        self.assertEqual(
            WI.body_candidates(files, "Andrea Moda S921", "andrea-moda-s921"),
            ["File:Andrea Moda S921.jpg"])

    def test_a_vector_file_is_never_a_candidate(self):
        self.assertEqual(
            WI.body_candidates(["File:Andrea Moda S921 livery.svg"],
                               "Andrea Moda S921", "andrea-moda-s921"), [])

    def test_a_name_starts_at_a_word(self):
        for f, article, ids in (("File:Camera Angle.jpg", "ERA A", "era-a"),
                                ("File:Tram 01.jpg", "RAM 01", "ram-01"),
                                ("File:Marlboro 001 livery.jpg", "Boro 001",
                                 "boro-001")):
            self.assertFalse(WI.names_car(f, article, ids), f)
        self.assertTrue(WI.names_car("File:2006FOS 1991BenettonB191.jpg",
                                     "Benetton B191", "benetton-b191"))

    def test_a_longer_designation_does_not_name_the_car(self):
        self.assertEqual(
            WI.body_candidates(["File:Brabham BT46 Lauda.jpg"], "Brabham BT4",
                               "brabham-bt4"), [])
        self.assertTrue(WI.names_car(
            "File:2020 Formula One tests Barcelona, Alfa Romeo C39, "
            "Räikkönen.jpg", "Alfa Romeo Racing C39", "alfa-romeo-c39"))

    def test_title_order(self):
        files = ["File:Lotus 72 b.jpg", "File:Lotus 72 a.JPG"]
        self.assertEqual(WI.body_candidates(files, "Lotus 72", "lotus-72"),
                         ["File:Lotus 72 a.JPG", "File:Lotus 72 b.jpg"])

    def test_every_chassis_of_a_family_article_is_a_name(self):
        # car_specs.txt joins a family's chassis ids with "+".
        # The article title is chosen so only the second id can match.
        self.assertTrue(WI.names_car("File:Ferrari 312T2 Monza.jpg",
                                     "Ferrari family",
                                     "ferrari-500+ferrari-312t2"))
        self.assertFalse(WI.names_car("File:Niki Lauda 1976.jpg",
                                      "Ferrari family",
                                      "ferrari-500+ferrari-312t2"))



class CategoryTail(unittest.TestCase):
    """Check a of the category route in tools/wikimedia_images.py (AF-42).

    Every case is a title Commons' category search offered for a chassis
    with no article."""

    MERCEDES = ("Mercedes", "Mercedes AMG F1")

    def accepts(self, title, full, name, cons):
        self.assertIsNotNone(WI.category_tail(title, full, name, cons),
                             f"{title!r} should name {full!r}")

    def refuses(self, title, full, name, cons):
        self.assertIsNone(WI.category_tail(title, full, name, cons),
                          f"{title!r} should not name {full!r}")

    def test_the_exact_name_and_a_closed_space(self):
        self.accepts("Category:Vanwall VW5", "Vanwall VW 5", "VW 5",
                     ("Vanwall", "Vanwall"))
        self.accepts("Category:Talbot-Lago T26 C", "Talbot-Lago T26C",
                     "T26C", ("Talbot-Lago", "Talbot-Lago"))

    def test_the_constructors_full_name_and_a_season_name(self):
        self.accepts("Category:Mercedes-AMG F1 W12 E Performance",
                     "Mercedes F1 W12", "F1 W12", self.MERCEDES)
        self.accepts("Category:Mercedes AMG F1 W08 EQ Power+",
                     "Mercedes F1 W08 EQ Power+", "F1 W08 EQ Power+",
                     self.MERCEDES)

    def test_a_tail_that_names_another_car(self):
        self.refuses("Category:Ferrari 125 S", "Ferrari 125", "125", FERRARI)
        self.refuses("Category:Ferrari 275 GTB", "Ferrari 275", "275",
                     FERRARI)
        self.refuses("Category:Talbot-Lago T26C-GS", "Talbot-Lago T26C",
                     "T26C", ("Talbot-Lago", "Talbot-Lago"))
        self.accepts("Category:Ferrari 125 F1", "Ferrari 125", "125",
                     FERRARI)

    def test_no_variant_letter_and_no_family_cut(self):
        march = ("March", "March Engineering")
        self.refuses("Category:March 721X", "March 721", "721", march)
        self.refuses("Category:March 721", "March 721X", "721X", march)
        self.refuses("Category:Matra MS120", "Matra MS120C", "MS120C",
                     ("Matra", "Equipe Matra Sports"))

    def test_a_show_car_or_replica_title(self):
        rb = ("Red Bull", "Red Bull Racing")
        self.refuses("Category:Red Bull RB22 (Formula One show car)",
                     "Red Bull RB22", "RB22", rb)
        self.refuses("Category:Red Bull RB22 (F1 replica)",
                     "Red Bull RB22", "RB22", rb)
        self.refuses("Category:Red Bull RB22 replica", "Red Bull RB22",
                     "RB22", rb)

    def test_the_constructor_is_named_whole(self):
        self.refuses("Category:Red RB22", "Red Bull RB22", "RB22",
                     ("Red Bull", "Red Bull Racing"))
        self.refuses("Category:Aston NB42", "Aston Butterworth NB42", "NB42",
                     ("Aston Butterworth", "Aston Butterworth"))
        self.accepts("Category:Lotus T128 (Formula One car)", "Lotus T128",
                     "T128", ("Lotus Racing", "Lotus Racing"))
        self.accepts("Category:Red Bull Racing RB22", "Red Bull RB22",
                     "RB22", ("Red Bull", "Red Bull Racing"))

    def test_a_file_naming_a_sibling_chassis(self):
        others = [("coloni-fc188b", "Coloni FC188B")]
        self.assertEqual(WI.file_candidates(
            [("File:Coloni FC188B 2008 Donington Park.jpg", 0),
             ("File:Coloni FC188 1988.jpg", 0)],
            "Coloni FC188", "coloni-fc188", others),
            ["File:Coloni FC188 1988.jpg"])
        self.assertEqual(WI.file_candidates(
            [("File:Coloni FC188B 2008 Donington Park.jpg", 0)],
            "Coloni FC188B", "coloni-fc188b", [("coloni-fc188", "Coloni FC188")]),
            ["File:Coloni FC188B 2008 Donington Park.jpg"])
        self.assertEqual(WI.file_candidates(
            [("File:Talbot-Lago T26C-DA 1949.jpg", 0)],
            "Talbot-Lago T26C-DA", "talbot-lago-t26c-da",
            [("talbot-lago-t26c", "Talbot-Lago T26C")]),
            ["File:Talbot-Lago T26C-DA 1949.jpg"])
        self.assertEqual(WI.file_candidates(
            [("File:Talbot-Lago T26C-DA 1949.jpg", 0)],
            "Talbot-Lago T26C", "talbot-lago-t26c",
            [("talbot-lago-t26c-da", "Talbot-Lago T26C-DA")]), [])
        self.assertEqual(WI.file_candidates(
            [("File:BAR 006 2004.jpg", 0)], "BAR 006", "bar-007",
            [("bar-006", "BAR 006")]), [])

    def test_a_bracket_must_say_formula_one(self):
        lotus = ("Lotus", "Lotus Racing")
        self.accepts("Category:Lotus T128 (Formula One car)", "Lotus T128",
                     "T128", lotus)
        self.refuses("Category:Lotus T128 (Le Mans Prototype)",
                     "Lotus T128", "T128", lotus)

    def test_one_cars_appearances_are_not_the_car(self):
        self.refuses("Category:Vanwall VW5 of Stirling Moss in 1957",
                     "Vanwall VW 5", "VW 5", ("Vanwall", "Vanwall"))

    def test_the_replica_rule(self):
        self.assertTrue(WI.REPLICA.search(
            "File:Replica of Red Bull Racing RB19 at a show.jpg"))
        self.assertTrue(WI.REPLICA.search("File:Lotus 72E 1:43 model.jpg"))
        self.assertTrue(WI.REPLICA.search(
            "File:Hart 415T engine in Lola THL1.JPG"))
        self.assertTrue(WI.REPLICA.search(
            "File:Fatal accident at 1973 Dutch Grand Prix (3).jpg"))
        self.assertFalse(WI.REPLICA.search("File:Vanwall VW5 Donington.jpg"))
        self.assertFalse(WI.REPLICA.search(
            "File:Mercedes-AMG F1 W17 E Performance of Andrea Kimi "
            "Antonelli (028A8052).jpg"))


if __name__ == "__main__":
    unittest.main()
