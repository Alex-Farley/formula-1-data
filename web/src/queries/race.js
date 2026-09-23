/**
 * One race's page: its queries, its four tables' columns and the order a
 * classification is printed in, read by Race.jsx and by scripts/prerender.js
 * (PD-02, rung four).
 *
 * WHY THIS FILE EXISTS
 *     The static race page carried a seven-column classification to the
 *     app's ten — no chassis, no fastest-lap column, "Status" against "Out",
 *     the fastest lap folded into the status cell — ordered by a different
 *     rule, and no qualifying, sprint or pit-stop table at all, so a crawler
 *     read a different race from the one a reader saw. The definitions live
 *     here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { EMPTY, classificationOrder, finished, missing, points, result, text } from '../lib/format.js'
import { SHARED } from '../lib/site.js'

export const RACE = `
  SELECT r.*, c.name AS circuit, c.locality, c.country,
         cl.layout_name, cl.length_km AS layout_km, cl.turns AS layout_turns,
         g.name AS gp_full,
         o.path AS outline, o.length_km AS outline_km, o.turns AS outline_turns
    FROM races r
    LEFT JOIN circuits c        ON c.id = r.circuit_id
    LEFT JOIN circuit_layouts cl ON cl.circuit_id = r.circuit_id AND cl.layout_key = r.layout_key
    LEFT JOIN grands_prix g     ON g.id = r.gp_id
    LEFT JOIN circuit_outlines o ON o.f1db_layout_id = r.f1db_layout_id
   WHERE r.year = ? AND r.round = ?
`

export const ENTRIES = `
  SELECT e.*, d.full_name AS driver, d.nationality, k.name AS constructor,
         k.country AS constructor_country, ch.name AS chassis
    FROM race_entries e
    JOIN races r         ON r.id = e.race_id
    LEFT JOIN drivers d  ON d.id = e.driver_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
    LEFT JOIN chassis ch ON ch.id = e.chassis_id
   WHERE r.year = ? AND r.round = ?
`

export const QUALIFYING = `
  SELECT q.*, d.full_name AS driver, k.name AS constructor, k.country AS constructor_country
    FROM qualifying q
    JOIN races r         ON r.id = q.race_id
    LEFT JOIN drivers d  ON d.id = q.driver_id
    LEFT JOIN constructors k ON k.id = q.constructor_id
   WHERE r.year = ? AND r.round = ?
   ORDER BY q.position IS NULL, q.position
`

export const SPRINT = `
  SELECT s.*, d.full_name AS driver, k.name AS constructor, k.country AS constructor_country
    FROM sprint_results s
    JOIN races r         ON r.id = s.race_id
    LEFT JOIN drivers d  ON d.id = s.driver_id
    LEFT JOIN constructors k ON k.id = s.constructor_id
   WHERE r.year = ? AND r.round = ?
`

/** Lap order, then stop order: the order the app's table opens in. */
export const PITS = `
  SELECT p.*, d.full_name AS driver
    FROM pit_stops p
    JOIN races r        ON r.id = p.race_id
    LEFT JOIN drivers d ON d.id = p.driver_id
   WHERE r.year = ? AND r.round = ?
   ORDER BY p.lap_number, p.stop_number, p.id
`

export const NEIGHBOURS = `
  SELECT
    (SELECT year || '/' || round FROM races
      WHERE (year < ?1) OR (year = ?1 AND round < ?2)
      ORDER BY year DESC, round DESC LIMIT 1) AS previous,
    (SELECT year || '/' || round FROM races
      WHERE (year > ?1) OR (year = ?1 AND round > ?2)
      ORDER BY year, round LIMIT 1) AS next
`

/**
 * The registry entries behind the rows this page prints, for the citation's
 * second sentence (CD-08; site.js's behindThisPage says what it reads). The
 * race row, and every classification, qualifying, sprint, pit-stop and
 * timetable row of it: each carries `source_id`, which build.py resolves
 * from `source` and verify.py re-resolves, so this is a join and not a
 * reading of URLs. Photographs and the circuit outline are not here: each
 * carries its own credit beside it - per file for a photograph, F1DB's
 * CC BY 4.0 line under the outline - which is the rule for them.
 */
export const RACE_SOURCES = `
  SELECT s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id IN (
           SELECT r.source_id FROM races r WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT e.source_id FROM race_entries e JOIN races r ON r.id = e.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT q.source_id FROM qualifying q JOIN races r ON r.id = q.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT x.source_id FROM sprint_results x JOIN races r ON r.id = x.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT p.source_id FROM pit_stops p JOIN races r ON r.id = p.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT t.source_id FROM sessions t JOIN races r ON r.id = t.race_id WHERE r.year = ?1 AND r.round = ?2)
   ORDER BY s.priority, s.id
`

