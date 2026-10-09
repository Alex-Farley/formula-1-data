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
import re
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
     "Won the 1961 French Grand Prix at Reims in his first World Championship race. Only Nino Farina and Johnnie Parsons, both in the championship's first season, had done the same, and nobody has since.", "reference"),
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
    applied = set()
    with open(os.path.abspath(POLES_FILE), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            year, rnd, pole, fl, winner = line.split("|")
            fl = None if fl.strip() in ("?", "") else fl.strip()
            fl_source = SOURCE.format(year=int(year))
            shared = SHARED_FASTEST_LAPS.get((int(year), int(rnd)))
            if shared:
                held, names, src, _ = shared
                if fl != held:
                    raise SystemExit(
                        f"poles harvest: shared fastest lap override for "
                        f"{year} r{rnd} expects {held!r}, row holds {fl!r}; "
                        f"the harvest has changed, re-check the override")
                # The season table is the source for the one name it gives;
                # the race article is the source for the share.
                fl, fl_source = names, src
                applied.add((int(year), int(rnd)))
            rows.append({
                "year": int(year),
                "round": int(rnd),
                "pole": None if pole.strip() in ("?", "") else pole.strip(),
                "fastest_lap": fl,
                "fastest_lap_source": fl_source,
                "shared_override": bool(shared),
                "winner_check": winner.strip(),
                "source": SOURCE.format(year=int(year)),
            })
    missing = sorted(set(SHARED_FASTEST_LAPS) - applied)
    if missing:
        raise SystemExit(
            f"poles harvest: shared fastest lap override(s) for {missing} "
            f"name a race the harvest no longer has a row for")
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
# The note is about the driver, not the row: how the row got here is
# POLE_ONLY_PROVENANCE below, in drivers.provenance. It carries no figure
# the page derives - starts, podiums, poles - because the strip beside the
# lede shows the derived one and a typed one goes stale (Amon's said 96
# starts beside a strip that counted 108).
#   id, full_name, nationality, code, note
# ---------------------------------------------------------------------
POLE_ONLY_DRIVERS = [
    ("amon", "Chris Amon", "New Zealand", "NZL",
     "Widely held to be the finest driver never to win a championship Grand Prix."),
    ("jarier", "Jean-Pierre Jarier", "France", "FRA",
     "Led races for Shadow and Lotus without ever converting one into a win."),
    ("fabi", "Teo Fabi", "Italy", "ITA", "Took pole at Indianapolis and in Formula One."),
    ("heidfeld", "Nick Heidfeld", "Germany", "GER",
     # The register's own figure: 13 podiums and no win, ahead of Johansson's
     # 12. The first rewrite said "most starts without a win", which the
     # race records disprove - de Cesaris held that from 1990.
     "Holds the record for most podium finishes without a win."),
    ("magnussen", "Kevin Magnussen", "Denmark", "DEN",
     "Scored a podium on debut in Australia in 2014."),
    ("lewis-evans", "Stuart Lewis-Evans", "United Kingdom", "GBR",
     "Vanwall driver who died of burns after the 1958 Moroccan Grand Prix, prompting the team's withdrawal."),
    ("de-cesaris", "Andrea de Cesaris", "Italy", "ITA",
     # 214 entries and no win in the race records, the most of anyone until
     # Hulkenberg passed it; the figure is the page's to show.
     "Took pole at Long Beach in 1982, and held the record for most Grand "
     "Prix entries without a win until Nico Hulkenberg passed it."),
    ("warwick", "Derek Warwick", "United Kingdom", "GBR", "Later won Le Mans."),
    ("zhou", "Zhou Guanyu", "China", "CHN", "China's first full-time Formula One driver."),
    ("parkes", "Mike Parkes", "United Kingdom", "GBR", "Ferrari engineer and driver."),
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
    ("wurz", "Alexander Wurz", "Austria", "AUT", "Twice a Le Mans winner."),
    ("de-la-rosa", "Pedro de la Rosa", "Spain", "ESP", None),
    ("glock", "Timo Glock", "Germany", "GER",
     "His slide on dry tyres at Interlagos in 2008 handed Lewis Hamilton the championship."),
    ("sutil", "Adrian Sutil", "Germany", "GER", None),
    ("petrov", "Vitaly Petrov", "Russia", "RUS", "Russia's first Formula One driver."),
    ("senna-b", "Bruno Senna", "Brazil", "BRA", "Nephew of Ayrton Senna."),
    ("gutierrez", "Esteban Gutierrez", "Mexico", "MEX", None),
    ("kvyat", "Daniil Kvyat", "Russia", "RUS", "Briefly Vettel's replacement at Red Bull."),
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

POLE_ONLY_PROVENANCE = ("Added to the register from the pole position and fastest lap harvest. "
                        "Never won a World Championship Grand Prix. Pole and fastest-lap counts "
                        "are derived from the race records; other career figures are not held.")


# ---------------------------------------------------------------------
# What the database does not hold, and why. One tuple per row of known_gaps:
#   id, key, field, area, state, reader, description, resolution
# races_affected is not in the tuple: it is measured, by GAP_RACES below.
# `id` is written here, not counted: it used to come from the list position,
# so filing a gap mid-list renumbered every `known_gaps #N` citation after
# it, and nine had drifted by the time #87 read them (PM-30). A new gap takes
# the next number and keeps it; verify.py requires the ids to be unique and
# contiguous and every citation in the tree to name a row that exists.
# `key` is the name a reader cites the gap by (DA-24): lower-case words and
# digits joined by hyphens, saying what is missing rather than where it sits
# in this list. Like the id it is written once and never changed or reused,
# including when the gap closes.
# `state` is 'open' (a fact nobody holds yet - the gaps the site counts),
# 'closed' (filled since; the row stays, and `resolution` says when and how)
# or 'position' (a deliberate absence, which is the right state and not a
# gap). `reader` is the paragraph a reader of the site is shown; the
# description and resolution are the maintainer's note and are kept whole.
# A row is never deleted: a closed gap is recorded as closed.
# ---------------------------------------------------------------------
KNOWN_GAPS = [
    (1, "fastest-lap-before-the-harvest", "fastest_lap", "the fastest lap of a race the pole harvest has not "
     "reached yet",
     "closed",
     "Closed: every completed race now carries a fastest lap, read from F1DB "
     "wherever the hand-written harvest is silent. The one completed race "
     "without one is the 2021 Belgian Grand Prix, in which no racing lap "
     "was set.",
     "The fastest lap of every race comes from harvest/poles.txt, which is "
     "written by hand. Everything else about a completed race - the "
     "classification, the qualifying sheet, the standings, and since this "
     "version the driver at the front of the grid - is refreshed from F1DB by "
     "a scheduled job within a day or two of the flag. So for the week "
     "between a Grand Prix and somebody editing that file, the site shows a "
     "completed race with no fastest lap. Pole used to sit in the same hole "
     "and no longer does: F1DB may now fill grid 1 where nothing else has.",
     "CLOSED in v2.18, the same way pole was closed. tools/f1db_fetch.py now "
     "reads the fastest-lap results beside race-results.yml and writes "
     "harvest/fastest_laps.txt, 1950 to the latest round F1DB holds; build.py fills "
     "race_entries.fastest_lap ONLY where the pole harvest is silent, and "
     "records a discrepancy rather than choosing where the two disagree - "
     "two did, at 1960 round 5 and 1970 round 1, and both are open. The one "
     "completed race still without a fastest lap is 2021 Belgium, where no "
     "racing lap was ever set, which is the true null this gap always "
     "excluded."),
    (2, "shared-drives", "finish_position", "shared drives, and where two sources read a race "
     "differently",
     "closed",
     "Closed: the full classification of every race ships in the database, "
     "from F1DB under a licence that permits passing it on. Two things "
     "remain by design rather than by omission - a driver who drove two "
     "cars in one Grand Prix, normal before 1965, keeps one row and one "
     "result; and where a second source reads 118 classifications "
     "differently, the disagreement is recorded rather than one being "
     "chosen.",
     "CLOSED in v2.15, and by a licence rather than a harvest. The full "
     "classification - {{fig:race_entries}} entries across all {{fig:races_completed}} races, 1950 to 2026 - "
     "now ships in the committed database. It comes from F1DB, which is CC "
     "BY 4.0: attribution only. The same facts via Jolpica-F1 carry Ergast's "
     "CC BY-NC-SA, and that non-commercial clause is the whole reason this "
     "gap stood for seven versions; nothing about the data was ever hard to "
     "get. The winner of {{fig:races_winner_held}} of those races was already "
     "held here, from the Wikipedia harvest and from formula1.com for the "
     "seasons after it, and F1DB agrees with every one; a round run since "
     "formula1.com was last read has F1DB's winner alone. "
     "What remains is not missing data. race_entries is ONE ROW PER DRIVER "
     "PER RACE, so a driver who drove two cars in one Grand Prix - normal "
     "before 1965, and the 1955 Argentine Grand Prix in particular - can "
     "only keep one result. And the two sources genuinely differ on 118 of "
     "26,082 entries when Jolpica is loaded on top: F1DB leaves a "
     "disqualified driver's position VACANT while Jolpica promotes everyone "
     "below, so the 1983 Brazilian Grand Prix has no second place in one "
     "reading and Lauda second in the other. Neither is wrong.",
     "CLOSED in v2.15: the full classification comes from F1DB under CC BY "
     "4.0, so the rows could be committed. "
     "Nothing to fetch. Run tools/ergast_load.py --from-dump to put Jolpica "
     "alongside: it no longer overwrites, it records every disagreement in "
     "`discrepancies` and leaves the stored value alone. Reading those 118 "
     "rows is the work, and it is a person's."),

    (3, "winning-chassis", "chassis_id", "the chassis each race was won in, where a season is ambiguous",
     "open",
     "We do not know which car won roughly one race in four. Where a team "
     "ran more than one design in a season and no source in use here says "
     "which raced which round, the winning chassis is left blank rather than "
     "guessed. Closing it needs per-round entry lists, which no source in "
     "use here publishes.",
     "The winning chassis is known for {{fig:races_winning_chassis}} of "
     "{{fig:races_completed}} races. It comes from "
     "F1DB's entry lists, resolved through the driver and the round: F1DB "
     "records which chassis a constructor ran in a SEASON and which driver "
     "an entrant ran in which ROUND, and the second is far sharper than the "
     "first. What is left is the entrants that ran more than one design and "
     "do not say which raced where - Gold Leaf Team Lotus in 1970 entered a "
     "49C, a 72B and a 72C, so Rindt's wins stay NULL while Soler-Roig's "
     "single Garvey Team Lotus entry resolves. v_ambiguous_seasons lists "
     "them. The gap is concentrated before 1980 because a modern team runs "
     "one car all season while a 1960s constructor was a name several "
     "privateers entered several different chassis under.",
     "Per-round chassis data, which no source in use here has. The season "
     "articles print a chassis column in the same results table the winners "
     "came from, and that column IS per round. Harvesting it is only safe "
     "with the check that now exists: a harvested chassis must appear in "
     "that constructor's entry list for that season, or be refused."),
    (4, "pole-car", "cars.poles", "the car each pole was taken in, where the season is ambiguous",
     "open",
     "For a handful of seasons we cannot say which car took a pole. Almost "
     "every pole entry now names a constructor, but where a team ran two "
     "designs - McLaren's M23 and M26 through 1976 and 1977 - attributing "
     "the pole to one of them would be a guess.",
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
     "sixteen poles against a published fourteen before this was checked.",
     "Per-round chassis data, which no source in use here has. The remaining "
     "seasons are listed in v_ambiguous_seasons and in car_seasons where "
     "corroborated = 0."),
    (5, "lap-timing", "laps", "lap times, tyre stints, pit stops, radio and telemetry",
     "position",
     "No lap times, tyre stints, race control messages or telemetry. Nobody "
     "publishes Formula One race timing under a licence that permits passing "
     "it on, so this database holds none: the tables exist and stay empty "
     "by design. Pit stops - lap and order, from F1DB - and six radio "
     "exchanges quoted from Wikipedia are the exceptions, and may be passed "
     "on.",
     "The laps, stints and race_control_messages tables are EMPTY in the "
     "distributed database, and that is a licensing and reproducibility "
     "decision rather than a missing harvest. (pit_stops holds F1DB's stops - "
     "lap and order, no durations - and team_radio six exchanges quoted from "
     "Wikipedia; both may be passed on.) Two "
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
     "weekend and fastf1_load.py writes it to Parquet beside the database.",
     "LOCALLY ONLY, and there is no version of this that ends in a shipped "
     "table: no source has lap times under a licence that permits passing "
     "them on. F1DB is the one source here that does permit it - which is "
     "why {{fig:pit_stops}} of its pit stops ARE committed - and it has no lap times. "
     "So this is not an unfinished harvest, it is the correct state until "
     "that changes. On your own machine: "
     "python3 tools/ergast_load.py --from-dump --timing   (1996-, one "
     "hash-verified zip, about fifteen seconds), and/or "
     "pip install fastf1 && python3 tools/fastf1_load.py --years 2018-2026 "
     "--results --radio. Then ./f1 laps. verify.py re-derives each race's "
     "fastest lap from the lap times and checks it against the setter "
     "already stored from the pole harvest - 446 races, no disagreement. "
     "docs/TIMING-ARCHITECTURE.md has the measurements and the design this "
     "would take if a redistributable source ever appears."),
    (6, "race-timing", "race_timing", "pole, fastest lap and race times per race",
     # A position, not an open gap: the table is one of the four verify.py
     # keeps empty, because per-race timing is FOM's data. The review of #72
     # caught it filed as fillable. The pre-2018 race-report route is a
     # separate question the maintainer note still records.
     "position",
     "No race times, by decision: per-race timing is Formula One's own data "
     "and the table that would hold it is kept empty, as gap 5 says. The "
     "winner's time and margin as printed in race reports are a different "
     "source and have not been read.",
     "The race_timing table is empty. These figures are published per race "
     "rather than per season, so filling them for 1950-2017 means reading "
     "{{fig:races_before_2018}} individual race articles, which was judged too expensive against "
     "what it returns. From 2018 the FastF1 loader supplies the same "
     "information at far greater resolution.",
     "Either harvest race articles for the pre-2018 seasons, or accept that "
     "timing starts in 2018 and fill it with tools/fastf1_load.py."),
    (7, "layout-as-raced", "layout_name", "circuit configuration as raced, for most circuits",
     "open",
     "For most circuits we hold one shape - the current one - so a 1976 "
     "Kyalami lap is reported at the length of the 1992 rebuild. Thirteen "
     "circuits have a full configuration timeline; elsewhere a race page "
     "says 'current layout' where it cannot say 'as raced'.",
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
     "broken out.",
     "Research the configuration history of each remaining multi-race circuit "
     "and add the rows; verify.py already enforces that a circuit's layout "
     "rows, once present, form a complete non-overlapping timeline."),
    (8, "fastest-lap-2021-belgian-gp", "fastest_lap", "fastest lap, 2021 round 12 (Belgian Grand Prix)",
     "position",
     "The 2021 Belgian Grand Prix has no fastest lap because none was set: "
     "the race was abandoned after two laps behind the safety car, half "
     "points were awarded and no racing lap was completed. The blank is "
     "correct.",
     "No fastest lap is recorded because none was set. The race was abandoned after "
     "two laps behind the safety car, half points were awarded and no racing lap was "
     "completed. This is a true null, not missing data.",
     "Nothing to fix - the absence is correct."),

    (9, "qualifying-before-1996", "qualifying.q1", "qualifying session detail before 1996, and sector times",
     "open",
     "No sector times, tyre compounds or qualifying session detail before "
     "1996. A pre-1996 qualifying session was a single time, so there are "
     "no Q1, Q2 or Q3 figures to hold; sector times were never published "
     "before the live-timing era.",
     "Qualifying is held for every completed race - but its SHAPE "
     "changes. Before the knockout format a session is a single time, so q1, "
     "q2 and q3 are NULL and there is nothing to put in them; from 1996 the "
     "three segments are recorded and `time` is NULL instead. Neither is "
     "back-filled from the other, and verify.py fails the build if a row "
     "ever carries both. What is missing throughout is sector times, tyre "
     "compound and the lap a time was set on, none of which was published "
     "before the live timing era.",
     "From 2018, tools/fastf1_load.py has all of it at far greater "
     "resolution. Before that it does not exist in any retrievable form."),

    (10, "historic-centrelines", "centreline", "the shape of a circuit, for anything but the present day",
     "position",
     "A traced circuit is always the circuit as it is today. OpenStreetMap "
     "maps what is on the ground, and Spa's 14.1 km road course is not on "
     "the ground any more, so a historic layout has no trace rather than a "
     "modern shape standing in for it.",
     "circuit_geometry traces a circuit from OpenStreetMap and checks the "
     "trace against the length this database already held. It can only ever "
     "be the CURRENT configuration, because OSM maps what is on the ground: "
     "Spa's 14.1 km Ardennes road course, Monza's banked sopraelevata and "
     "the 1976 Kyalami are not mapped and cannot be. Wikidata does model "
     "historic layouts as their own entities - 'Circuit de Monaco Grand "
     "Prix Circuit (1929-1972)' is Q66712049 - but those entities carry a "
     "length and a date range and NO coordinates, so there is no geometry "
     "source for them anywhere. A trace is therefore attached to a layout "
     "only where that layout is still current, and historic layouts have no "
     "row rather than a modern shape standing in for them.",
     "Nothing available. A historic centreline would have to be traced from "
     "period maps or aerial survey, which is a research project rather than "
     "a harvest, and any such trace would have no independent length to be "
     "checked against - the one thing that makes the current ones "
     "trustworthy. Leaving them absent is the correct answer."),

    (11, "photograph-shows-the-car", "article_images.name_matches", "whether a photograph shows the car",
     "open",
     "We cannot confirm that the {{fig:article_route_images}} photographs leading car articles "
     "show the car they are filed under, and {{fig:images_to_check}} of them do not even name "
     "it in their file name. The article is verified; the picture in it is not, and there "
     "is no second source to check it against - one car article leads with "
     "a photograph of police officers.",
     "{{fig:article_route_images}} car articles carry a lead photograph from Wikimedia Commons, with "
     "its licence and photographer. The ARTICLE is well constrained - it "
     "passed the constructor, seasons and name checks in "
     "tools/wikispec_fetch.py before it was accepted - so the recorded claim "
     "is 'the article proved to describe this chassis leads with this file'. "
     "What is NOT established is that the photograph shows the car. Nothing "
     "in this database constrains the content of an image and there is no "
     "second source to disagree with, which makes this the only part of the "
     "database with no cross-check available at all. Testing whether the "
     "file name mentions the chassis finds {{fig:article_route_named}} of "
     "{{fig:article_route_images}}, because most correct "
     "images are filed under the driver - "
     "File:Jos_Verstappen_2000_Monza_(cropped).jpg really is an Arrows A21 - "
     "so the test cannot be a rule without discarding half the good rows. "
     "It is stored as name_matches and enforced nowhere. The failure it "
     "half-detects is real: the ATS D5 article leads with a photograph of "
     "officials and police.",
     "A person looking. v_images_to_check lists the {{fig:images_to_check}} whose file name does "
     "not name the car, worst first by how many chassis depend on the "
     "article. Every row sits at 'unverified' until then, which is where "
     "this database puts what it cannot prove; a row taken from a Commons "
     "category for a chassis with no article sits lower still, at "
     "'catalogued'."),

    (12, "underivable-records", "records", "the records the database cannot derive",
     "open",
     "Five records the authored table used to carry are not published, "
     "because the database cannot derive them: the youngest and oldest "
     "champion need the round at which the title was clinched, the closest "
     "finish and the longest race need race times it does not hold, and "
     "'only woman to score points' needs an attribute no table models. Nor "
     "are the race-leader records in Wikipedia's lists of driver and "
     "constructor records - laps and distance led, races led, leading every "
     "lap and so the grand slam - which need the running order lap by lap.",
     "records is derived from the race records on every build - every row is "
     "one query, with its rule in `detail` - and a record the tables cannot "
     "support is not shipped rather than typed in from memory, which is how "
     "the table came to say Hamilton had 105 wins beside a drivers.wins of "
     "106. Five that the authored table carried are not derivable here. The "
     "youngest and oldest World Champion need the round at which the title "
     "was clinched, which would have to be computed from the points still "
     "available under each season's scoring system; the database holds the "
     "standings after every round but not that calculation. The closest race "
     "finish needs the winning margin, and race_entries holds no race times "
     "or gaps. The race_timing table, which would hold them, is EMPTY; see "
     "gap #6. The longest race by duration needs the race time, which the "
     "same absence covers. "
     "'Only woman to score points' needs a gender attribute, which no table "
     "holds and no source in use publishes as data. The closest qualifying "
     "margin IS derived - qualifying.gap holds a parseable gap for second "
     "place in all but one completed race - and stands as a record. WK-06 "
     "read Wikipedia's lists of driver and constructor records against this "
     "table and added the headline records the race records can derive, "
     "leaving which of the lists' many variants belong here to WK-08 (#643); "
     "what they cannot derive is the race-leader family - laps and distance led, in "
     "a career, a season or a run, races led, leading every lap, and the "
     "grand slam, which is pole, win and fastest lap while leading every lap. "
     "All of it needs the running order lap by lap, which is lap timing and "
     "which `laps` holds none of by licence (gap #5); pole, win and fastest "
     "lap together IS derived. The list's records that need the clinching "
     "round - the youngest champion, the most races left when a title was "
     "won - wait on the same derivation as the youngest and oldest champion "
     "above, and its pit-stop durations need timing too.",
     "The clinching round is computable from `standings` and `points_systems`, "
     "and the per-season maximum-points rule that route was waiting on is now "
     "written down: points_systems.win_points and .fastest_lap_points carry as "
     "figures what `scoring` and `fastest_lap` carry as sentences, and the "
     "season page already adds them up to say who can still win (PD-28). What "
     "is left is walking the standings back round by round to find the first "
     "at which the gap exceeded what remained; this gap stays open until that "
     "is derived and checked. The others need race timing, which no source "
     "publishes under a licence that permits passing it on (known_gaps #5), "
     "or an attribute the project does not model."),
    (13, "team-entry-fee", "governance", "what a new team pays to enter",
     "open",
     "The sum a new team pays to join - the anti-dilution fund - is a term "
     "of the Concorde Agreement, a private contract. The figures in print, "
     "US$200 million under the 2021 agreement and US$450 million under the "
     "2026 one, are reported by the press and confirmed by no published "
     "document, so this database does not carry them.",
     "The Wikipedia Formula One page states US$450 million as the up-front "
     "payment a new team makes, describing it as a payment to the FIA; press "
     "reports describe the same sum as the Concorde Agreement's anti-dilution "
     "fund, compensating the existing teams - which is the point: the "
     "recipient, like the figure, is reported rather than published. The "
     "2021 agreement's US$200 million is likewise widely reported. Neither "
     "the FIA nor Formula One has published the agreement or the figure, and "
     "the project's rule is that a fact needs a source before it needs a row: "
     "a governance row would carry a newspaper's number as if it were the "
     "contract's. Filed from the survey of the Wikipedia page (WK-04).",
     "Closes if the FIA or Formula One publishes the figure, or if the "
     "Concorde Agreement is published; the row would then go in governance "
     "citing that document."),
    (14, "107-per-cent-2011-australian-gp", "race_entries", "the two 2011 Australian Grand Prix entries that failed "
     "the 107 per cent rule",
     "open",
     "Two HRT cars, Vitantonio Liuzzi's and Narain Karthikeyan's, set "
     "qualifying times at the 2011 Australian Grand Prix that lay outside 107 "
     "per cent of the fastest first-segment time, and the stewards did not "
     "allow them to start. The qualifying table holds both times; the race "
     "classification has no entry for either car, because the source it comes "
     "from omits them for this race, so the race shows 22 entries where 24 "
     "cars took part in the weekend.",
     "F1DB's qualifying rows for 2011 round 1 carry both HRT cars as not "
     "classified, with times of 1:32.978 and 1:34.293 against a fastest Q1 "
     "of 1:25.296 - 107 per cent of which is 1:31.267. Its race classification "
     "for the same round omits them, while its 2012 round 1 classification "
     "lists the same team's two cars as DNQ in the same circumstances. The "
     "two rows are not added by hand: the classification is loaded whole from "
     "harvest/race_results.txt, which tools/f1db_fetch.py rewrites, and there "
     "is no curated path for a classification entry as there is for a winner, "
     "a pole or a fastest lap. A hand-written row would be overwritten at the "
     "next fetch. verify.py pins the pair by identity, so a third orphan "
     "qualifying row fails the build.",
     "Closes when F1DB's classification for 2011 round 1 carries the two DNQ "
     "rows, which the next fetch would pick up; or by a curated-entry "
     "mechanism with its own source column, if a second case appears."),
    (15, "session-timetable", "sessions", "the weekend timetable, checked against one source only",
     "open",
     "The start time of every 2026 session is held from formula1.com's race "
     "pages and reproduced from them by machine. The FIA publishes the same "
     "timetable for each event as a document, and this database has not yet "
     "read those documents, so a start time here has one source behind it "
     "where most figures have two.",
     "sessions carries {{fig:sessions}} rows read from formula1.com's per-event pages "
     "(LV-02, #91), whose schema.org markup states each start in UTC; the "
     "review of #91 reproduced all 115 it then held from that markup. verify.py holds the "
     "structure - the five sessions a sprint flag implies, their order, and "
     "the race's local day against races.date_to - but no non-race start is "
     "constrained by anything independent of the source it came from. The "
     "FIA's per-event 'Event & Timing Information' PDFs carry the same "
     "timetable and are the independent source; the project has no tool "
     "that reads them yet.",
     "Closes when a tool reads the FIA event timetable and verify.py compares "
     "every start against it, with a disagreement filed in discrepancies."),
    (16, "cost-cap-indexation", "regulation_limits.cost_cap_usd", "the cost cap after Indexation",
     "open",
     "The cost cap shown for each year is the figure the FIA Financial "
     "Regulations state before Indexation. Those regulations adjust it for "
     "inflation in 2023 to 2025 and from 2027, and the adjusted figures are "
     "not held here.",
     "The 2023-2025 issues (18 and 25 read) and Section D issue 07 each set "
     "the cap as adjusted, where applicable, for Indexation, with the rate "
     "communicated by the Cost Cap Administration by Determination rather "
     "than written in the regulations. Section D's Indexation does not reach "
     "2026, so the 2026 figure is final; the 2027 one cannot be known until "
     "2026 inflation is determined, and the rate to 30 June 2027 can raise "
     "it. The stored values are the regulations' own figures, which "
     "verify.py and the 2026 regulation_changes prose agree on.",
     "Closes when the indexed figure for each indexed year is read from an "
     "FIA Determination or an FIA statement of the adjusted cap, and stored "
     "beside the base."),
    (17, "career-figure-no-named-source", "drivers.*_external",
     "a typed career figure that no named source gives",
     "open",
     "Maria de Villota tested for Marussia in 2012 and never entered a "
     "championship race. The career wins and poles once typed for her came "
     "from reference records nobody named, and F1DB, the source every other "
     "typed figure was checked against, holds only drivers who entered, so "
     "no second figure is held to compare hers with. Her totals counted from "
     "the race records are unaffected.",
     "PM-57 (#624). Every career figure typed into data/drivers.py was "
     "checked against a named source that publishes that figure: F1DB's own "
     "career totals (harvest/f1db_driver_totals.txt), or where F1DB differs "
     "a second one (RESOURCED_ELSEWHERE). Where one matched, the figure "
     "cites it. These two - de-villota's wins and poles, both 0 - have no "
     "F1DB driver to be checked against and no other named source, so the "
     "build removes them (NULL, not established) rather than leave a figure "
     "no source stands behind. CAREER_FIGURES_NO_SOURCE lists them and the "
     "build refuses any other.",
     "Closes when a named, classified source publishes a career total for "
     "her, and that figure is read and cited."),
    (18, "qualifying-format-before-1996", "qualifying_formats",
     "how the grid was set before 1996",
     "open",
     "How qualifying worked before 1996 is not recorded here. The grids "
     "themselves are, race by race; what is missing is the rule that set "
     "them - how many sessions, and which time counted - season by season "
     "from 1950 to 1995.",
     "WK-01 (#186). qualifying_formats starts in 1996 because that is the "
     "first change Formula 1's own history of qualifying formats dates: the "
     "single one-hour session of that season. For the years before, the "
     "article gives one pattern, with exceptions it places by decade but "
     "not by year, so it cannot bound a period, and no row "
     "was written for any part of the span. The FIA's Sporting Regulations "
     "read for this table begin with 2009.",
     "Closes when a source that states the format season by season - the "
     "FIA's yearbooks or its Sporting Regulations for those years - is read "
     "for 1950 to 1995 and each span is written as a row."),
    (19, "qualifying-107-before-2009", "qualifying_formats.rule_107",
     "whether the 107% rule applied, 1996 to 2008 and at two rounds of 2016",
     "open",
     "For the qualifying formats from 1996 to 2008, and for the first two "
     "rounds of 2016, this database does not say whether a driver outside "
     "107 per cent of the fastest time could be kept off the grid: the "
     "column is empty rather than guessed.",
     "WK-01 (#186). rule_107 is read only from the FIA Sporting Regulations, "
     "and the earliest issue read is 2009's: the 2009 and 2010 issues set "
     "no 107% limit, and every issue read from 2011 does. The periods before "
     "2009 are dated by Formula 1's history of qualifying formats, which "
     "does not mention the rule, and so are the two 2016 rounds run to the "
     "elimination format, because the March 2016 issue that set it out was "
     "not found; the 20 April issue read for the rest of 2016 postdates "
     "them. Those rows hold NULL.",
     "Closes when the Sporting Regulations for 1996 to 2008, and the 2016 "
     "issue in force at the first two rounds, are read and each row's "
     "rule_107 is set from them."),

    (20, "circuit-article-sudschleife", "circuits.article",
     "which Wikipedia article describes the Nurburgring Sudschleife",
     "position",
     "The Nurburgring's southern loop is held in the register for a race "
     "that did not count towards the championship, so no list of "
     "championship circuits names an article for it, and none is guessed.",
     "VD-47 (#420). Every other circuit is mapped to its Wikipedia article "
     "by the List of Formula One circuits, matched on country, seasons and "
     "races held rather than on the name (tools/circuit_articles.py). The "
     "Sudschleife held no championship Grand Prix - the 1960 German Grand "
     "Prix run on it was a Formula Two race - so the list does not carry "
     "it, and a source that does is what the ruling of 2026-09-24 asks for. "
     "Wikipedia has no article of its own for it: the title redirects into "
     "a section of the Nurburgring article, the same article the list gives "
     "the Nordschleife and the GP-Strecke. A redirect found by trying a "
     "title is a name match, which is the thing the mapping refuses.",
     "A source that names the article for this circuit - a list of "
     "circuits beyond the championship, or the Nurburgring article's own "
     "account of its layouts read as one. Until then this is the position, "
     "not an omission: CIRCUIT_ARTICLE_GAPS declares it and verify.py "
     "fails on any circuit neither mapped nor declared."),
]

# known_gaps.races_affected, measured rather than typed (DA-16, #210).
#
# It was typed, and it said 0 on twelve of the twenty rows - including the winning
# chassis gap, whose own description counted 287 races without one, and the
# lap timing gap, which covers every race. A 0 is a claim that no race is
# affected, so a typed one is only ever the figure nobody checked.
#
# Each entry is a query returning the number of races the gap touches, run
# by build.py to fill the column and re-run by verify.py against it. A gap
# with no entry holds NULL: either it is not counted in races - a photograph,
# a circuit's shape, a fee - or no query here can yet say which races it
# touches (the pole car, the layout as raced, qualifying detail), and a count
# nobody can reproduce is the thing this replaced. verify.py fails an open
# or position gap that measures 0 - the gap has closed, or its query has
# stopped finding it - and a closed one that measures anything else.
_RUN = "SELECT r.id FROM races r WHERE r.status = 'completed'"
GAP_RACES = {
    # a race won in a car nobody here can name
    "winning-chassis": f"""SELECT COUNT(*) FROM ({_RUN}) r WHERE EXISTS (
        SELECT 1 FROM race_entries e WHERE e.race_id = r.id
        AND e.finish_position = 1 AND e.chassis_id IS NULL)""",
    # a run race with no lap in the table - every one, by design
    "lap-timing": f"""SELECT COUNT(*) FROM ({_RUN}) r WHERE NOT EXISTS (
        SELECT 1 FROM laps l WHERE l.race_id = r.id)""",
    "race-timing": f"""SELECT COUNT(*) FROM ({_RUN}) r WHERE NOT EXISTS (
        SELECT 1 FROM race_timing t WHERE t.race_id = r.id)""",
    # a settled race - not the season in progress, which the pole and
    # fastest-lap refresh may simply not have reached - with no fastest lap
    "fastest-lap-2021-belgian-gp": f"""SELECT COUNT(*) FROM ({_RUN}
        AND r.year < (SELECT CAST(value AS INTEGER) FROM meta
                      WHERE key = 'current_season')) r
        WHERE NOT EXISTS (SELECT 1 FROM race_entries e
                          WHERE e.race_id = r.id AND e.fastest_lap = 1)""",
    # a race whose qualifying sheet names a driver its classification omits
    "107-per-cent-2011-australian-gp": f"""SELECT COUNT(*) FROM ({_RUN}) r
        WHERE EXISTS (SELECT 1 FROM qualifying q WHERE q.race_id = r.id
            AND NOT EXISTS (SELECT 1 FROM race_entries e
                WHERE e.race_id = q.race_id AND e.driver_id = q.driver_id))""",
    # a weekend whose timetable rests on formula1.com's page alone
    "session-timetable": """SELECT COUNT(*) FROM races r
        WHERE EXISTS (SELECT 1 FROM sessions s WHERE s.race_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.race_id = r.id
              AND s.source NOT LIKE 'https://www.formula1.com/%')""",
}

# Shared fastest laps the season tables render as ONE name. harvest/poles.txt
# is read from the season summary tables, and where two or three drivers set
# the same time those tables can carry a single driver, so the other names
# were lost before the row was written. Each entry names the single driver
# the harvest holds - load_poles() refuses an override whose row has changed,
# so a re-harvest that fixes the cell fails loudly and the entry is removed
# rather than silently doubling - then the shared reading, the race article
# that establishes it, and why.
#
# Found from the outside in. The reference record gave Brabham 12 fastest
# laps against 11 in the race data and Phil Hill 6 against 5, and F1DB named
# Hill at Spa 1960 where the harvest named Brabham. The 1960 Belgian Grand
# Prix article credits Brabham, Ireland and Hill jointly at 3:51.9, which
# closes Hill. The 1969 Canadian Grand Prix article credits Brabham with the
# 1:18.1 that both harvests credit to Ickx: both are true of the same time,
# and the share closes Brabham without moving Ickx off his reference 14.
# The third was found the other way round, once the F1DB fetch kept every
# row of a tie (PD-53): F1DB credits Ascari and González jointly at Monza in
# 1952, the harvest Ascari alone, and the race article sides with F1DB.
# build.py records each as a resolved row in `discrepancies`.
#   (year, round): (name the harvest holds, shared names, source, why)
SHARED_FASTEST_LAPS = {
    (1960, 5): (
        "Jack Brabham", "Jack Brabham / Innes Ireland / Phil Hill",
        "https://en.wikipedia.org/wiki/1960_Belgian_Grand_Prix",
        "Three drivers lapped in 3:51.9 and the race article credits all "
        "three; the season table the harvest read carries Brabham alone. "
        "Restoring the share takes Phil Hill to the 6 fastest laps of his "
        "reference record and Innes Ireland to his 1. Brabham is unchanged."),
    (1969, 9): (
        "Jacky Ickx", "Jacky Ickx / Jack Brabham",
        "https://en.wikipedia.org/wiki/1969_Canadian_Grand_Prix",
        "Ickx on lap 30 and Brabham on lap 62 both lapped in 1:18.1. The "
        "season table and F1DB credit Ickx; the race article credits Brabham. "
        "The share takes Brabham to the 12 fastest laps of his reference "
        "record and leaves Ickx on his 14."),
    (1952, 8): (
        "Alberto Ascari", "Alberto Ascari / Jose Froilan Gonzalez",
        "https://en.wikipedia.org/wiki/1952_Italian_Grand_Prix",
        "Ascari and González both lapped in 2:06.1. The race article credits "
        "both, and its classification gives Ascari half a point for a shared "
        "fastest lap; F1DB credits both too. The season table the harvest "
        "read carries Ascari alone. Restoring the share takes González to "
        "the 6 fastest laps his career infobox and F1DB both give, and leaves "
        "Ascari unchanged."),
}

# The shares above whose added names build.py inserts an entry for when it
# reads the poles harvest (stage 17), ahead of the classification. That is
# how these two were built when race_entries ids were promised stable, and
# their rows keep the ids they were given. Every share added since waits for
# the classification to create the entry and credits that row, so restoring
# a share moves no id (DA-39). Nothing is added here.
SHARED_FASTEST_LAPS_INSERTED = {(1960, 5), (1969, 9)}

# Races where F1DB names a different fastest-lap setter from the harvest and
# the disagreement has been LOOKED AT. build.py records every such race in
# `discrepancies`; an entry here replaces the generic open assessment with
# what the check found, and says whether the row is still open. A race not
# listed here stays open with the generic text.
#   (year, round): (status, status_note, assessment)
# status is open, resolved or explained; the note is the short phrase saying
# how, and None where the status says it all (DA-09).
FASTEST_LAP_DISAGREEMENTS = {
    (1970, 1): (
        "open", "sources differ, reference record favours the stored value",
        "The harvest credits Brabham alone with the 1:20.8; F1DB credits "
        "Surtees and Brabham both, as a shared fastest lap (until PD-53 the "
        "fetch kept only the first row of a tie, so this read as Surtees "
        "alone). The race article credits Brabham and footnotes that some "
        "sources credit both, so this is a real disagreement between sources "
        "and stays open. The single-name reading is kept because the reference "
        "record sides with it: Surtees's total is 10 on formula1.com and in "
        "his career infobox, and the hand-entered 11 was already corrected to "
        "10 on that evidence (CORRECTIONS). That is a reason to prefer one "
        "reading, not proof the other is wrong. "
        "Source: https://en.wikipedia.org/wiki/1970_South_African_Grand_Prix"),
    (1953, 5): (
        "open", "sources differ",
        "The harvest credits Fangio alone with the 2:41.1; F1DB credits Fangio "
        "and Ascari both, as a shared fastest lap. The race article credits "
        "Fangio and footnotes that some sources credit Ascari with an equal "
        "fastest lap, so this is a real disagreement between sources and stays "
        "open. It is the race behind Ascari's open career row: F1DB's 13 "
        "fastest laps for him against the 12 of his career infobox and the "
        "race records (RESOURCED_ELSEWHERE). "
        "Source: https://en.wikipedia.org/wiki/1953_French_Grand_Prix"),
}

# Reference fastest-lap totals for the three drivers a restored share above
# also names and whose rows in data/drivers.py carry no fastest-lap figure.
# With these, every name the shares credit sits under the same external
# cross-check that pins Brabham and Phil Hill; without them Ireland's 1,
# Ickx's 14 and González's 6 were asserted in the reasoning and checked by
# nothing.
#   driver_id: (fastest laps, source)
EXTERNAL_FASTEST_LAPS = {
    "ireland": (1, "https://en.wikipedia.org/wiki/Innes_Ireland"),
    "ickx": (14, "https://en.wikipedia.org/wiki/Jacky_Ickx"),
    "gonzalez": (6, "https://en.wikipedia.org/wiki/Jos%C3%A9_Froil%C3%A1n_Gonz%C3%A1lez"),
}

# The career figures typed into data/drivers.py came from reference records
# nobody named, and a claim is the value a SOURCE gave (PM-57, #624). So the
# build checks every one of them against F1DB's own published career totals,
# harvest/f1db_driver_totals.txt, and:
#   - where F1DB gives the same figure, the figure cites F1DB;
#   - where F1DB gives a larger one for a driver still racing, and the race
#     records have reached it, the typed figure was an earlier total and
#     F1DB's replaces it, with the typed one kept in `discrepancies`;
#   - where F1DB gives a different figure otherwise, a second named source
#     must be read and declared here, or the build fails;
#   - where F1DB holds no such driver, the figure is removed and
#     CAREER_FIGURES_NO_SOURCE names it, beside known gap 17.
# A declaration here keeps the typed figure, cites the source that gives it,
# and files F1DB's figure against it as an open disagreement: two named
# sources differ, and neither is an official one.
#   (driver_id, field): (the typed figure, the named source that gives it, why)
RESOURCED_ELSEWHERE = {
    ("ascari", "fastest_laps"): (
        12, "https://en.wikipedia.org/wiki/Alberto_Ascari",
        "His Wikipedia career infobox gives 12, which is also the count in the "
        "race records; F1DB's published total is 13. The difference is the "
        "1953 French Grand Prix: F1DB credits Ascari and Fangio jointly with "
        "the 2:41.1, while the race article credits Fangio and footnotes that "
        "some sources credit Ascari with an equal lap. Two sources read one "
        "lap differently, and neither is an official one. "
        "Source: https://en.wikipedia.org/wiki/1953_French_Grand_Prix"),
}

# Typed career figures no named source gives, removed by the build (known gap
# 17). The build refuses a removal not listed here, and a listing that did not
# happen.
#   (driver_id, field)
CAREER_FIGURES_NO_SOURCE = (
    ("de-villota", "wins"),
    ("de-villota", "poles"),
)

# Differences between a hand-entered career figure and the figure derived
# from the race records that are NOT explained by the gaps above. Declared
# here so that verify.py can assert no NEW unexplained difference appears:
# a regression fails the build, while these stay visible. Empty since the two
# it held - Brabham 12 v 11 and Phil Hill 6 v 5 - turned out to be the two
# shared fastest laps in SHARED_FASTEST_LAPS; the mechanism stays.
#   driver_id, field, assessment
DECLARED_DISCREPANCIES = [
]

# Where the register's seasons and the race records' differ and neither is
# wrong: each side is right about something, the driver page shows both
# (CD-22), and this puts the reason beside the fact, in `discrepancies`,
# rather than in a code comment no reader meets (CD-25). verify.py derives
# the pair it pins from these rows, so a third driver whose spans differ
# needs a row here before the build passes.
#   driver_id, field ('first_season' or 'last_season'), register value,
#   race-records value, why
EXPLAINED_SPANS = [
    ("cevert", "first_season", 1970, 1969,
     "The published 1970 is his Formula One debut, the Dutch Grand Prix in a "
     "March run by Tyrrell. The race records hold a 1969 entry: that year's "
     "German Grand Prix admitted Formula 2 cars alongside the Formula One "
     "field, and he drove a Tecno TF69, one of them, retiring with a gearbox "
     "failure. It was a championship race and he was entered, so the records "
     "count it and the published span does not. "
     "Source: https://en.wikipedia.org/wiki/1969_German_Grand_Prix"),
    ("alexander-rossi", "first_season", 2014, 2015,
     "The published 2014 comes from F1DB's entry lists, which name him as "
     "entered for two rounds that year for Marussia, the Belgian and Russian "
     "Grands Prix; he started neither, so the race records hold nothing for "
     "him until 2015, when he started five Grands Prix for the same team, by "
     "then Manor Marussia. His earlier seasons as a Caterham reserve carry no "
     "round and count for neither span. An entry is not a start. "
     "Source: https://github.com/f1db/f1db, seasons/2014/entrants.yml"),
]

# Corrections made to hand-entered career figures after checking them against an
# external reference. Kept as a record of what changed and why.
#
# The last field is where the corrected value came from, and it is what the
# claim backing the external column cites from then on (PM-14). None means
# the SAME source, mistyped: the figure was transcribed wrongly and the source
# itself gives the new value, so the claim keeps its source and takes the
# value. A URL means a different source outranked the first, so the claim
# changes source - Russell's 11 poles are Wikipedia's figure, not
# formula1.com's, and the row-grain drivers.external_source cannot say so.
#   driver_id, field, old_value, new_value, reason, source of the new value
CORRECTIONS = [
    ("russell", "poles", 12, 11,
     "The formula1.com driver page gave 12. That same fetch returned internally "
     "inconsistent 2026 figures (160 points against the standings' 183, and third "
     "place against second), so it was not reliable. The Wikipedia career infobox "
     "independently gives 11 poles and 7 wins, both matching the figures derived "
     "from the race records. Corrected to 11.",
     "https://en.wikipedia.org/wiki/George_Russell_(racing_driver)"),
    ("surtees", "fastest_laps", 11, 10,
     "The hand-entered total of 11 was wrong by the race records and by his "
     "Wikipedia career infobox, which both give 10. F1DB's published total is "
     "11: it credits him with the fastest lap of the 1970 South African Grand "
     "Prix, which the harvest gives Brabham, and that race-level disagreement "
     "is on the record and open. Corrected to 10, the figure the infobox and "
     "the race records agree on.",
     "https://en.wikipedia.org/wiki/John_Surtees"),
]


# The three career figures stored as a source gave them and never recounted
# (DA-16) - drivers.entries, drivers.starts and drivers.career_points -
# compared with what the race records give for the same driver (DA-42): the
# rows race_entries holds for him, the ones of them that are starts by
# build.STARTED, and the points of those rows and of his sprint_results. The
# build files every difference in `discrepancies` and fails on one that is not
# accounted for, as it does for wins, poles and fastest laps.
#
# Accounted for means one of three things:
#   - a current driver's formula1.com figure (VERIFIED_STATS) that equals the
#     race records counted to the day it was read, the races run since being
#     the whole of the difference: explained, and nothing to declare;
#   - a typed figure no source gives, corrected below to the one a named
#     source does, with the typed value kept on the record;
#   - a difference declared below with the reason for it. Most are each
#     source counting by its own rule - a championship total net of the
#     scores the best-results rule dropped, an entry at a race the driver
#     never reached the grid of - and are explained; where two named sources
#     disagree about the race itself, the row is open.
#
# The figures F1DB publishes, quoted below, are its career totals in release
# v2026.14.0, f1db-drivers.csv in f1db-csv.zip (totalRaceEntries,
# totalRaceStarts, totalPoints, totalChampionshipPoints): the release
# harvest/f1db_driver_totals.txt was at when they were read. That file now
# moves with every refresh (CR-69), so a later release may publish other
# figures for a driver still racing. The infobox figures are
# Wikipedia's, read on 2026-10-01, where the figure outside the brackets is
# the championship total and the one inside it everything scored.
#
# A declaration names both readings, and the build refuses one the database
# no longer holds - so a refresh that moves either side reopens the question
# rather than carrying the old answer past it.
#   driver_id, field, typed value, corrected value, why
STORED_TOTALS_CORRECTED = [
    ("ascari", "career_points", 140.64, 140.14,
     "No source gives 140.64. His Wikipedia infobox gives 107 9/14 (140 1/7) "
     "- a championship total of 107 9/14 out of 140 1/7 scored - and F1DB's "
     "published totals are the same, 107.64 and 140.14, as is the sum of the "
     "race records. The typed figure is the scored total with the fraction "
     "of the championship one. Corrected to 140.14, the points he scored, "
     "held to two places as the race records hold a seventh of a point. "
     "Source: https://en.wikipedia.org/wiki/Alberto_Ascari"),
    ("ascari", "entries", 33, 34,
     "No source gives 33. His Wikipedia infobox gives 34 entries and 32 "
     "starts, the 34 counting the two races he was entered for and did not "
     "start: the 1950 French Grand Prix, where he did not start, and the "
     "1953 Indianapolis 500, where he was entered and did not arrive. That "
     "is the rule every other champion's stored entries follow, so the "
     "figure is corrected to 34. The difference from the race records' 32 "
     "is declared beside it. "
     "Source: https://en.wikipedia.org/wiki/Alberto_Ascari"),
    ("fangio", "career_points", 245.14, 245,
     "No source gives 245.14. His Wikipedia infobox gives 245 (277 9/14), "
     "F1DB's published totals give 245 championship points of 277.64 "
     "scored, and the final tables here sum to 245. Corrected to 245, the "
     "championship total the typed figure's whole points are; the "
     "difference from the race records' 277.64 is declared beside it. "
     "Source: https://en.wikipedia.org/wiki/Juan_Manuel_Fangio"),
    ("hulme", "entries", 114, 112,
     "No source gives 114. His Wikipedia infobox gives 112 entries, every "
     "one a start, F1DB's published total is 112, and the race records hold "
     "112 rows for him. Corrected to 112. "
     "Source: https://en.wikipedia.org/wiki/Denny_Hulme"),
    ("p-hill", "entries", 51, 52,
     "No source gives 51. His Wikipedia infobox gives 52 entries, F1DB's "
     "published total is 52, and the race records hold 52 rows for him, "
     "four of them races he did not start - the 1962 United States Grand Prix, "
     "the 1966 Monaco and Belgian Grands Prix, where he drove a camera car "
     "for the film Grand Prix, and the 1966 Italian Grand Prix, which he "
     "did not qualify for. Corrected to 52. "
     "Source: https://en.wikipedia.org/wiki/Phil_Hill"),
]

# For a dated figure - a current driver's - the race-records value is the
# count to the day stats_as_of gives, so the declaration holds from one race
# to the next; the row filed carries the count as it is now.
#   driver_id, field, stored value, race-records value, status, status_note,
#   why
STORED_TOTALS_DECLARED = [
    ("senna", "career_points", 610, 614, "explained", "net of dropped scores",
     "The stored 610 is his championship total and the race records' 614 "
     "everything he scored: in 1988 only the best eleven of sixteen results "
     "counted, and four of his 94 points that year were dropped. Both are "
     "his - his Wikipedia infobox gives 610 (614), and F1DB's published "
     "totals give 610 championship points of 614 scored. "
     "Source: https://en.wikipedia.org/wiki/Ayrton_Senna"),
    ("fangio", "career_points", 245, 277.64, "explained", "net of dropped scores",
     "The stored 245 is his championship total and the race records' 277.64 "
     "everything he scored: the best-results rule dropped points from six "
     "of his eight seasons, 1951 and 1953 to 1957, 32 9/14 of them in all. "
     "Both are his - his Wikipedia infobox gives 245 (277 9/14), and F1DB's "
     "published totals give 245 championship points of 277.64 scored. "
     "Source: https://en.wikipedia.org/wiki/Juan_Manuel_Fangio"),
    ("farina", "career_points", 127.33, 126, "explained",
     "a car the records do not hold",
     "He finished the 1955 Argentine Grand Prix in two cars, each shared "
     "three ways and its points divided: second in the Ferrari he shared "
     "with Gonzalez and Trintignant, for 2 points, and third in the one he "
     "shared with Maglioli and Trintignant, for 1 1/3. The race records hold "
     "one row per driver per race, so they carry the 2 and not the 1 1/3. "
     "The stored 127 1/3 is everything he scored: his Wikipedia infobox "
     "gives 115 1/3 (127 1/3), and F1DB, which holds both cars, publishes "
     "127.33. Source: https://en.wikipedia.org/wiki/Giuseppe_Farina"),
    ("ascari", "entries", 34, 32, "explained", "an entry the records do not hold",
     "Wikipedia's 34 counts two races he was entered for and did not start: "
     "the 1950 French Grand Prix and the 1953 Indianapolis 500, where he did "
     "not arrive. The race records hold neither, and F1DB's published "
     "total, 32, counts neither. "
     "Source: https://en.wikipedia.org/wiki/Alberto_Ascari"),
    ("fangio", "entries", 52, 51, "explained", "an entry the records do not hold",
     "Wikipedia's 52 counts the 1958 Indianapolis 500, which he went to, "
     "tried cars at and did not qualify for. The race records hold no "
     "Indianapolis non-qualifier and have no row for him there; F1DB's "
     "published total, 51, does not count it either. "
     "Source: https://en.wikipedia.org/wiki/Juan_Manuel_Fangio"),
    ("farina", "entries", 35, 34, "explained", "an entry the records do not hold",
     "Wikipedia's 35 counts the 1956 Indianapolis 500, which he did not "
     "qualify for. The race records hold no Indianapolis non-qualifier and "
     "have no row for him there; F1DB's published total, 34, does not count "
     "it either. Source: https://en.wikipedia.org/wiki/Giuseppe_Farina"),
    ("lauda", "entries", 177, 176, "explained", "an entry the records do not hold",
     "Wikipedia's 177 counts the 1979 Canadian Grand Prix, where he stopped "
     "during practice, told Ecclestone he was retiring, and left: it lists "
     "him as withdrawn. The race records have no row for him there, and "
     "F1DB's published total, 176, does not count it. "
     "Source: https://en.wikipedia.org/wiki/Niki_Lauda"),
    ("raikkonen", "entries", 353, 352, "explained", "an entry the records do not hold",
     "Wikipedia's 353 counts the 2021 Dutch Grand Prix, which he was entered "
     "for and withdrew from during the weekend after testing positive for "
     "COVID-19, Robert Kubica driving his car. F1DB's entry list names him "
     "for the round, but its race results, which its published total of 352 "
     "counts, and the race records name Kubica. "
     "Source: https://en.wikipedia.org/wiki/Kimi_R%C3%A4ikk%C3%B6nen"),
    ("alonso", "entries", 439, 440, "open", "sources differ",
     "formula1.com's driver page, read on 2026-09-04 after round 12, gave "
     "439; counted to that day, the race records hold 440 rows for him, two "
     "of them races he did not start, the 2005 United States and 2017 "
     "Russian Grands Prix. The page's figure is one fewer, and which race it "
     "leaves out is not established. Source: "
     "https://www.formula1.com/en/drivers"),
    ("leclerc", "entries", 183, 185, "open", "sources differ",
     "formula1.com's driver page, read on 2026-09-04 after round 12, gave "
     "183; counted to that day, the race records hold 185 rows for him, two "
     "of them races he did not start, the 2021 Monaco and 2023 Sao Paulo "
     "Grands Prix, and the page's figure is two fewer. Hamilton's and "
     "Verstappen's pages, read the same day, agree with the records, and "
     "neither has a race he did not start; but Alonso's and Russell's "
     "differences do not follow the non-starts, so that the page counts only "
     "starts is not established. Source: https://www.formula1.com/en/drivers"),
    ("norris", "entries", 163, 164, "open", "sources differ",
     "formula1.com's driver page, read on 2026-09-04 after round 12, gave "
     "163; counted to that day, the race records hold 164 rows for him, one "
     "of them a race he did not start, the 2026 Chinese Grand Prix, and the "
     "page's figure is one fewer. Hamilton's and Verstappen's pages, read "
     "the same day, agree with the records, and neither has a race he did "
     "not start; but Alonso's and Russell's differences do not follow the "
     "non-starts, so that the page counts only starts is not established. "
     "Source: https://www.formula1.com/en/drivers"),
    ("piastri", "entries", 80, 82, "open", "sources differ",
     "formula1.com's driver page, read on 2026-09-04 after round 12, gave "
     "80; counted to that day, the race records hold 82 rows for him, two of "
     "them races he did not start, the 2026 Australian and Chinese Grands "
     "Prix, and the page's figure is two fewer. Hamilton's and Verstappen's "
     "pages, read the same day, agree with the records, and neither has a "
     "race he did not start; but Alonso's and Russell's differences do not "
     "follow the non-starts, so that the page counts only starts is not "
     "established. Source: https://www.formula1.com/en/drivers"),
    ("russell", "entries", 163, 164, "open", "sources differ",
     "formula1.com's driver page, read on 2026-09-04 after round 12, gave "
     "163; counted to that day, the race records hold 164 rows for him, "
     "every one a start. The page's figure is one fewer, and which race it "
     "leaves out is not established. Source: "
     "https://www.formula1.com/en/drivers"),
    ("piastri", "career_points", 903, 905, "open", "sources differ",
     "formula1.com's driver page, read on 2026-09-04 after round 12, gave "
     "903; counted to that day, the race records give 905. The 2 points are "
     "the 2026 Monaco Grand Prix: formula1.com's own table after round 12 "
     "gives him 104 points for the season and F1DB's, which the race records "
     "follow, 106, and that disagreement is open on the race, 2026 round 6. "
     "Source: https://www.formula1.com/en/results/2026/drivers"),
    ("russell", "career_points", 1193, 1216, "open", "sources differ",
     "formula1.com's driver page, read on 2026-09-04 after round 12, gave "
     "1193; counted to that day, the race records give 1216, 23 more. The "
     "same fetch gave his 2026 total as 160 points against the standings' "
     "183 - the inconsistency that had his pole count corrected - and the "
     "career figure is short by the same 23. The records' 2026 figure, 183, "
     "agrees with formula1.com's and F1DB's tables; the page has not been "
     "read again. Source: https://www.formula1.com/en/drivers"),
    ("raikkonen", "starts", 349, 350, "open", "sources differ",
     "The 2001 Belgian Grand Prix was stopped on lap five, declared void "
     "and run again from the start. He retired from the first race with a "
     "transmission failure and took no part in the second, and the official "
     "results list him as not having started, which is the 349 Wikipedia "
     "gives. F1DB's "
     "published total, 350, and the race records count it as a start he "
     "retired from. One race read two ways. "
     "Source: https://en.wikipedia.org/wiki/2001_Belgian_Grand_Prix"),
    ("piquet", "starts", 204, 203, "open", "sources differ",
     "The race records, and F1DB's published total of 203, hold his 1985 "
     "Canadian Grand Prix as a race he did not start, with a transmission "
     "failure. The race's Wikipedia article, citing formula1.com, has him "
     "retiring on lap 0 from ninth on the grid, which is a start, and his "
     "own article's infobox gives 204 starts. One race read two ways. "
     "Source: https://en.wikipedia.org/wiki/1985_Canadian_Grand_Prix"),
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
# known_gaps #3 records that the chassis-per-race harvest was abandoned
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
F1DB_TOTALS_FILE = os.path.join(HERE, "..", "harvest", "f1db_driver_totals.txt")
F1DB_COUNTRIES_FILE = os.path.join(HERE, "..", "harvest", "f1db_countries.txt")
ENTRANT_DRIVERS_FILE = os.path.join(HERE, "..", "harvest", "entrant_drivers.txt")
ENGINES_FILE = os.path.join(HERE, "..", "harvest", "engines.txt")
F1DB_CONS_FILE = os.path.join(HERE, "..", "harvest", "f1db_constructors.txt")
ENTRANTS_FILE = os.path.join(HERE, "..", "harvest", "entrants.txt")
SPECS_FILE = os.path.join(HERE, "..", "harvest", "car_specs.txt")
IMAGES_FILE = os.path.join(HERE, "..", "harvest", "article_images.txt")
CIRCUIT_ARTICLES_FILE = os.path.join(HERE, "..", "harvest", "circuit_articles.txt")
CATEGORY_IMAGES_FILE = os.path.join(HERE, "..", "harvest", "category_images.txt")
CIRCUIT_IMAGES_FILE = os.path.join(HERE, "..", "harvest", "circuit_images.txt")
RACE_IMAGES_FILE = os.path.join(HERE, "..", "harvest", "race_images.txt")
GEOMETRY_FILE = os.path.join(HERE, "..", "harvest", "circuit_geometry.txt")
RESULTS_FILE = os.path.join(HERE, "..", "harvest", "race_results.txt")
SPRINT_FILE = os.path.join(HERE, "..", "harvest", "sprint_results.txt")
QUALIFYING_FILE = os.path.join(HERE, "..", "harvest", "qualifying.txt")
PRACTICE_FILE = os.path.join(HERE, "..", "harvest", "practice.txt")
SPRINT_QUALIFYING_FILE = os.path.join(HERE, "..", "harvest", "sprint_qualifying.txt")
STANDINGS_FILE = os.path.join(HERE, "..", "harvest", "standings.txt")
F1DB_PITS_FILE = os.path.join(HERE, "..", "harvest", "f1db_pit_stops.txt")
RACE_DATES_FILE = os.path.join(HERE, "..", "harvest", "race_dates.txt")
FASTEST_LAPS_FILE = os.path.join(HERE, "..", "harvest", "fastest_laps.txt")
OUTLINES_FILE = os.path.join(HERE, "..", "harvest", "circuit_outlines.txt")
RACE_LAYOUTS_FILE = os.path.join(HERE, "..", "harvest", "race_layouts.txt")

# What an outline may hold: SVG path commands, numbers, separators. The path
# is written into a `d` attribute on every page that draws it, so anything
# else is refused at the fetch, at the build and in verify.py.
SVG_PATH_DATA = r"[MmZzLlHhVvCcSsQqTtAa0-9eE.,\- ]+"

# Every F1DB asset draws in the same box: <svg width="500" height="500">.
OUTLINE_BOX = 500.0

_SVG_NUMBER = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")
_SVG_ARGS = {"M": 2, "L": 2, "T": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "A": 7, "Z": 0}


def svg_path_segments(d):
    """Yield (command, arguments) for every segment of SVG path data.

    Implicit repeats are expanded - "M1 2 3 4" is an M and an L, "m1 2 3 4"
    an m and an l - and an arc's two flags are read as the single digits the
    grammar makes them, so "a1 1 0 011 1" is not misread as one number.
    Raises ValueError on anything the grammar does not allow: the fetch
    refuses such a path and verify.py reports it as outside its box (the
    build applies only SVG_PATH_DATA).
    """
    pos, n, cmd = 0, len(d), None
    while pos < n:
        ch = d[pos]
        if ch in " ,\t\n\r":
            pos += 1
            continue
        if ch.isalpha():
            if ch.upper() not in _SVG_ARGS:
                raise ValueError(f"unknown path command {ch!r} at {pos}")
            cmd, pos = ch, pos + 1
            if cmd.upper() == "Z":
                yield cmd, []
                continue
        elif cmd is None or cmd.upper() == "Z":
            raise ValueError(f"number without a command at {pos}")
        args = []
        for i in range(_SVG_ARGS[cmd.upper()]):
            while pos < n and d[pos] in " ,\t\n\r":
                pos += 1
            if cmd.upper() == "A" and i in (3, 4):
                if pos >= n or d[pos] not in "01":
                    raise ValueError(f"arc flag expected at {pos}")
                args.append(float(d[pos]))
                pos += 1
                continue
            m = _SVG_NUMBER.match(d, pos)
            if not m:
                raise ValueError(f"number expected at {pos}")
            args.append(float(m.group()))
            pos = m.end()
        yield cmd, args
        if cmd == "M":
            cmd = "L"
        elif cmd == "m":
            cmd = "l"


def _svg_number(v):
    return f"{v:.3f}".rstrip("0").rstrip(".") or "0"


def svg_path_translate(d, dx, dy):
    """Return `d` moved by (dx, dy): a translate() applied to the path itself.

    Only absolute coordinates move - a relative command is a displacement and
    a translate leaves it alone. The first `m` of a path is absolute by the
    grammar and moves with the rest. Arc radii, rotation and flags are not
    coordinates. The result is re-serialised at three decimals, which is what
    F1DB's assets carry.
    """
    out, first = [], True
    for cmd, args in svg_path_segments(d):
        moved = list(args)
        upper = cmd.upper()
        absolute = cmd.isupper() or (first and cmd == "m")
        if absolute and upper in ("M", "L", "T", "C", "S", "Q"):
            moved = [v + (dx if i % 2 == 0 else dy) for i, v in enumerate(args)]
        elif absolute and upper == "H":
            moved = [args[0] + dx]
        elif absolute and upper == "V":
            moved = [args[0] + dy]
        elif absolute and upper == "A":
            moved = args[:5] + [args[5] + dx, args[6] + dy]
        first = False
        out.append(cmd + " ".join(_svg_number(v) for v in moved))
    return " ".join(out)


def svg_path_extent(d):
    """(min_x, min_y, max_x, max_y) over every point the path names.

    Control points bound a Bezier curve, so this is an outer bound of the
    drawn shape; an arc is traced through its centre (SVG 1.1, F.6.5) and
    sampled, because F1DB's near-straight arcs carry radii in the tens of
    thousands and their endpoints plus radii would bound nothing. Where a
    stored outline lies is the one geometric fact the build can check - the
    box every F1DB asset draws in is OUTLINE_BOX square, and a path outside it
    renders as an empty figure.
    """
    x = y = sx = sy = 0.0
    xs, ys = [], []
    first = True
    for cmd, args in svg_path_segments(d):
        upper = cmd.upper()
        rel = cmd.islower() and not (first and cmd == "m")
        ox, oy = (x, y) if rel else (0.0, 0.0)
        first = False
        if upper == "Z":
            x, y = sx, sy
            continue
        if upper == "H":
            x = ox + args[0]
            xs.append(x)
            continue
        if upper == "V":
            y = oy + args[0]
            ys.append(y)
            continue
        if upper == "A":
            ex, ey = ox + args[5], oy + args[6]
            for px, py in _svg_arc_points(x, y, ex, ey, *args[:5]):
                xs.append(px)
                ys.append(py)
            x, y = ex, ey
            continue
        pts = [(ox + args[i], oy + args[i + 1]) for i in range(0, len(args), 2)]
        xs += [p[0] for p in pts]
        ys += [p[1] for p in pts]
        x, y = pts[-1]
        if upper == "M":
            sx, sy = x, y
    if not xs or not ys:
        raise ValueError("a path with no coordinates")
    return min(xs), min(ys), max(xs), max(ys)


def _svg_arc_points(x1, y1, x2, y2, rx, ry, phi, large, sweep, samples=64):
    """Points along an elliptical arc, endpoints included.

    The endpoint-to-centre conversion of SVG 1.1 appendix F.6.5, radii scaled
    up where they cannot span the chord as the same appendix says a renderer
    must. Zero radius is a straight line, per F.6.2.
    """
    import math
    rx, ry = abs(rx), abs(ry)
    if rx == 0 or ry == 0 or (x1, y1) == (x2, y2):
        return [(x1, y1), (x2, y2)]
    p = math.radians(phi)
    cp, sp = math.cos(p), math.sin(p)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx ** 2 * ry ** 2 - rx ** 2 * y1p ** 2 - ry ** 2 * x1p ** 2
    den = rx ** 2 * y1p ** 2 + ry ** 2 * x1p ** 2
    coef = (-1 if large == sweep else 1) * math.sqrt(max(0.0, num / den)) if den else 0.0
    cxp, cyp = coef * rx * y1p / ry, -coef * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x1 + x2) / 2
    cy = sp * cxp + cp * cyp + (y1 + y2) / 2
    t1 = math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx)
    t2 = math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx)
    dt = t2 - t1
    if sweep and dt < 0:
        dt += 2 * math.pi
    elif not sweep and dt > 0:
        dt -= 2 * math.pi
    pts = []
    for i in range(samples + 1):
        t = t1 + dt * i / samples
        pts.append((cx + rx * cp * math.cos(t) - ry * sp * math.sin(t),
                    cy + rx * sp * math.cos(t) + ry * cp * math.sin(t)))
    return pts


