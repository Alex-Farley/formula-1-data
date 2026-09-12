import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { DRIVERS, DRIVER_COLUMNS } from '../queries/drivers.js'

/**
 * What only the app adds to the shared column list: the link on a name, the
 * sort key behind the Seasons span, the title years behind a titles count.
 * The query and the columns themselves are in queries/drivers.js, read by
 * scripts/prerender.js too, so the static register is this one.
 */
const APP = {
  full_name: { render: (name, row) => <Link to={`/drivers/${row.id}`}>{name}</Link> },
  first_season: { sort: (row) => row.first_season },
  titles: {
    render: (value, row) =>
      value ? <span title={row.title_years ?? undefined}>{value}</span> : cell(value),
  },
}

export default function Drivers() {
  const state = useQuery(DRIVERS)
  return (
    <Page
      title="Drivers"
      lede="Every driver the championship has recorded an entry for, from 1950 to now. Filter by nationality, narrow to champions or race winners, then open anyone for their full career, season by season."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => <Register rows={data.rows} />}
        </Result>
      </Section>

      <Onward
        items={[
          { to: '/records', label: 'Records', hint: 'Most wins, most poles, every champion.' },
          { to: '/constructors', label: 'Constructors', hint: 'The teams these drivers drove for.' },
          { to: '/seasons', label: 'Seasons', hint: 'Championship tables year by year.' },
        ]}
      />
    </Page>
  )
}

function Register({ rows }) {
  const [term, setTerm] = useState('')
  const [nationality, setNationality] = useState('')
  const [kind, setKind] = useState('')

  const nationalities = useMemo(
    () => [...new Set(rows.map((r) => r.nationality).filter(Boolean))].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (nationality && row.nationality !== nationality) return false
      if (kind === 'champions' && !row.titles) return false
      if (kind === 'winners' && !row.wins) return false
      // The grid is an entry in the latest completed season, derived in the
      // shared query; the register's open span is a NULL last_season, so the
      // year was never the test (IX-17).
      if (kind === 'active' && !row.on_grid) return false
      if (!needle) return true
      return row.full_name.toLowerCase().includes(needle)
    })
  }, [rows, term, nationality, kind])

  return (
    <>
      <Filters showing={filtered.length} of={rows.length} noun="drivers">
        <SearchField value={term} onChange={setTerm} label="Filter drivers" placeholder="A name…" />
        <Select
          value={nationality}
          onChange={setNationality}
          label="Nationality"
          all="Every nationality"
          options={nationalities}
        />
        <Chips
          label="Filter drivers by kind"
          value={kind}
          onChange={setKind}
          options={[
            ['', 'All'],
            ['winners', 'Race winners'],
            ['champions', 'Champions'],
            ['active', `On the ${rows[0]?.latest_season ?? ''} grid`.replace('  ', ' ')],
          ]}
        />
      </Filters>

      <DataTable
        rows={filtered}
        rowKey={(row) => row.id}
        sort="wins"
        direction="desc"
        page={150}
        columns={DRIVER_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
        footer="Most wins first; sort by any column. Entries is every race a driver was entered for, counted from the race records — an entry is not a start. A blank is a figure nobody has established, not a zero, and those rows sink to the bottom whichever way you sort."
      />
    </>
  )
}
