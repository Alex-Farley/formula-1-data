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
import { CURRENT_SEASON_SQL } from '../lib/season.js'
import { FOLD_NOUN } from '../lib/table.js'
import { PRACTICE_SESSIONS } from './race.js'
import { LABELS } from '../lib/site.js'

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
 * The registry entries behind the rows this page prints, for the citation's
 * second sentence (CD-08; site.js's behindThisPage says what it reads): the
 * driver's own row, the article the row's note was checked against where
 * that is not the row's own source (driver_note_sources, LV-08), every
 * entry, the race each entry was in, every round of
 * the current season that THIS_SEASON prints - the whole calendar, including
 * rounds the driver did not enter and rounds still to run, so its races are
 * reached by the same condition and not through the entries - and every
 * standings row the season's table is read from: a finished season's final
 * rows, and for the season being run the running rows, where both sources
 * stand. Those rather than v_standings_final's, because the view folds a
 * second source's position into the first's row where the first has none,
 * and a source whose value is printed is behind the page.
 */
export const DRIVER_SOURCES = `
  SELECT s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id IN (
           SELECT source_id FROM drivers WHERE id = ?1
     UNION SELECT source_id FROM driver_note_sources WHERE driver_id = ?1
     UNION SELECT source_id FROM race_entries WHERE driver_id = ?1
     UNION SELECT r.source_id FROM races r JOIN race_entries e ON e.race_id = r.id WHERE e.driver_id = ?1
     UNION SELECT r.source_id FROM races r
            WHERE r.year = ${CURRENT_SEASON_SQL}
              AND EXISTS (SELECT 1 FROM race_entries x JOIN races y ON y.id = x.race_id
                           WHERE x.driver_id = ?1 AND y.year = r.year)
     UNION SELECT t.source_id FROM standings t
            WHERE t.table_type = 'drivers' AND t.driver_id = ?1
              AND (t.basis = 'final'
                   OR NOT EXISTS (SELECT 1 FROM standings f
                                   WHERE f.year = t.year AND f.table_type = 'drivers'
                                     AND f.basis = 'final')))
   ORDER BY s.priority, s.id
`

/**
 * The table as each season finished, one row per season. v_standings_final
 * folds the two sources that describe 2026 into one row and says why in
 * schema.sql; a driver can still hold two rows in one season only where one
 * source asserts two entries, which never happens for a driver.
 */
export const STANDINGS = `
  SELECT s.id, s.year, s.driver_id, s.engine_id, s.position, s.position_text, s.points, s.team
    FROM v_standings_final s
   WHERE s.table_type = 'drivers' AND s.driver_id = ?
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

/**
 * THE SEASON BEING RUN, ROUND BY ROUND (PD-49).
 *
 * A driver of the current season has a page that opens on that season, with
 * the career below it. Every round of the declared season's calendar is a
 * row here, with the driver's entry beside it where there is one, so a round
 * still to run and a round the driver was not entered for are rows as well:
 * the chart's axis then runs the length of the calendar, and how much of the
 * season is left is the space to the right of the last dot rather than a
 * figure to read. The anchor is meta.current_season (lib/season.js), never a
 * MAX() over the races - the register already holds next season's calendar.
 *
 * A driver with no entry in that season gets no rows, and so no section: a
 * declared reserve who has not raced has no season to show yet, and for
 * everyone else the career is the page, as it was.
 */
export const THIS_SEASON = `
  SELECT r.year AS season, r.round, r.name_used, r.status, r.sprint,
         e.id AS entry_id, e.grid_text, e.grid, e.position_text, e.finish_position,
         e.status AS out, e.points,
         k.id AS constructor_id, k.name AS constructor, k.country AS constructor_country
    FROM races r
    LEFT JOIN race_entries e ON e.race_id = r.id AND e.driver_id = ?1
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE r.year = ${CURRENT_SEASON_SQL}
     AND EXISTS (SELECT 1 FROM race_entries x JOIN races y ON y.id = x.race_id
                  WHERE x.driver_id = ?1 AND y.year = r.year)
   ORDER BY r.round, e.id
`

/**
 * "2026, round by round" (CD-51). It was "The 2026 season so far", which
 * restated the strip's last tile 100 px above it; the tile says where the
 * season stands, and this section is the rounds, so its heading says that.
 */
/**
 * The notes under the driver's two figures, here rather than in Driver.jsx so
 * conventions.mjs can hold each to the figure grammar's 50 words at its
 * longest (VD-80). `source` is colourSource()'s clause for the colours the
 * figure drew, or null where it drew none; `hollow` is whether some mark is
 * drawn hollow among coloured ones.
 */
const colourClause = (lead, source, hollow, mark, none) =>
  source
    ? `${lead}: ${source}.${hollow ? ` A hollow ${mark} has no colour on record.` : ''}`
    : `The ${mark}s are not in team colours: ${none}.`

/** The championship chart's note: 50 words at the longest, a career that runs from national colours into the gap. */
export const finishesFigureNote = (source, hollow) =>
  `Final championship position by season, ringed for a title; a season with points and no dot was an exclusion. ${colourClause(
    'Dots are coloured for each season’s final team',
    source,
    hollow,
    'dot',
    'no season on this record has one',
  )}`

/** The season-so-far chart's note: 50 words at the longest. A season is one year, so it draws liveries or national colours, never both. */
export const thisSeasonFigureNote = (toCome, source, hollow) =>
  `Finishing position by round, P1 at the top, a win ringed. No dot: not classified or not entered.${
    toCome ? ' The space at the right is rounds to come.' : ''
  } ${colourClause('Dots are coloured for that weekend’s team', source, hollow, 'dot', 'no round on this record has one')}`

export const thisSeasonHeading = (rows) => `${rows[0]?.season}, round by round`

/** The rounds run, which are the table's rows: a round still to come has no result to state. */
export const roundsRun = (rows) => rows.filter((row) => row.status === 'completed')

/**
 * The season being run, as one tile at the end of the career strip (PD-59).
 *
 * PD-49 opened a current driver's page on the season, with the career under
 * a heading of its own below it, and that put the career totals a searcher
 * came for below the first screen on the most visited driver pages - y =
 * 999 at 1440 and 1,131 at 400. The strip is straight under the lede again,
 * as on every other driver's page, and the season keeps a place in it: where
 * the drivers' championship has this driver, and on how many points. The
 * section with a dot per round follows the career chart.
 *
 * The figures are the standings' own row for the season, as thisSeasonNote()
 * reads them, never the rounds added up: the championship counts the Sprint
 * races as well. A driver the standings do not place gets no tile rather
 * than an em dash, since nothing is missing - the section below says what
 * there is. "So far" on the same test as the section's heading.
 */
export const seasonTile = (rows, standings) => {
  if (!rows.length) return null
  const season = rows[0].season
  const standing = standings.find((row) => row.year === season)
  if (!standing || missing(standing.position)) return null
  const running = rows.some((row) => row.status !== 'completed')
  const rounds = new Set(rows.map((row) => row.round)).size
  const ran = new Set(roundsRun(rows).map((row) => row.round)).size
  const total = missing(standing.points) ? null : `${points(standing.points)} ${standing.points === 1 ? 'point' : 'points'}`
  const note = [total, running ? `${number(ran)} of ${plural(rounds, 'round')} run` : null].filter(Boolean).join(', ')
  // P3, not 3rd: the strip's other positions - Best finish, Best grid - are
  // P-numbers, and one strip reads one form (CD-51).
  return {
    label: running ? `${season} so far` : String(season),
    value: `P${standing.position}`,
    note: note || undefined,
  }
}

/**
 * A round the driver was not entered for is a fact about the round, not a
 * missing result, so it says so in words rather than drawing the em dash
 * that means nobody has established the figure; its other cells are blank.
 */
export const NOT_ENTERED = 'not entered'
const entered = (row) => !missing(row.entry_id)
const ifEntered = (format) => (value, row) => (entered(row) ? format(value, row) : '')

export const THIS_SEASON_COLUMNS = [
  { key: 'round', label: 'Round', align: 'num', text: (round) => String(round) },
  { key: 'name_used', rowHeader: true, label: 'Grand Prix' },
  { key: 'constructor', label: 'Constructor', text: ifEntered((value) => text(value)) },
  { key: 'grid_text', label: 'Grid', align: 'num', text: ifEntered((value) => text(value)) },
  {
    key: 'position_text',
    label: 'Result',
    align: 'num',
    text: (_, row) => (entered(row) ? result(row) : NOT_ENTERED),
    glossary: 'results',
  },
  { key: 'points', label: 'Points', align: 'num', text: ifEntered((value) => points(value)) },
]

/**
 * The line under the heading, where the strip has no tile for the season
 * (CD-51). The tile says where the championship has the driver and how much
 * of the season is run, and this line said it again 100 px below, so it is
 * drawn only for a driver the standings do not place - where seasonTile()
 * returns null, and the section would otherwise be the only place that says
 * who the driver is driving for and how far the season has gone.
 */
export const thisSeasonLine = (rows, standings) =>
  seasonTile(rows, standings) ? null : thisSeasonNote(rows, standings.find((row) => row.year === rows[0]?.season) ?? null)

/**
 * The sentence itself: where the drivers' championship has this driver, for
 * whom, and how much of the season that is.
 *
 * The position and the total are the standings' own row for the season -
 * v_standings_final, which the championship chart below already reads -
 * and never the rounds added up: the table counts each Grand Prix's points,
 * and the championship counts the Sprint races as well.
 */
export const thisSeasonNote = (rows, standing) => {
  const rounds = new Set(rows.map((row) => row.round)).size
  const run = roundsRun(rows)
  const ran = new Set(run.map((row) => row.round)).size
  const started = new Set(run.filter(entered).map((row) => row.round)).size
  const teams = [...new Set(rows.map((row) => row.constructor).filter(Boolean))]
  const total = missing(standing?.points) ? null : `${points(standing.points)} ${standing.points === 1 ? 'point' : 'points'}`
  const place = !standing
    ? null
    : !missing(standing.position)
      ? `${ordinal(standing.position)} in the drivers' championship${total ? ` on ${total}` : ''}`
      : total
        ? `${total} in the drivers' championship`
        : null
  const how = ran === rounds ? `with all ${plural(rounds, 'round')} run` : `with ${number(ran)} of the ${plural(rounds, 'round')} run`
  const who = teams.length ? `driving for ${constructorList(teams)}` : null
  const head = [place, who, how].filter(Boolean).join(', ')
  const sentence = `${head.charAt(0).toUpperCase()}${head.slice(1)}.`
  return started < ran ? `${sentence} Entered for ${number(started)} of those ${number(ran)}.` : sentence
}

