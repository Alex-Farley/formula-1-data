import { Link } from 'react-router-dom'
import { Confidence, FigurePart, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { UNFOLDED } from '../lib/table.js'
import { Dated } from '../components/Dates.jsx'
import SubNav from '../components/SubNav.jsx'
import Figure from '../charts/Figure.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number } from '../lib/format.js'

import {
  AMBIGUOUS,
  AMBIGUOUS_COLUMNS,
  AMBIGUOUS_NOTE,
  CHASSIS_COVERAGE_COLUMNS,
  CHASSIS_COVERAGE,
  CHASSIS_NOTE,
  CHASSIS_TITLE,
  CONFIDENCE_MIX,
  DISCREPANCIES,
  DISCREPANCIES_NOTE,
  DISCREPANCY_COLUMNS,
  DISTRIBUTION_COLUMNS,
  DISTRIBUTION_NOTE,
  DISTRIBUTION_TITLE,
  GAPS,
  GAP_COLUMNS,
  GAP_GROUPS,
  GEOMETRY_COLUMNS,
  GEOMETRY_COVERAGE,
  GEOMETRY_FOOTER,
  IMAGES,
  LADDER_NOTE,
  MAINTAINER_NOTE,
  PHOTOGRAPHS_UNNAMED_NOTE,
  PHOTOGRAPH_STATS,
  PROVENANCE,
  PROVENANCE_COLUMNS,
  RECONCILIATION,
  RECONCILIATION_COLUMNS,
  RECONCILIATION_NOTE,
  UNVERIFIED,
  UNVERIFIED_COLUMNS,
  UNVERIFIED_FOOTER,
  disagrees,
  distribution,
  photographsCatalogued,
  QUALITY_LEDE,
} from '../queries/quality.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import { NAMES } from '../lib/site.js'
const SPEC = {
  provenance: [PROVENANCE],
  gaps: [GAPS],
  discrepancies: [DISCREPANCIES],
  reconciliation: [RECONCILIATION],
  unverified: [UNVERIFIED],
  ambiguous: [AMBIGUOUS],
  chassisCoverage: [CHASSIS_COVERAGE],
  geometryCoverage: [GEOMETRY_COVERAGE],
  images: [IMAGES],
  confidenceMix: [CONFIDENCE_MIX],
}

/*
 * The React renders for the columns queries/quality.js defines — the
 * confidence pill and the season link. The words each cell carries are the
 * column's own `text`, which scripts/prerender.js prints too.
 */
const pill = { render: (value) => <Confidence value={value} plain /> }
const PROVENANCE_APP = { confidence: pill }
const RECONCILIATION_APP = { confidence: pill }
const AMBIGUOUS_APP = { year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> } }
const GAP_APP = {
  reader: {
    render: (value, row) => (
      <>
        <p className="gap-reader">
          <Dated>{value}</Dated>
        </p>
        <details className="gap-note">
          {/* Named for its row as well, for a screen reader's list of
              controls, where twenty notes read alike out of context (DP-30). */}
          <summary>
            {MAINTAINER_NOTE}
            <span className="sr-only">, {row.area}</span>
          </summary>
          <p>
            <Dated>{row.description}</Dated>
          </p>
          {row.resolution && (
            <p>
              <Dated>{row.resolution}</Dated>
            </p>
          )}
        </details>
      </>
    ),
  },
}
const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

export default function Quality() {
  const state = useQueries(SPEC)

  return (
    <Page
      title={NAMES.quality().headline}
      documentName={NAMES.quality().title}
      trail={TRAIL.quality()}
      lede={QUALITY_LEDE}
    >
      <SubNav />
      <Result state={state}>{(data) => <Body data={data} />}</Result>
    </Page>
  )
}

/**
 * One group of the register. The reader's sentence is the row; the
 * maintainer's note - the description and resolution the row has always
 * carried - is behind a disclosure, kept whole and never dropped. The
 * homepage counts only the open group, through the same v_open_gaps view.
 */
function Gaps({ rows: list, title, note }) {
  if (!list.length) return null
  return (
    <Section title={title} count={`${list.length}`} note={note}>
      <DataTable
        unfolded={UNFOLDED.reference}
        rows={list}
        rowKey={(row) => row.id}
        sortable={false}
        page={20}
        columns={withRenders(GAP_COLUMNS, GAP_APP)}
      />
    </Section>
  )
}

