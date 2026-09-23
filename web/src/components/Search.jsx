import { useEffect, useMemo, useRef, useState } from 'react'
import { fold, rank } from '../lib/search.js'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { query } from '../data/client.js'

/**
 * One way in, for 3,494 things.
 *
 * A register of 862 drivers reached only by scrolling an alphabetical table is
 * a register nobody reads. This is the answer to "where is Rindt", "what
 * happened at Monza in 1971" and "which car was the 79" without having to know
 * first which of six pages holds it.
 *
 * The index is one query, run once, the first time the palette is opened —
 * about 3,500 rows, which is nothing against a database already in memory, and
 * means every keystroke afterwards is filtered locally with no round trip.
 */
const INDEX_SQL = `
  SELECT 'Driver' AS kind, id AS key, full_name AS label,
         COALESCE(nationality, '') AS meta,
         first_season AS from_year, last_season AS to_year,
         COALESCE(wins, 0) AS weight
    FROM drivers
  UNION ALL
  SELECT 'Constructor', id, name, COALESCE(country, ''), first_entry, last_entry,
         COALESCE(wins, 0)
    FROM constructors
  UNION ALL
  SELECT 'Circuit', id, name, COALESCE(country, ''), first_gp, last_gp,
         COALESCE(gp_count, 0)
    FROM circuits
  UNION ALL
  -- The full name, so "Ferrari 312" finds the 312 and not nothing: the bare
  -- model number is what the register stores, not what anyone types.
  SELECT 'Car', id, COALESCE(full_name, name), COALESCE(constructor_id, ''), first_year, last_year,
         COALESCE(wins, 0)
    FROM chassis
  UNION ALL
  SELECT 'Season', CAST(year AS TEXT), CAST(year AS TEXT) || ' season',
         COALESCE(drivers_champion, ''), year, year, 0
    FROM seasons
  UNION ALL
  SELECT 'Race', year || '/' || round, year || ' ' || name_used,
         COALESCE(circuit_id, ''), year, year, 0
    FROM races
`

const ROUTE = {
  Driver: (key) => `/drivers/${key}`,
  Constructor: (key) => `/constructors/${key}`,
  Circuit: (key) => `/circuits/${key}`,
  Car: (key) => `/cars/${key}`,
  Season: (key) => `/seasons/${key}`,
  Race: (key) => `/races/${key}`,
}

let indexPromise = null

function loadIndex() {
  if (!indexPromise) {
    // Memoising the REJECTION too meant one transient failure — a worker still
    // starting, a database fetch that lost the connection — left the palette
    // reporting "0 entities indexed" for the rest of the session, with no way
    // back but a reload. Forget a failed attempt so the next open retries.
    indexPromise = query(INDEX_SQL)
      .then(({ rows }) => rows.map((row) => ({ ...row, needle: fold(row.label) })))
      .catch((error) => {
        indexPromise = null
        throw error
      })
  }
  return indexPromise
}

/**
 * A modal combobox: one field, a listbox of results, and nowhere else to go.
 *
 * It declared `aria-modal` and behaved as none of it (AX-02). Shift+Tab left
 * it for the page behind; the highlighted row moved on screen and nowhere a
 * screen reader could follow, because the field never named it; and Escape
 * removed the dialog with focus inside it, which drops the reader on <body>.
 *
 * So the field is the only stop. The rows are options of a listbox that the
 * field points into with `aria-activedescendant` — the WAI-ARIA combobox
 * pattern — and each keeps its real link for a click, a middle-click or a
 * copied address, taken out of the tab order. Tab has nowhere to go and stays
 * put. Closing without a navigation hands focus back to whatever had it when
 * the palette opened; a navigation leaves it to Page.jsx, which focuses the
 * new heading.
 */
