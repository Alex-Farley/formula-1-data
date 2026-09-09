import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { rows as pick, useQueries } from '../data/useQuery.js'
import { pathOf, project, stitch } from '../lib/lap.js'
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

/**
 * The traced laps, for the strip at the top of the page.
 *
 * 25 of the 80 circuits have a centreline. That is a minority, and the strip
 * says so rather than implying the other 55 are missing something — a trace
 * exists where somebody could match an OSM relation to a length this database
 * already held, and most venues in the register have been gone for decades.
 */
const TRACES = `
  SELECT g.circuit_id, c.name, c.country, g.measured_km, g.centreline, g.closes
    FROM circuit_geometry g
    JOIN circuits c ON c.id = g.circuit_id
   ORDER BY c.name
`

/** One circuit's outline, drawn small enough to read as a shape. */
function LapThumb({ trace }) {
  // stitch() takes the centreline as stored and parses it itself — handing it
  // an already-extracted coordinates array makes it look for .coordinates on
  // an array, find nothing, and return null for every circuit.
  const shape = useMemo(() => {
    const walk = stitch(trace.centreline)
    if (!walk?.ring?.length) return null
    const flat = project(walk.ring)
    // pathOf's `to` is exclusive and defaults to the full length. Passing
    // length - 1 dropped the point that closes the ring, leaving a gap of up
    // to 40 m on the thumbnail. The atlas draws the same rings closed.
    return { d: pathOf(flat.x, flat.y), bounds: flat.bounds }
  }, [trace.centreline])

  if (!shape) return null
  const { x0, x1, y0, y1 } = shape.bounds
  const w = x1 - x0
  const h = y1 - y0
  const side = Math.max(w, h) * 1.14
  const box = `${x0 - (side - w) / 2} ${y0 - (side - h) / 2} ${side} ${side}`

  return (
    <svg viewBox={box} role="img" aria-label={`The lap at ${trace.name}`} style={{ aspectRatio: '1' }}>
      <path
        d={shape.d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={side / 44}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Circuits() {
  const state = useQueries({ register: [SQL], traces: [TRACES] })
  return (
    <Page
      title="Circuits"
      lede="Eighty venues, from airfield perimeters to street courses laid out for a single season. Sorted by races held: open one for how its shape changed, who has won there most, and every Grand Prix it has staged."
    >
      <Result state={state} skeleton>
        {(data) => (
          <>
            <Section
              title="The traced laps"
              count={`${pick(data, 'traces').length} of ${pick(data, 'register').length}`}
            >
              <p className="note" style={{ marginTop: 0 }}>
                Drawn from the centreline each one was matched to, each at its own scale so the
                shape reads rather than the size.{' '}
                <Link to="/circuits/atlas">Open the track atlas</Link> to compare them at one
                scale and walk a lap.
              </p>
              <ul className="lapgrid">
                {pick(data, 'traces').map((trace) => (
                  <li key={trace.circuit_id}>
                    <Link to={`/circuits/${trace.circuit_id}`} className="lapcard">
                      <LapThumb trace={trace} />
                      <b>{trace.name}</b>
                      <span>
                        {trace.country} · {trace.measured_km?.toFixed(3)} km
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Every venue" count={`${pick(data, 'register').length} circuits`}>
              <Register rows={pick(data, 'register')} />
            </Section>
          </>
        )}
      </Result>

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
