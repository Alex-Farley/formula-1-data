# -*- coding: utf-8 -*-
"""
The prose pass (PM-17, #249): label every written field in scope original,
paraphrased or close to source, measured against Wikipedia.

    python3 tools/prose_pass.py            # fetch what is not cached, label, write
    python3 tools/prose_pass.py --check    # offline: which labels are stale or missing

Reads:   f1.db
Writes:  docs/prose_pass.tsv        one line per field, with its evidence
Caches:  .prose-pass-cache/         the article text it compared against

Why this exists
---------------
The release is CC BY-SA because prose "taken from or closely following"
Wikipedia is in it (ATTRIBUTION.md). Nobody had said which prose. A field
written in this project's own words owes Wikipedia nothing, a field that
follows an article's wording carries the share-alike with it, and the licence
statement can only draw that line once each field is labelled. The labels are
evidence for a person's decision - PM-49 (#573), PD-41 (#481) - and decide
nothing on their own: this file relicenses nothing.

What a field is compared against
--------------------------------
Every article a reader would reach for when writing it: the row's own article
where the row names one (a car's `source`), the top three results of a
Wikipedia search for the row's subject, and a few general articles for the
table. Against each it measures two things over lower-cased words:

  run   the longest run of consecutive words the field shares with the article
  c4    the share of the field's four-word sequences that occur in the article

and keeps the article that shares the longest run. The labels follow from the
two numbers alone, so the pass can be rerun and gets the same answer:

  close to source   a run of CLOSE_RUN words or more: a clause lifted whole
  paraphrased       a run of PARA_RUN or more, or c4 of PARA_C4 or more: the
                    article's phrasing, rearranged
  original          neither

The two numbers are a screen, not a verdict. A number cannot tell a lifted
clause from a proper name ("the Grand Prix Drivers' Association"), a result
put in the only words it has ("won the 1972 Monaco Grand Prix"), a points
scale or a stock phrase of the sport ("the Formula One World Championship").
So every field the screen flags - every `close` and every `paraphrased` - is
read, and the reading is declared in READ below under one of a few stated
reasons, the way every other deviation in this project is. Its line in the
file says `basis=read`; a line the screen passed says `basis=auto`. A flagged
field with no reading, or a reading of a field the screen no longer flags, is
a failure of `--check`, so the declarations cannot drift from the evidence.

What the labels mean
--------------------
  original          none of the article's expression found: the project's
                    own wording, or wording that shares with the article
                    only names, facts in their ordinary words, figures,
                    stock phrases or a quotation both of them quote
  paraphrased       follows the article's way of putting something that could
                    be put other ways
  close to source   reproduces a clause of the article's expression; the one
                    class that would need rewriting

What the pass does not see
--------------------------
It measures against the current revision of each article, which it records.
The prose was written in 2026, weeks before the pass, so the drift is small
but not nothing: an article rewritten since would read as further from the
field than it was. It sees only Wikipedia; the other sources are FOM's, the
FIA's and F1DB's, and none of their text is the share-alike question. And it
reads words, not ideas: a field that follows an article's sequence of points
in wholly different words reads `original`, which is also what the licence
says it is - copyright is in the expression. Abbreviations break a run ("F1"
against "Formula One", "GP" against "Grand Prix"); expanding them was tried,
and added 32 flags, every one a race or championship name.

Titles and short labels - `regulation_changes.title`, `governance.event`,
`safety_milestones.milestone`, `eras.era_name` and the like - are headings,
not prose, and are not measured.

Out of scope, and why
---------------------
The five PM-47 columns granted CC BY 4.0 (discrepancies.assessment and four
of known_gaps) are about this database's own sources and state and were granted
on that reading (PM-47). `records.detail` is written by build.py, and
`drivers.provenance` is boilerplate build.py and data/harvest.py write. The
registry and metadata tables describe this project. `team_radio.transcript` is
a quotation and is kept as one (COMMERCIAL-READINESS.md). Specification values
- `seasons.engine_formula`, `cars.suspension` and the harvested `chassis`
fields - are the short factual values ATTRIBUTION.md already reads as closer
to fact than to expression.
"""
import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB = os.path.join(ROOT, "f1.db")
OUT = os.path.join(ROOT, "docs", "prose_pass.tsv")
CACHE = os.path.join(ROOT, ".prose-pass-cache")

