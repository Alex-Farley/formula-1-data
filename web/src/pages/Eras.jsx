import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Confidence, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import { UNFOLDED } from '../lib/table.js'
import { SportNav } from '../components/SubNav.jsx'
import { Chips } from '../components/Filters.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { span } from '../lib/format.js'
import { oneOf, useUrlState } from '../lib/urlstate.js'
import {
  ENGINES,
  ENGINE_COLUMNS,
  ERAS,
  ERAS_TITLE,
  ERA_LINES,
  GOVERNANCE,
  GOVERNANCE_COLUMNS,
  INNOVATIONS,
  INNOVATION_COLUMNS,
  LIMITS,
  LIMITS_NOTE,
  LIMIT_COLUMNS,
  POINTS,
  POINTS_COLUMNS,
  POINTS_NOTE,
  REGULATIONS,
  REGULATION_COLUMNS,
  SAFETY,
  TYRES,
  TYRE_COLUMNS,
  ERAS_LEDE,
  erasNote,
  erasTiers,
  eraPath,
} from '../queries/eras.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import { NAMES } from '../lib/site.js'
const SPEC = {
  eras: [ERAS],
  engines: [ENGINES],
  points: [POINTS],
  regulations: [REGULATIONS],
  innovations: [INNOVATIONS],
  safety: [SAFETY],
  governance: [GOVERNANCE],
  tyres: [TYRES],
  limits: [LIMITS],
}

/*
 * The React render for the one column queries/eras.js defines whose cell is
 * two lines: the era's name over its years. A text-node space before the
 * break, so the accessible name and the static cell read "name years".
 */
const ENGINE_APP = {
  era_name: {
    render: (name, row) => (
      <>
        <b>{name}</b>{' '}
        <br />
        <span className="faint small">{span(row.from_year, row.to_year)}</span>
      </>
    ),
  },
}
const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

/** The engine formulae, here and on an era's page (IA-25). */
export function EngineTable({ rows, empty }) {
  return (
    <DataTable
      unfolded={UNFOLDED.reference}
      rows={rows}
      rowKey={(row) => row.id}
      sortable={false}
      columns={withRenders(ENGINE_COLUMNS, ENGINE_APP)}
      empty={empty}
    />
  )
}

/** The safety milestones as a dated timeline, here and on an era's page. */
export function SafetyTimeline({ milestones, empty }) {
  if (milestones.length === 0 && empty) return <p className="state is-empty">{empty}</p>
  return (
    <div className="timeline">
      {milestones.map((milestone) => (
        <article key={milestone.id}>
          <h3>
            {milestone.milestone}
            <span className="years">{milestone.year}</span>
          </h3>
          {milestone.trigger_event && (
            <p className="faint small">
              <strong>After:</strong> {milestone.trigger_event}
            </p>
          )}
          <p>{milestone.description}</p>
        </article>
      ))}
    </div>
  )
}

export default function Eras() {
  const state = useQueries(SPEC)

  return (
    <Page
      title={NAMES.eras().headline}
      documentName={NAMES.eras().title}
      trail={TRAIL.eras()}
      lede={ERAS_LEDE}
    >
      <SportNav />
      <Result state={state}>{(data) => <Body data={data} />}</Result>
    </Page>
  )
}

function Body({ data }) {
  const eras = rows(data, 'eras')
  const engines = rows(data, 'engines')
  const points = rows(data, 'points')
  const regulations = rows(data, 'regulations')
  const innovations = rows(data, 'innovations')
  const safety = rows(data, 'safety')
  const governance = rows(data, 'governance')
  const tyres = rows(data, 'tyres')
  const limits = rows(data, 'limits')

  const categories = useMemo(
    () => [...new Set(regulations.map((r) => r.category).filter(Boolean))].sort(),
    [regulations],
  )
  const chips = [['', 'All'], ...categories.map((c) => [c, c])]

  // In the address (IA-08): the regulation category is the one thing a
  // reader chooses on this page, and it is what they would want to send.
  const [params, set] = useUrlState({ category: '' })
  const category = oneOf(params.category, chips)
  const shownRegulations = category ? regulations.filter((r) => r.category === category) : regulations
  const eraTiers = erasTiers(eras)

  return (
    <>
      {/* queries/eras.js's heading, note and lines, which the static page
          draws too (VD-87). */}
      <Section title={ERAS_TITLE} count={`${eras.length}`} note={erasNote(eraTiers)}>
        <div className="timeline">
          {eras.map((era) => (
            <article key={era.id}>
              <h3>
                {/* Its own page (IA-25), as prerender.js links it. */}
                <Link to={eraPath(era)}>{era.era_name}</Link>
                <span className="years">{span(era.from_year, era.to_year)}</span>
                {eraTiers.length > 1 && <Confidence value={era.confidence} />}
              </h3>
              <p>{era.summary}</p>
              {ERA_LINES.map(
                ([key, label]) =>
                  era[key] && (
                    <p key={key} className="faint small">
                      <strong>{label}</strong> {era[key]}
                    </p>
                  ),
              )}
            </article>
          ))}
        </div>
      </Section>

      <Section title="Engine formulae" count={`${engines.length}`}>
        <EngineTable rows={engines} />
      </Section>

      <Section
        title="Scoring systems"
        count={`${points.length}`}
        note={POINTS_NOTE}
      >
        <DataTable unfolded={UNFOLDED.reference} rows={points} rowKey={(row) => row.id} sortable={false} columns={POINTS_COLUMNS} />
      </Section>

      <Section title="Regulation changes" count={`${regulations.length}`}>
        <div className="filters">
          <Chips
            label="Filter regulation changes by category"
            value={category}
            onChange={(value) => set({ category: value })}
            options={chips}
          />
        </div>
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={shownRegulations}
          rowKey={(row) => row.id}
          sort="year"
          direction="desc"
          page={80}
          columns={REGULATION_COLUMNS}
        />
      </Section>

      <Section
        title="Regulation limits"
        count={`${limits.length}`}
        note={LIMITS_NOTE}
      >
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={limits}
          rowKey={(row) => `${row.field}-${row.from_year}`}
          sortable
          sort="from_year"
          direction="desc"
          columns={LIMIT_COLUMNS}
        />
      </Section>

      <Section title="Technical innovations" count={`${innovations.length}`}>
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={innovations}
          rowKey={(row) => row.id}
          sort="year"
          direction="asc"
          page={60}
          columns={INNOVATION_COLUMNS}
        />
      </Section>

      <Section title="Safety" count={`${safety.length}`}>
        <SafetyTimeline milestones={safety} />
      </Section>

      <Section title="Governance" count={`${governance.length}`}>
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={governance}
          rowKey={(row) => row.id}
          sort="year"
          direction="asc"
          page={40}
          columns={GOVERNANCE_COLUMNS}
        />
      </Section>

      <Section title="Tyre suppliers" count={`${tyres.length}`}>
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={tyres}
          rowKey={(row) => row.id}
          sort="from_year"
          direction="asc"
          columns={TYRE_COLUMNS}
        />
      </Section>

      <Onward {...ONWARD.eras()} />
    </>
  )
}
