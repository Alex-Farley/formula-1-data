"""
The figure a driver's note must not state, as one compiled pattern.

`drivers.notes` is read as the page's lede and its meta description. A figure
the page derives - starts, entries, wins, poles, podiums, points, fastest
laps, titles - belongs to the strip beside the lede, where it cannot go
stale: Amon's note said 96 starts beside a strip that counted 108, and
Montoya's said a fourth start where the race records held a third. verify.py
fails the build on any note this pattern matches; tests/test_lede_figures.py
proves what it matches on every interpreter CI runs, so a version difference
that narrowed it to nothing would be seen (CD-21, CD-23).

What counts as a figure
-----------------------
A cardinal in digits (up to three, so a year is not one) or spelled ("Ten",
"Thirteen", "twenty-three"), followed by the plural noun - a count of one is
written "a win", and "Formula 2 race" is not a figure - or an ordinal that
states a running count ("300th start", "eighteenth start"), which takes
either number. "first" is left out because a first win states no count;
every ordinal above it does. A margin ("by two points") is not a total the
strip shows and is left alone.

Up to two lower-case words may sit between the number and the noun: "four
runner-up finishes", "Ten career wins", "three straight wins" are the same
figure with an adjective in the way. Not "of", "his", "the" and their kin:
"Four of his wins came in the wet" states no total. A capitalised word
between them names a subset the page never totals - "Six Monaco wins", "six
Le Mans wins" - and those are left to the note, except the qualifiers that
name the whole career and not a part of it: "Ten F1 wins", "Seven World
titles", "two consecutive Drivers' titles" are career totals, and "GP" or
"Grand Prix" qualifies the noun rather than narrowing it.
"""
import re

UNITS = ("one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|"
         "thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen")
TENS = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred"
CARDINAL = (rf"(?:\d{{1,3}}(?:,\d{{3}})*"
            rf"|(?:{UNITS}|{TENS})(?:[- ](?:{UNITS}|{TENS}))*)")
# "first" alone states no count; "twenty-first" does, so the compound is in.
ORDINAL = (r"(?:\d+(?:st|nd|rd|th)|(?:" + TENS + r")-first|(?:(?:" + TENS + r")-)?"
           r"(?:second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|"
           r"eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|"
           r"seventeenth|eighteenth|nineteenth|"
           r"twentieth|thirtieth|fortieth|fiftieth|sixtieth|seventieth|"
           r"eightieth|ninetieth|hundredth))")
# Qualifiers that name the whole career: the noun they precede is still the
# figure the strip derives. Case-sensitive, so "world" in running prose is a
# lower-case word between and "World" is this.
QUALIFIER = (r"(?:(?:Grands? Prix|GP|F1|Formula One|Formula 1|World Championship|"
             r"World|Championship|Drivers'|Constructors'|career) )?")
PLURAL = (r"(?:starts|races|entries|wins|poles|podiums|points|fastest laps|titles|"
          r"finishes|victories|championships)")
EITHER = (r"(?:starts?|races?|entries|entry|wins?|poles?|podiums?|points?|"
          r"fastest laps?|titles?)")
# The lower-case words allowed between number and noun. Case-sensitive inside
# an otherwise case-insensitive pattern, which is what tells an adjective from
# a subset's name.
STOP = r"(?:of|his|her|their|the|a|an|in|at|for|with)"
BETWEEN = rf"(?-i:(?:(?!{STOP} )[a-z][\w-]* ){{0,2}})"

# "Formula One wins" with no count: "One wins" is not a figure.
FIGURE = re.compile(
    rf"(?<!\bby )(?<!Formula )\b(?:{CARDINAL} {BETWEEN}(?-i:{QUALIFIER}){PLURAL}"
    rf"|{ORDINAL} {BETWEEN}(?-i:{QUALIFIER}){EITHER})\b",
    re.IGNORECASE,
)


def figure(text):
    """The first figure stated in `text`, or None."""
    m = FIGURE.search(text)
    return m.group(0) if m else None


# ---------------------------------------------------------------------
# The figures the pattern above leaves alone on purpose - "Six Monaco wins",
# "six Le Mans wins" - name a subset of a career, and the strip totals no
# subset. They were verified by hand for #79 and nothing re-read them; a
# note is the one place a number can sit unchecked (CD-24). subset_figures()
# finds them so verify.py can count each against the race records where the
# place is a Grand Prix, and require the rest to be declared.
# ---------------------------------------------------------------------
_WORDS = {w: i + 1 for i, w in enumerate(UNITS.split("|"))}
_WORDS.update({w: (i + 2) * 10 for i, w in enumerate(TENS.split("|")[:-1])})
_WORDS["hundred"] = 100
# A place is one or more capitalised words with no sentence punctuation
# inside: "24 Hours. Five Monaco wins" is two sentences, not a 24-count.
_PLACE = r"(?-i:(?:[A-Z][A-Za-z'-]*(?: [A-Z][A-Za-z'-]*)*))"
_SUBSET_NOUN = r"(?:wins|victories|poles|podiums)"
SUBSET = re.compile(rf"\b(?P<n>{CARDINAL}) (?P<place>{_PLACE}) (?P<noun>{_SUBSET_NOUN})\b",
                    re.IGNORECASE)


def number(text):
    """"Six", "twenty-three", "1,566" -> 6, 23, 1566."""
    text = text.lower().replace(",", "")
    if text.isdigit():
        return int(text)
    total = 0
    for part in re.split(r"[- ]", text):
        if part == "hundred":
            total = (total or 1) * 100
        else:
            total += _WORDS[part]
    return total


def subset_figures(text):
    """Every (count, place, noun) a note states for a named subset."""
    return [(number(m.group("n")), m.group("place"), m.group("noun").lower())
            for m in SUBSET.finditer(text)]
