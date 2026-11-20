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
import { inWords, number, raceDates } from '../lib/format.js'
import { CURRENT_SEASON_SQL } from '../lib/season.js'
import { LABELS, NOT_YET_RUN } from '../lib/site.js'
import { ON_A_CAR_PAGE } from './car.js'
import { STARTS } from './circuit.js'
import { DRIVER_TEAMS } from './season.js'
import { raceStage } from './sessions.js'

/** The counts the opening strip and the board are built from. */
export const SHAPE = `
  SELECT
    (SELECT COUNT(*) FROM races WHERE status = 'completed') AS races_run,
    (SELECT COUNT(*) FROM races WHERE status = 'scheduled') AS races_scheduled,
    (SELECT COUNT(*) FROM race_entries)   AS entries,
    (SELECT COUNT(*) FROM qualifying)     AS qualifying,
    (SELECT COUNT(*) FROM standings)      AS standings,
    (SELECT COUNT(*) FROM pit_stops)      AS pit_stops,
    (SELECT COUNT(DISTINCT driver_id) FROM race_entries) AS drivers,
    (SELECT COUNT(*) FROM constructors)   AS constructors,
    (SELECT COUNT(*) FROM chassis)        AS chassis,
    (SELECT COUNT(*) FROM circuits)       AS circuits,
    (SELECT COUNT(*) FROM seasons)        AS seasons,
    (SELECT COUNT(*) FROM article_images WHERE ${ON_A_CAR_PAGE}) AS images,
    (SELECT COUNT(*) FROM discrepancies)  AS discrepancies,
    (SELECT COUNT(*) FROM circuit_geometry) AS geometry,
    (SELECT MIN(year) FROM races)         AS from_year,
    (SELECT MAX(year) FROM races)         AS to_year
`

/**
 * The column chart, and the sentence under it. `run` comes back beside the
 * count because a season whose rounds have all still to be run is a calendar
 * rather than a set of results, and the note has to name which ones those
 * are - from the rows, never from arithmetic on the current year; and a
 * season part run is drawn as what it has run, with the rest dashed
 * (VD-123). `indianapolis` counts the season's Indianapolis 500, a
 * championship round to 1960, which the note and the first season's note
 * say are counted.
 */
export const PER_SEASON = `
  SELECT year, COUNT(*) AS rounds, SUM(status = 'completed') AS run,
         SUM(gp_id = 'indianapolis-500') AS indianapolis
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
  SELECT r.year, r.round, r.name_used, r.date_iso, r.date_from, r.date_to,
         r.circuit_id, c.name AS circuit, r.f1db_layout_id, o.path AS outline
    FROM races r
    JOIN now n ON r.year = n.year
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN circuit_outlines o ON o.f1db_layout_id = r.f1db_layout_id
   WHERE r.status = 'scheduled'
   ORDER BY r.round LIMIT 1
`

/**
 * The dateline's next race (IA-30): the first round still to run, in the
 * season being run or, once that has run every round, the next season with
 * one, ordered as NEXT is, by round. Read off the database, never off a
 * clock, so the static page and the app name the same race.
 */
export const DATELINE_RACE = `
  WITH now AS (SELECT CAST(value AS INTEGER) AS year FROM meta WHERE key = 'current_season')
  SELECT r.year, r.round, r.name_used, r.date_iso, r.date_from, r.date_to
    FROM races r
    JOIN now n ON r.year >= n.year
   WHERE r.status = 'scheduled'
   ORDER BY r.year, r.round LIMIT 1
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
  SELECT f.entity, f.driver_id, f.team, f.points
    FROM v_standings_final f, now n
   WHERE f.year = n.year AND f.table_type = 'drivers' AND f.position IS NOT NULL
   ORDER BY f.position LIMIT 2
`

/**
 * The standfirst: the app's, which says what the site is, what is in it and
 * where the reading happens. The static half's said the same things in
 * fewer of them.
 *
 * Its last clause said "nothing you look at is sent anywhere" until the site
 * began counting arrivals (PD-0, #261). It now claims only what the searching
 * and the SQL are, which is the part of the sentence this page is about and
 * the part that is still true; IN_THIS_TAB carries the whole of it, including
 * what does leave, on /data, where every page's footer links (IA-31).
 */
export const LEDE =
  'Seventy-seven seasons of results, grids, championship tables and pit stops — from ' +
  'Silverstone in May 1950 to the calendar still to be run. Search it, sort it, or write your own ' +
  'SQL. It all runs in this tab, so it is quick, and nothing you search for is sent as you type it.'

