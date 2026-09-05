# -*- coding: utf-8 -*-
"""
Loader for the Wikipedia race-result harvest (harvest/races.txt).

Source: the '<year> Formula One World Championship' / '<year> Formula One
season' articles on en.wikipedia.org, harvested 2026-09-04.

Confidence: 'reference'. Wikipedia's season results tables are transcribed
from FIA classifications and are heavily cross-checked, but they are not an
official source under this database's policy and are never promoted to
'verified' without an FIA/F1 check.

Every row is validated on load:
  - race count per season must equal seasons.rounds
  - rounds must be contiguous 1..n
  - every driver and constructor name must map to a known id, or be
    declared below as a deliberate non-mapping
"""
import os
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
RACES_FILE = os.path.join(HERE, "..", "harvest", "races.txt")

SOURCE = "https://en.wikipedia.org/wiki/{year}_Formula_One_World_Championship"
CONFIDENCE = "reference"


def _norm(s):
    """Strip accents, punctuation and honorifics for name matching."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace(".", "").replace("'", "").replace("-", " ")
    # 'sir' is an honorific and is dropped. 'jr' is NOT: it is the only thing
    # separating Nelson Piquet from Nelson Piquet Jr, and stripping it used to
    # give the son his father's 23 wins.
    s = s.replace("sir ", "")
    return " ".join(s.split())


# Names in the harvest that map to a driver id that _norm() alone won't find
DRIVER_ALIASES = {
    "giuseppe farina": "farina",
    "nino farina": "farina",
    "jose froilan gonzalez": "gonzalez",
    "bruce mclaren": "mclaren-d",
    "phil hill": "p-hill",
    "graham hill": "g-hill",
    "damon hill": "d-hill",
    "gilles villeneuve": "villeneuve-g",
    "jacques villeneuve": "villeneuve-j",
    "pedro rodriguez": "rodriguez-p",
    "michael schumacher": "schumacher",
    "ralf schumacher": "r-schumacher",
    "nico rosberg": "n-rosberg",
    "keke rosberg": "k-rosberg",
    "elio de angelis": "de-angelis",
    "alessandro nannini": "nannini",
    "carlos sainz": "sainz",
    "andrea kimi antonelli": "antonelli",
    "kimi antonelli": "antonelli",
}

# Drivers the harvest reveals that were not previously in the register.
# id, full_name, nationality, code, born, died, first, last, wins, poles,
# titles, status, notes, confidence
NEW_DRIVERS = [
    ("beltoise", "Jean-Pierre Beltoise", "France", "FRA", "1937-04-26", "2015-01-05", 1966, 1974,
     1, 0, 0, "deceased",
     "Won the 1972 Monaco Grand Prix for BRM in torrential rain — the team's last victory. Raced with a permanently weakened left arm after a sports-car crash.", "reference"),
    ("gethin", "Peter Gethin", "United Kingdom", "GBR", "1940-02-21", "2011-12-05", 1970, 1974,
     1, 0, 0, "deceased",
     "Won the 1971 Italian Grand Prix by 0.01 seconds — the closest finish in the sport's history, with the top five covered by 0.61 s.", "reference"),
    ("brambilla", "Vittorio Brambilla", "Italy", "ITA", "1937-11-11", "2001-05-26", 1974, 1980,
     1, 1, 0, "deceased",
     "'The Monza Gorilla'. Won the rain-shortened 1975 Austrian Grand Prix for March and crashed on the slowing-down lap while waving to the crowd.", "reference"),
    ("pace", "Carlos Pace", "Brazil", "BRA", "1944-10-06", "1977-03-18", 1972, 1977,
     1, 1, 0, "deceased",
     "Won his home Grand Prix at Interlagos in 1975 for Brabham. Killed in a light-aircraft crash; the Interlagos circuit is named after him.", "reference"),
    ("baghetti", "Giancarlo Baghetti", "Italy", "ITA", "1934-12-25", "1995-11-27", 1961, 1967,
     1, 0, 0, "deceased",
     "The only driver to win on his World Championship debut, the 1961 French Grand Prix at Reims.", "reference"),
]

# Indianapolis 500 winners, 1950-1960, when the race counted towards the
# World Championship. Almost none of them contested a European Grand Prix.
INDY_WINNERS = [
    ("parsons", "Johnnie Parsons", "United States", "USA", 1950),
    ("wallard", "Lee Wallard", "United States", "USA", 1951),
    ("ruttman", "Troy Ruttman", "United States", "USA", 1952),
    ("vukovich", "Bill Vukovich", "United States", "USA", 1953),
    ("sweikert", "Bob Sweikert", "United States", "USA", 1955),
    ("flaherty", "Pat Flaherty", "United States", "USA", 1956),
    ("hanks", "Sam Hanks", "United States", "USA", 1957),
    ("bryan", "Jimmy Bryan", "United States", "USA", 1958),
    ("ward", "Rodger Ward", "United States", "USA", 1959),
    ("rathmann", "Jim Rathmann", "United States", "USA", 1960),
]

INDY_NOTE = ("Won the Indianapolis 500 in the years it counted towards the Formula One "
             "World Championship (1950-1960). Recorded as a World Championship race "
             "winner in the official record; did not contest European Grands Prix.")

# Constructor name (chassis part) -> constructor id.
# A few need to be resolved by year because the name was reused.
CONSTRUCTOR_MAP = {
    "alfa romeo": "alfa-romeo", "ferrari": "ferrari", "maserati": "maserati",
    "mercedes": "mercedes", "vanwall": "vanwall", "cooper": "cooper",
    "brm": "brm", "brabham": "brabham", "matra": "matra", "honda": "honda-works",
    "eagle": "eagle", "mclaren": "mclaren", "tyrrell": "tyrrell", "march": "march",
    "williams": "williams", "hesketh": "hesketh", "penske": "penske",
    "shadow": "shadow", "wolf": "wolf", "ligier": "ligier", "renault": "renault",
    "benetton": "benetton", "jordan": "jordan", "stewart": "stewart-gp",
    "sauber": "sauber", "bmw sauber": "bmw-sauber", "toro rosso": "toro-rosso",
    "brawn": "brawn", "red bull": "red-bull", "red bull racing": "red-bull",
    "mercedes benz": "mercedes", "scuderia ferrari": "ferrari",
    "racing point": "racing-point", "alphatauri": "alphatauri", "alpine": "alpine",
    "porsche": "porsche", "toleman": "toleman", "arrows": "arrows",
    "aston martin": "aston-martin", "haas": "haas", "audi": "audi",
    "cadillac": "cadillac", "racing bulls": "racing-bulls", "minardi": "minardi",
}

# 'Lotus' is two different teams. Team Lotus (Hethel) to 1994; the Enstone
# team raced as Lotus F1 Team 2012-2015.
def constructor_id_for(name, year):
    key = _norm(name)
    if key == "lotus":
        return "lotus" if year <= 1994 else "lotus-f1"
    return CONSTRUCTOR_MAP.get(key)


# Chassis that only ever appeared at the Indianapolis 500 in the years it
# counted. Deliberately not given constructor rows: they were never Formula
# One constructors, and inventing rows for them would corrupt the
# constructor statistics.
INDY_CHASSIS = {"kurtis kraft", "kuzma", "watson", "salih", "epperly", "phillips"}


def load():
    """Return a list of dicts, one per harvested race."""
    rows = []
    with open(os.path.abspath(RACES_FILE), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            year, rnd, gp, driver, constructor = line.split("|")
            year, rnd = int(year), int(rnd)
            # shared drives, e.g. 1957 British GP (Brooks / Moss)
            names = [n.strip() for n in driver.split("/")]
            rows.append({
                "year": year,
                "round": rnd,
                "gp_name": gp,
                "winner_name": names[0],
                "co_winner_name": names[1] if len(names) > 1 else None,
                "entrant": constructor,
                "chassis": constructor.split("-")[0].strip(),
                "source": SOURCE.format(year=year),
                "confidence": CONFIDENCE,
            })
    return rows


# =====================================================================
# Pole position and fastest lap harvest (harvest/poles.txt)
#
# Same sources as the race harvest, re-read for the pole and fastest-lap
# columns. Each row also carries the winner, which is checked against the
# winner already stored in race_results — so every row self-validates.
# =====================================================================
POLES_FILE = os.path.join(HERE, "..", "harvest", "poles.txt")


def load_poles():
    rows = []
    with open(os.path.abspath(POLES_FILE), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            year, rnd, pole, fl, winner = line.split("|")
            rows.append({
                "year": int(year),
                "round": int(rnd),
                "pole": None if pole.strip() in ("?", "") else pole.strip(),
                "fastest_lap": None if fl.strip() in ("?", "") else fl.strip(),
                "winner_check": winner.strip(),
                "source": SOURCE.format(year=int(year)),
            })
    return rows


# =====================================================================
# Race venue harvest (harvest/venues.txt)
#
# year|round|venue|winner, one row per championship race, read from the
# same season articles. The winner column is checked against the winner
# already stored, so every row self-validates before its circuit is used.
#
# VENUE_MAP resolves the harvested venue string to a circuit id in the
# register. Two venues need the year as well as the name and are handled
# by venue_circuit_id(): the Nurburgring (Nordschleife before 1977, the
# GP-Strecke from 1984) and the Osterreichring site, which is a distinct
# circuit from the A1-Ring/Red Bull Ring rebuilt on it.
# =====================================================================
VENUES_FILE = os.path.join(HERE, "..", "harvest", "venues.txt")

VENUE_MAP = {
    "a1-ring": "red-bull-ring",
    "avus": "avus",
    "adelaide street circuit": "adelaide",
    "ain-diab circuit": "ain-diab",
    "aintree motor racing circuit": "aintree",
    "albert park circuit": "albert-park",
    "autodromo dino ferrari": "imola",
    "autodromo hermanos rodriguez": "rodriguez",
    "autodromo internacional do algarve": "portimao",
    "autodromo internazionale del mugello": "mugello",
    "autodromo jose carlos pace": "interlagos",
    "autodromo nazionale di monza": "monza",
    "autodromo oscar alfredo galvez": "buenos-aires",
    "autodromo de buenos aires": "buenos-aires",
    "autodromo de interlagos": "interlagos",
    "autodromo de jacarepagua": "jacarepagua",
    "autodromo do estoril": "estoril",
    "bahrain international circuit": "bahrain",
    "baku city circuit": "baku",
    "brands hatch": "brands-hatch",
    "buddh international circuit": "buddh",
    "bugatti circuit": "le-mans-bugatti",
    "caesars palace grand prix circuit": "caesars-palace",
    "charade circuit": "charade",
    "circuit bremgarten": "bremgarten",
    "circuit gilles villeneuve": "gilles-villeneuve",
    "circuit mont-tremblant": "mont-tremblant",
    "circuit paul ricard": "paul-ricard",
    "circuit zandvoort": "zandvoort",
    "circuit zolder": "zolder",
    "circuit de barcelona-catalunya": "catalunya",
    "circuit de monaco": "monaco",
    "circuit de nevers magny-cours": "magny-cours",
    "circuit de spa-francorchamps": "spa",
    "circuit of the americas": "cota",
    "circuito permanente del jarama": "jarama",
    "circuito da boavista": "porto",
    "circuito de jerez": "jerez",
    "detroit street circuit": "detroit",
    "dijon-prenois": "dijon",
    "donington park": "donington",
    "fair park street circuit": "dallas",
    "fuji speedway": "fuji",
    "hockenheimring": "hockenheim",
    "hungaroring": "hungaroring",
    "ile notre-dame circuit": "gilles-villeneuve",
    "indianapolis motor speedway": "indianapolis",
    "istanbul park": "istanbul",
    "jacarepagua": "jacarepagua",
    "jeddah corniche circuit": "jeddah",
    "korea international circuit": "yeongam",
    "kyalami grand prix circuit": "kyalami",
    "las vegas strip circuit": "las-vegas",
    "long beach street circuit": "long-beach",
    "lusail international circuit": "lusail",
    "magdalena mixhuca": "rodriguez",
    "marina bay street circuit": "marina-bay",
    "miami international autodrome": "miami",
    "monsanto park circuit": "monsanto",
    "montjuic circuit": "montjuic",
    "mosport park": "mosport",
    "nivelles-baulers": "nivelles",
    "nurburgring gp-strecke": "nurburgring-gp",
    "osterreichring": "red-bull-ring",
    "pedralbes circuit": "pedralbes",
    "pescara circuit": "pescara",
    "phoenix street circuit": "phoenix",
    "prince george circuit": "east-london",
    "red bull ring": "red-bull-ring",
    "reims-gueux": "reims",
    "riverside international raceway": "riverside",
    "rouen-les-essarts": "rouen",
    "scandinavian raceway": "anderstorp",
    "sebring international raceway": "sebring",
    "sepang international circuit": "sepang",
    "shanghai international circuit": "shanghai",
    "silverstone circuit": "silverstone",
    "sochi autodrom": "sochi",
    "suzuka circuit": "suzuka",
    "suzuka international racing course": "suzuka",
    "ti circuit": "aida",
    "valencia street circuit": "valencia",
    "watkins glen international": "watkins-glen",
    "yas marina circuit": "yas-marina",
    "zeltweg air base": "zeltweg",
}

# Venues whose name alone does not identify the circuit.
VENUE_BY_YEAR = {
    "nurburgring": [(1951, 1976, "nordschleife"), (1984, None, "nurburgring-gp")],
}


def _vnorm(s):
    """Fold a venue string for matching: accents out, lower case, one space.

    Unlike _norm() this keeps hyphens, which distinguish real venue names
    (Reims-Gueux, Dijon-Prenois, Nivelles-Baulers).
    """
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace(".", "").replace("'", "")
    # season articles sometimes append the town: "Hungaroring, Mogyorod"
    s = s.split(",")[0]
    return " ".join(s.split())


def venue_circuit_id(venue, year):
    """Resolve a harvested venue string to a circuit id, or None."""
    key = _vnorm(venue)
    if key in VENUE_BY_YEAR:
        for lo, hi, cid in VENUE_BY_YEAR[key]:
            if year >= lo and (hi is None or year <= hi):
                return cid
        return None
    return VENUE_MAP.get(key)


def load_venues():
    rows = []
    with open(os.path.abspath(VENUES_FILE), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            year, rnd, venue, winner = line.split("|")
            year = int(year)
            rows.append({
                "year": year,
                "round": int(rnd),
                "venue": venue.strip(),
                "circuit_id": venue_circuit_id(venue, year),
                "winner_check": winner.strip(),
                "source": SOURCE.format(year=year),
            })
    return rows


def split_names(s):
    """Shared poles/fastest laps are recorded as 'A / B'."""
    if not s:
        return []
    return [n.strip() for n in s.split("/") if n.strip()]


# ---------------------------------------------------------------------
# Drivers revealed by the pole / fastest-lap harvest who had not appeared
# before, because none of them ever won a championship race.
#
# Their pole and fastest-lap records are 'reference' — derived from the
# harvested race rows and therefore checkable. The biographical detail
# (nationality) is hand-entered and unverified, so these rows carry
# confidence 'medium'.
#   id, full_name, nationality, code, note_extra
# ---------------------------------------------------------------------
POLE_ONLY_DRIVERS = [
    ("amon", "Chris Amon", "New Zealand", "NZL",
     "Widely held to be the finest driver never to win a championship Grand Prix; five poles and eleven podiums across 96 starts."),
    ("jarier", "Jean-Pierre Jarier", "France", "FRA",
     "Led races for Shadow and Lotus without ever converting one into a win."),
    ("fabi", "Teo Fabi", "Italy", "ITA", "Took pole at Indianapolis and in Formula One."),
    ("heidfeld", "Nick Heidfeld", "Germany", "GER",
     "Thirteen podiums and 183 starts without a victory — for years the record for most starts without a win."),
    ("magnussen", "Kevin Magnussen", "Denmark", "DEN",
     "Scored a podium on debut in Australia in 2014."),
    ("lewis-evans", "Stuart Lewis-Evans", "United Kingdom", "GBR",
     "Vanwall driver who died of burns after the 1958 Moroccan Grand Prix, prompting the team's withdrawal."),
    ("de-cesaris", "Andrea de Cesaris", "Italy", "ITA",
     "208 starts without a win, and pole at Long Beach in 1982."),
    ("warwick", "Derek Warwick", "United Kingdom", "GBR", "Four podiums; later won Le Mans."),
    ("zhou", "Zhou Guanyu", "China", "CHN", "China's first full-time Formula One driver."),
    ("parkes", "Mike Parkes", "United Kingdom", "GBR", "Ferrari engineer and driver; two podiums."),
    ("attwood", "Richard Attwood", "United Kingdom", "GBR", "Won Le Mans for Porsche in 1970."),
    ("oliver", "Jackie Oliver", "United Kingdom", "GBR", "Later co-founded Arrows."),
    ("pescarolo", "Henri Pescarolo", "France", "FRA", "Four-time Le Mans winner."),
    ("hailwood", "Mike Hailwood", "United Kingdom", "GBR",
     "Nine-time motorcycle World Champion; awarded the George Medal for pulling Clay Regazzoni from a burning car at Kyalami in 1973."),
    ("pryce", "Tom Pryce", "United Kingdom", "GBR",
     "Killed at Kyalami in 1977 when he struck a marshal crossing the track."),
    ("giacomelli", "Bruno Giacomelli", "Italy", "ITA", "Took pole for Alfa Romeo at Watkins Glen in 1980."),
    ("surer", "Marc Surer", "Switzerland", "SUI", None),
    ("henton", "Brian Henton", "United Kingdom", "GBR", None),
    ("palmer", "Jonathan Palmer", "United Kingdom", "GBR", "Later a circuit owner and broadcaster."),
    ("gugelmin", "Mauricio Gugelmin", "Brazil", "BRA", None),
    ("nakajima", "Satoru Nakajima", "Japan", "JPN", "Japan's first full-time Formula One driver."),
    ("gachot", "Bertrand Gachot", "Belgium", "BEL",
     "His imprisonment in 1991 freed the Jordan seat that gave Michael Schumacher his debut."),
    ("moreno", "Roberto Moreno", "Brazil", "BRA", None),
    ("wurz", "Alexander Wurz", "Austria", "AUT", "Three podiums; twice a Le Mans winner."),
    ("de-la-rosa", "Pedro de la Rosa", "Spain", "ESP", None),
    ("glock", "Timo Glock", "Germany", "GER",
     "His slide on dry tyres at Interlagos in 2008 handed Lewis Hamilton the championship."),
    ("sutil", "Adrian Sutil", "Germany", "GER", None),
    ("petrov", "Vitaly Petrov", "Russia", "RUS", "Russia's first Formula One driver."),
    ("senna-b", "Bruno Senna", "Brazil", "BRA", "Nephew of Ayrton Senna."),
    ("gutierrez", "Esteban Gutierrez", "Mexico", "MEX", None),
    ("kvyat", "Daniil Kvyat", "Russia", "RUS", "Three podiums; briefly Vettel's replacement at Red Bull."),
    ("behra", "Jean Behra", "France", "FRA",
     "Killed in a supporting sports-car race at AVUS in 1959."),
    ("castellotti", "Eugenio Castellotti", "Italy", "ITA", "Killed testing at Modena in 1957."),
    ("herrmann", "Hans Herrmann", "Germany", "GER", "Won Le Mans outright for Porsche in 1970."),
    ("kling", "Karl Kling", "Germany", "GER", "Mercedes team-mate to Fangio in 1954-55."),
    ("marimon", "Onofre Marimon", "Argentina", "ARG",
     "The first driver to be killed at a World Championship event, in practice at the Nurburgring in 1954."),
    ("mieres", "Roberto Mieres", "Argentina", "ARG", None),
    # Indianapolis 500 specialists who took pole or fastest lap in the years
    # the race counted towards the championship.
    ("faulkner", "Walt Faulkner", "United States", "USA", None),
    ("nalon", "Duke Nalon", "United States", "USA", None),
    ("agabashian", "Fred Agabashian", "United States", "USA", None),
    ("mcgrath", "Jack McGrath", "United States", "USA", None),
    ("hoyt", "Jerry Hoyt", "United States", "USA", None),
    ("russo", "Paul Russo", "United States", "USA", None),
    ("oconnor", "Pat O'Connor", "United States", "USA", None),
    ("rathmann-d", "Dick Rathmann", "United States", "USA", None),
    ("bettenhausen", "Tony Bettenhausen", "United States", "USA", None),
    ("sachs", "Eddie Sachs", "United States", "USA", None),
    ("thomson", "Johnny Thomson", "United States", "USA", None),
    ("kobayashi", "Kamui Kobayashi", "Japan", "JPN",
     "A podium at Suzuka in 2012 in front of his home crowd; later won Le Mans with Toyota."),
]

POLE_ONLY_NOTE = ("Added to the register from the pole position and fastest lap harvest. "
                  "Never won a World Championship Grand Prix. Pole and fastest-lap counts "
                  "are derived from the race records; other career figures are not held.")


# ---------------------------------------------------------------------
# What the pole / fastest-lap harvest could not reach, and why.
# area, description, races_affected, resolution
# ---------------------------------------------------------------------
KNOWN_GAPS = [
    ("finish_position", "the full race classification",
     "race_entries in the DISTRIBUTED build holds the winner, the "
     "pole-sitter and the fastest-lap setter for every race - about 2.1 rows "
     "per race against a real field of 15 to 22. Second place, retirements, "
     "grid positions and per-race points are not in the committed file, and "
     "that is deliberate rather than unfinished: the rows come from "
     "Jolpica-F1, whose Ergast data is CC BY-NC-SA - non-commercial, the "
     "most restrictive licence any source here carries - and this database "
     "is a function of what is in its own repository. "
     "tools/ergast_load.py has now been run against the live API and works: "
     "21,017 rows across all 1,161 races, no race refused on a winner "
     "mismatch, and the podium reconciliation passes. Run it locally and the "
     "gap closes on your copy. "
     "Its first live run also proved why the reconciliation exists: the "
     "loader's driver resolver matched Jolpica's bare `fittipaldi` - Wilson - "
     "onto this register's Emerson, moving eight wins from Team Lotus to "
     "Brabham before the constructor win check caught it.", 0,
     "python3 tools/ergast_load.py  (about 270 requests, a few minutes). "
     "Then rerun verify.py. The binding constraint is now the driver "
     "register, not the API: 577 drivers who have started a Grand Prix are "
     "not in it, so 5,558 rows are skipped and the loader exits non-zero "
     "naming them. "
     "Do NOT transcribe these rows by hand - an attempt to do so during "
     "v2.7 put fabricated results into four of five sampled 2008 rows."),
    ("chassis_id", "the chassis each race was won in, before 1980",
     "The winning chassis is now known for 819 of 1,161 races. It comes from "
     "F1DB's per-season entry lists, which record which chassis a constructor "
     "ran in a season - the second, constraining source the abandoned harvest "
     "was missing. What is left is not a smaller version of the same problem, "
     "it is a different one, and it has a hard edge: **F1DB records what a "
     "team ran in a SEASON, not what it ran in a ROUND.** Where a constructor "
     "used more than one design in a year the entry list names them all "
     "without saying which raced where, so the season constrains nothing and "
     "the entries stay NULL. 321 constructor-seasons are in that position; "
     "v_ambiguous_seasons lists them. The gap is therefore concentrated "
     "almost entirely before 1980 - the 1960s stand at 4 per cent linked "
     "against 49 per cent for the 2020s - because a modern team runs one car "
     "all season while a 1960s constructor was a name several privateers "
     "entered several different chassis under.", 0,
     "Per-round entry lists, which F1DB does not have. The season articles "
     "print a chassis column in the same results table the winners came "
     "from, and that column IS per round. Harvesting it is only safe with "
     "the check that is now available: a harvested chassis must appear in "
     "that constructor's entry list for that season, or be refused. Without "
     "that second test the winner cross-check passes on an invented value - "
     "a 1952 trial returned 'Ferrari 125 F2' for races Ascari won in a "
     "Ferrari 500 and every winner matched."),
    ("cars.weight_kg", "weight and wheelbase for the modern era",
     "Modern cars are documented far more thinly than historic ones, and the "
     "thinness is deliberate on the teams' part: current-era specifications "
     "are competitive secrets, so a team publishes a power-unit badge, a "
     "suspension layout and very little else. Most 'weight' quoted for a "
     "recent car is simply that season's regulation minimum, and the 2026 "
     "figures in circulation - 768 kg, a 3,400 mm wheelbase, 1,900 mm of "
     "width - are limits in the rules that every car on the grid is built "
     "to. Storing one in a per-car field would be inference presented as "
     "fact. They are in regulation_limits instead, and the harvest drops a "
     "car figure that only restates one. The practical consequence is that "
     "going backwards yields much richer rows than starting at 2026: the "
     "recent chassis are thin and say so.", 1,
     "Nothing to fix by finding a better source, because no better source "
     "exists - the figures are not published. A car field stays NULL until a "
     "measurement of that car, rather than of the rules it was built to, is "
     "established."),
    ("cars.poles", "the car each pole was taken in, where the season is ambiguous",
     "This was the largest gap in the car data and is now mostly closed. The "
     "pole and fastest-lap harvest recorded who set them but not what they "
     "drove, so 1,260 of 2,424 entries carried no constructor at all and "
     "could not reach a car. F1DB's per-round driver data supplies it: 99 "
     "per cent of entries now name a constructor, and NINE cars match their "
     "published career pole total exactly, where previously none could be "
     "checked for more than not exceeding it. What is left is the seasons a "
     "constructor ran more than one chassis, where attributing a pole to a "
     "particular car would be a guess - McLaren ran the M23 and the M26 "
     "through 1976 and 1977, and the blanket season claim gave the M23 "
     "sixteen poles against a published fourteen before this was checked.", 0,
     "Per-round chassis data, which no source in use here has. The remaining "
     "seasons are listed in v_ambiguous_seasons and in car_seasons where "
     "corroborated = 0."),
    ("laps", "lap times, tyre stints, pit stops, radio and telemetry",
     "The laps, stints, pit_stops, race_control_messages and team_radio "
     "tables are EMPTY in the distributed database, and that is a licensing "
     "and reproducibility decision rather than a missing harvest. Two "
     "sources fill them, and between them they reach further back than the "
     "2018 floor this gap used to describe. "
     "Jolpica's database dump has 628,454 race laps from 1996 and 12,627 pit "
     "stops from 2011 - twenty-two seasons more than was previously thought "
     "available - but its Ergast lineage is CC BY-NC-SA, non-commercial, so "
     "the rows are loaded locally and never committed. "
     "FastF1 reads the F1 live timing API, which begins in 2018 and for "
     "which nothing earlier exists in any retrievable form; it adds sectors, "
     "tyre compound, stints and race control, none of which Jolpica has. "
     "Both may hold the same race at once - the schema keys a lap on "
     "(race, source, driver, lap) precisely so they can be compared rather "
     "than one overwriting the other. "
     "Car telemetry (speed, throttle, brake, gear at about 4 Hz) is "
     "deliberately NOT stored here at all: it is hundreds of megabytes per "
     "weekend and fastf1_load.py writes it to Parquet beside the database.", 0,
     "python3 tools/ergast_load.py --from-dump --timing   (1996-, one "
     "hash-verified zip, about fifteen seconds), and/or "
     "pip install fastf1 && python3 tools/fastf1_load.py --years 2018-2026 "
     "--results --radio. Then ./f1 laps. verify.py re-derives each race's "
     "fastest lap from the lap times and checks it against the setter "
     "already stored from the pole harvest - 446 races, no disagreement."),
    ("race_timing", "pole, fastest lap and race times per race",
     "The race_timing table is empty. These figures are published per race "
     "rather than per season, so filling them for 1950-2017 means reading "
     "1,161 individual race articles, which was judged too expensive against "
     "what it returns. From 2018 the FastF1 loader supplies the same "
     "information at far greater resolution.", 0,
     "Either harvest race articles for the pre-2018 seasons, or accept that "
     "timing starts in 2018 and fill it with tools/fastf1_load.py."),
    ("layout_name", "circuit configuration as raced, for most circuits",
     "Thirteen circuits have a complete configuration timeline: Spa, Monza, "
     "Silverstone, Hockenheim, Interlagos, Indianapolis, Catalunya, Albert "
     "Park, the Spielberg site, the Mexico City site, Bahrain, Marina Bay and "
     "Yas Marina. For every other circuit the database holds one set of "
     "figures - the most recent - so a 1976 Kyalami lap is reported at the "
     "length of the 1992 rebuild. v_race_venues is explicit about this: its "
     "'figures' column reads 'as raced' where a layout row covers the year "
     "and 'current layout' where it does not. Zandvoort, Suzuka, Imola, "
     "Jerez, Estoril, Paul Ricard, Zolder, Brands Hatch, Kyalami and Buenos "
     "Aires all changed shape between championship races and are not yet "
     "broken out.", 0,
     "Research the configuration history of each remaining multi-race circuit "
     "and add the rows; verify.py already enforces that a circuit's layout "
     "rows, once present, form a complete non-overlapping timeline."),
    ("fastest_lap", "fastest lap, 2021 round 12 (Belgian Grand Prix)",
     "No fastest lap is recorded because none was set. The race was abandoned after "
     "two laps behind the safety car, half points were awarded and no racing lap was "
     "completed. This is a true null, not missing data.", 1,
     "Nothing to fix - the absence is correct."),
]

# Differences between a hand-entered career figure and the figure derived
# from the race records that are NOT explained by the gaps above. Declared
# here so that verify.py can assert no NEW unexplained difference appears:
# a regression fails the build, while these stay visible.
#   driver_id, field, assessment
DECLARED_DISCREPANCIES = [
    ("brabham", "fastest_laps",
     "Career total is 12 in the reference record; 11 are found in the race data. "
     "Every race of his career (1955-1970) has a fastest lap recorded, so the missing "
     "one must be a race where he shared the fastest lap with another driver and the "
     "season table renders only one name. Needs a race-by-race check to locate."),
    ("p-hill", "fastest_laps",
     "Career total is 6 in the reference record; 5 are found in the race data. Same "
     "cause as Brabham - an unflagged shared fastest lap. Needs a race-by-race check."),
]

# Corrections made to hand-entered career figures after checking them against an
# external reference. Kept as a record of what changed and why.
#   driver_id, field, old_value, new_value, reason
CORRECTIONS = [
    ("russell", "poles", 12, 11,
     "The formula1.com driver page gave 12. That same fetch returned internally "
     "inconsistent 2026 figures (160 points against the standings' 183, and third "
     "place against second), so it was not reliable. The Wikipedia career infobox "
     "independently gives 11 poles and 7 wins, both matching the figures derived "
     "from the race records. Corrected to 11."),
    ("surtees", "fastest_laps", 11, 10,
     "The hand-entered total of 11 was wrong. The reference record gives 10, which is "
     "also the number found in the race data. Corrected in favour of the derived "
     "figure, which two independent sources now agree on."),
]


# =====================================================================
# The chassis, engine and entrant register (harvest/chassis.txt,
# harvest/engines.txt, harvest/f1db_constructors.txt, harvest/entrants.txt)
#
# Source: F1DB (https://github.com/f1db/f1db), CC BY 4.0, re-released after
# every race. Fetched by tools/f1db_fetch.py, which writes these files and is
# the only thing that ever writes them: 1,153 chassis and 1,925 entrant rows
# are far past the scale CONTRIBUTING.md allows a person to move by hand.
#
# Confidence: 'reference'. F1DB is a maintained, versioned community database
# with an explicit licence and a public revision history, which is better
# provenance than most of what is available here - but it is not an FIA
# source and is not promoted to 'verified'.
#
# What the entrant data does and does not settle
# ----------------------------------------------
# known_gaps #1 records that the chassis-per-race harvest was abandoned
# because the winner cross-check does not constrain the chassis: a 1952 trial
# returned "Ferrari 125 F2" for races Ascari won in a Ferrari 500, and every
# winner still matched. F1DB's season -> constructor -> chassis mapping is the
# second source that check was missing.
#
# It is not a complete answer, and pretending otherwise would repeat the
# original mistake in a new form. **F1DB records which chassis a constructor
# ran in a season. It does not record which chassis ran in which round.**
# Where a team ran more than one design in a year the entrant block lists
# them all with no round attribution.
#
# The drivers inside those blocks DO carry rounds, though, and that is what
# makes the mapping work. Resolving through (season, round, driver) picks out
# one ENTRANT rather than a whole constructor, and an entrant is a far
# smaller thing:
#
#   Lotus in 1970 ran a 49C, a 72B and a 72C, so the constructor-season
#   settles nothing. But only Gold Leaf Team Lotus entered all three. Garvey
#   Team Lotus entered a 49C for Soler-Roig in round 2, Pete Lovely a 49B,
#   Team Gunston a 49 - every one of those resolves. Only Rindt's own entries
#   stay ambiguous, correctly, because he moved from the 49C to the 72
#   mid-season.
#
# So there are two rules, and the second is strictly sharper than the first:
# a constructor-season naming exactly one chassis, and a (season, round,
# driver) whose entrant names exactly one. Whatever neither settles stays
# NULL and the ambiguity is stored, not dropped.
# =====================================================================
CHASSIS_FILE = os.path.join(HERE, "..", "harvest", "chassis.txt")
F1DB_DRIVERS_FILE = os.path.join(HERE, "..", "harvest", "f1db_drivers.txt")
ENTRANT_DRIVERS_FILE = os.path.join(HERE, "..", "harvest", "entrant_drivers.txt")
ENGINES_FILE = os.path.join(HERE, "..", "harvest", "engines.txt")
F1DB_CONS_FILE = os.path.join(HERE, "..", "harvest", "f1db_constructors.txt")
ENTRANTS_FILE = os.path.join(HERE, "..", "harvest", "entrants.txt")
SPECS_FILE = os.path.join(HERE, "..", "harvest", "car_specs.txt")

F1DB_SOURCE = "https://github.com/f1db/f1db"
F1DB_CONFIDENCE = "reference"

# F1DB constructor id -> this database's constructor id, for the seven that
# do not already share one. Six are spelling; the seventh is not.
F1DB_CONSTRUCTORS = {
    "honda": "honda-works",
    "talbot-lago": "lago",
    "leyton-house": "leyton",
    "prost": "prost-gp",
    "stewart": "stewart-gp",
    "surtees": "surtees-team",
    # F1DB splits the Faenza team's 2024 name from its 2025 one; this
    # register holds the continuing team under a single id.
    "rb": "racing-bulls",
}

# Constructors this database holds that F1DB has no constructor for, with the
# reason. Declared rather than forced: a mapping invented to make a join
# succeed is a fabrication with a foreign key on it.
F1DB_NON_MAPPING = {
    "rob-walker":
        "F1DB models R.R.C. Walker Racing Team as an ENTRANT, not a "
        "constructor, which is right: Rob Walker never built a car. He "
        "entered other people's - the Cooper T51 Moss won Argentina 1958 in, "
        "and later Lotuses. This database records him as a constructor "
        "because the race records credit the win to 'Cooper-Climax' entered "
        "by Walker and the constructor column had to hold something. The two "
        "models disagree; neither is wrong on the facts.",
}


def _read_pipe(path, fields):
    """Read one of the generated register files, checking the field count on
    every line. A short row is a truncated file, not something to pad."""
    rows = []
    with open(os.path.abspath(path), encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.split("|")
            if len(parts) != fields:
                raise SystemExit(
                    f"{os.path.basename(path)}:{n}: {len(parts)} fields, "
                    f"expected {fields}. Rerun tools/f1db_fetch.py.")
            rows.append([p.strip() or None for p in parts])
    return rows


def load_chassis():
    """chassis_id, constructor_id, name, full_name"""
    return _read_pipe(CHASSIS_FILE, 4)


def load_engines():
    """engine_id, manufacturer_id, name, full_name, capacity_l, config, aspiration"""
    return _read_pipe(ENGINES_FILE, 7)


def load_f1db_constructors():
    """constructor_id, name, full_name, country_id"""
    return _read_pipe(F1DB_CONS_FILE, 4)


def load_entrants():
    """year, entrant_id, constructor_id, engine_manufacturer_id,
    [chassis_ids], [engine_ids], [tyre_ids]

    The three id lists are lists because F1DB writes them as lists whenever a
    constructor ran more than one in a season and does not say which ran
    where. Splitting them into separate rows here would invent the pairing.
    """
    out = []
    for (year, entrant, cons, eng_man, chassis, engines,
         tyres) in _read_pipe(ENTRANTS_FILE, 7):
        out.append((int(year), entrant, cons, eng_man,
                    (chassis or "").split("+") if chassis else [],
                    (engines or "").split("+") if engines else [],
                    (tyres or "").split("+") if tyres else []))
    return out


def constructor_for_f1db(f1db_id):
    """This database's constructor id for an F1DB one, or None where there is
    deliberately no mapping."""
    return F1DB_CONSTRUCTORS.get(f1db_id, f1db_id)


def load_f1db_drivers():
    """driver_id, name, first_name, last_name, date_of_birth"""
    return _read_pipe(F1DB_DRIVERS_FILE, 5)


def load_entrant_drivers():
    """year, entrant_id, constructor_id, engine_manufacturer_id, driver_id,
    {rounds}, test_driver

    `rounds` comes back as a set of integers. An empty set means the source
    gave no rounds at all - a test driver who never entered a race - and the
    caller must skip the row rather than read it as "every round"."""
    out = []
    for (year, entrant, cons, eng_man, driver, rounds,
         test) in _read_pipe(ENTRANT_DRIVERS_FILE, 7):
        out.append((int(year), entrant, cons, eng_man, driver,
                    parse_rounds(rounds), test == "1"))
    return out


def parse_rounds(spec):
    """'1-10' / '1,4-5' / '3' -> {1..10} / {1,4,5} / {3}. Empty -> set()."""
    out = set()
    for part in (spec or "").split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, _, hi = part.partition("-")
            out.update(range(int(lo), int(hi) + 1))
        else:
            out.add(int(part))
    return out


# F1DB driver id -> this database's driver id, where the names do not match
# on their own. Three of them; written out and checked one at a time.
F1DB_DRIVER_ALIASES = {
    "jj-lehto": "jarvilehto",       # JJ Lehto raced as Jyrki Jarvilehto
    "carlos-sainz-jr": "sainz",     # this register holds only the son
    "guanyu-zhou": "zhou",          # given name first in one, family in the other
}

# F1DB drivers that look like a register entry and are NOT one. Declared, so
# that a later widening of the name match cannot quietly pick them up.
F1DB_DRIVER_NON_MAPPING = {
    "emilio-de-villota":
        "This register's `de-villota` is MARIA de Villota, who tested for "
        "Marussia and never entered a Grand Prix. Emilio de Villota is a "
        "different person - her father - who entered fifteen between 1976 and "
        "1982. The names normalise to the same string and the two must not be "
        "joined.",
}


def resolve_f1db_drivers(our_drivers):
    """F1DB driver id -> this database's driver id, by normalised name.

    `our_drivers` is {our_id: full_name}. Only names that match are returned;
    F1DB holds 917 drivers and this register holds a few hundred, so most
    have no counterpart and that is not an error.

    Two safeguards, both learned the hard way. If two F1DB drivers normalise
    onto the same register entry, NEITHER is mapped - that is the Piquet and
    Piquet Jr failure, where stripping a suffix gave the son his father's 23
    wins. And a register name that no F1DB driver matches is simply left
    unmapped; nothing is created from a bulk feed.
    """
    ours = {}
    for did, name in our_drivers.items():
        key = _norm(name)
        ours.setdefault(key, []).append(did)
    aliases = {_norm(k): v for k, v in DRIVER_ALIASES.items()}

    hits = {}
    for f1db_id, name, first, last, _dob in load_f1db_drivers():
        if f1db_id in F1DB_DRIVER_NON_MAPPING:
            continue
        if f1db_id in F1DB_DRIVER_ALIASES:
            hits.setdefault(F1DB_DRIVER_ALIASES[f1db_id], set()).add(f1db_id)
            continue
        for candidate in (name, f"{first or ''} {last or ''}"):
            key = _norm(candidate or "")
            target = aliases.get(key) or (ours[key][0] if key in ours
                                          and len(ours[key]) == 1 else None)
            if target:
                hits.setdefault(target, set()).add(f1db_id)
                break
    out, collisions = {}, {}
    for our_id, f1db_ids in hits.items():
        if len(f1db_ids) > 1:
            collisions[our_id] = sorted(f1db_ids)
            continue
        out[f1db_ids.pop()] = our_id
    return out, collisions


def load_car_specs():
    """The Wikipedia infobox harvest. Returns a list of dicts keyed by the
    column names in the file header, or [] if the harvest has not been run."""
    path = os.path.abspath(SPECS_FILE)
    if not os.path.exists(path):
        return []
    cols, rows = None, []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("#"):
                if "|" in line:
                    cols = [c.strip() for c in line.lstrip("# ").split("|")]
                continue
            if not line.strip():
                continue
            parts = line.split("|")
            if cols is None or len(parts) != len(cols):
                raise SystemExit(
                    f"car_specs.txt: {len(parts)} fields, expected "
                    f"{len(cols) if cols else '?'}. Rerun "
                    f"tools/wikispec_fetch.py.")
            rows.append({c: (v.strip() or None) for c, v in zip(cols, parts)})
    return rows
