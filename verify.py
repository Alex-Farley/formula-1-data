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

# Shared drives. This used to assert a count of exactly 3, which was the
# number the winner harvest happened to record - a constant, not a property.
# The full classification finds 42 races with a shared car, which is correct:
# sharing was routine in the 1950s and only died out in the 1960s. So check
# what is actually true of a shared drive instead of how many there are.
shared_races = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
    WHERE shared_drive = 1""").fetchone()[0]
late = con.execute("""SELECT r.year, r.name_used FROM races r
    JOIN race_entries e ON e.race_id = r.id AND e.shared_drive = 1
    WHERE r.year > 1964 GROUP BY r.id ORDER BY r.year""").fetchall()
check("no shared drive after 1964, when the practice ended", not late,
      "; ".join(f"{r[0]} {r[1]}" for r in late))
noplace = con.execute("""SELECT COUNT(*) FROM race_entries
    WHERE shared_drive = 1 AND finish_position IS NULL""").fetchone()[0]
check("every shared drive is a classified finish", noplace == 0,
      f"{noplace} with no position")
print(f"  [info] {shared_races} races have a shared car. The two drivers are "
      f"not always both present: this register holds a few hundred of the "
      f"~780 who have started a Grand Prix, so a co-driver outside it is "
      f"skipped rather than invented")

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

# A race entry's constructor must have been entering races that season. This
# check did not exist until the constructor register was extended, and its
# absence is why Zhou Guanyu's fastest laps at Suzuka 2022 and Bahrain 2023
# sat against Alfa Romeo - a constructor whose last entry was 1985 - for as
# long as they did. F1DB's `alfa-romeo` covers the 1950-51 works team, the
# 1979-85 works return, and the name Sauber raced under from 2019; this
# register's covers only the first two.
era = con.execute("""SELECT r.year, c.name, c.first_entry, c.last_entry,
        COUNT(*) n
    FROM race_entries e JOIN races r ON r.id = e.race_id
    JOIN constructors c ON c.id = e.constructor_id
    WHERE c.first_entry IS NOT NULL
      AND (r.year < c.first_entry
           OR (c.last_entry IS NOT NULL AND r.year > c.last_entry))
    GROUP BY r.year, c.id ORDER BY r.year""").fetchall()
check("no entry is credited to a constructor that was not racing that season",
      not era,
      "; ".join(f"{r[0]}: {r[1]} ({r[2]}-{r[3]}) x{r[4]}" for r in era[:5]))

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

print("\nFINISHING ORDER AND PODIUMS")
n_pod = con.execute("""SELECT COUNT(*) FROM race_entries
    WHERE finish_position IN (2, 3)""").fetchone()[0]
n_field = con.execute("""SELECT COUNT(*) FROM race_entries
    WHERE finish_position > 3""").fetchone()[0]
races_with_pod = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
    WHERE finish_position IN (2, 3)""").fetchone()[0]
held = con.execute("SELECT COUNT(*) FROM races WHERE status='completed'").fetchone()[0]
print(f"  [info] {n_pod} second/third places across {races_with_pod} of "
      f"{held} races; {n_field} finishers below third")
if not n_pod:
    print("  [info] no classification loaded - run tools/ergast_load.py")

# Structural checks. All hold whether the classification is loaded or not.
bad = con.execute("""SELECT COUNT(*) FROM (
    SELECT race_id, finish_position FROM race_entries
    WHERE finish_position IS NOT NULL
    GROUP BY race_id, finish_position
    HAVING COUNT(*) > SUM(shared_drive) + 1)""").fetchone()[0]
check("no finishing position is claimed twice except by a shared drive",
      bad == 0, f"{bad} positions")

bad = con.execute("""SELECT COUNT(*) FROM race_entries
    WHERE finish_position IS NOT NULL AND finish_position < 1""").fetchone()[0]
check("finishing positions are positive", bad == 0, f"{bad} bad")

bad = con.execute("""SELECT COUNT(*) FROM race_entries e JOIN races r
    ON r.id = e.race_id WHERE r.status != 'completed'
    AND e.finish_position IS NOT NULL""").fetchone()[0]
check("no result is recorded against an unrun race", bad == 0, f"{bad} rows")

