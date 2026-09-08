import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'

const SQL = `
  SELECT rr.year, rr.round, rr.gp_name, rr.gp_id, rr.circuit_id, c.name AS circuit, c.country,
         rr.winner, rr.winner_id, rr.co_winner_id, rr.constructor, rr.constructor_id,
         rr.pole, rr.pole_id, rr.fastest_lap, rr.fastest_lap_id, r.status, r.sprint
    FROM race_results rr
    JOIN races r ON r.id = rr.id
    LEFT JOIN circuits c ON c.id = rr.circuit_id
   ORDER BY rr.year DESC, rr.round DESC
`

export default function Races() {
  const state = useQuery(SQL)
  const [term, setTerm] = useState('')
  const [decade, setDecade] = useState('')
  const [status, setStatus] = useState('')

  return (
    <Page
      title="Races"
      lede="Every round of every championship, back to Silverstone in May 1950. Search for a Grand Prix, a circuit or a winner, or pick a decade — then open a race for its full classification, qualifying sheet and, from 1994, its pit stops."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => <RaceList rows={data.rows} {...{ term, setTerm, decade, setDecade, status, setStatus }} />}
        </Result>
      </Section>

      <Onward
        items={[
          { to: '/seasons', label: 'Seasons', hint: 'The same races, grouped into championships.' },
          { to: '/circuits', label: 'Circuits', hint: 'The venues these races were held at.' },
          { to: '/records', label: 'Records', hint: 'Who won the most of them.' },
        ]}
      />
    </Page>
  )
}

function RaceList({ rows, term, setTerm, decade, setDecade, status, setStatus }) {
  const decades = useMemo(
    () => [...new Set(rows.map((r) => Math.floor(r.year / 10) * 10))].sort((a, b) => b - a),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (decade && Math.floor(row.year / 10) * 10 !== Number(decade)) return false
      if (status === 'run' && row.status !== 'completed') return false
      if (status === 'scheduled' && row.status !== 'scheduled') return false
      if (!needle) return true
      return [row.gp_name, row.circuit, row.country, row.winner, row.constructor, String(row.year)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    })
  }, [rows, term, decade, status])

  return (
    <>
      <Filters showing={filtered.length} of={rows.length} noun="races">
        <SearchField
          value={term}
          onChange={setTerm}
          label="Filter races"
          placeholder="A Grand Prix, a circuit, a winner…"
        />
        <Select
          value={decade}
          onChange={setDecade}
          label="Decade"
          all="Every decade"
          options={decades.map((d) => [String(d), `${d}s`])}
        />
        <Chips
          value={status}
          onChange={setStatus}
          options={[
            ['', 'All'],
            ['run', 'Run'],
            ['scheduled', 'Scheduled'],
          ]}
        />
      </Filters>

      <DataTable
        rows={filtered}
        rowKey={(row) => `${row.year}-${row.round}`}
        sortable={false}
        page={120}
        columns={[
          {
            key: 'year',
            label: 'Season',
            align: 'num',
            render: (year) => <Link to={`/seasons/${year}`}>{year}</Link>,
          },
          { key: 'round', label: 'R', align: 'num' },
          {
            key: 'gp_name',
            label: 'Grand Prix',
            render: (name, row) => (
              <>
                <Link to={`/races/${row.year}/${row.round}`}>{name}</Link>
                {row.sprint ? <span className="tag" style={{ marginLeft: 6 }}>sprint</span> : null}
              </>
            ),
          },
          {
            key: 'circuit',
            label: 'Circuit',
            render: (name, row) =>
              row.circuit_id ? <Link to={`/circuits/${row.circuit_id}`}>{name}</Link> : cell(name),
          },
          {
            key: 'winner',
            label: 'Winner',
            render: (name, row) =>
              row.status !== 'completed' ? (
                <span className="tag">not yet run</span>
              ) : row.winner_id ? (
                <>
                  <Link to={`/drivers/${row.winner_id}`}>{name}</Link>
                  {row.co_winner_id ? <span className="tag" style={{ marginLeft: 6 }}>shared</span> : null}
                </>
              ) : (
                cell(name)
              ),
          },
          {
            key: 'constructor',
            label: 'Car',
            render: (name, row) =>
              row.constructor_id ? (
                <Link to={`/constructors/${row.constructor_id}`}>{name}</Link>
              ) : (
                cell(name)
              ),
          },
          {
            key: 'pole',
            label: 'Pole',
            render: (name, row) =>
              row.pole_id ? <Link to={`/drivers/${row.pole_id}`}>{name}</Link> : cell(name),
          },
          {
            key: 'fastest_lap',
            label: 'Fastest lap',
            render: (name, row) =>
              row.fastest_lap_id ? <Link to={`/drivers/${row.fastest_lap_id}`}>{name}</Link> : cell(name),
          },
        ]}
        footer="“Shared” marks a race two drivers are both classified as winning, which was normal before 1958. A row tagged “not yet run” is a calendar entry with no result."
      />
    </>
  )
}
