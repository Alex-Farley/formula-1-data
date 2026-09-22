import { Link } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import SubNav from '../components/SubNav.jsx'
import { currentProgress } from '../data/client.js'
import { row, rows, useQueries } from '../data/useQuery.js'
import { number } from '../lib/format.js'
import { CROSS_CHECKED, DIGEST_NOTE, DOCUMENTS, DOCUMENTS_NOTE, NAMES, NOT_HELD, REPOSITORY, SELF_DESCRIBING, TWO_FILES } from '../lib/site.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
/**
 * The database's front door.
 *
 * Every other page here is about the sport. This one is about the file: what
 * it is, which files there are and why there are two, what else it is exported
 * as, how far to trust it, and under what terms it may be taken. It is also
 * the one crawlable surface that can carry the claim, because robots.txt
 * keeps crawlers off the files themselves — a 20 MB download helps nobody's
 * index.
 *
 * The version and build date are read from the database's own `meta` table,
 * as the footer's are, so this page can never describe a version other than
 * the one it is running on. The sizes and digests come from db-manifest.json,
 * which the loader fetched before it opened the file, for the same reason.
 */
const SPEC = {
  meta: ['SELECT key, value FROM meta'],
  shape: [
    `SELECT
       (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table') AS tables,
       (SELECT COUNT(*) FROM sqlite_master WHERE type = 'view')  AS views,
       (SELECT COUNT(*) FROM source_registry)                    AS sources,
       (SELECT COUNT(*) FROM discrepancies)                      AS discrepancies,
       (SELECT COUNT(*) FROM discrepancies WHERE status LIKE 'open%') AS open_discrepancies,
       (SELECT COUNT(*) FROM v_open_gaps)                        AS gaps,
       (SELECT COUNT(*) FROM races)                              AS races,
       (SELECT COUNT(*) FROM race_entries)                       AS entries,
       (SELECT COUNT(*) FROM laps) + (SELECT COUNT(*) FROM stints)
         + (SELECT COUNT(*) FROM race_timing)
         + (SELECT COUNT(*) FROM race_control_messages)          AS timing_rows`,
  ],
  classes: ['SELECT redistributable, COUNT(*) AS n FROM source_registry GROUP BY redistributable'],
  ladder: ['SELECT confidence FROM provenance ORDER BY rank'],
}

const mb = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : null)
const kb = (bytes) => (bytes ? `${(bytes / 1024).toFixed(0)} KB` : null)

/**
 * What each licence class means for a reader, in the order the build ranks
 * them. `SOURCE_LICENCE` in data/current.py classifies every source into one
 * of these three and the build refuses one it has not classified; verify.py
 * fails on any row citing a `no` source. There is no fourth class and no
 * default, which is why the three are written out rather than read.
 */
const CLASSES = [
  ['yes', 'Redistributable', 'Its rows may be passed on under the licence shown beside them.'],
  ['facts-only', 'Facts only', 'The facts are used; nothing is copied. FIA regulations are read for the limits they set, not reproduced.'],
  ['no', 'Not redistributable', 'On the register so the position is on record. No row may cite one, and the build refuses a database in which one does.'],
]

export default function Data() {
  const state = useQueries(SPEC)

  return (
    <Page
      title={NAMES.data().headline}
      documentName={NAMES.data().title}
      trail={TRAIL.data()}
      lede="The whole site is one SQLite file, and you can have it. What it is, the files it comes as, how far to trust it, and what you may do with it."
    >
      <SubNav />
      <Result state={state}>{(data) => <Body data={data} />}</Result>
    </Page>
  )
}

