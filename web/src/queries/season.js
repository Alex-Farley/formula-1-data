/**
 * One season's page: its queries, its tables' columns and the headings that
 * depend on whether the season is over, read by Season.jsx and by
 * scripts/prerender.js (PD-02, rung two).
 *
 * WHY THIS FILE EXISTS
 *     The static season page read race_results for its calendar and the
 *     app counted winners from race_entries; the static standings table
 *     stopped at twelve drivers with a Team column the app never shows; the
 *     app had an entrants table the static page did not. And both halves
 *     headed the season in progress "How the title was decided" and "Final
 *     drivers' standings" with ten rounds still to run, under a stat strip
 *     that got it right (IA-17). The queries, the columns and the heading
 *     rule live here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { EMPTY, missing, points, text } from '../lib/format.js'
import { NOT_YET_RUN, SPRINT } from '../lib/site.js'

export const SEASON = `
  SELECT s.*, d.full_name AS champion, t.name AS champion_team_name,
         ru.full_name AS runner_up_name, cc.name AS constructors_champion_name
    FROM seasons s
    LEFT JOIN drivers d       ON d.id  = s.drivers_champion
    LEFT JOIN drivers ru      ON ru.id = s.runner_up
    LEFT JOIN constructors t  ON t.id  = s.champion_team
    LEFT JOIN constructors cc ON cc.id = s.constructors_champion
   WHERE s.year = ?
`

/**
 * The calendar, with each round's winner, winning car, pole and fastest lap
 * counted from the race records. Two winners in one cell is a shared drive.
 */
export const CALENDAR = `
  SELECT r.round, r.name_used, r.dates, r.status, r.sprint, r.circuit_id, c.name AS circuit,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.finish_position = 1)      AS winner,
         (SELECT e.driver_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winner_id,
         (SELECT k.name FROM race_entries e JOIN constructors k ON k.id = e.constructor_id
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winning_team,
         (SELECT e.constructor_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winning_team_id,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.pole = 1)                 AS pole,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.fastest_lap = 1)          AS fastest
    FROM races r
    LEFT JOIN circuits c ON c.id = r.circuit_id
   WHERE r.year = ?
   ORDER BY r.round
`

/** The running table, round by round, for the title-race chart. */
export const STANDINGS = `
  SELECT id, year, table_type, after_round, position, position_text,
         entity, entity_id, engine_id, team, points, source
    FROM standings
   WHERE year = ? AND after_round IS NOT NULL
   ORDER BY after_round, table_type, position
`

/**
 * The season as it stands, one row per entity: v_standings_final folds the
 * two-sources-one-season rows and keeps the one-source-two-entries rows, and
 * says why in schema.sql. A position nobody established sorts last.
 */
export const FINAL = `
  SELECT id, year, table_type, position, position_text, entity, entity_id,
         engine_id, team, points, source
    FROM v_standings_final
   WHERE year = ?
   ORDER BY table_type, position IS NULL, position, points DESC
`

export const NEIGHBOURS = `
  SELECT (SELECT MAX(year) FROM seasons WHERE year < ?1) AS previous,
         (SELECT MIN(year) FROM seasons WHERE year > ?1) AS next
`

/**
 * Who entered, by constructor. The ORDER BY is the order the app's table
 * opens in — case-insensitive, an entrant with no constructor last — so the
 * static page can print the rows as they come.
 */
export const ENTRANTS = `
  SELECT se.id, se.entrant_id, se.constructor_id, k.name AS constructor,
         se.chassis_ids, se.chassis_count, se.engine_ids, se.tyre_ids
    FROM season_entrants se
    LEFT JOIN constructors k ON k.id = se.constructor_id
   WHERE se.year = ?
   ORDER BY k.name IS NULL, k.name COLLATE NOCASE, se.entrant_id
`

export const GRID = 'SELECT * FROM v_season_grid WHERE year = ?'

/* ------------------------------------------------------------------ state */

/** A season with a round still to run. The headings below turn on this. */
export const stillRunning = (calendar) => calendar.some((r) => r.status === 'scheduled')

