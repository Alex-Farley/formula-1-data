/**
 * The data-quality page: its queries and its tables' columns, read by
 * Quality.jsx and by scripts/prerender.js (PD-02, rung six).
 *
 * WHY THIS FILE EXISTS
 *     The static page carried the known gaps as sections and none of the
 *     tables the app draws around them — the confidence ladder, the
 *     disagreements kept rather than resolved, the career totals against
 *     published ones, the geometry coverage, the seasons whose results
 *     cannot be attributed to a car, the rows nobody has checked. The
 *     definitions live here once; each ORDER BY is the order the app's table
 *     opens in. The gaps stay as sections in the static half: their cell
 *     folds a disclosure the crawler should read whole.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { text } from '../lib/format.js'

export const PROVENANCE = 'SELECT * FROM provenance ORDER BY rank'
export const GAPS = 'SELECT * FROM known_gaps ORDER BY id'
// Case-insensitive by subject, then filed order: the order the app opens in.
export const DISCREPANCIES = 'SELECT * FROM discrepancies ORDER BY subject COLLATE NOCASE, id'
export const RECONCILIATION = 'SELECT * FROM v_stat_reconciliation ORDER BY derived_wins DESC, full_name'
export const UNVERIFIED = 'SELECT tbl, COUNT(*) AS n FROM v_unverified GROUP BY tbl ORDER BY n DESC, tbl'
export const AMBIGUOUS = 'SELECT * FROM v_ambiguous_seasons ORDER BY unlinked_entries DESC, year, constructor'
export const CHASSIS_COVERAGE = 'SELECT * FROM v_chassis_coverage ORDER BY decade'
export const GEOMETRY_COVERAGE = 'SELECT * FROM v_geometry_coverage'
export const IMAGES = `
  SELECT COUNT(*) AS total,
         SUM(name_matches = 1) AS named,
         SUM(name_matches = 0) AS unnamed,
         COUNT(DISTINCT licence) AS licences,
         (SELECT COUNT(*) FROM article_images WHERE route = 'category') AS catalogued
    FROM article_images
   WHERE route = 'article'
`
export const CONFIDENCE_MIX = `
  SELECT confidence, COUNT(*) AS n FROM (
      SELECT confidence FROM races
      UNION ALL SELECT confidence FROM race_entries
      UNION ALL SELECT confidence FROM drivers
      UNION ALL SELECT confidence FROM constructors
      UNION ALL SELECT confidence FROM chassis
      UNION ALL SELECT confidence FROM circuits
      UNION ALL SELECT confidence FROM seasons
   ) WHERE confidence IS NOT NULL
   GROUP BY confidence
`

export const LADDER = ['verified', 'high', 'reference', 'medium', 'unverified', 'catalogued']

/** Whether a row at this level may be quoted without a second look. */
export const safeToQuote = (value) => (value ? 'yes' : 'not without checking')

export const PROVENANCE_COLUMNS = [
  { key: 'rank', label: 'Rank', align: 'num' },
  { key: 'confidence', label: 'Level' },
  { key: 'definition', label: 'What it means', align: 'prose' },
  { key: 'may_publish', label: 'Safe to quote', align: 'num', text: safeToQuote },
]

export const LADDER_NOTE =
  'Only an official source — the FIA or formula1.com — carries a row to “verified”. Wikipedia and F1DB reach “reference”, which is not a criticism of either: it means something else would have to check them.'

export const DISCREPANCY_COLUMNS = [
  { key: 'subject', label: 'Subject' },
  { key: 'field', label: 'Field' },
  { key: 'stored_value', label: 'Recorded', align: 'num' },
  { key: 'derived_value', label: 'Derived', align: 'num' },
  { key: 'assessment', label: 'Assessment', align: 'prose' },
  { key: 'status', label: 'Status' },
]

export const DISCREPANCIES_NOTE =
  "Where two sources differ and neither can be checked officially, the difference is recorded instead of one being picked quietly. Several of these are a regulation minimum masquerading as a car's measured weight — the check that caught them is why those figures are now blank rather than wrong."

export const RECONCILIATION_COLUMNS = [
  { key: 'full_name', label: 'Driver' },
  { key: 'derived_wins', label: 'Wins derived', align: 'num' },
  { key: 'wins_external', label: 'Wins published', align: 'num' },
  { key: 'derived_poles', label: 'Poles derived', align: 'num' },
  { key: 'poles_external', label: 'Poles published', align: 'num' },
  { key: 'derived_fl', label: 'FL derived', align: 'num' },
  { key: 'fastest_laps_external', label: 'FL published', align: 'num' },
  { key: 'confidence', label: 'Confidence', text: (value) => text(value) },
]

export const RECONCILIATION_NOTE =
  'Wins, poles and fastest laps are derived from the race records and then compared with the figures published elsewhere. This comparison is what caught a wrong pole count in an official source; it runs on every build.'

/** A driver whose derived figures differ from the published ones where a published one exists. */
export const disagrees = (row) =>
  (row.wins_external !== null && row.derived_wins !== row.wins_external) ||
  (row.poles_external !== null && row.derived_poles !== row.poles_external) ||
  (row.fastest_laps_external !== null && row.derived_fl !== row.fastest_laps_external)

export const GEOMETRY_COLUMNS = [
  { key: 'status', label: 'Status' },
  { key: 'circuits', label: 'Circuits', align: 'num' },
  { key: 'traced', label: 'Traced', align: 'num' },
  { key: 'pct', label: '%', align: 'num' },
]

export const GEOMETRY_FOOTER =
  "Historic geometry has no source at all: OpenStreetMap maps what is on the ground, and Spa's 14.1 km road course is not on the ground any more."

export const AMBIGUOUS_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'constructor', label: 'Constructor' },
  { key: 'chassis', label: 'Designs entered', align: 'prose' },
  { key: 'unlinked_entries', label: 'Entries left unattributed', align: 'num' },
]

export const AMBIGUOUS_NOTE =
  'A constructor that ran more than one design in a season, where no source in use here says which car raced which round. Attributing a win to one of them would be a guess, so the chassis is left blank.'

export const UNVERIFIED_COLUMNS = [
  { key: 'tbl', label: 'Table' },
  { key: 'n', label: 'Rows at medium or unverified', align: 'num' },
]

export const UNVERIFIED_FOOTER =
  'These are not errors — they are rows nobody has yet been able to raise above medium confidence.'
