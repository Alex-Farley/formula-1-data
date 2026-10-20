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
      'Attribution only, and no non-commercial clause — which is why the full classification of every race ships in the committed database rather than being loaded locally. This is the licence that closed the largest gap this project had.',
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
      'Share-alike plus a database right, so it is quarantined into a file of its own: the centrelines ship as f1-geometry.db, f1.db contains no OpenStreetMap data at all, and two databases side by side are a Collective Database rather than a derivative one. Your browser merges them to read what each trace measures; the circuits are drawn from F1DB’s outlines.',
  },
  {
    source: 'Wikimedia Commons',
    licence: 'per file',
    consequence:
      'Sixteen different licence strings across the photographs, so each row carries its own. No pixels are stored — only a reference, its licence, and its photographer, and the photographer is displayed with the picture because the licence requires it.',
  },
]

export const CONSEQUENCE_COLUMNS = [
  { key: 'source', rowHeader: true, label: 'Source' },
  { key: 'licence', label: 'Licence' },
  { key: 'consequence', label: 'Consequence', align: 'prose', date: 'text' },
]

export const CONSEQUENCES_NOTE =
  'Licences decided what is in this database and what is not. If you reuse anything from here, this is the column that applies to you.'

export const SOURCE_COLUMNS = [
  { key: 'priority', label: 'Rank', align: 'num' },
  { key: 'source', rowHeader: true, label: 'Source' },
  { key: 'authority', label: 'Authority' },
  // The registry's prose, which dates what it says (CD-57).
  { key: 'use', label: 'Used for', align: 'prose', date: 'text' },
  { key: 'licence', label: 'Licence', align: 'prose', date: 'text' },
  { key: 'cadence', label: 'Updated', align: 'prose', date: 'text' },
  { key: 'checkability', label: 'What can check it', align: 'prose', date: 'text' },
]

export const SOURCES_FOOTER =
  'Ranked by authority, not by volume. The last column is the one that decides where a source sits.'

export const LICENCE_COLUMNS = [
  { key: 'licence', rowHeader: true, label: 'Licence' },
  { key: 'images', label: 'Photographs', align: 'num' },
  { key: 'licence_url', label: 'Terms', text: (url) => (url ? host(url) : text(null)) },
]

/**
 * The closing section, "Using this data", in both renderers (VD-87): what a
 * reader may do with what they take, then the outlines' credit and the
 * trademark line. The static page had the credit under the source registry
 * and no section of its own for it.
 */
export const USING_TITLE = 'Using this data'
export const USING_THIS_DATA =
  'You are welcome to. Carry the licence with whatever you take: attribute F1DB for the race records, keep share-alike on anything derived from Wikipedia prose, and treat a traced centreline as OpenStreetMap under ODbL — that obligation travels with it.'
export const UNAFFILIATED =
  'This site is unaffiliated with Formula One, the FIA, or any team. Formula One, F1 and Grand Prix are trademarks of their respective owners and are used here descriptively.'

export const LICENCES_NOTE =
  'Commons files do not share one licence, so each photograph carries its own — which is why the credit always travels with the picture.'

/**
 * The page's lede, under its h1 in both renderers (VD-79): the app's words,
 * read by pages/Sources.jsx and by scripts/prerender.js, where the static page
 * used to open on a sentence of its own and swap it at the handover.
 */
export const SOURCES_LEDE =
  'Where every figure on this site comes from, and what you may do with it if you take it. Sources are ranked on whether anything independent can check them, not on how much data they hold.'
