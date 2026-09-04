/**
 * A NULL in this database means "not established" — never zero, never an
 * empty string. It is rendered as an em dash everywhere so that a missing
 * figure reads as missing rather than as a gap in the layout.
 */
export const EMPTY = '—'

export function cell(value) {
  if (value === null || value === undefined || value === '') return EMPTY
  if (typeof value === 'number') return numeric(value)
  return String(value)
}

export function numeric(n) {
  if (n === null || n === undefined) return EMPTY
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))
}

/** Whether a column should be right-aligned and set in tabular figures. */
export function isNumericColumn(rows, column) {
  for (const row of rows) {
    const v = row[column]
    if (v === null || v === undefined) continue
    return typeof v === 'number'
  }
  return false
}

/**
 * Whether a column holds prose rather than a label.
 *
 * Names, countries and circuits should stay on one line — wrapping "United
 * Kingdom" in a table with room to spare just makes every row two lines tall.
 * Gap descriptions and design notes must wrap or they push the rest of the
 * table off screen. The content decides, since the same table component
 * renders both, and an arbitrary SQL result has no schema to consult.
 */
const PROSE_AT = 60

export function isProseColumn(rows, column) {
  return rows.some((row) => typeof row[column] === 'string' && row[column].length > PROSE_AT)
}

/** "1950–2026", "1950–", "1950" — a span written the way the README writes it. */
export function span(from, to) {
  if (!from && !to) return EMPTY
  if (from && to) return from === to ? String(from) : `${from}–${to}`
  return `${from ?? to}${from ? '–' : ''}`
}

/**
 * The confidence ladder, as a class name. The database records how good every
 * fact is; hiding that in the UI would misrepresent it.
 */
export function confidenceClass(confidence) {
  return `pill pill-${confidence ?? 'unknown'}`
}
