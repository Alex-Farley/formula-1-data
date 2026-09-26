# -*- coding: utf-8 -*-
"""
2026 season: entries, calendar, standings, regulations status.
Plus verified race-winner records for 2025 and 2026, and the 2027 calendar.

Everything here was checked against formula1.com on 2026-09-04, except
CALENDAR_2027, which was read from the announcement of 2026-09-16.
"""

# The season in progress, and the one number every other file used to type
# out (CR-07). It is NOT MAX(year) in the season register: that is 2027, whose
# calendar was announced on 2026-09-16 and which has not run a race. Anything
# that means "this year's grid, calendar, standings or timetable" reads this;
# a year that is part of a fact - a livery, a regulation reset, a historical
# comparison - stays written out, because it is data and not the clock.
#
# build.py writes it into `meta.current_season`, so the artefact carries it and
# verify.py, export_json.py and the renderers read it from there rather than
# importing this module. verify.py then checks it against the season the built
# database actually holds an entry list and a timetable for, which is what
# stops this line and the data below drifting apart.
CURRENT_SEASON = 2026

# The season before it: the most recent one with a final classification, which
# is what the standings cross-checks run over alongside the running season.
PREVIOUS_SEASON = CURRENT_SEASON - 1

# formula1.com's results are published per season AND per section, and the
# fact each row here holds decides which page it must cite. One constant could
# not: it carried 31 rows of the 2025 final classification, 47 race rows from
# both seasons and the 2026 calendar, all citing the same page - and that page
# was https://www.formula1.com/en/results/2026, which formula1.com does not
# serve at all. The bare year path 404s; only the section pages under it
# resolve, and the calendar lives under /en/racing/ instead (#426).
#
# So each season names its own pages, every one of them read and checked, and
# NONE of them is derived from CURRENT_SEASON. A citation follows the season of
# the row that carries it, which is what keeps last season's standings citing
# last season's page when CURRENT_SEASON moves; and a season whose pages do not
# exist yet - formula1.com serves /en/results/<year> for a year it has not run
# empty, and served nothing at all for 2027 when its calendar was announced -
# cannot acquire a citation by arithmetic. It gets one when someone reads one.
#
# `drivers` and `constructors` are the two standings tables, named for the
# table_type that cites them; formula1.com calls the second one `team` in its
# path. `races` is the season's race-by-race results, which is what the winner
# rows cite. `calendar` is the schedule, and only a season with a calendar
# here needs it.
SOURCE_F1_SEASON = {
    2025: {
        "races": "https://www.formula1.com/en/results/2025/races",
        "drivers": "https://www.formula1.com/en/results/2025/drivers",
        "constructors": "https://www.formula1.com/en/results/2025/team",
    },
    2026: {
        "races": "https://www.formula1.com/en/results/2026/races",
        "drivers": "https://www.formula1.com/en/results/2026/drivers",
        "constructors": "https://www.formula1.com/en/results/2026/team",
        "calendar": "https://www.formula1.com/en/racing/2026",
    },
}


def f1_source(year, section):
    """The checked formula1.com page for one season and one kind of fact.

    A season nobody has read a page for is a build failure rather than a
    guessed URL: the alternative is a citation that points at a page which
    may not exist, which is the defect this map replaced.
    """
    pages = SOURCE_F1_SEASON.get(year)
    if pages is None or section not in pages:
        raise SystemExit(
            f"no checked formula1.com page for {year} {section!r}. Read the "
            f"page and add it to SOURCE_F1_SEASON in data/current.py before "
            f"the build can cite it.")
    return pages[section]

# The 2027 calendar was announced on 2026-09-16, after World Motor Sport
# Council approval. formula1.com has no /racing/2027 or /results/2027 page
# yet - the results page for the year is served but empty - so the
# announcement article is the official source, and the round-by-round dates
# on it are published as an image. Dates, venues and Sprint rounds were read
# from that image; nothing else on the page is copied (SOURCE_LICENCE,
# facts-only).
SOURCE_F1_2027 = ("https://www.formula1.com/en/latest/article/"
                  "formula-1-reveals-calendar-for-2027-season-with-10-sprint-"
                  "events.5J8ePLyjRuMyWEIDNUKgY4")

# constructor_id, driver_id, car, power_unit, number, role
ENTRIES_2026 = [
    ("mercedes", "russell", "W17", "Mercedes", 63, "race"),
    ("mercedes", "antonelli", "W17", "Mercedes", 12, "race"),
    ("ferrari", "leclerc", "SF-26", "Ferrari", 16, "race"),
    ("ferrari", "hamilton", "SF-26", "Ferrari", 44, "race"),
    ("mclaren", "norris", "MCL40", "Mercedes", 1, "race"),
    ("mclaren", "piastri", "MCL40", "Mercedes", 81, "race"),
    ("red-bull", "verstappen", "RB22", "Red Bull Ford", 3, "race"),
    ("red-bull", "hadjar", "RB22", "Red Bull Ford", 6, "race"),
    ("racing-bulls", "lawson", "VCARB 03", "Red Bull Ford", 30, "race"),
    ("racing-bulls", "lindblad", "VCARB 03", "Red Bull Ford", 41, "race"),
    ("alpine", "gasly", "A526", "Mercedes", 10, "race"),
    ("alpine", "colapinto", "A526", "Mercedes", 43, "race"),
    ("haas", "ocon", "VF-26", "Ferrari", 31, "race"),
    ("haas", "bearman", "VF-26", "Ferrari", 87, "race"),
    ("audi", "hulkenberg", "R26", "Audi", 27, "race"),
    ("audi", "bortoleto", "R26", "Audi", 5, "race"),
    ("williams", "sainz", "FW48", "Mercedes", 55, "race"),
    ("williams", "albon", "FW48", "Mercedes", 23, "race"),
    ("aston-martin", "alonso", "AMR26", "Honda", 14, "race"),
    ("aston-martin", "stroll", "AMR26", "Honda", 18, "race"),
    ("cadillac", "perez", "MAC-26", "Ferrari", 11, "race"),
    ("cadillac", "bottas", "MAC-26", "Ferrari", 77, "race"),
    ("racing-bulls", "tsunoda", None, "Red Bull Ford", 22, "reserve"),
]

TEAM_PERSONNEL_2026 = [
    ("mercedes", "Toto Wolff", "James Allison"),
    ("ferrari", "Frederic Vasseur", "Loic Serra / Enrico Gualtieri"),
    ("mclaren", "Andrea Stella", "Peter Prodromou / Neil Houldey"),
    ("red-bull", "Laurent Mekies", "Pierre Wache"),
    ("racing-bulls", "Alan Permane", "Tim Goss"),
    ("alpine", "Flavio Briatore (Executive Advisor), Steve Nielsen (Managing Director)", "David Sanchez"),
    ("haas", "Ayao Komatsu", "Andrea De Zordo"),
    ("audi", "Mattia Binotto", "James Key"),
    ("williams", "James Vowles", "Pat Fry"),
    ("aston-martin", "Adrian Newey", "Enrico Cardile"),
    ("cadillac", "Marcin Budkowski", "Nick Chester"),
]

