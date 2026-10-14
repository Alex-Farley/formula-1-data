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
import { classificationOrder, finished, missing, number, points, raceDates, result, text } from '../lib/format.js'
import { linked } from '../lib/tiles.js'
import { LABELS, SHARED } from '../lib/site.js'
import { LATE_NOTE, raceDay } from '../lib/refresh.js'

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
  SELECT e.*, d.full_name AS driver, d.abbreviation, d.nationality, k.name AS constructor,
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

/* Practice, every session of the weekend in one read, and sprint qualifying
   (LV-03). practice_only rides along so a Friday driver who never started a
   race is marked on the sheet as well as on their own page. */
export const PRACTICE = `
  SELECT p.*, d.full_name AS driver, d.practice_only, k.name AS constructor,
         k.country AS constructor_country
    FROM practice p
    JOIN races r         ON r.id = p.race_id
    LEFT JOIN drivers d  ON d.id = p.driver_id
    LEFT JOIN constructors k ON k.id = p.constructor_id
   WHERE r.year = ? AND r.round = ?
   ORDER BY p.session, p.position IS NULL, p.position
`

export const SPRINT_QUALIFYING = `
  SELECT q.*, d.full_name AS driver, d.practice_only, k.name AS constructor,
         k.country AS constructor_country
    FROM sprint_qualifying q
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

/**
 * The span of races any stop is recorded for, which the stint figure's empty
 * state reads (stintsEmpty() below): `year` is the first season (1994 today),
 * named on the races before it, and `latest_year`/`latest_round` the last
 * round holding a stop, after which an empty section is stops not yet
 * published rather than none (SD-40). Read rather than written, so that a
 * source reaching further back, or a refresh adding a round, moves the
 * sentence with it. No row where no stop is held at all.
 */
export const PITS_FROM = `
  WITH held AS (SELECT DISTINCT r.year, r.round FROM pit_stops p JOIN races r ON r.id = p.race_id)
  SELECT (SELECT MIN(year) FROM held) AS year, l.year AS latest_year, l.round AS latest_round
    FROM (SELECT year, round FROM held ORDER BY year DESC, round DESC LIMIT 1) l
`

export const NEIGHBOURS = `
  WITH before AS (
         SELECT year, round, name_used FROM races
          WHERE (year < ?1) OR (year = ?1 AND round < ?2)
          ORDER BY year DESC, round DESC LIMIT 1),
       after AS (
         SELECT year, round, name_used FROM races
          WHERE (year > ?1) OR (year = ?1 AND round > ?2)
          ORDER BY year, round LIMIT 1)
  SELECT
    (SELECT year || '/' || round FROM before)     AS previous,
    (SELECT year || ' ' || name_used FROM before) AS previous_name,
    (SELECT year || '/' || round FROM after)      AS next,
    (SELECT year || ' ' || name_used FROM after)  AS next_name,
    (SELECT COUNT(*) FROM races WHERE year = ?1)  AS rounds
`

/**
 * The registry entries behind the rows this page prints, for the citation's
 * second sentence (CD-08; site.js's behindThisPage says what it reads). The
 * race row, and every classification, qualifying, sprint, pit-stop and
 * timetable row of it: each carries `source_id`, which build.py resolves
 * from `source` and verify.py re-resolves, so this is a join and not a
 * reading of URLs. A classification row's note (DA-46) is cited in `claims`
 * rather than by the row's own source_id - the row is F1DB's, the reason
 * under it a race article's - so the claim behind each note printed is read
 * too. Photographs and the circuit outline are not here: each carries its own
 * credit beside it - per file for a photograph, F1DB's CC BY 4.0 line under
 * the outline - which is the rule for them.
 */
export const RACE_SOURCES = `
  SELECT s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id IN (
           SELECT r.source_id FROM races r WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT e.source_id FROM race_entries e JOIN races r ON r.id = e.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT q.source_id FROM qualifying q JOIN races r ON r.id = q.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT f.source_id FROM practice f JOIN races r ON r.id = f.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT y.source_id FROM sprint_qualifying y JOIN races r ON r.id = y.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT x.source_id FROM sprint_results x JOIN races r ON r.id = x.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT p.source_id FROM pit_stops p JOIN races r ON r.id = p.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT t.source_id FROM sessions t JOIN races r ON r.id = t.race_id WHERE r.year = ?1 AND r.round = ?2
     UNION SELECT c.source_id FROM claims c
             JOIN race_entries e ON c.tbl = 'race_entries' AND c.field = 'note' AND c.row_key = e.race_id || '|' || e.driver_id
             JOIN races r ON r.id = e.race_id
            WHERE r.year = ?1 AND r.round = ?2 AND e.note IS NOT NULL AND e.note <> '')
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

