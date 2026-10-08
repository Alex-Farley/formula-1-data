# -*- coding: utf-8 -*-
"""
How tools/wikispec_fetch.py reads an infobox's single `track` field and its
list templates, tested directly (PM-68).

WHY THIS FILE EXISTS
    The parse runs only against the live API, and the committed harvest shows
    what it read, not what it would read from a form no page uses yet. Before
    PM-68 the front was copied into the rear on every chassis and a list
    template kept only its last item; the car-vs-chassis comparison catches
    that coming back on curated cars alone. The forms below are the ones the
    articles use, plus the both-ends label in each position.

    python3 -m unittest discover -s tests
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), "tools"))

import wikispec_fetch as WS  # noqa: E402


class TrackEnds(unittest.TestCase):

    def ends(self, raw, front, rear):
        self.assertEqual(WS.track_ends(raw), (front, rear), raw)

    def test_labels_before_the_figures(self):
        self.ends("Front: 1,702 mm<br>Rear: 1,600 mm", 1702, 1600)
        self.ends("F: 1,702 mm R: 1,600 mm", 1702, 1600)
        self.ends("Back: 1,400 mm<br>Front: 1,500 mm", 1500, 1400)

    def test_labels_after_the_figures(self):
        self.ends("1,540 mm (Front)<br>1,520 mm (Rear)", 1540, 1520)
        self.ends("1,450 mm/1,420 mm front/rear", 1450, 1420)

    def test_a_label_naming_both_ends_gives_both_wherever_it_stands(self):
        self.ends("1,320 mm front and rear", 1320, 1320)
        self.ends("Front and rear: 1,320 mm", 1320, 1320)

    def test_an_unlabelled_figure_is_the_front_and_the_rear_stays_empty(self):
        self.ends("1,500 mm", 1500, None)

    def test_a_figure_per_variant_takes_the_first(self):
        self.ends("Front: 1,600 mm (78), 1,650 mm (79)<br>Rear: 1,550 mm",
                  1600, 1550)

    def test_a_list_template_around_the_ends(self):
        self.ends("{{ubl|Front: 1,702 mm|Rear: 1,600 mm}}", 1702, 1600)

    def test_no_figure(self):
        self.ends("", None, None)
        self.ends("see text", None, None)


class ListTemplates(unittest.TestCase):

    def reads(self, raw, text):
        self.assertEqual(WS.strip(raw), text, raw)

    def test_every_item_not_the_last(self):
        self.reads("{{ubl|[[Adrian Newey]] (CTO)|[[Pierre Waché|Pierre Wache]]"
                   "|Toyoharu Tanabe}}",
                   "Adrian Newey (CTO); Pierre Wache; Toyoharu Tanabe")

    def test_plainlist_carries_its_items_as_bullets(self):
        self.reads("{{plainlist|\n* [[Adrian Newey]]\n* Rob Marshall\n}}",
                   "Adrian Newey; Rob Marshall")

    def test_named_parameters_are_not_items(self):
        self.reads("{{ubl|class=x|A|B}}", "A; B")
        self.reads("{{collapsible list|title=Drivers|A|B}}", "A; B")

    def test_ill_renders_its_english_name_inside_a_list(self):
        self.reads("{{ill|Jean Dupont|fr|Jean Dupont (ingénieur)}}", "Jean Dupont")
        self.reads("{{ubl|{{ill|Hans Mezger|de}}|Other}}", "Hans Mezger; Other")


if __name__ == "__main__":
    unittest.main()
