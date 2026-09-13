/**
 * One race's page: its queries, its four tables' columns and the order a
 * classification is printed in, read by Race.jsx and by scripts/prerender.js
 * (PD-02, rung four).
 *
 * WHY THIS FILE EXISTS
 *     The static race page carried a seven-column classification to the
 *     app's ten — no chassis, no fastest-lap column, "Status" against "Out",
 *     the fastest lap folded into the status cell — ordered by a different
 *     rule, and no qualifying, sprint or pit-stop table at all, so a crawler
 *     read a different race from the one a reader saw. The definitions live
 *     here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { EMPTY, classificationOrder, finished, missing, points, result, text } from '../lib/format.js'
import { SHARED } from '../lib/site.js'

export const RACE = `
  SELECT r.*, c.name AS circuit, c.locality, c.country,
         cl.layout_name, cl.length_km AS layout_km, cl.turns AS layout_turns,
         g.name AS gp_full,
         o.path AS outline, o.length_km AS outline_km, o.turns AS outline_turns
    FROM races r
    LEFT JOIN circuits c        ON c.id = r.circuit_id
    LEFT JOIN circuit_layouts cl ON cl.circuit_id = r.circuit_id AND cl.layout_key = r.layout_key
    LEFT JOIN grands_prix g     ON g.id = r.gp_id
    LEFT JOIN circuit_outlines o ON o.f1db_layout_id = r.f1db_layout_id
   WHERE r.year = ? AND r.round = ?
`

export const ENTRIES = `
  SELECT e.*, d.full_name AS driver, d.nationality, k.name AS constructor,
         ch.name AS chassis
    FROM race_entries e
    JOIN races r         ON r.id = e.race_id
    LEFT JOIN drivers d  ON d.id = e.driver_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
    LEFT JOIN chassis ch ON ch.id = e.chassis_id
   WHERE r.year = ? AND r.round = ?
`

export const QUALIFYING = `
  SELECT q.*, d.full_name AS driver, k.name AS constructor
    FROM qualifying q
    JOIN races r         ON r.id = q.race_id
    LEFT JOIN drivers d  ON d.id = q.driver_id
    LEFT JOIN constructors k ON k.id = q.constructor_id
   WHERE r.year = ? AND r.round = ?
   ORDER BY q.position IS NULL, q.position
`

export const SPRINT = `
  SELECT s.*, d.full_name AS driver, k.name AS constructor
    FROM sprint_results s
    JOIN races r         ON r.id = s.race_id
    LEFT JOIN drivers d  ON d.id = s.driver_id
    LEFT JOIN constructors k ON k.id = s.constructor_id
   WHERE r.year = ? AND r.round = ?
`

/** Lap order, then stop order: the order the app's table opens in. */
export const PITS = `
  SELECT p.*, d.full_name AS driver
    FROM pit_stops p
    JOIN races r        ON r.id = p.race_id
    LEFT JOIN drivers d ON d.id = p.driver_id
   WHERE r.year = ? AND r.round = ?
   ORDER BY p.lap_number, p.stop_number, p.id
`

export const NEIGHBOURS = `
  SELECT
    (SELECT year || '/' || round FROM races
      WHERE (year < ?1) OR (year = ?1 AND round < ?2)
      ORDER BY year DESC, round DESC LIMIT 1) AS previous,
    (SELECT year || '/' || round FROM races
      WHERE (year > ?1) OR (year = ?1 AND round > ?2)
      ORDER BY year, round LIMIT 1) AS next
`

/* ------------------------------------------------------------------ order */

/**
 * The classification in the order a classification is printed: finishers by
 * position, then everyone else by how far they got. finish_position is NULL
 * for a retirement, so ordering on it in SQL would put every DNF first —
 * SQLite sorts NULL first — which is why both renderers sort here. A sprint
 * is a separate race on the same weekend and is ordered the same way.
 */
export const inClassificationOrder = (rows) =>
  [...rows].sort((a, b) => classificationOrder(a) - classificationOrder(b))

/** What a row achieved, for the rail beside it: podium, points, classified, or nothing. */
export const railOf = (entry) => {
  if (entry.finish_position >= 1 && entry.finish_position <= 3) return 'podium'
  if (entry.points > 0) return 'points'
  if (!missing(entry.finish_position)) return 'classified'
  return ''
}

/* ---------------------------------------------------------------- columns */

export const FASTEST_LAP = 'fastest lap'

