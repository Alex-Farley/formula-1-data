# -*- coding: utf-8 -*-
"""
Podium finishers, 1950-2026, from the Jolpica-F1 API (the maintained
successor to Ergast).

WHY A SECOND SOURCE
    Everything else in this database was harvested from Wikipedia. The
    finishing order could not be: the season standings grid left-packs its
    cells, so a driver who missed a round has every later result shifted one
    column, and the winner cross-check does not catch it. A trial of 1976 put
    Hasemi's round-16 result in round 1 and still passed. Jolpica returns the
    classification as structured JSON - position, grid, laps, retirement
    cause, points - so there is nothing to misread.

WHAT IS HERE, AND WHAT IS NOT
    Second and third places only. The full field is 26,137 rows and the API
    returns about 100 per request, so the complete finishing order is a job
    for a script run locally against the same API, not for this build. Second
    and third are what turn a race-winner database into one that can answer
    questions about podiums, and they are complete for P2.

HOW IT IS CHECKED
    The winner is already known for all 1,161 races, so a P2 or P3 row can be
    rejected if it claims a position the winner already holds, or if its race
    does not exist. Beyond that, the derived podium counts are reconciled
    against the podium figures held on 38 drivers from their official pages -
    which is the real test, and the one that would expose a systematic error.

This module holds the REGISTER and the ID MAPPING only. The result rows
themselves are fetched and written by tools/ergast_load.py, which talks to
the API directly. There is deliberately no harvest file for them: an earlier
attempt to relay these rows through one, by hand, put fabricated results into
four of five sampled 2008 rows before the podium reconciliation caught it.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PODIUMS_FILE = os.path.join(HERE, "..", "harvest", "podiums.txt")
SOURCE = "https://api.jolpi.ca/ergast/f1/{year}/results/"
CONFIDENCE = "reference"

# ---------------------------------------------------------------------
# Jolpica driver ids that surname matching cannot resolve, because this
# database holds more than one driver with that surname. Jolpica uses the
# bare surname for whichever of them is best known and qualifies the others.
# ---------------------------------------------------------------------
DRIVER_ALIASES = {
    "hill": "g-hill",              # Graham; phil_hill and damon_hill are qualified
    "phil_hill": "p-hill",
    "damon_hill": "d-hill",
    "rosberg": "n-rosberg",        # Nico; Keke is keke_rosberg
    "keke_rosberg": "k-rosberg",
    "senna": "senna",              # Ayrton; Bruno is bruno_senna
    "villeneuve": "villeneuve-j",  # Jacques; Gilles is gilles_villeneuve
    "gilles_villeneuve": "villeneuve-g",
    "rathmann": "rathmann",        # Jim; Dick Rathmann is rathmann-d
    # Name order, not ambiguity. This register lists him family name first,
    # as he is usually written, so the surname index holds "guanyu" and a
    # source saying "Guanyu Zhou" finds nothing. Declared rather than fixed
    # by matching names order-insensitively, which would start joining
    # genuinely different people.
    "zhou": "zhou",
    # Spelling differences between Jolpica and the F1DB-derived register.
    # Each was checked against the seasons and entries the two agree on, not
    # guessed from the surname.
    "crossley": "geoffrey-crossley",        # "Geoff" / "Geoffrey"
    "fontes": "asdrubal-fontes-bayardo",    # Jolpica drops the second surname
    "jerry_unser": "jerry-unser-jr",        # the Jr. is in the register name
    "papis": "max-papis",                   # "Massimiliano" / "Max"
    "ahrens": "kurt-ahrens-jr",             # the Jr. again
    "graffenried": "emmanuel-de-graffenried",   # "Toulo" was his nickname
    "montagny": "franck-montagny",
    "aitken": "jack-aitken",
    # Jolpica records this driver's forename against another driver's
    # surname - "Boy Lunger", conflating Boy Hayje with Brett Lunger. F1DB,
    # the entry lists and the race records all say Boy Hayje.
    "hayje": "boy-hayje",
    # Two sources, two forms of the same person's name. Each was checked
    # against the seasons and entries the two agree on.
    "zanardi": "alex-zanardi",              # "Alessandro" / "Alex"
    "tomaso": "alejandro-de-tomaso",        # "Alessandro" / "Alejandro"
    "ramos": "hermano-da-silva-ramos",      # "Hernando" / "Hermano"
    "webb": "spider-webb",                  # "Travis" / his racing name
}

# Jolpica drivers this register does not hold, with the reason. Jolpica
# records a championship entry for each; F1DB holds no such driver at all,
# and the register is built from F1DB. Neither source can be checked against
# an official entry list here, so the disagreement is declared rather than
# resolved by inventing a driver - which is the one thing the loader must
# never do. 14 drivers, 60-odd rows, all of them 1950s and 1960s entries or
# non-starters.
DRIVER_NON_MAPPING = {
    "abate": "Carlo Abate", "bira": "Prince Bira", "blignaut": "Alex Blignaut",
    "boffa": "Menato Boffa", "clapham": "David Clapham", "duke": "Geoff Duke",
    "hocking": "Gary Hocking", "ken_miles": "Ken Miles",
    "monarch": "Thomas Monarch", "monteverdi": "Peter Monteverdi",
    "reed": "Ray Reed", "slotemaker": "Rob Slotemaker", "vos": "Ernie de Vos",
    "vyver": "Syd van der Vyver",
}

# ---------------------------------------------------------------------
# Constructors. Most resolve on name; these do not.
# ---------------------------------------------------------------------
CONSTRUCTOR_ALIASES = {
    "alfa": "alfa-romeo",
    # Teams the constructor register gained from F1DB, under the spelling
    # Jolpica uses. Verified against the seasons each id actually appears in
    # rather than assumed from the name.
    "behra-porsche": "behra-porsche",   # would otherwise split at the hyphen
    "lambo": "modena",                  # 1991; the team raced as Lambo
    "lotus_racing": "caterham",         # 2010-11, before the Caterham name
    "manor": "virgin",                  # 2015-16
    "marussia": "virgin",               # 2012-14
    "mf1": "midland",                   # 2006
    "spyker_mf1": "midland",            # also 2006, after Spyker bought in
    "moda": "andrea-moda",              # 1992
    "simca": "simca-gordini",           # 1950-53
    "tomaso": "de-tomaso",              # 1963 and 1970
    "arzani-volpini": "arzani-volpini",  # would split at the hyphen
    "butterworth": "aston-butterworth",  # Jolpica drops the "Aston"
    "derrington": "derrington-francis",  # and the "Francis"
    "tec-mec": "tec-mec",                # would split at the hyphen
    "prost": "prost-gp",
    "stewart": "stewart-gp",
    "team_lotus": "lotus",
    "lotus_f1": "lotus-f1",
    "toro_rosso": "toro-rosso",
    "red_bull": "red-bull",
    "bmw_sauber": "bmw-sauber",
    "force_india": "force-india",
    "racing_point": "racing-point",
    "aston_martin": "aston-martin",
    "virgin": "virgin",
    "rb": "racing-bulls",        # Racing Bulls, ex-AlphaTauri
    "honda": "honda-works",      # the works team, not the engine supplier
    "surtees": "surtees-team",
}

# Indianapolis 500 chassis builders. The 500 counted towards the
# championship from 1950 to 1960 and its entries were not Formula One
# constructors, so these rows are stored with no constructor rather than
# inventing one - the same rule data/harvest.py already applies to the
# Indy winners.
INDY_CHASSIS = {
    "kurtis_kraft", "kuzma", "deidt", "epperly", "watson", "lesovsky",
    "phillips", "sherman", "schroeder", "moore", "pawl", "hall", "bromme",
    "trevis", "marchese", "salih", "stevens", "wetteroth", "adams",
    "langley", "rae", "olson", "nichels", "christensen", "dunn", "meskowski",
    "ewing", "elder", "sutton",
    # 1953 Indianapolis entries, the same case as the rest of this set.
    "turner", "del_roy", "pankratz", "snowberger",
    # Jolpica's own spelling of Christensen, which is already in this set.
    "vhristensen",
}

# Constructors that appear on a podium but are not yet in the register.
# id, name, full_name, base, first_entry, nationality, notes, confidence
NEW_CONSTRUCTORS = [
    ("lago", "Talbot-Lago", "Automobiles Talbot-Darracq", "Suresnes, France",
     1950, "French",
     "Ran the pre-war T26C through the early 1950s. Its naturally aspirated "
     "4.5-litre engine was slower than the supercharged Alfas but drank far "
     "less, so a Talbot could sometimes run a race non-stop while the "
     "front-runners refuelled twice. Rosier won Spa in 1950 that way.",
     "medium"),
    ("gordini", "Gordini", "Equipe Gordini", "Paris, France", 1950, "French",
     "Amedee Gordini's small team, chronically underfunded and known as "
     "'le sorcier' for extracting results from very little money.", "medium"),
    ("connaught", "Connaught", "Connaught Engineering", "Send, Surrey, UK",
     1952, "British",
     "British constructor whose Type B gave Britain one of its first "
     "significant Grand Prix results at Syracuse in 1955.", "medium"),
    ("lola", "Lola", "Lola Cars", "Huntingdon, UK", 1962, "British",
     "Eric Broadley's constructor, better known for sports and Indycars. "
     "Its 1962 Formula One car was run by the Bowmaker team for John "
     "Surtees, and the Lola name reappeared as a chassis supplier for "
     "decades afterwards.", "medium"),
    ("fittipaldi", "Fittipaldi", "Fittipaldi Automotive", "Sao Paulo, Brazil",
     1975, "Brazilian",
     "Emerson Fittipaldi left McLaren as a double champion to drive for his "
     "brother Wilson's team. It never won a race and the decision is usually "
     "read as the one that ended his career at the front.", "medium"),
    ("larrousse", "Larrousse", "Larrousse F1", "Antony, France", 1987,
     "French",
     "Gerard Larrousse's team, which took a surprise podium at Suzuka in "
     "1990 with Aguri Suzuki - the first by a Japanese driver.", "medium"),
    ("leyton", "Leyton House", "Leyton House Racing", "Bicester, UK", 1990,
     "British",
     "The renamed March team, running Adrian Newey's designs. Ivan Capelli "
     "led the 1990 French Grand Prix until nine laps from the end.", "medium"),
    ("onyx", "Onyx", "Onyx Grand Prix", "Littlehampton, UK", 1989, "British",
     "Lasted a season and a half and took one podium, Johansson's third at "
     "Estoril in 1989.", "medium"),
    ("dallara", "Dallara", "BMS Scuderia Italia", "Varano de' Melegari, Italy",
     1988, "Italian",
     "Better known now as a supplier of chassis to other series; ran its own "
     "Formula One entry through Scuderia Italia, taking two podiums.",
     "medium"),
    ("footwork", "Footwork", "Footwork Arrows", "Milton Keynes, UK", 1991,
     "British",
     "Arrows under its Japanese owner's name from 1991 to 1996. Held here as "
     "a separate register entry because that is how the results were "
     "published; it is the same operation as Arrows.", "medium"),
]


# ---------------------------------------------------------------------
# The same constructors in the F1DB register, for the reason given against
# PODIUM_ONLY_F1DB below: these ten rows cited Jolpica, and the marques are
# all in F1DB under CC BY 4.0. Checked on every build by name rather than by
# date - a constructor has no date of birth - so the assertion is weaker than
# the drivers' and is stated as what it is.
#
# The prose in NEW_CONSTRUCTORS was written for this project and is not
# affected either way.
# ---------------------------------------------------------------------
PODIUM_ONLY_CONSTRUCTORS_F1DB = {
    'lago': 'talbot-lago',
    'gordini': 'gordini',
    'connaught': 'connaught',
    'lola': 'lola',
    'fittipaldi': 'fittipaldi',
    'larrousse': 'larrousse',
    'leyton': 'leyton-house',
    'onyx': 'onyx',
    'dallara': 'dallara',
    'footwork': 'footwork',
}


# Jolpica constructors this register deliberately does not hold, with the
# reason. Declared so the loader's "not in the register" line stays a list of
# real gaps rather than a list that is always noise.
CONSTRUCTOR_NON_MAPPING = {
    "milano":
        "Jolpica records Scuderia Milano as a constructor for two 1950 "
        "entries. F1DB records the same entries as Scuderia Milano ENTERING "
        "Maseratis, and holds no Milano constructor at all. The two sources "
        "disagree about whether a constructor existed, neither can be "
        "checked against an official 1950 entry list here, and this project "
        "does not pick one silently - so the constructor is not created and "
        "the two entries keep a NULL.",
}


# Jolpica ids whose meaning depends on the season, because one name was two
# constructors. Each entry is (from_year, to_year, target).
#
# These were invisible until the constructor register was extended: the
# earlier entity had no row, so the entries either went nowhere or quietly
# took the later entity's id. verify.py now refuses an entry credited to a
# constructor that was not racing that season, which is what surfaced them.
CONSTRUCTOR_ALIASES_BY_YEAR = {
    # Frank Williams Racing Cars (1975) and Wolf-Williams (1976) are not the
    # Williams that first entered in 1977 - Frank Williams sold out to Walter
    # Wolf and bought his way back with a new company.
    "wolf": [(1976, 1976, "wolf-williams")],
    # Two unrelated teams called ATS: Automobili Turismo e Sport, which
    # entered five races in 1963, and the German wheel manufacturer, which
    # ran from 1978 to 1984. F1DB keeps them as `ats` and `ats-wheels`.
    "ats": [(1978, 1984, "ats-wheels")],
    # Alfa Romeo was a naming-rights partner to Sauber from 2019, not a
    # constructor. The register's own note on `alfa-romeo` says so, and its
    # last entry as a constructor was 1985.
    "alfa": [(2019, 2023, "sauber")],
    # Frank Williams's 1976 entries reach Jolpica under both `williams` and
    # `wolf`; F1DB has the whole season as Wolf-Williams.
    "williams": [(1950, 1975, "frank-williams-racing-cars"),
                 (1976, 1976, "wolf-williams")],
    # A target of None means "deliberately unmapped for these seasons" - the
    # id is real, but not for this era. Jolpica records BMW as a constructor
    # for six 1952-53 entries. F1DB holds a BMW constructor for 1969 only,
    # the 269 that ran the German Grand Prix, and records the 1952-53 cars as
    # Veritas and AFM chassis with BMW ENGINES, which is what an engine
    # supplier is. This register follows F1DB: those six entries keep a NULL
    # rather than being credited to a constructor seventeen years early.
    "bmw": [(1950, 1968, None)],
}


def _resolve_constructor(eid, year=None):
    """Jolpica constructor id -> this database's id, or None.

    None means one of two things, and the loader distinguishes them: an
    Indianapolis chassis builder (correct, no Formula One constructor), or a
    constructor not yet in the register (a gap).

    `year` disambiguates a name that was two different constructors. Without
    it, 1975's Frank Williams entries land on the 1977 Williams and 1976's
    Wolf-Williams on Walter Wolf Racing.
    """
    if eid in INDY_CHASSIS:
        return None
    if year is not None:
        for lo, hi, target in CONSTRUCTOR_ALIASES_BY_YEAR.get(eid, ()):
            if lo <= year <= hi:
                return target          # None = deliberately unmapped here
    if eid in CONSTRUCTOR_ALIASES:
        return CONSTRUCTOR_ALIASES[eid]
    # brabham-alfa_romeo, cooper-climax: chassis first, engine second
    return eid.split("-")[0].replace("_", "-")


# ---------------------------------------------------------------------
# Drivers who reached a podium but never won a race, took pole or set a
# fastest lap, and so were never added to the register by earlier harvests.
# Names, nationalities and dates of birth come from the same API as the
# results, so a podium row can never reference a driver this database has
# had to invent.
#
#   local_id, jolpica_id, full_name, nationality, code, born
# ---------------------------------------------------------------------
PODIUM_ONLY_DRIVERS = [
    ('allison', 'allison', 'Cliff Allison', 'United Kingdom', 'GBR', '1932-02-08'),
    ('amick', 'george_amick', 'George Amick', 'United States', 'USA', '1924-10-24'),
    ('anderson', 'anderson', 'Bob Anderson', 'United Kingdom', 'GBR', '1931-05-19'),
    ('arundell', 'arundell', 'Peter Arundell', 'United Kingdom', 'GBR', '1933-11-08'),
    ('ayulo', 'ayulo', 'Manny Ayulo', 'United States', 'USA', '1921-10-20'),
    ('bernard', 'bernard', 'Éric Bernard', 'France', 'FRA', '1964-08-24'),
    ('blundell', 'blundell', 'Mark Blundell', 'United Kingdom', 'GBR', '1966-04-08'),
    ('bonetto', 'bonetto', 'Felice Bonetto', 'Italy', 'ITA', '1903-06-09'),
    ('boyd', 'boyd', 'Johnny Boyd', 'United States', 'USA', '1926-08-19'),
    ('brundle', 'brundle', 'Martin Brundle', 'United Kingdom', 'GBR', '1959-06-01'),
    ('capelli', 'capelli', 'Ivan Capelli', 'Italy', 'ITA', '1963-05-24'),
    ('carter', 'darter', 'Duane Carter', 'United States', 'USA', '1913-05-05'),
    ('cheever', 'cheever', 'Eddie Cheever', 'United States', 'USA', '1958-01-10'),
    ('chiron', 'chiron', 'Louis Chiron', 'Monaco', 'MON', '1899-08-03'),
    ('courage', 'courage', 'Piers Courage', 'United Kingdom', 'GBR', '1942-05-27'),
    ('cross', 'cross', 'Art Cross', 'United States', 'USA', '1918-01-24'),
    ('davies', 'davies', 'Jimmy Davies', 'United States', 'USA', '1929-08-08'),
    ('de-portago', 'portago', 'Alfonso de Portago', 'Spain', 'ESP', '1928-10-11'),
    ('donohue', 'donohue', 'Mark Donohue', 'United States', 'USA', '1937-03-18'),
    ('fischer', 'fischer', 'Rudi Fischer', 'Switzerland', 'SUI', '1912-04-19'),
    ('flockhart', 'flockhart', 'Ron Flockhart', 'United Kingdom', 'GBR', '1923-06-16'),
    ('follmer', 'follmer', 'George Follmer', 'United States', 'USA', '1934-01-27'),
    ('freeland', 'freeland', 'Don Freeland', 'United States', 'USA', '1925-03-25'),
    ('frere', 'frere', 'Paul Frère', 'Belgium', 'BEL', '1917-01-30'),
    ('gendebien', 'gendebien', 'Olivier Gendebien', 'Belgium', 'BEL', '1924-01-12'),
    ('goldsmith', 'goldsmith', 'Paul Goldsmith', 'United States', 'USA', '1925-10-02'),
    ('gregory', 'gregory', 'Masten Gregory', 'United States', 'USA', '1932-02-29'),
    ('holland', 'holland', 'Bill Holland', 'United States', 'USA', '1907-12-18'),
    ('jarvilehto', 'lehto', 'Jyrki Järvilehto', 'Finland', 'FIN', '1966-01-31'),
    ('johansson', 'johansson', 'Stefan Johansson', 'Sweden', 'SWE', '1956-09-08'),
    ('larini', 'larini', 'Nicola Larini', 'Italy', 'ITA', '1964-03-19'),
    ('love', 'love', 'John Love', 'Rhodesia', 'RHO', '1924-12-07'),
    ('maggs', 'maggs', 'Tony Maggs', 'South Africa', 'RSA', '1937-02-09'),
    ('maglioli', 'maglioli', 'Umberto Maglioli', 'Italy', 'ITA', '1928-06-05'),
    ('mairesse', 'mairesse', 'Willy Mairesse', 'Belgium', 'BEL', '1928-10-01'),
    ('manzon', 'manzon', 'Robert Manzon', 'France', 'FRA', '1917-04-12'),
    ('menditeguy', 'menditeguy', 'Carlos Menditeguy', 'Argentina', 'ARG', '1914-08-10'),
    ('modena', 'modena', 'Stefano Modena', 'Italy', 'ITA', '1963-05-12'),
    ('monteiro', 'monteiro', 'Tiago Monteiro', 'Portugal', 'POR', '1976-07-24'),
    ('morbidelli', 'morbidelli', 'Gianni Morbidelli', 'Italy', 'ITA', '1968-01-13'),
    ('nazaruk', 'nazaruk', 'Mike Nazaruk', 'United States', 'USA', '1921-10-02'),
    ('parnell', 'reg_parnell', 'Reg Parnell', 'United Kingdom', 'GBR', '1911-07-02'),
    ('perdisa', 'perdisa', 'Cesare Perdisa', 'Italy', 'ITA', '1932-10-21'),
    ('piquet-jr', 'piquet_jr', 'Nelson Piquet Jr.', 'Brazil', 'BRA', '1985-07-25'),
    ('redman', 'redman', 'Brian Redman', 'United Kingdom', 'GBR', '1937-03-09'),
    ('rose', 'rose', 'Mauri Rose', 'United States', 'USA', '1906-05-26'),
    ('rosier', 'rosier', 'Louis Rosier', 'France', 'FRA', '1905-11-05'),
    ('salo', 'salo', 'Mika Salo', 'Finland', 'FIN', '1966-11-30'),
    ('salvadori', 'salvadori', 'Roy Salvadori', 'United Kingdom', 'GBR', '1922-05-12'),
    ('sato', 'sato', 'Takuma Sato', 'Japan', 'JPN', '1977-01-28'),
    ('schell', 'schell', 'Harry Schell', 'United States', 'USA', '1921-06-29'),
    ('schenken', 'schenken', 'Tim Schenken', 'Australia', 'AUS', '1943-09-26'),
    ('serafini', 'serafini', 'Dorino Serafini', 'Italy', 'ITA', '1909-07-22'),
    ('servoz-gavin', 'gavin', 'Johnny Servoz-Gavin', 'France', 'FRA', '1942-01-18'),
    ('spence', 'spence', 'Mike Spence', 'United Kingdom', 'GBR', '1936-12-30'),
    ('stommelen', 'stommelen', 'Rolf Stommelen', 'Germany', 'GER', '1943-07-11'),
    ('streiff', 'streiff', 'Philippe Streiff', 'France', 'FRA', '1955-06-26'),
    ('stuck', 'stuck', 'Hans-Joachim Stuck', 'Germany', 'GER', '1951-01-01'),
    ('suzuki', 'suzuki', 'Aguri Suzuki', 'Japan', 'JPN', '1960-09-08'),
    ('taylor', 'trevor_taylor', 'Trevor Taylor', 'United Kingdom', 'GBR', '1936-12-26'),
    ('whitehead', 'whitehead', 'Peter Whitehead', 'United Kingdom', 'GBR', '1914-11-12'),
    ('wisell', 'wisell', 'Reine Wisell', 'Sweden', 'SWE', '1941-09-30'),
]


# ---------------------------------------------------------------------
# The same drivers in the F1DB register, which is the SOURCE OF RECORD for
# their rows.
#
# WHY THIS MAPPING EXISTS
#     The names and dates above were first read from Jolpica, whose Ergast
#     lineage is CC BY-NC-SA. A non-commercial clause on the committed
#     database is the one licence condition this project will not carry - it
#     is what kept the full classification out of the build for seven
#     versions, until v2.15 found the same facts in F1DB under CC BY 4.0.
#     These sixty-two rows were the residue of that switch: the last rows in
#     the committed database still citing an NC source.
#
#     Every one of them is in F1DB, and the build now cites it. That is a
#     re-SOURCING, not a re-labelling: the mapping is proved on every build
#     by comparing the date of birth, and a driver F1DB does not hold, or
#     holds with a different date, stops the build.
#
#     What is NOT taken from F1DB is this register's own naming: `love` is
#     Rhodesian here and Zimbabwean there, and the codes above are the
#     sporting ones rather than ISO. Those are editorial choices this
#     database already makes, and a licence fix is no reason to revisit them.
#
#     Jolpica remains the id mapping for the LOCAL cross-check loader below.
#     Reading a source to check a fact is not redistributing it.
# ---------------------------------------------------------------------
PODIUM_ONLY_F1DB = {
    'allison': 'cliff-allison',
    'amick': 'george-amick',
    'anderson': 'bob-anderson',
    'arundell': 'peter-arundell',
    'ayulo': 'manny-ayulo',
    'bernard': 'eric-bernard',
    'blundell': 'mark-blundell',
    'bonetto': 'felice-bonetto',
    'boyd': 'johnny-boyd',
    'brundle': 'martin-brundle',
    'capelli': 'ivan-capelli',
    'carter': 'duane-carter',
    'cheever': 'eddie-cheever',
    'chiron': 'louis-chiron',
    'courage': 'piers-courage',
    'cross': 'art-cross',
    'davies': 'jimmy-davies',
    'de-portago': 'alfonso-de-portago',
    'donohue': 'mark-donohue',
    'fischer': 'rudi-fischer',
    'flockhart': 'ron-flockhart',
    'follmer': 'george-follmer',
    'freeland': 'don-freeland',
    'frere': 'paul-frere',
    'gendebien': 'olivier-gendebien',
    'goldsmith': 'paul-goldsmith',
    'gregory': 'masten-gregory',
    'holland': 'bill-holland',
    'jarvilehto': 'jj-lehto',  # F1DB files him under his racing name
    'johansson': 'stefan-johansson',
    'larini': 'nicola-larini',
    'love': 'john-love',
    'maggs': 'tony-maggs',
    'maglioli': 'umberto-maglioli',
    'mairesse': 'willy-mairesse',
    'manzon': 'robert-manzon',
    'menditeguy': 'carlos-menditeguy',
    'modena': 'stefano-modena',
    'monteiro': 'tiago-monteiro',
    'morbidelli': 'gianni-morbidelli',
    'nazaruk': 'mike-nazaruk',
    'parnell': 'reg-parnell',
    'perdisa': 'cesare-perdisa',
    'piquet-jr': 'nelson-piquet-jr',
    'redman': 'brian-redman',
    'rose': 'mauri-rose',
    'rosier': 'louis-rosier',
    'salo': 'mika-salo',
    'salvadori': 'roy-salvadori',
    'sato': 'takuma-sato',
    'schell': 'harry-schell',
    'schenken': 'tim-schenken',
    'serafini': 'dorino-serafini',
    'servoz-gavin': 'johnny-servoz-gavin',
    'spence': 'mike-spence',
    'stommelen': 'rolf-stommelen',
    'streiff': 'philippe-streiff',
    'stuck': 'hans-joachim-stuck',
    'suzuki': 'aguri-suzuki',
    'taylor': 'trevor-taylor',
    'whitehead': 'peter-whitehead',
    'wisell': 'reine-wisell',
}


def load():
    """Rows from harvest/podiums.txt, if one exists.

    Normally empty: tools/ergast_load.py writes to the database directly.
    The path is kept so a hand-checkable subset can still be loaded through
    the build's own validation, and so build_driver_map() has something to
    resolve against when it is used standalone.
    """
    rows = []
    if not os.path.exists(os.path.abspath(PODIUMS_FILE)):
        return rows
    with open(os.path.abspath(PODIUMS_FILE), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            year, rnd, pos, drv, con, grid, laps, status, pts = line.split("|")
            rows.append({
                "year": int(year),
                "round": int(rnd),
                "position": int(pos),
                "driver_ergast": drv,
                "constructor_ergast": con,
                "constructor_id": _resolve_constructor(con),
                "indy_chassis": con in INDY_CHASSIS,
                "grid": int(grid) if grid.isdigit() and int(grid) > 0 else None,
                "laps": int(laps) if laps.isdigit() else None,
                "status": status,
                "points": float(pts) if pts not in ("", "?") else None,
                "source": SOURCE.format(year=int(year)),
                "confidence": CONFIDENCE,
            })
    return rows


def _norm_tokens(s):
    """Lower-case alphabetic tokens, accents stripped. Hyphens are treated as
    word separators, so 'Lewis-Evans' gives ('lewis', 'evans') and matches
    the Jolpica id 'lewis-evans'."""
    import re
    import unicodedata
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return tuple(re.sub(r"[^a-z]+", " ", s.lower()).split())


def make_resolver(cur):
    """Return resolve(jolpica_driver_id) -> this database's driver id or None.

    Resolves on demand rather than from a fixed list, because the loader does
    not know which drivers a season will contain until it fetches it.

    Order, most specific first:
      1. DRIVER_ALIASES, for surnames this database holds more than one of
      2. PODIUM_ONLY_DRIVERS, the register entries v2.7 adds
      3. exact full-name match on the NAME the source states for this result
      4. exact full-name match on the id's own tokens
      5. unique surname match - ONLY when the source gave no forename that
         contradicts it

    Returns None rather than guessing. The caller reports and skips; it never
    invents a driver.

    Rule 5 is the dangerous one, and the first live run of this loader proved
    it. Jolpica gives Emerson Fittipaldi the id `emerson_fittipaldi` and his
    brother Wilson the bare `fittipaldi`. Our register holds only Emerson, so
    a surname match on `fittipaldi` resolved Wilson ONTO Emerson and
    overwrote his 1972-73 Lotus entries with Wilson's Brabham - moving eight
    wins from Team Lotus to Brabham and inventing two for the Fittipaldi
    constructor. It is the same failure as `_norm()` stripping "jr" and
    giving Piquet Jr his father's 23 wins, in a second resolver.

    So a bare surname is now only accepted when the name the source supplies
    alongside it agrees. `fittipaldi` arriving with "Wilson Fittipaldi"
    resolves to nothing and the row is skipped, which is correct: Wilson is
    not in this register.
    """
    by_full, by_surname, toks_by_id = {}, {}, {}
    for did, name in cur.execute("SELECT id, full_name FROM drivers"):
        toks = _norm_tokens(name)
        toks_by_id[did] = set(toks)
        if not toks:
            continue
        by_full[toks] = did
        by_surname.setdefault(toks[-1], []).append(did)
        if len(toks) > 2:                    # double-barrelled surnames
            by_surname.setdefault(" ".join(toks[-2:]), []).append(did)

    extra = {e: l for l, e, *_ in PODIUM_ONLY_DRIVERS}
    cache = {}

    def resolve(eid, stated_name=None):
        key = (eid, stated_name)
        if key in cache:
            return cache[key]
        did = None
        if eid in DRIVER_ALIASES:
            did = DRIVER_ALIASES[eid]
        elif eid in extra:
            did = extra[eid]
        else:
            name_toks = _norm_tokens(stated_name or "")
            id_toks = _norm_tokens(eid.replace("_", " "))
            if name_toks and name_toks in by_full:
                did = by_full[name_toks]
            elif id_toks in by_full:
                did = by_full[id_toks]
            else:
                # Surname fallback, narrowed by the name the source states.
                #
                # This does two jobs at once, and it has to do both. It
                # rejects a namesake - a bare `fittipaldi` arriving as
                # "Wilson Fittipaldi" must not become this register's
                # Emerson - and it PICKS BETWEEN people who share a surname,
                # which a register of 860 drivers routinely contains.
                #
                # The second job was added when the register grew. Before
                # that, `moss` was the only Moss and the bare surname
                # resolved on its own. Admitting Bill Moss made the lookup
                # ambiguous, the fallback gave up, and the 1955 British Grand
                # Prix was refused on a winner mismatch - Stirling Moss no
                # longer resolved to anyone. The refusal is the system
                # working: nothing was mis-attributed, the race was declined
                # whole. Duncan Hamilton and the other Brabhams do the same
                # thing to Lewis Hamilton and Jack Brabham.
                #
                # One may be a fuller form of the other - this register holds
                # "Sir Stirling Moss" where the source says "Stirling Moss" -
                # so the test is subset either way, not equality.
                for k in (" ".join(id_toks), id_toks[-1] if id_toks else ""):
                    cands = by_surname.get(k, [])
                    if not cands:
                        continue
                    if name_toks:
                        stated = set(name_toks)
                        cands = [d for d in cands
                                 if stated <= toks_by_id[d]
                                 or toks_by_id[d] <= stated]
                    if len(cands) == 1:
                        did = cands[0]
                        break
        cache[key] = did
        return did

    return resolve


def build_driver_map(cur):
    """Every id this module knows about, resolved. Used by the build to fail
    loudly if the register and the alias tables have drifted apart."""
    resolve = make_resolver(cur)
    ids = ({r["driver_ergast"] for r in load()} | set(DRIVER_ALIASES)
           | {e for _, e, *_ in PODIUM_ONLY_DRIVERS})
    out, unresolved = {}, []
    for eid in sorted(ids):
        did = resolve(eid)
        if did is None:
            unresolved.append(eid)
        else:
            out[eid] = did
    return out, unresolved
