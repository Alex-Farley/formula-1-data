import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { NAMES, SELF_DESCRIBING, TIMING_EMPTY_TABLES, timingEmpty, TWO_FILES } from '../lib/site.js'
import { bare, emptyTimingTableRead } from '../lib/sql.js'
import { Note, Onward, Page, Section } from '../components/Page.jsx'
import { ErrorBox, Loading } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import SubNav from '../components/SubNav.jsx'
import { query, queryReadOnly } from '../data/client.js'
import { number } from '../lib/format.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
// `m.sql` alongside the column names, because the column names are the half
// of the schema that cannot warn anybody. The comments in the DDL are where
// this database says what a column means — that `standings.after_round IS
// NULL` is the end-of-season classification and not the last round, that a
// NULL `position` is an exclusion rather than a gap. The page already tells
// the reader to run `SELECT sql FROM sqlite_master` for the commented schema
// (SELF_DESCRIBING, in the paragraph below the note); the panel beside it
// printed only `pragma_table_info`, so the warning was one query away from
// the reader who most needed it.
const SCHEMA = `
  SELECT m.type, m.name, m.sql,
         (SELECT group_concat(p.name, ', ') FROM pragma_table_info(m.name) p) AS columns
    FROM sqlite_master m
   WHERE m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite_%'
   ORDER BY m.type DESC, m.name
`

const EXAMPLES = [
  [
    'Who has led a race from pole most often?',
    `SELECT d.full_name, COUNT(*) AS pole_to_win
   FROM race_entries e
   JOIN drivers d ON d.id = e.driver_id
  WHERE e.pole = 1 AND e.finish_position = 1
  GROUP BY e.driver_id
  ORDER BY pole_to_win DESC
  LIMIT 15`,
  ],
  [
    "The drivers' championship as it stands",
    `SELECT position, entity AS driver, team, points
   -- standings keeps a row after every round, and more than one source's
   -- reading of each; this view is the fold — one row per driver per season.
   FROM v_standings_final
  WHERE table_type = 'drivers'
    AND year = (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'current_season')
  ORDER BY position`,
  ],
  [
    'The races two drivers both won',
    `SELECT r.year, r.name_used, group_concat(d.full_name, ' and ') AS winners
   FROM race_entries e
   JOIN races r   ON r.id = e.race_id
   JOIN drivers d ON d.id = e.driver_id
  WHERE e.finish_position = 1
  GROUP BY r.id
 HAVING COUNT(*) > 1
  ORDER BY r.year`,
  ],
  [
    'What actually stops a Formula One car',
    `SELECT status, COUNT(*) AS entries
   FROM race_entries
  WHERE status IS NOT NULL
  GROUP BY status
  ORDER BY entries DESC
  LIMIT 25`,
  ],
  [
    'Constructors who entered a race and never scored',
    `SELECT k.name, COUNT(*) AS entries, MIN(r.year) AS first_year, MAX(r.year) AS last_year
   FROM race_entries e
   JOIN races r        ON r.id = e.race_id
   JOIN constructors k ON k.id = e.constructor_id
  GROUP BY k.id
 HAVING SUM(COALESCE(e.points, 0)) = 0
  ORDER BY entries DESC`,
  ],
  [
    'How grid position turns into a result, in 2025',
    `SELECT e.grid, COUNT(*) AS starts,
         ROUND(AVG(e.finish_position), 2) AS mean_finish,
         SUM(e.finish_position = 1) AS wins
   FROM race_entries e
   JOIN races r ON r.id = e.race_id
  WHERE r.year = 2025 AND e.grid IS NOT NULL
  GROUP BY e.grid
  ORDER BY e.grid`,
  ],
  [
    'Everything the database is unsure about',
    `SELECT tbl, label, confidence
   FROM v_unverified
  ORDER BY tbl, label`,
  ],
]

const START = EXAMPLES[0][1]

/**
 * A courtesy, not the guarantee.
 *
 * The guarantee is that every statement runs inside a transaction that is
 * rolled back — see the worker. This only catches the obvious case early so
 * that a reader who types DELETE gets an explanation rather than an empty
 * result and a false sense of what happened.
 */
// Read-only, row-returning pragmas: they report on the schema and change no
// setting, so nothing survives the statement to affect the next one.
const INTROSPECTION =
  /^pragma\s+(table_info|table_xinfo|table_list|index_list|index_info|index_xinfo|foreign_key_list|database_list|collation_list|compile_options|function_list|pragma_list|module_list)\b/i

