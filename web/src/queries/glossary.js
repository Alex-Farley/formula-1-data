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
export const GLOSSARY = 'SELECT * FROM glossary ORDER BY term COLLATE NOCASE'
export const PERSONNEL = 'SELECT * FROM personnel ORDER BY active_from IS NULL, active_from, full_name, id'

export const GLOSSARY_COLUMNS = [
  { key: 'term', label: 'Term', width: '18%' },
  { key: 'category', label: 'Category' },
  { key: 'definition', label: 'Definition', align: 'prose' },
]

export const PERSONNEL_COLUMNS = [
  { key: 'full_name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'associated_with', label: 'With' },
  { key: 'active_from', label: 'Active', align: 'num', text: (_, row) => span(row.active_from, row.active_to) },
  { key: 'nationality', label: 'Nationality' },
  { key: 'significance', label: 'Why they are here', align: 'prose' },
]
