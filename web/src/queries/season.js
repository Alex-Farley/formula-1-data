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
import { EMPTY, inWords, missing, number, ordinal, points, raceDates, roundResult, shortNames, text } from '../lib/format.js'
import { NOT_YET_RUN, SPRINT } from '../lib/site.js'
import { CURRENT_SEASON_SQL } from '../lib/season.js'
import { carName } from './race.js'
import { colourForEntry, lastTeamColour } from '../lib/liveries.js'

// Kept here for the pages and tests that import it from this module; it
// lives in lib/format.js, where queries/race.js - which this module imports -
// can reach it without a cycle (VD-113).
export { shortNames }

export const SEASON = `
  SELECT s.*, d.full_name AS champion, t.name AS champion_team_name, t.country AS champion_team_country,
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
 * `winning_entrant` is there for winningCar() below: the car of a winner
 * with no constructor row (AF-68).
 */
export const CALENDAR = `
  SELECT r.round, r.name_used, r.date_iso, r.date_from, r.date_to, r.status, r.sprint, r.circuit_id, c.name AS circuit,
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
         (SELECT e.entrant FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winning_entrant,
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

/**
 * The running table, round by round, for the title-race chart: one source's,
 * the one that holds a table after the most rounds - a history, not the
 * latest single table, so an official snapshot refreshed ahead of F1DB does
 * not replace fourteen points per driver with one. The snapshot stands after
 * its own round too (DA-01), and two sources' readings of one round would
 * draw two points at it.
 */
export const STANDINGS = `
  SELECT id, year, table_type, after_round, position, position_text,
         entity, driver_id, constructor_id, engine_id, team, points, source
    FROM standings
   WHERE year = ?1 AND basis = 'running'
     AND source = (SELECT source FROM standings
                    WHERE year = ?1 AND basis = 'running'
                    GROUP BY source
                    ORDER BY COUNT(DISTINCT after_round) DESC, MAX(after_round) DESC, source
                    LIMIT 1)
   ORDER BY after_round, table_type, position
`

/**
 * The season as it stands, one row per entity: v_standings_final folds the
 * two-sources-one-season rows and keeps the one-source-two-entries rows, and
 * says why in schema.sql. A position nobody established sorts last.
 *
 * The last term makes the order total (CR-64). 121 (season, table, position)
 * groups hold more than one row - shared places, and a constructor's two
 * engines in one season - and without it their order is whatever the query
 * plan gives, which the app (sql.js) and the prerender (node:sqlite) agree on
 * only while their plans happen to coincide. The row id is the order the
 * source listed the tie in, and the order every tied group already showed.
 */
export const FINAL = `
  SELECT f.id, f.year, f.table_type, f.position, f.position_text, f.entity,
         f.driver_id, f.constructor_id, f.engine_id, f.team, f.points, f.source,
         k.country AS constructor_country,
         MAX(CASE WHEN f.position IS NOT NULL THEN f.points END)
           OVER (PARTITION BY f.table_type) - f.points AS gap,
         CASE WHEN f.driver_id IS NOT NULL THEN (
           SELECT COUNT(DISTINCT e.race_id)
             FROM race_entries e JOIN races r ON r.id = e.race_id
            WHERE r.year = f.year AND e.finish_position = 1
              AND e.driver_id = f.driver_id) END AS wins
    FROM v_standings_final f
    LEFT JOIN constructors k ON k.id = f.constructor_id
   WHERE f.year = ?1
   ORDER BY f.table_type, f.position IS NULL, f.position, f.points DESC, f.id
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
 * and no arithmetic this simple can say who is out. A system that dropped
 * nothing says EVERY_RESULT_COUNTS, and verify.py holds that spelling to
 * every such row (DA-18). `session` is which of the two period tables a row
 * belongs to.
 *
 * `scale` and `sprint_scale` are the two systems' points by place, as the
 * JSON arrays the table holds, for what a team can still win (AF-132): a
 * one-two is the first two places added, read from the season's own scale
 * and never written here. `sprint_scale` is NULL in a season with no sprint
 * system.
 *
 * `countback` is how the season's own regulations settle a tie on points,
 * from `tie_breaks` (AF-137): RACE_PLACES, or NULL where no period read
 * covers the season, which titleAnswer() declines to work out. `results` is
 * how many of the rounds run have a winner in race_entries, because the
 * countback is counted from those and the classification is harvested apart
 * from the calendar: a round run with no result yet would be counted as
 * nobody's places.
 */
/** What `points_systems.dropped_scores` says of a system that dropped no result. */
export const EVERY_RESULT_COUNTS = 'Every result counts'

export const REMAINING = `
  WITH to_run AS (
    SELECT SUM(CASE WHEN r.status <> 'completed' THEN 1 ELSE 0 END)          AS races,
           SUM(CASE WHEN r.status <> 'completed' THEN r.sprint ELSE 0 END)   AS sprints,
           SUM(CASE WHEN r.status =  'completed' THEN 1 ELSE 0 END)          AS run
      FROM races r
     WHERE r.year = ?1),
  gp AS (
    SELECT win_points, fastest_lap_points, dropped_scores, scale
      FROM points_systems
     WHERE session = 'race'
       AND from_year <= ?1 AND (to_year IS NULL OR to_year >= ?1)
     ORDER BY from_year DESC LIMIT 1),
  sp AS (
    SELECT win_points, scale
      FROM points_systems
     WHERE session = 'sprint'
       AND from_year <= ?1 AND (to_year IS NULL OR to_year >= ?1)
     ORDER BY from_year DESC LIMIT 1)
  SELECT t.races, t.sprints, t.run, g.win_points, g.fastest_lap_points, g.dropped_scores,
         g.scale, (SELECT scale FROM sp) AS sprint_scale,
         COALESCE((SELECT win_points FROM sp), 0) AS sprint_points,
         t.races * (g.win_points + g.fastest_lap_points)
           + t.sprints * COALESCE((SELECT win_points FROM sp), 0) AS available,
         (SELECT countback FROM tie_breaks
           WHERE from_year <= ?1 AND to_year >= ?1) AS countback,
         (SELECT COUNT(DISTINCT e.race_id)
            FROM race_entries e JOIN races r ON r.id = e.race_id
           WHERE r.year = ?1 AND r.status = 'completed' AND e.finish_position = 1) AS results
    FROM to_run t, gp g
`

/** What `tie_breaks.countback` says of a count of Grand Prix places, first places first (AF-137). */
export const RACE_PLACES = 'race places'

/**
 * Every driver's and every team's Grand Prix places in the season so far,
 * one row a place (AF-137): `kind` is the table, `id` the driver or
 * constructor id the standings match on, `n` how many times they finished
 * there. A team's are both its cars', as the countback counts them. Only
 * rounds run are read, and only classified finishes; a sprint's places are
 * not, because the regulations count places in a race (tie_breaks).
 */
export const PLACES = `
  SELECT 'drivers' AS kind, e.driver_id AS id, e.finish_position AS place, COUNT(*) AS n
    FROM race_entries e JOIN races r ON r.id = e.race_id
   WHERE r.year = ?1 AND r.status = 'completed'
     AND e.finish_position IS NOT NULL AND e.driver_id IS NOT NULL
   GROUP BY e.driver_id, e.finish_position
  UNION ALL
  SELECT 'constructors', e.constructor_id, e.finish_position, COUNT(*)
    FROM race_entries e JOIN races r ON r.id = e.race_id
   WHERE r.year = ?1 AND r.status = 'completed'
     AND e.finish_position IS NOT NULL AND e.constructor_id IS NOT NULL
   GROUP BY e.constructor_id, e.finish_position
`

/**
 * The drivers' table after one round and after the round before it, each row
 * with the most points still to be won from there, for titleSettled() below
 * (CD-61). Read with (year, round) by Race.jsx and scripts/prerender.js.
 *
 * `available` is REMAINING's arithmetic from a given round rather than from
 * today: every round of the season after it, completed or not, at the most a
 * race can pay one driver - a win and, where the season paid one, the
 * fastest lap - and each sprint after it at a sprint win. A sprint with no
 * sprint system to price it makes it NULL, which declines, rather than
 * pricing it at nothing. `dropped_scores` comes back for the same reason it
 * does there. The champion comes back so the answer can be held to the
 * season record; it is NULL until a title is recorded. `wins` is each
 * driver's race wins that season up to the round, and `races_left` the
 * races after it, which is what a tie on points is settled on.
 *
 * The figures are the most the rules allowed, not what was paid: a
 * shortened race paid half, which only makes a driver behind less able to
 * catch up than this says, never more. The one round that paid double, the
 * last of 2014, is the exception, and is the round that season was settled
 * at whichever price is used.
 */
export const TITLE_STANDINGS = `
  WITH gp AS (
    SELECT win_points + fastest_lap_points AS most, dropped_scores
      FROM points_systems
     WHERE session = 'race'
       AND from_year <= ?1 AND (to_year IS NULL OR to_year >= ?1)
     ORDER BY from_year DESC LIMIT 1),
  sp AS (
    SELECT win_points AS most
      FROM points_systems
     WHERE session = 'sprint'
       AND from_year <= ?1 AND (to_year IS NULL OR to_year >= ?1)
     ORDER BY from_year DESC LIMIT 1),
  still AS (
    SELECT a.n AS after_round,
           (SELECT COUNT(*) FROM races r WHERE r.year = ?1 AND r.round > a.n) AS races,
           (SELECT COALESCE(SUM(r.sprint), 0) FROM races r WHERE r.year = ?1 AND r.round > a.n) AS sprints
      FROM (SELECT ?2 - 1 AS n UNION ALL SELECT ?2) a)
  SELECT s.after_round, s.driver_id, s.entity, s.points, s.position, gp.dropped_scores,
         a.races AS races_left,
         (SELECT COUNT(*) FROM race_entries w JOIN races r ON r.id = w.race_id
           WHERE r.year = ?1 AND r.round <= s.after_round
             AND w.driver_id = s.driver_id AND w.finish_position = 1) AS wins,
         a.races * gp.most
           + CASE WHEN a.sprints = 0 THEN 0 ELSE a.sprints * (SELECT most FROM sp) END AS available,
         se.drivers_champion
    FROM standings s
    JOIN still a ON a.after_round = s.after_round
    CROSS JOIN gp
    LEFT JOIN seasons se ON se.year = ?1
   WHERE s.year = ?1 AND s.table_type = 'drivers' AND s.basis = 'running'
   ORDER BY s.after_round, s.id
`

/**
 * Whether this round settled the drivers' title, from TITLE_STANDINGS' rows:
 * `{ champion, ledBefore }`, or null (CD-61).
 *
 * Settled HERE means two things, and both must hold. After this round no
 * other driver could finish ahead of the leader: each was behind by more
 * than the points still to be won, or by exactly that and would lose the
 * tie on wins. And after the round before, someone still could: a driver
 * behind by less than what was left, or by exactly that and able to win
 * the tie. A level total is settled on wins, and a driver who scores the
 * most still to be won has won every race left, so the tie is the leader's
 * wins against that driver's wins plus the races left - 2004, settled in
 * Belgium on a margin of 40 with 40 left, and 2006, still open going into
 * Brazil on a margin of 10 with 10 left. Where those two are level too the
 * next countback decides, which this does not work out, and it declines.
 * So does everything titleAnswer() declines - a dropped-scores season,
 * where a total need not rise by what its driver scores, fewer than two
 * drivers on a table, a table missing for either round, a driver whose
 * sources give two totals after one round. A leader who is not the season's
 * recorded champion declines too, as a table that has gone wrong rather
 * than a fact.
 *
 * `ledBefore` names the sole leader going into the round when that was
 * someone else: the title lost, as well as won, at this round.
 */
export function titleSettled(rows, round) {
  const list = rows ?? []
  if (!list.length || list[0].dropped_scores !== EVERY_RESULT_COUNTS) return null
  // The table after one round: its leader, the margin to second, and
  // whether the title was `settled` or still `open` there - or null where
  // the rows cannot say which.
  const table = (after) => {
    const byDriver = new Map()
    let available = null
    let racesLeft = null
    for (const row of list) {
      if (row.after_round !== after) continue
      available = row.available
      racesLeft = row.races_left
      // Excluded from the classification: neither the leader nor someone to
      // catch, as titleAnswer() reads the same footer.
      if (missing(row.points) || missing(row.position)) continue
      const held = byDriver.get(row.driver_id)
      if (held && held.points !== row.points) return null
      byDriver.set(row.driver_id, row)
    }
    if (byDriver.size < 2 || missing(available)) return null
    // Level on points, the table's own order says who leads.
    const order = [...byDriver.values()].sort((a, b) => b.points - a.points || a.position - b.position)
    const leader = order[0]
    let open = false
    let unknown = false
    for (const rival of order.slice(1)) {
      const gap = leader.points - rival.points
      if (gap < available) open = true
      else if (gap === available) {
        if (missing(racesLeft) || missing(rival.wins) || missing(leader.wins)) unknown = true
        else if (rival.wins + racesLeft > leader.wins) open = true
        else if (rival.wins + racesLeft === leader.wins) unknown = true
      }
    }
    if (!open && unknown) return null
    return { leader, margin: leader.points - order[1].points, open }
  }
  const after = table(round)
  const before = table(round - 1)
  if (!after || !before || after.open || !before.open) return null
  const champion = list[0].drivers_champion
  if (!missing(champion) && champion !== after.leader.driver_id) return null
  const ledBefore =
    before.margin > 0 && before.leader.driver_id !== after.leader.driver_id ? before.leader.entity : null
  return { champion: after.leader.entity, ledBefore }
}

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
 * static page can print the rows as they come. Within a constructor the
 * entrants run by the name the table shows, not by the id it used to.
 */
export const ENTRANTS = `
  SELECT se.id, se.entrant_id, se.entrant_name, se.constructor_id, k.name AS constructor,
         se.chassis_ids, se.chassis_count, se.engine_ids, se.tyre_ids, se.tyre_names
    FROM season_entrants se
    LEFT JOIN constructors k ON k.id = se.constructor_id
   WHERE se.year = ?
   ORDER BY k.name IS NULL, k.name COLLATE NOCASE, se.entrant_name COLLATE NOCASE, se.entrant_id
`

/**
 * The register's name for every chassis and engine the season's entrants
 * list (UR-14). season_entrants keeps those as '+'-separated ids, for the
 * reason schema.sql gives, and `full_name` in `chassis` and `engines` names
 * each of them - verify.py holds every id in the lists to a register row.
 * `entrantNames` below puts the names into the rows in list order.
 */
export const ENTRANT_CHASSIS = `
  SELECT ch.id, ch.full_name AS name
    FROM chassis ch
   WHERE EXISTS (SELECT 1 FROM season_entrants se
                  WHERE se.year = ?1 AND instr('+' || se.chassis_ids || '+', '+' || ch.id || '+') > 0)
`

export const ENTRANT_ENGINES = `
  SELECT en.id, en.full_name AS name
    FROM engines en
   WHERE EXISTS (SELECT 1 FROM season_entrants se
                  WHERE se.year = ?1 AND instr('+' || se.engine_ids || '+', '+' || en.id || '+') > 0)
`

const ids = (list) => (list ? list.split('+') : [])

/**
 * The entrant rows with names where the table used to print slugs (UR-14),
 * so both renderers read one shape: `chassis` is each chassis as { id, name }
 * in the row's own order, which the app and the static page link to
 * /cars/<id>; `chassis_names`, `engine_names` and `tyres` are the names as
 * one string, which is what the cell says, what the column sorts on and what
 * a file taken from the table carries. An id with no register row - which
 * verify.py refuses - would show as itself rather than vanish.
 */
export function entrantNames(rows, chassis, engines) {
  const chassisName = new Map(chassis.map((c) => [c.id, c.name]))
  const engineName = new Map(engines.map((e) => [e.id, e.name]))
  const joined = (names) => (names.length ? names.join(', ') : null)
  return rows.map((row) => {
    const cars = ids(row.chassis_ids).map((id) => ({ id, name: chassisName.get(id) ?? id }))
    return {
      ...row,
      chassis: cars,
      chassis_names: joined(cars.map((c) => c.name)),
      engine_names: joined(ids(row.engine_ids).map((id) => engineName.get(id) ?? id)),
      tyres: joined(ids(row.tyre_names)),
    }
  })
}

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

/**
 * THE NEXT ROUND, ON THE PAGE OF THE SEASON BEING RUN (PD-49).
 *
 * The first round the database holds no classification for - the round the
 * calendar strip below marks "next" (lib/outline.js roundStates), from the
 * same status, so the section and the strip cannot name different rounds and
 * the static page, which has no clock, names the same one as the app.
 *
 * Only on the page of meta.current_season (lib/season.js). Next season's
 * page has a "next round" too, a year away, and the question this section
 * answers - where is the championship going this weekend - is not one that
 * page is asked. A season with nothing left to run returns no row, and the
 * section is absent.
 */
export const NEXT_ROUND = `
  SELECT r.year, r.round, r.name_used, r.date_iso, r.date_from, r.date_to, r.sprint, r.circuit_id,
         c.name AS circuit, c.locality, c.country,
         r.f1db_layout_id, o.path AS outline, o.length_km AS outline_km, o.turns AS outline_turns
    FROM races r
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN circuit_outlines o ON o.f1db_layout_id = r.f1db_layout_id
   WHERE r.year = ?1 AND r.year = ${CURRENT_SEASON_SQL} AND r.status <> 'completed'
   ORDER BY r.round
   LIMIT 1
`

/** How many of the venue's past winners the section names; the circuit's page has every one. */
export const WON_HERE_LIMIT = 5

/**
 * The last Grands Prix run at the next round's venue, newest first, with who
 * won each. The venue is the circuit, not the event's name: a Grand Prix that
 * has moved takes its history with the name, and the one being raced this
 * weekend is at this circuit. The winner and the car are counted from the
 * race records, as the calendar above counts them.
 */
export const WON_HERE = `
  WITH next AS (${NEXT_ROUND})
  SELECT r.year, r.round, r.name_used,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.finish_position = 1)          AS winner,
         (SELECT e.driver_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winner_id,
         (SELECT k.name FROM race_entries e JOIN constructors k ON k.id = e.constructor_id
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS constructor,
         (SELECT e.constructor_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS constructor_id
    FROM races r
   WHERE r.circuit_id = (SELECT circuit_id FROM next) AND r.status = 'completed'
   ORDER BY r.year DESC, r.round DESC
   LIMIT ${WON_HERE_LIMIT}
`

/** The ids of the races WON_HERE prints, chosen as it chooses them, for SEASON_SOURCES. */
const WON_HERE_RACES = `
  SELECT r.id FROM races r
   WHERE r.circuit_id = (SELECT circuit_id FROM (${NEXT_ROUND})) AND r.status = 'completed'
   ORDER BY r.year DESC, r.round DESC
   LIMIT ${WON_HERE_LIMIT}
`

/**
 * The next venue's OpenStreetMap trace, where it has one: queries/circuit.js
 * GEOMETRY for the one circuit the section is about. Nothing in f1.db - the
 * centrelines ship as f1-geometry.db and only the browser merges them - so
 * the static page never has a row, and the app has one only once the overlay
 * has arrived.
 */
export const NEXT_TRACE = `
  WITH next AS (${NEXT_ROUND})
  SELECT g.* FROM circuit_geometry g WHERE g.circuit_id = (SELECT circuit_id FROM next)
`

/**
 * The registry entries behind the rows this page prints, for the citation's
 * second sentence (CD-46, as CD-08 did for races and drivers; site.js's
 * behindThisPage says what it reads). The season's own row; every round on
 * the calendar; every entry in those rounds - the calendar's winner, pole and
 * fastest lap, the grid's count and the colour beside a driver's name are all
 * read from them; every standings row the tables are read from, by the rule
 * DRIVER_SOURCES gives for the same view (a finished table's final rows, and
 * for one not finished every source's running rows), and the running rows
 * the title-race chart and the round the tables stand after are read from,
 * chosen as STANDINGS chooses them; and every entrant.
 *
 * Three more only where the page prints them. The entry list (CURRENT_GRID)
 * and the past winners at the next venue (WON_HERE) are each in their
 * section; the timetable is read on the page of a season with a round still
 * to run, by the next round's section and by the app's next-session tile,
 * which is the one thing here that depends on the clock, so the whole
 * season's sessions are named rather than the ones still ahead. The entry
 * list has no `source_id`, so its whole-table entry in `table_provenance`
 * stands for its rows.
 *
 * The points-system rows are TITLE_SOURCES, and seasonSources() adds them
 * where the page reads them: titleAnswer() decides whether the arithmetic is
 * printed on more than SQL can say. `id` and `priority` come back for that
 * merge. A name joined in to label a row is the label's, as on a
 * driver's page; outlines and photographs carry their own credit beside them.
 */
export const SEASON_SOURCES = `
  SELECT s.id, s.priority, s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id IN (
           SELECT source_id FROM seasons WHERE year = ?1
     UNION SELECT source_id FROM races WHERE year = ?1
     UNION SELECT e.source_id FROM race_entries e JOIN races r ON r.id = e.race_id WHERE r.year = ?1
     UNION SELECT t.source_id FROM standings t
            WHERE t.year = ?1
              AND (t.basis = 'final'
                   OR NOT EXISTS (SELECT 1 FROM standings f
                                   WHERE f.year = t.year AND f.table_type = t.table_type
                                     AND f.basis = 'final'))
     UNION SELECT t.source_id FROM standings t
            WHERE t.year = ?1 AND t.basis = 'running'
              AND t.source = (SELECT source FROM standings
                               WHERE year = ?1 AND basis = 'running'
                               GROUP BY source
                               ORDER BY COUNT(DISTINCT after_round) DESC, MAX(after_round) DESC, source
                               LIMIT 1)
     UNION SELECT source_id FROM season_entrants WHERE year = ?1
     UNION SELECT p.source_id FROM table_provenance p
            WHERE p.tbl = 'season_entries' AND EXISTS (SELECT 1 FROM season_entries WHERE year = ?1)
     UNION SELECT x.source_id FROM sessions x JOIN races r ON r.id = x.race_id
            WHERE r.year = ?1
              AND EXISTS (SELECT 1 FROM races y WHERE y.year = ?1 AND y.status <> 'completed')
     UNION SELECT w.source_id FROM races w
            WHERE w.id IN (${WON_HERE_RACES})
     UNION SELECT e.source_id FROM race_entries e
            WHERE e.finish_position = 1 AND e.race_id IN (${WON_HERE_RACES}))
   ORDER BY s.priority, s.id
`

/** The points-system rows REMAINING reads: a table with no `source_id`, so its `table_provenance` entry. */
export const TITLE_SOURCES = `
  SELECT s.id, s.priority, s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id IN (SELECT source_id FROM table_provenance WHERE tbl = 'points_systems')
   ORDER BY s.priority, s.id
`

/**
 * What the countback is counted from (AF-137): the season's tie-break
 * period, by its own row, and the Grand Prix results PLACES counts. A page
 * cites them only where it printed an answer that counted a tie back
 * (countedTie), never because a season has a rule.
 */
export const TIE_SOURCES = `
  SELECT s.id, s.priority, s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id IN (
           SELECT source_id FROM tie_breaks WHERE from_year <= ?1 AND to_year >= ?1
     UNION SELECT e.source_id FROM race_entries e JOIN races r ON r.id = e.race_id
            WHERE r.year = ?1 AND r.status = 'completed' AND e.finish_position IS NOT NULL)
   ORDER BY s.priority, s.id
`

/**
 * Whether a printed answer counted a tie back (AF-137), so that TIE_SOURCES
 * is behind it. Without `kind`, the whole answer, whose basis states the
 * rule wherever a fight in it has the rule held; with it, one contender's
 * line, which the countback reaches only where its fight has a rival who
 * can at best draw level.
 */
export const countedTie = (answer, kind) => {
  if (kind) {
    const fight = answer?.[kind]
    return Boolean(fight?.tie && fight.rows.some((d) => d.level))
  }
  return Boolean(answer?.drivers?.tie || answer?.constructors?.tie)
}

/**
 * SEASON_SOURCES, with TITLE_SOURCES joined in where the page prints what
 * the points system says: the title arithmetic, where `answer` -
 * seasonAnswer()'s result, which both renderers print when it is not null -
 * says it is printed; and a rule that dropped scores, which the title
 * chart's note says (progressionNote) on a season that ran under one. Both
 * renderers pass `remaining`, REMAINING's row, whether or not the static page
 * draws the chart, so the sentence is one sentence. One entry per source, in
 * the registry's order.
 */
export const seasonSources = (sources, title, { answer, remaining, tie = [] }) => {
  const dropped = remaining?.dropped_scores
  if (!answer && (missing(dropped) || dropped === EVERY_RESULT_COUNTS)) return sources
  const cited = mergeSources(sources, title)
  return countedTie(answer) ? mergeSources(cited, tie) : cited
}

/** Two lists of registry entries as one, one entry per source, in the registry's order. */
export const mergeSources = (sources, more) => {
  const byId = new Map([...sources, ...more].map((s) => [s.id, s]))
  return [...byId.values()].sort((a, b) => a.priority - b.priority || a.id - b.id)
}

export const NEXT_HEADING = 'The next round'
export const WON_HERE_HEADING = 'Won here before'

/**
 * The sentence that opens the section, in the pieces either side of its two
 * links - the race and the circuit - so both renderers say it word for word:
 *
 *     Round 15, 24–26 Sep 2026: Azerbaijan Grand Prix at Baku City Circuit,
 *     Baku, Azerbaijan.
 *
 * The weekend is not in the strings: `dated` says there is one, and each
 * renderer draws it between `before` and `colon` as a date in its reader's
 * format (components/Dates.jsx, CD-57).
 *
 * The place is the circuit page's own eyebrow, locality then country. A round
 * with no circuit recorded says nothing about where it is rather than
 * guessing, and the Sprint tag goes after the race's name in both halves.
 */
export const nextLine = (next) => {
  const place = [next.locality, next.country].filter(Boolean).join(', ')
  return {
    before: `Round ${next.round}${raceDates(next) ? ', ' : ''}`,
    dated: raceDates(next) !== null,
    colon: ': ',
    at: next.circuit ? ' at ' : '',
    circuit: next.circuit ?? '',
    after: `${next.circuit && place ? `, ${place}` : ''}.`,
  }
}

/**
 * The line under the past winners: how many there are and where the rest
 * are, or that there are none. A venue with no race run is a fact about the
 * register - no championship Grand Prix is recorded there - not a gap in it.
 */
export const wonHereNote = (next, rows) =>
  rows.length === 0
    ? `No championship Grand Prix is recorded at ${next.circuit ?? 'this circuit'} before this one.`
    : rows.length < WON_HERE_LIMIT
      ? `Every Grand Prix run at ${next.circuit}, newest first.`
      : `The last ${WON_HERE_LIMIT} Grands Prix run at ${next.circuit}, newest first. Every race held there is on the circuit's page.`

export const WON_HERE_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', rowHeader: true, label: 'Grand Prix' },
  { key: 'winner', label: 'Winner' },
  { key: 'constructor', label: 'Constructor' },
]

/** "Yuki Tsunoda reserve": the role, wherever the seat is not a race seat. */
export const gridDriver = (name, row) =>
  row.role && row.role !== 'race' ? `${text(name)} ${row.role}` : text(name)

export const GRID_COLUMNS = [
  { key: 'car_number', label: 'No.', align: 'num' },
  { key: 'driver', rowHeader: true, label: 'Driver', text: gridDriver },
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
  'The entry list as the season declared it, one row per driver. The count above is taken from the race ' +
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

/**
 * The title-race chart's note. The dropped-scores sentence is said only of a
 * season whose scoring rule dropped results (CD-50): it sat on all 36 charts
 * from 1991 on, where it is false, and since PD-58 and VD-53 beside the h1.
 * `dropped` is the season's `points_systems.dropped_scores`, REMAINING's
 * column; a season with no rule on record makes no claim either way.
 */
export const progressionNote = (live, dropped) => {
  const who = `${live ? 'The three drivers placed highest so far' : 'The three drivers who finished highest'}, tracked from the opening round.`
  if (missing(dropped) || dropped === EVERY_RESULT_COUNTS) return who
  return `${who} Before 1991 only a driver's best few results counted, so a line can rise by less than they scored that weekend.`
}

/** The title race's numbers, as Figure's table lays them out. */
export const TITLE_RACE_COLUMNS = [
  { key: 'driver', label: 'Driver', rowHeader: true },
  { key: 'round', label: 'After round', align: 'num', rowHeader: true },
  { key: 'points', label: 'Points', align: 'num' },
]

/** What the title race plots, over the figure under its finding (VD-121). */
export const TITLE_RACE_KICKER = 'Points after each round'

/**
 * Every entry of the season's top three, round by round, for the notes the
 * title race's markers point to (VD-121): which rounds a contender missed,
 * and how their race ended where it matters. A position shared at third
 * brings in every driver holding it; titleRaceFigure() reads only the three
 * it draws. Read with the year by Season.jsx and scripts/prerender.js.
 */
export const CONTENDER_ENTRIES = `
  SELECT r.round, e.driver_id, e.finish_position, e.position_text, e.status, e.laps_completed
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE r.year = ?1
     AND e.driver_id IN (SELECT driver_id FROM v_standings_final
                          WHERE year = ?1 AND table_type = 'drivers'
                            AND driver_id IS NOT NULL AND position <= 3)
   ORDER BY r.round, e.driver_id, e.id
`

/**
 * Who led the drivers' table after each round, from STANDINGS' rows: one
 * entry per round the table is held for, in order, each with the driver
 * alone on the most points (`id`, `name`), or a null `id` where two or more
 * share it or a source gives one driver two totals - a lead nobody held
 * outright. `level` is everyone on the most points.
 */
export function leadersByRound(standings) {
  const tables = new Map()
  for (const r of standings) {
    if (r.table_type !== 'drivers' || missing(r.points) || missing(r.driver_id) || missing(r.after_round)) continue
    if (!tables.has(r.after_round)) tables.set(r.after_round, new Map())
    const table = tables.get(r.after_round)
    const held = table.get(r.driver_id)
    table.set(r.driver_id, { name: r.entity, points: held && held.points !== r.points ? NaN : r.points })
  }
  return [...tables]
    .sort((a, b) => a[0] - b[0])
    .map(([round, table]) => {
      const rows = [...table]
      if (rows.some(([, v]) => Number.isNaN(v.points))) return { round, id: null, name: null, level: [] }
      const most = Math.max(...rows.map(([, v]) => v.points))
      const level = rows.filter(([, v]) => v.points === most)
      return level.length === 1
        ? { round, id: level[0][0], name: level[0][1].name, level: [level[0][0]] }
        : { round, id: null, name: null, level: level.map(([id]) => id) }
    })
}

/**
 * The title race's finding (VD-121): one sentence, over the chart, of who
 * led and for how long, from leadersByRound(). `nameOf` gives a driver's
 * short name from their id and full name. Null where the table is not held
 * after every round from the first - a gap would make "every round" a
 * guess - or nobody leads outright after the last.
 *
 *     Hunt led after every round
 *     Lauda led after fifteen rounds. Hunt led after one: the last
 *     Farina led after four of the seven rounds, including the last
 *     Prost led after eleven of the sixteen rounds, and every one from round 9
 *     Antonelli has led after every round since round 4
 */
export function titleFinding(leaders, live, nameOf) {
  if (leaders.length < 2 || leaders.some((l, i) => l.round !== i + 1)) return null
  const last = leaders[leaders.length - 1]
  if (!last.id) return null
  const n = leaders.length
  // Counts in words to twenty, as a sentence spells them; past it, digits
  // for both, so "14 of the 22 rounds" is not half of each.
  const count = (k) => (n > 20 ? number(k) : inWords(k))
  const who = nameOf(last.id, last.name)
  const led = leaders.filter((l) => l.id === last.id).length
  let from = n - 1
  while (from > 0 && leaders[from - 1].id === last.id) from -= 1
  const since = leaders[from].round
  if (led === n) return live ? `${who} has led after every round so far` : `${who} led after every round`
  if (from === n - 1) {
    if (live) return `${who} took the lead after round ${number(last.round)}`
    if (led > 1) return `${who} led after ${count(led)} of the ${count(n)} rounds, including the last`
    const before = leaders[n - 2]
    if (!before.id) return `${who} led after one round: the last`
    const times = leaders.filter((l) => l.id === before.id).length
    return `${nameOf(before.id, before.name)} led after ${count(times)} round${times === 1 ? '' : 's'}. ${who} led after one: the last`
  }
  if (led === n - from)
    return live ? `${who} has led after every round since round ${number(since)}` : `${who} led after every round from round ${number(since)}`
  return live
    ? `${who} has led after ${count(led)} of the ${count(n)} rounds, and every one since round ${number(since)}`
    : `${who} led after ${count(led)} of the ${count(n)} rounds, and every one from round ${number(since)}`
}

// "Fuel system" as it reads inside a sentence.
const lowered = (status) => status.charAt(0).toLowerCase() + status.slice(1)
const FATAL = /^Fatal/

/**
 * How one contender's race ended, as a note says it, from their entries in
 * that round: "wins", "finishes 3rd", "crashes out", "withdraws after two
 * laps", "retires (engine)", "does not start (accident in practice)". Null
 * where they had more than one entry - a shared drive, whose car's result
 * is not theirs alone - or none, or the record says nothing a sentence can.
 */
export function raceEnded(entries) {
  if (entries.length !== 1) return null
  const [e] = entries
  if (!missing(e.finish_position)) return e.finish_position === 1 ? 'wins' : `finishes ${ordinal(e.finish_position)}`
  // A status that only says the result again ("Retired") adds nothing.
  const why = !missing(e.status) && e.status !== e.position_text && !/^retire/i.test(e.status) ? ` (${lowered(e.status)})` : ''
  switch (e.position_text) {
    case 'DNF':
      if (e.status === 'Accident') return 'crashes out'
      if (e.status === 'Withdrew')
        return e.laps_completed > 0 ? `withdraws after ${inWords(e.laps_completed)} lap${e.laps_completed === 1 ? '' : 's'}` : 'withdraws'
      return `retires${why}`
    case 'DNS':
      return `does not start${why}`
    case 'DSQ':
      return 'is disqualified'
    case 'EX':
      return 'is excluded'
    case 'NC':
      return 'is not classified'
    case 'DNQ':
      return 'does not qualify'
    case 'DNPQ':
      return 'does not pre-qualify'
    default:
      return null
  }
}

// "R11 and R12", "R13 to R16", "R4, R6 and R9".
const roundList = (rounds) => {
  const r = rounds.map((n) => `R${number(n)}`)
  if (rounds.length >= 3 && rounds.every((n, i) => i === 0 || n === rounds[i - 1] + 1)) return `${r[0]} to ${r[r.length - 1]}`
  return r.length < 2 ? r.join('') : `${r.slice(0, -1).join(', ')} and ${r[r.length - 1]}`
}

/**
 * The notes on the title race (VD-121): at most one of each kind, in round
 * order, each `{ series, x, lead, text, band }` - the line and round its
 * marker sits on, the bold lead and the line under it in the key, and the
 * span it shades, if any. Every one is a fact the rows below state:
 *
 * - A contender's longest run of rounds without an entry, after their first
 *   (one after a fatal accident before any other, then the longest, the
 *   earliest, the higher placed): marked at the last round they entered
 *   before it, which is shaded to the last missed. A round none of the
 *   three entered - the Indianapolis 500, which the championship counted to
 *   1960 and most of its regulars did not run - is no absence. Where the
 *   entry before it ended in a fatal accident the note says that, in the
 *   record's words, and nothing of rounds "missed"; where it ended in a
 *   disqualification the note does not say so, since "disqualified, then
 *   misses" would read as the cause.
 * - The round the champion settled the title with rounds still to run,
 *   where clinchRound() establishes it: never in a season that dropped
 *   scores, whose arithmetic declines.
 * - A title decided at the last round: the champion did not lead outright
 *   after the round before it, and does after it. How the rival who led, or
 *   who was level, finished there, then the champion, and the final margin.
 *
 * `series` are the drawn contenders, `{ id, name, short, points }`.
 */
export function titleRaceNotes({ live, series, drivers, standings, rounds, entries, champion, remaining }) {
  const notes = []
  const index = new Map(series.map((s, i) => [s.id, i]))
  const plotted = (i, round) => series[i].points.some((p) => p.x === round)
  const raceName = (round) => rounds.find((r) => r.round === round)?.name_used ?? null
  const lead = (round) => (raceName(round) ? `R${number(round)}, ${raceName(round)}` : `R${number(round)}`)
  const entriesOf = (id, round) => entries.filter((e) => e.driver_id === id && e.round === round)

  // The longest absence.
  const run = rounds.filter((r) => r.status === 'completed').map((r) => r.round)
  const anyone = new Set(entries.filter((e) => index.has(e.driver_id)).map((e) => e.round))
  const counted = run.filter((round) => anyone.has(round))
  // A fatal ending outranks any absence: the absence after it is the
  // driver's death, which the note must say (1961: von Trips at Monza, not
  // Hill's missing the round Ferrari withdrew from). Then the longest, the
  // earliest, the higher placed.
  const fatalAt = (i, round) => {
    const ended = entriesOf(series[i].id, round)
    return ended.length === 1 && !missing(ended[0].status) && FATAL.test(ended[0].status)
  }
  const outranks = (a, b) => {
    const fa = fatalAt(a.i, a.after)
    const fb = fatalAt(b.i, b.after)
    if (fa !== fb) return fa
    if (a.missed.length !== b.missed.length) return a.missed.length > b.missed.length
    return a.after < b.after
  }
  let away = null
  series.forEach((s, i) => {
    const entered = new Set(entries.filter((e) => e.driver_id === s.id).map((e) => e.round))
    if (entered.size === 0) return
    const first = Math.min(...entered)
    let after = null
    let missed = []
    const close = () => {
      if (missed.length && after !== null) {
        const candidate = { i, after, missed }
        if (!away || outranks(candidate, away)) away = candidate
      }
      missed = []
    }
    for (const round of counted) {
      if (round < first) continue
      if (entered.has(round)) {
        close()
        after = round
      } else missed.push(round)
    }
    close()
  })
  if (away && plotted(away.i, away.after)) {
    const s = series[away.i]
    const ended = entriesOf(s.id, away.after)
    if (fatalAt(away.i, away.after)) {
      notes.push({ series: away.i, x: away.after, lead: lead(away.after), text: `${s.short}: ${lowered(ended[0].status)}.`, band: null })
    } else {
      // A disqualification is not said before an absence: "disqualified,
      // then misses" reads as the cause, and need not be (1994: Schumacher's
      // ban was for Silverstone, not Spa).
      const how = /^(?:DSQ|EX)$/.test(ended.length === 1 ? ended[0].position_text : '') ? null : raceEnded(ended)
      notes.push({
        series: away.i,
        x: away.after,
        lead: lead(away.after),
        text: `${s.short} ${how ? `${how}, then misses` : 'misses'} ${roundList(away.missed)} (shaded).`,
        band: { from: away.after, to: away.missed[away.missed.length - 1] },
      })
    }
  }

  const leaders = leadersByRound(standings)
  const lastRound = leaders.length ? leaders[leaders.length - 1].round : null
  const calendarEnd = rounds.length ? Math.max(...rounds.map((r) => r.round)) : null
  const champ = !missing(champion) && index.has(champion) ? index.get(champion) : null

  // Settled with rounds to run.
  if (champ !== null && lastRound !== null && remaining?.dropped_scores === EVERY_RESULT_COUNTS) {
    const at = clinchRound({ most: mostPerRound(remaining), rounds, standings, afterRound: lastRound }, 'drivers', champion)
    const left = at === null ? 0 : rounds.filter((r) => r.round > at).length
    if (at !== null && left > 0 && plotted(champ, at))
      notes.push({
        series: champ,
        x: at,
        lead: lead(at),
        text: `${series[champ].short} settles the title with ${inWords(left)} round${left === 1 ? '' : 's'} to run.`,
        band: null,
      })
  }

  // Decided at the last round.
  const [first, second] = drivers
  const margin = first && second && !missing(first.points) && !missing(second.points) ? first.points - second.points : null
  if (
    !live &&
    champ !== null &&
    leaders.length >= 2 &&
    lastRound === calendarEnd &&
    first?.driver_id === champion &&
    margin > 0 &&
    plotted(champ, lastRound)
  ) {
    const [before, after] = leaders.slice(-2)
    const rival = before.id ?? before.level.find((id) => id !== champion && index.has(id)) ?? null
    if (after.id === champion && before.id !== champion && rival !== null && index.has(rival)) {
      const them = series[index.get(rival)].short
      const us = series[champ].short
      const level = before.id === null && before.level.includes(champion) ? `${us} and ${them} arrive level on points. ` : ''
      const theirs = raceEnded(entriesOf(rival, lastRound))
      const ours = raceEnded(entriesOf(champion, lastRound))
      const by = margin === 1 ? 'a point' : `${points(margin)} points`
      notes.push({
        series: champ,
        x: lastRound,
        lead: lead(lastRound),
        text: `${level}${theirs ? `${them} ${theirs}. ` : ''}${us} ${ours ? `${ours} and takes` : 'takes'} the title by ${by}.`,
        band: null,
      })
    }
  }
  return notes.sort((a, b) => a.x - b.x).map((note, k) => ({ ...note, n: k + 1 }))
}

/**
 * The title race, as it actually ran (VD-73): everything LineChart and its
 * Figure are given, worked out once for both renderers - Season.jsx draws it
 * in the app, scripts/prerender.js on the static page. Null where fewer than
 * two contenders have a line, which is no race to draw.
 *
 * Three series, because three is what the palette validates to and what a
 * reader can follow at once - the eventual top three, tracked round by
 * round. A points total that goes flat is a driver who scored nothing that
 * weekend; it never falls, because a championship total cannot.
 *
 * Each line in its driver's team colour where the season has one (AF-04):
 * the livery from 2010, the national colour before 1968, the neutral series
 * palette between and wherever a colour is missing. Two drivers of one team
 * share the colour; every line has its slot's dash as well (AX-16), so they
 * are still two lines. A driver who changed teams wears the one they
 * finished with. The chart wears liveries only when every contender has
 * one: a mix of one papaya line and two neutral blues would read as a claim
 * about the blues.
 *
 * Each line is named at its end by its driver's short name, and the
 * annotation pattern (VD-121) adds the finding over the chart and the notes
 * titleRaceNotes() works out, each a marker on a line and an entry in the
 * key under it. A season still being run draws its whole calendar on the x
 * axis, so the lines stop where the season has got to.
 *
 * `drivers` is FINAL's drivers' rows, `standings` STANDINGS's, `teams`
 * teamsByDriver() of DRIVER_TEAMS's, `live` stillRunning() of the calendar,
 * `remaining` REMAINING's row, `rounds` the calendar, `entries`
 * CONTENDER_ENTRIES' rows and `champion` the season's recorded champion's id.
 */
export function titleRaceFigure({ year, live, drivers, standings, teams, remaining, rounds = [], entries = [], champion = null }) {
  const contenders = drivers.slice(0, 3).filter((d) => d.driver_id)
  const shorts = shortNames(contenders.map((d) => d.entity))
  const progression = contenders.map((driver, k) => {
    const last = (teams.get(driver.driver_id) ?? [])[0]
    return {
      id: driver.driver_id,
      name: driver.entity,
      short: shorts[k],
      colour: last ? colourForEntry({ constructorId: last.constructor_id, country: last.country, year, team: last.constructor }) : null,
      // STANDINGS holds the running table only; the season's end is FINAL,
      // and drawing it here would put the final classification beside the
      // last round's running total, which before 1991 is another figure.
      points: standings
        .filter((r) => r.table_type === 'drivers' && r.driver_id === driver.driver_id)
        .sort((a, b) => a.after_round - b.after_round)
        .map((r) => ({ x: r.after_round, y: r.points })),
    }
  })
  if (progression.length <= 1) return null
  const inColour = progression.every((s) => s.colour)
  const series = progression.map((s) => ({ name: s.name, label: s.short, points: s.points, colour: inColour ? s.colour : null }))
  const notes = titleRaceNotes({
    live,
    series: progression.map((s) => ({ id: s.id, name: s.name, short: s.short, points: s.points.map((p) => ({ x: p.x })) })),
    drivers,
    standings,
    rounds,
    entries,
    champion,
    remaining,
  })
  const named = new Map(progression.map((s) => [s.id, s.short]))
  const nameOf = (id, name) => named.get(id) ?? shortNames([name])[0]
  return {
    heading: titleHeading(live),
    note: progressionNote(live, remaining?.dropped_scores),
    finding: titleFinding(leadersByRound(standings), live, nameOf),
    kicker: TITLE_RACE_KICKER,
    annotations: notes.map(({ n, lead, text }) => ({ n, lead, text })),
    marks: notes.map(({ n, series: i, x }) => ({ n, series: i, x })),
    bands: notes.flatMap((note) => (note.band ? [note.band] : [])),
    xMax: live && rounds.length ? Math.max(...rounds.map((r) => r.round)) : null,
    rows: series.flatMap((s) => s.points.map((p) => ({ driver: s.name, round: p.x, points: p.y }))),
    series,
    format: (v) => points(v),
    formatX: (v) => `R${Math.round(v)}`,
    height: 250,
    label: `Championship points by round for the top three drivers of ${year}`,
  }
}

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

/** The first season of the constructors' championship. */
export const CONSTRUCTORS_FROM = 1958

/**
 * The first season in which every car's points counted to its constructor
 * (AF-132). Before it only a team's best-placed car scored for it in each
 * race, so a team's most from a round was a win and not a one-two, and the
 * database holds no row that says which rule a season ran under: the
 * constructors' answer declines before it rather than guess. Every season
 * before 1991 also dropped scores, which declines both answers anyway; the
 * two years are named so that neither rule leans on the other.
 */
export const EVERY_CAR_COUNTS_FROM = 1979

/** A points scale's first two places added - a one-two - or null where the JSON does not hold two numbers. */
const oneTwo = (scale) => {
  try {
    const places = JSON.parse(scale)
    return Array.isArray(places) && places.length >= 2 && places.slice(0, 2).every(Number.isFinite)
      ? places[0] + places[1]
      : null
  } catch {
    return null
  }
}

/**
 * The most one driver and one team can score from one round, under the
 * season's own scoring, from REMAINING's row (AF-132): `{ drivers, constructors }`,
 * each `{ race, sprint }`, a value null where the row cannot say.
 *
 * A driver's is a win and, where the season paid one, the fastest lap: the
 * sum REMAINING's `available` is made of. A team's is a one-two - the first
 * two places of the season's scale - and the fastest lap, which one of its
 * two cars can take; a sprint's, the sprint scale's first two places. A
 * sprint round with no sprint system on record prices the team's sprint at
 * null, which declines, rather than at nothing.
 */
export function mostPerRound(remaining) {
  if (!remaining) return null
  const lap = missing(remaining.fastest_lap_points) ? null : remaining.fastest_lap_points
  const race = (base) => (missing(base) || lap === null ? null : base + lap)
  return {
    drivers: { race: race(remaining.win_points), sprint: missing(remaining.sprint_scale) ? null : remaining.sprint_points },
    constructors: { race: race(oneTwo(remaining.scale)), sprint: oneTwo(remaining.sprint_scale) },
  }
}

/**
 * What a team can still win from REMAINING's row: a one-two in every round
 * still to run and in every sprint, or null where the scale cannot say.
 */
export const teamAvailable = (remaining) => {
  const most = mostPerRound(remaining)?.constructors
  if (!most || most.race === null) return null
  if (remaining.sprints && most.sprint === null) return null
  return remaining.races * most.race + (remaining.sprints ? remaining.sprints * most.sprint : 0)
}

/** A points scale's length - how far down the order it pays - or null where the JSON does not hold numbers. */
const scaleLength = (scale) => {
  try {
    const places = JSON.parse(scale)
    return Array.isArray(places) && places.length >= 2 && places.every(Number.isFinite) ? places.length : null
  } catch {
    return null
  }
}

/**
 * What the countback can be counted from for one title (AF-137), or null
 * where the season's rule is not held - REMAINING's `countback` is not
 * RACE_PLACES - which leaves the tie unsettled and says so in the old words.
 * With the rule held, `counts` is null where the places cannot be counted:
 * no PLACES rows, a scale that does not say how far down it pays, or a round
 * run with no result yet.
 *
 * A rival who can at best draw level does it only one way: by scoring the
 * most there is in every round left - a win, or for a team a one-two, and
 * every sprint - while the leader scores nothing. That fixes both sides'
 * places as far down as the scale pays: the rival's `gained` are a win a
 * round, and for a team a second place too; the leader's places that score
 * stay what they are, because a result that scores nothing is one below
 * them. A sprint's places are not counted, so a sprint adds nothing here.
 */
function tieBreak(kind, remaining, places) {
  if (remaining.countback !== RACE_PLACES) return null
  const depth = scaleLength(remaining.scale)
  if (depth === null || !Array.isArray(places) || remaining.results !== remaining.run) return { counts: null }
  const counts = new Map()
  for (const p of places) {
    if (p.kind !== kind || missing(p.id) || !Number.isInteger(p.place) || p.place < 1 || p.place > depth) continue
    if (!counts.has(p.id)) counts.set(p.id, new Map())
    counts.get(p.id).set(p.place, (counts.get(p.id).get(p.place) ?? 0) + p.n)
  }
  const gained = (place) => (place === 1 || (kind === 'constructors' && place === 2) ? remaining.races : 0)
  return { counts, depth, gained }
}

/**
 * How the countback falls for a rival who can at best draw level with
 * `leaders` (AF-137): `{ wins, place, mine, theirs }`, the first place at
 * which the two counts differ and each side's count there, or null where it
 * cannot be said. With more than one leader the rival has to beat each: a
 * loss to any is a loss, and `place` is that leader's. Level on every place
 * that scores is null, because below those the leader's finishes are not
 * fixed - the regulations go on down the order, and in 2026 on to
 * qualifying, and neither is worked out here.
 */
function settle(tie, rival, leaders) {
  if (!tie?.counts || missing(rival.id) || !leaders.length || leaders.some((l) => missing(l.id))) return null
  const at = (id, place) => tie.counts.get(id)?.get(place) ?? 0
  const outcomes = leaders.map((leader) => {
    for (let place = 1; place <= tie.depth; place += 1) {
      const mine = at(rival.id, place) + tie.gained(place)
      const theirs = at(leader.id, place)
      if (mine !== theirs) return { wins: mine > theirs, place, mine, theirs }
    }
    return null
  })
  const lost = outcomes.find((o) => o && !o.wins)
  if (lost) return lost
  return outcomes.every(Boolean) ? outcomes[0] : null
}

/**
 * One championship's table, measured against what is still to be won: the
 * elimination test both titles share. `table` is FINAL's rows for the one
 * championship; `idOf` reads the driver or constructor id a page matches on;
 * `tie` is tieBreak()'s. Null with fewer than two classified, or nothing to
 * measure against.
 *
 * Each row comes back with `behind` the leader, the most it can still
 * `reach`, and whether it is still `alive`: behind by no more than what is
 * left. A row behind by exactly that is `level`: it can at best draw level,
 * and its `countback` is settle()'s. It is out where the countback goes
 * against it, and counted in otherwise - where it would win the tie, and
 * where nobody can say, which is the reading that puts nobody out wrongly.
 * A table with one id twice is not counted back at all.
 */
function standingFight(kind, table, available, idOf, tie = null) {
  // A row with points and no position was excluded from the classification,
  // which is the same table's footer: neither the leader nor someone to catch.
  const scored = (table ?? []).filter((d) => !missing(d.points) && !missing(d.position))
  if (scored.length < 2 || missing(available)) return null
  const lead = Math.max(...scored.map((d) => d.points))
  const rows = [...scored]
    .sort((a, b) => b.points - a.points || a.position - b.position)
    .map((d) => ({
      id: idOf(d) ?? null,
      entity: d.entity,
      points: d.points,
      position: d.position,
      behind: lead - d.points,
      reach: d.points + available,
      alive: lead - d.points <= available,
      level: false,
      countback: null,
      row: d,
    }))
  const leaders = rows.filter((d) => d.behind === 0)
  const ids = rows.map((d) => d.id)
  const once = new Set(ids).size === ids.length
  for (const d of rows) {
    if (d.behind === 0 || d.behind !== available) continue
    d.level = true
    d.countback = once ? settle(tie, d, leaders) : null
    if (d.countback && !d.countback.wins) d.alive = false
  }
  return { kind, available, lead, rows, leaders, tie, alive: rows.filter((d) => d.alive), scored: rows.length }
}

/** Whether a row is out of a fight on the countback alone: it can draw level and would lose the tie. */
const lostTie = (d) => Boolean(d.level && d.countback && !d.countback.wins)

const PLACE_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

/** "7 wins to 6", or "level on wins, then 4 second places to 3": where settle() found the counts apart. */
const countbackFigures = ({ place, mine, theirs }) => {
  if (place === 1) return `${plural(mine, 'win')} to ${number(theirs)}`
  const word = PLACE_WORDS[place - 1] ?? ordinal(place)
  const before = place === 2 ? 'wins' : `wins and every place to ${PLACE_WORDS[place - 2] ?? ordinal(place - 1)}`
  return `level on ${before}, then ${number(mine)} ${word} place${mine === 1 ? '' : 's'} to ${number(theirs)}`
}

/**
 * The sentence for one rival who can at best draw level (AF-137): how, and
 * who the countback would then favour, with the figures where there is one
 * leader to compare against.
 */
const levelLine = (fight, d, sprints) => {
  const left = `every round${sprints ? ' and sprint' : ''} left`
  const how = fight.kind === 'drivers' ? `by winning ${left}` : `with a one-two in ${left}`
  const start = `${d.entity} can at best draw level with ${listed(fight.leaders.map((l) => l.entity))}, ${how},`
  const c = d.countback
  if (!c) return `${start} and who the countback would then favour is not worked out here.`
  const figures = fight.leaders.length === 1 ? `: ${countbackFigures(c)}` : ''
  return c.wins
    ? `${start} and would then take the title on the countback${figures}.`
    : `${start} and would then lose it on the countback${figures}.`
}

/**
 * The basis's last sentence: how a tie at the top is settled. Where the
 * season's rule is not held, the words VD-90 printed; where it is, the rule,
 * then a sentence for each rival who can at best draw level.
 */
const tieLines = (fights, sprints) => {
  if (!fights.some((f) => f.tie)) return 'Points only: a tie at the top is settled on wins, which this does not work out.'
  const level = fights.flatMap((f) => f.rows.filter((d) => d.level).map((d) => levelLine(f, d, sprints)))
  return ['A tie on points goes to whoever has more wins, then more second places, and so on.', ...level].join(' ')
}

/** The sentence for one title: who can still win it. */
const whoLine = (fight) => {
  const title = fight.kind === 'drivers' ? "the drivers' title" : "the constructors' title"
  const other = fight.kind === 'drivers' ? 'driver' : 'team'
  const many = fight.kind === 'drivers' ? 'drivers' : 'teams'
  const alive = fight.alive
  // One who can reach the leader's total and is out all the same - level at
  // best, and losing the countback (AF-137) - is why the reason changes.
  const tied = fight.rows.some(lostTie)
  if (alive.length === 1) {
    return tied
      ? `Only ${alive[0].entity} can still win ${title}: no other ${other} can now beat the leader's total, or match it and win the countback.`
      : `Only ${alive[0].entity} can still win ${title}: no other ${other} can now reach the leader's total.`
  }
  if (alive.length <= TITLE_LIST_LIMIT) return `Who can still win ${title}: ${listed(alive.map((d) => d.entity))}.`
  if (tied) return `${number(alive.length)} of the ${number(fight.scored)} ${many} who have scored can still win ${title}.`
  // The drivers' wording is the one VD-90 printed; a team's says which title.
  const of = fight.kind === 'drivers' ? '' : ` in ${title}`
  if (alive.length === fight.scored) return `Every ${other} who has scored can still reach the leader's total${of}.`
  return `${number(alive.length)} of the ${number(fight.scored)} ${many} who have scored can still reach the leader's total${of}.`
}

/** How many names a sentence lists, and the reach chart draws, before the count is the answer instead. */
export const TITLE_LIST_LIMIT = 10

/**
 * Who can still win the title, as one answer every page that prints it reads
 * (PD-28, AF-132): the season's lede and the reach chart under its tiles, the
 * next-race panel on the home page, the upcoming race's page, and a
 * contender's driver and team pages. The most-asked question of every
 * September, and one the site can answer from what it already holds: the
 * standings as they stand, the rounds still on the calendar, and the points a
 * round is worth under the season's own scoring rule.
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
 *   - fewer than two classified on both tables.
 *
 * The constructors' title is answered on the same test, against a one-two in
 * every round left (mostPerRound), and only where the season had a
 * constructors' championship (from 1958) under which every car scored for its
 * team (from 1979): `year` says which, and without it the constructors' title
 * is not answered. Either title can be null while the other is answered.
 *
 * Where more than ten are still in - the opening weeks of a season, when
 * nobody is out - the count is the answer and the list of names is not, and
 * where nobody at all is out it says that rather than counting to itself.
 *
 * A tie at the top is settled on the countback (AF-137), where the season's
 * own rule is held (`tie_breaks`, through REMAINING's `countback`) and
 * `places` - PLACES' rows - can count it: a rival who can at best draw level
 * is out where the tie would go against them, and its last sentence says who
 * the tie would favour, and on what. Where the rule is not held its last
 * sentence is the one VD-90 printed, that a tie is not worked out, and one
 * who can only equal is counted in; so is one whose tie cannot be counted.
 * The round it was counted after and the date the database was built are
 * printed with it, because the answer changes with the harvest and not with
 * the code (SD-14).
 *
 * It comes in two parts (VD-90): `who`, the answer, which a season being run
 * prints in its lede (seasonLede below), and `basis`, what it was worked out
 * from and what it does not claim, which follows directly under the tiles.
 * The whole of it, ninety words, was too long to be a lede: on 2026 it ran to
 * ten lines, and the web font arriving after the page put an eleventh on and
 * moved everything beneath it. `drivers` and `constructors` are the two
 * fights themselves, for the reach chart and a contender's line.
 *
 * `settled` names a title already on the record, which is not fought here:
 * once there is a champion, a sentence working out who could have won is
 * noise at best and a contradiction at worst. seasonAnswer() below passes it.
 */
export function titleAnswer({ drivers, constructors, remaining, afterRound, built, year, places, settled = {} }) {
  if (!remaining || !remaining.races) return null
  // Anything but the one spelling - a rule, or a blank - declines, so a
  // reworded row fails closed rather than into a wrong elimination.
  if (remaining.dropped_scores !== EVERY_RESULT_COUNTS) return null
  if (missing(afterRound) || afterRound !== remaining.run) return null

  // A sprint still to run with no sprint system on record is priced at
  // nothing by REMAINING's `available`: the drivers' title declines it, as
  // the constructors' does, rather than count it as worth no points.
  const unpriced = remaining.sprints > 0 && missing(remaining.sprint_scale)
  const forDrivers = settled.drivers
    ? null
    : standingFight('drivers', drivers, unpriced ? null : remaining.available, (d) => d.driver_id, tieBreak('drivers', remaining, places))
  const teams = !settled.constructors && Number.isInteger(year) && year >= CONSTRUCTORS_FROM && year >= EVERY_CAR_COUNTS_FROM
  const forTeams = teams
    ? standingFight('constructors', constructors, teamAvailable(remaining), (d) => d.constructor_id, tieBreak('constructors', remaining, places))
    : null
  if (!forDrivers && !forTeams) return null

  const left = [plural(remaining.races, 'round'), remaining.sprints ? plural(remaining.sprints, 'sprint') : null]
    .filter(Boolean)
    .join(' and ')
  const who = [forDrivers, forTeams].filter(Boolean).map(whoLine).join(' ')
  const still =
    forDrivers && forTeams
      ? `${left} still to run, so ${points(forDrivers.available)} points are still available to a driver and ${points(forTeams.available)} to a team, a one-two in every round, and anyone further behind their leader than that cannot reach them.`
      : forDrivers
        ? `${left} still to run, so ${points(forDrivers.available)} points are still available, and a driver further behind the leader than that cannot reach them.`
        : `${left} still to run, so ${points(forTeams.available)} points are still available to a team, a one-two in every round, and a team further behind the leader than that cannot reach them.`
  const basis = [
    still,
    afterRound ? `Counted after round ${number(afterRound)}${built ? `, from the database built ${built}` : ''}.` : null,
    tieLines([forDrivers, forTeams].filter(Boolean), remaining.sprints),
  ]
    .filter(Boolean)
    .join(' ')
  return { who, basis, drivers: forDrivers, constructors: forTeams, afterRound, year }
}

/**
 * The titles on the record with rounds still to run (LV-15), each `{ id, line }`
 * with the sentence the pages print, or null where neither is. `season` is a
 * row carrying the two champions' ids and names, as SEASON and FIGHT_SEASON
 * both do; `rounds` is the calendar, whose rows name each race.
 *
 * The champion comes from the record and the round from the arithmetic:
 * clinchRound() names it, and where that declines the sentence stops at the
 * title rather than guess at when it fell. Once the season is over a page
 * says who won, so this says nothing.
 */
export function crownedTitles({ season, year, remaining, standings, rounds, afterRound }) {
  if (!remaining?.races) return null
  const counted = remaining.dropped_scores === EVERY_RESULT_COUNTS
  const title = { most: mostPerRound(remaining), rounds, standings, afterRound }
  const crowned = (kind, id, name, honour) => {
    if (missing(id)) return null
    const round = counted && !missing(afterRound) ? clinchRound(title, kind, id) : null
    const race = (rounds ?? []).find((r) => r.round === round)?.name_used
    const at = race ? `, clinched at the ${race} (round ${number(round)})` : ''
    return { id, round: race ? round : null, line: `${name} is the ${year} ${honour}${at}.` }
  }
  const drivers = crowned('drivers', season?.drivers_champion, season?.champion, 'World Champion')
  const constructors = crowned(
    'constructors',
    season?.constructors_champion,
    season?.constructors_champion_name,
    "Constructors' Champion",
  )
  return drivers || constructors ? { drivers, constructors } : null
}

/**
 * What a season being run says about its titles, for both renderers: any
 * title on the record first, then titleAnswer() for whichever is still
 * fought. The one exit from the arithmetic that must not take the champion
 * with it is titleAnswer()'s null - standings behind the calendar, say, or
 * no title left to fight - so that case keeps the sentence and has no basis.
 */
export function seasonAnswer({ season, rounds, standings, ...args }) {
  const { remaining, afterRound, year } = args
  const crowned = crownedTitles({ season, year, remaining, standings, rounds, afterRound })
  const answer = titleAnswer({ ...args, settled: { drivers: crowned?.drivers, constructors: crowned?.constructors } })
  // The finishes at the next round that would settle the drivers' title
  // (AF-138), for the season page and the upcoming race's.
  const clinch = clinchStrips(answer, remaining, rounds)
  if (!crowned) return answer && { ...answer, clinch }
  const said = [crowned.drivers?.line, crowned.constructors?.line, answer?.who].filter(Boolean).join(' ')
  return { basis: null, drivers: null, constructors: null, afterRound, year, ...answer, who: said, crowned, clinch }
}

/**
 * The calendar's rounds, for the round a contender went out at (AF-132):
 * outSince() prices what was left after each one from them, and for the
 * race a title was clinched at (LV-15), which crownedTitles() names.
 */
export const TITLE_ROUNDS = `
  SELECT round, name_used, sprint, status FROM races WHERE year = ?1 ORDER BY round
`

/** The season's own row, as much of it as the title fight reads. */
const FIGHT_SEASON = `
  SELECT s.year, s.drivers_champion, d.full_name AS champion,
         s.constructors_champion, c.name AS constructors_champion_name
    FROM seasons s
    LEFT JOIN drivers d      ON d.id = s.drivers_champion
    LEFT JOIN constructors c ON c.id = s.constructors_champion
   WHERE s.year = ${CURRENT_SEASON_SQL}
`

const current = (sql) => sql.replaceAll('?1', CURRENT_SEASON_SQL)

/**
 * The registry entries behind the title fight of the season being run
 * (AF-132), for the citation of a page that prints it and is not that
 * season's: the points system's, the calendar's, and the standings' - both
 * tables as FINAL reads them, by SEASON_SOURCES' rule, and the running rows
 * STANDINGS chooses. A page adds them with mergeSources() only where it
 * prints the answer, and the countback's, TIE_SOURCES, only where that
 * answer counted a tie back (fightCitation).
 */
const FIGHT_SOURCES = `
  SELECT s.id, s.priority, s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id IN (
           SELECT source_id FROM table_provenance WHERE tbl = 'points_systems'
     UNION SELECT source_id FROM races WHERE year = ?1
     UNION SELECT t.source_id FROM standings t
            WHERE t.year = ?1
              AND (t.basis = 'final'
                   OR NOT EXISTS (SELECT 1 FROM standings f
                                   WHERE f.year = t.year AND f.table_type = t.table_type
                                     AND f.basis = 'final'))
     UNION SELECT t.source_id FROM standings t
            WHERE t.year = ?1 AND t.basis = 'running'
              AND t.source = (SELECT source FROM standings
                               WHERE year = ?1 AND basis = 'running'
                               GROUP BY source
                               ORDER BY COUNT(DISTINCT after_round) DESC, MAX(after_round) DESC, source
                               LIMIT 1))
   ORDER BY s.priority, s.id
`

/**
 * The registry entry the season's own row cites, which is the statement that
 * a title was decided where one was with rounds to run (LV-15): only a page
 * printing that sentence adds it, through fightCitation().
 */
const CROWNED_SOURCES = `
  SELECT s.id, s.priority, s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id = (SELECT source_id FROM seasons WHERE year = ?1)
`

/**
 * The queries the title fight of the season being run is answered from, on
 * a page that is not that season's (AF-132): the home page, the upcoming
 * race and a contender's pages. The season's own page reads the same tables
 * by its year. Each is keyed for useQueries, and scripts/prerender.js runs
 * the same SQL once for every page it writes.
 */
export const FIGHT_QUERIES = {
  fightSeason: [FIGHT_SEASON],
  fightFinal: [current(FINAL)],
  fightStandings: [current(STANDINGS)],
  fightRemaining: [current(REMAINING)],
  fightRounds: [current(TITLE_ROUNDS)],
  fightPlaces: [current(PLACES)],
  fightSources: [current(FIGHT_SOURCES)],
  fightTieSources: [current(TIE_SOURCES)],
  crownedSources: [current(CROWNED_SOURCES)],
}

/**
 * The registry entries behind what a page prints from currentTitle(): the
 * fight's, the countback's only where countedTie() says the line or answer
 * counted a tie back (AF-137), and the season row's only where the crowned
 * sentence is printed.
 * `kind` and `id` ask that of one contender's page; without them it is asked
 * of the whole answer, which the upcoming race prints. `get(key)` as there.
 */
export function fightCitation(get, title, kind, id) {
  const crowned = kind ? title?.crowned?.[kind]?.id === id : Boolean(title?.crowned)
  const fight = countedTie(title, kind) ? mergeSources(get('fightSources'), get('fightTieSources')) : get('fightSources')
  return crowned ? mergeSources(fight, get('crownedSources')) : fight
}

/**
 * The answer for the season being run, from FIGHT_QUERIES' rows, by the
 * season page's own rule: seasonAnswer(), with two drivers on the table. Null
 * once the season is over. `get(key)` returns a query's rows.
 *
 * The running table and the calendar ride along for outSince().
 */
export function currentTitle(get, built) {
  const season = get('fightSeason')[0]
  if (!season) return null
  const final = get('fightFinal')
  const drivers = final.filter((r) => r.table_type === 'drivers')
  if (drivers.length < 2) return null
  const standings = get('fightStandings')
  const remaining = get('fightRemaining')[0] ?? null
  const rounds = get('fightRounds')
  const answer = seasonAnswer({
    season,
    rounds,
    standings,
    drivers,
    constructors: final.filter((r) => r.table_type === 'constructors'),
    remaining,
    afterRound: latestRound(standings),
    built,
    year: season.year,
    places: get('fightPlaces'),
  })
  if (!answer) return null
  return { ...answer, standings, rounds, most: mostPerRound(remaining), next: nextRoundOf(rounds) }
}

const nextRoundOf = (rounds) => rounds.find((r) => r.status !== 'completed')?.round ?? null

/**
 * What outSince() and clinchRound() both read, or null where the scoring
 * cannot price it: `left(n)`, the most one contender could still win after
 * round n, and `tables`, each round's totals by contender id - NaN for one
 * the sources give two totals for.
 */
function runningTables(title, kind) {
  const most = title?.most?.[kind]
  if (!most || most.race === null) return null
  const rounds = title.rounds ?? []
  if (rounds.some((r) => r.sprint) && most.sprint === null) return null
  const left = (n) => rounds.filter((r) => r.round > n).reduce((sum, r) => sum + most.race + (r.sprint ? most.sprint : 0), 0)
  const idOf = kind === 'drivers' ? (r) => r.driver_id : (r) => r.constructor_id
  const tables = new Map()
  for (const r of title.standings ?? []) {
    if (r.table_type !== kind || missing(r.points) || missing(r.position) || missing(idOf(r))) continue
    if (!tables.has(r.after_round)) tables.set(r.after_round, new Map())
    const table = tables.get(r.after_round)
    const held = table.get(idOf(r))
    table.set(idOf(r), held !== undefined && held !== r.points ? NaN : r.points)
  }
  return { left, tables }
}

/**
 * The round after which a contender could no longer reach the leader, where
 * the running table establishes it (AF-132), or null.
 *
 * What was still to be won after round n is every round of the calendar
 * after it, each at the most mostPerRound() gives, and its sprint where it
 * had one. Out after round n is behind the table's leader then by more than
 * that. Established means the table after every round from that one to the
 * last is held and says out, and the one before it is held and says in -
 * or is the start of the season, before which nobody is out. A gap in the
 * tables, a contender twice in one with two totals, or a table that has them
 * in where the answer has them out, declines.
 */
export function outSince(title, kind, id) {
  const running = runningTables(title, kind)
  if (!running || missing(id)) return null
  const { left, tables } = running
  // true out, false in, null where the table cannot say.
  const out = (n) => {
    const table = tables.get(n)
    if (!table || !table.has(id)) return null
    const totals = [...table.values()]
    if (totals.some(Number.isNaN)) return null
    return Math.max(...totals) - table.get(id) > left(n)
  }
  let since = null
  for (let n = title.afterRound; n >= 1; n -= 1) {
    const now = out(n)
    if (now === null) return null
    if (!now) return since
    since = n
  }
  return since
}

/**
 * The round a recorded champion became one (LV-15), or null: the first round
 * after which nobody could reach or equal them, and every table from there
 * to the last held and saying so. The test is outSince()'s, turned round: no
 * rival within what was left.
 *
 * It is strict, as verify.py's arithmetic is. A round after which a rival
 * could at best have drawn level may have settled it on the countback, which
 * this does not work out (AF-176), so it declines rather than name the next
 * round; so does a gap in the tables or a contender twice in one.
 */
export function clinchRound(title, kind, id) {
  const running = runningTables(title, kind)
  if (!running || missing(id)) return null
  const { left, tables } = running
  // What the champion had in hand after round n, or null where the table
  // cannot say. Above nought is out of reach; nought is level at best.
  const inHand = (n) => {
    const table = tables.get(n)
    if (!table || !table.has(id) || table.size < 2 || [...table.values()].some(Number.isNaN)) return null
    const rest = [...table].filter(([who]) => who !== id).map(([, total]) => total)
    return table.get(id) - Math.max(...rest) - left(n)
  }
  let since = null
  for (let n = title.afterRound; n >= 1; n -= 1) {
    const clear = inHand(n)
    if (clear === null || clear === 0) return null
    if (clear < 0) return since
    since = n
  }
  return since
}

/**
 * The one line a driver's or team's page prints about the title (AF-132),
 * from currentTitle()'s answer: the sentence itself on the page of a
 * champion crowned with rounds to run (LV-15), and otherwise where they stand
 * in the fight - null where that answer is null, where this title is not
 * answered, or where the id is not on its table once.
 *
 *     Still in the title fight: 102 behind with 150 left.
 *     Leads the title fight by 133 with 125 left.
 *     Level on points at the top of the title fight with 125 left.
 *     The only one left in the title fight: 133 clear with 125 left.
 *     Out of the title fight since round 15.
 *     Out of the title fight: can at best draw level, and would lose the countback.
 *
 * "Since round N" only where outSince() establishes N; otherwise only that
 * they are out.
 */
export function fightLine(title, kind, id) {
  const crowned = title?.crowned?.[kind]
  if (crowned && crowned.id === id) return crowned.line
  const fight = title?.[kind]
  if (!fight || missing(id)) return null
  const mine = fight.rows.filter((d) => d.id === id)
  if (mine.length !== 1) return null
  const [me] = mine
  const left = points(fight.available)
  if (lostTie(me)) return 'Out of the title fight: can at best draw level, and would lose the countback.'
  if (!me.alive) {
    const since = outSince(title, kind, id)
    return since === null ? 'Out of the title fight.' : `Out of the title fight since round ${number(since)}.`
  }
  const others = fight.rows.filter((d) => d !== me)
  if (me.behind > 0) return `Still in the title fight: ${points(me.behind)} behind with ${left} left.`
  if (others.some((d) => d.behind === 0)) return `Level on points at the top of the title fight with ${left} left.`
  const margin = me.points - others[0].points
  if (fight.alive.length === 1) return `The only one left in the title fight: ${points(margin)} clear with ${left} left.`
  return `Leads the title fight by ${points(margin)} with ${left} left.`
}

/**
 * The answer under the home page's next race (AF-132): only where that race
 * is in the season the answer is about, so a winter's next race, in the
 * season after, is not given this one's title fight.
 */
export const fightAhead = (title, race) => (title && race && race.year === title.year ? title.who : null)

/** The upcoming race's section (AF-132): what its title fight stands at, until its results land. */
export const STAKE_HEADING = "What's at stake"

/**
 * Whether a race's page is the upcoming race's: the first round of the
 * season being run with no result on the calendar, while there is an answer
 * to print.
 */
export const isUpcoming = (title, race) =>
  Boolean(title && race && race.year === title.year && race.round === title.next && race.status !== 'completed')

/* ------------------------------------------------------------ reach chart */

/** The reach chart's section and its two figures (AF-132). */
export const REACH_HEADING = 'Who can still win'
export const reachTitle = (kind) => (kind === 'drivers' ? "The drivers' title" : "The constructors' title")

/**
 * The reach chart's note, at most 50 words (VD-80): what the two parts of a
 * bar are and what the line is, which is what stops a misreading. `tied` is
 * a bar drawn that meets the line and is out on the countback (AF-137),
 * which the note says only where the list is not cut: the two together run
 * past 50 words, and the basis under the tiles names that rival either way.
 */
export const reachNote = (kind, cut, tied = false) =>
  `Each solid bar is the points scored so far, and the outlined part the most still to be won: ${
    kind === 'drivers' ? 'a win' : 'a one-two'
  } in every round left. The line is the leader's total; ${
    tied && !cut ? 'a bar short of it is out, as is one that meets it and loses the countback' : 'a bar that stops short of it is out'
  }.${cut ? ` The ${TITLE_LIST_LIMIT} highest of those still in are drawn.` : ''}`

export const reachColumns = (kind) => [
  { key: 'entity', rowHeader: true, label: kind === 'drivers' ? 'Driver' : 'Constructor' },
  { key: 'points', label: 'Points', align: 'num', text: points },
  { key: 'behind', label: 'Gap', align: 'num', text: (value) => (missing(value) || value === 0 ? EMPTY : points(value)) },
  { key: 'reach', label: 'Most possible', align: 'num', text: points },
  { key: 'alive', label: 'Title fight', text: (value) => (value ? 'in' : 'out') },
]

/**
 * The reach chart (AF-132), worked out once for both renderers: each
 * contender's points as a solid bar, an outlined extension to the most they
 * could still reach, and a line at the leader's total. It draws those still
 * in - the first TITLE_LIST_LIMIT of them, where more are - and the highest
 * placed of those already out, so the line has a bar that stops short of it.
 *
 * `colourOf(row)` is the contender's colour or null; the chart wears colours
 * only where every bar has one, as the title race does. Null where the fight
 * is.
 */
export function reachFigure(fight, year, colourOf = () => null) {
  if (!fight) return null
  const still = fight.alive.slice(0, TITLE_LIST_LIMIT)
  const justOut = fight.rows.find((d) => !d.alive)
  const drawn = justOut ? [...still, justOut] : still
  const cut = fight.alive.length > TITLE_LIST_LIMIT
  const coloured = drawn.map((d) => colourOf(d))
  const inColour = coloured.every(Boolean)
  return {
    kind: fight.kind,
    title: reachTitle(fight.kind),
    note: reachNote(fight.kind, cut, drawn.some(lostTie)),
    lead: fight.lead,
    data: drawn.map((d, i) => ({
      key: String(d.id ?? d.entity),
      label: d.entity,
      points: d.points,
      reach: d.reach,
      alive: d.alive,
      colour: inColour ? coloured[i] : null,
    })),
    rows: drawn.map((d) => ({ entity: d.entity, id: d.id, points: d.points, behind: d.behind, reach: d.reach, alive: d.alive })),
    columns: reachColumns(fight.kind),
    label: `${reachTitle(fight.kind)} in ${year}: points so far and the most each contender can still reach, against the leader's ${points(fight.lead)}`,
  }
}

/**
 * The colour a contender's bar wears (AF-132), as the title race takes it: a
 * driver in the team they last raced for that season (`teams` is
 * teamsByDriver()'s map), a team in its own, each by colourForEntry()'s
 * rules for the year.
 */
const contenderColour = (kind, teams, year) => (d) => {
  if (kind === 'constructors') {
    return colourForEntry({ constructorId: d.row.constructor_id, country: d.row.constructor_country, year, team: d.entity })
  }
  const last = (teams?.get(d.id) ?? [])[0]
  return last ? colourForEntry({ constructorId: last.constructor_id, country: last.country, year, team: last.constructor }) : null
}

/** Both titles' reach charts, drivers' first, for whichever titleAnswer() answered. */
export const reachFigures = (answer, year, teams) =>
  answer
    ? [answer.drivers, answer.constructors]
        .filter(Boolean)
        .map((fight) => reachFigure(fight, year, contenderColour(fight.kind, teams, year)))
    : []

/* ----------------------------------------------------------- clinch strip */

/** What a cell of the clinch strip says (AF-138): the title settled, level on points, going on, or the leader's own place. */
export const CLINCH_CHAMPION = 'champion'
export const CLINCH_LEVEL = 'level'
export const CLINCH_ON = 'on'
export const CLINCH_TAKEN = 'taken'

/** A points scale's places, best first, or null where the JSON does not hold numbers. */
const scalePlaces = (scale) => {
  try {
    const places = JSON.parse(scale)
    return Array.isArray(places) && places.length >= 2 && places.every(Number.isFinite) ? places : null
  } catch {
    return null
  }
}

/**
 * The countback for a rival who, after the next round, can at best draw
 * level with the leader (AF-138): tieBreak()'s count, with the next round's
 * two places added - `rivalPlace` and `leaderPlace`, each counted only where
 * it scores - and every round after it won by the rival, which is the one
 * way to draw level. settle()'s answer, from the rival's side: null
 * where the places cannot be counted, or are level on every place that
 * scores.
 */
function nextCountback(tie, rival, leader, rivalPlace, leaderPlace, racesAfter) {
  if (!tie?.counts) return null
  const at = (id, place) => tie.counts.get(id)?.get(place) ?? 0
  for (let place = 1; place <= tie.depth; place += 1) {
    const ours = at(rival.id, place) + (place === rivalPlace ? 1 : 0) + (place === 1 ? racesAfter : 0)
    const its = at(leader.id, place) + (place === leaderPlace ? 1 : 0)
    if (ours !== its) return { wins: ours > its, place, mine: ours, theirs: its }
  }
  return null
}

/** Whether a cell settles the title: outright, or level and the countback going to the leader. */
const settles = (cell) => cell.mark === CLINCH_CHAMPION || (cell.mark === CLINCH_LEVEL && Boolean(cell.countback) && !cell.countback.wins)

/** "wins the United States Grand Prix", "finishes second in the ...", "scores no points in the ...": the leader's finish in a strip's title. */
const finishWords = (place, depth, race) => {
  if (place === 1) return `wins the ${race}`
  if (place > depth) return `scores no points in the ${race}`
  return `finishes ${PLACE_WORDS[place - 1] ?? ordinal(place)} in the ${race}`
}

/** One cell's words in the strip's table, which are the numbers behind the figure. */
const cellText = (cell, leader, rival) => {
  if (cell.mark === CLINCH_TAKEN) return `${leader}'s place`
  if (cell.mark === CLINCH_CHAMPION) return `${leader} champion`
  if (cell.mark === CLINCH_ON) return 'Title goes on'
  if (!cell.countback) return 'Level: the countback is not worked out'
  return cell.countback.wins ? `Level: ${rival} takes the countback` : `Level: ${leader} champion on the countback`
}

/**
 * The clinch strip's table columns (AF-138): the rival, then one column a
 * place that scores and one for none. `depth` is how far down the scale pays.
 */
export const clinchColumns = (depth) => [
  { key: 'entity', rowHeader: true, label: 'Rival' },
  ...Array.from({ length: depth }, (_, i) => ({ key: `p${i + 1}`, label: ordinal(i + 1) })),
  { key: 'none', label: 'No points' },
]

/**
 * The strip's note, at most 50 words (VD-80): what each mark is, which is
 * what stops a misreading. `leader` is the name the strip's rows use.
 */
export const clinchNote = (leader) =>
  `Each row is a rival still in, each column where they finish. A tick is ${leader} champion; an equals sign, level on points, the countback deciding as the table says; an arrow, the title going on; a dash, ${leader}'s own place.`

/**
 * Which finishes at the next round would settle the drivers' title (AF-138),
 * worked out once for both renderers: one strip for each place the leader
 * could take that can settle it, best first, each with a row for every rival
 * still in and a cell for each place that rival could take - every place the
 * scale pays, then none. A cell is the title settled there as far as that
 * rival goes (`champion`), the rival level on points and the countback
 * deciding (`level`, with nextCountback()'s answer), the title going on, or
 * the leader's own place, which the rival cannot take.
 *
 * The test is titleAnswer()'s, a round on: after the next round the rival
 * is out behind by more than is left to win, and level behind by exactly
 * that. What is left is what titleAnswer() measured, less the most one round
 * pays. A strip is drawn only where every row can land on the title settled -
 * a cell that is champion, or level with the countback the leader's - and a
 * rival who scores nothing is the leader's best case, so that cell is the
 * one asked. Each rival is measured alone, because whether they are out
 * turns on their own finish and the leader's and nobody else's: the title
 * is settled where every row is. Two rivals cannot take one place, which a
 * row each leaves to the reader.
 *
 * `answer` is titleAnswer()'s, `remaining` REMAINING's row, `rounds` the
 * calendar. Only the drivers' title, where a rival's finish is one place:
 * a team's is two cars'. Null - nothing drawn and nothing said - where the
 * title cannot be settled at the next round: no drivers' fight, no rival
 * still in, two or more level at the top, a next round that is not the one
 * after the round counted, a scale that does not say what each place pays,
 * or no finish of the leader's that settles it. A round the arithmetic here
 * cannot draw and that could settle it - a sprint weekend, two results, or
 * a season paying the fastest lap a point, which turns on more than a place
 * - comes back as `{ race, round, declined }`, the sentence saying so.
 */
export function clinchStrips(answer, remaining, rounds) {
  const fight = answer?.drivers
  if (!fight || !remaining || fight.leaders.length !== 1) return null
  const [leader] = fight.leaders
  const rivals = fight.alive.filter((d) => d !== leader)
  if (!rivals.length || missing(leader.id) || rivals.some((d) => missing(d.id))) return null
  const next = (rounds ?? []).find((r) => r.status !== 'completed')
  if (!next || missing(answer.afterRound) || next.round !== answer.afterRound + 1) return null
  const scale = scalePlaces(remaining.scale)
  const most = mostPerRound(remaining)?.drivers
  if (!scale || !most || most.race === null || (next.sprint && most.sprint === null)) return null
  const round = most.race + (next.sprint ? most.sprint : 0)
  const left = fight.available - round
  const race = text(next.name_used)

  const depth = scale.length
  const racesAfter = remaining.races - 1
  // The leader's best case: the most the round pays, and every rival nothing.
  // A rival who can then at best draw level leaves it settled only where the
  // countback is the leader's - the leader winning, the rival scoring
  // nothing - so a round whose countback is the rival's, or cannot be
  // counted, could not settle it, and nothing is drawn or said.
  const outAtBest = (d) => {
    const gap = leader.points + round - d.points
    if (gap !== left) return gap > left
    const countback = nextCountback(fight.tie, d, leader, depth + 1, 1, racesAfter)
    return Boolean(countback) && !countback.wins
  }
  if (!rivals.every(outAtBest)) return null
  const declined = (why) => ({ race, round: next.round, declined: `The ${race} could settle the drivers' title, but ${why}.` })
  if (next.sprint) return declined('it has a sprint as well, and which finishes in the two would settle it is not drawn here')
  if (!missing(remaining.fastest_lap_points) && remaining.fastest_lap_points > 0) {
    return declined("the fastest lap pays a point, and which finishes would settle it then turns on more than a place, so it is not drawn here")
  }

  const names = shortNames([leader, ...rivals].map((d) => d.entity))
  const short = new Map([leader, ...rivals].map((d, i) => [d, names[i]]))
  // What a place pays: the scale's figure, and nothing below the places it pays.
  const pays = (place) => (place <= depth ? scale[place - 1] : 0)
  const strips = []
  for (let place = 1; place <= depth + 1; place += 1) {
    const total = leader.points + pays(place)
    const rows = rivals.map((rival) => {
      const cells = Array.from({ length: depth + 1 }, (_, i) => {
        const at = i + 1
        if (at === place && place <= depth) return { place: at, mark: CLINCH_TAKEN, countback: null }
        const gap = total - (rival.points + pays(at))
        if (gap > left) return { place: at, mark: CLINCH_CHAMPION, countback: null }
        if (gap < left) return { place: at, mark: CLINCH_ON, countback: null }
        return { place: at, mark: CLINCH_LEVEL, countback: nextCountback(fight.tie, rival, leader, at, place, racesAfter) }
      })
      return { rival, cells }
    })
    if (!rows.every((r) => settles(r.cells[depth]))) continue
    const title = `If ${leader.entity} ${finishWords(place, depth, race)}`
    strips.push({
      key: `p${place}`,
      place: place <= depth ? place : null,
      title,
      note: clinchNote(short.get(leader)),
      columns: clinchColumns(depth),
      data: rows.map(({ rival, cells }) => ({ key: String(rival.id), label: short.get(rival), cells })),
      rows: rows.map(({ rival, cells }) =>
        Object.fromEntries([
          ['entity', rival.entity],
          ['id', rival.id],
          ...cells.map((cell) => [cell.place > depth ? 'none' : `p${cell.place}`, cellText(cell, short.get(leader), short.get(rival))]),
        ]),
      ),
      label: `${title}: for each rival still in and each place they could finish, whether ${leader.entity} is champion, level on points or not yet champion`,
    })
  }
  return strips.length ? { race, round: next.round, strips } : null
}

/**
 * A season's lede: who can still win, then the season's own note (VD-90).
 *
 * Design system section 4 puts *Who can still win* in the lede position on a
 * season being run, so that the page reads h1, the September question's
 * answer, then the tiles - where it used to be the first sentence of an
 * unheaded note between the tiles and the title chart. `who` is titleAnswer()'s
 * answer; its basis stays under the tiles. The note follows rather than being
 * replaced, as a race's follows who won (SD-39): it is the season written by
 * hand, and the arithmetic says nothing of new regulations or new entries. A
 * season with no answer to give - concluded, not yet run, or one the
 * arithmetic declines - keeps its note alone. Both renderers print this
 * string.
 */
export const seasonLede = (notes, who) => {
  const written = typeof notes === 'string' && notes.trim() ? notes.trim() : null
  if (!who) return written
  return written ? `${who} ${written}` : who
}

/* ---------------------------------------------------------------- columns */

/** "Chinese Grand Prix sprint": the name, and the sprint mark where the weekend had one. */
export const roundName = (name, row) => (row.sprint ? `${text(name)} ${SPRINT}` : text(name))

/** The winner, or "not yet run" for a calendar entry with no result. */
export const roundWinner = (name, row) => (row.status !== 'completed' ? NOT_YET_RUN : text(name))

/**
 * The winning car, by the rule the race page names it with (queries/race.js
 * carName, AF-64): the constructor where one is resolved, else the entry's
 * own designation. The eleven Indianapolis 500s that counted from 1950 to
 * 1960 have no constructor row, so this column dashed a car the race page one
 * click on names as "Kurtis Kraft-Offenhauser" (AF-68).
 */
export const winningCar = (row) =>
  carName({ constructor_id: row.winning_team_id, constructor: row.winning_team, entrant: row.winning_entrant })

export const CALENDAR_COLUMNS = [
  { key: 'round', label: 'R', align: 'num' },
  { key: 'name_used', rowHeader: true, label: 'Grand Prix', text: roundName },
  { key: 'circuit', label: 'Circuit' },
  { key: 'date_iso', label: 'Dates', date: 'race' },
  { key: 'winner', label: 'Winner', text: roundWinner },
  { key: 'winning_team', label: 'Constructor', text: (_, row) => roundResult(winningCar(row), row) },
  { key: 'pole', label: 'Pole', text: roundResult },
  { key: 'fastest', label: 'Fastest lap', text: roundResult },
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
// The leader is nobody's gap: a 0 here means no one is ahead of you on points,
// which an em dash says and a nought does not. Two drivers tied at the top
// both get it, which is the same statement about each of them.
const behind = (value) => (missing(value) || value === 0 ? EMPTY : points(value))
const won = (value) => (missing(value) ? EMPTY : number(value))

// `has-bar` on Points: the cell carries the figure and the bar beside it, its
// head over the figure rather than right-aligned to the cell's edge (VD-110).
// Below 768 px Wins is the column that goes, as the phone set says, and the
// bar stacks under its figure.
export const DRIVERS_FINAL_COLUMNS = [
  { key: 'position_text', label: 'Pos', align: 'num', text: position, glossary: 'results', phone: true },
  { key: 'entity', rowHeader: true, label: 'Driver' },
  { key: 'wins', label: 'Wins', align: 'num', text: won },
  { key: 'points', label: 'Points', align: 'num', cellClass: 'has-bar', text: points, phone: true },
  { key: 'gap', label: 'Gap', align: 'num', text: behind, phone: true },
]

// The bar beside each total (VD-110), said once and printed under both
// standings tables, by both renderers.
export const BAR_FOOTER =
  "Each bar is a total against the leader's, in the colour of the mark beside the name, or in ink where there is none."

export const DRIVERS_FINAL_FOOTER =
  'A driver with points and no position was excluded from the classification: the points stand, the position does not. ' +
  'Wins are counted from the race records, and a shared drive is a win for both of its drivers. ' +
  `${GAP_FOOTER} ${BAR_FOOTER}`

/*
 * THE LEADER IN THE ROW, AND A BAR IN THE POINTS (VD-105, VD-110).
 *
 * A standings table's leader is marked in its own row rather than read from
 * the tiles above it: DataTable's `leader` and prerender's option of the same
 * name take this predicate, and both write lib/table.js's LEADER class on the
 * row. The table ranks by position, so the leader is every row at P1: a
 * place two rows share at the top marks both, never the first one sorted,
 * and a level total split by countback marks the one the source placed
 * first, which is what the position says. A row nobody placed is no leader.
 */
export const standingsLeader = (row) => row.position === 1

/**
 * The pill on the champion's row (VD-110), or null: the leader whose id is
 * the season's recorded champion, and, where crownedTitles() names the round
 * the title was clinched at, that round - "champion · settled R19". A
 * leader who is not yet champion has the row's mark and no pill, since
 * "leads" says nothing position 1 does not. A constructor's two engines are
 * two rows, and only the one at P1 is the champion's.
 */
export function championPill(kind, row, season, crowned) {
  if (!standingsLeader(row)) return null
  const id = kind === 'drivers' ? row.driver_id : row.constructor_id
  const champion = kind === 'drivers' ? season?.drivers_champion : season?.constructors_champion
  if (missing(id) || id !== champion) return null
  const held = crowned?.[kind]
  return held?.id === id && Number.isInteger(held.round) ? `champion · settled R${held.round}` : 'champion'
}

/**
 * Each total as a share of the leader's, for the bar beside it (VD-110):
 * a function of a row's points, null where the points are not held or no
 * leader has a total above nought to measure against. The leader's total is
 * the one the Gap column measures from, the highest a classified row holds;
 * a share is held to 0 to 1, so an excluded row can never draw past the
 * leader's bar, and rounded so the two renderers write one value.
 */
export function pointsShare(rows) {
  const held = rows.filter((r) => !missing(r.position) && typeof r.points === 'number').map((r) => r.points)
  const top = held.length ? Math.max(...held) : null
  return (value) =>
    typeof value !== 'number' || !(top > 0) ? null : Number(Math.min(1, Math.max(0, value / top)).toFixed(4))
}

/**
 * The colour beside a standings row and in its bar, and the mark's tooltip:
 * a driver's last team of the season (DRIVER_TEAMS through lastTeamColour(),
 * which names every team where there was more than one), a constructor's own
 * (colourForEntry()). Both renderers read it.
 */
export function standingsColour(kind, row, year, teams) {
  if (kind === 'drivers') return lastTeamColour(teams.get(row.driver_id), year)
  const colour = colourForEntry({ constructorId: row.constructor_id, country: row.constructor_country, year, team: row.entity })
  return { colour, title: colour?.title }
}

/** "McLaren mercedes" where the championship is contested by a chassis–engine pair. */
export const constructorEntity = (name, row) => (row.engine_id ? `${text(name)} ${row.engine_id}` : text(name))

export const CONSTRUCTORS_FINAL_COLUMNS = [
  { key: 'position_text', label: 'Pos', align: 'num', text: position, glossary: 'results' },
  { key: 'entity', rowHeader: true, label: 'Constructor', text: constructorEntity },
  { key: 'points', label: 'Points', align: 'num', cellClass: 'has-bar', text: points },
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
  ambiguous
    ? `${CONSTRUCTORS_GAP_FOOTER} ${CONSTRUCTORS_PAIR_FOOTER} ${BAR_FOOTER}`
    : `${CONSTRUCTORS_GAP_FOOTER} ${BAR_FOOTER}`

/**
 * What stands where a constructors' table would, and why it is empty (CD-32).
 *
 * Nine seasons hold no constructors' standings and they are not empty for the
 * same reason. Eight are 1950-1957, before the championship existed; the
 * ninth is a calendar that has been announced and not yet raced, and it was
 * being told the championship "was not contested until 1958" - a sentence
 * about a season seventy years earlier, on the page of one that has not
 * started. The strip at the top of that page already reads "not yet run" for
 * both champions, which is IA-17's rule that an unrun season and an unknown
 * one must not read the same; this block is where that rule had not reached.
 *
 * `notRun` is the season with no round completed, as both renderers compute
 * it. The third case holds for no season today and is what the two facts
 * actually leave: a season that has run and whose constructors' table this
 * database does not hold.
 */
export const noConstructorsNote = (year, notRun) => {
  if (notRun) {
    return {
      head: 'Not yet run.',
      body: `No round of the ${year} calendar has been raced, so the constructors' championship has nothing to show yet.`,
    }
  }
  if (year < 1958) {
    return { head: "No constructors' championship.", body: 'It was not contested until 1958.' }
  }
  return {
    head: "No constructors' standings.",
    body: "This database holds no constructors' table for this season.",
  }
}

/** What an empty standings table says on a season nobody has raced yet. */
export const NOT_RUN_STANDINGS = 'Not yet run: no round of this calendar has been raced.'

export const ENTRANT_COLUMNS = [
  { key: 'constructor', rowHeader: true, label: 'Constructor', text: (name, row) => text(name ?? row.entrant_name) },
  { key: 'entrant_name', rowHeader: true, label: 'Entered as' },
  { key: 'chassis_names', label: 'Chassis', align: 'prose' },
  { key: 'chassis_count', label: 'Designs', align: 'num' },
  { key: 'engine_names', label: 'Engines' },
  { key: 'tyres', label: 'Tyres' },
]

export const ENTRANTS_FOOTER =
  'Where an entrant ran more than one design, no source records which car raced which round — so those race results carry no chassis.'

/**
 * VD-104 (c): the season plate - a concluded season's champion, in the
 * colours of the team they won it with. A 4 px rule in the team's pair, the
 * label with its livery mark, the champion's name in the display face, and
 * the margin at the hero size with the sentence that says what it is. The
 * rule is in ink where no colour is on record - 1968 to 2009, or a team with
 * none sourced - so a colour is never the plate's only cue. Null while the
 * season is running, a title settled with rounds to go included: the strip
 * carries the leader and the gap until the last round, and the plate is the
 * season's end. The margin is the stored one - the champion's points less
 * the runner-up's - and the sentence carries the champion's points, which
 * the strip's champion tile did. With no margin stored the plate prints no
 * figure and no sentence, and titleStrip keeps both tiles: the champion's
 * points, and the Margin to show it is not established.
 */
export const SEASON_PLATE_LABEL = (year) => `${year} World Champion`
export const seasonPlate = ({ season, year, running }) => {
  if (running || !season?.drivers_champion) return null
  const margin = season.margin === null || season.margin === undefined ? null : season.margin
  return {
    label: SEASON_PLATE_LABEL(year),
    team: season.champion_team_name ?? null,
    teamHref: season.champion_team ? `constructors/${season.champion_team}` : null,
    name: season.champion ?? season.drivers_champion,
    href: `drivers/${season.drivers_champion}`,
    margin: margin === null ? null : points(margin),
    sentence:
      margin === null
        ? null
        : `${margin === 1 ? 'point' : 'points'} clear of ${season.runner_up_name ?? 'the runner-up'} in the final table${
            season.champion_points === null || season.champion_points === undefined ? '' : `, with ${points(season.champion_points)} points`
          }.`,
    colour: season.champion_team
      ? colourForEntry({
          constructorId: season.champion_team,
          country: season.champion_team_country,
          year,
          team: season.champion_team_name,
        })
      : null,
  }
}

/**
 * The season's tiles, as both renderers draw them (VD-49).
 *
 * A season still running leads with who leads, by how much, after how many
 * rounds; the champion's slots would be a row of em dashes on the
 * most-searched page of the year. A season nobody has raced carries
 * NOT_YET_RUN in those slots rather than a dash (IA-17), and the
 * constructors' title before 1958 is "not contested", which is a fact, where
 * a dash would be a gap. A concluded season with a champion opens on its
 * plate (seasonPlate, above), which states the champion, their points and
 * the margin, so the strip leaves those two tiles out - only where the plate
 * has a margin to print.
 *
 * `running` and `notRun` are the page's own two questions, passed in rather
 * than asked again here, so the strip cannot answer them differently from
 * the headings below it. The next session's tile is not here: only a
 * browser knows how long until it starts, so Season.jsx adds it to the end
 * of this list and the static page carries no such tile.
 */
export const titleStrip = ({ season, year, running, run, notRun, lead, second, teamLead }) => {
  if (running) {
    return [
      { label: 'Rounds', value: number(season.rounds), note: `${run} run` },
      {
        label: season.drivers_champion ? "Drivers' champion" : 'Leads',
        kind: 'name',
        value: lead.entity,
        href: lead.driver_id ? `drivers/${lead.driver_id}` : null,
        note: `${points(lead.points)} points`,
      },
      {
        label: 'Gap',
        value: points(lead.points - second.points),
        note: `over ${second.entity}`,
      },
      teamLead
        ? {
            label: season.constructors_champion ? "Constructors' champion" : "Constructors' leader",
            kind: 'name',
            value: teamLead.entity,
            href: teamLead.constructor_id ? `constructors/${teamLead.constructor_id}` : null,
            note: `${points(teamLead.points)} points`,
          }
        : null,
    ].filter(Boolean)
  }
  const notYet = { value: NOT_YET_RUN, quiet: true }
  // The season plate (VD-104 (c)) names the champion, their points and the
  // margin above the strip, so the strip does not say them twice.
  const plate = seasonPlate({ season, year, running })
  return [
    {
      label: 'Rounds',
      value: number(season.rounds),
      note: notRun ? NOT_YET_RUN : run === season.rounds ? 'all run' : `${run} run`,
    },
    plate?.margin
      ? null
      : {
      label: "Drivers' champion",
      kind: 'name',
      ...(season.drivers_champion
        ? { value: season.champion, href: `drivers/${season.drivers_champion}` }
        : notRun
          ? notYet
          : { value: null }),
      note: season.champion_points !== null ? `${points(season.champion_points)} points` : undefined,
    },
    {
      label: "Constructors' champion",
      kind: 'name',
      ...(season.constructors_champion
        ? { value: season.constructors_champion_name, href: `constructors/${season.constructors_champion}` }
        : year < 1958
          ? { value: 'not contested', quiet: true }
          : notRun
            ? notYet
            : { value: null }),
      note:
        season.constructors_points !== null && season.constructors_points !== undefined
          ? `${points(season.constructors_points)} points`
          : undefined,
    },
    plate?.margin
      ? null
      : {
      label: 'Margin',
      ...(season.margin !== null ? { value: points(season.margin) } : notRun ? notYet : { value: null }),
      note: season.runner_up_name ? `over ${season.runner_up_name}` : undefined,
    },
  ].filter(Boolean)
}
