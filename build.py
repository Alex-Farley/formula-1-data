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
VERSION = "2.12"
BUILT = "2026-09-05"


def build():
    if os.path.exists(DB):
        os.remove(DB)
    con = sqlite3.connect(DB)
    con.executescript(open(os.path.join(HERE, "schema.sql"), encoding="utf-8").read())
    cur = con.cursor()

    # ---------------------------------------------------------- meta
    cur.executemany("INSERT INTO provenance VALUES (?,?,?,?)", N.PROVENANCE)
    cur.executemany(
        "INSERT INTO source_registry (priority, source, url, use, authority,"
        " licence, cadence, checkability) VALUES (?,?,?,?,?,?,?,?)",
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
         "Complete for: the chassis register (every chassis that has raced), engines, "
         "per-season entry lists, season champions, race-by-race winners 1950-2026, pole position "
         "1950-2024, fastest lap 1950-2024 bar 12 races, the circuit of every race "
         "1950-2026, constructor lineage, engine formulae, regulation changes, safety "
         "milestones, points systems. "
         "Partial by design for: full driver register (every race winner, pole-sitter and "
         "fastest-lap setter, not all ~780 starters); full finishing order; qualifying, "
         "grid and lap-by-lap data (not held); chassis specifications, which exist only "
         "on the per-car articles and are thin for the modern era because teams do not "
         "publish them. The chassis a race was won in is known where the season's entry "
         "list names one chassis for the constructor and NULL where it names several. "
         "See the known_gaps table."),
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

    # A figure withdrawn because it described the regulations rather than the
    # car must actually be gone, and the reason must be on the record.
    for car_id, field, old, reason in CR.WITHDRAWN:
        row = cur.execute(f"SELECT {field} FROM cars WHERE id=?",
                          (car_id,)).fetchone()
        if row is None:
            raise SystemExit(f"WITHDRAWN names unknown car {car_id}")
        if row[0] is not None:
            raise SystemExit(
                f"{car_id}.{field} is declared withdrawn but still holds "
                f"{row[0]}. Set it to None in data/cars.py.")
        cur.execute("""INSERT INTO discrepancies (subject, field, stored_value,
            derived_value, assessment, status)
            SELECT full_name, ?, ?, 'NULL', ?, 'resolved - withdrawn'
            FROM cars WHERE id = ?""", (field, str(old), reason, car_id))

    known_cons = {r[0] for r in cur.execute("SELECT id FROM constructors")}

    # --- constructors admitted from the F1DB register (data/teams.py
    # F1DB_CONSTRUCTORS). The ids are authored there; every attribute comes
    # from the generated harvest files, so nobody types eighty-five team
    # names and no team appears without a reviewed line.
    f1db_names = {r[0]: (r[1], r[2], r[3]) for r in HV.load_f1db_constructors()}
    f1db_country = {r[0]: r[1] for r in HV.load_f1db_countries()}
    cons_years = {}
    for year, _e, f1db_cons, _em, _d, rounds, test in HV.load_entrant_drivers():
        if test or not rounds:
            continue
        cons_years.setdefault(f1db_cons, set()).add(year)
    for f1db_id in T.F1DB_CONSTRUCTORS:
        if f1db_id in known_cons:
            raise SystemExit(
                f"F1DB_CONSTRUCTORS admits {f1db_id}, which the register "
                f"already holds. Remove it from the list or rename the id.")
        if f1db_id in T.F1DB_CONSTRUCTOR_NON_MAPPING:
            raise SystemExit(f"{f1db_id} is both admitted and declared "
                             f"deliberately excluded")
        meta = f1db_names.get(f1db_id)
        if meta is None:
            raise SystemExit(f"F1DB_CONSTRUCTORS admits {f1db_id}, which is "
                             f"not in harvest/f1db_constructors.txt. Rerun "
                             f"tools/f1db_fetch.py.")
        yrs = cons_years.get(f1db_id)
        if not yrs:
            raise SystemExit(f"F1DB_CONSTRUCTORS admits {f1db_id}, which the "
                             f"entry lists show entering no championship race")
        name, full, country_id = meta
        cur.execute("""INSERT INTO constructors (id, name, full_name, country,
            first_entry, last_entry, wins, constructors_titles,
            drivers_titles, active, confidence, source)
            VALUES (?,?,?,?,?,?,NULL,0,0,?,?,?)""",
            (f1db_id, name, full, f1db_country.get(country_id),
             min(yrs), max(yrs), 1 if max(yrs) >= 2026 else 0,
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))
        known_cons.add(f1db_id)

    # --- regulation limits. Loaded before the chassis register so the
    # register's weights can be measured against them.
    for i, (fy, ty, field, value, unit, note, conf, src) in \
            enumerate(X.REGULATION_LIMITS, 1):
        cur.execute("""INSERT INTO regulation_limits (id, from_year, to_year,
            field, value, unit, note, confidence, source)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (i, fy, ty, field, value, unit, note, conf, src))

    # --- the chassis, engine and entrant register (F1DB, via
    # tools/f1db_fetch.py). Bulk rows: no person has touched them.
    known_eng = {r[0] for r in cur.execute("SELECT id FROM engine_manufacturers")}

    for eid, man, name, full, cap, cfg, asp in HV.load_engines():
        our_man = HV.constructor_for_f1db(man)
        cur.execute("""INSERT INTO engines (id, manufacturer_id,
            f1db_manufacturer_id, name, full_name, capacity_l, configuration,
            aspiration, confidence, source) VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (eid, our_man if our_man in known_eng else None, man, name, full,
             float(cap) if cap else None, cfg,
             asp.replace("_", " ").lower() if asp else None,
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))

    entrants = HV.load_entrants()
    # seasons a chassis was entered, from the entry lists
    chassis_years = {}
    for year, _entrant, _cons, _eman, ch_ids, _eng, _tyres in entrants:
        for ch in ch_ids:
            chassis_years.setdefault(ch, set()).add(year)

    # chassis -> the curated car that covers it, from CAR_CHASSIS
    chassis_car = {}
    for car_id, ch_ids in CR.CAR_CHASSIS.items():
        for ch in ch_ids:
            if ch in chassis_car:
                raise SystemExit(
                    f"chassis {ch} is claimed by both {chassis_car[ch]} "
                    f"and {car_id}")
            chassis_car[ch] = car_id

    specs = {}
    for row in HV.load_car_specs():
        for ch in (row["chassis_ids"] or "").split("+"):
            if ch:
                specs[ch] = row

    def _int(v):
        return int(float(v)) if v else None

    def _float(v):
        return float(v) if v else None

    for ch_id, f1db_cons, name, full in HV.load_chassis():
        if ch_id in chassis_car and chassis_car[ch_id] not in seen_cars:
            raise SystemExit(f"CAR_CHASSIS names unknown car "
                             f"{chassis_car[ch_id]}")
        yrs = chassis_years.get(ch_id) or set()
        # The season matters here too: the Alfa Romeo C42 and C43 are F1DB
        # `alfa-romeo` chassis and Sauber cars.
        #
        # Every season the chassis raced must agree about which constructor
        # it belongs to. Taking one of them - the first, say - would silently
        # pick the wrong entity for a chassis that raced across a rename.
        # None does today; the build refuses rather than wait for one.
        _cands = {HV.constructor_for_f1db(f1db_cons, y) for y in yrs} or \
                 {HV.constructor_for_f1db(f1db_cons)}
        if len(_cands) > 1:
            raise SystemExit(
                f"chassis {ch_id} raced {min(yrs)}-{max(yrs)}, which spans a "
                f"constructor rename: {sorted(_cands)}. Split the chassis or "
                f"the mapping; do not let one season decide.")
        our_cons = _cands.pop()
        sp = specs.get(ch_id, {})
        cur.execute("""INSERT INTO chassis (id, constructor_id,
            f1db_constructor_id, name, full_name, car_id, first_year,
            last_year, seasons, article, designers, chassis_type, susp_front,
            susp_rear, engine_name, engine_config, aspiration,
            engine_position, gearbox, gears, brakes, fuel, tyres, capacity_cc,
            power_bhp, power_note, weight_kg, wheelbase_mm, track_front_mm,
            track_rear_mm, fuel_capacity_l, predecessor, successor,
            published_races, published_wins, published_poles, confidence,
            spec_source, source) VALUES (""" + ",".join("?" * 39) + ")",
            (ch_id, our_cons if our_cons in known_cons else None, f1db_cons,
             name, full, chassis_car.get(ch_id),
             min(yrs) if yrs else None, max(yrs) if yrs else None, len(yrs),
             sp.get("article"), sp.get("designers"), sp.get("chassis_type"),
             sp.get("susp_front"), sp.get("susp_rear"), sp.get("engine_name"),
             sp.get("engine_config"), sp.get("aspiration"),
             sp.get("engine_position"), sp.get("gearbox"), sp.get("gears"),
             sp.get("brakes"), sp.get("fuel"), sp.get("tyres"),
             _int(sp.get("capacity_cc")), _int(sp.get("power_bhp")),
             sp.get("power_note"), _float(sp.get("weight_kg")),
             _int(sp.get("wheelbase_mm")), _int(sp.get("track_front_mm")),
             _int(sp.get("track_rear_mm")), _int(sp.get("fuel_l")),
             sp.get("predecessor"), sp.get("successor"),
             _int(sp.get("races")), _int(sp.get("wins")), _int(sp.get("poles")),
             HV.F1DB_CONFIDENCE,
             ("https://en.wikipedia.org/wiki/" +
              sp["article"].replace(" ", "_")) if sp.get("article") else None,
             HV.F1DB_SOURCE))

    # --- a regulation figure is not a measurement, part one
    #
    # Drop any harvested figure that exactly restates a limit this database
    # has a source for. tools/wikispec_fetch.py already does this, but it
    # does it per chassis, and a family article carries one row for several
    # chassis - so the Ferrari F2004 and F2004M share a row whose span is
    # 2004-2005, and whichever chassis was read first decided which seasons
    # were tested. Doing it here, against the span actually stored, closes
    # that. The build is where the guarantee belongs anyway: the harvest can
    # be re-run by anyone, and this cannot be skipped.
    reg_by_year = {}
    for lo_, hi_, field_, val_, _u, _n, _c, _s in X.REGULATION_LIMITS:
        for y in range(lo_, (hi_ or lo_) + 1):
            reg_by_year.setdefault(y, {})[field_] = val_
    for col, field_, what in (("weight_kg", "minimum_weight_kg", "minimum"),
                              ("wheelbase_mm", "maximum_wheelbase_mm", "maximum")):
        for cid_, val, lo_, hi_ in cur.execute(
                f"""SELECT id, {col}, first_year, last_year FROM chassis
                    WHERE {col} IS NOT NULL AND first_year IS NOT NULL""").fetchall():
            hit = [y for y in range(lo_, (hi_ or lo_) + 1)
                   if reg_by_year.get(y, {}).get(field_) == val]
            if hit:
                cur.execute(f"UPDATE chassis SET {col}=NULL WHERE id=?", (cid_,))
                cur.execute("""INSERT INTO discrepancies (subject, field,
                    stored_value, derived_value, assessment, status)
                    SELECT full_name, ?, ?, 'NULL', ?, 'resolved - withdrawn'
                    FROM chassis WHERE id = ?""",
                    (col, str(val),
                     f"{val:g} is the {hit[0]} regulation {what}, which every "
                     f"car that season was built to. It describes the rules, "
                     f"not this car.", cid_))

    # --- a regulation figure is not a measurement, part two
    #
    # regulation_limits catches only the years a limit has actually been
    # sourced for, and that series is full of holes on purpose: carrying a
    # value across a change no source records would invent one. Whole eras
    # are uncovered.
    #
    # The data closes them from the other direction. A figure that is
    # genuinely a measurement of one car is that car's alone; a figure that
    # three or more DIFFERENT CONSTRUCTORS all quote for cars racing in the
    # same season is the rule they were built to.
    #
    # Both qualifications are load-bearing, and each was learned by getting
    # it wrong:
    #
    #   * Constructors, not cars. The BRM P126, P133 and P138 share a
    #     wheelbase because they are one car evolved. Three cars from one
    #     constructor is evidence of nothing.
    #   * Per season, not per group. A minimum stays in force for years, so
    #     the cars quoting it need not overlap each other - 600 kg covers
    #     1995 to 2003. Requiring one year common to all of them made the
    #     test fire almost never. Counting per season also stops the reverse
    #     error: 620 kg is quoted by fourteen constructors, but thirteen of
    #     them are 2010 and the fourteenth is a 1955 Lancia, which keeps its
    #     figure because in 1955 nobody else shared it.
    #   * Weight only. The test says "a figure a whole grid shares is the
    #     rule", which is sound only where a rule actually fixes that figure.
    #     Minimum weight has been fixed for the whole grid continuously since
    #     1961. Wheelbase has never been capped at all except for 2026, which
    #     regulation_limits already covers - so a shared wheelbase cannot be
    #     a regulation and must be something else. Running the test on it
    #     dropped 2,540 mm, 2,692 mm and 2,794 mm from fifteen cars, which
    #     are 100, 106 and 110 inches exactly: designers of that era worked
    #     in imperial and rounded to the same numbers. Those are real
    #     measurements and they are kept.
    for col, what in (("weight_kg", "minimum weight"),):
        rows_ = cur.execute(
            f"""SELECT id, {col}, f1db_constructor_id, first_year, last_year
                FROM chassis
                WHERE {col} IS NOT NULL AND first_year IS NOT NULL""").fetchall()
        # (value, season) -> constructors quoting it, and the chassis doing so
        by_year = {}
        for cid_, val, cons_, lo_, hi_ in rows_:
            for y in range(lo_, (hi_ or lo_) + 1):
                cons, ids = by_year.setdefault((val, y), (set(), set()))
                cons.add(cons_)
                ids.add(cid_)
        drop, evidence = set(), {}
        for (val, y), (cons, ids) in by_year.items():
            if len(cons) < 3:
                continue
            drop |= ids
            best = evidence.get(val)
            if best is None or len(cons) > best[1]:
                evidence[val] = (y, len(cons), len(ids))
        if drop:
            cur.executemany(f"UPDATE chassis SET {col}=NULL WHERE id=?",
                            [(c,) for c in sorted(drop)])
            for val, (y, ncons, nids) in sorted(evidence.items()):
                cur.execute("""INSERT INTO discrepancies (subject, field,
                    stored_value, derived_value, assessment, status)
                    VALUES (?,?,?,?,?,?)""",
                    (f"{nids} chassis quoting {val:g}", col, str(val), "NULL",
                     f"{ncons} different constructors racing in {y} all quote "
                     f"{val:g} for this field. A figure a whole grid shares is "
                     f"the season's {what}, not a measurement of any one car, "
                     f"so it is not stored per chassis. The rule itself "
                     f"belongs in regulation_limits.",
                     "resolved - withdrawn"))

    known_years = {r[0] for r in cur.execute("SELECT year FROM seasons")}
    for i, (year, entrant, f1db_cons, eng_man, ch_ids, eng_ids, tyres) in \
            enumerate(entrants, 1):
        if year not in known_years:
            raise SystemExit(f"entrants.txt: season {year} is not in the "
                             f"season register")
        our_cons = HV.constructor_for_f1db(f1db_cons, year)
        cur.execute("""INSERT INTO season_entrants (id, year, entrant_id,
            f1db_constructor_id, constructor_id, engine_manufacturer_id,
            chassis_ids, chassis_count, engine_ids, tyre_ids, confidence,
            source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (i, year, entrant, f1db_cons,
             our_cons if our_cons in known_cons else None, eng_man,
             "+".join(ch_ids) or None, len(ch_ids),
             "+".join(eng_ids) or None, "+".join(tyres) or None,
             HV.F1DB_CONFIDENCE, HV.F1DB_SOURCE))

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
    # --- link race entries to the CHASSIS that scored them
    #
    # known_gaps #1 has stood since v2.6: the chassis-per-race harvest was
    # abandoned because the winner cross-check does not constrain the
    # chassis. A 1952 trial returned "Ferrari 125 F2" for races Ascari won in
    # a Ferrari 500 and every winner still matched, because the winner says
    # which race a row describes and nothing at all about what he drove.
    #
    # The entry lists are the constraint that was missing. They are also not
    # a complete answer, and that limit is the whole design of this block:
    #
    #   F1DB records which chassis a constructor ran in a SEASON. It does not
    #   record which chassis ran in which ROUND.
    #
    # So a constructor-season constrains the chassis only when the entry
    # lists name exactly one for it across every entrant. Ferrari in 1952
    # names five - the 500 Ascari won everything in, plus a 125, a 166, a 212
    # and a 375S in other people's hands - and gets no link at all. That is
    # the correct answer for 1952 and it is the answer the abandoned harvest
    # should have given.
    season_chassis = {}
    for year, _entrant, f1db_cons, _eman, ch_ids, _eng, _tyres in entrants:
        our = HV.constructor_for_f1db(f1db_cons, year)
        if our in known_cons:
            season_chassis.setdefault((our, year), set()).update(ch_ids)
    unambiguous = {k: next(iter(v)) for k, v in season_chassis.items()
                   if len(v) == 1}

    # The check, before anything is written. CAR_SEASONS + CAR_CHASSIS are a
    # fact this database already holds, asserted by hand and already proved
    # against published win totals. Where F1DB's entry lists resolve the same
    # constructor-season to a single chassis, it must be one this database
    # already assigns to that car. A disagreement is not reconciled quietly;
    # it stops the build.
    for car_id, yr in CR.CAR_SEASONS:
        cons = cur.execute("SELECT constructor_id FROM cars WHERE id=?",
                           (car_id,)).fetchone()[0]
        found = unambiguous.get((cons, yr))
        if found and found not in CR.CAR_CHASSIS.get(car_id, ()):
            raise SystemExit(
                f"chassis linkage: the {yr} entry lists give {cons} exactly "
                f"one chassis, {found}, but CAR_SEASONS says that season "
                f"belongs to {car_id}, whose chassis are "
                f"{CR.CAR_CHASSIS.get(car_id)}")

    for (cons, yr), ch_id in unambiguous.items():
        cur.execute("""UPDATE race_entries SET chassis_id=?
            WHERE constructor_id=? AND race_id IN
                  (SELECT id FROM races WHERE year=?)""", (ch_id, cons, yr))

    # --- rule two: resolve through the driver and the round
    #
    # The rule above asks what a CONSTRUCTOR ran in a SEASON, and gives up
    # whenever the answer is more than one. That is most of the 1950s and
    # 1960s, where a "constructor" was a name several privateers entered
    # several different chassis under.
    #
    # The drivers inside an entrant block carry rounds, though, and that is a
    # far sharper question: what did THIS ENTRANT run for THIS DRIVER in THIS
    # ROUND. Lotus in 1970 ran a 49C, a 72B and a 72C and settles nothing as a
    # constructor - but Garvey Team Lotus entered a 49C for Soler-Roig in
    # round 2 and nothing else, and that resolves. Only Rindt's entries stay
    # ambiguous, correctly: he moved from the 49C to the 72 mid-season.
    #
    # This rule never contradicts the first - a constructor-season with one
    # chassis has that chassis in every one of its entrant blocks - and the
    # build asserts as much rather than assuming it.
    drivers_by_f1db, collisions = HV.resolve_f1db_drivers(
        dict(cur.execute("SELECT id, full_name FROM drivers")))
    if collisions:
        raise SystemExit(
            "two F1DB drivers normalise onto one register entry: "
            + "; ".join(f"{k} <- {v}" for k, v in collisions.items()))

    # (year, entrant, constructor, engine manufacturer) -> its chassis list
    block_chassis = {}
    for year, entrant, f1db_cons, eng_man, ch_ids, _e, _t in entrants:
        block_chassis[(year, entrant, f1db_cons, eng_man)] = ch_ids

    # (year, round, our driver id) -> {chassis}, {our constructor id}
    per_round = {}
    for (year, entrant, f1db_cons, eng_man, f1db_driver, rounds,
         test) in HV.load_entrant_drivers():
        if test or not rounds:
            continue                    # a test driver did not enter a race
        our_driver = drivers_by_f1db.get(f1db_driver)
        if our_driver is None:
            continue                    # not in this register; never created
        ch = block_chassis.get((year, entrant, f1db_cons, eng_man), [])
        our_cons = HV.constructor_for_f1db(f1db_cons, year)
        for rnd in rounds:
            slot = per_round.setdefault((year, rnd, our_driver), (set(), set()))
            slot[0].update(ch)
            if our_cons in known_cons:
                slot[1].add(our_cons)

    # The check that has to pass before any of this is trusted.
    #
    # 1,164 race entries already carry a constructor, established by a
    # different route entirely - the Wikipedia race harvest. For every one of
    # them F1DB must agree. This is the constraining cross-check: it is the
    # entrant lists' answer to a question this database already knows the
    # answer to, on a thousand rows, before their answer is taken on the
    # rows where it does not.
    agreed = conflict = 0
    conflicts = []
    for eid_, year, rnd, did_, cons_ in cur.execute(
            """SELECT e.id, r.year, r.round, e.driver_id, e.constructor_id
               FROM race_entries e JOIN races r ON r.id = e.race_id
               WHERE e.constructor_id IS NOT NULL""").fetchall():
        found = per_round.get((year, rnd, did_))
        if not found or not found[1]:
            continue
        if cons_ in found[1]:
            agreed += 1
        else:
            conflict += 1
            if len(conflicts) < 8:
                conflicts.append(f"{year} r{rnd} {did_}: stored {cons_}, "
                                 f"entry list {sorted(found[1])}")
    if conflict:
        raise SystemExit(
            f"entrant lists disagree with the stored constructor on "
            f"{conflict} of {agreed + conflict} checked entries:\n  "
            + "\n  ".join(conflicts))
    if agreed < 800:
        raise SystemExit(
            f"only {agreed} race entries could be checked against the entry "
            f"lists; that is too few to trust the rest. Rerun "
            f"tools/f1db_fetch.py.")

    filled_cons = filled_chassis = 0
    for eid_, year, rnd, did_, cons_, ch_ in cur.execute(
            """SELECT e.id, r.year, r.round, e.driver_id, e.constructor_id,
                      e.chassis_id
               FROM race_entries e JOIN races r ON r.id = e.race_id""").fetchall():
        found = per_round.get((year, rnd, did_))
        if not found:
            continue
        chassis_set, cons_set = found
        if cons_ is None and len(cons_set) == 1:
            cur.execute("UPDATE race_entries SET constructor_id=? WHERE id=?",
                        (next(iter(cons_set)), eid_))
            filled_cons += 1
        if len(chassis_set) == 1:
            one = next(iter(chassis_set))
            if ch_ is not None and ch_ != one:
                raise SystemExit(
                    f"the two chassis rules disagree for {year} round {rnd} "
                    f"{did_}: season says {ch_}, entry list says {one}")
            if ch_ is None:
                cur.execute("UPDATE race_entries SET chassis_id=? WHERE id=?",
                            (one, eid_))
                filled_chassis += 1
    print(f"  entry lists: {agreed} stored constructors confirmed, "
          f"{filled_cons} filled, {filled_chassis} chassis resolved by round")

    # --- link race entries to the curated car that scored them
    #
    # Two routes, and the precise one goes first.
    #
    # 1. Through the chassis. Where the entry lists resolved a chassis and
    #    that chassis belongs to a curated car, the car follows with no
    #    assumption at all.
    #
    # 2. CAR_SEASONS, the authored claim that every race a constructor won,
    #    took pole for or set fastest lap in that season was in this car.
    #    That claim is now CHECKED rather than trusted: it is applied only
    #    where the season's entry lists name no chassis outside the ones the
    #    car covers. Twelve of the forty-one pairs fail that test, and the
    #    cost of having trusted them shows up the moment poles can be
    #    attributed at all - McLaren ran the M23 and the M26 through 1976 and
    #    1977, and the blanket claim handed every one of Hunt's sixteen poles
    #    to the M23 against a published career fourteen.
    #
    # Where the claim is not corroborated and the chassis did not resolve,
    # the entry keeps no car. "We do not know whether that pole was an M23 or
    # an M26" is the true answer.
    cur.execute("""UPDATE race_entries SET car_id = (
        SELECT c.car_id FROM chassis c WHERE c.id = race_entries.chassis_id)
        WHERE chassis_id IS NOT NULL""")

    season_all = {}
    for year, _entrant, f1db_cons, _eman, ch_ids, _e, _t in entrants:
        our = HV.constructor_for_f1db(f1db_cons, year)
        if our in known_cons:
            season_all.setdefault((our, year), set()).update(ch_ids)

    uncorroborated = []
    for cid, yr in CR.CAR_SEASONS:
        row = cur.execute("""SELECT constructor_id, from_year, to_year
                             FROM cars WHERE id=?""", (cid,)).fetchone()
        if row is None:
            raise SystemExit(f"car season: unknown car {cid}")
        cons, fy, ty = row
        if (fy is not None and yr < fy) or (ty is not None and yr > ty):
            raise SystemExit(
                f"car season: {cid} asserted for {yr}, outside its {fy}-{ty} life")
        others = sorted(season_all.get((cons, yr), set())
                        - set(CR.CAR_CHASSIS.get(cid, ())))
        cur.execute("""INSERT INTO car_seasons (car_id, year, corroborated,
            other_chassis) VALUES (?,?,?,?)""",
            (cid, yr, 0 if others else 1, "+".join(others) or None))
        if others:
            uncorroborated.append((cid, yr, others))
            continue
        # Zero entries is legitimate: a car can race a season without winning,
        # taking pole or setting a fastest lap, and race_entries only holds
        # those. Lotus scored none of the three in 1971.
        cur.execute("""UPDATE race_entries SET car_id=? WHERE constructor_id=?
            AND car_id IS NULL
            AND race_id IN (SELECT id FROM races WHERE year=?)""",
            (cid, cons, yr))
    for cid, yr, others in uncorroborated:
        cur.execute("""INSERT INTO discrepancies (subject, field, stored_value,
            derived_value, assessment, status) VALUES (?,?,?,?,?,?)""",
            (f"{cid} {yr}", "CAR_SEASONS", "one chassis", "+".join(others),
             f"CAR_SEASONS claims every {yr} result for this constructor was "
             f"in {cid}, but the season's entry lists also name "
             f"{', '.join(others)}. The blanket link is not applied; entries "
             f"that season get a car only where the entry lists resolved the "
             f"chassis itself.", "resolved - claim not corroborated"))
    print(f"  car linkage: {len(CR.CAR_SEASONS) - len(uncorroborated)} of "
          f"{len(CR.CAR_SEASONS)} CAR_SEASONS claims corroborated by the "
          f"entry lists")

    bad = cur.execute("""SELECT e.id FROM race_entries e JOIN cars c ON c.id=e.car_id
        JOIN races r ON r.id=e.race_id
        WHERE r.year < c.from_year OR (c.to_year IS NOT NULL AND r.year > c.to_year)
        LIMIT 1""").fetchone()
    if bad:
        raise SystemExit("car season: an entry falls outside its car's years")


    # A chassis may not be credited with a race run outside the seasons the
    # entry lists record it in. This cannot fail given how the links are
    # made; it is here so that it cannot start failing silently later.
    bad = cur.execute("""SELECT e.id FROM race_entries e
        JOIN chassis c ON c.id = e.chassis_id JOIN races r ON r.id = e.race_id
        WHERE r.year < c.first_year OR r.year > c.last_year LIMIT 1""").fetchone()
    if bad:
        raise SystemExit("chassis linkage: an entry falls outside its "
                         "chassis's entered seasons")

    cur.execute("""UPDATE chassis SET
        races = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                 WHERE e.chassis_id = chassis.id),
        wins = (SELECT COUNT(DISTINCT e.race_id) FROM race_entries e
                WHERE e.chassis_id = chassis.id AND e.finish_position = 1)""")

    # The reconciliation. `wins` is counted from this database's own race
    # records through the linkage above; `published_wins` was read off the
    # car's Wikipedia article by a different route entirely. A chassis cannot
    # have won more races than its published career total, and one that has
    # means the linkage is wrong.
    over = cur.execute("""SELECT id, full_name, wins, published_wins
        FROM chassis WHERE published_wins IS NOT NULL AND wins > published_wins
        ORDER BY wins - published_wins DESC""").fetchall()
    for cid_, full_, derived_, published_ in over:
        # A family article publishes the family's total, so a single chassis
        # in a family can only ever come in under it. Exceeding it is a real
        # linkage error.
        raise SystemExit(
            f"chassis linkage: {full_} is credited with {derived_} wins from "
            f"the race records but its article publishes {published_}")

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
