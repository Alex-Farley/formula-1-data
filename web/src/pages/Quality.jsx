import { Link } from 'react-router-dom'
import { Confidence, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import SubNav from '../components/SubNav.jsx'
import Figure from '../charts/Figure.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number, percent } from '../lib/format.js'

import {
  AMBIGUOUS,
  AMBIGUOUS_COLUMNS,
  AMBIGUOUS_NOTE,
  CHASSIS_COVERAGE,
  CONFIDENCE_MIX,
  DISCREPANCIES,
  DISCREPANCIES_NOTE,
  DISCREPANCY_COLUMNS,
  GAPS,
  GEOMETRY_COLUMNS,
  GEOMETRY_COVERAGE,
  GEOMETRY_FOOTER,
  IMAGES,
  LADDER,
  LADDER_NOTE,
  PROVENANCE,
  PROVENANCE_COLUMNS,
  RECONCILIATION,
  RECONCILIATION_COLUMNS,
  RECONCILIATION_NOTE,
  UNVERIFIED,
  UNVERIFIED_COLUMNS,
  UNVERIFIED_FOOTER,
  disagrees,
} from '../queries/quality.js'

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
const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

export default function Quality() {
  const state = useQueries(SPEC)

  return (
    <Page
      title="Data quality"
      lede="How far to trust anything on this site. Every row carries a confidence level, every disagreement between sources is kept rather than quietly resolved, and everything known to be missing is listed here."
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
        rows={list}
        rowKey={(row) => row.id}
        sortable={false}
        page={20}
        columns={[
          { key: 'field', label: 'Field' },
          { key: 'area', label: 'Area', align: 'prose' },
          {
            key: 'reader',
            label: 'What is missing, and why',
            align: 'prose',
            render: (value, row) => (
              <>
                <p className="gap-reader">{value}</p>
                <details className="gap-note">
                  <summary>Maintainer’s note</summary>
                  <p>{row.description}</p>
                  {row.resolution && <p>{row.resolution}</p>}
                </details>
              </>
            ),
          },
        ]}
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

  const total = mix.reduce((sum, row) => sum + row.n, 0)
  const ordered = LADDER.map((name) => ({
    key: name,
    value: mix.find((row) => row.confidence === name)?.n ?? 0,
    label: name,
  }))

  const disagreeing = reconciliation.filter(disagrees)

  return (
    <>
      <Section title="The confidence ladder">
        <DataTable
          rows={provenance}
          rowKey={(row) => row.confidence}
          sortable={false}
          columns={withRenders(PROVENANCE_COLUMNS, PROVENANCE_APP)}
        />
        <p className="source-note">{LADDER_NOTE}</p>
      </Section>

      <Section title="How the database is distributed across it">
        <Figure
          title="Rows by confidence"
          note="Across races, race entries, drivers, constructors, chassis, circuits and seasons. Most of it sits at “reference” because most of it is the F1DB race record, which a second source can check."
          table={{
            rows: ordered.map((row) => ({
              confidence: row.key,
              rows: row.value,
              share: percent(row.value, total),
            })),
            columns: [
              { key: 'confidence', label: 'Confidence' },
              { key: 'rows', label: 'Rows', align: 'num' },
              { key: 'share', label: 'Share', align: 'num' },
            ],
          }}
        >
          <ColumnChart
            data={ordered}
            height={190}
            label="Number of rows at each level of the confidence ladder"
          />
        </Figure>
      </Section>

      <Gaps
        rows={gaps.filter((row) => row.state === 'open')}
        title="Open gaps"
        note="What is missing, and what it would take to close each one. Several need a person to read something rather than a script to fetch it."
      />

      <Gaps
        rows={gaps.filter((row) => row.state === 'position')}
        title="Positions, not gaps"
        note="Deliberate absences. Each is the right state for this database, stated so it is not mistaken for something unfinished."
      />

      <Gaps
        rows={gaps.filter((row) => row.state === 'closed')}
        title="Closed"
        note="Gaps that have since been filled, kept so the closure is on record."
      />

      <Section
        title="Disagreements kept rather than resolved"
        count={`${discrepancies.length}`}
        note={DISCREPANCIES_NOTE}
      >
        {/* No opening sort: the query orders by subject, case-insensitively,
            and the static page prints the rows as they come. */}
        <DataTable rows={discrepancies} rowKey={(row) => row.id} sortable page={60} columns={DISCREPANCY_COLUMNS} />
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
          <Figure
            title="Race entries that name a chassis, by decade"
            note="A modern team runs one car all season; a 1960s constructor was a name several privateers entered several different designs under. That, not a harvest failure, is why the older decades are thinner."
            table={{
              rows: chassisCoverage,
              columns: [
                { key: 'decade', label: 'Decade', align: 'num' },
                { key: 'race_entries', label: 'Entries', align: 'num' },
                { key: 'with_chassis', label: 'With a chassis', align: 'num' },
                { key: 'pct', label: '%', align: 'num' },
              ],
            }}
          >
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

          <div>
            <Section title="Circuit geometry">
              <DataTable
                rows={geometryCoverage}
                rowKey={(row) => row.status}
                sortable={false}
                columns={GEOMETRY_COLUMNS}
                footer={GEOMETRY_FOOTER}
              />
            </Section>

            <Section title="Photographs">
              <Stats
                items={[
                  { label: 'Referenced', value: number(images.total) },
                  { label: 'File names the subject', value: number(images.named) },
                  { label: 'Needs a person', value: number(images.unnamed) },
                  { label: 'Distinct licences', value: number(images.licences) },
                ]}
              />
              <p className="source-note">
                A photograph whose file name does not name the car is not necessarily the wrong
                photograph — most are filed under the driver. But nothing in the database can tell
                which are not, and one article leads with a picture of police officers, so all of
                them are held at unverified until someone looks.
              </p>
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
          rows={unverified}
          rowKey={(row) => row.tbl}
          sortable
          sort="n"
          direction="desc"
          columns={UNVERIFIED_COLUMNS}
          footer={UNVERIFIED_FOOTER}
        />
      </Section>

      <Onward
        items={[
          { to: '/data/sources', label: 'Sources and licences', hint: 'Who says so, and what you may reuse.' },
          { to: '/data/sql', label: 'SQL console', hint: 'Interrogate any of this yourself.' },
          { to: '/records', label: 'Records', hint: 'The figures these checks are protecting.' },
        ]}
      />
    </>
  )
}
