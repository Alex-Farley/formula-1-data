import { useEffect, useRef, useState } from 'react'
import { Page } from '../components/Page.jsx'
import { ErrorBox } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import { readOnlyComplaint, run } from '../db.js'

const STORED = 'f1db.console.sql'

const DEFAULT = `-- Champions who did not win the most races that season
SELECT s.year, d.full_name AS champion, s.champion_wins,
       (SELECT COUNT(*) FROM race_results r
        WHERE r.year = s.year
        GROUP BY r.winner_id
        ORDER BY COUNT(*) DESC LIMIT 1) AS most_wins
FROM seasons s
JOIN drivers d ON d.id = s.drivers_champion
WHERE s.champion_wins < most_wins
ORDER BY s.year`

// The queries the README opens with. They are the fastest way to see what
// shape the database is in.
const EXAMPLES = [
  {
    label: 'Pole-to-win by decade',
    sql: `SELECT (year/10)*10 AS decade,
       SUM(pole_converted) * 100 / SUM(races) AS pct
FROM v_pole_to_win
GROUP BY decade
ORDER BY decade`,
  },
  {
    label: 'Poles but never a win',
    sql: `SELECT full_name, poles, nationality
FROM drivers
WHERE poles > 0 AND wins = 0
ORDER BY poles DESC`,
  },
  {
    label: 'Closest title margins',
    sql: `SELECT year, champion, runner_up, margin
FROM v_champions
WHERE margin IS NOT NULL
ORDER BY margin, year
LIMIT 15`,
  },
  {
    label: 'Grand slams',
    sql: `SELECT year, round, gp_name, driver, constructor
FROM v_grand_slams
ORDER BY year DESC, round DESC`,
  },
  {
    label: 'Countries by races held',
    sql: `SELECT country, circuits, races, first_gp, last_gp
FROM v_circuits_by_country
ORDER BY races DESC`,
  },
  {
    label: 'Stored vs derived career figures',
    sql: `SELECT full_name, derived_wins, wins_external,
       derived_poles, poles_external,
       derived_fl, fastest_laps_external
FROM v_stat_reconciliation
WHERE derived_wins != wins_external
   OR derived_poles != poles_external
   OR derived_fl != fastest_laps_external`,
  },
  {
    label: 'Every table and its size',
    sql: `SELECT name, type FROM sqlite_master
WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'
ORDER BY type, name`,
  },
]

export default function Console() {
  const [sql, setSql] = useState(() => localStorage.getItem(STORED) ?? DEFAULT)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(null)
  const box = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORED, sql)
  }, [sql])

  async function execute() {
    const complaint = readOnlyComplaint(sql)
    if (complaint) {
      setError(new Error(complaint))
      setResult(null)
      return
    }
    setBusy(true)
    setError(null)
    const started = performance.now()
    try {
      const data = await run(sql)
      setResult(data)
      setElapsed(performance.now() - started)
    } catch (e) {
      setError(e)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      execute()
    }
  }

  function useExample(example) {
    setSql(example.sql)
    box.current?.focus()
  }

  return (
    <Page
      title="SQL"
      lede="The same database ./f1 sql queries, in your browser. It is a copy in this tab — nothing you run here reaches a server, and a reload restores it."
    >
      <div className="examples">
        {EXAMPLES.map((e) => (
          <button key={e.label} type="button" className="chip" onClick={() => useExample(e)}>
            {e.label}
          </button>
        ))}
      </div>

      <textarea
        ref={box}
        className="sql"
        value={sql}
        spellCheck={false}
        rows={12}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label="SQL query"
      />

      <div className="run-row">
        <button type="button" className="primary" onClick={execute} disabled={busy}>
          {busy ? 'Running…' : 'Run'}
        </button>
        <span className="muted">
          ⌘/Ctrl + Enter
          {result && !error && (
            <>
              {' · '}
              {result.rows.length} {result.rows.length === 1 ? 'row' : 'rows'}
              {elapsed !== null && ` in ${elapsed < 1 ? '<1' : Math.round(elapsed)} ms`}
            </>
          )}
        </span>
      </div>

      {error && <ErrorBox error={error} context="SQLite says" />}
      {result && !error && <DataTable data={result} empty="The query returned no rows." />}
    </Page>
  )
}
