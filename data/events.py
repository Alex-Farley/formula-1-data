# -*- coding: utf-8 -*-
"""
Canonical register of Grands Prix.

Every race in the database points at one of these by id. Before v2.4 the
race rows carried a free-text `gp_name`, which allowed the same event to
appear under two spellings ("Emilia Romagna" and "Emilia-Romagna") and
made it impossible to join a race to its event reliably.

`aliases` holds every name string that has appeared for this event,
including official renames (Brazilian -> Sao Paulo, Mexican -> Mexico
City). The race row keeps the name actually used that year for display;
`gp_id` is what you join on.

 id, name, country, aliases (list), notes
"""

GRANDS_PRIX = [
    ("british", "British Grand Prix", "United Kingdom", [],
     "Held every season since 1950 - one of only two events with an unbroken run."),
    ("italian", "Italian Grand Prix", "Italy", [],
     "The other event held every season since 1950. All but one at Monza."),
    ("monaco", "Monaco Grand Prix", "Monaco", [],
     "Part of the Triple Crown of motorsport. Missing only 1951-54 and 2020."),
    ("belgian", "Belgian Grand Prix", "Belgium", [], ""),
    ("french", "French Grand Prix", "France", [],
     "The oldest Grand Prix of all, first run in 1906. Absent since 2022."),
    ("german", "German Grand Prix", "Germany", [], ""),
    ("spanish", "Spanish Grand Prix", "Spain", [], ""),
    ("dutch", "Dutch Grand Prix", "Netherlands", [], "Ran 1952-1985; returned 2021."),
    ("swiss", "Swiss Grand Prix", "Switzerland", [],
     "Ended with Switzerland's ban on circuit racing after the 1955 Le Mans disaster."),
    ("indianapolis-500", "Indianapolis 500", "United States", [],
     "Counted towards the World Championship 1950-1960. Run to American national "
     "rules by largely American entrants; almost no Formula One regular took part."),
    ("argentine", "Argentine Grand Prix", "Argentina", [], ""),
    ("us", "United States Grand Prix", "United States", [], ""),
    ("us-west", "United States Grand Prix West", "United States", [],
     "The Long Beach race, run alongside a separate United States Grand Prix."),
    ("moroccan", "Moroccan Grand Prix", "Morocco", [],
     "A single running, in 1958, which decided that year's championship."),
    ("pescara", "Pescara Grand Prix", "Italy", [],
     "A single running, in 1957, on the longest circuit ever used - 25.579 km."),
    ("portuguese", "Portuguese Grand Prix", "Portugal", [], ""),
    ("south-african", "South African Grand Prix", "South Africa", [], ""),
    ("mexican", "Mexican Grand Prix", "Mexico", ["Mexico City Grand Prix"],
     "Renamed the Mexico City Grand Prix from 2021."),
    ("austrian", "Austrian Grand Prix", "Austria", [], ""),
    ("canadian", "Canadian Grand Prix", "Canada", [], ""),
    ("brazilian", "Brazilian Grand Prix", "Brazil", ["Sao Paulo Grand Prix"],
     "Renamed the Sao Paulo Grand Prix from 2021."),
    ("swedish", "Swedish Grand Prix", "Sweden", [],
     "Existed because of Ronnie Peterson and Gunnar Nilsson; ended when both were gone."),
    ("japanese", "Japanese Grand Prix", "Japan", [], ""),
    ("australian", "Australian Grand Prix", "Australia", [], ""),
    ("caesars-palace", "Caesars Palace Grand Prix", "United States", [],
     "Two runnings in a Las Vegas hotel car park, both deciding the championship."),
    ("detroit", "Detroit Grand Prix", "United States", [], ""),
    ("dallas", "Dallas Grand Prix", "United States", [],
     "A single running, in 1984, on a surface that broke up in 40 C heat."),
    ("european", "European Grand Prix", "various", [],
     "A movable title used to allow a second race in one country."),
    ("san-marino", "San Marino Grand Prix", "San Marino (held at Imola, Italy)", [],
     "A second Italian race under a flag of convenience."),
    ("hungarian", "Hungarian Grand Prix", "Hungary", [],
     "The first Grand Prix held behind the Iron Curtain."),
    ("pacific", "Pacific Grand Prix", "Japan", [],
     "Run at TI Circuit Aida so Japan could stage two races."),
    ("luxembourg", "Luxembourg Grand Prix", "Luxembourg (held at the Nurburgring, Germany)", [], ""),
    ("malaysian", "Malaysian Grand Prix", "Malaysia", [], ""),
    ("bahrain", "Bahrain Grand Prix", "Bahrain", [],
     "First Grand Prix in the Middle East. Hosted at Sepang in 2026."),
    ("chinese", "Chinese Grand Prix", "China", [], ""),
    ("turkish", "Turkish Grand Prix", "Turkey", [], ""),
    ("singapore", "Singapore Grand Prix", "Singapore", [], "The sport's first night race."),
    ("abu-dhabi", "Abu Dhabi Grand Prix", "United Arab Emirates", [], ""),
    ("korean", "Korean Grand Prix", "South Korea", [], ""),
    ("indian", "Indian Grand Prix", "India", [], ""),
    ("russian", "Russian Grand Prix", "Russia", [],
     "Contract terminated after the invasion of Ukraine."),
    ("azerbaijan", "Azerbaijan Grand Prix", "Azerbaijan", [], ""),
    ("saudi", "Saudi Arabian Grand Prix", "Saudi Arabia", [], ""),
    ("qatar", "Qatar Grand Prix", "Qatar", [], ""),
    ("miami", "Miami Grand Prix", "United States", [], ""),
    ("emilia-romagna", "Emilia-Romagna Grand Prix", "Italy",
     ["Emilia Romagna Grand Prix"],
     "Imola's return under a new name. Both spellings appear in the record; "
     "they are the same event."),
    ("las-vegas", "Las Vegas Grand Prix", "United States", [], ""),
    ("madrid", "Madrid Grand Prix", "Spain", [], "New for 2026."),
    ("styrian", "Styrian Grand Prix", "Austria", [],
     "A second Red Bull Ring race, in 2020 and 2021."),
    ("70th-anniversary", "70th Anniversary Grand Prix", "United Kingdom", [],
     "A second Silverstone race in 2020, marking 70 years of the championship."),
    ("tuscan", "Tuscan Grand Prix", "Italy", [],
     "A single running, at Mugello in 2020, which was Ferrari's 1,000th championship start."),
    ("eifel", "Eifel Grand Prix", "Germany", [], "A single running, at the Nurburgring in 2020."),
    ("sakhir", "Sakhir Grand Prix", "Bahrain", [],
     "A second Bahrain race in 2020, on the short outer circuit - a 53-second lap."),
]

