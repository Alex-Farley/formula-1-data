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
 * What counts as a start, for the SQLite the browser runs.
 *
 * THIS IS build.py's STARTED, and it is here as a constant rather than
 * written into the query because DERIVED asks the question three times - how
 * many starts, how many starts have no grid recorded, how many have no lap
 * count - and one rule spelled three times is how the country vocabulary
 * split. tests/test_conventions.py compares this string's codes with
 * build.py's and fails if either moves without the other.
 *
 * An entry is a start unless the source's result says it never was. A
 * pit-lane start counts; so does a retirement on the first lap.
 */
const STARTED = "COALESCE(e.position_text, '') NOT IN ('DNQ', 'DNPQ', 'DNS', 'DNP', 'EX')"

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
         SUM(e.shared_drive = 1)         AS shared,
         -- PD-15's substitutes. On 625 of the 862 driver pages Wins, Podiums,
         -- Poles and Fastest laps are all zero, and strip() drops the four
         -- there in favour of these. They are counted here rather than in a
         -- second query because every one of them was already one SELECT away.
         --
         -- A START, BY THE RULE THE RECORDS USE: the STARTED constant above,
         -- which is build.py's.
         SUM(${STARTED})                 AS starts,
         -- The source's own code, counted, not a status string interpreted:
         -- position_text is 'DNF' on 8,719 entries and NC, DSQ and EX are
         -- each a different fact that is not a retirement.
         SUM(e.position_text = 'DNF')    AS retirements,
         -- WHAT IS MISSING IS COUNTED AGAINST THE STARTS, and only where it
         -- is really missing. 1,917 entries carry no grid number, and there
         -- are three reasons for that of which only one is a gap:
         --
         --   a DNQ never qualified, so there is no slot to record and nothing
         --     is absent; counting those would report 14 of Gabbiani's 17
         --     entries as holes in the data;
         --   a PIT-LANE START has no grid number but carries 'PL' in
         --     grid_text - 237 entries - and schema.sql says why that is not
         --     an absence: "NULLing those would say we do not know where they
         --     started, which is the opposite of the truth". Reading them as
         --     gaps put a spurious note on 40 driver pages, under a strip
         --     whose own note says a pit-lane start counts;
         --   a start with neither a number nor a grid_text IS a gap.
         --
         -- Only the third is counted: 20 of the winless pages that show a
         -- Best grid at all. The lap count is the same shape - a non-start
         -- ran no laps - and its gap falls on 20 pages too.
         --
         -- MIN(e.grid) itself spans every entry, including a DNS that
         -- qualified and then did not go. That is deliberate: it is the best
         -- slot ON RECORD, not the best slot started from.
         MIN(e.grid)                     AS best_grid,
         SUM(e.grid IS NULL AND e.grid_text IS NULL AND ${STARTED}) AS starts_without_grid,
         SUM(e.laps_completed)           AS laps,
         SUM(e.laps_completed IS NULL AND ${STARTED}) AS starts_without_laps,
         COUNT(DISTINCT e.constructor_id) AS constructors,
         -- COUNT(DISTINCT) skips a NULL, so a career whose entries do not all
         -- name a constructor counts only the named ones. Four winless
         -- careers are in that position; the tile says so rather than
         -- implying the entries it could not read.
         SUM(e.constructor_id IS NULL)   AS entries_without_constructor
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE e.driver_id = ?
`

/**
 * The constructors a driver entered for, most often first.
 *
 * Here rather than in either renderer because the opening sentence below
 * names them and both renderers write that sentence. 377 entries name no
 * constructor and the JOIN drops them, so a career that named none returns
 * no row and the sentence says nothing about who it was for.
 */
export const DRIVER_CONSTRUCTORS = `
  SELECT c.name, COUNT(*) AS n
    FROM race_entries e
    JOIN constructors c ON c.id = e.constructor_id
   WHERE e.driver_id = ?
   GROUP BY c.id
   ORDER BY n DESC, c.name
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
 *
 * THE STRIP FITS THE CAREER (PD-15). It used to carry Wins, Podiums, Poles
 * and Fastest laps whatever they were, and on 625 of the 862 driver pages all
 * four were zero: a summary that summarised nothing, four times, above a page
 * whose actual story - seventeen entries, three starts, three retirements -
 * was not on it anywhere. Those four now appear only where at least ONE of
 * them is non-zero, and give way to figures that are not zero when they do
 * not: the best grid slot on record, the laps, the retirements, the
 * constructors.
 *
 * THE FOUR MOVE TOGETHER, and that is deliberate. A zero among non-zeros is
 * informative - 'Podiums 3, Wins 0' is a career - so the test is whether any
 * of the four says something, not whether each does. 237 strips keep them,
 * 121 of those still showing Wins 0, which is why Driver.jsx still refuses to
 * LEAD with a zero.
 *
 * AND A DROPPED TILE IS NOT A MISSING FACT. The zero is still on the page
 * twice below: every season's Wins, Podiums, Poles and FL in 'Season by
 * season', and Wins, Poles and Fastest laps derived-and-published under 'On
 * the record'. The strip is the summary, not the register, so dropping a
 * figure here hides nothing - which is the condition on dropping it at all.
 */
