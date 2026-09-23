import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EMPTY, isNumericColumn, isProseColumn, label as humanise, missing, text } from '../lib/format.js'
import { staticRows } from '../lib/handover.js'
import { shared, sharedLine } from '../lib/table.js'
import { useUrlState } from '../lib/urlstate.js'
import { PageTitle, SectionTitle } from './Page.jsx'
import TakeAway from './TakeAway.jsx'

/**
 * One table component for everything, from the season list to whatever a
 * reader types into the SQL console.
 *
 * Columns can be given as strings (take the value, guess the alignment) or as
 * objects — { key, label, align, cellClass, render, sort, className, width,
 * text } — which is how an id becomes a link without this component knowing
 * anything about routes. Given neither, it renders the result's own shape,
 * which is what the console needs.
 *
 * `cellClass` is a constant class on every cell of the column, header included,
 * declared in the page's queries module and read by scripts/prerender.js too,
 * so a column the stylesheet treats specially looks the same before the
 * database opens and after. `className` is the per-row one and stays a
 * function.
 *
 * `text` is a plain-string formatter from a page's queries module, shared
 * with scripts/prerender.js so the static table prints the same cell; it is
 * used where the page gives no `render`. See queries/drivers.js.
 *
 * `ariaHidden` takes a column out of the accessibility tree, header and every
 * cell, and leaves its header empty: a column that only repeats in colour
 * what the column beside it says in words, which is the classification's
 * result rail (AX-12). scripts/prerender.js reads the same flag.
 *
 * `rowHeader` makes the column's cells `<th scope="row">` rather than `<td>`:
 * the cell that says which row this is - the driver, the chassis, the season
 * (AX-21). Without one, a screen reader moving down the Result column of a
 * 394-race career hears 394 values and nothing to say which race each belongs
 * to; with one, it names the row as it arrives. A row is sometimes named by
 * two cells together - a race is its season AND its Grand Prix, since either
 * alone repeats down the table - and a column list marks both, which is what
 * HTML's row headers allow. Every declared column list in web/src/queries
 * names at least one (web/test/conventions.mjs); the SQL console's result
 * declares nothing and has none, because a statement's shape is not known to
 * have a name column. scripts/prerender.js reads the same flag, and the
 * stylesheet draws the cell as the `<td>` it replaced.
 *
 * `opening` is the order the rows already arrive in - `{ key, direction }`,
 * the column a query's ORDER BY leads with - and it is shown, never applied.
 * A table that opens in the query's own order used to open with no arrow and
 * no `aria-sort` on any header, so the order a reader saw was unexplained
 * (CR-28); re-sorting client-side to show it would trade SQLite's collation
 * for the browser's and break the tie-breaks the ORDER BY spells out. So the
 * header says what the order is, and the rows are left as they came until
 * the reader asks for another. It is shown only on a column that sorts: an
 * `aria-sort` on a header with no button inside it announces an order the
 * reader cannot change.
 *
 * AND THAT COLUMN KEEPS THE QUERY'S ORDER IN BOTH DIRECTIONS.
 *     `compare()` below reads digits as numbers and SQLite's NOCASE reads
 *     them as characters, so the disagreements table opens "10 chassis"
 *     before "3 chassis" and a client sort on the same column puts them the
 *     other way round. Sorted by `compare()`, one "Subject ▲" would have
 *     stood for two orders depending on whether the reader had clicked. So
 *     on the opening column the arrival order is the order: ascending is the
 *     rows as they came, descending is those rows reversed with the missing
 *     ones still last. Every other column sorts by `compare()` as before.
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

/**
 * The table a reader can send somebody: its sort column, its direction and
 * whether it has been expanded, in the address bar as `?sort=wins&dir=asc`
 * and `?all=1` (IA-08). A sort that is the table's own default is not
 * written down, so a register nobody has touched keeps a clean address.
 *
 * `addressed` is opt-in, and only a page whose register IS the page takes it
 * — the four registers and the race index. One set of parameters can name
 * one table, and on a page of seven they would fight over it.
 */
export default function DataTable({ addressed = false, ...props }) {
  return addressed ? <AddressedTable {...props} /> : <Table {...props} />
}