/**
 * Said under the table only where it is needed: where the championship
 * total above is not what the table's points add up to. The two differ by
 * the Sprint races in a season that ran any, and the sentence names them
 * only then; anything else is the standings' own figure, and says no more.
 */
export const thisSeasonFooter = (rows, standing) => {
  // Over the entries that carry a figure: a round whose points nobody has
  // recorded adds nothing rather than being read as a zero.
  const scored = roundsRun(rows)
    .filter((row) => entered(row) && !missing(row.points))
    .reduce((sum, row) => sum + row.points, 0)
  if (!standing || missing(standing.points) || Math.abs(standing.points - scored) < 0.01) return null
  const why = roundsRun(rows).some((row) => row.sprint)
    ? "the championship total above is the drivers' table's, which counts the Sprint races as well"
    : "the championship total above is the drivers' table's own"
  return `Points here are each Grand Prix's own, ${points(scored)} between them; ${why}.`
}

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
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'teams', label: 'Constructor', align: 'prose' },
  { key: 'entries', label: 'Entries', align: 'num' },
  // Counted from the race records, so a 0 is a true zero and a column of them
  // is a career fact worth stating once rather than a column worth scrolling
  // (VD-29). Not `teams`, `entries`, `championship_text` or `points`: the
  // first carries a livery mark the app draws itself, and an em dash on the
  // others is a season classified nowhere rather than a nought.
  { key: 'wins', label: 'Wins', align: 'num', collapse: true },
  { key: 'podiums', label: 'Podiums', align: 'num', collapse: true },
  { key: 'poles', label: 'Poles', align: 'num', collapse: true },
  { key: 'fastest_laps', label: 'FL', align: 'num', collapse: true },
  { key: 'best', label: 'Best', align: 'num', text: (value) => (missing(value) ? EMPTY : `P${value}`) },
  {
    key: 'championship_text',
    label: 'Championship',
    align: 'num',
    text: (value, row) => text(value ?? row.championship),
    glossary: 'results',
  },
  { key: 'points', label: 'Points scored', align: 'num', text: (value) => points(value) },
]