# The release it runs as, read from build.py rather than typed here, where
# it went stale at every release (review of #717). Read, not imported:
# importing build.py loads the whole build for one string.
with open(os.path.join(ROOT, "build.py"), encoding="utf-8") as _f:
    _VERSION = re.search(r'^VERSION = "([^"]+)"', _f.read(), re.M).group(1)
UA = (f"formula-1-data/{_VERSION} (https://github.com/Alex-Farley/formula-1-data; "
      "prose pass, PM-17)")
API = "https://en.wikipedia.org/w/api.php"

CLOSE_RUN = 8
PARA_RUN = 5
PARA_C4 = 0.25
# The evidence column quotes the matched run, cut to this many words. Enough
# to find the sentence again; not enough to be a copy of it.
QUOTE_WORDS = 12

GENERAL = ["Formula One", "History of Formula One"]

# table -> (prose columns, SQL giving the row key and the words to search on,
#           general articles for the table, SQL giving a title named by the row)
# The SQL names the key and the subject only; the prose columns are read by
# name from the table itself.
TABLES = {
    "drivers": (["notes"],
                "SELECT id, full_name || ' racing driver' FROM drivers", [], None),
    "circuits": (["characteristics", "notes"],
                 "SELECT id, name FROM circuits", [], None),
    "constructors": (["notes"],
                     "SELECT id, name || ' Formula One constructor' FROM constructors", [], None),
    "seasons": (["notes"],
                "SELECT year, year || ' Formula One season' FROM seasons", [],
                "SELECT year, year || ' Formula One World Championship' FROM seasons"),
    "cars": (["concept", "innovations", "story", "outcome", "power_note"],
             "SELECT id, full_name FROM cars", [],
             "SELECT id, source FROM cars WHERE source LIKE '%wikipedia.org/wiki/%'"),
    "races": (["note"],
              "SELECT r.id, r.year || ' ' || COALESCE(r.name_used, g.name) FROM races r "
              "LEFT JOIN grands_prix g ON g.id = r.gp_id", [], None),
    "glossary": (["definition"],
                 "SELECT term, term || ' motorsport' FROM glossary",
                 ["Glossary of motorsport terms"], None),
    "regulation_changes": (["detail", "impact"],
                           "SELECT id, title || ' Formula One ' || year FROM regulation_changes",
                           ["Formula One regulations"],
                           "SELECT id, year || ' Formula One World Championship' FROM regulation_changes"),
    "regulation_limits": (["note"],
                          "SELECT id, 'Formula One ' || REPLACE(field, '_', ' ') || ' regulation' FROM regulation_limits",
                          ["Formula One regulations", "Formula One car", "Formula One engines"], None),
    "qualifying_formats": (["note"],
                           "SELECT id, 'Formula One qualifying ' || format FROM qualifying_formats",
                           ["Formula One regulations"], None),
    "personnel": (["significance"],
                  "SELECT id, full_name || ' Formula One' FROM personnel", [], None),
    "constructor_lineage": (["note"],
                            "SELECT id, entity_name || ' Formula One team' FROM constructor_lineage", [], None),
    "engine_manufacturers": (["notes"],
                             "SELECT id, name || ' Formula One engine' FROM engine_manufacturers",
                             ["Formula One engines"], None),
    "technical_innovations": (["description", "legacy"],
                              "SELECT id, innovation || ' Formula One' FROM technical_innovations",
                              ["Formula One car"], None),
    "safety_milestones": (["trigger_event", "description"],
                          "SELECT id, milestone || ' Formula One' FROM safety_milestones", [], None),
    "grands_prix": (["notes"],
                    "SELECT id, name FROM grands_prix", [], None),
    "governance": (["detail", "significance"],
                   "SELECT id, event || ' Formula One' FROM governance", [], None),
    "engine_eras": (["notes"],
                    "SELECT id, era_name || ' Formula One engine' FROM engine_eras",
                    ["Formula One engines"], None),
    "eras": (["summary", "defining_features"],
             "SELECT id, era_name || ' Formula One' FROM eras", [], None),
    "tyre_suppliers": (["notes"],
                       "SELECT id, supplier || ' Formula One tyres' FROM tyre_suppliers",
                       ["Formula One tyres"], None),
    "points_systems": (["notes"],
                       "SELECT id, 'Formula One points system ' || from_year FROM points_systems",
                       ["List of Formula One World Championship points scoring systems"], None),
    "team_radio": (["context"],
                   "SELECT t.id, r.year || ' ' || COALESCE(r.name_used, g.name) FROM team_radio t "
                   "JOIN races r ON r.id = t.race_id LEFT JOIN grands_prix g ON g.id = r.gp_id", [], None),
    "circuit_layouts": (["change_reason"],
                        "SELECT l.id, c.name FROM circuit_layouts l JOIN circuits c ON c.id = l.circuit_id",
                        [], None),
}