# Every race that has a second place must have a first.
bad = con.execute("""SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
    WHERE e.finish_position = 2 AND NOT EXISTS (
        SELECT 1 FROM race_entries w WHERE w.race_id = e.race_id
          AND w.finish_position = 1)""").fetchone()[0]
check("every race with a second place has a winner", bad == 0, f"{bad} races")

# THE reconciliation. Derived podium counts against the official figures.
# This is the check that caught fabricated rows during the v2.7 harvest, and
# it is the reason the podium data can be trusted at all.
if n_pod:
    rows = con.execute("""SELECT full_name, podiums, podiums_external, status
        FROM drivers WHERE podiums_external IS NOT NULL
        ORDER BY podiums_external DESC""").fetchall()
    over, under = [], []
    for r in rows:
        d = r["podiums"] - r["podiums_external"]
        if d < 0:
            under.append(f"{r['full_name']} {r['podiums']} vs {r['podiums_external']}")
        elif d > 0 and r["status"] != "active":
            over.append(f"{r['full_name']} {r['podiums']} vs {r['podiums_external']}")
    # A retired driver's total cannot move; an active driver's can only grow
    # past a figure captured earlier in the season.
    check("no driver has fewer podiums than the official figure", not under,
          "; ".join(under))
    check("no retired driver has more podiums than the official figure",
          not over, "; ".join(over))
    exact = sum(1 for r in rows if r["podiums"] == r["podiums_external"])
    print(f"  [info] {exact} of {len(rows)} drivers match their official "
          f"podium count exactly")
else:
    warn("podium reconciliation ran", False,
         "no classification loaded, so the strongest check on this data "
         "is not running - see tools/ergast_load.py")

bad = con.execute("""SELECT COUNT(*) FROM drivers d
    WHERE NOT EXISTS (SELECT 1 FROM race_entries e WHERE e.driver_id = d.id)"""
    ).fetchone()[0]
print(f"  [info] {bad} drivers in the register have no race entry yet "
      f"(they gain one when the classification loads)")

print("\nCARS")
from data import cars as _CR
# The (car, year) pairs the season entry lists actually corroborate, which is
# what decides whether a car's derived win count must EQUAL its published one
# or merely not exceed it.
_corroborated = {(r[0], r[1]) for r in con.execute(
    "SELECT car_id, year FROM car_seasons WHERE corroborated = 1")}
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
# published on its own reference page; and where every year it raced is
# linked, the derived total must EQUAL the published one.
#
# Poles used to be a lower bound and nothing more. The pole harvest recorded
# who took pole but not what they drove, so 1,260 entries carried no
# constructor and could not reach a car at all. The season entry lists supply
# that constructor now, and a fully linked car's pole count must match its
# published figure exactly, on the same terms as its wins.
over, neq, npeq, checked = [], [], [], 0
for cid, (ew, ep) in _CR.EXPECTED.items():
    row = con.execute("""SELECT wins, poles, from_year, to_year FROM cars
                         WHERE id=?""", (cid,)).fetchone()
    if row is None:
        over.append(f"{cid}: not in the register")
        continue
    w, p, fy, ty = row
    complete = _CR.seasons_complete(cid, fy, ty, _corroborated)
    if ew is not None:
        checked += 1
        if w > ew:
            over.append(f"{cid}: derived {w} wins, published {ew}")
        elif complete and w != ew:
            neq.append(f"{cid}: all seasons linked but {w} wins, published {ew}")
    if ep is not None:
        if p > ep:
            over.append(f"{cid}: derived {p} poles, published {ep}")
        elif complete and p != ep:
            npeq.append(f"{cid}: all seasons linked but {p} poles, "
                        f"published {ep}")
check("no car has more wins or poles than its published total", not over,
      "; ".join(over))
check("fully linked cars match their published win total exactly", not neq,
      "; ".join(neq))
check("fully linked cars match their published pole total exactly", not npeq,
      "; ".join(npeq))
pmatch = sum(1 for cid, (_w, ep) in _CR.EXPECTED.items() if ep is not None
             and (con.execute("SELECT poles FROM cars WHERE id=?",
                              (cid,)).fetchone() or [None])[0] == ep)
print(f"  [info] {pmatch} cars match their published pole total exactly; "
      f"before the entry lists supplied the missing constructors, none could")
ncomplete = sum(1 for cid in _CR.EXPECTED
                if (lambda r: r and _CR.seasons_complete(
                        cid, r[0], r[1], _corroborated))(
                    con.execute("SELECT from_year,to_year FROM cars WHERE id=?",
                                (cid,)).fetchone()))