export const SEASONS_FOOTER =
  '“Points scored” adds up every point from the races. The championship column is where the season ' +
  'actually finished, which before 1991 could be lower once dropped scores were applied. Open a season ' +
  'for its full table.'

/**
 * TEAM-MATES, SEASON BY SEASON (PD-43).
 *
 * The comparison fans actually make is with the one driver in the same car,
 * and it is exactly computable here: two entries in the same race for the
 * same constructor. One row per season, constructor and team-mate, so a
 * driver who changed teams mid-season, or a 1950s team that ran four cars,
 * gets a row for each pairing rather than one row averaging over them.
 *
 *   qualifying  who had the better qualifying position, over the races where
 *               both have one - `qualifying` holds a position for 26,882
 *               of the 27,504 entries, and a race where either lacks one
 *               is counted on neither side;
 *   race        who finished ahead, over the races BOTH were classified in.
 *               A retirement is not a defeat by the team-mate: the car
 *               failing is not the other driver beating you, so a race with
 *               a DNF, a DNS or a DNQ on either side counts for neither. A
 *               shared drive puts two drivers on one car's result, which is
 *               a tie and also counts for neither;
 *   points      each driver's own, from the Grands Prix they ran together.
 *               Every point scored, before any dropped score, and no Sprint
 *               points: race_entries holds each Grand Prix's.
 *
 * TOTAL rather than SUM: a group always has at least one row, and TOTAL of
 * comparisons that are all NULL is 0.0 where SUM's is NULL - and here nothing
 * comparable IS none ahead. both_qualified carries the denominator, so the
 * column can tell "0-0 of 0" (nothing established) from a real 0-0.
 *
 * ?2 narrows to one team-mate, for /compare; NULL keeps every one.
 *
 * WHAT A CONSTRUCTOR IS NOT. It is the make of the car, not the team that
 * entered it, and before the 1980s a constructor's cars were routinely
 * entered by private teams as well as its own: season_entrants names fifteen
 * entrants of Coopers in 1959, and 91 of Jack Brabham's 176 pairings are in
 * one. The record holds no per-race entrant, so the pairing cannot be
 * narrowed to a garage; the footer says so rather than the query guessing.
 */
