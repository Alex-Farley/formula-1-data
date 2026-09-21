"""
What the lede check catches, proved on every interpreter CI runs.

verify.py fails the build when a driver's note, or a race's, states a figure
the page derives. The pattern is a scoped-flag regular expression whose
behaviour across Python versions the review of #79 could only reason about;
these cases make both interpreters demonstrate it (CD-23).

The race cases below are the second half of that (AF-63). `races.note` reuses
the driver pattern whole rather than growing a second one to drift from it, so
what needs demonstrating is that a driver's vocabulary still reads race prose:
that it catches the figures a race page derives, and that it leaves the prose
a race note is actually for - a venue, a homologation, a stoppage - alone.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
from lede_figures import figure, number, subset_figures  # noqa: E402

CAUGHT = {
    "Ten wins and thirteen podiums.": "Ten wins",
    "Started 300 races.": "300 races",
    "Scored 1,566 points.": "1,566 points",
    "Won on his 300th start.": "300th start",
    "Took pole on his eighteenth start.": "eighteenth start",
    "Four runner-up finishes.": "Four runner-up finishes",
    "Ten career wins.": "Ten career wins",
    "Three straight wins in 1988.": "Three straight wins",
    "Passed Schumacher on his fourth GP start.": "fourth GP start",
    "Ten F1 wins.": "Ten F1 wins",
    "Seven World titles.": "Seven World titles",
    "Two World Championship titles.": "Two World Championship titles",
    "Three Championship wins.": "Three Championship wins",
    "Won two consecutive Drivers' titles.": "two consecutive Drivers' titles",
    "Six Formula One wins.": "Six Formula One wins",
    "Nine consecutive championship races.": "Nine consecutive championship races",
    "Twenty-three podiums.": "Twenty-three podiums",
    "Won on his twenty-first start.": "twenty-first start",
}

LEFT_ALONE = [
    "Six Monaco wins including five straight.",
    "Twice champion; six Le Mans wins.",
    "Won the title by two points.",
    "Champion in 1961 with a title clinched at Monza.",
    "Four of his wins came in the wet.",
    "His Formula One wins were all for Ferrari.",
    "A win at his home race.",
    "Won a Formula 2 race the week before.",
    "Took his first win at Spa.",
    "Killed four days after the race.",
    "The only World Champion on both two wheels and four.",
    "Champion with Ferrari every year from 2000 to 2004.",
]


# A race page derives its entry count, the classified count beside it and the
# count on every section heading, and the site's own records pages derive the
# rest: a note that states one of those is the figure that goes stale.
RACE_CAUGHT = {
    "Twenty entries, the smallest field since 1958.": "Twenty entries",
    "Ferrari's 100th win.": "100th win",
    "The 1000th World Championship race.": "1000th World Championship race",
    "Hamilton's fourth win here.": "fourth win",
    "Six points were awarded, the race stopped short of half distance.": "Six points",
    # Wider than a race page's own figures, and deliberately so: the pattern
    # is a driver career's vocabulary, "races" is in it, and the cost of
    # catching a count no race page shows is a rewording.
    "One of three races held at Sebring.": "three races",
}

# The two notes the database carries today, and the kinds of prose a race note
# is for. None of it states a total, and none of it may fail the build.
RACE_LEFT_ALONE = [
    "The Bahrain Grand Prix of 2026 is hosted at Sepang, Malaysia.",
    "The Turkish Grand Prix of 2027 is subject to FIA circuit homologation.",
    "Stopped after 31 laps and not restarted.",
    "Held over two heats, the results aggregated.",
    "Run on the Saturday because of a local election.",
    "The grid was set by the sprint.",
    "Half points were awarded.",
]


class LedeFigures(unittest.TestCase):
    def test_a_stated_total_is_caught_whole(self):
        for note, expected in CAUGHT.items():
            with self.subTest(note=note):
                self.assertEqual(figure(note), expected)

    def test_a_note_that_states_no_total_is_left_alone(self):
        for note in LEFT_ALONE:
            with self.subTest(note=note):
                self.assertIsNone(figure(note))

    def test_a_race_note_may_not_state_a_figure_the_page_derives(self):
        for note, expected in RACE_CAUGHT.items():
            with self.subTest(note=note):
                self.assertEqual(figure(note), expected)

    def test_the_prose_a_race_note_is_for_is_left_alone(self):
        for note in RACE_LEFT_ALONE:
            with self.subTest(note=note):
                self.assertIsNone(figure(note))

    def test_subset_figures_name_their_place(self):
        self.assertEqual(subset_figures('Six Monaco wins including five straight.'), [(6, 'Monaco', 'wins')])
        self.assertEqual(subset_figures('Twice champion; six Le Mans wins.'), [(6, 'Le Mans', 'wins')])
        self.assertEqual(subset_figures('Two Monaco wins, eight years apart (1955 and 1958).'), [(2, 'Monaco', 'wins')])
        self.assertEqual(subset_figures('Five Monaco poles and two San Marino podiums.'), [(5, 'Monaco', 'poles'), (2, 'San Marino', 'podiums')])
        self.assertEqual(subset_figures('Ten wins and thirteen podiums.'), [])
        self.assertEqual(subset_figures('Four of his wins came in the wet.'), [])
        self.assertEqual(subset_figures('Le Mans 24 Hours. Five Monaco wins.'), [(5, 'Monaco', 'wins')])

    def test_numbers_read_in_digits_and_words(self):
        for text, value in (('Six', 6), ('twenty-three', 23), ('1,566', 1566), ('hundred', 100), ('one hundred', 100), ('two hundred', 200), ('ninety nine', 99)):
            with self.subTest(text=text):
                self.assertEqual(number(text), value)

    def test_case_does_not_hide_a_figure(self):
        self.assertEqual(figure("TEN WINS."), "TEN WINS")
        self.assertEqual(figure("ten wins."), "ten wins")


if __name__ == "__main__":
    unittest.main()
