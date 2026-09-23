import { useEffect, useMemo, useRef, useState } from 'react'
import { elsewhere, prepare, rank } from '../lib/search.js'
import { QUESTIONS, questionPath } from '../lib/questions.js'
import { NAMES } from '../lib/site.js'
import { CHANGES_TITLE } from '../lib/changes.js'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { query } from '../data/client.js'

/**
 * One way in, for everything on the site with an address.
 *
 * A register of hundreds of drivers reached only by scrolling an alphabetical
 * table is a register nobody reads. This is the answer to "where is Rindt",
 * "what happened at Monza in 1971", "which car was the 79" and "who has won
 * the most" without having to know first which page holds it.
 *
 * The index is one query, run once, the first time the palette is opened,
 * and two lists that need no query: the site's own pages and the questions
 * in lib/questions.js. A few thousand rows is nothing against a database
 * already in memory, and every keystroke afterwards is filtered locally with
 * no round trip.
 *
 * Every branch says where its row goes, as `path`. `meta` is shown beside the
 * label and searched; `also` is searched and never shown. Names rather than
 * ids in `meta` - a season's champion, a race's circuit, a car's team - because
 * the id is what the database joins on and the name is what a reader types:
 * "hamilton 2008" is Sir Lewis's season, and the 1971 race at Monza is at the
 * Autodromo Nazionale Monza, not at `monza`.
 */
const INDEX_SQL = `
  SELECT 'Driver' AS kind, id AS key, full_name AS label,
         COALESCE(nationality, '') AS meta,
         first_season AS from_year, last_season AS to_year,
         COALESCE(wins, 0) AS weight, '' AS also, '/drivers/' || id AS path
    FROM drivers
  UNION ALL
  SELECT 'Constructor', id, name, COALESCE(country, ''), first_entry, last_entry,
         COALESCE(wins, 0), COALESCE(full_name, ''), '/constructors/' || id
    FROM constructors
  UNION ALL
  SELECT 'Circuit', id, name, COALESCE(country, ''), first_gp, last_gp,
         COALESCE(gp_count, 0), COALESCE(locality, ''), '/circuits/' || id
    FROM circuits
  UNION ALL
  -- The full name, so "Ferrari 312" finds the 312 and not nothing: the bare
  -- model number is what the register stores, not what anyone types.
  SELECT 'Car', ch.id, COALESCE(ch.full_name, ch.name), COALESCE(k.name, ''), ch.first_year, ch.last_year,
         COALESCE(ch.wins, 0), '', '/cars/' || ch.id
    FROM chassis ch
    LEFT JOIN constructors k ON k.id = ch.constructor_id
  UNION ALL
  -- The curated designs no chassis row owns - the Lotus 72, the Brawn BGP 001,
  -- the Mercedes W11 - whose deep-dive pages had an address and no way in.
  SELECT 'Car', c.id, c.full_name, COALESCE(k.name, ''), c.from_year, c.to_year,
         COALESCE(c.wins, 0), c.designation, '/cars/' || c.id
    FROM cars c
    LEFT JOIN constructors k ON k.id = c.constructor_id
   WHERE c.id NOT IN (SELECT id FROM chassis)
  UNION ALL
  SELECT 'Season', CAST(s.year AS TEXT), CAST(s.year AS TEXT) || ' season',
         COALESCE(d.full_name, ''), s.year, s.year, 0, '', '/seasons/' || s.year
    FROM seasons s
    LEFT JOIN drivers d ON d.id = s.drivers_champion
  UNION ALL
  SELECT 'Race', r.year || '/' || r.round, r.year || ' ' || r.name_used,
         COALESCE(c.name, ''), r.year, r.year, 0, COALESCE(c.locality, ''),
         '/races/' || r.year || '/' || r.round
    FROM races r
    LEFT JOIN circuits c ON c.id = r.circuit_id
  UNION ALL
  -- A Grand Prix has no page of its own; the race index filtered to its name
  -- is every edition run under that name, on one page. The address is
  -- written in loadIndex, where the name can be encoded.
  SELECT 'Grand Prix', id, name, COALESCE(country, ''), first_held, last_held,
         COALESCE(editions, 0), COALESCE(aliases, ''), NULL
    FROM grands_prix
  UNION ALL
  -- The holder and the figure as the meta, so "most poles" is answered in the
  -- row before it is opened.
  SELECT 'Record', key, record, holder || ' · ' || value, NULL, NULL, 0, category,
         '/records?category=' || category
    FROM records
`

/**
 * The site's own pages. The palette used to find only what the registers
 * hold, so "records", "glossary", "eras", "sql" and "download" - five pages a
 * reader might reasonably look for by name - returned nothing (IA-30). `also`
 * is what each page is for, in the words a reader looking for it would use.
 */