export const TEAM_MATES = `
  SELECT r.year, e.constructor_id, k.name AS constructor, k.country AS constructor_country,
         o.driver_id AS mate_id, d.full_name AS mate,
         COUNT(*) AS races,
         CAST(TOTAL(qa.position IS NOT NULL AND qb.position IS NOT NULL) AS INTEGER) AS both_qualified,
         CAST(TOTAL(qa.position < qb.position) AS INTEGER) AS qualified_ahead,
         CAST(TOTAL(qa.position > qb.position) AS INTEGER) AS qualified_behind,
         CAST(TOTAL(e.finish_position IS NOT NULL AND o.finish_position IS NOT NULL) AS INTEGER) AS both_classified,
         CAST(TOTAL(e.finish_position < o.finish_position) AS INTEGER) AS finished_ahead,
         CAST(TOTAL(e.finish_position > o.finish_position) AS INTEGER) AS finished_behind,
         TOTAL(e.points) AS points,
         TOTAL(o.points) AS mate_points
    FROM race_entries e
    JOIN race_entries o ON o.race_id = e.race_id AND o.constructor_id = e.constructor_id
                       AND o.driver_id <> e.driver_id
    JOIN races r ON r.id = e.race_id
    JOIN constructors k ON k.id = e.constructor_id
    JOIN drivers d ON d.id = o.driver_id
    LEFT JOIN qualifying qa ON qa.race_id = e.race_id AND qa.driver_id = e.driver_id
    LEFT JOIN qualifying qb ON qb.race_id = e.race_id AND qb.driver_id = o.driver_id
   WHERE e.driver_id = ?1 AND (?2 IS NULL OR o.driver_id = ?2)
   GROUP BY r.year, e.constructor_id, o.driver_id
   ORDER BY r.year DESC, k.name, races DESC, d.full_name
`

