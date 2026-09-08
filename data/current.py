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
     "Admitted as a REFERENCE source for race-by-race results only (see the 'reference' confidence tier). Its season tables are transcribed from FIA classifications and were cross-checked on load against independently held season data. Not admissible for narrative, attribution or contested claims, and never promoted to 'verified' without an FIA/F1 check.", "reference",
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
     "full classification for all 1,161 races (27,555 entries, 1950-2026), "
     "qualifying (26,975), championship standings after every round (34,495) "
     "and pit stops (22,472) - plus the chassis, engine, constructor and "
     "per-season entrant register it already supplied. Loaded by "
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
     "was read. (1) The winner of every one of the 1,161 races came from the "
     "Wikipedia harvest; a race whose winner disagreed is refused WHOLE, and "
     "none was. The comparison is on sets, because a shared drive puts two "
     "drivers on position 1 and both are winners. (2) The champion, the "
     "runner-up and both their point totals for 76 seasons were already in "
     "`seasons`; the final standings must reproduce all four and do. "
     "(3) Qualifying position 1 is checked against the pole-sitter already "
     "stored - 13 races differ, every one a grid penalty or a sprint "
     "weekend, each recorded rather than resolved. (4) Its (constructor, "
     "season) -> chassis mapping is checked against the 41 CAR_SEASONS "
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
     "needed to display it. Loaded by tools/wikimedia_images.py. NO IMAGE IS "
     "STORED - article_images holds a reference and its credit, and the "
     "pixels are fetched from upload.wikimedia.org by whatever renders the "
     "page.", "reference",
     "Per file, and they differ: sixteen distinct licence strings across 602 "
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
     "name mentions the car finds only 265 of 602, because most correct "
     "images are filed under the driver, so the test is recorded as "
     "name_matches and enforced nowhere. The failure it half-detects is "
     "real: the ATS D5 article leads with a photograph of officials and "
     "police. These rows are 'unverified' because that is what they are."),

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
}

PROVENANCE = [
    ("verified", 1, "Checked directly against an official FIA or Formula 1 source during database construction. Safe to state as fact and to cite.", 1),
    ("high", 2, "A well-established record, consistently published in official sources over many years. Safe to rely on; cite the official archive if publishing.", 1),
    ("reference", 3, "Harvested from Wikipedia's season results tables, which are transcribed from FIA classifications. Every row was cross-checked on load against independently held season data. Reliable for results; not official under this database's policy, so cite the FIA/F1 archive if publishing.", 1),
    ("medium", 4, "Correct in substance. An exact figure or date may have drifted or may move with the current season. Confirm before publication.", 0),
    ("unverified", 5, "Placeholder, disputed, or known to be incomplete. Never state as fact.", 0),
]