export function strip(driver, derived) {
  const entries = derived.entries ?? 0
  const starts = derived.starts ?? 0
  // Whether the four results figures have anything to say between them.
  const placed = [derived.wins, derived.podiums, derived.poles, derived.fastest_laps].some(
    (figure) => (figure ?? 0) > 0,
  )
  return [
    {
      label: 'Seasons',
      value: span(driver.first_season, driver.last_season),
      note: seasonsNote(driver, derived),
    },
    { label: 'Entries', value: number(entries) },
    // Only where an entry was not a start. On 417 careers the two figures are
    // the same and a second tile would restate the first - the two drivers
    // with no entry at all among them, 0 and 0 - and on the other 445 the gap
    // IS the career: the late 1980s put 1,041 DNQs and 337 DNPQs on these
    // pages, and an entry list that never says so reads as a career of races.
    starts === entries
      ? null
      : {
          label: 'Starts',
          value: number(starts),
          note: `${number(entries - starts)} did not start`,
        },
    ...(placed
      ? [
          { label: 'Wins', value: number(derived.wins ?? 0) },
          { label: 'Podiums', value: number(derived.podiums ?? 0) },
          { label: 'Poles', value: number(derived.poles ?? 0) },
          { label: 'Fastest laps', value: number(derived.fastest_laps ?? 0) },
        ]
      : []),
    driver.titles
      ? {
          label: 'Titles',
          value: number(driver.titles),
          note: missing(driver.title_years) ? undefined : yearList(driver.title_years),
        }
      : null,
    { label: 'Best finish', value: derived.best ? `P${derived.best}` : null },
    ...(placed ? [] : instead(derived, starts)),
  ].filter(Boolean)
}

/** "1 start", "3 starts", "1 entry", "4 entries". */
const plural = (n, one, many = `${one}s`) => `${number(n)} ${n === 1 ? one : many}`

/**
 * What a strip carries in place of four zeros: PD-15's list, in the order the
 * issue gives it.
 *
 * EACH ONE IS DROPPED WHERE IT WOULD SAY NOTHING rather than shown as a zero
 * or an em dash - which is the whole point of the change, and would be undone
 * by substituting four different zeros for the four it removed. A career with
 * no grid on record gets no Best grid, one that ran no recorded lap gets no
 * Laps, one that never started gets no Retirements (0 of 0 starts is not a
 * fact about a driver), one whose entries name no constructor gets no
 * Constructors, and the two drivers in the register with no entry at all get
 * none of them: a strip of two tiles, which is the whole truth about them.
 *
 * EACH ONE SAYS WHAT IT IS OVER where that is not every start. `starts` is
 * the denominator rather than `entries` because a driver who did not qualify
 * has no grid and ran no laps, and there is nothing missing about that; a
 * start with neither is a gap, and only a gap gets a note.
 */