/** "14–2": this driver's figure first. Both are counts, so neither is ever NULL. */
export const versus = (mine, theirs) => `${number(mine)}–${number(theirs)}`

/**
 * The three comparison columns, shared by a driver's Team-mates table and the
 * pair's table on /compare. Qualifying is an em dash only where no race of the
 * row has a qualifying position for both - not established - and never 0–0.
 */
const HEAD_TO_HEAD_COLUMNS = [
  { key: 'races', label: 'Races', align: 'num' },
  {
    key: 'qualified_ahead',
    label: 'Qualifying',
    align: 'num',
    text: (ahead, row) => (row.both_qualified ? versus(ahead, row.qualified_behind) : EMPTY),
  },
  // "none" where no race of the row had both classified: a true fact, and
  // not the em dash, but not a 0–0 either, which would read as races run
  // level. A tie on a shared car is in both_classified and on neither side.
  {
    key: 'finished_ahead',
    label: 'Race',
    align: 'num',
    text: (ahead, row) => (row.both_classified ? versus(ahead, row.finished_behind) : 'none'),
  },
  {
    key: 'points',
    label: 'Points',
    align: 'num',
    text: (mine, row) => `${points(mine)}–${points(row.mate_points)}`,
  },
]

/** The season and the team-mate name the row: a pairing is both. */
export const TEAM_MATE_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'mate', rowHeader: true, label: 'Team-mate' },
  { key: 'constructor', label: 'Constructor' },
  ...HEAD_TO_HEAD_COLUMNS,
]

/** On /compare the team-mate is the page's second driver on every row, so the season and team name it. */
export const PAIR_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'constructor', rowHeader: true, label: 'Constructor' },
  ...HEAD_TO_HEAD_COLUMNS,
]

/**
 * The section's count: how many different drivers the rows pair this one
 * with, and how many rows that is. A row is a team-mate in a season, so
 * Fangio's 46 team-mates are 74 rows, and the fold under the table counts
 * those (CD-52): the heading names both, in the fold's own words, so the
 * two figures can be squared.
 */
export const teamMateCount = (rows) =>
  `${plural(new Set(rows.map((row) => row.mate_id)).size, 'team-mate')}, ${plural(rows.length, 'team-mate season', FOLD_NOUN.teamMates)}`

/**
 * Under the table, in both renderers. It says what each figure counts, what
 * a constructor is not, and - as the critique asked - declines the verdict
 * the table invites.
 */
export const teamMatesFooter = (name) =>
  `A team-mate is anyone entered for the same constructor in the same Grand Prix, and each pair of figures is ${name}’s first. ` +
  'Races counts every Grand Prix both were entered for, started or not. Qualifying counts the races both have a qualifying ' +
  'position in; Race only those both were classified in, so a retirement on either side counts for neither, and reads none ' +
  'where there was no such race; Points are each ' +
  'driver’s own from those Grands Prix, before any dropped scores and without Sprint points. Before the 1980s a constructor’s ' +
  'cars were often entered by private teams as well as its own, so a pairing then can be two drivers who never shared a garage. ' +
  'The figures say who was ahead, not who was better.'

