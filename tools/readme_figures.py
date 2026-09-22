#!/usr/bin/env python3
"""
Every number the documents in DOCUMENTS state about the CURRENT database,
computed from it: README.md, and docs/COMMERCIAL-READINESS.md, the licence
statement (PM-31).

The README said 39 tables, 34 views and about 8,400 rows against an actual
46, 39 and 119,265, and that qualifying was "not held at all" while 26,997
rows of it were. Nothing checked the prose, so it stayed wrong through seven
releases while `meta.coverage_note` two files over was derived on every build
and compared whole by verify.py. This gives the README the same discipline;
the licence statement got it after its class table said 539 facts-only rows
against 552 held.

A figure is a name and one expression. A document marks where each one lands:

    <!-- fig:tables -->46<!-- /fig -->

    python3 tools/readme_figures.py            print every figure and its value
    python3 tools/readme_figures.py --check    exit 1 where a document disagrees
    python3 tools/readme_figures.py --write    rewrite the spans in place

`make all` runs --write after the build; verify.py runs the check on every
run, so a data change that moves a count fails CI until the README is
regenerated. A figure that is not in FIGURES is in no document: prose that
cannot be derived from f1.db, f1-geometry.db or the code is deleted rather
than left to drift.

Numbers are formatted the way the README already writes them - thousands
separated with a comma, percentages as a whole number. Nothing here writes to
a database.
"""
import os
import re
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "f1.db")
GEOMETRY_DB = os.path.join(ROOT, "f1-geometry.db")
README = os.path.join(ROOT, "README.md")
# Every document whose figures are spans this tool writes and verify.py
# checks. docs/COMMERCIAL-READINESS.md typed its class table and per-table
# breakdown by hand and drifted, 539 stated against 552 held (PM-31).
DOCUMENTS = (README, os.path.join(ROOT, "docs", "COMMERCIAL-READINESS.md"))

# <!-- fig:name -->value<!-- /fig -->. The value may run over a line break -
# the centreline table is one figure - so DOTALL, and non-greedy so two spans
# on a line stay two spans.
SPAN = re.compile(r"<!-- fig:([a-z0-9_]+) -->(.*?)<!-- /fig -->", re.DOTALL)


def n(value):
    return f"{value:,}"


def pct(part, whole):
    return f"{round(100 * part / whole)}%"


