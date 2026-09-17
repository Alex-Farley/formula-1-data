/**
 * One driver's page: its queries, its tables' columns and the shape of its
 * facts, read by Driver.jsx and by scripts/prerender.js.
 *
 * WHY THIS FILE EXISTS
 *     The static driver page read the stored `entries`, `wins` and `podiums`
 *     columns; the app counts the same figures from the race records. Under
 *     the same label, 14 of the 38 drivers with a stored entry count showed
 *     one number statically and another once the app took over, and the
 *     other 824 showed an em dash and then a figure (PD-02). Both halves
 *     now run the SQL below and lay the answers out with the functions
 *     below, so what the crawler reads is what the reader sees.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { EMPTY, finished, missing, number, points, result, span, text, yearList } from '../lib/format.js'

export const DRIVER = `SELECT * FROM drivers WHERE id = ?`

/**
 * The career, counted from the race records rather than read from a column.
 *
 * The stored figures are shown beside these on the page, because where they
 * differ the difference is the interesting part: career_points is a gross
 * total here and a net one in the register for every season that ran the
 * best-N-results rule, which is every season up to 1990.
 *
 * first_year and last_year are for the static page's meta description
 * (CD-20), which is one sentence built from this row and never from a
 * stored column the page labels as published. The strip shows them only
 * where they differ from the register's seasons (CD-22).
 */
export const DERIVED = `
  SELECT COUNT(*)                        AS entries,
         COUNT(DISTINCT r.year)          AS seasons,
         MIN(r.year)                     AS first_year,
         MAX(r.year)                     AS last_year,
         SUM(e.finish_position = 1)      AS wins,
         SUM(e.finish_position <= 3)     AS podiums,
         SUM(e.pole = 1)                 AS poles,
         SUM(e.fastest_lap = 1)          AS fastest_laps,
         SUM(COALESCE(e.points, 0))      AS points,
         MIN(e.finish_position)          AS best,
         SUM(e.finish_position IS NOT NULL) AS classified,
         SUM(e.shared_drive = 1)         AS shared
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE e.driver_id = ?
`

export const BY_SEASON = `
  SELECT r.year,
         COUNT(*)                    AS entries,
         -- COALESCE, because SUM over a season with no classified finish is
         -- NULL, which rendered as the em dash meaning "not established" on
         -- 591 driver-seasons whose true figure is zero - beside a strip that
         -- said WINS 0 forty pixels above.
         COALESCE(SUM(e.finish_position = 1), 0)  AS wins,
         COALESCE(SUM(e.finish_position <= 3), 0) AS podiums,
         COALESCE(SUM(e.pole = 1), 0)             AS poles,
         COALESCE(SUM(e.fastest_lap = 1), 0)      AS fastest_laps,
         SUM(COALESCE(e.points, 0))  AS points,
         MIN(e.finish_position)      AS best,
         group_concat(DISTINCT k.name) AS teams
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE e.driver_id = ?
   GROUP BY r.year
   ORDER BY r.year
`

/**
 * The table as each season finished, one row per season. v_standings_final
 * folds the two sources that describe 2026 into one row and says why in
 * schema.sql; a driver can still hold two rows in one season only where one
 * source asserts two entries, which never happens for a driver.
 */
export const STANDINGS = `
  SELECT s.id, s.year, s.entity_id, s.engine_id, s.position, s.position_text, s.points, s.team
    FROM v_standings_final s
   WHERE s.table_type = 'drivers' AND s.entity_id = ?
   ORDER BY s.year
`

export const RESULTS = `
  SELECT r.year, r.round, r.name_used, r.circuit_id, c.name AS circuit,
         e.grid_text, e.grid, e.position_text, e.finish_position, e.status,
         e.points, e.fastest_lap, e.shared_drive, e.laps_completed,
         k.id AS constructor_id, k.name AS constructor, k.country AS constructor_country,
         e.chassis_id, ch.name AS chassis
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
    LEFT JOIN chassis ch ON ch.id = e.chassis_id
   WHERE e.driver_id = ?
   ORDER BY r.year DESC, r.round DESC
`