def svg_path_in_box(d, box=OUTLINE_BOX, margin=5.0):
    """True when the path lies inside [0, box] on both axes, give or take `margin`.

    The extent is an outer bound - a control point may sit outside the curve
    it shapes - and F1DB draws to within two units of the edge (buenos-aires-1,
    kyalami-1), so a few units are allowed. A path drawn elsewhere entirely,
    which is what a transform left unapplied produces, is hundreds out.
    """
    try:
        x0, y0, x1, y1 = svg_path_extent(d)
    except ValueError:
        return False
    return x0 >= -margin and y0 >= -margin and x1 <= box + margin and y1 <= box + margin

F1DB_SOURCE = "https://github.com/f1db/f1db"
F1DB_CONFIDENCE = "reference"

# A driver F1DB enters twice in one race, in cars of two constructors this
# database holds (CR-62). race_entries is one row per driver per race
# (known_gaps #2), so build.py merges a driver's later rows in a race into
# the first, which keeps that row's car. Where both cars were one
# constructor's, or the constructor is one the register does not hold (the
# Indianapolis makes), nothing a constructor is counted by is lost. These are
# the entries that are: the other constructor's car is not this driver's row.
# build.py refuses one not named here, and a name here F1DB no longer bears
# out, so a new case arrives as a question and not as a silent merge.
# Keyed (year, round, our driver id, constructor of the entry NOT kept).
SECOND_ENTRIES = {
    (1961, 5, "moss", "ferguson"):
        "F1DB lists Moss in a Lotus, DNF, and in the Ferguson, DSQ, that Jack "
        "Fairman also drove; the Lotus row is kept, and Fairman's row holds "
        "the Ferguson's entry.",
    (1978, 14, "harald-ertl", "ensign"):
        "F1DB lists Ertl in an ATS, DNQ, and an Ensign, DNPQ; the ATS row is "
        "kept, and the practice table holds the Ensign's pre-qualifying run "
        "(verify.py PRACTICE_TEAM_EXCEPTIONS).",
}

