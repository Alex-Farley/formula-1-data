/**
 * /compare: two drivers side by side, and how they fared as team-mates
 * (PD-43). Read by pages/Compare.jsx and by scripts/prerender.js.
 *
 * WHY THIS FILE EXISTS
 *     The arguments a fan comes to settle are comparative - this driver
 *     against that one - and no page here put two careers in one view. The
 *     figures are the driver page's own: DERIVED for the career, TEAM_MATES
 *     narrowed to the pair for the races they shared a constructor, so a
 *     number on this page is the number on each driver's page.
 *
 * ADDRESSABLE BY CONSTRUCTION
 *     The pair is the address - /compare?a=senna&b=prost - so a comparison
 *     can be linked, cited and reloaded, and a driver's Team-mates section
 *     can link here without a page per pair existing. The
 *     static half has one page at /compare; the pair is drawn once the
 *     database is open, because a query string never reaches a static file.
 *
 * AND IT REFUSES THE VERDICT
 *     A comparison page invites "who was better", which none of these
 *     figures can answer: careers ran different lengths, in different eras,
 *     under points systems that paid differently, in cars that were not
 *     equal. The page shows the figures and says what each does not account
 *     for, as the critique that asked for it put it (docs/critiques/
 *     2026-09-21-product-design.md, PD-44).
 */
import { number, points, span, text, yearList } from '../lib/format.js'

/**
 * Every driver, for the two pickers. full_name is unique across the register.
 * Ordered by the label itself, because a select answers typing by the start
 * of each label: "Sir Lewis Hamilton" is found by typing what it says.
 */
export const COMPARE_DRIVERS = `SELECT id, full_name FROM drivers ORDER BY full_name`

/** "?a=senna&b=prost", "?a=senna", or "" with neither: the pair as the address holds it. */
export const compareSearch = (a, b) => {
  const params = new URLSearchParams()
  if (a) params.set('a', a)
  if (b) params.set('b', b)
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** "/compare?a=senna&b=prost", or "/compare?a=senna" while the second is unchosen. */
export const comparePath = (a, b) => `/compare${compareSearch(a, b)}`

export const COMPARE_LEDE =
  'Two careers side by side, counted from the race records the driver pages use, and — where the two ever drove ' +
  'for the same constructor — how they fared against each other in the same Grands Prix. Choose two drivers; ' +
  'the address carries both, so a comparison can be shared.'

/** Said on the static page, where the pickers cannot run. */
export const COMPARE_NOSCRIPT =
  'Choosing the two drivers needs JavaScript. Every figure here is also on each driver’s own page, and a ' +
  'driver’s Team-mates table holds the head-to-head.'

/**
 * Under the careers table. The same refusal the module's header gives, in
 * the page's words.
 */
export const COMPARE_CAVEAT =
  'Side by side, not a ranking. Careers ran different lengths, in different eras, under points systems that paid ' +
  'differently and in cars that were not equal; these figures say what each driver did, and not who was better. ' +
  'Points scored adds up every point from the Grands Prix, before any dropped scores and without Sprint points.'

/**
 * A SUM over no matching entry is the zero. DERIVED's SUM of a comparison is
 * NULL for a career in which no entry matched - a driver never classified
 * has no win, not an unknown number of them - which is strip()'s reading in
 * queries/driver.js. None of these reads a stored column.
 */
const count = (value) => number(value ?? 0)

/**
 * The careers, figure by figure: one row per figure, one column per driver.
 * Seasons and titles are the register's, as on the driver page's strip; the
 * rest are counted from the race records by DERIVED.
 */
export function careerRows(a, derivedA, b, derivedB) {
  const row = (figure, read) => ({ figure, a: read(a, derivedA), b: read(b, derivedB) })
  return [
    row('Seasons', (driver) => span(driver.first_season, driver.last_season)),
    row('Entries', (_, derived) => count(derived.entries)),
    row('Starts', (_, derived) => count(derived.starts)),
    row('Wins', (_, derived) => count(derived.wins)),
    row('Podiums', (_, derived) => count(derived.podiums)),
    row('Poles', (_, derived) => count(derived.poles)),
    row('Fastest laps', (_, derived) => count(derived.fastest_laps)),
    // The register's count: 0 for a driver who never won one, and the
    // stored figure the driver page's Titles tile shows.
    row('Titles', (driver) => text(driver.titles)),
    row('Best finish', (_, derived) => (derived.best ? `P${derived.best}` : 'none classified')),
    row('Points scored', (_, derived) => (derived.entries ? points(derived.points) : '0')),
  ]
}

/** The careers table's columns: the figure names the row, each driver heads a column. */
export const careerColumns = (nameA, nameB) => [
  { key: 'figure', rowHeader: true, label: 'Career' },
  { key: 'a', label: nameA, align: 'num' },
  { key: 'b', label: nameB, align: 'num' },
]

const plural = (n, one, many = `${one}s`) => `${number(n)} ${n === 1 ? one : many}`

const listed = (names) =>
  names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * The head-to-head as a sentence, over every season the pair shared a
 * constructor: TEAM_MATES's rows for the pair, added up. The same three
 * figures as the table under it, in the same order and with the same
 * denominators, so the sentence is the table's total and not a second
 * reading of it.
 */
export function pairSummary(nameA, nameB, rows) {
  if (!rows.length) return null
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0)
  const years = [...new Set(rows.map((row) => row.year))].sort((x, y) => x - y)
  const teams = [...new Set([...rows].sort((x, y) => x.year - y.year).map((row) => row.constructor))]
  // A race where either lacks a qualifying position is on neither side, so
  // the clause goes where no race has one for both - not a 0 and 0.
  const qualified = sum('both_qualified')
    ? ` In qualifying ${nameA} was ahead ${plural(sum('qualified_ahead'), 'time')} and ${nameB} ${plural(sum('qualified_behind'), 'time')}.`
    : ''
  const classified = sum('both_classified')
  // A tie is a shared drive: two drivers credited with one car's result,
  // which is in the count of races both were classified in and on neither
  // side of it. Said, so the two figures are seen not to add up by design.
  const ties = classified - sum('finished_ahead') - sum('finished_behind')
  const tied = ties > 0 ? `; ${ties === 1 ? 'one was a tie, a car' : `${number(ties)} were ties, cars`} the two shared` : ''
  const raced = classified
    ? ` Of the ${plural(classified, 'race')} both were classified in, ${nameA} finished ahead in ${number(sum('finished_ahead'))} and ${nameB} in ${number(sum('finished_behind'))}${tied}.`
    : ' They were never both classified in the same race.'
  const scored = (value) => `${points(value)} ${value === 1 ? 'point' : 'points'}`
  return (
    `Team-mates in ${plural(sum('races'), 'Grand Prix', 'Grands Prix')} at ${listed(teams)}, in ${yearList(years.join(','))}.` +
    `${qualified}${raced} From those Grands Prix ${nameA} scored ${scored(sum('points'))} and ${nameB} ${scored(sum('mate_points'))}.`
  )
}

