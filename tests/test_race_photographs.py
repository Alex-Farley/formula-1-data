# -*- coding: utf-8 -*-
"""
The race route's rules (PD-64), tested directly.

WHY THIS FILE EXISTS
    The harvest applies these against the live Commons API, and build.py and
    verify.py re-apply them only to the rows the last harvest kept, so a
    regression in a pattern would show only after a two-hour re-harvest.
    Every case below is one a run of the route actually met.

    python3 -m unittest discover -s tests
"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))

from data import harvest as H  # noqa: E402
import wikimedia_images as WI  # noqa: E402


class TheCategoryIsTheRaces(unittest.TestCase):
    def test_season_and_name_exactly(self):
        self.assertEqual(H.race_category(1967, "Dutch Grand Prix"),
                         "Category:1967 Dutch Grand Prix")

    def test_filed_as_that_seasons_formula_one(self):
        self.assertEqual(H.race_category_parents(1994),
                         ("Category:1994 Formula One races",
                          "Category:1994 in Formula One"))


class NotTakenAtTheRace(unittest.TestCase):
    """The narrowing rules, on the files the first runs took."""

    def elsewhere(self, name, year):
        return bool(H.RACE_PHOTOGRAPH_ELSEWHERE.search(name)
                    or H.race_file_names_another_season(name, year))

    def test_what_the_runs_refused(self):
        for name, year in (
                ("File:French GP 1995 winner's trophy 2019 Michael Schumacher "
                 "Private Collection.jpg", 1995),
                ("File:1988F1JapaneseGrandPrixWinnerTrophyHCH.jpg", 1988),
                ("File:Wg ticket 1973.jpg", 1973),
                ("File:Eintrittskarte GP Europa 1961 1.JPG", 1961),
                ("File:TrackMap.jpg", 1990),
                ("File:Indy500winningcar1956.JPG", 1956),
                ("File:Kurtis Kraft-Offenhauser 1950 Indy 500 Winner - "
                 "Johnnie Parsons.jpg", 1950),
                ("File:1957 Indy 500 Pace Car - Mercury Turnpike Cruiser.jpg",
                 1957),
                ("File:Rundentabelle GP Monaco 1971.jpg", 1971),
                ("File:Car and Driver August 1962 cover.jpg", 1962),
                ("File:Clay Regazzoni 1975 Watkins Glen 5.jpg", 1974)):
            self.assertTrue(self.elsewhere(name, year), name)

    def test_what_they_kept(self):
        for name, year in (
                ("File:Clark at 1967 Dutch Grand Prix (3).jpg", 1967),
                ("File:Grand Prix te Zandvoort, Bestanddeelnr 920-3789.jpg",
                 1967),
                ("File:Lewis Hamilton (35871613510).jpg", 2017),
                ("File:Ferrari F1-2000 Barrichello.jpg", 2000),
                ("File:Damon Hill Williams FW18 2010 Bahrain.jpg", 2010)):
            self.assertFalse(self.elsewhere(name, year), name)


class OnePhotographOnce(unittest.TestCase):
    def test_versions_share_a_key(self):
        for a, b in (
                ("File:Alonso Bahrain 2010.jpg",
                 "File:Alonso Bahrain 2010 (cropped).jpg"),
                ("File:A Bestanddeelnr 909-5855 (cropped).jpg",
                 "File:A Bestanddeelnr 909-5855 (cropped2).jpg"),
                ("File:B Bestanddeelnr 911-3161.jpg",
                 "File:B Bestanddeelnr 911-3161 restored.jpg"),
                ("File:Felipe Massa 2010 Italy 2.jpg",
                 "File:Felipe Massa 2010 Italy 2(cropped).jpg")):
            self.assertEqual(H.race_twin_key(a), H.race_twin_key(b), (a, b))

    def test_numbered_shots_are_not_versions(self):
        self.assertNotEqual(H.race_twin_key("File:Surtees at 1967 Dutch Grand Prix.jpg"),
                            H.race_twin_key("File:Surtees at 1967 Dutch Grand Prix (2).jpg"))

    def test_the_harvest_keeps_a_version_and_logs_the_rest(self):
        keep, passed = WI.race_candidates(
            ["File:A 909-5855.jpg", "File:A 909-5855 (cropped).jpg",
             "File:A 909-5855 (cropped2).jpg", "File:Map.png", "File:C.jpg"],
            1967, H)
        self.assertEqual(keep, ["File:A 909-5855 (cropped).jpg", "File:C.jpg"])
        self.assertEqual(sorted(f for f, _why in passed),
                         ["File:A 909-5855 (cropped2).jpg",
                          "File:A 909-5855.jpg", "File:Map.png"])


class TheCreditNamesSomebody(unittest.TestCase):
    def test_boilerplate(self):
        for text in ("Own work", " own work ",
                     "I, the copyright holder of this work, hereby publish it "
                     "under the following license:"):
            self.assertTrue(H.CREDIT_BOILERPLATE.match(text), text)
        for text in ("Landmensch", "Own work by Jürgen Weidanz",
                     "Flickr: Dustin Halcon"):
            self.assertFalse(H.CREDIT_BOILERPLATE.match(text), text)

    def test_the_artist_first_as_the_page_shows_it(self):
        self.assertEqual(H.credit_shown("Own work", "Landmensch"), "Own work")
        self.assertEqual(H.credit_shown(None, "Landmensch"), "Landmensch")
        self.assertIsNone(H.credit_shown(" ", ""))

    def test_a_grant_in_doubt(self):
        self.assertTrue(H.CREDIT_PERMISSION.search(
            "uploaded with permission given by original author"))
        self.assertFalse(H.CREDIT_PERMISSION.search("Eric Koch for Anefo"))

    def test_the_harvest_reads_boilerplate_as_empty(self):
        meta = {"host": WI.COMMONS_HOST, "namespace": 6, "repository": "local",
                "licence": "CC BY-SA 4.0", "licence_url": None,
                "artist": "Own work", "credit": "Landmensch",
                "attribution_required": "true",
                "description_url": "https://commons.wikimedia.org/wiki/File:X.jpg",
                "thumb_url": None, "width": 800, "height": 600}
        row = WI.admit("1994-09", "File:X.jpg", meta, "", [], route="race")
        self.assertEqual((row["artist"], row["credit"], row["name_matches"]),
                         (None, "Landmensch", 0))
        log = []
        nobody = dict(meta, credit="Own work")
        self.assertIsNone(WI.admit("1994-09", "File:X.jpg", nobody, "", log,
                                   route="race"))
        self.assertIn("names nobody", log[-1])

    def test_every_route_reads_boilerplate_as_empty(self):
        # CR-70 (4): the rule is admit()'s for every route, not the race
        # route's, so no route's refresh can fail verify.py on "Own work".
        meta = {"host": None, "namespace": None, "repository": "shared",
                "licence": "CC BY-SA 4.0", "licence_url": None,
                "artist": "Koreller", "credit": "Own work",
                "attribution_required": "true",
                "description_url": "https://commons.wikimedia.org/wiki/File:X.jpg",
                "thumb_url": None, "width": 800, "height": 600}
        row = WI.admit("AGS JH22", "File:X.jpg", meta, "", [])
        self.assertEqual((row["artist"], row["credit"]), ("Koreller", None))
        log = []
        nobody = dict(meta, artist="Own work", attribution_required="false")
        self.assertIsNone(WI.admit("AGS JH22", "File:X.jpg", nobody, "", log,
                                   route="circuit"))
        self.assertIn("names nobody", log[-1])


KOLFORN = ("Kolforn ( Kolforn ) I'd appreciate if you could mail me "
           "(someone@example.com) if you want to use this picture out of the "
           "Wikimedia project scope. This file is licensed under the Creative "
           "Commons Attribution-Share Alike 4.0 International license. You "
           "are free: to share - to copy, distribute and transmit the work")


class TheCreditIsAName(unittest.TestCase):
    """CR-70, ruled 2026-10-05: a licence paragraph is cut to the name, and
    the unknown-author value gives way to a credit that names the source."""

    def test_a_licence_paragraph_is_cut_to_the_name(self):
        self.assertEqual(H.credit_without_licence(KOLFORN), "Kolforn")
        self.assertEqual(H.clean_credit(KOLFORN, None), ("Kolforn", None))
        # Nothing before the licence is nothing to show.
        self.assertIsNone(H.credit_without_licence(
            "This file is licensed under the Creative Commons license."))
        # A field without a licence sentence is left whole, brackets and all.
        for text in ("Dan Smith (from the stands)", "Joop van Bilsen / Anefo",
                     None, ""):
            self.assertEqual(H.credit_without_licence(text), text)

    def test_the_unknown_author_value(self):
        for text in ("Unknown author Unknown author", "Unknown author",
                     "Anonymous Unknown author", "Unknown photographer",
                     "Template:Unknown photograph", "unknown", "Anonymous",
                     "Unknown source Unknown source"):
            self.assertTrue(H.CREDIT_UNKNOWN.match(text), text)
        for text in ("sconosciuta", "Autore sconosciuto", "Desconocido",
                     "onbekend"):
            self.assertTrue(H.CREDIT_UNKNOWN.match(text), text)
        for text in ("Unknown photographer from Anefo Fotograaf Onbekend "
                     "for Anefo", "Anonymous Studio", "El Gráfico"):
            self.assertFalse(H.CREDIT_UNKNOWN.match(text), text)

    def test_the_source_is_shown_where_there_is_one(self):
        self.assertEqual(
            H.clean_credit("Unknown author Unknown author", "El Gráfico"),
            (None, "El Gráfico"))
        # A bare URL is a credit (CR-70 (3)).
        self.assertEqual(
            H.clean_credit("Unknown photographer", "http://example.org/a"),
            (None, "http://example.org/a"))

    def test_the_artist_stays_where_the_credit_names_nobody(self):
        # Refusing the file was ruled out; with nothing better, it stays.
        for credit in ("[2]", "Unknown source Unknown source", "Own work",
                       None, "here", "sconosciuta",
                       "Transfered from it.wikipedia",
                       "Transferred from it.wikipedia to Commons."):
            self.assertEqual(
                H.clean_credit("Unknown author Unknown author", credit)[0],
                "Unknown author Unknown author", credit)

    def test_a_transfer_note_with_its_source_names_it(self):
        self.assertEqual(
            H.clean_credit("Unknown author Unknown author",
                           "Transferred from it.wikipedia La Stampa del "
                           "12-09-1976")[0], None)

    def test_a_name_is_left_alone(self):
        for pair in (("Koreller", None), (None, "Los Angeles Daily News"),
                     ("Lothar Spurzem", "[2]"),
                     ("Hans van Dijk for Anefo", "http://proxy.handle.net/x")):
            self.assertEqual(H.clean_credit(*pair), pair)

    def test_a_stray_link_bracket_is_not_part_of_the_credit(self):
        # Commons' own page renders the 1963 Dutch Grand Prix photographs'
        # author with an unpaired "]]" (CR-76).
        self.assertEqual(
            H.clean_credit("Harry Pot for Anefo ]] / neg. stroken, 1945-1989",
                           "http://proxy.handle.net/x"),
            ("Harry Pot for Anefo / neg. stroken, 1945-1989",
             "http://proxy.handle.net/x"))
        self.assertEqual(H.clean_credit("[[ ]]", "Corsa"), (None, "Corsa"))

    def test_the_harvest_applies_it(self):
        meta = {"host": WI.COMMONS_HOST, "namespace": 6, "repository": "local",
                "licence": "Public domain", "licence_url": None,
                "artist": "Unknown author Unknown author",
                "credit": "Corsa no. 354", "attribution_required": "false",
                "description_url": "https://commons.wikimedia.org/wiki/File:X.jpg",
                "thumb_url": None, "width": 800, "height": 600}
        row = WI.admit("1975-01", "File:X.jpg", meta, "", [], route="race")
        self.assertEqual((row["artist"], row["credit"]),
                         (None, "Corsa no. 354"))
        row = WI.admit("1992-09", "File:X.jpg",
                       dict(meta, licence="CC BY-SA 4.0", artist=KOLFORN,
                            credit=None, attribution_required="true"),
                       "", [], route="race")
        self.assertEqual((row["artist"], row["credit"]), ("Kolforn", None))


if __name__ == "__main__":
    unittest.main()