export default function Search({ open, onClose }) {
  const [index, setIndex] = useState(null)
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const opener = useRef(null)
  const byKey = useRef(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!open) return
    // Read before the field takes focus: this effect runs in the commit that
    // mounts the palette, so focus is still where the reader opened it from.
    opener.current = document.activeElement
    setTerm('')
    setActive(0)
    loadIndex().then(setIndex, () => setIndex([]))
    input.current?.focus()
  }, [open])

  // Keep the highlighted row in view when the arrow keys move it past the
  // edge of the list. Not on hover: a row the pointer is on is already there.
  useEffect(() => {
    if (!byKey.current) return
    byKey.current = false
    document.getElementById(`palette-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const results = useMemo(() => {
    const needle = term.trim()
    if (!index || needle.length < 2) return []
    const hits = []
    for (const entry of index) {
      const value = rank(entry, needle)
      if (value > 0) hits.push([value, entry])
    }
    hits.sort((a, b) => b[0] - a[0])
    return hits.slice(0, 40).map(([, entry]) => entry)
  }, [index, term])

  if (!open) return null

  // Close with no route change, so nothing else will place focus: put it back
  // where it was. <main> when that was nowhere — the page itself, or an
  // element a re-render has since removed — rather than <body>.
  const dismiss = () => {
    const back = opener.current
    opener.current = null
    onClose()
    const target = back?.isConnected && back !== document.body ? back : document.getElementById('main')
    target?.focus({ preventScroll: true })
  }

  // Picking the page already open is a close, not a navigation: the pathname
  // does not change, so Page.jsx has no heading to hand focus to.
  const pick = (to) => (to === pathname ? dismiss() : onClose())

  const go = (entry) => {
    if (!entry) return
    const to = ROUTE[entry.kind](entry.key)
    pick(to)
    if (to !== pathname) navigate(to)
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      dismiss()
    } else if (event.key === 'Tab') {
      // The field is the dialog's only stop, so Tab and Shift+Tab stay on it.
      event.preventDefault()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      byKey.current = true
      // Never below 0: with no rows yet — the index still loading — the upper
      // bound is -1, and an active descendant of -1 names no element.
      setActive((i) => Math.max(0, Math.min(i + 1, results.length - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      byKey.current = true
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(results[active])
    }
  }

  const searched = term.trim().length >= 2
  const shown = results.length > 0

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      // A press on the backdrop closes. A press anywhere inside that is not
      // the field would take focus off it and out of the dialog, to <body>,
      // where the next Tab leaves for the page: hold focus where it is, which
      // still lets the click land on a result.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss()
        else if (event.target !== input.current) event.preventDefault()
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search the database">
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-label="Search"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls="palette-results"
          aria-activedescendant={shown ? `palette-option-${active}` : undefined}
          value={term}
          autoComplete="off"
          spellCheck="false"
          placeholder="A driver, a team, a circuit, a car, a season, a race…"
          onChange={(event) => {
            setTerm(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        {/* The WAI-ARIA combobox pattern with aria-activedescendant: focus
            stays on the field, so neither the list nor its rows are meant
            to take it, which is what the two rules below cannot know. */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a listbox the field points into, per the combobox pattern (AX-02) */}
        <ul id="palette-results" role="listbox" aria-label="Results">
          {results.map((entry, i) => (
            // biome-ignore lint/a11y/useFocusableInteractive: reached by aria-activedescendant from the field, never by focus (AX-02)
            <li
              key={`${entry.kind}-${entry.key}`}
              id={`palette-option-${i}`}
              // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: an option of that listbox (AX-02)
              role="option"
              aria-selected={i === active}
              data-active={i === active}
            >
              {/* A real Link, not an <a href={`#${...}`}>. The hash hrefs
                  these used to carry were dead the moment the router stopped
                  reading the hash — and even under the old router they were
                  wrong for a middle-click, an open-in-new-tab or a copied
                  link, because the only thing that actually navigated was the
                  onClick beneath them. Link writes the href the router would
                  honour, basename and all, and still closes the palette. */}
              <Link
                to={ROUTE[entry.kind](entry.key)}
                tabIndex={-1}
                onClick={() => pick(ROUTE[entry.kind](entry.key))}
                onMouseEnter={() => setActive(i)}
              >
                <span className="kind">{entry.kind}</span>
                <span>{entry.label}</span>
                <span className="meta">
                  {entry.meta}
                  {entry.kind !== 'Season' && entry.kind !== 'Race' && entry.from_year
                    ? ` · ${entry.from_year}${entry.to_year && entry.to_year !== entry.from_year ? `–${entry.to_year}` : ''}`
                    : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {/* Outside the listbox, which may hold only options. A live region,
            present from the first frame so its changes are announced: the
            count while there are rows, the reason while there are none. */}
        <div role="status" className="palette-status">
          {searched && !shown ? (
            <span className="nohit">
              <span className="kind">No match</span>
              <span className="muted">
                {index ? 'Nothing in the register answers to that.' : 'Building the index…'}
              </span>
            </span>
          ) : searched ? (
            <span className="sr-only">
              {results.length === 40
                ? 'The 40 closest matches'
                : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
            </span>
          ) : null}
        </div>
        <p className="hint">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
          <span className="muted">
            {index ? `${index.length.toLocaleString('en-GB')} entities indexed` : 'indexing…'}
          </span>
        </p>
      </div>
    </div>
  )
}
