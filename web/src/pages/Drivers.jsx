import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, NoMatch, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { anyThisSeason, gridLabel, seasonOf } from '../lib/season.js'
import { DRIVERS, DRIVER_COLUMNS } from '../queries/drivers.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
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
      trail={TRAIL.drivers()}
      lede="Every driver the championship has recorded an entry for, from 1950 to now. Filter by nationality, narrow to champions or race winners, then open anyone for their full career, season by season."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => <Register rows={data.rows} />}
        </Result>
      </Section>

      <Onward {...ONWARD.drivers()} />
    </Page>
  )
}

function Register({ rows }) {
  const [term, setTerm] = useState('')
  const [nationality, setNationality] = useState('')
  const [kind, setKind] = useState('')
  // The season the grid filter names, from the shared query; every row
  // carries the same value.
  const gridSeason = seasonOf(rows)
  const hasGrid = anyThisSeason(rows, 'on_grid')

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
      // The grid is the declared season's entry list, derived in the shared
      // query; the register's open span is a NULL last_season, so the year
      // was never the test (IX-17).
      if (kind === 'grid' && !row.on_grid) return false
      if (!needle) return true
      return row.full_name.toLowerCase().includes(needle)
    })
  }, [rows, term, nationality, kind])

  // What the three filters are asking for, as a plural noun phrase, for the
  // state that says which of them emptied the register (IX-28). The chips'
  // own labels are headings rather than nouns, and `nationality` is a country
  // and not an adjective, so neither goes in raw.
  const among =
    nationality || kind
      ? [
          kind === 'winners'
            ? 'race winners'
            : kind === 'champions'
              ? 'champions'
              : kind === 'grid'
                ? `drivers on the ${gridSeason} grid`
                : 'drivers',
          nationality ? `from ${nationality}` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : ''

  const clear = () => {
    setTerm('')
    setNationality('')
    setKind('')
  }

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
            ...(hasGrid ? [['grid', gridLabel(gridSeason)]] : []),
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
        empty={<NoMatch noun="driver" term={term} among={among} onClear={clear} />}
        footer="Most wins first; sort by any column. Entries is every race a driver was entered for, counted from the race records — an entry is not a start. A blank is a figure nobody has established, not a zero, and those rows sink to the bottom whichever way you sort."
      />
    </>
  )
}