/* ------------------------------------------------------------------ order */

/**
 * The classification in the order a classification is printed: finishers by
 * position, then everyone else by how far they got. finish_position is NULL
 * for a retirement, so ordering on it in SQL would put every DNF first —
 * SQLite sorts NULL first — which is why both renderers sort here. A sprint
 * is a separate race on the same weekend and is ordered the same way.
 */
export const inClassificationOrder = (rows) =>
  [...rows].sort((a, b) => classificationOrder(a) - classificationOrder(b))

/** What a row achieved, for the rail beside it: podium, points, classified, or nothing. */
export const railOf = (entry) => {
  if (entry.finish_position >= 1 && entry.finish_position <= 3) return 'podium'
  if (entry.points > 0) return 'points'
  if (!missing(entry.finish_position)) return 'classified'
  return ''
}

/* ---------------------------------------------------------------- columns */

export const FASTEST_LAP = 'fastest lap'

// The rail is data, not decoration — what the row achieved, read before any
// of the numbers — and it is always paired with the position beside it, so
// the colour never carries the meaning alone. Because the Pos cell says in
// words what the rail says in colour, the whole column is hidden from
// assistive technology in both renderers: named "Result" for a screen reader,
// it was an empty cell announced as Result on every row, and nothing more
// (AX-12). Its cell carries no text in either renderer.
const rail = { key: 'rail', label: 'Result', align: 'rail', sortable: false, ariaHidden: true, text: () => '' }

/** The classified position, the source's own spelling first ("EX", "NC"), or the em dash. */
export const position = (_, row) => result(row)

/** "Finished" for a classified finisher with no status, the status otherwise, the em dash for neither. */
export const outcome = (value, row) => (finished(value, row.finish_position) ? 'Finished' : text(value))

/** The driver, and "shared" where two drivers took turns in the car. */
export const driverName = (name, row) => `${text(name ?? row.driver_id)}${row.shared_drive === 1 ? ` ${SHARED}` : ''}`

/** "●" with the words "fastest lap" for a screen reader; nothing otherwise. */
export const fastestLapMark = (value) => (value === 1 ? `●${FASTEST_LAP}` : '')

const pts = (value) => (missing(value) ? EMPTY : points(value))

/**
 * The car an entry raced, for every surface that names one.
 *
 * The constructor where one is resolved, the entrant's name where none is -
 * which is how eleven winning entries come to be named at all. The
 * Indianapolis 500 counted for the championship from 1950 to 1960 and its
 * winners were entered as "Kurtis Kraft-Offenhauser", "Watson-Offenhauser"
 * and the like, designations no constructor row holds, so `constructor_id`
 * is NULL and `constructor` with it. Reading the stored name alone leaves
 * those pages blank about a car the entry plainly had.
 *
 * It is a function rather than four copies of the expression because it was
 * four copies: the classification's Constructor column and raceSentence()
 * applied it, while the Winner tile in pages/Race.jsx and the Constructor
 * fact row in scripts/prerender.js read `constructor` raw, so one race page
 * named the car in its standfirst and in its table and showed nothing
 * between them (AF-64).
 *
 * Returns undefined for no row, which is what the tile wants for "no note".
 */
export const carName = (row) =>
  row?.constructor_id ? row.constructor : (row?.entrant ?? row?.constructor)

export const CLASSIFICATION_COLUMNS = [
  rail,
  { key: 'position_text', label: 'Pos', align: 'num', text: position },
  { key: 'driver', rowHeader: true, label: 'Driver', text: driverName },
  // The entrant's name where no constructor is resolved: a privateer entry.
  { key: 'constructor', label: 'Constructor', text: (_, row) => text(carName(row)) },
  { key: 'chassis', label: 'Chassis', text: (name, row) => text(name ?? row.chassis_id) },
  { key: 'grid_text', label: 'Grid', align: 'num' },
  { key: 'laps_completed', label: 'Laps', align: 'num' },
  { key: 'status', label: 'Out', text: outcome },
  { key: 'points', label: 'Points', align: 'num', text: pts },
  { key: 'fastest_lap', label: 'FL', align: 'num', text: fastestLapMark },
]

/**
 * Why a position appears twice in a classification.
 *
 * Both renderers mark the drivers with the "shared" tag, but only the app
 * explained what the duplicated position meant; the static race page showed
 * the tag and left the reader to guess that a row had been repeated in error
 * (CD-04). A pair rather than one string because the app sets the first
 * sentence as <strong> and the static page writes it out, the same split
 * driver.js's pointsNote uses.
 */
