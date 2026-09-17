/**
 * The sources page: its queries, the licence consequences and the two
 * tables' columns, read by Sources.jsx and by scripts/prerender.js (PD-02,
 * rung six).
 *
 * WHY THIS FILE EXISTS
 *     The static page printed each source as a section of facts in id
 *     order; the app ranks them by authority in one table and adds the
 *     photograph licences, and the licence consequences lived only in the
 *     app. The definitions live here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { host, text } from '../lib/format.js'

export const SOURCES = 'SELECT * FROM source_registry ORDER BY priority, id'

export const LICENCES = `
  SELECT licence, licence_url, COUNT(*) AS images
    FROM article_images
   WHERE licence IS NOT NULL AND route = 'article'
   GROUP BY licence
   ORDER BY images DESC, licence
`

export const GEOMETRY_LICENCE = 'SELECT COUNT(*) AS n, licence FROM circuit_geometry GROUP BY licence'

/**
 * The licences, as consequences rather than as a list of names.
 *
 * A licence is not a footnote here — it is the thing that decided what this
 * database contains. The full classification of every race was available for
 * seven versions and stayed out because the copy that could be got carried a
 * non-commercial clause; it shipped when the same facts were found under CC BY.
 */
export const CONSEQUENCES = [
  {
    source: 'F1DB',
    licence: 'CC BY 4.0',
    consequence:
      'Attribution only, and no non-commercial clause — which is why the full classification of all 1,161 races ships in the committed database rather than being loaded locally. This is the licence that closed the largest gap this project had.',
  },
  {
    source: 'Wikipedia',
    licence: 'CC BY-SA 4.0',
    consequence:
      'Share-alike, and it reaches any prose taken from it. Registers, notes and the era descriptions are downstream of this.',
  },
  {
    source: 'Jolpica-F1 (Ergast)',
    licence: 'CC BY-NC-SA',
    consequence:
      'The non-commercial clause means these rows are loaded locally as a cross-check and never committed. They are what produces the 118 recorded finishing-position disagreements, and they are why those disagreements are recorded rather than resolved.',
  },
  {
    source: 'Wikidata',
    licence: 'CC0',
    consequence: 'No obligation at all. Used to resolve circuit identity to an OpenStreetMap relation.',
  },
  {
    source: 'OpenStreetMap',
    licence: 'ODbL 1.0',
    consequence:
      'Share-alike plus a database right, so it is quarantined into a file of its own: the centrelines ship as f1-geometry.db, f1.db contains no OpenStreetMap data at all, and two databases side by side are a Collective Database rather than a derivative one. Your browser merges them to draw the maps.',
  },
  {
    source: 'Wikimedia Commons',
    licence: 'per file',
    consequence:
      'Sixteen different licence strings across the photographs, so each row carries its own. No pixels are stored — only a reference, its licence, and its photographer, and the photographer is displayed with the picture because the licence requires it.',
  },
]

export const CONSEQUENCE_COLUMNS = [
  { key: 'source', label: 'Source' },
  { key: 'licence', label: 'Licence' },
  { key: 'consequence', label: 'Consequence', align: 'prose' },
]

export const CONSEQUENCES_NOTE =
  'Licences decided what is in this database and what is not. If you reuse anything from here, this is the column that applies to you.'

export const SOURCE_COLUMNS = [
  { key: 'priority', label: 'Rank', align: 'num' },
  { key: 'source', label: 'Source' },
  { key: 'authority', label: 'Authority' },
  { key: 'use', label: 'Used for', align: 'prose' },
  { key: 'licence', label: 'Licence', align: 'prose' },
  { key: 'cadence', label: 'Updated', align: 'prose' },
  { key: 'checkability', label: 'What can check it', align: 'prose' },
]

export const SOURCES_FOOTER =
  'Ranked by authority, not by volume. The last column is the one that decides where a source sits.'

export const LICENCE_COLUMNS = [
  { key: 'licence', label: 'Licence' },
  { key: 'images', label: 'Photographs', align: 'num' },
  { key: 'licence_url', label: 'Terms', text: (url) => (url ? host(url) : text(null)) },
]

export const LICENCES_NOTE =
  'Commons files do not share one licence, so each photograph carries its own — which is why the credit always travels with the picture.'
