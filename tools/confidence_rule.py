#!/usr/bin/env python3
"""
The derived-confidence rule, run read-only against the current database.

A SKETCH. It writes nothing. It exists to answer one question — if confidence
were derived rather than declared, what would change? — with numbers rather
than with an argument. See docs/DERIVED-CONFIDENCE.md.

The rule:

                  | no independent source | another source agreed
    --------------+-----------------------+----------------------
    official      | high                  | verified
    reference     | medium                | reference
    (unresolved)  | unverified            | unverified

Authority picks the pair; only a CROSS-SOURCE check picks which of the pair.
Internal consistency checks - referential, temporal, arithmetic, coverage -
keep the database honest but cannot raise a tier, because a self-consistent
database can be uniformly wrong. An open disagreement caps a row at 'medium'.

Two of the three inputs do not exist yet, so this stands in for them:

  * AUTHORITY is resolved by matching a row's `source` against
    source_registry.url, plus the URL_PATTERNS below — which is the
    `url_pattern` column the sketch proposes, prototyped in Python.
  * CONSTRAINT comes from CONSTRAINED_BY, a hand-written seed naming the
    checks in verify.py that demonstrably cover a table, and of what kind.
    The real version is the `checks` table, where each check declares its
    kind and the rows it covered.

So treat the CONSTRAINT column as the sketch's weakest claim. It is seeded,
not measured. That is the point of step 4 in the doc.
"""
import os
import re
import sqlite3
import sys

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "f1.db")

# What `source_registry.url_pattern` would hold. A registry url is one example
# page; these are the namespaces those examples were drawn from.
URL_PATTERNS = [
    (r"^https://en\.wikipedia\.org/wiki/\d{4}_Formula_One_World_Championship", 8),
    (r"^https://en\.wikipedia\.org/wiki/List_of_Formula_One", 8),
    (r"^https://en\.wikipedia\.org/wiki/\d{4}_.*Grand_Prix", 8),
    (r"^https://en\.wikipedia\.org/wiki/History_of_Formula_One", 8),
    (r"^https://en\.wikipedia\.org/wiki/", 11),   # per-car and per-topic articles
    (r"^https://www\.formula1\.com/", 3),
    (r"^https://www\.fia\.com/", 1),
    (r"^https://api\.jolpi\.ca/", 12),
    (r"^https://github\.com/f1db/f1db", 10),
]

# Seed for the `checks` table. Which tables verify.py demonstrably constrains,
# and the check names it prints while doing it.
# Seed for the `checks` table. Which tables verify.py demonstrably constrains,
# of what KIND, and the check names it prints while doing it. Only 'cross'
# raises a tier: it means a source held here independently agreed.
CONSTRAINED_BY = {
    "seasons": ("cross", [
        "every season's champion and runner-up match the final standings",
        "champion_wins matches the race records in every season"]),
    "drivers": ("cross", [
        "every driver's wins, poles and fastest laps equal the race records",
        "headline career records match the known official figures",
        "every external-vs-derived difference is accounted for"]),
    "constructors": ("cross", [
        "every constructor win total equals the number of races it won"]),
    "races": ("cross", [
        "every winner agreed with the independently harvested winner (build.py)",
        "completed race count per season matches the rounds recorded"]),
    "standings": ("cross", [
        "every season's champion and runner-up match the final standings"]),
    "qualifying": ("cross", [
        "the re-derived fastest lap matches the setter stored from the pole harvest"]),
    "chassis": ("cross", [
        "published_races/wins/poles compared against the derived figures"]),
    "circuit_geometry": ("cross", [
        "measured_km checked against published_km, delta_pct stored"]),
    "car_seasons": ("cross", [
        "corroborated against the season entry lists"]),

    "race_entries": ("cross", [
        "the winner of every race agreed with the one already held from the "
        "Wikipedia harvest, or the race was refused (build.py)",
        "the podium reconciles against the published figures, 7 of 7"]),

    # Internal only. These pass, and they matter, but nothing outside the
    # database had a chance to disagree.
    "circuits": ("internal", [
        "circuit usage runs forwards"]),
    "season_entrants": ("internal", [
        "every entry resolves to a driver / constructor"]),
    # NB: season_entrants is what CONSTRAINS race_entries ("no entry is
    # credited to a constructor that was not racing that season"). Nothing
    # constrains season_entrants itself - it is single-source F1DB.

    # Deliberately absent: article_images, glossary, eras, records, governance,
    # technical_innovations, safety_milestones, points_systems, tyre_suppliers,
    # engine_eras, grands_prix, constructor_lineage, personnel, circuit_layouts.
    # Nothing in verify.py constrains their values.
}

