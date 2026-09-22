import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, NoMatch, SearchField, Select } from '../components/Filters.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import { useQuery } from '../data/useQuery.js'
import { colourForEntry } from '../lib/liveries.js'
import { NOT_YET_RUN, SHARED, SPRINT } from '../lib/site.js'
import { oneOf, useUrlState } from '../lib/urlstate.js'
import { RACES, RACE_COLUMNS, RACES_FOOTER } from '../queries/races.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
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
  // The winning car's colour mark (AF-47), as the race page draws it beside
  // the same constructor: one per row, the year the row's own.
  constructor: {
    render: (name, row) => (
      <>
        <LiveryMark
          colour={colourForEntry({
            constructorId: row.constructor_id,
            country: row.constructor_country,
            year: row.year,
            team: name,
          })}
          year={row.year}
        />
        {row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name)}
      </>
    ),
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

  return (
    <Page
      title="Races"
      trail={TRAIL.races()}
      lede="Every round of every championship, back to Silverstone in May 1950. Search for a Grand Prix, a circuit or a winner, or pick a decade — then open a race for its full classification, qualifying sheet and, from 1994, its pit stops."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => <RaceList rows={data.rows} />}
        </Result>
      </Section>

      <Onward {...ONWARD.races()} />
    </Page>
  )
}

/**
 * The filters used to be held above `Result`, so that a query settling did
 * not throw away what the reader had typed. They are in the address now
 * (IA-08), which is a better place for the same reason and two others: the
 * register can be sent to somebody, and it comes back from a race page as
 * they left it.
 */
function RaceList({ rows }) {
  const decades = useMemo(
    () => [...new Set(rows.map((r) => Math.floor(r.year / 10) * 10))].sort((a, b) => b - a),
    [rows],
  )
  const decadeOptions = decades.map((d) => [String(d), `${d}s`])
  const statuses = [
    ['', 'All'],
    ['run', 'Run'],
    ['scheduled', 'Scheduled'],
  ]

  const [params, set, clear] = useUrlState({ q: '', decade: '', status: '' })
  const term = params.q
  const decade = oneOf(params.decade, decadeOptions)
  const status = oneOf(params.status, statuses)

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

  // The filters as a plural noun phrase, for the empty state (IX-28).
  const among =
    decade || status
      ? [
          status === 'run' ? 'races already run' : status === 'scheduled' ? 'races still to come' : 'races',
          decade ? `in the ${decade}s` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : ''

  return (
    <>
      <Filters showing={filtered.length} of={rows.length} noun="races">
        <SearchField
          value={term}
          onChange={(value) => set({ q: value })}
          label="Filter races"
          placeholder="A Grand Prix, a circuit, a winner…"
        />
        <Select
          value={decade}
          onChange={(value) => set({ decade: value })}
          label="Decade"
          all="Every decade"
          options={decadeOptions}
        />
        <Chips
          label="Filter races by status"
          value={status}
          onChange={(value) => set({ status: value })}
          options={statuses}
        />
      </Filters>

      {/* The rows come in the query's order — run first, newest first, then
          the rounds still to come — and the table keeps it. */}
      <DataTable
        addressed
        rows={filtered}
        rowKey={(row) => `${row.year}-${row.round}`}
        sortable={false}
        page={120}
        columns={RACE_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
        empty={<NoMatch noun="race" term={term} among={among} onClear={clear} />}
        footer={RACES_FOOTER}
      />
    </>
  )
}
