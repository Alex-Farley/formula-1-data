import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import SearchKey from '../components/SearchKey.jsx'
import { number } from '../lib/format.js'
import { NAMES } from '../lib/site.js'
import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import { DERIVATION, RECORD, holderPath } from '../queries/records.js'
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
 * scripts/prerender.js writes the same page for every key the database holds,
 * from the same query.
 */
export default function Record() {
  const { key } = useParams()
  const state = useQueries({ record: [RECORD, [key]] })

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
        return <RecordBody record={record} />
      }}
    </Result>
  )
}

function RecordBody({ record }) {
  const holder = holderPath(record)
  return (
    <Page title={NAMES.record(record.record).headline} trail={TRAIL.record(record.key, record.record)}>
      <Section>
        <Stats
          items={[
            { label: 'Value', value: record.value, lead: true },
            { label: 'Holder', value: holder ? <Link to={`/${holder}`}>{record.holder}</Link> : record.holder },
          ]}
        />
      </Section>

      <Section title={DERIVATION}>
        <p className="measure">{record.detail}</p>
      </Section>

      <Section title="On the record">
        <Fields
          items={[
            { label: 'As of', value: record.as_of },
            { label: 'Confidence', value: <Confidence value={record.confidence} /> },
            { label: 'Category', value: record.category },
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