function AddressedTable({ sort = null, direction = 'asc', ...props }) {
  const [state, set] = useUrlState({ sort: sort ?? '', dir: direction, all: false })

  /*
   * A sort is a column, and what arrives from the address is a string.
   *
   * `/races` renders its header unsortable — the query's own order, run
   * first and newest first, is the order the page means — and `?sort=year`
   * there put the index in an order no control expresses, under an
   * `aria-sort` on a header with no button inside it to change or clear.
   * `?sort=` with nothing after it threw a register's opening sort away
   * just as quietly, taking the arrow and the `aria-sort` with it.
   *
   * So the address is read the same way a filter is (`oneOf` in
   * lib/urlstate.js): a key no header offers, or any key at all on a table
   * that does not sort, falls back to the table's own opening sort and
   * direction. The parameter stays in the address, wrong and visible,
   * rather than the page quietly being wrong.
   */
  const offered = (props.sortable === false ? [] : (props.columns ?? []))
    .map((column) => (typeof column === 'string' ? { key: column } : column))
    .filter((column) => column.sortable !== false)
    .map((column) => column.key)
  const asked = offered.includes(state.sort)

  return (
    <Table
      {...props}
      sort={asked ? state.sort : sort}
      // A direction is one of two words; anything else typed into the address
      // is not a third option, it is a mistake, and ascending is the default.
      direction={asked ? (state.dir === 'desc' ? 'desc' : 'asc') : direction}
      showAll={state.all}
      onSort={(key, next) => set({ sort: key, dir: next })}
      onShowAll={() => set({ all: true })}
    />
  )
}

