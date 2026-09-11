import { useEffect, useState } from 'react'
import { Note, Onward, Page, Section } from '../components/Page.jsx'
import { ErrorBox, Loading } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import SubNav from '../components/SubNav.jsx'
import { query, queryReadOnly } from '../data/client.js'
import { number } from '../lib/format.js'

const SCHEMA = `
  SELECT m.type, m.name,
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
  const stripped = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
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

export default function Sql() {
  const [text, setText] = useState(START)
  const [state, setState] = useState({ status: 'idle' })
  const [schema, setSchema] = useState([])

  useEffect(() => {
    query(SCHEMA).then(({ rows }) => setSchema(rows), () => setSchema([]))
  }, [])

  const run = async (statement = text) => {
    const complaint = complain(statement)
    if (complaint) {
      setState({ status: 'error', error: new Error(complaint) })
      return
    }
    setState({ status: 'running' })
    const started = performance.now()
    try {
      const data = await queryReadOnly(statement)
      setState({ status: 'done', data, elapsed: performance.now() - started })
    } catch (error) {
      setState({ status: 'error', error })
    }
  }

  useEffect(() => {
    run(START)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      run()
    }
  }

  return (
    <Page
      title="SQL console"
      lede="Every page on this site is a query against one SQLite file. Here you write your own. Start from an example on the right, or open a table below to see its columns — then run it with ⌘/Ctrl + Enter."
    >
      <SubNav />

      <Note>
        <strong>Nothing you type can break anything.</strong> The database is a copy in your own
        browser, every statement runs inside a transaction that is rolled back, and a reload
        restores it either way. Reads only.
      </Note>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <div>
          <textarea
            className="sql"
            value={text}
            spellCheck="false"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="SQL to run"
          />
          <div className="filters" style={{ marginTop: 10 }}>
            <button type="button" className="button" onClick={() => run()} disabled={state.status === 'running'}>
              Run
            </button>
            <span className="faint small">or ⌘/Ctrl + Enter</span>
            <span className="spacer" />
            {state.status === 'done' && (
              <span className="result-count" role="status">
                {number(state.data.rows.length)} rows in {state.elapsed.toFixed(0)} ms
              </span>
            )}
          </div>

          <Section>
            {state.status === 'running' && <Loading label="Running" />}
            {state.status === 'error' && <ErrorBox error={state.error} context="SQLite refused that" />}
            {state.status === 'done' && (
              <DataTable
                data={state.data}
                page={200}
                raw
                empty="The statement ran and matched nothing."
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
                onClick={() => {
                  setText(statement)
                  run(statement)
                }}
              >
                <b>{label}</b>
                <span className="faint">{statement.split('\n')[0].slice(0, 46)}…</span>
              </button>
            ))}
          </Section>

          <Section title="Schema" count={`${schema.length}`}>
            <div className="panel schema-list">
              {schema.map((entry) => (
                <details key={entry.name}>
                  <summary>
                    <code>{entry.name}</code>
                    <span className="rows">{entry.type}</span>
                  </summary>
                  <p className="cols">{entry.columns}</p>
                </details>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <Onward
        items={[
          { to: '/reference/quality', label: 'Data quality', hint: 'What the confidence column means before you quote a row.' },
          { to: '/reference/sources', label: 'Sources and licences', hint: 'What you may do with what you pull out.' },
          { to: '/records', label: 'Records', hint: 'The leaderboards already written for you.' },
        ]}
      />
    </Page>
  )
}
