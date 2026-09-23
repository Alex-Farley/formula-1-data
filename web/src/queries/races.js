/**
 * The races list: its query and its columns, read by Races.jsx and by
 * scripts/prerender.js (PD-02, rung two).
 *
 * WHY THIS FILE EXISTS
 *     The static list had six columns to the app's eight, "Rd" against "R"
 *     and "Constructor" against "Car", and a scheduled race's winner was
 *     "to come" in one renderer and "not yet run" in the other. And both
 *     opened with ten races that have not happened above the last one that
 *     has (IA-17). The definition lives here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { text } from '../lib/format.js'
import { NOT_YET_RUN, SHARED, SPRINT } from '../lib/site.js'

/**
 * Every championship race, the ones that have run first and newest first
 * among them, then the ones still to come, soonest first. The last race run
 * is the row a reader arriving here most likely wants, and it was tenth.
 * "Soonest first" holds across seasons too: both the season and the round
 * run backwards for a race that has been run and forwards for one to come, so
 * the next race heads the scheduled block rather than a later season's
 * opener (AF-44).
 */
/**
 * The last race actually run: what the overview opens on, and the season its
 * onward band offers. It sat in Home.jsx until scripts/prerender.js needed
 * the same row to write the same band (IA-03), and a second copy of "latest"
 * is how the two renderers would have come to disagree about which race that
 * is.
 */
export const LATEST = `
  SELECT r.year, r.round, r.name_used, r.dates, c.name AS circuit,
         d.full_name AS winner, d.id AS winner_id,
         k.name AS constructor, k.id AS constructor_id, k.country AS constructor_country
    FROM races r
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN race_entries e ON e.race_id = r.id AND e.finish_position = 1
    LEFT JOIN drivers d ON d.id = e.driver_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE r.status = 'completed'
   ORDER BY r.year DESC, r.round DESC
   LIMIT 1
`

export const RACES = `
  SELECT rr.year, rr.round, rr.gp_name, rr.gp_id, rr.circuit_id, c.name AS circuit, c.country,
         rr.winner, rr.winner_id, rr.co_winner_id, rr.constructor, rr.constructor_id,
         k.country AS constructor_country,
         rr.pole, rr.pole_id, rr.fastest_lap, rr.fastest_lap_id, r.status, r.sprint
    FROM race_results rr
    JOIN races r ON r.id = rr.id
    LEFT JOIN circuits c ON c.id = rr.circuit_id
    LEFT JOIN constructors k ON k.id = rr.constructor_id
   ORDER BY r.status = 'scheduled',
            CASE WHEN r.status = 'scheduled' THEN rr.year ELSE -rr.year END,
            CASE WHEN r.status = 'scheduled' THEN rr.round ELSE -rr.round END
`

/** "Dutch Grand Prix sprint": the name, and the sprint mark where the weekend had one. */
export const raceName = (name, row) => (row.sprint ? `${text(name)} ${SPRINT}` : text(name))

/** The winner, "not yet run" for a calendar entry with no result, "shared" for two winners. */
export const raceWinner = (name, row) =>
  row.status !== 'completed' ? NOT_YET_RUN : row.co_winner_id ? `${text(name)} ${SHARED}` : text(name)

export const RACE_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'round', label: 'R', align: 'num' },
  { key: 'gp_name', rowHeader: true, label: 'Grand Prix', text: raceName },
  { key: 'circuit', label: 'Circuit' },
  { key: 'country', label: 'Country', optional: true },
  { key: 'winner', label: 'Winner', text: raceWinner, phone: true },
  { key: 'constructor', label: 'Car' },
  { key: 'pole', label: 'Pole' },
  { key: 'fastest_lap', label: 'Fastest lap' },
]

export const RACES_FOOTER =
  '“Shared” marks a race two drivers are both classified as winning, which was normal before 1958. A row tagged “not yet run” is a calendar entry with no result; those rows follow every race that has been run, the next one to be run first.'
