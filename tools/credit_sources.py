#!/usr/bin/env python3
"""
Every statement of which source supplied which table, checked against the
sources the table's rows cite (AF-102).

The counts in the credits are figure spans (tools/readme_figures.py), but
which source a table comes from was typed prose, and it drifted: a credit
went on naming Wikipedia for the driver and constructor records after 733 of
915 `drivers` rows had come to cite F1DB and no `constructors` row cited
Wikipedia at all (#773), and a description of 64 rows' sources matched 15 of
them (#681). Nothing read the sentences, so nothing noticed.

A document marks a statement the way it marks a figure, naming the tables
the statement is about:

    <!-- credit:qualifying,standings -->derived from [F1DB](...)<!-- /credit -->

What is checked is the prose inside the span, not a second list beside it:
the sources it names are the names in NAMES found in its text, links read
for their text alone. Two things must hold.

  1. Every source a span names is cited by at least one row of every table
     the span lists. A credit to a source nothing in the table comes from is
     the #773 class.
  2. Every source citing more than SHARE of a table's rows is named by some
     span listing that table under the same `## ` heading. A statement may
     run over several sentences - the attribution text credits `drivers` to
     F1DB, formula1.com and Wikipedia in three - but a section that credits
     a table at all credits the sources most of it comes from.

A row's source is its `source_id`, which the build resolves from its
`source` through `source_patterns`; a table with no such column takes the
one `table_provenance` gives it. Registry entries are grouped by the name
the prose uses for them, which is the registry's own `domains` - every
formula1.com section is formula1.com, every Wikipedia article is Wikipedia -
because a credit names a publisher, and the registry's finer entries are not
always the finer source (a driver's own article resolves to entry 11,
which holds car and topic articles too). The share is per table, so a
source large in a small table is not hidden by a large one beside it in the
same span.

LICENSE-DATA's credit is the attribution text with its links and these
markers dropped, word for word (tests/test_parquet_notice.py), so checking
ATTRIBUTION.md checks it too.

    python3 tools/credit_sources.py            print each statement and what its tables cite
    python3 tools/credit_sources.py --check    exit 1 where a statement disagrees

verify.py runs the check on every build. Nothing here writes to a database.
"""
import os
import re
import sqlite3
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "f1.db")
DOCUMENTS = (os.path.join(ROOT, "ATTRIBUTION.md"),)

# <!-- credit:table,table -->prose<!-- /credit -->. Non-greedy and DOTALL, as
# the figure spans are: a statement runs over line breaks, and two on a line
# stay two.
SPAN = re.compile(r"<!-- credit:([a-z0-9_,]+) -->(.*?)<!-- /credit -->", re.DOTALL)
# Anything that looks like a credit marker. A marker SPAN does not read - a
# space after the colon, a capital, a lost closing tag - would otherwise drop
# its statement from the check without a word.
MARKER = re.compile(r"<!--\s*/?\s*credit", re.IGNORECASE)
# The key a row with no source_id is counted under.
UNRESOLVED = "rows with no source_id"
LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")

# Above this share of a table's rows, a source must be named wherever the
# table is credited. A tenth: the classification's Wikipedia winner rows (4%)
# and the formula1.com rows of the race calendar (6%) are a detail of their
# tables rather than where they come from; formula1.com's 13% of `drivers` is
# not.
SHARE = 0.10

# The name a credit uses for a source -> the token in `source_registry.domains`
# that marks the registry entries it stands for. AUTHORED stands for the
# entries whose authority is 'authored', which have no domain.
AUTHORED = object()
NAMES = {
    "F1DB": "f1db",
    "Wikipedia": "en.wikipedia.org",
    "Wikimedia Commons": "commons.wikimedia.org",
    "OpenStreetMap": "openstreetmap.org",
    "formula1.com": "formula1.com",
    "FIA": "fia.com",
    "Jolpica": "jolpica",
    "OpenF1": "openf1.org",
    "FastF1": "fastf1",
    "written for this project": AUTHORED,
}


def named(text):
    """The names in NAMES a piece of prose uses, links read as their text."""
    text = " ".join(LINK.sub(r"\1", text).split())
    return {name for name in NAMES
            if re.search(rf"(?<![\w.]){re.escape(name)}(?!\w)", text, re.IGNORECASE)}