/** "Every entry": one row per race the driver was entered for, latest first. */
export const ENTRY_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', rowHeader: true, label: 'Grand Prix' },
  { key: 'constructor', label: 'Constructor' },
  { key: 'chassis', label: 'Chassis', text: (name, row) => text(name ?? row.chassis_id) },
  { key: 'grid_text', label: 'Grid', align: 'num' },
  { key: 'position_text', label: 'Result', align: 'num', text: (_, row) => result(row), glossary: 'results' },
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
      label: LABELS.seasons,
      value: span(driver.first_season, driver.last_season),
      note: seasonsNote(driver, derived),
    },
    { label: LABELS.entries, value: number(entries) },
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

/**
 * Which figures lead the strip (VD-28).
 *
 * It lived in Driver.jsx while emphasis was the app's alone and the static
 * page drew the same list as a key/value table with no ranks to give. The
 * static page draws the tiles now (VD-01), so a lead decided in a React page
 * would be a lead on one half of the site and not the other — which is the
 * divergence this module exists to prevent. It is still presentation, and it
 * is still only ever a flag ON what strip() returned.
 *
 * Wins and titles are what a reader came for, and they are the two the
 * critique named. WHICH figures a strip carries at all is PD-15 (#147),
 * settled above, and still not decided here: this ranks whatever the strip
 * returns, and a lead tile that is not present is simply not led.
 *
 * A ZERO NEVER LEADS, and PD-15 did not retire the rule. It dropped the four
 * results figures from the 625 pages where all four were zero, so the
 * privateer's page no longer offers a "Wins" 0 to lead with at all. It left
 * 237 strips that keep them because one of the four is non-zero, and on 121
 * of those Wins is still 0 - a driver with podiums and no win. Leading that
 * would set the one figure the driver does not have at twice the size of the
 * ones he does, which is emphasis pointing at an absence, so the test below
 * still runs on every tile. `number()` groups thousands, so it looks for a
 * digit that is not a zero rather than for the string '0'; and it fails safe
 * for everything else that could arrive here - an em dash carries no digit,
 * and a value that was somehow an element stringifies to none either, so
 * neither leads.
 */
const LEAD_FIGURES = new Set(['Wins', 'Titles'])

const worthLeading = (item) => LEAD_FIGURES.has(item.label) && /[1-9]/.test(String(item.value))

export const leading = (items) =>
  items.map((item) => (worthLeading(item) ? { ...item, lead: true } : item))

/**
 * The strip both renderers draw under the lede: strip() with its leads, then
 * the season being run where the driver has one (PD-59). `rows` is
 * THIS_SEASON's, `standings` STANDINGS'; a driver of another season has no
 * rows and so no season tile.
 */
