# -*- coding: utf-8 -*-
"""
The circuit-to-article mapping (VD-47), shown refusing what it exists to
refuse.

WHY THIS FILE EXISTS
    A wrong row in harvest/circuit_articles.txt would put a photograph of the
    wrong place on a circuit page under someone else's name. verify.py checks
    every row on every build, but every build so far has been against a
    correct file, so a check that passed whatever the file held would read
    exactly like one that works. Each test here starts from a small register
    that passes and breaks ONE thing.

    The parser gets the same treatment: the list's cells carry attribute
    prefixes (`bgcolor=FBCEB1|`, `align=center|`) and a pipe inside a link is
    not one of them.

    python3 -m unittest tests.test_circuit_articles
"""
import copy
import importlib.util
import os
import unittest

import verify

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "https://en.wikipedia.org/w/index.php?title=List_of_Formula_One_circuits&oldid=1"


def row(cid, article, linked, country, seasons, held, qid=""):
    return {"circuit_id": cid, "article": article, "section": None,
            "linked_as": linked, "wikidata_id": qid, "country": country,
            "seasons": seasons, "held": str(held), "as_of": "2026-09-27",
            "source": SRC}


REGISTER = {
    "avus": ("Germany", [(1959, "1959-08-02")], 0),
    "monsanto": ("Portugal", [(1959, "1959-08-23")], 0),
    "nordschleife": ("Germany", [(1951, "1951-07-29"), (1952, "1952-08-03")], 0),
    "nurburgring-gp": ("Germany", [(1984, "1984-10-07")], 0),
    "nurburgring-sudschleife": ("Germany", [], 0),
    "monza": ("Italy", [(2025, "2025-09-07"), (2026, "2026-09-06")], 0),
    "miami": ("United States of America", [(2026, "2026-05-03")], 0),
    "singapore": ("Singapore", [(2025, "2025-10-05"), (2026, "2026-10-11")], 0),
}
ROWS = [
    row("avus", "AVUS", "AVUS", "West Germany", "1959", 1),
    row("monsanto", "Circuito de Monsanto", "Circuito de Monsanto", "Portugal", "1959", 1),
    row("nordschleife", "Nürburgring", "Nürburgring", "Germany", "1951-1952,1984", 3),
    row("nurburgring-gp", "Nürburgring", "Nürburgring", "Germany", "1951-1952,1984", 3),
    row("monza", "Monza Circuit", "Monza Circuit", "Italy", "2025-2026", 2, "Q171417"),
    row("miami", "Miami International Autodrome", "Miami International Autodrome",
        "United States", "2026", 1, "Q2"),
    # The 2026 Singapore race is after the list's date, so it is not counted.
    row("singapore", "Marina Bay Street Circuit", "Marina Bay Street Circuit",
        "Singapore", "2025", 1),
]
DECLARED = {
    "splits": [("nordschleife", "nurburgring-gp")],
    "historic": {"West Germany": "Germany"},
    "aliases": {"United States": "United States of America"},
    "gaps": {"nurburgring-sudschleife": "circuit-article-sudschleife"},
    "gap_keys": {"circuit-article-sudschleife"},
    "admitted": {"monza": "Q171417", "miami": "Q1"},
    "wrong": {"miami": ("Q1", "Q2")},
}


def run(rows=ROWS, register=REGISTER, declared=DECLARED):
    return verify.circuit_article_faults(
        copy.deepcopy(rows), copy.deepcopy(register), copy.deepcopy(declared))


def faults(rows=ROWS, register=REGISTER, declared=DECLARED):
    return {k: v for k, v in run(rows, register, declared)[0].items() if v}


def edited(cid, **changes):
    return [dict(r, **changes) if r["circuit_id"] == cid else r for r in ROWS]


