/**
 * How values are written down.
 *
 * The one rule everything else follows: a NULL in this database means "not
 * established" — never zero, never an empty string, never a guess. It renders
 * as an em dash so that a missing figure reads as missing rather than as a
 * hole in the layout, and nothing here ever coalesces one to 0.
 */
export const EMPTY = '—'

export const missing = (value) => value === null || value === undefined || value === ''

export function text(value) {
  if (missing(value)) return EMPTY
  if (typeof value === 'number') return number(value)
  return String(value)
}

/** Integers plain, fractions to three places at most, thousands separated. */
export function number(value) {
  if (missing(value) || typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  return Number.isInteger(value)
    ? value.toLocaleString('en-GB')
    : Number(value.toFixed(3)).toLocaleString('en-GB')
}

/** Championship points: 24, 25.5, 0.5 — never 25.000. */
export function points(value) {
  if (missing(value) || typeof value !== 'number') return EMPTY
  return Number(value.toFixed(2)).toLocaleString('en-GB')
}

/** A share, given a numerator and a denominator that may be zero. */
export function percent(part, whole, places = 1) {
  if (!whole) return EMPTY
  return `${((part / whole) * 100).toFixed(places)}%`
}

/** "1950–2026", "1950–", "1950". The dash is an en dash, as a span should be. */
export function span(from, to) {
  if (missing(from) && missing(to)) return EMPTY
  if (!missing(from) && !missing(to)) return from === to ? String(from) : `${from}–${to}`
  if (missing(to)) return `${from}–`
  return String(to)
}

export function bytes(n) {
  if (!n) return EMPTY
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * A race result as it is written in a classification.
 *
 * position_text carries what the source actually printed — a number, DNF, DSQ,
 * NC, DNQ, DNPQ — and finish_position is NULL for all but the numbers. Showing
 * the text is the honest rendering: a driver who did not finish did not finish
 * in no position, they did not finish.
 */
export function result(entry) {
  if (!missing(entry.position_text)) return String(entry.position_text)
  if (!missing(entry.finish_position)) return String(entry.finish_position)
  return EMPTY
}

/** Sorting key for a classification: finishers in order, then everyone else. */
export function classificationOrder(entry) {
  if (!missing(entry.finish_position)) return entry.finish_position
  if (!missing(entry.laps_completed)) return 1000 - entry.laps_completed
  return 9999
}

/** Sentence-case a snake_case column name, keeping the initialisms upright. */
export function label(column) {
  return String(column)
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bGp\b/g, 'GP')
    .replace(/\bId\b/g, 'ID')
    .replace(/\bKm\b/g, 'km')
    .replace(/\bMm\b/g, 'mm')
    .replace(/\bKg\b/g, 'kg')
    .replace(/\bBhp\b/g, 'bhp')
    .replace(/\bCc\b/g, 'cc')
    .replace(/\bQ1\b/g, 'Q1')
    .replace(/\bSql\b/g, 'SQL')
    .replace(/\bPct\b/g, '%')
}

/** Whether a column of results holds numbers, and so should be set right. */
export function isNumericColumn(rows, column) {
  for (const row of rows) {
    const value = row[column]
    if (missing(value)) continue
    return typeof value === 'number'
  }
  return false
}

/**
 * Whether a column holds prose rather than a label.
 *
 * Names and countries stay on one line — wrapping "United Kingdom" in a table
 * with room to spare makes every row two lines tall for nothing. Assessments
 * and gap descriptions must wrap or they push the rest of the table off the
 * screen. The content decides, because the same component renders a register
 * and an arbitrary SQL result, and the second has no schema to consult.
 */
const PROSE_AT = 60

export function isProseColumn(rows, column) {
  return rows.some((row) => typeof row[column] === 'string' && row[column].length > PROSE_AT)
}

/** A URL's host, for showing a source without showing 120 characters of it. */
export function host(url) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return String(url ?? '')
  }
}