/** Where the pair never shared a constructor in a race: a fact about the record, not a gap in it. */
export const neverTeamMates = (nameA, nameB) =>
  `${nameA} and ${nameB} were never team-mates on this record: no Grand Prix has both entered for the same constructor.`

/**
 * The drivers one driver shared most Grands Prix with, for the page before a
 * second driver is chosen: TEAM_MATES's rows folded to one per team-mate,
 * most races together first, then by name. At most `limit` of them.
 */
export function closestTeamMates(rows, limit = 10) {
  const byMate = new Map()
  for (const row of rows) {
    const held = byMate.get(row.mate_id) ?? { id: row.mate_id, name: row.mate, races: 0 }
    held.races += row.races
    byMate.set(row.mate_id, held)
  }
  return [...byMate.values()].sort((x, y) => y.races - x.races || x.name.localeCompare(y.name)).slice(0, limit)
}

/** Above the list of team-mates offered as the second driver. */
export const closestNote = (name, shown, total) =>
  shown < total
    ? `The ${number(shown)} of ${name}’s ${number(total)} team-mates who shared most Grands Prix with them, each a comparison. Or choose any second driver above.`
    : `Every team-mate ${name} had on this record, most Grands Prix together first, each a comparison. Or choose any second driver above.`

/** A driver no other driver was ever entered beside for the same constructor. */
export const noTeamMate = (name) => `${name} had no team-mate on this record. Choose any second driver above.`

/** The picker's empty option, and what a pair of one driver twice is told. */
export const CHOOSE = 'Choose a driver'
export const SAME_DRIVER = 'That is the same driver twice. Choose a second, different driver.'

/** The way from a driver's Team-mates section to this page, in both renderers. */
export const compareWith = (name) => `Compare ${name} with any other driver`

/** The static page's description: one sentence for a search result. */
export const COMPARE_DESCRIPTION =
  'Two Formula One drivers side by side: their careers counted from the race records, and how they fared as team-mates in the same Grands Prix.'
