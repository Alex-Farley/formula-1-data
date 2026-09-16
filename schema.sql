-- =====================================================================
-- F1 Verified Facts Database — relational schema
-- Version 2.0 (2026-09-04)
--
-- Provenance model
-- ----------------
-- Every fact table carries:
--   confidence  'verified' | 'high' | 'medium' | 'unverified'
--   source      URL or citation where the fact was checked
--
--   verified   = checked this session against fia.com / formula1.com
--   high       = well-established record, stable across decades of
--                official publication; safe to rely on
--   reference  = harvested from Wikipedia's season results tables, which
--                are transcribed from FIA classifications. Cross-checked
--                on load against independently held season data. Usable,
--                but not official under this database's policy.
--   medium     = correct in substance, detail (exact figure, exact
--                date) worth confirming before publication
--   unverified = placeholder / disputed / known-incomplete
--
-- Rule inherited from v1: never promote a fact to 'verified' without
-- an official source. See the `provenance` table for the ladder.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- meta
CREATE TABLE meta (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

CREATE TABLE provenance (
    confidence      TEXT PRIMARY KEY,
    rank            INTEGER NOT NULL,
    definition      TEXT NOT NULL,
    may_publish     INTEGER NOT NULL   -- 1 = safe to state as fact
);

CREATE TABLE source_registry (
    id              INTEGER PRIMARY KEY,
    priority        INTEGER NOT NULL,
    source          TEXT NOT NULL,
    url             TEXT,
    use             TEXT,
    -- official | reference | authored | forbidden
    --
    -- 'authored' was added in v2.16 and names what ATTRIBUTION.md already
    -- said in prose: some of this database was written for the project from
    -- general knowledge rather than taken from anywhere. That is a real
    -- provenance and it deserves a word. It is NOT a lesser kind of
    -- reference source - it has no external source at all - and nothing
    -- carrying it may sit above 'medium'. See docs/DERIVED-CONFIDENCE.md.
    authority       TEXT NOT NULL DEFAULT 'official'
                    CHECK (authority IN ('official', 'reference', 'authored', 'forbidden')),
    -- A source is judged on these three, not on how much data it has. The
    -- largest dataset in the sport is worth nothing here if its values
    -- cannot be checked against something held independently.
    licence         TEXT,     -- what you may actually do with the data
    cadence         TEXT,     -- how often it is updated, and by whom
    checkability    TEXT,     -- what in this database can contradict it

    -- `licence` above is prose, written for a person. These four are the
    -- same judgement in a form the BUILD can read, so that "may this row be
    -- published?" is a query rather than a memory. Without them the licence
    -- of a row is knowable only by reading a paragraph and recognising which
    -- of sixteen sources a URL belongs to, which is how a CC BY-NC citation
    -- survived seven versions in the committed database.
    --
    --   yes         may be redistributed, on the terms in the columns below
    --   facts-only  the FACTS may be restated - they are not copyrightable -
    --               but nothing of the source's own expression may be copied,
    --               and no substantial extraction of its database made
    --   no          may not be redistributed at all. A row citing one of
    --               these must not be in the committed database, and
    --               verify.py fails if one is.
    redistributable TEXT NOT NULL DEFAULT 'facts-only'
                    CHECK (redistributable IN ('yes', 'facts-only', 'no')),
    share_alike     INTEGER NOT NULL DEFAULT 0,   -- reuse must carry the same licence
    attribution_required INTEGER NOT NULL DEFAULT 1,

    -- How a row's `source` is recognised as belonging to this entry: a
    -- comma-separated list of hostnames and of the bare tokens the loaders
    -- write ('f1db', 'fastf1', 'jolpica'). NULL where no row ever cites the
    -- source - the fan-site entry exists to record that it is forbidden, not
    -- to be pointed at. Several entries may share a host, and where they do
    -- the build requires them to agree on the three columns above.
    domains         TEXT
);

-- How a row's free-text `source` resolves to a registry entry.
--
-- source_registry.url is ONE EXAMPLE PAGE, not a namespace, which is why
-- 4,691 rows - 4.9% - previously resolved to no registry entry at all:
-- .../List_of_Formula_One_polesitters does not prefix-match
-- .../2024_Formula_One_World_Championship though both are the same source.
-- A source needs several patterns (Wikipedia needs three), so this is a
-- child table rather than a column.
CREATE TABLE source_patterns (
    id              INTEGER PRIMARY KEY,
    source_id       INTEGER NOT NULL REFERENCES source_registry(id),
    pattern         TEXT NOT NULL,     -- Python re, anchored at the start
    note            TEXT
);

-- Provenance for a table that has no `source` column of its own.
--
-- Fifteen tables carry `confidence` and no `source`. Thirteen of them are
-- authored; two are sourced and simply never got the column. Either way the
-- provenance existed only in ATTRIBUTION.md, where nothing could read it.
-- A row here says, for the whole table, where its content came from.
CREATE TABLE table_provenance (
    tbl             TEXT PRIMARY KEY,
    source_id       INTEGER NOT NULL REFERENCES source_registry(id),
    -- 1 where nothing in this database can constrain the claim the table
    -- makes, whatever the source's standing. A well-run source does not
    -- make a row checkable: article_images comes from the MediaWiki API and
    -- records which file an article leads with, and NOTHING here constrains
    -- what the photograph shows. See known_gaps #11. Such a table is floored
    -- at 'unverified' rather than taking its source's tier.
    unconstrained   INTEGER NOT NULL DEFAULT 0,
    note            TEXT
);

-- ------------------------------------------------------------- people
CREATE TABLE drivers (
    id              TEXT PRIMARY KEY,          -- slug, e.g. 'juan-manuel-fangio'
    full_name       TEXT NOT NULL,
    nationality     TEXT,
    nationality_code TEXT,
    born            TEXT,                      -- ISO date where known
    died            TEXT,
    first_season    INTEGER,
    last_season     INTEGER,
    entries         INTEGER,
    starts          INTEGER,
    wins            INTEGER,
    podiums         INTEGER,
    poles           INTEGER,
    fastest_laps    INTEGER,
    career_points   REAL,
    titles          INTEGER DEFAULT 0,
    title_years     TEXT,                      -- comma-separated
    status          TEXT CHECK (status IN ('active', 'retired', 'deceased')),
    stats_as_of     TEXT,                      -- when the career figures were true
    -- wins / poles / fastest_laps / podiums above are DERIVED from the race
    -- records, which cover every championship race 1950-2026. Podiums became
    -- derivable in v2.7, when second and third place were harvested for every
    -- race; before that the figure was hand-entered. They are
    -- therefore always internally consistent and always current.
    -- The *_external columns hold the separately sourced figure for the same
    -- statistic, so the two can be compared. Where they disagree, the
    -- difference is recorded in the discrepancies table rather than hidden.
    wins_external           INTEGER,
    poles_external          INTEGER,
    fastest_laps_external   INTEGER,
    podiums_external        INTEGER,
    external_source         TEXT,
    notes           TEXT,                      -- about the driver; the page's lede
    -- How the row entered the register, where that was a harvest rather than
    -- the authored list. Kept apart from notes because notes is read as the
    -- page lede and the meta description, and 111 of them opened with it.
    provenance      TEXT,
    confidence      TEXT NOT NULL DEFAULT 'medium' REFERENCES provenance(confidence),
    source          TEXT
);

CREATE TABLE personnel (
    id              TEXT PRIMARY KEY,
    full_name       TEXT NOT NULL,
    nationality     TEXT,
    role            TEXT,                      -- designer | team principal | official | founder
    active_from     INTEGER,
    active_to       INTEGER,
    associated_with TEXT,
    significance    TEXT,
    confidence      TEXT NOT NULL DEFAULT 'medium' REFERENCES provenance(confidence)
);

-- ------------------------------------------------------- constructors
CREATE TABLE constructors (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    full_name       TEXT,
    country         TEXT,
    base            TEXT,
    first_entry     INTEGER,
    -- NULL = still competing, and verify.py holds it to that: an inactive
    -- constructor with none takes the last season it has a race entry in.
    last_entry      INTEGER,
    entries         INTEGER,
    wins            INTEGER,
    poles           INTEGER,
    constructors_titles INTEGER DEFAULT 0,
    drivers_titles  INTEGER DEFAULT 0,
    title_years     TEXT,
    lineage_chain   TEXT,                      -- FK-ish to constructor_lineage.chain_id
    active          INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    confidence      TEXT NOT NULL DEFAULT 'medium' REFERENCES provenance(confidence),
    source          TEXT
);

-- A single continuous racing operation that changed names/owners over
-- time, e.g. Enstone: Toleman > Benetton > Renault > Lotus > Renault > Alpine
CREATE TABLE constructor_lineage (
    id              INTEGER PRIMARY KEY,
    chain_id        TEXT NOT NULL,
    chain_name      TEXT NOT NULL,
    sequence        INTEGER NOT NULL,
    entity_name     TEXT NOT NULL,
    from_year       INTEGER,
    to_year         INTEGER,
    note            TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

-- --------------------------------------------------- engines / power units
CREATE TABLE engine_manufacturers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    country         TEXT,
    first_year      INTEGER,
    last_year       INTEGER,
    wins            INTEGER,
    constructors_titles INTEGER DEFAULT 0,
    drivers_titles  INTEGER DEFAULT 0,
    notes           TEXT,
    confidence      TEXT NOT NULL DEFAULT 'medium' REFERENCES provenance(confidence)
);

CREATE TABLE engine_eras (
    id              INTEGER PRIMARY KEY,
    from_year       INTEGER NOT NULL,
    to_year         INTEGER,
    era_name        TEXT NOT NULL,
    formula         TEXT NOT NULL,
    aspiration      TEXT,
    typical_config  TEXT,
    approx_power_bhp TEXT,
    rev_limit       TEXT,
    notes           TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

-- ------------------------------------------------------------ seasons
CREATE TABLE seasons (
    year            INTEGER PRIMARY KEY,
    rounds          INTEGER,
    drivers_champion TEXT REFERENCES drivers(id),
    champion_team   TEXT REFERENCES constructors(id),
    champion_points REAL,
    champion_wins   INTEGER,
    runner_up       TEXT REFERENCES drivers(id),
    runner_up_points REAL,
    margin          REAL,
    constructors_champion TEXT REFERENCES constructors(id),
    constructors_points REAL,
    engine_formula  TEXT,
    tyre_suppliers  TEXT,
    notes           TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence),
    source          TEXT
);

-- Championship entries: who drove what, in which year
CREATE TABLE season_entries (
    id              INTEGER PRIMARY KEY,
    year            INTEGER NOT NULL REFERENCES seasons(year),
    constructor_id  TEXT REFERENCES constructors(id),
    driver_id       TEXT REFERENCES drivers(id),
    car             TEXT,
    power_unit      TEXT,
    car_number      INTEGER,
    role            TEXT DEFAULT 'race',       -- race | reserve | substitute
    note            TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

CREATE TABLE standings (
    id              INTEGER PRIMARY KEY,
    year            INTEGER NOT NULL,
    table_type      TEXT NOT NULL CHECK (table_type IN ('drivers', 'constructors')),
    -- NULL where the entry has no championship position. That is not a gap:
    -- Michael Schumacher scored 78 points in 1997 and was EXCLUDED from the
    -- classification after Jerez, so he has points and no position. Storing
    -- a 0 there put him first in every query that ordered by position.
    position        INTEGER,
    position_text   TEXT,                      -- "2", or DSQ / EX
    entity          TEXT NOT NULL,             -- driver or constructor display name
    entity_id       TEXT,
    -- The constructors' championship is contested by a CHASSIS-ENGINE
    -- combination, not by a chassis maker. Cooper-Climax won 1960 with 48
    -- points; Cooper-Maserati and Cooper-Castellotti tied for fifth on 3.
    -- Without this column those are one row and Cooper's total is whichever
    -- happened to be written last. NULL on driver rows.
    engine_id       TEXT,
    team            TEXT,
    points          REAL,
    -- The round these standings stood after. NULL is the END-OF-SEASON
    -- classification, which is not the same fact as "after the last round":
    -- before 1991 the championship counted only a driver's best N results,
    -- so the final table and the running total genuinely differ.
    after_round     INTEGER,
    as_of           TEXT,                      -- 'final' | 'round 7' | a date
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence),
    source          TEXT,
    -- as_of is in the key so an official live snapshot and a derived
    -- end-of-season row can coexist for the same season without one
    -- silently overwriting the other.
    UNIQUE (year, table_type, after_round, entity_id, engine_id, as_of)
);

-- The UNIQUE above is inert for 69% of the rows. SQLite treats NULLs as
-- distinct in a unique index, and after_round is NULL on every end-of-season
-- row while engine_id is NULL on every driver row, so a byte-for-byte
-- duplicate of a final driver row was accepted. This index says what the key
-- actually is, with the NULLs pinned. position_text is in it on purpose: it
-- is the column that tells the two 2018 Force India constructor rows apart -
-- EX on 0 points and P7 on 52, one entrant excluded and its successor scoring
-- under the same id - which are two facts and not a loader running twice.
CREATE UNIQUE INDEX ux_standings_identity ON standings(
    year, table_type, COALESCE(after_round, -1), entity_id,
    COALESCE(engine_id, ''), as_of, COALESCE(position_text, ''));

-- ------------------------------------------------- circuits and events
CREATE TABLE circuits (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    official_name   TEXT,
    locality        TEXT,
    country         TEXT,
    circuit_type    TEXT CHECK (circuit_type IN ('permanent', 'street', 'hybrid', 'oval', 'road')),
    first_gp        INTEGER,
    last_gp         INTEGER,
    gp_count        INTEGER,
    length_km       REAL,
    turns           INTEGER,
    -- One spelling. Jacarepagua carried 'anticlockwise' for nine releases and
    -- a filter on direction missed it; the vocabulary rule that already
    -- governs countries and confidence tiers now governs this.
    direction       TEXT CHECK (direction IN ('clockwise', 'anti-clockwise')),
    characteristics TEXT,
    notes           TEXT,
    confidence      TEXT NOT NULL DEFAULT 'medium' REFERENCES provenance(confidence),
    source          TEXT
);

CREATE TABLE circuit_layouts (
    id              INTEGER PRIMARY KEY,
    circuit_id      TEXT NOT NULL REFERENCES circuits(id),
    layout_key      TEXT NOT NULL,             -- stable id, unique per circuit
    layout_name     TEXT,
    from_year       INTEGER,
    to_year         INTEGER,
    -- 1: this layout is what was raced at this circuit for every season in
    --    [from_year, to_year], and such rows form a complete non-overlapping
    --    timeline. 0: a one-off used for particular races only, reachable
    --    solely through races.layout_key. A season that ran two different
    --    layouts - Bahrain in 2020 - needs the second one flagged this way.
    by_year         INTEGER NOT NULL DEFAULT 1,
    length_km       REAL,
    turns           INTEGER,
    change_reason   TEXT,
    confidence      TEXT NOT NULL DEFAULT 'medium' REFERENCES provenance(confidence),
    -- The F1DB outline that draws this row, DERIVED in build.py: set where
    -- every race in the row's span ran one F1DB layout, NULL where the span
    -- crosses two (F1DB splits Monza's chicane era where this timeline does
    -- not) or no race here ran it. A race page never needs it - races carry
    -- their own f1db_layout_id - so a NULL loses a reader nothing.
    f1db_layout_id  TEXT REFERENCES circuit_outlines(f1db_layout_id),
    UNIQUE (circuit_id, layout_key)
);

-- The outline of every layout the championship has raced on, from F1DB.
--
-- A DRAWING, not a measurement, and a different fact from a row in
-- circuit_geometry. The trace there is OpenStreetMap's: geo-referenced,
-- measured against the published length, and possible only for a layout
-- that is on the ground today, which caps it at 25 circuits. The outline is
-- F1DB's, drawn by Jules Roy in a 500x500 box with no scale, no position and
-- no direction of travel, and exists for all 160 layouts of every circuit -
-- seven Monzas and eight Silverstones among them. The rule the site prints
-- wherever a shape appears: the outline is F1DB's, for every layout; the
-- trace is OpenStreetMap's, where it exists. Nothing checks one against the
-- other, because they do not claim the same thing.
--
-- CC BY 4.0 like the rest of F1DB, so unlike the ODbL trace it may live in
-- this file. The key is F1DB's own layout id. circuit_id is DERIVED in
-- build.py from the races that ran the layout, never read from F1DB: its
-- circuit ids differ from this register's for ten venues, and its one
-- `nurburgring` is three circuits here. f1db_circuit_id keeps what it said.
CREATE TABLE circuit_outlines (
    f1db_layout_id  TEXT PRIMARY KEY,          -- F1DB's id: monza-7
    circuit_id      TEXT NOT NULL REFERENCES circuits(id),
    f1db_circuit_id TEXT NOT NULL,
    length_km       REAL,                      -- F1DB's figures for the layout, not this register's
    turns           INTEGER,
    path            TEXT NOT NULL,             -- SVG path data; viewBox 0 0 500 500
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    source          TEXT
);

-- The centreline of a circuit as OpenStreetMap maps it, checked against the
-- length this database already held.
--
-- ODbL 1.0, which is share-alike AND carries a database right. That is a
-- different obligation from anything else here and it is confined to this
-- one table on purpose - see ATTRIBUTION.md. Nothing else in the database
-- derives from OpenStreetMap.
--
-- The trace can only ever be the CURRENT layout: OSM maps what is on the
-- ground. Historic configurations - Spa's 14.1 km road course, Monza's
-- banking - have no geometry source anywhere, so they have no row here, and
-- layout_key names the configuration a trace actually corresponds to rather
-- than letting a modern shape stand in for a 1955 one.
--
-- measured_km, published_km and delta_pct are all stored so the check is
-- visible in the data and not only in the loader. A naive sum of a circuit
-- relation's member ways includes the pit lane and puts Monaco 12% long;
-- what rejects that is published_km, which came from somewhere else.
CREATE TABLE circuit_geometry (
    circuit_id      TEXT NOT NULL REFERENCES circuits(id),
    -- NULL where the circuit has no layout timeline at all. Never a historic
    -- layout: a trace is of the shape that exists now.
    layout_key      TEXT,
    wikidata_id     TEXT NOT NULL,             -- Q171400; CC0, brokers the id
    osm_relation    INTEGER NOT NULL,          -- 148194
    centreline      TEXT NOT NULL,             -- GeoJSON MultiLineString, lon/lat
    measured_km     REAL NOT NULL,             -- summed from centreline
    published_km    REAL NOT NULL,             -- what it was checked against
    delta_pct       REAL NOT NULL,             -- signed, and small by construction
    node_count      INTEGER,
    -- Topology, measured when the row is admitted. An OSM relation's members
    -- are an unordered bag of ways; whether they form a lap is a separate
    -- question from whether they measure the right length, and a trace can be
    -- short by one way and still measure plausibly. See build.py.
    segment_count   INTEGER,                   -- ways in the MultiLineString
    loose_ends      INTEGER,                   -- way ends meeting nothing
    closes          INTEGER,                   -- 1 = every way stitches into one closed ring
    osm_timestamp   TEXT,                      -- the relation version measured
    licence         TEXT NOT NULL DEFAULT 'ODbL-1.0',
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    UNIQUE (circuit_id, layout_key)
);

-- ------------------------------------------------------------------ cars
-- One row per car model. A car is a chassis design, not a season: the Lotus
-- 79 raced in 1978 and 1979 and is one row. Where a design was substantially
-- revised and given a new designation - 72C, 72D, 72E - each designation is
-- its own row, chained through supersedes_id, because that is how results
-- were published and how the cars are talked about.
--
-- The spec columns are patchy ON PURPOSE. A famous car has published figures;
-- a 1954 privateer entry does not. A NULL here means "not established", never
-- "zero", and spec_confidence records how good the figures that ARE here are.
CREATE TABLE cars (
    id              TEXT PRIMARY KEY,          -- lotus-79, ferrari-312t
    constructor_id  TEXT NOT NULL REFERENCES constructors(id),
    designation     TEXT NOT NULL,             -- "79", "312T", "MP4/4"
    full_name       TEXT NOT NULL,             -- "Lotus 79"
    from_year       INTEGER,
    to_year         INTEGER,
    supersedes_id   TEXT REFERENCES cars(id),  -- the design this evolved from
    designers       TEXT,                      -- comma-separated
    engine_id       TEXT REFERENCES engine_manufacturers(id),
    engine_name     TEXT,                      -- "Ford Cosworth DFV" as published
    tyres           TEXT,

    -- power unit
    engine_config   TEXT,                      -- V8, V12, flat-12, turbo I4
    capacity_cc     INTEGER,
    aspiration      TEXT,                      -- naturally aspirated | turbo | hybrid
    power_bhp       INTEGER,                   -- peak race power as published
    power_note      TEXT,                      -- qualifying boost, era caveats
    rev_limit_rpm   INTEGER,

    -- chassis and running gear
    chassis_type    TEXT,                      -- spaceframe | aluminium monocoque
                                               -- | carbon-fibre composite
    gearbox         TEXT,
    suspension      TEXT,
    brakes          TEXT,
    weight_kg       REAL,                      -- as raced, to the era's rules
    wheelbase_mm    INTEGER,
    track_front_mm  INTEGER,
    track_rear_mm   INTEGER,
    fuel_capacity_l INTEGER,

    -- what the car was for, and what it changed
    concept         TEXT,                      -- the design idea in one line
    innovations     TEXT,                      -- what it introduced
    story           TEXT,                      -- the deep dive, where warranted
    outcome         TEXT,                      -- what it actually achieved

    -- derived at build time from race_entries, never stored by hand
    -- races with a RECORDED entry, not races entered: race_entries holds
    -- only winners, pole-sitters and fastest-lap setters, so this is always
    -- a lower bound on the car's true race count.
    races           INTEGER DEFAULT 0,
    wins            INTEGER DEFAULT 0,
    poles           INTEGER DEFAULT 0,
    fastest_laps    INTEGER DEFAULT 0,
    -- authored, not derived: a title season is often shared between two
    -- chassis (Lotus ran the 78 and the 79 through 1978) and there is no
    -- defensible rule for splitting a championship between them. These are
    -- the titles the car was the team's primary chassis for.
    drivers_titles  INTEGER DEFAULT 0,
    constructors_titles INTEGER DEFAULT 0,

    landmark        INTEGER NOT NULL DEFAULT 0, -- 1 = in the deep-dive set
    confidence      TEXT NOT NULL DEFAULT 'medium' REFERENCES provenance(confidence),
    spec_confidence TEXT REFERENCES provenance(confidence),
    source          TEXT,
    UNIQUE (constructor_id, designation)
);

-- ------------------------------------------------- the chassis register
--
-- `cars` above is a curated set: a design, its story and what it changed,
-- researched one at a time. `chassis` is the opposite - every chassis that
-- has raced, 1,153 of them, loaded from F1DB by tools/f1db_fetch.py without
-- a person in the middle.
--
-- The two are different things and are deliberately not merged. A `cars` row
-- is a design family (one row covers the Ferrari 312T through 312T5, because
-- that is how Wikipedia, and the sport, treat it). A `chassis` row is one
-- machine as entered. The link between them runs through `chassis.car_id`,
-- and where both hold the same figure the build compares them instead of
-- picking one: a specification derived twice by different routes is the
-- strongest evidence this database has, and a disagreement goes to
-- `discrepancies` rather than being resolved silently.
CREATE TABLE chassis (
    id              TEXT PRIMARY KEY,          -- f1db id: ferrari-312t2
    constructor_id  TEXT REFERENCES constructors(id),  -- NULL where this
                                               -- database has no constructor
    f1db_constructor_id TEXT NOT NULL,         -- always present
    name            TEXT NOT NULL,             -- "312T2"
    full_name       TEXT NOT NULL,             -- "Ferrari 312T2"
    car_id          TEXT REFERENCES cars(id),  -- the design family, if curated
    first_year      INTEGER,                   -- first season entered
    last_year       INTEGER,                   -- last season entered
    seasons         INTEGER NOT NULL DEFAULT 0,
    -- specifications harvested from the chassis's own Wikipedia article.
    -- NULL is "not established" throughout, and is never a zero or a guess.
    -- A figure that is only the season's regulation limit is NOT stored here
    -- - it lives in regulation_limits, where a rule belongs.
    article         TEXT,                      -- the article the specs came from
    designers       TEXT,
    chassis_type    TEXT,
    susp_front      TEXT,
    susp_rear       TEXT,
    engine_name     TEXT,
    engine_config   TEXT,
    aspiration      TEXT,
    engine_position TEXT,
    gearbox         TEXT,
    gears           TEXT,
    brakes          TEXT,
    fuel            TEXT,
    tyres           TEXT,
    capacity_cc     INTEGER,
    power_bhp       INTEGER,
    power_note      TEXT,
    weight_kg       REAL,
    wheelbase_mm    INTEGER,
    track_front_mm  INTEGER,
    track_rear_mm   INTEGER,
    fuel_capacity_l INTEGER,
    predecessor     TEXT,
    successor       TEXT,
    -- published career figures off the same article. Not specifications:
    -- these are the numbers the database derives from its own race records,
    -- and comparing the two is what proves a linkage rather than assuming it.
    published_races INTEGER,
    published_wins  INTEGER,
    published_poles INTEGER,
    -- derived at build time from race_entries, never stored by hand
    races           INTEGER NOT NULL DEFAULT 0,
    wins            INTEGER NOT NULL DEFAULT 0,
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    spec_source     TEXT,
    source          TEXT NOT NULL
);

-- The record of which CAR_SEASONS claims the entry lists corroborate.
--
-- data/cars.py asserts, per (car, season), that every race the constructor
-- won, took pole for or set fastest lap in that year was in this car. That is
-- an authored claim, and this table is where it stops being trusted and
-- starts being checked: `corroborated` is 1 only where the season's entry
-- lists name no chassis outside the ones the car covers.
--
-- Where it is 0, `other_chassis` says what else the constructor ran, and the
-- blanket link is NOT made - an entry that season gets a car only if the
-- entry lists resolved its chassis outright. The claim was safe for wins by
-- luck rather than by construction, and the moment poles could be attributed
-- it showed: McLaren ran the M23 and M26 through 1976-77, and the blanket
-- gave the M23 sixteen poles against a published career fourteen.
-- The lead image of each car article, and the attribution needed to show it.
--
-- NO IMAGE IS STORED. This is a reference and its credit: which file an
-- article leads with, who took it, under what licence. The pixels are fetched
-- from upload.wikimedia.org by whatever renders the page, under Wikimedia's
-- terms; this database redistributes nothing and f1.db does not grow.
--
-- The claim is checkable and it is deliberately narrow: "the article already
-- proved to describe this chassis leads with this file". The article passed
-- the three checks in tools/wikispec_fetch.py before it got here, so the row
-- is not an image found by searching for a car's name.
--
-- What CANNOT be checked is whether the photograph shows the car. Nothing in
-- this database constrains the content of an image and there is no second
-- source to disagree. Testing whether the file name mentions the chassis
-- finds under half the correct images - most are filed under the driver -
-- so name_matches is RECORDED AND ENFORCED NOWHERE. These rows are
-- 'unverified' because that is what they are.
CREATE TABLE article_images (
    article         TEXT PRIMARY KEY,          -- joins chassis.article
    file_name       TEXT NOT NULL,             -- 'File:...' as Commons spells it
    -- Must be 'shared'. A file hosted locally on en.wikipedia.org is local
    -- BECAUSE it is non-free; linking one would be a licence violation.
    repository      TEXT NOT NULL CHECK (repository = 'shared'),
    -- Every file carries its own. Sixteen distinct licence strings appear
    -- across these rows, so there is no blanket credit line for them.
    licence         TEXT NOT NULL,
    licence_url     TEXT,
    artist          TEXT,                      -- plain text; the API returns HTML
    credit          TEXT,
    description_url TEXT NOT NULL,             -- the Commons file page
    width           INTEGER,
    height          INTEGER,
    name_matches    INTEGER NOT NULL DEFAULT 0,
    confidence      TEXT NOT NULL DEFAULT 'unverified' REFERENCES provenance(confidence)
);

CREATE TABLE car_seasons (
    car_id          TEXT NOT NULL REFERENCES cars(id),
    year            INTEGER NOT NULL,
    corroborated    INTEGER NOT NULL,
    other_chassis   TEXT,                      -- '+'-separated, when not
    PRIMARY KEY (car_id, year)
);

-- Who entered what, per season: the mapping that lets a race be tied to a
-- chassis at all. One row per (season, entrant, constructor).
--
-- The `+`-separated lists are the point of this table rather than an
-- awkwardness in it. F1DB records which chassis a constructor ran in a
-- season; it does NOT record which chassis ran in which round. Where a team
-- ran two designs both are listed, and splitting them into separate rows
-- would invent an attribution the source never made. `chassis_count` = 1 is
-- exactly the case where the season constrains the chassis, and it is the
-- only case build.py will link a race entry from.
CREATE TABLE season_entrants (
    id              INTEGER PRIMARY KEY,
    year            INTEGER NOT NULL REFERENCES seasons(year),
    entrant_id      TEXT NOT NULL,             -- f1db entrant id
    f1db_constructor_id TEXT NOT NULL,
    constructor_id  TEXT REFERENCES constructors(id),
    -- part of the grain, not decoration: Team Lotus in 1966 is one entrant
    -- with two constructor blocks, both Lotus, one on Climax and one on BRM.
    engine_manufacturer_id TEXT,
    chassis_ids     TEXT,                      -- '+'-separated
    chassis_count   INTEGER NOT NULL DEFAULT 0,
    engine_ids      TEXT,                      -- '+'-separated
    tyre_ids        TEXT,                      -- '+'-separated
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    source          TEXT NOT NULL,
    UNIQUE (year, entrant_id, f1db_constructor_id, engine_manufacturer_id)
);

-- Every engine that has raced, with the three specifications F1DB carries.
CREATE TABLE engines (
    id              TEXT PRIMARY KEY,
    manufacturer_id TEXT REFERENCES engine_manufacturers(id),
    f1db_manufacturer_id TEXT NOT NULL,
    name            TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    capacity_l      REAL,
    configuration   TEXT,                      -- V10, F12, L6 ...
    aspiration      TEXT,                      -- NATURALLY_ASPIRATED | TURBOCHARGED
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    source          TEXT NOT NULL
);

-- Numeric limits the regulations put on every car in a season.
--
-- Here rather than on a car because that is what they are. Most "weight"
-- quoted for a modern car is the season's minimum, and the 2026 figures in
-- circulation - 768 kg, 3,400 mm, 1,900 mm - are rules, not measurements of
-- anything. A per-car field holding one of them would be inference presented
-- as fact.
--
-- The series has holes on purpose: a row covers from_year..to_year, and
-- to_year is set only where a source records the next change. Carrying a
-- value across an unrecorded change would invent a limit.
CREATE TABLE regulation_limits (
    id              INTEGER PRIMARY KEY,
    from_year       INTEGER NOT NULL,
    to_year         INTEGER NOT NULL,
    field           TEXT NOT NULL,             -- minimum_weight_kg, maximum_width_mm
    value           REAL NOT NULL,
    unit            TEXT NOT NULL,
    note            TEXT,
    confidence      TEXT NOT NULL REFERENCES provenance(confidence),
    source          TEXT NOT NULL,
    UNIQUE (from_year, field)
);

CREATE TABLE grands_prix (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    country         TEXT,
    first_held      INTEGER,
    last_held       INTEGER,
    editions        INTEGER,
    circuits_used   TEXT,
    aliases         TEXT,                      -- other names this event has carried
    notes           TEXT,
    confidence      TEXT NOT NULL DEFAULT 'medium' REFERENCES provenance(confidence)
);


-- =====================================================================
-- The race model (v2.4)
--
-- `races` is one row per championship event.
-- `race_entries` is one row per driver per race.
--
-- Every per-driver fact about a race - who was on pole, who won, who set
-- the fastest lap - is an attribute of an ENTRY, not of the race. Before
-- v2.4 those three facts were columns on the race row plus a separate
-- credits table, which meant a shared win and a shared fastest lap were
-- modelled two different ways and neither could be extended to a full
-- finishing order without changing shape again.
--
-- Deriving from entries:
--   pole         pole = 1
--   win          finish_position = 1
--   fastest lap  fastest_lap = 1
-- Adding the rest of the finishing order is then pure INSERT.
--
-- WHAT 'POLE' MEANS HERE. Three different facts sit near the front of a grid
-- and this schema holds each in its own place:
--
--   pole = 1                the driver CREDITED with pole position, as the
--                           season record credits it (the pole harvest)
--   grid = 1                the car that STARTED from the front of the grid
--                           (F1DB's grid)
--   qualifying.position = 1 the driver who was QUICKEST in qualifying
--
-- They usually name one driver and sometimes do not. A grid penalty moves the
-- fastest qualifier back and pole stays with whoever starts first; through
-- 2021 a sprint set the grid and pole went to the sprint winner; from 2022 a
-- sprint weekend credits the fastest qualifier even where the sprint winner
-- starts first (2022 round 21: Magnussen has pole, Russell grid 1). And a
-- pole-sitter who never starts leaves grid 1 empty (1996 round 9, 2021 round
-- 5). None of these is a disagreement between sources - each column is true
-- of the thing it describes - so none is recorded in `discrepancies`;
-- verify.py pins the counts instead, so a new case arrives as a question.
--
-- Through v2.20 `grid = 1` carried both of the first two meanings, which made
-- 2022 round 21 a row with grid = 1 and grid_text = '8'.
-- =====================================================================
CREATE TABLE races (
    id              INTEGER PRIMARY KEY,
    year            INTEGER NOT NULL REFERENCES seasons(year),
    round           INTEGER NOT NULL,
    gp_id           TEXT NOT NULL REFERENCES grands_prix(id),
    name_used       TEXT NOT NULL,             -- the name carried that year
    circuit_id      TEXT REFERENCES circuits(id),
    layout_key      TEXT,                      -- overrides the year lookup
    -- The F1DB layout this race ran, from the round's own race.yml: the key
    -- into circuit_outlines, so every race can be drawn whether or not its
    -- circuit has a layout timeline here.
    f1db_layout_id  TEXT REFERENCES circuit_outlines(f1db_layout_id),
    -- TWO COLUMNS, BECAUSE THEY ANSWER DIFFERENT QUESTIONS.
    --   dates     is for a reader. It may be a RANGE - "27-29 Mar 2026" -
    --             because a Grand Prix is a weekend, and for a race still to
    --             be run that is the more useful fact.
    --   date_iso  is the day the race itself was held, always YYYY-MM-DD,
    --             for anything that has to compute: schema.org startDate,
    --             sorting, date arithmetic.
    -- Storing only one loses something either way. A single ISO day cannot
    -- express a weekend; a range cannot be parsed. verify.py checks that
    -- where `dates` IS an ISO day the two agree.
    dates           TEXT,
    date_iso        TEXT,                      -- YYYY-MM-DD, the race day
    sprint          INTEGER NOT NULL DEFAULT 0,
    -- completed | scheduled. A cancelled round has no row rather than a
    -- third value: the calendar holds what was and will be run, and the
    -- front end knows only these two. A third state fails loudly here first.
    status          TEXT NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed', 'scheduled')),
    note            TEXT,
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    source          TEXT,
    UNIQUE (year, round)
);

-- The weekend timetable of the current season (LV-02): one row per session,
-- the start in UTC and the circuit's IANA zone beside it, so a page can show
-- both the circuit's clock and the reader's, and count down to the next
-- session in the browser. Rows exist only for the season in progress; the
-- source is formula1.com's race page (a start time is a fact and may be
-- re-stated), and the FIA's per-event timetable is what it will be checked
-- against. A sprint weekend is fp1, sprint_qualifying, sprint, qualifying,
-- race; any other is fp1, fp2, fp3, qualifying, race - verify.py holds each
-- weekend to the set races.sprint implies, and holds the race's local day to
-- the last day of races.dates. Las Vegas is why the zone travels with the
-- row: its Saturday-evening race is Sunday in UTC.
CREATE TABLE sessions (
    id              INTEGER PRIMARY KEY,
    race_id         INTEGER NOT NULL REFERENCES races(id),
    kind            TEXT NOT NULL CHECK (kind IN ('fp1', 'fp2', 'fp3', 'sprint_qualifying',
                                                 'sprint', 'qualifying', 'race')),
    name            TEXT NOT NULL,             -- "Practice 1", "Sprint qualifying"
    start_utc       TEXT NOT NULL,             -- YYYY-MM-DDTHH:MMZ; the Z is what makes a browser read it as UTC
    zone            TEXT NOT NULL,             -- IANA tz database name of the circuit
    confidence      TEXT NOT NULL DEFAULT 'verified' REFERENCES provenance(confidence),
    source          TEXT NOT NULL,
    UNIQUE (race_id, kind)
);

CREATE TABLE race_entries (
    id              INTEGER PRIMARY KEY,
    race_id         INTEGER NOT NULL REFERENCES races(id),
    driver_id       TEXT NOT NULL REFERENCES drivers(id),
    constructor_id  TEXT REFERENCES constructors(id),
    car_id          TEXT REFERENCES cars(id),  -- the curated design family
    -- The chassis as entered. Filled only where the season's entry list
    -- names exactly one chassis for the constructor, which is the only case
    -- in which the season constrains it; NULL everywhere else, including
    -- every season a team ran two designs.
    chassis_id      TEXT REFERENCES chassis(id),
    entrant         TEXT,                      -- chassis-engine as published
    grid            INTEGER,                   -- the slot the car started from
    -- Credited with pole position. Distinct from grid = 1 on purpose: see
    -- WHAT 'POLE' MEANS HERE, above. Credited from harvest/poles.txt - the
    -- Wikipedia season tables - whatever `source` says: `source` names who
    -- established the row's FINISHING POSITION, and the pole and fastest-lap
    -- flags are the one thing on a row that can come from elsewhere. Field-grain
    -- sourcing is what `claims` would carry (docs/DERIVED-CONFIDENCE.md);
    -- until then this is where the exception is declared.
    pole            INTEGER NOT NULL DEFAULT 0,
    -- The grid slot as the source states it. Almost always the same number
    -- as `grid`, but 236 entries started from the PIT LANE, which is not a
    -- grid slot at all. NULLing those would say "we do not know where they
    -- started", which is the opposite of the truth.
    grid_text       TEXT,
    finish_position INTEGER,                   -- 1 = race win; NULL if unclassified
    -- The result as the source states it, losslessly: "1", or one of NC,
    -- DNF, DNQ, DNPQ, DNP, DNS, DSQ, EX. finish_position is an integer so it
    -- can be ordered and counted; this keeps what actually happened, because
    -- "did not qualify" and "retired on lap 3" are different facts and
    -- collapsing them loses the late-1980s entirely - 1,041 failures to
    -- qualify and 338 failures to PRE-qualify.
    position_text   TEXT,
    shared_drive    INTEGER NOT NULL DEFAULT 0,
    fastest_lap     INTEGER NOT NULL DEFAULT 0,   -- credited as `pole` is, see above
    fastest_lap_shared INTEGER,                -- how many drivers shared it
    -- Reserved for the full finishing order. Declared now so that adding it
    -- is pure INSERT and no consumer of this schema has to change.
    classified      INTEGER,                   -- 1 = classified finisher
    status          TEXT,                      -- Finished | +1 Lap | Engine | Accident ...
    laps_completed  INTEGER,
    points          REAL,
    note            TEXT,
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    source          TEXT,
    UNIQUE (race_id, driver_id)
);

CREATE INDEX idx_races_year      ON races(year, round);
CREATE INDEX idx_races_gp        ON races(gp_id);
CREATE INDEX idx_races_circuit   ON races(circuit_id);
-- ---------------------------------------------------------------- sprints
--
-- A sprint is a SEPARATE RACE held on a grand prix weekend, with its own
-- grid, its own classification and its own points — and those points count
-- towards the championship. It is not a session of the grand prix, so it is
-- not a column on race_entries: it is its own rows, keyed on the round that
-- held it.
--
-- Sprints began at Silverstone in 2021. Before that this table is empty, and
-- that emptiness is a fact rather than a gap: there were none.
--
-- No shared_drive column, unlike race_entries. Sharing a car mid-race ended
-- in 1964 and no sprint has ever had one, so a column for it would only ever
-- hold zero.
CREATE TABLE sprint_results (
    id              INTEGER PRIMARY KEY,
    race_id         INTEGER NOT NULL REFERENCES races(id),
    driver_id       TEXT NOT NULL REFERENCES drivers(id),
    constructor_id  TEXT REFERENCES constructors(id),
    grid            INTEGER,                   -- the sprint grid, not the GP grid
    finish_position INTEGER,                   -- 1 = sprint win; NULL if unclassified
    -- As race_entries.position_text: "1", or NC, DNF, DNS, DSQ. Kept because
    -- "retired" and "did not start" are different facts.
    position_text   TEXT,
    status          TEXT,                      -- reason retired, where stated
    laps_completed  INTEGER,
    time            TEXT,                      -- winner's time; gap for the rest
    gap             TEXT,
    points          REAL,                      -- counts towards the championship
    note            TEXT,
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    source          TEXT,
    UNIQUE (race_id, driver_id)
);

CREATE INDEX idx_sprint_race    ON sprint_results(race_id);
CREATE INDEX idx_sprint_driver  ON sprint_results(driver_id);
CREATE INDEX idx_sprint_cons    ON sprint_results(constructor_id);
CREATE INDEX idx_sprint_pos     ON sprint_results(race_id, finish_position);

CREATE INDEX idx_entries_race    ON race_entries(race_id);
CREATE INDEX idx_entries_driver  ON race_entries(driver_id);
CREATE INDEX idx_entries_cons    ON race_entries(constructor_id);
CREATE INDEX idx_entries_win     ON race_entries(finish_position);
CREATE INDEX idx_entries_grid    ON race_entries(grid);
CREATE INDEX idx_entries_fl      ON race_entries(fastest_lap);
-- composite indexes so the per-race lookups in the compatibility views and
-- in any "who won / who was on pole" query are index-only
CREATE INDEX idx_entries_race_pos  ON race_entries(race_id, finish_position);
CREATE INDEX idx_entries_race_grid ON race_entries(race_id, grid);
CREATE INDEX idx_entries_race_fl   ON race_entries(race_id, fastest_lap);
CREATE INDEX idx_entries_driver_pos ON race_entries(driver_id, finish_position);
CREATE INDEX idx_entries_car     ON race_entries(car_id);
CREATE INDEX idx_entries_chassis ON race_entries(chassis_id);
CREATE INDEX idx_chassis_cons    ON chassis(constructor_id);
CREATE INDEX idx_chassis_car     ON chassis(car_id);
CREATE INDEX idx_chassis_years   ON chassis(first_year, last_year);
CREATE INDEX idx_entrants_year   ON season_entrants(year, constructor_id);
CREATE INDEX idx_cars_constructor ON cars(constructor_id);
CREATE INDEX idx_cars_years       ON cars(from_year, to_year);

-- ------------------------------------------- rules, tech and safety
-- Qualifying, which is a session and not a property of the race.
--
-- This is deliberately NOT a column on race_entries. race_entries.grid is the
-- STARTING GRID, which penalties, engine changes and pit-lane starts move
-- away from the qualifying order; F1DB publishes the two separately for the
-- same reason. A driver can also qualify and never start, and 1,041 drivers
-- failed to qualify at all - none of which fits on a row about a race.
--
-- Pre-1996 qualifying is a single time. The knockout era has three segments
-- and no single time, so both shapes are stored and neither is back-filled
-- from the other: q1/q2/q3 are NULL for 1950, and `time` is NULL for 2021.
CREATE TABLE qualifying (
    id              INTEGER PRIMARY KEY,
    race_id         INTEGER NOT NULL REFERENCES races(id),
    driver_id       TEXT NOT NULL REFERENCES drivers(id),
    constructor_id  TEXT REFERENCES constructors(id),
    position        INTEGER,                   -- NULL where not classified
    position_text   TEXT,                      -- "1", DNQ, DNPQ, DNS ...
    driver_number   INTEGER,
    time            TEXT,                      -- as published: "1:50.800"
    q1              TEXT,
    q2              TEXT,
    q3              TEXT,
    gap             TEXT,
    interval        TEXT,
    laps            INTEGER,
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    source          TEXT,
    UNIQUE (race_id, driver_id)
);

CREATE TABLE regulation_changes (
    id              INTEGER PRIMARY KEY,
    year            INTEGER NOT NULL,
    category        TEXT NOT NULL
                    CHECK (category IN ('technical', 'sporting', 'safety', 'financial', 'format')),
    title           TEXT NOT NULL,
    detail          TEXT,
    impact          TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence),
    source          TEXT
);

