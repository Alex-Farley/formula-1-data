/**
 * One circuit's page: its queries and its three tables' columns, read by
 * Circuit.jsx and by scripts/prerender.js (PD-02, rung five).
 *
 * WHY THIS FILE EXISTS
 *     The static circuit page had one table, "Grands Prix held here", from
 *     race_results in year order with four columns; the app has "Every race
 *     held here" newest first with the layout raced and a "not yet run" mark,
 *     and two tables — most wins here, constructors here — the static page
 *     did not carry. The definitions live here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { span, text } from '../lib/format.js'
import { NOT_YET_RUN } from '../lib/site.js'

/**
 * The stored row with the derived figures beside it: v_circuits counts the
 * races and their span from the races themselves, because the stored
 * last_gp is NULL for every venue still in use.
 */
export const CIRCUIT = `
  SELECT c.*, v.races, v.first_gp AS derived_first, v.last_gp AS derived_last,
         v.seasons_used, v.events_hosted, v.layouts
    FROM circuits c
    LEFT JOIN v_circuits v ON v.id = c.id
   WHERE c.id = ?
`

/** The centreline is a few hundred kilobytes of coordinates; only ever fetched for the one circuit being looked at. */
export const GEOMETRY = `SELECT * FROM circuit_geometry WHERE circuit_id = ?`

/**
 * How much of the register is traced, for the line a circuit without a trace
 * shows (IX-31). Counted rather than written into the sentence: "25 of the
 * 80" is true today, and a figure typed into prose goes stale in silence.
 */
export const TRACE_COVERAGE = `
  SELECT (SELECT COUNT(DISTINCT circuit_id) FROM circuit_geometry) AS traced,
         (SELECT COUNT(*) FROM circuits) AS circuits
`

export const LAYOUTS = `
  SELECT * FROM circuit_layouts WHERE circuit_id = ? ORDER BY from_year
`

/**
 * F1DB's outline of every layout raced here (AF-03), with the years and
 * the rounds run on each, counted from the completed races that name it —
 * the same split v_circuits makes for the stats above, so a layout on the
 * calendar and not yet raced is "1 round to come", not a round run at a
 * venue that has never held one. A drawing, not a measurement:
 * lib/outline.js says how it differs from GEOMETRY.
 */
export const OUTLINES = `
  SELECT o.f1db_layout_id, o.length_km, o.turns, o.path,
         MIN(CASE WHEN r.status = 'completed' THEN r.year END) AS first_year,
         MAX(CASE WHEN r.status = 'completed' THEN r.year END) AS last_year,
         COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS rounds,
         COUNT(CASE WHEN r.status != 'completed' THEN 1 END) AS scheduled
    FROM circuit_outlines o
    LEFT JOIN races r ON r.f1db_layout_id = o.f1db_layout_id
   WHERE o.circuit_id = ?
   GROUP BY o.f1db_layout_id
   ORDER BY first_year IS NULL, first_year, o.f1db_layout_id
`

/** Newest first: the order the app's table opens in. */
export const RACES = `
  SELECT r.year, r.round, r.name_used, r.status, r.layout_key,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.finish_position = 1) AS winner,
         (SELECT e.driver_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winner_id,
         (SELECT k.name FROM race_entries e JOIN constructors k ON k.id = e.constructor_id
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS constructor
    FROM races r
   WHERE r.circuit_id = ?
   ORDER BY r.year DESC, r.round DESC
`

export const WINNERS = `
  SELECT driver_id, driver, wins, first_win, last_win
    FROM v_circuit_winners WHERE circuit_id = ?
   ORDER BY wins DESC, driver
`

/**
 * One row per constructor that has won here, most wins first.
 *
 * The join is for the constructor's country, which the pre-1968 national
 * colour needs and the view does not carry (AF-52). The view's own
 * `last_win` is the season the mark is drawn for - the site's rule for a
 * subject spanning seasons is the last one - so nothing here needs a
 * correlated MAX and `schema.sql` is untouched.
 */
export const TEAMS = `
  SELECT v.*, k.country AS constructor_country
    FROM v_circuit_constructors v
    LEFT JOIN constructors k ON k.id = v.constructor_id
   WHERE v.circuit_id = ?
   ORDER BY v.wins DESC, v.constructor
`

/** The winner, or "not yet run" for a race still on the calendar. */
export const raceWinnerHere = (name, row) => (row.status !== 'completed' ? NOT_YET_RUN : text(name))

export const RACE_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', label: 'Grand Prix' },
  // Plain text in both halves, and a NULL here is a race this database has
  // not attributed to a layout - which is what the sentence above the table
  // says in words. Monza ran 77 races with no layout recorded against any of
  // them (VD-29).
  { key: 'layout_key', label: 'Layout', collapse: true },
  { key: 'winner', label: 'Winner', text: raceWinnerHere },
  { key: 'constructor', label: 'Car' },
]

export const WINNER_COLUMNS = [
  { key: 'driver', label: 'Driver' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'first_win', label: 'Span', align: 'num', text: (_, row) => span(row.first_win, row.last_win) },
]

// The span the WINNERS table above already prints for a driver, and this
// one did not for a constructor. AF-52's mark takes `last_win` and its
// tooltip names that season, so the row has to show it: a mark whose claim
// a reader cannot check against the row is the one thing this site does not
// do. The column is the same construction as WINNER_COLUMNS's.
export const TEAM_COLUMNS = [
  { key: 'constructor', label: 'Constructor' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'first_win', label: 'Span', align: 'num', text: (_, row) => span(row.first_win, row.last_win) },
]
