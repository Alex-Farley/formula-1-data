/**
 * The circuits register: its query and its columns, read by Circuits.jsx and
 * by scripts/prerender.js (PD-02, rung three).
 *
 * WHY THIS FILE EXISTS
 *     The static register read the stored `gp_count` and `last_gp`; the app
 *     derives the race count and the span of Grands Prix from the races
 *     through v_circuits, because the stored last_gp is NULL for the 27
 *     venues still in use. Seven columns to the app's ten, "Location" against
 *     "Locality", a length with "km" appended in one renderer and a header
 *     saying so in the other. The definition lives here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { EMPTY, span } from '../lib/format.js'
import { CURRENT_SEASON_SQL } from '../lib/season.js'

/**
 * Most races first, then by name — the order the app's table opens in.
 * `traced` counts the OpenStreetMap centrelines, which are not in f1.db: the
 * browser overlays them from f1-geometry.db before this runs, and the
 * prerenderer, which reads f1.db alone, answers the column from that sibling
 * file itself (a set of circuit ids, no centreline) and refuses to build
 * without it.
 */
export const CIRCUITS = `
  SELECT v.*,
         (SELECT COUNT(*) FROM circuit_geometry g WHERE g.circuit_id = v.id) AS traced,
         -- This year's calendar (IA-19), against the declared season and not
         -- MAX(races.year): the 2027 calendar was announced on 2026-09-16 and
         -- is already in the register, so a MAX() would name a season nobody
         -- has run (lib/season.js, CR-07). A round scheduled but not yet run
         -- counts - it is the calendar, not the results.
         ${CURRENT_SEASON_SQL} AS calendar_season,
         EXISTS (SELECT 1 FROM races r
                  WHERE r.circuit_id = v.id AND r.year = ${CURRENT_SEASON_SQL}) AS on_calendar
    FROM v_circuits v
   ORDER BY v.races DESC, v.name
`

/**
 * "●" with the word "traced" for a screen reader, or the em dash. Both
 * renderers set the glyph aria-hidden and the word visually hidden, so the
 * cell reads "●traced" to the smoke test's textContent in each.
 */
export const TRACED = 'traced'
export const traced = (value) => (value ? `●${TRACED}` : EMPTY)

export const CIRCUIT_COLUMNS = [
  { key: 'name', label: 'Circuit' },
  { key: 'locality', label: 'Locality' },
  { key: 'country', label: 'Country' },
  { key: 'circuit_type', label: 'Type' },
  { key: 'races', label: 'Races', align: 'num' },
  { key: 'first_gp', label: 'Grands Prix', align: 'num', text: (_, row) => span(row.first_gp, row.last_gp) },
  { key: 'layouts', label: 'Layouts', align: 'num' },
  { key: 'length_km', label: 'Length (km)', align: 'num' },
  { key: 'turns', label: 'Turns', align: 'num' },
  { key: 'traced', label: 'Traced', align: 'num', text: traced },
]

export const CIRCUITS_FOOTER =
  "Length and turns describe the layout in use now. Only 13 of the 80 have a layout timeline, so a 1976 lap of a circuit rebuilt since is reported at today's length."
