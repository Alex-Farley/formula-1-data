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

/*
 * Eras as an axis (IA-25): an address of their own, /eras/<first season>,
 * and a filter on the drivers, constructors and cars registers, `?era=` with
 * the same key.
 *
 * The key is the era's first season and not `eras.id`, which build.py numbers
 * by position in data/technical.py: an era inserted before another would
 * renumber every one after it, and a cited /eras/8 would quietly become a
 * different era. scripts/prerender.js refuses two eras that start in the same
 * season, since they would be one address.
 */

/** The era's key: its address, and its value in a register's `?era=`. */
export const eraKey = (era) => String(era.from_year)

/** The era's page. */
export const eraPath = (era) => `/eras/${era.from_year}`

/** The era whose page `key` is, or null: the address takes the first season alone. */
export const eraByKey = (eras, key) => eras.find((era) => eraKey(era) === String(key)) ?? null

/** Does a season fall in the era? One with no last season is still running. */
export const inEra = (era, year) =>
  year !== null && year !== undefined && year >= era.from_year && (missingYear(era.to_year) || year <= era.to_year)

/**
 * Does a span of seasons touch the era? A span with no last season is open,
 * and one with no first season is not established, so it touches none.
 */
export const touchesEra = (era, from, to) =>
  !missingYear(from) && (missingYear(era.to_year) || from <= era.to_year) && (missingYear(to) || to >= era.from_year)

const missingYear = (year) => year === null || year === undefined

/** The rows of a table that fall in the era, by a season column. */
export const rowsInEra = (era, rows, key = 'year') => rows.filter((row) => inEra(era, row[key]))

/** The rows whose own span of seasons touches the era. */
export const rowsTouchingEra = (era, rows, from = 'from_year', to = 'to_year') =>
  rows.filter((row) => touchesEra(era, row[from], row[to]))

/** "The hybrid era, 2014–2021": an era as one select option names it. */
export const eraLabel = (era) => `${era.era_name}, ${span(era.from_year, era.to_year)}`

/** The register's `?era=` select: one option per era, oldest first. */
export const eraOptions = (eras) => eras.map((era) => [eraKey(era), eraLabel(era)])

/**
 * The era as the tail of a register's empty-state phrase (IX-28): "in
 * 2014–2021", or "since 2026" for the one still running.
 */
export const eraWhen = (era) =>
  missingYear(era.to_year) ? `since ${era.from_year}` : `in ${span(era.from_year, era.to_year)}`

/**
 * The eras a driver or constructor raced in, as their keys, comma-separated:
 * the column the register's era filter reads. `entry` is the condition that
 * picks the row's race entries out of `race_entries e`; `first` and `last`
 * are the span the register prints.
 *
 * A season with a race entry in it decides, because a span hides a gap: Alfa
 * Romeo's runs 1950-1985 and it entered no race from 1952 to 1978. A row
 * with no race entry at all - a Friday driver who never started one, or Rob
 * Walker Racing, whose cars were other makers' - has only its span, and the
 * span stands in. A row with neither is in no era, because nothing says
 * which.
 */
export const erasRaced = (entry, first, last) => `
  (SELECT group_concat(er.from_year) FROM eras er
    WHERE CASE WHEN EXISTS (SELECT 1 FROM race_entries e WHERE ${entry})
               THEN EXISTS (SELECT 1 FROM race_entries e JOIN races r ON r.id = e.race_id
                             WHERE ${entry} AND r.year >= er.from_year
                               AND (er.to_year IS NULL OR r.year <= er.to_year))
               ELSE ${first} IS NOT NULL AND (er.to_year IS NULL OR ${first} <= er.to_year)
                    AND (${last} IS NULL OR ${last} >= er.from_year)
          END)`

/**
 * An era's page, in both renderers (IA-25): the era's two lines as fields,
 * then its slice of the chronology /eras holds whole - its seasons, the
 * engine formulae that ran in them, and the regulation changes, innovations
 * and safety milestones dated in them - each from the query /eras draws it
 * from, under the heading it has there. A slice with nothing in it keeps its
 * heading and says so.
 */
export const ERA_FIELDS = [
  ['dominant_teams', 'Dominant'],
  ['defining_features', 'Technology'],
]
export const ERA_SEASONS_TITLE = 'The seasons'
export const ERA_EMPTY = 'None recorded for these seasons.'
export const eraDescription = (era) =>
  `${era.era_name}, ${span(era.from_year, era.to_year)}: the seasons, engine formulae, regulation changes, technical innovations and safety milestones of one era of Formula One.`

/** Is the register row, carrying `erasRaced` as `eras_raced`, in the era? */
export const racedIn = (row, key) => String(row.eras_raced ?? '').split(',').includes(String(key))

/**
 * The eras as one timeline section, in both renderers (VD-87): its heading,
 * the note it carries where every era shares one tier, and the two labelled
 * lines under each era's summary. The static page drew each era as an h2
 * section of its own.
 */
export const ERAS_TITLE = 'Ten eras'
export const erasTiers = (eras) => [...new Set(eras.map((e) => e.confidence))]
export const erasNote = (tiers) =>
  tiers.length === 1 ? `Each era carries the ${tiers[0]} tier: the boundaries are the conventional ones, not a measurement.` : null
export const ERA_LINES = [
  ['dominant_teams', 'Dominant:'],
  ['defining_features', 'Technology:'],
]
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

/**
 * The page's lede, under its h1 in both renderers (VD-79): the app's words,
 * read by pages/Eras.jsx and by scripts/prerender.js, where the static page
 * used to open on a sentence of its own and swap it at the handover.
 */
export const ERAS_LEDE =
  'Formula One is a rule set that keeps being rewritten, and most of what changed about the cars follows from that. Here is the chronology: what the rules were, what someone invented to get round them, and what was banned afterwards.'
