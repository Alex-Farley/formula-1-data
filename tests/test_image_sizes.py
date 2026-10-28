# -*- coding: utf-8 -*-
"""
The size a photograph is drawn at (PM-54), tested directly.

WHY THIS FILE EXISTS
    Asked for an 800 px thumbnail, the MediaWiki API reports `thumbwidth`
    800 even for an original narrower than that, which it serves unscaled.
    The harvest stored that figure as `width` for every row, so 550 rows
    said 800 for files 104 to 799 px wide. drawn_size() is the rule that
    replaced it, and the answers below are the API's own, for three files
    the harvest holds, as it gave them on 2026-10-28.

    python3 -m unittest discover -s tests
"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))

import wikimedia_images as WI  # noqa: E402

ORIGINAL = "https://upload.wikimedia.org/wikipedia/commons/"
THUMB = "https://thumb.wikimedia.org/wikipedia/commons/thumb/"


class DrawnSize(unittest.TestCase):
    def test_a_narrower_original_is_its_own_size(self):
        ii = {"width": 583, "height": 405, "thumbwidth": 800,
              "thumbheight": 556,
              "thumburl": ORIGINAL + "5/55/Monza_1950.jpg?utm_source=x"}
        self.assertEqual(WI.drawn_size(ii), (583, 405))

    def test_a_wider_original_is_the_thumbnails_size(self):
        ii = {"width": 5184, "height": 3456, "thumbwidth": 800,
              "thumbheight": 533,
              "thumburl": THUMB + "5/55/AGS_JH24.jpg/960px-AGS_JH24.jpg"}
        self.assertEqual(WI.drawn_size(ii), (800, 533))

    def test_a_file_scaled_up_keeps_the_thumbnails_size(self):
        # A vector original is drawn at any width, from a /thumb/ address.
        ii = {"width": 512, "height": 256, "thumbwidth": 800,
              "thumbheight": 400,
              "thumburl": THUMB + "a/ab/Map.svg/960px-Map.svg.png"}
        self.assertEqual(WI.drawn_size(ii), (800, 400))

    def test_no_thumbnail_size_falls_back_to_the_original(self):
        self.assertEqual(WI.drawn_size({"width": 583, "height": 405}),
                         (583, 405))
        self.assertEqual(WI.drawn_size({}), (None, None))


if __name__ == "__main__":
    unittest.main()
