/**
 * The home page, as data both renderers read.
 *
 * WHY THIS FILE EXISTS
 *     The app's `/` and the prerendered `/` were two different pages about
 *     the same database (PD-40). The static half was headed "Formula One,
 *     1950-2027, with its sources attached", carried 1,974 characters, a
 *     key/value list and the last ten champions, and its newest fact was the
 *     2025 champion. The app replaced it with a different headline, a strip
 *     of tiles, the season at both ends and 3,874 characters. Every crawler,
 *     every answer engine and every cold visitor read the weaker of the two.
 *
 *     Home.jsx wrote its blocks inline in JSX, which is the drift VD-49 is
 *     about: scripts/prerender.js cannot read JSX, so it had no choice but
 *     to re-implement the page and then diverge from it. The fix is the one
 *     queries/driver.js already made for the driver strip - the list lives
 *     here as data, and the page and the script each draw it.
 *
 * WHAT IS HERE AND WHAT IS NOT
 *     The queries, the figures, the headings and every sentence. The markup
 *     is each renderer's own: a link is a <Link> in one and an <a> in the
 *     other, and there is no shape that is both. Prose that surrounds a link
 *     is split around it, as UNCHECKED_NOTE and ABOUT_REPOSITORY already are
 *     in lib/site.js, so the words are still decided once.
 */
import { number } from '../lib/format.js'
import { NOT_YET_RUN } from '../lib/site.js'

/** The counts the opening strip and the board are built from. */
export const SHAPE = `
  SELECT
    (SELECT COUNT(*) FROM races WHERE status = 'completed') AS races_run,
    (SELECT COUNT(*) FROM races WHERE status = 'scheduled') AS races_scheduled,
    (SELECT COUNT(*) FROM race_entries)   AS entries,
    (SELECT COUNT(*) FROM qualifying)     AS qualifying,
    (SELECT COUNT(*) FROM standings)      AS standings,
    (SELECT COUNT(*) FROM pit_stops)      AS pit_stops,
    (SELECT COUNT(*) FROM drivers)        AS drivers,
    (SELECT COUNT(*) FROM constructors)   AS constructors,
    (SELECT COUNT(*) FROM chassis)        AS chassis,
    (SELECT COUNT(*) FROM circuits)       AS circuits,
    (SELECT COUNT(*) FROM seasons)        AS seasons,
    (SELECT COUNT(*) FROM article_images WHERE route = 'article') AS images,
    (SELECT COUNT(*) FROM discrepancies)  AS discrepancies,
    (SELECT COUNT(*) FROM v_open_gaps)    AS gaps,
    (SELECT COUNT(*) FROM circuit_geometry) AS geometry,
    (SELECT MIN(year) FROM races)         AS from_year,
    (SELECT MAX(year) FROM races)         AS to_year
`

/**
 * The column chart, and the sentence under it. `run` comes back beside the
 * count because a season whose rounds have all still to be run is a calendar
 * rather than a set of results, and the note has to name which ones those
 * are - from the rows, never from arithmetic on the current year.
 */
export const PER_SEASON = `
  SELECT year, COUNT(*) AS rounds, SUM(status = 'completed') AS run
    FROM races GROUP BY year ORDER BY year
`

/**
 * The next round OF THE SEASON BEING RUN, and, where that season has none
 * left, the next season the register holds a calendar for.
 *
 * Not the next round anywhere: the panel sits inside a section headed "The
 * 2026 season", and `meta.current_season` does not move to the following
 * year until F1DB publishes its entry lists - so between a finale and
 * pre-season "the next round anywhere" is next year's opener, drawn under
 * this year's heading. A block that names a season answers about that
 * season, and hands the reader on to the next one by name when it is over.
 */
export const NEXT = `
  WITH now AS (SELECT CAST(value AS INTEGER) AS year FROM meta WHERE key = 'current_season')
  SELECT r.year, r.round, r.name_used, r.dates
    FROM races r, now n
   WHERE r.status = 'scheduled' AND r.year = n.year
   ORDER BY r.round LIMIT 1
`

export const NEXT_SEASON = `
  WITH now AS (SELECT CAST(value AS INTEGER) AS year FROM meta WHERE key = 'current_season')
  SELECT MIN(r.year) AS year FROM races r, now n
   WHERE r.status = 'scheduled' AND r.year > n.year
`

/**
 * The season being run, counted (PD-48).
 *
 * Anchored on `meta.current_season`, as lib/season.js sets out and as the
 * four registers' "On the 2026 grid" filter already is - never MAX(year),
 * which names next season's announced calendar for the whole of a winter.
 *
 * `season_entries` is the entry list as declared, so the seat count is the
 * same set /drivers filters on and the same one /seasons/<year> heads its
 * grid table with; a reserve is a row there and is counted here only under
 * `race`, because "24 drivers" on a home page means the race seats.
 *
 * The teams are counted over the same `race` rows and not over every row, so
 * the two figures in the tile describe one set: a team that declared only a
 * reserve would otherwise be a team with no driver in the count beside it.
 */
