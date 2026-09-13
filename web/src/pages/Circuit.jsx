import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import LapFigure from '../components/LapFigure.jsx'
import { BANDS, BAND_NAMES, buildLap } from '../lib/lap.js'
import { rows, useQueries } from '../data/useQuery.js'
import { number, span } from '../lib/format.js'

import { NOT_YET_RUN } from '../lib/site.js'
import {
  CIRCUIT,
  GEOMETRY,
  LAYOUTS,
  RACES,
  RACE_COLUMNS,
  TEAMS,
  TEAM_COLUMNS,
  WINNERS,
  WINNER_COLUMNS,
} from '../queries/circuit.js'

/*
 * The React renders for the columns queries/circuit.js defines — the links,
 * the tag and the sort keys; the router is the reason they live here. The
 * words each cell carries are the column's own `text`, which
 * scripts/prerender.js prints too, so the static tables are these.
 */
const WINNER_APP = {
  driver: { render: (name, row) => <Link to={`/drivers/${row.driver_id}`}>{name}</Link> },
  first_win: { sort: (row) => row.first_win },
}
const TEAM_APP = {
  constructor: {
    render: (name, row) =>
      row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name),
  },
}
const RACE_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  name_used: { render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link> },
  winner: {
    render: (name, row) =>
      row.status !== 'completed' ? (
        <span className="tag">{NOT_YET_RUN}</span>
      ) : row.winner_id && !String(name ?? '').includes(' / ') ? (
        <Link to={`/drivers/${row.winner_id}`}>{name}</Link>
      ) : (
        cell(name)
      ),
  },
}
const withRenders = (columns, renders) => columns.map((column) => ({ ...column, ...renders[column.key] }))

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
            <Page title="No such circuit" cite={false} back={{ to: '/circuits', label: 'The register' }}>
              <p className="muted">Nothing in the register has the id “{id}”.</p>
              <p>
                Press <kbd>/</kbd> to search by name, or{' '}
                <Link to="/circuits">browse all eighty venues</Link>.
              </p>
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
  // Races come back newest first, so the first completed one is the last held.
  const latest = races.find((race) => race.status === 'completed') ?? null

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
          note="Traced from OpenStreetMap, and measured against the published length. It ships as a separate file under ODbL, which your browser merged in to draw this."
        >
          <p className="note" style={{ marginTop: -4 }}>
            <Link to="/circuits/atlas">Open it in the atlas</Link> to walk the lap metre by metre
            and compare it with the other traced circuits at one scale.
          </p>
          <div className="map-grid">
            {geometry.map((row) => (
              <CircuitLap key={`${row.circuit_id}-${row.layout_key}`} geometry={row} circuit={circuit} />
            ))}
          </div>
        </Section>
      )}

      {layouts.length > 0 && (
        <Section title="How it changed" count={`${layouts.length} layouts`}>
          <div className="timeline">
            {layouts.map((layout) => (
              <article key={layout.id}>
                <h3>
                  {layout.layout_name}
                  <span className="years">{span(layout.from_year, layout.to_year)}</span>
                  {layout.length_km && <span className="years">{layout.length_km} km</span>}
                  <Confidence value={layout.confidence} />
                </h3>
                {layout.change_reason && <p>{layout.change_reason}</p>}
              </article>
            ))}
          </div>
        </Section>
      )}

      {layouts.length === 0 && circuit.races > 1 && (
        <Note>
          <strong>No layout timeline for this circuit.</strong> Only thirteen of the eighty have
          one, so an early race here is reported at the length the circuit is today. Nothing maps
          what a circuit used to look like — see the{' '}
          <Link to="/data/quality">known gaps</Link>.
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
              columns={withRenders(WINNER_COLUMNS, WINNER_APP)}
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
              columns={withRenders(TEAM_COLUMNS, TEAM_APP)}
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
          columns={withRenders(RACE_COLUMNS, RACE_APP)}
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

      <Onward
        items={[
          latest
            ? {
                to: `/races/${latest.year}/${latest.round}`,
                label: `${latest.year} ${latest.name_used}`,
                hint: 'The most recent race held here, in full.',
              }
            : null,
          winners[0]
            ? {
                to: `/drivers/${winners[0].driver_id}`,
                label: winners[0].driver,
                hint: `Has won here ${winners[0].wins} ${winners[0].wins === 1 ? 'time' : 'times'} — more than anyone.`,
              }
            : null,
          geometry.length > 0
            ? { to: '/circuits/atlas', label: 'Track atlas', hint: 'This lap beside the other traced circuits.' }
            : null,
          { to: '/circuits', label: 'All circuits', hint: 'Eighty venues, by races held.' },
        ]}
      />
    </Page>
  )
}

/**
 * The atlas's drawing, on the circuit's own page. The trace is coloured by
 * corner radius and carries the direction of travel; the attribution stays
 * attached to the drawing because the geometry is the one ODbL table.
 */
function CircuitLap({ geometry, circuit }) {
  const lap = useMemo(
    () => buildLap({ ...geometry, name: circuit.name, direction: circuit.direction }),
    [geometry, circuit.name, circuit.direction],
  )
  if (!lap) return null
  const delta = geometry.delta_pct
  return (
    <figure className="photo lapfigure-card">
      <LapFigure lap={lap} />
      {lap.radius && (
        <div className="legend" aria-label="Corner radius">
          {BAND_NAMES.map((name, i) => (
            <span key={name}>
              <i style={{ background: `var(--seq-${5 - i})` }} />
              {name}
              {i === 0 && ` <${BANDS[0]} m`}
              {i > 0 && i < BANDS.length && ` ${BANDS[i - 1]}\u2013${BANDS[i]} m`}
              {i === BANDS.length && ` >${BANDS[BANDS.length - 1]} m`}
            </span>
          ))}
        </div>
      )}
      <figcaption>
        Traced from OpenStreetMap relation{' '}
        <a
          href={`https://www.openstreetmap.org/relation/${geometry.osm_relation}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          {geometry.osm_relation}
        </a>{' '}
        · {number(geometry.node_count)} points
        {!lap.complete && ' · the trace does not close, so it is not coloured'}
        {' '}· measures {geometry.measured_km?.toFixed(3)} km against{' '}
        {geometry.published_km?.toFixed(3)} km published
        {delta !== null && delta !== undefined && ` (${delta > 0 ? '+' : ''}${delta.toFixed(2)}%)`}
        {circuit.direction && ` · raced ${circuit.direction}`}
        {lap.complete && circuit.direction && '; the arrow is the direction, not the start'}
        <br />© OpenStreetMap contributors, {geometry.licence || 'ODbL 1.0'}.
      </figcaption>
    </figure>
  )
}
