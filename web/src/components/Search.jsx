import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
         first_season AS from_year, last_season AS to_year
    FROM drivers
  UNION ALL
  SELECT 'Constructor', id, name, COALESCE(country, ''), first_entry, last_entry
    FROM constructors
  UNION ALL
  SELECT 'Circuit', id, name, COALESCE(country, ''), first_gp, last_gp
    FROM circuits
  UNION ALL
  SELECT 'Car', id, name, COALESCE(constructor_id, ''), first_year, last_year
    FROM chassis
  UNION ALL
  SELECT 'Season', CAST(year AS TEXT), CAST(year AS TEXT) || ' season',
         COALESCE(drivers_champion, ''), year, year
    FROM seasons
  UNION ALL
  SELECT 'Race', year || '/' || round, year || ' ' || name_used,
         COALESCE(circuit_id, ''), year, year
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
    indexPromise = query(INDEX_SQL).then(({ rows }) =>
      rows.map((row) => ({ ...row, needle: row.label.toLowerCase() })),
    )
  }
  return indexPromise
}

/**
 * Rank a match by where it starts.
 *
 * A search for "hill" should offer Damon Hill before Graham Hill's Brabham,
 * and both before anything that merely contains the letters. Start of the
 * label beats start of a word beats anywhere; ties break on the shorter
 * label, because that is usually the more specific entity.
 */
function score(entry, needle) {
  const at = entry.needle.indexOf(needle)
  if (at === -1) return -1
  if (at === 0) return 100 - entry.needle.length / 200
  if (entry.needle[at - 1] === ' ' || entry.needle[at - 1] === '-') return 60 - entry.needle.length / 200
  return 20 - entry.needle.length / 200
}

export default function Search({ open, onClose }) {
  const [index, setIndex] = useState(null)
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    setTerm('')
    setActive(0)
    loadIndex().then(setIndex, () => setIndex([]))
    input.current?.focus()
  }, [open])

  const results = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!index || needle.length < 2) return []
    const hits = []
    for (const entry of index) {
      const value = score(entry, needle)
      if (value > 0) hits.push([value, entry])
    }
    hits.sort((a, b) => b[0] - a[0])
    return hits.slice(0, 40).map(([, entry]) => entry)
  }, [index, term])

  if (!open) return null

  const go = (entry) => {
    if (!entry) return
    onClose()
    navigate(ROUTE[entry.kind](entry.key))
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') onClose()
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(results[active])
    }
  }

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search the database">
        <input
          ref={input}
          type="text"
          value={term}
          autoComplete="off"
          spellCheck="false"
          placeholder="A driver, a team, a circuit, a car, a season, a race…"
          onChange={(event) => {
            setTerm(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          aria-controls="palette-results"
        />
        <ul id="palette-results">
          {results.map((entry, i) => (
            <li key={`${entry.kind}-${entry.key}`} data-active={i === active}>
              {/* A real Link, not an <a href={`#${...}`}>. The hash hrefs
                  these used to carry were dead the moment the router stopped
                  reading the hash — and even under the old router they were
                  wrong for a middle-click, an open-in-new-tab or a copied
                  link, because the only thing that actually navigated was the
                  onClick beneath them. Link writes the href the router would
                  honour, basename and all, and still closes the palette. */}
              <Link
                to={ROUTE[entry.kind](entry.key)}
                onClick={() => onClose()}
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
          {term.trim().length >= 2 && results.length === 0 && (
            <li>
              <span className="nohit">
                <span className="kind">No match</span>
                <span className="muted">
                  {index ? 'Nothing in the register answers to that.' : 'Building the index…'}
                </span>
              </span>
            </li>
          )}
        </ul>
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
