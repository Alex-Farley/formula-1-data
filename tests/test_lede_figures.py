"""
What the lede check catches, proved on every interpreter CI runs.

verify.py fails the build when a driver's note states a figure the page
derives. The pattern is a scoped-flag regular expression whose behaviour
across Python versions the review of #79 could only reason about; these
cases make both interpreters demonstrate it (CD-23).
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


class LedeFigures(unittest.TestCase):
    def test_a_stated_total_is_caught_whole(self):
        for note, expected in CAUGHT.items():
            with self.subTest(note=note):
                self.assertEqual(figure(note), expected)

    def test_a_note_that_states_no_total_is_left_alone(self):
        for note in LEFT_ALONE:
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
