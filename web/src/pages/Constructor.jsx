import { Link, useParams } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Confidence, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import { cell, span } from '../format.js'

const TEAM = `SELECT * FROM constructors WHERE id = ?`

// The lineage chain this constructor belongs to, in order. This is the table
// most F1 databases do not have: a team that changed its name four times is
// one racing operation, not four constructors.
const LINEAGE = `
SELECT l.sequence, l.entity_name, l.from_year, l.to_year, l.note, l.chain_name
FROM constructor_lineage l
WHERE l.chain_id = (SELECT lineage_chain FROM constructors WHERE id = ?)
ORDER BY l.sequence`

const WINS = `
SELECT r.year, r.round, COALESCE(r.name_used, g.name) AS gp, ci.name AS circuit,
       ci.id AS circuit_id, d.full_name AS driver, d.id AS driver_id
FROM race_entries e
JOIN races r ON r.id = e.race_id
LEFT JOIN grands_prix g ON g.id = r.gp_id
LEFT JOIN circuits ci ON ci.id = r.circuit_id
LEFT JOIN drivers d ON d.id = e.driver_id
WHERE e.constructor_id = ? AND e.finish_position = 1
ORDER BY r.year DESC, r.round DESC`

export default function Constructor() {
  const { id } = useParams()
  const team = useQuery(TEAM, [id])
  const lineage = useQuery(LINEAGE, [id])
  const wins = useQuery(WINS, [id])

  return (
    <Result state={team} what="Loading the constructor">
      {(data) => {
        const t = data.rows[0]
        if (!t)
          return (
            <Page title="Not found" back={{ to: '/constructors', label: 'All constructors' }}>
              <p className="muted">No constructor with id “{id}”.</p>
            </Page>
          )
        return (
          <Page
            title={
              <>
                {t.name} <Confidence value={t.confidence} />
              </>
            }
            back={{ to: '/constructors', label: 'All constructors' }}
          >
            <Stats
              items={[
                { label: 'Full name', value: t.full_name },
                { label: 'Country', value: t.country },
                { label: 'Base', value: t.base },
                { label: 'Entered', value: span(t.first_entry, t.last_entry) },
                { label: 'Wins', value: t.wins },
                { label: "Constructors' titles", value: t.constructors_titles },
                { label: "Drivers' titles", value: t.drivers_titles },
                { label: 'Active', value: t.active ? 'yes' : 'no' },
              ]}
            />
            {t.notes && <p className="lede">{t.notes}</p>}

            <Result state={lineage} what="Loading the lineage">
              {(rows) =>
                rows.rows.length > 1 && (
                  <Section
                    title={rows.rows[0].chain_name}
                    note="One continuous racing operation through its changes of name and owner."
                  >
                    <DataTable
                      data={rows}
                      columns={['sequence', 'entity_name', 'years', 'note']}
                      labels={{ sequence: '#', entity_name: 'Raced as' }}
                      render={{ years: (_, row) => span(row.from_year, row.to_year) }}
                    />
                  </Section>
                )
              }
            </Result>

            <Section
              title="Race wins"
              note="Derived from the race records — this is the list the win total above is counted from."
            >
              <Result state={wins} what="Loading the wins">
                {(rows) => (
                  <DataTable
                    data={rows}
                    columns={['year', 'gp', 'circuit', 'driver']}
                    labels={{ gp: 'Grand Prix' }}
                    render={{
                      year: (v) => <Link to={`/seasons/${v}`}>{v}</Link>,
                      circuit: (v, row) =>
                        v ? <Link to={`/circuits/${row.circuit_id}`}>{v}</Link> : cell(v),
                      driver: (v, row) =>
                        v ? <Link to={`/drivers/${row.driver_id}`}>{v}</Link> : cell(v),
                    }}
                    empty="No championship race wins recorded."
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