# Grand Prix -> the circuit that hosted it, where exactly one circuit ever did.
# Events that alternated between venues are deliberately absent: the race row
# is left without a circuit rather than given a guessed one.
SINGLE_CIRCUIT = {
    "monaco": "monaco", "hungarian": "hungaroring", "dutch": "zandvoort",
    "san-marino": "imola", "emilia-romagna": "imola", "malaysian": "sepang",
    "chinese": "shanghai", "turkish": "istanbul", "singapore": "marina-bay",
    "abu-dhabi": "yas-marina", "korean": "yeongam", "indian": "buddh",
    "russian": "sochi", "azerbaijan": "baku", "saudi": "jeddah",
    "qatar": "lusail", "miami": "miami", "las-vegas": "las-vegas",
    "madrid": "madring", "pacific": "aida", "luxembourg": "nurburgring-gp",
    "pescara": "pescara", "moroccan": "ain-diab", "dallas": "dallas",
    "detroit": "detroit", "caesars-palace": "caesars-palace",
    "us-west": "long-beach", "styrian": "red-bull-ring",
    "70th-anniversary": "silverstone", "tuscan": "mugello",
    "eifel": "nurburgring-gp", "sakhir": "bahrain", "swedish": "anderstorp",
    "indianapolis-500": "indianapolis",
}

# Name string as it appears in the harvest -> canonical grand prix id.
# Built from GRANDS_PRIX plus its aliases; declared explicitly so an
# unrecognised name fails the build rather than being silently dropped.
def name_to_id():
    m = {}
    for gid, name, _c, aliases, _n in GRANDS_PRIX:
        m[name] = gid
        for a in aliases:
            m[a] = gid
    return m
