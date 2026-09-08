import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { span } from '../lib/format.js'

/**
 * Race counts and first/last Grand Prix come from v_circuits, which derives
 * them from the races. The stored circuits.last_gp is NULL for the 27 venues
 * still in use, and reading it would report every current circuit as never
 * having held its most recent race.
 */
const SQL = `
  SELECT v.*, 
         (SELECT COUNT(*) FROM circuit_geometry g WHERE g.circuit_id = v.id) AS traced
    FROM v_circuits v
   ORDER BY v.races DESC, v.name
`

export default function Circuits() {
  const state = useQuery(SQL)
  return (
    <Page
      title="Circuits"
      lede="Eighty venues, from airfield perimeters to street courses laid out for a single season. Sorted by races held: open one for how its shape changed, who has won there most, and every Grand Prix it has staged."
    >
      <Section>
        <p className="note" style={{ marginTop: 0 }}>
          Twenty-five of them are traced from OpenStreetMap.{' '}
          <Link to="/circuits/atlas">Open the track atlas</Link> to compare their shapes at one
          scale and walk a lap.
        </p>
        <Result state={state} skeleton>
          {(data) => <Register rows={data.rows} />}
        </Result>
      </Section>

      <Onward
        items={[
          { to: '/circuits/atlas', label: 'Track atlas', hint: '25 traced laps, side by side and at true scale.' },
          { to: '/races', label: 'Every race', hint: 'What was run at each of these venues.' },
          { to: '/reference/eras', label: 'Eras and rules', hint: 'The safety work that redrew many of these circuits.' },
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
  const types = useMemo(
    () => [...new Set(rows.map((r) => r.circuit_type).filter(Boolean))].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (country && row.country !== country) return false
      if (kind && kind !== 'traced' && row.circuit_type !== kind) return false
      if (kind === 'traced' && !row.traced) return false
      if (!needle) return true
      return [row.name, row.locality, row.country]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    })
  }, [rows, term, country, kind])

  return (
    <>
      <Filters showing={filtered.length} of={rows.length} noun="circuits">
        <SearchField value={term} onChange={setTerm} label="Filter circuits" placeholder="A circuit or a place…" />
        <Select value={country} onChange={setCountry} label="Country" all="Every country" options={countries} />
        <Chips
          value={kind}
          onChange={setKind}
          options={[['', 'All'], ...types.map((t) => [t, t]), ['traced', 'Traced']]}
        />
      </Filters>

      <DataTable
        rows={filtered}
        rowKey={(row) => row.id}
        sort="races"
        direction="desc"
        page={100}
        columns={[
          {
            key: 'name',
            label: 'Circuit',
            render: (name, row) => <Link to={`/circuits/${row.id}`}>{name}</Link>,
          },
          { key: 'locality', label: 'Locality' },
          { key: 'country', label: 'Country' },
          { key: 'circuit_type', label: 'Type' },
          { key: 'races', label: 'Races', align: 'num' },
          {
            key: 'first_gp',
            label: 'Grands Prix',
            align: 'num',
            render: (_, row) => span(row.first_gp, row.last_gp),
            sort: (row) => row.first_gp,
          },
          { key: 'layouts', label: 'Layouts', align: 'num' },
          { key: 'length_km', label: 'Length (km)', align: 'num' },
          { key: 'turns', label: 'Turns', align: 'num' },
          {
            key: 'traced',
            label: 'Traced',
            align: 'num',
            render: (value) => (value ? '●' : cell(null)),
          },
        ]}
        footer="Length and turns describe the layout in use now. Only 13 of the 80 have a layout timeline, so a 1976 lap of a circuit rebuilt since is reported at today's length."
      />
    </>
  )
}
