import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Onward, Page, Section } from '../components/Page.jsx'
import Outline from '../components/Outline.jsx'
import { Result } from '../components/States.jsx'
import { DateText, Dated } from '../components/Dates.jsx'
import SearchKey from '../components/SearchKey.jsx'
import { missing, number } from '../lib/format.js'
import { LABELS, NAMES } from '../lib/site.js'
import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import {
  DERIVATION,
  DERIVATION_ID,
  LONGEST_RUNS,
  RECORD,
  holderPath,
  recordLead,
  recordRacesNote,
  streakRaces,
  streakRuns,
  stripRound,
} from '../queries/records.js'
import { roundShortName } from '../lib/outline.js'
import { useQueries } from '../data/useQuery.js'

/**
 * One record, at an address of its own (PD-27).
 *
 * A record was a row in a table and nothing else: a reader citing "the most
 * Grand Prix wins" could cite /records and hope the row was still where they
 * left it. The page is the row, and nothing more - the figure, whose it is,
 * how it is derived and as of when - because the row is the citation, and the
 * citation block every page carries names this address. The address is the
 * record's key, never its id, which moves (DA-26).
 *
 * It opens on the record (VD-112): the number large with the words that give
 * it meaning, and, for a record that is a run of races, the races and the
 * longest runs there have been, counted here under the record's own rule.
 *
 * scripts/prerender.js writes the same page for every key the database holds,
 * from the same queries.
 */
export default function Record() {
  const { key } = useParams()
  const runs = streakRuns(key)
  const state = useQueries({
    record: [RECORD, [key]],
    runs: runs ? [runs] : null,
    races: runs ? [streakRaces(key)] : null,
  })

  return (
    <Result state={state} context="That record could not be read">
      {(data) => {
        const record = data.record.rows[0]
        if (!record) {
          return (
            <Page title="No such record" cite={false} trail={TRAIL.missing('/records', 'Records')}>
              <p className="muted">No record in the database has the key “{key}”.</p>
              <p>
                Press <SearchKey /> to search by name, or <Link to="/records">see every record</Link>.
              </p>
            </Page>
          )
        }
        return <RecordBody record={record} lead={recordLead(record, data.runs?.rows, data.races?.rows)} />
      }}
    </Result>
  )
}

/** A run of parts, { text } or { text, href }, as recordLead() gives a line. */
function Parts({ parts }) {
  return parts.map((part, i) =>
    part.href ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: a line's parts are fixed in order
      <Link key={i} to={`/${part.href}`}>
        {part.text}
      </Link>
    ) : (
      part.text
    ),
  )
}

function RecordBody({ record, lead }) {
  const holder = holderPath(record)
  return (
    <Page title={NAMES.record(record.record).headline} trail={TRAIL.record(record.key, record.record)}>
      <Section>
        {/* queries/records.js's recordLead(), which the static page draws too. */}
        <div className="record-lead">
          {lead.figure ? <b className="record-lead-figure">{lead.figure}</b> : <b className="record-lead-whole">{lead.whole}</b>}
          <div className="record-lead-words">
            {lead.lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the lines are fixed in order
              <p key={i}>
                <Parts parts={line} />
              </p>
            ))}
          </div>
        </div>
        {lead.runs?.top.map((run, i) => (
          <ol key={`${run.holder_id}-${run.first_n}`} className="outline-strip record-races" aria-label={run.label}>
            {run.races.map((race) => (
              <li key={`${race.year}-${race.round}`}>
                <Link to={`/races/${race.year}/${race.round}`}>
                  {race.outline ? <Outline path={race.outline} decorative /> : <span className="outline outline-none" aria-hidden="true" />}
                  <b>{stripRound(race, lead.runs.spansSeasons[i])}</b>
                  <span>{roundShortName(race.name_used)}</span>
                </Link>
              </li>
            ))}
          </ol>
        ))}
        {lead.runs?.top.some((run) => run.races.some((race) => race.outline)) && (
          <p className="faint outline-strip-note">{recordRacesNote}</p>
        )}
      </Section>

      {lead.runs && (
        <Section title={LONGEST_RUNS}>
          <ol className="record-runs">
            {lead.runs.longest.map((run) => (
              <li key={run.key} className={run.mark ? 'is-holder' : undefined}>
                <span className="record-run-who">
                  <Link to={`/${run.href}`}>{run.holder}</Link> <small>{run.years}</small>
                </span>
                <span className="record-run-bar">
                  <i style={{ '--share': run.share }} aria-hidden="true" />
                  {run.figure} <small>{run.ends}</small>
                </span>
              </li>
            ))}
          </ol>
          <p className="faint record-runs-note">
            {lead.runs.rule}{' '}
            <a href={`#${DERIVATION_ID}`}>{DERIVATION}</a>.
          </p>
        </Section>
      )}

      <Section title={DERIVATION} id={DERIVATION_ID}>
        <p className="measure">
          <Dated>{record.detail}</Dated>
        </p>
      </Section>

      <Section title={LABELS.provenance}>
        <Fields
          items={[
            { label: 'As of', value: missing(record.as_of) ? null : <DateText iso={record.as_of} /> },
            { label: 'Confidence', value: <Confidence value={record.confidence} /> },
            { label: 'Category', value: record.category },
            // The section of /records it is listed under (WK-08).
            { label: 'Family', value: record.family },
            // The figure a query compares, which the value above is written
            // around: 6802 where the value reads "18 years, 228 days".
            { label: 'Comparable figure', value: number(record.value_num) },
            { label: 'Unit', value: record.unit },
            { label: 'Key', value: <code>{record.key}</code> },
          ]}
        />
      </Section>

      <Onward {...ONWARD.record({ record, holder })} />
    </Page>
  )
}
