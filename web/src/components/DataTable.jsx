import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EMPTY, isNumericColumn, isProseColumn, label as humanise, missing, text } from '../lib/format.js'
import { PageTitle, SectionTitle } from './Page.jsx'

/**
 * One table component for everything, from the season list to whatever a
 * reader types into the SQL console.
 *
 * Columns can be given as strings (take the value, guess the alignment) or as
 * objects — { key, label, align, render, sort, className, width, text } — which
 * is how an id becomes a link without this component knowing anything about
 * routes. Given neither, it renders the result's own shape, which is what the
 * console needs.
 *
 * `text` is a plain-string formatter from a page's queries module, shared
 * with scripts/prerender.js so the static table prints the same cell; it is
 * used where the page gives no `render`. See queries/drivers.js.
 *
 * NULLS SORT LAST, ALWAYS.
 *     SQLite sorts NULL first, and this database uses NULL for "not
 *     established". Sorted naively, the drivers nobody has a points total for
 *     lead the points table. Ordering by a missing value is meaningless in
 *     either direction, so missing values go to the bottom of both.
 */
const PAGE = 250

/** Order two values that are both present. Missing ones never reach here. */
function compare(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })
}

function normalise(columns, rows) {
  return columns.map((column) => {
    const spec = typeof column === 'string' ? { key: column } : column
    const align =
      spec.align ?? (isNumericColumn(rows, spec.key) ? 'num' : isProseColumn(rows, spec.key) ? 'prose' : null)
    return {
      sortable: true,
      ...spec,
      align,
      label: spec.label ?? humanise(spec.key),
    }
  })
}