# The reading of every field the screen flags. reason -> (label, why, fields);
# a field is "table.column key". Nothing goes here without its reason, and
# --check fails on a flagged field that is not here or a field here that the
# screen no longer flags.
READ = {
    "name": ("original", "the shared words are a name or a title", [
        "drivers.notes antonio-fuoco", "drivers.notes callum-ilott",
        "drivers.notes cian-shields", "drivers.notes dino-beganovic",
        "drivers.notes enrico-toccacelo", "drivers.notes jake-dennis",
        "drivers.notes jan-charouz", "drivers.notes leonardo-fornaroli",
        "drivers.notes luke-browning", "drivers.notes theo-pourchaire",
        "drivers.notes victor-martins", "drivers.notes zak-osullivan",
        "drivers.notes bonnier", "drivers.notes baghetti", "circuits.characteristics madring",
        "circuits.notes anderstorp", "circuits.notes imola", "circuits.notes pedralbes",
        "circuits.notes rodriguez", "seasons.notes 1955", "seasons.notes 1963",
        "cars.innovations mercedes-w11", "cars.story vanwall-vw5", "cars.story williams-fw14",
        "races.note 1165", "glossary.definition HANS", "regulation_changes.detail 41",
        "personnel.significance masi", "grands_prix.notes mexican", "grands_prix.notes monaco",
        "grands_prix.notes swedish", "grands_prix.notes swiss", "governance.detail 4",
        "circuit_layouts.change_reason 44",
    ]),
    "fact": ("original", "the shared words state a result, a date or a record in the "
                         "ordinary words for it", [
        "drivers.notes alexandre-premat", "drivers.notes alfonso-celis-jr",
        "drivers.notes bas-leinders", "drivers.notes felipe-drugovich",
        "drivers.notes naoki-yamamoto", "drivers.notes neel-jani",
        "drivers.notes patricio-oward", "drivers.notes raffaele-marciello",
        "drivers.notes beltoise", "drivers.notes brambilla",
        "drivers.notes clark", "drivers.notes de-cesaris", "drivers.notes farina",
        "drivers.notes g-hill", "drivers.notes gethin", "drivers.notes kovalainen",
        "drivers.notes leclerc", "drivers.notes marimon", "drivers.notes mclaren-d",
        "drivers.notes ocon", "drivers.notes pace", "drivers.notes patrese",
        "drivers.notes perez", "drivers.notes scarfiotti", "drivers.notes villeneuve-j",
        "drivers.notes watson", "circuits.notes aida", "circuits.notes avus",
        "circuits.notes hockenheim", "circuits.notes jarama",
        "constructors.notes mclaren", "seasons.notes 1961", "seasons.notes 1999",
        "seasons.notes 2007", "cars.concept brabham-bt46", "cars.story brabham-bt46",
        "cars.story brawn-bgp001", "cars.story ferrari-312t", "cars.story ferrari-f2004",
        "cars.story lotus-72", "cars.story tyrrell-p34", "cars.outcome williams-fw14",
        "glossary.definition Bargeboard", "glossary.definition Cost cap",
        "regulation_changes.detail 23", "regulation_changes.detail 34",
        "regulation_changes.detail 47", "regulation_limits.note 6",
        "personnel.significance stella", "constructor_lineage.note 3",
        "constructor_lineage.note 6", "constructor_lineage.note 10",
        "constructor_lineage.note 11", "constructor_lineage.note 30",
        "safety_milestones.trigger_event 16", "eras.summary 6", "team_radio.context 1",
        "team_radio.context 4", "circuit_layouts.change_reason 22",
    ]),
    "figures": ("original", "the shared words are figures: a points scale, a capacity, "
                            "a power output", [
        "cars.power_note brabham-bt46", "cars.power_note ferrari-f2004",
        "cars.power_note mercedes-w196", "cars.power_note renault-r25",
        "cars.power_note williams-fw07", "regulation_changes.detail 2",
        "regulation_changes.detail 28", "regulation_changes.detail 32",
        "regulation_changes.detail 39", "regulation_changes.detail 59",
        "regulation_limits.note 2", "engine_eras.notes 6",
    ]),
    "stock": ("original", "the shared words are a stock phrase of English or of the sport", [
        "drivers.notes chanoch-nissany", "drivers.notes michael-ammermuller",
        "drivers.notes brabham", "drivers.notes gurney", "drivers.notes gonzalez",
        "drivers.notes von-trips", "drivers.notes bryan", "drivers.notes flaherty",
        "drivers.notes hanks", "drivers.notes parsons", "drivers.notes rathmann",
        "drivers.notes ruttman", "drivers.notes sweikert", "drivers.notes vukovich",
        "drivers.notes wallard", "drivers.notes ward", "circuits.characteristics fuji",
        "circuits.notes bahrain", "circuits.notes indianapolis", "circuits.notes monsanto",
        "circuits.notes monza", "circuits.notes nurburgring-sudschleife",
        "circuits.notes sepang", "circuits.notes zeltweg", "seasons.notes 2008",
        "cars.concept ferrari-312t", "cars.innovations renault-rs01",
        "cars.story ferrari-312b", "cars.story ferrari-500", "cars.story mercedes-w196",
        "glossary.definition Apex", "glossary.definition Blue flag",
        "glossary.definition DNPQ", "glossary.definition DNS", "glossary.definition DRS",
        "glossary.definition Downforce", "glossary.definition ERS",
        "regulation_changes.detail 24", "regulation_changes.detail 40",
        "regulation_changes.detail 46", "regulation_limits.note 12",
        "qualifying_formats.note 6", "qualifying_formats.note 8",
        "personnel.significance cooper-j", "engine_manufacturers.notes repco",
        "technical_innovations.description 21", "technical_innovations.description 22",
        "grands_prix.notes bahrain", "grands_prix.notes hungarian",
        "grands_prix.notes indianapolis-500", "governance.significance 1",
        "governance.significance 17", "points_systems.notes 2", "points_systems.notes 8",
        "circuit_layouts.change_reason 43",
    ]),
    "quote": ("original", "the shared words are a quotation both texts quote - a radio "
                          "message, a period slogan", [
        "regulation_changes.impact 8", "team_radio.context 2", "team_radio.context 5",
    ]),
    "follows": ("paraphrased", "the field follows the article's way of putting something "
                               "that could be put other ways", [
        "drivers.notes amon", "drivers.notes wolff-s",
        "constructors.notes brabham", "cars.concept lotus-78",
        "cars.concept lotus-88", "cars.innovations ferrari-312t", "cars.innovations lotus-25",
        "regulation_changes.detail 33", "technical_innovations.description 10",
    ]),
    "lifted": ("close", "a clause of the article's description, reproduced", [
        "circuits.characteristics jacarepagua",
    ]),
}


