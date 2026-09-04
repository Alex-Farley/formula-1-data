#!/usr/bin/env python3
"""
Integrity and consistency checks. Exit code 1 if any FAIL.
"""
import os
import sqlite3
import sys
from collections import Counter

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "f1.db")
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
con.execute("PRAGMA foreign_keys=ON")
fails, warns = [], []


def check(name, ok, detail=""):
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        fails.append(name)


def warn(name, ok, detail=""):
    print(f"  [{'ok  ' if ok else 'WARN'}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        warns.append(name)


print("\nREFERENTIAL INTEGRITY")
fk = con.execute("PRAGMA foreign_key_check").fetchall()
check("foreign keys resolve", not fk, f"{len(fk)} violations" if fk else "")

for tbl, col, ref in [("seasons", "drivers_champion", "drivers"),
                      ("seasons", "runner_up", "drivers"),
                      ("seasons", "champion_team", "constructors"),
                      ("seasons", "constructors_champion", "constructors"),
                      ("season_entries", "driver_id", "drivers"),
                      ("season_entries", "constructor_id", "constructors"),
                      ("race_entries", "driver_id", "drivers"),
                      ("race_entries", "constructor_id", "constructors"),
                      ("races", "circuit_id", "circuits"),
                      ("races", "gp_id", "grands_prix"),
                      ("circuit_layouts", "circuit_id", "circuits")]:
    bad = con.execute(f"""SELECT COUNT(*) FROM {tbl} t WHERE t.{col} IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM {ref} r WHERE r.id = t.{col})""").fetchone()[0]
    check(f"{tbl}.{col} -> {ref}", bad == 0, f"{bad} orphans")

print("\nCOVERAGE")
yrs = [r[0] for r in con.execute("SELECT year FROM seasons ORDER BY year")]
missing = [y for y in range(1950, 2027) if y not in yrs]
check("every season 1950-2026 present", not missing, str(missing))
nochamp = [r[0] for r in con.execute(
    "SELECT year FROM seasons WHERE drivers_champion IS NULL AND year < 2026")]
check("every completed season has a champion", not nochamp, str(nochamp))
nocc = [r[0] for r in con.execute(
    """SELECT year FROM seasons WHERE constructors_champion IS NULL
       AND year BETWEEN 1958 AND 2025""")]
check("every season from 1958 has a constructors' champion", not nocc, str(nocc))
pre58 = con.execute(
    "SELECT COUNT(*) FROM seasons WHERE year<1958 AND constructors_champion IS NOT NULL"
).fetchone()[0]
check("no constructors' champion before 1958", pre58 == 0)

print("\nCROSS-TABULATION: title counts vs season records")
from_seasons = Counter(r[0] for r in con.execute(
    "SELECT drivers_champion FROM seasons WHERE drivers_champion IS NOT NULL"))
mismatch = []
for did, n in from_seasons.items():
    stored = con.execute("SELECT titles, full_name FROM drivers WHERE id=?", (did,)).fetchone()
    if stored["titles"] != n:
        mismatch.append(f"{stored['full_name']}: seasons say {n}, driver row says {stored['titles']}")
check("driver title counts agree with the seasons table", not mismatch, "; ".join(mismatch))

extra = con.execute("""SELECT full_name, titles FROM drivers WHERE titles>0
    AND id NOT IN (SELECT drivers_champion FROM seasons WHERE drivers_champion IS NOT NULL)"""
).fetchall()
check("no driver claims a title with no season behind it", not extra,
      "; ".join(f"{r['full_name']} ({r['titles']})" for r in extra))

ct = Counter(r[0] for r in con.execute(
    "SELECT constructors_champion FROM seasons WHERE constructors_champion IS NOT NULL"))
cmis = []
for cid, n in ct.items():
    row = con.execute("SELECT name, constructors_titles FROM constructors WHERE id=?",
                      (cid,)).fetchone()
    if row["constructors_titles"] != n:
        cmis.append(f"{row['name']}: seasons say {n}, row says {row['constructors_titles']}")
check("constructor title counts agree with the seasons table", not cmis, "; ".join(cmis))

print("\nTITLE-YEAR STRINGS")
bad = []
for r in con.execute("SELECT id, full_name, titles, title_years FROM drivers WHERE titles>0"):
    yrs_listed = [int(y) for y in (r["title_years"] or "").split(",") if y.strip()]
    if len(yrs_listed) != r["titles"]:
        bad.append(f"{r['full_name']}: {r['titles']} titles, {len(yrs_listed)} years listed")
    for y in yrs_listed:
        got = con.execute("SELECT drivers_champion FROM seasons WHERE year=?", (y,)).fetchone()
        if not got or got[0] != r["id"]:
            bad.append(f"{r['full_name']} claims {y} but seasons disagree")
check("title_years match the seasons table exactly", not bad, "; ".join(bad))

print("\nDUPLICATES AND UNIQUENESS")
for tbl in ("drivers", "constructors", "circuits", "grands_prix", "personnel"):
    n = con.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
    u = con.execute(f"SELECT COUNT(DISTINCT id) FROM {tbl}").fetchone()[0]
    check(f"{tbl} ids unique", n == u, f"{n} rows, {u} ids")
dupname = con.execute("""SELECT full_name, COUNT(*) n FROM drivers
    GROUP BY lower(full_name) HAVING n>1""").fetchall()
warn("no duplicate driver names", not dupname,
     "; ".join(f"{r['full_name']} x{r['n']}" for r in dupname))

print("\nARITHMETIC")
bad = con.execute("""SELECT year, champion_points, runner_up_points, margin FROM seasons
    WHERE champion_points IS NOT NULL AND runner_up_points IS NOT NULL
      AND ABS(margin - (champion_points - runner_up_points)) > 0.001""").fetchall()
check("season margins equal champion minus runner-up", not bad,
      "; ".join(str(r["year"]) for r in bad))
neg = con.execute("SELECT year FROM seasons WHERE margin < 0").fetchall()
check("no champion scored fewer points than the runner-up", not neg,
      "; ".join(str(r["year"]) for r in neg))

print("\nSTANDINGS")
for y in (2025, 2026):
    for t in ("drivers", "constructors"):
        pos = [r[0] for r in con.execute("""SELECT position FROM standings
            WHERE year=? AND table_type=? ORDER BY position""", (y, t))]
        check(f"{y} {t} standings positions are 1..n with no gaps",
              pos == list(range(1, len(pos) + 1)), str(pos[:5]))
        pts = [r[0] for r in con.execute("""SELECT points FROM standings
            WHERE year=? AND table_type=? ORDER BY position""", (y, t))]
        check(f"{y} {t} points are non-increasing down the order",
              all(pts[i] >= pts[i + 1] for i in range(len(pts) - 1)))

d25 = con.execute("""SELECT SUM(points) FROM standings WHERE year=2025
    AND table_type='drivers'""").fetchone()[0]
c25 = con.execute("""SELECT SUM(points) FROM standings WHERE year=2025
    AND table_type='constructors'""").fetchone()[0]
check("2025 driver points total equals constructor points total", d25 == c25,
      f"drivers {d25}, constructors {c25}")
d26 = con.execute("""SELECT SUM(points) FROM standings WHERE year=2026
    AND table_type='drivers'""").fetchone()[0]
c26 = con.execute("""SELECT SUM(points) FROM standings WHERE year=2026
    AND table_type='constructors'""").fetchone()[0]
check("2026 driver points total equals constructor points total", d26 == c26,
      f"drivers {d26}, constructors {c26}")

champ25 = con.execute("""SELECT champion_points, runner_up_points FROM seasons
    WHERE year=2025""").fetchone()
top25 = con.execute("""SELECT points FROM standings WHERE year=2025
    AND table_type='drivers' ORDER BY position LIMIT 2""").fetchall()
check("2025 season row matches the 2025 standings",
      champ25[0] == top25[0][0] and champ25[1] == top25[1][0],
      f"season {tuple(champ25)} vs standings {(top25[0][0], top25[1][0])}")

print("\nRACE RESULTS")
for y, n in ((2025, 24), (2026, 12)):
    got = con.execute("""SELECT COUNT(*) FROM races
        WHERE year=? AND status='completed'""", (y,)).fetchone()[0]
    check(f"{y} has {n} completed races", got == n, f"got {got}")
    rounds = [r[0] for r in con.execute("""SELECT round FROM races
        WHERE year=? AND status='completed' ORDER BY round""", (y,))]
    check(f"{y} rounds are 1..{n} with no gaps", rounds == list(range(1, n + 1)))

w25 = Counter(r[0] for r in con.execute("""SELECT e.driver_id FROM race_entries e
    JOIN races r ON r.id=e.race_id WHERE r.year=2025 AND e.finish_position=1"""))
check("2025 win tally sums to 24", sum(w25.values()) == 24)
print("        2025 winners:", ", ".join(f"{k} {v}" for k, v in w25.most_common()))
w26 = Counter(r[0] for r in con.execute("""SELECT e.driver_id FROM race_entries e
    JOIN races r ON r.id=e.race_id WHERE r.year=2026 AND e.finish_position=1"""))
print("        2026 winners:", ", ".join(f"{k} {v}" for k, v in w26.most_common()))

# the 2025 champion must have won at least one race that year
c25id = con.execute("SELECT drivers_champion FROM seasons WHERE year=2025").fetchone()[0]
check("2025 champion appears in the 2025 race winners", c25id in w25)

print("\nHARVESTED RACE RESULTS")
yrs = [r[0] for r in con.execute("SELECT DISTINCT year FROM races ORDER BY year")]
check("races cover every season 1950-2026",
      yrs == list(range(1950, 2027)), f"{len(yrs)} seasons")

bad = []
for y, n in con.execute("""SELECT year, COUNT(*) FROM races
    WHERE status='completed' GROUP BY year"""):
    stored = con.execute("SELECT rounds FROM seasons WHERE year=?", (y,)).fetchone()[0]
    expected = stored if y != 2026 else 12   # 2026 in progress
    if n != expected:
        bad.append(f"{y}: {n} completed vs {expected} rounds")
check("completed race count per season matches the rounds recorded",
      not bad, "; ".join(bad))

bad = []
for y in yrs:
    rs = [r[0] for r in con.execute(
        "SELECT round FROM races WHERE year=? ORDER BY round", (y,))]
    if rs != list(range(1, len(rs) + 1)):
        bad.append(str(y))
check("rounds are contiguous 1..n in every season", not bad, "; ".join(bad))

orphan = con.execute("""SELECT COUNT(*) FROM races r WHERE r.status='completed'
    AND NOT EXISTS (SELECT 1 FROM race_entries e
                    WHERE e.race_id=r.id AND e.finish_position=1)""").fetchone()[0]
check("every completed race has a winner", orphan == 0, f"{orphan} without")

nocons = con.execute("""SELECT COUNT(*) FROM race_entries e
    WHERE e.finish_position=1 AND e.constructor_id IS NULL""").fetchone()[0]
check("only the Indianapolis 500 winners lack a constructor", nocons == 11,
      f"{nocons} (expected 11: Indy 1950-1960)")
indy = con.execute("""SELECT COUNT(*) FROM race_entries e JOIN races r ON r.id=e.race_id
    WHERE e.finish_position=1 AND e.constructor_id IS NULL
      AND r.gp_id='indianapolis-500'""").fetchone()[0]
check("all constructor-less winners are Indianapolis 500s", indy == nocons)

shared = con.execute("""SELECT r.year, r.name_used FROM races r
    JOIN race_entries e ON e.race_id=r.id AND e.shared_drive=1
    GROUP BY r.id ORDER BY r.year""").fetchall()
check("shared drives are recorded with both drivers", len(shared) == 3,
      "; ".join(f"{r[0]} {r[1]}" for r in shared))

print("\nWIN TALLIES: stored figures vs figures derived from race results")
bad = []
for r in con.execute("""SELECT id, full_name, wins FROM drivers WHERE wins IS NOT NULL"""):
    d = con.execute("""SELECT COUNT(*) FROM race_entries
        WHERE driver_id=? AND finish_position=1""", (r["id"],)).fetchone()[0]
    if r["wins"] != d:
        bad.append(f"{r['full_name']}: stored {r['wins']}, derived {d}")
check("every driver win total equals the number of races they won", not bad,
      "; ".join(bad))

bad = []
for r in con.execute("""SELECT id, name, wins FROM constructors WHERE wins IS NOT NULL"""):
    d = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
        WHERE constructor_id=? AND finish_position=1""", (r["id"],)).fetchone()[0]
    if r["wins"] != d:
        bad.append(f"{r['name']}: stored {r['wins']}, derived {d}")
check("every constructor win total equals the number of races it won", not bad,
      "; ".join(bad))

total = con.execute("SELECT COUNT(*) FROM races WHERE status='completed'").fetchone()[0]
credits = con.execute("""SELECT COUNT(*) FROM race_entries
    WHERE finish_position = 1""").fetchone()[0]
print(f"        {total} races, {credits} win credits, "
      f"{con.execute('SELECT COUNT(DISTINCT driver_id) FROM race_entries WHERE finish_position=1').fetchone()[0]}"
      " distinct winners")

print("\nPOLE POSITION AND FASTEST LAP")
done = con.execute("SELECT COUNT(*) FROM races WHERE status='completed'").fetchone()[0]
check("1161 completed races", done == 1161, f"{done}")
np = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
    WHERE grid = 1""").fetchone()[0]