CREATE TABLE technical_innovations (
    id              INTEGER PRIMARY KEY,
    year            INTEGER NOT NULL,
    innovation      TEXT NOT NULL,
    originator      TEXT,
    description     TEXT,
    legacy          TEXT,
    banned_year     INTEGER,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

CREATE TABLE safety_milestones (
    id              INTEGER PRIMARY KEY,
    year            INTEGER NOT NULL,
    milestone       TEXT NOT NULL,
    trigger_event   TEXT,
    description     TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

CREATE TABLE tyre_suppliers (
    id              INTEGER PRIMARY KEY,
    supplier        TEXT NOT NULL,
    from_year       INTEGER,
    to_year         INTEGER,
    exclusive       INTEGER DEFAULT 0,
    notes           TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

CREATE TABLE points_systems (
    id              INTEGER PRIMARY KEY,
    from_year       INTEGER NOT NULL,
    to_year         INTEGER,
    scoring         TEXT NOT NULL,
    fastest_lap     TEXT,
    dropped_scores  TEXT,
    notes           TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

-- DERIVED, not authored. Until v2.23 this held thirty rows typed from general
-- knowledge, with twenty-four spellings of `as_of` and a Hamilton win count
-- one behind the `drivers.wins` the same database computed. Every row is now
-- one query in build.py (derive_records) over the tables the site's
-- leaderboards read, so the two cannot disagree, and verify.py recomputes a
-- sample by a different route. `detail` says how each was derived: which
-- tables, the rule, what was excluded and why. A tie holds every holder in
-- `holder`, comma-separated, with `holder_id` NULL - one is never picked.
CREATE TABLE records (
    id              INTEGER PRIMARY KEY,
    key             TEXT NOT NULL UNIQUE,      -- stable slug, e.g. 'most-wins'
    category        TEXT NOT NULL,             -- drivers | constructors | races
    record          TEXT NOT NULL,
    holder          TEXT NOT NULL,             -- name(s), for display
    -- The row `holder_id` joins to. `records` is the one place a holder can
    -- be a driver, a team, a race or a circuit, so the table has to be said.
    holder_table    TEXT NOT NULL
                    CHECK (holder_table IN ('drivers', 'constructors', 'races', 'circuits')),
    holder_id       TEXT,                      -- NULL when the record is shared
    value           TEXT NOT NULL,             -- for display: '18 years, 228 days, ...'
    value_num       REAL NOT NULL,             -- the figure, comparable: 6802
    unit            TEXT NOT NULL,             -- what value_num counts: 'days'
    detail          TEXT NOT NULL,
    as_of           TEXT NOT NULL,             -- ISO date of the last completed race
    -- 'reference' because that is what the race records the figures are
    -- computed from carry; a derivation cannot outrank its inputs.
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence)
);

CREATE TABLE eras (
    id              INTEGER PRIMARY KEY,
    from_year       INTEGER NOT NULL,
    to_year         INTEGER,
    era_name        TEXT NOT NULL,
    summary         TEXT,
    dominant_teams  TEXT,
    defining_features TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

CREATE TABLE glossary (
    term            TEXT PRIMARY KEY,
    category        TEXT,
    definition      TEXT NOT NULL,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

CREATE TABLE governance (
    id              INTEGER PRIMARY KEY,
    year            INTEGER,
    event           TEXT NOT NULL,
    detail          TEXT,
    significance    TEXT,
    confidence      TEXT NOT NULL DEFAULT 'high' REFERENCES provenance(confidence)
);

-- --------------------------------------------------------- indexes
CREATE INDEX idx_seasons_champion       ON seasons(drivers_champion);
CREATE INDEX idx_seasons_cchampion      ON seasons(constructors_champion);
CREATE INDEX idx_sentries_year           ON season_entries(year);
CREATE INDEX idx_sentries_driver         ON season_entries(driver_id);
CREATE INDEX idx_sentries_constructor    ON season_entries(constructor_id);
CREATE INDEX idx_standings_year         ON standings(year, table_type);
CREATE INDEX idx_regs_year              ON regulation_changes(year);
CREATE INDEX idx_regs_category          ON regulation_changes(category);
CREATE INDEX idx_innov_year             ON technical_innovations(year);
CREATE INDEX idx_safety_year            ON safety_milestones(year);
CREATE INDEX idx_layouts_circuit        ON circuit_layouts(circuit_id);
CREATE INDEX idx_lineage_chain          ON constructor_lineage(chain_id, sequence);
CREATE INDEX idx_drivers_titles         ON drivers(titles);
CREATE INDEX idx_drivers_wins           ON drivers(wins);

-- ----------------------------------------------------------- views
CREATE VIEW v_champions AS
SELECT s.year,
       d.full_name        AS champion,
       d.nationality      AS nationality,
       c.name             AS team,
       s.champion_points  AS points,
       s.champion_wins    AS wins,
       ru.full_name       AS runner_up,
       s.runner_up_points AS runner_up_points,
       s.margin           AS margin,
       cc.name            AS constructors_champion,
       s.rounds           AS rounds
FROM seasons s
LEFT JOIN drivers d       ON d.id  = s.drivers_champion
LEFT JOIN drivers ru      ON ru.id = s.runner_up
LEFT JOIN constructors c  ON c.id  = s.champion_team
LEFT JOIN constructors cc ON cc.id = s.constructors_champion
ORDER BY s.year;

CREATE VIEW v_title_count AS
SELECT d.full_name, d.nationality, d.titles, d.title_years, d.wins, d.poles
FROM drivers d
WHERE d.titles > 0
ORDER BY d.titles DESC, d.wins DESC;

CREATE VIEW v_constructor_titles AS
SELECT name, country, constructors_titles, drivers_titles, wins,
       first_entry, last_entry, title_years
FROM constructors
WHERE constructors_titles > 0 OR drivers_titles > 0
ORDER BY constructors_titles DESC, wins DESC;

CREATE VIEW v_current_grid AS
SELECT e.car_number, d.full_name AS driver, d.nationality_code, c.name AS team,
       e.car, e.power_unit, e.role
FROM season_entries e
LEFT JOIN drivers d      ON d.id = e.driver_id
LEFT JOIN constructors c ON c.id = e.constructor_id
WHERE e.year = 2026
ORDER BY e.role, c.name, e.car_number;

CREATE VIEW v_season_timeline AS
SELECT s.year, s.rounds, d.full_name AS champion, cc.name AS constructors_champion,
       s.engine_formula, s.tyre_suppliers, s.notes
FROM seasons s
LEFT JOIN drivers d       ON d.id  = s.drivers_champion
LEFT JOIN constructors cc ON cc.id = s.constructors_champion
ORDER BY s.year;

CREATE VIEW v_unverified AS
SELECT 'drivers' AS tbl, id AS key, full_name AS label, confidence FROM drivers WHERE confidence IN ('medium','unverified')
UNION ALL SELECT 'constructors', id, name, confidence FROM constructors WHERE confidence IN ('medium','unverified')
UNION ALL SELECT 'circuits', id, name, confidence FROM circuits WHERE confidence IN ('medium','unverified')
UNION ALL SELECT 'seasons', CAST(year AS TEXT), CAST(year AS TEXT), confidence FROM seasons WHERE confidence IN ('medium','unverified');

-- ------------------------------------------- race-result views (v2.1)




-- Known gaps in the harvest, and open discrepancies between a hand-entered
-- career figure and the figure derived from the race records. Recorded
-- rather than silently reconciled: where two sources disagree and neither
-- can be checked against an official source, the disagreement IS the fact.
-- --------------------------------------------------------------- timing
-- Per-race timing, one row per race. Times are stored as text exactly as
-- published ("1:24.303") and as seconds for arithmetic, because the published
-- form is the citable one and the numeric form is the useful one. Both are
-- written from the same harvested string so they cannot disagree.
CREATE TABLE race_timing (
    race_id         INTEGER PRIMARY KEY REFERENCES races(id),
    pole_time       TEXT,
    pole_seconds    REAL,
    fastest_lap_time TEXT,
    fastest_lap_seconds REAL,
    fastest_lap_number INTEGER,
    winner_time     TEXT,                      -- total race time
    winner_seconds  REAL,
    margin          TEXT,                      -- gap to second, as published
    margin_seconds  REAL,                      -- NULL when the gap is in laps
    margin_laps     INTEGER,                   -- set instead when lapped
    laps            INTEGER,                   -- race distance in laps
    distance_km     REAL,
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    source          TEXT
);

-- Per-lap data. Empty in the distributed database: F1 does not publish lap
-- times before 2018 in any retrievable form, and the 2018- data comes from
-- the live timing API through FastF1, which needs network access this build
-- environment does not have. tools/fastf1_load.py populates these four
-- tables; the schema is here so that a database built with them and one
-- built without are the same shape.
CREATE TABLE laps (
    id              INTEGER PRIMARY KEY,
    race_id         INTEGER NOT NULL REFERENCES races(id),
    driver_id       TEXT REFERENCES drivers(id),
    driver_code     TEXT,                      -- VER, HAM where the source has one
    -- What the SOURCE keys this lap on, and the reason the two can coexist.
    -- FastF1 identifies a driver by three-letter code and may not resolve a
    -- register id; Jolpica resolves to a register id and mostly has no
    -- abbreviation before the 2000s. Neither column is reliably present for
    -- both, so each loader writes its own key here and the uniqueness is
    -- (race, source, key, lap) - which lets both sources hold the same race
    -- side by side, and verify.py compare them.
    driver_key      TEXT NOT NULL,
    lap_number      INTEGER NOT NULL,
    position        INTEGER,
    lap_seconds     REAL,
    sector1_seconds REAL,
    sector2_seconds REAL,
    sector3_seconds REAL,
    speed_trap_kph  REAL,
    compound        TEXT,                      -- SOFT | MEDIUM | HARD | INTER | WET
    tyre_life       INTEGER,                   -- laps on this set
    fresh_tyre      INTEGER,
    stint           INTEGER,
    is_personal_best INTEGER,
    deleted         INTEGER,                   -- lap time deleted by the stewards
    deleted_reason  TEXT,
    track_status    TEXT,                      -- yellow, SC, VSC, red as flagged
    is_fastest_lap  INTEGER,                   -- the driver's quickest of the race
    source          TEXT NOT NULL DEFAULT 'fastf1',
    UNIQUE (race_id, source, driver_key, lap_number)
);

CREATE TABLE stints (
    id              INTEGER PRIMARY KEY,
    race_id         INTEGER NOT NULL REFERENCES races(id),
    driver_id       TEXT REFERENCES drivers(id),
    driver_code     TEXT,
    stint           INTEGER NOT NULL,
    compound        TEXT,
    lap_start       INTEGER,
    lap_end         INTEGER,
    laps_run        INTEGER,
    source          TEXT NOT NULL DEFAULT 'fastf1',
    UNIQUE (race_id, driver_code, stint)
);

CREATE TABLE pit_stops (
    id              INTEGER PRIMARY KEY,
    race_id         INTEGER NOT NULL REFERENCES races(id),
    driver_id       TEXT REFERENCES drivers(id),
    driver_code     TEXT,
    driver_key      TEXT NOT NULL,             -- as laps.driver_key
    stop_number     INTEGER,
    lap_number      INTEGER,
    -- The timing sources publish PIT LANE time - entry to exit, around
    -- 20-30 s - not the two or three seconds the car is stationary. Storing
    -- the one we have in the column that names it, and leaving the other
    -- NULL, is the difference between a figure and a wrong figure. In the
    -- DISTRIBUTED database both are NULL on every row: the only source that
    -- may be passed on, F1DB, publishes the lap and the stop order and no
    -- duration at all. Strategy is derivable from it; duration is not.
    stationary_seconds REAL,
    pit_lane_seconds REAL,
    source          TEXT NOT NULL DEFAULT 'fastf1',
    UNIQUE (race_id, source, driver_key, stop_number)
);

-- ------------------------------------------------------ radio and control
-- Race control messages are published as text and are fully structured:
-- flags, safety cars, investigations, penalties, deleted lap times.
CREATE TABLE race_control_messages (
    id              INTEGER PRIMARY KEY,
    race_id         INTEGER NOT NULL REFERENCES races(id),
    session         TEXT NOT NULL DEFAULT 'race', -- race | qualifying | sprint
    utc_time        TEXT,
    lap_number      INTEGER,
    category        TEXT,                      -- Flag | SafetyCar | Drs | Other
    flag            TEXT,                      -- GREEN | YELLOW | DOUBLE YELLOW | RED ...
    scope           TEXT,                      -- Track | Sector | Driver
    sector          INTEGER,
    driver_number   INTEGER,
    message         TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'fastf1',
    UNIQUE (race_id, session, utc_time, message)
);

-- Team radio. F1 publishes the AUDIO, not transcripts, so `transcript` is
-- filled only where one has been made: tools/fastf1_load.py can transcribe
-- with a local Whisper model if one is installed, and otherwise records the
-- clip and its URL with transcript NULL. `notable` marks the curated set of
-- historically significant exchanges, which are transcribed from broadcast
-- and are the only rows that exist for seasons before 2018.
CREATE TABLE team_radio (
    id              INTEGER PRIMARY KEY,
    race_id         INTEGER REFERENCES races(id),
    driver_id       TEXT REFERENCES drivers(id),
    driver_code     TEXT,
    utc_time        TEXT,
    lap_number      INTEGER,
    speaker         TEXT,                      -- driver | engineer | team
    transcript      TEXT,
    audio_url       TEXT,
    notable         INTEGER NOT NULL DEFAULT 0,
    context         TEXT,                      -- why this one matters
    confidence      TEXT NOT NULL DEFAULT 'reference' REFERENCES provenance(confidence),
    source          TEXT NOT NULL DEFAULT 'fastf1'
);

CREATE INDEX idx_laps_race        ON laps(race_id, lap_number);
CREATE INDEX idx_laps_driver      ON laps(race_id, driver_code);
CREATE INDEX idx_stints_race      ON stints(race_id);
CREATE INDEX idx_pits_race        ON pit_stops(race_id);
CREATE INDEX idx_rcm_race         ON race_control_messages(race_id);
CREATE INDEX idx_radio_race       ON team_radio(race_id);
CREATE INDEX idx_radio_notable    ON team_radio(notable);

-- What the database does not hold, on the record. A row is never deleted:
-- a gap that closes is marked closed and its resolution says when and how,
-- so the register keeps its history. `state` separates three things that
-- used to share one list and one count -
--   open      a fact nobody holds yet; these are the gaps the site counts
--   closed    filled since, and kept so the closure is on record
--   position  a deliberate absence (no lap timing, no historic centrelines,
--             a race in which no lap was set) - the right state, not a gap
-- `reader` is the one-paragraph version a reader of the site is shown;
-- `description` and `resolution` are the maintainer's note, kept whole.
CREATE TABLE known_gaps (
    id              INTEGER PRIMARY KEY,
    field           TEXT NOT NULL,             -- which column is incomplete
    area            TEXT NOT NULL,
    state           TEXT NOT NULL CHECK (state IN ('open', 'closed', 'position')),
    reader          TEXT NOT NULL,             -- what a reader is shown
    description     TEXT NOT NULL,             -- the maintainer's note
    races_affected  INTEGER,
    resolution      TEXT                       -- what would close it, or what did
);

-- The gaps the site counts. The homepage, /data and the README figure all
-- read this view, so they cannot disagree with each other or with the table.
CREATE VIEW v_open_gaps AS
SELECT * FROM known_gaps WHERE state = 'open' ORDER BY id;

CREATE TABLE discrepancies (
    id              INTEGER PRIMARY KEY,
    subject         TEXT NOT NULL,
    field           TEXT NOT NULL,
    stored_value    TEXT,
    derived_value   TEXT,
    assessment      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open'
);

-- Shared poles and fastest laps: one row per driver credited. Used because
-- several early races had two or more drivers set identical times, and the
-- official record credits every one of them.

-- --------------------------------------- pole / fastest lap views (v2.2)


-- Pole + win + fastest lap in the same race




-- =====================================================================
-- Race views (v2.4)
--
-- The first two reproduce the pre-v2.4 `race_results` and `race_credits`
-- tables exactly, so anything written against them keeps working. New
-- queries should go to races / race_entries.
-- =====================================================================
CREATE VIEW race_results AS
SELECT r.id, r.year, r.round, r.name_used AS gp_name, r.gp_id, r.circuit_id,
       w.driver_id       AS winner_id,
       wd.full_name      AS winner,
       cw.driver_id      AS co_winner_id,
       w.constructor_id  AS constructor_id,
       cn.name           AS constructor,
       w.entrant         AS entrant,
       pd.full_name      AS pole,
       p.driver_id       AS pole_id,
       fd.full_name      AS fastest_lap,
       f.driver_id       AS fastest_lap_id,
       r.note, r.confidence, r.source
FROM races r
LEFT JOIN race_entries w  ON w.race_id = r.id AND w.finish_position = 1
                         AND w.id = (SELECT MIN(id) FROM race_entries
                                     WHERE race_id = r.id AND finish_position = 1)
LEFT JOIN race_entries cw ON cw.race_id = r.id AND cw.finish_position = 1
                         AND cw.id != w.id
LEFT JOIN race_entries p  ON p.race_id = r.id AND p.pole = 1
LEFT JOIN race_entries f  ON f.race_id = r.id AND f.fastest_lap = 1
                         AND f.id = (SELECT MIN(id) FROM race_entries
                                     WHERE race_id = r.id AND fastest_lap = 1)
LEFT JOIN drivers wd      ON wd.id = w.driver_id
LEFT JOIN drivers pd      ON pd.id = p.driver_id
LEFT JOIN drivers fd      ON fd.id = f.driver_id
LEFT JOIN constructors cn ON cn.id = w.constructor_id;

CREATE VIEW race_credits AS
SELECT r.year, r.round, 'pole' AS credit_type, e.driver_id, 1 AS shared_with
FROM races r JOIN race_entries e ON e.race_id = r.id WHERE e.pole = 1
UNION ALL
SELECT r.year, r.round, 'fastest_lap', e.driver_id,
       COALESCE(e.fastest_lap_shared, 1)
FROM races r JOIN race_entries e ON e.race_id = r.id WHERE e.fastest_lap = 1;

CREATE VIEW v_race_winners AS
SELECT r.year, r.round, r.name_used AS gp_name, g.name AS grand_prix,
       ci.name AS circuit,
       d.full_name AS winner, d2.full_name AS co_winner,
       c.name AS constructor, e.entrant, r.confidence
FROM races r
JOIN race_entries e ON e.race_id = r.id AND e.finish_position = 1
                   AND e.id = (SELECT MIN(id) FROM race_entries
                               WHERE race_id = r.id AND finish_position = 1)
LEFT JOIN race_entries e2 ON e2.race_id = r.id AND e2.finish_position = 1 AND e2.id != e.id
LEFT JOIN drivers d       ON d.id  = e.driver_id
LEFT JOIN drivers d2      ON d2.id = e2.driver_id
LEFT JOIN constructors c  ON c.id  = e.constructor_id
LEFT JOIN grands_prix g   ON g.id  = r.gp_id
LEFT JOIN circuits ci     ON ci.id = r.circuit_id
ORDER BY r.year, r.round;

CREATE VIEW v_wins_by_driver AS
SELECT d.full_name, d.nationality, COUNT(*) AS wins,
       MIN(r.year) AS first_win, MAX(r.year) AS last_win, d.titles
FROM race_entries e JOIN races r ON r.id = e.race_id JOIN drivers d ON d.id = e.driver_id
WHERE e.finish_position = 1
GROUP BY d.id ORDER BY wins DESC, first_win;

CREATE VIEW v_wins_by_constructor AS
SELECT c.name, c.country, COUNT(DISTINCT e.race_id) AS wins,
       MIN(r.year) AS first_win, MAX(r.year) AS last_win, c.constructors_titles
FROM race_entries e JOIN races r ON r.id = e.race_id
JOIN constructors c ON c.id = e.constructor_id
WHERE e.finish_position = 1
GROUP BY c.id ORDER BY wins DESC;

CREATE VIEW v_wins_by_decade AS
SELECT (r.year/10)*10 AS decade, d.full_name, COUNT(*) AS wins
FROM race_entries e JOIN races r ON r.id = e.race_id JOIN drivers d ON d.id = e.driver_id
WHERE e.finish_position = 1
GROUP BY decade, d.id ORDER BY decade, wins DESC;

CREATE VIEW v_poles_by_driver AS
SELECT d.full_name, d.nationality, COUNT(*) AS poles,
       MIN(r.year) AS first_pole, MAX(r.year) AS last_pole
FROM race_entries e JOIN races r ON r.id = e.race_id JOIN drivers d ON d.id = e.driver_id
WHERE e.pole = 1
GROUP BY d.id ORDER BY poles DESC, first_pole;

CREATE VIEW v_fastest_laps_by_driver AS
SELECT d.full_name, d.nationality, COUNT(*) AS fastest_laps,
       MIN(r.year) AS first, MAX(r.year) AS last,
       SUM(CASE WHEN e.fastest_lap_shared > 1 THEN 1 ELSE 0 END) AS shared
FROM race_entries e JOIN races r ON r.id = e.race_id JOIN drivers d ON d.id = e.driver_id
WHERE e.fastest_lap = 1
GROUP BY d.id ORDER BY fastest_laps DESC;

CREATE VIEW v_grand_slams AS
SELECT r.year, r.round, r.name_used AS gp_name, d.full_name AS driver,
       c.name AS constructor
FROM races r
JOIN race_entries e ON e.race_id = r.id
JOIN drivers d ON d.id = e.driver_id
LEFT JOIN constructors c ON c.id = e.constructor_id
WHERE e.pole = 1 AND e.finish_position = 1 AND e.fastest_lap = 1
ORDER BY r.year, r.round;

CREATE VIEW v_pole_to_win AS
SELECT r.year, COUNT(*) AS races,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM race_entries e
                             WHERE e.race_id = r.id AND e.pole = 1
                               AND e.finish_position = 1) THEN 1 ELSE 0 END) AS pole_converted
FROM races r WHERE r.status = 'completed'
GROUP BY r.year ORDER BY r.year;

-- One row per entity in a season's FINAL table - the question everyone asks
-- of standings, and the one the raw table answers wrongly.
--
-- after_round IS NULL holds the end-of-season classification, but not one row
-- per entity, for two different reasons and only one of them is a duplicate:
--
--   Two sources describing one season. 2026 carries a formula1.com row (team,
--   no engine) and an F1DB row (engine, position, more recent points) for
--   every driver and team. Rendered naively, everyone appears twice, and the
--   compat export shipped exactly that for seven releases.
--
--   One source asserting two entries. Force India was excluded from the 2018
--   constructors' championship on 0 points and its successor scored 52 under
--   the same id; Cooper contested 1960 with three engines. Those rows all
--   belong in the table, and collapsing them would delete a fact.
--
-- The source tells them apart, by construction: two rows from DIFFERENT
-- sources are two descriptions of one thing, two rows from ONE source are two
-- things. So per entity the view keeps every row from one source - the one
-- whose table has counted the most rounds; formula1.com where both stand
-- after the same round - and fills position, position_text, engine_id and
-- team from the other source where the kept row lacks them. Same columns as
-- the table, so a consumer swaps the name and nothing else. For a finished
-- season the sources agree and this is the identity.
--
-- The freshest row, not the largest. The rule was "the higher total", on the
-- reasoning that points only accumulate - which holds only while both sources
-- stand after the same round. In 2026 the official snapshot stood after
-- round 12 and F1DB after round 14, and the larger figure kept Gasly and
-- Alpine on the round-12 table beside every other row at round 14 (AF-35).
-- How many rounds a row has counted is read from what as_of says: a snapshot
-- names its round ('... (after round 12)'); 'current' is the source's own
-- latest running table, which verify.py holds it to; 'final' is the whole
-- season. A row whose moment cannot be read sorts last.
--
-- Written for the two sources that exist: formula1.com and F1DB. The tie-break
-- names one of them, and the fill takes the lowest-id row of "the other", so a
-- third source would need this revisited - verify.py's checks on which row
-- survives and what it was filled from are what would say so.
CREATE VIEW v_standings_final AS
WITH final AS (SELECT * FROM standings WHERE after_round IS NULL),
counted AS (
  SELECT c.year, c.table_type, c.entity_id, c.source,
         CASE
           WHEN c.as_of LIKE '%(after round %)'
             THEN CAST(SUBSTR(c.as_of, INSTR(c.as_of, '(after round ') + 13) AS INTEGER)
           WHEN c.as_of = 'current'
             THEN (SELECT MAX(x.after_round) FROM standings x
                    WHERE x.year = c.year AND x.source = c.source
                      AND x.after_round IS NOT NULL)
           WHEN c.as_of = 'final'
             THEN (SELECT MAX(r.round) FROM races r WHERE r.year = c.year)
         END AS rounds
    FROM final c),
ranked AS (
  SELECT year, table_type, entity_id, source,
         ROW_NUMBER() OVER (
           PARTITION BY year, table_type, entity_id
           ORDER BY MAX(rounds) IS NULL, MAX(rounds) DESC,
                    CASE WHEN source LIKE '%formula1.com%' THEN 0 ELSE 1 END) AS rank
    FROM counted GROUP BY year, table_type, entity_id, source)
SELECT f.id, f.year, f.table_type,
       COALESCE(f.position, o.position)           AS position,
       COALESCE(f.position_text, o.position_text) AS position_text,
       f.entity, f.entity_id,
       COALESCE(f.engine_id, o.engine_id)         AS engine_id,
       COALESCE(f.team, o.team)                   AS team,
       f.points, f.after_round, f.as_of, f.confidence, f.source
  FROM final f
  JOIN ranked k ON k.year = f.year AND k.table_type = f.table_type
               AND k.entity_id = f.entity_id AND k.source = f.source AND k.rank = 1
  LEFT JOIN final o ON o.id = (SELECT MIN(x.id) FROM final x
                                WHERE x.year = f.year AND x.table_type = f.table_type
                                  AND x.entity_id = f.entity_id AND x.source <> f.source);

CREATE VIEW v_stat_reconciliation AS
SELECT d.full_name,
       d.wins AS derived_wins, d.wins_external,
       d.poles AS derived_poles, d.poles_external,
       d.fastest_laps AS derived_fl, d.fastest_laps_external,
       d.last_season, d.confidence
FROM drivers d
WHERE d.wins_external IS NOT NULL OR d.poles_external IS NOT NULL
ORDER BY d.wins DESC;

-- Every event, with how many times it has been held and where
CREATE VIEW v_grands_prix AS
SELECT g.id, g.name, g.country, COUNT(r.id) AS editions,
       MIN(r.year) AS first_held, MAX(r.year) AS last_held,
       COUNT(DISTINCT r.circuit_id) AS circuits_recorded,
       COUNT(r.circuit_id) || '/' || COUNT(r.id) AS circuit_coverage
FROM grands_prix g LEFT JOIN races r ON r.gp_id = g.id
GROUP BY g.id ORDER BY editions DESC;

-- The calendar is the race table seen as a schedule. It was a separate table
-- until v2.4, which meant the 2026 season existed in two places.
CREATE VIEW calendar AS
SELECT r.id, r.year, r.round, r.name_used AS gp_name, r.gp_id,
       g.country, ci.locality AS city, r.circuit_id, ci.name AS circuit_name,
       r.dates, r.sprint, r.status, r.confidence, r.source
FROM races r
LEFT JOIN grands_prix g ON g.id = r.gp_id
LEFT JOIN circuits ci   ON ci.id = r.circuit_id
ORDER BY r.year, r.round;

-- ------------------------------------------------------------- circuits
-- Every circuit with its championship record, in one row.
CREATE VIEW v_circuits AS
SELECT c.id, c.name, c.country, c.locality, c.circuit_type,
       COUNT(CASE WHEN r.status='completed' THEN 1 END) AS races,
       COUNT(CASE WHEN r.status!='completed' THEN 1 END) AS scheduled,
       MIN(CASE WHEN r.status='completed' THEN r.year END) AS first_gp,
       MAX(CASE WHEN r.status='completed' THEN r.year END) AS last_gp,
       COUNT(DISTINCT CASE WHEN r.status='completed' THEN r.year END)
                                 AS seasons_used,
       COUNT(DISTINCT CASE WHEN r.status='completed' THEN r.gp_id END)
                                 AS events_hosted,
       (SELECT COUNT(*) FROM circuit_layouts l WHERE l.circuit_id = c.id)
                                 AS layouts,
       c.length_km, c.turns, c.direction
FROM circuits c LEFT JOIN races r ON r.circuit_id = c.id
GROUP BY c.id ORDER BY races DESC, c.name;

-- ------------------------------------------------------------- seasons

-- The grid of a season, counted rather than written: who was entered (from
-- the race entries - entered, not started: a DNQ is an entry, and no source
-- here says who started), which constructors entered, whose engines. The
-- Wikipedia infobox states these three for the current season by hand; here
-- they hold for every season. Constructors are counted by the F1DB key, which
-- every entrant row carries: the curated constructor_id is NULL for the
-- Indianapolis 500 builders of 1950-1960, and counting it read 1950 as eight
-- constructors when twenty-three entered - the review of #73 caught it.
CREATE VIEW v_season_grid AS
SELECT s.year,
       -- NULLIF, not the bare count: a season whose calendar has been
       -- announced and whose entries nobody has published yet has no grid
       -- ESTABLISHED, which is not the same claim as a grid of nobody. Every
       -- season that has run has a non-zero count, so this only ever speaks
       -- for one that has not.
       NULLIF((SELECT COUNT(DISTINCT e.driver_id) FROM race_entries e
          JOIN races r ON r.id = e.race_id WHERE r.year = s.year), 0)     AS drivers,
       NULLIF((SELECT COUNT(DISTINCT se.f1db_constructor_id) FROM season_entrants se
         WHERE se.year = s.year), 0)                                      AS constructors,
       NULLIF((SELECT COUNT(DISTINCT se.engine_manufacturer_id) FROM season_entrants se
         WHERE se.year = s.year AND se.engine_manufacturer_id IS NOT NULL), 0) AS engine_manufacturers,
       (SELECT COUNT(*) FROM races r WHERE r.year = s.year
          AND r.status = 'completed')                                    AS races_run
  FROM seasons s;

-- Who has won most often at each circuit.
CREATE VIEW v_circuit_winners AS
SELECT r.circuit_id, c.name AS circuit, e.driver_id, d.full_name AS driver,
       COUNT(DISTINCT r.id) AS wins,
       MIN(r.year) AS first_win, MAX(r.year) AS last_win
FROM races r
JOIN race_entries e ON e.race_id = r.id AND e.finish_position = 1
JOIN circuits c     ON c.id = r.circuit_id
JOIN drivers d      ON d.id = e.driver_id
GROUP BY r.circuit_id, e.driver_id
ORDER BY r.circuit_id, wins DESC, driver;

-- The same for constructors.
CREATE VIEW v_circuit_constructors AS
SELECT r.circuit_id, c.name AS circuit, e.constructor_id,
       t.name AS constructor, COUNT(DISTINCT r.id) AS wins,
       MIN(r.year) AS first_win, MAX(r.year) AS last_win
FROM races r
JOIN race_entries e  ON e.race_id = r.id AND e.finish_position = 1
JOIN circuits c      ON c.id = r.circuit_id
JOIN constructors t  ON t.id = e.constructor_id
GROUP BY r.circuit_id, e.constructor_id
ORDER BY r.circuit_id, wins DESC, constructor;

-- Countries ranked by how much championship racing they have held.
-- Circuits with a traced centreline, and how far the trace sits from the
-- length that admitted it. Sorted worst-first: the interesting row is always
-- the one closest to the tolerance, not the one that matched exactly.
CREATE VIEW v_circuit_geometry AS
SELECT g.circuit_id, c.name AS circuit, c.country,
       COALESCE(g.layout_key, '-') AS layout,
       g.measured_km, g.published_km, g.delta_pct,
       g.node_count, g.osm_relation, g.osm_timestamp, g.licence,
       -- The coordinates themselves. Without them this view describes a
       -- centreline it cannot draw, which is what it did for one build.
       g.centreline
FROM circuit_geometry g JOIN circuits c ON c.id = g.circuit_id
ORDER BY ABS(g.delta_pct) DESC;

-- What has a trace and what does not, by whether the circuit is still in use.
-- The shape of this is the point: OSM maps the present, so a circuit that
-- stopped hosting Grands Prix in 1976 is not missing its geometry, it has
-- none to have.
CREATE VIEW v_geometry_coverage AS
SELECT CASE WHEN c.last_gp IS NULL THEN 'in use' ELSE 'former' END AS status,
       COUNT(*) AS circuits,
       SUM(CASE WHEN g.circuit_id IS NOT NULL THEN 1 ELSE 0 END) AS traced,
       ROUND(100.0 * SUM(CASE WHEN g.circuit_id IS NOT NULL THEN 1 ELSE 0 END)
             / COUNT(*), 1) AS pct
FROM circuits c LEFT JOIN circuit_geometry g ON g.circuit_id = c.id
GROUP BY status ORDER BY status;

-- Every car that can be illustrated, with the credit that must appear beside
-- it. A row here is a licence obligation, not a decoration: where
-- attribution_required is 1 the artist line is not optional.
CREATE VIEW v_car_images AS
SELECT DISTINCT ch.car_id, c.full_name AS car, i.article,
       i.file_name, i.licence, i.licence_url, i.artist, i.credit,
       i.description_url, i.width, i.height, i.name_matches
FROM article_images i
JOIN chassis ch ON ch.article = i.article
JOIN cars c ON c.id = ch.car_id
WHERE ch.car_id IS NOT NULL;

-- The images whose file name does not mention the car. NOT a list of wrong
-- images - most are correct and simply filed under the driver - but it is
-- where a wrong one will be, and it is the only handle there is.
CREATE VIEW v_images_to_check AS
SELECT i.article, i.file_name, i.licence, i.description_url,
       (SELECT COUNT(*) FROM chassis ch WHERE ch.article = i.article) AS chassis
FROM article_images i
WHERE i.name_matches = 0
ORDER BY chassis DESC, i.article;

CREATE VIEW v_circuits_by_country AS
SELECT c.country, COUNT(DISTINCT c.id) AS circuits, COUNT(r.id) AS races,
       MIN(r.year) AS first_gp, MAX(r.year) AS last_gp,
       GROUP_CONCAT(DISTINCT c.name) AS venues
FROM circuits c LEFT JOIN races r ON r.circuit_id = c.id
                                 AND r.status = 'completed' 
GROUP BY c.country ORDER BY races DESC;

-- Each race with the circuit and the exact configuration in use that year.
CREATE VIEW v_race_venues AS
SELECT r.id AS race_id, r.year, r.round, r.name_used AS gp_name, r.gp_id,
       r.circuit_id, c.name AS circuit, c.country, c.locality,
       l.layout_name, COALESCE(l.length_km, c.length_km) AS length_km,
       COALESCE(l.turns, c.turns) AS turns,
       -- Where the circuit has a researched layout timeline the figures are
       -- those actually raced that year. Otherwise they are the circuit's
       -- current figures, which may not be what was raced.
       CASE WHEN l.id IS NOT NULL THEN 'as raced' ELSE 'current layout' END
            AS figures
FROM races r
LEFT JOIN circuits c ON c.id = r.circuit_id
LEFT JOIN circuit_layouts l ON l.circuit_id = r.circuit_id AND (
       (r.layout_key IS NOT NULL AND l.layout_key = r.layout_key)
    OR (r.layout_key IS NULL AND l.by_year = 1 AND r.year >= l.from_year
        AND (l.to_year IS NULL OR r.year <= l.to_year)))
ORDER BY r.year, r.round;

-- Venues no longer in use, most recently dropped first.
CREATE VIEW v_lost_circuits AS
SELECT c.id, c.name, c.country, COUNT(r.id) AS races,
       MIN(r.year) AS first_gp, MAX(r.year) AS last_gp,
       2026 - MAX(r.year) AS years_since
FROM circuits c JOIN races r ON r.circuit_id = c.id
WHERE NOT EXISTS (SELECT 1 FROM races s WHERE s.circuit_id = c.id AND s.year >= 2025)
GROUP BY c.id
ORDER BY last_gp DESC;

-- ---------------------------------------------------------------- cars
-- The register with its derived competition record.
CREATE VIEW v_cars AS
SELECT c.id, c.full_name AS car, t.name AS constructor, c.from_year, c.to_year,
       c.engine_name, c.engine_config, c.capacity_cc, c.aspiration, c.power_bhp,
       c.chassis_type, c.weight_kg,
       c.races AS recorded_races, c.wins, c.poles, c.fastest_laps,
       c.drivers_titles, c.constructors_titles, c.landmark,
       c.designers, c.concept, c.confidence, c.spec_confidence
FROM cars c JOIN constructors t ON t.id = c.constructor_id
ORDER BY c.wins DESC, c.from_year;

-- Every race a car is known to have won, taken pole for or set fastest lap in.
CREATE VIEW v_car_races AS
SELECT c.id AS car_id, c.full_name AS car, r.year, r.round,
       r.name_used AS gp_name, ci.name AS circuit, d.full_name AS driver,
       CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END AS won,
       e.pole,
       e.fastest_lap
FROM race_entries e
JOIN cars c     ON c.id = e.car_id
JOIN races r    ON r.id = e.race_id
JOIN drivers d  ON d.id = e.driver_id
LEFT JOIN circuits ci ON ci.id = r.circuit_id
ORDER BY r.year, r.round;

-- How the technology moved: one row per car, in the order the cars appeared.
CREATE VIEW v_car_evolution AS
SELECT c.from_year, c.full_name AS car, t.name AS constructor,
       c.chassis_type, c.engine_config, c.aspiration, c.capacity_cc,
       c.power_bhp, c.weight_kg, c.innovations
FROM cars c JOIN constructors t ON t.id = c.constructor_id
WHERE c.landmark = 1
ORDER BY c.from_year, c.full_name;

-- Design lineages: a car and everything descended from it.
CREATE VIEW v_car_lineage AS
WITH RECURSIVE chain(root, id, full_name, from_year, depth) AS (
    SELECT id, id, full_name, from_year, 0 FROM cars WHERE supersedes_id IS NULL
    UNION ALL
    SELECT ch.root, c.id, c.full_name, c.from_year, ch.depth + 1
    FROM cars c JOIN chain ch ON c.supersedes_id = ch.id
)
SELECT root, id, full_name, from_year, depth FROM chain
ORDER BY root, depth;

-- What per-lap data exists, by season, and which source it came from.
-- Empty in the distributed build: both loaders need network access, and both
-- sources are licensed for local use rather than redistribution.
CREATE VIEW v_lap_coverage AS
-- Counted in subqueries rather than by joining both tables to `races` at
-- once. Joining laps AND pit_stops in one query multiplies them: ten laps
-- and two stops in a race renders as twenty laps, because every lap row is
-- paired with every stop row. COUNT(DISTINCT ...) hides it for the ids and
-- not for anything else, which is worse than failing outright.
SELECT r.year,
       COUNT(*) AS races,
       (SELECT COUNT(DISTINCT l.race_id) FROM laps l
        JOIN races x ON x.id = l.race_id WHERE x.year = r.year)
           AS races_with_laps,
       (SELECT COUNT(*) FROM laps l
        JOIN races x ON x.id = l.race_id WHERE x.year = r.year) AS laps,
       (SELECT COUNT(DISTINCT p.race_id) FROM pit_stops p
        JOIN races x ON x.id = p.race_id WHERE x.year = r.year)
           AS races_with_stops,
       (SELECT COUNT(*) FROM pit_stops p
        JOIN races x ON x.id = p.race_id WHERE x.year = r.year) AS pit_stops,
       (SELECT GROUP_CONCAT(DISTINCT l.source) FROM laps l
        JOIN races x ON x.id = l.race_id WHERE x.year = r.year) AS sources
FROM races r
GROUP BY r.year ORDER BY r.year;

-- ------------------------------------------------ the chassis register
--
-- Every chassis that has raced, with whatever specification has been
-- established for it. `specs` says where that came from: 'harvested' where
-- the car's own article was read and accepted, 'register only' where the
-- chassis is known to exist and nothing more.
CREATE VIEW v_chassis AS
SELECT ch.id, ch.full_name AS chassis, COALESCE(t.name, ch.f1db_constructor_id)
           AS constructor,
       ch.first_year, ch.last_year, ch.seasons,
       ch.races AS recorded_races, ch.wins, ch.published_wins,
       ch.engine_name, ch.engine_config, ch.capacity_cc, ch.aspiration,
       ch.power_bhp, ch.chassis_type, ch.weight_kg, ch.wheelbase_mm,
       ch.car_id, ch.article,
       CASE WHEN ch.article IS NULL THEN 'register only' ELSE 'harvested' END
           AS specs
FROM chassis ch LEFT JOIN constructors t ON t.id = ch.constructor_id
ORDER BY ch.first_year, ch.full_name;

-- What the chassis register actually covers, by decade. The shape of this is
-- the finding, not an accident: a modern team runs one car all season and the
-- entry list settles it, while a 1960s "constructor" was a name several
-- privateers entered several different chassis under, and the season settles
-- nothing.
CREATE VIEW v_chassis_coverage AS
SELECT (r.year / 10) * 10 AS decade,
       COUNT(*) AS race_entries,
       SUM(CASE WHEN e.chassis_id IS NOT NULL THEN 1 ELSE 0 END) AS with_chassis,
       ROUND(100.0 * SUM(CASE WHEN e.chassis_id IS NOT NULL THEN 1 ELSE 0 END)
             / COUNT(*), 1) AS pct
FROM race_entries e JOIN races r ON r.id = e.race_id
GROUP BY decade ORDER BY decade;

-- Every constructor-season the entry lists cannot resolve to one chassis,
-- with the chassis it was choosing between. This is the open half of
-- known_gaps #3, listed rather than described.
CREATE VIEW v_ambiguous_seasons AS
SELECT se.year, COALESCE(t.name, se.f1db_constructor_id) AS constructor,
       GROUP_CONCAT(DISTINCT se.chassis_ids) AS chassis,
       (SELECT COUNT(*) FROM race_entries e JOIN races r ON r.id = e.race_id
        WHERE r.year = se.year AND e.constructor_id = se.constructor_id)
           AS unlinked_entries
FROM season_entrants se LEFT JOIN constructors t ON t.id = se.constructor_id
WHERE se.chassis_ids IS NOT NULL
GROUP BY se.year, se.f1db_constructor_id
HAVING COUNT(DISTINCT se.chassis_ids) > 1 OR MAX(se.chassis_count) > 1
ORDER BY unlinked_entries DESC, se.year;

-- What each season's rules capped or required, next to nothing else.
CREATE VIEW v_regulation_limits AS
SELECT field, from_year, to_year, value, unit, note, confidence, source
FROM regulation_limits ORDER BY field, from_year;