LADDER = ["verified", "high", "reference", "medium", "unverified"]


def authority(con, source):
    """A: official | reference | forbidden | None."""
    if not source:
        return None, None
    reg = con.execute("SELECT id, url, authority FROM source_registry "
                      "WHERE url IS NOT NULL").fetchall()
    best = None
    for sid, url, auth in reg:
        u = url.rstrip("/")
        if source.startswith(u) and (best is None or len(u) > best[0]):
            best = (len(u), sid, auth)
    if best:
        return best[2], best[1]
    for pattern, sid in URL_PATTERNS:
        if re.match(pattern, source):
            row = con.execute("SELECT authority FROM source_registry WHERE id=?",
                              (sid,)).fetchone()
            return row[0], sid
    return None, None


def derive(auth, kind, contested):
    """The rule itself. `kind` is 'cross', 'internal' or None."""
    if auth == "forbidden":
        return "REJECT"
    if auth is None:
        return "unverified"
    if contested:
        return "medium"
    cross = kind == "cross"
    if auth == "official":
        return "verified" if cross else "high"
    return "reference" if cross else "medium"


def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row

    tables = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    fact_tables = []
    for t in tables:
        cols = [r[1] for r in con.execute(f'PRAGMA table_info("{t}")')]
        if "confidence" in cols and t != "provenance":
            fact_tables.append((t, "source" in cols))

    # Rows already flagged as contested.
    contested = {r[0] for r in con.execute(
        "SELECT DISTINCT subject FROM discrepancies WHERE status='open'")}

    print(f"\nDERIVED-CONFIDENCE SKETCH — {os.path.basename(DB)}")
    print("Read-only. Nothing is written.\n")
    print(f"  {'table':24} {'rows':>6}  {'agree':>6} {'differ':>6}   derived tiers")
    print("  " + "-" * 76)

    agree_all = differ_all = total_all = 0
    moves = {}
    unsourced_high = 0

    for t, has_source in fact_tables:
        rows = con.execute(f'SELECT * FROM "{t}"').fetchall()
        if not rows:
            continue
        kind = CONSTRAINED_BY.get(t, (None, []))[0]
        tiers, agree, differ = {}, 0, 0
        for r in rows:
            src = r["source"] if has_source else None
            auth, _ = authority(con, src)
            new = derive(auth, kind, False)
            old = r["confidence"]
            tiers[new] = tiers.get(new, 0) + 1
            if new == old:
                agree += 1
            else:
                differ += 1
                moves[(t, old, new)] = moves.get((t, old, new), 0) + 1
                if not has_source and old == "high":
                    unsourced_high += 1
        agree_all += agree
        differ_all += differ
        total_all += len(rows)
        shown = ", ".join(f"{k}:{v}" for k, v in
                          sorted(tiers.items(), key=lambda kv: LADDER.index(kv[0])
                                 if kv[0] in LADDER else 9))
        flag = "" if has_source else "  [no source column]"
        print(f"  {t:24} {len(rows):6}  {agree:6} {differ:6}   {shown}{flag}")

    print("  " + "-" * 76)
    pct = 100 * agree_all / total_all if total_all else 0
    print(f"  {'TOTAL':24} {total_all:6}  {agree_all:6} {differ_all:6}   "
          f"{pct:.1f}% of stored tiers reproduced\n")

    print("WHAT WOULD MOVE, largest first\n")
    for (t, old, new), n in sorted(moves.items(), key=lambda kv: -kv[1])[:14]:
        direction = "DEMOTE" if (new in LADDER and old in LADDER
                                 and LADDER.index(new) > LADDER.index(old)) else "promote"
        print(f"  {n:6}  {t:22} {old:>10} -> {new:<10} {direction}")

    print(f"\n  {unsourced_high} rows sit at 'high' (may_publish=1) with no source column")
    print("  at all and no check that constrains them. See docs/DERIVED-CONFIDENCE.md,")
    print("  'What the rule says today' — the honest fix is an `authored` authority,")
    print("  not a blanket demotion.\n")

    print("CAVEAT: CONSTRAINT is seeded from CONSTRAINED_BY, not measured. Until")
    print("verify.py's checks declare their kind and the rows they cover, a table")
    print("counts as constrained or not as a whole, which is coarser than the rule")
    print("intends -- and the cross/internal split is a reading of the checks, not")
    print("a property the database records.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
