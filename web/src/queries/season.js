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
import { EMPTY, missing, number, points, text } from '../lib/format.js'
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
         r.f1db_layout_id, o.path AS outline,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.finish_position = 1)      AS winner,
         (SELECT e.driver_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winner_id,
         (SELECT k.name FROM race_entries e JOIN constructors k ON k.id = e.constructor_id
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winning_team,
         (SELECT e.constructor_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winning_team_id,
         (SELECT k.country FROM race_entries e JOIN constructors k ON k.id = e.constructor_id
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winning_team_country,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.pole = 1)                 AS pole,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.fastest_lap = 1)          AS fastest
    FROM races r
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN circuit_outlines o ON o.f1db_layout_id = r.f1db_layout_id
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
  SELECT f.id, f.year, f.table_type, f.position, f.position_text, f.entity, f.entity_id,
         f.engine_id, f.team, f.points, f.source,
         k.country AS constructor_country,
         MAX(CASE WHEN f.position IS NOT NULL THEN f.points END)
           OVER (PARTITION BY f.table_type) - f.points AS gap,
         CASE WHEN f.table_type = 'drivers' AND f.entity_id IS NOT NULL THEN (
           SELECT COUNT(DISTINCT e.race_id)
             FROM race_entries e JOIN races r ON r.id = e.race_id
            WHERE r.year = f.year AND e.finish_position = 1
              AND e.driver_id = f.entity_id) END AS wins
    FROM v_standings_final f
    LEFT JOIN constructors k ON f.table_type = 'constructors' AND k.id = f.entity_id
   WHERE f.year = ?
   ORDER BY f.table_type, f.position IS NULL, f.position, f.points DESC
`

/**
 * What is still to be won, and under which rule (PD-28).
 *
 * `points_systems` holds the win and fastest-lap values as figures beside the
 * sentences that state them, which is what known_gaps #12 said the title
 * arithmetic was waiting on; verify.py holds each figure to its sentence. The
 * two periods are picked the same way - the latest row whose span covers the
 * year - and verify.py checks that no season is covered by two of either.
 *
 * `dropped_scores` comes back unread so the caller can decline to make the
 * claim: before 1991 only a driver's best few results counted, so a driver
 * 40 behind with 50 available might still gain nothing from winning twice,
 * and no arithmetic this simple can say who is out.
 */
export const REMAINING = `
  WITH to_run AS (
    SELECT SUM(CASE WHEN r.status <> 'completed' THEN 1 ELSE 0 END)          AS races,
           SUM(CASE WHEN r.status <> 'completed' THEN r.sprint ELSE 0 END)   AS sprints,
           SUM(CASE WHEN r.status =  'completed' THEN 1 ELSE 0 END)          AS run
      FROM races r
     WHERE r.year = ?1),
  gp AS (
    SELECT win_points, fastest_lap_points, dropped_scores
      FROM points_systems
     WHERE scoring NOT LIKE 'SPRINT:%'
       AND from_year <= ?1 AND (to_year IS NULL OR to_year >= ?1)
     ORDER BY from_year DESC LIMIT 1),
  sp AS (
    SELECT win_points
      FROM points_systems
     WHERE scoring LIKE 'SPRINT:%'
       AND from_year <= ?1 AND (to_year IS NULL OR to_year >= ?1)
     ORDER BY from_year DESC LIMIT 1)
  SELECT t.races, t.sprints, t.run, g.win_points, g.fastest_lap_points, g.dropped_scores,
         COALESCE((SELECT win_points FROM sp), 0) AS sprint_points,
         t.races * (g.win_points + g.fastest_lap_points)
           + t.sprints * COALESCE((SELECT win_points FROM sp), 0) AS available
    FROM to_run t, gp g
`

/**
 * Who each driver raced for that season, latest team first, for the colour
 * mark beside a name in the drivers' table (AF-04). A standings row names a
 * `team` as text; the constructor id it needs is in the race entries. A
 * driver who changed teams has two rows here and the mark takes the first -
 * the team they finished the season with - and its tooltip names both.
 */
export const DRIVER_TEAMS = `
  SELECT e.driver_id, e.constructor_id, k.name AS constructor, k.country,
         MAX(r.round) AS last_round, COUNT(*) AS entries
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE r.year = ? AND e.driver_id IS NOT NULL AND e.constructor_id IS NOT NULL
   GROUP BY e.driver_id, e.constructor_id
   ORDER BY e.driver_id, last_round DESC, e.constructor_id
`

/**
 * DRIVER_TEAMS rows grouped by driver, in the query's order (latest team
 * first). queries/driver.js SEASON_TEAMS is the same grouping for one
 * driver's career, and lib/liveries.js lastTeamColour() reads either.
 */
export function teamsByDriver(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.driver_id)) map.set(row.driver_id, [])
    map.get(row.driver_id).push(row)
  }
  return map
}

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

/**
 * Who is in the cars: one row per entry declared for the season, with the
 * number it carries, the driver's three-letter code, the chassis and the
 * power unit (PD-38, and the fields PD-17 harvested).
 *
 * The database answers this already in `v_current_grid`, which `./f1 grid`
 * prints. That view is pinned to `meta.current_season` and returns display
 * names only, so it can be asked about one year and its rows can neither be
 * linked nor coloured. This asks the same question of the same table, by
 * year, and brings back the two ids a page needs - which is the arrangement
 * lib/season.js already sets out: the site shares the anchor with those
 * views rather than the views themselves.
 *
 * `season_entries` is the entry list as declared, and not a count of who has
 * started a race - v_season_grid's counting sentence above the table is that
 * - so a reserve is a row here and carries the word. It is the same set the
 * drivers' register filters on ("On the 2026 grid", queries/drivers.js
 * `on_grid`), because the entry list is what this site means by the grid.
 */
export const CURRENT_GRID = `
  SELECT e.id, e.car_number, e.driver_id, d.full_name AS driver, d.abbreviation,
         e.constructor_id, k.name AS team, k.country AS team_country,
         e.car, e.power_unit, e.role
    FROM season_entries e
    LEFT JOIN drivers d      ON d.id = e.driver_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE e.year = ?
   ORDER BY CASE e.role WHEN 'race' THEN 0 WHEN 'substitute' THEN 1 WHEN 'reserve' THEN 2 ELSE 3 END,
            k.name IS NULL, k.name COLLATE NOCASE, e.car_number
`

/** "Yuki Tsunoda reserve": the role, wherever the seat is not a race seat. */
export const gridDriver = (name, row) =>
  row.role && row.role !== 'race' ? `${text(name)} ${row.role}` : text(name)

export const GRID_COLUMNS = [
  { key: 'car_number', label: 'No.', align: 'num' },
  { key: 'driver', label: 'Driver', text: gridDriver },
  { key: 'abbreviation', label: 'Code' },
  { key: 'team', label: 'Team' },
  { key: 'car', label: 'Car' },
  { key: 'power_unit', label: 'Power unit' },
]

export const GRID_HEADING = 'On the grid'

/**
 * Two figures on this page are called the grid, and they answer different
 * questions: the sentence in the strip above counts the drivers who have
 * been entered for a round (v_season_grid, from race_entries), and this
 * table is the list the season declared. They agree in a season whose
 * line-up does not move and need not in one whose does, so the difference
 * is said above the table rather than under it.
 */
export const GRID_NOTE =
  'The entry list as the season declared it, one row per seat. The count above is taken from the race ' +
  'entries — the drivers entered for a round — so in a season whose line-up moves the two need not agree.'

export const GRID_FOOTER =
  'A driver named as a reserve or a substitute carries that word: this is not a count of who has started. ' +
  'The number is the one carried this season and the code is the three letters the timing screens use; ' +
  'the power unit is the maker, whose engine the car is entered with.'

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

/* --------------------------------------------------- who can still win */

const plural = (n, word) => `${number(n)} ${word}${n === 1 ? '' : 's'}`

/** "Norris, Piastri and Verstappen". */
const listed = (names) =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * Who can still win the drivers' title, as one sentence both renderers print
 * (PD-28). The most-asked question of every September, and one the site can
 * answer from what it already holds: the standings as they stand, the rounds
 * still on the calendar, and the points a win is worth under the season's own
 * scoring rule.
 *
 * It returns null rather than a hedge wherever the arithmetic would not carry:
 *
 *   - no round left to run — there is nothing to work out;
 *   - a standings table that does not stand after the round the calendar says
 *     has run: results and standings are harvested separately and either can
 *     land first, and a table one round behind a calendar would be measured
 *     against one race too few and put a driver out who is not;
 *   - a dropped-scores season — before 1991 only a driver's best few results
 *     counted, so a total need not rise by what its driver scores and being
 *     behind by more than is available does not put anyone out;
 *   - fewer than two drivers on the table.
 *
 * Where more than ten drivers are still in - the opening weeks of a season,
 * when nobody is out - the count is the answer and the list of names is not,
 * and where nobody at all is out it says that rather than counting to itself.
 *
 * What it does not claim is in its own last sentence: a tie on points is
 * settled on wins, so "can still reach the leader's total" is not the same as
 * "can still be champion", and a driver who can only equal is counted in.
 * The round it was counted after and the date the database was built are
 * printed with it, because the answer changes with the harvest and not with
 * the code (SD-14).
 */
export function titlePermutations({ drivers, remaining, afterRound, built }) {
  if (!remaining || !remaining.races) return null
  if (remaining.dropped_scores && remaining.dropped_scores !== 'None') return null
  if (missing(afterRound) || afterRound !== remaining.run) return null
  // A driver with points and no position was excluded from the classification,
  // which is the same table's footer: their points stand and their position
  // does not, so they are neither the leader to catch nor someone to catch.
  const scored = (drivers ?? []).filter((d) => !missing(d.points) && !missing(d.position))
  if (scored.length < 2) return null

  const available = remaining.available
  if (missing(available)) return null
  const lead = Math.max(...scored.map((d) => d.points))
  const alive = scored.filter((d) => lead - d.points <= available)

  const left = [plural(remaining.races, 'round'), remaining.sprints ? plural(remaining.sprints, 'sprint') : null]
    .filter(Boolean)
    .join(' and ')
  const who =
    alive.length === 1
      ? `Only ${alive[0].entity} can still win the drivers' title: no other driver can now reach that total.`
      : alive.length <= 10
        ? `Who can still win the drivers' title: ${listed(alive.map((d) => d.entity))}.`
        : alive.length === scored.length
          ? "Every driver who has scored can still reach the leader's total."
          : `${number(alive.length)} of the ${number(scored.length)} drivers who have scored can still reach the leader's total.`

  return [
    who,
    `${left} still to run, so ${points(available)} points are still available, and a driver further behind the leader than that cannot reach them.`,
    afterRound ? `Counted after round ${number(afterRound)}${built ? `, from the database built ${built}` : ''}.` : null,
    'Points only: a tie at the top is settled on wins, which this does not work out.',
  ]
    .filter(Boolean)
    .join(' ')
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
// Said once and printed under both standings tables. The net-of-dropped-scores
// clause is the same warning seasons.js puts on the Margin column: before 1991
// a total is what counted, not what was scored, so a gap of 3 can sit between
// two drivers eleven points apart on the road (1988).
export const GAP_FOOTER =
  "The gap is to the highest points total classified, so the leader's own is an em dash; " +
  'before 1991 it is a difference of net totals, dropped scores and all.'

const position = (value, row) => text(value ?? row.position)
const pts = (value) => (missing(value) ? EMPTY : points(value))
// The leader is nobody's gap: a 0 here means no one is ahead of you on points,
// which an em dash says and a nought does not. Two drivers tied at the top
// both get it, which is the same statement about each of them.
const behind = (value) => (missing(value) || value === 0 ? EMPTY : points(value))
const won = (value) => (missing(value) ? EMPTY : number(value))

export const DRIVERS_FINAL_COLUMNS = [
  { key: 'position_text', label: 'Pos', align: 'num', text: position },
  { key: 'entity', label: 'Driver' },
  { key: 'wins', label: 'Wins', align: 'num', text: won },
  { key: 'points', label: 'Points', align: 'num', text: pts },
  { key: 'gap', label: 'Gap', align: 'num', text: behind },
]

export const DRIVERS_FINAL_FOOTER =
  'A driver with points and no position was excluded from the classification: the points stand, the position does not. ' +
  'Wins are counted from the race records, and a shared drive is a win for both of its drivers. ' +
  GAP_FOOTER

/** "McLaren mercedes" where the championship is contested by a chassis–engine pair. */
export const constructorEntity = (name, row) => (row.engine_id ? `${text(name)} ${row.engine_id}` : text(name))

export const CONSTRUCTORS_FINAL_COLUMNS = [
  { key: 'position_text', label: 'Pos', align: 'num', text: position },
  { key: 'entity', label: 'Constructor', text: constructorEntity },
  { key: 'points', label: 'Points', align: 'num', text: pts },
  { key: 'gap', label: 'Gap', align: 'num', text: behind },
]

export const CONSTRUCTORS_PAIR_FOOTER =
  'The championship is contested by a chassis–engine pair, so one name can appear more than once with different engines.'

export const CONSTRUCTORS_GAP_FOOTER = GAP_FOOTER

/**
 * No wins column here to match the drivers' table: a row can be a
 * chassis-engine pair, and the race records say which constructor won a race
 * and not which of its engines is credited with the championship point, so a
 * pair's wins cannot be told apart without asserting something no source does.
 */
export const constructorsFooter = (ambiguous) =>
  ambiguous ? `${CONSTRUCTORS_GAP_FOOTER} ${CONSTRUCTORS_PAIR_FOOTER}` : CONSTRUCTORS_GAP_FOOTER

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
