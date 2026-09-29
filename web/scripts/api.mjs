#!/usr/bin/env node
/**
 * The static JSON API: the database, one file per thing a reader looks up.
 *
 *   /api/v1/index.json                    what this is, and every endpoint
 *   /api/v1/drivers.json                  the register, one row each
 *   /api/v1/drivers/{id}.json             a driver, every entry, every session
 *   /api/v1/constructors.json             the register
 *   /api/v1/constructors/{id}.json        a constructor, its seasons and wins
 *   /api/v1/circuits.json                 the register
 *   /api/v1/circuits/{id}.json            a circuit and every race held there
 *   /api/v1/seasons.json                  every season
 *   /api/v1/seasons/{year}.json           the calendar and the final tables
 *   /api/v1/races/{year}/{round}.json     a weekend: every session's sheet
 *
 * WHY STATIC
 *     Every query on this site runs in the reader's browser against f1.db;
 *     there is no server to ask. A live endpoint would be one - a running
 *     service with a cost, a rate limit and an abuse problem - for data that
 *     changes a few times a week. So the API is files, written at build time
 *     beside the pages from the same database, and served by the same host.
 *     It changes when the site does, and never disagrees with it.
 *
 * WHAT IS IN A FILE
 *     The rows as the database holds them - `SELECT *`, never a typed column
 *     list, so a column added to a table arrives here without an edit - with
 *     the names a reader needs joined beside the ids. Every file carries the
 *     licence and where the attribution is, because a file is read far from
 *     the page that explains it. NULL stays null: it means "not established",
 *     as it does everywhere else in this project.
 *
 * Run after prerender, from web/, as the last step of `npm run build`. It
 * writes under dist/api/v1 and fails the build on any error: a half-written
 * API is worse than none.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const web = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(web, '..')
const dist = join(web, 'dist')
const root = join(dist, 'api', 'v1')

const ORIGIN = (process.env.SITE_ORIGIN ?? 'https://lapledger.org').replace(/\/$/, '')
const BASE = (process.env.SITE_BASE ?? '/').replace(/\/*$/, '/')

// LAPLEDGER_DB is for the test that plants what the refusal exists for.
const db = new DatabaseSync(process.env.LAPLEDGER_DB ?? join(repo, 'f1.db'), { readOnly: true })
const all = (sql, ...params) => db.prepare(sql).all(...params)
const one = (sql, ...params) => db.prepare(sql).get(...params) ?? null

// REFUSED BEFORE ANYTHING IS WRITTEN (review of #711). An API exists to be
// handed to somebody, and the f1.db beside this script can be a local copy:
// the timing loaders write into it, and tools/geometry_overlay.py merges
// ODbL centrelines into it. The deploy builds from the committed file, which
// CI has already held to verify.py - but a local `npm run build` does not,
// so this stops the way tools/parquet_export.py does, naming what to undo.
const SERVED = [
  'drivers', 'constructors', 'circuits', 'seasons', 'races', 'race_entries',
  'qualifying', 'sprint_results', 'sprint_qualifying', 'practice', 'pit_stops',
  'season_entrants', 'sessions', 'standings', 'driver_note_sources',
]
const refuse = (why) => {
  console.error(`\nREFUSED: ${why}\nThe API is a redistribution format; nothing was written.\n`)
  process.exit(1)
}
for (const table of ['laps', 'stints', 'race_timing', 'race_control_messages']) {
  const n = one(`SELECT COUNT(*) AS n FROM ${table}`).n
  if (n) refuse(`${table} holds ${n} rows of FOM-owned timing, from a local load. Rebuild without it (python3 build.py).`)
}
{
  const n = one('SELECT COUNT(*) AS n FROM circuit_geometry').n
  if (n) refuse(`circuit_geometry holds ${n} OpenStreetMap rows under ODbL. Remove the overlay (python3 tools/geometry_overlay.py --remove).`)
}
{
  const n = one("SELECT COUNT(*) AS n FROM pit_stops WHERE source IS NOT 'f1db'").n
  if (n) refuse(`pit_stops holds ${n} rows from a source other than F1DB, from a local load. Rebuild without it (python3 build.py).`)
}
for (const table of SERVED) {
  const n = one(`SELECT COUNT(*) AS n FROM ${table} t
                  WHERE (t.source_id IS NULL AND t.source IS NOT NULL)
                     OR t.source_id IN (SELECT id FROM source_registry WHERE redistributable = 'no')`).n
  if (n) refuse(`${table} holds ${n} rows citing a source that may not be passed on, or none the registry classifies. Rebuild (python3 build.py) and run verify.py.`)
}

const manifest = JSON.parse(readFileSync(join(dist, 'db-manifest.json'), 'utf8'))
const metaRow = (key) => one('SELECT value FROM meta WHERE key = ?', key)?.value ?? null

/** What every file says about itself. */
const META = {
  api: 'lapledger/v1',
  version: metaRow('version'),
  built: metaRow('built'),
  // The digest of the f1.db these files were written from, as /data states it.
  database_sha256: manifest.sha256 ?? null,
  // CC BY-SA 4.0 - the five columns LICENSE-DATA puts under CC BY 4.0 are
  // in tables this API does not serve - and LICENSE-DATA names these files
  // among those it covers.
  licence: 'CC BY-SA 4.0',
  licence_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
  terms: `${ORIGIN}${BASE}LICENSE-DATA`,
  attribution: `${ORIGIN}${BASE}data/sources`,
  documentation: `${ORIGIN}${BASE}data`,
}

