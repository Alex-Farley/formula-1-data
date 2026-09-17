# -*- coding: utf-8 -*-
"""
Harvest Formula One car specifications from the per-car Wikipedia articles.

    python3 tools/wikispec_fetch.py                 # full run, ~700 requests
    python3 tools/wikispec_fetch.py --only ferrari  # chassis ids matching
    python3 tools/wikispec_fetch.py --limit 40      # a sample, for a trial

Reads:   harvest/chassis.txt, harvest/f1db_constructors.txt, harvest/entrants.txt
Writes:  harvest/car_specs.txt      the accepted rows
         harvest/car_specs.log      every chassis, and why it was refused

There is no unified Formula One car specification dataset anywhere. F1DB's
chassis register is complete and carries no technical data at all. The
specifications exist only in the `{{Racing car}}` infobox on each car's own
article, whose fields map almost one-for-one onto this database's `cars`
schema. The 29 curated rows in data/cars.py were read off those pages by
hand; this does the same job at scale, without a person in the middle.

Why the article's own numbers cannot be trusted on their own
------------------------------------------------------------
Guessing that "Ferrari 312T2" is the article for the chassis F1DB calls
`ferrari-312t2` is inference, and inference is what put an invented
"Ferrari 125 F2" into the abandoned 1952 chassis harvest. The title is only a
candidate. A page is accepted only when the page itself agrees with two facts
this database already holds and did not get from Wikipedia:

  1. **Constructor.** The infobox `Constructor` must resolve to the same
     constructor F1DB assigns that chassis. This is the check the 1952
     harvest was missing: it constrains the identity of the car being
     described, which a race winner does not.
  2. **Years.** The years the infobox reports - `Debut`, and the seasons named
     in its championship fields - must fall inside the seasons F1DB records
     that chassis as entered, allowing one year either side for a car
     launched or last raced across a season boundary.
  3. **Name.** The article title must be a form of this chassis's
     constructor followed by this chassis's designation. The title is split
     into words. Some leading run of them must be a form of a name F1DB holds
     for the constructor, compared as a prefix in either direction: "Ferrari
     Tipo" is a form of Ferrari, "Mercedes-Benz" and "Mercedes-AMG" of
     Mercedes, "Hispania" of Hispania Racing Team. The comparison is of whole
     words, so "Barcelona" is not a form of BAR. The words after that run
     must then be the designation - exactly ("Red Bull Racing RB19"),
     followed by more words ("Mercedes-AMG F1 W11 EQ Performance"), with a
     single variant letter after a closing digit ("AGS JH25B" for the JH25),
     or cut back to the family ("Lotus 72" for the 72C, "Ferrari 312" for
     the 312/66). A title that is the chassis's full name passes as it
     stands.

     Wikipedia routinely documents a family on one page, so the title will
     not always be the chassis's own name, but it may not be a *different*
     car. This is what stops a candidate landing on a namesake: searching
     for "Ferrari 312/66" offers "Ferrari 312T" first, and 312t is neither
     31266 nor a family of it. A family is never cut inside a run of digits
     unless the designation itself breaks into words there (312/66), so
     "F1" is not a family of the F10, "24" of the 246, or "3" of the 33 -
     "Ferrari 156 F1", "Ferrari SF-24" and "Lotus 1-2-3" are all refused.
     Past the designation, the title must break at a word, so a
     one-letter designation cannot be read into a longer word: "English
     Racing Automobiles" is not the ERA A, and "Boron-11 ..." is not the
     Boro 001.

     Between the constructor's name and the designation a title may put
     only filler ("Tipo", "Type", "Racing", "Team", "Scuderia") or a word
     of the constructor as the page's own infobox spells or links it ("Benz"
     in "Mercedes-Benz in Formula One"), and after such a longer head the designation must
     follow exactly, never cut back to a family. So "Lotus 18/21" is not the
     21, "Lotus Elan 25" not the 25, "Ferrari 125 S" not the SF-23. The
     title's spelling of the constructor is still not the constructor
     evidence - check 1 is - so the infobox is parsed before this check
     runs, which costs nothing: the page has already been fetched.

     One title names two cars on purpose: "Alfa Romeo 158/159 Alfetta"
     covers the 158 and the 159. A slash-joined word counts as a list of
     models only when every item in it is itself the designation of one of
     the constructor's F1DB chassis and the joined word is not. The title
     then counts for each listed car exactly as if it named that car alone,
     with no family cut. So "Lotus 18/21" is still not the 21 (F1DB holds an
     18/21), and "Alfa Romeo 105/115 Series Coupes" is not a list at all.

A page failing either check is refused whole and logged. It is never
partially accepted, and a near miss is never nudged into a match.

Regulation limits are not measurements
--------------------------------------
Modern cars are documented far more thinly than historic ones: current-era
figures are competitive secrets, and most "weight" quoted for a modern car is
simply that season's regulation minimum. 2026's widely-circulated 768 kg,
3,400 mm and 1,900 mm are limits in the rules, not measurements of any
particular car.

Storing one in a per-car field would be inference presented as fact. So a
harvested weight or wheelbase that merely restates the season's regulation
limit is dropped, and the reason is logged. The limits themselves live in
`regulation_limits`, which is where a rule belongs.

That only catches the years a limit has actually been sourced for, and
`regulation_limits` is full of holes on purpose. The rest are caught in
build.py, offline, by a test this file cannot do: a figure several
*different constructors* quote identically in the same era is the rule they
were all built to. It runs there rather than here so that this file records
what the page said, and the database records what survived the checks. The consequence is that
going backwards yields much richer rows than starting at 2026, and the recent
rows are thin. That is the honest shape of the data, not a gap to pad.
"""
import argparse
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HARVEST = os.path.join(ROOT, "harvest")

