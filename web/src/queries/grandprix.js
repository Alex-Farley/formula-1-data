/**
 * One Grand Prix's page: its queries and its three tables' columns, read by
 * GrandPrix.jsx and by scripts/prerender.js (IA-01).
 *
 * The event is the continuing thing - `grands_prix.name` - and each edition
 * keeps the name it was run under, `races.name_used`: the Mexico City and
 * São Paulo Grands Prix are editions of the Mexican and Brazilian, and the
 * editions table says so row by row rather than renaming them.
 *
 * As in queries/grandsprix.js, every figure is counted from the races, and a
 * run race is `status = 'completed'`.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { span, text } from '../lib/format.js'
import { NOT_YET_RUN } from '../lib/site.js'
import { carName } from './race.js'
import { raceName, raceWinner } from './races.js'

/** The stored row, with the figures the page shows counted beside it. */
export const GRAND_PRIX = `
  SELECT g.id, g.name, g.country, g.aliases, g.notes, g.confidence,
         COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS held,
         COUNT(CASE WHEN r.status != 'completed' THEN 1 END) AS scheduled,
         MIN(CASE WHEN r.status = 'completed' THEN r.year END) AS first_held,
         MAX(CASE WHEN r.status = 'completed' THEN r.year END) AS last_held,
         COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.circuit_id END) AS circuits
    FROM grands_prix g
    LEFT JOIN races r ON r.gp_id = g.id
   WHERE g.id = ?
   GROUP BY g.id
`

/**
 * Every venue the event has been held at, in the order it first went there.
 * A venue it is on the calendar for and has not yet raced at is listed last,
 * with no span and a "not yet run" mark: Sepang is booked for a Bahrain Grand
 * Prix, and is not a circuit that event has used.
 */
export const CIRCUITS = `
  SELECT r.circuit_id, c.name AS circuit, c.country,
         COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS races,
         COUNT(CASE WHEN r.status != 'completed' THEN 1 END) AS scheduled,
         MIN(CASE WHEN r.status = 'completed' THEN r.year END) AS first_year,
         MAX(CASE WHEN r.status = 'completed' THEN r.year END) AS last_year
    FROM races r
    LEFT JOIN circuits c ON c.id = r.circuit_id
   WHERE r.gp_id = ?
   GROUP BY r.circuit_id
   ORDER BY first_year IS NULL, first_year, c.name
`

/** Newest first, the order the app's table opens in, as on a circuit's page. */
export const EDITIONS = `
  SELECT r.year, r.round, r.name_used, r.status, r.sprint, r.circuit_id, c.name AS circuit,
         rr.winner, rr.winner_id, rr.co_winner_id, rr.constructor, rr.constructor_id, rr.entrant,
         k.country AS constructor_country
    FROM races r
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN race_results rr ON rr.id = r.id
    LEFT JOIN constructors k ON k.id = rr.constructor_id
   WHERE r.gp_id = ?
   ORDER BY r.year DESC, r.round DESC
`

/**
 * Most wins at this event, from the classification rather than from
 * race_results' one winner per race, as v_circuit_winners counts a circuit's:
 * a shared win before 1958 is a win for each driver classified first.
 */
export const WINNERS = `
  SELECT e.driver_id, d.full_name AS driver, COUNT(DISTINCT r.id) AS wins,
         MIN(r.year) AS first_win, MAX(r.year) AS last_win
    FROM races r
    JOIN race_entries e ON e.race_id = r.id AND e.finish_position = 1
    JOIN drivers d      ON d.id = e.driver_id
   WHERE r.gp_id = ?
   GROUP BY e.driver_id
   ORDER BY wins DESC, driver
`

/** A venue's years here, or "not yet run" for one the event is booked at and has not raced. */
export const circuitYears = (_, row) =>
  row.first_year === null || row.first_year === undefined
    ? row.scheduled
      ? NOT_YET_RUN
      : span(null, null)
    : span(row.first_year, row.last_year)

/**
 * The count beside "Where it has been held": the venues raced at, and apart
 * from them the ones only booked, so the figure agrees with the Circuits tile
 * above it and still accounts for every row below it.
 */
export const venuesCount = (rows) => {
  const used = rows.filter((row) => row.races > 0).length
  const booked = rows.length - used
  return booked ? `${used} · ${booked} to come` : `${used}`
}

/**
 * The winning car: the entrant's name where no constructor row exists, the
 * rule carName applies wherever a car is named (AF-64) - the eleven
 * championship Indianapolis 500s are this page's whole table otherwise
 * blank. Nothing on an edition still to come, as a season's calendar leaves
 * it: the Winner cell says "not yet run" once, and an em dash here would say
 * a fact is missing about a race that has not happened (CD-37).
 */
export const editionCar = (_, row) => (row.status !== 'completed' ? '' : text(carName(row)))

export const CIRCUIT_COLUMNS = [
  { key: 'circuit', rowHeader: true, label: 'Circuit' },
  { key: 'country', label: 'Country' },
  { key: 'races', label: 'Races', align: 'num' },
  { key: 'first_year', label: 'Span', align: 'num', text: circuitYears },
]

export const EDITION_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', rowHeader: true, label: 'Run as', text: raceName },
  { key: 'circuit', label: 'Circuit' },
  { key: 'winner', label: 'Winner', text: raceWinner },
  { key: 'constructor', label: 'Car', text: editionCar },
]

export const WINNER_COLUMNS = [
  { key: 'driver', rowHeader: true, label: 'Driver' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'first_win', label: 'Span', align: 'num', text: (_, row) => span(row.first_win, row.last_win) },
]