check("pole recorded for every completed race", np == 1161, f"{np} of 1161")

nfl = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
    WHERE fastest_lap = 1""").fetchone()[0]
declared_gap = con.execute("""SELECT SUM(races_affected) FROM known_gaps
    WHERE field = 'fastest_lap'""").fetchone()[0]
check("races without a fastest lap equal the declared gaps",
      1161 - nfl == declared_gap, f"{1161 - nfl} missing, {declared_gap} declared")
nofl = con.execute("""SELECT r.year, r.round FROM races r WHERE r.status='completed'
    AND NOT EXISTS (SELECT 1 FROM race_entries e
                    WHERE e.race_id = r.id AND e.fastest_lap = 1)""").fetchall()
check("the only race without a fastest lap is 2021 Belgium, where none was set",
      [tuple(r) for r in nofl] == [(2021, 12)], str([tuple(r) for r in nofl]))

orph = con.execute("""SELECT COUNT(*) FROM race_entries e
    WHERE NOT EXISTS (SELECT 1 FROM drivers d WHERE d.id = e.driver_id)""").fetchone()[0]
check("every entry resolves to a driver", orph == 0, f"{orph} orphans")
orph = con.execute("""SELECT COUNT(*) FROM race_entries e
    WHERE NOT EXISTS (SELECT 1 FROM races r WHERE r.id = e.race_id)""").fetchone()[0]
check("every entry resolves to a race", orph == 0, f"{orph} orphans")
orph = con.execute("""SELECT COUNT(*) FROM races r
    WHERE NOT EXISTS (SELECT 1 FROM grands_prix g WHERE g.id = r.gp_id)""").fetchone()[0]
check("every race resolves to a grand prix", orph == 0, f"{orph} orphans")
orph = con.execute("""SELECT COUNT(*) FROM races r WHERE r.circuit_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM circuits c WHERE c.id = r.circuit_id)""").fetchone()[0]
check("every race circuit resolves", orph == 0, f"{orph} orphans")

dup = con.execute("""SELECT race_id, driver_id, COUNT(*) n FROM race_entries
    GROUP BY 1,2 HAVING n > 1""").fetchall()
check("a driver appears at most once per race", not dup, f"{len(dup)} duplicates")

multi = con.execute("""SELECT race_id, COUNT(*) n FROM race_entries
    WHERE grid = 1 GROUP BY race_id HAVING n > 1""").fetchall()
check("no race has two cars on pole", not multi, f"{len(multi)} races")

multi = con.execute("""SELECT race_id, COUNT(*) n FROM race_entries
    WHERE finish_position = 1 GROUP BY race_id HAVING n > 1""").fetchall()
bad = [m for m in multi if con.execute("""SELECT COUNT(*) FROM race_entries
    WHERE race_id=? AND finish_position=1 AND shared_drive=0""",
    (m[0],)).fetchone()[0] > 1]
check("a race has one winner, unless the drive was shared", not bad, f"{len(bad)} races")
check("the shared drives are the three known ones", len(multi) == 3, f"{len(multi)}")

shared = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
    WHERE fastest_lap = 1 AND fastest_lap_shared > 1""").fetchone()[0]