/*
 * DA-46: why a row reads as it does, where the classification alone cannot
 * say - a Formula Two car in a paid place, a shared drive under the 1958
 * rule, a push-start penalty - held in race_entries.note and cited in claims.
 * The classification's row carries the mark in its driver cell, beside "shared" and the
 * practice sheets' dagger, and the note itself is the first sentence of the
 * footer under the table, naming the driver, so a 0 inside the paid places is
 * never left unexplained. The mark is spoken as where to look, because a
 * screen reader would otherwise read "asterisk".
 */
export const ENTRY_NOTE_MARK = '*'
export const ENTRY_NOTE_SPOKEN = '(see the note under the table)'

/** Whether a classification row carries a note, and so the mark. */
export const hasEntryNote = (row) => !missing(row.note)

const andList = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)

/**
 * The classification's notes, one sentence each in the table's order: the
 * drivers a note is about, then the note. Two drivers given the same reason
 * (a pair of Formula Two cars) share one sentence rather than repeating it.
 */
export const entryNotes = (entries) => {
  const groups = new Map()
  for (const row of entries) {
    if (!hasEntryNote(row)) continue
    const names = groups.get(row.note) ?? []
    names.push(text(row.driver ?? row.driver_id))
    groups.set(row.note, names)
  }
  return [...groups].map(([note, names]) => `${ENTRY_NOTE_MARK} ${andList(names)}: ${note}`)
}

/** The driver, and "shared" where two drivers took turns in the car. */
export const driverName = (name, row) => `${text(name ?? row.driver_id)}${row.shared_drive === 1 ? ` ${SHARED}` : ''}`

/*
 * The classification's driver: driverName() and the mark where the row
 * carries a note. Its own formatter rather than driverName()'s, because Grid
 * to flag and the stint table name the same rows and have no footer giving
 * the note, so a mark there would point at nothing.
 */
const classifiedName = (name, row) => `${driverName(name, row)}${hasEntryNote(row) ? ` ${ENTRY_NOTE_MARK}` : ''}`

/** "●" with the words "fastest lap" for a screen reader; nothing otherwise. */
export const fastestLapMark = (value) => (value === 1 ? `●${FASTEST_LAP}` : '')

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

/*
 * The classification fits its own box from --bp-tablet (IX-45): ten columns
 * at max-content are about 960 px, so from 768 to 1,010 px Points and FL
 * scrolled out of view. `WRAPS` on its four columns of words lets a name or
 * a reason break at a space between those widths, and the stylesheet closes
 * the table's cells up there (app.css, "A table that fits its box"); the
 * figures never wrap. A class rather than a rule on the page, so the static
 * table, which prerender.js writes from these same columns, fits too.
 */
const WRAPS = 'wraps'

export const CLASSIFICATION_COLUMNS = [
  rail,
  { key: 'position_text', label: 'Pos', align: 'num', text: position, glossary: 'results' },
  { key: 'driver', rowHeader: true, label: 'Driver', text: classifiedName, cellClass: WRAPS },
  // The entrant's name where no constructor is resolved: a privateer entry.
  { key: 'constructor', label: 'Constructor', text: (_, row) => text(carName(row)), cellClass: WRAPS },
  { key: 'chassis', label: 'Chassis', text: (name, row) => text(name ?? row.chassis_id), cellClass: WRAPS },
  { key: 'grid_text', label: 'Grid', align: 'num' },
  { key: 'laps_completed', label: 'Laps', align: 'num' },
  { key: 'status', label: 'Out', text: outcome, cellClass: WRAPS },
  { key: 'points', label: 'Points', align: 'num', text: points },
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
    ...entryNotes(entries),
    entries.some((row) => missing(row.status) && missing(row.finish_position)) ? OUT_NOTE : '',
    entries.some((row) => missing(row.chassis) && missing(row.chassis_id)) ? CHASSIS_NOTE : '',
  ]
    .filter(Boolean)
    .join(' ')