# round, gp_name, country, city, circuit_id, dates, sprint, status
CALENDAR_2026 = [
    (1, "Australian Grand Prix", "Australia", "Melbourne", "albert-park", "06-08 Mar 2026", 0, "completed"),
    (2, "Chinese Grand Prix", "China", "Shanghai", "shanghai", "13-15 Mar 2026", 1, "completed"),
    (3, "Japanese Grand Prix", "Japan", "Suzuka", "suzuka", "27-29 Mar 2026", 0, "completed"),
    (4, "Miami Grand Prix", "United States", "Miami", "miami", "01-03 May 2026", 1, "completed"),
    (5, "Canadian Grand Prix", "Canada", "Montreal", "gilles-villeneuve", "22-24 May 2026", 1, "completed"),
    (6, "Monaco Grand Prix", "Monaco", "Monaco", "monaco", "05-07 Jun 2026", 0, "completed"),
    (7, "Spanish Grand Prix", "Spain", "Barcelona", "catalunya", "12-14 Jun 2026", 0, "completed"),
    (8, "Austrian Grand Prix", "Austria", "Spielberg", "red-bull-ring", "26-28 Jun 2026", 0, "completed"),
    (9, "British Grand Prix", "United Kingdom", "Silverstone", "silverstone", "03-05 Jul 2026", 1, "completed"),
    (10, "Belgian Grand Prix", "Belgium", "Spa-Francorchamps", "spa", "17-19 Jul 2026", 0, "completed"),
    (11, "Hungarian Grand Prix", "Hungary", "Budapest", "hungaroring", "24-26 Jul 2026", 0, "completed"),
    (12, "Dutch Grand Prix", "Netherlands", "Zandvoort", "zandvoort", "21-23 Aug 2026", 1, "completed"),
    (13, "Italian Grand Prix", "Italy", "Monza", "monza", "04-06 Sep 2026", 0, "scheduled"),
    (14, "Madrid Grand Prix", "Spain", "Madrid", "madring", "11-13 Sep 2026", 0, "scheduled"),
    (15, "Azerbaijan Grand Prix", "Azerbaijan", "Baku", "baku", "24-26 Sep 2026", 0, "scheduled"),
    (16, "Bahrain Grand Prix", "Bahrain (hosted at Sepang, Malaysia)", "Sepang", "sepang", "02-04 Oct 2026", 0, "scheduled"),
    (17, "Singapore Grand Prix", "Singapore", "Singapore", "marina-bay", "09-11 Oct 2026", 1, "scheduled"),
    (18, "United States Grand Prix", "United States", "Austin", "cota", "23-25 Oct 2026", 0, "scheduled"),
    (19, "Mexico City Grand Prix", "Mexico", "Mexico City", "rodriguez", "30 Oct-01 Nov 2026", 0, "scheduled"),
    (20, "Sao Paulo Grand Prix", "Brazil", "Sao Paulo", "interlagos", "06-08 Nov 2026", 0, "scheduled"),
    (21, "Las Vegas Grand Prix", "United States", "Las Vegas", "las-vegas", "19-21 Nov 2026", 0, "scheduled"),
    (22, "Qatar Grand Prix", "Qatar", "Lusail", "lusail", "27-29 Nov 2026", 0, "scheduled"),
    (23, "Abu Dhabi Grand Prix", "Abu Dhabi", "Yas Marina", "yas-marina", "04-06 Dec 2026", 0, "scheduled"),
]

# Same columns as CALENDAR_2026. Twenty-four rounds, ten of them Sprint
# events; no round has been run, so every status is 'scheduled' and the
# season carries no entries, standings or results. Round 17 is the one
# conditional entry on the calendar and says so in its country field, which
# build.py turns into the race's note.
CALENDAR_2027 = [
    (1, "Bahrain Grand Prix", "Bahrain", "Sakhir", "bahrain", "12-14 Mar 2027", 1, "scheduled"),
    (2, "Saudi Arabian Grand Prix", "Saudi Arabia", "Jeddah", "jeddah", "19-21 Mar 2027", 0, "scheduled"),
    (3, "Australian Grand Prix", "Australia", "Melbourne", "albert-park", "02-04 Apr 2027", 1, "scheduled"),
    (4, "Japanese Grand Prix", "Japan", "Suzuka", "suzuka", "09-11 Apr 2027", 1, "scheduled"),
    (5, "Chinese Grand Prix", "China", "Shanghai", "shanghai", "16-18 Apr 2027", 0, "scheduled"),
    (6, "Miami Grand Prix", "United States", "Miami", "miami", "30 Apr-02 May 2027", 0, "scheduled"),
    (7, "Canadian Grand Prix", "Canada", "Montreal", "gilles-villeneuve", "21-23 May 2027", 1, "scheduled"),
    (8, "Monaco Grand Prix", "Monaco", "Monaco", "monaco", "04-06 Jun 2027", 1, "scheduled"),
    (9, "Portuguese Grand Prix", "Portugal", "Portimao", "portimao", "18-20 Jun 2027", 0, "scheduled"),
    (10, "British Grand Prix", "United Kingdom", "Silverstone", "silverstone", "02-04 Jul 2027", 1, "scheduled"),
    (11, "Austrian Grand Prix", "Austria", "Spielberg", "red-bull-ring", "09-11 Jul 2027", 0, "scheduled"),
    (12, "Belgian Grand Prix", "Belgium", "Spa-Francorchamps", "spa", "23-25 Jul 2027", 0, "scheduled"),
    (13, "Hungarian Grand Prix", "Hungary", "Budapest", "hungaroring", "30 Jul-01 Aug 2027", 0, "scheduled"),
    (14, "Italian Grand Prix", "Italy", "Monza", "monza", "03-05 Sep 2027", 1, "scheduled"),
    (15, "Spanish Grand Prix", "Spain", "Madrid", "madring", "10-12 Sep 2027", 0, "scheduled"),
    (16, "Azerbaijan Grand Prix", "Azerbaijan", "Baku", "baku", "24-26 Sep 2027", 0, "scheduled"),
    (17, "Turkish Grand Prix", "Turkey (subject to FIA circuit homologation)", "Istanbul", "istanbul", "01-03 Oct 2027", 0, "scheduled"),
    (18, "Singapore Grand Prix", "Singapore", "Singapore", "marina-bay", "08-10 Oct 2027", 0, "scheduled"),
    (19, "United States Grand Prix", "United States", "Austin", "cota", "22-24 Oct 2027", 0, "scheduled"),
    (20, "Mexico City Grand Prix", "Mexico", "Mexico City", "rodriguez", "29-31 Oct 2027", 0, "scheduled"),
    (21, "Sao Paulo Grand Prix", "Brazil", "Sao Paulo", "interlagos", "05-07 Nov 2027", 1, "scheduled"),
    (22, "Las Vegas Grand Prix", "United States", "Las Vegas", "las-vegas", "18-20 Nov 2027", 0, "scheduled"),
    (23, "Qatar Grand Prix", "Qatar", "Lusail", "lusail", "03-05 Dec 2027", 1, "scheduled"),
    (24, "Abu Dhabi Grand Prix", "Abu Dhabi", "Yas Marina", "yas-marina", "10-12 Dec 2027", 1, "scheduled"),
]

# year -> (calendar, source). build.py loads every season named here, so a
# new season arrives by being added to this map and to data/seasons.py, and
# nothing in the loader names a year.
CALENDARS = {
    2026: (CALENDAR_2026, f1_source(2026, "calendar")),
    2027: (CALENDAR_2027, SOURCE_F1_2027),
}

# position, driver_id, display, team, points
DRIVER_STANDINGS_2026 = [
    (1, "antonelli", "Kimi Antonelli", "Mercedes", 242),
    (2, "russell", "George Russell", "Mercedes", 183),
    (3, "hamilton", "Lewis Hamilton", "Ferrari", 183),
    (4, "norris", "Lando Norris", "McLaren", 159),
    (5, "leclerc", "Charles Leclerc", "Ferrari", 155),
    (6, "verstappen", "Max Verstappen", "Red Bull Racing", 112),
    (7, "piastri", "Oscar Piastri", "McLaren", 104),
    (8, "hadjar", "Isack Hadjar", "Red Bull Racing", 68),
    (9, "lawson", "Liam Lawson", "Racing Bulls", 49),
    (10, "gasly", "Pierre Gasly", "Alpine", 44),
    (11, "lindblad", "Arvid Lindblad", "Racing Bulls", 23),
    (12, "colapinto", "Franco Colapinto", "Alpine", 19),
    (13, "bearman", "Oliver Bearman", "Haas F1 Team", 18),
    (14, "bortoleto", "Gabriel Bortoleto", "Audi", 10),
    (15, "hulkenberg", "Nico Hulkenberg", "Audi", 6),
    (16, "sainz", "Carlos Sainz", "Williams", 6),
    (17, "albon", "Alexander Albon", "Williams", 5),
    (18, "ocon", "Esteban Ocon", "Haas F1 Team", 3),
    (19, "alonso", "Fernando Alonso", "Aston Martin", 3),
    (20, "tsunoda", "Yuki Tsunoda", "Racing Bulls", 0),
    (21, "stroll", "Lance Stroll", "Aston Martin", 0),
    (22, "bottas", "Valtteri Bottas", "Cadillac", 0),
    (23, "perez", "Sergio Perez", "Cadillac", 0),
]