export const SHARED_DRIVE_NOTE = {
  head: 'This race includes a shared drive.',
  body:
    'Two drivers took turns in one car and both are classified in the same position, so a ' +
    'position below appears twice. That is correct, not a duplicated row.',
}

/**
 * What the classification's blanks mean — each sentence only where the blank
 * it explains is on the page.
 *
 * Both sentences were printed unconditionally beneath all 1,163 classifications.
 * The first matched nothing: CD-01 made a classified finisher with no status
 * read "Finished" rather than an em dash, which left no row in the database at
 * all where "Out" is empty (0 of 27,504 entries), so every race page taught a
 * rule about a value the reader will never see, under a column showing
 * "Finished" twenty times. The second is true of 761 of the 1,163 and was
 * asserted on the other 402 (CD-36). The sentences are kept rather than the
 * first deleted, because each one is right whenever its blank appears and the
 * database is rebuilt from sources that may yet produce one.
 *
 * The tests are the cells' own: "Out" is blank exactly where `outcome` falls
 * through to the em dash, and a chassis cell is blank exactly where neither the
 * name nor the id is there for either renderer to print.
 */
export const OUT_NOTE = 'An empty “Out” is a retirement nobody recorded a reason for, not a driver who finished.'

export const CHASSIS_NOTE =
  'A blank chassis is a season the team ran more than one design and no source says which car raced here.'

export const classificationFooter = (entries) =>
  [
    entries.some((row) => missing(row.status) && missing(row.finish_position)) ? OUT_NOTE : '',
    entries.some((row) => missing(row.chassis) && missing(row.chassis_id)) ? CHASSIS_NOTE : '',
  ]
    .filter(Boolean)
    .join(' ')

/** One time per driver before knock-out qualifying arrived in 2006; the best lap of each session from then. */
export const qualifyingColumns = (rows) => [
  { key: 'position_text', label: 'Pos', align: 'num' },
  { key: 'driver', rowHeader: true, label: 'Driver', text: (name, row) => text(name ?? row.driver_id) },
  { key: 'constructor', label: 'Constructor' },
  { key: 'driver_number', label: 'No.', align: 'num' },
  ...(rows.some((q) => q.q1)
    ? [
        { key: 'q1', label: 'Q1', align: 'num' },
        { key: 'q2', label: 'Q2', align: 'num' },
        { key: 'q3', label: 'Q3', align: 'num' },
      ]
    : [{ key: 'time', label: 'Time', align: 'num' }]),
  { key: 'gap', label: 'Gap', align: 'num' },
  { key: 'interval', label: 'Interval', align: 'num' },
]

export const QUALIFYING_FOOTER =
  'Before knock-out qualifying arrived in 2006 there is one time per driver; from 2006, the best lap of each of the three sessions.'

export const SPRINT_COLUMNS = [
  rail,
  { key: 'position_text', label: 'Pos', align: 'num' },
  { key: 'driver', rowHeader: true, label: 'Driver', text: (name, row) => text(name ?? row.driver_id) },
  { key: 'constructor', label: 'Constructor' },
  { key: 'grid', label: 'Grid', align: 'num' },
  { key: 'laps_completed', label: 'Laps', align: 'num' },
  { key: 'status', label: 'Out', text: outcome },
  { key: 'gap', label: 'Gap', align: 'num' },
  { key: 'points', label: 'Points', align: 'num', text: pts },
]

export const SPRINT_FOOTER =
  'A sprint is a separate, shorter race held on the grand prix weekend, with its own grid and its own points — and those points count towards the championship. The grid column is the sprint grid, not the grand prix one.'

export const PIT_COLUMNS = [
  { key: 'lap_number', label: 'Lap', align: 'num' },
  { key: 'driver', rowHeader: true, label: 'Driver', text: (name, row) => text(name ?? row.driver_key) },
  { key: 'stop_number', rowHeader: true, label: 'Stop', align: 'num' },
  { key: 'stationary_seconds', label: 'Stationary (s)', align: 'num' },
  { key: 'pit_lane_seconds', label: 'Pit lane (s)', align: 'num' },
  // Every stop on a page usually comes from the one source, and the column
  // says so twenty times (VD-29). Not the two durations above it: they are
  // NULL because F1DB publishes no duration, which PITS_FOOTER and schema.sql
  // explain and "not established" would contradict.
  { key: 'source', label: 'Source', collapse: true },
]