# A classified finisher inside the paid places whom F1DB gives no points
# (DA-37). The points system's scale says the place was paid, so the 0 that
# build.py writes below the paid places (DA-08) does not reach these: what
# the race's own rules did to the entry is a fact about that entry, and each
# one here is sourced to the race's own article, which states it. build.py
# writes the note to race_entries.note, cites the article for it in
# `claims`, and writes the 0 the cause establishes; it refuses a name here
# F1DB no longer bears out - a row gone, moved out of the paid places, or
# given points - and verify.py refuses a finisher inside the paid places
# holding no points that is not named here, so a new one arrives as a row
# to read and not as a blank or a guessed 0. The note is this project's
# wording of what the article states. Keyed (year, round, our driver id).
_F2 = ("A Formula Two car, run in the same race as the Formula One field and "
       "not eligible for championship points.")
_SHARED = "A shared drive, for which no championship points were awarded."
# The 1960 article states the rule's age; the 1958 one states only the
# outcome, so each note says what its own article does.
_SHARED_SINCE_1958 = ("A shared drive: under a rule in place since 1958, no "
                      "championship points were awarded for it.")
_SECOND_CAR = ("The team's second car, when the team had entered only one car "
               "for the championship, so not eligible for points.")
_WP = "https://en.wikipedia.org/wiki/"
UNPAID_INSIDE_THE_PAID_PLACES = {
    (1957, 5, "collins"): (
        "Shared Trintignant's car and drove 3 of its 88 laps: Trintignant "
        "received all 3 points for fourth, as Collins was judged not to have "
        "driven a significant number of laps.", _WP + "1957_British_Grand_Prix"),
    (1958, 8, "mclaren-d"): (_F2, _WP + "1958_German_Grand_Prix"),
    (1958, 10, "gregory"): (_SHARED, _WP + "1958_Italian_Grand_Prix"),
    (1958, 10, "carroll-shelby"): (_SHARED, _WP + "1958_Italian_Grand_Prix"),
    (1960, 1, "moss"): (_SHARED_SINCE_1958, _WP + "1960_Argentine_Grand_Prix"),
    (1960, 1, "trintignant"): (_SHARED_SINCE_1958, _WP + "1960_Argentine_Grand_Prix"),
    (1963, 4, "g-hill"): (
        "Push-started on the grid, for which the organisers gave a one-minute "
        "penalty; no championship points were awarded for his third place.",
        _WP + "1963_French_Grand_Prix"),
    # The 1967 article marks the car Formula Two and pays fifth place's 2
    # points to Bonnier, sixth on the road; it does not state the rule.
    (1967, 7, "oliver"): (
        "A Formula Two car, run in the same race as the Formula One field; "
        "the 2 points for fifth went to the next Formula One car.",
        _WP + "1967_German_Grand_Prix"),
    (1969, 7, "pescarolo"): (_F2, _WP + "1969_German_Grand_Prix"),
    (1969, 7, "attwood"): (_F2, _WP + "1969_German_Grand_Prix"),
    (1984, 14, "jo-gartner"): (_SECOND_CAR, _WP + "1984_Italian_Grand_Prix"),
    (1984, 14, "berger"): (_SECOND_CAR, _WP + "1984_Italian_Grand_Prix"),
    (1987, 16, "yannick-dalmas"): (_SECOND_CAR, _WP + "1987_Australian_Grand_Prix"),
}

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