def readings():
    """(table, key, column) -> (label, why), from READ."""
    out = {}
    for reason, (lab, why, names) in READ.items():
        for name in names:
            where, _, key = name.partition(" ")
            table, _, col = where.partition(".")
            assert (table, key, col) not in out, f"{name} is read twice"
            out[(table, key, col)] = (lab, f"{reason}: {why}")
    return out


# ------------------------------------------------------------------ fetch

def _cached(name, url):
    path = os.path.join(CACHE, hashlib.sha1(name.encode("utf-8")).hexdigest() + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.loads(r.read().decode("utf-8", "replace"))
            time.sleep(0.1)
            break
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 3:
                time.sleep(2 ** (attempt + 2))
                continue
            raise
        except urllib.error.URLError:
            if attempt < 3:
                time.sleep(2 ** (attempt + 2))
                continue
            raise
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return data


def search(query):
    q = urllib.parse.urlencode({"action": "query", "list": "search", "srsearch": query,
                                "srlimit": 3, "srnamespace": 0, "format": "json"})
    data = _cached("search:" + query, API + "?" + q)
    return [h["title"] for h in data.get("query", {}).get("search", [])]


def article(title):
    """(resolved title, revision id, plain text), or None for a missing page."""
    q = urllib.parse.urlencode({"action": "query", "prop": "extracts|revisions",
                                "explaintext": 1, "rvprop": "ids", "redirects": 1,
                                "titles": title, "format": "json"})
    data = _cached("article:" + title, API + "?" + q)
    for page in data.get("query", {}).get("pages", {}).values():
        if "missing" in page or "extract" not in page:
            return None
        return page["title"], page["revisions"][0]["revid"], page["extract"]
    return None


# ------------------------------------------------------------------ measure

_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"',
                         "–": "-", "—": "-", " ": " "})


