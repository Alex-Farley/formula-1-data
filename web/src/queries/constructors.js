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
import { span } from '../lib/format.js'
import { CURRENT_SEASON_SQL } from '../lib/season.js'

/**
 * Most race entries first, then alphabetically, case-insensitively.
 *
 * It opened alphabetically until VD-30: AFM, AGS, Alfa Special, Amon, Andrea
 * Moda, and roughly sixty of the seventy-eight figures on the first screen
 * were zero. A register is a way in, and the way in was its emptiest rows.
 * Alphabetical is one click on the Constructor header away, which is where
 * every other ordering of this table already lives.
 *
 * DataTable opens the app's table on the same key and its sort is stable, so
 * ties keep the order below and the static page can still print the rows as
 * they come - the same arrangement queries/drivers.js relies on.
 *
 * Entries and designs are counted from the race records and the chassis
 * register rather than read from a column; `on_grid` is the season's entry
 * list, the anchor lib/season.js explains.
 */
export const CONSTRUCTORS = `
  SELECT k.id, k.name, k.country, k.base, k.first_entry, k.last_entry,
         k.wins, k.poles, k.constructors_titles, k.drivers_titles, k.title_years,
         k.lineage_chain, k.active,
         (SELECT COUNT(*) FROM race_entries e WHERE e.constructor_id = k.id) AS entries,
         (SELECT COUNT(DISTINCT ch.id) FROM chassis ch WHERE ch.constructor_id = k.id) AS designs,
         ${CURRENT_SEASON_SQL} AS grid_season,
         EXISTS (SELECT 1 FROM season_entries se
                  WHERE se.constructor_id = k.id AND se.year = ${CURRENT_SEASON_SQL}) AS on_grid
    FROM constructors k
   ORDER BY entries DESC, k.name COLLATE NOCASE, k.id
`

/** "1950–" for a constructor still entered; "1950–1964" for one that is not. */
export const entered = (_, row) => span(row.first_entry, row.active ? null : row.last_entry)

export const CONSTRUCTOR_COLUMNS = [
  { key: 'name', rowHeader: true, label: 'Constructor' },
  { key: 'country', label: 'Country' },
  { key: 'base', label: 'Base', optional: true },
  { key: 'first_entry', label: 'Entered', align: 'num', text: entered },
  { key: 'entries', label: 'Race entries', align: 'num', phone: true },
  { key: 'designs', label: 'Designs', align: 'num' },
  { key: 'wins', label: 'Wins', align: 'num', phone: true },
  { key: 'poles', label: 'Poles', align: 'num' },
  { key: 'constructors_titles', label: "Constructors' titles", align: 'num' },
  { key: 'drivers_titles', label: "Drivers' titles", align: 'num' },
]

export const CONSTRUCTORS_FOOTER =
  '“Race entries” counts one row per car per race, so a two-car team collects two for every Grand Prix it started.'
