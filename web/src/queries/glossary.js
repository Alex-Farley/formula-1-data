/**
 * The glossary page: its two queries and their columns, read by Glossary.jsx
 * and by scripts/prerender.js (PD-02, rung six).
 *
 * WHY THIS FILE EXISTS
 *     The static page printed the glossary as a definition list with no
 *     category, and had no table of people at all. The definitions live
 *     here once; each ORDER BY is the order the app's table opens in.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { span } from '../lib/format.js'

// Case-insensitive, and the app's table opens in this order rather than
// re-sorting: "DRS" sorts among the Ds, not before "Downforce".
//
// The confidence tiers are the provenance table's rows, not glossary rows
// (CD-09): "reference" and "medium" are printed on page after page, and the
// ladder's own definition of each is the one the build enforces. Copying them
// into data/technical.py would have made a second wording free to drift from
// the first, so the page reads the ladder and names the tier as it is
// printed everywhere else, capitalised as a term.
export const GLOSSARY = `
  SELECT term, category, definition FROM glossary
  UNION ALL
  SELECT upper(substr(confidence, 1, 1)) || substr(confidence, 2), 'confidence', definition
    FROM provenance
   ORDER BY term COLLATE NOCASE`
export const PERSONNEL = 'SELECT * FROM personnel ORDER BY active_from IS NULL, active_from, full_name, id'

export const GLOSSARY_COLUMNS = [
  { key: 'term', rowHeader: true, label: 'Term', width: '18%' },
  { key: 'category', label: 'Category' },
  { key: 'definition', label: 'Definition', align: 'prose' },
]

export const PERSONNEL_COLUMNS = [
  { key: 'full_name', rowHeader: true, label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'associated_with', label: 'With' },
  { key: 'active_from', label: 'Active', align: 'num', text: (_, row) => span(row.active_from, row.active_to) },
  { key: 'nationality', label: 'Nationality' },
  { key: 'significance', label: 'Why they are here', align: 'prose' },
]
