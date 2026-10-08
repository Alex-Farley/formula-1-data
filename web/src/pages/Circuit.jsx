import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { OutlineCard } from '../components/Outline.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import CommonsImage from '../components/CommonsImage.jsx'
import { currentProgress } from '../data/client.js'
import { rows, row as firstRow, useQueries } from '../data/useQuery.js'
import { number } from '../lib/format.js'
import { FOLD_NOUN } from '../lib/table.js'
import { colourForEntry } from '../lib/liveries.js'
import { canShow } from '../lib/commons.js'
import {
  LAYOUT_CARDS,
  NO_DRAWING,
  circuitOutlinesNote,
  layoutTimeline,
  layoutsCount,
  leadOutline,
  otherLayouts,
  outlineCaption,
  timelineName,
  timelineStripName,
  timelineYears,
} from '../lib/outline.js'
import { TRACE_NOT_LOADED, TRACE_RULE, measured, noTrace, odblCredit } from '../lib/trace.js'

import { EYEBROWS, LABELS, NAMES, NOT_YET_RUN, PHOTOGRAPH_WIDTH } from '../lib/site.js'
import {
  CIRCUIT,
  GEOMETRY,
  GRANDS_PRIX,
  LAYOUTS,
  OUTLINES,
  PHOTOGRAPH,
  RACES,
  RACES_HEADING,
  RACE_COLUMNS,
  TEAMS,
  TEAM_COLUMNS,
  TRACE_COVERAGE,
  WINNERS,
  WINNER_COLUMNS,
  circuitStrip,
  heldAs,
  photographAlt,
  racesCount,
} from '../queries/circuit.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import SearchKey from '../components/SearchKey.jsx'
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
  first_win: { sort: (row) => row.first_win },
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
    photograph: [PHOTOGRAPH, [id]],
    coverage: [TRACE_COVERAGE],
    races: [RACES, [id]],
    winners: [WINNERS, [id]],
    teams: [TEAMS, [id]],
    grandsPrix: [GRANDS_PRIX, [id]],
  })

  return (
    <Result state={state} context="That circuit could not be read">
      {(data) => {
        const circuit = data.circuit.rows[0]
        if (!circuit) {
          return (
            <Page title="No such circuit" cite={false} trail={TRAIL.missing('/circuits', 'Circuits')}>
              <p className="muted">Nothing in the register has the id “{id}”.</p>
              <p>
                Press <SearchKey /> to search by name, or{' '}
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
  const { lead, rest } = leadOutline(outlines)
  const timeline = layouts.length > 0 ? layoutTimeline(layouts, outlines) : []
  const races = rows(data, 'races')
  const winners = rows(data, 'winners')
  const teams = rows(data, 'teams')
  const held = heldAs(rows(data, 'grandsPrix'))
  // VD-62: the photograph identifies the place, beside the heading - not a
  // hero, and not in place of the outlines below. canShow() before anything
  // is drawn, so a row with nobody to credit leaves the page as it was.
  const photograph = rows(data, 'photograph').find(canShow) ?? null
  // VD-83: what sits beside the lead in *Every layout raced here* - the
  // timeline's rows with their cards behind a disclosure, or, with no
  // timeline, the other drawings behind the same one.
  const history =
    timeline.length > 0 ? (
      <div>
        <ol className="layout-strip">
          {timeline.map((entry) => (
            <li key={entry.key}>
              <span className="years">{timelineYears(entry)}</span> {timelineStripName(entry)}
            </li>
          ))}
        </ol>
        <details className="layout-cards">
          <summary>{LAYOUT_CARDS}</summary>
          <div className="timeline layout-timeline">
            {timeline.map((entry) => {
              const { key, layout, outline } = entry
              return (
                <article key={key}>
                  {outline ? (
                    <OutlineCard
                      path={outline.path}
                      circuit={circuit.name}
                      layoutId={outline.f1db_layout_id}
                      caption={outlineCaption(outline)}
                    />
                  ) : (
                    <p className="outline-none">{NO_DRAWING}</p>
                  )}
                  <div>
                    <h3>
                      {timelineName(entry)}
                      <span className="years">{timelineYears(entry)}</span>
                      {layout?.length_km && <span className="years">{layout.length_km} km</span>}
                      {layout && <Confidence value={layout.confidence} />}
                    </h3>
                    {layout?.change_reason && <p>{layout.change_reason}</p>}
                  </div>
                </article>
              )
            })}
          </div>
        </details>
      </div>
    ) : (
      rest.length > 0 && (
        <details className="layout-cards">
          <summary>{otherLayouts(rest.length)}</summary>
          <div className="outline-grid">
            {rest.map((row) => (
              <OutlineCard
                key={row.f1db_layout_id}
                path={row.path}
                circuit={circuit.name}
                layoutId={row.f1db_layout_id}
                caption={outlineCaption(row)}
              />
            ))}
          </div>
        </details>
      )
    )
  return (
    <Page
      eyebrow={EYEBROWS.circuit(circuit.locality, circuit.country)}
      title={NAMES.circuit(circuit.name).headline}
      trail={TRAIL.circuit(circuit.id, circuit.name)}
      lede={circuit.notes}
      aside={
        photograph && (
          <div className="page-photo">
            <CommonsImage image={photograph} width={PHOTOGRAPH_WIDTH} alt={photographAlt(circuit.name)} />
          </div>
        )
      }
    >
      <Section>
        {/* queries/circuit.js's strip, which the static page draws too (VD-49). */}
        <Stats items={circuitStrip(circuit)} />
      </Section>

      <div className="split">
        {winners.length > 0 && (
          <Section title="Most wins here" count={`${winners.length} drivers`}>
            <DataTable
              rows={winners}
              fold={FOLD_NOUN.winners}
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
              fold={FOLD_NOUN.constructors}
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

      {/* AF-23: this page used to draw the circuit twice — the ODbL trace and
          then every layout F1DB draws (AF-03) — two pictures of one thing,
          from two sources, with no rule for which to believe. The outline is
          the picture: it covers 79 of the 80 venues and every historic layout
          no trace can ever hold. The rule and the caveat are the section's
          note, once, rather than under each card.

          VD-37: the latest layout leads, drawn large, and the rest beside it.

          IX-32: where the register has a timeline, it is one list with the
          drawings rather than a second one joined by a "drawn as monza-5" the
          reader matched by eye. Each row sits beside the drawing it names; a
          row that names none and a drawing no row names are both shown as
          what they are (lib/outline.js, layoutTimeline).

          PD-60 put the winners first and the history behind a disclosure,
          closed, but only at the 13 circuits with a timeline; the other 67
          opened on a grid of cards. VD-83 (SD-41): one order on all 80 -
          winners, then this section, the lead drawn large with the rows or
          the other drawings beside it behind the same disclosure. */}
      {(timeline.length > 0 || outlines.length > 0) && (
        <Section
          title="Every layout raced here"
          count={layoutsCount(layouts, outlines)}
          note={circuitOutlinesNote(outlines.length, timeline.length > 0)}
        >
          {lead ? (
            <div className="outline-set">
              <OutlineCard path={lead.path} circuit={circuit.name} layoutId={lead.f1db_layout_id} caption={outlineCaption(lead)} />
              {history}
            </div>
          ) : (
            history
          )}
        </Section>
      )}

      <Section title={RACES_HEADING} count={racesCount(races)}>
        {/* IA-01: the way from a venue to every other place its Grand Prix
            has been run. The words are queries/circuit.js's, which
            prerender.js prints too. */}
        {held.length > 0 && (
          <p className="measure">
            {held.map((segment) =>
              segment.id ? (
                <Link key={segment.key} to={`/grands-prix/${segment.id}`}>
                  {segment.name}
                </Link>
              ) : (
                <span key={segment.key}>{segment.text}</span>
              ),
            )}
          </p>
        )}
        <DataTable
          rows={races}
          fold={FOLD_NOUN.races}
          rowKey={(row) => `${row.year}-${row.round}`}
          sortable
          sort="year"
          direction="desc"
          page={100}
          columns={withRenders(RACE_COLUMNS, RACE_APP)}
        />
      </Section>

      {/* PD-60: after the races, whose lengths it qualifies. */}
      {layouts.length === 0 && circuit.races > 1 && (
        <Note>
          <strong>No layout timeline for this circuit.</strong> Only thirteen of the eighty have
          one, so an early race here is reported at the length the circuit is today. The outlines
          above are the shapes F1DB distinguishes; nothing here dates a change or says why — see
          the <Link to="/data/quality">known gaps</Link>.
        </Note>
      )}

      {/* PD-60: the trace is method rather than content, so it comes last. */}
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

      <Section title={LABELS.provenance}>
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

      <Onward {...ONWARD.circuit({ races, winners })} />
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
          { label: 'Measured', value: measured(geometry) },
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
