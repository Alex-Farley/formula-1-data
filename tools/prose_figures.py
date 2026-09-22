#!/usr/bin/env python3
"""
Every figure a database row states about the database it sits in, derived at
build time rather than typed.

`/data/sources` reads `source_registry` prose straight out of f1.db, and the
prose said the full classification covered 1,161 races in 27,555 entries
against 1,163 and 27,504 held, with qualifying, standings and pit stops all
stale beside them. Nothing read those numbers, so they drifted one race
weekend at a time - the same defect the README had before
tools/readme_figures.py, and the same one `meta.coverage_note` never had
because it is derived on every build and compared whole by verify.py
(CD-38, and AF-63 before it).

This is readme_figures.py's idea pointed at the database's own prose. A
figure is a name and one expression. Prose in data/*.py marks where each one
lands:

    "the full classification for all {{fig:races_completed}} races"

build.py expands the tokens in its final stage, after every loader, off the
tables the figures count; verify.py re-expands the literals from data/*.py,
compares the stored prose whole, and refuses a token that survived into any
text column of any table. A figure cannot go stale because no figure is
typed: the number that ships is the count, every build.

    python3 tools/prose_figures.py            print every figure and its value
    python3 tools/prose_figures.py --check    exit 1 where the database disagrees

What stays typed, and why: a figure about a source's own holdings rather than
this database's - Jolpica's 628,454 lap times, its 118 of 26,082 readings -
counts rows that are not here to count, and a figure verify.py already pins
as an invariant, like the 13 races where the credited pole-sitter was not the
fastest qualifier, is checked where it is pinned. Everything else that counts
this database's rows is a token.

Nothing here writes to a database except through apply(), which build.py
calls once.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# {{fig:name}}. Doubled braces so a single brace in prose is left alone, and
# the name is the same shape readme_figures.py uses.
TOKEN = re.compile(r"\{\{fig:([a-z0-9_]+)\}\}")

# One name, one expression, each a count of this database's own rows. Nothing
# here may read a table the build has not filled by its final stage.
FIGURES = {
    "races_completed": "SELECT COUNT(*) FROM races WHERE status = 'completed'",
    "race_entries": "SELECT COUNT(*) FROM race_entries",
    "qualifying": "SELECT COUNT(*) FROM qualifying",
    "standings": "SELECT COUNT(*) FROM standings",
    "pit_stops": "SELECT COUNT(*) FROM pit_stops",
    "circuit_outlines": "SELECT COUNT(*) FROM circuit_outlines",
    "car_seasons": "SELECT COUNT(*) FROM car_seasons",
    # The seasons whose champion, runner-up and both point totals were held
    # before F1DB was read, which is what the final standings must reproduce.
    "seasons_reproduced": """SELECT COUNT(*) FROM seasons
        WHERE drivers_champion IS NOT NULL AND runner_up IS NOT NULL
          AND champion_points IS NOT NULL AND runner_up_points IS NOT NULL""",
    "article_images": "SELECT COUNT(*) FROM article_images",
    "article_images_named": "SELECT COUNT(*) FROM article_images WHERE name_matches = 1",
    "article_image_licences": "SELECT COUNT(DISTINCT licence) FROM article_images",
}


def _source_registry_literals():
    """priority -> {column: the prose as data/current.py writes it}.

    SOURCE_REGISTRY is a tuple per entry and build.py inserts it positionally;
    the indices here are that same order, named once.
    """
    sys.path.insert(0, ROOT)
    from data import current as N  # noqa: E402 - ROOT has to be on the path first
    return {e[0]: {"use": e[3], "licence": e[5], "cadence": e[6],
                   "checkability": e[7]}
            for e in N.SOURCE_REGISTRY}


# The prose a build expands. Each entry names the table, the column that
# identifies a row, and where the unexpanded literal lives, so build.py and
# verify.py work from one source of truth rather than two. A second table
# joins by adding an accessor beside the one above.
PROSE = (
    {"table": "source_registry", "key": "priority",
     "literals": _source_registry_literals},
)


def values(cur):
    """name -> the figure as the prose prints it."""
    out = {}
    for name, sql in FIGURES.items():
        out[name] = f"{cur.execute(sql).fetchone()[0]:,}"
    return out


def names(text):
    return TOKEN.findall(text or "")


def expand(text, vals, where):
    """`text` with every token replaced. Raises on a name FIGURES has not got:
    a token nobody computes would otherwise ship to the page as itself."""
    def sub(m):
        name = m.group(1)
        if name not in vals:
            raise SystemExit(
                f"{where} states {{{{fig:{name}}}}}, which tools/prose_figures.py "
                f"does not compute. Add the expression to FIGURES or correct the "
                f"name; a figure the build cannot derive does not go in the prose.")
        return vals[name]
    return TOKEN.sub(sub, text or "")


def expected(cur):
    """(table, key column, key, column) -> the prose the build should have
    written, for every row in PROSE."""
    vals = values(cur)
    out = {}
    for spec in PROSE:
        for key, columns in spec["literals"]().items():
            for column, literal in columns.items():
                where = f"{spec['table']}.{column} ({spec['key']} {key})"
                out[(spec["table"], spec["key"], key, column)] = expand(literal, vals, where)
    return out


def apply(cur):
    """Expand every figure token in the prose PROSE names. Returns the number
    of rows rewritten."""
    rewritten = 0
    for (table, keycol, key, column), text in expected(cur).items():
        cur.execute(f"UPDATE {table} SET {column} = ? WHERE {keycol} = ? AND {column} IS NOT ?",
                    (text, key, text))
        rewritten += cur.rowcount
    return rewritten


def _text_columns(con, table):
    return [c[1] for c in con.execute(f"PRAGMA table_info({table})")
            if (c[2] or "").upper() in ("TEXT", "")]


def survivors(con):
    """(table, column, rows) wherever a token reached the built database.

    Every text column of every table, from PRAGMA rather than a list: the
    point is to catch a token in a column PROSE does not name, and a hardcoded
    list could only ever catch the ones it already knows about.
    """
    found = []
    tables = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")]
    for table in sorted(tables):
        for column in _text_columns(con, table):
            n = con.execute(
                f'SELECT COUNT(*) FROM "{table}" WHERE "{column}" LIKE ?',
                ("%{{fig:%",)).fetchone()[0]
            if n:
                found.append((table, column, n))
    return found


def unused(cur):
    """Figures computed here and stated in no prose - dead expressions, the
    way readme_figures.py treats a figure no document names."""
    stated = set()
    for spec in PROSE:
        for columns in spec["literals"]().values():
            for literal in columns.values():
                stated.update(names(literal))
    return sorted(set(FIGURES) - stated)


def main(argv):
    import sqlite3
    con = sqlite3.connect(os.path.join(ROOT, "f1.db"))
    cur = con.cursor()
    vals = values(cur)

    if "--check" in argv:
        bad = False
        for (table, keycol, key, column), text in expected(cur).items():
            stored = con.execute(
                f"SELECT {column} FROM {table} WHERE {keycol} = ?", (key,)).fetchone()
            if stored is None:
                print(f"  {table}.{column}: no row with {keycol} = {key}")
                bad = True
            elif stored[0] != text:
                print(f"  {table}.{column} ({keycol} {key}) is not what the counts say")
                bad = True
        for table, column, n in survivors(con):
            print(f"  {table}.{column}: {n} row(s) still carry an unexpanded figure token")
            bad = True
        for name in unused(cur):
            print(f"  fig:{name} is computed here and stated in no prose")
            bad = True
        if bad:
            print("the database disagrees with its own counts - rebuild with build.py")
            return 1
        print(f"all {len(vals)} figures agree with the database")
        return 0

    width = max(len(k) for k in vals)
    for name in FIGURES:
        print(f"  {name:<{width}}  {vals[name]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
