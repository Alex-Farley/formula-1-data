/**
 * Reading a reader's own SQL well enough to answer it honestly.
 *
 * The console has to say something when a statement matches nothing, and the
 * honest answer depends on what was asked for: `SELECT * FROM laps` matched
 * nothing because `laps` is empty by licence (CD-05, and site.js's
 * `timingEmpty`), while every other empty result means what the ordinary
 * message says. Getting that wrong in the confident direction - telling a
 * reader about a licence position their query never touched - is worse than
 * not answering at all, which is why this lives here with a test around it
 * rather than as a regular expression inside a page.
 */

import { TIMING_EMPTY_TABLES } from './site.js'

/**
 * A statement with its comments and its string literals emptied out.
 *
 * Both readers want this rather than the raw text: the console's read-only
 * courtesy must not be fooled by a DELETE behind a comment, and the timing
 * test must not read `-- from laps` or `LIKE '%from laps%'` as a read of an
 * empty table. The literals keep their quotes, so a statement that is only a
 * string is still not a SELECT.
 */
export const bare = (sql) =>
  sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")

// SQLite's four spellings of an identifier: bare, "quoted", `quoted`,
// [quoted]. The closing bracket differs from the opening one, so they are two
// classes rather than one.
const QUOTE = '["`\\[]'
const UNQUOTE = '["`\\]]'
const NAME = '[a-z_][a-z0-9_$]*'

/*
 * Only a FROM or a JOIN counts, never the bare name: `laps` is also a column
 * of race_entries, so `SELECT e.laps FROM race_entries e WHERE ...` matching
 * nothing keeps the ordinary message. A schema qualifier (`main.laps`) is the
 * same read, and the quote may follow FROM with no space at all.
 */
const TIMING_READ = new RegExp(
  `\\b(?:from|join)(?:\\s+|\\s*(?=${QUOTE}))` +
    `(?:${QUOTE}?${NAME}${UNQUOTE}?\\s*\\.\\s*)?` +
    `${QUOTE}?(${TIMING_EMPTY_TABLES.join('|')})\\b`,
  'i',
)

/*
 * A CTE named for one of the four shadows the table: the rows that matched
 * nothing are the reader's own, and the licence has nothing to do with them.
 */
const shadowedByCte = (statement, table) =>
  new RegExp(
    `(?:\\bwith\\b|,)\\s*(?:recursive\\s+)?${QUOTE}?${table}${UNQUOTE}?\\s*(?:\\([^()]*\\))?\\s*\\bas\\b`,
    'i',
  ).test(statement)

/**
 * Which of the four tables that are empty by licence does this statement
 * read, if any? The name, lower-cased, or null.
 */
export const emptyTimingTableRead = (sql) => {
  if (typeof sql !== 'string') return null
  const statement = bare(sql)
  const found = TIMING_READ.exec(statement)
  if (!found) return null
  const table = found[1].toLowerCase()
  return shadowedByCte(statement, table) ? null : table
}
