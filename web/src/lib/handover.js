/**
 * What the prerendered page was already showing, so the app does not take it
 * away again (IX-19).
 *
 * scripts/prerender.js writes every row of a register into the static page:
 * /drivers is 862 rows and /cars 1,182. The app then pages the same table at
 * 150, and main.jsx's handOver() removed the static page and put the app's in
 * its place — so at about thirteen seconds on a slow connection a reader
 * scrolled to row 700 was returned to a table that stopped at 150, with the
 * driver they were reading gone and nothing said. The handover is supposed to
 * be the page getting ABLE, not the page getting shorter.
 *
 * So the static tables are counted before they are removed, and DataTable
 * opens at least as many rows as the reader could already see. "Show the
 * remaining N" (IX-26) is what pages the table from there on, by the reader's
 * own hand rather than by an event they did not cause.
 *
 * A TABLE IS MATCHED BY ITS NAME, WHICH BOTH HALVES TAKE FROM ONE HEADING.
 *     The static half's <caption> is the heading above the table, written by
 *     nameTables() in scripts/prerender.js; the app's is DataTable's `name`,
 *     the enclosing Section's title or the page's own (AX-17). smoke.mjs
 *     already asserts the two are the same string, which is what makes it a
 *     key rather than a guess. Where they are not — a table the static half
 *     does not draw, two tables under one heading, a route with no static
 *     page at all — nothing matches and the table pages as it always did.
 */

/** One heading as one string, so " Drivers\n" and "Drivers" are one key. */
const key = (name) => String(name ?? '').replace(/\s+/g, ' ').trim()

/** The route the static page was written for; null until it has been read. */
let arrival = null
/** Rows drawn, by table name. A null value is a name that named two tables. */
let drawn = new Map()

/**
 * Count the static page's tables. Call this while it is still in the document
 * — main.jsx does, at boot — because by the time a DataTable has rows to draw
 * the database is ready and handOver() has already removed it.
 */
export function captureStaticTables() {
  if (typeof document === 'undefined') return
  const pre = document.getElementById('prerendered')
  if (!pre) return
  arrival = location.pathname
  const counted = new Map()
  for (const table of pre.querySelectorAll('table')) {
    const name = key(table.querySelector('caption')?.textContent)
    if (!name) continue
    // Two tables under one heading cannot be told apart by it, and seeding
    // the wrong one is worse than seeding neither.
    counted.set(name, counted.has(name) ? null : table.querySelectorAll('tbody tr').length)
  }
  drawn = counted
}

/**
 * How many rows the static page drew for the table of this name — 0 where it
 * drew none, and 0 once the reader has moved to another route, because the
 * page they are standing on is then the app's own and nothing was taken from
 * it. A query string is not another route: filtering a register is the
 * reader's own doing, and the rows they had stay available to them.
 */
export function staticRows(name) {
  if (arrival === null || location.pathname !== arrival) return 0
  return drawn.get(key(name)) ?? 0
}