function complain(sql) {
  const stripped = bare(sql).trim()
  if (!stripped) return 'Nothing to run.'
  if (!/^(select|with|explain|pragma|values)\b/i.test(stripped)) {
    return 'Reads only: start with SELECT, WITH, VALUES, EXPLAIN or PRAGMA. A write would be rolled back anyway, so nothing has changed.'
  }
  // The rollback does not cover pragmas. A PRAGMA is not transactional, so
  // `PRAGMA case_sensitive_like = ON` survives the ROLLBACK and silently
  // changes every later query in the tab — which is exactly the guarantee this
  // page makes. The introspection pragmas below only read, so they keep
  // working; anything else is refused rather than quietly breaking the promise.
  if (/^pragma\b/i.test(stripped) && !INTROSPECTION.test(stripped)) {
    return 'That pragma can change how later queries behave, and a pragma is not undone by the rollback. Introspection pragmas (table_info, index_list, foreign_key_list and the like) are fine.'
  }
  return null
}

/**
 * One table or view in the schema panel: its columns, then the DDL the
 * database itself holds.
 *
 * The DDL is scrolled sideways rather than wrapped. These comments are written
 * against the column they annotate — `after_round`'s is the one that explains
 * why the obvious standings query answers with the season several times over —
 * and wrapping a CREATE TABLE (65 lines, for `drivers`) into a 220-pixel column
 * folds every trailing comment back to the left margin, where it reads as if it
 * belonged to the next column instead.
 *
 * A scrolling region has to be reachable without a pointer, and only while
 * there is something to scroll to: a tab stop on a block that fits is noise.
 * That is DataTable's rule for `.table-scroll`, and the same measurement, with
 * the tab stop on the scrolling div rather than on the <pre>. A closed
 * <details> lays nothing out, so the width is not knowable until it opens —
 * which is a resize, and what the observer is watching for.
 */
function SchemaEntry({ entry }) {
  const box = useRef(null)
  const [clipped, setClipped] = useState(false)
  const empty = TIMING_EMPTY_TABLES.includes(entry.name)

  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const check = () => setClipped(el.scrollWidth > el.clientWidth)
    check()
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check)
    watch?.observe(el)
    return () => watch?.disconnect()
  }, [])

  return (
    <details>
      <summary>
        <code>{entry.name}</code>
        {empty && <span className="pill">empty by design</span>}
        <span className="rows">{entry.type}</span>
      </summary>
      <p className="cols">{entry.columns}</p>
      {entry.sql && (
        <div className="ddl" ref={box} tabIndex={clipped ? 0 : undefined}>
          <pre>{entry.sql}</pre>
        </div>
      )}
      {empty && (
        <p className="small faint" style={{ margin: '0 0 8px', paddingLeft: 14 }}>
          {timingEmpty(entry.name)} <Link to="/data">Why this is so</Link>.
        </p>
      )}
    </details>
  )
}