# position, constructor_id, display, points
TEAM_STANDINGS_2026 = [
    (1, "mercedes", "Mercedes", 425),
    (2, "ferrari", "Ferrari", 338),
    (3, "mclaren", "McLaren", 263),
    (4, "red-bull", "Red Bull Racing", 186),
    (5, "racing-bulls", "Racing Bulls", 66),
    (6, "alpine", "Alpine", 63),
    (7, "haas", "Haas F1 Team", 21),
    (8, "audi", "Audi", 16),
    (9, "williams", "Williams", 11),
    (10, "aston-martin", "Aston Martin", 3),
    (11, "cadillac", "Cadillac", 0),
]

# Final 2025 standings, verified against formula1.com
DRIVER_STANDINGS_2025 = [
    (1, "norris", "Lando Norris", "McLaren", 423),
    (2, "verstappen", "Max Verstappen", "Red Bull Racing", 421),
    (3, "piastri", "Oscar Piastri", "McLaren", 410),
    (4, "russell", "George Russell", "Mercedes", 319),
    (5, "leclerc", "Charles Leclerc", "Ferrari", 242),
    (6, "hamilton", "Lewis Hamilton", "Ferrari", 156),
    (7, "antonelli", "Kimi Antonelli", "Mercedes", 150),
    (8, "albon", "Alexander Albon", "Williams", 73),
    (9, "sainz", "Carlos Sainz", "Williams", 64),
    (10, "alonso", "Fernando Alonso", "Aston Martin", 56),
    (11, "hulkenberg", "Nico Hulkenberg", "Kick Sauber", 51),
    (12, "hadjar", "Isack Hadjar", "Racing Bulls", 51),
    (13, "bearman", "Oliver Bearman", "Haas F1 Team", 41),
    (14, "lawson", "Liam Lawson", "Racing Bulls", 38),
    (15, "ocon", "Esteban Ocon", "Haas F1 Team", 38),
    (16, "stroll", "Lance Stroll", "Aston Martin", 33),
    (17, "tsunoda", "Yuki Tsunoda", "Red Bull Racing", 33),
    (18, "gasly", "Pierre Gasly", "Alpine", 22),
    (19, "bortoleto", "Gabriel Bortoleto", "Kick Sauber", 19),
    (20, "colapinto", "Franco Colapinto", "Alpine", 0),
    (21, "doohan", "Jack Doohan", "Alpine", 0),
]

TEAM_STANDINGS_2025 = [
    (1, "mclaren", "McLaren", 833),
    (2, "mercedes", "Mercedes", 469),
    (3, "red-bull", "Red Bull Racing", 451),
    (4, "ferrari", "Ferrari", 398),
    (5, "williams", "Williams", 137),
    (6, "racing-bulls", "Racing Bulls", 92),
    (7, "aston-martin", "Aston Martin", 89),
    (8, "haas", "Haas F1 Team", 79),
    (9, "sauber", "Kick Sauber", 70),
    (10, "alpine", "Alpine", 22),
]

# year, round, gp_name, winner_id, constructor_id
RACE_RESULTS = [
    (2025, 1, "Australian Grand Prix", "norris", "mclaren"),
    (2025, 2, "Chinese Grand Prix", "piastri", "mclaren"),
    (2025, 3, "Japanese Grand Prix", "verstappen", "red-bull"),
    (2025, 4, "Bahrain Grand Prix", "piastri", "mclaren"),
    (2025, 5, "Saudi Arabian Grand Prix", "piastri", "mclaren"),
    (2025, 6, "Miami Grand Prix", "piastri", "mclaren"),
    (2025, 7, "Emilia-Romagna Grand Prix", "verstappen", "red-bull"),
    (2025, 8, "Monaco Grand Prix", "norris", "mclaren"),
    (2025, 9, "Spanish Grand Prix", "piastri", "mclaren"),
    (2025, 10, "Canadian Grand Prix", "russell", "mercedes"),
    (2025, 11, "Austrian Grand Prix", "norris", "mclaren"),
    (2025, 12, "British Grand Prix", "norris", "mclaren"),
    (2025, 13, "Belgian Grand Prix", "piastri", "mclaren"),
    (2025, 14, "Hungarian Grand Prix", "norris", "mclaren"),
    (2025, 15, "Dutch Grand Prix", "piastri", "mclaren"),
    (2025, 16, "Italian Grand Prix", "verstappen", "red-bull"),
    (2025, 17, "Azerbaijan Grand Prix", "verstappen", "red-bull"),
    (2025, 18, "Singapore Grand Prix", "russell", "mercedes"),
    (2025, 19, "United States Grand Prix", "verstappen", "red-bull"),
    (2025, 20, "Mexico City Grand Prix", "norris", "mclaren"),
    (2025, 21, "Sao Paulo Grand Prix", "norris", "mclaren"),
    (2025, 22, "Las Vegas Grand Prix", "verstappen", "red-bull"),
    (2025, 23, "Qatar Grand Prix", "verstappen", "red-bull"),
    (2025, 24, "Abu Dhabi Grand Prix", "verstappen", "red-bull"),
    (2026, 1, "Australian Grand Prix", "russell", "mercedes"),
    (2026, 2, "Chinese Grand Prix", "antonelli", "mercedes"),
    (2026, 3, "Japanese Grand Prix", "antonelli", "mercedes"),
    (2026, 4, "Miami Grand Prix", "antonelli", "mercedes"),
    (2026, 5, "Canadian Grand Prix", "antonelli", "mercedes"),
    (2026, 6, "Monaco Grand Prix", "antonelli", "mercedes"),
    (2026, 7, "Spanish Grand Prix", "hamilton", "ferrari"),
    (2026, 8, "Austrian Grand Prix", "russell", "mercedes"),
    (2026, 9, "British Grand Prix", "leclerc", "ferrari"),
    (2026, 10, "Belgian Grand Prix", "antonelli", "mercedes"),
    (2026, 11, "Hungarian Grand Prix", "norris", "mclaren"),
    (2026, 12, "Dutch Grand Prix", "norris", "mclaren"),
]

REGULATIONS_2026 = {
    "status": "VERIFIED SUMMARY - always defer to the latest FIA regulation issue for exact legal wording",
    "current_fia_issues": {
        "Section A - General Provisions": "Issue 03, dated 2026-06-25",
        "Section B - Sporting": "Issue 08, dated 2026-08-05",
        "Section C - Technical": "Issue 20, dated 2026-08-05",
        "Section D - Financial - F1 Teams": "Issue 07, dated 2026-06-25",
        "Section E - Financial - PU Manufacturers": "Issue 06, dated 2026-06-25",
        "Section F - Operational": "Issue 10, dated 2026-08-05",
    },
}