export const SEASON_NOW = `
  WITH now AS (SELECT CAST(value AS INTEGER) AS year FROM meta WHERE key = 'current_season')
  SELECT n.year AS year,
         (SELECT COUNT(*) FROM races r WHERE r.year = n.year)                          AS rounds,
         (SELECT COUNT(*) FROM races r WHERE r.year = n.year AND r.status = 'completed') AS run,
         (SELECT COUNT(*) FROM season_entries e WHERE e.year = n.year AND e.role = 'race') AS seats,
         (SELECT COUNT(DISTINCT e.constructor_id) FROM season_entries e
           WHERE e.year = n.year AND e.role = 'race' AND e.constructor_id IS NOT NULL) AS teams,
         (SELECT s.drivers_champion FROM seasons s WHERE s.year = n.year)              AS champion
    FROM now n
`

/**
 * Who leads it, from the same view the season page's own table reads, so the
 * home page cannot name a different leader from the page it links to. Two
 * rows, because the gap is the second thing a reader wants and it is not a
 * fact about either row on its own. A position nobody established is not a
 * lead, so the rows without one are left out.
 */
export const SEASON_LEAD = `
  WITH now AS (SELECT CAST(value AS INTEGER) AS year FROM meta WHERE key = 'current_season')
  SELECT f.entity, f.entity_id, f.team, f.points
    FROM v_standings_final f, now n
   WHERE f.year = n.year AND f.table_type = 'drivers' AND f.position IS NOT NULL
   ORDER BY f.position LIMIT 2
`

/**
 * The standfirst: the app's, which says what the site is, what is in it and
 * where the reading happens. The static half's said the same things in
 * fewer of them.
 */
export const LEDE =
  'Seventy-seven seasons of results, grids, championship tables and pit stops — from ' +
  'Silverstone in May 1950 to the calendar still to be run. Search it, sort it, or write your own ' +
  'SQL. It all runs in this tab, so it is quick and nothing you look at is sent anywhere.'

/** The opening strip, as components/Page.jsx's <Stats> and prerender's stats() draw it. */
export const strip = (shape) => [
  { label: 'Races run', value: number(shape.races_run), note: `${shape.from_year}–${shape.to_year}` },
  { label: 'Race entries', value: number(shape.entries), note: 'one row per driver per race' },
  { label: 'Qualifying rows', value: number(shape.qualifying) },
  { label: 'Standings rows', value: number(shape.standings), note: 'after every round' },
  { label: 'Pit stops', value: number(shape.pit_stops), note: 'from 1994' },
  { label: 'Photographs', value: number(shape.images), note: 'referenced, not stored' },
]

export const seasonHeading = (year) => `The ${year} season`

/**
 * What is happening this season, in three figures (PD-48).
 *
 * The home page is where a reader arrives first and it named none of it: the
 * season page opens on who is in the cars and the registers all filter on
 * this year, and `/` said only what the whole database holds.
 *
 * A season with no round run yet gets the rounds tile as NOT_YET_RUN rather
 * than as "0 of 24" - a calendar is not a record of nothing, which is the
 * same distinction IA-17 draws on /seasons - and no leader, because there
 * is nobody leading.
 */
export const seasonStrip = (now, lead) => {
  if (!now) return []
  const [first, second] = lead ?? []
  // COUNT(*) over the rounds, so never NULL: a season with no round run
  // counts 0, and 0 is the answer rather than a missing one.
  const started = now.run > 0
  const gap = first && second ? first.points - second.points : null
  return [
    {
      label: 'Rounds run',
      value: started ? `${number(now.run)} of ${number(now.rounds)}` : NOT_YET_RUN,
      note: started ? null : `${number(now.rounds)} on the calendar`,
      lead: true,
    },
    started && first
      ? {
          // "Leading" only while there is something to lead: once the season
          // has a champion on the record, the same row is the champion, and
          // a tile still calling them the leader would restate as open a
          // question the season page next door has settled.
          label: now.champion ? 'Champion' : 'Leading the championship',
          value: first.entity,
          kind: 'name',
          note: leadNote(first, gap),
          lead: true,
        }
      : null,
    { label: 'On the grid', value: number(now.seats), note: `${number(now.teams)} teams` },
  ].filter(Boolean)
}

