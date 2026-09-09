import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import TrackMap from '../components/TrackMap.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number, span } from '../lib/format.js'

const CIRCUIT = `
  SELECT c.*, v.races, v.first_gp AS derived_first, v.last_gp AS derived_last,
         v.seasons_used, v.events_hosted, v.layouts
    FROM circuits c
    LEFT JOIN v_circuits v ON v.id = c.id
   WHERE c.id = ?
`

/** The centreline is a few hundred kilobytes of coordinates; it is only ever
 *  fetched for the one circuit being looked at. */
const GEOMETRY = `SELECT * FROM circuit_geometry WHERE circuit_id = ?`

const LAYOUTS = `
  SELECT * FROM circuit_layouts WHERE circuit_id = ? ORDER BY from_year
`

const RACES = `
  SELECT r.year, r.round, r.name_used, r.status, r.layout_key,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.finish_position = 1) AS winner,
         (SELECT e.driver_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winner_id,
         (SELECT k.name FROM race_entries e JOIN constructors k ON k.id = e.constructor_id
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS constructor
    FROM races r
   WHERE r.circuit_id = ?
   ORDER BY r.year DESC, r.round DESC
`

const WINNERS = `
  SELECT driver_id, driver, wins, first_win, last_win
    FROM v_circuit_winners WHERE circuit_id = ?
   ORDER BY wins DESC, driver
`

const TEAMS = `
  SELECT * FROM v_circuit_constructors WHERE circuit_id = ? ORDER BY wins DESC
`

export default function Circuit() {
  const { id } = useParams()
  const state = useQueries({
    circuit: [CIRCUIT, [id]],
    geometry: [GEOMETRY, [id]],
    layouts: [LAYOUTS, [id]],
    races: [RACES, [id]],
    winners: [WINNERS, [id]],
    teams: [TEAMS, [id]],
  })

  return (
    <Result state={state} context="That circuit could not be read">
      {(data) => {
        const circuit = data.circuit.rows[0]
        if (!circuit) {
          return (
            <Page title="No such circuit" back={{ to: '/circuits', label: 'The register' }}>
              <p className="muted">Nothing in the register has the id “{id}”.</p>
            </Page>
          )
        }
        return <CircuitBody circuit={circuit} data={data} />
      }}
    </Result>
  )
}

