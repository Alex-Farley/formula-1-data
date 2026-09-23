/**
 * The Grands Prix register: its query and its columns, read by GrandsPrix.jsx
 * and by scripts/prerender.js (IA-01).
 *
 * WHY THIS FILE EXISTS
 *     `grands_prix` holds the event a race is an edition of - the British
 *     Grand Prix, not the 1976 British Grand Prix - and until IA-01 the site
 *     had no page for one. The circuit page is not a substitute: seventeen of
 *     the events have moved between venues, and those seventeen hold two
 *     thirds of every race, so the French Grand Prix was spread across seven
 *     circuit pages and reassembled nowhere.
 *
 * Every figure here is counted from `races`, not read from the stored
 * `editions`, `first_held` and `last_held`: those count a round still on the
 * calendar as held, so the stored British Grand Prix "last held" a race that
 * has not been run. A run race is `status = 'completed'`, the split
 * v_circuits makes for the circuits register.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { span, text } from '../lib/format.js'
import { SHARED } from '../lib/site.js'

/** The register's standfirst, in both renderers. */
export const GRANDS_PRIX_LEDE =
  'The events every race is an edition of. A Grand Prix can move: open one for every edition, who won it, and each circuit it has been held at.'

/**
 * One row per event, most often held first. The last winner is the winner of
 * the latest edition actually run - race_results' winner, the name the races
 * list gives the same race - with the second driver's id where two shared it.
 */
export const GRANDS_PRIX = `
  SELECT g.id, g.name, g.country,
         COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS held,
         COUNT(CASE WHEN r.status != 'completed' THEN 1 END) AS scheduled,
         MIN(CASE WHEN r.status = 'completed' THEN r.year END) AS first_held,
         MAX(CASE WHEN r.status = 'completed' THEN r.year END) AS last_held,
         COUNT(DISTINCT CASE WHEN r.status = 'completed' THEN r.circuit_id END) AS circuits,
         (SELECT rr.winner FROM race_results rr JOIN races x ON x.id = rr.id
           WHERE x.gp_id = g.id AND x.status = 'completed'
           ORDER BY x.year DESC, x.round DESC LIMIT 1) AS last_winner,
         (SELECT rr.winner_id FROM race_results rr JOIN races x ON x.id = rr.id
           WHERE x.gp_id = g.id AND x.status = 'completed'
           ORDER BY x.year DESC, x.round DESC LIMIT 1) AS last_winner_id,
         (SELECT rr.co_winner_id FROM race_results rr JOIN races x ON x.id = rr.id
           WHERE x.gp_id = g.id AND x.status = 'completed'
           ORDER BY x.year DESC, x.round DESC LIMIT 1) AS last_co_winner_id
    FROM grands_prix g
    LEFT JOIN races r ON r.gp_id = g.id
   GROUP BY g.id
   ORDER BY held DESC, g.name
`

/** The winner of the latest edition run, "shared" where two drivers were classified as winning it. */
export const lastWinner = (name, row) => (row.last_co_winner_id ? `${text(name)} ${SHARED}` : text(name))

export const GRANDS_PRIX_COLUMNS = [
  { key: 'name', rowHeader: true, label: 'Grand Prix' },
  { key: 'country', label: 'Country' },
  { key: 'held', label: 'Held', align: 'num', phone: true },
  { key: 'first_held', label: 'Span', align: 'num', text: (_, row) => span(row.first_held, row.last_held) },
  { key: 'circuits', label: 'Circuits', align: 'num', phone: true },
  { key: 'last_winner', label: 'Last winner', text: lastWinner },
]

export const GRANDS_PRIX_FOOTER =
  'Held, span and circuits count the editions actually run; a round still on the calendar is on the event’s own page, marked as still to come. The last winner is the winner of the latest edition run.'
