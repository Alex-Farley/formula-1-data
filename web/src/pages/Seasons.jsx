import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Page } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import Filter, { matches } from '../components/Filter.jsx'

const SQL = `
SELECT year, champion, nationality, team, points, wins, runner_up, margin,
       constructors_champion, rounds
FROM v_champions
ORDER BY year DESC`

export default function Seasons() {
  const state = useQuery(SQL)
  const [term, setTerm] = useState('')

  return (
    <Page
      title="Seasons"
      lede="Every championship season from 1950 to 2026 — champion, margin, and the constructors' title alongside it. Constructors' championships begin in 1958."
    >
      <Result state={state} what="Loading the database">
        {(data) => {
          const rows = data.rows.filter((r) =>
            matches(r, ['year', 'champion', 'team', 'constructors_champion', 'runner_up'], term),
          )
          return (
            <>
              <Filter
                value={term}
                onChange={setTerm}
                placeholder="Filter by champion, team or year"
                count={rows.length}
                noun={rows.length === 1 ? 'season' : 'seasons'}
              />
              <DataTable
                data={{ ...data, rows }}
                labels={{
                  runner_up: 'Runner-up',
                  constructors_champion: "Constructors'",
                  rounds: 'Races',
                }}
                render={{
                  year: (v) => <Link to={`/seasons/${v}`}>{v}</Link>,
                }}
                empty="No season matches that."
              />
            </>
          )
        }}
      </Result>
    </Page>
  )
}