export default function Sql() {
  // The query lives in the URL as well as in state: `?q=` is the permalink,
  // written on every run, read on arrival. A site that asks to be cited
  // had no way to cite a query.
  const [params, setParams] = useSearchParams()
  const arrived = params.get('q')
  const [text, setText] = useState(arrived || START)
  const [state, setState] = useState({ status: 'idle' })
  // One step back. An example replaced whatever the reader had typed, with
  // no undo; the last thing replaced is kept and offered back.
  const [replaced, setReplaced] = useState(null)
  // The statement last run, so that the address changing to what was just
  // run does not run it again, and a new address does.
  const ran = useRef(null)
  const [schema, setSchema] = useState([])
  const running = useRef(null)

  useEffect(() => {
    query(SCHEMA).then(({ rows }) => setSchema(rows), () => setSchema([]))
  }, [])

  const run = async (statement = text) => {
    // One statement at a time. The Run button is disabled while one runs, but
    // Ctrl+Enter and the example buttons were not, and a second statement
    // behind a stuck one left Cancel aborting the wrong request.
    if (running.current) return
    const complaint = complain(statement)
    if (complaint) {
      setState({ status: 'error', error: new Error(complaint) })
      return
    }
    setState({ status: 'running' })
    ran.current = statement
    setParams(statement === START ? {} : { q: statement }, { replace: true })
    const started = performance.now()
    const controller = new AbortController()
    running.current = controller
    try {
      const data = await queryReadOnly(statement, [], { signal: controller.signal })
      // The statement travels with its result: an empty result is read
      // differently depending on what was asked for, and the ref holding the
      // last statement is not what re-renders the table.
      setState({ status: 'done', data, statement, elapsed: performance.now() - started })
    } catch (error) {
      if (error?.name === 'AbortError') {
        setState({ status: 'cancelled', elapsed: performance.now() - started })
      } else {
        setState({ status: 'error', error })
      }
    } finally {
      if (running.current === controller) running.current = null
    }
  }

  // The one way out of a statement that will not finish. Before this, a
  // three-way self-join held the single worker every page shares for the
  // rest of the session; navigating away showed skeletons that never filled.
  const cancel = () => running.current?.abort()

  // Leaving the page stops the statement. Before this, a runaway typed here
  // and abandoned held the worker every register shares, and the next page
  // showed skeletons that never filled.
  useEffect(() => () => running.current?.abort(), [])

  // On arrival, and again whenever the address brings a different query
  // while the page stays mounted (a link to a query from within the site).
  useEffect(() => {
    const statement = arrived || START
    if (statement === ran.current) return
    if (arrived) setText(arrived)
    run(statement)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrived])

  const useExample = (statement) => {
    if (text.trim() && text !== statement && text !== START) setReplaced(text)
    setText(statement)
    run(statement)
  }

  // Which of the four tables that are empty by licence this result came from
  // asking for, if any: what the empty result says depends on it.
  const emptied = state.status === 'done' ? emptyTimingTableRead(state.statement) : null

  const onKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      run()
    }
  }

  return (
    <Page
      title={NAMES.sql().headline}
      documentName={NAMES.sql().title}
      trail={TRAIL.sql()}
      lede="Every page on this site is a query against one SQLite file. Here you write your own. Start from an example on the right, or open a table below for its columns and its commented schema — then run it with ⌘/Ctrl + Enter."
    >
      <SubNav />

      <Note>
        <strong>Nothing you type can break anything.</strong> The database is a copy in your own
        browser, every statement runs inside a transaction that is rolled back, and a reload
        restores it either way. Reads only. Nothing you type is sent as you write it either —
        though running a statement keeps it in the address, so a link you share or reload carries
        it.
      </Note>

      <p className="measure">
        The database is a plain SQLite file. If you would rather query it with your own tools,
        download <a href={`${import.meta.env.BASE_URL}f1.db`}><code>f1.db</code></a> and open it
        with any SQLite client. The circuit centrelines are not in it — <code>circuit_geometry</code>{' '}
        there is deliberately empty — and ship beside it as{' '}
        <a href={`${import.meta.env.BASE_URL}f1-geometry.db`}><code>f1-geometry.db</code></a>.{' '}
        {TWO_FILES} {SELF_DESCRIBING}
      </p>

      <div className="split uneven">
        <div>
          <textarea
            className="sql"
            value={text}
            rows={Math.max(6, text.split('\n').length + 1)}
            spellCheck="false"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="SQL to run"
          />
          <div className="filters" style={{ marginTop: 10 }}>
            <button type="button" className="button" onClick={() => run()} disabled={state.status === 'running'}>
              Run
            </button>
            {state.status === 'running' ? (
              <button type="button" className="button cancel" onClick={cancel}>
                Cancel
              </button>
            ) : (
              <span className="faint small">or ⌘/Ctrl + Enter</span>
            )}
            <span className="spacer" />
            {state.status === 'done' && (
              <span className="result-count" role="status">
                {number(state.data.rows.length)} rows in {state.elapsed.toFixed(0)} ms
              </span>
            )}
          </div>
          {(replaced || arrived) && (
            <p className="small faint" style={{ margin: '8px 0 0', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {arrived && (
                <span className="permalink">
                  {text === arrived
                    ? 'The address of this page is a link to this query.'
                    : 'The address links to the query last run, not to what you have typed; run it to update.'}
                </span>
              )}
              {replaced && (
                <button
                  type="button"
                  className="linklike"
                  onClick={() => {
                    setText(replaced)
                    setReplaced(null)
                  }}
                >
                  Restore what you had typed
                </button>
              )}
            </p>
          )}

          <Section>
            {state.status === 'running' && <Loading label="Running" />}
            {state.status === 'error' && <ErrorBox error={state.error} context="SQLite refused that" />}
            {state.status === 'cancelled' && (
              <p className="note" role="status">
                Cancelled after {(state.elapsed / 1000).toFixed(1)} s. The statement was stopped and
                the connection reopened; the rest of the site was not affected.
              </p>
            )}
            {state.status === 'done' && (
              <DataTable
                data={state.data}
                page={200}
                raw
                // The one table on the site the page's own heading would name
                // wrongly: "SQL console" is where the reader is, not what they
                // are looking at.
                caption="The result of your query"
                empty={
                  emptied ? (
                    <p className="state is-empty">
                      {timingEmpty(emptied)} <Link to="/data">Why this is so</Link>.
                    </p>
                  ) : (
                    'The statement ran and matched nothing.'
                  )
                }
                footer={
                  state.data.rows.length > 200
                    ? 'Showing the first two hundred rows.'
                    : undefined
                }
              />
            )}
          </Section>
        </div>

        <div>
          <Section title="Try one of these">
            {EXAMPLES.map(([label, statement]) => (
              <button
                key={label}
                type="button"
                className="example"
                onClick={() => useExample(statement)}
              >
                <b>{label}</b>
                <span className="faint">{statement.split('\n')[0].slice(0, 46)}…</span>
              </button>
            ))}
          </Section>

          <Section title="Schema" count={`${schema.length}`}>
            <div className="panel schema-list">
              {schema.map((entry) => (
                <SchemaEntry key={entry.name} entry={entry} />
              ))}
            </div>
          </Section>
        </div>
      </div>

      <Onward {...ONWARD.sql()} />
    </Page>
  )
}
