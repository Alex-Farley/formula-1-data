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
 */
export const RACES = `
  SELECT rr.year, rr.round, rr.gp_name, rr.gp_id, rr.circuit_id, c.name AS circuit, c.country,
         rr.winner, rr.winner_id, rr.co_winner_id, rr.constructor, rr.constructor_id,
         rr.pole, rr.pole_id, rr.fastest_lap, rr.fastest_lap_id, r.status, r.sprint
    FROM race_results rr
    JOIN races r ON r.id = rr.id
    LEFT JOIN circuits c ON c.id = rr.circuit_id
   ORDER BY r.status = 'scheduled',
            rr.year DESC,
            CASE WHEN r.status = 'scheduled' THEN rr.round ELSE -rr.round END
`

/** "Dutch Grand Prix sprint": the name, and the sprint mark where the weekend had one. */
export const raceName = (name, row) => (row.sprint ? `${text(name)} ${SPRINT}` : text(name))

/** The winner, "not yet run" for a calendar entry with no result, "shared" for two winners. */
export const raceWinner = (name, row) =>
  row.status !== 'completed' ? NOT_YET_RUN : row.co_winner_id ? `${text(name)} ${SHARED}` : text(name)

export const RACE_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'round', label: 'R', align: 'num' },
  { key: 'gp_name', label: 'Grand Prix', text: raceName },
  { key: 'circuit', label: 'Circuit' },
  { key: 'winner', label: 'Winner', text: raceWinner },
  { key: 'constructor', label: 'Car' },
  { key: 'pole', label: 'Pole' },
  { key: 'fastest_lap', label: 'Fastest lap' },
]

export const RACES_FOOTER =
  '“Shared” marks a race two drivers are both classified as winning, which was normal before 1958. A row tagged “not yet run” is a calendar entry with no result; those rows follow every race that has been run.'
