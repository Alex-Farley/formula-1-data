/**
 * One constructor's page: its queries and its three tables' columns, read
 * by Constructor.jsx and by scripts/prerender.js (PD-02, rung five).
 *
 * WHY THIS FILE EXISTS
 *     The static constructor page had one table, "Wins", with three columns
 *     from race_results in year order; the app has "Every win" with five,
 *     newest first, and a season-by-season table and a table of the cars
 *     built that the static page did not carry at all. The definitions live
 *     here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { EMPTY, missing, number, points, span, text, yearList } from '../lib/format.js'
import { derivedAndPublished } from './driver.js'
import { LABELS } from '../lib/site.js'

export const CONSTRUCTOR = `SELECT * FROM constructors WHERE id = ?`

/** The record, counted from the race records rather than read from a column. */
export const DERIVED = `
  SELECT COUNT(*)                       AS entries,
         COUNT(DISTINCT r.year)         AS seasons,
         COUNT(DISTINCT r.id)           AS races,
         SUM(e.finish_position = 1)     AS wins,
         SUM(e.finish_position <= 3)    AS podiums,
         SUM(e.pole = 1)                AS poles,
         SUM(e.fastest_lap = 1)         AS fastest_laps,
         COUNT(DISTINCT e.driver_id)    AS drivers
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE e.constructor_id = ?
`

/**
 * Wins and Poles as the register states them (CD-34): the count from the race
 * records beside the published figure, in the driver page's words - "251
 * derived · 250 published". The stored `constructors.wins` is hand-entered
 * from reference records and parts from the count on four teams (ferrari,
 * vanwall, alfa-romeo, rob-walker), so neither figure is shown alone. Read by
 * the app's "On the record" and the static page's facts list, which is how
 * the two say the same thing; the Stats strip's Wins is the derived half.
 */
export const recordFigures = (constructor, derived) => [
  ['Wins', derivedAndPublished(derived.wins ?? 0, constructor.wins)],
  ['Poles', derivedAndPublished(derived.poles ?? 0, constructor.poles)],
]

export const BY_SEASON = `
  SELECT r.year,
         COUNT(*)                    AS entries,
         COALESCE(SUM(e.finish_position = 1), 0)  AS wins,
         COALESCE(SUM(e.finish_position <= 3), 0) AS podiums,
         COALESCE(SUM(e.pole = 1), 0)             AS poles,
         SUM(COALESCE(e.points, 0))  AS points,
         MIN(e.finish_position)      AS best,
         COUNT(DISTINCT e.driver_id) AS drivers
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE e.constructor_id = ?
   GROUP BY r.year
   ORDER BY r.year
`

/**
 * The season's final table can legitimately hold two rows for one constructor:
 * Force India was excluded from 2018 with nothing and its successor scored 52
 * under the same id, and Cooper contested 1960 with three engines. Both
 * survive v_standings_final; the same-fact-from-two-sources rows do not. The
 * rule and its reasons are on the view in schema.sql.
 *
 * Two such rows can share a position (Cooper's 1960 Maserati and Castellotti
 * rows are both fifth), so the row id closes the order, as on the season's
 * FINAL (CR-64): constructorSeasons shows the first of them.
 */
export const STANDINGS = `
  SELECT s.id, s.year, s.constructor_id, s.engine_id, s.position, s.position_text, s.points, s.team
    FROM v_standings_final s
   WHERE s.table_type = 'constructors' AND s.constructor_id = ?
   ORDER BY s.year, s.position IS NULL, s.position, s.id
`

/** Newest first: the order the app's table opens in. */
export const WINS = `
  SELECT r.year, r.round, r.name_used, r.circuit_id, c.name AS circuit,
         e.driver_id, d.full_name AS driver, e.chassis_id, ch.name AS chassis
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN circuits c  ON c.id = r.circuit_id
    LEFT JOIN drivers d   ON d.id = e.driver_id
    LEFT JOIN chassis ch  ON ch.id = e.chassis_id
   WHERE e.constructor_id = ? AND e.finish_position = 1
   ORDER BY r.year DESC, r.round DESC, e.id
`

export const DESIGNS = `
  SELECT ch.id, ch.name, ch.first_year, ch.last_year, ch.engine_name, ch.chassis_type,
         ch.power_bhp, ch.races, ch.wins, ch.confidence
    FROM chassis ch
   WHERE ch.constructor_id = ?
   ORDER BY ch.first_year IS NULL, ch.first_year, ch.name, ch.id
`

