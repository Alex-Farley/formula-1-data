import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { span } from '../lib/format.js'

/**
 * The whole register in one query.
 *
 * Wins, poles, podiums and fastest laps are the stored columns the build
 * derives from the race records; Entries is counted here from the same
 * records, one row per race a driver was entered for — an entry, not a
 * start, so it carries the word the driver's own page uses for the same
 * count. The stored `entries` and `starts` columns are published figures
 * held for 38 and 31 of 862 drivers, so two columns opened on 96% em dashes;
 * they are on the driver's own page, labelled as published, and not here.
 */
const SQL = `
  SELECT d.id, d.full_name, d.nationality, d.first_season, d.last_season,
         d.wins, d.podiums, d.poles, d.fastest_laps, d.career_points,
         d.titles, d.title_years, d.status, d.confidence,
         (SELECT COUNT(*) FROM race_entries e WHERE e.driver_id = d.id) AS entries
    FROM drivers d
   ORDER BY d.wins DESC, d.podiums DESC, d.full_name
`

export default function Drivers() {
  const state = useQuery(SQL)
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
      if (kind === 'active' && row.last_season !== 2026) return false
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
            ['active', 'On the 2026 grid'],
          ]}
        />
      </Filters>

      <DataTable
        rows={filtered}
        rowKey={(row) => row.id}
        sort="wins"
        direction="desc"
        page={150}
        columns={[
          {
            key: 'full_name',
            label: 'Driver',
            render: (name, row) => <Link to={`/drivers/${row.id}`}>{name}</Link>,
          },
          { key: 'nationality', label: 'Nationality' },
          {
            key: 'first_season',
            label: 'Seasons',
            align: 'num',
            render: (_, row) => span(row.first_season, row.last_season),
            sort: (row) => row.first_season,
          },
          { key: 'entries', label: 'Entries', align: 'num' },
          { key: 'wins', label: 'Wins', align: 'num' },
          { key: 'podiums', label: 'Podiums', align: 'num' },
          { key: 'poles', label: 'Poles', align: 'num' },
          { key: 'fastest_laps', label: 'Fastest laps', align: 'num' },
          {
            key: 'titles',
            label: 'Titles',
            align: 'num',
            render: (value, row) =>
              value ? <span title={row.title_years ?? undefined}>{value}</span> : cell(value),
          },
        ]}
        footer="Most wins first; sort by any column. Entries is every race a driver was entered for, counted from the race records — an entry is not a start. A blank is a figure nobody has established, not a zero, and those rows sink to the bottom whichever way you sort."
      />
    </>
  )
}