function Body({ data }) {
  const meta = Object.fromEntries(rows(data, 'meta').map((r) => [r.key, r.value]))
  const shape = row(data, 'shape') ?? {}
  const classes = Object.fromEntries(rows(data, 'classes').map((r) => [r.redistributable, r.n]))
  const ladder = rows(data, 'ladder').map((r) => r.confidence)
  const manifest = currentProgress().manifest
  const base = import.meta.env.BASE_URL

  return (
    <>
      <Section>
        <Stats
          items={[
            { label: 'Database', value: meta.version ? `v${meta.version}` : null, note: 'meta.version' },
            { label: 'Built', value: meta.built ?? null, note: 'meta.built' },
            { label: 'Covers', value: meta.coverage_seasons ?? null },
            { label: 'Tables', value: number(shape.tables), note: `and ${number(shape.views)} views` },
            { label: 'Races', value: number(shape.races), note: `${number(shape.entries)} race entries` },
          ]}
        />
        <p className="measure">{CROSS_CHECKED}</p>
        <p className="measure">
          The races, classifications, qualifying, standings and pit stops are F1DB&rsquo;s race
          record, normalised and cross-checked; the eras, regulations, glossary and registers are
          harvested from Wikipedia; the confidence tiers, the recorded disagreements and the gap
          register originate here. What is held, and what is not, is written into the file itself
          as <code>meta.coverage_note</code>.
        </p>
      </Section>

      <Section
        title="The files"
        note="Two databases distributed together, and a columnar copy of the first for anyone who would rather not open SQLite."
      >
        <div className="board">
          <a href={`${base}f1.db`}>
            <b>
              f1.db
              <span className="n">{mb(manifest?.bytes) ?? 'SQLite'}</span>
            </b>
            <p>
              The database, as built. {manifest?.gzipBytes ? `${mb(manifest.gzipBytes)} over the wire; ` : ''}
              open it with any SQLite client. <code>circuit_geometry</code> in it is deliberately
              empty.
            </p>
          </a>
          <a href={`${base}f1-geometry.db`}>
            <b>
              f1-geometry.db
              <span className="n">{kb(manifest?.geometry?.bytes) ?? 'ODbL'}</span>
            </b>
            <p>
              The circuit centrelines, © OpenStreetMap contributors under ODbL 1.0, in a file of
              their own. Take it beside <code>f1.db</code>.
            </p>
          </a>
          <a href={`${base}f1-parquet.zip`}>
            <b>
              f1-parquet.zip
              <span className="n">Parquet</span>
            </b>
            <p>
              Every table as Parquet, one file each. Columnar and compressed: pandas, polars and
              DuckDB read it directly. Rebuilt from this database on every deploy.
            </p>
          </a>
        </div>
        <p className="measure" style={{ marginTop: 18 }}>
          {TWO_FILES}
        </p>
        <p className="measure">{SELF_DESCRIBING}</p>
        <p className="measure faint">
          Two JSON exports — <code>f1_database.json.gz</code>, every table, and{' '}
          <code>f1_compat.json</code>, the original v1 key layout — are written by the same build
          and travel with each release rather than being served from here. The Parquet bundle
          carries the two tables the JSON export leaves out for size.
        </p>
        {manifest?.digest && (
          <Fields
            items={[
              { label: 'f1.db digest', value: <code>{manifest.digest}</code> },
              manifest.geometry?.digest && {
                label: 'f1-geometry.db digest',
                value: <code>{manifest.geometry.digest}</code>,
              },
            ]}
          />
        )}
        {manifest?.digest && (
          <p className="source-note">
            {DIGEST_NOTE.split('SHA256SUMS')[0]}
            <a href={`${base}SHA256SUMS`}>
              <code>SHA256SUMS</code>
            </a>
            {DIGEST_NOTE.split('SHA256SUMS')[1]}
          </p>
        )}
      </Section>

      <Section
        title="What explains it"
        note="The schema, the attribution and the terms, served from here beside the files they describe."
      >
        <div className="board">
          {DOCUMENTS.map(([file, what]) => (
            <a key={file} href={`${base}${file}`}>
              <b>
                {file}
                <span className="n">{file.endsWith('.sql') ? 'SQL' : 'Text'}</span>
              </b>
              <p>{what}</p>
            </a>
          ))}
        </div>
        <p className="measure" style={{ marginTop: 18 }}>
          {DOCUMENTS_NOTE} <a href={REPOSITORY}>The repository</a> holds the build, the checks that
          gate it and the source data they read, so the cross-checking claimed above can be read
          rather than taken on trust.
        </p>
      </Section>

      <Section
        title="How far to trust it"
        note="Every row carries one of five confidence tiers; every disagreement between sources is kept rather than quietly resolved; everything known to be missing is listed."
      >
        <Stats
          items={[
            {
              label: 'Disagreements on record',
              value: number(shape.discrepancies),
              note: `${number(shape.open_discrepancies)} still open`,
            },
            { label: 'Open gaps', value: number(shape.gaps), note: 'and what would close each' },
            { label: 'Sources', value: number(shape.sources), note: 'each with its licence' },
          ]}
        />
        <p className="measure">
          The ladder, from the top:{' '}
          {ladder.map((tier, i) => (
            <span key={tier}>
              {i > 0 ? ' ' : ''}
              <Confidence value={tier} />
            </span>
          ))}
          . Only an official source — the FIA or formula1.com — carries a row to the top. Where a
          career total derived from the race records differs from a published one, both are
          shown. <Link to="/data/quality">The full account</Link>: the ladder defined, every gap,
          every disagreement, and the reconciliation that runs on each build.
        </p>
      </Section>

      <Section
        title="What you may do with it"
        note="A licence decided what is in this database, and what is not."
      >
        <Fields
          // A class no source falls into is a count of zero, not an unestablished
          // figure: GROUP BY simply has no row for it.
          items={CLASSES.map(([key, label, meaning]) => ({
            label,
            value: (
              <>
                <b>{number(classes[key] ?? 0)}</b> {classes[key] === 1 ? 'source' : 'sources'} — {meaning}
              </>
            ),
          }))}
        />
        <Note>
          <strong>What is not here.</strong> {NOT_HELD}{' '}
          {shape.timing_rows === 0
            ? 'This copy has all four empty, as the build requires.'
            : `This copy holds ${number(shape.timing_rows)} rows in those tables, loaded locally, and is not the file to publish.`}
        </Note>
        <p className="measure">
          Race data from F1DB is CC BY 4.0; prose and registers from Wikipedia are CC BY-SA 4.0
          and carry share-alike; the centrelines are ODbL and the obligation follows{' '}
          <code>f1-geometry.db</code> alone. What this project wrote itself — its reading of every
          disagreement and its account of every gap — is CC BY 4.0 and carries no share-alike;{' '}
          <code>meta.project_prose_columns</code> names those columns inside the database.{' '}
          <Link to="/data/sources">Every source</Link>, what it is trusted for, and what each
          licence cost or bought.
        </p>
      </Section>

      <Section title="Ask it something">
        <div className="board">
          <Link to="/data/sql">
            <b>
              SQL console
              <span className="n">
                {number(shape.tables)} tables · {number(shape.views)} views
              </span>
            </b>
            <p>
              Any read against the whole database, in this tab &mdash; and a query&rsquo;s
              address is a link to it.
            </p>
          </Link>
        </div>
        <p className="measure">
          Where a view exists, start from it. <code>standings</code> keeps a row after every
          round and more than one source&rsquo;s reading of each, so the obvious query over it
          answers with the season several times over. <code>v_standings_final</code> folds both
          away: the end-of-season rows, one source&rsquo;s reading of each entrant. What it does
          not fold is the constructors&rsquo; championship&rsquo;s own grain — Cooper-Climax and
          Cooper-Maserati are two 1960 entries and not one — so count that side on{' '}
          <code>entity_id</code> and <code>engine_id</code> together. The console&rsquo;s schema
          panel prints the commented schema of every table and view, which is where each column
          says what it means.
        </p>
      </Section>

      <Onward {...ONWARD.data()} />
    </>
  )
}