def words(text):
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?", (text or "").translate(_QUOTES).lower())


class Article:
    def __init__(self, title, revid, text):
        self.title, self.revid = title, revid
        self.words = words(text)
        self.vocab = set(self.words)
        # Runs are found from shared word pairs: indexing single words would
        # walk every "the" in a long article for every "the" in a field.
        self.at = {}
        for i in range(len(self.words) - 1):
            self.at.setdefault((self.words[i], self.words[i + 1]), []).append(i)
        self.grams4 = {tuple(self.words[i:i + 4]) for i in range(len(self.words) - 3)}

    def longest_run(self, field):
        best, where = 0, 0
        for i, w in enumerate(field):
            if not best and w in self.vocab:
                best, where = 1, i
            for p in self.at.get(tuple(field[i:i + 2]), ()):
                n = 0
                while (i + n < len(field) and p + n < len(self.words)
                       and field[i + n] == self.words[p + n]):
                    n += 1
                if n > best:
                    best, where = n, i
        return best, where

    def c4(self, field):
        grams = [tuple(field[i:i + 4]) for i in range(len(field) - 3)]
        if not grams:
            return 0.0
        return sum(g in self.grams4 for g in grams) / len(grams)


def label(run, c4):
    if run >= CLOSE_RUN:
        return "close"
    if run >= PARA_RUN or c4 >= PARA_C4:
        return "paraphrased"
    return "original"


def sha(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]


# ------------------------------------------------------------------ the pass

def fields(con):
    """Every (table, key, column, text) in scope, in table and key order."""
    for table, (cols, _, _, _) in TABLES.items():
        pk = [c[1] for c in con.execute(f'PRAGMA table_info("{table}")') if c[5]][0]
        for col in cols:
            for key, text in con.execute(
                    f'SELECT "{pk}", "{col}" FROM "{table}" '
                    f"WHERE \"{col}\" IS NOT NULL AND TRIM(\"{col}\") <> '' ORDER BY \"{pk}\""):
                yield table, str(key), col, text


def candidates(con):
    """(table, key) -> the article titles the row is compared against."""
    out = {}
    for table, (_, subject_sql, general, title_sql) in TABLES.items():
        named = {}
        if title_sql:
            for key, t in con.execute(title_sql):
                t = t.split("/wiki/", 1)[1] if "/wiki/" in t else t
                named[str(key)] = [urllib.parse.unquote(t).replace("_", " ")]
        for key, query in con.execute(subject_sql):
            titles = named.get(str(key), []) + search(query) + general + GENERAL
            out[(table, str(key))] = list(dict.fromkeys(titles))
    return out


def run_pass(con):
    cands = candidates(con)
    read = readings()
    loaded = {}

    def get(title):
        if title not in loaded:
            got = article(title)
            loaded[title] = Article(*got) if got else None
        return loaded[title]

    rows = []
    for table, key, col, text in fields(con):
        field = words(text)
        best = (0, 0.0, None, 0)
        for title in cands.get((table, key), GENERAL):
            a = get(title)
            if a is None:
                continue
            run, where = a.longest_run(field)
            c4 = a.c4(field)
            if (run, c4) > best[:2]:
                best = (run, c4, a, where)
        run, c4, a, where = best
        # Labelled on the figure the file records, so --check can rederive it.
        c4 = float(f"{c4:.2f}")
        screen = label(run, c4)
        lab, basis, why = screen, "auto", ""
        if (table, key, col) in read:
            lab, why = read[(table, key, col)]
            basis = "read"
        quote = " ".join(field[where:where + min(run, QUOTE_WORDS)]) if run >= PARA_RUN else ""
        rows.append([table, key, col, lab, basis, screen, str(run), f"{c4:.2f}",
                     a.title if a else "", str(a.revid) if a else "", quote, why, sha(text)])
    return rows


