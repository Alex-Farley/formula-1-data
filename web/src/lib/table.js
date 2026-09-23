/**
 * A column that says the same thing on every row is not a column.
 *
 * Monza's 76 races carried "Italian Grand Prix" 76 times and an em dash under
 * *Layout* 76 times, two of five columns holding nothing a reader could use
 * (VD-29). The rule is the one queries/records.js already applied by hand to
 * the confidence tier: where every row shares a value, say it once above the
 * table and drop the column.
 *
 * Both renderers read this module - components/DataTable.jsx and
 * scripts/prerender.js - so the static table and the app's table lose the same
 * columns and print the same sentence, which is what smoke.mjs compares.
 *
 * A COLUMN DECLARES ITSELF, IN web/src/queries/*.
 *     The first version of this collapsed any column whose cells read alike
 *     and asked each renderer to protect its own: a React `render` in the app,
 *     an entry in prerender's `links` map. Those are two lists, and they are
 *     not the same list. The driver page's *Constructor* column has a render -
 *     the livery mark - and no link, so the static half collapsed it and the
 *     app could not: 32 driver pages shipped a nine-column table under a
 *     ten-column one, and the reader watched the table change shape as the
 *     database opened. `collapse: true` on the column itself is the one thing
 *     both halves read, so they cannot disagree.
 *
 *     It is a claim about the cell, and it is only true where the cell is its
 *     text: no link that differs row by row, no mark, no tag. It is also a
 *     claim about the value, because the sentence has to be readable on its
 *     own - "Pole - not established" under a season not yet run says the
 *     database is missing something, and an em dash on that column means the
 *     race has not happened. Declaring a column is a judgement, once, where
 *     the column is defined.
 */
import { EMPTY, label as humanise, text } from './format.js'

/**
 * A floor, because the rule is about noise and a short table has none: four
 * rows are read as one block, the repetition is visible for what it is, and a
 * reader moving between two driver pages should not find the second missing
 * the columns the first had over a coincidence. A one-row table would collapse
 * entirely.
 */
export const MIN_ROWS = 5

/** The string a column prints for a row: its own formatter, or the shared one. */
export const cellText = (column, row) =>
  column.text ? column.text(row[column.key], row) : text(row[column.key])

/**
 * Split a column list into the columns worth showing and the ones every row
 * agrees on, with the value each of those holds.
 *
 * Only a column whose spec says `collapse: true` is ever a candidate, and even
 * then only where every row prints the same cell.
 */
export function shared(columns, rows) {
  const none = { columns, shared: [] }
  if (rows.length < MIN_ROWS) return none
  const constant = columns.filter((column) => {
    if (column.collapse !== true) return false
    const first = cellText(column, rows[0])
    return rows.every((row) => cellText(column, row) === first)
  })
  // A table needs columns. Where collapsing would leave one, the table is
  // saying so little that a list of facts above an empty grid is worse than
  // the repetition, so nothing collapses.
  if (constant.length === 0 || columns.length - constant.length < 2) return none
  const dropped = new Set(constant)
  return {
    columns: columns.filter((column) => !dropped.has(column)),
    shared: constant.map((column) => ({ column, value: cellText(column, rows[0]) })),
  }
}

/**
 * The sentence above the table, as one string in both halves.
 *
 * An em dash in a cell means "not established"; in a sentence it has nothing
 * to be read against, so it is written out. `shared` only ever returns columns
 * whose cell is a plain string, which is why this can be a string and not a
 * node - the tier sentence in queries/records.js has to be two halves because
 * the app sets its value as a pill.
 */
export const sharedLine = (entries, count) =>
  `The same on all ${count.toLocaleString('en-GB')} rows: ${entries
    .map(({ column, value }) => `${column.label ?? humanise(column.key)} — ${value === EMPTY ? 'not established' : value}`)
    .join('; ')}.`

/**
 * Which columns a register shows (IA-23).
 *
 * A register's column list, in web/src/queries/*, is its FULL set. Two
 * smaller sets are declared on the columns themselves, so both renderers read
 * them from one place, as they read `collapse`:
 *
 *   `optional: true`  is in the full set and not the default. Neither renderer
 *                     draws it until a reader asks for it, so the static page
 *                     prints the default and the app opens on the same one.
 *   `phone: true`     is in the phone default, the three columns a register
 *                     opens on at `PHONE` width (IX-27, folded into IA-23). A
 *                     row header is always in it - it is the cell that says
 *                     which row this is, at any width - and a list that
 *                     declares no `phone` column has no phone set at all.
 *
 * The phone default is not a second column list: both renderers draw the
 * default and mark every column the phone set leaves out with `WIDE_ONLY`,
 * which app.css hides at the same width. So the static page and the app draw
 * one table, which is what smoke.mjs compares, and a phone that has not run a
 * line of script still opens on three columns rather than one and a fade.
 *
 * What a reader chooses is `?cols=`, the keys in the order the list declares
 * them (DataTable's AddressedTable), and a choice replaces both defaults at
 * every width: it is the table they asked for, and the one they can send.
 */

/** The width the phone default applies below. app.css says the same number. */
export const PHONE = '(max-width: 560px)'

/** The class on a column the phone default leaves out. */
export const WIDE_ONLY = 'wide-only'

/** The columns a table opens on where nobody has chosen. */
export const defaultColumns = (columns) => columns.filter((column) => column.optional !== true)

/** Is this column in the phone default of the list it belongs to? */
export const onPhone = (column, columns) =>
  column.rowHeader === true || column.phone === true || !columns.some((c) => c.phone === true)

/**
 * The keys `?cols=` names, as the list's own columns in the list's own order,
 * or null where it names none this list has - a parameter the data does not
 * vouch for falls back, as a filter's does (`oneOf` in lib/urlstate.js). The
 * row headers are always in: a table whose rows nobody can tell apart is not
 * a choice this control offers.
 */
export function chosenColumns(columns, param) {
  if (!param) return null
  const asked = new Set(String(param).split(','))
  const known = columns.filter((column) => column.ariaHidden !== true && asked.has(column.key))
  if (known.length === 0) return null
  return columns.filter((column) => column.rowHeader === true || known.includes(column))
}
