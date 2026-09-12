/**
 * The drivers register: its query and its columns, read by Drivers.jsx and
 * by scripts/prerender.js.
 *
 * WHY THIS FILE EXISTS
 *     The static register had eight columns to the app's nine, Poles before
 *     Podiums against Podiums before Poles, and no Fastest laps (CR-24),
 *     because prerender.js wrote its own SQL and its own header row. Two
 *     renderers with two definitions drift, and every review found another
 *     face of the same defect (PD-02). The definition lives here once; both
 *     halves read it, so they cannot disagree about what a row is or what
 *     the columns are called.
 *
 * A column is { key, label, align, text }. `text` is a plain-string formatter
 * for a cell that is not simply its value — the static table prints it, and
 * DataTable prints it wherever the page does not wrap the cell in a link.
 * The React `render` and `sort` stay on the page: they need the router and
 * the sort state, and a Node script has neither.
 */
import { span } from '../lib/format.js'

/**
 * The whole register in one query.
 *
 * Wins, poles, podiums and fastest laps are the stored columns the build
 * derives from the race records; Entries is counted here from the same
 * records, one row per race a driver was entered for — an entry, not a
 * start, so it carries the word the driver's own page uses for the same
 * count (CD-18). The stored `entries` and `starts` columns are published
 * figures held for 38 and 31 of 862 drivers, so two columns opened on 96%
 * em dashes; they are on the driver's own page, labelled as published, and
 * not here.
 *
 * Most wins first. DataTable opens the app's table sorted by wins, and its
 * sort is stable with missing values last, so this ORDER BY is also the
 * order the table opens in: the static page can print the rows as they come.
 */
export const DRIVERS = `
  SELECT d.id, d.full_name, d.nationality, d.first_season, d.last_season,
         d.wins, d.podiums, d.poles, d.fastest_laps, d.career_points,
         d.titles, d.title_years, d.status, d.confidence,
         (SELECT COUNT(*) FROM race_entries e WHERE e.driver_id = d.id) AS entries,
         -- The grid is derived, not read from status: an entry in the latest
         -- completed season. The season itself rides along so the filter can
         -- name it (IX-17).
         (SELECT MAX(year) FROM races WHERE status = 'completed') AS latest_season,
         EXISTS (SELECT 1 FROM race_entries e JOIN races r ON r.id = e.race_id
                  WHERE e.driver_id = d.id
                    AND r.year = (SELECT MAX(year) FROM races WHERE status = 'completed')) AS on_grid
    FROM drivers d
   ORDER BY d.wins DESC, d.podiums DESC, d.full_name
`

export const DRIVER_COLUMNS = [
  { key: 'full_name', label: 'Driver' },
  { key: 'nationality', label: 'Nationality' },
  {
    key: 'first_season',
    label: 'Seasons',
    align: 'num',
    text: (_, row) => span(row.first_season, row.last_season),
  },
  { key: 'entries', label: 'Entries', align: 'num' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'podiums', label: 'Podiums', align: 'num' },
  { key: 'poles', label: 'Poles', align: 'num' },
  { key: 'fastest_laps', label: 'Fastest laps', align: 'num' },
  { key: 'titles', label: 'Titles', align: 'num' },
]