uncorr = con.execute(
    "SELECT COUNT(*) FROM car_seasons WHERE corroborated = 0").fetchone()[0]
print(f"  [info] {uncorr} of "
      f"{con.execute('SELECT COUNT(*) FROM car_seasons').fetchone()[0]} "
      f"CAR_SEASONS claims are not corroborated by the entry lists, so the "
      f"blanket link is withheld for those seasons")
print(f"  [info] {checked} cars compared against published figures, "
      f"{ncomplete} of them fully linked")

linked = con.execute("SELECT COUNT(*) FROM race_entries WHERE car_id IS NOT NULL"
                     ).fetchone()[0]
tot = con.execute("SELECT COUNT(*) FROM race_entries").fetchone()[0]
print(f"  [info] {linked} of {tot} race entries linked to a car "
      f"({100 * linked / tot:.0f}%)")

print("\nTHE DRIVER REGISTER")
from data import drivers as _D
from data import results as _RS
from data import harvest as _HV
_drv_years = {}
for _y, _e, _c, _em, _d, _rounds, _t in _HV.load_entrant_drivers():
    if _rounds:
        _drv_years.setdefault(_d, set()).add(_y)
_ourd = {r[0] for r in con.execute("SELECT id FROM drivers")}
_dmap, _dcoll = _HV.resolve_f1db_drivers(
    dict(con.execute("SELECT id, full_name FROM drivers")))
check("no two F1DB drivers normalise onto one register entry", not _dcoll,
      "; ".join(f"{k} <- {v}" for k, v in list(_dcoll.items())[:4]))

# Every driver F1DB records entering a championship race must be in the
# register. Unlike constructors there is no Indianapolis exclusion: this
# project has counted an Indianapolis start in 1950-60 as a World
# Championship start since v2.1, when the ten Indianapolis winners were
# added, and 73 of the drivers admitted here entered nothing else.
_dgap = [d for d in _drv_years if d not in _dmap]
check("every driver that entered a championship race is in the register",
      not _dgap, "; ".join(sorted(_dgap)[:6]))
_admitted_d = con.execute("""SELECT COUNT(*) FROM drivers
    WHERE confidence = 'reference' AND source LIKE '%f1db%'""").fetchone()[0]
print(f"  [info] {len(_ourd)} drivers, {_admitted_d} of them admitted from "
      f"the F1DB register; {len(_RS.DRIVER_NON_MAPPING)} Jolpica drivers are "
      f"declared as a source disagreement rather than created")
_dupe = con.execute("""SELECT full_name, COUNT(*) n FROM drivers
    GROUP BY LOWER(full_name) HAVING n > 1""").fetchall()
check("no two register rows share a driver's full name", not _dupe,
      "; ".join(f"{r[0]} x{r[1]}" for r in _dupe[:4]))

print("\nTHE CONSTRUCTOR REGISTER")
from data import teams as _T
import collections as _coll
_indy = {(y, r) for y, r in con.execute(
    "SELECT year, round FROM races WHERE gp_id='indianapolis-500'")}
_ent = _coll.defaultdict(set)
for _y, _e, _c, _em, _d, _rounds, _test in _HV.load_entrant_drivers():
    # rounds, not the testDriver flag - see the note in build.py
    for _r in _rounds:
        _ent[_c].add((_y, _r))
_ours = {r[0] for r in con.execute("SELECT id FROM constructors")}

# The admission test, asserted rather than assumed. Every constructor F1DB
# records entering a championship race that was NOT the Indianapolis 500 must
# be in this register, aliased to a team that is, or declared as a deliberate
# exclusion. Nothing may simply be absent - which is how Ensign started 133
# Grands Prix without a row here.
# Every SEASON must resolve, not just one of them. An id whose meaning
# changes part-way - `alfa-romeo` is the register's own constructor until
# 1985 and Sauber's branding from 2019 - can have one season land in the
# register while another lands nowhere. Testing only the last season would
# pass on that.
_gap = []
for _c, _slots in _ent.items():
    if not (_slots - _indy):
        continue                       # Indianapolis-only, correctly excluded
    if _c in _T.F1DB_CONSTRUCTOR_ALIASES or _c in _T.F1DB_CONSTRUCTOR_NON_MAPPING:
        continue
    _unresolved = sorted({_y for _y, _ in _slots
                          if _HV.constructor_for_f1db(_c, _y) not in _ours})
    if _unresolved:
        _gap.append(f"{_c} ({len(_unresolved)} season(s): "
                    f"{_unresolved[0]}-{_unresolved[-1]})")
