import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { OutlineCard } from '../components/Outline.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import { currentProgress } from '../data/client.js'
import { rows, row as firstRow, useQueries } from '../data/useQuery.js'
import { number, span } from '../lib/format.js'
import { colourForEntry } from '../lib/liveries.js'
import { OUTLINE_FIGURES_NOTE, OUTLINE_RULE, OUTLINE_SCALE_NOTE, outlineCaption } from '../lib/outline.js'
import { TRACE_NOT_LOADED, TRACE_RULE, noTrace, odblCredit } from '../lib/trace.js'

import { NOT_YET_RUN } from '../lib/site.js'
import {
  CIRCUIT,
  GEOMETRY,
  LAYOUTS,
  OUTLINES,
  RACES,
  RACE_COLUMNS,
  TEAMS,
  TEAM_COLUMNS,
  TRACE_COVERAGE,
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
  // The winning team's colour mark (AF-52): a constructor is the subject of
  // this row under clause 1 of AF-47. The row covers every season the team
  // won here, so the mark takes the last of them - `last_win`, which the
  // view already carries - under the site's rule for a subject spanning
  // seasons.
  constructor: {
    render: (name, row) => (
      <>
        <LiveryMark
          colour={colourForEntry({
            constructorId: row.constructor_id,
            country: row.constructor_country,
            year: row.last_win,
            team: name,
          })}
          year={row.last_win}
        />
        {row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name)}
      </>
    ),
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
const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

export default function Circuit() {
  const { id } = useParams()
  const state = useQueries({
    circuit: [CIRCUIT, [id]],
    geometry: [GEOMETRY, [id]],
    layouts: [LAYOUTS, [id]],
    outlines: [OUTLINES, [id]],
    coverage: [TRACE_COVERAGE],
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
  // Whether the ODbL overlay merged, which is a different question from
  // whether this circuit has a row in it (IX-31). mergeGeometry() in the
  // worker returns null when the file did not arrive.
  const overlay = currentProgress().manifest?.geometry ?? null
  const coverage = firstRow(data, 'coverage')
  const layouts = rows(data, 'layouts')
  const outlines = rows(data, 'outlines')
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

      {/* AF-23: this page used to draw the circuit twice — the ODbL trace and
          then every layout F1DB draws (AF-03) — two pictures of one thing,
          from two sources, with no rule for which to believe. The outline is
          the picture: it covers 79 of the 80 venues and every historic layout
          no trace can ever hold. The rule and the caveat are the section's
          note, once, rather than under each card. */}
      {outlines.length > 0 && (
        <Section
          title="Every layout raced here"
          count={`${outlines.length}`}
          note={`${OUTLINE_RULE} ${OUTLINE_SCALE_NOTE}`}
        >
          <div className="outline-grid">
            {outlines.map((row) => (
              <OutlineCard
                key={row.f1db_layout_id}
                path={row.path}
                circuit={circuit.name}
                layoutId={row.f1db_layout_id}
                caption={outlineCaption(row)}
              />
            ))}
          </div>
        </Section>
      )}

      {geometry.length > 0 ? (
        <Section title="Traced and measured" note={TRACE_RULE}>
          {geometry.map((row) => (
            <CircuitTrace key={`${row.circuit_id}-${row.layout_key}`} geometry={row} circuit={circuit} />
          ))}
        </Section>
      ) : (
        // IX-31: a circuit with no trace and a trace that did not arrive were
        // the same silent page. Which of the two this is cannot be told from
        // this circuit's rows — without the overlay every circuit has none —
        // so it is told from whether the overlay merged at all.
        <Section note={overlay ? noTrace(coverage?.traced, coverage?.circuits) : TRACE_NOT_LOADED} />
      )}

      {layouts.length > 0 && (
        <Section title="How it changed" count={`${layouts.length} layouts`} note={outlines.length > 0 ? OUTLINE_FIGURES_NOTE : undefined}>
          <div className="timeline">
            {layouts.map((layout) => (
              <article key={layout.id}>
                <h3>
                  {layout.layout_name}
                  <span className="years">{span(layout.from_year, layout.to_year)}</span>
                  {layout.length_km && <span className="years">{layout.length_km} km</span>}
                  {layout.f1db_layout_id && <span className="years">drawn as {layout.f1db_layout_id}</span>}
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
          one, so an early race here is reported at the length the circuit is today. The outlines
          above are the shapes F1DB distinguishes; nothing here dates a change or says why — see
          the <Link to="/data/quality">known gaps</Link>.
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
          { to: '/circuits', label: 'All circuits', hint: 'Eighty venues, by races held.' },
        ]}
      />
    </Page>
  )
}

/**
 * What the trace measures, on the circuit's own page.
 *
 * AF-23 demoted it from a drawing to its facts: the outlines above are the
 * picture of this circuit, and the trace is the thing they cannot be — a
 * length taken off the map and checked against the one this register
 * publishes, which is the only independent check the 25 traced circuits have
 * on their own stated length. `closes` is the build's verdict on the walk,
 * not a fresh stitch in the browser: build.py decides it when the row is
 * admitted and verify.py re-derives it on every build.
 *
 * The attribution stays attached to the figures because a measurement taken
 * from an ODbL database is as much that database's as a drawing of it was.
 */
function CircuitTrace({ geometry, circuit }) {
  const { delta_pct: delta, measured_km: measured, published_km: published } = geometry
  const both = measured !== null && measured !== undefined && published !== null && published !== undefined
  return (
    <>
      <Fields
        items={[
          {
            label: 'OpenStreetMap relation',
            value: (
              <a
                href={`https://www.openstreetmap.org/relation/${geometry.osm_relation}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {geometry.osm_relation}
              </a>
            ),
          },
          geometry.layout_key ? { label: 'Layout traced', value: geometry.layout_key } : null,
          {
            label: 'Measured',
            value: both
              ? `${measured.toFixed(3)} km against ${published.toFixed(3)} km published here${
                  delta === null || delta === undefined ? '' : ` (${delta > 0 ? '+' : ''}${delta.toFixed(2)}%)`
                }`
              : null,
          },
          { label: 'Points', value: number(geometry.node_count) },
          {
            // build.py sums every way in the relation, whether or not they
            // walk into a ring, so a trace with a hole still has an honest
            // length — it is just not a lap. Las Vegas measures within 2 %
            // of its published length and is still missing a way.
            label: 'The walk',
            // build.py writes 0 or 1 and the column is not NOT NULL, so the
            // absence of a verdict is a third state and reads as one.
            value:
              geometry.closes === null || geometry.closes === undefined
                ? null
                : geometry.closes
                  ? 'closes into one lap'
                  : `does not close — ${number(geometry.loose_ends)} loose way ${
                      geometry.loose_ends === 1 ? 'end' : 'ends'
                    }, so the length above is the ways added up rather than a lap walked round`,
          },
          circuit.direction ? { label: 'Raced', value: circuit.direction } : null,
        ]}
      />
      <p className="faint">{odblCredit(geometry.licence)}</p>
    </>
  )
}
