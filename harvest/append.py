#!/usr/bin/env python3
"""
Append rows to a harvest file, from stdin, with the shape checked.

    python3 harvest/append.py venues.txt 4 < new_rows.txt

The second argument is how many fields a row must have. Every harvest file is
pipe-delimited and every row carries a fact already in the database - the race
winner - so that data/harvest.py can reject any row that disagrees. See
CONTRIBUTING.md.

Files and their shapes:
    races.txt   5   year|round|gp|winner|constructor
    poles.txt   5   year|round|pole|fastest_lap|winner
    venues.txt  4   year|round|venue|winner

Prints a per-season count afterwards so a short or duplicated batch is
obvious immediately.
"""
import collections
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

if len(sys.argv) != 3:
    sys.exit(__doc__)
name, fields = sys.argv[1], int(sys.argv[2])
path = os.path.join(HERE, os.path.basename(name))

rows = [ln.strip() for ln in sys.stdin if ln.strip() and not ln.startswith("#")]
for r in rows:
    if r.count("|") != fields - 1:
        sys.exit(f"bad row (expected {fields} fields): {r!r}")

with open(path, "a", encoding="utf-8") as f:
    for r in rows:
        f.write(r + "\n")

seen = collections.Counter()
dupes = set()
keys = set()
for ln in open(path, encoding="utf-8"):
    ln = ln.strip()
    if not ln:
        continue
    y, rnd = ln.split("|")[:2]
    seen[y] += 1
    if (y, rnd) in keys:
        dupes.add((y, rnd))
    keys.add((y, rnd))

print(" ".join(f"{y}:{n}" for y, n in sorted(seen.items())))
print(f"{sum(seen.values())} rows in {os.path.basename(path)}")
if dupes:
    print(f"WARNING: duplicate (year, round): {sorted(dupes)[:10]}")