# priority, source, url, use, authority, licence, cadence, checkability
#
# The last three are the assessment, and they are the point of this table.
# A source is judged on what you may do with it, how often it is maintained,
# and - above all - on whether anything already held here can contradict it.
# A source nothing can contradict is a source you are trusting, not checking,
# and this project has twice paid for trusting one.
SOURCE_REGISTRY = [
    (1, "FIA Formula 1 regulations", "https://www.fia.com/regulations/formula-1",
     "Primary authority for sporting, technical, financial and operational rules.", "official",
     "FIA copyright; published for reference, not redistribution.",
     "Reissued per season, amended in-season by WMSC decision.",
     "Nothing here outranks it. Its own numbers are checked against each "
     "other across seasons, and the limits it sets are stored in "
     "regulation_limits rather than on any car."),
    (2, "FIA 2026 Formula One Championship archive",
     "https://www.fia.com/events/fia-formula-one-world-championship/season-2026/2026-fia-formula-one-world-championship",
     "Primary authority for FIA championship calendar, classifications and event status.", "official",
     "FIA copyright.", "Per event, during the season.",
     "The 2026 calendar it gives is checked against the stored race register "
     "on every build."),
    (3, "Formula1.com", "https://www.formula1.com/",
     "Official Formula 1/FOM source for teams, drivers, cars, schedules, results and official explainers.", "official",
     "FOM copyright; no reuse licence.", "Continuous during the season.",
     "Its career totals are reconciled against totals derived from the race "
     "records. That is what caught Russell's pole count and, before it, an "
     "internally inconsistent set of 2026 figures on the same pages."),
    (4, "Official F1 team websites", "https://www.formula1.com/en/teams",
     "Official team facts, car names, power units, staff, bases and team history.", "official",
     "Team copyright.", "Around a launch, then rarely.",
     "Car names cross-check against the chassis register; nothing else "
     "here can contradict a team's own history page."),
    (5, "Official circuit/promoter sources", "https://www.formula1.com/en/racing/2026",
     "Circuit/event facts; verify against FIA homologation where a technical or legal detail matters.", "official",
     "Promoter copyright.", "Around an event.",
     "Circuit length and turn counts are checked against the layout "
     "timelines, which must be complete and non-overlapping where present."),
    (6, "Official driver profiles", "https://www.formula1.com/en/drivers",
     "Driver nationality, number, biography and career statistics.", "official",
     "FOM copyright.", "Per event.",
     "Every career win, pole and fastest-lap total is recomputed from the "
     "race records and compared."),
    (7, "F1 results archive", "https://www.formula1.com/en/results",
     "Season-by-season classifications and race results.", "official",
     "FOM copyright.", "Per event.",
     "The winner of every race is held independently from the Wikipedia "
     "harvest; the two must agree."),
    (8, "Wikipedia season results tables", "https://en.wikipedia.org/wiki/List_of_Formula_One_World_Championship_points_scoring_systems",
     "Admitted as a REFERENCE source for race-by-race results only (see the 'reference' confidence tier). Its season tables are transcribed from FIA classifications, and a race winner harvested from them is compared on load with F1DB's. Not admissible for narrative, attribution or contested claims, and never promoted to 'verified' without an FIA/F1 check.", "reference",
     "CC BY-SA 4.0. Share-alike reaches any prose taken from it - see "
     "ATTRIBUTION.md.", "Continuous, by anyone.",
     "Race count per season, contiguous rounds, and every driver and "
     "constructor name resolving to the register. NOT sufficient on its own "
     "for standings grids: they left-pack their cells, a driver who missed a "
     "round shifts every later result a column, and the winner cross-check "
     "passes anyway because winners sit in the dense top rows. That route "
     "is closed."),
    (9, "Fan sites, Reddit, secondary media, unsourced databases", None,
     "FORBIDDEN as authority under this database's verification policy. May be used to locate an official source, never to establish a fact.", "forbidden",
     "Various and mostly unstated.", "Various.",
     "Nothing. That is the reason for the ban, not the size of the data."),

    (10, "F1DB", "https://github.com/f1db/f1db",
     "Since v2.15 the primary source for RESULTS as well as registers: the "
     "full classification for all {{fig:races_completed}} races ({{fig:race_entries}} entries, 1950-2026), "
     "qualifying ({{fig:qualifying}}), championship standings after every round ({{fig:standings}}) "
     "and pit stops ({{fig:pit_stops}}) - plus the chassis, engine, constructor and "
     "per-season entrant register it already supplied, and since 2026-09-13 "
     "the outline of every one of its {{fig:circuit_outlines}} circuit layouts (SVG assets drawn "
     "by Jules Roy) with the layout each race ran. Loaded by "
     "tools/f1db_fetch.py into diffable text, then built offline.",
     "reference",
     "CC BY 4.0 - attribution only, no share-alike, and NO NON-COMMERCIAL "
     "CLAUSE. That last absence is not a footnote: it is the reason the full "
     "classification ships in the committed database when the same facts "
     "from Jolpica-F1 could only ever be loaded onto a local copy. The most "
     "permissive licence of any bulk source used here, and now the most "
     "consequential.",
     "Re-released after every race, versioned, with a public commit history "
     "and a changelog. Better maintained than anything else at this scale.",
     "Heavily, in four independent places, all of them held here before F1DB "
     "was read. (1) The winner of every one of the {{fig:races_completed}} races was established here "
     "before F1DB was read - from the Wikipedia harvest, and from "
     "formula1.com for the seasons it covers; a race whose winner "
     "disagreed is refused WHOLE, and "
     "none was. The comparison is on sets, because a shared drive puts two "
     "drivers on position 1 and both are winners. (2) The champion, the "
     "runner-up and both their point totals for {{fig:seasons_reproduced}} seasons were already in "
     "`seasons`; the final standings must reproduce all four and do. "
     "(3) Qualifying position 1 is checked against the pole-sitter already "
     "stored - 13 races differ, every one a grid penalty or a sprint "
     "weekend, each recorded rather than resolved. (4) Its (constructor, "
     "season) -> chassis mapping is checked against the {{fig:car_seasons}} CAR_SEASONS "
     "assertions already proved against published win totals. It carries NO "
     "technical specifications at all, so nothing it says can be mistaken "
     "for one."),

    (11, "Wikipedia per-car articles ({{Racing car}} infobox)",
     "https://en.wikipedia.org/wiki/Category:Formula_One_cars",
     "Chassis specifications: construction, suspension, engine, gearbox, "
     "brakes, weight, wheelbase, track, tyres, designers, predecessor and "
     "successor. There is no unified specification dataset for Formula One "
     "cars anywhere; this is where the data lives. Harvested by "
     "tools/wikispec_fetch.py.", "reference",
     "CC BY-SA 4.0.", "Continuous, by anyone; a historic car's article may "
     "not change for years, which for a fixed specification is a feature.",
     "Three checks, all of which must pass before a page is read at all: "
     "the constructor the infobox names must be the one F1DB gives the "
     "chassis; the years it reports must fall inside the seasons F1DB "
     "records it entered; and the article title must be a form of the "
     "chassis's own name. Afterwards its published win total is reconciled "
     "against the wins derived from this database's race records."),

    (12, "Jolpica-F1 (Ergast's maintained successor)",
     "https://api.jolpi.ca/ergast/f1/",
     "A SECOND OPINION on the full classification, which F1DB now supplies "
     "under a licence that permits committing it. tools/ergast_load.py no "
     "longer overwrites: it compares, records every disagreement in "
     "`discrepancies`, and leaves the stored value alone. It remains the "
     "ONLY source here for 628,454 lap times back to 1996, which F1DB does "
     "not carry.", "reference",
     "CC BY-NC-SA 4.0 on the Ergast data it continues: NON-COMMERCIAL. The "
     "most restrictive licence of any source here, and the reason these rows "
     "are loaded locally rather than committed. That restriction now costs "
     "nothing for results, because F1DB supplies the same facts under CC BY.",
     "Per event, community-run, and explicitly a volunteer continuation "
     "after Ergast's shutdown - the least certain future of any source here.",
     "Now cuts both ways. Its winner must still equal the one already "
     "stored or the race is refused whole. Beyond that it CHECKS rather than "
     "writes: on a full load it disagrees with F1DB on 118 of 26,082 "
     "finishing positions, 0.45 per cent, and the pattern is a real "
     "difference in reading rather than an error - F1DB leaves a "
     "disqualified driver's position vacant while Jolpica promotes everyone "
     "below, so the 1983 Brazilian Grand Prix has no second place in one "
     "and Lauda second in the other. Its reconciliation caught a "
     "hand-relayed fabrication in v2.7 and the loader's own resolver handing "
     "Wilson Fittipaldi's Brabham results to his brother Emerson. The dump "
     "path is checked against the API path race by race (--verify-dump), "
     "because a second fetch implementation is a second place to be wrong."),

    (13, "OpenF1", "https://openf1.org",
     "Car telemetry from 2023: speed, throttle, brake, RPM, gear and "
     "position at about 3.7 Hz, plus intervals, stints and radio. Free with "
     "no authentication for historical data; only real-time needs a "
     "subscription. NOT loaded: it covers 2023+ where FastF1 covers 2018+, "
     "and telemetry does not belong in this file at all.", "reference",
     "MIT for the code; the underlying data is Formula One Management's.",
     "Real-time during a session.",
     "Its lap and stint data can be checked against FastF1's for the "
     "overlapping seasons, which is the only reason it would be worth "
     "adding. Nothing in this database constrains a telemetry sample."),

    (14, "Formula 1 live timing, via FastF1",
     "https://github.com/theOehrly/Fast-F1",
     "Per-lap timing, tyre stints, pit stops, race control messages and the "
     "team radio index, 2018 onwards. Loaded by tools/fastf1_load.py.",
     "reference",
     "MIT for the library; the data is Formula One Management's and FastF1's "
     "guidance is personal, non-commercial use. Never committed here.",
     "Live during a session; nothing exists before 2018 and nothing will.",
     "Its finishing order is checked against the winner already stored, the "
     "same test the Jolpica loader applies."),

    (15, "Wikimedia Commons (via the MediaWiki API)",
     "https://commons.wikimedia.org/",
     "The lead photograph of each accepted car article, and the attribution "
     "needed to display it; for a chassis with no article, a photograph filed "
     "under the Commons category named for it (AF-42). Loaded by "
     "tools/wikimedia_images.py. NO IMAGE IS "
     "STORED - article_images holds a reference and its credit, and the "
     "pixels are fetched from upload.wikimedia.org by whatever renders the "
     "page.", "reference",
     "Per file, and they differ: sixteen distinct licence strings across {{fig:article_images}} "
     "rows - CC BY-SA at four versions, CC BY at four more, CC0, public "
     "domain and national variants. There is no blanket credit line, so each "
     "row carries its own and the build refuses a file that names no author.",
     "Continuous, by anyone. The lead image of an article is whatever an "
     "editor last put there, which is why the Commons-only and licence "
     "checks run on every build rather than once at harvest.",
     "Weak, and this is the one place in the database where that is true. "
     "The ARTICLE is constrained - it already passed the three checks in "
     "tools/wikispec_fetch.py for constructor, seasons and name - so the "
     "claim recorded is 'the article proved to describe this chassis leads "
     "with this file'. But nothing here constrains what a photograph SHOWS, "
     "and there is no second source to disagree. Testing whether the file "
     "name mentions the car finds only {{fig:article_route_named}} of {{fig:article_route_images}}, because most correct "
     "images are filed under the driver, so the test is recorded as "
     "name_matches and enforced nowhere. The failure it half-detects is "
     "real: the ATS D5 article leads with a photograph of officials and "
     "police. These rows are 'unverified' because that is what they are. "
     "For a chassis with no article, a photograph filed under a Commons "
     "category named for it is taken instead and held one rung lower, at "
     "'catalogued' (AF-42)."),

    (16, "OpenStreetMap (via api.openstreetmap.org)",
     "https://www.openstreetmap.org/",
     "Circuit centrelines: the shape of each track as currently mapped, "
     "stored as GeoJSON on circuit_geometry. Loaded by "
     "tools/osm_geometry.py. Relation ids come from Wikidata (P402), which "
     "is CC0 and brokers the identifier without constraining anything.",
     "reference",
     "ODbL 1.0 - share-alike AND a database right. That is a different "
     "obligation from every other source here, and it is confined to one "
     "table on purpose; see ATTRIBUTION.md. Nothing else derives from it.",
     "Continuous, by anyone, and it maps only what is on the ground NOW. "
     "There is no historic geometry to be had: Spa's 14.1 km road course and "
     "Monza's banking are unmapped and unmappable, and Wikidata's own "
     "layout entities carry length and dates but no coordinates.",
     "Strong, and it fired immediately. A circuit relation is not an ordered "
     "ring - its members include the pit lane - so a naive sum puts Monaco "
     "at 3.745 km against a published 3.337, twelve per cent long, and "
     "nothing about that number looks wrong on its own. What rejects it is "
     "length_km, held here before OSM was consulted. Excluding the pit lane "
     "by member role gives 3.388 km, and anything outside two per cent is "
     "refused rather than stored with a caveat. The measurement is then "
     "re-run in build.py from the stored coordinates, with its own copy of "
     "the arithmetic, because sharing the tool's would check nothing."),

    (17, "Wikipedia per-circuit articles", "https://en.wikipedia.org/wiki/Category:Formula_One_circuits",
     "Circuit configuration timelines: which layout was raced in which years, "
     "its length and turn count, and why it changed. Feeds circuit_layouts.",
     "reference",
     "CC BY-SA 4.0. The change_reason prose follows the article and carries "
     "share-alike with it - see ATTRIBUTION.md.",
     "Continuous, by anyone. A circuit that last changed shape in 1974 has an "
     "article that may not have been edited in years, which cuts both ways.",
     "Real but partial. A circuit's layout rows must form a complete, "
     "non-overlapping timeline or the build fails, and where a layout is "
     "still current its length is checked against the OSM trace. Neither "
     "test reaches a historic layout's length, which nothing here can "
     "contradict."),

    (18, "Written for this project from general knowledge", None,
     "The glossary, the era and engine-era periodisations, the governance and "
     "safety timelines, the technical-innovation notes, the constructor "
     "lineage chains, the points-system table, the tyre-supplier list, the "
     "grand prix register, the personnel notes and the engine-manufacturer "
     "notes. Twelve tables; the records list left it in v2.23, derived from "
     "the race records instead of written.",
     "authored",
     "Original to this repository, and the only content here under no "
     "external obligation at all.",
     "Whenever somebody edits it. There is no upstream to track and no "
     "version to pin.",
     "NOTHING, and that is the entire point of giving it a name. It has no "
     "external source to be compared against and no check in verify.py that "
     "constrains a value - what "
     "constrains grands_prix, constructor_lineage and personnel is "
     "referential and temporal only: ids resolve, years run forwards, and "
     "a lineage period holds its constructor's race entries. Those prove the "
     "shape and say nothing about the claim - that Toleman and Alpine are one "
     "team. So nothing here may "
     "sit above 'medium', which is what that tier means: correct in "
     "substance, confirm the figure before publishing. It sat at 'high' "
     "until v2.16, which promised more than anything could deliver."),
]