let files = 0
const write = (path, data) => {
  const file = join(root, `${path}.json`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ meta: META, data })}\n`)
  files += 1
}

// ---------------------------------------------------------------- drivers

const drivers = all(`
  SELECT d.*, (SELECT COUNT(*) FROM race_entries e WHERE e.driver_id = d.id) AS race_entries
    FROM drivers d ORDER BY d.full_name`)
write(
  'drivers',
  drivers.map(({ id, full_name, nationality, first_season, last_season, race_entries, wins, titles, practice_only }) => ({
    id,
    full_name,
    nationality,
    first_season,
    last_season,
    race_entries,
    wins,
    titles,
    practice_only,
    href: `${BASE}api/v1/drivers/${id}.json`,
  })),
)
const entriesOf = db.prepare(`
  SELECT r.year, r.round, r.name_used AS race, k.name AS constructor_name, e.*
    FROM race_entries e JOIN races r ON r.id = e.race_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE e.driver_id = ? ORDER BY r.year, r.round`)
const qualifyingOf = db.prepare(`
  SELECT r.year, r.round, q.* FROM qualifying q JOIN races r ON r.id = q.race_id
   WHERE q.driver_id = ? ORDER BY r.year, r.round`)
const practiceOf = db.prepare(`
  SELECT r.year, r.round, p.* FROM practice p JOIN races r ON r.id = p.race_id
   WHERE p.driver_id = ? ORDER BY r.year, r.round, p.session`)
// The driver row's `source` is F1DB's, for the name, dates and nationality.
// A note written from another source cites it in driver_note_sources, and
// that citation travels with the note here as it does on the page (LV-08).
const noteSourceOf = db.prepare('SELECT * FROM driver_note_sources WHERE driver_id = ?')
for (const d of drivers) {
  write(`drivers/${d.id}`, {
    driver: d,
    note_source: noteSourceOf.get(d.id) ?? null,
    entries: entriesOf.all(d.id),
    qualifying: qualifyingOf.all(d.id),
    practice: practiceOf.all(d.id),
  })
}

// ------------------------------------------------------------ constructors

const constructors = all('SELECT * FROM constructors ORDER BY name')
write(
  'constructors',
  constructors.map(({ id, name, country, first_entry, last_entry }) => ({
    id,
    name,
    country,
    first_entry,
    last_entry,
    href: `${BASE}api/v1/constructors/${id}.json`,
  })),
)
const seasonsOf = db.prepare('SELECT * FROM season_entrants WHERE constructor_id = ? ORDER BY year')
const winsOf = db.prepare(`
  SELECT r.year, r.round, r.name_used AS race, e.driver_id, d.full_name AS driver_name
    FROM race_entries e JOIN races r ON r.id = e.race_id
    LEFT JOIN drivers d ON d.id = e.driver_id
   WHERE e.constructor_id = ? AND e.finish_position = 1 ORDER BY r.year, r.round`)
for (const k of constructors) {
  write(`constructors/${k.id}`, { constructor: k, seasons: seasonsOf.all(k.id), wins: winsOf.all(k.id) })
}

// ---------------------------------------------------------------- circuits

// A circuit's first and last Grand Prix two ways, as its page gives them
// (circuit.js): derived from the race records by v_circuits, and stored.
// Neither replaces the other. The stored last_gp is NULL for a circuit in
// use - which alone would read as "not established" - and is 2027 for
// Istanbul and Portimao, whose next race is scheduled and not yet run, which
// the derived figure cannot know (reviews of #711). So the stored row keeps
// its own columns and the view's figures sit beside them as races,
// scheduled, derived_first_gp and derived_last_gp. The list is the view's,
// as the circuits page is.
const derived = new Map(all('SELECT * FROM v_circuits').map((c) => [c.id, c]))
const circuits = all('SELECT * FROM circuits ORDER BY name').map((c) => {
  const v = derived.get(c.id) ?? {}
  return { ...c, races: v.races ?? null, scheduled: v.scheduled ?? null, derived_first_gp: v.first_gp ?? null, derived_last_gp: v.last_gp ?? null }
})
write(
  'circuits',
  circuits.map(({ id, name, locality, country, races, derived_first_gp, derived_last_gp }) => ({
    id,
    name,
    locality,
    country,
    races,
    first_gp: derived_first_gp,
    last_gp: derived_last_gp,
    href: `${BASE}api/v1/circuits/${id}.json`,
  })),
)
// Every winner, not the first: three races were shared wins - Reims 1951,
// Buenos Aires 1956, Aintree 1957 - and a single field would drop a driver's
// win without saying so (review of #711).
const winners = new Map()
for (const { race_id, driver_id } of all(
  'SELECT race_id, driver_id FROM race_entries WHERE finish_position = 1 ORDER BY race_id, id',
)) {
  winners.set(race_id, [...(winners.get(race_id) ?? []), driver_id])
}
const racesAt = db.prepare('SELECT * FROM races WHERE circuit_id = ? ORDER BY year, round')
for (const c of circuits) {
  write(`circuits/${c.id}`, {
    circuit: c,
    races: racesAt.all(c.id).map((r) => ({ ...r, winner_ids: winners.get(r.id) ?? [] })),
  })
}

// ----------------------------------------------------------------- seasons

const seasons = all('SELECT * FROM seasons ORDER BY year')
write(
  'seasons',
  seasons.map(({ year, rounds, drivers_champion }) => ({
    year,
    rounds,
    drivers_champion,
    href: `${BASE}api/v1/seasons/${year}.json`,
  })),
)
const calendarOf = db.prepare('SELECT * FROM races WHERE year = ? ORDER BY round')
const finalOf = db.prepare('SELECT * FROM v_standings_final WHERE year = ? ORDER BY table_type, position')
for (const s of seasons) {
  write(`seasons/${s.year}`, { season: s, races: calendarOf.all(s.year), standings: finalOf.all(s.year) })
}

// ------------------------------------------------------------------- races

const sheet = (table, extra = '') =>
  db.prepare(`
    SELECT t.*, d.full_name AS driver_name, k.name AS constructor_name
      FROM ${table} t
      LEFT JOIN drivers d ON d.id = t.driver_id
      LEFT JOIN constructors k ON k.id = t.constructor_id
     WHERE t.race_id = ? ORDER BY ${extra}t.id`)
const RACE = {
  classification: sheet('race_entries'),
  qualifying: sheet('qualifying'),
  sprint: sheet('sprint_results'),
  sprint_qualifying: sheet('sprint_qualifying'),
  practice: sheet('practice', 't.session, '),
}
// F1DB's only, on top of the refusal above: the one table a local load adds rows to.
const pitsOf = db.prepare("SELECT * FROM pit_stops WHERE race_id = ? AND source = 'f1db' ORDER BY stop_number, id")
const sessionsOf = db.prepare('SELECT * FROM sessions WHERE race_id = ? ORDER BY start_utc')
for (const r of all('SELECT * FROM races ORDER BY year, round')) {
  write(`races/${r.year}/${r.round}`, {
    race: r,
    sessions: sessionsOf.all(r.id),
    ...Object.fromEntries(Object.entries(RACE).map(([name, q]) => [name, q.all(r.id)])),
    pit_stops: pitsOf.all(r.id),
  })
}

// ------------------------------------------------------------------- index

write('index', {
  description:
    'The Lap Ledger Formula One database, 1950 to now, as static JSON: one file per driver, constructor, circuit, season and race weekend, written from the same f1.db the site runs on.',
  endpoints: {
    drivers: `${BASE}api/v1/drivers.json`,
    driver: `${BASE}api/v1/drivers/{id}.json`,
    constructors: `${BASE}api/v1/constructors.json`,
    constructor: `${BASE}api/v1/constructors/{id}.json`,
    circuits: `${BASE}api/v1/circuits.json`,
    circuit: `${BASE}api/v1/circuits/{id}.json`,
    seasons: `${BASE}api/v1/seasons.json`,
    season: `${BASE}api/v1/seasons/{year}.json`,
    race: `${BASE}api/v1/races/{year}/{round}.json`,
  },
  notes: {
    drivers:
      'race_entries is counted from the race records; entries and starts are the published figures, held for a few drivers, and are kept beside it rather than replaced by it. practice_only is 1 for a driver who drove in practice (or sprint qualifying) with no race entry and no qualifying row.',
    circuits:
      'In circuits.json, races, first_gp and last_gp are derived from the race records, as the circuits page shows them. A circuit file keeps its stored first_gp and last_gp (last_gp null while in use, or a scheduled year) and gives the derived ones beside them as derived_first_gp and derived_last_gp, as the circuit page does.',
    shared_drives: 'A shared drive puts two drivers on one finishing position; winner_ids is a list for that reason.',
    nulls: 'null means not established; it is never a zero.',
  },
  counts: {
    drivers: drivers.length,
    constructors: constructors.length,
    circuits: circuits.length,
    seasons: seasons.length,
    races: one('SELECT COUNT(*) AS n FROM races').n,
  },
})

db.close()
console.log(`  api: ${files.toLocaleString('en-GB')} files under dist/api/v1`)
