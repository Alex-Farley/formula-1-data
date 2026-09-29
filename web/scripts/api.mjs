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

const db = new DatabaseSync(join(repo, 'f1.db'), { readOnly: true })
const all = (sql, ...params) => db.prepare(sql).all(...params)
const one = (sql, ...params) => db.prepare(sql).get(...params) ?? null

const manifest = JSON.parse(readFileSync(join(dist, 'db-manifest.json'), 'utf8'))
const metaRow = (key) => one('SELECT value FROM meta WHERE key = ?', key)?.value ?? null

/** What every file says about itself. */
const META = {
  api: 'lapledger/v1',
  version: metaRow('version'),
  built: metaRow('built'),
  // The digest of the f1.db these files were written from, as /data states it.
  database_sha256: manifest.sha256 ?? null,
  // CC BY-SA 4.0, bar five columns of the project's own writing under CC BY
  // 4.0: LICENSE-DATA says which, and names these files among those it
  // covers.
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
for (const d of drivers) {
  write(`drivers/${d.id}`, {
    driver: d,
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

const circuits = all('SELECT * FROM circuits ORDER BY name')
write(
  'circuits',
  circuits.map(({ id, name, locality, country }) => ({
    id,
    name,
    locality,
    country,
    href: `${BASE}api/v1/circuits/${id}.json`,
  })),
)
const racesAt = db.prepare(`
  SELECT r.*, (SELECT e.driver_id FROM race_entries e WHERE e.race_id = r.id AND e.finish_position = 1
                ORDER BY e.id LIMIT 1) AS winner_id
    FROM races r WHERE r.circuit_id = ? ORDER BY r.year, r.round`)
for (const c of circuits) write(`circuits/${c.id}`, { circuit: c, races: racesAt.all(c.id) })

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
const pitsOf = db.prepare('SELECT * FROM pit_stops WHERE race_id = ? ORDER BY stop_number, id')
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
