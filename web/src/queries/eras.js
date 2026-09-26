/**
 * The eras page: its queries and its seven tables' columns, read by Eras.jsx
 * and by scripts/prerender.js (PD-02, rung six).
 *
 * WHY THIS FILE EXISTS
 *     The static page carried the ten eras as sections and none of the seven
 *     tables the app draws beneath them — engine formulae, scoring systems,
 *     regulation changes and limits, innovations, governance, tyre suppliers.
 *     The definitions live here once, and each ORDER BY is the order the
 *     app's table opens in, so the static page prints the rows as they come.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { span, text } from '../lib/format.js'

export const ERAS = 'SELECT * FROM eras ORDER BY from_year'
export const ENGINES = 'SELECT * FROM engine_eras ORDER BY from_year, id'
export const POINTS = 'SELECT * FROM points_systems ORDER BY from_year, id'
// Newest first, as the app opens; within a year, in the order they were filed.
export const REGULATIONS = 'SELECT * FROM regulation_changes ORDER BY year DESC, id'
export const INNOVATIONS = 'SELECT * FROM technical_innovations ORDER BY year, id'
export const SAFETY = 'SELECT * FROM safety_milestones ORDER BY year, id'
export const GOVERNANCE = 'SELECT * FROM governance ORDER BY year, id'
export const TYRES = 'SELECT * FROM tyre_suppliers ORDER BY from_year, id'
export const LIMITS = 'SELECT * FROM v_regulation_limits ORDER BY from_year DESC, field'

const years = (_, row) => span(row.from_year, row.to_year)

/** "1.5 L supercharged / 4.5 L 1947–1953": the era's name and its years, as the app's two-line cell reads. */
export const eraCell = (name, row) => `${text(name)} ${span(row.from_year, row.to_year)}`

export const ENGINE_COLUMNS = [
  { key: 'era_name', rowHeader: true, label: 'Era', text: eraCell },
  { key: 'formula', label: 'Formula', align: 'prose' },
  { key: 'typical_config', label: 'Typical' },
  { key: 'approx_power_bhp', label: 'Power (bhp)', align: 'num' },
  { key: 'rev_limit', label: 'Revs', align: 'num' },
  { key: 'notes', label: 'Notes', align: 'prose' },
]

export const POINTS_COLUMNS = [
  { key: 'from_year', rowHeader: true, label: 'Years', align: 'num', text: years },
  // Two period tables in one (DA-18): a sprint row overlaps the Grand Prix
  // row of the same seasons, and this is what says which it is.
  { key: 'session', label: 'Session', text: (session) => (session === 'sprint' ? 'Sprint' : 'Grand Prix') },
  { key: 'scoring', label: 'Scoring', align: 'prose' },
  { key: 'fastest_lap', label: 'Fastest lap' },
  { key: 'dropped_scores', label: 'Dropped scores', align: 'prose' },
  { key: 'notes', label: 'Notes', align: 'prose' },
]

export const POINTS_NOTE =
  "Read this before comparing points across eras: until 1990 only a driver's best few results counted, so a published career total can be lower than the points actually scored."

export const REGULATION_COLUMNS = [
  { key: 'year', label: 'Year', align: 'num', text: (year) => String(year) },
  { key: 'category', label: 'Category' },
  { key: 'title', rowHeader: true, label: 'Change' },
  { key: 'detail', label: 'Detail', align: 'prose' },
  { key: 'impact', label: 'Impact', align: 'prose' },
]

export const LIMIT_COLUMNS = [
  { key: 'field', rowHeader: true, label: 'Limit' },
  { key: 'from_year', rowHeader: true, label: 'Years', align: 'num', text: years },
  { key: 'value', label: 'Value', align: 'num' },
  { key: 'unit', label: 'Unit' },
  { key: 'note', label: 'Note', align: 'prose' },
]

export const LIMITS_NOTE =
  'The numeric limits the regulations set for a season — on the car, and on the weekend: tyre sets, classification, the 107% rule, the cost cap. They are kept here rather than on each car, because a rule several teams quote is not a measurement of any one of them.'

export const INNOVATION_COLUMNS = [
  { key: 'year', label: 'Year', align: 'num', text: (year) => String(year) },
  { key: 'innovation', rowHeader: true, label: 'Innovation' },
  { key: 'originator', label: 'Originator' },
  { key: 'description', label: 'What it was', align: 'prose' },
  { key: 'legacy', label: 'What became of it', align: 'prose' },
  { key: 'banned_year', label: 'Banned', align: 'num', text: (year) => text(year === null || year === undefined ? null : String(year)) },
]

export const GOVERNANCE_COLUMNS = [
  { key: 'year', label: 'Year', align: 'num', text: (year) => String(year) },
  { key: 'event', rowHeader: true, label: 'Event' },
  { key: 'detail', label: 'Detail', align: 'prose' },
  { key: 'significance', label: 'Why it mattered', align: 'prose' },
]

export const TYRE_COLUMNS = [
  { key: 'supplier', rowHeader: true, label: 'Supplier' },
  { key: 'from_year', rowHeader: true, label: 'Years', align: 'num', text: years },
  { key: 'exclusive', label: 'Sole supplier', align: 'num', text: (value) => (value ? 'yes' : 'no') },
  { key: 'notes', label: 'Notes', align: 'prose' },
]
