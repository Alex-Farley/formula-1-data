import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { currentProgress } from '../data/client.js'
import { rows as pick, useQueries } from '../data/useQuery.js'
import { TRACE_COLUMN_UNKNOWN, TRACE_NOT_LOADED, traceRegisterNote } from '../lib/trace.js'
import { CIRCUITS, CIRCUIT_COLUMNS, CIRCUITS_FOOTER, TRACED } from '../queries/circuits.js'

/**
 * Race counts and first/last Grand Prix come from v_circuits, which derives
 * them from the races. The stored circuits.last_gp is NULL for the 27 venues
 * still in use, and reading it would report every current circuit as never
 * having held its most recent race.
 */
/**
 * The React renders for the columns queries/circuits.js defines — the link
 * and a sort key; the router is the reason they live here. The words each
 * cell carries are the column's own `text`, which scripts/prerender.js prints
 * too, so the static register is this one.
 */
const APP = {
  name: { render: (name, row) => <Link to={`/circuits/${row.id}`}>{name}</Link> },
  first_gp: { sort: (row) => row.first_gp },
  traced: {
    render: (value) =>
      value ? (
        <>
          <span aria-hidden="true">●</span>
          <span className="sr-only">{TRACED}</span>
        </>
      ) : (
        cell(null)
      ),
  },
}

/**
 * The traced centrelines, for the cards at the top of the page.
 *
 * 25 of the 80 circuits have one. That is a minority, and the section says so
 * rather than implying the other 55 are missing something — a trace exists
 * where somebody could match an OSM relation to a length this database
 * already held, and most venues in the register have been gone for decades.
 *
 * AF-23: what each card carries is the measurement, not the shape. This was
 * the third place the site drew the same circuit, after the trace and the
 * F1DB outlines on the circuit's own page; the outline is the picture now,
 * and the centreline is what it cannot be. The centreline itself is no longer
 * read here at all, which is a few hundred kilobytes of coordinates the
 * register no longer parses to draw 25 thumbnails.
 */
const TRACES = `
  SELECT g.circuit_id, c.name, c.country, g.measured_km, g.closes, g.licence
    FROM circuit_geometry g
    JOIN circuits c ON c.id = g.circuit_id
   ORDER BY c.name
`

export default function Circuits() {
  const state = useQueries({ register: [CIRCUITS], traces: [TRACES] })
  return (
    <Page
      title="Circuits"
      lede="Eighty venues, from airfield perimeters to street courses laid out for a single season. Sorted by races held: open one for how its shape changed, who has won there most, and every Grand Prix it has staged."
    >
      <Result state={state} skeleton>
        {(data) => {
          const traces = pick(data, 'traces')
          const register = pick(data, 'register')
          // IX-31: "0 of 80" is a claim about the database, made in the
          // database's voice, when what happened is that an ODbL file did not
          // arrive — and the register's Traced column empties with it, so the
          // page is internally consistent and wrong throughout. The overlay's
          // own state is the only thing that can tell the two apart.
          const overlay = currentProgress().manifest?.geometry ?? null
          return (
            <>
              <Section
                title="The traced centrelines"
                count={overlay ? `${traces.length} of ${register.length}` : null}
              >
                {/* One credit for the set, from the rows themselves: every
                    row of circuit_geometry states the same licence today, and
                    a circuit's own page prints its own row's. */}
                <p className="note" style={{ marginTop: 0 }}>
                  {overlay ? traceRegisterNote(traces[0]?.licence) : TRACE_NOT_LOADED}
                </p>
                {overlay && traces.length > 0 && (
                  <ul className="lapgrid">
                    {traces.map((trace) => (
                      <li key={trace.circuit_id}>
                        <Link to={`/circuits/${trace.circuit_id}`} className="lapcard">
                          <b>{trace.name}</b>
                          <span>{trace.country}</span>
                          <span>
                            {trace.measured_km?.toFixed(3)} km measured
                            {/* Strictly 0, not falsy: a NULL verdict is
                                unestablished, not a trace that does not
                                close. */}
                            {trace.closes === 0 ? ' · does not close' : ''}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              {/* The Traced column is answered from the same overlay, so
                  without it every row reads as an em dash — the register
                  saying "unestablished" eighty times when what happened was a
                  download (IX-31). The column stays, because dropping a column
                  would make the static and app tables disagree; what it means
                  today is said beside it, and the filter that reads it goes,
                  because it would return nothing. */}
              <Section
                title="Every venue"
                count={`${register.length} circuits`}
                note={overlay ? undefined : TRACE_COLUMN_UNKNOWN}
              >
                <Register rows={register} traceable={Boolean(overlay)} />
              </Section>
            </>
          )
        }}
      </Result>

      <Onward
        items={[
          { to: '/races', label: 'Every race', hint: 'What was run at each of these venues.' },
          { to: '/reference/eras', label: 'Eras and rules', hint: 'The safety work that redrew many of these circuits.' },
        ]}
      />
    </Page>
  )
}

function Register({ rows, traceable = true }) {
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
          label="Filter circuits by type"
          value={kind}
          onChange={setKind}
          // Without the overlay every row's Traced is unestablished, so the
          // chip would filter eighty circuits down to none and read as an
          // answer (IX-31).
          options={[['', 'All'], ...types.map((t) => [t, t]), ...(traceable ? [['traced', 'Traced']] : [])]}
        />
      </Filters>

      <DataTable
        rows={filtered}
        rowKey={(row) => row.id}
        sort="races"
        direction="desc"
        page={100}
        columns={CIRCUIT_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
        footer={CIRCUITS_FOOTER}
      />
    </>
  )
}
