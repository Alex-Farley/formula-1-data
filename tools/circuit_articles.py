# -*- coding: utf-8 -*-
"""
Harvest which Wikipedia article describes each circuit in the register (VD-47).

    python3 tools/circuit_articles.py                 # the list as it stands
    python3 tools/circuit_articles.py --oldid 1377015416   # a pinned revision

Reads:   en.wikipedia.org  List of Formula One circuits, one revision
         f1.db             circuits, and the completed races at each
Writes:  harvest/circuit_articles.txt  one row per circuit the list proves
         harvest/circuit_articles.log  every list row and circuit, and why
                                       one was not matched

This is the first piece of the circuit-photograph work. Nothing loads the
file yet: verify.py cross-checks it against the database on every build, and
the photograph route that will read it comes after.

Why a list, and why not the names
---------------------------------
A wrong mapping would put a photograph of the wrong place on a circuit page
under someone else's name, so the question is provenance before it is
anything else. The maintainer's ruling on 2026-09-24 was that the mapping is
harvested and verified, with its source per row, and never guessed.

The source is Wikipedia's "List of Formula One circuits". Each of its rows
links one article and states the country, the championship seasons and the
number of Grands Prix held there. Those three facts are what identify the
row, and the circuit's name plays no part: a row is matched to the circuit
in this register that has the same country and exactly the same completed
championship seasons and number of races, on or before the day of the
revision read. Names are where matching goes wrong - "Nürburgring" is two
circuits here, "Interlagos Circuit" is the Autodromo Jose Carlos Pace - and
seasons are where it cannot: three circuits held their only Grand Prix in
1959, and they are in three countries.

A row that matches no circuit, or more than one, is refused and logged. So is
a circuit two rows both claim. What the list links is taken as the list
links it, including where that is a section of a larger article - the
Bugatti Circuit is a section of the Circuit de la Sarthe article, Fair Park's
street circuit a section of the park's - because that IS the list's claim,
and the section is kept in its own column so that what reads the file later
can tell a circuit article from an article about the ground it ran on.

Two declared exceptions, both in data/harvest.py:

  CIRCUIT_ARTICLE_SPLITS  one list row that this register holds as more than
                          one circuit. The list's Nürburgring row is the
                          Nordschleife and the GP-Strecke together: its
                          seasons are the union of theirs and its 41 races
                          their sum. Wikipedia has one article for both, and
                          redirects each loop's name into a section of it.
  HISTORIC_COUNTRIES      a country the list names by the state of the day.
                          AVUS is in "West Germany" there; the register
                          holds every circuit under its modern country.

A circuit the list does not carry at all is not guessed at. It is declared in
CIRCUIT_ARTICLE_GAPS with the known_gaps row that says why, and verify.py
fails on one that is neither mapped nor declared.

What each row records, beside the article: the link as the list wrote it
(which may be a redirect), the article's Wikidata id, the country, seasons
and race count the list gives, the revision's date and a permanent link to
it. The Wikidata id is a second, independent check where one exists: for the
25 circuits data/circuits.py admits a Wikidata entity for, the article must
be that entity's.
"""
import argparse
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
sys.path.insert(0, ROOT)

import build  # noqa: E402  COUNTRY_ALIASES: the one country vocabulary
from data import harvest as H  # noqa: E402

API = "https://en.wikipedia.org/w/api.php"
LIST = "List of Formula One circuits"
UA = ("formula-1-data (https://github.com/Alex-Farley/formula-1-data; "
      "circuit-article harvest)")
DELAY = 1.0
BATCH = 50

COLUMNS = ["circuit_id", "article", "section", "linked_as", "wikidata_id",
           "country", "seasons", "held", "as_of", "source"]

# The caption of the table read. The article has a key table above it; the
# caption is what tells the two apart, and a list that renames it should stop
# this rather than have it read the wrong table.
CAPTION = "|+ Formula One circuits"

# The column order the parser relies on, as the header row states it. Checked
# on every run, because a column added to the list would otherwise shift
# every field read after it.
HEADER = ["Circuit", "Map", "Type", "Direction", "Location", "Country",
          "Last length used", "Turns", "Grands Prix", "Season(s)",
          "Grands Prix held"]


def api(**params):
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                data = json.loads(r.read().decode("utf-8"))
            time.sleep(DELAY)
            return data
        except (urllib.error.URLError, TimeoutError):
            if attempt < 5:
                time.sleep(5 * (attempt + 1))
                continue
            raise
    raise SystemExit("circuit_articles: gave up after six attempts")