function Table({
  data,
  rows: given,
  columns,
  caption,
  // The sort, the direction and the expansion are the table's own until a
  // caller hands back an `onSort` or an `onShowAll`, at which point that
  // caller holds them — which is how AddressedTable keeps its copy in the
  // URL rather than in a second place that could disagree with it.
  sort: givenSort = null,
  direction: givenDirection = 'asc',
  opening = null,
  showAll: givenShowAll = false,
  onSort,
  onShowAll,
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
  /*
   * What the FILE is called, which is not always what the table is called.
   *
   * On a register the page is the table and one name serves both. On an entity
   * page `name` is the section heading - "Every race" - which says what the
   * table is and nothing about whose, so every driver's race table would land
   * in a downloads folder as another copy of one file name. The page's own
   * title is the subject, so the file takes both.
   *
   * An explicit `caption` is left alone: it is already a statement that this
   * table has a name of its own and the heading above it is the wrong one.
   */
  const fileLabel =
    caption ?? [pageTitle, name === pageTitle ? null : name].filter(Boolean).join(' ')
  const [ownSort, setOwnSort] = useState(givenSort)
  const [ownDirection, setOwnDirection] = useState(givenDirection)
  const [ownShowAll, setOwnShowAll] = useState(false)
  const sort = onSort ? givenSort : ownSort
  const direction = onSort ? givenDirection : ownDirection
  const showAll = onShowAll ? givenShowAll : ownShowAll

  const cols = useMemo(
    () => normalise(columns ?? data?.columns ?? [], source),
    [columns, data?.columns, source],
  )

  // The columns the header keeps, and the ones every row agreed on, which a
  // column has to have declared itself a candidate for in web/src/queries/*
  // (VD-29). A console result declares nothing, so nothing there collapses,
  // which is right: the result's shape is the statement's shape.
  const { columns: kept, shared: constants } = useMemo(() => shared(cols, source), [cols, source])

  const openingKey = opening?.key
  const openingDirection = opening?.direction ?? 'asc'
  const ordered = useMemo(() => {
    if (!sort) return source
    const column = cols.find((c) => c.key === sort)
    const value = column?.sort ?? ((row) => row[sort])
    if (sort === openingKey) {
      if (direction === openingDirection) return source
      // Reversed, not re-sorted, and the missing values stay at the bottom.
      const present = source.filter((row) => !missing(value(row)))
      return [...present.reverse(), ...source.filter((row) => missing(value(row)))]
    }
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
  }, [source, sort, direction, cols, openingKey, openingDirection])

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

  /*
   * The page opens on at least what the reader could already see.
   *
   * On a prerendered route the static page draws every row - 862 drivers,
   * 1,153 chassis - and this table used to replace it with `page` of them the
   * moment the database opened. A reader at row 700 was returned to a table
   * that ended at 150 (IX-19). lib/handover.js counted the static table before
   * it was removed, and the app opens on at least that many.
   *
   * The price is that a seeded register re-renders all of its rows rather than
   * `page` of them - every keystroke in the filter above /drivers now lays out
   * 862 rows, not 150. They are the rows the static page already had in the
   * document, and the alternative is taking them away again, so it is the
   * right side of the trade; it is the one thing here that got dearer.
   *
   * Where the static table held everything, that is the whole table and there
   * is nothing left to show: `hidden` is 0 and no "Show the remaining" is
   * drawn, which is right, because a control that took rows away again would
   * be the defect with a button on it. Where the static table was itself a
   * declared slice - /races prints the 200 most recently run - the button is
   * there for the rest, which is the "collapse only afterwards" the item asked
   * for: by the reader's hand, never by an event they did not cause.
   *
   * AND SO A SEEDED TABLE IS EXPANDED WITHOUT `all=1` IN THE ADDRESS.
   *     IA-08 writes an expansion down so a reader can send the table they
   *     are looking at. This one is not written down, so the link they send
   *     opens at `page` rows for somebody who did not arrive through the
   *     static page. The alternative is worse: writing to the address bar on
   *     an event the reader did not cause, which would put a parameter in
   *     their history for having waited for the database. The rows are the
   *     same rows either way, and the receiver's own arrival seeds their own
   *     table.
   */
  // The order the header states: the reader's sort where there is one, and
  // otherwise the order the rows arrived in, where the caller has named it
  // and the column is one a reader can sort by.
  const resting =
    !sort && opening && sortable && kept.some((c) => c.key === opening.key && c.sortable !== false) ? opening : null
  const shownSort = sort ?? resting?.key ?? null
  const shownDirection = sort ? direction : (resting?.direction ?? 'asc')

  const size = Math.max(page, staticRows(name))
  const visible = showAll ? ordered : ordered.slice(0, size)
  const hidden = ordered.length - visible.length

  const toggle = (key) => {
    // From the order the header shows, so the first click on a column the
    // table merely opened in reverses it rather than restating it.
    const next =
      key === shownSort
        ? shownDirection === 'asc'
          ? 'desc'
          : 'asc'
        : // Numbers are nearly always most interesting at their largest.
          cols.find((c) => c.key === key)?.align === 'num'
          ? 'desc'
          : 'asc'
    if (onSort) onSort(key, next)
    else {
      setOwnSort(key)
      setOwnDirection(next)
    }
  }

  // data-rows is the total the table holds, not the number currently on
  // screen. The smoke suite reads it to compare what a page shows against
  // what the database says it should, without having to page through.
  return (
    <>
      {/* Above the table rather than in its footer: a column that is not there
          has to be accounted for before the reader wonders where it went. */}
      {constants.length > 0 && <p className="table-shared">{sharedLine(constants, ordered.length)}</p>}
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
                {kept.map((column) => {
                  const active = shownSort === column.key
                  const canSort = sortable && column.sortable !== false
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      // `cellClass` on the header too: scripts/prerender.js puts the
                      // column's class on its <th> as well as its <td>, and a class
                      // the two halves spell differently is the divergence this
                      // mechanism exists to prevent (VD-01). `sortable` is the app's
                      // alone — the static table has no buttons to sort with.
                      className={[column.align, column.cellClass, canSort ? 'sortable' : null]
                        .filter(Boolean)
                        .join(' ')}
                      style={column.width ? { width: column.width } : undefined}
                      aria-sort={active ? (shownDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                      aria-hidden={column.ariaHidden ? 'true' : undefined}
                    >
                      {column.ariaHidden ? null : canSort ? (
                        <button type="button" onClick={() => toggle(column.key)}>
                          {column.label}
                          {/* A column that sorts says so at rest (IX-20): the idle
                              mark is the stylesheet's, so it is no part of the
                              header's text and the static table, which has no
                              buttons, draws none. */}
                          <span className={active ? 'arrow' : 'arrow is-idle'} aria-hidden="true">
                            {active ? (shownDirection === 'asc' ? '▲' : '▼') : ''}
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
                  <td colSpan={kept.length} className="prose">
                    {empty}
                  </td>
                </tr>
              )}
              {visible.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  className={highlight?.(row) ? 'is-highlight' : undefined}
                >
                  {kept.map((column) => {
                    const Cell = column.rowHeader ? 'th' : 'td'
                    return (
                      <Cell
                        key={column.key}
                        scope={column.rowHeader ? 'row' : undefined}
                        className={[column.align, column.cellClass, column.className?.(row)]
                          .filter(Boolean)
                          .join(' ')}
                        aria-hidden={column.ariaHidden ? 'true' : undefined}
                      >
                        {column.render
                          ? column.render(row[column.key], row)
                          : column.text
                            ? plain(column.text(row[column.key], row))
                            : cell(row[column.key], { raw })}
                      </Cell>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* The footer is drawn on every table that has rows now, where before
            it appeared only to hold a "Show the remaining" button or a page's
            own note. It carries the way out of the site (IX-26), and a table
            small enough to fit is exactly the one a reader is most likely to
            want to take. */}
        <div className="table-foot">
          <span>{footer}</span>
          <div className="table-acts">
            {hidden > 0 && (
              <button
                type="button"
                className="more"
                // Seven tables on a page put seven identical "Show the
                // remaining" in a screen reader's list of controls.
                aria-label={
                  name ? `Show the remaining ${hidden.toLocaleString('en-GB')}, ${name}` : undefined
                }
                onClick={() => (onShowAll ? onShowAll() : setOwnShowAll(true))}
              >
                Show the remaining {hidden.toLocaleString('en-GB')}
              </button>
            )}
            {/* `cols` and not `kept`: a column collapsed into the sentence
                above the table (VD-29) is still data, and a file that has
                left the page has no sentence above it. */}
            <TakeAway columns={cols} rows={ordered} shown={visible.length} name={name} fileLabel={fileLabel} />
          </div>
        </div>
      </div>
    </>
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