# How a free-text `source` resolves to a registry entry. Anchored at the
# start of the string; a longest-prefix match on source_registry.url is tried
# first, then these in order. See source_patterns in schema.sql for why this
# is a table rather than one column.
SOURCE_PATTERNS = [
    (1,  r"^https://www\.fia\.com/", "any FIA page"),
    (3,  r"^https://www\.formula1\.com/", "all of formula1.com; entries 4-7 are its sections"),
    (8,  r"^https://en\.wikipedia\.org/wiki/\d{4}_Formula_One_World_Championship",
     "season articles - the results, pole and venue harvests"),
    (8,  r"^https://en\.wikipedia\.org/wiki/List_of_Formula_One", "the list articles"),
    (8,  r"^https://en\.wikipedia\.org/wiki/\d{4}_.*Grand_Prix", "per-race articles - team radio"),
    (10, r"^https://github\.com/f1db/f1db", None),
    (12, r"^https://api\.jolpi\.ca/", None),
    (15, r"^https://commons\.wikimedia\.org/", None),
    (16, r"^https://www\.openstreetmap\.org/", None),
    # Everything else on en.wikipedia is a topic or per-car article. Last, so
    # the three specific Wikipedia patterns above win first.
    (11, r"^https://en\.wikipedia\.org/wiki/", "per-car and per-topic articles"),
    # The bare token pit_stops carries. It is part of that table's natural
    # key, so it stays a token rather than becoming the URL. Until it had a
    # pattern its 22,506 rows resolved to nothing and no check noticed: the
    # check read only tables with a `confidence` column, and pit_stops has
    # none (DA-03).
    (10, r"^f1db$", "the bare token pit_stops carries"),
]