def fetch_revision(oldid=None):
    params = {"action": "query", "prop": "revisions",
              "rvprop": "ids|timestamp|content", "rvslots": "main"}
    if oldid:
        params["revids"] = str(oldid)
    else:
        params["titles"] = LIST
    page = api(**params)["query"]["pages"][0]
    if page.get("title") != LIST:
        raise SystemExit(f"circuit_articles: revision {oldid} is of "
                         f"{page.get('title')!r}, not {LIST!r}")
    rev = page["revisions"][0]
    return rev["revid"], rev["timestamp"][:10], rev["slots"]["main"]["content"]


LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]*))?\]\]")
SEASON = re.compile(r"\{\{[Ff]1\|(\d{4})\}\}(?:\s*[–-]\s*\{\{[Ff]1\|(\d{4})\}\})?")


def cell_text(cell):
    """A cell's content, without a leading attribute list such as
    `bgcolor=FBCEB1|` or `align=center|`. A pipe inside a link or a template
    is not an attribute separator, so only one that comes before any of
    those is taken."""
    depth, i = 0, 0
    while i < len(cell):
        two = cell[i:i + 2]
        if two in ("[[", "{{"):
            depth += 1
            i += 2
            continue
        if two in ("]]", "}}"):
            depth -= 1
            i += 2
            continue
        if cell[i] == "|" and depth == 0:
            return cell[i + 1:].strip()
        i += 1
    return cell.strip()


def parse_list(wikitext):
    """The circuit table's rows: link target, country, seasons, races held.

    Refuses outright if the table or its header is not what it was when this
    was written, because a silently shifted column is a wrong mapping.
    """
    start = wikitext.find(CAPTION)
    if start < 0:
        raise SystemExit(f"circuit_articles: no table captioned {CAPTION!r}")
    body = wikitext[start:]
    body = body[:body.find("\n|}")]
    chunks = body.split("\n|-")
    header = [re.sub(r"^.*\|", "", h.strip("!").strip()).strip()
              for h in chunks[0].split("\n") if h.startswith("!")]
    if header != HEADER:
        raise SystemExit(f"circuit_articles: the table's columns are now "
                         f"{header}, not {HEADER}. Read the list again before "
                         f"trusting a field from it.")
    rows, refused = [], []
    for chunk in chunks[1:]:
        cells = [cell_text(line[1:]) for line in chunk.strip("\n").split("\n")
                 if line.startswith("|")]
        if not cells:
            continue
        if len(cells) != len(HEADER):
            refused.append(("row", cells[0][:60] if cells else "?",
                            f"{len(cells)} cells, expected {len(HEADER)}"))
            continue
        link = LINK.search(cells[0])
        countries = LINK.findall(cells[5])
        years = set()
        for a, b in SEASON.findall(cells[9]):
            years.update(range(int(a), int(b or a) + 1))
        held = cells[10].strip()
        if not link or not countries or not years or not held.isdigit():
            refused.append(("row", cells[0][:60],
                            "no link, country, season or count could be read"))
            continue
        target = link.group(1).strip()
        title, _, section = target.partition("#")
        rows.append({"linked_as": target, "title": title.strip(),
                     "section": section.strip() or None,
                     "country": countries[-1][0].strip(),
                     "years": years, "held": int(held)})
    return rows, refused


def resolve(titles):
    """Each linked title's article after redirects, the section a redirect
    points into, and the article's Wikidata id."""
    out = {}
    titles = sorted(set(titles))
    for i in range(0, len(titles), BATCH):
        q = api(action="query", titles="|".join(titles[i:i + BATCH]),
                redirects="1", prop="pageprops", ppprop="wikibase_item")["query"]
        norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
        redir = {r["from"]: (r["to"], r.get("tofragment"))
                 for r in q.get("redirects", [])}
        pages = {p["title"]: p for p in q["pages"]}
        for t in titles[i:i + BATCH]:
            name = norm.get(t, t)
            name, frag = redir.get(name, (name, None))
            page = pages.get(name, {})
            if page.get("missing") or page.get("ns") != 0:
                out[t] = None
                continue
            out[t] = (name, frag,
                      page.get("pageprops", {}).get("wikibase_item"))
    return out