/*
 * One time per driver before knock-out qualifying arrived in 2006; the best
 * lap of each session from then.
 *
 * A qualifying sheet is read whole, as the classification is: its figures -
 * the three sessions' times, the gap and the interval - are the right-hand
 * columns, and from 768 to 900 px they scrolled 112 px out of view on
 * /races/2024/21, in both qualifying and sprint qualifying (IX-48). So its
 * two columns of words take `WRAPS`, the classification's rule for a table
 * that fits its box. The practice sheets fit at one line and keep it.
 */
export const qualifyingColumns = (rows) => [
  { key: 'position_text', label: 'Pos', align: 'num', glossary: 'results' },
  { key: 'driver', rowHeader: true, label: 'Driver', text: (name, row) => text(name ?? row.driver_id), cellClass: WRAPS },
  { key: 'constructor', label: 'Constructor', cellClass: WRAPS },
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

/** The sessions practice rows can belong to, in weekend order, with the name the timetable gives each. */
export const PRACTICE_SESSIONS = [
  ['pre_qualifying', 'Pre-qualifying'],
  ['fp1', 'Practice 1'],
  ['fp2', 'Practice 2'],
  ['fp3', 'Practice 3'],
  ['fp4', 'Practice 4'],
  ['warm_up', 'Warm-up'],
]

/** One weekend's practice rows, split by session and in weekend order; a session with no rows is left out. */
export const practiceBySession = (rows) =>
  PRACTICE_SESSIONS.map(([session, title]) => ({ session, title, rows: rows.filter((r) => r.session === session) })).filter(
    (s) => s.rows.length > 0,
  )

/*
 * PD-57: a weekend's session sheets sit behind one disclosure below the
 * result, because a reader who came for the classification had three of them
 * (about 3,000 px in 2025) between qualifying and the pit stops. Closed, not
 * gone: the tables are in the page, and in the static HTML, either way. The
 * summary names the sheets inside, since a pre-qualifying or a warm-up is not
 * what "practice" alone promises. Race.jsx and scripts/prerender.js print
 * these words, so the two halves label the same disclosure the same way.
 */
export const PRACTICE_SUMMARY = 'Practice sessions'
export const practiceSummaryCount = (practice) => practice.map((s) => s.title).join(' · ')

/** The mark a practice-only driver carries on a session sheet, and what it means. */
export const PRACTICE_ONLY_MARK = '†'
export const PRACTICE_ONLY_NOTE = `${PRACTICE_ONLY_MARK} Drove in practice and never started a Grand Prix.`

/* The driver cell of a session sheet: the name, and the mark where the driver
   never started a race. The static page prints this text and the app renders
   the same mark, so the two halves say the same thing. */
const sessionDriver = {
  key: 'driver',
  rowHeader: true,
  label: 'Driver',
  text: (name, row) => text(name ?? row.driver_id) + (row.practice_only === 1 ? ` ${PRACTICE_ONLY_MARK}` : ''),
}

export const PRACTICE_COLUMNS = [
  { key: 'position_text', label: 'Pos', align: 'num', glossary: 'results' },
  sessionDriver,
  { key: 'constructor', label: 'Constructor' },
  { key: 'driver_number', label: 'No.', align: 'num' },
  { key: 'time', label: 'Best lap', align: 'num' },
  { key: 'gap', label: 'Gap', align: 'num' },
  { key: 'interval', label: 'Interval', align: 'num' },
  { key: 'laps', label: 'Laps', align: 'num' },
]

export const practiceFooter = (rows) =>
  [
    'Each driver’s best lap of the session and the laps they ran: a classification, not lap timing.',
    rows.some((r) => r.practice_only === 1) ? PRACTICE_ONLY_NOTE : '',
  ]
    .filter(Boolean)
    .join(' ')

const SQ_LABELS = { q1: 'SQ1', q2: 'SQ2', q3: 'SQ3' }

export const sprintQualifyingColumns = (rows) =>
  qualifyingColumns(rows).map((column) =>
    // Object.hasOwn, not a lookup: every object answers `constructor`, which
    // is also this table's column key.
    // The session sheet's driver cell, with its † mark, keeps qualifying's
    // `WRAPS`; practice uses the same cell at one line.
    column.key === 'driver'
      ? { ...sessionDriver, cellClass: column.cellClass }
      : Object.hasOwn(SQ_LABELS, column.key)
        ? { ...column, label: SQ_LABELS[column.key] }
        : column,
  )

export const sprintQualifyingFooter = (rows) =>
  [SPRINT_QUALIFYING_FOOTER, rows.some((r) => r.practice_only === 1) ? PRACTICE_ONLY_NOTE : ''].filter(Boolean).join(' ')

export const SPRINT_QUALIFYING_FOOTER =
  'The session that sets the sprint grid: the sprint shootout in 2023, sprint qualifying since, with the best lap of each of its three parts.'

export const SPRINT_COLUMNS = [
  rail,
  { key: 'position_text', label: 'Pos', align: 'num', glossary: 'results' },
  { key: 'driver', rowHeader: true, label: 'Driver', text: (name, row) => text(name ?? row.driver_id) },
  { key: 'constructor', label: 'Constructor' },
  { key: 'grid', label: 'Grid', align: 'num' },
  { key: 'laps_completed', label: 'Laps', align: 'num' },
  { key: 'status', label: 'Out', text: outcome },
  { key: 'gap', label: 'Gap', align: 'num' },
  { key: 'points', label: 'Points', align: 'num', text: points },
]

export const SPRINT_FOOTER =
  'A sprint is a separate, shorter race held on the grand prix weekend, with its own grid and its own points — and those points count towards the championship. The grid column is the sprint grid, not the grand prix one.'

/*
 * Grid to flag (PD-30): the figure charts/gridFlag.js lays out, under the
 * classification, with its words and its table here so both renderers print
 * the same ones. The table is the figure's numbers - the cars it draws, in
 * the order it ends them - and not a second classification: an entry with
 * no line is not in it, and the note says how many.
 */
export const GRID_FLAG_HEADING = 'Grid to flag'

export const GRID_FLAG_COLUMNS = [
  { key: 'driver', rowHeader: true, label: 'Driver', text: driverName },
  { key: 'grid_text', label: 'Grid', align: 'num', text: (value, row) => text(value ?? row.grid) },
  { key: 'position_text', label: 'Result', align: 'num', text: position, glossary: 'results' },
  { key: 'laps_completed', label: 'Laps', align: 'num' },
]

/**
 * What the lines mean and what they cannot, and - only where the page has
 * one - a car out and a shared car: 48 words at the longest, under the 50
 * the figure grammar allows (VD-80). The sentence on what the record holds
 * is the one that must never be lost: the database holds no position
 * between the start and the end, so a crossing is not an overtake at that
 * lap.
 */
export const gridFlagNote = (rows) =>
  [
    'Lines run from grid slot to result, ending at the last lap completed.',
    rows.some((r) => r.out) ? 'A dashed line ending in a cross is a driver not classified.' : '',
    'Nothing between is recorded, so a crossing is not an overtake at that lap.',
    rows.some((r) => r.entry.shared_drive === 1) ? 'Drivers who shared a car have a line each.' : '',
  ]
    .filter(Boolean)
    .join(' ')

/**
 * The entries the classification holds and the figure cannot draw, said
 * under the figure's table, which is short of them by the same count: it is
 * a fact about the table, and a note that carried it as well ran to 59
 * words.
 */
export const gridFlagUndrawn = (undrawn) =>
  undrawn.length
    ? `${number(undrawn.length)} ${undrawn.length === 1 ? 'entry' : 'entries'} with no recorded grid slot or lap count ${
        undrawn.length === 1 ? 'is' : 'are'
      } in the classification and not drawn.`
    : undefined

/** The figure's name for a screen reader, which hears the table and the note with it. */
export const gridFlagLabel = (rows) => {
  const out = rows.filter((r) => r.out).length
  return `Grid to flag: ${rows.length} drivers from their grid slots to the result, ${rows.length - out} classified and ${out} not.`
}

/*
 * Pit stops (PD-56): the stint figure charts/stints.js lays out, the pit
 * order between neighbours under it, and the words, tables and empty states
 * of both, here so the two renderers print the same ones.
 *
 * It replaced a table of stops - lap, driver, stop number and two duration
 * columns that were empty on every row, F1DB publishing no duration. The
 * figure's table carries every lap that table did, driver by driver, and
 * the note says in words what the empty columns said by being empty.
 */
export const PITS_HEADING = 'Pit stops'

export const STINT_COLUMNS = [
  { key: 'driver', rowHeader: true, label: 'Driver', text: driverName },
  { key: 'position_text', label: 'Result', align: 'num', text: position, glossary: 'results' },
  { key: 'laps_completed', label: 'Laps', align: 'num' },
  { key: 'stops', label: 'Stops recorded', align: 'num' },
  // A driver with no stop recorded is not always a driver who did not stop:
  // F1DB's record has gaps (/races/1995/7 holds stops for 5 of its 16
  // finishers), so the cell says what the record holds and no more.
  { key: 'stop_laps', label: 'Stopped on lap', text: (value, row) => (row.stops === 0 ? 'None recorded' : text(value)) },
]

/**
 * What the bars mean and what they cannot, and - only where the page has
 * one - a gap in the record, a car out and a stop on the lap a driver went
 * out on: 49 words at the longest, under the 50 the figure grammar allows
 * (VD-80). The sentence on what the record holds is the one that must never
 * be lost: the lap of each stop, and no duration, tyre or lap time, so
 * nothing here measures what a stop gained.
 */
export const stintsNote = (rows, late) =>
  [
    'Bars run in finishing order, ticked on each lap a driver stopped.',
    rows.some((r) => r.stops.length === 0) ? 'An unticked bar may hide a stop: F1DB’s record has gaps.' : '',
    rows.some((r) => r.out) ? 'A cross is a driver not classified.' : '',
    late.length ? `${number(late.length)} ${late.length === 1 ? 'driver' : 'drivers'} stopped on their final lap.` : '',
    'Only the lap is recorded: not a stop’s length, tyres or gain.',
  ]
    .filter(Boolean)
    .join(' ')

/** The drivers in the figure's table and not in its drawing, said under that table, as gridFlagUndrawn() is. */
export const stintsUnbarred = (unbarred) =>
  unbarred.length
    ? `${number(unbarred.length)} ${unbarred.length === 1 ? 'driver' : 'drivers'} with stops recorded and no lap count ${
        unbarred.length === 1 ? 'is' : 'are'
      } in the table and not drawn.`
    : undefined

/** The figure's name for a screen reader, which hears the table and the note with it. */
export const stintsLabel = (rows) => {
  const stops = rows.reduce((sum, r) => sum + r.stops.length, 0)
  return `Pit stops: ${rows.length} drivers’ races in finishing order, split at ${number(stops)} recorded ${stops === 1 ? 'stop' : 'stops'}.`
}

/**
 * Where a race run has no figure, the section says why rather than
 * vanishing. `span` is PITS_FROM's row. Before the first season any stop is
 * recorded, that no source here holds them. After the last round holding a
 * stop, that they have not arrived yet (SD-40): F1DB adds a race's stops
 * after its classification, so the newest round is the one that reads as
 * empty, and "records no pit stop" said of it what is true only of a race
 * like Spa 2021, which later rounds' stops show was genuinely without one.
 * That needs no clock, so both renderers say the same at any date. Between
 * the two, that this race has none recorded.
 */
export const stintsEmpty = (race, span) => {
  if (span?.year && race.year < span.year) {
    return `Pit stops are recorded from ${span.year}. F1DB, the source of every stop here, holds none before then, so this race has no stints to draw.`
  }
  const after =
    span?.latest_year != null &&
    (race.year > span.latest_year || (race.year === span.latest_year && race.round > span.latest_round))
  return after
    ? 'No pit stop is recorded for this race yet. F1DB adds a race’s stops after its classification, and this site checks F1DB every morning.'
    : 'F1DB records no pit stop for this race, so there are no stints to draw.'
}

/* Who stopped first between neighbours: charts/stints.js's pitPairs. */
export const PIT_ORDER_HEADING = 'Who stopped first, between neighbours'

const pairName = (entry) => text(entry.driver ?? entry.driver_id)
const both = (pair, read) => `${read(pair.ahead)} · ${read(pair.behind)}`

export const PIT_ORDER_COLUMNS = [
  { key: 'pair', rowHeader: true, label: 'Drivers, in grid order', text: (_, row) => both(row, pairName) },
  { key: 'grid', label: 'Grid', align: 'num', text: (_, row) => both(row, (e) => text(e.grid)) },
  { key: 'result', label: 'Result', align: 'num', text: (_, row) => both(row, (e) => result(e)) },
  {
    key: 'laps',
    label: 'First recorded stop, lap',
    align: 'num',
    text: (_, row) => `${text(row.firstAhead)} · ${text(row.firstBehind)}`,
  },
  { key: 'first', label: 'Stopped first', text: (_, row) => (row.first ? pairName(row.first) : 'Same lap') },
  { key: 'swapped', label: 'Grid to flag', text: (_, row) => (row.swapped ? 'Swapped places' : 'Kept their order') },
]

export const PIT_ORDER_NOTE =
  'Pairs of classified drivers who started or finished next to each other, each with a stop recorded; the two names in a row are in grid order. Both are read from the stops F1DB records, which has gaps. It is the order things happened in and no more: with no stop duration and no lap times, the record cannot say whether stopping first won or lost a place.'

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
    const when = raceDates(race)
    return `Scheduled${when ? ` for ${when}` : ''}${where}; ${held}.`
  }
  if (!winners.length) return 'No winner is recorded for this round.'
  const first = winners[0]
  const car = carName(first)
  const forWhom = car ? ` for ${car}` : ''
  const who = winners.map((w) => w.driver ?? w.driver_id).join(' and ')
  return winners.length > 1 ? `${who} shared the win${forWhom}${where}.` : `${who} won${forWhom}${where}.`
}