# ------------------------------------------------------------------ claims
#
# PM-14. The columns `claims` backs: (tbl, column) -> what the column holds.
# A claim's `field` is a column of its table, and its value is the value that
# column holds as the claim's source gave it - so which source stands behind
# one value in one column of one row is a lookup, where the row's source_id
# answers only for the row as a whole.
#
# The build refuses a claim on a column not named here. verify.py requires
# every column named here to be exactly its claims: one claim per row, the
# same value, and no value without one - except a driver figure typed from
# reference records nobody named, which has no source to claim and so no
# claim (PM-57, #624). A new kind of claim is therefore a declaration, and a
# column that stops being backed fails rather than thinning out.
CLAIM_FIELDS = {
    ("drivers", "wins_external"): "career wins as a source other than the race records gives them",
    ("drivers", "poles_external"): "career poles, likewise",
    ("drivers", "fastest_laps_external"): "career fastest laps, likewise",
    ("drivers", "podiums_external"): "career podiums, likewise",
    ("chassis", "published_races"): "the career the chassis's Wikipedia article publishes for its subject",
    ("chassis", "published_wins"): "likewise, wins",
    ("chassis", "published_poles"): "likewise, poles",
    ("car_seasons", "other_chassis"): "chassis F1DB's entry lists name for the constructor that season beyond the ones the car covers",
}

# Provenance for the tables that carry `confidence` and no `source` column.
# (tbl, source_id, unconstrained, note)
TABLE_PROVENANCE = [
    ("glossary", 18, 0, None),
    ("eras", 18, 0, None),
    ("engine_eras", 18, 0, None),
    ("governance", 18, 0, None),
    ("safety_milestones", 18, 0, None),
    ("technical_innovations", 18, 0, None),
    ("points_systems", 18, 0, None),
    ("tyre_suppliers", 18, 0, None),
    ("constructor_lineage", 18, 0,
     "The chains are an editorial reading. Nothing official says Toleman and "
     "Alpine are one team."),
    ("grands_prix", 18, 0,
     "Only partly authored: editions, first_held, last_held and circuits_used "
     "are DERIVED from `races` in build.py. The name, country, aliases and "
     "notes are written here, and those are what the tier describes."),
    ("personnel", 18, 0, "The `significance` field is a judgement, not a fact."),
    ("engine_manufacturers", 18, 0, None),
    # Derived, not authored: since v2.23 every row is a query in build.py
    # (derive_records) over race_entries, races, seasons, drivers, circuits and
    # the final standings. The classification those tables hold is F1DB's,
    # which is why the table resolves here; the pole and fastest-lap credits
    # come from the Wikipedia season tables (8) and the champions from
    # `seasons`, and each row's `detail` names the tables it was read from.
    # verify.py recomputes a sample by another route and holds as_of to the
    # last completed race.
    ("records", 10, 0,
     "Derived in build.py from the race records; each row's detail names its "
     "inputs and rule. verify.py recomputes a sample by a different query."),
    # Sourced, and simply never given the column.
    ("circuit_layouts", 17, 0, "Wikipedia per-circuit articles; see ATTRIBUTION.md."),
    ("season_entries", 3, 0, "The 2026 entry list, from formula1.com."),
    ("article_images", 15, 1,
     "The article is well constrained - it passed the constructor, seasons "
     "and name checks before being accepted. That the PHOTOGRAPH shows the "
     "car is not established and nothing here can establish it. known_gaps #11. "
     "Rows on the category route (AF-42) have no article at all: a Commons "
     "category named for the chassis stands in for it, and they sit a rung "
     "lower, at 'catalogued'."),
    ("circuit_geometry", 16, 0, None),
]


# priority -> (redistributable, share_alike, attribution_required, domains)
#
# The prose in `licence` above is written for a person. This is the same
# judgement written for the BUILD, and it exists because a licence nobody can
# query is a licence nobody enforces: a CC BY-NC citation sat in the committed
# database for seven versions because knowing it was there meant reading a
# paragraph and recognising which of sixteen sources a URL belonged to.
#
#   yes         may be redistributed on the terms given
#   facts-only  the FACTS may be restated - a race winner, a circuit length
#               and a points total are not copyrightable - but none of the
#               source's own expression may be copied and no substantial
#               extraction of its database made. This is the correct class
#               for the official sources: this database cites them as the
#               AUTHORITY for a fact, and holds none of their prose.
#   no          may not be redistributed at all. verify.py fails if any row
#               in the committed database cites one.
#
# `domains` is how a row's `source` is recognised: hostnames, plus the bare
# tokens the loaders write. NULL where no row ever cites the entry.
SOURCE_LICENCE = {
    # The official sources. Every row citing one holds a fact and nothing
    # else - see docs/COMMERCIAL-READINESS.md, which classifies all 539.
    1:  ("facts-only", 0, 0, "fia.com"),
    2:  ("facts-only", 0, 0, "fia.com"),
    3:  ("facts-only", 0, 0, "formula1.com"),
    4:  ("facts-only", 0, 0, "formula1.com"),
    5:  ("facts-only", 0, 0, "formula1.com"),
    6:  ("facts-only", 0, 0, "formula1.com"),
    7:  ("facts-only", 0, 0, "formula1.com"),

    # Wikipedia. Share-alike reaches the prose taken from it, which is why
    # the whole data release is CC BY-SA - see LICENSE-DATA.
    8:  ("yes", 1, 1, "en.wikipedia.org"),
    11: ("yes", 1, 1, "en.wikipedia.org"),
    # 17 arrived on a branch that predates these columns, and the build's
    # refusal to guess is what caught it at the merge. Same site, same licence
    # as 8 and 11.
    17: ("yes", 1, 1, "en.wikipedia.org"),

    # Forbidden as authority, and pointed at by nothing.
    9:  ("no", 0, 0, None),

    # F1DB. Attribution only, no share-alike, no non-commercial clause - the
    # most permissive licence here and the reason the full classification
    # ships. `f1db` is the bare token pit_stops carries.
    10: ("yes", 0, 1, "github.com,f1db"),

    # Non-commercial or FOM-owned. Loaded onto a local copy by tools/ and
    # never committed; the REDISTRIBUTION section in verify.py enforces it.
    12: ("no", 1, 1, "api.jolpi.ca,jolpica"),
    13: ("no", 0, 0, "openf1.org"),
    14: ("no", 0, 0, "fastf1"),

    # Sixteen distinct file licences, all free, all requiring attribution.
    # share_alike is set because most of them are a CC BY-SA version and the
    # conservative reading is the one to record here; the per-file licence on
    # the row is what actually governs each image.
    15: ("yes", 1, 1, "commons.wikimedia.org,upload.wikimedia.org"),

    # ODbL: share-alike AND a database right, confined to circuit_geometry.
    16: ("yes", 1, 1, "openstreetmap.org"),

    # The project's own writing. It has no upstream to be licensed FROM and no
    # domain to match a URL against, so it takes the licence the release itself
    # carries. Nothing here may sit above 'medium' - see the authored ceiling
    # in build.py and docs/DERIVED-CONFIDENCE.md - but that is a confidence
    # question, not a redistribution one: it is ours to publish.
    18: ("yes", 1, 1, None),
}

