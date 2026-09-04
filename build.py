#!/usr/bin/env python3
"""
Build f1.db from schema.sql and the data modules.

    python3 build.py

Idempotent: deletes and rebuilds the database each run.
"""
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from data import seasons as S      # noqa: E402
from data import drivers as D      # noqa: E402
from data import teams as T        # noqa: E402
from data import circuits as C     # noqa: E402
from data import technical as X    # noqa: E402
from data import current as N      # noqa: E402
from data import people as P       # noqa: E402
from data import harvest as HV     # noqa: E402
from data import events as EV      # noqa: E402
from data import cars as CR        # noqa: E402
from data import radio as RA       # noqa: E402
from data import results as RS     # noqa: E402

DB = os.path.join(HERE, "f1.db")
VERSION = "2.7"
BUILT = "2026-09-04"


def build():
    if os.path.exists(DB):
        os.remove(DB)
    con = sqlite3.connect(DB)
    con.executescript(open(os.path.join(HERE, "schema.sql"), encoding="utf-8").read())
    cur = con.cursor()

    # ---------------------------------------------------------- meta
    cur.executemany("INSERT INTO provenance VALUES (?,?,?,?)", N.PROVENANCE)
    cur.executemany(
        "INSERT INTO source_registry (priority, source, url, use, authority) VALUES (?,?,?,?,?)",
        N.SOURCE_REGISTRY)
    cur.executemany("INSERT INTO meta VALUES (?,?)", [
        ("database_name", "F1 Verified Facts Project Memory Database"),
        ("version", VERSION),
        ("built", BUILT),
        ("verification_date", BUILT),
        ("missing_fact_policy", "Mark UNVERIFIED / NOT FOUND IN OFFICIAL SOURCES; never invent."),
        ("promotion_rule", "Never promote a fact to 'verified' without an official FIA or Formula 1 source."),
        ("coverage_seasons", "1950-2026"),
        ("coverage_note",
         "Complete for: season champions, race-by-race winners 1950-2026, pole position "
         "1950-2024, fastest lap 1950-2024 bar 12 races, the circuit of every race "
         "1950-2026, constructor lineage, engine formulae, regulation changes, safety "
         "milestones, points systems. "
         "Partial by design for: full driver register (every race winner, pole-sitter and "
         "fastest-lap setter, not all ~780 starters); full finishing order; qualifying, "
         "grid and lap-by-lap data (not held). See the known_gaps table."),
    ])

    # ------------------------------------------------------- drivers
    for r in D.CHAMPIONS:
        (did, name, nat, code, born, died, first, last, entries, starts, wins,
         podiums, poles, fl, pts, titles, tyears, status, notes, conf) = r
        cur.execute("""INSERT INTO drivers (id, full_name, nationality, nationality_code,
            born, died, first_season, last_season, entries, starts, wins, podiums, poles,
            fastest_laps, career_points, titles, title_years, status, notes, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, born, died, first, last, entries, starts, wins, podiums,
             poles, fl, pts, titles, tyears, status, notes, conf,
             "https://www.formula1.com/en/drivers"))

    for r in D.OTHER_DRIVERS:
        (did, name, nat, code, born, died, first, last, wins, poles, titles, status, notes, conf) = r
        cur.execute("""INSERT INTO drivers (id, full_name, nationality, nationality_code,
            born, died, first_season, last_season, wins, poles, titles, status, notes,
            confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, born, died, first, last, wins, poles, titles, status,
             notes, conf, "https://www.formula1.com/en/drivers"))

    for r in HV.NEW_DRIVERS:
        (did, name, nat, code, born, died, first, last, wins, poles, titles,
         status, notes, conf) = r
        cur.execute("""INSERT INTO drivers (id, full_name, nationality, nationality_code,
            born, died, first_season, last_season, wins, poles, titles, status, notes,
            confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, born, died, first, last, wins, poles, titles, status,
             notes, conf, HV.SOURCE.format(year=first)))

    for did, name, nat, code, year in HV.INDY_WINNERS:
        cur.execute("""INSERT INTO drivers (id, full_name, nationality, nationality_code,
            first_season, last_season, wins, titles, status, notes, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, year, year, None, 0, "deceased", HV.INDY_NOTE,
             "reference", HV.SOURCE.format(year=year)))

    for did, name, nat, code, extra in HV.POLE_ONLY_DRIVERS:
        note = HV.POLE_ONLY_NOTE + ((" " + extra) if extra else "")
        cur.execute("""INSERT INTO drivers (id, full_name, nationality,
            nationality_code, wins, titles, notes, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (did, name, nat, code, 0, 0, note, "medium",
             "https://en.wikipedia.org/wiki/List_of_Formula_One_polesitters"))

    # Drivers who reached a podium but never won, took pole or set a fastest
    # lap. Names and dates come from the same API as the podium rows, so a
    # result can never reference a driver this database had to invent.
    for lid, eid, name, nat, code, born in RS.PODIUM_ONLY_DRIVERS:
        cur.execute("""INSERT INTO drivers (id, full_name, nationality,
            nationality_code, born, wins, titles, notes, confidence, source)
            VALUES (?,?,?,?,?,0,0,?,?,?)""",
            (lid, name, nat, code, born or None,
             "Added to the register from the podium harvest: reached a podium "
             "without ever winning a race, taking pole or setting a fastest lap.",
             "reference", "https://api.jolpi.ca/ergast/f1/drivers/" + eid))

    # The wins / poles / fastest_laps just inserted are hand-entered from
    # reference records. Move them to the *_external columns now, before the
    # derived figures overwrite the main ones.
    cur.execute("""UPDATE drivers SET
        wins_external = wins, poles_external = poles,
        fastest_laps_external = fastest_laps,
        external_source = 'hand-entered from reference records'""")

    # -------------------------------------------------- constructors
    for r in T.CONSTRUCTORS:
        (cid, name, full, country, base, first, last, wins, ct, dt, tyears,
         chain, active, notes, conf) = r
        cur.execute("""INSERT INTO constructors (id, name, full_name, country, base,
            first_entry, last_entry, wins, constructors_titles, drivers_titles, title_years,
            lineage_chain, active, notes, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, name, full, country, base, first, last, wins, ct, dt, tyears, chain,
             active, notes, conf, "https://www.formula1.com/en/teams"))

    # Constructors that reached a podium but are not in the main register:
    # short-lived teams, and the pre-1961 marques that never won.
    for cid, name, full, base, first, nat, notes, conf in RS.NEW_CONSTRUCTORS:
        cur.execute("""INSERT INTO constructors (id, name, full_name, country,
            base, first_entry, wins, constructors_titles, drivers_titles,
            active, notes, confidence, source)
            VALUES (?,?,?,?,?,?,0,0,0,0,?,?,?)""",
            (cid, name, full, nat, base, first, notes, conf,
             "https://api.jolpi.ca/ergast/f1/constructors/"))

    for i, (chain, cname, seq, ent, fy, ty, note) in enumerate(T.LINEAGE, 1):
        cur.execute("""INSERT INTO constructor_lineage
            (id, chain_id, chain_name, sequence, entity_name, from_year, to_year, note)
            VALUES (?,?,?,?,?,?,?,?)""", (i, chain, cname, seq, ent, fy, ty, note))

    # Every constructor must resolve to a lineage chain. Teams that never
    # changed identity get a chain of one, generated from their own row, so
    # the link is never dangling and `lineage` works for all of them.
    have = {r[0] for r in cur.execute("SELECT DISTINCT chain_id FROM constructor_lineage")}
    nid = cur.execute("SELECT COALESCE(MAX(id), 0) FROM constructor_lineage").fetchone()[0]
    for c in cur.execute("""SELECT id, name, lineage_chain, first_entry, last_entry
                             FROM constructors WHERE lineage_chain IS NOT NULL""").fetchall():
        if c[2] in have:
            continue
        nid += 1
        cur.execute("""INSERT INTO constructor_lineage (id, chain_id, chain_name,
            sequence, entity_name, from_year, to_year, note)
            VALUES (?,?,?,?,?,?,?,?)""",
            (nid, c[2], f"{c[1]}", 1, c[1], c[3], c[4],
             "Raced under a single identity throughout."))
        have.add(c[2])

    for r in T.ENGINES:
        cur.execute("""INSERT INTO engine_manufacturers (id, name, country, first_year,
            last_year, wins, constructors_titles, drivers_titles, notes, confidence)
            VALUES (?,?,?,?,?,?,?,?,?,?)""", r)

    for r in X_engine_eras():
        cur.execute("""INSERT INTO engine_eras (id, from_year, to_year, era_name, formula,
            aspiration, typical_config, approx_power_bhp, rev_limit, notes)
            VALUES (?,?,?,?,?,?,?,?,?,?)""", r)

    cur.executemany("""INSERT INTO personnel (id, full_name, nationality, role,
        active_from, active_to, associated_with, significance, confidence)
        VALUES (?,?,?,?,?,?,?,?,?)""", P.PERSONNEL)

    # ------------------------------------------------------- seasons
    for r in S.SEASONS:
        (yr, rounds, champ, team, cpts, cwins, ru, rupts, cc, ccpts,
         formula, tyres, notes, conf) = r
        margin = round(cpts - rupts, 2) if (cpts is not None and rupts is not None) else None
        cur.execute("""INSERT INTO seasons (year, rounds, drivers_champion, champion_team,
            champion_points, champion_wins, runner_up, runner_up_points, margin,
            constructors_champion, constructors_points, engine_formula, tyre_suppliers,
            notes, confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (yr, rounds, champ, team, cpts, cwins, ru, rupts, margin, cc, ccpts,
             formula, tyres, notes, conf, S.SEASON_NOTES_SOURCE))

    # ------------------------------------------------------ circuits
    for r in C.CIRCUITS:
        (cid, name, official, loc, country, ctype, first, last, length, turns,
         direction, chars, notes, conf) = r
        cur.execute("""INSERT INTO circuits (id, name, official_name, locality, country,
            circuit_type, first_gp, last_gp, length_km, turns, direction, characteristics,
            notes, confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, name, official, loc, country, ctype, first, last, length, turns,
             direction, chars, notes, conf, "https://www.formula1.com/en/racing"))

    for i, (cid, key, lname, fy, ty, byyear, length, turns, reason) in \
            enumerate(C.LAYOUTS, 1):
        cur.execute("""INSERT INTO circuit_layouts (id, circuit_id, layout_key,
            layout_name, from_year, to_year, by_year, length_km, turns,
            change_reason) VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (i, cid, key, lname, fy, ty, byyear, length, turns, reason))

    # --- cars. Inserted in file order so that a car can reference the one it
    # supersedes, which is always listed before it.
    seen_cars = set()
    for c in CR.CARS:
        (cid, cons, desig, full, fy, ty, sup, designers, eng_id, eng_name, tyres,
         cfg, cc, asp, bhp, pnote, rev, ctype, gbox, susp, brakes,
         wt, wb, tf, tr, fuel, concept, innov, story, outcome,
         dt, ct, landmark, conf, sconf, src) = c
        if cid in seen_cars:
            raise SystemExit(f"duplicate car id {cid}")
        if sup and sup not in seen_cars:
            raise SystemExit(f"car {cid} supersedes {sup}, which is not listed above it")
        seen_cars.add(cid)
        cur.execute("""INSERT INTO cars (id, constructor_id, designation, full_name,
            from_year, to_year, supersedes_id, designers, engine_id, engine_name,
            tyres, engine_config, capacity_cc, aspiration, power_bhp, power_note,
            rev_limit_rpm, chassis_type, gearbox, suspension, brakes, weight_kg,
            wheelbase_mm, track_front_mm, track_rear_mm, fuel_capacity_l,
            concept, innovations, story, outcome, drivers_titles,
            constructors_titles, landmark, confidence, spec_confidence, source)
            VALUES (""" + ",".join("?" * 36) + ")",
            (cid, cons, desig, full, fy, ty, sup, designers, eng_id, eng_name,
             tyres, cfg, cc, asp, bhp, pnote, rev, ctype, gbox, susp, brakes,
             wt, wb, tf, tr, fuel, concept, innov, story, outcome, dt, ct,
             landmark, conf, sconf, src))

    for gid, name, country, aliases, notes in EV.GRANDS_PRIX:
        cur.execute("""INSERT INTO grands_prix (id, name, country, aliases, notes,
            confidence) VALUES (?,?,?,?,?,?)""",
            (gid, name, country, ", ".join(aliases) or None, notes or None, "high"))

    # ------------------------------------------- rules / tech / safety
    for i, (yr, cat, title, detail, impact) in enumerate(X.REGULATIONS, 1):
        cur.execute("""INSERT INTO regulation_changes (id, year, category, title, detail,
            impact, source) VALUES (?,?,?,?,?,?,?)""",
            (i, yr, cat, title, detail, impact, "https://www.fia.com/regulations/formula-1"))

    for i, r in enumerate(X.INNOVATIONS, 1):
        cur.execute("""INSERT INTO technical_innovations (id, year, innovation, originator,
            description, legacy, banned_year) VALUES (?,?,?,?,?,?,?)""", (i,) + r)

    for i, r in enumerate(X.SAFETY, 1):
        cur.execute("""INSERT INTO safety_milestones (id, year, milestone, trigger_event,
            description) VALUES (?,?,?,?,?)""", (i,) + r)

    for i, r in enumerate(X.TYRES, 1):
        cur.execute("""INSERT INTO tyre_suppliers (id, supplier, from_year, to_year,
            exclusive, notes) VALUES (?,?,?,?,?,?)""", (i,) + r)

    for i, r in enumerate(X.POINTS, 1):
        cur.execute("""INSERT INTO points_systems (id, from_year, to_year, scoring,
            fastest_lap, dropped_scores, notes) VALUES (?,?,?,?,?,?,?)""", (i,) + r)

    off = len(X.POINTS)
    for i, (fy, ty, scoring, note) in enumerate(X.SPRINT_POINTS, off + 1):
        cur.execute("""INSERT INTO points_systems (id, from_year, to_year, scoring,
            fastest_lap, dropped_scores, notes) VALUES (?,?,?,?,?,?,?)""",
            (i, fy, ty, "SPRINT: " + scoring, None, None, note))

    for i, r in enumerate(X.RECORDS, 1):
        cat, rec, holder, val, detail, asof = r
        cur.execute("""INSERT INTO records (id, category, record, holder, value, detail,
            as_of) VALUES (?,?,?,?,?,?,?)""", (i, cat, rec, holder, val, detail, asof))

    for i, r in enumerate(X.ERAS, 1):
        cur.execute("""INSERT INTO eras (id, from_year, to_year, era_name, summary,
            dominant_teams, defining_features) VALUES (?,?,?,?,?,?,?)""", (i,) + r)

    cur.executemany("INSERT INTO glossary (term, category, definition) VALUES (?,?,?)",
                    X.GLOSSARY)

    for i, r in enumerate(X.GOVERNANCE, 1):
        cur.execute("""INSERT INTO governance (id, year, event, detail, significance)
            VALUES (?,?,?,?,?)""", (i,) + r)

    # -------------------------------------------------- current season
    for i, (cid, did, car, pu, num, role) in enumerate(N.ENTRIES_2026, 1):
        cur.execute("""INSERT INTO season_entries (id, year, constructor_id, driver_id,
            car, power_unit, car_number, role, confidence)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (i, 2026, cid, did, car, pu, num, role, "verified"))

    sid = 0
    for year, tbl, rows, asof in (
            (2026, "drivers", N.DRIVER_STANDINGS_2026, "2026-09-04 (after round 12)"),
            (2026, "constructors", N.TEAM_STANDINGS_2026, "2026-09-04 (after round 12)"),
            (2025, "drivers", N.DRIVER_STANDINGS_2025, "final"),
            (2025, "constructors", N.TEAM_STANDINGS_2025, "final")):
        for row in rows:
            sid += 1
            if tbl == "drivers":
                pos, eid, disp, team, pts = row
            else:
                pos, eid, disp, pts = row
                team = None
            cur.execute("""INSERT INTO standings (id, year, table_type, position, entity,
                entity_id, team, points, as_of, confidence, source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (sid, year, tbl, pos, disp, eid, team, pts, asof, "verified", N.SOURCE_F1))

    # =================================================================
    # Races and race entries
    # =================================================================
    gp_map = EV.name_to_id()
    # Built with collision detection. Two drivers whose names normalise to the
    # same string would otherwise overwrite each other silently, and the
    # harvest would credit one with the other's results.
    lookup, _clash = {}, {}
    for _did, _name in cur.execute("SELECT id, full_name FROM drivers"):
        _k = HV._norm(_name)
        if _k in lookup:
            _clash.setdefault(_k, [lookup[_k]]).append(_did)
        lookup[_k] = _did
    _clash = {k: v for k, v in _clash.items() if k not in HV.DRIVER_ALIASES}
    if _clash:
        raise SystemExit("driver names collide under _norm(): " + "; ".join(
            f"{k!r} -> {v}" for k, v in _clash.items()))
    lookup.update(HV.DRIVER_ALIASES)

    def driver_id(name, where):
        did = lookup.get(HV._norm(name))
        if did is None:
            raise SystemExit(f"unmapped driver {name!r} at {where}")
        return did

    # one dict per race, from the two winner sources
    races = []
    for h in HV.load():
        races.append({
            "year": h["year"], "round": h["round"], "gp_name": h["gp_name"],
            "winners": [h["winner_name"]] + ([h["co_winner_name"]]
                                             if h["co_winner_name"] else []),
            "chassis": h["chassis"], "entrant": h["entrant"],
            "confidence": h["confidence"], "source": h["source"],
        })
    for (yr, rnd, gp, win, cons) in N.RACE_RESULTS:
        races.append({
            "year": yr, "round": rnd, "gp_name": gp, "winners": None,
            "winner_id": win, "constructor_id": cons, "chassis": None,
            "entrant": None, "confidence": "verified", "source": N.SOURCE_F1,
        })

    cal = {r[0]: r for r in N.CALENDAR_2026}
    race_key = {}
    rid = 0
    for r in races:
        rid += 1
        gid = gp_map.get(r["gp_name"])
        if gid is None:
            raise SystemExit(f"unmapped grand prix {r['gp_name']!r}")
        circuit = EV.SINGLE_CIRCUIT.get(gid)
        dates = sprint = None
        if r["year"] == 2026 and r["round"] in cal:
            c = cal[r["round"]]
            circuit, dates, sprint = c[4], c[5], c[6]
        cur.execute("""INSERT INTO races (id, year, round, gp_id, name_used,
            circuit_id, dates, sprint, status, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, r["year"], r["round"], gid, r["gp_name"], circuit, dates,
             sprint or 0, "completed", r["confidence"], r["source"]))
        race_key[(r["year"], r["round"])] = rid

        # winner entries
        if r["winners"] is not None:
            cons = HV.constructor_id_for(r["chassis"], r["year"])
            if cons is None and HV._norm(r["chassis"]) not in HV.INDY_CHASSIS:
                raise SystemExit(f"unmapped constructor {r['chassis']!r}")
            shared = 1 if len(r["winners"]) > 1 else 0
            for nm in r["winners"]:
                cur.execute("""INSERT INTO race_entries (race_id, driver_id,
                    constructor_id, entrant, finish_position, shared_drive,
                    confidence, source) VALUES (?,?,?,?,?,?,?,?)""",
                    (rid, driver_id(nm, f"{r['year']} r{r['round']}"), cons,
                     r["entrant"], 1, shared, r["confidence"], r["source"]))
        else:
            cur.execute("""INSERT INTO race_entries (race_id, driver_id,
                constructor_id, finish_position, confidence, source)
                VALUES (?,?,?,?,?,?)""",
                (rid, r["winner_id"], r["constructor_id"], 1,
                 r["confidence"], r["source"]))

    # 2026 rounds not yet run: the event exists, with no entries
    for c in N.CALENDAR_2026:
        if (2026, c[0]) in race_key:
            continue
        rid += 1
        gid = gp_map.get(c[1])
        if gid is None:
            raise SystemExit(f"unmapped grand prix {c[1]!r}")
        cur.execute("""INSERT INTO races (id, year, round, gp_id, name_used,
            circuit_id, dates, sprint, status, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, 2026, c[0], gid, c[1], c[4], c[5], c[6], c[7],
             "verified", N.SOURCE_F1))
        race_key[(2026, c[0])] = rid

    # --- pole position and fastest lap, as attributes of an entry
    # Each harvested row also carries the race winner, which must equal the
    # winner already recorded. A mismatch means the row describes a different
    # race and is rejected outright.
    applied = 0
    for h in HV.load_poles():
        rid = race_key.get((h["year"], h["round"]))
        if rid is None:
            raise SystemExit(f"pole harvest: no race at {h['year']} r{h['round']}")
        stored = cur.execute("""SELECT driver_id FROM race_entries
            WHERE race_id=? AND finish_position=1 ORDER BY id LIMIT 1""",
            (rid,)).fetchone()
        got = lookup.get(HV._norm(h["winner_check"].split("/")[0].strip()))
        if stored is None or got != stored[0]:
            raise SystemExit(
                f"pole harvest: winner mismatch at {h['year']} r{h['round']}: "
                f"harvest {h['winner_check']!r} vs stored "
                f"{stored[0] if stored else None!r}")

        def upsert(did, **fields):
            row = cur.execute("""SELECT id FROM race_entries
                WHERE race_id=? AND driver_id=?""", (rid, did)).fetchone()
            if row:
                sets = ", ".join(f"{k}=?" for k in fields)
                cur.execute(f"UPDATE race_entries SET {sets} WHERE id=?",
                            (*fields.values(), row[0]))
            else:
                cols = ", ".join(fields)
                qs = ",".join("?" * len(fields))
                cur.execute(f"""INSERT INTO race_entries (race_id, driver_id,
                    confidence, source, {cols}) VALUES (?,?,?,?,{qs})""",
                    (rid, did, "reference", h["source"], *fields.values()))

        pole_names = HV.split_names(h["pole"])
        fl_names = HV.split_names(h["fastest_lap"])
        if pole_names:
            upsert(driver_id(pole_names[0], f"pole {h['year']} r{h['round']}"), grid=1)
        for nm in fl_names:
            upsert(driver_id(nm, f"fastest lap {h['year']} r{h['round']}"),
                   fastest_lap=1, fastest_lap_shared=len(fl_names))
        applied += 1
    if applied != 1161:
        raise SystemExit(f"pole harvest: expected 1161 rows, applied {applied}")

    # --- race venue, as circuit_id on the event
    # Harvested from the same season articles, again carrying the winner so
    # each row self-validates. Two further checks apply: where the Grand Prix
    # has only ever used one circuit the harvested venue must be that circuit,
    # and where a circuit is already stored from the verified 2026 calendar
    # the harvest must agree with it.
    applied = 0
    for h in HV.load_venues():
        rid = race_key.get((h["year"], h["round"]))
        if rid is None:
            raise SystemExit(f"venue harvest: no race at {h['year']} r{h['round']}")
        if h["circuit_id"] is None:
            raise SystemExit(
                f"venue harvest: unresolved venue {h['venue']!r} "
                f"at {h['year']} r{h['round']}")
        stored = cur.execute("""SELECT driver_id FROM race_entries
            WHERE race_id=? AND finish_position=1 ORDER BY id LIMIT 1""",
            (rid,)).fetchone()
        got = lookup.get(HV._norm(h["winner_check"].split("/")[0].strip()))
        if stored is None or got != stored[0]:
            raise SystemExit(
                f"venue harvest: winner mismatch at {h['year']} r{h['round']}: "
                f"harvest {h['winner_check']!r} vs stored "
                f"{stored[0] if stored else None!r}")
        gid, prior = cur.execute(
            "SELECT gp_id, circuit_id FROM races WHERE id=?", (rid,)).fetchone()
        single = EV.SINGLE_CIRCUIT.get(gid)
        if single and single != h["circuit_id"]:
            raise SystemExit(
                f"venue harvest: {h['year']} r{h['round']} {gid} is a "
                f"single-circuit event at {single} but harvest gives "
                f"{h['circuit_id']} ({h['venue']!r})")
        if prior and prior != h["circuit_id"]:
            raise SystemExit(
                f"venue harvest: {h['year']} r{h['round']} already stored as "
                f"{prior} but harvest gives {h['circuit_id']} ({h['venue']!r})")
        cur.execute("""UPDATE races SET circuit_id=?,
            source=COALESCE(source, ?) WHERE id=?""",
            (h["circuit_id"], h["source"], rid))
        applied += 1
    if applied != 1161:
        raise SystemExit(f"venue harvest: expected 1161 rows, applied {applied}")

    # --- races that used a layout other than the circuit's for that season
    for cid, key, yr, rnd in C.RACE_LAYOUTS:
        if not cur.execute("""SELECT 1 FROM circuit_layouts
                WHERE circuit_id=? AND layout_key=?""", (cid, key)).fetchone():
            raise SystemExit(f"race layout override: no layout {cid}:{key}")
        n = cur.execute("""UPDATE races SET layout_key=? WHERE year=? AND round=?
            AND circuit_id=?""", (key, yr, rnd, cid)).rowcount
        if n != 1:
            raise SystemExit(
                f"race layout override: no {cid} race at {yr} round {rnd}")

    # --- second and third place, from the Jolpica-F1 API
    # Checked three ways before anything is written:
    #   1. the race must exist in this database;
    #   2. the driver must resolve to a register entry - no invented drivers;
    #   3. the row must not claim a position the winner already holds, and no
    #      two drivers may claim the same position in the same race.
    # A driver who already has an entry (as pole-sitter or fastest-lap setter)
    # is UPDATED, not duplicated.
    dmap, unresolved = RS.build_driver_map(cur)
    if unresolved:
        raise SystemExit("podiums: unresolved driver ids: " + ", ".join(unresolved))

    claimed = {}
    applied = 0
    for h in RS.load():
        rid = race_key.get((h["year"], h["round"]))
        if rid is None:
            raise SystemExit(f"podiums: no race at {h['year']} r{h['round']}")
        did = dmap[h["driver_ergast"]]
        # Two drivers may legitimately share a position: they shared a car.
        # A shared drive has the same constructor and the same lap count -
        # Serafini and Ascari, second at Monza in 1950, are the first of them.
        # Anything else claiming a taken position is an error, not a share.
        key = (rid, h["position"])
        prev = claimed.get(key)
        shared = 0
        if prev:
            if prev["driver"] == did:
                raise SystemExit(
                    f"podiums: {h['year']} r{h['round']} lists {did} twice "
                    f"at position {h['position']}")
            if (prev["constructor"] != h["constructor_ergast"]
                    or prev["laps"] != h["laps"]):
                raise SystemExit(
                    f"podiums: {h['year']} r{h['round']} position "
                    f"{h['position']} claimed by {prev['driver']} and {did} "
                    f"in different cars - not a shared drive")
            shared = 1
            cur.execute("""UPDATE race_entries SET shared_drive=1
                WHERE race_id=? AND driver_id=?""", (rid, prev["driver"]))
        claimed[key] = {"driver": did, "constructor": h["constructor_ergast"],
                        "laps": h["laps"]}

        winner = cur.execute("""SELECT driver_id FROM race_entries
            WHERE race_id=? AND finish_position=1 ORDER BY id LIMIT 1""",
            (rid,)).fetchone()
        if winner and winner[0] == did:
            raise SystemExit(
                f"podiums: {h['year']} r{h['round']} says {did} finished "
                f"{h['position']}, but this database has him as the winner")

        # Grid is taken from this source EXCEPT where it is 1. Pole is
        # established for all 1,161 races by the pole harvest, and it is a
        # single fact per race; this source hands the car's grid slot to every
        # driver who shared it, so accepting grid 1 here gave Farina a pole in
        # 1955 for a car Gonzalez had qualified.
        grid = h["grid"] if h["grid"] and h["grid"] > 1 else None

        cur.execute("""INSERT INTO race_entries (race_id, driver_id,
                constructor_id, finish_position, grid, classified, status,
                laps_completed, points, shared_drive, confidence, source)
            VALUES (?,?,?,?,?,1,?,?,?,?,?,?)
            ON CONFLICT (race_id, driver_id) DO UPDATE SET
                constructor_id  = COALESCE(excluded.constructor_id, constructor_id),
                -- A driver who shared two cars that both finished on the
                -- podium keeps the better result: race_entries is one row per
                -- driver per race and cannot hold two. The 1955 Argentine
                -- Grand Prix, run in extreme heat with drivers swapping cars,
                -- is the only race where this happens. It is in known_gaps.
                finish_position = MIN(COALESCE(finish_position, 99),
                                      excluded.finish_position),
                grid            = COALESCE(grid, excluded.grid),
                classified      = 1,
                status          = excluded.status,
                laps_completed  = excluded.laps_completed,
                points          = excluded.points,
                shared_drive    = MAX(shared_drive, excluded.shared_drive)""",
            (rid, did, h["constructor_id"], h["position"], grid,
             h["status"], h["laps"], h["points"], shared, h["confidence"],
             h["source"]))
        applied += 1
    # harvest/podiums.txt is empty in the distributed build: the full
    # classification comes from tools/ergast_load.py, which writes to the
    # database directly. The file path is kept so a harvested subset can be
    # loaded the same way, and so this loader's checks apply either way.
    if applied:
        print(f"  podiums: {applied} rows from harvest/podiums.txt")

    # --- notable team radio. A small curated set, each checked against a
    # written source. The bulk radio index for 2018- is loaded separately by
    # tools/fastf1_load.py and is flagged notable=0.
    for (yr, rnd, did, speaker, channel, text, ctx, conf, src) in RA.NOTABLE_RADIO:
        rid = race_key.get((yr, rnd))
        if rid is None:
            raise SystemExit(f"notable radio: no race at {yr} r{rnd}")
        if did and not cur.execute("SELECT 1 FROM drivers WHERE id=?",
                                   (did,)).fetchone():
            raise SystemExit(f"notable radio: unknown driver {did}")
        cur.execute("""INSERT INTO team_radio (race_id, driver_id, speaker,
            transcript, context, notable, confidence, source)
            VALUES (?,?,?,?,?,1,?,?)""",
            (rid, did, f"{speaker} [{channel}]", text, ctx, conf, src))

    # --- career figures checked against the official driver pages.
    # Entries, starts and points are not derivable from the race records this
    # database holds, so they are stored directly. Wins, poles and - since
    # v2.7, when second and third place were harvested for every race -
    # PODIUMS are derivable, so the official figures go to the external
    # columns to be compared against the derived ones.
    for did, (entries, starts, wins, podiums, poles, pts) in D.VERIFIED_STATS.items():
        n = cur.execute("""UPDATE drivers SET entries=?, starts=?,
            podiums_external=?, career_points=?, stats_as_of=?,
            wins_external=?, poles_external=?,
            external_source=?, confidence='verified' WHERE id=?""",
            (entries, starts, podiums, pts, D.STATS_AS_OF, wins, poles,
             "formula1.com driver page, " + D.STATS_AS_OF, did)).rowcount
        if n != 1:
            raise SystemExit(f"VERIFIED_STATS: no driver row for {did!r}")

    # --- derived win totals
    # Fill constructor win counts that were previously unknown, and correct
    # rows where the stored figure counted something other than constructor
    # wins. Every other stored figure was reconciled against the derived
    # count during construction; see verify.py.
    cur.execute("""UPDATE constructors SET wins = (
            SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
              WHERE e.constructor_id = constructors.id AND e.finish_position = 1)
        WHERE wins IS NULL""")
    cur.execute("""UPDATE constructors SET wins = NULL,
        notes = notes || ' Its Grand Prix victories are credited to the Cooper and Lotus '
                      || 'chassis it entered, so it holds no constructor win total of its own.'
        WHERE id = 'rob-walker'""")
    for cid, msg in (
        ("racing-bulls", " The Faenza team's two wins are credited to the constructor names "
                         "it raced under at the time, Toro Rosso (2008) and AlphaTauri (2020)."),
        ("sauber", " Its single victory is credited to BMW Sauber, the constructor name in "
                   "use in 2008.")):
        cur.execute("UPDATE constructors SET wins = 0, notes = notes || ? WHERE id = ?",
                    (msg, cid))

    cur.execute("""UPDATE drivers SET wins = (
            SELECT COUNT(*) FROM race_entries e
            WHERE e.driver_id = drivers.id AND e.finish_position = 1)""")

    # The race records now cover every championship race, 1950-2026, so the
    # derived counts are the authoritative internal figure. Preserve whatever
    # was hand-entered or externally checked in the *_external columns first,
    # then overwrite the main columns from the race data.
    # Corrections to external figures that were checked and found wrong.
    for did, field, old, new, reason in HV.CORRECTIONS:
        n = cur.execute(f"""UPDATE drivers SET {field}_external = ?
            WHERE id = ? AND {field}_external = ?""", (new, did, old)).rowcount
        if n != 1:
            raise SystemExit(f"correction did not apply: {did} {field} {old}->{new}")

    cur.execute("""UPDATE drivers SET poles = (
            SELECT COUNT(*) FROM race_entries e
            WHERE e.driver_id = drivers.id AND e.grid = 1)""")
    cur.execute("""UPDATE drivers SET fastest_laps = (
            SELECT COUNT(*) FROM race_entries e
            WHERE e.driver_id = drivers.id AND e.fastest_lap = 1)""")
    # Podiums are derivable ONLY when second and third places are present.
    # Without them, counting finish_position 1-3 would just be the win count
    # wearing a different name, so the authored figure is left alone and
    # drivers.podiums stays hand-entered, as it was before v2.7.
    have_podiums = cur.execute("""SELECT COUNT(*) FROM race_entries
        WHERE finish_position IN (2, 3)""").fetchone()[0]
    if have_podiums:
        cur.execute("""UPDATE drivers SET podiums = (
                SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                WHERE e.driver_id = drivers.id
                  AND e.finish_position BETWEEN 1 AND 3)""")
    else:
        cur.execute("UPDATE drivers SET podiums = podiums_external "
                    "WHERE podiums_external IS NOT NULL")
    for did, *_ in HV.POLE_ONLY_DRIVERS:
        cur.execute("""UPDATE drivers SET
            first_season = (SELECT MIN(r.year) FROM race_entries e
                JOIN races r ON r.id=e.race_id WHERE e.driver_id=?),
            last_season  = (SELECT MAX(r.year) FROM race_entries e
                JOIN races r ON r.id=e.race_id WHERE e.driver_id=?)
            WHERE id = ? AND first_season IS NULL""", (did, did, did))

    # Indianapolis winners: their championship span is exactly the years they
    # won, so take it from the race data rather than asserting it.
    for did, *_ in HV.INDY_WINNERS:
        cur.execute("""UPDATE drivers SET
            first_season = (SELECT MIN(r.year) FROM race_entries e
                JOIN races r ON r.id=e.race_id WHERE e.driver_id=?),
            last_season  = (SELECT MAX(r.year) FROM race_entries e
                JOIN races r ON r.id=e.race_id WHERE e.driver_id=?)
            WHERE id = ?""", (did, did, did))

    for i, (field, area, desc, n, res) in enumerate(HV.KNOWN_GAPS, 1):
        cur.execute("""INSERT INTO known_gaps (id, field, area, description,
            races_affected, resolution) VALUES (?,?,?,?,?,?)""",
            (i, field, area, desc, n, res))
    # the circuit gap is measured, not asserted
    cur.execute("""UPDATE known_gaps SET races_affected =
        (SELECT COUNT(*) FROM races WHERE circuit_id IS NULL)
        WHERE field = 'circuit_id'""")

    # Record every stored-vs-derived difference, and assert that each one is
    # either explained by a known gap (the driver was still racing in a season
    # the harvest could not reach) or explicitly declared above.
    for i, (did, field, old, new, reason) in enumerate(HV.CORRECTIONS, 1):
        cur.execute("""INSERT INTO discrepancies (subject, field, stored_value,
            derived_value, assessment, status)
            SELECT full_name, ?, ?, ?, ?, 'resolved - corrected'
            FROM drivers WHERE id = ?""", (field, str(old), str(new), reason, did))

    # Compare the externally sourced career figure against the figure derived
    # from the race records. Any difference must be declared; a new one fails
    # the build.
    declared = {(d, f): a for d, f, a in HV.DECLARED_DISCREPANCIES}
    for r in cur.execute("""SELECT id, full_name, wins, wins_external,
        poles, poles_external, fastest_laps, fastest_laps_external,
        last_season FROM drivers""").fetchall():
        for field, derived, external in (("wins", r[2], r[3]),
                                         ("poles", r[4], r[5]),
                                         ("fastest_laps", r[6], r[7])):
            if external is None or external == derived:
                continue
            key = (r[0], field)
            if key in declared:
                assessment, status = declared[key], "open - needs official check"
            elif r[8] is None and external < derived:
                # still racing: the external figure was true on its as-of date
                # and the driver has added to it since
                assessment = ("Driver is still competing. The external figure was "
                              "correct on its as-of date; the derived figure includes "
                              "races run since. Not an error.")
                status = "explained - external figure is older"
            else:
                raise SystemExit(
                    f"UNEXPLAINED discrepancy: {r[1]} {field} "
                    f"external {external}, derived {derived}")
            cur.execute("""INSERT INTO discrepancies (subject, field,
                stored_value, derived_value, assessment, status)
                VALUES (?,?,?,?,?,?)""",
                (r[1], field, str(external), str(derived), assessment, status))

    # --- figures derivable from the race records
    # --- link race entries to the car that scored them
    for cid, yr in CR.CAR_SEASONS:
        row = cur.execute("""SELECT constructor_id, from_year, to_year
                             FROM cars WHERE id=?""", (cid,)).fetchone()
        if row is None:
            raise SystemExit(f"car season: unknown car {cid}")
        cons, fy, ty = row
        if (fy is not None and yr < fy) or (ty is not None and yr > ty):
            raise SystemExit(
                f"car season: {cid} asserted for {yr}, outside its {fy}-{ty} life")
        # Zero entries is legitimate: a car can race a season without winning,
        # taking pole or setting a fastest lap, and race_entries only holds
        # those. Lotus scored none of the three in 1971.
        cur.execute("""UPDATE race_entries SET car_id=? WHERE constructor_id=?
            AND race_id IN (SELECT id FROM races WHERE year=?)""",
            (cid, cons, yr))
    bad = cur.execute("""SELECT e.id FROM race_entries e JOIN cars c ON c.id=e.car_id
        JOIN races r ON r.id=e.race_id
        WHERE r.year < c.from_year OR (c.to_year IS NOT NULL AND r.year > c.to_year)
        LIMIT 1""").fetchone()
    if bad:
        raise SystemExit("car season: an entry falls outside its car's years")

    cur.execute("""UPDATE cars SET
        races = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                 WHERE e.car_id = cars.id),
        wins = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                WHERE e.car_id = cars.id AND e.finish_position = 1),
        poles = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                 WHERE e.car_id = cars.id AND e.grid = 1),
        fastest_laps = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                        WHERE e.car_id = cars.id AND e.fastest_lap = 1)""")

    cur.execute("""UPDATE circuits SET gp_count = (
        SELECT COUNT(*) FROM races r WHERE r.circuit_id = circuits.id
                                      AND r.status = 'completed')""")
    cur.execute("""UPDATE grands_prix SET
        editions = (SELECT COUNT(*) FROM races r
                    WHERE r.gp_id = grands_prix.id AND r.status = 'completed'),
        first_held = (SELECT MIN(year) FROM races r WHERE r.gp_id = grands_prix.id),
        last_held  = (SELECT MAX(year) FROM races r WHERE r.gp_id = grands_prix.id),
        circuits_used = (SELECT GROUP_CONCAT(DISTINCT c.name) FROM races r
                         JOIN circuits c ON c.id = r.circuit_id
                         WHERE r.gp_id = grands_prix.id)""")
    cur.execute("""UPDATE constructors SET poles = (
        SELECT COUNT(*) FROM race_entries e
        WHERE e.constructor_id = constructors.id AND e.grid = 1)""")

    con.commit()
    return con


def X_engine_eras():
    return T.ENGINE_ERAS


def report(con):
    cur = con.cursor()
    tables = [r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    total = 0
    print(f"{'table':28} rows")
    print("-" * 36)
    for t in tables:
        n = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        total += n
        print(f"{t:28} {n:>5}")
    print("-" * 36)
    print(f"{'TOTAL':28} {total:>5}")
    views = [r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")]
    print("\nviews:", ", ".join(views))


if __name__ == "__main__":
    c = build()
    report(c)
    print(f"\nWrote {DB}")