export const PITS_FOOTER =
  'Stationary time is the car standing still; pit-lane time is the whole detour. Where two sources record the same stop, both are kept so you can compare them.'

/**
 * What happened, in one sentence, counted from the race records rather than
 * read off a stored column - so it is current by construction and cannot go
 * stale the way a written sentence can.
 *
 *     Juan Manuel Fangio and Luigi Fagioli shared the win for Alfa Romeo at
 *     Reims-Gueux.
 *
 * `winners` is every entry classified first, which is two of them on the
 * three races a pair shared a car; both are credited, as the classification
 * below credits both. The car is the constructor, falling back to the
 * entrant where no constructor is resolved - the rule the classification's
 * own Constructor column applies, and the reason the eleven Indianapolis
 * 500s in the championship read "Kurtis Kraft-Offenhauser" rather than
 * nothing.
 *
 * A scheduled round has no classification to describe, so it says when and
 * where instead, that being the whole of what is established about it. The
 * no-winner sentence holds for no race today - every one of the 1,163 run
 * rounds classifies someone first - and is here because a round whose
 * classification has not been loaded yet is a state this site passes through
 * every time a season runs.
 */
export const raceSentence = (race, winners, stage = 'awaited') => {
  const where = race.circuit ? ` at ${race.circuit}` : ''
  if (race.status === 'scheduled') {
    // "not yet run" is true of a round still to come and false of one that
    // ran on Sunday and has not been harvested yet, which is the state AF-01
    // measured at twenty-three hours. `stage` is raceStage() in
    // queries/sessions.js, read from the clock by whichever renderer has one;
    // where nobody passes it the sentence is what the record says, unchanged.
    const held = stage === 'awaited' ? 'not yet run' : 'no result is recorded yet'
    return `Scheduled${race.dates ? ` for ${race.dates}` : ''}${where}; ${held}.`
  }
  if (!winners.length) return 'No winner is recorded for this round.'
  const first = winners[0]
  const car = carName(first)
  const forWhom = car ? ` for ${car}` : ''
  const who = winners.map((w) => w.driver ?? w.driver_id).join(' and ')
  return winners.length > 1 ? `${who} shared the win${forWhom}${where}.` : `${who} won${forWhom}${where}.`
}

/**
 * The opening sentence of a race's page, in both renderers (CD-03).
 *
 * `note` is the override and stays the lede wherever a person wrote one - 2
 * of the 1,196 rows, each a scheduled round whose venue or status needs
 * explaining. The other 1,194 pages opened straight onto the strip of tiles
 * with nothing to say what the reader was looking at, while
 * scripts/prerender.js had already composed a serviceable sentence for the
 * meta description and kept it off the page. raceSentence() above is that
 * sentence, written once and read by both, so the description and the
 * standfirst cannot come to disagree.
 *
 * What counts as a note is raceNote() below, so the static page can ask the
 * same question before deciding whether it has already printed one. lede() in
 * queries/driver.js is the same rule for the same reason.
 */
export const raceLede = (race, winners, stage = 'awaited') =>
  raceNote(race) || raceSentence(race, winners, stage)

/**
 * The block a scheduled round carries where its classification would be, in
 * both renderers (AF-01).
 *
 * The two halves each wrote their own sentence for this and had already come
 * to word it differently; one function is what stops them drifting further,
 * the rule SHARED_DRIVE_NOTE above is here for.
 *
 * `stage` is raceStage() in queries/sessions.js. Only the headline changes
 * with it: what the reader does next — wait for the classification — is the
 * same in all three states, and the body says so once.
 */
export const scheduledNote = (race, stage = 'awaited') => {
  if (stage === 'awaited') {
    return {
      head: 'This race has not been run.',
      body: `It is on the ${race.year} calendar and carries no result yet.`,
    }
  }
  return {
    head: stage === 'running' ? 'This race is under way.' : 'This race has been run; the result is not here yet.',
    body:
      stage === 'running'
        ? 'Its scheduled start has passed; the classification appears here once the result has been recorded.'
        : 'The classification appears here once the result has been recorded.',
  }
}

/**
 * The note a person wrote on this round, or '' where nobody did.
 *
 * A blank note is not a note: `note` has no NOT NULL or length constraint, so
 * an empty string would otherwise render an empty lede rather than falling
 * through to the sentence. Read here rather than decided twice - the static
 * page also has to know whether the lede it is printing is the note, and two
 * copies of this rule are how the two would come to disagree.
 */
export const raceNote = (race) => (race.note == null ? '' : String(race.note).trim())
