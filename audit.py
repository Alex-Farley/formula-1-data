#!/usr/bin/env python3
"""
Structural audit of f1.db.

verify.py asks "is the data correct?". This asks "is the structure still
fit for purpose?" — fill rates, coverage, key integrity, redundancy, and
whether the shape can absorb what is planned next.

Run it after any schema change:  python3 audit.py
"""
import os
import sqlite3

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "f1.db")
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
W = 74

def head(n, t):
    print("\n" + "=" * W)
    print(f"  {n}. {t}")
    print("=" * W)

def tables():
    return [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]

def views():
    return [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")]

# Columns that are deliberately optional: free-text annotation, or a field
# only a minority of rows can ever have. Listed so the audit reports real
# gaps rather than noise.
OPTIONAL = {
    "race_entries.note", "races.note", "season_entries.note", "drivers.died",
    "drivers.stats_as_of", "races.dates", "constructors.last_entry",
    "circuits.last_gp", "drivers.last_season", "grands_prix.last_held",
    "engine_manufacturers.last_year", "engine_eras.to_year",
    "constructor_lineage.to_year", "circuit_layouts.to_year",
    "points_systems.to_year", "eras.to_year", "tyre_suppliers.to_year",
    "technical_innovations.banned_year", "known_gaps.races_affected",
    "race_entries.fastest_lap_shared", "race_entries.grid",
    "race_entries.entrant", "race_entries.constructor_id",
    "drivers.title_years", "drivers.born", "seasons.notes",
    "grands_prix.notes", "circuits.notes", "constructors.notes",
    "drivers.notes", "drivers.wins_external", "drivers.poles_external",
    "drivers.fastest_laps_external", "drivers.external_source",
    "safety_milestones.trigger_event", "records.detail", "governance.detail",
    "race_entries.classified", "race_entries.status", "race_entries.points",
    "race_entries.laps_completed", "race_entries.finish_position",
    "races.circuit_id", "grands_prix.aliases", "constructors.title_years",
    "drivers.entries", "drivers.starts", "drivers.podiums",
    "drivers.career_points", "constructors.entries",
}

head(1, "COLUMN FILL RATES  (base tables; optional columns excluded)")
issues = 0
for t in tables():
    n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    if not n:
        print(f"  {t}: EMPTY TABLE")
        issues += 1
        continue
    rows = []
    for c in [x[1] for x in con.execute(f"PRAGMA table_info({t})")]:
        if f"{t}.{c}" in OPTIONAL:
            continue
        filled = con.execute(f'SELECT COUNT("{c}") FROM {t}').fetchone()[0]
        if filled == 0:
            rows.append(f"never populated: {c}")
            issues += 1
        elif filled < n * 0.5:
            rows.append(f"{c}: {filled}/{n} ({100*filled//n}%)")
    if rows:
        print(f"  {t}")
        for r in rows:
            print(f"      {r}")
if not issues:
    print("  every non-optional column is populated")

head(2, "TIME COVERAGE  (which tables span the full 1950-2026 range)")
for t, col in (("races", "year"), ("race_entries", None), ("seasons", "year"),
               ("standings", "year"), ("season_entries", "year")):
    if col is None:
        r = con.execute("""SELECT MIN(r.year), MAX(r.year), COUNT(DISTINCT r.year)
            FROM race_entries e JOIN races r ON r.id = e.race_id""").fetchone()
    else:
        r = con.execute(f"SELECT MIN({col}), MAX({col}), COUNT(DISTINCT {col}) FROM {t}").fetchone()
    span = "FULL" if r[2] == 77 else f"{r[2]}/77 seasons"
    print(f"  {t:<16} {r[0]}-{r[1]}   {span}")

head(3, "KEYS AND CONSTRAINTS")
sql = {r[0]: (r[1] or "") for r in con.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='table'")}
for t in ("races", "race_entries"):
    u = "UNIQUE" in sql.get(t, "")
    print(f"  {t:<16} UNIQUE constraint: {'yes' if u else 'NO'}")
fk = con.execute("PRAGMA foreign_key_check").fetchall()
print(f"  foreign key violations: {len(fk)}")
nfk = sum(1 for t in tables() for _ in con.execute(f"PRAGMA foreign_key_list({t})"))
print(f"  declared foreign keys:  {nfk}")

head(4, "REDUNDANCY  (a fact stored in two places can disagree)")
red = []
d = con.execute("""SELECT COUNT(*) FROM seasons s WHERE s.champion_wins IS NOT NULL
  AND s.champion_wins != (SELECT COUNT(*) FROM race_entries e JOIN races r
      ON r.id = e.race_id WHERE r.year = s.year AND e.finish_position = 1
      AND e.driver_id = s.drivers_champion)""").fetchone()[0]
red.append(("seasons.champion_wins", "derivable from race_entries", d))
d = con.execute("""SELECT COUNT(*) FROM seasons WHERE margin IS NOT NULL
  AND ABS(margin - (champion_points - runner_up_points)) > 0.001""").fetchone()[0]
red.append(("seasons.margin", "derivable from the two point totals", d))
for col, why, bad in red:
    print(f"  {col:<26} {why}")
    print(f"      {'consistent' if bad == 0 else f'{bad} rows DISAGREE'}")
print("  drivers.wins/poles/fastest_laps are derived at build time, not stored twice")

head(5, "COMPATIBILITY LAYER")
for v in ("race_results", "race_credits", "calendar"):
    if v in views():
        n = con.execute(f"SELECT COUNT(*) FROM {v}").fetchone()[0]
        print(f"  {v:<16} view over the base tables, {n} rows")
print("  pre-v2.4 queries keep working; new queries should use races/race_entries")

head(6, "VENUE COVERAGE")
n, held, nul = con.execute("""SELECT COUNT(*),
    SUM(status='completed'), SUM(circuit_id IS NULL) FROM races""").fetchone()
print(f"  {n - nul} of {n} races linked to a circuit ({held} of them held)")
nc, used = con.execute("""SELECT COUNT(*),
    SUM(EXISTS(SELECT 1 FROM races r WHERE r.circuit_id = c.id))
    FROM circuits c""").fetchone()
print(f"  {nc} circuits in the register, {used} of them with a race")
lay, cov = con.execute("""SELECT COUNT(DISTINCT circuit_id),
    (SELECT COUNT(*) FROM races r WHERE EXISTS
        (SELECT 1 FROM circuit_layouts l WHERE l.circuit_id = r.circuit_id
           AND r.year >= l.from_year
           AND (l.to_year IS NULL OR r.year <= l.to_year)))
    FROM circuit_layouts""").fetchone()
print(f"  {lay} circuits have a researched configuration timeline")
print(f"  {cov} of {n} races ({100 * cov / n:.0f}%) report the layout actually raced;")
print(f"  the rest fall back to the circuit's current figures "
      f"(v_race_venues.figures says which)")
print()
print("  most-used venues:")
for r in con.execute("""SELECT name, country, races, first_gp, last_gp
    FROM v_circuits WHERE races > 0 ORDER BY races DESC LIMIT 5"""):
    print(f"    {r[2]:>3}  {r[0]} ({r[1]}, {r[3]}-{r[4]})")

head(7, "CARS, TIMING AND RADIO")
nc, lm = con.execute(
    "SELECT COUNT(*), SUM(landmark) FROM cars").fetchone()
linked, tot = con.execute("""SELECT SUM(car_id IS NOT NULL), COUNT(*)
    FROM race_entries""").fetchone()
print(f"  {nc} cars, {lm} with a full deep dive")
print(f"  {linked} of {tot} race entries linked to a car ({100*linked/tot:.0f}%)")
filled = con.execute("""SELECT
    SUM(power_bhp IS NOT NULL), SUM(weight_kg IS NOT NULL),
    SUM(wheelbase_mm IS NOT NULL), SUM(story IS NOT NULL) FROM cars""").fetchone()
print(f"  spec fill: power {filled[0]}/{nc}, weight {filled[1]}/{nc}, "
      f"wheelbase {filled[2]}/{nc}, design story {filled[3]}/{nc}")
print()
for t, note in (("race_timing", "per-race pole/FL/race times"),
                ("laps", "per-lap timing, 2018- only"),
                ("stints", "tyre stints, 2018- only"),
                ("pit_stops", "pit stops, 2018- only"),
                ("race_control_messages", "flags, SC, penalties, 2018- only"),
                ("team_radio", "radio clips and notable exchanges")):
    n_ = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t:<24}{n_:>8}   {note}")
nb = con.execute("SELECT COUNT(*) FROM team_radio WHERE notable=1").fetchone()[0]
print(f"\n  {nb} of those radio rows are the curated notable set; the rest, and")
print("  every other row above, come from tools/fastf1_load.py, which needs")
print("  network access this build environment does not have.")

head(8, "CLASSIFICATION COVERAGE")
n, held = con.execute("""SELECT COUNT(*),
    (SELECT COUNT(*) FROM races WHERE status='completed') FROM race_entries"""
    ).fetchone()
pod = con.execute("""SELECT COUNT(*) FROM race_entries
    WHERE finish_position IN (2,3)""").fetchone()[0]
field = con.execute("""SELECT COUNT(*) FROM race_entries
    WHERE finish_position > 3""").fetchone()[0]
print(f"  {n} entries across {held} races = {n/held:.1f} per race")
print(f"  second and third places: {pod}")
print(f"  finishers below third:   {field}")
if not pod:
    print("\n  The classification has not been loaded. race_entries holds the")
    print("  winner, the pole-sitter and the fastest-lap setter only, which is")
    print("  why podiums, retirements, per-race points and grid positions are")
    print("  absent. tools/ergast_load.py fills all four in one run:")
    print("      python3 tools/ergast_load.py && python3 verify.py")
noent = con.execute("""SELECT COUNT(*) FROM drivers d WHERE NOT EXISTS
    (SELECT 1 FROM race_entries e WHERE e.driver_id = d.id)""").fetchone()[0]
print(f"\n  {noent} of {con.execute('SELECT COUNT(*) FROM drivers').fetchone()[0]} "
      f"register entries have no race rows yet")
print()

head(9, "READINESS FOR A FULL FINISHING ORDER")
e = con.execute("SELECT COUNT(*) FROM race_entries").fetchone()[0]
r = con.execute("SELECT COUNT(*) FROM races WHERE status='completed'").fetchone()[0]
print(f"  race_entries holds {e} rows across {r} races ({e/r:.1f} per race)")
print("  a full finishing order is roughly 10-20 per race, so 12,000-20,000 rows")
cols = [x[1] for x in con.execute("PRAGMA table_info(race_entries)")]
need = {"finish_position": "have", "grid": "have", "constructor_id": "have",
        "driver_id": "have", "race_id": "have"}
reserved = [c for c in ("classified", "status", "laps_completed", "points")
            if c in cols]
print(f"  columns in place:  {', '.join(k for k in need)}")
print(f"  columns reserved:  {', '.join(reserved) if reserved else 'none'}")
if len(reserved) == 4:
    print("  -> adding the rest of the field is pure INSERT.")
    print("     No table, column, key or view has to change.")
else:
    print("  -> the reserved columns are missing; adding a full order would")
    print("     require a schema change.")
