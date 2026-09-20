import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import {
  CHANGES_LEDE,
  CHANGES_TITLE,
  CURRENT_HEADING,
  CURRENT_NOTE,
  FEED_FILE,
  FEED_HEADING,
  FEED_LINK_TEXT,
  FEED_NOTE,
  HISTORY_HEADING,
  HISTORY_NOTE,
  RELEASES,
  RELEASE_COLUMNS,
} from '../lib/changes.js'
import { LATEST, SHAPE } from '../queries/changes.js'

/*
 * What changed (SD-20).
 *
 * The app's half of the page scripts/prerender.js writes. Both read the same
 * figures out of queries/changes.js and the same words and the same release
 * record out of lib/changes.js, so the page a crawler is served and the page a
 * reader ends up looking at cannot say different things.
 *
 * The feed itself is a build artefact — prerender writes dist/feed.xml — so
 * this page links to it rather than rendering it. The link is a plain <a> and
 * not a <Link>: it is a file beside the app, not a route the router knows.
 */
const SPEC = {
  shape: [SHAPE],
  latest: [LATEST],
  meta: ['SELECT key, value FROM meta'],
}

/** A figure, or the em dash that means nobody established it — never a zero. */
const n = (value) => (value === null || value === undefined ? '—' : value.toLocaleString())

function Current({ data }) {
  const shape = rows(data, 'shape')[0] ?? null
  const latest = rows(data, 'latest')[0] ?? null
  // The version and the build date come from the database's own meta table, as
  // the footer's and the data page's do, so this page can never describe a
  // build other than the one it is running on.
  const meta = Object.fromEntries(rows(data, 'meta').map((r) => [r.key, r.value]))

  return (
    <>
      <dl className="facts">
        <dt>Version</dt>
        <dd>{meta.version ? `v${meta.version}` : '—'}</dd>
        <dt>Built</dt>
        <dd>{meta.built ?? '—'}</dd>
        <dt>Races</dt>
        <dd>{shape ? `${n(shape.races_run)} run, of ${n(shape.races)} on the calendar` : '—'}</dd>
        <dt>Most recent</dt>
        <dd>
          {latest ? (
            <>
              <Link to={`/races/${latest.year}/${latest.round}`}>{latest.name_used}</Link>,{' '}
              {latest.date_iso}
            </>
          ) : (
            '—'
          )}
        </dd>
        <dt>Race entries</dt>
        <dd>{n(shape?.entries)}</dd>
        <dt>Qualifying rows</dt>
        <dd>{n(shape?.qualifying)}</dd>
        <dt>Drivers</dt>
        <dd>{n(shape?.drivers)}</dd>
        <dt>Constructors</dt>
        <dd>{n(shape?.constructors)}</dd>
        <dt>Open disagreements</dt>
        <dd>
          <Link to="/data/quality">{`${n(shape?.open_discrepancies)} recorded, not resolved`}</Link>
        </dd>
        <dt>Known gaps</dt>
        <dd>
          <Link to="/data/quality">{`${n(shape?.open_gaps)} stated`}</Link>
        </dd>
      </dl>
      <p className="faint">{CURRENT_NOTE}</p>
    </>
  )
}

export default function Changes() {
  const state = useQueries(SPEC)
  // The most recent race is the one route out of here that depends on the
  // data, so it is read at this level rather than only inside Current. It is
  // dropped from the list until the query has answered, which is what Onward's
  // own filter is for.
  const latest = rows(state.data, 'latest')[0] ?? null

  return (
    <Page title={CHANGES_TITLE} lede={CHANGES_LEDE}>
      <Section title={CURRENT_HEADING}>
        <Result state={state}>{(data) => <Current data={data} />}</Result>
      </Section>

      <Section title={FEED_HEADING}>
        <p>
          {FEED_NOTE} <a href={`${import.meta.env.BASE_URL}${FEED_FILE}`}>{FEED_LINK_TEXT}</a>.
        </p>
      </Section>

      <Section title={HISTORY_HEADING}>
        <DataTable columns={RELEASE_COLUMNS} rows={RELEASES} />
        <p className="faint">{HISTORY_NOTE}</p>
      </Section>

      <Onward
        items={[
          latest && {
            to: `/races/${latest.year}/${latest.round}`,
            label: latest.name_used,
            hint: 'The most recent race this database holds the classification of.',
          },
          {
            to: '/data/quality',
            label: 'Data quality',
            hint: 'The disagreements and the gaps counted above, one by one.',
          },
          {
            to: '/data',
            label: 'Data',
            hint: 'The whole database as one file, and how to query it.',
          },
        ]}
      />
    </Page>
  )
}