check("every constructor that entered a non-Indianapolis race is in the "
      "register, aliased, or declared", not _gap, "; ".join(sorted(_gap)[:6]))

_bad_alias = [k for k, v in _T.F1DB_CONSTRUCTOR_ALIASES.items() if v not in _ours]
check("every constructor alias points at a team in the register",
      not _bad_alias, "; ".join(_bad_alias))
_both = set(_T.F1DB_CONSTRUCTORS) & set(_T.F1DB_CONSTRUCTOR_ALIASES)
_both |= set(_T.F1DB_CONSTRUCTORS) & set(_T.F1DB_CONSTRUCTOR_NON_MAPPING)
check("no constructor is both admitted and aliased or excluded", not _both,
      "; ".join(sorted(_both)))
_admitted = con.execute("""SELECT COUNT(*) FROM constructors
    WHERE confidence = 'reference' AND source LIKE '%f1db%'""").fetchone()[0]
print(f"  [info] {len(_ours)} constructors, {_admitted} of them admitted from "
      f"the F1DB register; {len(_T.F1DB_CONSTRUCTOR_ALIASES)} aliases and "
      f"{len(_T.F1DB_CONSTRUCTOR_NON_MAPPING)} declared exclusion(s)")
_unmapped = con.execute("""SELECT COUNT(DISTINCT f1db_constructor_id)
    FROM season_entrants WHERE constructor_id IS NULL""").fetchone()[0]
print(f"  [info] {_unmapped} F1DB constructors remain unmapped; all but the "
      f"declared exclusion are Indianapolis 500 chassis makers, which this "
      f"project has never counted as Formula One constructors")

print("\nTHE CHASSIS REGISTER")
nch = con.execute("SELECT COUNT(*) FROM chassis").fetchone()[0]
neng = con.execute("SELECT COUNT(*) FROM engines").fetchone()[0]
nent = con.execute("SELECT COUNT(*) FROM season_entrants").fetchone()[0]
nspec = con.execute("SELECT COUNT(*) FROM chassis WHERE article IS NOT NULL").fetchone()[0]
print(f"  [info] {nch} chassis, {neng} engines, {nent} season entrant rows; "
      f"{nspec} chassis carry harvested specifications")

# Every chassis id in CAR_CHASSIS must exist, belong to the car's constructor,
# be claimed by only one car, and have raced inside the car's stated life.
# A typo cannot survive all four.
reg = {r["id"]: r for r in con.execute("SELECT * FROM chassis")}
missing, wrongcons, outside, late, twice = [], [], [], [], []
claimed = {}
for car_id, ch_ids in _CR.CAR_CHASSIS.items():
    car = con.execute("SELECT constructor_id, from_year, to_year FROM cars "
                      "WHERE id=?", (car_id,)).fetchone()
    for ch in ch_ids:
        if ch not in reg:
            missing.append(f"{car_id}:{ch}")
            continue
        if ch in claimed:
            twice.append(f"{ch} ({claimed[ch]} and {car_id})")
        claimed[ch] = car_id
        if reg[ch]["constructor_id"] != car["constructor_id"]:
            wrongcons.append(f"{ch} is {reg[ch]['constructor_id']}, "
                             f"{car_id} is {car['constructor_id']}")
        fy, ly = reg[ch]["first_year"], reg[ch]["last_year"]
        if fy is not None and fy < car["from_year"]:
            outside.append(f"{ch} was entered in {fy}, before {car_id} "
                           f"existed ({car['from_year']})")
        if ly is not None and ly > (car["to_year"] or car["from_year"]):
            late.append(f"{ch} last entered {ly}, {car_id} lived "
                        f"{car['from_year']}-{car['to_year']}")
check("every chassis a car claims is in the register", not missing,
      "; ".join(missing))
check("a claimed chassis belongs to the car's constructor", not wrongcons,
      "; ".join(wrongcons))
check("no chassis is claimed by two cars", not twice, "; ".join(twice))
check("no claimed chassis was entered before its car existed", not outside,
      "; ".join(outside))
