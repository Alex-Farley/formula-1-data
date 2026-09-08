import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { useQuery } from '../data/useQuery.js'
import { points } from '../lib/format.js'

const SQL = `
  SELECT s.year, s.rounds,
         s.drivers_champion       AS champion_id,
         d.full_name              AS champion,
         d.nationality            AS nationality,
         s.champion_team          AS champion_team_id,
         t.name                   AS champion_team,
         s.champion_points        AS champion_points,
         s.champion_wins          AS champion_wins,
         s.runner_up              AS runner_up_id,
         ru.full_name             AS runner_up,
         s.margin                 AS margin,
         s.constructors_champion  AS constructors_champion_id,
         cc.name                  AS constructors_champion,
         s.engine_formula
    FROM seasons s
    LEFT JOIN drivers d       ON d.id  = s.drivers_champion
    LEFT JOIN drivers ru      ON ru.id = s.runner_up
    LEFT JOIN constructors t  ON t.id  = s.champion_team
    LEFT JOIN constructors cc ON cc.id = s.constructors_champion
   ORDER BY s.year DESC
`

export default function Seasons() {
  const state = useQuery(SQL)

  return (
    <Page
      title="Seasons"
      lede="Seventy-seven championships, newest first. Pick a year for its calendar, the title race round by round, and the final tables — or sort this list by any column to find the closest finishes and the biggest walkovers."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => (
            <DataTable
              data={data}
              rowKey={(row) => row.year}
              sort="year"
              direction="desc"
              columns={[
                {
                  key: 'year',
                  label: 'Season',
                  align: 'num',
                  render: (year) => <Link to={`/seasons/${year}`}>{year}</Link>,
                },
                { key: 'rounds', label: 'Rounds', align: 'num' },
                {
                  key: 'champion',
                  label: "Drivers' champion",
                  render: (name, row) =>
                    row.champion_id ? <Link to={`/drivers/${row.champion_id}`}>{name}</Link> : cell(name),
                },
                {
                  key: 'champion_team',
                  label: 'Driving for',
                  render: (name, row) =>
                    row.champion_team_id ? (
                      <Link to={`/constructors/${row.champion_team_id}`}>{name}</Link>
                    ) : (
                      cell(name)
                    ),
                },
                { key: 'champion_points', label: 'Points', align: 'num', render: (v) => (v === null ? cell(v) : points(v)) },
                { key: 'champion_wins', label: 'Wins', align: 'num' },
                {
                  key: 'runner_up',
                  label: 'Runner-up',
                  render: (name, row) =>
                    row.runner_up_id ? <Link to={`/drivers/${row.runner_up_id}`}>{name}</Link> : cell(name),
                },
                { key: 'margin', label: 'Margin', align: 'num', render: (v) => (v === null ? cell(v) : points(v)) },
                {
                  key: 'constructors_champion',
                  label: "Constructors' champion",
                  render: (name, row) =>
                    row.constructors_champion_id ? (
                      <Link to={`/constructors/${row.constructors_champion_id}`}>{name}</Link>
                    ) : (
                      cell(name)
                    ),
                },
              ]}
              footer="Margin is the points gap between champion and runner-up at the end of the season; before 1991 that is net of dropped scores, so it can look small beside the wins. A blank constructors' champion before 1958 is not a gap — the championship did not exist yet."
            />
          )}
        </Result>
      </Section>

      <Onward
        items={[
          { to: '/races', label: 'Every race', hint: 'All 1,000-plus rounds in one filterable list.' },
          { to: '/records', label: 'Records', hint: 'Champions, most wins, most poles, grand slams.' },
          { to: '/reference/eras', label: 'Eras and rules', hint: 'Why a 1955 points total cannot be compared with a 2025 one.' },
        ]}
      />
    </Page>
  )
}
