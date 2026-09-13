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

/**
 * Most races first, then by name — the order the app's table opens in.
 * `traced` counts the OpenStreetMap centrelines the browser overlays from
 * f1-geometry.db; in f1.db alone, which is what the prerenderer reads, it is
 * 0 for every circuit, and the static column says so honestly.
 */
export const CIRCUITS = `
  SELECT v.*,
         (SELECT COUNT(*) FROM circuit_geometry g WHERE g.circuit_id = v.id) AS traced
    FROM v_circuits v
   ORDER BY v.races DESC, v.name
`

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
  { key: 'traced', label: 'Traced', align: 'num', text: (value) => (value ? '●' : EMPTY) },
]

export const CIRCUITS_FOOTER =
  "Length and turns describe the layout in use now. Only 13 of the 80 have a layout timeline, so a 1976 lap of a circuit rebuilt since is reported at today's length."