/**
 * The opening of a race's page, in both renderers (CD-03): raceSentence()
 * above, then the note where a person wrote one.
 *
 * The pages used to open straight onto the strip of tiles with nothing to say
 * what the reader was looking at, while scripts/prerender.js had already
 * composed a serviceable sentence for the meta description and kept it off
 * the page. raceSentence() is that sentence, written once and read by both,
 * so the description and the standfirst cannot come to disagree.
 *
 * The note follows the sentence rather than replacing it (SD-39). A race's
 * note explains its venue or its status - "hosted at Sepang", "subject to
 * homologation" - and says nothing of the result, so as the override it made
 * /races/2026/16, a round two days old, the one race page that never said
 * who won. lede() in queries/driver.js keeps its note as the override, and
 * can: a driver's note is a career written by hand, not an aside about one
 * of its facts.
 */
export const raceLede = (race, winners, stage = 'awaited') => {
  const sentence = raceSentence(race, winners, stage)
  const note = raceNote(race)
  return note ? `${sentence} ${note}` : sentence
}

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
 *
 * `late` is lib/refresh.js's lateDays() for the round, or null (SD-37). A
 * late result is the one state where waiting is not the whole answer - the
 * reader is owed whether anything is wrong - so it replaces the body too,
 * with the words /changes uses.
 */