UA = ("formula-1-data/2.8 (https://github.com/Alex-Farley/formula-1-data; "
      "chassis specification harvest)")
RAW = "https://en.wikipedia.org/w/index.php?title={}&action=raw"
URL = "https://en.wikipedia.org/wiki/{}"

# Fields taken off the infobox, in the order they are written out.
# infobox key(s) -> output column
TEXT_FIELDS = [
    ("designers",    ["designer", "designers"]),
    ("chassis_type", ["chassis"]),
    ("susp_front",   ["front suspension", "suspension (front)"]),
    ("susp_rear",    ["rear suspension", "suspension (rear)"]),
    ("engine_name",  ["engine name", "engine"]),
    ("engine_config", ["configuration"]),
    ("aspiration",   ["turbo/na", "turbo / na", "aspiration"]),
    ("engine_position", ["engine position"]),
    ("gearbox",      ["gearbox name", "gearbox", "transmission"]),
    ("gears",        ["gears"]),
    ("brakes",       ["brakes"]),
    ("fuel",         ["fuel"]),
    ("lubricants",   ["lubricants"]),
    ("tyres",        ["tyres", "tires"]),
    ("predecessor",  ["predecessor"]),
    ("successor",    ["successor"]),
    ("debut",        ["debut"]),
    ("power_note",   ["power"]),
]
NUM_FIELDS = [
    ("capacity_cc",  ["capacity"],       "cc"),
    ("power_bhp",    ["power"],          "hp"),
    ("weight_kg",    ["weight"],         "kg"),
    ("wheelbase_mm", ["wheelbase"],      "mm"),
    ("track_front_mm", ["front track", "track"], "mm"),
    ("track_rear_mm",  ["rear track", "track"],  "mm"),
    ("fuel_l",       ["fuel capacity"],  "l"),
]
# Published career figures. Not specifications - these are the numbers the
# database already derives from its own race records, and comparing the two
# is what proves a linkage rather than assuming it.
CAREER_FIELDS = [("races", ["races"]), ("wins", ["wins"]),
                 ("poles", ["poles"]),
                 ("fastest_laps", ["fastest_laps", "fastest laps"]),
                 ("podiums", ["podiums"]),
                 ("drivers_titles", ["drivers_champ", "drivers champ"]),
                 ("constructors_titles", ["cons_champ", "cons champ"])]

COLUMNS = (["article", "chassis_ids", "constructor_id", "first_year", "last_year"]
           + [c for c, _ in TEXT_FIELDS]
           + [c for c, _, _ in NUM_FIELDS]
           + [c for c, _ in CAREER_FIELDS])