check("shared fastest laps are recorded as such", shared == 6, f"{shared} races")

# the name a race carried must be a known name for the event it points at
bad = []
import sys as _s; _s.path.insert(0, os.path.dirname(DB))
from data import events as _EV
_m = _EV.name_to_id()
for r in con.execute("SELECT year, round, name_used, gp_id FROM races"):
    if _m.get(r["name_used"]) != r["gp_id"]:
        bad.append(f"{r['year']} r{r['round']} {r['name_used']}")
check("every race name resolves to the event it is linked to", not bad,
      "; ".join(bad[:5]))

# Every declared gap must still be a gap. A gap that has been filled should
# be removed from KNOWN_GAPS, not left standing with a stale count.
stale = []
for g in con.execute("SELECT field, area, races_affected FROM known_gaps"):
    if g["races_affected"] is None or g["races_affected"] == 0:
        continue
    actual = con.execute(
        f"SELECT COUNT(*) FROM races WHERE {g['field']} IS NULL").fetchone()[0] \
        if g["field"] in ("circuit_id", "dates") else None
    if actual is not None and actual != g["races_affected"]:
        stale.append(f"{g['field']}: declared {g['races_affected']}, actual {actual}")
check("declared gaps match the actual gaps", not stale, "; ".join(stale))

print("\nSTRUCTURE")
u = con.execute("""SELECT COUNT(*) FROM (SELECT year, round FROM races
    GROUP BY year, round HAVING COUNT(*) > 1)""").fetchone()[0]
