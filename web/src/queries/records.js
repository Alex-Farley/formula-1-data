/**
 * The records page: its queries and its tables' columns, read by Records.jsx
 * and by scripts/prerender.js.
 *
 * WHY THIS FILE EXISTS
 *     The static /records table had a Category column the app never shows
 *     (CR-23), sorted its rows by a different key, and said nothing about
 *     the confidence tier the app states once above the table (CR-22). One
 *     query and one column list, here; both renderers read them.
 *
 * See queries/drivers.js for what a column's `text` is.
 */

export const RECORDS = `SELECT * FROM records ORDER BY category, id`

export const DRIVER_WINS = `
  SELECT e.driver_id, d.full_name, COUNT(*) AS wins,
         MIN(r.year) AS first_win, MAX(r.year) AS last_win
    FROM race_entries e
    JOIN races r   ON r.id = e.race_id
    JOIN drivers d ON d.id = e.driver_id
   WHERE e.finish_position = 1
   GROUP BY e.driver_id
   ORDER BY wins DESC, d.full_name
   LIMIT 40
`

export const DRIVER_POLES = `
  SELECT e.driver_id, d.full_name, COUNT(*) AS poles
    FROM race_entries e
    JOIN drivers d ON d.id = e.driver_id
   WHERE e.pole = 1
   GROUP BY e.driver_id
   ORDER BY poles DESC, d.full_name
   LIMIT 40
`

export const CONSTRUCTOR_WINS = `
  SELECT * FROM v_wins_by_constructor LIMIT 40
`

export const TITLES = `SELECT * FROM v_title_count`

export const DECADES = `SELECT * FROM v_wins_by_decade`

export const POLE_TO_WIN = `SELECT * FROM v_pole_to_win ORDER BY year`

export const GRAND_SLAMS = `SELECT * FROM v_grand_slams ORDER BY year DESC, round DESC`

/** The confidence tiers the records carry, in first-seen order. */
export const tiersOf = (records) => [...new Set(records.map((r) => r.confidence))]

/**
 * The records table. Thirty identical badges in a column mean nothing, so
 * the tier is a column only where the rows differ on it; where they all
 * share one it is said once above the table (tierBefore / TIER_AFTER) and
 * not repeated on every row.
 */
export function recordColumns(records) {
  return [
    { key: 'record', label: 'Record' },
    { key: 'holder', label: 'Holder', align: 'prose' },
    // "18 years, 228 days, 2016 Spanish Grand Prix": a phrase, not a column
    // of figures, so it does not pretend to align as one. The comparable
    // number is value_num, with its unit, for a query.
    { key: 'value', label: 'Value', align: 'prose' },
    { key: 'detail', label: 'How it is derived', align: 'prose' },
    { key: 'as_of', label: 'As of' },
    ...(tiersOf(records).length === 1 ? [] : [{ key: 'confidence', label: 'Confidence' }]),
  ]
}

/**
 * The sentence above the table when every record shares a tier, in two
 * halves around the tier itself: the app sets the tier as a Confidence pill
 * and the static page as a link, so neither can be given the whole string.
 */
export const tierBefore = (count) => `All ${count} carry the `
export const TIER_AFTER = ' tier, so it is not repeated on every row.'

export const TITLE_COLUMNS = [
  { key: 'full_name', label: 'Driver' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'titles', label: 'Titles', align: 'num' },
  { key: 'title_years', label: 'Years', align: 'prose' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'poles', label: 'Poles', align: 'num' },
]

export const GRAND_SLAM_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num' },
  { key: 'gp_name', label: 'Grand Prix' },
  { key: 'driver', label: 'Driver' },
  { key: 'constructor', label: 'Constructor' },
]

/** The sentence both renderers open the records with; CR-22's claim rests on it. */
export const RECORDS_LEDE =
  'Every record here is derived from the same tables as the leaderboards on every build, as of the last completed race the database holds, and each row says how.'