/** The round the current table stands after, from the running standings; null before the first. */
export const latestRound = (standings) => {
  let latest = null
  for (const r of standings) if (r.after_round !== null && (latest === null || r.after_round > latest)) latest = r.after_round
  return latest
}

/* --------------------------------------------------------------- headings */

/** "The title race" while rounds remain; "How the title was decided" once none do. */
export const titleHeading = (live) => (live ? 'The title race' : 'How the title was decided')

export const progressionNote = (live) =>
  `${live ? 'The three drivers placed highest so far' : 'The three drivers who finished highest'}, tracked from the opening round. Before 1991 only a driver's best few results counted, so a line can rise by less than they scored that weekend.`

/**
 * "Drivers' standings after round 13" while rounds remain; "Final drivers'
 * standings" once none do. `kind` is "Drivers'" or "Constructors'".
 */
export const standingsHeading = (kind, live, afterRound) => {
  if (!live) return `Final ${kind.toLowerCase()} standings`
  return afterRound ? `${kind} standings after round ${afterRound}` : `${kind} standings`
}

/* ---------------------------------------------------------------- columns */

/** "Chinese Grand Prix sprint": the name, and the sprint mark where the weekend had one. */
export const roundName = (name, row) => (row.sprint ? `${text(name)} ${SPRINT}` : text(name))

/** The winner, or "not yet run" for a calendar entry with no result. */
export const roundWinner = (name, row) => (row.status !== 'completed' ? NOT_YET_RUN : text(name))

export const CALENDAR_COLUMNS = [
  { key: 'round', label: 'R', align: 'num' },
  { key: 'name_used', label: 'Grand Prix', text: roundName },
  { key: 'circuit', label: 'Circuit' },
  { key: 'dates', label: 'Dates' },
  { key: 'winner', label: 'Winner', text: roundWinner },
  { key: 'winning_team', label: 'Car' },
  { key: 'pole', label: 'Pole' },
  { key: 'fastest', label: 'Fastest lap' },
]

export const CALENDAR_FOOTER =
  'Two names in one cell is a shared drive: both drivers are classified in that position, and both are winners. Open any round for its full classification.'

// position_text is the source's own spelling ("EX", "NC"); the hand-maintained
// 2025-26 rows carry only the number. Falling back to it is the difference
// between P1 and an em dash on the champion.
const position = (value, row) => text(value ?? row.position)
const pts = (value) => (missing(value) ? EMPTY : points(value))

export const DRIVERS_FINAL_COLUMNS = [
  { key: 'position_text', label: 'Pos', align: 'num', text: position },
  { key: 'entity', label: 'Driver' },
  { key: 'points', label: 'Points', align: 'num', text: pts },
]

export const DRIVERS_FINAL_FOOTER =
  'A driver with points and no position was excluded from the classification: the points stand, the position does not.'

/** "McLaren mercedes" where the championship is contested by a chassis–engine pair. */
export const constructorEntity = (name, row) => (row.engine_id ? `${text(name)} ${row.engine_id}` : text(name))

export const CONSTRUCTORS_FINAL_COLUMNS = [
  { key: 'position_text', label: 'Pos', align: 'num', text: position },
  { key: 'entity', label: 'Constructor', text: constructorEntity },
  { key: 'points', label: 'Points', align: 'num', text: pts },
]

export const CONSTRUCTORS_PAIR_FOOTER =
  'The championship is contested by a chassis–engine pair, so one name can appear more than once with different engines.'

export const NO_CONSTRUCTORS_TITLE = 'It was not contested until 1958.'

export const ENTRANT_COLUMNS = [
  { key: 'constructor', label: 'Constructor', text: (name, row) => text(name ?? row.entrant_id) },
  { key: 'entrant_id', label: 'Entered as' },
  { key: 'chassis_ids', label: 'Chassis', align: 'prose' },
  { key: 'chassis_count', label: 'Designs', align: 'num' },
  { key: 'engine_ids', label: 'Engines' },
  { key: 'tyre_ids', label: 'Tyres' },
]

export const ENTRANTS_FOOTER =
  'Where an entrant ran more than one design, no source records which car raced which round — so those race results carry no chassis.'
