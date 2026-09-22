# -*- coding: utf-8 -*-
"""
Fetch the chassis, engine and per-season entrant register from F1DB.

    python3 tools/f1db_fetch.py                    # clone and regenerate
    python3 tools/f1db_fetch.py --source ~/f1db    # use an existing checkout
    python3 tools/f1db_fetch.py --check            # regenerate and diff only

Source:  https://github.com/f1db/f1db   (CC BY 4.0)
Writes:  harvest/chassis.txt, harvest/engines.txt, harvest/entrants.txt,
         harvest/entrant_drivers.txt, harvest/f1db_constructors.txt,
         harvest/f1db_drivers.txt, and the results, qualifying, standings,
         pit stop, race date, fastest lap, circuit outline and race layout
         files main() lists

Why a tool and not a person
---------------------------
This is 1,153 chassis, 424 engines and 1,799 entrant rows. CONTRIBUTING.md is
explicit that data at that scale goes through a loader and never through a
human: during v2.7 an API harvest was relayed by hand and four of five sampled
rows came back fabricated. So this script fetches and writes; nobody types.

Why the output is a text file and not a direct write to f1.db
-------------------------------------------------------------
`build.py` is offline and reproducible, and CI rebuilds the database from
`data/` and `harvest/` on every push. A loader that wrote straight into f1.db
would put data in the distributed artefact that no fresh build could
reproduce. Writing diffable text instead keeps one rule intact - the database
is a function of the sources in this repository - and means a change in F1DB
shows up in a pull request as readable lines.

What F1DB does and does not give you
------------------------------------
The `chassis` entity is a complete register of every chassis that has raced:
id, constructorId, name, fullName. It carries **no technical specifications
at all** - no weight, no wheelbase, no suspension. Those come from the
per-car Wikipedia harvest (tools/wikispec_fetch.py) instead.

The `engine` entity does carry capacity, configuration and aspiration.

`seasons/<year>/entrants.yml` links season -> entrant -> constructor ->
chassis/engine/tyre. That mapping is the second source the chassis-per-race
harvest was missing (known_gaps #3). It has one hard limit, and it decides
how far the linkage can go:

    **F1DB records which chassis a constructor ran in a season. It does not
    record which chassis ran in which round.**

Where a team ran two designs in a year - Lotus in 1970, Ferrari in 1975 - the
entrant block lists both under a `chassis:` list with no round attribution.
So the mapping constrains the chassis only for constructor-seasons that used
exactly one. Those are stored; the rest stay NULL. Multi-chassis seasons are
written out too, with every chassis on the row, so the ambiguity is recorded
rather than dropped - build.py refuses to link them.

The circuit outlines
--------------------
Each F1DB circuit file lists its `layouts:` - id, length, turns - and every
race.yml names the layout it ran as `circuitLayoutId`. Since v2026.0.1 F1DB
also ships an SVG of every layout in src/assets/circuits/, drawn by Jules Roy
and credited to him in F1DB's README: four styles, one <path> each, in a
500x500 box, under the same CC BY 4.0 as the data. The styles differ only in
stroke and fill, so the path is read once, from the `black` set, and the site
styles it. An outline is a drawing, not a measurement - no scale, no position,
no direction of travel - which is what separates it from the OpenStreetMap
trace in harvest/circuit_geometry.txt, and why build.py keeps the two in
different tables. The trace exists for 25 current layouts; the outline for
every layout the championship has raced on.
"""
import argparse
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
from data.harvest import (  # noqa: E402  (the one rule for what an outline may hold)
    SVG_PATH_DATA, svg_path_in_box, svg_path_translate)
HARVEST = os.path.join(ROOT, "harvest")
CACHE = os.path.join(ROOT, ".f1dbcache")
REPO = "https://github.com/f1db/f1db.git"