# A chassis outliving the car's authored life is normal and not an error. The
# two fields mean different things: `cars.to_year` is the works career, and
# the entry lists record every entry including the privateers who bought the
# thing afterwards. Ferrari 500s were still being entered in 1957, four years
# after the works team moved on.
warn("no claimed chassis outlives its car's authored life", not late,
     "; ".join(late))
print(f"  [info] the 29 curated cars cover {len(claimed)} register chassis")

bad = con.execute("""SELECT COUNT(*) FROM chassis c WHERE c.car_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM cars x WHERE x.id = c.car_id)""").fetchone()[0]
check("chassis.car_id -> cars", bad == 0, f"{bad} orphans")
bad = con.execute("""SELECT COUNT(*) FROM race_entries e WHERE e.chassis_id
    IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM chassis c WHERE c.id = e.chassis_id)""").fetchone()[0]
check("race_entries.chassis_id -> chassis", bad == 0, f"{bad} orphans")
bad = con.execute("""SELECT COUNT(*) FROM race_entries e
    JOIN chassis c ON c.id = e.chassis_id
    WHERE c.constructor_id IS NOT NULL
      AND c.constructor_id <> e.constructor_id""").fetchone()[0]
check("a linked chassis belongs to the entry's constructor", bad == 0,
      f"{bad} wrong")
bad = con.execute("""SELECT COUNT(*) FROM race_entries e
    JOIN chassis c ON c.id = e.chassis_id JOIN races r ON r.id = e.race_id
    WHERE r.year < c.first_year OR r.year > c.last_year""").fetchone()[0]
check("a linked chassis was entered in that season", bad == 0,
      f"{bad} outside")

# Whichever rule made a link, the chassis must be one the entry lists
# actually record for that constructor in that season. Rule one resolves a
# constructor-season that names exactly one chassis; rule two resolves a
# (season, round, driver) whose entrant names exactly one, which reaches into
# seasons the first cannot. Neither may ever produce a chassis the source
# does not put in that constructor's hands that year.
# Where the entry names a constructor this register holds, the chassis must
# be in THAT constructor's list. Where it does not - an Indianapolis chassis
# maker, or one of the 67 F1 constructors this register still lacks - the
# chassis must at least be in some entry list for that season, because the
# entry that resolved it was matched on driver and round rather than on a
# constructor id.
stray = con.execute("""
    SELECT COUNT(*) FROM race_entries e JOIN races r ON r.id = e.race_id
    WHERE e.chassis_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM season_entrants se
        WHERE se.year = r.year
          AND (se.constructor_id = e.constructor_id
               OR e.constructor_id IS NULL)
          AND ('+' || se.chassis_ids || '+') LIKE ('%+' || e.chassis_id || '+%'))
    """).fetchone()[0]
check("every linked chassis is in an entry list for that season, and for "
      "that constructor where one is known", stray == 0, f"{stray} entries")

# Rule two fills constructor_id on entries the pole and fastest-lap harvests
# left blank. It is trusted there only because it was checked where the
# answer was already known: the constructor F1DB gives must equal the one
# the Wikipedia race harvest established, on every entry that has one.
# build.py fails outright on a disagreement; this counts the agreement.
nocons = con.execute("""SELECT COUNT(*) FROM race_entries
    WHERE constructor_id IS NULL""").fetchone()[0]
print(f"  [info] {tot - nocons} of {tot} race entries carry a constructor; "
      f"{nocons} still do not")

# The reconciliation: derived from this database's race records, against the
# figure published on the car's own article and read by a different route.
over = con.execute("""SELECT full_name, wins, published_wins FROM chassis
    WHERE published_wins IS NOT NULL AND wins > published_wins""").fetchall()
check("no chassis has more derived wins than its article publishes", not over,
      "; ".join(f"{r[0]} {r[1]}>{r[2]}" for r in over))
cmp_ = con.execute("""SELECT COUNT(*) FROM chassis
    WHERE published_wins IS NOT NULL AND wins > 0""").fetchone()[0]
exact = con.execute("""SELECT COUNT(*) FROM chassis
    WHERE published_wins IS NOT NULL AND wins > 0
      AND wins = published_wins""").fetchone()[0]
print(f"  [info] {cmp_} chassis have both a derived and a published win "
      f"count; {exact} agree exactly")