check("(year, round) is unique across races", u == 0, f"{u} duplicates")
bad = con.execute("""SELECT COUNT(*) FROM constructors c
    WHERE c.lineage_chain IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM constructor_lineage l WHERE l.chain_id = c.lineage_chain)"""
).fetchone()[0]
check("every constructor resolves to a lineage chain", bad == 0, f"{bad} dangling")
bad = con.execute("""SELECT COUNT(*) FROM seasons s WHERE s.champion_wins IS NOT NULL
  AND s.champion_wins != (SELECT COUNT(*) FROM race_entries e JOIN races r
      ON r.id = e.race_id WHERE r.year = s.year AND e.finish_position = 1
      AND e.driver_id = s.drivers_champion)""").fetchone()[0]
check("champion_wins matches the race records in every season", bad == 0,
      f"{bad} seasons")

print("\nEXTERNAL FIGURES VS THE RACE RECORDS")
bad = con.execute("""SELECT COUNT(*) FROM discrepancies
    WHERE status = 'undeclared'""").fetchone()[0]
check("every external-vs-derived difference is accounted for", bad == 0,
      f"{bad} undeclared")

# wins, poles and fastest laps must equal what the race records say, for
# every driver, without exception - they are derived from them
derived = {r["driver_id"]: (r["w"], r["p"], r["f"]) for r in con.execute("""
    SELECT driver_id,
           SUM(CASE WHEN finish_position = 1 THEN 1 ELSE 0 END) AS w,
           SUM(CASE WHEN grid = 1 THEN 1 ELSE 0 END) AS p,
           SUM(fastest_lap) AS f
    FROM race_entries GROUP BY driver_id""")}
bad = []
for r in con.execute("SELECT id, full_name, wins, poles, fastest_laps FROM drivers"):
    w, p, f = derived.get(r["id"], (0, 0, 0))
    if (r["wins"], r["poles"], r["fastest_laps"]) != (w, p, f):
        bad.append(f"{r['full_name']} ({r['wins']},{r['poles']},{r['fastest_laps']}"
                   f" vs {w},{p},{f})")