def constructor_for_f1db(f1db_id, year=None):
    """This database's constructor id for an F1DB one.

    `year` matters for the same reason it does in constructor_id_for() above:
    one name can be two teams. F1DB's `alfa-romeo` covers three entities -
    the works team that won the first two championships, the works return of
    1979-85, and the naming rights Sauber raced under from 2019. This
    register's `alfa-romeo` is only the first two, and its own note says so.

    Without the year, Zhou Guanyu's fastest laps at Suzuka 2022 and Bahrain
    2023 were credited to a constructor whose last entry was 1985, thirty-
    seven years earlier. Nothing caught it, because no check asked whether an
    entry's constructor was actually racing that season. One does now.
    """
    from data import teams as _T
    if year is not None:
        renamed = F1DB_CONSTRUCTORS_BY_YEAR.get(f1db_id)
        if renamed:
            for lo, hi, target in renamed:
                if lo <= year <= (hi or year):
                    return target
    if f1db_id in _T.F1DB_CONSTRUCTOR_ALIASES:
        return _T.F1DB_CONSTRUCTOR_ALIASES[f1db_id]
    return F1DB_CONSTRUCTORS.get(f1db_id, f1db_id)


# F1DB ids whose meaning depends on the season. from_year, to_year, target.
F1DB_CONSTRUCTORS_BY_YEAR = {
    "alfa-romeo": [(2019, 2023, "sauber")],
}