# Regulation limits that a modern article quotes as if they were the car's
# own figure. year -> (minimum weight kg, maximum wheelbase mm). Sourced from
# regulation_limits in data/technical.py; kept here so the tool can drop the
# value at harvest time rather than storing it and hoping the build notices.
from_technical = os.path.join(ROOT, "data")
sys.path.insert(0, ROOT)


def limits():
    """year -> {field: value}, expanded over each row's stated span only."""
    from data import technical as X
    out = {}
    for lo, hi, field, value, _u, _n, _c, _s in X.REGULATION_LIMITS:
        for y in range(lo, (hi or lo) + 1):
            out.setdefault(y, {})[field] = value
    return out


# --------------------------------------------------------------- wikitext

def strip(value):
    """Turn an infobox value into plain text.

    Wikitext markup only. Anything this does not understand is left in place
    rather than guessed at, and shows up in the output where it can be seen.
    """
    if value is None:
        return None
    s = value
    s = re.sub(r"<ref[^>]*/>", "", s)
    s = re.sub(r"<ref.*?</ref>", "", s, flags=re.S | re.I)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    s = re.sub(r"\{\{\s*(convert|cvt)\s*\|([^|}]+)\|([^|}]+)[^}]*\}\}",
               lambda m: m.group(2).strip() + " " + m.group(3).strip(), s, flags=re.I)
    s = re.sub(r"\{\{\s*(flagicon|flag|nowrap|small|nbsp|citation needed|cn|"
               r"efn|sfn|refn)[^{}]*\}\}", " ", s, flags=re.I)
    # remaining simple templates: keep the last parameter, which is what
    # {{ubl|a|b}} and friends render
    for _ in range(3):
        s = re.sub(r"\{\{[^{}]*\}\}",
                   lambda m: m.group(0).strip("{}").split("|")[-1], s)
    s = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[\[([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"<br\s*/?>", "; ", s, flags=re.I)
    s = re.sub(r"</?(sup|sub|span|div|small|b|i)[^>]*>", "", s, flags=re.I)
    s = s.replace("'''", "").replace("''", "")
    s = re.sub(r"[|]", "/", s)          # the output file is pipe-delimited
    s = re.sub(r"\s+", " ", s).strip(" ;,\t")
    return s or None


def parse_infobox(text):
    """Return the {{Racing car}} / {{Infobox racing car}} parameters, lowercased
    keys to raw values, or None if the article has no such infobox."""
    m = re.search(r"\{\{\s*(Infobox[ _]racing[ _]car|Racing[ _]car)\s*(\||\n)",
                  text, re.I)
    if not m:
        return None
    i = m.start()
    depth, j = 0, i
    while j < len(text):
        if text.startswith("{{", j):
            depth += 1
            j += 2
        elif text.startswith("}}", j):
            depth -= 1
            j += 2
            if depth == 0:
                break
        else:
            j += 1
    body = text[i + 2:j - 2]
    # split on top-level pipes only
    parts, depth2, buf = [], 0, ""
    k = 0
    while k < len(body):
        c = body[k]
        if body.startswith("{{", k) or body.startswith("[[", k):
            depth2 += 1
            buf += body[k:k + 2]
            k += 2
            continue
        if body.startswith("}}", k) or body.startswith("]]", k):
            depth2 -= 1
            buf += body[k:k + 2]
            k += 2
            continue
        if c == "|" and depth2 == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += c
        k += 1
    parts.append(buf)
    out = {}
    for p in parts[1:]:
        if "=" not in p:
            continue
        key, _, val = p.partition("=")
        out[key.strip().lower()] = val.strip()
    return out


def first(box, keys):
    for k in keys:
        if box.get(k):
            return box[k]
    return None


def number(box, keys, unit):
    """Pull a figure in `unit` out of an infobox value.

    Only a value the article states in that unit is taken. A weight given in
    pounds is not converted: a converted figure is a derived one, and this
    file is meant to record what the page says.
    """
    raw = first(box, keys)
    if raw is None:
        return None
    s = strip(raw)
    if not s:
        return None
    pat = {"cc": r"([\d,.]+)\s*cc\b",
           "hp": r"([\d,.]+)\s*(?:-|–|to)?\s*([\d,.]*)\s*(?:hp|bhp|PS)\b",
           "kg": r"([\d,.]+)\s*kg\b",
           "mm": r"([\d,.]+)\s*mm\b",
           "l": r"([\d,.]+)\s*(?:l|litres|liters)\b"}[unit]
    m = re.search(pat, s, re.I)
    if not m:
        return None
    def num(t):
        t = t.replace(",", "").strip()
        try:
            return float(t)
        except ValueError:
            return None
    v = num(m.group(1))
    if unit == "hp" and m.lastindex and m.group(2):
        # "500-515 hp": take the top of the range, which is what a published
        # peak-power figure means, and keep the full string in power_note.
        v = max(v or 0, num(m.group(2)) or 0) or None
    if v is None:
        return None
    return v


def years_in(text):
    return {int(y) for y in re.findall(r"\b(19[3-9]\d|20[0-4]\d)\b", text or "")}


# --------------------------------------------------------------- checking

_DROP = re.compile(r"\b(scuderia|team|racing|grand prix|formula one|formula 1|"
                   r"f1|ltd|limited|gmbh|s\.?p\.?a|srl|sa|ag|inc|automobili|"
                   r"engineering|motorsport|cars?|the|and|of|works)\b")


def norm_team(s):
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = _DROP.sub(" ", s)
    return " ".join(s.split())


def read_pipe_named(name):
    """Return (columns, rows-as-dicts), taking the column names from the last
    commented header line of the file. Generated files gain columns; reading
    them by position does not survive that."""
    cols, out = None, []
    with open(os.path.join(HARVEST, name), encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("#"):
                if "|" in line:
                    cols = [c.strip() for c in
                            line.lstrip("# ").split("   ")[0].split("|")]
                continue
            if not line.strip():
                continue
            parts = line.split("|")
            if cols is None:
                sys.exit(f"{name}: no column header")
            if len(parts) != len(cols):
                sys.exit(f"{name}: {len(parts)} fields, expected {len(cols)}")
            out.append(dict(zip(cols, parts)))
    return cols, out


def read_pipe(name):
    rows = []
    with open(os.path.join(HARVEST, name), encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            rows.append(line.split("|"))
    return rows


# ------------------------------------------------------------------ fetch

def fetch(title, session_delay=0.15):
    url = RAW.format(urllib.parse.quote(title.replace(" ", "_"), safe="/:()',.!"))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                time.sleep(session_delay)
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (429, 503) and attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            return None
        except Exception:
            if attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            return None
    return None


def slug(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def words(s):
    """A title's words, each reduced as slug() reduces a whole name.

    Split on spaces, hyphens, slashes and underscores, which is where
    Wikipedia puts a constructor/designation boundary: "Mercedes-AMG F1 W11",
    "Toro_Rosso_STR2", "Alfa Romeo 158/159 Alfetta".
    """
    return [w for w in (slug(x) for x in re.split(r"[\s/_\-]+", s or ""))
            if w]


def either_word_prefix(a, b):
    """Is one list of words the leading words of the other?"""
    n = min(len(a), len(b))
    return n > 0 and a[:n] == b[:n]


def designation(full, cons_short, name):
    """The chassis's designation, as a list of words.

    Taken from the full name with the constructor's name removed, because
    that is the spelling F1DB shows: the Boro chassis is `name` "1" and
    full name "Boro 001", and "1" would be read into any word that starts
    with a one. The short `name` is the fallback when the full name does not
    start with the constructor's.
    """
    fw, cw = words(full), words(cons_short)
    if cw and fw[:len(cw)] == cw and len(fw) > len(cw):
        return fw[len(cw):]
    return words(name)


def designation_follows(rest, parts, family=True):
    """Do the words `rest` open with the designation whose words are `parts`?

    Exactly, as a run of whole words; with one variant letter after a
    closing digit (JH25B for JH25); or cut back to a family (72 for 72C,
    312 for 312/66, 126C for 126CK). A family is never cut inside a run of
    digits, except where the designation itself breaks into words: F1 is not
    the F10's family, nor 24 the 246's. `family` False allows no cut at all.
    """
    want = "".join(parts)
    breaks, n = set(), 0
    for p in parts:
        n += len(p)
        breaks.add(n)
    cut = "".join(rest)
    if (family and cut and len(cut) < len(want) and want.startswith(cut)
            and (len(cut) in breaks
                 or not (cut[-1].isdigit() and want[len(cut)].isdigit()))):
        return True                        # a family page: "72" for 72C
    run = ""
    for w in rest:
        run += w
        if run == want:
            return True
        if (len(run) == len(want) + 1 and run.startswith(want)
                and want[-1].isdigit() and run[-1].isalpha()):
            return True
        if len(run) > len(want):
            return False
    return False


# Words a title may put between the constructor's name and the designation
# without naming anything else: "Ferrari Tipo 500", "Connaught Type A",
# "Scuderia Toro Rosso STR13".
FILLER = {"tipo", "type", "scuderia", "team", "racing", "f1", "formula", "one"}
# Never taken from the infobox as a spelling of the constructor.
_GLUE = {"in", "of", "the", "and", "a", "an"}


def listed_models(title, want, siblings):
    """`title` with a list of models cut down to the one that is `want`.

    A word such as "158/159" is a list only when every item is in
    `siblings` - the constructor's F1DB designations, each reduced to one
    slug - and the whole word is not. The listed item must be the
    designation exactly. Returns the rewritten title, or None.
    """
    if not siblings:
        return None
    chunks = re.split(r"([\s_]+)", title)
    for k, chunk in enumerate(chunks):
        items = [slug(x) for x in chunk.split("/")]
        if (len(items) < 2 or slug(chunk) in siblings
                or not all(x in siblings for x in items)):
            continue
        for x, raw in zip(items, chunk.split("/")):
            if x == want:
                return "".join(chunks[:k] + [raw] + chunks[k + 1:])
    return None


def name_is_form(title, full, name, cons_names, page_constructor=None,
                 siblings=()):
    """Check 3: is `title` a form of this constructor, then this designation?

    `cons_names` is every name F1DB holds for the chassis's constructor, its
    short name first. `page_constructor` is the infobox's Constructor value,
    whose words - "Benz" in "Mercedes-Benz" - may also stand between the
    constructor's name and the designation. Nothing else may: "Lotus 18/21"
    is not the 21, "Lotus Elan 25" is not the 25. `siblings` is the set of
    the constructor's designations, as slugs, which is what lets a list of
    models ("158/159") count for each car it lists; see listed_models().
    """
    if slug(title) == slug(full):
        return True
    want = designation(full, cons_names[0] if cons_names else "", name)
    alone = listed_models(title, "".join(want), siblings)
    if alone is not None and _form(alone, full, name, cons_names,
                                   page_constructor, family=False):
        return True
    return _form(title, full, name, cons_names, page_constructor)


def _form(title, full, name, cons_names, page_constructor, family=True):
    """name_is_form() for one title; `family` False forbids any family cut."""
    if slug(title) == slug(full):
        return True
    forms = [w for w in (words(c) for c in cons_names) if w]
    want = designation(full, cons_names[0] if cons_names else "", name)
    extra = FILLER | {w for w in words(page_constructor)
                      if w not in _GLUE and not any(c.isdigit() for c in w)}
    t = words(title)
    for i in range(1, len(t)):
        for f in forms:
            if not either_word_prefix(t[:i], f):
                continue
            if any(w not in extra for w in t[len(f):i]):
                continue
            # A head with words beyond the constructor's name ("Ferrari
            # Tipo") must be followed by the designation itself, not a cut
            # of it.
            if designation_follows(t[i:], want,
                                   family=family and i <= len(f)):
                return True
    return False


def candidates(full_name):
    """Titles worth trying for a chassis, most specific first.

    Mechanical only: the exact name, then the name cut back at each
    separator, then whatever Wikipedia's own search offers. No candidate is
    trusted - every one of them still has to pass all three checks - so the
    list can afford to be generous where the checks are strict.
    """
    out = [full_name]
    for sep in ("/", "-", " "):
        head = full_name.rsplit(sep, 1)[0].strip()
        if sep in full_name and len(head.split()) >= 2 and head not in out:
            out.append(head)
    return out


def search(term, limit=3):
    url = ("https://en.wikipedia.org/w/api.php?action=opensearch&format=json"
           "&limit=%d&search=%s" % (limit, urllib.parse.quote(term)))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        import json
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))[1]
    except Exception:
        return []


def resolve(title, seen=None):
    """Fetch an article, following redirects. Returns (final_title, text)."""
    seen = seen or set()
    if title in seen or len(seen) > 4:
        return None, None
    seen.add(title)
    text = fetch(title)
    if text is None:
        return None, None
    m = re.match(r"\s*#REDIRECT\s*\[\[([^\]#|]+)", text, re.I)
    if m:
        return resolve(m.group(1).strip(), seen)
    return title, text


# ------------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="substring filter on the chassis id")
    ap.add_argument("--limit", type=int, help="stop after N chassis")
    ap.add_argument("--delay", type=float, default=0.15,
                    help="seconds between requests (default 0.15)")
    args = ap.parse_args()

    chassis = [(c, k, n, f) for c, k, n, f in read_pipe("chassis.txt")]
    cons_name = {r[0]: (r[1], r[2]) for r in read_pipe("f1db_constructors.txt")}
    # Each constructor's designations, for check 3's list of models.
    siblings = {}
    for _c, k, n_, f in chassis:
        short = cons_name.get(k, ("",))[0]
        siblings.setdefault(k, set()).add("".join(designation(f, short, n_)))
    years = {}
    # Read the columns by name from the file's own header rather than by
    # position. A column was once added to entrants.txt and this loop went on
    # reading position 3, which had become the engine manufacturer - so every
    # chassis looked as though it had never entered a season and the whole
    # harvest returned nothing. Positional reads of a file someone else
    # generates are a standing trap.
    ent_cols, ent_rows = read_pipe_named("entrants.txt")
    need = {"year", "chassis_ids"}
    if not need <= set(ent_cols):
        sys.exit(f"entrants.txt header lacks {sorted(need - set(ent_cols))}; "
                 f"rerun tools/f1db_fetch.py")
    for row in ent_rows:
        for ch in (row["chassis_ids"] or "").split("+"):
            if ch:
                years.setdefault(ch, set()).add(int(row["year"]))
    reg = limits()

    if args.only:
        chassis = [c for c in chassis if args.only in c[0]]
    if args.limit:
        chassis = chassis[:args.limit]

    accepted, log = {}, []
    claimed = {}                     # article -> chassis ids resolved onto it
    for n, (cid, con_id, name, full) in enumerate(chassis, 1):
        if n % 25 == 0:
            print(f"  {n}/{len(chassis)}  {len(accepted)} accepted",
                  file=sys.stderr)
        entered = years.get(cid)
        if not entered:
            log.append(f"{cid}|never entered a championship season|{full}")
            continue
        lo, hi = min(entered), max(entered)

        tried, title, box = [], None, None
        for cand in candidates(full) + search(full):
            if cand in tried:
                continue
            tried.append(cand)
            t, body = resolve(cand)
            if body is None:
                continue
            # check 3: the article may be a family page, but not a
            # different car. The infobox is read first only for the words it
            # spells the constructor with; nothing else is taken from it
            # until the page has passed.
            b2 = parse_infobox(body)
            spelt = None
            if b2 and first(b2, ["constructor"]):
                # The text shown and the article it links to: the W196 page
                # shows "Mercedes" and links "Mercedes-Benz in Formula One".
                raw = re.sub(r"<ref.*?</ref>|<ref[^>]*/>", "",
                             first(b2, ["constructor"]), flags=re.S | re.I)
                spelt = " ".join([strip(raw) or ""]
                                 + re.findall(r"\[\[([^\]|#]+)", raw))
            if not name_is_form(t, full, name, cons_name.get(con_id, ()),
                                spelt, siblings.get(con_id, ())):
                log.append(f"{cid}|name disagrees|{t} is not a form of {full}")
                continue
            if b2 is None:
                log.append(f"{cid}|no racing-car infobox|{t}")
                continue
            title, box = t, b2
            break
        if box is None:
            if not any(l.startswith(cid + "|") for l in log):
                log.append(f"{cid}|no article|tried {', '.join(tried) or full}")
            continue
        category = strip(box.get("category") or "") or ""
        if "formula one" not in category.lower() and "formula 1" not in category.lower():
            log.append(f"{cid}|infobox is not a Formula One car|{title} "
                       f"(category: {category or 'absent'})")
            continue

        # ---- check 1: the constructor the page names must be the one F1DB
        # gives this chassis. This is the constraint the abandoned chassis
        # harvest lacked.
        page_team = norm_team(strip(first(box, ["constructor"])))
        want = {norm_team(v) for v in cons_name.get(con_id, ())} - {""}
        if not page_team:
            log.append(f"{cid}|infobox names no constructor|{title}")
            continue
        if not any(w and (w in page_team or page_team in w) for w in want):
            log.append(f"{cid}|constructor disagrees|{title}: page says "
                       f"'{page_team}', F1DB says {sorted(want)}")
            continue

        # ---- check 2: the years the page reports must sit inside the seasons
        # F1DB records this chassis as entered.
        page_years = years_in(strip(first(box, ["debut"])) or "")
        if page_years and not any(lo - 1 <= y <= hi + 1 for y in page_years):
            log.append(f"{cid}|years disagree|{title}: page debut "
                       f"{sorted(page_years)}, F1DB entered {lo}-{hi}")
            continue

        row = {"article": title, "constructor_id": con_id,
               "first_year": lo, "last_year": hi}
        for col, keys in TEXT_FIELDS:
            row[col] = strip(first(box, keys))
        for col, keys, unit in NUM_FIELDS:
            row[col] = number(box, keys, unit)
        for col, keys in CAREER_FIELDS:
            v = strip(first(box, keys))
            m = re.match(r"^\s*(\d+)", v or "")
            row[col] = int(m.group(1)) if m else None

        # A single `track` field cannot be split between front and rear.
        if not first(box, ["front track"]) and first(box, ["track"]):
            row["track_rear_mm"] = row["track_front_mm"]

        # ---- a regulation limit is not a measurement of this car
        for y in range(lo, hi + 1):
            for col, field, what in (
                    ("weight_kg", "minimum_weight_kg", "minimum"),
                    ("wheelbase_mm", "maximum_wheelbase_mm", "maximum")):
                if row[col] and reg.get(y, {}).get(field) == row[col]:
                    log.append(f"{cid}|{col} dropped|{title}: {row[col]} is the "
                               f"{y} regulation {what}, not a measurement")
                    row[col] = None

        if title in accepted:
            # A family article - Ferrari 312T covers 312T through 312T5.
            # Widen the span rather than writing the page out twice.
            prev = accepted[title]
            prev["first_year"] = min(prev["first_year"], lo)
            prev["last_year"] = max(prev["last_year"], hi)
            claimed[title].append(cid)
            log.append(f"{cid}|folded into {title}|shares the article")
            continue
        accepted[title] = row
        claimed[title] = [cid]

    stamp = time.strftime("%Y-%m-%d")
    with open(os.path.join(HARVEST, "car_specs.txt"), "w", encoding="utf-8") as f:
        f.write("# Generated by tools/wikispec_fetch.py on %s. "
                "Do not edit by hand.\n" % stamp)
        f.write("# Source: the per-car articles on en.wikipedia.org, "
                "{{Racing car}} infobox. CC BY-SA 4.0.\n")
        f.write("# Every row was checked against F1DB for constructor and "
                "seasons before it was written; see car_specs.log.\n")
        f.write("# " + "|".join(COLUMNS) + "\n")
        for title in sorted(accepted):
            row = accepted[title]
            row["chassis_ids"] = "+".join(sorted(claimed[title]))
            out = []
            for c in COLUMNS:
                v = row.get(c)
                if isinstance(v, float) and v == int(v):
                    v = int(v)
                out.append("" if v is None else str(v))
            f.write("|".join(out) + "\n")
    with open(os.path.join(HARVEST, "car_specs.log"), "w", encoding="utf-8") as f:
        f.write("# Generated by tools/wikispec_fetch.py on %s.\n" % stamp)
        f.write("# chassis_id|reason|detail — every chassis not written to "
                "car_specs.txt, and why.\n")
        for line in log:
            f.write(line + "\n")
    print(f"{len(accepted)} articles accepted from {len(chassis)} chassis; "
          f"{len(log)} entries in the log")


if __name__ == "__main__":
    main()
