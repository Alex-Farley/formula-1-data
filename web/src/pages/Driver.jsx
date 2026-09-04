import { Link, useParams } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Confidence, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import { cell, span } from '../format.js'

const DRIVER = `SELECT * FROM drivers WHERE id = ?`

// Every recorded entry for this driver. The database holds an entry per driver
// per race only where something happened worth recording - a win, a pole, a
// fastest lap - not the full finishing order, so this is their record of those
// three things and not a race-by-race career log.
const ENTRIES = `
SELECT r.year, r.round, COALESCE(r.name_used, g.name) AS gp, ci.name AS circuit,
       ci.id AS circuit_id, co.name AS constructor, co.id AS constructor_id,
       e.grid, e.finish_position, e.fastest_lap, e.shared_drive
FROM race_entries e
JOIN races r ON r.id = e.race_id
LEFT JOIN grands_prix g ON g.id = r.gp_id
LEFT JOIN circuits ci ON ci.id = r.circuit_id
LEFT JOIN constructors co ON co.id = e.constructor_id
WHERE e.driver_id = ?
ORDER BY r.year DESC, r.round DESC`

function role(row) {
  const parts = []
  if (row.finish_position === 1) parts.push('Win')
  if (row.grid === 1) parts.push('Pole')
  if (row.fastest_lap) parts.push('Fastest lap')
  return parts.length ? parts.join(' · ') : '—'
}

export default function Driver() {
  const { id } = useParams()
  const driver = useQuery(DRIVER, [id])
  const entries = useQuery(ENTRIES, [id])

  return (
    <Result state={driver} what="Loading the driver">
      {(data) => {
        const d = data.rows[0]
        if (!d)
          return (
            <Page title="Not found" back={{ to: '/drivers', label: 'All drivers' }}>
              <p className="muted">No driver with id “{id}”.</p>
            </Page>
          )
        return (
          <Page
            title={
              <>
                {d.full_name} <Confidence value={d.confidence} />
              </>
            }
            back={{ to: '/drivers', label: 'All drivers' }}
          >
            <Stats
              items={[
                { label: 'Nationality', value: d.nationality },
                { label: 'Seasons', value: span(d.first_season, d.last_season) },
                { label: 'Titles', value: d.titles },
                { label: 'Wins', value: d.wins },
                { label: 'Poles', value: d.poles },
                { label: 'Fastest laps', value: d.fastest_laps },
                { label: 'Podiums', value: d.podiums },
                { label: 'Starts', value: d.starts },
                { label: 'Career points', value: d.career_points },
              ]}
            />
            {d.notes && <p className="lede">{d.notes}</p>}
            {d.title_years && (
              <dl className="inline-facts">
                <dt>Title years</dt>
                <dd>{d.title_years.split(',').join(', ')}</dd>
                <dt>Born</dt>
                <dd>
                  {cell(d.born)}
                  {d.died ? ` · died ${d.died}` : ''}
                </dd>
              </dl>
            )}

            <Section
              title="Recorded entries"
              note="Wins, poles and fastest laps — the three facts this database holds per race. It does not hold the full finishing order, so an ordinary points finish does not appear here. Where a constructor is blank, the pole harvest recorded who set it but not what they drove."
            >
              <Result state={entries} what="Loading the record">
                {(rows) => (
                  <DataTable
                    data={rows}
                    columns={['year', 'gp', 'circuit', 'constructor', 'result']}
                    labels={{ gp: 'Grand Prix' }}
                    render={{
                      year: (v) => <Link to={`/seasons/${v}`}>{v}</Link>,
                      circuit: (v, row) =>
                        v ? <Link to={`/circuits/${row.circuit_id}`}>{v}</Link> : cell(v),
                      constructor: (v, row) =>
                        v ? <Link to={`/constructors/${row.constructor_id}`}>{v}</Link> : cell(v),
                      result: (_, row) => (
                        <>
                          {role(row)}
                          {row.shared_drive ? ' (shared)' : ''}
                        </>
                      ),
                    }}
                    empty="No recorded entries."
                  />
                )}
              </Result>
            </Section>
          </Page>
        )
      }}
    </Result>
  )
}
