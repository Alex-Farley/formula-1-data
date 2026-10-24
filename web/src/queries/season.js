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
import { EMPTY, missing, number, points, raceDates, text } from '../lib/format.js'
import { NOT_YET_RUN, SPRINT } from '../lib/site.js'
import { CURRENT_SEASON_SQL } from '../lib/season.js'
import { carName } from './race.js'
import { colourForEntry } from '../lib/liveries.js'

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
   WHERE f.year = ?
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
    SELECT win_points, fastest_lap_points, dropped_scores
      FROM points_systems
     WHERE session = 'race'
       AND from_year <= ?1 AND (to_year IS NULL OR to_year >= ?1)
     ORDER BY from_year DESC LIMIT 1),
  sp AS (
    SELECT win_points
      FROM points_systems
     WHERE session = 'sprint'
       AND from_year <= ?1 AND (to_year IS NULL OR to_year >= ?1)
     ORDER BY from_year DESC LIMIT 1)
  SELECT t.races, t.sprints, t.run, g.win_points, g.fastest_lap_points, g.dropped_scores,
         COALESCE((SELECT win_points FROM sp), 0) AS sprint_points,
         t.races * (g.win_points + g.fastest_lap_points)
           + t.sprints * COALESCE((SELECT win_points FROM sp), 0) AS available
    FROM to_run t, gp g
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
 * season record; it is NULL while the season is being run. `wins` is each
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
 * SEASON_SOURCES, with TITLE_SOURCES joined in where the page prints what
 * the points system says: the title arithmetic, where `answer` -
 * titleAnswer()'s result, which both renderers print when it is not null -
 * says it is printed; and a rule that dropped scores, which the title
 * chart's note says (progressionNote) on a season that ran under one. Both
 * renderers pass `remaining`, REMAINING's row, whether or not the static page
 * draws the chart, so the sentence is one sentence. One entry per source, in
 * the registry's order.
 */
export const seasonSources = (sources, title, { answer, remaining }) => {
  const dropped = remaining?.dropped_scores
  if (!answer && (missing(dropped) || dropped === EVERY_RESULT_COUNTS)) return sources
  const byId = new Map([...sources, ...title].map((s) => [s.id, s]))
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
 * `drivers` is FINAL's drivers' rows, `standings` STANDINGS's, `teams`
 * teamsByDriver() of DRIVER_TEAMS's, `live` stillRunning() of the calendar,
 * and `dropped` REMAINING's `dropped_scores`.
 */
export function titleRaceFigure({ year, live, drivers, standings, teams, dropped }) {
  const contenders = drivers.slice(0, 3).filter((d) => d.driver_id)
  const progression = contenders.map((driver) => {
    const last = (teams.get(driver.driver_id) ?? [])[0]
    return {
      name: driver.entity,
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
  const series = progression.map((s) => ({ name: s.name, points: s.points, colour: inColour ? s.colour : null }))
  return {
    heading: titleHeading(live),
    note: progressionNote(live, dropped),
    legend: series.map((s) => ({ name: s.name, colour: s.colour })),
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
 *
 * It comes in two parts (VD-90): `who`, the answer, which a season being run
 * prints in its lede (seasonLede below), and `basis`, what it was worked out
 * from and what it does not claim, which follows directly under the tiles.
 * The whole of it, ninety words, was too long to be a lede: on 2026 it ran to
 * ten lines, and the web font arriving after the page put an eleventh on and
 * moved everything beneath it.
 */
export function titleAnswer({ drivers, remaining, afterRound, built }) {
  if (!remaining || !remaining.races) return null
  // Anything but the one spelling - a rule, or a blank - declines, so a
  // reworded row fails closed rather than into a wrong elimination.
  if (remaining.dropped_scores !== EVERY_RESULT_COUNTS) return null
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
      ? `Only ${alive[0].entity} can still win the drivers' title: no other driver can now reach the leader's total.`
      : alive.length <= 10
        ? `Who can still win the drivers' title: ${listed(alive.map((d) => d.entity))}.`
        : alive.length === scored.length
          ? "Every driver who has scored can still reach the leader's total."
          : `${number(alive.length)} of the ${number(scored.length)} drivers who have scored can still reach the leader's total.`

  const basis = [
    `${left} still to run, so ${points(available)} points are still available, and a driver further behind the leader than that cannot reach them.`,
    afterRound ? `Counted after round ${number(afterRound)}${built ? `, from the database built ${built}` : ''}.` : null,
    'Points only: a tie at the top is settled on wins, which this does not work out.',
  ]
    .filter(Boolean)
    .join(' ')
  return { who, basis }
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
 * A result column on a round that has not been run: nothing (CD-37, CD-32).
 *
 * The Winner cell beside it already says "not yet run", and the em dash means
 * a figure nobody has established - so Car, Pole and Fastest lap dashed three
 * times per scheduled round said that a fact was missing about a race that
 * has not happened. 33 rounds on the calendar are in that state today and
 * every season passes through it. The row states the case once, in the cell
 * that exists to state it, and the rest stay blank.
 */
export const roundResult = (value, row) => (row.status !== 'completed' ? '' : text(value))

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

export const DRIVERS_FINAL_COLUMNS = [
  { key: 'position_text', label: 'Pos', align: 'num', text: position, glossary: 'results' },
  { key: 'entity', rowHeader: true, label: 'Driver' },
  { key: 'wins', label: 'Wins', align: 'num', text: won },
  { key: 'points', label: 'Points', align: 'num', text: points },
  { key: 'gap', label: 'Gap', align: 'num', text: behind },
]

export const DRIVERS_FINAL_FOOTER =
  'A driver with points and no position was excluded from the classification: the points stand, the position does not. ' +
  'Wins are counted from the race records, and a shared drive is a win for both of its drivers. ' +
  GAP_FOOTER

/** "McLaren mercedes" where the championship is contested by a chassis–engine pair. */
export const constructorEntity = (name, row) => (row.engine_id ? `${text(name)} ${row.engine_id}` : text(name))

export const CONSTRUCTORS_FINAL_COLUMNS = [
  { key: 'position_text', label: 'Pos', align: 'num', text: position, glossary: 'results' },
  { key: 'entity', rowHeader: true, label: 'Constructor', text: constructorEntity },
  { key: 'points', label: 'Points', align: 'num', text: points },
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
 * The season's tiles, as both renderers draw them (VD-49).
 *
 * A season still running leads with who leads, by how much, after how many
 * rounds; the champion's slots would be a row of em dashes on the
 * most-searched page of the year. A season nobody has raced carries
 * NOT_YET_RUN in those slots rather than a dash (IA-17), and the
 * constructors' title before 1958 is "not contested", which is a fact, where
 * a dash would be a gap.
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
        label: 'Leads',
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
            label: "Constructors' leader",
            kind: 'name',
            value: teamLead.entity,
            href: teamLead.constructor_id ? `constructors/${teamLead.constructor_id}` : null,
            note: `${points(teamLead.points)} points`,
          }
        : null,
    ].filter(Boolean)
  }
  const notYet = { value: NOT_YET_RUN, quiet: true }
  return [
    {
      label: 'Rounds',
      value: number(season.rounds),
      note: notRun ? NOT_YET_RUN : run === season.rounds ? 'all run' : `${run} run`,
    },
    {
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
    {
      label: 'Margin',
      ...(season.margin !== null ? { value: points(season.margin) } : notRun ? notYet : { value: null }),
      note: season.runner_up_name ? `over ${season.runner_up_name}` : undefined,
    },
  ]
}
