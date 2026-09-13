import { Link } from 'react-router-dom'
import { Confidence, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import SubNav from '../components/SubNav.jsx'
import Figure from '../charts/Figure.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number, percent } from '../lib/format.js'

const SPEC = {
  provenance: ['SELECT * FROM provenance ORDER BY rank'],
  gaps: ['SELECT * FROM known_gaps ORDER BY id'],
  discrepancies: ['SELECT * FROM discrepancies ORDER BY id'],
  reconciliation: ['SELECT * FROM v_stat_reconciliation'],
  unverified: ['SELECT tbl, COUNT(*) AS n FROM v_unverified GROUP BY tbl ORDER BY n DESC'],
  ambiguous: ['SELECT * FROM v_ambiguous_seasons ORDER BY unlinked_entries DESC'],
  chassisCoverage: ['SELECT * FROM v_chassis_coverage ORDER BY decade'],
  geometryCoverage: ['SELECT * FROM v_geometry_coverage'],
  images: [
    `SELECT COUNT(*) AS total,
            SUM(name_matches = 1) AS named,
            SUM(name_matches = 0) AS unnamed,
            COUNT(DISTINCT licence) AS licences
       FROM article_images`,
  ],
  confidenceMix: [
    `SELECT confidence, COUNT(*) AS n FROM (
        SELECT confidence FROM races
        UNION ALL SELECT confidence FROM race_entries
        UNION ALL SELECT confidence FROM drivers
        UNION ALL SELECT confidence FROM constructors
        UNION ALL SELECT confidence FROM chassis
        UNION ALL SELECT confidence FROM circuits
        UNION ALL SELECT confidence FROM seasons
     ) WHERE confidence IS NOT NULL
     GROUP BY confidence`,
  ],
}

const LADDER = ['verified', 'high', 'reference', 'medium', 'unverified']

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

  const disagreeing = reconciliation.filter(
    (row) =>
      (row.wins_external !== null && row.derived_wins !== row.wins_external) ||
      (row.poles_external !== null && row.derived_poles !== row.poles_external) ||
      (row.fastest_laps_external !== null && row.derived_fl !== row.fastest_laps_external),
  )

  return (
    <>
      <Section title="The confidence ladder">
        <DataTable
          rows={provenance}
          rowKey={(row) => row.confidence}
          sortable={false}
          columns={[
            { key: 'rank', label: 'Rank', align: 'num' },
            {
              key: 'confidence',
              label: 'Level',
              render: (value) => <Confidence value={value} plain />,
            },
            { key: 'definition', label: 'What it means', align: 'prose' },
            {
              key: 'may_publish',
              label: 'Safe to quote',
              align: 'num',
              render: (value) => (value ? 'yes' : 'not without checking'),
            },
          ]}
        />
        <p className="source-note">
          Only an official source — the FIA or formula1.com — carries a row to “verified”. Wikipedia
          and F1DB reach “reference”, which is not a criticism of either: it means something else
          would have to check them.
        </p>
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
        note="Where two sources differ and neither can be checked officially, the difference is recorded instead of one being picked quietly. Several of these are a regulation minimum masquerading as a car's measured weight — the check that caught them is why those figures are now blank rather than wrong."
      >
        <DataTable
          rows={discrepancies}
          rowKey={(row) => row.id}
          sortable
          sort="subject"
          page={60}
          columns={[
            { key: 'subject', label: 'Subject' },
            { key: 'field', label: 'Field' },
            { key: 'stored_value', label: 'Recorded', align: 'num' },
            { key: 'derived_value', label: 'Derived', align: 'num' },
            { key: 'assessment', label: 'Assessment', align: 'prose' },
            { key: 'status', label: 'Status' },
          ]}
        />
      </Section>

      <Section
        title="Career totals against published ones"
        count={`${reconciliation.length} drivers`}
        note="Wins, poles and fastest laps are derived from the race records and then compared with the figures published elsewhere. This comparison is what caught a wrong pole count in an official source; it runs on every build."
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
          highlight={(row) =>
            (row.wins_external !== null && row.derived_wins !== row.wins_external) ||
            (row.poles_external !== null && row.derived_poles !== row.poles_external) ||
            (row.fastest_laps_external !== null && row.derived_fl !== row.fastest_laps_external)
          }
          columns={[
            { key: 'full_name', label: 'Driver' },
            { key: 'derived_wins', label: 'Wins derived', align: 'num' },
            { key: 'wins_external', label: 'Wins published', align: 'num' },
            { key: 'derived_poles', label: 'Poles derived', align: 'num' },
            { key: 'poles_external', label: 'Poles published', align: 'num' },
            { key: 'derived_fl', label: 'FL derived', align: 'num' },
            { key: 'fastest_laps_external', label: 'FL published', align: 'num' },
            { key: 'confidence', label: 'Confidence', render: (v) => <Confidence value={v} plain /> },
          ]}
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
                columns={[
                  { key: 'status', label: 'Status' },
                  { key: 'circuits', label: 'Circuits', align: 'num' },
                  { key: 'traced', label: 'Traced', align: 'num' },
                  { key: 'pct', label: '%', align: 'num' },
                ]}
                footer="Historic geometry has no source at all: OpenStreetMap maps what is on the ground, and Spa's 14.1 km road course is not on the ground any more."
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
        note="A constructor that ran more than one design in a season, where no source in use here says which car raced which round. Attributing a win to one of them would be a guess, so the chassis is left blank."
      >
        <DataTable
          rows={ambiguous}
          rowKey={(row) => `${row.year}-${row.constructor}`}
          sortable
          sort="unlinked_entries"
          direction="desc"
          page={40}
          columns={[
            {
              key: 'year',
              label: 'Season',
              align: 'num',
              render: (year) => <Link to={`/seasons/${year}`}>{year}</Link>,
            },
            { key: 'constructor', label: 'Constructor' },
            { key: 'chassis', label: 'Designs entered', align: 'prose' },
            { key: 'unlinked_entries', label: 'Entries left unattributed', align: 'num' },
          ]}
        />
      </Section>

      <Section title="Rows nobody has checked" count={`${unverified.reduce((n, r) => n + r.n, 0)}`}>
        <DataTable
          rows={unverified}
          rowKey={(row) => row.tbl}
          sortable
          sort="n"
          direction="desc"
          columns={[
            { key: 'tbl', label: 'Table' },
            { key: 'n', label: 'Rows at medium or unverified', align: 'num' },
          ]}
          footer="These are not errors — they are rows nobody has yet been able to raise above medium confidence."
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