export const LINEAGE = `
  SELECT l.* FROM constructor_lineage l
   WHERE l.chain_id = (SELECT lineage_chain FROM constructors WHERE id = ?)
   ORDER BY l.sequence
`

/**
 * The season-by-season rows with the championship position joined on, newest
 * first — the order the app's table opens in, so the static page prints them
 * as they come. Where a season carries two standings rows (an engine split),
 * the first by position is the one shown, as the app has always done.
 */
export const constructorSeasons = (bySeason, standings) =>
  [...bySeason]
    .sort((a, b) => b.year - a.year)
    .map((season) => {
      const standing = standings.find((s) => s.year === season.year)
      return {
        ...season,
        championship: standing?.position ?? null,
        championship_text: standing?.position_text ?? null,
      }
    })

export const SEASON_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'entries', label: 'Entries', align: 'num' },
  { key: 'drivers', label: 'Drivers', align: 'num' },
  // Counted from the race records, as the driver page's are, and declared for
  // the same reason (VD-29): a team that never won prints a column of noughts,
  // and the two pages describing the same figures should not differ on it.
  { key: 'wins', label: 'Wins', align: 'num', collapse: true },
  { key: 'podiums', label: 'Podiums', align: 'num', collapse: true },
  { key: 'poles', label: 'Poles', align: 'num', collapse: true },
  { key: 'best', label: 'Best', align: 'num', text: (value) => (missing(value) ? EMPTY : `P${value}`) },
  { key: 'points', label: 'Points scored', align: 'num', text: (value) => points(value) },
  {
    key: 'championship_text',
    label: 'Championship',
    align: 'num',
    text: (value, row) => text(value ?? row.championship),
    glossary: 'results',
  },
]

export const ENGINE_SPLIT_FOOTER =
  "The constructors' championship is contested by a chassis–engine pair, so a season can carry more than one entry for the same name. Open the season to see both."

export const WIN_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', rowHeader: true, label: 'Grand Prix' },
  { key: 'circuit', label: 'Circuit' },
  { key: 'driver', label: 'Driver' },
  { key: 'chassis', label: 'Chassis', text: (name, row) => text(name ?? row.chassis_id) },
]

export const WINS_FOOTER =
  'A blank chassis is a season this team ran more than one design and no source records which car raced which round.'

export const DESIGN_COLUMNS = [
  { key: 'name', rowHeader: true, label: 'Chassis' },
  { key: 'first_year', label: 'Years', align: 'num', text: (_, row) => span(row.first_year, row.last_year) },
  { key: 'engine_name', label: 'Engine' },
  { key: 'power_bhp', label: 'Power (bhp)', align: 'num' },
  { key: 'races', label: 'Races', align: 'num' },
  { key: 'wins', label: 'Wins', align: 'num' },
]

/**
 * The constructor's tiles, as both renderers draw them (VD-49). The figures
 * are DERIVED's, counted from the race records, never the stored columns:
 * constructors.entries is NULL for every row.
 *
 * VD-28: wins and the constructors' titles lead, the same two ranks the
 * driver page takes and for the same reason - and, for the same reason, a
 * zero does not lead: of the constructors in the register most never won,
 * and leading their 0 would point the emphasis at what is not there. A strip
 * with no lead keeps the one rank it always had.
 */
export const teamStrip = (constructor, derived) =>
  [
    {
      label: LABELS.seasons,
      value: span(constructor.first_entry, constructor.active ? null : constructor.last_entry),
      note: `${derived.seasons ?? 0} ${derived.seasons === 1 ? 'season' : 'seasons'}`,
    },
    { label: LABELS.entries, value: number(derived.entries) },
    { label: 'Wins', value: number(derived.wins ?? 0), lead: Number(derived.wins) > 0 },
    { label: 'Podiums', value: number(derived.podiums ?? 0) },
    { label: 'Poles', value: number(derived.poles ?? 0) },
    { label: 'Drivers', value: number(derived.drivers) },
    constructor.constructors_titles
      ? {
          label: "Constructors' titles",
          value: number(constructor.constructors_titles),
          note: missing(constructor.title_years) ? undefined : yearList(constructor.title_years),
          lead: true,
        }
      : null,
    constructor.drivers_titles ? { label: "Drivers' titles", value: number(constructor.drivers_titles) } : null,
  ].filter(Boolean)
