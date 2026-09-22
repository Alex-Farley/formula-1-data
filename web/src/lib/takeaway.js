/**
 * A table, as a file (IX-26).
 *
 * Until now nothing on this site could be taken out of it: no `clipboard`, no
 * `download`, no share. A reader who had filtered 862 drivers to the 73 French
 * ones could read the answer and do nothing else with it. Every table the site
 * draws goes through components/DataTable.jsx, so the way out is one component
 * and one pair of functions here.
 *
 * WHAT GOES IN THE FILE, AND WHY IT IS NOT QUITE WHAT IS ON SCREEN
 *
 * Three deliberate differences from the rendered cell, each because a file
 * leaves the page and has to stand on its own:
 *
 *   1. NUMBERS ARE UNFORMATTED. The table prints 1,950 and 27,482 because a
 *      reader is reading them; a spreadsheet reading "27,482" gets a string,
 *      and a CSV reading it gets two columns. This is the same rule the SQL
 *      console already applies on screen with `raw` — data as data.
 *
 *   2. A COLLAPSED COLUMN COMES BACK. VD-29 drops a column every row agrees on
 *      and states it once in a sentence above the table. That sentence is on
 *      the page; the file is not. A CSV of Monza's 76 races with no *Race*
 *      column because all 76 say "Italian Grand Prix" is a CSV nobody can use,
 *      so the file carries every column the table was given.
 *
 *   3. A COLUMN THAT IS DRAWN RATHER THAN WRITTEN IS LEFT OUT. The result rail
 *      on a classification is a column whose own formatter returns the empty
 *      string — it is a block of colour, and its meaning is already in the
 *      *Result* column beside it. A column that prints nothing on every row is
 *      not data, and an all-blank column in a file is noise.
 *
 * AN EM DASH TRAVELS AS AN EM DASH. A NULL here means "not established", never
 * zero and never an empty string (lib/format.js), and an empty CSV field is
 * exactly the reading that rule exists to prevent. The file says the same
 * thing the table said.
 *
 * The values are otherwise the strings the table shows, from each column's own
 * `text` formatter where it has one — the same formatter scripts/prerender.js
 * prints — so the file and the page cannot disagree about what a cell says.
 */
import { EMPTY, label as humanise, missing } from './format.js'

/** The header a column carries into a file: the header the table shows. */
export const headerOf = (column) => column.label ?? humanise(column.key)

/**
 * One cell as a file carries it: the column's own formatter where it has one,
 * the value itself where it does not, and an em dash for a value nobody has
 * established. Numbers go in unformatted — see the note above.
 */
export function fieldText(column, row) {
  const value = row[column.key]
  if (column.text) {
    const written = column.text(value, row)
    return written === null || written === undefined ? '' : String(written)
  }
  if (missing(value)) return EMPTY
  return String(value)
}

/**
 * The columns a file carries, in the table's order: everything the table was
 * given, less any column that prints nothing at all.
 */
export const writtenColumns = (columns, rows) =>
  columns.filter((column) => rows.some((row) => fieldText(column, row) !== ''))

/**
 * RFC 4180: quote a field holding a comma, a quote or a line break, and double
 * the quotes inside it. Leading or trailing space is quoted too, because a
 * reader who opens the file in something that trims is looking at different
 * data from the one who does not.
 */
const csvField = (value) =>
  /[",\r\n]/.test(value) || value !== value.trim() ? `"${value.replace(/"/g, '""')}"` : value

/**
 * A clipboard paste has no quoting a spreadsheet agrees on: Excel, Numbers and
 * Sheets all split a pasted tab and a pasted newline whatever is around them.
 * So a field that holds one loses it to a space rather than silently becoming
 * two cells. Only the prose columns — an assessment, a gap description — are
 * ever long enough for this to reach.
 */
const tsvField = (value) => value.replace(/[\t\r\n]+/g, ' ')

const rowsOf = (columns, rows, field, separator) =>
  [
    columns.map((column) => field(headerOf(column))).join(separator),
    ...rows.map((row) => columns.map((column) => field(fieldText(column, row))).join(separator)),
  ]

/**
 * Tab-separated, for the clipboard. No byte-order mark and no trailing
 * newline: this is a paste, not a file, and a trailing newline pastes an empty
 * row under the data.
 */
export const toTsv = (columns, rows) =>
  rowsOf(columns, rows, tsvField, '\t').join('\n')

/**
 * Comma-separated, for the download. CRLF because that is what RFC 4180 says
 * and every reader of CSV accepts it.
 *
 * The leading U+FEFF is not decoration. Excel opens a UTF-8 CSV without one as
 * the local code page, and this database is full of Räikkönen, Nürburgring and
 * the em dash that means "not established" — all of which arrive as mojibake
 * for a large share of the people this button exists for. Every tool that
 * reads CSV handles the mark; a spreadsheet that mangles every accented name
 * is the failure that matters.
 */
export const toCsv = (columns, rows) =>
  `﻿${rowsOf(columns, rows, csvField, ',').join('\r\n')}\r\n`

/**
 * What the file is called: the table's own name, the database version that
 * fixes which figures are in it, and the extension.
 *
 * The version is there for the reason lib/site.js's citation() gives — "the
 * version and build date fix which figures you saw" — and a file that travels
 * is the one artefact from this site that carries no page around it to say so.
 */
export function fileName(name, version, extension) {
  const slug = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return ['lap-ledger', slug || 'table', version ? `v${version}` : null]
    .filter(Boolean)
    .join('-')
    .concat(`.${extension}`)
}