def load_f1db_countries():
    """country_id, name, alpha3, demonym"""
    return _read_pipe(F1DB_COUNTRIES_FILE, 4)


def load_f1db_drivers():
    """driver_id, name, first_name, last_name, date_of_birth, date_of_death,
    abbreviation, nationality_country_id, place_of_birth,
    country_of_birth_country_id, permanent_number"""
    return _read_pipe(F1DB_DRIVERS_FILE, 11)


def load_f1db_driver_totals():
    """(release, {driver_id: (wins, poles, fastest_laps)}): F1DB's own career
    totals, from the release tools/f1db_totals_fetch.py read. The release is
    returned because the totals come from a release artefact, not the clone
    the rest of the F1DB files are read from; the refresh fetches both for the
    same release, and verify.py fails when they differ (CR-69)."""
    with open(os.path.abspath(F1DB_TOTALS_FILE), encoding="utf-8") as f:
        m = re.search(r"^# Source: F1DB (\S+) \(", f.read(), re.M)
    if not m:
        raise SystemExit("f1db_driver_totals.txt names no F1DB release. Rerun "
                         "tools/f1db_totals_fetch.py.")
    return m.group(1), {r[0]: tuple(int(v) for v in r[1:])
                        for r in _read_pipe(F1DB_TOTALS_FILE, 4)}


