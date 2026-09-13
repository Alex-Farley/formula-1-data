import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { colourFor } from '../lib/racingColours.js'
import { CONSTRUCTORS, CONSTRUCTOR_COLUMNS, CONSTRUCTORS_FOOTER } from '../queries/constructors.js'

/**
 * The React renders for the columns queries/constructors.js defines — the
 * racing-colour swatch, the links, a title attribute; the router is the
 * reason they live here. The words each cell carries are the column's own
 * `text`, which scripts/prerender.js prints too, so the static register is
 * this one.
 */
const APP = {
  name: {
    render: (name, row) => {
      const colour = colourFor(row.country)
      return (
        <>
          <i
            className="livery"
            style={colour ? { background: colour.css } : undefined}
            title={colour ? `${colour.name} — the racing colour of ${row.country}` : 'no racing colour recorded'}
          />
          <Link to={`/constructors/${row.id}`}>{name}</Link>
        </>
      )
    },
  },
  first_entry: { sort: (row) => row.first_entry },
  drivers_titles: {
    render: (value, row) => (value ? <span title={row.title_years ?? undefined}>{value}</span> : cell(value)),
  },
}

export default function Constructors() {
  const state = useQuery(CONSTRUCTORS)
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
          label="Filter constructors by kind"
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

      {/* No opening sort: the query's ORDER BY is the alphabetical order the
          table opens in, and the static page prints the rows as they come. */}
      <DataTable
        rows={filtered}
        rowKey={(row) => row.id}
        page={150}
        columns={CONSTRUCTOR_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
        footer={CONSTRUCTORS_FOOTER}
      />
    </>
  )
}
