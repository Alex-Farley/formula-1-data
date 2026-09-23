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

import { distance } from './search.js'
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
 *
 * The body's opening bracket is required, or the second branch matches an
 * ordinary column alias - `SELECT id, laps AS n FROM laps` reads the empty
 * table and must be told so.
 */
const shadowedByCte = (statement, table) =>
  new RegExp(
    `(?:\\bwith\\b|,)\\s*(?:recursive\\s+)?${QUOTE}?${table}${UNQUOTE}?\\s*(?:\\([^()]*\\))?\\s*\\bas\\s*\\(`,
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

/**
 * The console's refusal before a statement runs, or null to run it.
 *
 * A courtesy, not the guarantee. The guarantee is that every statement runs
 * inside a transaction that is rolled back - see the worker. This only
 * catches the obvious case early so that a reader who types DELETE gets an
 * explanation rather than an empty result and a false sense of what happened.
 *
 * And it answers what was typed. `SELEC 1` used to be told that a write would
 * be rolled back, which is a lecture to somebody who made a typo (IX-25).
 */
export function complaint(sql) {
  const stripped = bare(sql).trim()
  if (!stripped) return 'Nothing to run.'
  if (!/^(select|with|explain|pragma|values)\b/i.test(stripped)) {
    const word = stripped.match(/^[a-z_][a-z0-9_]*/i)?.[0]
    const near = word ? nearestStatement(word) : null
    if (near && READS.includes(near)) {
      return `Did you mean ${near.toUpperCase()}? No statement starts with “${word}”, so nothing ran.`
    }
    if (near) {
      return 'Reads only: start with SELECT, WITH, VALUES, EXPLAIN or PRAGMA. A write would be rolled back anyway, so nothing has changed.'
    }
    const opening = word ?? stripped[0]
    return `No statement starts with “${opening}”, so nothing ran. A read starts with SELECT, WITH, VALUES, EXPLAIN or PRAGMA.`
  }
  // The rollback does not cover pragmas. A PRAGMA is not transactional, so
  // `PRAGMA case_sensitive_like = ON` survives the ROLLBACK and silently
  // changes every later query in the tab - which is exactly the guarantee this
  // page makes. The introspection pragmas below only read, so they keep
  // working; anything else is refused rather than quietly breaking the promise.
  if (/^pragma\b/i.test(stripped) && !INTROSPECTION.test(stripped)) {
    return 'That pragma can change how later queries behave, and a pragma is not undone by the rollback. Introspection pragmas (table_info, index_list, foreign_key_list and the like) are fine.'
  }
  return null
}

// Read-only, row-returning pragmas: they report on the schema and change no
// setting, so nothing survives the statement to affect the next one.
const INTROSPECTION =
  /^pragma\s+(table_info|table_xinfo|table_list|index_list|index_info|index_xinfo|foreign_key_list|database_list|collation_list|compile_options|function_list|pragma_list|module_list)\b/i

// The words a statement may start with here, and every other word SQLite
// starts one with. The second list is here so that a near miss is read as the
// statement it is nearest: `DELET` is two edits from SELECT and one from
// DELETE, and the reader who typed it was not trying to read.
const READS = ['select', 'with', 'values', 'explain', 'pragma']
const OTHERS = [
  'alter', 'analyze', 'attach', 'begin', 'commit', 'create', 'delete', 'detach', 'drop', 'end',
  'insert', 'reindex', 'release', 'replace', 'rollback', 'savepoint', 'update', 'vacuum',
]

/**
 * The statement keyword `word` is a near miss of, or null. Two edits, a swap
 * of neighbours counting as one; one for a keyword of four letters or fewer,
 * where two would leave half the word (`it` is two from WITH). A word as near
 * one keyword as another is not guessed at, and a tie that includes a write
 * is not read as a read.
 */
export function nearestStatement(word) {
  const typed = word.toLowerCase()
  let best = null
  let bestDistance = Infinity
  let tied = false
  for (const keyword of [...READS, ...OTHERS]) {
    const most = keyword.length <= 4 ? 1 : 2
    const d = distance(typed, keyword, most)
    if (d > most) continue
    if (d < bestDistance) {
      best = keyword
      bestDistance = d
      tied = false
    } else if (d === bestDistance) {
      tied = true
      if (!READS.includes(keyword)) best = keyword
    }
  }
  if (tied && READS.includes(best)) return null
  return best
}