# A car and the chassis it covers hold some of the same figures, reached by
# different routes. Where both are present they must agree.
dis = con.execute("""SELECT c.full_name, ch.full_name, c.capacity_cc,
        ch.capacity_cc FROM cars c JOIN chassis ch ON ch.car_id = c.id
    WHERE c.capacity_cc IS NOT NULL AND ch.capacity_cc IS NOT NULL
      AND ABS(c.capacity_cc - ch.capacity_cc) > 5""").fetchall()
warn("the curated and harvested engine capacities agree", not dis,
     "; ".join(f"{r[0]}: {r[2]} vs {r[1]} {r[3]}" for r in dis[:4]))

lk = con.execute("SELECT COUNT(*) FROM race_entries WHERE chassis_id IS NOT NULL"
                 ).fetchone()[0]
wonk = con.execute("""SELECT COUNT(DISTINCT race_id) FROM race_entries
    WHERE chassis_id IS NOT NULL AND finish_position = 1""").fetchone()[0]
nrace = con.execute("SELECT COUNT(*) FROM races WHERE status='completed'"
                    ).fetchone()[0]
print(f"  [info] {lk} of {tot} race entries linked to a chassis "
      f"({100 * lk / tot:.0f}%); the winning chassis is known for "
      f"{wonk} of {nrace} races ({100 * wonk / nrace:.0f}%)")

# A regulation limit may not be sitting in a per-car field pretending to be a
# measurement. This is the check the 2026 rows exist to make possible.
lim = {}
for r in con.execute("SELECT from_year, to_year, field, value FROM regulation_limits"):
    for y in range(r[0], r[1] + 1):
        lim.setdefault(y, {})[r[2]] = r[3]
leaked = []
for tbl, wcol, bcol in (("cars", "weight_kg", "wheelbase_mm"),
                        ("chassis", "weight_kg", "wheelbase_mm")):
    yl = "from_year" if tbl == "cars" else "first_year"
    yh = "to_year" if tbl == "cars" else "last_year"
    for r in con.execute(f"""SELECT id, {yl}, {yh}, {wcol}, {bcol} FROM {tbl}
            WHERE {yl} IS NOT NULL AND ({wcol} IS NOT NULL OR {bcol} IS NOT NULL)"""):
        for y in range(r[1], (r[2] or r[1]) + 1):
            if r[3] is not None and lim.get(y, {}).get("minimum_weight_kg") == r[3]:
                leaked.append(f"{tbl}.{r[0]} weight {r[3]} = the {y} minimum")
            if r[4] is not None and lim.get(y, {}).get("maximum_wheelbase_mm") == r[4]:
                leaked.append(f"{tbl}.{r[0]} wheelbase {r[4]} = the {y} maximum")
check("no regulation limit is stored as a car's own figure", not leaked,
      "; ".join(leaked[:4]))