def seasons_text(years):
    """1951-1954,1956 - short, and read back by data/harvest.py."""
    ys, spans = sorted(years), []
    for y in ys:
        if spans and y == spans[-1][1] + 1:
            spans[-1][1] = y
        else:
            spans.append([y, y])
    return ",".join(f"{a}" if a == b else f"{a}-{b}" for a, b in spans)


def register(db, as_of):
    """This register's circuits, each with its completed championship
    seasons and race count on or before the list's date."""
    con = sqlite3.connect(db)
    out = {cid: {"country": country, "years": set(), "held": 0}
           for cid, country in con.execute("SELECT id, country FROM circuits")}
    for cid, year in con.execute(
            """SELECT circuit_id, year FROM races WHERE status = 'completed'
               AND date_iso <= ?""", (as_of,)):
        out[cid]["years"].add(year)
        out[cid]["held"] += 1
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--oldid", type=int, help="a revision of the list to read")
    ap.add_argument("--db", default=os.path.join(ROOT, "f1.db"))
    args = ap.parse_args()

    revid, as_of, text = fetch_revision(args.oldid)
    rows, log = parse_list(text)
    ours = register(args.db, as_of)
    source = ("https://en.wikipedia.org/w/index.php?title="
              + urllib.parse.quote(LIST.replace(" ", "_")) + f"&oldid={revid}")

    # The units a list row may match: every circuit on its own, and each
    # declared split as the union of its circuits.
    units = [(cid,) for cid in ours]
    units += [tuple(s) for s in H.CIRCUIT_ARTICLE_SPLITS]

    def unit_facts(unit):
        countries = {ours[c]["country"] for c in unit}
        years = set().union(*(ours[c]["years"] for c in unit))
        return countries, years, sum(ours[c]["held"] for c in unit)

    resolved = resolve([r["title"] for r in rows])
    claimed = {}
    for r in rows:
        country = H.HISTORIC_COUNTRIES.get(r["country"], r["country"])
        country = build.COUNTRY_ALIASES.get(country, country)
        hits = []
        for unit in units:
            countries, years, held = unit_facts(unit)
            if countries == {country} and years == r["years"] and held == r["held"]:
                hits.append(unit)
        if len(hits) != 1:
            log.append(("row", r["linked_as"],
                        f"{len(hits)} circuits have {r['country']}, "
                        f"{seasons_text(r['years'])} and {r['held']} races"))
            continue
        if resolved.get(r["title"]) is None:
            log.append(("row", r["linked_as"], "not an article on en.wikipedia.org"))
            continue
        for cid in hits[0]:
            claimed.setdefault(cid, []).append(r)

    out = []
    for cid in sorted(ours):
        got = claimed.get(cid, [])
        if len(got) != 1:
            why = ("claimed by " + ", ".join(g["linked_as"] for g in got)) if got \
                else ("declared: known_gaps " + H.CIRCUIT_ARTICLE_GAPS[cid]
                      if cid in H.CIRCUIT_ARTICLE_GAPS else "no row on the list")
            log.append(("circuit", cid, why))
            continue
        r = got[0]
        article, frag, qid = resolved[r["title"]]
        out.append([cid, article, r["section"] or frag or "", r["linked_as"],
                    qid or "", r["country"], seasons_text(r["years"]),
                    str(r["held"]), as_of, source])

    path = os.path.join(ROOT, "harvest", "circuit_articles.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# Generated by tools/circuit_articles.py from revision {revid} "
                f"of {LIST} ({as_of}). Do not edit by hand.\n"
                "# Source: Wikipedia (CC BY-SA 4.0), source_registry 17. A row "
                "is matched on country, seasons and races held, never on the name.\n"
                "# section: the part of the article the list links, where it "
                "links a section rather than a whole article.\n"
                "# " + "|".join(COLUMNS) + "\n")
        for row in out:
            f.write("|".join(row) + "\n")
    with open(os.path.join(ROOT, "harvest", "circuit_articles.log"), "w",
              encoding="utf-8") as f:
        f.write(f"# tools/circuit_articles.py, revision {revid} ({as_of}): what "
                f"was not matched, and why.\n")
        for kind, name, why in log:
            f.write(f"{kind}|{name}|{why}\n")
    print(f"circuit_articles: {len(out)} of {len(ours)} circuits mapped from "
          f"{len(rows)} list rows; {len(log)} lines in the log")


if __name__ == "__main__":
    main()
