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
 * Wins, poles, podiums and fastest laps here are the stored columns, which the
 * build derives from the race records — the same 27,460 entries a driver's own
 * page counts. Entries and starts are not yet derived, and the register says
 * so rather than implying they are the same kind of number.
 */
const SQL = `
  SELECT id, full_name, nationality, first_season, last_season,
         entries, starts, wins, podiums, poles, fastest_laps, career_points,
         titles, title_years, status, confidence
    FROM drivers
   ORDER BY full_name
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
        sort="full_name"
        direction="asc"
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
          { key: 'starts', label: 'Starts', align: 'num' },
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
        footer="Sort by any column. A blank is a figure nobody has established, not a zero, and those rows sink to the bottom whichever way you sort."
      />
    </>
  )
}