/**
 * The constructors a driver raced for in each season, latest first within a
 * season: queries/season.js DRIVER_TEAMS, for one driver across a career
 * rather than one season across a grid, with the same order and the same
 * tiebreak. teamsBySeason() groups it; lib/liveries.js lastTeamColour()
 * turns a season's list into the one mark its row wears (AF-47).
 */
export const SEASON_TEAMS = `
  SELECT r.year, e.constructor_id, k.name AS constructor, k.country,
         MAX(r.round) AS last_round, COUNT(*) AS entries
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE e.driver_id = ? AND e.constructor_id IS NOT NULL
   GROUP BY r.year, e.constructor_id
   ORDER BY r.year, last_round DESC, e.constructor_id
`

/** SEASON_TEAMS rows grouped by season, in the query's order (latest team first). */
export function teamsBySeason(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.year)) map.set(row.year, [])
    map.get(row.year).push(row)
  }
  return map
}

/**
 * "Season by season", as the table opens: each BY_SEASON row joined to where
 * that championship finished, latest season first. The order is DataTable's
 * initial sort on the page (year, descending), stated here so the static
 * table prints the same rows in the same order without a DataTable.
 */
export function seasonRows(bySeason, standings) {
  const byYear = new Map(standings.map((s) => [s.year, s]))
  return bySeason
    .map((season) => ({
      ...season,
      championship: byYear.get(season.year)?.position ?? null,
      championship_text: byYear.get(season.year)?.position_text ?? null,
      championship_points: byYear.get(season.year)?.points ?? null,
    }))
    .sort((a, b) => b.year - a.year)
}

export const SEASON_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num' },
  { key: 'teams', label: 'Constructor', align: 'prose' },
  { key: 'entries', label: 'Entries', align: 'num' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'podiums', label: 'Podiums', align: 'num' },
  { key: 'poles', label: 'Poles', align: 'num' },
  { key: 'fastest_laps', label: 'FL', align: 'num' },
  { key: 'best', label: 'Best', align: 'num', text: (value) => (missing(value) ? EMPTY : `P${value}`) },
  {
    key: 'championship_text',
    label: 'Championship',
    align: 'num',
    text: (value, row) => text(value ?? row.championship),
  },
  { key: 'points', label: 'Points scored', align: 'num', text: (value) => points(value) },
]

export const SEASONS_FOOTER =
  '“Points scored” adds up every point from the races. The championship column is where the season ' +
  'actually finished, which before 1991 could be lower once dropped scores were applied. Open a season ' +
  'for its full table.'

/** "Every entry": one row per race the driver was entered for, latest first. */
export const ENTRY_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num' },
  { key: 'name_used', label: 'Grand Prix' },
  { key: 'constructor', label: 'Constructor' },
  { key: 'chassis', label: 'Chassis', text: (name, row) => text(name ?? row.chassis_id) },
  { key: 'grid_text', label: 'Grid', align: 'num' },
  { key: 'position_text', label: 'Result', align: 'num', text: (_, row) => result(row) },
  {
    key: 'status',
    label: 'Out',
    text: (value, row) => (finished(value, row.finish_position) ? 'Finished' : text(value)),
  },
  { key: 'laps_completed', label: 'Laps', align: 'num' },
  { key: 'points', label: 'Points', align: 'num', text: (value) => points(value) },
]

/**
 * The strip at the top of the page: the career as the race records count
 * it, with the seasons and titles the register holds. Titles appears only
 * where there is one to show; Best finish only where a finish was classified.
 * Each item is { label, value, note }, value a string or null; both Stats and
 * the static facts list drop a null value.
 */
export function strip(driver, derived) {
  return [
    {
      label: 'Seasons',
      value: span(driver.first_season, driver.last_season),
      note: seasonsNote(driver, derived),
    },
    { label: 'Entries', value: number(derived.entries) },
    { label: 'Wins', value: number(derived.wins ?? 0) },
    { label: 'Podiums', value: number(derived.podiums ?? 0) },
    { label: 'Poles', value: number(derived.poles ?? 0) },
    { label: 'Fastest laps', value: number(derived.fastest_laps ?? 0) },
    driver.titles
      ? {
          label: 'Titles',
          value: number(driver.titles),
          note: missing(driver.title_years) ? undefined : yearList(driver.title_years),
        }
      : null,
    { label: 'Best finish', value: derived.best ? `P${derived.best}` : null },
  ].filter(Boolean)
}

