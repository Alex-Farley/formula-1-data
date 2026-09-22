import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, NoMatch, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { anyThisSeason, gridLabel, seasonOf } from '../lib/season.js'
import { oneOf, useUrlState } from '../lib/urlstate.js'
import { colourFor } from '../lib/racingColours.js'
import { CONSTRUCTORS, CONSTRUCTOR_COLUMNS, CONSTRUCTORS_FOOTER } from '../queries/constructors.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import { NAMES } from '../lib/site.js'
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
      title={NAMES.constructors().headline}
      documentName={NAMES.constructors().title}
      trail={TRAIL.constructors()}
      lede="A hundred and fifty constructors, from the ones that defined an era to the ones that entered a handful of races and disappeared. Sorted by race entries, with alphabetical a click away: filter by country, or narrow to race winners, champions and this season’s grid. Each page carries the team’s record, the cars it built, and the names it raced under before and after."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => <Register rows={data.rows} />}
        </Result>
      </Section>

      <Onward {...ONWARD.constructors()} />
    </Page>
  )
}

function Register({ rows }) {
  // IA-19: the same question /drivers asks, in the same words. It read
  // "Active" before, which named the stored constructors.active column and
  // left a reader to work out that it meant this year.
  const gridSeason = seasonOf(rows)
  const hasGrid = anyThisSeason(rows, 'on_grid')

  const countries = useMemo(
    () => [...new Set(rows.map((r) => r.country).filter(Boolean))].sort(),
    [rows],
  )
  const kinds = [
    ['', 'All'],
    ['winners', 'Race winners'],
    ['champions', 'Champions'],
    ...(hasGrid ? [['grid', gridLabel(gridSeason)]] : []),
  ]

  // In the address, and clamped to what this register actually holds (IA-08).
  const [params, set, clear] = useUrlState({ q: '', country: '', kind: '' })
  const term = params.q
  const country = oneOf(params.country, countries)
  const kind = oneOf(params.kind, kinds)

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (country && row.country !== country) return false
      if (kind === 'winners' && !row.wins) return false
      if (kind === 'champions' && !row.constructors_titles) return false
      // `on_grid` from the query, not the stored `active` column. CR-35
      // moved `active` onto the declared season and verify.py now holds it
      // to that season's entry list, so the two cannot disagree; this chip
      // is still the one to read, because it names the season out loud
      // rather than leaving a reader to work out which one "active" means.
      if (kind === 'grid' && !row.on_grid) return false
      if (!needle) return true
      return row.name.toLowerCase().includes(needle)
    })
  }, [rows, term, country, kind])

  // The filters as a plural noun phrase, for the empty state (IX-28).
  const among =
    country || kind
      ? [
          kind === 'winners'
            ? 'race winners'
            : kind === 'champions'
              ? 'champions'
              : kind === 'grid'
                ? `constructors on the ${gridSeason} grid`
                : 'constructors',
          country ? `from ${country}` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : ''

  return (
    <>
      <Filters showing={filtered.length} of={rows.length} noun="constructors">
        <SearchField
          value={term}
          onChange={(value) => set({ q: value })}
          label="Filter constructors"
          placeholder="A name…"
        />
        <Select
          value={country}
          onChange={(value) => set({ country: value })}
          label="Country"
          all="Every country"
          options={countries}
        />
        <Chips
          label="Filter constructors by kind"
          value={kind}
          onChange={(value) => set({ kind: value })}
          options={kinds}
        />
      </Filters>

      {/* VD-30: most race entries first, which is the query's own ORDER BY,
          so the static page still prints the rows as they come. Alphabetical
          is one click on the Constructor header away. */}
      <DataTable
        addressed
        rows={filtered}
        rowKey={(row) => row.id}
        sort="entries"
        direction="desc"
        page={150}
        columns={CONSTRUCTOR_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
        empty={<NoMatch noun="constructor" term={term} among={among} onClear={clear} />}
        footer={CONSTRUCTORS_FOOTER}
      />
    </>
  )
}
