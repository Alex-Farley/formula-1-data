/**
 * The data page's figures, as data both renderers read (VD-49).
 *
 * Data.jsx wrote its two tile strips inline in JSX, so scripts/prerender.js
 * opened the same page on two key/value lists of its own, with its own copy
 * of the query behind them. The query and both strips live here, and the
 * page and the script each draw them.
 */
import { number } from '../lib/format.js'

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
