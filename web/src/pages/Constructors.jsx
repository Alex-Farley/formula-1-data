import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { span } from '../lib/format.js'
import { colourFor } from '../lib/racingColours.js'

const SQL = `
  SELECT k.id, k.name, k.country, k.base, k.first_entry, k.last_entry,
         k.wins, k.poles, k.constructors_titles, k.drivers_titles, k.title_years,
         k.lineage_chain, k.active,
         (SELECT COUNT(*) FROM race_entries e WHERE e.constructor_id = k.id) AS entries,
         (SELECT COUNT(DISTINCT ch.id) FROM chassis ch WHERE ch.constructor_id = k.id) AS designs
    FROM constructors k
   ORDER BY k.name
`

export default function Constructors() {
  const state = useQuery(SQL)
  return (
    <Page
      title="Constructors"
      lede="A hundred and fifty constructors, from the ones that defined an era to the ones that entered a handful of races and disappeared. Filter by country, or narrow to race winners and champions; each page carries the team’s record, the cars it built, and the names it raced under before and after."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => <Register rows={data.rows} />}
        </Result>
      </Section>

      <Onward
        items={[
          { to: '/cars', label: 'Cars', hint: 'The chassis these teams built, with specifications.' },
          { to: '/records', label: 'Records', hint: 'Most wins by constructor, and every title.' },
          { to: '/drivers', label: 'Drivers', hint: 'Who drove for them.' },
        ]}
      />
    </Page>
  )
}

function Register({ rows }) {
  const [term, setTerm] = useState('')
  const [country, setCountry] = useState('')
  const [kind, setKind] = useState('')

  const countries = useMemo(
    () => [...new Set(rows.map((r) => r.country).filter(Boolean))].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (country && row.country !== country) return false
      if (kind === 'winners' && !row.wins) return false
      if (kind === 'champions' && !row.constructors_titles) return false
      if (kind === 'active' && !row.active) return false
      if (!needle) return true
      return row.name.toLowerCase().includes(needle)
    })
  }, [rows, term, country, kind])

  return (
    <>
      <Filters showing={filtered.length} of={rows.length} noun="constructors">
        <SearchField value={term} onChange={setTerm} label="Filter constructors" placeholder="A name…" />
        <Select value={country} onChange={setCountry} label="Country" all="Every country" options={countries} />
        <Chips
          value={kind}
          onChange={setKind}
          options={[
            ['', 'All'],
            ['winners', 'Race winners'],
            ['champions', 'Champions'],
            ['active', 'Active'],
          ]}
        />
      </Filters>

      <DataTable
        rows={filtered}
        rowKey={(row) => row.id}
        sort="name"
        direction="asc"
        page={150}
        columns={[
          {
            key: 'name',
            label: 'Constructor',
            render: (name, row) => {
              const colour = colourFor(row.country)
              return (
                <>
                  <i
                    className="livery"
                    style={colour ? { background: colour.hex } : undefined}
                    title={colour ? `${colour.name} — the racing colour of ${row.country}` : 'no racing colour recorded'}
                  />
                  <Link to={`/constructors/${row.id}`}>{name}</Link>
                </>
              )
            },
          },
          { key: 'country', label: 'Country' },
          {
            key: 'first_entry',
            label: 'Entered',
            align: 'num',
            render: (_, row) => span(row.first_entry, row.active ? null : row.last_entry),
            sort: (row) => row.first_entry,
          },
          { key: 'entries', label: 'Race entries', align: 'num' },
          { key: 'designs', label: 'Designs', align: 'num' },
          { key: 'wins', label: 'Wins', align: 'num' },
          { key: 'poles', label: 'Poles', align: 'num' },
          { key: 'constructors_titles', label: "Constructors' titles", align: 'num' },
          {
            key: 'drivers_titles',
            label: "Drivers' titles",
            align: 'num',
            render: (value, row) =>
              value ? <span title={row.title_years ?? undefined}>{value}</span> : cell(value),
          },
        ]}
        footer="“Race entries” counts one row per car per race, so a two-car team collects two for every Grand Prix it started."
      />
    </>
  )
}
