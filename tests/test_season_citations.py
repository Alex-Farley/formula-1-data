# -*- coding: utf-8 -*-
"""
A season's Wikipedia citation names its article's own title (PM-70, #913).

WHY THIS FILE EXISTS
    Until PM-70 every season cited '<year>_Formula_One_World_Championship',
    a title Wikipedia does not have for 26 seasons to 1980: the link a reader
    followed opened nothing. data/harvest.py's season_source() now cites the
    title each article has, read from the Wikipedia API on 2026-10-28, and
    source pattern 4 in data/current.py matches both spellings. Two things
    could undo it without the build noticing:

    - the switch moving, which would send some seasons back to a missing
      title. The titles are pinned here as measured, so moving it is a
      deliberate edit that has to re-read Wikipedia first;
    - the pattern losing a spelling. A season URL it no longer matched would
      not fail the build - it would fall through to the catch-all pattern
      for car, driver and topic articles and be credited to source 11, the
      wrong entry in the registry. The build refuses only a citation that
      resolves to nothing.

    python3 -m unittest discover -s tests
"""
import os
import re
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from data import current as N  # noqa: E402
from data import harvest as H  # noqa: E402

WIKI = "https://en.wikipedia.org/wiki/"


def resolve(text):
    """build.py's rule: the longest registry-URL prefix, then the patterns in
    order. Returns the matching pattern's note, or the registry URL."""
    prefixes = [r[2] for r in N.SOURCE_REGISTRY if r[2]]
    best = max((u for u in prefixes if text.startswith(u.rstrip("/"))),
               key=len, default=None)
    if best:
        return best
    return next((note for _, p, note in N.SOURCE_PATTERNS
                 if re.compile(p).match(text)), None)


class EachSeasonCitesTheTitleItHas(unittest.TestCase):
    def test_to_1980_the_season_article(self):
        for year in (1950, 1951, 1952, 1966, 1979, 1980):
            self.assertEqual(H.season_source(year),
                             f"{WIKI}{year}_Formula_One_season")

    def test_from_1981_the_world_championship_article(self):
        for year in (1981, 2000, 2024, N.CURRENT_SEASON):
            self.assertEqual(H.season_source(year),
                             f"{WIKI}{year}_Formula_One_World_Championship")


class EverySeasonResolvesToTheSeasonPattern(unittest.TestCase):
    def test_each_year_takes_the_season_article_pattern(self):
        (note,) = [n for sid, _, n in N.SOURCE_PATTERNS
                   if sid == 8 and n and n.startswith("season articles")]
        for year in range(1950, N.CURRENT_SEASON + 1):
            with self.subTest(year=year):
                self.assertEqual(resolve(H.season_source(year)), note)


if __name__ == "__main__":
    unittest.main()