/** "312 points, 24 clear" — and never "0 clear", which is level. */
const leadNote = (first, gap) => {
  const points = `${number(first.points)} points`
  if (gap === null || gap === undefined) return points
  return gap > 0 ? `${points}, ${number(gap)} clear` : `${points}, level at the top`
}

export const seasonLink = (year) => `Open the ${year} season — the grid, the calendar and the standings →`

export const LAST_RACE = 'Last race run'
export const seasonComplete = (year) => `Every round of the ${year} season has been run.`
export const NEXT_RACE = 'Next on the calendar'
export const CLASSIFICATION_LINK = 'See the full classification →'
export const NOTHING_SCHEDULED = 'Nothing scheduled beyond the last recorded race.'
export const calendarLink = (year) => `Open the ${year} calendar →`
/**
 * How much of THIS season is still to come. It used to count every scheduled
 * round in the register, which is this season's remainder plus the whole of
 * next season's announced calendar - true of the database, and read as a
 * claim about the season the heading above it names.
 */
export const stillToRunNote = (now) =>
  `${number(now.rounds - now.run)} rounds of the ${now.year} season are still to run, so they carry no result.`

/** "Won by Lando Norris for McLaren." — split around the two links in it. */
export const WON_BY = 'Won by '
export const WON_FOR = ' for '
export const UNRECORDED_WINNER = 'an unrecorded driver'

export const BOARD_HEADING = 'Where to start'
export const BOARD_NOTE =
  'Or press / from anywhere to jump straight to a driver, team, circuit, car, season or race.'

/**
 * The eight doors out of the home page. `count` names the figure from SHAPE
 * that belongs beside the label, where one does: /records and /data are not
 * registers of a countable thing.
 */
export const BOARD = [
  { to: '/seasons', label: 'Seasons', count: 'seasons', blurb: 'Championship tables, calendars and entry lists, year by year.' },
  { to: '/races', label: 'Races', count: 'races_run', blurb: 'Every classification: grid, finish, status, laps and points.' },
  { to: '/drivers', label: 'Drivers', count: 'drivers', blurb: 'Look up a career — every entry, season by season.' },
  { to: '/constructors', label: 'Constructors', count: 'constructors', blurb: 'Team records, the cars they built, and who they became.' },
  { to: '/circuits', label: 'Circuits', count: 'circuits', blurb: 'Venues, the layouts as they changed, and 25 traced laps.' },
  { to: '/cars', label: 'Cars', count: 'chassis', blurb: 'The chassis register, with specifications where they exist.' },
  { to: '/records', label: 'Records', count: null, blurb: 'Leaderboards, champions, grand slams and who won each decade.' },
  { to: '/data', label: 'Data', count: null, blurb: 'The database itself: download it, query it, and see how far to trust it.' },
]

export const CHART_HEADING = 'The shape of the championship'
export const CHART_TITLE = 'Championship races per season'

/** "2026 and 2027", "2026, 2027 and 2028", "2027". */
const years = (list) =>
  list.length < 2 ? String(list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`

export const chartNote = (seasons) => {
  const raced = [...seasons].reverse().find((s) => s.run)
  const calendars = seasons.filter((s) => !s.run).map((s) => s.year)
  const grown = seasons.length && raced ? `${number(seasons[0].rounds)} rounds in ${seasons[0].year}; ${number(raced.rounds)} by ${raced.year}.` : ''
  if (!calendars.length) return grown
  const one = calendars.length === 1
  return `${grown} The ${years(calendars)} column${one ? ' is a calendar' : 's are calendars'}, not ${
    one ? 'a set of results' : 'sets of results'
  }.`
}

export const chartLabel = (shape) =>
  `Number of championship races in each season from ${shape.from_year} to ${shape.to_year}`

export const READING_HEADING = 'Reading the numbers here'
export const READING_NOTE = 'Four things worth knowing before you quote anything off this site.'

/**
 * The four conventions, each as a head and a body, with the body split around
 * its link where it has one. Two of them count rows, so they are a function
 * of the shape rather than a constant.
 */
export const reading = (shape) => [
  {
    head: 'A blank means unknown.',
    body: [
      'An em dash is a figure nobody has established — never a zero, never a plausible guess.',
    ],
  },
  {
    head: 'Disagreements are shown, not settled.',
    body: ['Where two sources conflict you see both. There are ', '.'],
    link: { to: '/data/quality', text: `${number(shape.discrepancies)} on record` },
  },
  {
    head: 'Every row says how solid it is.',
    body: [
      'Verified, high, reference, medium or unverified — only an official source reaches the top. ' +
        'Photographs have a sixth rung below those.',
    ],
  },
  {
    head: 'The gaps are published too.',
    body: ['', ' — what is missing, why, and what would close it.'],
    link: { to: '/data/quality', text: `${number(shape.gaps)} open gaps` },
  },
]