def statements(text):
    """(heading, tables, names) for each span, in document order. The heading
    is the `## ` heading the span sits under, '' before the first."""
    heading, out, at = "", [], 0
    for m in SPAN.finditer(text):
        for line in text[at:m.start()].splitlines():
            if line.startswith("## "):
                heading = line[3:].strip()
        at = m.end()
        tables = [t for t in m.group(1).split(",") if t]
        out.append((heading, tables, named(m.group(2))))
    return out


def registry_names(con):
    """source_registry id -> the name in NAMES it stands for, or None."""
    out = {}
    for sid, authority, domains in con.execute(
            "SELECT id, authority, domains FROM source_registry"):
        tokens = {d.strip() for d in (domains or "").split(",") if d.strip()}
        out[sid] = next((name for name, token in NAMES.items()
                         if (token is AUTHORED and authority == "authored")
                         or (token is not AUTHORED and token in tokens)), None)
    return out


def cited(con, table, names):
    """Counter of name -> rows of `table` citing it, with None for a registry
    entry no name stands for. None where the table does not exist or records
    no source at all."""
    if not con.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
                       (table,)).fetchone():
        return None
    cols = {r[1] for r in con.execute(f'PRAGMA table_info("{table}")')}
    if "source_id" in cols:
        rows = con.execute(f'SELECT source_id, COUNT(*) FROM "{table}" GROUP BY source_id')
    else:
        prov = con.execute("SELECT source_id FROM table_provenance WHERE tbl = ?",
                           (table,)).fetchone()
        if prov is None:
            return None
        rows = [(prov[0], con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])]
    out = Counter()
    for sid, k in rows:
        if k:
            out[UNRESOLVED if sid is None else names.get(sid)] += k
    return out


def faults(con, documents):
    """(spans read, [fault, ...]) across `documents`, {path: text}."""
    names = registry_names(con)
    found, out = 0, []
    for path, text in documents.items():
        doc = os.path.relpath(path, ROOT) if os.path.isabs(path) else path
        credited = defaultdict(set)   # (heading, table) -> names
        spans = statements(text)
        markers = len(MARKER.findall(text))
        if markers != 2 * len(spans):
            out.append(f"{doc}: {markers} credit markers, which is not an opening "
                       f"and a closing one for each of the {len(spans)} spans read")
        for heading, tables, said in spans:
            found += 1
            where = f"{doc}" + (f", {heading}" if heading else "")
            if not tables:
                out.append(f"{where}: a credit span lists no table")
            if not said:
                out.append(f"{where}: the credit for {', '.join(tables)} names no source")
            for table in tables:
                counts = cited(con, table, names)
                if counts is None:
                    out.append(f"{where}: `{table}` is not a table that records its sources")
                    continue
                credited[(heading, table)] |= said
                for name in sorted(said):
                    if not counts[name]:
                        out.append(f"{where}: credits {name} for `{table}`, "
                                   f"which no row of it cites")
        for (heading, table), said in credited.items():
            counts = cited(con, table, names)
            total = sum(counts.values())
            where = f"{doc}" + (f", {heading}" if heading else "")
            for name, k in sorted(counts.items(), key=lambda x: (-x[1], str(x[0]))):
                if k / total > SHARE and name not in said:
                    who = (name if name and name != UNRESOLVED else
                           "no source" if name else
                           "a source registry entry no name in NAMES stands for")
                    out.append(f"{where}: {who} is cited by {k:,} of {total:,} "
                               f"`{table}` rows and the credit does not name it")
    return found, out


def read(paths=DOCUMENTS):
    out = {}
    for path in paths:
        with open(path, encoding="utf-8") as f:
            out[path] = f.read()
    return out


def main(argv):
    con = sqlite3.connect(DB)
    docs = read()
    if "--check" in argv:
        found, bad = faults(con, docs)
        for line in bad:
            print(line)
        if not found:
            print("no credit span in any document")
        return 1 if bad or not found else 0
    names = registry_names(con)
    for path, text in docs.items():
        for heading, tables, said in statements(text):
            print(f"{os.path.relpath(path, ROOT)}, {heading or '(top)'}: "
                  f"{', '.join(sorted(said)) or '(no source named)'}")
            for table in tables:
                counts = cited(con, table, names)
                shown = ("not a table that records its sources" if counts is None else
                         ", ".join(f"{n or '?'} {k:,}" for n, k in counts.most_common()))
                print(f"    {table}: {shown}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