const PAGES = [
  ['/seasons', NAMES.seasons().headline, 'years championships calendar'],
  ['/now', 'The season in progress', 'current this year now live'],
  ['/races', NAMES.races().headline, 'grands prix results calendar'],
  ['/drivers', NAMES.drivers().headline, 'register every driver'],
  ['/constructors', NAMES.constructors().headline, 'teams register'],
  ['/circuits', NAMES.circuits().headline, 'tracks venues register'],
  ['/cars', NAMES.cars().headline, 'chassis register'],
  ['/records', NAMES.records().headline, 'most wins poles titles youngest leaderboards statistics'],
  ['/data', NAMES.data().headline, 'download files export sqlite json csv parquet licence'],
  ['/data/sql', NAMES.sql().headline, 'sql query console'],
  ['/data/quality', NAMES.quality().headline, 'confidence gaps discrepancies checks'],
  ['/data/sources', NAMES.sources().headline, 'licence licenses attribution provenance'],
  ['/changes', CHANGES_TITLE, 'changelog releases updates corrections'],
  ['/reference/eras', NAMES.eras().headline, 'eras rules regulations history'],
  ['/reference/glossary', NAMES.glossary().headline, 'glossary terms definitions people'],
  ['/about', NAMES.about().headline, 'who contact corrections'],
].map(([path, label, also]) => ({ kind: 'Page', key: path, label, meta: '', also, path, weight: 100 }))

const ASKED = QUESTIONS.map((entry, i) => ({
  kind: 'Question',
  key: String(i),
  label: entry.q,
  meta: entry.topic,
  also: entry.also,
  path: questionPath(entry),
  weight: 0,
}))

let indexPromise = null

function loadIndex() {
  if (!indexPromise) {
    // Memoising the REJECTION too meant one transient failure — a worker still
    // starting, a database fetch that lost the connection — left the palette
    // reporting "0 entities indexed" for the rest of the session, with no way
    // back but a reload. Forget a failed attempt so the next open retries.
    indexPromise = query(INDEX_SQL)
      .then(({ rows }) =>
        [...PAGES, ...rows, ...ASKED].map((row) =>
          prepare(row.kind === 'Grand Prix' ? { ...row, path: `/races?q=${encodeURIComponent(row.label)}` } : row),
        ),
      )
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
  const { pathname, search } = useLocation()

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

  // As typed first; only when that finds nothing, the near spellings, so a
  // name spelt right is never crowded by its neighbours (IX-22). And when
  // neither finds anything, the two places to look instead are the options,
  // so a keyboard reaches them the way it reaches a result.
  const { results, found } = useMemo(() => {
    const needle = term.trim()
    if (!index || needle.length < 2) return { results: [], found: 'none' }
    const scan = (options) => {
      const hits = []
      for (const entry of index) {
        const value = rank(entry, needle, options)
        if (value > 0) hits.push([value, entry])
      }
      hits.sort((a, b) => b[0] - a[0])
      return hits.slice(0, 40).map(([, entry]) => entry)
    }
    const exact = scan()
    if (exact.length > 0) return { results: exact, found: 'exact' }
    const near = scan({ fuzzy: true })
    if (near.length > 0) return { results: near, found: 'near' }
    return { results: elsewhere(needle), found: 'none' }
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

  // Picking a result on the page already open is a close, not a navigation
  // to a new page: the pathname does not change, so Page.jsx has no heading
  // to hand focus to. That includes a question for the console opened from
  // the console, and a filtered register from that register, where only the
  // query string moves - so the pathname is what is compared.
  const samePage = (to) => to.split(/[?#]/)[0] === pathname
  const pick = (to) => (samePage(to) ? dismiss() : onClose())

  const go = (entry) => {
    if (!entry) return
    pick(entry.path)
    if (entry.path !== pathname + search) navigate(entry.path)
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
          placeholder="A driver, a team, a circuit, a race, or a question…"
          onChange={(event) => {
            setTerm(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        {/* Outside the listbox, which may hold only options. A live region,
            present from the first frame so its changes are announced: the
            count while there are rows as typed, and otherwise what the rows
            are instead - the near spellings, or two places to look. Above the
            list, because that is what it does for the rows: heads them. */}
        <div role="status" className="palette-status">
          {searched && !index ? (
            <span className="nohit">
              <span className="kind">Indexing</span>
              <span className="muted">Building the index…</span>
            </span>
          ) : searched && found === 'none' ? (
            <span className="nohit">
              <span className="kind">No match</span>
              <span className="muted">Nothing on the site answers to that. Two places to look instead:</span>
            </span>
          ) : searched && found === 'near' ? (
            <span className="nohit">
              <span className="kind">Did you mean</span>
              <span className="muted">
                Nothing is spelt quite that way. {results.length === 1 ? 'The nearest spelling:' : 'The nearest spellings:'}
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
                to={entry.path}
                tabIndex={-1}
                onClick={() => pick(entry.path)}
                onMouseEnter={() => setActive(i)}
              >
                <span className="kind">{entry.kind}</span>
                <span>{entry.label}</span>
                <span className="meta">
                  {entry.meta}
                  {entry.kind !== 'Season' && entry.kind !== 'Race' && entry.kind !== 'Record' && entry.from_year
                    ? ` · ${entry.from_year}${entry.to_year && entry.to_year !== entry.from_year ? `–${entry.to_year}` : ''}`
                    : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="hint">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
          <span className="muted">
            {index ? `${index.length.toLocaleString('en-GB')} pages, names and questions indexed` : 'indexing…'}
          </span>
        </p>
      </div>
    </div>
  )
}