# --------------------------------------------------- the project's own prose
#
# PM-47. The release is CC BY-SA 4.0 because prose taken from or closely
# following Wikipedia is in it and share-alike runs with that prose.
# LICENSE-DATA says so, and says why the line was drawn around the whole file
# rather than around the prose: "Rather than draw a line field-by-field, the
# whole data release is licensed CC BY-SA 4.0." That was a convenience and not
# an obligation, and it swept up writing that has no upstream at all.
#
# These columns are that writing. The assessment of each disagreement between
# sources is this project's reading of it, reached here; every column of
# known_gaps - what a reader is shown, the maintainer's note, what would close
# it - was written here for this project. Nothing in either came from
# anywhere else, so nothing in either owes share-alike to anyone. They are
# offered under CC BY 4.0: attribution, and no condition on what a reader
# builds. That is the licence F1DB already gives this project for 97% of its
# sourced rows.
#
# A CC BY grant is not retractable from a copy already taken, which is why
# this list is short and why every name on it has to be a column nobody else
# wrote. The line stops here on purpose: `source_registry` entry 18 names
# twelve further tables as authored, and whether that prose is equally free of
# Wikipedia is read one way by ATTRIBUTION.md and another by the 2026-09-21
# data-architecture critique. PM-49 (#573) holds that question, PM-17 (#249)
# is the pass that would answer it, and nothing else moves until it does.
#
# build.py writes both values into `meta`, so the grant travels with the file
# and not only with the repository, and verify.py checks that the two licence
# documents name every column it covers.
PROJECT_PROSE_COLUMNS = [
    "discrepancies.assessment",
    "known_gaps.area",
    "known_gaps.reader",
    "known_gaps.description",
    "known_gaps.resolution",
]

PROJECT_PROSE_NOTE = (
    "The columns named in meta.project_prose_columns are this project's own "
    "writing. They have no upstream source and carry no share-alike "
    "obligation, and they are offered under CC BY 4.0 "
    "(https://creativecommons.org/licenses/by/4.0/) - attribution to Lap "
    "Ledger, and no condition on what you build from them. Everything else "
    "in this file stays CC BY-SA 4.0: see LICENSE-DATA, which names what the "
    "share-alike comes from. The remaining columns of those two tables hold "
    "facts and identifiers rather than expression.")

# ------------------------------------------------------------- identifiers
#
# Which `id` a reader may keep, and which one they may not (DA-04).
#
# Seventeen per cent of `race_entries.id` moved between v2.20 and v2.21, and
# nothing in the database or the README said whether that was allowed. It is:
# an INTEGER PRIMARY KEY here is a SURROGATE, handed out in the order the
# build happens to insert rows, so a source read in a different order shifts
# every id after the row it added. A text id - `hamilton`, `monza`,
# `lotus-79` - is a natural key and does not move; an integer one is an
# implementation detail unless something says otherwise.
#
# So every table with a surrogate id says which it is:
#
#   "stable"    this release undertakes not to renumber them. A reader may
#               store them.
#   "unstable"  the ids are the build's business. Join on the natural key.
#
# "stable" is an UNDERTAKING and not a measurement. Nothing in the build
# compares a release with the one before it - doing that is the M half of
# DA-04 - so what keeps the promise is whoever changes a loader reading this
# comment. Write nothing here that the artefacts do not bear out: `records`
# was proposed for the stable list and is not on it, because 23 of its 29 ids
# moved between v2.21 and v2.23.
#
# The second element is the NATURAL KEY - the columns that identify the fact
# rather than the row - or None where none has been established. It is the
# tuple to join on whichever way the first element reads, and verify.py
# checks on every build that each declared one identifies exactly one row: a
# published key that does not is worse than no key at all, because a reader
# joining on it silently doubles their rows rather than failing.
#
# build.py REFUSES a surrogate-id table that is not listed here, the way it
# refuses a source with no licence class. The default for a new table is not
# "unstable", it is "nobody has decided yet".
ID_STABILITY = {
    # The stable ones. Each natural key is the grain the table is built at:
    # one row per driver per race, per entrant's chassis-engine per season,
    # per stop.
    "circuit_layouts":       ("stable",   ("circuit_id", "layout_key")),
    # The table's own UNIQUE, and deliberately not (race_id, driver_id,
    # stop_number): `source` is 'f1db' on every row of the DISTRIBUTED database
    # and would look redundant here, but a local F1_LOCAL_TIMING load puts
    # fastf1 rows beside them, and a published key that duplicates the moment
    # somebody exercises a supported path is not a key.
    "pit_stops":             ("stable",   ("race_id", "source", "driver_key",
                                           "stop_number")),
    "qualifying":            ("stable",   ("race_id", "driver_id")),
    # One row per driver per race even where a driver drove two cars, which
    # was normal before 1965 - see the `finish_position` row of `known_gaps`.
    "race_entries":          ("stable",   ("race_id", "driver_id")),
    "races":                 ("stable",   ("year", "round")),
    "season_entrants":       ("stable",   ("year", "entrant_id",
                                           "f1db_constructor_id",
                                           "engine_manufacturer_id")),
    "sprint_results":        ("stable",   ("race_id", "driver_id")),

    # `records.id` is `enumerate(derive_records(cur), 1)` - a position in a
    # derived list, so inserting one record renumbers every row after it. 23 of
    # 29 moved between v2.21 and v2.23. The table has a real key and that is
    # what a reader should hold; the id is the order the build wrote them in.
    "records":               ("unstable", ("key",)),

    # The two registers this project originates rather than re-exports, each
    # given a name to cite a row by. `discrepancies.key` is made from the
    # (tbl, row_key, field) the row is about, so it follows the fact (DA-09);
    # the three columns are not the key themselves because a figure a whole
    # grid quoted has no one row, and its NULL row_key would collapse every
    # such row into one. `known_gaps.key` is written by hand in
    # data/harvest.py beside the id, and like it is never reused (DA-24).
    "discrepancies":         ("unstable", ("key",)),
    "known_gaps":            ("unstable", ("key",)),

    # Unstable, and the one a reader is most likely to have joined to: a
    # running season's table is reloaded whole, so every id in it moves. The
    # key needs `position_text` because 2018 holds Force India twice in the
    # constructors' final table - the excluded entity on nought points and
    # the re-entered one on 52 - which is a real fact and not a duplicate.
    # Making the insert order deterministic is the M half of DA-04. Four of
    # the nine columns hold NULL - `driver_id` on every constructors' row and
    # `constructor_id` on every drivers' one, `engine_id` on every drivers' row
    # because a driver has no engine, and `position_text` on a handful - so
    # this is a key to join with `IS`, SQLite's null-safe comparison, and not
    # with `=`, which would drop most of the table in silence. The README
    # marks all four.
    # `after_round` was the third until DA-01 filled it on every row. After
    # v2.24 (DA-31) `as_of` left the key and the table, and the two things it
    # told apart are the two columns that replaced it: `basis`, a season's
    # final table from its running one after the last round, and `source`,
    # the official snapshot from F1DB's table after the same round. The one
    # `entity_id` became `driver_id` and `constructor_id` (DA-10).
    # It is `ux_standings_identity` in schema.sql, column for column: the
    # database already enforces this key, and publishing a narrower one would
    # have said the grain was something the schema does not agree with.
    "standings":             ("unstable", ("year", "table_type", "after_round",
                                           "basis", "driver_id",
                                           "constructor_id", "engine_id",
                                           "source", "position_text")),

    # Unstable, with no natural key published yet. Each is either a register
    # small enough to read whole or one of the timing tables that ship empty
    # under the licence decision in docs/TIMING-ARCHITECTURE.md. Declaring a
    # key for one of them is a change to that table, not to this list.
    "constructor_lineage":   ("unstable", None),
    "engine_eras":           ("unstable", None),
    "eras":                  ("unstable", None),
    "governance":            ("unstable", None),
    "laps":                  ("unstable", None),
    "points_systems":        ("unstable", None),
    "race_control_messages": ("unstable", None),
    "regulation_changes":    ("unstable", None),
    "regulation_limits":     ("unstable", None),
    "safety_milestones":     ("unstable", None),
    "season_entries":        ("unstable", None),
    "sessions":              ("unstable", None),
    "source_patterns":       ("unstable", None),
    "source_registry":       ("unstable", None),
    "stints":                ("unstable", None),
    "team_radio":            ("unstable", None),
    "technical_innovations": ("unstable", None),
    "tyre_suppliers":        ("unstable", None),
}