export const careerStrip = (driver, derived, rows, standings) =>
  [...leading(strip(driver, derived)), seasonTile(rows, standings)].filter(Boolean)

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
  // A DATE OF DEATH A LIVING DRIVER DOES NOT HAVE IS NOT A MISSING FACT
  // (CD-37). `status` is the register's own word and two of its values say
  // the driver is alive: 310 of the 862 pages carried `Died —` directly above
  // `Status active` or `Status retired`, which is the em-dash convention -
  // the site's loudest claim about its own honesty - asserting the opposite
  // of the row beneath it. A `deceased` row keeps the dash, because 10 of the
  // 441 are a death whose date nobody has established and that is exactly
  // what it means; so does a blank status, where nothing is established
  // either way.
  //
  // A practice-only driver (LV-03) has no status, because a status describes
  // a racing career, but is not "nothing established": the row is F1DB's,
  // F1DB's register carries a death where there is one, and build.py already
  // reads its absence as alive for every racing driver it admits. So the
  // same reading holds here, and the Status row says what the driver is.
  const practiceOnly = driver.practice_only === 1 && !driver.status
  const living = driver.status === 'active' || driver.status === 'retired' || (practiceOnly && !driver.died)
  return [
    ['Born', text(driver.born)],
    ...(living ? [] : [['Died', text(driver.died)]]),
    ['Nationality', text(driver.nationality)],
    ['Status', practiceOnly ? 'practice only' : text(driver.status)],
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
    // AND ONLY WHERE THERE IS A PUBLISHED FIGURE (CD-37). The register holds
    // an entry count for 38 drivers and a start count for 31; on the other
    // 824 and 831 pages the row said that nobody had established a number
    // the strip above states, counted, in the same words minus the label.
    // ENTRIES_NOTE already says these are "kept for the few drivers who have
    // one", so a page without one has nothing to explain.
    ...(missing(driver.entries) ? [] : [['Entries (published)', number(driver.entries)]]),
    ...(missing(driver.starts) ? [] : [['Starts (published)', number(driver.starts)]]),
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
 * empty lede rather than falling through to the sentence. The trimmed string
 * is what is returned as well as what is tested: deciding on one string and
 * showing another is how the two would come to disagree.
 */
export const lede = (driver, derived, constructors, practice = []) => {
  const written = driver.notes == null ? '' : String(driver.notes).trim()
  if (written) return written
  return driver.practice_only === 1 ? practiceSentence(practice) : careerSentence(derived, constructors, driver.titles)
}

/*
 * The Friday drivers (LV-03): in the register, and never in a race. Their
 * whole record is the practice sheets, so their page opens on those and
 * says, before anything else, that there is no race record to look for.
 * `practice_only` is derived by the build - no race entry, no qualifying row,
 * and at least one practice or sprint qualifying row - and verify.py holds it
 * both ways.
 */
export const DRIVER_PRACTICE = `
  SELECT p.id, p.session, p.position, p.position_text, p.time, p.laps,
         r.year, r.round, r.name_used, p.constructor_id, k.name AS constructor
    FROM practice p
    JOIN races r ON r.id = p.race_id
    LEFT JOIN constructors k ON k.id = p.constructor_id
   WHERE p.driver_id = ?
   ORDER BY r.year DESC, r.round DESC,
            CASE p.session WHEN 'pre_qualifying' THEN 0 WHEN 'fp1' THEN 1 WHEN 'fp2' THEN 2
                           WHEN 'fp3' THEN 3 WHEN 'fp4' THEN 4 WHEN 'warm_up' THEN 5 END
`

const SESSION_NAMES = Object.fromEntries(PRACTICE_SESSIONS)

export const PRACTICE_ONLY_NOTICE = {
  head: 'Practice only.',
  body: 'There is no race record to find here — the sessions below are the whole of it.',
}

/**
 * The opening sentence for a practice-only driver, from their sessions, as
 * careerSentence() is from the races - where nobody has written who they
 * were. Every Friday driver has a sourced note since LV-08, so this is the
 * fallback for one a later refresh admits before a line is written.
 */
export const practiceSentence = (sessions) => {
  if (!sessions.length) return 'Never started a championship Grand Prix.'
  const years = sessions.map((r) => r.year)
  const first = Math.min(...years)
  const last = Math.max(...years)
  const when = first === last ? `in ${first}` : `across ${first}–${last}`
  const teams = [...new Set(sessions.map((r) => r.constructor).filter(Boolean))]
  const who = teams.length ? ` for ${constructorList(teams)}` : ''
  return `Drove in ${plural(sessions.length, 'practice session')} ${when}${who}, and never started a championship Grand Prix.`
}

export const practiceCount = (sessions) => plural(sessions.length, 'session')

export const PRACTICE_SESSION_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', rowHeader: true, label: 'Grand Prix' },
  { key: 'session', label: 'Session', text: (value) => text(SESSION_NAMES[value] ?? value) },
  { key: 'constructor', label: 'Constructor' },
  { key: 'position_text', label: 'Pos', align: 'num', glossary: 'results' },
  { key: 'time', label: 'Best lap', align: 'num' },
  { key: 'laps', label: 'Laps', align: 'num' },
]