check("every driver's wins, poles and fastest laps equal the race records",
      not bad, "; ".join(bad[:6]))

n = con.execute("SELECT COUNT(*) FROM drivers WHERE wins_external IS NOT NULL").fetchone()[0]
d = con.execute("SELECT COUNT(*) FROM discrepancies").fetchone()[0]
print(f"        {n} drivers compared on three fields; {d} differences, all accounted for")

openn = con.execute("SELECT COUNT(*) FROM discrepancies WHERE status LIKE 'open%'").fetchone()[0]
warn("no open discrepancies awaiting an official check", openn == 0,
     f"{openn} open - see the discrepancies table")

# spot-check a sample of headline career records against the known official figures
KNOWN = {"Sir Lewis Hamilton": (106, 104, 69), "Michael Schumacher": (91, 68, 77),
         "Ayrton Senna": (41, 65, 19), "Alain Prost": (51, 33, 41),
         "Juan Manuel Fangio": (24, 29, 23), "Jim Clark": (25, 33, 28),
         "Sebastian Vettel": (53, 57, 38), "Max Verstappen": (71, 48, 37),
         "Nigel Mansell": (31, 32, 30), "Sir Jackie Stewart": (27, 17, 15)}
bad = []
for name, (w, p, f) in KNOWN.items():
    r = con.execute("""SELECT wins, poles, fastest_laps FROM drivers
        WHERE full_name = ?""", (name,)).fetchone()
    if r is None or tuple(r) != (w, p, f):
        bad.append(f"{name}: expected {(w, p, f)}, got {tuple(r) if r else None}")
check("headline career records match the known official figures", not bad,
      "; ".join(bad))

slams = con.execute("SELECT COUNT(*) FROM v_grand_slams").fetchone()[0]
check("grand slams (pole + win + fastest lap) found", slams > 100, f"{slams}")

print("\nCALENDAR")
rounds = [r[0] for r in con.execute(
    "SELECT round FROM races WHERE year=2026 ORDER BY round")]
check("2026 calendar rounds are 1..23", rounds == list(range(1, 24)))
sprints = con.execute(
    "SELECT COUNT(*) FROM races WHERE year=2026 AND sprint=1").fetchone()[0]
check("2026 has six sprint events", sprints == 6, f"got {sprints}")
completed = con.execute("""SELECT COUNT(*) FROM races
    WHERE year=2026 AND status='completed'""").fetchone()[0]
check("completed 2026 rounds match the recorded results",
      completed == sum(w26.values()),
      f"completed {completed}, results {sum(w26.values())}")

for y in (2025, 2026):
    cw = con.execute("SELECT drivers_champion, champion_wins FROM seasons WHERE year=?",
                     (y,)).fetchone()
    if cw["drivers_champion"] and cw["champion_wins"] is not None:
        actual = con.execute("""SELECT COUNT(*) FROM race_entries e
            JOIN races r ON r.id=e.race_id
            WHERE r.year=? AND e.driver_id=? AND e.finish_position=1""",
            (y, cw["drivers_champion"])).fetchone()[0]
        check(f"{y} champion_wins matches the race records",
              cw["champion_wins"] == actual, f"stored {cw['champion_wins']}, counted {actual}")
nocirc = con.execute(
    "SELECT COUNT(*) FROM races WHERE year=2026 AND circuit_id IS NULL").fetchone()[0]
check("every 2026 round maps to a circuit", nocirc == 0, f"{nocirc} unmapped")

print("\nENTRIES")
n = con.execute("""SELECT COUNT(*) FROM season_entries WHERE year=2026
    AND role='race'""").fetchone()[0]
check("2026 has 22 race seats", n == 22, f"got {n}")
teams = con.execute("""SELECT COUNT(DISTINCT constructor_id) FROM season_entries
    WHERE year=2026 AND role='race'""").fetchone()[0]
check("2026 has 11 teams", teams == 11, f"got {teams}")
percar = con.execute("""SELECT constructor_id, COUNT(*) n FROM season_entries
    WHERE year=2026 AND role='race' GROUP BY constructor_id HAVING n != 2""").fetchall()
check("every 2026 team has exactly two race drivers", not percar,
      "; ".join(r["constructor_id"] for r in percar))
dupnum = con.execute("""SELECT car_number, COUNT(*) n FROM season_entries
    WHERE year=2026 AND role='race' GROUP BY car_number HAVING n>1""").fetchall()
check("2026 car numbers are unique", not dupnum)
missing = con.execute("""SELECT entity FROM standings WHERE year=2026
    AND table_type='drivers' AND entity_id NOT IN
    (SELECT driver_id FROM season_entries WHERE year=2026)""").fetchall()
check("every 2026 driver in the standings has an entry", not missing,
      "; ".join(r[0] for r in missing))

print("\nTIMELINE SANITY")
bad = con.execute("""SELECT full_name, born, died FROM drivers
    WHERE born IS NOT NULL AND died IS NOT NULL AND died < born""").fetchall()