def f1db_harvest_release():
    """The F1DB release tools/f1db_fetch.py read the harvest from, as
    harvest/f1db_drivers.txt's header names it - the release
    tools/f1db_totals_fetch.py reads by default, and the one verify.py holds
    the career totals to (CR-69)."""
    with open(os.path.abspath(F1DB_DRIVERS_FILE), encoding="utf-8") as f:
        m = re.search(r"^# Source: F1DB (\S+) \(", f.read(), re.M)
    if not m:
        raise SystemExit("f1db_drivers.txt names no F1DB release. Rerun "
                         "tools/f1db_fetch.py.")
    return m.group(1)


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
        "Kept out of the NAME-based resolver, not out of the register. This "
        "register's `de-villota` is MARIA de Villota, who tested for Marussia "
        "and never entered a Grand Prix. Emilio is a different person - her "
        "father - who entered fifteen between 1976 and 1982, and he now has "
        "his own row under his own F1DB id. The two must never be joined, "
        "which is what this entry prevents.",
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
    ours_by_id = set(our_drivers)
    ours = {}
    for did, name in our_drivers.items():
        key = _norm(name)
        ours.setdefault(key, []).append(did)
    aliases = {_norm(k): v for k, v in DRIVER_ALIASES.items()}

    hits = {}
    for f1db_id, name, first, last, *_rest in load_f1db_drivers():
        if f1db_id in ours_by_id:
            # Admitted under its own F1DB id, so it maps to itself and can
            # never be pulled onto a namesake by the name match below.
            hits.setdefault(f1db_id, set()).add(f1db_id)
            continue
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