// The rail is data, not decoration — what the row achieved, read before any
// of the numbers — and it is always paired with the position beside it, so
// the colour never carries the meaning alone. Its header is for a screen
// reader only; its cell carries no text in either renderer.
const rail = { key: 'rail', label: 'Result', align: 'rail', sortable: false, srOnly: true, text: () => '' }

/** The classified position, the source's own spelling first ("EX", "NC"), or the em dash. */
export const position = (_, row) => result(row)

/** "Finished" for a classified finisher with no status, the status otherwise, the em dash for neither. */
export const outcome = (value, row) => (finished(value, row.finish_position) ? 'Finished' : text(value))

/** The driver, and "shared" where two drivers took turns in the car. */
export const driverName = (name, row) => `${text(name ?? row.driver_id)}${row.shared_drive === 1 ? ` ${SHARED}` : ''}`

/** "●" with the words "fastest lap" for a screen reader; nothing otherwise. */
export const fastestLapMark = (value) => (value === 1 ? `●${FASTEST_LAP}` : '')

const pts = (value) => (missing(value) ? EMPTY : points(value))

export const CLASSIFICATION_COLUMNS = [
  rail,
  { key: 'position_text', label: 'Pos', align: 'num', text: position },
  { key: 'driver', label: 'Driver', text: driverName },
  // The entrant's name where no constructor is resolved: a privateer entry.
  { key: 'constructor', label: 'Constructor', text: (name, row) => text(row.constructor_id ? name : (row.entrant ?? name)) },
  { key: 'chassis', label: 'Chassis', text: (name, row) => text(name ?? row.chassis_id) },
  { key: 'grid_text', label: 'Grid', align: 'num' },
  { key: 'laps_completed', label: 'Laps', align: 'num' },
  { key: 'status', label: 'Out', text: outcome },
  { key: 'points', label: 'Points', align: 'num', text: pts },
  { key: 'fastest_lap', label: 'FL', align: 'num', text: fastestLapMark },
]

export const CLASSIFICATION_FOOTER =
  'An empty “Out” is a retirement nobody recorded a reason for, not a driver who finished. A blank chassis is a season the team ran more than one design and no source says which car raced here.'

/** One time per driver before knock-out qualifying arrived in 2006; the best lap of each session from then. */
export const qualifyingColumns = (rows) => [
  { key: 'position_text', label: 'Pos', align: 'num' },
  { key: 'driver', label: 'Driver', text: (name, row) => text(name ?? row.driver_id) },
  { key: 'constructor', label: 'Constructor' },
  { key: 'driver_number', label: 'No.', align: 'num' },
  ...(rows.some((q) => q.q1)
    ? [
        { key: 'q1', label: 'Q1', align: 'num' },
        { key: 'q2', label: 'Q2', align: 'num' },
        { key: 'q3', label: 'Q3', align: 'num' },
      ]
    : [{ key: 'time', label: 'Time', align: 'num' }]),
  { key: 'gap', label: 'Gap', align: 'num' },
  { key: 'interval', label: 'Interval', align: 'num' },
]

export const QUALIFYING_FOOTER =
  'Before knock-out qualifying arrived in 2006 there is one time per driver; from 2006, the best lap of each of the three sessions.'

export const SPRINT_COLUMNS = [
  rail,
  { key: 'position_text', label: 'Pos', align: 'num' },
  { key: 'driver', label: 'Driver', text: (name, row) => text(name ?? row.driver_id) },
  { key: 'constructor', label: 'Constructor' },
  { key: 'grid', label: 'Grid', align: 'num' },
  { key: 'laps_completed', label: 'Laps', align: 'num' },
  { key: 'status', label: 'Out', text: outcome },
  { key: 'gap', label: 'Gap', align: 'num' },
  { key: 'points', label: 'Points', align: 'num', text: pts },
]

export const SPRINT_FOOTER =
  'A sprint is a separate, shorter race held on the grand prix weekend, with its own grid and its own points — and those points count towards the championship. The grid column is the sprint grid, not the grand prix one.'

export const PIT_COLUMNS = [
  { key: 'lap_number', label: 'Lap', align: 'num' },
  { key: 'driver', label: 'Driver', text: (name, row) => text(name ?? row.driver_key) },
  { key: 'stop_number', label: 'Stop', align: 'num' },
  { key: 'stationary_seconds', label: 'Stationary (s)', align: 'num' },
  { key: 'pit_lane_seconds', label: 'Pit lane (s)', align: 'num' },
  { key: 'source', label: 'Source' },
]

export const PITS_FOOTER =
  'Stationary time is the car standing still; pit-lane time is the whole detour. Where two sources record the same stop, both are kept so you can compare them.'