check("nobody died before they were born", not bad)
bad = con.execute("""SELECT full_name, first_season, last_season FROM drivers
    WHERE last_season IS NOT NULL AND first_season IS NOT NULL
    AND last_season < first_season""").fetchall()
check("driver careers run forwards", not bad,
      "; ".join(r["full_name"] for r in bad))
bad = con.execute("""SELECT name, first_entry, last_entry FROM constructors
    WHERE last_entry IS NOT NULL AND last_entry < first_entry""").fetchall()
check("constructor entries run forwards", not bad,
      "; ".join(r["name"] for r in bad))
bad = con.execute("""SELECT name, first_gp, last_gp FROM circuits
    WHERE last_gp IS NOT NULL AND last_gp < first_gp""").fetchall()
check("circuit usage runs forwards", not bad, "; ".join(r["name"] for r in bad))
bad = con.execute("""SELECT full_name, born, first_season FROM drivers
    WHERE born IS NOT NULL AND first_season IS NOT NULL
    AND CAST(substr(born,1,4) AS INTEGER) + 16 > first_season""").fetchall()
check("nobody started before turning 16", not bad,
      "; ".join(f"{r['full_name']} b.{r['born']} debut {r['first_season']}" for r in bad))
bad = con.execute("""SELECT id, from_year, to_year FROM constructor_lineage
    WHERE to_year IS NOT NULL AND to_year < from_year""").fetchall()
check("lineage periods run forwards", not bad)

print("\nCARS")
from data import cars as _CR
nc = con.execute("SELECT COUNT(*) FROM cars").fetchone()[0]
lm = con.execute("SELECT COUNT(*) FROM cars WHERE landmark=1").fetchone()[0]
print(f"  [info] {nc} cars in the register, {lm} with a full deep dive")

bad = con.execute("""SELECT c.id FROM cars c WHERE c.supersedes_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM cars p WHERE p.id = c.supersedes_id)""").fetchall()
check("every supersedes_id resolves", not bad, ", ".join(r[0] for r in bad))

bad = con.execute("""SELECT c.id FROM cars c JOIN cars p ON p.id = c.supersedes_id
    WHERE c.from_year < p.from_year""").fetchall()
check("a car does not predate the one it supersedes", not bad,
      ", ".join(r[0] for r in bad))

bad = con.execute("""SELECT COUNT(*) FROM cars
    WHERE to_year IS NOT NULL AND to_year < from_year""").fetchone()[0]
check("car years run forwards", bad == 0, f"{bad} reversed")

# An entry can only carry a car the constructor actually built, in a year the
# car existed.
bad = con.execute("""SELECT COUNT(*) FROM race_entries e JOIN cars c ON c.id=e.car_id
    WHERE e.constructor_id IS NOT NULL AND e.constructor_id != c.constructor_id"""
    ).fetchone()[0]
check("linked cars belong to the entry's constructor", bad == 0, f"{bad} wrong")

bad = con.execute("""SELECT r.year, c.id, c.from_year, c.to_year
    FROM race_entries e JOIN cars c ON c.id=e.car_id JOIN races r ON r.id=e.race_id
    WHERE r.year < c.from_year OR (c.to_year IS NOT NULL AND r.year > c.to_year)
    LIMIT 5""").fetchall()
check("no entry falls outside its car's years", not bad,
      "; ".join(f"{r[0]} {r[1]} ({r[2]}-{r[3]})" for r in bad))

# The strongest car check. A car cannot have won more races than the number
# published on its own reference page; and where CAR_SEASONS covers every
# year the car raced, the derived total must EQUAL the published one. Poles
# are a lower bound only - see the note in data/cars.py.
over, neq, checked = [], [], 0
for cid, (ew, ep) in _CR.EXPECTED.items():
    row = con.execute("""SELECT wins, poles, from_year, to_year FROM cars
                         WHERE id=?""", (cid,)).fetchone()
    if row is None:
        over.append(f"{cid}: not in the register")
        continue
    w, p, fy, ty = row
    complete = _CR.seasons_complete(cid, fy, ty)
    if ew is not None:
        checked += 1
        if w > ew:
            over.append(f"{cid}: derived {w} wins, published {ew}")
        elif complete and w != ew:
            neq.append(f"{cid}: all seasons linked but {w} wins, published {ew}")
    if ep is not None and p > ep:
        over.append(f"{cid}: derived {p} poles, published {ep}")
check("no car has more wins or poles than its published total", not over,
      "; ".join(over))
check("fully linked cars match their published win total exactly", not neq,
      "; ".join(neq))
ncomplete = sum(1 for cid in _CR.EXPECTED
                if (lambda r: r and _CR.seasons_complete(cid, r[0], r[1]))(
                    con.execute("SELECT from_year,to_year FROM cars WHERE id=?",
                                (cid,)).fetchone()))
print(f"  [info] {checked} cars compared against published figures, "
      f"{ncomplete} of them fully linked")

