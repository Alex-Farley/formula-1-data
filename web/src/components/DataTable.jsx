import { useMemo, useState } from 'react'
import { isNumericColumn, isProseColumn, label as humanise, missing, text } from '../lib/format.js'

/**
 * One table component for everything, from the season list to whatever a
 * reader types into the SQL console.
 *
 * Columns can be given as strings (take the value, guess the alignment) or as
 * objects — { key, label, align, render, sort, className, width } — which is
 * how an id becomes a link without this component knowing anything about
 * routes. Given neither, it renders the result's own shape, which is what the
 * console needs.
 *
 * NULLS SORT LAST, ALWAYS.
 *     SQLite sorts NULL first, and this database uses NULL for "not
 *     established". Sorted naively, the drivers nobody has a points total for
 *     lead the points table. Ordering by a missing value is meaningless in
 *     either direction, so missing values go to the bottom of both.
 */
const PAGE = 250

function compare(a, b) {
  if (missing(a) && missing(b)) return 0
  if (missing(a)) return 1
  if (missing(b)) return -1
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
  empty = 'Nothing recorded.',
  rowKey,
  highlight,
  page = PAGE,
  sortable = true,
  footer,
}) {
  const source = given ?? data?.rows ?? []
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
    return [...source].sort((a, b) => sign * compare(value(a), value(b)))
  }, [source, sort, direction, cols])

  if (cols.length === 0 || (source.length === 0 && !caption)) {
    return <p className="state">{empty}</p>
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
    <div className="table-wrap" data-rows={ordered.length} data-shown={visible.length}>
      <div className="table-scroll">
        <table>
          {caption && <caption>{caption}</caption>}
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
                    {column.render ? column.render(row[column.key], row) : cell(row[column.key])}
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

/** A value, with NULL rendered as the em dash that means "not established". */
export function cell(value) {
  if (missing(value)) return <span className="empty">—</span>
  return text(value)
}