/**
 * The Seasons note: how many seasons carry an entry, and, where the register's
 * span is not the race records' span, the records' years - so the reader sees
 * which is which. The description derives its years; the fact shows the
 * register's; for two drivers they differ, and each side is right about
 * something: Cevert's first entry was the 1969 German Grand Prix in a Formula
 * 2 Tecno, and the register's 1970 is his Formula One debut; Rossi's 2014 was
 * practice sessions only, and the records' 2015 is his first race entry.
 * verify.py pins the pair (CD-22). A NULL last_season is the register's way
 * of saying the driver is still driving, not a claim about the last year, so
 * an open span never differs on its last year; the review of #81 found the
 * note firing on the whole current grid for want of that clause. Both spans
 * are labelled, the register's as published, in the site's own vocabulary.
 */
export const seasonsNote = (driver, derived) => {
  const n = `${derived.seasons ?? 0} with an entry`
  if (missing(derived.first_year)) return n
  // Symmetric: a NULL at either end of the register's span is no claim about
  // that end, and the other end is still compared (CD-26).
  const differs =
    (!missing(driver.first_season) && derived.first_year !== driver.first_season) ||
    (!missing(driver.last_season) && derived.last_year !== driver.last_season)
  if (!differs) return n
  return `${n}; ${span(derived.first_year, derived.last_year)} in the race records, ${span(driver.first_season, driver.last_season)} published`
}

/** "N derived · M published", or just the derived figure where nothing was published. */
export const derivedAndPublished = (derived, published) =>
  `${number(derived)} derived${missing(published) ? '' : ` · ${number(published)} published`}`

/**
 * "On the record": the stored row, label by label, in the page's order. The
 * values are the strings both renderers print — a missing one is already the
 * em dash, so the static list keeps the row the app shows dashed. Confidence
 * and Source follow these in both renderers; they are a pill and a link
 * there, not strings, so each renderer appends its own. The sentence under
 * the list is ENTRIES_NOTE in lib/site.js, shared the same way.
 */
export function record(driver) {
  return [
    ['Born', text(driver.born)],
    ['Died', text(driver.died)],
    ['Nationality', text(driver.nationality)],
    ['Status', text(driver.status)],
    // How a harvest put the row here, where one did. It used to open
    // `notes`, which is the lede above and the meta description; it is
    // shown only where it exists, so most rows get no em dash for it.
    ...(driver.provenance ? [['Provenance', String(driver.provenance)]] : []),
    // Published figures, labelled as such (CD-18): the strip above counts
    // Entries from the race records, and an entry is not a start.
    ['Entries (published)', number(driver.entries)],
    ['Starts (published)', number(driver.starts)],
    ['Wins', derivedAndPublished(driver.wins, driver.wins_external)],
    ['Poles', derivedAndPublished(driver.poles, driver.poles_external)],
    ['Fastest laps', derivedAndPublished(driver.fastest_laps, driver.fastest_laps_external)],
    ['External source', text(driver.external_source)],
  ]
}

/**
 * Whether the stored career total and the points scored differ beyond
 * rounding. The stored total is net of dropped scores wherever the season's
 * rules dropped any; the derived one adds up every point scored. Saying so
 * is better than showing one and hiding the other.
 */
export const pointsDiffer = (driver, derived) =>
  !missing(driver.career_points) &&
  !missing(derived.points) &&
  Math.abs(driver.career_points - derived.points) > 0.01

export const pointsNote = (driver, derived) => ({
  head: `Two career points totals: ${points(driver.career_points)} published, ${points(derived.points)} scored.`,
  body:
    "Both are right. Up to 1990 only a driver's best few results counted towards the " +
    'championship, so the published total is net of the points that were dropped.',
})
