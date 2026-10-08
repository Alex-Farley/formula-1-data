# -*- coding: utf-8 -*-
"""
The CC BY 4.0 facts artefact's table and column set: piece 2 of PD-41 (PD-53, #741).

    python3 tools/facts_artefact.py           # the declared set, table by table
    python3 tools/facts_artefact.py --diff    # where the artefact differs from f1.db

Reads:   f1.db; F1DB's files in harvest/; docs/prose_pass.tsv, through
         tools/prose_pass.py
Writes:  nothing. PD-54 (#742) builds the file from what this declares, and
         verify.py's THE FACTS ARTEFACT section holds the declaration.

What the artefact is
--------------------
PD-41 (#481) ruled that a facts artefact is published beside f1.db under
CC BY 4.0, on the pattern of [D-07], leaving out everything that stays
share-alike; f1.db itself stays CC BY-SA 4.0. On 2026-10-08 the maintainer
ruled the route for the race rows that cite a Wikipedia season article:
they are rebuilt from F1DB, which is CC BY 4.0, so that nothing Wikipedia
made is in the file. The claims and the driver note sources that cite
Wikipedia stay out, and remain in f1.db under its licence.

How the set is found
--------------------
Nothing here lists the tables, or the columns of a table that is carried
whole. Each is derived, in this order, and a table or column the rules do
not reach is a failure in verify.py rather than a silent inclusion:

  rows      a table with `source_id` carries the rows whose source is
            redistributable and not share-alike - F1DB's, and the facts-only
            official sources'; a table with no source column takes its
            `table_provenance` row's source for the whole table; an authored
            table (source_registry's `authored` entry) is carried only if
            PM-49 granted it, which is every column the prose pass measures
            in it being in PROJECT_PROSE_COLUMNS. A table whose rows are
            keyed (NOT NULL) to a table left out is left out with it.
  columns   out of a carried table go: the prose the prose pass measures,
            unless granted; every column a `claims` row cites a share-alike
            source for; the span of columns a per-row source column governs
            (SPANS); and every column keyed to a table left out, found by
            its foreign key, or declared in KEYED where the schema has none.

Then three declarations, each with its reason, because they are judgements
and not derivations:

  RESOURCED  the tables whose share-alike rows are rebuilt from F1DB instead
             of dropped, and for each, what every one of its columns is on
             a rebuilt row. The races and race entries are the ruling; the
             drivers they name follow, because a race row naming a driver
             the artefact does not hold is not a row. Every column of these
             tables has to be classed, so a new one fails until it is.
  APPARATUS  the tables in which the database describes itself.
  UNSOURCED  the tables with neither a source nor a provenance row.
  UNGRANTED  this project's own writing outside the prose pass that PM-47
             and PM-49 did not grant CC BY 4.0. It stays CC BY-SA in f1.db,
             and out of the artefact.

`rebuild()` computes every value the artefact holds that is not f1.db's as
stored: the race rows' keys, names and circuits from F1DB's grand prix and
layout, the winners' classification from F1DB's, the pole and fastest-lap
credits on every row by rule from F1DB, and the drivers the season articles
introduced from F1DB's register. `differences()` says where that leaves the
artefact unlike f1.db, which verify.py compares with what the rules predict.

This is an analysis of what the artefact holds, not the artefact. It
relicenses nothing: until PD-54 ships the file, every row in f1.db is
CC BY-SA 4.0 as LICENSE-DATA says.
"""
import argparse
import os
import re
import sqlite3
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB = os.path.join(ROOT, "f1.db")
for _p in (ROOT, HERE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from data import current as _N   # noqa: E402
from data import harvest as HV   # noqa: E402
import prose_pass as _PP         # noqa: E402

# ----------------------------------------------------------- declarations

# The ruling of 2026-10-08 on PD-53: the race rows that cite Wikipedia are
# rebuilt from F1DB. For each table, what each column is on a rebuilt row:
#
#   key      the row's identity, which is the same on both sides
#   f1db     F1DB's value, taken from its files by rebuild()
#   rule     derived from F1DB's values by a rule written in rebuild()
#   project  this project's own classification of the row, not a value any
#            source gave it (a status, a confidence)
#   linkage  this project's link from the row to F1DB's own registers
#   claimed  a value a `claims` row cites a source the artefact carries for,
#            row by row, which verify.py holds
#   counted  derived from the race rows, which PD-54 counts again from the
#            artefact's own (RECOUNTED)
#   null     not established on these rows: F1DB does not give it, and
#            nothing is taken from the stored row instead
#   cited    the row's source, which on a rebuilt row is F1DB
#
# A column left out of the artefact altogether is not classed here; the
# rules above find it.
RESOURCED = {
    "races": {
        "why": "the ruling of 2026-10-08: the season articles' race rows are rebuilt "
               "from F1DB; every other table of results is keyed to them",
        "columns": {
            "id": "key", "year": "key", "round": "key",
            "gp_id": "rule", "name_used": "rule", "circuit_id": "rule",
            "f1db_layout_id": "f1db", "date_iso": "f1db", "sprint": "f1db",
            "date_from": "null", "date_to": "null",
            "status": "project", "on_f1db_calendar": "project", "confidence": "project",
            "source": "cited", "source_id": "cited",
        },
    },
    "race_entries": {
        "why": "the ruling of 2026-10-08: the winners the season articles established "
               "are rebuilt from F1DB's classification",
        "columns": {
            "id": "key", "race_id": "key", "driver_id": "key",
            "constructor_id": "f1db", "grid": "f1db", "grid_text": "f1db",
            "finish_position": "f1db", "position_text": "f1db", "shared_drive": "f1db",
            "classified": "f1db", "status": "f1db", "laps_completed": "f1db",
            "points": "f1db",
            "pole": "rule", "fastest_lap": "rule", "fastest_lap_shared": "rule",
            "chassis_id": "linkage",
            # Wikipedia's house style, the constructor and the engine as the
            # season article writes them. F1DB holds both as ids and the
            # snapshot names its constructors but not its engine makers, so
            # no rule can write the string from F1DB, and the ruling carries
            # nothing of the article's (the measurement, COMMERCIAL-READINESS).
            "entrant": "null",
            "confidence": "project", "source": "cited", "source_id": "cited",
        },
    },
    "drivers": {
        "why": "the drivers a season article or the polesitters' list introduced: the "
               "race rows rebuilt from F1DB name them, and F1DB's register holds every one",
        "columns": {
            "id": "key", "f1db_id": "key",
            "full_name": "rule", "nationality": "rule", "nationality_code": "rule",
            "born": "f1db", "died": "f1db",
            "abbreviation": "f1db", "permanent_number": "f1db",
            "place_of_birth": "f1db", "country_of_birth": "f1db",
            "first_season": "counted", "last_season": "counted", "entries": "counted",
            "starts": "counted", "wins": "counted", "podiums": "counted",
            "poles": "counted", "fastest_laps": "counted", "career_points": "counted",
            "titles": "counted", "title_years": "counted", "status": "project",
            "practice_only": "counted", "stats_as_of": "project",
            "wins_external": "claimed", "podiums_external": "claimed",
            "poles_external": "claimed", "fastest_laps_external": "claimed",
            "confidence": "project", "source": "cited", "source_id": "cited",
        },
    },
}

CLASSES = ("key", "f1db", "rule", "project", "linkage", "claimed", "counted", "null", "cited")

# Where a rebuilt driver's value is F1DB's and differs from f1.db's. Each is
# a disagreement between the two sources the artefact resolves F1DB's way,
# because the route is F1DB's; f1.db keeps its own.
DRIVER_DIFFERENCES = {
    ("gachot", "nationality"): "F1DB gives France, the season article Belgium, "
                               "under whose licence he raced; PM-72 (#930)",
    ("gachot", "nationality_code"): "follows the nationality",
}

# The tables in which the database describes itself: its sources, how a
# source is recognised, the provenance of whole tables, and what a confidence
# means. They are carried, less the prose UNGRANTED names, because a row's
# source_id means nothing without them. `meta` is not carried: it states
# f1.db's version, licence and coverage, and PD-54 writes the artefact's own.
APPARATUS = {
    "source_registry": "all", "source_patterns": "all", "table_provenance": "all",
    "provenance": "all",
    "meta": "none",
}

# The four tables of FOM-owned timing, which f1.db holds empty (CLAUDE.md,
# [D-06]). They are out of the artefact by name, whatever a row in them would
# cite, so a local build with the timing loaders cannot put one in it.
FOM_TABLES = ("laps", "stints", "race_timing", "race_control_messages")

# The tables with no source column and no table_provenance row.
# Each names the columns that are this project's own identifiers and states,
# beside the prose PM-47 granted; any other column goes, so a column added
# later is out until it is named here. A discrepancy is carried only where
# the column it is about is carried, as a claim is.
UNSOURCED = {
    "discrepancies": {
        "why": "this project's record of where its sources disagree, and its reading of "
               "each; the reading is granted CC BY 4.0 (PM-47)",
        "own": ["id", "key", "kind", "subject", "tbl", "row_key", "field", "status"],
        "about": ("tbl", "field"),
    },
    "known_gaps": {
        "why": "this project's record of what it has not established; every written "
               "column is granted CC BY 4.0 (PM-47)",
        "own": ["id", "key", "field", "state", "races_affected"],
        "about": None,
    },
}

# Why the rest of an UNSOURCED table goes.
UNSOURCED_VALUES = (
    "not this project's own identifier, state or granted prose: the disagreeing values "
    "come from whichever sources the row compares - often an article - and the table "
    "holds no field-grain source for them")

# This project's writing that the prose pass does not measure and neither
# grant reaches. It stays CC BY-SA 4.0 with the rest of f1.db.
UNGRANTED = {
    "source_registry.use": "the registry's account of a source, this project's prose",
    "source_registry.licence": "the registry's account of a source's licence, this "
                               "project's prose",
    "source_registry.cadence": "the registry's account of a source, this project's prose",
    "source_registry.checkability": "the registry's account of a source, this project's prose",
    "source_patterns.note": "a note on how a source is recognised, this project's prose",
    "table_provenance.note": "a note on a table's provenance, this project's prose",
    "provenance.definition": "what each confidence tier means, this project's prose",
    "drivers.provenance": "build.py's account of how a driver entered the register",
    "drivers.external_source": "names where the external totals came from, two of "
                               "which are Wikipedia's and left out",
    "records.detail": "build.py's sentence about each record",
}

# The screen verify.py runs over every other text column the artefact
# carries: a value of more words than this is written prose, which the
# prose pass has to measure or UNGRANTED has to name before it goes out.
PROSE_WORDS = 20

# A column keyed to another table that the schema gives no foreign key.
KEYED = {
    "races.layout_key": "circuit_layouts",
}

# A per-row source column and the span of columns, in schema order, that it
# governs: chassis rows are F1DB's, and their specifications are the per-car
# article's wherever spec_source names one.
SPANS = {
    "chassis": ("spec_source", "article", "published_poles"),
}

# Derived by build.py from the credit columns the artefact rebuilds. PD-54
# counts them again from the artefact's own rows, so that the file agrees
# with itself where F1DB's fastest laps differ from f1.db's.
RECOUNTED = {
    "drivers.poles": "race_entries.pole",
    "drivers.fastest_laps": "race_entries.fastest_lap",
    "constructors.poles": "race_entries.pole",
    "records": "the whole table: build.py's record definitions, run on the artefact's own "
               "rows (one, the longest circuit, also reads circuit_layouts, which is out)",
}

# The seasons in which a sprint weekend's pole went to the fastest qualifier
# although the sprint set the race's grid, so that the car starting first was
# the sprint's winner: 2022, which credited qualifying where 2021 had credited
# the sprint (schema.sql, WHAT 'POLE' MEANS HERE: 2022 round 21). From 2023
# qualifying sets the grid at a sprint weekend too (qualifying_formats), and
# pole is the car starting first, as at any other race.
POLE_TO_FASTEST_QUALIFIER = {2022}

# A shared drive's winner row in f1.db is the driver's F1DB rows merged: the
# position-1 row and the other car's. F1DB's position-1 row leaves these
# blank where the other car's filled them, and the ruling leaves them NULL on
# a rebuilt row rather than filling them from the stored one.
SHARED_DRIVE_BLANKS = ("grid", "grid_text", "laps_completed", "status")

# The one race name F1DB's grand prix does not give: F1DB files the Mexico
# City Grand Prix under its Mexican Grand Prix and names the city only in the
# race's official title. Where the title names the city, the race takes the
# register's own name for the event held there (grands_prix.aliases).
OFFICIAL_TITLE_NAMES = {
    "Ciudad de México": "Mexico City Grand Prix",
}


# ------------------------------------------------------------- the registry

def registry(con):
    return {i: {"redistributable": r, "share_alike": s, "authority": a, "domains": d}
            for i, r, s, a, d in con.execute(
                "SELECT id, redistributable, share_alike, authority, domains "
                "FROM source_registry")}


def carried_sources(con):
    """The sources whose rows the artefact may carry as they are: may be
    redistributed, and owe no share-alike."""
    return {i for i, s in registry(con).items()
            if s["redistributable"] in ("yes", "facts-only") and not s["share_alike"]}


def f1db_source(con):
    """F1DB's registry entry, found by the token its loaders write."""
    ids = [i for i, s in registry(con).items()
           if "f1db" in (s["domains"] or "").split(",")]
    if len(ids) != 1:
        raise SystemExit(f"source_registry has {len(ids)} entries owning 'f1db'")
    return ids[0]


def granted():
    return set(_N.PROJECT_PROSE_COLUMNS)


def measured(table):
    return list(_PP.TABLES.get(table, ([],))[0])


# ------------------------------------------------------------- the declared set

def _tables(con):
    return [t for (t,) in con.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name")]


def _columns(con, table):
    return [(c[1], bool(c[3])) for c in con.execute(f'PRAGMA table_info("{table}")')]


def _fks(con, table):
    return [(f[3], f[2]) for f in con.execute(f'PRAGMA foreign_key_list("{table}")')]


def claimed_cells(con):
    """{(table, row key, column)} of every value a claim cites a source the
    artefact cannot carry for: a Wikipedia figure on a row that cites
    someone else. The artefact holds those cells NULL."""
    carried = carried_sources(con)
    return {(t, k, f) for t, k, f, sid in con.execute(
        "SELECT tbl, row_key, field, source_id FROM claims") if sid not in carried}


def declare(con):
    """{table: {"rows", "why", "resourced", "where", "columns", "dropped",
    "nulled"}}.

    rows is 'all', 'by source' or 'none', and where is the SQL condition
    selecting the rows carried as stored (None for all of them). columns is
    what the artefact carries, in schema order; dropped maps each column left
    out to why; nulled maps a carried column to why some of its cells are
    NULL. A table nothing here reaches is returned with rows None, which
    verify.py fails on.
    """
    reg = registry(con)
    carried = carried_sources(con)
    tp = dict(con.execute("SELECT tbl, source_id FROM table_provenance").fetchall())
    grant = granted()
    out = {}
    for t in _tables(con):
        cols = [c for c, _ in _columns(con, t)]
        if t in FOM_TABLES:
            rows, why = "none", "FOM's timing data, which f1.db holds empty and the artefact never carries"
        elif t in APPARATUS:
            rows, why = APPARATUS[t], "the database's description of itself"
            if rows == "none":
                why = "states f1.db's own version and terms; PD-54 writes the artefact's"
        elif "source_id" in cols:
            rows, why = "by source", "the rows citing a source carried"
            ids = ",".join(str(i) for i in sorted(carried))
            held, kept = con.execute(
                f'SELECT COUNT(*), COALESCE(SUM(source_id IN ({ids})), 0) FROM "{t}"').fetchone()
            if held and not kept and t not in RESOURCED:
                rows, why = "none", "no row cites a source the artefact may carry"
        elif t in tp:
            s = reg[tp[t]]
            m = measured(t)
            if s["authority"] == "authored":
                ok = all(f"{t}.{c}" in grant for c in m)
                rows = "all" if ok else "none"
                why = ("written for this project, granted CC BY 4.0 (PM-49)" if ok else
                       "written for this project and not granted CC BY 4.0 (PM-49)")
            elif tp[t] in carried:
                rows, why = "all", f"table_provenance: source {tp[t]}"
            else:
                rows, why = "none", f"table_provenance: source {tp[t]} is share-alike or not redistributable"
        elif t in UNSOURCED:
            rows, why = "all", UNSOURCED[t]["why"]
        else:
            rows, why = None, "no source column, no provenance row and no declaration"
        out[t] = {"rows": rows, "why": why, "resourced": t in RESOURCED,
                  "where": None, "columns": [], "dropped": {}, "nulled": {}}

    # A table whose rows cannot stand without one left out goes with it,
    # until nothing more moves.
    moved = True
    while moved:
        moved = False
        for t, d in out.items():
            if d["rows"] == "none":
                continue
            for col, notnull in _columns(con, t):
                ref = dict(_fks(con, t)).get(col)
                if notnull and ref and out.get(ref, {}).get("rows") == "none":
                    d["rows"] = "none"
                    d["why"] = f"every row is keyed to {ref}, which the artefact leaves out"
                    moved = True
                    break

    # The claims, by the column each cites a source for. A column whose
    # every value is such a claim goes; one with values of its own keeps
    # them, and the claimed cells are NULL.
    claimed = {}
    for t, _k, f in claimed_cells(con):
        claimed[(t, f)] = claimed.get((t, f), 0) + 1

    for t, d in out.items():
        if d["rows"] in (None, "none"):
            continue
        cols = [c for c, _ in _columns(con, t)]
        drop = {}
        for c in measured(t):
            if f"{t}.{c}" not in grant:
                drop[c] = "prose the prose pass measures, not granted CC BY 4.0"
        for c in cols:
            name = f"{t}.{c}"
            if name in UNGRANTED:
                drop[c] = UNGRANTED[name]
            elif (t, c) in claimed:
                held = con.execute(
                    f'SELECT COUNT(*) FROM "{t}" WHERE "{c}" IS NOT NULL').fetchone()[0]
                why = "a value as a source the artefact cannot carry publishes it (claims)"
                if held <= claimed[(t, c)]:
                    drop[c] = why
                else:
                    d["nulled"][c] = f"{claimed[(t, c)]} cells: {why}"
        if t in UNSOURCED:
            for c in cols:
                if c not in UNSOURCED[t]["own"] and f"{t}.{c}" not in grant:
                    drop.setdefault(c, UNSOURCED_VALUES)
        if t in SPANS:
            governs, first, last = SPANS[t]
            span = cols[cols.index(first):cols.index(last) + 1]
            for c in span:
                drop[c] = f"the per-car article's specification, which {governs} cites"
        refs = dict(_fks(con, t))
        refs.update({k.split(".", 1)[1]: v for k, v in KEYED.items()
                     if k.split(".", 1)[0] == t})
        for c, ref in refs.items():
            if out.get(ref, {}).get("rows") == "none":
                drop[c] = f"keyed to {ref}, which the artefact leaves out"
        d["dropped"] = {c: drop[c] for c in cols if c in drop}
        d["columns"] = [c for c in cols if c not in drop]

    ids = ",".join(str(i) for i in sorted(carried))
    for t, d in out.items():
        if d["rows"] == "by source" and not d["resourced"]:
            d["where"] = f"source_id IN ({ids})"
    # A claim is carried where its source is and the column it is about is
    # carried too; a claim about a column the artefact does not hold is
    # about nothing in it.
    about = ", ".join(sorted(f"'{t}.{c}'" for t, d in out.items()
                             if d["rows"] not in (None, "none") for c in d["columns"]))
    if out.get("claims", {}).get("rows") == "by source":
        out["claims"]["where"] += f" AND tbl || '.' || field IN ({about})"
    for t, spec in UNSOURCED.items():
        if spec["about"] and out.get(t, {}).get("rows") == "all":
            a, b = spec["about"]
            out[t]["where"] = f"{a} || '.' || {b} IN ({about})"
    return out


# ------------------------------------------------------------- F1DB's files

def _unaccented(text):
    t = unicodedata.normalize("NFKD", text or "")
    return "".join(ch for ch in t if not unicodedata.combining(ch))


def _fold(text):
    """A name compared without its diacritics, case, hyphens or word order:
    São Paulo and Sao Paulo, Emilia-Romagna and Emilia Romagna, Zhou Guanyu
    and Guanyu Zhou."""
    return " ".join(sorted(_unaccented(text).casefold().replace("-", " ").split()))


def _f1db(name):
    path = os.path.join(ROOT, "harvest", name)
    return HV._read_named(path, "tools/f1db_fetch.py")


def _by_race(rows):
    out = {}
    for r in rows:
        out.setdefault((int(r["year"]), int(r["round"])), []).append(r)
    return out


def _int(v):
    return int(v) if v and v.lstrip("-").isdigit() else None


class F1DB:
    """F1DB's files, read once, keyed the way the rebuild reads them."""

    def __init__(self, con):
        self.gp = {(int(r["year"]), int(r["round"])): r
                   for r in _f1db("race_grands_prix.txt")}
        self.gp_full = {r["grand_prix_id"]: r["full_name"]
                        for r in _f1db("f1db_grands_prix.txt")}
        self.layout = {(int(r["year"]), int(r["round"])): r["layout_id"]
                       for r in _f1db("race_layouts.txt")}
        self.date = {(int(r["year"]), int(r["round"])): r["date"]
                     for r in _f1db("race_dates.txt")}
        self.results = _by_race(_f1db("race_results.txt"))
        self.qualifying = _by_race(_f1db("qualifying.txt"))
        self.fastest = _by_race(_f1db("fastest_laps.txt"))
        self.sprints = set(_by_race(_f1db("sprint_results.txt")))
        self.drivers = {r[0]: r for r in HV.load_f1db_drivers()}
        self.countries = {r[0]: r[1] for r in HV.load_f1db_countries()}
        self.driver_id = dict(con.execute(
            "SELECT f1db_id, id FROM drivers WHERE f1db_id IS NOT NULL").fetchall())
        self.constructors = {c for (c,) in con.execute("SELECT id FROM constructors")}

    def ours(self, f1db_driver):
        return self.driver_id.get(f1db_driver)

    def constructor(self, f1db_constructor, year):
        c = HV.constructor_for_f1db(f1db_constructor, year) if f1db_constructor else None
        return c if c in self.constructors else None


# ------------------------------------------------------------- the rebuild

def register_names(con):
    """Every name the grands_prix register gives an event, folded, to the
    event and each spelling of it the register holds."""
    names = {}
    for gid, name, aliases in con.execute("SELECT id, name, aliases FROM grands_prix"):
        for n in [name] + [a for a in re.split(r"\s*[;,]\s*", aliases or "") if a]:
            names.setdefault(_fold(n), {}).setdefault(gid, []).append(n)
    return names


def crosswalk(con, src=None):
    """F1DB's grand-prix ids to this register's, by name: F1DB's full name of
    the grand prix is the register's name or one of its aliases, accents and
    hyphens aside. São Paulo falls under the Brazilian Grand Prix that way,
    as it does in f1.db. Returns ({f1db id: (gp_id, register name)},
    [F1DB ids with no single match])."""
    src = src or F1DB(con)
    names = register_names(con)
    out, bad = {}, []
    for gid, full in sorted(src.gp_full.items()):
        hit = names.get(_fold(full), {})
        if len(hit) != 1:
            bad.append(gid)
            continue
        ours, spellings = next(iter(hit.items()))
        # The register's spelling of the name F1DB gives: São Paulo is the
        # register's Sao Paulo, and where the register holds Emilia-Romagna
        # and Emilia Romagna both, F1DB's Emilia Romagna picks the second.
        same = [n for n in spellings if _unaccented(n) == _unaccented(full)]
        out[gid] = (ours, (same or spellings)[0])
    return out, bad


def _name_from_title(con, gp_id, official):
    """OFFICIAL_TITLE_NAMES: the register's name for the event the official
    title names by its city, where it holds one."""
    aliases = con.execute("SELECT aliases FROM grands_prix WHERE id = ?",
                          (gp_id,)).fetchone()
    held = set(re.split(r"\s*[;,]\s*", aliases[0] or "")) if aliases else set()
    for phrase, name in OFFICIAL_TITLE_NAMES.items():
        if phrase in (official or "") and name in held:
            return name
    return None


def rebuild(con):
    """Every value the artefact holds that is not f1.db's as stored.

    Returns {table: {row id: {column: value}}}: the race rows citing a
    source the artefact cannot carry, rebuilt from F1DB; their winners; the
    drivers they introduced; and the pole and fastest-lap credits on every
    race entry, whatever the row's source, because the season harvest gave
    them everywhere. A column not named for a row is the row's stored value.
    """
    src = F1DB(con)
    carried = carried_sources(con)
    f1db_id = f1db_source(con)
    f1db_url = HV.F1DB_SOURCE
    walk, _ = crosswalk(con, src)
    layout_circuit = dict(con.execute(
        "SELECT f1db_layout_id, circuit_id FROM circuit_outlines").fetchall())
    out = {"races": {}, "race_entries": {}, "drivers": {}}
    cited = {"source": f1db_url, "source_id": f1db_id}
    nulled = {(t, c) for t, d in declare(con).items() for c in d["nulled"]}
    for t, k, c in claimed_cells(con):
        if (t, c) in nulled:
            out.setdefault(t, {}).setdefault(k, {})[c] = None

    race_key = {}
    for rid, y, r, sid in con.execute("SELECT id, year, round, source_id FROM races"):
        race_key[rid] = (y, r)
        if sid in carried:
            # The venue harvest reads every season's articles, so a race
            # citing formula1.com can still hold the article's circuit
            # (2025's do). Wherever F1DB gives the layout, the circuit is the
            # layout's; a race it gives none is on a formula1.com calendar
            # (CALENDARS), which verify.py holds.
            layout = src.layout.get((y, r))
            if layout:
                out["races"][rid] = {"circuit_id": layout_circuit.get(layout)}
            continue
        g = src.gp.get((y, r))
        gp_id = name = None
        if g:
            hit = walk.get(g["grand_prix_id"])
            if hit:
                gp_id, name = hit
                name = _name_from_title(con, gp_id, g["official_name"]) or name
        layout = src.layout.get((y, r))
        out["races"][rid] = {
            "gp_id": gp_id, "name_used": name,
            "circuit_id": layout_circuit.get(layout),
            "f1db_layout_id": layout, "date_iso": src.date.get((y, r)),
            "sprint": 1 if (y, r) in src.sprints else 0,
            "date_from": None, "date_to": None, **cited}

    # The winners, from F1DB's row for the driver at position 1.
    for eid, rid, did, sid in con.execute(
            "SELECT id, race_id, driver_id, source_id FROM race_entries"):
        if sid in carried:
            continue
        y, r = race_key[rid]
        row = next((x for x in src.results.get((y, r), [])
                    if src.ours(x["driver_id"]) == did and x["position"] == "1"), None)
        if row is None:
            out["race_entries"][eid] = {"finish_position": None}
            continue
        pos = _int(row["position"])
        out["race_entries"][eid] = {
            "constructor_id": src.constructor(row["constructor_id"], y),
            "grid": _int(row["grid"]), "grid_text": row["grid"],
            "finish_position": pos, "position_text": row["position_text"],
            "shared_drive": 1 if row["shared_drive"] == "1" else 0,
            "classified": 1 if pos is not None else 0,
            "status": row["reason_retired"] or (row["position_text"] if pos is None else None),
            "laps_completed": _int(row["laps"]),
            "points": float(row["points"]) if row["points"] else None,
            "entrant": None, **cited}

    # The credits, on every entry. Pole is the car F1DB starts from grid 1,
    # except where the record credits the fastest qualifier: a sprint weekend
    # of a season in POLE_TO_FASTEST_QUALIFIER, and a race with no car on
    # grid 1, where the pole-sitter did not start (schema.sql, WHAT 'POLE'
    # MEANS HERE). The fastest lap is F1DB's: every driver at position 1 of
    # its fastest-lap classification, so a tie is shared as F1DB shares it.
    # A race F1DB holds no classification of yet - a round run since its
    # release - has neither credit established, and its cells are NULL
    # rather than a 0 saying nobody took pole; so is the fastest lap of a
    # race F1DB gives none for (2021 Belgium, where no racing lap was set).
    entries = {}
    for eid, rid, did in con.execute("SELECT id, race_id, driver_id FROM race_entries"):
        entries[(rid, did)] = eid
    credit = {eid: {"pole": None, "fastest_lap": None, "fastest_lap_shared": None}
              for eid in entries.values()}
    by_race = {}
    for (rid, _d), eid in entries.items():
        by_race.setdefault(rid, []).append(eid)
    for rid, (y, r) in race_key.items():
        grid_one = [x["driver_id"] for x in src.results.get((y, r), []) if x["grid"] == "1"]
        quickest = [x["driver_id"] for x in src.qualifying.get((y, r), [])
                    if x["position"] == "1"]
        sprint_sets_grid = y in POLE_TO_FASTEST_QUALIFIER and (y, r) in src.sprints
        poles = grid_one if grid_one and not sprint_sets_grid else quickest
        fl = [x["driver_id"] for x in src.fastest.get((y, r), [])]
        for eid in by_race.get(rid, []):
            if poles:
                credit[eid]["pole"] = 0
            if fl:
                credit[eid]["fastest_lap"] = 0
        for d in poles:
            eid = entries.get((rid, src.ours(d)))
            if eid is not None:
                credit[eid]["pole"] = 1
        for d in fl:
            eid = entries.get((rid, src.ours(d)))
            if eid is not None:
                credit[eid]["fastest_lap"] = 1
                credit[eid]["fastest_lap_shared"] = len(fl)
    for eid, c in credit.items():
        out["race_entries"].setdefault(eid, {}).update(c)

    # The drivers the season articles introduced, from F1DB's register. A
    # name is the register's where F1DB's is the same name, accents and word
    # order aside; a nationality is the country vocabulary's for F1DB's
    # nationality, as every F1DB-cited driver row has it.
    vocab = {}
    for f1, nat, code in con.execute(
            "SELECT f1db_id, nationality, nationality_code FROM drivers "
            f"WHERE source_id = {f1db_id} AND f1db_id IS NOT NULL"):
        meta = src.drivers.get(f1)
        if meta:
            vocab.setdefault(meta[7], set()).add((nat, code))
    for did, f1, name, nat, code in con.execute(
            "SELECT id, f1db_id, full_name, nationality, nationality_code FROM drivers "
            f"WHERE source_id NOT IN ({','.join(map(str, sorted(carried)))})"):
        meta = src.drivers.get(f1)
        if meta is None:
            out["drivers"].setdefault(did, {})["full_name"] = None
            continue
        theirs = meta[1]
        options = vocab.get(meta[7], set())
        if (nat, code) in options:
            nat_r, code_r = nat, code
        elif len(options) == 1:
            nat_r, code_r = next(iter(options))
        else:
            nat_r = code_r = None
        out["drivers"].setdefault(did, {}).update({
            "full_name": name if _fold(name) == _fold(theirs) else theirs,
            "nationality": nat_r, "nationality_code": code_r,
            "born": meta[4], "died": meta[5], "abbreviation": meta[6],
            "place_of_birth": meta[8], "country_of_birth": src.countries.get(meta[9]),
            "permanent_number": _int(meta[10]), **cited})
    return out


def differences(con, rebuilt=None):
    """[(table, row id, column, f1.db's value, the artefact's)] wherever a
    rebuilt value is not the stored one, leaving out the re-citing itself."""
    rebuilt = rebuilt or rebuild(con)
    out = []
    for table, rows in rebuilt.items():
        pk = "id"
        cols = sorted({c for v in rows.values() for c in v} - {"source", "source_id"})
        stored = {r[0]: dict(zip(cols, r[1:])) for r in con.execute(
            f"SELECT {pk}, {', '.join(cols)} FROM {table}")}
        for rid, vals in rows.items():
            for c, v in vals.items():
                if c in ("source", "source_id"):
                    continue
                if stored[rid][c] != v:
                    out.append((table, rid, c, stored[rid][c], v))
    return out


# ------------------------------------------------------------- the command

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--diff", action="store_true",
                    help="list where the artefact differs from f1.db")
    args = ap.parse_args()
    con = sqlite3.connect(DB)
    if args.diff:
        for row in differences(con):
            print("|".join("" if v is None else str(v) for v in row))
        return
    for t, d in declare(con).items():
        print(f"{t}: rows {d['rows']}{' (share-alike rows rebuilt from F1DB)' if d['resourced'] else ''}"
              f" - {d['why']}")
        for c, why in d["dropped"].items():
            print(f"    - {c}: {why}")


if __name__ == "__main__":
    main()