class TheCheckRefuses(unittest.TestCase):
    def test_the_fixture_passes(self):
        self.assertEqual(faults(), {})

    def assertRefused(self, found, name):
        self.assertIn(name, found, found)

    def test_a_row_for_the_wrong_country(self):
        # AVUS's only Grand Prix was in 1959, and so was Monsanto's: the
        # country is what tells the two rows apart.
        self.assertRefused(faults(edited("avus", country="Portugal")),
                           "every mapped circuit is in the country its list row names")

    def test_a_season_the_circuit_did_not_hold(self):
        self.assertRefused(faults(edited("monsanto", seasons="1958")),
                           "every list row's seasons and races are its circuits' own")

    def test_a_race_count_that_does_not_add_up(self):
        self.assertRefused(faults(edited("monza", held="3")),
                           "every list row's seasons and races are its circuits' own")

    def test_one_loop_of_a_split_alone(self):
        rows = [r for r in ROWS if r["circuit_id"] != "nurburgring-gp"]
        self.assertRefused(faults(rows), "every list row's seasons and races are its circuits' own")

    def test_an_undeclared_shared_row(self):
        declared = dict(DECLARED, splits=[])
        self.assertRefused(faults(declared=declared), "only a declared split shares one list row")

    def test_a_declared_split_the_list_does_not_make(self):
        declared = dict(DECLARED, splits=DECLARED["splits"] + [("avus", "monsanto")])
        self.assertRefused(faults(declared=declared), "only a declared split shares one list row")

    def test_a_circuit_neither_mapped_nor_declared(self):
        rows = [r for r in ROWS if r["circuit_id"] != "monsanto"]
        self.assertRefused(faults(rows),
                           "every circuit is mapped or declared, unless all its races postdate the list")

    def test_a_raceless_circuit_losing_its_declaration(self):
        # The Sudschleife has no race at all, so "it has not raced yet" is
        # not an excuse it can use: dropping its declaration and its
        # known_gaps row together must still fail (PR #730's review).
        declared = dict(DECLARED, gaps={}, gap_keys=set())
        self.assertRefused(faults(declared=declared),
                           "every circuit is mapped or declared, unless all its races postdate the list")

    def test_a_new_venue_waits_for_the_next_list(self):
        register = dict(REGISTER, madring=("Spain", [], 1),
                        lusail=("Qatar", [(2026, "2026-11-29")], 0))
        found, waiting = run(register=register)
        self.assertEqual({k: v for k, v in found.items() if v}, {})
        self.assertEqual(waiting, ["lusail", "madring"])

    def test_a_row_whose_facts_fit_another_circuit(self):
        register = dict(REGISTER, sebring=("Portugal", [(1959, "1959-12-12")], 0))
        rows = ROWS + [row("sebring", "Sebring", "Sebring", "Portugal", "1959", 1)]
        self.assertRefused(faults(rows, register),
                           "every list row's country, seasons and races fit no other circuit")

    def test_a_declared_gap_with_no_known_gaps_row(self):
        declared = dict(DECLARED, gap_keys=set())
        self.assertRefused(faults(declared=declared),
                           "no declared circuit is also mapped, and each declaration has its known_gaps row")

    def test_a_circuit_mapped_and_declared(self):
        declared = dict(DECLARED, gaps=dict(DECLARED["gaps"], monza="x"), gap_keys={"circuit-article-sudschleife", "x"})
        self.assertRefused(faults(declared=declared),
                           "no declared circuit is also mapped, and each declaration has its known_gaps row")

    def test_an_article_of_another_wikidata_entity(self):
        self.assertRefused(faults(edited("monza", wikidata_id="Q2")),
                           "every article is the Wikidata entity admitted for its circuit")

    def test_a_declared_wrong_id_still_pins_the_article(self):
        self.assertRefused(faults(edited("miami", wikidata_id="")),
                           "every article is the Wikidata entity admitted for its circuit")

    def test_a_stale_declaration_of_a_wrong_id(self):
        declared = dict(DECLARED, admitted={"monza": "Q171417", "miami": "Q9"})
        self.assertRefused(faults(declared=declared),
                           "every article is the Wikidata entity admitted for its circuit")

    def test_two_rows_naming_one_article(self):
        self.assertRefused(faults(edited("monsanto", article="AVUS")),
                           "no two list rows name the same article")

    def test_a_row_without_a_permanent_link(self):
        self.assertRefused(faults(edited("monza", source="https://en.wikipedia.org/wiki/List_of_Formula_One_circuits")),
                           "every row cites a permanent revision of the list")

    def test_a_row_for_no_circuit(self):
        self.assertRefused(faults(ROWS + [row("imola", "Imola Circuit", "Imola Circuit", "Italy", "1980", 1)]),
                           "every row names one circuit in the register, once")


def tool():
    spec = importlib.util.spec_from_file_location(
        "circuit_articles", os.path.join(ROOT, "tools", "circuit_articles.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


LIST = """{| class="wikitable sortable"

|+ Formula One circuits
!scope=col|Circuit
!scope=col class="unsortable"|Map
!scope=col|Type
!scope=col|Direction
!scope=col|Location
!scope=col|Country
!scope=col|Last length used
!Turns
! scope="col" |Grands Prix
!scope=col|Season(s)
!scope=col|Grands Prix held
|-
|bgcolor=FBCEB1|[[Albert Park Circuit]] *
|[[File:Albert Park Circuit 2021.svg|150px|Albert Park]]
|Street circuit
|Clockwise
|[[Melbourne]]
|{{Flagicon|AUS}} [[Australia]]
|{{sort|05.278|{{convert|5.278|km|mi|abbr=on}}}}
|16
|[[Australian Grand Prix]]
|{{F1|1996}}–{{F1|2019}}, {{F1|2022}}–{{F1|2026}}
|align=center|29
|-
|[[Circuit de la Sarthe#Bugatti Circuit|Bugatti Circuit]]
|[[File:Bugatti.svg|150px]]
|Race circuit
|Clockwise
|[[Le Mans]]
|{{Flagicon|FRA|1958}} [[France]]
|{{sort|04.422|{{convert|4.422|km|mi|abbr=on}}}}
|13
|[[French Grand Prix]]
|{{F1|1967}}
|align=center|1
|}
"""


class TheParserReads(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.T = tool()

    def test_rows_through_their_attribute_prefixes(self):
        rows, refused = self.T.parse_list(LIST)
        self.assertEqual(refused, [])
        a, b = rows
        self.assertEqual((a["title"], a["section"], a["country"], a["held"]),
                         ("Albert Park Circuit", None, "Australia", 29))
        self.assertEqual(a["years"], set(range(1996, 2020)) | set(range(2022, 2027)))
        self.assertEqual((b["title"], b["section"], b["linked_as"], b["held"]),
                         ("Circuit de la Sarthe", "Bugatti Circuit",
                          "Circuit de la Sarthe#Bugatti Circuit", 1))

    def test_refuses_a_table_whose_columns_moved(self):
        with self.assertRaises(SystemExit):
            self.T.parse_list(LIST.replace("!Turns\n", ""))

    def test_seasons_round_trip_through_the_check(self):
        years = {1951, 1952, 1953, 1956, 1961, 1962}
        self.assertEqual(self.T.seasons_text(years), "1951-1953,1956,1961-1962")
        self.assertEqual(verify._list_seasons(self.T.seasons_text(years)), years)
        self.assertIsNone(verify._list_seasons("1951-53"))


if __name__ == "__main__":
    unittest.main()
