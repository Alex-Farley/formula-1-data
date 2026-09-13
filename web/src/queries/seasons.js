/**
 * The seasons list: its query and its columns, read by Seasons.jsx and by
 * scripts/prerender.js (PD-02, rung two).
 *
 * WHY THIS FILE EXISTS
 *     The static list had seven columns to the app's nine and no Wins or
 *     Margin, because prerender.js wrote its own SQL and its own header row.
 *     And both halves rendered the season in progress as a row of em dashes
 *     — seven of them — under a footer that says this site never blurs
 *     "unknown" with "not yet" (IA-17). The definition lives here once, and
 *     the live season's row carries its leader, the leader's points and wins
 *     so far, the gap, and how many rounds have run, each marked "so far".
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { EMPTY, missing, points, text } from '../lib/format.js'
import { SO_FAR } from '../lib/site.js'

/**
 * One row per season, newest first.
 *
 * `live` is a season with no drivers' champion recorded and a round still
 * scheduled. For that row the champion's columns carry the leader instead —
 * the top of v_standings_final's drivers' table, the constructor they last
 * raced for this season, their points and wins counted from the race
 * records, the driver second to them and the gap — and the column formatters
 * below say so. A concluded season with no champion recorded stays blank:
 * the leader of a finished table is a champion, and if the register does not
 * say who, this query does not guess.
 */
export const SEASONS = `
  WITH progress AS (
    SELECT s.year,
           COALESCE(SUM(r.status = 'completed'), 0)                         AS run,
           (s.drivers_champion IS NULL AND SUM(r.status = 'scheduled') > 0) AS live
      FROM seasons s
      LEFT JOIN races r ON r.year = s.year
     GROUP BY s.year),
  ranked AS (
    SELECT year, table_type, entity_id, entity, team, points,
           ROW_NUMBER() OVER (PARTITION BY year, table_type
                              ORDER BY position IS NULL, position, points DESC) AS rank
      FROM v_standings_final)
  SELECT s.year, s.rounds, p.run, p.live,
         CASE WHEN p.live THEN d1.entity_id ELSE s.drivers_champion END AS champion_id,
         CASE WHEN p.live THEN d1.entity    ELSE d.full_name        END AS champion,
         CASE WHEN p.live THEN
              (SELECT e.constructor_id FROM race_entries e JOIN races r ON r.id = e.race_id
                WHERE r.year = s.year AND e.driver_id = d1.entity_id
                ORDER BY r.round DESC LIMIT 1)
              ELSE s.champion_team END                                AS champion_team_id,
         CASE WHEN p.live THEN d1.team      ELSE t.name             END AS champion_team,
         CASE WHEN p.live THEN d1.points    ELSE s.champion_points  END AS champion_points,
         CASE WHEN p.live THEN
              (SELECT COUNT(*) FROM race_entries e JOIN races r ON r.id = e.race_id
                WHERE r.year = s.year AND e.driver_id = d1.entity_id AND e.finish_position = 1)
              ELSE s.champion_wins END                                AS champion_wins,
         CASE WHEN p.live THEN d2.entity_id ELSE s.runner_up        END AS runner_up_id,
         CASE WHEN p.live THEN d2.entity    ELSE ru.full_name       END AS runner_up,
         CASE WHEN p.live THEN d1.points - d2.points ELSE s.margin  END AS margin,
         CASE WHEN p.live THEN k1.entity_id ELSE s.constructors_champion END AS constructors_champion_id,
         CASE WHEN p.live THEN k1.entity    ELSE cc.name            END AS constructors_champion,
         s.engine_formula
    FROM seasons s
    JOIN progress p           ON p.year = s.year
    LEFT JOIN drivers d       ON d.id  = s.drivers_champion
    LEFT JOIN drivers ru      ON ru.id = s.runner_up
    LEFT JOIN constructors t  ON t.id  = s.champion_team
    LEFT JOIN constructors cc ON cc.id = s.constructors_champion
    LEFT JOIN ranked d1 ON d1.year = s.year AND d1.table_type = 'drivers'      AND d1.rank = 1
    LEFT JOIN ranked d2 ON d2.year = s.year AND d2.table_type = 'drivers'      AND d2.rank = 2
    LEFT JOIN ranked k1 ON k1.year = s.year AND k1.table_type = 'constructors' AND k1.rank = 1
   ORDER BY s.year DESC
`

/** "Antonelli so far" on the live row; the name alone on every other. */
export const soFar = (name, row) => (missing(name) ? EMPTY : row.live ? `${name} ${SO_FAR}` : String(name))

const pts = (value) => (missing(value) ? EMPTY : points(value))

export const SEASONS_COLUMNS = [
  // The year is a link in both renderers; text() would print 2,026.
  { key: 'year', label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'rounds', label: 'Rounds', align: 'num', text: (rounds, row) => (row.live ? `${row.run} of ${text(rounds)}` : text(rounds)) },
  { key: 'champion', label: "Drivers' champion", text: soFar },
  { key: 'champion_team', label: 'Driving for' },
  { key: 'champion_points', label: 'Points', align: 'num', text: pts },
  { key: 'champion_wins', label: 'Wins', align: 'num' },
  { key: 'runner_up', label: 'Runner-up' },
  { key: 'margin', label: 'Margin', align: 'num', text: pts },
  { key: 'constructors_champion', label: "Constructors' champion", text: soFar },
]

export const SEASON_LIST_FOOTER =
  'Margin is the points gap between champion and runner-up at the end of the season; before 1991 that is net of dropped scores, so it can look small beside the wins. A row marked “so far” is the season still running: its leader, not its champion. A blank constructors’ champion before 1958 is not a gap — the championship did not exist yet.'