const instead = (derived, starts) => {
  const noGrid = derived.starts_without_grid ?? 0
  const noLaps = derived.starts_without_laps ?? 0
  const unnamed = derived.entries_without_constructor ?? 0
  return [
    {
      label: 'Best grid',
      value: missing(derived.best_grid) ? null : `P${derived.best_grid}`,
      note: noGrid > 0 ? `${plural(noGrid, 'start')} with no grid recorded` : undefined,
    },
    // Laps completed, added up. A lap count is per entry and 1,837 entries
    // carry none, so the note is the same shape as Best grid's.
    missing(derived.laps)
      ? null
      : {
          label: 'Laps',
          value: number(derived.laps),
          note: noLaps > 0 ? `${plural(noLaps, 'start')} with no lap count` : undefined,
        },
    // The note names the code the entry table below shows, so a reader can
    // match the figure to the rows it counts. Under a zero there are no rows
    // to match and it is the source code printed for its own sake.
    starts > 0
      ? {
          label: 'Retirements',
          value: number(derived.retirements ?? 0),
          note: (derived.retirements ?? 0) > 0 ? 'DNF' : undefined,
        }
      : null,
    derived.constructors
      ? {
          label: 'Constructors',
          value: number(derived.constructors),
          note: unnamed > 0 ? `no constructor on ${plural(unnamed, 'entry', 'entries')}` : undefined,
        }
      : null,
  ]
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
    // both Entries and Starts from the race records, by the rule STARTED
    // states, and an entry is not a start. Fourteen drivers' published entry
    // count and two drivers' published start count differ from the counted
    // one; both figures are shown and ENTRIES_NOTE under this list says why
    // neither is corrected.
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

/** "Ferrari", "Ferrari and Matra", "Mercedes, McLaren and Ferrari", "Ferrari, Matra and 6 other constructors". */
const constructorList = (names) => {
  if (names.length <= 3) return names.length < 3 ? names.join(' and ') : `${names[0]}, ${names[1]} and ${names[2]}`
  const rest = names.length - 2
  return `${names[0]}, ${names[1]} and ${rest} other ${rest === 1 ? 'constructor' : 'constructors'}`
}

// Digits throughout: "best finish 4th" and "best finish 33rd" read as one
// system, where words to twelfth and digits beyond did not.
const ordinal = (n) => {
  const tail = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'
  return `${n}${tail}`
}

/**
 * A driver's career as one sentence, from the figures counted out of the race
 * records - the ones the strip below it derives - and never from a stored
 * column the page labels as published.
 *
 *     Entered 88 championship Grands Prix across 1979-1986 for Arrows,
 *     Brabham and 5 other constructors; best finish 4th.
 *
 * `finish_position` is NULL for a DNF, a DNQ and a DNS alike, so a career
 * with no classified finish says exactly that rather than guessing why.
 */
export const careerSentence = (derived, constructors, titles) => {
  if (!derived || !derived.entries) return 'No championship race entry in the records.'
  const when =
    derived.first_year === derived.last_year
      ? `in ${derived.first_year}`
      : `across ${derived.first_year}–${derived.last_year}`
  const who = constructors.length ? ` for ${constructorList(constructors)}` : ''
  const entered = `Entered ${plural(derived.entries, 'championship Grand Prix', 'championship Grands Prix')} ${when}${who}`

  const tally = [
    titles ? plural(titles, 'world title') : null,
    derived.wins ? plural(derived.wins, 'win') : null,
    derived.podiums ? plural(derived.podiums, 'podium') : null,
    derived.poles ? plural(derived.poles, 'pole') : null,
  ].filter(Boolean)
  const counted = tally.length > 1 ? `${tally.slice(0, -1).join(', ')} and ${tally.at(-1)}` : tally[0] ?? null

  // A winner's best finish is the win; anyone else is described by their best
  // result, or by the absence of one.
  const best = derived.wins
    ? null
    : derived.best
      ? `best finish ${ordinal(derived.best)}`
      : 'no classified finish'

  return `${entered}; ${[counted, best].filter(Boolean).join(', ')}.`
}

/**
 * The opening sentence of a driver's page, in both renderers (PD-16).
 *
 * `notes` is the override and stays the lede wherever a person wrote one -
 * 163 of the 862 rows. The other 699 pages opened on a strip of tiles with
 * nothing to say what the reader was looking at; careerSentence() above says
 * it from the race records, so the sentence is current by construction and
 * cannot go stale the way a written figure can. That is the same rule
 * `notes` is held to: tools/lede_figures.py fails the build on a note that
 * states a figure the page derives.
 *
 * A blank note is not a note. 0 rows hold one today, and `notes` has no NOT
 * NULL or length constraint, so an empty string would otherwise render an
 * empty lede rather than falling through to the sentence.
 */
export const lede = (driver, derived, constructors) =>
  driver.notes && String(driver.notes).trim()
    ? driver.notes
    : careerSentence(derived, constructors, driver.titles)