/** The opening strip, as components/Page.jsx's <Stats> and prerender's stats() draw it. */
export const strip = (shape) => [
  { label: 'Races run', value: number(shape.races_run), note: `${shape.from_year}–${shape.to_year}` },
  { label: LABELS.entries, value: number(shape.entries), note: 'one row per driver per race' },
  { label: 'Qualifying rows', value: number(shape.qualifying) },
  { label: 'Standings rows', value: number(shape.standings), note: 'after every round' },
  { label: 'Pit stops', value: number(shape.pit_stops), note: 'from 1994' },
  { label: 'Photographs', value: number(shape.images), note: 'of cars, linked from Wikimedia Commons' },
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
export const stillToRunNote = (now) => {
  const left = now.rounds - now.run
  const one = left === 1
  return `${number(left)} round${one ? '' : 's'} of the ${now.year} season ${
    one ? 'is' : 'are'
  } still to run, so ${one ? 'it carries' : 'they carry'} no result.`
}

/**
 * The opening slot (VD-92, DR-06): the outline of one race, with its result
 * or its date, beside the header from 1180 px where the right half of the
 * band used to be empty. Outlines are F1DB's (CC BY 4.0), the same drawings
 * the race and circuit pages lead with, so the ODbL split is untouched.
 *
 * Which race is read off the database, never off a clock, so the static
 * page and the app choose the same one:
 *
 *   - the last race run, with its winner, because the result is what each
 *     round adds, and every race run in the register has a drawing today
 *     (nothing enforces it, so the next rule covers one that has none);
 *   - but the next round of the season being run, with its dates, while
 *     that season has run no round yet - between F1DB moving the current
 *     season on and its opener, last year's finale is not the news;
 *   - and where the one chosen has no drawing (a round F1DB has not yet
 *     given a layout has none), the other; neither, and there is no slot,
 *     and the header keeps the width.
 *
 * `now.run` is a COUNT, so 0 and not NULL in a season with nothing run.
 */
export const openingRace = (latest, next, now) => {
  const last = latest?.outline ? { race: latest, run: true } : null
  const coming = next?.outline ? { race: next, run: false } : null
  if (now && now.run === 0 && coming) return coming
  return last ?? coming
}

/**
 * The slot's caption, in words: "Last race run: the <year> <race>, won by
 * <driver>." or "Next on the calendar: the <year> <race>, <its dates>."
 * `dates` is the race where its dates are
 * held, for each renderer to draw as it draws dates (Dates.jsx's
 * <RaceDates>, prerender's raceDatesHtml) after a comma, and null where
 * they are not, so a missing date drops the clause rather than printing a
 * dash into a sentence. A winner nobody recorded reads as the panel below
 * reads it.
 */
export const openingCaption = ({ race, run }) => {
  const named = `the ${race.year} ${race.name_used}`
  return run
    ? { text: `${LAST_RACE}: ${named}${OPENING_WON}${race.winner ?? UNRECORDED_WINNER}`, dates: null }
    : { text: `${NEXT_RACE}: ${named}`, dates: raceDates(race) ? race : null }
}
const OPENING_WON = ', won by '

/** "Won by Lando Norris for McLaren." — split around the two links in it. */
export const WON_BY = 'Won by '
export const WON_FOR = ' for '
export const UNRECORDED_WINNER = 'an unrecorded driver'

export const BOARD_HEADING = 'Where to start'
// The static page carries this too, where no platform is known, so it names
// both keys rather than guessing (AX-15: a bare `/` no longer opens search).
// In words, not the ⌘ glyph, which some screen readers name as a symbol.
export const BOARD_NOTE =
  'Or press Ctrl K, or Cmd K on a Mac, from anywhere to jump straight to a driver, team, circuit, car, season or race.'

/**
 * The nine doors out of the home page: its one index (VD-93). There were two
 * grids of them, these eight and a band of four under the page, *Popular
 * ways in*; that band's eras door is here now, its records door already
 * was, its SQL console is behind /data, and its latest season is the link
 * under the season block. `count` names the figure from SHAPE that belongs
 * beside the label, where one does: /eras, /records and /data are not
 * registers of a countable thing.
 */
export const BOARD = [
  { to: '/seasons', label: 'Seasons', count: 'seasons', blurb: 'Championship tables, calendars and entry lists, year by year.' },
  { to: '/races', label: 'Races', count: 'races_run', blurb: 'Every classification: grid, finish, status, laps and points.' },
  { to: '/drivers', label: 'Drivers', count: 'drivers', blurb: 'Look up a career — every entry, season by season.' },
  { to: '/constructors', label: 'Constructors', count: 'constructors', blurb: 'Team records, the cars they built, and who they became.' },
  { to: '/circuits', label: 'Circuits', count: 'circuits', blurb: 'Venues, the layouts as they changed, and 25 traced laps.' },
  { to: '/cars', label: 'Cars', count: 'chassis', blurb: 'The chassis register, with specifications where they exist.' },
  { to: '/eras', label: 'Eras and rules', count: null, blurb: 'How the rules changed, and the words they are written in.' },
  { to: '/records', label: 'Records', count: null, blurb: 'Leaderboards, champions, grand slams and who won each decade.' },
  { to: '/data', label: 'Data', count: null, blurb: 'The database itself: download it, query it, and see how far to trust it.' },
]

export const CHART_HEADING = 'The shape of the championship'
/** What the chart plots, under its finding (VD-123). */
export const CHART_KICKER = 'Championship rounds per season'
/**
 * The plot's height, the same at every width so the static drawing holds
 * the app's box (VD-73): room for the markers over the tallest columns as
 * well as the columns.
 */
export const CHART_HEIGHT = 260
/**
 * The numbers behind the chart: each season's rounds, and how many of them
 * have been run, which is the solid column where a season is part run
 * (VD-123), and none in a calendar.
 */
export const CHART_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num', rowHeader: true, text: (year) => String(year) },
  { key: 'rounds', label: 'Rounds', align: 'num' },
  { key: 'run', label: 'Run', align: 'num' },
]

