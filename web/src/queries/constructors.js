/**
 * The constructors register: its query and its columns, read by
 * Constructors.jsx and by scripts/prerender.js (PD-02, rung three).
 *
 * WHY THIS FILE EXISTS
 *     The static register had seven columns to the app's nine, "Entries"
 *     against "Race entries", no Designs or drivers' titles, titles-first
 *     order against the app's alphabetical one, and "1950–present" where the
 *     app prints "1950–". The definition lives here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { span, text } from '../lib/format.js'

/**
 * Alphabetical, case-insensitively, and the app's table opens in this order
 * rather than re-sorting, so the static page prints the rows as they come.
 * Entries and designs are counted from the race records and the chassis
 * register rather than read from a column.
 */
export const CONSTRUCTORS = `
  SELECT k.id, k.name, k.country, k.base, k.first_entry, k.last_entry,
         k.wins, k.poles, k.constructors_titles, k.drivers_titles, k.title_years,
         k.lineage_chain, k.active,
         (SELECT COUNT(*) FROM race_entries e WHERE e.constructor_id = k.id) AS entries,
         (SELECT COUNT(DISTINCT ch.id) FROM chassis ch WHERE ch.constructor_id = k.id) AS designs
    FROM constructors k
   ORDER BY k.name COLLATE NOCASE, k.id
`

/** "1950–" for a constructor still entered; "1950–1964" for one that is not. */
export const entered = (_, row) => span(row.first_entry, row.active ? null : row.last_entry)

export const CONSTRUCTOR_COLUMNS = [
  { key: 'name', label: 'Constructor' },
  { key: 'country', label: 'Country' },
  { key: 'first_entry', label: 'Entered', align: 'num', text: entered },
  { key: 'entries', label: 'Race entries', align: 'num' },
  { key: 'designs', label: 'Designs', align: 'num' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'poles', label: 'Poles', align: 'num' },
  { key: 'constructors_titles', label: "Constructors' titles", align: 'num' },
  { key: 'drivers_titles', label: "Drivers' titles", align: 'num', text: (value) => text(value) },
]

export const CONSTRUCTORS_FOOTER =
  '“Race entries” counts one row per car per race, so a two-car team collects two for every Grand Prix it started.'
