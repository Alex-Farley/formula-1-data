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
 * ONLY A COLUMN WHOSE CELL IS ITS TEXT.
 *     A cell with a render is more than the string it prints: the circuit
 *     page's *Grand Prix* column reads "Italian Grand Prix" on all 76 rows and
 *     links each one to a different race, and a driver's *Constructor* column
 *     carries a livery mark whose colour is that row's season. Collapsing
 *     either would throw away what varies while keeping what does not, so a
 *     column the page renders itself is left alone - `rendered` is how each
 *     renderer names its own: a React `render` in the app, an entry in
 *     prerender's `links` map.
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
 * `rendered(column)` is true where the renderer draws the cell itself. A
 * column can also refuse outright with `collapse: false` in its own spec,
 * which both renderers read from web/src/queries/*.
 */
export function shared(columns, rows, { rendered = () => false } = {}) {
  const none = { columns, shared: [] }
  if (rows.length < MIN_ROWS) return none
  const constant = columns.filter((column) => {
    if (column.collapse === false || rendered(column)) return false
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
