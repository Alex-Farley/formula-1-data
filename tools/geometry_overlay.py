#!/usr/bin/env python3
"""
Merge the OpenStreetMap centrelines into a local copy of f1.db.

WHY THIS IS A SEPARATE STEP
    OpenStreetMap is ODbL 1.0, which carries share-alike and a database
    right. A database derived from an ODbL one is a Derivative Database, and
    publishing it means publishing the whole thing under ODbL - so twenty-five
    centrelines would decide the licence of 117,000 rows they have nothing to
    do with.

    f1.db therefore contains no OpenStreetMap data at all, and the geometry
    ships as f1-geometry.db beside it. Two independent databases distributed
    alongside each other are a Collective Database, which ODbL explicitly does
    not treat as derivative, so the obligation follows the file it belongs to
    and no further.

    Running this makes YOUR copy a Derivative Database. That is a perfectly
    ordinary thing to hold - every view and query that wants a centreline
    works again afterwards. It is simply not the file to redistribute, and
    verify.py will say so.

USE
    python3 tools/geometry_overlay.py --apply     merge into f1.db
    python3 tools/geometry_overlay.py --remove    take it back out
    python3 tools/geometry_overlay.py             report what is where
"""
import argparse
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB = os.path.join(ROOT, "f1.db")
GEO = os.path.join(ROOT, "f1-geometry.db")

COLUMNS = ("circuit_id, layout_key, wikidata_id, osm_relation, centreline, "
           "measured_km, published_km, delta_pct, node_count, osm_timestamp, "
           "licence, confidence")


def counts(db, geo):
    with sqlite3.connect(db) as con:
        merged = con.execute("SELECT COUNT(*) FROM circuit_geometry").fetchone()[0]
    available = 0
    if os.path.exists(geo):
        with sqlite3.connect(geo) as con:
            available = con.execute(
                "SELECT COUNT(*) FROM circuit_geometry").fetchone()[0]
    return merged, available


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    ap.add_argument("--db", default=DB)
    ap.add_argument("--geometry", default=GEO)
    ap.add_argument("--apply", action="store_true",
                    help="merge the centrelines into --db")
    ap.add_argument("--remove", action="store_true",
                    help="delete the centrelines from --db")
    args = ap.parse_args(argv)

    if args.apply and args.remove:
        sys.exit("--apply and --remove are opposites; pick one")
    if not os.path.exists(args.db):
        sys.exit(f"{args.db} not found. Build it first: python3 build.py")

    if args.remove:
        con = sqlite3.connect(args.db)
        n = con.execute("SELECT COUNT(*) FROM circuit_geometry").fetchone()[0]
        con.execute("DELETE FROM circuit_geometry")
        con.commit()
        con.close()
        print(f"removed {n} centrelines — {os.path.basename(args.db)} carries "
              f"no OpenStreetMap data")
        return 0

    if args.apply:
        if not os.path.exists(args.geometry):
            sys.exit(f"{args.geometry} not found. Build it first: "
                     f"python3 build.py")
        con = sqlite3.connect(args.db)
        held = con.execute("SELECT COUNT(*) FROM circuit_geometry").fetchone()[0]
        if held:
            con.close()
            sys.exit(f"{os.path.basename(args.db)} already holds {held} "
                     f"centrelines. Use --remove first if you want them "
                     f"replaced.")
        con.execute("ATTACH DATABASE ? AS geo", (args.geometry,))
        con.execute(f"INSERT INTO circuit_geometry ({COLUMNS}) "
                    f"SELECT {COLUMNS} FROM geo.circuit_geometry")
        n = con.execute("SELECT COUNT(*) FROM circuit_geometry").fetchone()[0]
        con.commit()
        con.close()
        print(f"merged {n} centrelines into {os.path.basename(args.db)}.\n"
              f"That copy is now a Derivative Database under ODbL 1.0 "
              f"((c) OpenStreetMap contributors).\n"
              f"Do not redistribute it; run --remove before committing.")
        return 0

    merged, available = counts(args.db, args.geometry)
    print(f"  {os.path.basename(args.db):18} {merged} centrelines")
    print(f"  {os.path.basename(args.geometry):18} {available} centrelines"
          f"{'' if os.path.exists(args.geometry) else '  (not built)'}")
    print("\n  --apply merges them; --remove takes them back out.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