function CircuitBody({ circuit, data }) {
  const geometry = rows(data, 'geometry')
  const layouts = rows(data, 'layouts')
  const races = rows(data, 'races')
  const winners = rows(data, 'winners')
  const teams = rows(data, 'teams')

  return (
    <Page
      eyebrow={[circuit.locality, circuit.country].filter(Boolean).join(', ')}
      title={circuit.name}
      back={{ to: '/circuits', label: 'The register' }}
      lede={circuit.notes}
    >
      <Section>
        <Stats
          items={[
            { label: 'Championship races', value: number(circuit.races) },
            {
              label: 'Grands Prix',
              value: span(circuit.derived_first, circuit.derived_last),
              note: `${circuit.seasons_used ?? 0} seasons`,
            },
            { label: 'Length', value: circuit.length_km ? `${circuit.length_km} km` : null, note: 'current layout' },
            { label: 'Turns', value: circuit.turns },
            { label: 'Direction', value: circuit.direction },
            { label: 'Type', value: circuit.circuit_type },
          ]}
        />
      </Section>

      {geometry.length > 0 && (
        <Section
          title="The shape of it"
          note="Traced from OpenStreetMap, the only ODbL-licensed data in the project. ODbL reaches the whole database it lands in, so these rows are not in f1.db at all: they ship as f1-geometry.db and your browser merged the two to draw this."
        >
          <div className="map-grid">
            {geometry.map((row) => (
              <TrackMap key={`${row.circuit_id}-${row.layout_key}`} geometry={row} />
            ))}
          </div>
        </Section>
      )}

      {layouts.length > 0 && (
        <Section title="How it changed" count={`${layouts.length} layouts`}>
          <div className="timeline">
            {layouts.map((layout) => (
              <article key={layout.id}>
                <h4>
                  {layout.layout_name}
                  <span className="years">{span(layout.from_year, layout.to_year)}</span>
                  {layout.length_km && <span className="years">{layout.length_km} km</span>}
                  <Confidence value={layout.confidence} />
                </h4>
                {layout.change_reason && <p>{layout.change_reason}</p>}
              </article>
            ))}
          </div>
        </Section>
      )}

      {layouts.length === 0 && circuit.races > 1 && (
        <Note>
          <strong>No layout timeline for this circuit.</strong> Only thirteen of the eighty have
          one, so a lap here in an early season is reported at the length the circuit is now.
          Historic geometry has no source: OpenStreetMap maps what is on the ground, and Wikidata's
          historic-layout entities carry a length and a date range but no coordinates.
        </Note>
      )}

      <div className="split" style={{ marginTop: 34 }}>
        {winners.length > 0 && (
          <Section title="Most wins here" count={`${winners.length} drivers`}>
            <DataTable
              rows={winners}
              rowKey={(row) => row.driver_id}
              sortable
              sort="wins"
              direction="desc"
              page={25}
              columns={[
                {
                  key: 'driver',
                  label: 'Driver',
                  render: (name, row) => <Link to={`/drivers/${row.driver_id}`}>{name}</Link>,
                },
                { key: 'wins', label: 'Wins', align: 'num' },
                {
                  key: 'first_win',
                  label: 'Span',
                  align: 'num',
                  render: (_, row) => span(row.first_win, row.last_win),
                  sort: (row) => row.first_win,
                },
              ]}
            />
          </Section>
        )}

        {teams.length > 0 && (
          <Section title="Constructors here" count={`${teams.length}`}>
            <DataTable
              rows={teams}
              rowKey={(row) => row.constructor_id ?? row.constructor}
              sortable
              sort="wins"
              direction="desc"
              page={25}
              columns={[
                {
                  key: 'constructor',
                  label: 'Constructor',
                  render: (name, row) =>
                    row.constructor_id ? (
                      <Link to={`/constructors/${row.constructor_id}`}>{name}</Link>
                    ) : (
                      cell(name)
                    ),
                },
                { key: 'wins', label: 'Wins', align: 'num' },
              ]}
            />
          </Section>
        )}
      </div>

      <Section title="Every race held here" count={`${races.length}`}>
        <DataTable
          rows={races}
          rowKey={(row) => `${row.year}-${row.round}`}
          sortable
          sort="year"
          direction="desc"
          page={100}
          columns={[
            {
              key: 'year',
              label: 'Season',
              align: 'num',
              render: (year) => <Link to={`/seasons/${year}`}>{year}</Link>,
            },
            {
              key: 'name_used',
              label: 'Grand Prix',
              render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link>,
            },
            { key: 'layout_key', label: 'Layout' },
            {
              key: 'winner',
              label: 'Winner',
              render: (name, row) =>
                row.status !== 'completed' ? (
                  <span className="tag">not yet run</span>
                ) : row.winner_id && !String(name ?? '').includes(' / ') ? (
                  <Link to={`/drivers/${row.winner_id}`}>{name}</Link>
                ) : (
                  cell(name)
                ),
            },
            { key: 'constructor', label: 'Car' },
          ]}
        />
      </Section>

      <Section title="On the record">
        <Fields
          items={[
            { label: 'Official name', value: circuit.official_name },
            { label: 'Characteristics', value: circuit.characteristics },
            { label: 'First Grand Prix (stored)', value: circuit.first_gp },
            {
              label: 'Last Grand Prix (stored)',
              value: circuit.last_gp ?? (circuit.races ? 'still in use — derived from the races' : null),
            },
            { label: 'Confidence', value: <Confidence value={circuit.confidence} /> },
            {
              label: 'Source',
              value: circuit.source ? (
                <a href={circuit.source} target="_blank" rel="noreferrer noopener">
                  {circuit.source}
                </a>
              ) : null,
            },
          ]}
        />
      </Section>
    </Page>
  )
}
