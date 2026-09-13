import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { NOT_YET_RUN, SHARED, SPRINT } from '../lib/site.js'
import { RACES, RACE_COLUMNS, RACES_FOOTER } from '../queries/races.js'

/**
 * The React renders for the columns queries/races.js defines — the links
 * and the tags; the router is the reason they live here. The words each cell
 * carries are the column's own `text`, which scripts/prerender.js prints too,
 * so the static list is this one.
 */
const APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  gp_name: {
    render: (name, row) => (
      <>
        <Link to={`/races/${row.year}/${row.round}`}>{name}</Link>
        {row.sprint ? ' ' : ''}
        {row.sprint ? <span className="tag">{SPRINT}</span> : null}
      </>
    ),
  },
  circuit: {
    render: (name, row) => (row.circuit_id ? <Link to={`/circuits/${row.circuit_id}`}>{name}</Link> : cell(name)),
  },
  winner: {
    render: (name, row) =>
      row.status !== 'completed' ? (
        <span className="tag">{NOT_YET_RUN}</span>
      ) : row.winner_id ? (
        <>
          <Link to={`/drivers/${row.winner_id}`}>{name}</Link>
          {row.co_winner_id ? ' ' : ''}
          {row.co_winner_id ? <span className="tag">{SHARED}</span> : null}
        </>
      ) : (
        cell(name)
      ),
  },
  constructor: {
    render: (name, row) =>
      row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name),
  },
  pole: {
    render: (name, row) => (row.pole_id ? <Link to={`/drivers/${row.pole_id}`}>{name}</Link> : cell(name)),
  },
  fastest_lap: {
    render: (name, row) =>
      row.fastest_lap_id ? <Link to={`/drivers/${row.fastest_lap_id}`}>{name}</Link> : cell(name),
  },
}

export default function Races() {
  const state = useQuery(RACES)
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
          { to: '/reference/glossary', label: 'Glossary', hint: 'What the words on a classification mean.' },
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
          label="Filter races by status"
          value={status}
          onChange={setStatus}
          options={[
            ['', 'All'],
            ['run', 'Run'],
            ['scheduled', 'Scheduled'],
          ]}
        />
      </Filters>

      {/* The rows come in the query's order — run first, newest first, then
          the rounds still to come — and the table keeps it. */}
      <DataTable
        rows={filtered}
        rowKey={(row) => `${row.year}-${row.round}`}
        sortable={false}
        page={120}
        columns={RACE_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
        footer={RACES_FOOTER}
      />
    </>
  )
}
