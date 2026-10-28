"""
The race-day weather rules (AF-136): how an infobox's words are cleaned,
read as wet or dry, and which day the model is asked for.

None of it needs the network or f1.db: the harvest's cleaning and the build's
reading are functions of a string, and the day of a date and a circuit.
"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tools"))
from data import harvest as HV  # noqa: E402
import race_weather as RW  # noqa: E402


class Clean(unittest.TestCase):
    def test_convert_prints_its_figure_and_unit(self):
        self.assertEqual(RW.clean("Sunny, {{convert|28|C|F}}"), "Sunny, 28 °C")
        self.assertEqual(RW.clean("Cool, {{cvt|77|F|C|order=flip}}"), "Cool, 77 °F")
        self.assertEqual(RW.clean("Air: {{convert|18|to|19|C|F}}"), "Air: 18–19 °C")

    def test_references_go_with_their_citation_parameters(self):
        # A citation's own `|url=` is not the infobox's next parameter: the
        # 2006 Bahrain phrase lost everything after its first reference
        # until the references were taken out first.
        raw = ("Fine<ref name=w>{{cite news|title=X |url=http://e.org/a }}</ref>"
               "<br />Track {{convert|40|C}}<ref name=w/>")
        self.assertEqual(RW.clean(raw), "Fine; Track 40 °C")

    def test_a_second_parameter_on_the_line_is_cut(self):
        self.assertEqual(RW.clean("Dry | Attendance = 100,000"), "Dry")

    def test_the_infobox_closing_on_the_line_is_cut(self):
        self.assertEqual(RW.clean("Cloudy}}"), "Cloudy")

    def test_an_ampersand_is_kept_and_an_entity_refused(self):
        self.assertEqual(RW.clean("Air & track 15 °C"), "Air & track 15 °C")
        self.assertEqual(RW.clean("Sunny,&nbsp;25 °C"), "Sunny, 25 °C")
        self.assertIsNone(RW.clean("Sunny &mdash; hot"))

    def test_markup_it_cannot_read_is_refused(self):
        self.assertIsNone(RW.clean("Sunny {{unknown|x}}"))

    def test_an_empty_value_is_none(self):
        self.assertIsNone(RW.clean("<!-- fill in -->"))


class Reading(unittest.TestCase):
    def test_any_rain_on_the_day_of_the_race_is_wet(self):
        for phrase in ("Wet, drying later", "Dry, then wet at the end",
                       "Sunny at start, brief showers late", "Drizzly",
                       "Dry at the start, damp in the end", "Cloudy, drying",
                       "Partly cloudy with humid track"):
            self.assertEqual(HV.weather_reading(1999, 1, phrase), "wet", phrase)

    def test_conditions_with_no_rain_are_dry(self):
        for phrase in ("Sunny", "Overcast", "Hot, dry", "Partly cloudy"):
            self.assertEqual(HV.weather_reading(1999, 1, phrase), "dry", phrase)

    def test_figures_alone_say_neither(self):
        self.assertIsNone(HV.weather_reading(
            1999, 1, "Temperatures up to 75.9 °F; Wind speeds up to 11.39 mph"))

    def test_a_declaration_holds_only_for_its_own_words(self):
        (year, rnd), (phrase, reading, _why) = next(iter(HV.WEATHER_READINGS.items()))
        self.assertEqual(HV.weather_reading(year, rnd, phrase), reading)
        # The same race with other words is read by the rule, not the
        # declaration: an article edited since does not stay overruled.
        self.assertEqual(HV.weather_reading(year, rnd, "Heavy rain"), "wet")

    def test_every_declaration_overrules_the_rule(self):
        # A declaration the rule already agrees with is one nobody needed.
        for (year, rnd), (phrase, reading, _why) in HV.WEATHER_READINGS.items():
            plain = ("wet" if HV.WEATHER_WET.search(phrase)
                     else "dry" if HV.WEATHER_STATED.search(phrase) else None)
            self.assertNotEqual(plain, reading, (year, rnd))


class Day(unittest.TestCase):
    def test_the_utc_day_everywhere_but_after_midnight(self):
        self.assertEqual(HV.weather_day("2024-11-24", "las-vegas", {"las-vegas"}),
                         "2024-11-23")
        self.assertEqual(HV.weather_day("2024-11-24", "monza", {"las-vegas"}),
                         "2024-11-24")
        self.assertEqual(HV.weather_day("2024-03-01", "las-vegas", {"las-vegas"}),
                         "2024-02-29")

    def test_a_date_already_the_last_local_day_is_kept(self):
        # F1DB's 2026 date is the UTC Sunday, after the weekend's Saturday;
        # formula1.com's 2027 date is the Saturday itself.
        self.assertEqual(HV.weather_day("2026-11-22", "las-vegas", {"las-vegas"},
                                        "2026-11-21"), "2026-11-21")
        self.assertEqual(HV.weather_day("2027-11-20", "las-vegas", {"las-vegas"},
                                        "2027-11-20"), "2027-11-20")


class Article(unittest.TestCase):
    def test_the_races_title_up_to_accents_and_hyphens(self):
        self.assertTrue(HV.weather_article_is_the_races(
            2021, 19, "Sao Paulo Grand Prix", "2021 São Paulo Grand Prix"))
        self.assertTrue(HV.weather_article_is_the_races(
            2020, 13, "Emilia Romagna Grand Prix", "2020 Emilia-Romagna Grand Prix"))

    def test_another_races_article_is_refused(self):
        # A round renumbered since the harvest: round 9's row read as round 10's.
        self.assertFalse(HV.weather_article_is_the_races(
            2026, 10, "British Grand Prix", "2026 Belgian Grand Prix"))

    def test_a_declared_redirect_and_only_it(self):
        self.assertTrue(HV.weather_article_is_the_races(
            2020, 5, "70th Anniversary Grand Prix", "70th Anniversary Grand Prix"))
        self.assertFalse(HV.weather_article_is_the_races(
            2020, 5, "70th Anniversary Grand Prix", "2020 British Grand Prix"))

    def test_the_request_names_its_point_day_and_model(self):
        url = HV.weather_model_url(52.078611, -1.016944, "1950-05-13")
        self.assertTrue(url.startswith(HV.WEATHER_MODEL_API + "?"))
        for part in ("latitude=52.078611", "longitude=-1.016944",
                     "start_date=1950-05-13", "end_date=1950-05-13",
                     "models=" + HV.WEATHER_MODEL, "timezone=auto"):
            self.assertIn(part, url)


if __name__ == "__main__":
    unittest.main()
