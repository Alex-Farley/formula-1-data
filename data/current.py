# -*- coding: utf-8 -*-
"""
2026 season: entries, calendar, standings, regulations status.
Plus verified race-winner records for 2025 and 2026.

Everything here was checked against formula1.com on 2026-09-04.
"""

SOURCE_F1 = "https://www.formula1.com/en/results/2026"

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

SOURCE_REGISTRY = [
    (1, "FIA Formula 1 regulations", "https://www.fia.com/regulations/formula-1",
     "Primary authority for sporting, technical, financial and operational rules.", "official"),
    (2, "FIA 2026 Formula One Championship archive",
     "https://www.fia.com/events/fia-formula-one-world-championship/season-2026/2026-fia-formula-one-world-championship",
     "Primary authority for FIA championship calendar, classifications and event status.", "official"),
    (3, "Formula1.com", "https://www.formula1.com/",
     "Official Formula 1/FOM source for teams, drivers, cars, schedules, results and official explainers.", "official"),
    (4, "Official F1 team websites", "https://www.formula1.com/en/teams",
     "Official team facts, car names, power units, staff, bases and team history.", "official"),
    (5, "Official circuit/promoter sources", "https://www.formula1.com/en/racing/2026",
     "Circuit/event facts; verify against FIA homologation where a technical or legal detail matters.", "official"),
    (6, "Official driver profiles", "https://www.formula1.com/en/drivers",
     "Driver nationality, number, biography and career statistics.", "official"),
    (7, "F1 results archive", "https://www.formula1.com/en/results",
     "Season-by-season classifications and race results.", "official"),
    (8, "Wikipedia season results tables", "https://en.wikipedia.org/wiki/List_of_Formula_One_World_Championship_points_scoring_systems",
     "Admitted as a REFERENCE source for race-by-race results only (see the 'reference' confidence tier). Its season tables are transcribed from FIA classifications and were cross-checked on load against independently held season data. Not admissible for narrative, attribution or contested claims, and never promoted to 'verified' without an FIA/F1 check.", "reference"),
    (9, "Fan sites, Reddit, secondary media, unsourced databases", None,
     "FORBIDDEN as authority under this database's verification policy. May be used to locate an official source, never to establish a fact.", "forbidden"),
]

PROVENANCE = [
    ("verified", 1, "Checked directly against an official FIA or Formula 1 source during database construction. Safe to state as fact and to cite.", 1),
    ("high", 2, "A well-established record, consistently published in official sources over many years. Safe to rely on; cite the official archive if publishing.", 1),
    ("reference", 3, "Harvested from Wikipedia's season results tables, which are transcribed from FIA classifications. Every row was cross-checked on load against independently held season data. Reliable for results; not official under this database's policy, so cite the FIA/F1 archive if publishing.", 1),
    ("medium", 4, "Correct in substance. An exact figure or date may have drifted or may move with the current season. Confirm before publication.", 0),
    ("unverified", 5, "Placeholder, disputed, or known to be incomplete. Never state as fact.", 0),
]