def _read_named(path, rerun):
    """Read a generated file by its column HEADER, not by position.

    Positional reads of a file another tool writes are a standing trap: adding
    engine_manufacturer_id to entrants.txt once shifted every field the spec
    harvest read, so every chassis looked never-entered and a seventy-minute
    run returned nothing. Reading by name costs one line and cannot do that.

    Returns [] when the harvest has not been run - these files are optional
    and the build must work without them.
    """
    path = os.path.abspath(path)
    if not os.path.exists(path):
        return []
    name = os.path.basename(path)
    cols, rows = None, []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("#"):
                if "|" in line:
                    # The header may carry a trailing note after the last
                    # column, separated by run of spaces - entrants.txt has
                    # done so since v2.9. Positional readers never saw it;
                    # this one would take the note as part of the name.
                    cols = [re.split(r"\s{2,}", c.strip())[0]
                            for c in line.lstrip("# ").split("|")]
                continue
            if not line.strip():
                continue
            parts = line.split("|")
            if cols is None or len(parts) != len(cols):
                raise SystemExit(
                    f"{name}: {len(parts)} fields, expected "
                    f"{len(cols) if cols else '?'}. Rerun {rerun}.")
            rows.append({c: (v.strip() or None) for c, v in zip(cols, parts)})
    return rows


# Markup in a text value: an HTML or wikitext tag, a comment, or a character
# entity. No column of the database holds one - a value that reaches a page
# or a meta description is printed as written, so a tag in one is a tag on
# the page (CD-54). build.py refuses one in the spec harvest; verify.py holds
# every text column of every table to it. A wikitext link's bracket is
# WIKILINK's, below.
MARKUP = re.compile(r"<\s*/?\s*[A-Za-z][A-Za-z0-9]*(\s[^<>]*)?/?\s*>|<!--"
                    r"|&[A-Za-z]+;|&#[0-9]+;|&#x[0-9A-Fa-f]+;")

# A wikitext link's bracket, left in a value by a harvest that did not pair
# it (CR-76): "Petronas E10Aramco]] branding" in a car's fuel, "Harry Pot for
# Anefo ]]" in a photograph's credit, printed as written on the page. The
# spec harvest's reader (build.py's _plain()) and the credit rule
# (clean_credit below) remove one, and verify.py holds every text column to
# it.
# MARKUP's sibling rather than part of it, because a JSON value may hold
# "]]" as its own syntax - the geometry overlay's coordinates do, in a merged
# local copy - and verify.py exempts a value that parses as JSON.
WIKILINK = re.compile(r"\[\[|\]\]")


def load_car_specs():
    """The Wikipedia infobox harvest, keyed by the file's own column names."""
    return _read_named(SPECS_FILE, "tools/wikispec_fetch.py")


def load_article_images():
    """The Commons lead-image references and their attribution.

    Every row is a licence obligation, not a decoration: where a file's
    licence requires attribution, the artist line travels with it or the row
    was refused at harvest time.
    """
    return _read_named(IMAGES_FILE, "tools/wikimedia_images.py")


def load_category_images():
    """The Commons-category photographs of chassis no article describes.

    The same licence obligation as load_article_images(), on a weaker claim:
    a Commons editor filed the file under a category named for the chassis.
    The build holds these rows at 'catalogued'.
    """
    return _read_named(CATEGORY_IMAGES_FILE,
                       "tools/wikimedia_images.py --route category")


def load_circuit_images():
    """The aerial photograph of each circuit whose article carries one
    (VD-61): the same licence obligation as load_article_images(), keyed on
    the circuit. See CIRCUIT_PHOTOGRAPH below for which file qualifies."""
    return _read_named(CIRCUIT_IMAGES_FILE,
                       "tools/wikimedia_images.py --route circuit")


# =====================================================================
# Circuit articles (harvest/circuit_articles.txt, VD-47)
#
# Which Wikipedia article describes each circuit, read from the List of
# Formula One circuits by tools/circuit_articles.py and matched on country,
# seasons and races held - never on the name. build.py loads it into
# circuits.article and circuits.article_section (VD-61), and verify.py
# cross-checks every row against the register and the loaded columns against
# the file. What follows are the declared exceptions the harvest and the
# check both read.
# =====================================================================

# One list row that this register holds as several circuits. The list's
# Nurburgring row covers 1951-2020 and 41 races: the Nordschleife's 22 and
# the GP-Strecke's 19. Wikipedia has one article for both - "Nurburgring
# Nordschleife" redirects into a section of it - so both map to it, and the
# check compares the row with the union of their seasons and the sum of
# their races, never with either alone.
CIRCUIT_ARTICLE_SPLITS = [
    ("nordschleife", "nurburgring-gp"),
]

# A country the list names by the state of the day, and the register's
# country for the same ground. Not a COUNTRY_ALIASES entry: that is a
# spelling of a registry country, and West Germany is not one.
HISTORIC_COUNTRIES = {
    "West Germany": "Germany",     # AVUS, 1959
}

# A circuit no source maps to an article, and the known_gaps key that says
# why. verify.py fails on a circuit that is neither mapped nor named here,
# unless it has races and every one of them postdates the list read - a new
# venue, which the next harvest reaches. A circuit with no race at all, like
# this one, has no such excuse.
CIRCUIT_ARTICLE_GAPS = {
    "nurburgring-sudschleife": "circuit-article-sudschleife",
}

# An admitted Wikidata id (data/circuits.py WIKIDATA_CIRCUITS) that is known
# to be wrong, and the issue that will correct it. The article check compares
# each mapped article's Wikidata entity with the admitted one; a declared
# disagreement holds the article to the right id instead, so the row keeps an
# independent check until the admission is corrected. verify.py fails on a
# declaration that no longer matches what data/circuits.py admits, so the fix
# deletes its line here too.
#
# Empty since PM-63 (#727): Long Beach had been admitted as Q16739, which is
# the CITY, with the circuit's own OSM relation - so the length check, which
# measures the relation and not the entity, passed it. The circuit is
# Q173889, the entity its article carries.
CIRCUIT_WIKIDATA_WRONG = {
    # circuit_id: (the admitted id, which is wrong; the article's, which is right)
}


# A mapped row whose article is not the circuit's, and why, so that the
# circuit route of tools/wikimedia_images.py takes no photograph from it. A
# photograph of the wrong place under the circuit's name is what the ruling
# of 2026-09-24 exists to prevent. The three rows that link a SECTION of a
# larger article - Fair Park, the Bugatti Circuit, Zeltweg Air Base - need
# no line here: `section` already says so, and the route refuses every one.
# verify.py fails on a line here that no longer names a mapped circuit.
CIRCUIT_ARTICLE_NOT_THE_CIRCUIT = {
    "caesars-palace": "the list links the race, Caesars Palace Grand Prix, "
                      "and not an article about the circuit",
}

# Which body image of a circuit's article stands for the circuit (VD-61,
# ruled 2026-09-30): a JPEG whose file name names the circuit and says one of
# these words - an aerial or satellite photograph, which shows the whole
# circuit. Nothing else. The article's lead image is a track map beside the
# outline the circuit page already draws; any other named body JPEG picks
# cars, a music festival, a statue and a road car. A circuit with no such
# file has no photograph, which fails closed. The harvest applies it, the
# build refuses a row that breaks it, and verify.py re-applies it.
CIRCUIT_PHOTOGRAPH = re.compile(r"skysat|aerial|luftaufnahme", re.I)
CIRCUIT_PHOTOGRAPH_SUFFIX = (".jpg", ".jpeg")

# A file whose own name carries a copyright mark is refused on the circuit
# route, whatever its licence says. `Luftaufnahme (c)Red Bull Ring.jpg` is
# uploaded as its uploader's own work under CC BY-SA 4.0 while its
# description says "(c) Red Bull Ring", with no permission ticket: the grant
# is in doubt, and a reference that states a licence to every reader of this
# database is not the place to settle it (VD-61 review). Refusing fails
# closed, as the GFDL Nurburgring file's missing author does.
CIRCUIT_PHOTOGRAPH_MARKED = re.compile(r"\(c\)|\u00a9", re.I)

# What "names the circuit" may be named BY: the article's title, the list's
# link text, the register's name and official name - but only a form that
# names a venue rather than a place. A third of the register's short names
# are the town, the suburb or the hill (Long Beach, Sebring, Kyalami,
# Montjuic), and "Long Beach aerial view.jpg" is the city. A form counts when
# it carries one of these words, or is one of the one-word -ring names in
# CIRCUIT_RING_NAMES - listed, because a word ending in -ring is as often a
# town: Sebring is one. "Park" stays: every such name in the register is a circuit's
# (Istanbul Park, Donington Park), Albert Park's included, whose roads are
# the circuit. A circuit none of whose forms counts (AVUS, Rouen-les-Essarts)
# takes no photograph, which fails closed.
CIRCUIT_VENUE_WORD = re.compile(
    r"\b(circuit|circuito|autodromo|autodrom|autodrome|speedway|raceway|"
    r"racing course|international|park|ring)\b", re.I)
CIRCUIT_RING_NAMES = {"hungaroring", "hockenheimring", "nurburgring",
                      "madring"}


def _fold(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c))


def circuit_name_forms(article, linked_as, name, official_name):
    """The names a circuit's photograph may be named by, in a stable order:
    those of the four that name a venue (CIRCUIT_VENUE_WORD)."""
    out = []
    for f in (article, (linked_as or "").split("#")[0], name, official_name):
        if f and f not in out and (CIRCUIT_VENUE_WORD.search(_fold(f))
                                   or _fold(f).lower() in CIRCUIT_RING_NAMES):
            out.append(f)
    return out


def circuit_file_names(file_name, forms):
    """Does the file name hold one of `forms`, letters and digits only? The
    build's and verify.py's test, looser than the harvest's word-boundary
    one, so it is a second route to the same answer."""
    def alnum(s):
        return re.sub(r"[^a-z0-9]", "", _fold(s).lower())
    have = alnum(file_name)
    return any(alnum(f) and alnum(f) in have for f in forms)


# =====================================================================
# Race photographs (harvest/race_images.txt, PD-64)
#
# The race page showed the lead photograph of each car that entered, which
# is a photograph of the car taken wherever it was taken - a launch, a
# museum, another race - on a page a reader takes to be about one
# afternoon. Wikimedia Commons keeps a category per Grand Prix, and the
# race route of tools/wikimedia_images.py takes its photographs from that.
# The rules are here, once, because the harvest applies them, the build
# refuses a row that breaks them and verify.py re-applies them from the
# database.
# =====================================================================

def race_category(year, name_used):
    """The Commons category a race's photographs are taken from: the season
    and the name the race was run under, exactly - `Category:1967 Dutch
    Grand Prix`. Matched from the race and never chosen per file, so a race
    whose category Commons spells otherwise (`São Paulo` for the register's
    `Sao Paulo`) has none, which fails closed."""
    return f"Category:{year} {name_used}"


def race_category_parents(year):
    """Check b of the race route: a visible parent that files the category
    as that season's Formula One. Commons uses both forms. A category filed
    under another season's races - `1994 Monaco Grand Prix` sits in `1995
    Formula One races` - is refused rather than corrected here."""
    return (f"Category:{year} Formula One races",
            f"Category:{year} in Formula One")


# A photograph or nothing: Commons race categories also hold PDFs of the
# FIA's documents, PNG maps and logos, and SVG flags. The circuit route's
# suffixes, for the circuit route's reason.
RACE_PHOTOGRAPH_SUFFIX = (".jpg", ".jpeg")

# The circuit route's copyright-mark refusal applies here unchanged, for its
# reason: a file whose own name says (c) or carries the sign has a grant in
# doubt whatever licence its uploader stated, and a reference that states a
# licence to every reader is not the place to settle it. One pattern, so the
# two routes cannot come to disagree about what a mark is.
RACE_PHOTOGRAPH_MARKED = CIRCUIT_PHOTOGRAPH_MARKED