function Body({ data }) {
  const provenance = rows(data, 'provenance')
  const gaps = rows(data, 'gaps')
  const discrepancies = rows(data, 'discrepancies')
  const reconciliation = rows(data, 'reconciliation')
  const unverified = rows(data, 'unverified')
  const ambiguous = rows(data, 'ambiguous')
  const chassisCoverage = rows(data, 'chassisCoverage')
  const geometryCoverage = rows(data, 'geometryCoverage')
  const images = data.images.rows[0] ?? {}
  const mix = rows(data, 'confidenceMix')

  // The figure's rows, which the static page prints as its table (VD-87).
  const ladder = distribution(mix)

  const disagreeing = reconciliation.filter(disagrees)

  return (
    <>
      <Section title="The confidence ladder">
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={provenance}
          rowKey={(row) => row.confidence}
          sortable={false}
          columns={withRenders(PROVENANCE_COLUMNS, PROVENANCE_APP)}
          footer={LADDER_NOTE}
        />
      </Section>

      <Section title={DISTRIBUTION_TITLE}>
        <Figure note={DISTRIBUTION_NOTE} table={{ rows: ladder, columns: DISTRIBUTION_COLUMNS }}>
          <ColumnChart
            data={ladder.map((row) => ({ key: row.confidence, value: row.rows, label: row.confidence }))}
            height={190}
            label="Number of rows at each level of the confidence ladder"
          />
        </Figure>
      </Section>

      {GAP_GROUPS.map(({ state, title, note }) => (
        <Gaps key={state} rows={gaps.filter((row) => row.state === state)} title={title} note={note} />
      ))}

      <Section
        title="Disagreements kept rather than resolved"
        count={`${discrepancies.length}`}
        note={DISCREPANCIES_NOTE}
      >
        {/* No opening sort: the query orders by subject, case-insensitively,
            and the static page prints the rows as they come. The header says
            so without re-sorting them (CR-28). */}
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={discrepancies}
          rowKey={(row) => row.id}
          sortable
          opening={{ key: 'subject', direction: 'asc' }}
          page={60}
          columns={DISCREPANCY_COLUMNS}
        />
      </Section>

      <Section
        title="Career totals against published ones"
        count={`${reconciliation.length} drivers`}
        note={RECONCILIATION_NOTE}
      >
        {disagreeing.length > 0 && (
          <Note>
            <strong>
              {disagreeing.length} of {reconciliation.length} drivers do not reconcile exactly.
            </strong>{' '}
            A fastest lap is the usual culprit: where two drivers set the same time, some sources
            credit both and some credit one.
          </Note>
        )}
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={reconciliation}
          rowKey={(row) => row.full_name}
          sortable
          sort="derived_wins"
          direction="desc"
          page={60}
          highlight={disagrees}
          columns={withRenders(RECONCILIATION_COLUMNS, RECONCILIATION_APP)}
        />
      </Section>

      <Section title="Coverage">
        <div className="split">
          <FigurePart title={CHASSIS_TITLE}>
          <Figure note={CHASSIS_NOTE} table={{ rows: chassisCoverage, columns: CHASSIS_COVERAGE_COLUMNS }}>
            <ColumnChart
              data={chassisCoverage.map((row) => ({
                key: row.decade,
                value: row.pct,
                label: `${row.decade}s`,
              }))}
              format={(v) => `${v}%`}
              height={200}
              label="Percentage of race entries naming a chassis, by decade"
            />
          </Figure>
          </FigurePart>

          <div>
            <Section title="Circuit geometry">
              <DataTable
                unfolded={UNFOLDED.reference}
                rows={geometryCoverage}
                rowKey={(row) => row.status}
                sortable={false}
                columns={GEOMETRY_COLUMNS}
                footer={GEOMETRY_FOOTER}
              />
            </Section>

            <Section title="Photographs">
              <Stats
                items={PHOTOGRAPH_STATS.map(({ key, label }) => ({ label, value: number(images[key]) }))}
              />
              <p className="source-note">{PHOTOGRAPHS_UNNAMED_NOTE}</p>
              <p className="source-note">{photographsCatalogued(number(images.catalogued))}</p>
            </Section>
          </div>
        </div>
      </Section>

      <Section
        title="Where a result cannot be attributed to a car"
        count={`${ambiguous.length} constructor-seasons`}
        note={AMBIGUOUS_NOTE}
      >
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={ambiguous}
          rowKey={(row) => `${row.year}-${row.constructor}`}
          sortable
          sort="unlinked_entries"
          direction="desc"
          page={40}
          columns={withRenders(AMBIGUOUS_COLUMNS, AMBIGUOUS_APP)}
        />
      </Section>

      <Section title="Rows nobody has checked" count={`${unverified.reduce((n, r) => n + r.n, 0)}`}>
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={unverified}
          rowKey={(row) => row.tbl}
          sortable
          sort="n"
          direction="desc"
          columns={UNVERIFIED_COLUMNS}
          footer={UNVERIFIED_FOOTER}
        />
      </Section>

      <Onward {...ONWARD.quality()} />
    </>
  )
}
