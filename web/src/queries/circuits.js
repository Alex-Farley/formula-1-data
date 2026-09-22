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

/**
 * The register's shapes: ONE outline per circuit, the layout raced most
 * recently.
 *
 * A circuit is a register entry with seven Monzas and eight Silverstones
 * behind it, and the register is not the place to draw all 160 - the
 * circuit's own page is, where each card carries the figures and years that
 * tell them apart. Here the question is which venue this is, so the card
 * draws the layout a reader is most likely to recognise: the one with the
 * latest race against its F1DB id, scheduled races included, because a
 * layout on next year's calendar is the shape of the place now. Ties go to
 * the layout that has held the most rounds, then to F1DB's id, so the pick is
 * a pure function of the database and the static page and the app choose the
 * same one.
 *
 * `last_year IS NULL` leads the ordering because SQLite sorts NULL smallest
 * and DESC would therefore put a layout nobody has raced first. No such row
 * exists today - every outline in f1.db is named by at least one race - which
 * is exactly why the ordering has to say what it would do if one arrived.
 *
 * 79 of the 80 venues have an outline; Nurburgring Sudschleife has none, and
 * the section's count says "79 of 80" rather than implying eighty shapes.
 */
export const REGISTER_OUTLINES = `
  WITH raced AS (
    SELECT o.circuit_id, o.f1db_layout_id, o.path,
           MAX(r.year) AS last_year,
           COUNT(r.id) AS rounds
      FROM circuit_outlines o
      LEFT JOIN races r ON r.f1db_layout_id = o.f1db_layout_id
     GROUP BY o.f1db_layout_id
  ),
  ranked AS (
    SELECT raced.*,
           ROW_NUMBER() OVER (
             PARTITION BY circuit_id
             ORDER BY last_year IS NULL, last_year DESC, rounds DESC, f1db_layout_id
           ) AS pick
      FROM raced
  )
  SELECT c.id AS circuit_id, c.name, c.country, ranked.f1db_layout_id, ranked.path
    FROM ranked
    JOIN circuits c ON c.id = ranked.circuit_id
   WHERE ranked.pick = 1
   ORDER BY c.name
`

/** The heading over that grid, in both renderers. */
export const SHAPES = 'The shapes'

/** What the section says when the filter has left it nothing to draw. */
export const NO_SHAPES = 'No outline among these circuits.'

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