# The narrowing rules: a file whose name says it was not taken at the race.
# A race's category holds what its editors filed there, and the first full
# run took the winner's trophy photographed in a private collection in
# 2019, the same race's ticket, a track map and a museum's pace car - each
# of the race, none from it. A heading that says "from this race" over them
# is the defect PD-64 was filed about, so they are passed over. As on the
# category route (REPLICA), this narrows; it is not a check that the rest
# were taken there. A real podium photograph that names its trophy is lost
# with them, which fails closed.
# Trophy, ticket and museum match inside a word as well - a file name run
# together, "1988F1JapaneseGrandPrixWinnerTrophyHCH", still says it. The
# second run's review added the Indianapolis 500's own kind: the winning car
# in the Speedway's museum ("Indy500winningcar1956", "... 1950 Indy 500
# Winner - Johnnie Parsons") and the pace car at a show decades later, which
# had left every photograph of four of its races a museum or show shot; and
# documents rather than photographs - a lap chart (Rundentabelle), a
# magazine cover, a German ticket (Eintrittskarte).
RACE_PHOTOGRAPH_ELSEWHERE = re.compile(
    r"troph|ticket|museum|museo|eintrittskarte|rundentabelle|"
    r"winning ?car|indy ?500 winner|pace ?car|lap ?chart|"
    r"\b(collections?|exhibitions?|posters?|programmes?|stamps?|covers?|"
    r"(track)?maps?|replicas?|models?|diecast|die-cast|lego)\b", re.I)

# Two files that are one photograph: "X.jpg" and "X (cropped).jpg", or "X
# (cropped2).jpg" and "X restored.jpg" beside them. race_twin_key() is what
# they share, and a race keeps one of them - the first derivative by title,
# an editor's framing of the subject, or the original where there is none.
_TWIN_TAIL = re.compile(
    r"(\s*\(\s*(cropped|crop|restored|retouched|edited)\s*\d*\s*\)"
    r"|[\s_-]+(cropped|crop|restored|retouched|edited)\d*)+$", re.I)


def race_twin_key(file_name):
    """The photograph a file is a version of: its name without the extension
    and without a trailing crop, restoration or edit marker, folded."""
    base = re.sub(r"\.[A-Za-z0-9]+$", "", file_name.removeprefix("File:"))
    return _TWIN_TAIL.sub("", base).strip().lower()


# A credit line is what the page shows beside the photograph, and Commons
# sometimes puts its own boilerplate in the field it is read from: "Own
# work", or the opening of its licence sentence, "I, the copyright holder of
# this work, hereby publish it ...". Shown alone, either credits nobody.
# Every route's harvest reads such a field as empty (clean_credit), so the
# other field speaks or the file is refused for naming nobody; build.py and
# verify.py refuse a row whose shown credit is boilerplate.
CREDIT_BOILERPLATE = re.compile(
    r"^\s*(own work|i,? the copyright holder of this work\b.*)\s*$", re.I)

# Three more ways a field names nobody, or names somebody inside something
# else (CR-70, ruled 2026-10-05):
#
# A licence paragraph. An uploader can write the whole licence into the
# author field - "Kolforn ( Kolforn ) I'd appreciate if you could mail me
# ... This file is licensed under the Creative Commons Attribution-Share
# Alike 4.0 International license. You are free: ..." - and a page that
# shows the field prints a paragraph as the credit. The field is cut to the
# name: the text before the licence, up to its first bracket. The file page
# the credit line links keeps the full terms and any request readable; the
# licence link shows as for every photograph.
CREDIT_LICENCE = re.compile(
    r"\bthis (file|work|image|photograph) is licensed under\b"
    r"|\byou are free\s*:", re.I)

# Commons' unknown-author value, as its templates render it ("Unknown author
# Unknown author", "Anonymous Unknown author", "Unknown photographer"), names
# nobody. Where the credit field names the source - El Grafico, Corsa, a
# newspaper - the artist field is read as empty so that source is shown with
# the public-domain mark. Where the credit names nobody either, the artist
# stays: refusing the file was ruled out, and there is nothing better to show.
# The other languages' word for it as Commons' Italian, Spanish, French,
# German and Dutch uploads write it alone in a field ("sconosciuta").
CREDIT_UNKNOWN = re.compile(
    r"^\s*(template:\s*)?(anonymous\s+)?"
    r"(unknown\s+(author|photographer|photograph|source)\s*)+$"
    r"|^\s*(anonymous|unknown)\s*$"
    r"|^\s*((autore|autor|auteur|fotografo|fot[oó]grafo)\s+)?"
    r"(sconosciut[oa]|ignot[oa]|desconocid[oa]|inconnue?|unbekannt|onbekend)"
    r"\s*\.?\s*$", re.I)

# A footnote marker left where the source should be ("[2]"): names nobody.
CREDIT_REFERENCE = re.compile(r"^\s*\[\d+\]\s*$")

# A credit field that says only how the file reached Commons, or keeps the
# text of a link whose address was lost: "Transferred from it.wikipedia to
# Commons.", "here". Names nobody (CR-70 review). A transfer note followed
# by its original source - "Transferred from it.wikipedia La Stampa del
# 12-09-1976" - names one, and is not matched.
CREDIT_NOBODY = re.compile(
    r"^\s*(here|transferr?ed from \S+( to commons)?)\s*\.?\s*$", re.I)


def credit_without_licence(text):
    """A credit field cut to the name before any licence paragraph in it, or
    None where nothing comes before it. A field with no licence paragraph is
    returned as it is."""
    if not text:
        return text
    m = CREDIT_LICENCE.search(text)
    if not m:
        return text
    name = text[:m.start()].split("(", 1)[0].strip(" \t.,;:-\u2013\u2014")
    return name or None


def credit_without_link_residue(text):
    """A credit field without the wikitext link brackets Commons' own page
    left unpaired (WIKILINK, CR-76), or None where nothing else is left.
    Commons renders "Harry Pot for Anefo ]] / neg. stroken, ..." with the
    stray "]]" as written; the credit is the rest of it. A field with no such
    bracket is returned as it is."""
    if not text or not WIKILINK.search(text):
        return text
    return " ".join(WIKILINK.sub(" ", text).split()) or None


def credit_names_somebody(text):
    """Does a credit field, shown alone, name a person or a source? A bare
    URL does: a link is an acceptable CC BY credit (CR-70)."""
    return bool(text and text.strip()
                and not CREDIT_BOILERPLATE.match(text)
                and not CREDIT_UNKNOWN.match(text)
                and not CREDIT_REFERENCE.match(text)
                and not CREDIT_NOBODY.match(text)
                and not CREDIT_LICENCE.search(text))


def clean_credit(artist, credit):
    """(artist, credit) as every route's harvest stores them, given the two
    fields as Commons answered them: an unpaired wikitext link bracket
    removed, a licence paragraph cut to the name, boilerplate read as empty,
    and the unknown-author value read as empty where the credit names
    somebody. A field no rule touches comes back as it went in, so a stored
    row is its own image under this function, which is what build.py and
    verify.py hold it to."""
    artist = credit_without_licence(credit_without_link_residue(artist))
    credit = credit_without_licence(credit_without_link_residue(credit))
    if artist and CREDIT_BOILERPLATE.match(artist):
        artist = None
    if credit and CREDIT_BOILERPLATE.match(credit):
        credit = None
    if artist and CREDIT_UNKNOWN.match(artist) and credit_names_somebody(credit):
        artist = None
    return artist, credit


def credit_shown(artist, credit):
    """The credit a page shows: web/src/lib/commons.js attribution(), which
    takes the artist and falls back to the credit."""
    return (artist or "").strip() or (credit or "").strip() or None


# A credit that says the file was uploaded on somebody else's permission is
# a grant in doubt unless a permission ticket stands behind it, and nothing
# here reads tickets: the copyright-mark rule's reasoning, applied to the
# credit rather than the name. The review of the race route found one, a
# team's livery image "uploaded with permission given by original author".
CREDIT_PERMISSION = re.compile(r"\bpermission\b", re.I)

# A season named in a file's name, whole: not inside a longer run of digits,
# so an archive's reference number or a Flickr id names none.
_SEASON_IN_NAME = re.compile(r"(?<![0-9])((?:19|20)[0-9]{2})(?![0-9])")


def race_file_names_another_season(file_name, year):
    """Does the file's name name a season that is not the race's? "Clay
    Regazzoni 1975 Watkins Glen" filed under the 1974 race, or a trophy
    "2019 Michael Schumacher Private Collection" under the 1995 one, was
    photographed another year. An archive caption that names the year it was
    donated is lost with them, which fails closed."""
    return any(int(y) != int(year) for y in _SEASON_IN_NAME.findall(file_name))

# How many photographs a race keeps. The strip draws six (PHOTOGRAPHS_SHOWN
# in web/src/lib/site.js) and the rest sit behind a disclosure, so twelve is
# six more than the strip, not a figure about Commons: the largest category
# holds 669 files and the median seven, and f1.db travels to every reader's
# browser whole. The page links the category for the rest.
RACE_PHOTOGRAPHS_KEPT = 12


def load_race_images():
    """The photographs filed under each race's Commons category (PD-64): the
    same licence obligation as load_article_images(), keyed on the season and
    round, held at 'catalogued' because the claim is a Commons editor's
    filing."""
    return _read_named(RACE_IMAGES_FILE,
                       "tools/wikimedia_images.py --route race")


def load_circuit_articles():
    """circuit_id, article, section, linked_as, wikidata_id, country,
    seasons, held, as_of, source - by the file's own header."""
    return _read_named(CIRCUIT_ARTICLES_FILE, "tools/circuit_articles.py")


def load_race_results():
    """The full classification, 1950-2026, from F1DB.

    CC BY 4.0 - attribution only. That is the whole reason these rows are in
    the repository rather than only on a local copy: the same facts via
    Jolpica are CC BY-NC-SA, and a non-commercial clause is why known_gaps #2
    stood for seven versions.
    """
    return _read_named(RESULTS_FILE, "tools/f1db_fetch.py")


def load_sprint_results():
    """The sprint race classification, 2021-2026, from F1DB.

    A sprint is a separate race on the grand prix weekend with its own grid,
    its own classification and its own points, and those points count towards
    the championship. Same licence and same source file tree as the grand
    prix results beside it.
    """
    return _read_named(SPRINT_FILE, "tools/f1db_fetch.py")


def load_qualifying():
    """Qualifying results, 1950-2026, from F1DB."""
    return _read_named(QUALIFYING_FILE, "tools/f1db_fetch.py")


def load_practice():
    """Every practice, warm-up and pre-qualifying classification, 1977-2026, from F1DB (LV-03)."""
    return _read_named(PRACTICE_FILE, "tools/f1db_fetch.py")


def load_sprint_qualifying():
    """Sprint qualifying and the 2023 sprint shootout, from F1DB (LV-03)."""
    return _read_named(SPRINT_QUALIFYING_FILE, "tools/f1db_fetch.py")


def load_standings():
    """Championship standings after every round, and at season end."""
    return _read_named(STANDINGS_FILE, "tools/f1db_fetch.py")


def load_f1db_pit_stops():
    """Pit stops from F1DB. Distinct from the FastF1 and Jolpica loads, which
    write the same table under their own `source`, so the three can be
    compared rather than overwriting one another."""
    return _read_named(F1DB_PITS_FILE, "tools/f1db_fetch.py")


def load_race_dates():
    """The day each race was held, 1950-2026, from F1DB.

    1,149 of 1,172 races had no date before this: the value sits in the
    round's own race.yml and the results loader only ever read
    race-results.yml beside it. A race that has been run has a date, and
    verify.py now says so.
    """
    return _read_named(RACE_DATES_FILE, "tools/f1db_fetch.py")


def load_fastest_laps():
    """The fastest lap of each race, 1950-2026, from F1DB.

    A second source for a fact the hand-written pole harvest already carries,
    and deliberately subordinate to it: build.py fills only where the harvest
    is silent, which is the week after each Grand Prix, and records a
    discrepancy rather than choosing where the two disagree.
    """
    return _read_named(FASTEST_LAPS_FILE, "tools/f1db_fetch.py")


def load_circuit_outlines():
    """F1DB's drawing of every circuit layout: one SVG path per layout id.

    A drawing, not a measurement - no scale, no position, no direction - and
    a different fact from the OpenStreetMap trace load_circuit_geometry()
    returns. CC BY 4.0, so unlike the trace it may live in f1.db. The circuit
    id on each row is F1DB's, which differs from this register's for ten
    venues; build.py derives the register's from the races that ran the
    layout and never reads it from here.
    """
    return _read_named(OUTLINES_FILE, "tools/f1db_fetch.py")


def load_race_layouts():
    """The F1DB layout id each race ran, keyed by year and round."""
    return _read_named(RACE_LAYOUTS_FILE, "tools/f1db_fetch.py")


def load_circuit_geometry():
    """Circuit centrelines from OpenStreetMap, already length-checked.

    The check is re-run in build.py against the length this database holds,
    because a harvest file is an input like any other and the constraint
    belongs where the row is admitted, not only where it was written.
    """
    return _read_named(GEOMETRY_FILE, "tools/osm_geometry.py")