nlim = con.execute("SELECT COUNT(*) FROM regulation_limits").fetchone()[0]
print(f"  [info] {nlim} regulation limits recorded, covering "
      + ", ".join(str(r[0]) for r in con.execute(
          "SELECT DISTINCT field FROM regulation_limits ORDER BY field")))

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
    WHERE lap_seconds IS NOT NULL AND lap_seconds <= 0""").fetchone()[0]
check("lap times are positive", bad == 0, f"{bad} at or below zero")

# A lap over fifteen minutes is not implausible, it is a red flag: the
# suspension is recorded inside the lap it happened on. The 2011 Canadian
# Grand Prix, the longest race in the sport's history, has a lap 25 of two
# hours and five minutes. What WOULD be implausible is a driver having many
# of them in one race, because that would mean the race was stopped more
# times than any race ever has been.
worst = con.execute("""SELECT MAX(n) FROM (SELECT COUNT(*) n FROM laps
    WHERE lap_seconds > 900 GROUP BY race_id, driver_key)""").fetchone()[0] or 0
check("no driver has more long laps than a race has had red flags",
      worst <= 4, f"one driver has {worst} laps over 15 minutes in one race")
longr = con.execute("""SELECT COUNT(DISTINCT race_id) FROM laps
    WHERE lap_seconds > 900""").fetchone()[0]
if longr:
    print(f"  [info] {longr} races contain a lap over 15 minutes; every one "
          f"is a red flag recorded inside the lap it interrupted")

# Each source reaches back as far as it reaches and no further. FastF1 reads
# the F1 live timing API, which begins in 2018 and for which nothing earlier
# exists. Jolpica's dump has per-lap times from 1996 - twenty-two seasons
# further back - and pit stops from 2011.
for src, first, what in (("fastf1", 2018, "the live timing API"),
                         ("jolpica", 1996, "Jolpica's dump")):
    bad = con.execute("""SELECT COUNT(*) FROM laps l JOIN races r
        ON r.id = l.race_id WHERE l.source = ? AND r.year < ?""",
        (src, first)).fetchone()[0]
    check(f"no {src} lap predates {first}, where {what} starts", bad == 0,
          f"{bad} rows")
bad = con.execute("""SELECT COUNT(*) FROM pit_stops p JOIN races r
    ON r.id = p.race_id WHERE p.source = 'jolpica' AND r.year < 2011"""
    ).fetchone()[0]
check("no jolpica pit stop predates 2011", bad == 0, f"{bad} rows")

# Where two independent sources cover the same race, they must agree about
# how many laps each driver ran. This is the reason both are allowed to hold
# the same race rather than one overwriting the other.
disagree = con.execute("""
    SELECT COUNT(*) FROM (
        SELECT l.race_id, l.driver_id
        FROM laps l WHERE l.driver_id IS NOT NULL
        GROUP BY l.race_id, l.driver_id
        HAVING COUNT(DISTINCT l.source) > 1
           AND COUNT(*) FILTER (WHERE l.source = 'fastf1')
             <> COUNT(*) FILTER (WHERE l.source = 'jolpica'))""").fetchone()[0]
check("where two sources hold the same race they agree on the lap count",
      disagree == 0, f"{disagree} driver-races differ")
both = con.execute("""SELECT COUNT(*) FROM (SELECT race_id FROM laps
    GROUP BY race_id HAVING COUNT(DISTINCT source) > 1)""").fetchone()[0]
print(f"  [info] {both} races are covered by both FastF1 and Jolpica and can "
      f"be compared lap for lap")

# The strongest thing the lap data does: it re-derives a fact this database
# already holds, by a route that shares nothing with how it was established.
#
# race_entries.fastest_lap came from the Wikipedia pole and fastest-lap
# harvest. The laps came from Jolpica's dump. Take the quickest lap each
# source FLAGS as an entry's fastest, and the driver it names must be the
# driver already stored.
#
# Use the flag, not the raw minimum. At the 2021 Portuguese Grand Prix
# Verstappen's 1:19.849 is the quickest time in the file and Bottas's
# 1:19.865 is the one flagged - because Verstappen's was struck for track
# limits. Ranking on time alone reports five disagreements, all of which are
# this. Ranking on the flag reports none.
fl_bad = con.execute("""
    WITH flagged AS (
        SELECT race_id, driver_id, lap_seconds,
               ROW_NUMBER() OVER (PARTITION BY race_id ORDER BY lap_seconds) rn
        FROM laps WHERE is_fastest_lap = 1 AND lap_seconds IS NOT NULL
                    AND driver_id IS NOT NULL)
    SELECT r.year, r.name_used, f.driver_id, e.driver_id
    FROM flagged f JOIN races r ON r.id = f.race_id
    JOIN race_entries e ON e.race_id = f.race_id AND e.fastest_lap = 1
    WHERE f.rn = 1 AND f.driver_id <> e.driver_id
    ORDER BY r.year""").fetchall()
# Exactly the population the check above compares - same three conditions.
# Counting a wider one would let the "they agree on all of them" line below
# include races the check never looked at, and that line is quoted in the
# README and the build notes.
fl_n = con.execute("""SELECT COUNT(DISTINCT l.race_id) FROM laps l
    JOIN race_entries e ON e.race_id = l.race_id AND e.fastest_lap = 1
    WHERE l.is_fastest_lap = 1 AND l.lap_seconds IS NOT NULL
      AND l.driver_id IS NOT NULL""").fetchone()[0]
check("the fastest lap derived from lap times matches the one already stored",
      not fl_bad,
      "; ".join(f"{r[0]} {r[1]}: laps say {r[2]}, stored {r[3]}"
                for r in fl_bad[:5]))
if fl_n:
    print(f"  [info] {fl_n} races have both a stored fastest-lap setter and "
          f"per-lap times; the two agree on all of them")
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
