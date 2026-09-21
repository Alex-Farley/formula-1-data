import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { anyThisSeason, gridLabel, seasonOf } from '../lib/season.js'
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
            style={colour ? { '--livery': colour.css } : undefined}
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
  // IA-19: the same question /drivers asks, in the same words. It read
  // "Active" before, which named the stored constructors.active column and
  // left a reader to work out that it meant this year.
  const gridSeason = seasonOf(rows)
  const hasGrid = anyThisSeason(rows, 'on_grid')

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
      // `on_grid` from the query, not the stored `active` column: the two
      // agree on the same eleven teams today, but `active` is built against
      // the highest year in the entry lists rather than the declared season
      // (CR-35, #429), and this chip names that season out loud.
      if (kind === 'grid' && !row.on_grid) return false
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
            ...(hasGrid ? [['grid', gridLabel(gridSeason)]] : []),
          ]}
        />
      </Filters>

      {/* VD-30: most race entries first, which is the query's own ORDER BY,
          so the static page still prints the rows as they come. Alphabetical
          is one click on the Constructor header away. */}
      <DataTable
        rows={filtered}
        rowKey={(row) => row.id}
        sort="entries"
        direction="desc"
        page={150}
        columns={CONSTRUCTOR_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
        footer={CONSTRUCTORS_FOOTER}
      />
    </>
  )
}