# The licence the header states, and the licence SOURCE_LICENCE in
# data/current.py classifies F1DB under. The header used to be stamped from
# this constant without looking: a relicensed release would have been
# fetched, stamped "CC BY 4.0", rebuilt and - passing every cross-check, which
# test facts and not terms - committed and deployed by refresh.yml before
# anyone read it. licence_check() now reads the licence file in the checkout
# and refuses anything but this one, so the refresh fails at the fetch and
# commits nothing (PM-27, found writing docs/UPSTREAM.md).
LICENCE = "Attribution 4.0 International"
# The legal code's own name for itself, required in the body: a file with the
# right title and any other text - "not for commercial use without written
# permission", say - is not the deed.
LICENCE_MARKER = "Creative Commons Attribution 4.0 International Public License"
LICENCE_FILES = ("LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "LICENCE.md")
# Any of these in a Creative Commons deed names a different licence. Compared
# case-insensitively.
LICENCE_FORBIDDEN = ("noncommercial", "sharealike", "noderivatives", "non-commercial")

HEADER = """\
# Generated by tools/f1db_fetch.py. Do not edit by hand.
# Source: F1DB {version} ({commit}), https://github.com/f1db/f1db, CC BY 4.0.
# {fields}
"""


def licence_check(path):
    """The licence file in an F1DB checkout, read and required to be CC BY 4.0.

    Returns the file name it read. Exits - so the refresh workflow's fetch
    step fails and nothing after it runs - if there is no licence file, if
    its title is not the Attribution 4.0 International deed, if the legal
    code's own name is not in the body, or if it names an element
    (NonCommercial, ShareAlike, NoDerivatives) that CC BY does not have. The
    check cannot tell a relicence from a reformatted deed, and does not try:
    either way a person reads the file, and either confirms the licence or
    reclassifies the source in SOURCE_LICENCE (data/current.py). The stale
    site a blocked refresh leaves is the cheap failure; publishing under an
    assumed licence is the expensive one. This reads the root deed only: a
    licence stated somewhere else in the repository is not seen.
    """
    for name in LICENCE_FILES:
        candidate = os.path.join(path, name)
        if os.path.isfile(candidate):
            break
    else:
        sys.exit(f"no licence file in {path} (looked for {', '.join(LICENCE_FILES)}); "
                 f"F1DB is classified as CC BY 4.0 in SOURCE_LICENCE and the fetch "
                 f"will not proceed without the deed to show for it")
    with open(candidate, encoding="utf-8", errors="replace") as f:
        text = f.read()
    title = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
    advice = ("does not match the deed F1DB is classified under in SOURCE_LICENCE "
              "(data/current.py). Read the file, and either confirm the licence or "
              "reclassify the source before fetching again; the committed harvest "
              "stays under the licence it was received under (docs/UPSTREAM.md)")
    if title != LICENCE:
        sys.exit(f"{name} in {path} is titled {title!r}, not {LICENCE!r}, and {advice}")
    if LICENCE_MARKER not in text:
        sys.exit(f"{name} in {path} has the deed's title but not its text "
                 f"({LICENCE_MARKER!r} is not in it), and {advice}")
    lowered = text.lower()
    named = [w for w in LICENCE_FORBIDDEN if w in lowered]
    if named:
        sys.exit(f"{name} in {path} names {', '.join(named)}, which the Attribution 4.0 "
                 f"deed does not, and {advice}")
    return name


def _yaml():
    try:
        import yaml
    except ImportError:
        sys.exit("PyYAML is needed by this tool (not by the build): "
                 "pip install pyyaml")
    return yaml


def checkout(source):
    """Return (path, version, commit) for an F1DB working tree."""
    if source:
        path = os.path.abspath(os.path.expanduser(source))
        if not os.path.isdir(os.path.join(path, "src", "data")):
            sys.exit(f"{path} does not look like an F1DB checkout")
    else:
        path = CACHE
        if os.path.isdir(os.path.join(path, ".git")):
            run(["git", "-C", path, "fetch", "--depth", "1", "origin", "HEAD"])
            run(["git", "-C", path, "reset", "--hard", "FETCH_HEAD"])
        else:
            run(["git", "clone", "--depth", "1", REPO, path])
    commit = run(["git", "-C", path, "rev-parse", "--short", "HEAD"]).strip()
    version = run(["git", "-C", path, "log", "-1", "--format=%s"]).strip()
    version = version.split(":")[-1].strip()
    return path, version, commit


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if p.returncode:
        sys.exit(f"{' '.join(cmd)} failed:\n{p.stderr}")
    return p.stdout


def _clean(value):
    """A field going into a pipe-delimited file may not contain a pipe or a
    newline. Nothing in F1DB does; fail loudly rather than corrupt a row."""
    if value is None:
        return ""
    s = str(value).strip()
    if "|" in s or "\n" in s:
        sys.exit(f"field contains a delimiter and cannot be stored: {s!r}")
    return s


def _listify(entry, single, plural, key):
    """F1DB writes one value as `chassisId: x` and several as a `chassis:`
    list of `- chassisId: x`. Return both shapes as a list, in file order."""
    out = []
    if entry.get(single):
        out.append(entry[single])
    for item in entry.get(plural) or []:
        if item.get(key):
            out.append(item[key])
    seen, uniq = set(), []
    for v in out:
        if v not in seen:
            seen.add(v)
            uniq.append(v)
    return uniq


def write(name, header_fields, rows, version, commit, check):
    path = os.path.join(HARVEST, name)
    body = HEADER.format(version=version, commit=commit, fields=header_fields)
    body += "".join(r + "\n" for r in rows)
    if check:
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        state = "unchanged" if old == body else "CHANGED"
        print(f"  {name:16s} {len(rows):5d} rows  {state}")
        return old == body
    with open(path, "w", encoding="utf-8") as f:
        f.write(body)
    print(f"  {name:16s} {len(rows):5d} rows written")
    return True


def chassis_rows(data, yaml):
    import glob
    rows = []
    for p in sorted(glob.glob(os.path.join(data, "chassis", "*.yml"))):
        d = yaml.safe_load(open(p, encoding="utf-8"))
        rows.append("|".join(_clean(d.get(k)) for k in
                             ("id", "constructorId", "name", "fullName")))
    return sorted(rows)


def engine_rows(data, yaml):
    import glob
    rows = []
    for p in sorted(glob.glob(os.path.join(data, "engines", "*.yml"))):
        d = yaml.safe_load(open(p, encoding="utf-8"))
        rows.append("|".join(_clean(d.get(k)) for k in
                             ("id", "engineManufacturerId", "name", "fullName",
                              "capacity", "configuration", "aspiration")))
    return sorted(rows)


def constructor_rows(data, yaml):
    """The constructor names, so the Wikipedia spec harvest can check an
    article's stated constructor against the one F1DB gives the chassis
    without a second network fetch."""
    import glob
    rows = []
    for p in sorted(glob.glob(os.path.join(data, "constructors", "*.yml"))):
        d = yaml.safe_load(open(p, encoding="utf-8"))
        rows.append("|".join(_clean(d.get(k)) for k in
                             ("id", "name", "fullName", "countryId")))
    return sorted(rows)


def country_rows(data, yaml):
    """Country ids to their names, so a constructor's country can be written
    the way this register writes it rather than title-cased from a slug.
    `united-states-of-america` is not "United States Of America"."""
    import glob
    rows = []
    for p in sorted(glob.glob(os.path.join(data, "countries", "*.yml"))):
        d = yaml.safe_load(open(p, encoding="utf-8"))
        rows.append("|".join(_clean(d.get(k)) for k in
                             ("id", "name", "alpha3Code", "demonym")))
    return sorted(rows)


def driver_rows(data, yaml):
    """The driver register: enough to resolve a race entry to an F1DB driver
    offline, and enough to describe one the register admits.

    This file never decides that a driver exists - data/drivers.py does that,
    one authored line at a time. It only supplies the spelling, the dates, the
    nationality and the rest of what F1DB holds about the ones already
    admitted.

    `permanentNumber` is set for 28 of the 917 drivers - the era that has
    them - and `placeOfBirth`, `countryOfBirthCountryId` and `abbreviation`
    for all of them. Two fields F1DB publishes are NOT here and cannot be:
    `bestStartingGridPosition` and `totalRaceLaps` are computed by F1DB's own
    Gradle build and appear only in its released artefacts, not in the source
    tree this reads (PD-45, #520)."""
    import glob
    rows = []
    for p in sorted(glob.glob(os.path.join(data, "drivers", "*.yml"))):
        d = yaml.safe_load(open(p, encoding="utf-8"))
        rows.append("|".join(_clean(d.get(k)) for k in
                             ("id", "name", "firstName", "lastName",
                              "dateOfBirth", "dateOfDeath", "abbreviation",
                              "nationalityCountryId", "placeOfBirth",
                              "countryOfBirthCountryId", "permanentNumber")))
    return sorted(rows)


def entrant_driver_rows(data, yaml):
    """One row per (season, entrant, constructor, engine manufacturer, driver).

    `rounds` is copied verbatim - "1-10", "1,4-5", "3" - and parsed in
    data/harvest.py, not here, so the file records exactly what the source
    says. A driver with no rounds is a test driver who did not enter a race;
    those rows are written with an empty rounds field and the build ignores
    them rather than assuming they raced everything."""
    import glob
    rows = []
    for p in sorted(glob.glob(os.path.join(data, "seasons", "*", "entrants.yml"))):
        year = int(os.path.basename(os.path.dirname(p)))
        for entrant in yaml.safe_load(open(p, encoding="utf-8")) or []:
            eid = entrant["entrantId"]
            for b in (entrant.get("constructors") or [entrant]):
                if not b.get("constructorId"):
                    continue
                drivers = b.get("drivers")
                if drivers is None and b.get("driverId"):
                    drivers = [{"driverId": b["driverId"],
                                "rounds": b.get("rounds")}]
                for d in drivers or []:
                    if not d.get("driverId"):
                        continue
                    rows.append("|".join([
                        str(year), _clean(eid), _clean(b["constructorId"]),
                        _clean(b.get("engineManufacturerId")),
                        _clean(d["driverId"]), _clean(d.get("rounds")),
                        "1" if d.get("testDriver") else "0",
                    ]))
    return rows


def entrant_rows(data, yaml):
    """One row per (year, entrant, constructor, engine manufacturer).

    The engine manufacturer is part of the grain, not decoration. Team Lotus
    in 1966 is one entrant with two constructor blocks, both `lotus`, one on
    Climax and one on BRM - a Lotus 33 and a Lotus 43. Collapsing them would
    merge two different cars into one row.

    Chassis, engines and tyres are '+'-joined where the source lists several,
    because the source does not say which went with which. Flattening them
    into separate rows would invent a pairing F1DB never claimed."""
    import glob
    rows = []
    for p in sorted(glob.glob(os.path.join(data, "seasons", "*", "entrants.yml"))):
        year = int(os.path.basename(os.path.dirname(p)))
        for entrant in yaml.safe_load(open(p, encoding="utf-8")) or []:
            eid = entrant["entrantId"]
            # An entrant can field cars from more than one constructor in a
            # season (Andy Granatelli, 1952: a Bromme and a Kurtis Kraft).
            blocks = entrant.get("constructors") or [entrant]
            for b in blocks:
                if not b.get("constructorId"):
                    continue
                rows.append("|".join([
                    str(year), _clean(eid), _clean(b["constructorId"]),
                    _clean(b.get("engineManufacturerId")),
                    "+".join(_clean(v) for v in
                             _listify(b, "chassisId", "chassis", "chassisId")),
                    "+".join(_clean(v) for v in
                             _listify(b, "engineId", "engines", "engineId")),
                    "+".join(_clean(v) for v in
                             _listify(b, "tyreManufacturerId",
                                      "tyreManufacturers", "tyreManufacturerId")),
                ]))
    return rows


# ---------------------------------------------------------------- results
#
# F1DB carries the full classification for all 1,161 races back to 1950, plus
# qualifying, the starting grid, per-round standings and pit stops. It is
# CC BY 4.0 - attribution only - which is what makes this different in kind
# from the same data via Jolpica: those rows are CC BY-NC-SA and cannot be
# committed, which is why known_gaps #2 existed for seven versions. These
# can.
#
# The two sources are kept side by side rather than one replacing the other.
# tools/ergast_load.py still runs, and where it disagrees the disagreement is
# recorded in `discrepancies` instead of one silently winning.

# F1DB writes a position as an integer when the driver was classified and as
# a code when they were not. Both are kept: `position` for ordering, and the
# code for what actually happened, because "did not qualify" and "retired on
# lap 3" are different facts and collapsing them loses the late-1980s story
# entirely - 1,041 DNQs and 338 failures to PRE-qualify.
POSITION_CODES = {"NC", "DNF", "DNQ", "DNPQ", "DNP", "DNS", "DSQ", "EX"}


def _races(data, yaml):
    """Yield (year, round, race_dir) for every race F1DB holds, in order."""
    seasons = os.path.join(data, "seasons")
    for year in sorted(os.listdir(seasons), key=lambda x: (not x.isdigit(), x)):
        rdir = os.path.join(seasons, year, "races")
        if not year.isdigit() or not os.path.isdir(rdir):
            continue
        for entry in sorted(os.listdir(rdir)):
            path = os.path.join(rdir, entry)
            if os.path.isdir(path) and entry.split("-")[0].isdigit():
                yield int(year), int(entry.split("-")[0]), path


def _load(path, yaml):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or []


def _pos(value):
    """(position, position_text). An integer position, or a code, never both."""
    if value is None:
        return "", ""
    if isinstance(value, int):
        return str(value), str(value)
    text = str(value).strip()
    if text.isdigit():
        return text, text
    if text not in POSITION_CODES:
        raise SystemExit(
            f"F1DB position {text!r} is not an integer and not one of "
            f"{sorted(POSITION_CODES)}. The vocabulary has changed; decide "
            f"what it means before storing it.")
    return "", text


def result_rows(data, yaml):
    rows = []
    for year, rnd, path in _races(data, yaml):
        results = _load(os.path.join(path, "race-results.yml"), yaml)
        # A shared drive is two rows with the same position AND the same car
        # number - Musso handing his Ferrari to Fangio at Buenos Aires in
        # 1956. Both drivers are credited, which is what the official record
        # does and what this database already held for the three cases it
        # knew about. Detecting it here means the flag travels with the row
        # rather than being rediscovered downstream.
        # A shared drive requires a CLASSIFIED position. Two drivers who
        # both failed to qualify under the same car number shared nothing -
        # they were entered in different sessions - and keying on the raw
        # position made 58 DNQ and DNS pairs look like shared drives,
        # including four after 1964, when the practice had ended.
        by_car = {}
        for r in results:
            if not isinstance(r.get("position"), int):
                continue
            key = (r["position"], r.get("driverNumber"))
            by_car[key] = by_car.get(key, 0) + 1
        for r in results:
            pos, text = _pos(r.get("position"))
            shared = by_car.get(
                (r.get("position"), r.get("driverNumber")), 0) > 1
            rows.append("|".join(_clean(v) for v in (
                year, rnd, pos, text,
                r.get("driverId"), r.get("constructorId"),
                r.get("engineManufacturerId"), r.get("tyreManufacturerId"),
                r.get("driverNumber"), r.get("laps"), r.get("time"),
                r.get("timePenalty"), r.get("gap"), r.get("interval"),
                r.get("reasonRetired"), r.get("points"),
                r.get("gridPosition"), 1 if shared else 0)))
    return rows


def race_date_rows(data, yaml):
    """The date each race was held.

    F1DB carries a date for every one of its 1,172 races, back to Silverstone
    on 1950-05-13. This database held 23, all of them in the 2020s, for a
    structural reason rather than a factual one: the date lives in the round's
    own race.yml, and result_rows() only ever opened race-results.yml beside
    it. The file was there the whole time and nothing read it.

    The gap was visible on every prerendered race page as "Dates -", and it
    kept startDate out of the SportsEvent JSON-LD, which is the one field a
    search engine most wants from an event.
    """
    rows = []
    for year, rnd, path in _races(data, yaml):
        race = _load(os.path.join(path, "race.yml"), yaml)
        if not isinstance(race, dict) or not race.get("date"):
            continue
        rows.append("|".join(_clean(v) for v in (year, rnd, race["date"])))
    return rows


def circuit_outline_rows(root, data, yaml):
    """One row per F1DB circuit layout, carrying the drawing of it.

    A layout without an SVG, or an SVG with anything but one <path>, or path
    data holding a character outside SVG path syntax, stops the fetch: the
    shape of F1DB's assets has changed and somebody should look before it is
    stored. The path is written into an attribute on every page that draws
    it, which is why the syntax check is here and again in build.py.

    The path is stored bare, so a transform on the <path> element has to be
    applied to it or the drawing is lost: ain-diab-1.svg alone of the 160
    positions its path with translate(-1074.322 -900.61), and stored as
    written it rendered as an empty figure (PR #273's review). A translate is
    applied here; any other transform stops the fetch. Then every outline
    must lie inside the 500-unit box, which is what the translate was for.
    """
    circuits = os.path.join(data, "circuits")
    assets = os.path.join(root, "src", "assets", "circuits", "black")
    rows = []
    for name in sorted(os.listdir(circuits)):
        if not name.endswith(".yml"):
            continue
        with open(os.path.join(circuits, name), encoding="utf-8") as f:
            circuit = yaml.safe_load(f)
        for layout in circuit.get("layouts") or []:
            svg_path = os.path.join(assets, f"{layout['id']}.svg")
            if not os.path.isfile(svg_path):
                sys.exit(f"F1DB layout {layout['id']} ({circuit['id']}) has no SVG at "
                         f"{svg_path}; the assets have moved or the layout is new")
            with open(svg_path, encoding="utf-8") as f:
                svg = f.read()
            elements = re.findall(r'<path\b[^>]*>', svg)
            if len(elements) != 1:
                sys.exit(f"{svg_path} has {len(elements)} <path> elements, not one; the "
                         f"shape of F1DB's circuit assets has changed")
            d = re.search(r'\sd="([^"]+)"', elements[0])
            if not d:
                sys.exit(f"{svg_path}: the <path> has no d attribute")
            path_d = " ".join(d.group(1).split())
            transform = re.search(r'\stransform="([^"]*)"', elements[0])
            if transform:
                t = re.fullmatch(r"\s*translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)\s*",
                                 transform.group(1))
                if not t:
                    sys.exit(f"{svg_path}: the <path> carries transform="
                             f"\"{transform.group(1)}\", which is not a translate; "
                             f"look at the asset before it is stored")
                path_d = svg_path_translate(path_d, float(t.group(1)), float(t.group(2)))
            if not re.fullmatch(SVG_PATH_DATA, path_d):
                sys.exit(f"{svg_path}: the path data holds a character outside SVG "
                         f"path syntax and will not be stored")
            if not svg_path_in_box(path_d):
                sys.exit(f"{svg_path}: the path lies outside the 500-unit box and would "
                         f"draw an empty figure; look at the asset before it is stored")
            rows.append("|".join(_clean(v) for v in (
                layout["id"], circuit["id"], layout.get("length"), layout.get("turns"),
                path_d)))
    return rows


def race_layout_rows(data, yaml):
    """The F1DB layout each race ran: `circuitLayoutId` in the round's race.yml."""
    rows = []
    for year, rnd, path in _races(data, yaml):
        race = _load(os.path.join(path, "race.yml"), yaml)
        if not isinstance(race, dict) or not race.get("circuitLayoutId"):
            continue
        rows.append("|".join(_clean(v) for v in (year, rnd, race["circuitLayoutId"])))
    return rows


def fastest_lap_rows(data, yaml):
    """Who set the fastest lap of each race, on which lap, and in what time.

    race_entries.fastest_lap comes only from the hand-written
    harvest/poles.txt, while everything else about a completed race refreshes
    from F1DB on a schedule. So for a week after every Grand Prix the fastest
    lap is blank on a race that is otherwise complete - exactly the hole that
    grid 1 used to have, and no longer does.

    F1DB shapes fastest-laps.yml as a classification, so the fastest lap of
    the race is the row at position 1; the rest order the field behind it and
    are not this database's concern. build.py fills only where the harvest is
    silent, and records a discrepancy where the two disagree.

    Eleven races have no such file, and all eleven are correct: 2021 Belgium,
    where no racing lap was ever set and the null is declared in known_gaps,
    and the ten 2026 rounds that have not been run.
    """
    rows = []
    for year, rnd, path in _races(data, yaml):
        for r in _load(os.path.join(path, "fastest-laps.yml"), yaml):
            if r.get("position") != 1:
                continue
            rows.append("|".join(_clean(v) for v in (
                year, rnd, r.get("driverId"), r.get("constructorId"),
                r.get("lap"), r.get("time"))))
            break
    return rows


def sprint_result_rows(data, yaml):
    """The sprint race classification, for the rounds that had one.

    A sprint is a separate race on the same weekend, with its own grid, its
    own classification and its own points, and those points count towards the
    championship. It is not a session of the grand prix, so it is not a column
    on the grand prix result — it is its own set of rows, keyed on the round
    that held it.

    F1DB shapes sprint-race-results.yml exactly like race-results.yml, minus
    the shared-drive problem: sprints began in 2021 and nobody has ever handed
    a sprint car over mid-race, so there is no flag to derive here.

    Sprint qualifying and the sprint grid are held separately by F1DB and are
    not taken: the grid position each driver started the sprint from already
    travels on these rows, which is the part the classification needs to make
    sense.
    """
    rows = []
    for year, rnd, path in _races(data, yaml):
        for r in _load(os.path.join(path, "sprint-race-results.yml"), yaml):
            pos, text = _pos(r.get("position"))
            rows.append("|".join(_clean(v) for v in (
                year, rnd, pos, text,
                r.get("driverId"), r.get("constructorId"),
                r.get("engineManufacturerId"), r.get("tyreManufacturerId"),
                r.get("driverNumber"), r.get("laps"), r.get("time"),
                r.get("timePenalty"), r.get("gap"), r.get("interval"),
                r.get("reasonRetired"), r.get("points"),
                r.get("gridPosition"))))
    return rows


def qualifying_rows(data, yaml):
    rows = []
    for year, rnd, path in _races(data, yaml):
        for r in _load(os.path.join(path, "qualifying-results.yml"), yaml):
            pos, text = _pos(r.get("position"))
            rows.append("|".join(_clean(v) for v in (
                year, rnd, pos, text,
                r.get("driverId"), r.get("constructorId"),
                r.get("driverNumber"),
                # Pre-1996 qualifying is one time; the knockout era is three
                # segments and no single time. Both shapes are written and
                # the empty ones stay empty rather than being back-filled
                # from whichever segment happens to be fastest.
                r.get("time"), r.get("q1"), r.get("q2"), r.get("q3"),
                r.get("gap"), r.get("interval"), r.get("laps"))))
    return rows


def standings_rows(data, yaml):
    """Championship standings after every round, and at the end of a season.

    The constructors' championship is awarded to a CHASSIS-ENGINE
    combination, not to a chassis maker. In 1960 that is seven entries for
    five constructors: Cooper-Climax won it with 48 points while
    Cooper-Maserati and Cooper-Castellotti tied for fifth on 3. Keying these
    rows on the constructor alone silently collapses them and hands Cooper
    the wrong total.

    after_round is empty for the end-of-season row. That is not the same as
    "after the last round": a season's final classification is the thing the
    title is awarded on, and before 1991 it was the best N results rather
    than the running total, so the two can differ.
    """
    rows = []
    for year, rnd, path in _races(data, yaml):
        for who, fname, key in (
                ("drivers", "driver-standings.yml", "driverId"),
                ("constructors", "constructor-standings.yml", "constructorId")):
            for r in _load(os.path.join(path, fname), yaml):
                rows.append("|".join(_clean(v) for v in (
                    year, rnd, who, r.get("position"), r.get(key),
                    r.get("engineManufacturerId"), r.get("points"))))
    seasons = os.path.join(data, "seasons")
    for year in sorted(os.listdir(seasons)):
        if not year.isdigit():
            continue
        for who, fname, key in (
                ("drivers", "driver-standings.yml", "driverId"),
                ("constructors", "constructor-standings.yml", "constructorId")):
            for r in _load(os.path.join(seasons, year, fname), yaml):
                rows.append("|".join(_clean(v) for v in (
                    year, "", who, r.get("position"), r.get(key),
                    r.get("engineManufacturerId"), r.get("points"))))
    return rows


def pit_stop_rows(data, yaml):
    rows = []
    for year, rnd, path in _races(data, yaml):
        for r in _load(os.path.join(path, "pit-stops.yml"), yaml):
            rows.append("|".join(_clean(v) for v in (
                year, rnd, r.get("driverId"), r.get("stop"), r.get("lap"),
                r.get("time"), r.get("timeMillis"))))
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", help="an existing F1DB checkout to read instead "
                                     "of cloning")
    ap.add_argument("--check", action="store_true",
                    help="regenerate in memory and report whether the committed "
                         "files still match; write nothing")
    args = ap.parse_args()

    yaml = _yaml()
    path, version, commit = checkout(args.source)
    licence_file = licence_check(path)
    data = os.path.join(path, "src", "data")
    print(f"F1DB {version} ({commit}) from {path}; {licence_file} is {LICENCE}")

    ok = True
    ok &= write("chassis.txt", "chassis_id|constructor_id|name|full_name",
                chassis_rows(data, yaml), version, commit, args.check)
    ok &= write("engines.txt",
                "engine_id|manufacturer_id|name|full_name|capacity_l|"
                "configuration|aspiration",
                engine_rows(data, yaml), version, commit, args.check)
    ok &= write("f1db_constructors.txt",
                "constructor_id|name|full_name|country_id",
                constructor_rows(data, yaml), version, commit, args.check)
    ok &= write("f1db_countries.txt",
                "country_id|name|alpha3|demonym",
                country_rows(data, yaml), version, commit, args.check)
    ok &= write("f1db_drivers.txt",
                "driver_id|name|first_name|last_name|date_of_birth|"
                "date_of_death|abbreviation|nationality_country_id|"
                "place_of_birth|country_of_birth_country_id|permanent_number",
                driver_rows(data, yaml), version, commit, args.check)
    ok &= write("entrants.txt",
                "year|entrant_id|constructor_id|engine_manufacturer_id|"
                "chassis_ids|engine_ids|tyre_ids"
                "   ('+' separates values the source does not disambiguate)",
                entrant_rows(data, yaml), version, commit, args.check)
    ok &= write("entrant_drivers.txt",
                "year|entrant_id|constructor_id|engine_manufacturer_id|"
                "driver_id|rounds|test_driver"
                "   (rounds is verbatim: '1-10', '1,4-5'; empty = did not race)",
                entrant_driver_rows(data, yaml), version, commit, args.check)

    # The full classification and everything derived from a session. These are
    # large files and they are committed on purpose: CC BY 4.0 has no
    # non-commercial clause, so unlike the same data from Jolpica they belong
    # in the repository rather than only on a local copy.
    ok &= write("race_results.txt",
                "year|round|position|position_text|driver_id|constructor_id|"
                "engine_manufacturer_id|tyre_manufacturer_id|driver_number|"
                "laps|time|time_penalty|gap|interval|reason_retired|points|"
                "grid|shared_drive",
                result_rows(data, yaml), version, commit, args.check)
    ok &= write("sprint_results.txt",
                "year|round|position|position_text|driver_id|constructor_id|"
                "engine_manufacturer_id|tyre_manufacturer_id|driver_number|"
                "laps|time|time_penalty|gap|interval|reason_retired|points|"
                "grid",
                sprint_result_rows(data, yaml), version, commit, args.check)
    ok &= write("qualifying.txt",
                "year|round|position|position_text|driver_id|constructor_id|"
                "driver_number|time|q1|q2|q3|gap|interval|laps",
                qualifying_rows(data, yaml), version, commit, args.check)
    ok &= write("standings.txt",
                "year|round|table_type|position|entity_id|"
                "engine_manufacturer_id|points"
                "   (round empty = the end-of-season classification; the "
                "constructors' championship is by CHASSIS-ENGINE, so "
                "Cooper-Climax and Cooper-Maserati are separate entries)",
                standings_rows(data, yaml), version, commit, args.check)
    ok &= write("f1db_pit_stops.txt",
                "year|round|driver_id|stop|lap|time|time_millis",
                pit_stop_rows(data, yaml), version, commit, args.check)
    ok &= write("race_dates.txt",
                "year|round|date   (ISO 8601, the day the race was held)",
                race_date_rows(data, yaml), version, commit, args.check)
    ok &= write("fastest_laps.txt",
                "year|round|driver_id|constructor_id|lap|time"
                "   (the fastest lap OF THE RACE, F1DB position 1)",
                fastest_lap_rows(data, yaml), version, commit, args.check)
    # The drawing of every layout, and the layout each race ran. CC BY 4.0
    # like the rest, so the paths live in f1.db - unlike the ODbL traces.
    ok &= write("circuit_outlines.txt",
                "layout_id|circuit_id|length_km|turns|path"
                "   (F1DB's ids and figures; path is SVG path data in a 500x500 "
                "box, drawn by Jules Roy; a translate() on the asset's <path> is "
                "applied to the path, and nothing else is changed)",
                circuit_outline_rows(path, data, yaml), version, commit, args.check)
    ok &= write("race_layouts.txt",
                "year|round|layout_id   (the F1DB circuit layout the race ran)",
                race_layout_rows(data, yaml), version, commit, args.check)

    if args.check and not ok:
        sys.exit("the committed harvest files are out of date with F1DB")


if __name__ == "__main__":
    main()