export default function DataTable({
  data,
  rows: given,
  columns,
  caption,
  sort: initialSort = null,
  direction: initialDirection = 'asc',
  // "Nothing recorded." is a claim about the database, and it was the default
  // on some fifty tables - including every register a reader had just filtered
  // to nothing, where what had happened was a search box (CD-17). The neutral
  // default says only what is true of the table; an absence that means
  // something gets its own string, as Car.jsx's NO_ENTRIES does.
  //
  // A node rather than a string replaces the whole state, which is how a
  // filtered register names the filters that emptied it and offers the way
  // back (IX-28); it carries `state is-empty` itself.
  empty = 'No rows here.',
  rowKey,
  highlight,
  page = PAGE,
  sortable = true,
  footer,
  // The SQL console shows data as data: 1950, not 1,950.
  raw = false,
}) {
  const source = given ?? data?.rows ?? []
  // Read unconditionally: hooks may not sit behind the early return below.
  const sectionTitle = useContext(SectionTitle)
  const pageTitle = useContext(PageTitle)
  // What this table is called. An explicit `caption` where the heading above
  // would be the wrong name for the table under it - the SQL console, whose
  // page is not its result - and otherwise the heading that introduces it.
  const name = caption ?? sectionTitle ?? pageTitle
  const [sort, setSort] = useState(initialSort)
  const [direction, setDirection] = useState(initialDirection)
  const [showAll, setShowAll] = useState(false)

  const cols = useMemo(
    () => normalise(columns ?? data?.columns ?? [], source),
    [columns, data?.columns, source],
  )

  const ordered = useMemo(() => {
    if (!sort) return source
    const column = cols.find((c) => c.key === sort)
    const value = column?.sort ?? ((row) => row[sort])
    const sign = direction === 'desc' ? -1 : 1
    // A copy: the caller's array is a query result other components may hold.
    return [...source].sort((a, b) => {
      const left = value(a)
      const right = value(b)
      // Sink missing values OUTSIDE the direction flip. Inside it, descending
      // inverts the sinking and brings them to the top — which on the driver
      // register means 824 em dashes above everyone who has a figure, because
      // that is how many drivers have no stored entry count.
      if (missing(left) && missing(right)) return 0
      if (missing(left)) return 1
      if (missing(right)) return -1
      return sign * compare(left, right)
    })
  }, [source, sort, direction, cols])

  // Hooks before the empty-state return below: a register filtered to no
  // rows must call the same hooks as one with rows, or React throws.
  // Seven of nine columns of the driver register were off-screen at 375 px
  // with nothing to say so. The fade at the right edge appears only while
  // there is more table to the right, and goes as the reader reaches it.
  const scroller = useRef(null)
  const [clipped, setClipped] = useState(false)
  useEffect(() => {
    const el = scroller.current
    if (!el) return undefined
    const check = () => setClipped(el.scrollWidth - el.clientWidth - el.scrollLeft > 1)
    check()
    el.addEventListener('scroll', check, { passive: true })
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check)
    watch?.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      watch?.disconnect()
    }
  }, [ordered.length, showAll])

  if (cols.length === 0 || source.length === 0) {
    // "state is-empty", not bare "state". A skeleton and a Loading share that
    // class because they are both the page waiting; this is the page having
    // finished and found nothing, which is a different thing and reads
    // differently to anyone watching for the wait to end. The smoke test was
    // watching for exactly that, and sat out a twenty-second timeout on every
    // page carrying an empty section.
    // A <div> inside this <p> would be invalid HTML and the browser would
    // reparent it, so a node renders as itself and brings its own classes.
    return typeof empty === 'string' ? <p className="state is-empty">{empty}</p> : empty
  }

  const visible = showAll ? ordered : ordered.slice(0, page)
  const hidden = ordered.length - visible.length

  const toggle = (key) => {
    if (key === sort) setDirection(direction === 'asc' ? 'desc' : 'asc')
    else {
      setSort(key)
      // Numbers are nearly always most interesting at their largest.
      setDirection(cols.find((c) => c.key === key)?.align === 'num' ? 'desc' : 'asc')
    }
  }

  return (
    // data-rows is the total the table holds, not the number currently on
    // screen. The smoke suite reads it to compare what a page shows against
    // what the database says it should, without having to page through.
    <div
      className="table-wrap"
      data-rows={ordered.length}
      data-shown={visible.length}
      data-clipped={clipped || undefined}
    >
      {/* A scrollable region is keyboard-reachable only while it has something
          to scroll to; a tab stop on every table would be noise. */}
      <div className="table-scroll" ref={scroller} tabIndex={clipped ? 0 : undefined}>
        <table>
          {/* Never shown. Whatever the name is, the reader can already see it
              directly above the table - the Section's heading, or the page's
              own - and a visible copy would only repeat it. Hidden, it still
              gives the table a name when somebody enters it with a screen
              reader, which is the whole point. */}
          {name && <caption className="sr-only">{name}</caption>}
          <thead>
            <tr>
              {cols.map((column) => {
                const active = sort === column.key
                const canSort = sortable && column.sortable !== false
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={[column.align, canSort ? 'sortable' : null].filter(Boolean).join(' ')}
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {canSort ? (
                      <button type="button" onClick={() => toggle(column.key)}>
                        {column.label}
                        <span className="arrow" aria-hidden="true">
                          {active ? (direction === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="prose">
                  {empty}
                </td>
              </tr>
            )}
            {visible.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row, i) : i}
                className={highlight?.(row) ? 'is-highlight' : undefined}
              >
                {cols.map((column) => (
                  <td
                    key={column.key}
                    className={[column.align, column.className?.(row)].filter(Boolean).join(' ')}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : column.text
                        ? plain(column.text(row[column.key], row))
                        : cell(row[column.key], { raw })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(hidden > 0 || footer) && (
        <div className="table-foot">
          <span>{footer}</span>
          {hidden > 0 && (
            <button type="button" onClick={() => setShowAll(true)}>
              Show the remaining {hidden.toLocaleString('en-GB')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A value, with NULL rendered as the em dash that means "not established"
 * and a true zero set faint, so the two never read the same and neither
 * competes with a figure. `raw` prints numbers unformatted.
 */
export function cell(value, { raw = false } = {}) {
  if (missing(value)) return <span className="empty">—</span>
  if (value === 0) return <span className="zero">0</span>
  if (raw && typeof value === 'number') return String(value)
  return text(value)
}

/**
 * A column's own `text` formatter as a cell: the string it returns, with the
 * em dash it uses for a missing value set faint like every other. The static
 * page prints the same string, which is the point of the formatter living in
 * one place rather than here and in prerender.js.
 */
export function plain(value) {
  if (value === EMPTY) return <span className="empty">{EMPTY}</span>
  return value
}