export const scheduledNote = (race, stage = 'awaited', late = null) => {
  if (late !== null) {
    return {
      head: 'This race’s result is late.',
      body: `It was run on ${raceDay(race)}. ${LATE_NOTE}`,
    }
  }
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
 * an empty string would otherwise leave a trailing space on the lede.
 */
const raceNote = (race) => (race.note == null ? '' : String(race.note).trim())

/**
 * The race's tiles, as both renderers draw them (VD-49).
 *
 * `entries` are the ENTRIES rows in the order the query returns them, and
 * `qualifying` QUALIFYING's: the pole-sitters and fastest-lap setters are
 * listed in that order, so a static page handed the classification order
 * instead would name a shared fastest lap in another order than the app.
 *
 * "Pole" is the driver the season record credits with pole position. Two
 * neighbouring facts are held separately and shown only where they name
 * someone else: the fastest qualifier (thirteen races, where a penalty or a
 * sprint-set grid moved the quickest driver back) and the car that actually
 * started from grid 1 (one race, 2022 Brazil, where the sprint winner
 * started first and pole stayed with the fastest qualifier). The database
 * records that they differ, not why, so neither tile states a cause.
 *
 * A round not yet run has a Status tile where the result would be, and no
 * Entries tile while no entry is held (PD-47, UR-20): "0" on this site is a
 * positive claim that nobody entered.
 */
export const raceStrip = (race, entries, qualifying) => {
  const scheduled = race.status === 'scheduled'
  const winners = inClassificationOrder(entries).filter((e) => e.finish_position === 1)
  const poles = entries.filter((e) => e.pole === 1)
  const quickest = qualifying.find((q) => q.position === 1)
  const outqualified = quickest && poles.length === 1 && quickest.driver_id !== poles[0].driver_id ? quickest : null
  const front = entries.filter((e) => e.grid === 1)
  const startedFirst =
    front.length === 1 && poles.length === 1 && front[0].driver_id !== poles[0].driver_id ? front[0] : null
  const fastest = entries.filter((e) => e.fastest_lap === 1)
  const finishers = entries.filter((e) => !missing(e.finish_position)).length
  const names = (list) => linked(list.map((e) => ({ label: e.driver ?? e.driver_id, href: `drivers/${e.driver_id}` })))
  return [
    {
      // VD-28: a name is set in the sans face at a reading size by the rule
      // in app.css, not by an inline size on one link.
      label: 'Circuit',
      kind: 'name',
      value: race.circuit_id ? race.circuit : null,
      href: `circuits/${race.circuit_id}`,
      note: [race.locality, race.country].filter(Boolean).join(', ') || undefined,
    },
    scheduled
      ? { label: 'Status', value: 'Scheduled', note: raceDates(race) ?? undefined }
      : {
          label: 'Winner',
          kind: 'name',
          ...names(winners),
          // The car by the classification's own rule, so the tile, the
          // standfirst above it and the table below it name the same one on
          // the eleven Indianapolis 500s (AF-64).
          note: carName(winners[0]) ?? undefined,
        },
    scheduled ? null : { label: 'Pole', kind: 'name', ...names(poles) },
    scheduled || !startedFirst
      ? null
      : {
          label: 'Started first',
          kind: 'name',
          value: startedFirst.driver ?? startedFirst.driver_id,
          href: `drivers/${startedFirst.driver_id}`,
          note: `the pole-sitter started ${poles[0].grid_text ?? '—'}`,
        },
    scheduled || !outqualified
      ? null
      : {
          label: 'Fastest qualifier',
          kind: 'name',
          value: outqualified.driver ?? outqualified.driver_id,
          href: `drivers/${outqualified.driver_id}`,
          note: `started ${entries.find((e) => e.driver_id === outqualified.driver_id)?.grid_text ?? '—'}${
            race.sprint ? ', the grid set by the sprint' : ''
          }`,
        },
    scheduled ? null : { label: 'Fastest lap', kind: 'name', ...names(fastest) },
    entries.length === 0
      ? null
      : {
          label: LABELS.entries,
          value: number(entries.length),
          note: scheduled ? undefined : `${finishers} classified`,
        },
  ].filter(Boolean)
}
