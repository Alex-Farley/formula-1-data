/**
 * The data page's figures, as data both renderers read (VD-49).
 *
 * Data.jsx wrote its two tile strips inline in JSX, so scripts/prerender.js
 * opened the same page on two key/value lists of its own, with its own copy
 * of the query behind them. The query and both strips live here, and the
 * page and the script each draw them.
 */
import { number } from '../lib/format.js'
import { REPOSITORY } from '../lib/site.js'

/** How big the file is, and how much of it is the record of its own doubts. */
export const SHAPE = `SELECT
       (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table') AS tables,
       (SELECT COUNT(*) FROM sqlite_master WHERE type = 'view')  AS views,
       (SELECT COUNT(*) FROM source_registry)                    AS sources,
       (SELECT COUNT(*) FROM discrepancies)                      AS discrepancies,
       (SELECT COUNT(*) FROM discrepancies WHERE status = 'open')     AS open_discrepancies,
       (SELECT COUNT(*) FROM v_open_gaps)                        AS gaps,
       (SELECT COUNT(*) FROM races)                              AS races,
       (SELECT COUNT(*) FROM race_entries)                       AS entries,
       (SELECT COUNT(*) FROM laps) + (SELECT COUNT(*) FROM stints)
         + (SELECT COUNT(*) FROM race_timing)
         + (SELECT COUNT(*) FROM race_control_messages)          AS timing_rows`

/**
 * What the file is: its version and build date, read from its own `meta`
 * table as the footer's are, so the page can never describe a version other
 * than the one it is running on - and how much it holds.
 */
export const fileStrip = (meta, shape) => [
  { label: 'Database', value: meta.version ? `v${meta.version}` : null, note: 'meta.version' },
  { label: 'Built', value: meta.built ?? null, note: 'meta.built', date: true },
  { label: 'Covers', value: meta.coverage_seasons ?? null },
  { label: 'Tables', value: number(shape.tables), note: `and ${number(shape.views)} views` },
  { label: 'Races', value: number(shape.races), note: `${number(shape.entries)} race entries` },
]

/**
 * Which ids a reader may keep (DA-25): the three `meta` rows DA-04 published,
 * as the file states them. `note` is meta.id_stability's sentence; `stable`
 * the tables meta.id_stability_stable names, whose ids are not renumbered;
 * `keys` each natural key meta.id_stability_keys publishes. A row the file
 * does not carry is null, not established, and drawn as the em dash; an
 * empty one is a list of none, which the build writes when no table is
 * declared stable.
 */
export const idPolicy = (meta) => {
  const list = (value, separator) =>
    value === null || value === undefined
      ? null
      : String(value)
          .split(separator)
          .map((part) => part.trim())
          .filter(Boolean)
  return {
    note: meta.id_stability ?? null,
    stable: list(meta.id_stability_stable, ','),
    keys: list(meta.id_stability_keys, ';'),
  }
}

/** The section's heading, its intro, and where a reader goes for more. */
export const ID_HEADING = 'Which ids you may keep'
export const ID_INTRO =
  'For anyone who keeps an id from one release to join on in the next. The file states its own ' +
  'policy in three rows of its meta table, and this is what they say.'
export const ID_QUERY = "SELECT key, value FROM meta WHERE key LIKE 'id_stability%'"
export const ID_README = `${REPOSITORY}/blob/main/README.md#identifiers`

/**
 * A sentence from `meta` cut at its backticks, which mark code in it - `id`,
 * a `?` - so each renderer can set those pieces as code rather than print
 * the marks.
 */
export const codeSpans = (text) => String(text).split('`').map((part, i) => ({ text: part, code: i % 2 === 1 }))

/** How far to trust it: what is disputed, what is missing, and who says so. */
export const trustStrip = (shape) => [
  {
    label: 'Disagreements on record',
    value: number(shape.discrepancies),
    note: `${number(shape.open_discrepancies)} still open`,
  },
  { label: 'Open gaps', value: number(shape.gaps), note: 'and what would close each' },
  { label: 'Sources', value: number(shape.sources), note: 'each with its licence' },
]
