import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Page } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import Filter, { matches } from '../components/Filter.jsx'
import { span } from '../format.js'

// wins, poles and fastest_laps on `drivers` are derived at build time from the
// race records, so this leaderboard cannot disagree with the races behind it.
const SQL = `
SELECT id, full_name, nationality, titles, wins, poles, fastest_laps,
       first_season, last_season
FROM drivers
ORDER BY wins DESC, poles DESC, fastest_laps DESC, full_name`

export default function Drivers() {
  const state = useQuery(SQL)
  const [term, setTerm] = useState('')

  return (
    <Page
      title="Drivers"
      lede="Every driver who has won a championship race, taken a pole, set a fastest lap or stood on a podium, plus every World Champion and the current grid — 244 in all. Wins, poles and fastest laps are derived from the race records rather than stored."
    >
      <Result state={state} what="Loading the database">
        {(data) => {
          const rows = data.rows.filter((r) => matches(r, ['full_name', 'nationality'], term))
          return (
            <>
              <Filter
                value={term}
                onChange={setTerm}
                placeholder="Filter by name or nationality"
                count={rows.length}
                noun={rows.length === 1 ? 'driver' : 'drivers'}
              />
              <DataTable
                data={{ ...data, rows }}
                columns={[
                  'full_name',
                  'nationality',
                  'titles',
                  'wins',
                  'poles',
                  'fastest_laps',
                  'seasons',
                ]}
                labels={{ full_name: 'Driver', fastest_laps: 'Fastest laps' }}
                render={{
                  full_name: (v, row) => <Link to={`/drivers/${row.id}`}>{v}</Link>,
                  seasons: (_, row) => span(row.first_season, row.last_season),
                }}
                empty="No driver matches that."
              />
            </>
          )
        }}
      </Result>
    </Page>
  )
}