# The sentence the database carries as `meta.id_stability`. It is written out
# here rather than assembled in build.py so that the policy and the tables it
# governs sit on one screen.
ID_STABILITY_NOTE = (
    "Integer `id` columns are surrogates, handed out by the build in insert "
    "order, and are NOT stable between releases except in the tables named by "
    "meta.id_stability_stable. There the maintainers undertake not to renumber "
    "them; nothing in the build measures that, because no release is compared "
    "with the one before it. Join on the natural keys published in "
    "meta.id_stability_keys - a `?` in one of those marks a column that holds "
    "NULL, so join it with IS rather than =. A text id is a natural key and "
    "does not move.")

PROVENANCE = [
    ("verified", 1, "Checked directly against an official FIA or Formula 1 source during database construction. Safe to state as fact and to cite.", 1),
    ("high", 2, "A well-established record, consistently published in official sources over many years. Safe to rely on; cite the official archive if publishing.", 1),
    ("reference", 3, "Taken from a published secondary record rather than an official one: F1DB for almost all of it, and for most of the rest Wikipedia's season results tables or its per-car and per-topic articles. A few regulation limits read from the FIA's own regulations sit here too. Where a second source held here covers the same fact the two are compared on load - a race's winner, where one is already held from another source, against F1DB's, for one - but some tables at this tier, the entrant, engine and sprint registers among them, have no second source, so the tier alone does not say a row was cross-checked. Reliable; not official under this database's policy, so cite the FIA/F1 archive if publishing.", 1),
    ("medium", 4, "Correct in substance. An exact figure or date may have drifted or may move with the current season. Confirm before publication.", 0),
    ("unverified", 5, "Placeholder, disputed, or known to be incomplete. Never state as fact.", 0),
    # AF-42. Below unverified because it is not even a claim this database
    # makes: it is where someone else filed something.
    ("catalogued", 6, "Not checked by anyone, here or at a source: a photograph that Wikimedia Commons editors filed under a category named for the chassis. A category also holds replicas, scale models, show cars and museum mock-ups, and nothing here can tell them from the car that raced. Never present it as the car without a person looking first.", 0),
]

# DA-05. The registry sources a tier's definition names, by id, each with the
# words the definition names it by. The `reference` definition said Wikipedia
# for years while F1DB supplied nearly every row at that tier, and nothing
# could notice. verify.py now holds both directions: every phrase below is in
# the shipped definition, and the sources declared here are exactly the ones
# the tier's rows resolve to - by `source_id`, or by `table_provenance` for a
# table without a `source` column. So a source that starts supplying a tier
# fails the build until its definition says so, and one that stops fails it
# until the definition stops saying so. A tier absent from this map names a
# kind of source ("an official FIA or Formula 1 source"), not a registry
# entry, and is not held to one. What is held is that a phrase appears, not
# what the sentence around it says: nothing here checks the definition's
# account of cross-checking, which is prose, and is the reason it names no
# table as checked that has no second source.
PROVENANCE_SOURCES = {
    "reference": {
        10: "F1DB",
        8:  "Wikipedia's season results tables",
        11: "per-car and per-topic articles",
        1:  "the FIA's own regulations",
    },
    "catalogued": {
        15: "Wikimedia Commons",
    },
}


# ---------------------------------------------------------------------------
# A championship total is the sum of what the cars scored
#
# The running total after round N is what the entrant scored in rounds 1..N.
# That is arithmetic over rows this database already holds, so it is the one
# cross-check that can see a standings file which was not updated - the
# failure a source figure compared only with another source figure cannot
# show.
#
# 2026 round 14 is why it exists. F1DB v2026.14.0 published a
# constructor-standings.yml for round 14 holding round 13's totals, byte for
# byte, for all eleven entries, while its driver-standings.yml for the same
# round was current. The build stored what the file said, and lapledger.org
# showed Mercedes on 468 when their two drivers had 503 between them.
#
# The first version of this rule only asked whether the total MOVED. The
# review of #583 showed why that is not enough: it cannot see a figure that
# moved by the wrong amount, and it let two consecutive stale rounds converge
# on a number no source ever published. The rule is the value.
#
# FROM WHICH SEASON, measured rather than assumed
# (`python3 tools/standings_rule.py --survey`):
#
#   drivers, 1991 - dropped scores. Until 1990 a driver's total counted only
#   their best N results, so it is not the sum of what they scored. From 1991
#   every one of the 12,640 driver rows in this database is exactly that sum,
#   with no exceptions at all.
#
#   constructors, 1979 - before 1979 only the best-placed car of each
#   constructor scored. From 1979 the only rows that are not the plain sum are
#   the six adjustments declared below, each one a decision somebody took and
#   published.
STANDINGS_ACCUMULATE_FROM = {"constructors": 1979, "drivers": 1991}

# The six rows in the whole file, from 1979 for constructors and 1991 for
# drivers, where the championship total is deliberately not the sum of what
# the cars scored. Each is (from_round, adjustment, why): an adjustment of
# 'zero' means the table reads zero from that round, and a number is added to
# the sum from that round on. They are scoped to the round the decision took
# effect, so every earlier round of the same entrant is still checked.
STANDINGS_ADJUSTMENTS = {
    ("constructors", 1995, "benetton"): (2, -10.0, (
        "Both cars were excluded from the Brazilian Grand Prix result over a "
        "fuel sample. The drivers' points were restored on appeal and the "
        "constructors' were not, so the table runs 10 behind the sum of its "
        "cars' points for the rest of the season. From round 2 and not round "
        "1 because F1DB publishes no round-1 table for either team - the "
        "classification they were excluded from is the one that would have "
        "been round 1's.")),
    ("constructors", 1995, "williams"): (2, -6.0, (
        "The same Brazilian Grand Prix decision and the same missing round-1 "
        "table: Coulthard's six constructors' points were not restored when "
        "his own were.")),
    ("constructors", 2000, "mclaren"): (10, -10.0, (
        "Hakkinen's Austrian Grand Prix win was struck from the "
        "constructors' championship after a seal was found missing from the "
        "electronic control unit. The driver kept the points; the constructor "
        "did not.")),
    ("constructors", 2007, "mclaren"): (1, "zero", (
        "Excluded from the 2007 constructors' championship by the World Motor "
        "Sport Council on 13 September 2007. The cars scored in every round "
        "from Australia to Brazil and the constructor received none of it, so "
        "the table reads zero after all seventeen rounds while the drivers' "
        "totals move.")),
    ("constructors", 2018, "force-india"): (13, -59.0, (
        "The team went into administration and was re-entered from Spa as a "
        "new constructor. The 59 points scored before round 13 stayed with "
        "the entity that scored them and did not carry.")),
    ("constructors", 2020, "racing-point"): (5, -15.0, (
        "Fifteen points deducted after the brake-duct protest, applied to the "
        "table at round 5 and carried by every total after it.")),
}

# A constructor that ran two engines in one season has two championship
# entries - the championship is contested by a chassis-engine pair - and
# `race_entries` names no engine, so a round's points cannot be split between
# them. Those entity-seasons are not checked, and this is the whole of that
# exemption. Measured: 20 entity-seasons and 352 rows, of which the ones from
# 1979 are 1982 Brabham, 1983 Lotus, 1983 Williams, 1984 Arrows and 1985
# Tyrrell. Summing a season's engines together and checking the total instead
# surfaces four further violations, all below the 1979 floor, so nothing
# modern hides here - but a constructor that changes engine mid-season takes
# its whole season out of the rule, which is a gap worth knowing about rather
# than one this file can close.
# Pinned, because an exemption that can quietly grow is one nobody notices
# growing: verify.py fails if these stop being the figures, and a constructor
# that takes a second engine mid-season therefore arrives as a failed check
# and a decision rather than as 20-odd rows leaving the rule in silence. The
# five from 1979 are 1982 Brabham, 1983 Lotus, 1983 Williams, 1984 Arrows and
# 1985 Tyrrell.
STANDINGS_MULTI_ENGINE_UNCHECKED = {
    "why": ("a chassis-engine pair's share of a round's points is not "
            "recoverable from race_entries, which names no engine"),
    "entity_seasons": 20,
    "rows": 352,
}