class Figures:
    """One method per figure, in README order. `con` has the geometry table
    reachable as `self.geo`, whether merged into f1.db or attached."""

    def __init__(self, con, geo="circuit_geometry"):
        self.con = con
        self.geo = geo

    def one(self, sql, *args):
        return self.con.execute(sql, args).fetchone()[0]

    def count(self, table, where=""):
        return self.one(f"SELECT COUNT(*) FROM {table}" + (f" WHERE {where}" if where else ""))

    def meta(self, key):
        return self.one("SELECT value FROM meta WHERE key = ?", key)

    # -- the header and the footer of the quick start --------------------------

    def version(self):
        return self.meta("version")

    def built(self):
        return self.meta("built")

    def verified_on(self):
        return self.meta("verification_date")

    def f1db_version(self):
        # The register's own header line, written by tools/f1db_fetch.py; the
        # build reads the same file, so this is what the database was built from.
        with open(os.path.join(ROOT, "harvest", "chassis.txt"), encoding="utf-8") as f:
            for line in f:
                m = re.search(r"F1DB (v[\d.]+)", line)
                if m:
                    return m.group(1)
                if not line.startswith("#"):
                    break
        raise SystemExit("harvest/chassis.txt does not name the F1DB version it came from")

    # -- Files ----------------------------------------------------------------

    def tables(self):
        return n(self.one("""SELECT COUNT(*) FROM sqlite_master
                             WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"""))

    def views(self):
        return n(self.one("SELECT COUNT(*) FROM sqlite_master WHERE type = 'view'"))

    def rows(self):
        names = [r[0] for r in self.con.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")]
        return n(sum(self.count(t) for t in names))

    def stages(self):
        sys.path.insert(0, ROOT)
        import build  # noqa: E402 - the schedule is the source of this number
        return n(len(build.STAGES))

    # -- Identifiers ------------------------------------------------------------

    def _id_policy(self):
        """(every surrogate-id table, the stable ones, table -> natural key),
        all of it read out of the database: the tables off the schema, the
        policy off `meta`. Nothing here restates the declaration in
        data/current.py — verify.py is what holds those two together."""
        sys.path.insert(0, ROOT)
        import build  # noqa: E402 - the schema is what says which ids are surrogates
        stable = set(self.meta("id_stability_stable").split(", "))
        keys = {}
        for part in self.meta("id_stability_keys").split("; "):
            table, columns = part.split("(", 1)
            keys[table] = columns.rstrip(")")
        return sorted(build.surrogate_id_tables(self.con)), stable, keys

    def stable_id_tables(self):
        return n(len(self._id_policy()[1]))

    def id_keys(self):
        # A whole table, header included, so the span can sit on lines of its
        # own: an HTML comment on the same line as a table row is where GitHub
        # stops rendering the table.
        tables, stable, keys = self._id_policy()
        rows = [f"| `{t}` | {'stable' if t in stable else 'unstable'} | "
                f"{'`(' + keys[t] + ')`' if t in keys else '—'} |"
                for t in tables]
        return "\n".join(["", "| Table | `id` | Natural key |", "|---|---|---|"]
                          + rows) + "\n"

    # -- What's in it -----------------------------------------------------------

    def seasons(self):
        return n(self.count("seasons"))

    def season_span(self):
        lo, hi = self.con.execute("SELECT MIN(year), MAX(year) FROM seasons").fetchone()
        return f"{lo}–{hi}"

    def races(self):
        return n(self.count("races"))

    def races_run(self):
        return n(self.count("races", "status = 'completed'"))

    def first_race(self):
        y, name = self.con.execute(
            "SELECT year, name_used FROM races ORDER BY year, round LIMIT 1").fetchone()
        return f"{y} {name}"

    def last_race(self):
        y, name = self.con.execute("""SELECT year, name_used FROM races
            WHERE status = 'completed' ORDER BY year DESC, round DESC LIMIT 1""").fetchone()
        return f"{y} {name}"

    def races_without_fastest_lap(self):
        return n(self.one("""SELECT COUNT(*) FROM races r WHERE status = 'completed'
            AND NOT EXISTS (SELECT 1 FROM race_entries e
                            WHERE e.race_id = r.id AND e.fastest_lap = 1)"""))

    def indy(self):
        return n(self.count("races", "gp_id LIKE '%indianapolis%'"))

    def drivers(self):
        return n(self.count("drivers"))

    def constructors(self):
        return n(self.count("constructors"))

    def lineage_chains(self):
        return n(self.one("SELECT COUNT(DISTINCT chain_id) FROM constructor_lineage"))

    def circuits(self):
        return n(self.count("circuits"))

    def circuits_raced(self):
        return n(self.one("SELECT COUNT(DISTINCT circuit_id) FROM races"))

    def layout_circuits(self):
        return n(self.one("SELECT COUNT(DISTINCT circuit_id) FROM circuit_layouts WHERE by_year = 1"))

    def circuit_outlines(self):
        return n(self.count("circuit_outlines"))

    def outline_circuits(self):
        return n(self.one("SELECT COUNT(DISTINCT circuit_id) FROM circuit_outlines"))

    def cars(self):
        return n(self.count("cars"))

    def chassis(self):
        return n(self.count("chassis"))

    def regulation_changes(self):
        return n(self.count("regulation_changes"))

    def innovations(self):
        return n(self.count("technical_innovations"))

    def engine_eras(self):
        return n(self.count("engine_eras"))

    def safety_milestones(self):
        return n(self.count("safety_milestones"))

    def eras(self):
        return n(self.count("eras"))

    def points_systems(self):
        return n(self.count("points_systems"))

    def personnel(self):
        return n(self.count("personnel"))

    def records(self):
        return n(self.count("records"))

    def glossary(self):
        return n(self.count("glossary"))

    def governance(self):
        return n(self.count("governance"))

    def race_entries(self):
        return n(self.count("race_entries"))

    def qualifying(self):
        return n(self.count("qualifying"))

    def standings(self):
        return n(self.count("standings"))

    def sprint_results(self):
        return n(self.count("sprint_results"))

    def sprint_races(self):
        return n(self.one("SELECT COUNT(DISTINCT race_id) FROM sprint_results"))

    def pit_stops(self):
        return n(self.count("pit_stops"))

    def season_entries(self):
        return n(self.count("season_entries"))

    def season_entries_year(self):
        lo, hi = self.con.execute("SELECT MIN(year), MAX(year) FROM season_entries").fetchone()
        return str(lo) if lo == hi else f"{lo}–{hi}"

    # -- Structure -------------------------------------------------------------

    def grands_prix(self):
        return n(self.count("grands_prix"))

    def race_name_strings(self):
        return n(self.one("SELECT COUNT(DISTINCT name_used) FROM races"))

    # -- Venues ----------------------------------------------------------------

    def as_raced(self):
        return n(self.count("v_race_venues", "figures = 'as raced'"))

    def as_raced_pct(self):
        return pct(self.count("v_race_venues", "figures = 'as raced'"), self.count("races"))

    # -- Cars and chassis -------------------------------------------------------

    def chassis_with_spec(self):
        return n(self.count("chassis", "spec_source IS NOT NULL"))

    def chassis_published_wins(self):
        return n(self.count("chassis", "published_wins IS NOT NULL"))

    def chassis_wins_match(self):
        return n(self.count("chassis", "published_wins IS NOT NULL AND wins = published_wins"))

    def chassis_wins_exceed(self):
        return n(self.count("chassis", "published_wins IS NOT NULL AND wins > published_wins"))

    def cars_checked(self):
        return n(self._car_linkage()[0])

    def cars_fully_linked(self):
        return n(self._car_linkage()[1])

    def _car_linkage(self):
        # The same terms verify.py applies: a car is fully linked when every
        # season it raced is corroborated by the entry lists, and only then
        # must its derived wins EQUAL the published figure.
        sys.path.insert(0, ROOT)
        from data import cars as CR
        corroborated = {(r[0], r[1]) for r in self.con.execute(
            "SELECT car_id, year FROM car_seasons WHERE corroborated = 1")}
        checked = complete = 0
        for cid, (ew, _ep) in CR.EXPECTED.items():
            row = self.con.execute("SELECT from_year, to_year FROM cars WHERE id = ?",
                                   (cid,)).fetchone()
            if row is None or ew is None:
                continue
            checked += 1
            if CR.seasons_complete(cid, row[0], row[1], corroborated):
                complete += 1
        return checked, complete

    def races_with_winning_chassis(self):
        return n(self.one("""SELECT COUNT(DISTINCT race_id) FROM race_entries
                             WHERE finish_position = 1 AND chassis_id IS NOT NULL"""))

    def _linked_in_decade(self, decade):
        linked, total = self.con.execute("""
            SELECT SUM(e.chassis_id IS NOT NULL), COUNT(*)
            FROM race_entries e JOIN races r ON r.id = e.race_id
            WHERE r.year / 10 * 10 = ?""", (decade,)).fetchone()
        return pct(linked, total)

    def linked_1950s(self):
        return self._linked_in_decade(1950)

    def linked_1960s(self):
        return self._linked_in_decade(1960)

    def linked_1970s(self):
        return self._linked_in_decade(1970)

    def linked_1980s(self):
        return self._linked_in_decade(1980)

    def linked_1990s(self):
        return self._linked_in_decade(1990)

    def linked_2000s(self):
        return self._linked_in_decade(2000)

    def linked_2010s(self):
        return self._linked_in_decade(2010)

    def linked_2020s(self):
        return self._linked_in_decade(2020)

    def ambiguous_seasons(self):
        return n(self.count("v_ambiguous_seasons"))

    def poles(self):
        return n(self.one("SELECT COUNT(DISTINCT race_id) FROM race_entries WHERE pole = 1"))

    def poles_without_constructor(self):
        return n(self.count("race_entries", "pole = 1 AND constructor_id IS NULL"))

    def entries_with_car(self):
        return n(self.count("race_entries", "car_id IS NOT NULL"))

    # -- Illustration -------------------------------------------------------------

    # The article route. The category route (AF-42) is counted on its own:
    # its rows make a weaker claim and the README says so separately.
    def images(self):
        return n(self.count("article_images", "route = 'article'"))

    def image_licences(self):
        return n(self.one("SELECT COUNT(DISTINCT licence) FROM article_images "
                          "WHERE route = 'article'"))

    def images_named(self):
        return n(self.count("article_images",
                            "route = 'article' AND name_matches = 1"))

    def images_unnamed(self):
        return n(self.count("article_images",
                            "route = 'article' AND name_matches = 0"))

    def images_catalogued(self):
        return n(self.count("article_images", "route = 'category'"))

    def chassis_without_article(self):
        return n(self.count("chassis", "article IS NULL"))

    def centrelines(self):
        return n(self.count(self.geo))

    def centrelines_closed(self):
        return n(self.count(self.geo, "closes = 1"))

    def open_centrelines(self):
        # A whole table, header included, so the span can sit on lines of its
        # own: an HTML comment on the same line as a table row is where GitHub
        # stops rendering the table.
        rows = self.con.execute(f"""SELECT circuit_id, loose_ends, segment_count
            FROM {self.geo} WHERE closes = 0 ORDER BY circuit_id""").fetchall()
        return "\n".join(["", "| Circuit | Loose ends | Ways in the relation |", "|---|---|---|"]
                         + [f"| `{cid}` | {le} | {seg} |" for cid, le, seg in rows]) + "\n"

    # -- Timing -------------------------------------------------------------------

    def notable_radio(self):
        return n(self.count("team_radio", "notable = 1"))

    # -- The finishing order --------------------------------------------------------

    def races_classified(self):
        return n(self.one("""SELECT COUNT(DISTINCT race_id) FROM race_entries
                             WHERE finish_position IS NOT NULL"""))

    def podiums_compared(self):
        return n(self.count("drivers", "podiums_external IS NOT NULL"))

    def podiums_match(self):
        return n(self.count("drivers", "podiums_external IS NOT NULL AND podiums = podiums_external"))

    def _status(self, text):
        return n(self.one("SELECT COUNT(*) FROM race_entries WHERE position_text = ?", text))

    def dnf(self):
        return self._status("DNF")

    def dnq(self):
        return self._status("DNQ")

    def dnpq(self):
        return self._status("DNPQ")

    def dns(self):
        return self._status("DNS")

    def dsq(self):
        return self._status("DSQ")

    # -- The confidence model -------------------------------------------------------

    def drivers_with_external(self):
        return n(self.count("drivers", """wins_external IS NOT NULL OR poles_external IS NOT NULL
                                          OR fastest_laps_external IS NOT NULL"""))

    def external_comparisons(self):
        return n(self.one("""SELECT SUM((wins_external IS NOT NULL) + (poles_external IS NOT NULL)
                                        + (fastest_laps_external IS NOT NULL)) FROM drivers"""))

    def external_differences(self):
        return n(self.count("drivers", """
            (wins_external IS NOT NULL AND wins != wins_external)
            OR (poles_external IS NOT NULL AND poles != poles_external)
            OR (fastest_laps_external IS NOT NULL AND fastest_laps != fastest_laps_external)"""))

    def discrepancies(self):
        return n(self.count("discrepancies"))

    def discrepancies_open(self):
        return n(self.count("discrepancies", "status LIKE 'open%'"))

    def discrepancies_explained(self):
        return n(self.count("discrepancies", "status LIKE 'explained%'"))

    # -- What it deliberately doesn't have ----------------------------------------------

    def known_gaps(self):
        return n(self.count("known_gaps"))

    def known_gaps_open(self):
        # The same view the homepage and /data count, so the three agree.
        return n(self.count("v_open_gaps"))

    # -- docs/COMMERCIAL-READINESS.md: the licence position, counted -------
    def _licence_tally(self):
        """(class -> rows, domain -> rows, (table, domain) -> rows) over every
        sourced row, resolving each source URL to a registry domain the way
        `./f1 licences` does; source_registry's own rows are not citations."""
        if hasattr(self, "_tally"):
            return self._tally
        classes = {}
        for domains, cls in self.con.execute("""SELECT domains, redistributable
                FROM source_registry WHERE domains IS NOT NULL ORDER BY priority"""):
            for d in (x.strip() for x in domains.split(",")):
                if d:
                    classes.setdefault(d, cls)

        def klass(value):
            m = re.match(r"https?://([^/]+)", str(value).strip())
            key = (m.group(1) if m else str(value).strip()).lower()
            if key in classes:
                return key
            return next((d for d in classes if key.endswith("." + d)), None)

        by_class, by_domain, by_table = {}, {}, {}
        for (t,) in self.con.execute("""SELECT name FROM sqlite_master WHERE type='table'
                AND name <> 'source_registry' ORDER BY name"""):
            cols = [x[1] for x in self.con.execute(f'PRAGMA table_info("{t}")')]
            if "source" not in cols:
                continue
            for value, k in self.con.execute(f'SELECT source, COUNT(*) FROM "{t}" WHERE '
                                             "source IS NOT NULL AND TRIM(source) <> '' "
                                             "GROUP BY source"):
                d = klass(value)
                cls = classes.get(d, "UNCLASSIFIED")
                by_class[cls] = by_class.get(cls, 0) + k
                by_domain[d] = by_domain.get(d, 0) + k
                if cls == "facts-only":
                    by_table[(t, d)] = by_table.get((t, d), 0) + k
        self._tally = (by_class, by_domain, by_table)
        return self._tally

    def sourced_rows(self):
        return n(sum(self._licence_tally()[0].values()))

    def yes_rows(self):
        return n(self._licence_tally()[0].get("yes", 0))

    def yes_share(self):
        by_class = self._licence_tally()[0]
        return f"{100.0 * by_class.get('yes', 0) / sum(by_class.values()):.1f}%"

    def facts_only_rows(self):
        return n(self._licence_tally()[0].get("facts-only", 0))

    def facts_only_share(self):
        by_class = self._licence_tally()[0]
        return f"{100.0 * by_class.get('facts-only', 0) / sum(by_class.values()):.1f}%"

    def no_rows(self):
        return n(self._licence_tally()[0].get("no", 0))

    def facts_only_formula1(self):
        return n(self._licence_tally()[1].get("formula1.com", 0))

    def facts_only_fia(self):
        return n(self._licence_tally()[1].get("fia.com", 0))

    # The tables the licence statement itemises, one fo_ figure each. The
    # writer refuses a facts-only row in any other table: the statement
    # claims every such row was read, and a figure that rewrote itself to
    # cover an unread table would assert that on nobody's behalf.
    ITEMISED = ("drivers", "circuits", "seasons", "standings", "constructors",
                "races", "race_entries", "regulation_changes", "regulation_limits",
                "sessions")

    def facts_only_tables(self):
        held = {t for t, _ in self._licence_tally()[2]}
        extra = sorted(held - set(self.ITEMISED))
        if extra:
            raise SystemExit(
                f"facts-only rows in {', '.join(extra)}, which "
                f"docs/COMMERCIAL-READINESS.md does not itemise: read the rows, "
                f"add a line to the breakdown and an fo_ figure to Figures.ITEMISED "
                f"before writing the figures")
        return n(len(held))

    def fo_current_season_rows(self):
        # races + race_entries + standings for the seasons formula1.com is
        # read for - 2025-26, plus the races of any calendar announced and
        # not yet run - the rows that look redundant beside F1DB and are not.
        return n(sum(int(self._fo(t).replace(",", "")) for t in ("races", "race_entries", "standings")))

    def no_share(self):
        by_class = self._licence_tally()[0]
        return f"{100.0 * by_class.get('no', 0) / sum(by_class.values()):.1f}%"

    def _fo(self, table):
        return n(sum(k for (t, _), k in self._licence_tally()[2].items() if t == table))

    def fo_drivers(self):            return self._fo("drivers")
    def fo_circuits(self):           return self._fo("circuits")
    def fo_seasons(self):            return self._fo("seasons")
    def fo_standings(self):          return self._fo("standings")
    def fo_constructors(self):       return self._fo("constructors")
    def fo_races(self):              return self._fo("races")
    def fo_race_entries(self):       return self._fo("race_entries")
    def fo_regulation_changes(self): return self._fo("regulation_changes")
    def fo_regulation_limits(self):  return self._fo("regulation_limits")
    def fo_sessions(self):           return self._fo("sessions")


# Public names, in definition order - which is README order, so the printout
# reads like the document.
NAMES = [name for name in Figures.__dict__
         if not name.startswith("_") and name not in ("one", "count", "meta")
         and callable(getattr(Figures, name))]


def compute(con, geo="circuit_geometry"):
    figs = Figures(con, geo)
    return {name: str(getattr(figs, name)()) for name in NAMES}


def stated(text):
    """name -> value as the README currently prints it. Raises on a name
    stated twice with two different values, which is the drift this exists
    to stop."""
    out = {}
    for name, value in SPAN.findall(text):
        if name in out and out[name] != value:
            raise ValueError(f"fig:{name} is stated twice with different values: "
                             f"{out[name]!r} and {value!r}")
        out[name] = value
    return out


def render(text, values):
    def sub(m):
        name = m.group(1)
        if name not in values:
            raise KeyError(name)
        return f"<!-- fig:{name} -->{values[name]}<!-- /fig -->"
    return SPAN.sub(sub, text)


def compare(text, values):
    """(unknown names in the README, figures never used, name -> (stated, actual)
    for every span whose value differs)."""
    said = stated(text)
    unknown = sorted(set(said) - set(values))
    unused = sorted(set(values) - set(said))
    wrong = {k: (said[k], values[k]) for k in said if k in values and said[k] != values[k]}
    return unknown, unused, wrong


def connect(db=DB):
    con = sqlite3.connect(db)
    geo = "circuit_geometry"
    geo_db = os.path.join(os.path.dirname(os.path.abspath(db)), "f1-geometry.db")
    if os.path.exists(geo_db) and not con.execute(
            "SELECT COUNT(*) FROM circuit_geometry").fetchone()[0]:
        con.execute("ATTACH DATABASE ? AS geo", (geo_db,))
        geo = "geo.circuit_geometry"
    return con, geo


def main(argv):
    con, geo = connect()
    values = compute(con, geo)
    texts = {}
    for path in DOCUMENTS:
        with open(path, encoding="utf-8") as f:
            texts[path] = f.read()
    label = lambda path: os.path.relpath(path, ROOT)

    if "--write" in argv:
        for path, text in texts.items():
            unknown, _unused, _wrong = compare(text, values)
            if unknown:
                print(f"{label(path)} names figures this tool does not compute: {', '.join(unknown)}",
                      file=sys.stderr)
                return 1
            new = render(text, values)
            if new != text:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new)
                print(f"{label(path)}: rewrote {len(SPAN.findall(new))} figure spans")
            else:
                print(f"{label(path)}: {len(SPAN.findall(new))} figure spans already current")
        return 0

    if "--check" in argv:
        bad = False
        said_all = {}
        for path, text in texts.items():
            unknown, _unused, wrong = compare(text, values)
            for k in unknown:
                print(f"  fig:{k} is in {label(path)} and not computed here")
            for k, (st, a) in wrong.items():
                print(f"  fig:{k}: {label(path)} says {st!r}, database says {a!r}")
            bad = bad or bool(unknown or wrong)
            said_all.update(stated(text))
        unused = sorted(set(values) - set(said_all))
        for k in unused:
            print(f"  fig:{k} is computed here and stated in no document")
        if bad or unused:
            print("a document disagrees with the database - run tools/readme_figures.py --write")
            return 1
        print(f"all {len(values)} figures agree with the database across {len(texts)} documents")
        return 0

    width = max(len(k) for k in values)
    for k in NAMES:
        v = values[k]
        print(f"  {k:<{width}}  {v if chr(10) not in v else v.strip().splitlines()[0] + ' ...'}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