linked = con.execute("SELECT COUNT(*) FROM race_entries WHERE car_id IS NOT NULL"
                     ).fetchone()[0]
tot = con.execute("SELECT COUNT(*) FROM race_entries").fetchone()[0]
print(f"  [info] {linked} of {tot} race entries linked to a car "
      f"({100 * linked / tot:.0f}%)")

print("\nTIMING AND RADIO")
for t in ("race_timing", "laps", "stints", "pit_stops",
          "race_control_messages", "team_radio"):
    n_ = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  [info] {t:<22} {n_} rows")
# These tables are filled by tools/fastf1_load.py, which needs network access.
# Every check below holds whether they are empty or full.
bad = con.execute("""SELECT COUNT(*) FROM laps l WHERE NOT EXISTS
    (SELECT 1 FROM races r WHERE r.id = l.race_id)""").fetchone()[0]
check("every lap belongs to a race", bad == 0, f"{bad} orphans")
bad = con.execute("""SELECT COUNT(*) FROM laps
    WHERE lap_seconds IS NOT NULL AND (lap_seconds <= 0 OR lap_seconds > 900)"""
    ).fetchone()[0]
check("lap times are plausible", bad == 0, f"{bad} outside 0-900 s")
bad = con.execute("""SELECT COUNT(*) FROM laps WHERE race_id IN
    (SELECT id FROM races WHERE year < 2018)""").fetchone()[0]
check("no lap data claims to predate live timing", bad == 0,
      f"{bad} rows before 2018")
bad = con.execute("""SELECT COUNT(*) FROM stints
    WHERE lap_end IS NOT NULL AND lap_start IS NOT NULL AND lap_end < lap_start"""
    ).fetchone()[0]
check("stints run forwards", bad == 0, f"{bad} reversed")
bad = con.execute("""SELECT COUNT(*) FROM team_radio
    WHERE notable = 0 AND audio_url IS NULL AND transcript IS NULL""").fetchone()[0]
check("every radio row has a clip or a transcript", bad == 0, f"{bad} empty")
bad = con.execute("""SELECT COUNT(*) FROM race_timing t WHERE
    (t.pole_seconds IS NOT NULL AND t.fastest_lap_seconds IS NOT NULL
     AND t.fastest_lap_seconds < t.pole_seconds * 0.9)""").fetchone()[0]
check("a race fastest lap is not wildly quicker than pole", bad == 0, f"{bad} suspect")

print("\nCIRCUITS AND VENUES")
n, nul = con.execute(
    "SELECT COUNT(*), SUM(circuit_id IS NULL) FROM races").fetchone()
check("every race has a circuit", nul == 0, f"{nul} of {n} races with no circuit")

# The authored first_gp/last_gp on a circuit must agree with the race records.
# last_gp NULL means "still in use", so the last race there must be recent.
bad = []
for r in con.execute("""SELECT c.id, c.first_gp, c.last_gp,
        MIN(r.year) mn, MAX(r.year) mx, COUNT(r.id) n
    FROM circuits c LEFT JOIN races r ON r.circuit_id = c.id
    GROUP BY c.id ORDER BY c.id"""):
    # races here include rounds already on a published calendar
    if r["n"] == 0:
        if r["first_gp"] is not None or r["last_gp"] is not None:
            bad.append(f"{r['id']}: no races but dated {r['first_gp']}-{r['last_gp']}")
        continue
    if r["first_gp"] != r["mn"]:
        bad.append(f"{r['id']}: first_gp {r['first_gp']} vs first race {r['mn']}")
    if r["last_gp"] is None and r["mx"] < 2025:
        bad.append(f"{r['id']}: open-ended but last race {r['mx']}")
    if r["last_gp"] is not None and r["last_gp"] != r["mx"]:
        bad.append(f"{r['id']}: last_gp {r['last_gp']} vs last race {r['mx']}")
check("circuit first/last GP agree with the race records", not bad, "; ".join(bad))

bad = con.execute("""SELECT COUNT(*) FROM circuits c WHERE c.gp_count !=
    (SELECT COUNT(*) FROM races r WHERE r.circuit_id = c.id
                                  AND r.status = 'completed')""").fetchone()[0]
check("circuits.gp_count equals the races held there", bad == 0, f"{bad} wrong")

held, sched = con.execute("""SELECT SUM(gp_count),
    (SELECT COUNT(*) FROM races WHERE status != 'completed') FROM circuits""").fetchone()
check("circuit race counts sum to the race table", held + sched == n,
      f"{held} held + {sched} scheduled vs {n} races")

# Where a circuit has layout rows at all, they must form a complete,
# non-overlapping timeline of the configurations used for championship races.
bad = con.execute("""SELECT COUNT(*) FROM circuit_layouts a
    JOIN circuit_layouts b ON a.circuit_id = b.circuit_id AND a.id < b.id
    WHERE a.by_year = 1 AND b.by_year = 1
      AND a.from_year <= COALESCE(b.to_year, 9999)
      AND b.from_year <= COALESCE(a.to_year, 9999)""").fetchone()[0]
