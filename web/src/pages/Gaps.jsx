import { useQuery } from '../useQuery.js'
import { Page, Section } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'

// known_gaps, discrepancies and v_unverified are tables in the database, not
// prose in a README: what is missing is queryable alongside what is there.
const GAPS = `SELECT area, description, resolution FROM known_gaps ORDER BY id`

const DISCREPANCIES = `
SELECT subject, field, stored_value, derived_value, status, assessment
FROM discrepancies
ORDER BY CASE WHEN status LIKE 'open%' THEN 0 ELSE 1 END, id`

const UNVERIFIED = `
SELECT tbl AS "table", COUNT(*) AS rows_at_medium
FROM v_unverified
GROUP BY tbl
ORDER BY rows_at_medium DESC`

const RECONCILIATION = `
SELECT full_name, derived_wins, wins_external, derived_poles, poles_external,
       derived_fl, fastest_laps_external
FROM v_stat_reconciliation
WHERE derived_wins != wins_external
   OR derived_poles != poles_external
   OR derived_fl != fastest_laps_external
ORDER BY full_name`

export default function Gaps() {
  const gaps = useQuery(GAPS)
  const discrepancies = useQuery(DISCREPANCIES)
  const unverified = useQuery(UNVERIFIED)
  const reconciliation = useQuery(RECONCILIATION)

  return (
    <Page
      title="Gaps"
      lede="What this database does not hold, and where its sources disagree. A database that hides its gaps is worse than one that does not, so these are rows you can query rather than a paragraph you have to trust."
    >
      <Section
        title="Known gaps"
        note="Each one carries the method that would close it, not just the fact that it is open."
      >
        <Result state={gaps} what="Loading the gaps">
          {(data) => (
            <DataTable
              data={data}
              columns={['area', 'description', 'resolution']}
              labels={{ area: 'Missing', resolution: 'How it gets fixed' }}
            />
          )}
        </Result>
      </Section>

      <Section
        title="Where sources disagree"
        note="Career figures are derived from the race records. Where an externally published figure differs, the difference is itself recorded — resolved with the reasoning, or left open rather than quietly picked."
      >
        <Result state={discrepancies} what="Loading the discrepancies">
          {(data) => (
            <DataTable
              data={data}
              columns={['subject', 'field', 'stored_value', 'derived_value', 'status', 'assessment']}
              labels={{ stored_value: 'External', derived_value: 'Derived' }}
            />
          )}
        </Result>
      </Section>

      <Section
        title="Derived against external, today"
        note="Every remaining difference between the figures computed from the race records and the figures published elsewhere. Staleness in an external figure looks the same as an error here, which is why the reasoning above matters."
      >
        <Result state={reconciliation} what="Reconciling">
          {(data) => (
            <DataTable
              data={data}
              labels={{
                full_name: 'Driver',
                derived_fl: 'Derived FL',
                fastest_laps_external: 'External FL',
              }}
              empty="Every career figure reconciles exactly."
            />
          )}
        </Result>
      </Section>

      <Section
        title="Not yet officially verified"
        note="Rows sitting at medium confidence — correct in substance, but with a figure or date that has not been checked against an official source. This is the work queue; nothing is promoted to verified without fia.com or formula1.com."
      >
        <Result state={unverified} what="Counting">
          {(data) => <DataTable data={data} labels={{ rows_at_medium: 'Rows at medium' }} />}
        </Result>
      </Section>
    </Page>
  )
}
