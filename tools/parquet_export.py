#!/usr/bin/env python3
"""
Export f1.db to Parquet, one file per table.

    python3 tools/parquet_export.py                 -> parquet/
    python3 tools/parquet_export.py --out DIR       -> somewhere else
    python3 tools/parquet_export.py --check         -> report, write nothing

WHY THIS EXISTS, BESIDE THE JSON EXPORT
    They are for different readers, and the difference is size.

    f1_database.json is a CONVENIENCE export: one file, human-readable, and
    deliberately incomplete. It leaves out `qualifying` and `pit_stops`
    because those two take it from 12 MB to 44 MB, at which point it stops
    being convenient and starts being a download.

    Parquet is a BULK export, and size is the point rather than the problem.
    It is columnar and compressed, pandas / polars / DuckDB read it directly,
    and a reader who wants 27,000 qualifying rows is exactly the reader that
    format is for. So this exports EVERYTHING the licence allows - the two
    tables JSON omits included.

WHY IT IS A TOOL AND NOT PART OF THE BUILD
    build.py, verify.py, audit.py, export_json.py and ./f1 use only the
    standard library, and that is a property worth keeping: `git clone && make
    all` needs nothing but Python. Parquet needs a writer, so this sits in
    tools/ beside the other optional loaders and imports pyarrow lazily.
    Nothing in the build imports this file.

        pip install pyarrow

WHAT IT REFUSES TO DO
    A local database is not always a publishable one. tools/fastf1_load.py can
    fill `laps`, `stints`, `race_timing` and `race_control_messages` with
    FOM-owned timing for local work, and tools/geometry_overlay.py --apply
    merges the ODbL centrelines back in. Neither may be redistributed, and
    Parquet is a redistribution format - it exists to be handed to somebody.

    So this refuses to run at all on a database carrying either. verify.py
    enforces the same rule on the committed artefact; this enforces it at the
    moment the data would leave.
"""
import argparse
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB = os.path.join(ROOT, "f1.db")

# Held empty in any publishable build; see docs/TIMING-ARCHITECTURE.md.
FOM_OWNED = ("laps", "stints", "race_timing", "race_control_messages")

# Not exported, with the reason. Anything neither exported nor named here
# fails the completeness check, so a new table cannot go missing quietly -
# the same guard export_json.py carries, for the same reason.
NOT_EXPORTED = {
    "circuit_geometry":
        "ODbL geometry - ships as f1-geometry.db, and is empty here",
    "laps": "FOM-owned timing; never shipped",
    "stints": "as laps",
    "race_timing": "as laps",
    "race_control_messages": "as laps",
}

# SQLite is dynamically typed and a column's declared type is a hint rather
# than a guarantee, so the declared type is a STARTING POINT: where the rows
# do not fit it, the column falls back to string rather than the export
# failing. Losing a type is recoverable; losing the row is not.
ARROW_FOR = {"INTEGER": "int64", "REAL": "float64", "TEXT": "string",
             "BLOB": "binary", "NUMERIC": "float64"}


def _pa():
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
        return pa, pq
    except ModuleNotFoundError:
        sys.exit("tools/parquet_export.py needs pyarrow, which the build "
                 "deliberately does not:\n\n    pip install pyarrow\n")


def refuse_unpublishable(con):
    """Stop before writing anything a licence does not allow us to hand on."""
    for table in FOM_OWNED:
        n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        if n:
            sys.exit(
                f"REFUSED: {table} holds {n} rows of FOM-owned timing. This "
                f"database is a local copy, not a publishable one, and "
                f"Parquet is a redistribution format. Rebuild without the "
                f"timing loaders (python3 build.py) and try again.")
    n = con.execute("SELECT COUNT(*) FROM circuit_geometry").fetchone()[0]
    if n:
        sys.exit(
            f"REFUSED: circuit_geometry holds {n} rows. Those are "
            f"OpenStreetMap centrelines under ODbL, merged in locally by "
            f"tools/geometry_overlay.py --apply. Exporting them here would "
            f"put every other table under ODbL's share-alike. Remove the "
            f"overlay (tools/geometry_overlay.py --remove) and try again.")


def tables(con):
    return [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name")]


def check_complete(con, written):
    held = set(tables(con))
    missing = held - set(written) - set(NOT_EXPORTED)
    if missing:
        sys.exit(f"parquet_export.py: {len(missing)} table(s) are neither "
                 f"exported nor declared in NOT_EXPORTED: "
                 f"{', '.join(sorted(missing))}")
    stale = set(NOT_EXPORTED) - held
    if stale:
        sys.exit(f"parquet_export.py: NOT_EXPORTED names table(s) that no "
                 f"longer exist: {', '.join(sorted(stale))}")


def table_to_arrow(pa, con, table):
    """One table as an Arrow table, columns derived from the schema itself.

    PRAGMA table_info rather than a written-out column list: three places
    once hardcoded twelve columns of circuit_geometry, main grew three more,
    and every copy would have silently dropped them.
    """
    info = list(con.execute(f"PRAGMA table_info({table})"))
    names = [r[1] for r in info]
    declared = [(r[2] or "").upper().split("(")[0] for r in info]
    rows = con.execute(f"SELECT * FROM {table}").fetchall()

    columns = []
    for i, (name, decl) in enumerate(zip(names, declared)):
        values = [r[i] for r in rows]
        want = ARROW_FOR.get(decl)
        try:
            columns.append(pa.array(values, type=want) if want
                           else pa.array(values))
        except (pa.ArrowInvalid, pa.ArrowTypeError, OverflowError):
            # The declared type was a hint and these rows do not honour it.
            columns.append(pa.array([None if v is None else str(v)
                                     for v in values], type="string"))
    return pa.table(columns, names=names)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=os.path.join(ROOT, "parquet"),
                    help="directory to write into (default: parquet/)")
    ap.add_argument("--check", action="store_true",
                    help="report what would be written, and write nothing")
    args = ap.parse_args()

    if not os.path.exists(DB):
        sys.exit(f"{DB} not found. Build it first:  python3 build.py")

    pa, pq = _pa()
    con = sqlite3.connect(DB)
    refuse_unpublishable(con)

    if not args.check:
        os.makedirs(args.out, exist_ok=True)

    written, total_rows, total_bytes = [], 0, 0
    for table in tables(con):
        if table in NOT_EXPORTED:
            continue
        at = table_to_arrow(pa, con, table)
        path = os.path.join(args.out, f"{table}.parquet")
        if args.check:
            print(f"  {table:28s} {at.num_rows:7,d} rows")
        else:
            pq.write_table(at, path, compression="zstd")
            size = os.path.getsize(path)
            total_bytes += size
            print(f"  {table:28s} {at.num_rows:7,d} rows  {size/1024:8.1f} KB")
        written.append(table)
        total_rows += at.num_rows

    check_complete(con, written)
    print(f"\n  {len(written)} tables, {total_rows:,} rows"
          + (f", {total_bytes/1048576:.1f} MB in {args.out}"
             if not args.check else " (nothing written)"))
    for table, why in sorted(NOT_EXPORTED.items()):
        print(f"  not exported: {table} - {why}")


if __name__ == "__main__":
    main()
