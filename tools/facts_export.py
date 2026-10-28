# -*- coding: utf-8 -*-
"""
The CC BY 4.0 facts artefact, written: piece 3 of PD-41 (PD-54, #742).

    python3 tools/facts_export.py                       # f1.db -> f1-facts.db
    python3 tools/facts_export.py --db f1.db --out f1-facts.db

Reads:   f1.db; F1DB's files in harvest/, through tools/facts_artefact.py
Writes:  f1-facts.db (or --out), through a .tmp beside it that replaces it
         only once every check below has passed

What it writes
--------------
tools/facts_artefact.py declares the set - which tables, which of their rows
and columns, and which values are rebuilt from F1DB - and verify.py's THE
FACTS ARTEFACT section holds the declaration. This writes exactly that set
and nothing else: it decides nothing about what goes out. Its own steps:

  schema    each carried table's CREATE TABLE as f1.db stores it, less the
            columns left out and the table constraints that name one. The
            columns in NULLABLE lose their NOT NULL. Indexes and views follow
            where every table and column they read is carried; the rest are
            left out. Every comment goes from all of them: schema.sql's
            commentary is about f1.db.
  rows      each table's declared rows, in key order, with rebuild()'s value
            in place of the stored one wherever it gives one.
  recount   the figures RECOUNTED names, counted again from the file's own
            rows by build.py's rule, so the file agrees with itself.
  meta      the file's own: f1.db's version, build date and current season,
            CC BY 4.0, and what it is. f1.db's meta states f1.db's terms and is not carried.

Then it opens what it wrote and refuses it - exit 1, nothing left at --out -
unless its tables and columns are the declared set, every source_id a row
cites names a source carried, each table holds the rows the declaration
selects (records, counted again, aside), its table_provenance names only
tables it holds and no source its own registry calls share-alike, meta
states CC BY 4.0 and holds every key a view reads, no key in it dangles and
SQLite finds it sound.

Why it is a release asset and not committed
-------------------------------------------
It is a pure function of three things the repository already commits - f1.db,
F1DB's files in harvest/ and this code - so a committed copy would add no
information, only a second database of nearly f1.db's size that does not
delta-compress, rewritten in git history by every refresh. f1_database.json
left git for the same reason. The release builds it, digests it in SHA256SUMS
and uploads it beside f1.db and f1-geometry.db; CI builds it twice on every
run and compares the two, so that it is byte-stable across rebuilds the way
the committed databases are.
"""
import argparse
import os
import re
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
for _p in (ROOT, HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import facts_artefact as fa   # noqa: E402

DB = os.path.join(ROOT, "f1.db")
OUT = os.path.join(ROOT, "f1-facts.db")

# NOT NULL in f1.db, and NULL in the artefact where a credit is not
# established: rebuild() leaves a race's pole or fastest lap NULL where F1DB
# holds no classification of it yet, or gives no fastest lap (2021 Belgium),
# rather than a 0 saying nobody took it. f1.db's 0 there comes from the
# season harvest, which the artefact does not carry.
NULLABLE = {
    "race_entries.pole": "not established where F1DB holds no qualifying or grid for the race",
    "race_entries.fastest_lap": "not established where F1DB gives no fastest lap for the race",
}

LICENCE = "CC BY 4.0"
# F1DB's creator, named in the credit as the maintainer ruled on PD-68
# (#1020): CC BY 4.0 asks for the creators to be identified, and F1DB's
# README names him as its creator and core maintainer.
F1DB_CREATOR = "Marcel Overdijk"
LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/"


# ------------------------------------------------------------- the schema

_TOKEN = re.compile(r"""
      (?P<comment>--[^\n]*|/\*.*?\*/)
    | (?P<string>'(?:[^']|'')*')
    | (?P<quoted>"(?:[^"]|"")*"|`[^`]*`|\[[^\]]*\])
    | (?P<space>\s+)
    | (?P<word>[A-Za-z_][A-Za-z0-9_$]*)
    | (?P<other>.)
""", re.X | re.S)


def _tokens(sql):
    """(kind, text) for every token of a statement, comments dropped and
    whitespace kept as one space."""
    out = []
    for m in _TOKEN.finditer(sql):
        kind = m.lastgroup
        if kind == "comment":
            kind, text = "space", " "
        else:
            text = " " if kind == "space" else m.group()
        if kind == "space" and out and out[-1][0] == "space":
            continue
        out.append((kind, text))
    return out


def _name(kind, text):
    """An identifier token as the name it spells, or None."""
    if kind == "word":
        return text.lower()
    if kind == "quoted":
        return text[1:-1].replace('""', '"').lower()
    return None


def _text(tokens):
    return "".join(t for _, t in tokens).strip()


def _uncommented(sql):
    """A statement without its comments: f1.db's are about f1.db."""
    return _text(_tokens(sql))


def split_table(sql):
    """CREATE TABLE text -> (head, [definition tokens]), where head is the
    text before the opening parenthesis and each definition is one column
    or table constraint, split on the commas at depth one."""
    toks = _tokens(sql)
    depth, start, parts, head = 0, None, [], None
    for i, (kind, text) in enumerate(toks):
        if kind != "other":
            continue
        if text == "(":
            depth += 1
            if depth == 1:
                head, start = _text(toks[:i]), i + 1
        elif text == ")":
            depth -= 1
            if depth == 0:
                parts.append(toks[start:i])
                rest = _text(toks[i + 1:])
                if rest:
                    raise ValueError(f"text after the column list: {rest!r}")
                return head, parts
        elif text == "," and depth == 1:
            parts.append(toks[start:i])
            start = i + 1
    raise ValueError("unbalanced parentheses")


CONSTRAINT_WORDS = {"constraint", "primary", "unique", "check", "foreign"}


def _drop_not_null(tokens):
    """The definition without its NOT NULL, at the column's own level."""
    out, depth, i = [], 0, 0
    while i < len(tokens):
        kind, text = tokens[i]
        depth += (text == "(") - (text == ")") if kind == "other" else 0
        if depth == 0 and _name(kind, text) == "not":
            j = i + 1
            while j < len(tokens) and tokens[j][0] == "space":
                j += 1
            if j < len(tokens) and _name(*tokens[j]) == "null":
                i = j + 1
                continue
        if not (tokens[i][0] == "space" and out and out[-1][0] == "space"):
            out.append(tokens[i])
        i += 1
    return out


def table_ddl(sql, columns, keep, tables, nullable=()):
    """f1.db's CREATE TABLE for one table, carrying only the columns in
    `keep` of its `columns`. A table constraint naming a column left out, or
    a table not in `tables`, goes with it; a column definition referencing a
    table left out is a declaration that has not dropped the column, and is
    refused. `nullable` names the kept columns that lose NOT NULL."""
    head, parts = split_table(sql)
    columns = {c.lower() for c in columns}
    keep = {c.lower() for c in keep}
    tables = {t.lower() for t in tables}
    nullable = {c.lower() for c in nullable}
    defs, seen = [], set()
    for part in parts:
        words = [(k, t) for k, t in part if k != "space"]
        if not words:
            continue
        first = _name(*words[0])
        refs = {_name(*words[i + 1]) for i, (k, t) in enumerate(words[:-1])
                if _name(k, t) == "references"}
        if words[0][0] == "word" and first in CONSTRAINT_WORDS:
            # Of the identifiers in it, the ones that are this table's
            # columns must all be carried; keywords and functions are not.
            named = {_name(k, t) for k, t in words} & columns
            if refs - tables or named - keep:
                continue
            defs.append(_text(part))
            continue
        if first not in keep:
            continue
        if refs - tables:
            raise SystemExit(f"{first} references {', '.join(sorted(refs - tables))}, "
                             "which the facts artefact leaves out, and is carried")
        seen.add(first)
        defs.append(_text(_drop_not_null(part) if first in nullable else part))
    missing = keep - seen
    if missing:
        raise SystemExit(f"columns to carry with no definition: {', '.join(sorted(missing))}")
    return head + " (\n    " + ",\n    ".join(defs) + "\n)"


def _order(con, table):
    """The table's key, for a row order that does not depend on how f1.db
    happens to store it."""
    pk = sorted((c[5], c[1]) for c in con.execute(f'PRAGMA table_info("{table}")') if c[5])
    return ", ".join(f'"{c}"' for _, c in pk) if pk else "rowid"


# ------------------------------------------------------------- the rows

def copy_rows(src, dst, table, d, rebuilt):
    """The declared rows of one table into the artefact, rebuild()'s values
    in place of the stored ones. Returns the number written."""
    cols = d["columns"]
    where = f" WHERE {d['where']}" if d["where"] else ""
    # rebuild() keys a rebuilt row by its id and a claimed cell by the claim's
    # row_key, which is TEXT: one row can be under both, so they are merged
    # by the id as text, and two values for one cell are refused.
    over = {}
    for k, vals in rebuilt.get(table, {}).items():
        merged = over.setdefault(str(k), {})
        for c, v in vals.items():
            if c in merged and merged[c] != v:
                raise SystemExit(f"{table} {k}: rebuild() gives {c} two values")
            merged[c] = v
    if over and "id" not in cols:
        raise SystemExit(f"{table}: rebuild() gives values by id, and the table carries none")
    stray = sorted({c for v in over.values() for c in v} - set(cols))
    if stray:
        raise SystemExit(f"{table}: rebuild() gives {', '.join(stray)}, which is not carried")
    at = {c: i for i, c in enumerate(cols)}
    applied = set()
    rows = []
    for row in src.execute(f'SELECT {", ".join(chr(34) + c + chr(34) for c in cols)} '
                           f'FROM "{table}"{where} ORDER BY {_order(src, table)}'):
        vals = over.get(str(row[at["id"]])) if over else None
        if vals is not None:
            row = list(row)
            for c, v in vals.items():
                row[at[c]] = v
            applied.add(str(row[at["id"]]))
        rows.append(row)
    unapplied = sorted(set(over) - applied)
    if unapplied:
        raise SystemExit(f"{table}: rebuild() gives values for {len(unapplied)} rows the "
                         f"declaration does not carry: {', '.join(unapplied[:6])}")
    marks = ",".join("?" * len(cols))
    dst.executemany(f'INSERT INTO "{table}" VALUES ({marks})', rows)
    return len(rows)


# ------------------------------------------------------------- the recount

def _counted(target, credit):
    """build.py's rule for a career count of a credit: the rows of
    race_entries crediting it, by the table's key. drivers.poles counts
    race_entries.pole = 1 by driver_id."""
    table, column = target.split(".")
    key = table[:-1] + "_id"
    flag = credit.split(".")[1]
    return table, column, (f"SELECT COUNT(*) FROM race_entries e "
                           f'WHERE e."{key}" = "{table}".id AND e."{flag}" = 1')


def recount(src, dst):
    """RECOUNTED, from the artefact's own rows. Each count is first run on
    f1.db and must give what build.py stored there, so the rule here is
    build.py's and not a second one that agrees by accident. Returns the
    records left out."""
    for target, credit in fa.RECOUNTED.items():
        if "." not in target:
            continue
        table, column, sql = _counted(target, credit)
        off = src.execute(f'SELECT COUNT(*) FROM "{table}" '
                          f'WHERE "{column}" IS NOT ({sql})').fetchone()[0]
        if off:
            raise SystemExit(f"{target}: the recount's rule gives another figure than "
                             f"build.py stored on {off} rows of f1.db")
        dst.execute(f'UPDATE "{table}" SET "{column}" = ({sql})')
    if "records" in fa.RECOUNTED:
        return sorted(recount_records(src, dst))
    return []


def recount_records(src, dst):
    """The records table, derived again by build.py's definitions over the
    artefact's rows. A record whose definition reads a table the artefact
    leaves out is left out with it. Each row keeps f1.db's id, family and
    headline for its key, and carries no detail (UNGRANTED)."""
    import build
    carried = {t for (t,) in dst.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    leave = {k for k, reads in RECORDS_READ.items() if not set(reads) <= carried}
    rows = build.derive_records(dst.cursor(), leave_out=leave)
    stored = {r[0]: r[1:] for r in src.execute(
        "SELECT key, id, family, headline, as_of, confidence FROM records")}
    as_of = dst.execute(
        "SELECT MAX(date_iso) FROM races WHERE status = 'completed'").fetchone()[0]
    cols = [c[1] for c in dst.execute("PRAGMA table_info(records)")]
    dst.execute("DELETE FROM records")
    for r in rows:
        if r["key"] not in stored:
            raise SystemExit(f"records: {r['key']} is derived here and not in f1.db")
        rid, family, headline, _as_of, confidence = stored[r["key"]]
        vals = dict(r, id=rid, family=family, headline=headline, as_of=as_of,
                    confidence=confidence)
        dst.execute(f"INSERT INTO records ({', '.join(cols)}) VALUES "
                    f"({', '.join('?' * len(cols))})", [vals[c] for c in cols])
    missing = sorted(set(stored) - {r["key"] for r in rows} - leave)
    if missing:
        raise SystemExit(f"records: in f1.db and not derived here: {', '.join(missing)}")
    return leave


# The records whose definitions read a table beyond those every record
# reads: the longest circuit reads circuit_layouts, the historic layouts,
# which the artefact leaves out (Wikipedia's). build.derive_records takes
# the keys to leave out.
RECORDS_READ = {
    "longest-circuit": ("circuits", "circuit_layouts", "races"),
}


# ------------------------------------------------------------- the file

# Open-Meteo's credit, with its link, and the Copernicus licence's for the
# modified ERA5 information under it, as ATTRIBUTION.md gives them.
WEATHER_CREDIT = ("Race-day air temperature, rain and wind (race_weather_modelled) are "
                  "modelled, from the Copernicus Climate Change Service's ERA5 reanalysis: "
                  "weather data by Open-Meteo.com (https://open-meteo.com/), licensed under "
                  "CC BY 4.0. Contains modified Copernicus Climate Change Service "
                  "information 2026. Neither the European Commission nor ECMWF is "
                  "responsible for any use that may be made of the Copernicus "
                  "information or data it contains.")


def _meta(src, records_out=()):
    """The artefact's own meta: f1.db's version, build date and current
    season, which it is built from (two views read the season), and its own
    terms."""
    held = dict(src.execute("SELECT key, value FROM meta "
                            "WHERE key IN ('version', 'built', 'current_season')"))
    f1db = fa.f1db_source(src)
    name, url = src.execute("SELECT source, url FROM source_registry WHERE id = ?",
                            (f1db,)).fetchone()
    # The race-day weather Open-Meteo modelled (AF-136) carries its own
    # credit, and its link, wherever it goes: this file is the one built to
    # be handed on.
    weather = src.execute("SELECT COUNT(*) FROM race_weather_modelled").fetchone()[0]
    return [
        ("database_name", "F1 facts (the CC BY 4.0 subset of f1.db)"),
        ("version", held["version"]),
        ("built", held["built"]),
        ("current_season", held["current_season"]),
        ("licence", LICENCE),
        ("licence_url", LICENCE_URL),
        ("attribution", f"Lap Ledger (https://lapledger.org), built from {name} by "
                        f"{F1DB_CREATOR} ({url}, CC BY 4.0) and the other sources its rows cite: each row's "
                        "source_id names one in source_registry"
                        + (f". {WEATHER_CREDIT}" if weather else "")),
        ("companion", "f1.db, the whole database, under CC BY-SA 4.0 as its LICENSE-DATA "
                      "says; this file is the part of it that may be offered under "
                      "CC BY 4.0"),
        ("rebuilt", "The rows of f1.db that cite a Wikipedia season article are rebuilt "
                    "here from F1DB, every race's pole and fastest-lap credits are "
                    "derived from F1DB's grid, qualifying and fastest laps, and "
                    "source_registry gives this project's own source no share-alike, "
                    "because the only writing of its own this file holds is offered "
                    "under CC BY 4.0, so some values differ from f1.db's: python3 "
                    "tools/facts_artefact.py --diff, in a checkout of the same version, "
                    "lists each one. drivers.poles, drivers.fastest_laps, "
                    "constructors.poles and records are counted again from this file's "
                    "own rows"
                    + (f", and these records, whose definitions read a table this file "
                       f"leaves out, are not in it: {', '.join(records_out)}."
                       if records_out else ".")),
        ("declaration", "tools/facts_artefact.py names every table and column this file "
                        "leaves out, and why: https://github.com/Alex-Farley/"
                        "formula-1-data/blob/main/tools/facts_artefact.py"),
    ]


def write(src, path):
    """Write the artefact to `path` from the open f1.db `src`. Returns
    {"tables": {table: rows}, "views": [...], "views_out": [...],
    "indexes": [...], "records_out": [...]}."""
    decl = fa.declare(src)
    undeclared = sorted(t for t, d in decl.items() if d["rows"] is None)
    if undeclared:
        raise SystemExit(f"tables with no declared place: {', '.join(undeclared)} (verify.py)")
    carried = sorted(t for t, d in decl.items() if d["rows"] not in (None, "none"))
    for name in NULLABLE:
        t, c = name.split(".")
        info = {x[1]: x[3] for x in src.execute(f'PRAGMA table_info("{t}")')}
        if not info.get(c) or c not in decl.get(t, {}).get("columns", ()):
            raise SystemExit(f"NULLABLE names {name}, which is not a carried NOT NULL column")
    rebuilt = fa.rebuild(src)

    if os.path.exists(path):
        os.remove(path)
    dst = sqlite3.connect(path)
    master = src.execute("SELECT type, name, tbl_name, sql FROM sqlite_master "
                         "WHERE sql IS NOT NULL ORDER BY rowid").fetchall()
    ddl = {n: s for k, n, _t, s in master if k == "table"}
    report = {"tables": {}, "views": [], "views_out": [], "indexes": []}

    meta_cols = [c[1] for c in src.execute("PRAGMA table_info(meta)")]
    dst.execute(table_ddl(ddl["meta"], meta_cols, meta_cols, ["meta"]))
    for t in carried:
        cols = [c[1] for c in src.execute(f'PRAGMA table_info("{t}")')]
        dst.execute(table_ddl(ddl[t], cols, decl[t]["columns"], carried,
                              [n.split(".")[1] for n in NULLABLE if n.split(".")[0] == t]))
    for t in carried:
        report["tables"][t] = copy_rows(src, dst, t, decl[t], rebuilt)

    # An index on a column left out goes with it. Before the recount, which
    # reads race_entries by driver and constructor. An index over an
    # expression names no column for it, so it is created and kept where
    # SQLite resolves every name the expression reads.
    for kind, name, t, sql in master:
        if kind != "index" or t not in carried:
            continue
        cols = [c[2] for c in src.execute(f'PRAGMA index_info("{name}")')]
        if any(c is not None and c not in decl[t]["columns"] for c in cols):
            continue
        try:
            dst.execute(_uncommented(sql))
            report["indexes"].append(name)
        except sqlite3.OperationalError as e:
            if "no such column" not in str(e):
                raise

    # Views read the tables, so they come before the recount, which reads
    # v_standings_final. A view reading anything left out is left out; the
    # SELECT is what makes SQLite resolve every name it reads.
    for kind, name, _t, sql in master:
        if kind != "view":
            continue
        try:
            dst.execute(_uncommented(sql))
            dst.execute(f'SELECT * FROM "{name}" LIMIT 0').fetchall()
            report["views"].append(name)
        except sqlite3.OperationalError as e:
            if "no such" not in str(e):
                raise
            dst.execute(f'DROP VIEW IF EXISTS "{name}"')
            report["views_out"].append(name)

    report["records_out"] = recount(src, dst)
    dst.executemany("INSERT INTO meta VALUES (?, ?)", _meta(src, report["records_out"]))

    dst.commit()
    dst.execute("VACUUM")
    dst.commit()
    dst.close()
    return report


# ------------------------------------------------------------- the checks

def self_description(con):
    """Where the file's own registry and provenance, read from the file,
    contradict it: a table_provenance row about a table it does not hold, or
    naming a source its registry calls share-alike, which its CC BY 4.0 says
    it holds none of (PD-67). [failure, ...]"""
    tables = {t for (t,) in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if not {"table_provenance", "source_registry"} <= tables:
        return []
    bad = []
    stray = sorted(t for (t,) in con.execute("SELECT tbl FROM table_provenance")
                   if t not in tables)
    if stray:
        bad.append(f"table_provenance describes tables the file does not hold: {', '.join(stray)}")
    alike = [f"{t} ({s})" for t, s in con.execute(
        "SELECT p.tbl, p.source_id FROM table_provenance p "
        "JOIN source_registry r ON r.id = p.source_id WHERE r.share_alike "
        "ORDER BY p.tbl")]
    if alike:
        bad.append("table_provenance names a source the file's registry calls share-alike: "
                   + ", ".join(alike))
    return bad


def check(src, path):
    """What the written file holds, read back from it: [failure, ...]."""
    decl = fa.declare(src)
    carried_src = fa.carried_sources(src)
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    bad = []
    tables = {t for (t,) in con.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")}
    want = {t for t, d in decl.items() if d["rows"] not in (None, "none")} | {"meta"}
    if tables != want:
        bad.append("tables not the declared set: "
                   + ", ".join(sorted(f"+{t}" for t in tables - want)
                               + sorted(f"-{t}" for t in want - tables)))
    for t in sorted(tables & want - {"meta"}):
        cols = [c[1] for c in con.execute(f'PRAGMA table_info("{t}")')]
        if cols != decl[t]["columns"]:
            bad.append(f"{t}: columns {cols} are not the declared {decl[t]['columns']}")
        where = f" WHERE {decl[t]['where']}" if decl[t]["where"] else ""
        n = src.execute(f'SELECT COUNT(*) FROM "{t}"{where}').fetchone()[0]
        m = con.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        if t != "records" and n != m:
            bad.append(f"{t}: {m} rows, and the declaration carries {n}")
        # The registry's own tables name sources rather than cite them.
        if "source_id" in cols and t not in fa.APPARATUS:
            stray = [s for (s,) in con.execute(f'SELECT DISTINCT source_id FROM "{t}"')
                     if s not in carried_src]
            if stray:
                bad.append(f"{t}: rows cite sources the artefact may not carry: {stray}")
    bad += self_description(con)
    fom = sorted(tables & set(fa.FOM_TABLES))
    if fom:
        bad.append(f"FOM's timing tables are in the file: {', '.join(fom)}")
    licence = con.execute("SELECT value FROM meta WHERE key = 'licence'").fetchone()
    if not licence or licence[0] != LICENCE:
        bad.append(f"meta.licence is {licence and licence[0]!r}, not {LICENCE!r}")
    # A view reading a meta key the file does not hold still resolves, and
    # answers wrongly: v_current_grid reads current_season.
    keys = {k for (k,) in con.execute("SELECT key FROM meta")}
    for name, sql in con.execute("SELECT name, sql FROM sqlite_master WHERE type = 'view'"):
        if re.search(r"\bmeta\b", sql):
            lost = sorted(set(re.findall(r"\bkey\s*=\s*'([^']+)'", sql)) - keys)
            if lost:
                bad.append(f"view {name} reads meta keys the file does not hold: {lost}")
    fk = con.execute("PRAGMA foreign_key_check").fetchall()
    if fk:
        bad.append(f"{len(fk)} keys name a row the file does not hold: {fk[:4]}")
    ok = con.execute("PRAGMA integrity_check").fetchone()[0]
    if ok != "ok":
        bad.append(f"integrity_check: {ok}")
    con.close()
    return bad


# ------------------------------------------------------------- the command

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--db", default=DB, help="the f1.db to read (default: the checkout's)")
    ap.add_argument("--out", default=OUT, help="where to write it (default: f1-facts.db)")
    args = ap.parse_args()
    src = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    tmp = args.out + ".tmp"
    # A refusal leaves no file at --out, not even an earlier build's, so
    # nothing after it can take a stale copy for this one.
    try:
        report = write(src, tmp)
        bad = check(src, tmp)
    except BaseException:
        for p in (tmp, args.out):
            if os.path.exists(p):
                os.remove(p)
        raise
    if bad:
        for p in (tmp, args.out):
            if os.path.exists(p):
                os.remove(p)
        for b in bad:
            print(f"  FAIL {b}")
        raise SystemExit(f"facts artefact refused: {len(bad)} failures; nothing written")
    os.replace(tmp, args.out)
    rows = sum(report["tables"].values())
    print(f"  facts artefact: {args.out}, {len(report['tables'])} tables, {rows:,} rows, "
          f"{len(report['views'])} views ({len(report['views_out'])} left out), "
          f"{len(report['indexes'])} indexes"
          + (f"; records left out: {', '.join(report['records_out'])}"
             if report["records_out"] else ""))


if __name__ == "__main__":
    main()