HEADER = ["table", "key", "column", "label", "basis", "screen", "run", "c4",
          "article", "revid", "shared_words", "why", "text_sha"]


def write(rows, version):
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("# Generated by tools/prose_pass.py - the prose pass, PM-17 (#249). "
                "Do not edit by hand; declare a reading in READ there.\n")
        f.write(f"# Measured against f1.db v{version} and the Wikipedia revision in `revid`.\n")
        f.write(f"# screen: close = a shared run of {CLOSE_RUN}+ words; paraphrased = a run of "
                f"{PARA_RUN}+ or c4 >= {PARA_C4}; original = neither. Every field the screen "
                "flags is read (basis=read), and `label` is the reading.\n")
        f.write("\t".join(HEADER) + "\n")
        for r in rows:
            f.write("\t".join(v.replace("\t", " ").replace("\n", " ") for v in r) + "\n")


def read_labels():
    if not os.path.exists(OUT):
        return {}
    with open(OUT, encoding="utf-8") as f:
        lines = [ln.rstrip("\n").split("\t") for ln in f if not ln.startswith("#")]
    head, body = lines[0], lines[1:]
    return {(r[0], r[1], r[2]): dict(zip(head, r)) for r in body}


def unread(rows):
    """Flagged fields with no reading, and readings of fields the screen passed."""
    read = readings()
    flagged = {(r[0], r[1], r[2]) for r in rows if r[5] != "original"}
    return ([f"{t}.{c} {k}" for t, k, c in sorted(flagged - set(read))],
            [f"{t}.{c} {k}" for t, k, c in sorted(set(read) - flagged)])


def check(con):
    held = read_labels()
    stale, missing, seen = [], [], set()
    for table, key, col, text in fields(con):
        seen.add((table, key, col))
        r = held.get((table, key, col))
        if r is None:
            missing.append(f"{table}.{col} {key}")
        elif r["text_sha"] != sha(text):
            stale.append(f"{table}.{col} {key}")
    gone = [f"{t}.{c} {k}" for (t, k, c) in held if (t, k, c) not in seen]
    rows = [[r[h] for h in HEADER] for r in held.values()]
    not_read, not_flagged = unread(rows)
    # A label in the file is what READ says for a read field and what the
    # screen says for any other, and the screen is what the file's own run and
    # c4 give. A hand edit to the file, or a change to READ without a rerun,
    # fails here rather than standing as evidence.
    read, drifted = readings(), []
    for (t, k, c), r in held.items():
        want = read.get((t, k, c), (r["screen"], ""))
        basis = "read" if (t, k, c) in read else "auto"
        if ((r["label"], r["why"], r["basis"]) != (want[0], want[1], basis)
                or r["screen"] != label(int(r["run"]), float(r["c4"]))):
            drifted.append(f"{t}.{c} {k}")
    for name, items in (("changed since labelled", stale), ("never labelled", missing),
                        ("no longer in the database", gone),
                        ("flagged by the screen and not read", not_read),
                        ("read but not flagged by the screen", not_flagged),
                        ("label disagrees with READ or the screen", drifted)):
        print(f"{len(items):5d} {name}" + (": " + ", ".join(items[:8]) if items else ""))
    return not (stale or missing or gone or not_read or not_flagged or drifted)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--check", action="store_true",
                    help="report stale and missing labels without fetching anything")
    args = ap.parse_args()
    con = sqlite3.connect(DB)
    if args.check:
        sys.exit(0 if check(con) else 1)
    rows = run_pass(con)
    version = con.execute("SELECT value FROM meta WHERE key = 'version'").fetchone()[0]
    write(rows, version)
    for what, rs in (("screen", [r[5] for r in rows]), ("labels", [r[3] for r in rows])):
        print(f"{what}: {len(rs)} fields, " + ", ".join(
            f"{rs.count(k)} {k}" for k in ("original", "paraphrased", "close")))
    not_read, not_flagged = unread(rows)
    for name, items in (("flagged and not read", not_read),
                        ("read and not flagged", not_flagged)):
        if items:
            print(f"{len(items)} {name}: " + ", ".join(items))
    sys.exit(1 if not_read or not_flagged else 0)


if __name__ == "__main__":
    main()