check("the by-year layout timelines do not overlap", bad == 0,
      f"{bad} overlapping pairs")

bad = con.execute("""SELECT r.year, r.round, r.circuit_id FROM races r
    WHERE r.circuit_id IN (SELECT circuit_id FROM circuit_layouts)
      AND NOT EXISTS (SELECT 1 FROM circuit_layouts l
          WHERE l.circuit_id = r.circuit_id AND l.by_year = 1
            AND r.year >= l.from_year
            AND (l.to_year IS NULL OR r.year <= l.to_year))""").fetchall()
check("every race at a multi-layout circuit falls in the timeline", not bad,
      "; ".join(f"{r['year']} r{r['round']} {r['circuit_id']}" for r in bad[:6]))

# Every race must resolve to exactly one layout, whether by its override key
# or by the timeline. v_race_venues would silently duplicate a race otherwise.
dup = con.execute("""SELECT COUNT(*) FROM (SELECT race_id FROM v_race_venues
    GROUP BY race_id HAVING COUNT(*) > 1)""").fetchone()[0]
check("v_race_venues returns one row per race", dup == 0, f"{dup} duplicated")
check("v_race_venues covers every race",
      con.execute("SELECT COUNT(*) FROM v_race_venues").fetchone()[0] == n)

bad = con.execute("""SELECT circuit_id, layout_key FROM circuit_layouts l
    WHERE by_year = 0 AND NOT EXISTS (SELECT 1 FROM races r
        WHERE r.circuit_id = l.circuit_id AND r.layout_key = l.layout_key)""").fetchall()
check("every one-off layout is claimed by a race", not bad,
      "; ".join(f"{r[0]}:{r[1]}" for r in bad))

bad = con.execute("""SELECT COUNT(*) FROM races r WHERE r.layout_key IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM circuit_layouts l
        WHERE l.circuit_id = r.circuit_id AND l.layout_key = r.layout_key)""").fetchone()[0]
check("every race layout override resolves", bad == 0, f"{bad} dangling")

bad = con.execute("""SELECT COUNT(*) FROM circuit_layouts l WHERE by_year = 1
    AND NOT EXISTS (SELECT 1 FROM races r WHERE r.circuit_id = l.circuit_id
       AND r.year >= l.from_year
       AND (l.to_year IS NULL OR r.year <= l.to_year))""").fetchone()[0]
warn("every layout hosted at least one championship race", bad == 0,
     f"{bad} unused layouts")

# A Grand Prix that has only ever run at one circuit must not have picked up
# a second one; the register in data/events.py depends on that staying true.
bad = con.execute("""SELECT gp_id, COUNT(DISTINCT circuit_id) n,
        GROUP_CONCAT(DISTINCT circuit_id) ids FROM races
    GROUP BY gp_id HAVING n > 1""").fetchall()
print(f"  [info] {len(bad)} Grands Prix have used more than one circuit")

bad = con.execute("""SELECT COUNT(*) FROM circuits c WHERE NOT EXISTS
    (SELECT 1 FROM races r WHERE r.circuit_id = c.id)""").fetchone()[0]
warn("every circuit in the register has hosted a race", bad == 0,
     f"{bad} with none (expected: 1, the Nurburgring Sudschleife, "
     f"plus any venue on a future calendar)")

print("\nOVERLAP CHECKS")
rows = con.execute("""SELECT chain_id, entity_name, from_year, to_year
    FROM constructor_lineage ORDER BY chain_id, sequence""").fetchall()
overlap = []
prev = None
for r in rows:
    if prev and prev["chain_id"] == r["chain_id"]:
        pend = prev["to_year"] or 9999
        if r["from_year"] < pend:
            overlap.append(f"{r['chain_id']}: {prev['entity_name']} ends {pend}, "
                           f"{r['entity_name']} starts {r['from_year']}")
    prev = r
warn("lineage periods do not overlap", not overlap, "; ".join(overlap))

print("\nCONFIDENCE DISTRIBUTION")
for tbl in ("drivers", "constructors", "circuits", "seasons"):
    dist = con.execute(f"""SELECT confidence, COUNT(*) n FROM {tbl}
        GROUP BY confidence ORDER BY n DESC""").fetchall()
    print(f"  {tbl:<14}" + "  ".join(f"{r['confidence']}={r['n']}" for r in dist))
bad = con.execute("""SELECT COUNT(*) FROM drivers
    WHERE confidence NOT IN (SELECT confidence FROM provenance)""").fetchone()[0]
check("all confidence values are in the provenance ladder", bad == 0)

print("\nVIEWS")
for v in ("v_champions", "v_title_count", "v_constructor_titles",
          "v_current_grid", "v_season_timeline", "v_unverified"):
    n = con.execute(f"SELECT COUNT(*) FROM {v}").fetchone()[0]
    check(f"view {v} returns rows", n > 0, f"{n} rows")

print("\n" + "=" * 60)
if fails:
    print(f"{len(fails)} CHECK(S) FAILED:")
    for f in fails:
        print("   -", f)
    sys.exit(1)
print(f"All checks passed. {len(warns)} warning(s).")