/** "2026 and 2027", "2026, 2027 and 2028", "2027". */
const years = (list) =>
  list.length < 2 ? String(list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/** The seasons the Indianapolis 500 counted in, as a span: "1950–60". */
const indianapolisSpan = (seasons) => {
  const held = seasons.filter((s) => s.indianapolis > 0).map((s) => s.year)
  if (!held.length) return null
  const [from, to] = [held[0], held[held.length - 1]]
  return from === to ? String(from) : `${from}–${String(to).slice(Math.floor(from / 100) === Math.floor(to / 100) ? 2 : 0)}`
}

/**
 * What the chart counts, and which columns are not results (VD-123): the
 * Indianapolis 500 is counted where the register holds it, and a calendar
 * is named as one. The growth it used to state is the finding over the
 * chart now, and the season being run is its fourth note.
 */
export const chartNote = (seasons) => {
  const span = indianapolisSpan(seasons)
  const counted = seasons.length ? `Every championship round${span ? `, the Indianapolis 500 of ${span} included` : ''}.` : ''
  const calendars = seasons.filter((s) => !s.run).map((s) => s.year)
  if (!calendars.length) return counted
  const one = calendars.length === 1
  return `${counted} The ${years(calendars)} column${one ? ' is a calendar' : 's are calendars'}: none of ${
    one ? 'its' : 'their'
  } rounds has been run.`
}

/**
 * The columns (VD-94, VD-123): the last season raced in the accent, the one
 * value the page states, and where it has rounds still to run, drawn as the
 * rounds it has run with the rest of its calendar dashed over them, so
 * the red column is the season so far and not its calendar; a calendar is
 * drawn hollow, because the note says it is not a set of results, and its
 * tooltip says "calendar". No value is printed on the plot: each figure the
 * chart states is a note in its key. Every tenth season is labelled under
 * the axis. The rules read the rows as chartNotes() does, so the picture and
 * the notes cannot name different seasons.
 */
export const chartData = (seasons) => {
  const raced = lastRaced(seasons)
  return seasons.map((s) => {
    const ahead = s.run > 0 ? s.rounds - s.run : 0
    return {
      key: s.year,
      value: ahead > 0 ? s.run : s.rounds,
      ahead,
      label: s.year % 10 === 0 ? s.year : '',
      mark: s === raced,
      hollow: !s.run,
      note: !s.run ? 'calendar' : ahead > 0 ? `${number(ahead)} still to run` : undefined,
    }
  })
}

/** The last season with a round run: the one the accent marks. */
const lastRaced = (seasons) => [...seasons].reverse().find((s) => s.run > 0) ?? null

/**
 * The longest run of consecutive completed seasons whose round counts lie
 * within one of each other - 1984–2003, every one 16 or 17 - the first where
 * two are as long. Null where none runs to five seasons, which is no
 * stretch worth shading.
 */
const steadiest = (complete) => {
  let best = null
  for (let i = 0; i < complete.length; i += 1) {
    let lo = complete[i].rounds
    let hi = lo
    let j = i
    while (j + 1 < complete.length && complete[j + 1].year === complete[j].year + 1) {
      const next = complete[j + 1].rounds
      if (Math.max(hi, next) - Math.min(lo, next) > 1) break
      lo = Math.min(lo, next)
      hi = Math.max(hi, next)
      j += 1
    }
    const length = j - i + 1
    if (length >= 5 && (!best || length > best.length)) best = { from: complete[i].year, to: complete[j].year, lo, hi, length }
  }
  return best
}

/**
 * The years of `list` that run on without a gap to its last one: the
 * columns a tied peak's one marker sits over (2024 and 2025), where a tie
 * not side by side would put a shared disc over some other season.
 */
const lastRun = (list) => {
  const out = [list[list.length - 1]]
  for (let k = list.length - 2; k >= 0 && list[k] === out[0] - 1; k -= 1) out.unshift(list[k])
  return out
}

/**
 * The chart's annotation (VD-123; docs/design-system.md section 3,
 * *Annotation*), every part worked out from the rows:
 *
 * - the finding: the first season's count, and the most any completed
 *   season has run, with the first season to run it;
 * - four notes, each with its marker or band - the first season; the
 *   longest steady stretch, shaded (steadiest()); the most in a completed
 *   season, one marker over the tied seasons where they stand together; and
 *   the season raced last, the accented column, with what it has still to
 *   run where it has any.
 *
 * A note whose subject the rows do not hold is left out, and the markers are
 * numbered in the order they stand on the axis. Where the season raced last
 * is complete and holds the peak, its own note says so, and the peak's note
 * names the seasons before it. Returns { finding, kicker, notes, marks,
 * bands }; with nothing raced, no finding and no notes.
 */
export const chartNotes = (seasons) => {
  const raced = lastRaced(seasons)
  const complete = seasons.filter((s) => s.run > 0 && s.run === s.rounds)
  const first = seasons[0]
  if (!raced || !complete.length || first.run !== first.rounds) return { finding: null, kicker: null, notes: [], marks: [], bands: [] }
  const most = Math.max(...complete.map((s) => s.rounds))
  const tied = complete.filter((s) => s.rounds === most).map((s) => s.year)
  const finding =
    tied[0] === first.year
      ? `${capital(inWords(first.rounds))} races in ${first.year}, never more.`
      : `${capital(inWords(first.rounds))} races in ${first.year}; ${inWords(most)} by ${tied[0]}.`

  const parts = []
  parts.push({
    keys: [first.year],
    lead: `${first.year}: ${inWords(first.rounds)} rounds`,
    text: `The first championship${first.indianapolis > 0 ? ', the Indianapolis 500 included' : ''}.`,
  })
  const steady = steadiest(complete)
  if (steady && steady.from !== first.year) {
    const keys = complete.filter((s) => s.year >= steady.from && s.year <= steady.to).map((s) => s.year)
    parts.push({
      keys,
      leader: false,
      band: { from: steady.from, to: steady.to },
      lead: `${steady.from}–${steady.to}: ${steady.lo === steady.hi ? number(steady.lo) : `${number(steady.lo)} or ${number(steady.hi)}`}, every year`,
      text: `${capital(inWords(steady.length))} seasons in a row within a round of each other, shaded.`,
    })
  }
  const before = tied.filter((year) => year !== raced.year)
  const racedHolds = raced.run === raced.rounds && raced.rounds === most
  // The first season has its own marker, so a peak it shares is marked over
  // the seasons after it, and named with it.
  const marked = before.filter((year) => year !== first.year)
  if (marked.length) {
    parts.push({
      keys: lastRun(marked),
      lead: `${years(before)}: ${number(most)}`,
      text: racedHolds ? `The most in any completed season, matched in ${raced.year}.` : 'The most in any completed season.',
    })
  }
  if (raced !== first) {
    const left = raced.rounds - raced.run
    const calendars = seasons.filter((s) => !s.run).map((s) => s.year)
    const later = calendars.length
      ? ` ${years(calendars)} ${calendars.length === 1 ? 'is a calendar' : 'are calendars'}.`
      : ''
    parts.push({
      keys: [raced.year],
      lead: left > 0 ? `${raced.year}: ${number(raced.run)} of ${number(raced.rounds)} run` : `${raced.year}: ${number(raced.rounds)} rounds`,
      text:
        left > 0
          ? `In red; the ${inWords(left)} to come ${left === 1 ? 'is' : 'are'} dashed above.${later}`
          : `In red, the season run last${racedHolds && !before.length ? ': the most in any season' : ''}.${later}`,
    })
  }
  // In the order they stand on the axis, numbered so.
  parts.sort((a, b) => a.keys[0] - b.keys[0])
  const notes = parts.map((p, i) => ({ n: i + 1, lead: p.lead, text: p.text }))
  const marks = parts.map((p, i) => ({ n: i + 1, keys: p.keys, leader: p.leader !== false }))
  const bands = parts.filter((p) => p.band).map((p) => p.band)
  return { finding, kicker: CHART_KICKER, notes, marks, bands }
}

export const chartLabel = (shape) =>
  `Number of championship races in each season from ${shape.from_year} to ${shape.to_year}`

export const READING_HEADING = 'Reading the numbers here'
export const READING_NOTE =
  "Four conventions that make this site's tables read differently from anyone else's. " +
  'The rest are explained where you meet them.'

/**
 * The four conventions, each as a head and a body, with the body split around
 * its link where it has one. One of them counts rows, so they are a function
 * of the shape rather than a constant. The fourth is a door, not a rule
 * (CD-14): the things most often read as bugs, each explained in place on the
 * page that shows it - the shared drive on the race, the pre-1991 margin under
 * the seasons table, the stored figure beside the counted one on the driver.
 */
export const reading = (shape) => [
  {
    head: 'A blank means unknown.',
    body: [
      'An em dash is a figure nobody has established. Nothing is filled in with a zero or a plausible guess.',
    ],
  },
  {
    head: 'Disagreements and gaps are published as they stand.',
    body: [
      'Where two sources conflict you see both: there are ',
      ', and what is missing is published too, with what would close it.',
    ],
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
    head: 'Some of it looks wrong on purpose.',
    body: [
      'A finishing position that appears twice is a shared drive. A championship margin before 1991 ' +
        'is net of dropped scores. Where a stored figure and a counted one disagree, you get both. ' +
        'Each is explained on the page that shows it.',
    ],
  },
]

/* ------------------------------------------------------------ the season cycle
 *
 * AF-135, part (a): during a season the block under the season's tiles
 * follows the calendar, in three states, worked out from the data and a
 * clock - the reader's in the app, the build's own day in the prerender
 * (scripts/prerender.js's STATIC_NOW), so each half says what is true at
 * its clock and the app corrects the static page the moment it opens.
 *
 *   preview   the last race run and the next round, as the block always
 *             said, with the next circuit's history under them
 *   weekend   from the next round's first session to its result landing:
 *             its sessions with their times; once the race itself is over
 *             and the database does not hold it yet, a line saying so
 *   results   from a result landing until RESULTS_DAYS after its race:
 *             the podium, the title fight's reach chart, and the next round
 *   off       no round of the season being run is still to come: the block
 *             as it was, the last race and the season complete
 */

/** Days after a race's day (`date_iso`, UTC) its podium leads the block. */
export const RESULTS_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

export const CYCLE = { off: 'off', preview: 'preview', weekend: 'weekend', results: 'results' }

/** The sessions of NEXT's round: the next round of the season being run. */
export const NEXT_SESSIONS = `
  SELECT s.kind, s.name, s.start_utc, s.zone
    FROM sessions s
   WHERE s.race_id = (SELECT r.id FROM races r
                       WHERE r.year = ${CURRENT_SEASON_SQL} AND r.status = 'scheduled'
                       ORDER BY r.round LIMIT 1)
   ORDER BY s.start_utc
`

/**
 * Where the block stands at `clock` (milliseconds). `now`, `latest` and
 * `next` are SEASON_NOW's, LATEST's and NEXT's rows, `sessions`
 * NEXT_SESSIONS'. `run` is whether the next round's race is over without
 * its result in the database (sessions.js raceStage(), the race page's own
 * rule), which only the weekend state can be.
 *
 * The weekend opens at the round's first session, or, where it has no
 * timetable, at the start of its first day (`date_from`, read as UTC) or
 * wherever raceStage() says its race has started, whichever is first. A podium
 * leads only for a result of the season being run, so last year's finale
 * is never this year's news.
 */
export function homeCycle({ now, latest, next, sessions = [] }, clock) {
  if (!now || !next) return { state: CYCLE.off, run: false }
  const stage = raceStage(next, sessions, clock)
  const starts = sessions.map((s) => Date.parse(s.start_utc ?? '')).filter(Number.isFinite)
  const from = Date.parse(`${next.date_from ?? ''}T00:00Z`)
  const opened = starts.length > 0 ? clock >= Math.min(...starts) : Number.isFinite(from) && clock >= from
  if (opened || stage !== 'awaited') return { state: CYCLE.weekend, run: stage === 'run' }
  const raced = latest && latest.year === now.year ? Date.parse(`${latest.date_iso ?? ''}T00:00Z`) : Number.NaN
  if (Number.isFinite(raced) && clock < raced + (RESULTS_DAYS + 1) * DAY_MS) return { state: CYCLE.results, run: false }
  return { state: CYCLE.preview, run: false }
}

/**
 * Where the next round's forecast is asked for (AF-143, lib/forecast.js):
 * the point race_weather_modelled holds for its circuit - F1DB's
 * coordinates, and the zone its day is read in - from the latest race
 * there with a modelled day. No row at a circuit none of whose races has
 * one, and then no forecast.
 */
export const FORECAST_POINT = `
  SELECT w.latitude, w.longitude, w.timezone
    FROM race_weather_modelled w
    JOIN races r ON r.id = w.race_id
   WHERE r.circuit_id = (SELECT n.circuit_id FROM races n
                          WHERE n.year = ${CURRENT_SEASON_SQL} AND n.status = 'scheduled'
                          ORDER BY n.round LIMIT 1)
   ORDER BY r.year DESC, r.round DESC LIMIT 1
`

export const THIS_WEEKEND = 'This weekend'

/**
 * The line over the weekend's sessions: the clock they are written on. The
 * static page writes UTC; the app the reader's zone, and UTC where the
 * browser names no other (sessions.js readerZone()).
 */
export const sessionsClock = (zone) => (zone ? `Start times, your time (${zone.replace(/_/g, ' ')}).` : 'Start times, UTC.')

/**
 * The top three of the last race run, for the podium (lib/podium.js's
 * podium(), which declines a place held by two entries or by none, and the
 * block then keeps its sentence).
 */
export const PODIUM = `
  WITH last AS (SELECT id, year FROM races WHERE status = 'completed' ORDER BY year DESC, round DESC LIMIT 1)
  SELECT e.finish_position AS position, e.driver_id, d.full_name AS driver,
         e.constructor_id, k.name AS constructor, k.country AS constructor_country, l.year
    FROM race_entries e
    JOIN last l ON l.id = e.race_id
    LEFT JOIN drivers d ON d.id = e.driver_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE e.finish_position BETWEEN 1 AND 3
   ORDER BY e.finish_position, e.id
`

// The steps themselves are lib/podium.js's, which a race page's slabs stand
// as well (VD-108); home's modules and tests read them from here.
export { PODIUM_LABEL, podium } from '../lib/podium.js'

/** The heading over the reach chart in the results state: which title it is. */
export const reachHeading = (title) => `Who can still win ${title.replace(/^The /, 'the ')}`

/** DRIVER_TEAMS for the season being run: the colour each contender's bar wears. */
export const FIGHT_TEAMS = replaceOnce(DRIVER_TEAMS, 'r.year = ?', `r.year = ${CURRENT_SEASON_SQL}`)

/**
 * Every winning start at the next round's circuit (circuit.js STARTS, the
 * circuit page's own), for its history under the block.
 */
export const NEXT_STARTS = replaceOnce(
  STARTS,
  'r.circuit_id = ?',
  `r.circuit_id = (SELECT n.circuit_id FROM races n WHERE n.year = ${CURRENT_SEASON_SQL} AND n.status = 'scheduled' ORDER BY n.round LIMIT 1)`,
)

export const startsHeadingAt = (circuit) => `Where winners start at ${circuit}`

function replaceOnce(sql, from, to) {
  const parts = sql.split(from)
  if (parts.length !== 2) throw new Error(`home.js: expected one "${from}" in the query, found ${parts.length - 1}`)
  return parts.join(to)
}
