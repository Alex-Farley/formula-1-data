import { Link, useParams } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Confidence, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import { cell, span } from '../format.js'

// The prose and the register entry come from `circuits`, but the race counts
// and the first and last Grand Prix come from v_circuits, which derives them
// from the races themselves. circuits.last_gp is NULL for the 27 venues still
// in use - NULL there means "not established", not "still active" - so
// reading it directly would print an open-ended span for Silverstone.
const CIRCUIT = `
SELECT c.*,
       v.races     AS derived_races,
       v.first_gp  AS derived_first_gp,
       v.last_gp   AS derived_last_gp
FROM circuits c
LEFT JOIN v_circuits v ON v.id = c.id
WHERE c.id = ?`

// Where a circuit appears here at all, these rows are a complete,
// non-overlapping timeline of the configurations actually raced - verify.py
// fails the build if they are not.
const LAYOUTS = `
SELECT layout_name, from_year, to_year, length_km, turns, change_reason, by_year
FROM circuit_layouts
WHERE circuit_id = ?
ORDER BY from_year, layout_key`

const WINNERS = `
SELECT driver_id, driver, wins, first_win, last_win
FROM v_circuit_winners
WHERE circuit_id = ?
ORDER BY wins DESC, last_win DESC`

const RACES = `
SELECT year, round, gp_name, layout_name, length_km, figures
FROM v_race_venues
WHERE circuit_id = ?
ORDER BY year DESC, round DESC`

export default function Circuit() {
  const { id } = useParams()
  const circuit = useQuery(CIRCUIT, [id])
  const layouts = useQuery(LAYOUTS, [id])
  const winners = useQuery(WINNERS, [id])
  const races = useQuery(RACES, [id])

  return (
    <Result state={circuit} what="Loading the circuit">
      {(data) => {
        const c = data.rows[0]
        if (!c)
          return (
            <Page title="Not found" back={{ to: '/circuits', label: 'All circuits' }}>
              <p className="muted">No circuit with id “{id}”.</p>
            </Page>
          )
        return (
          <Page
            title={
              <>
                {c.name} <Confidence value={c.confidence} />
              </>
            }
            back={{ to: '/circuits', label: 'All circuits' }}
          >
            <Stats
              items={[
                { label: 'Country', value: c.country },
                { label: 'Locality', value: c.locality },
                { label: 'Type', value: c.circuit_type },
                { label: 'Championship races', value: c.derived_races ?? c.gp_count },
                {
                  label: 'Held',
                  value: span(c.derived_first_gp ?? c.first_gp, c.derived_last_gp ?? c.last_gp),
                },
                { label: 'Length (km)', value: c.length_km },
                { label: 'Turns', value: c.turns },
                { label: 'Direction', value: c.direction },
              ]}
            />
            {c.characteristics && <p className="lede">{c.characteristics}</p>}
            {c.notes && <p className="note">{c.notes}</p>}

            <Result state={layouts} what="Loading the layouts">
              {(rows) =>
                rows.rows.length > 0 && (
                  <Section
                    title="Configurations raced"
                    note="A complete, non-overlapping timeline — the build fails if a season is left uncovered or claimed twice."
                  >
                    <DataTable
                      data={rows}
                      columns={['layout_name', 'years', 'length_km', 'turns', 'change_reason']}
                      labels={{
                        layout_name: 'Layout',
                        length_km: 'Length (km)',
                        change_reason: 'Why it changed',
                      }}
                      render={{
                        years: (_, row) =>
                          row.by_year ? span(row.from_year, row.to_year) : 'one-off',
                      }}
                    />
                  </Section>
                )
              }
            </Result>

            <Section title="Most wins here">
              <Result state={winners} what="Loading the winners">
                {(rows) => (
                  <DataTable
                    data={rows}
                    columns={['driver', 'wins', 'first_win', 'last_win']}
                    render={{
                      driver: (v, row) =>
                        v ? <Link to={`/drivers/${row.driver_id}`}>{v}</Link> : cell(v),
                    }}
                    empty="No championship race has been won here."
                  />
                )}
              </Result>
            </Section>

            <Section
              title="Races held"
              note="“figures” says whether the length shown for that race is the layout as raced, or a fallback to the circuit's current configuration."
            >
              <Result state={races} what="Loading the races">
                {(rows) => (
                  <DataTable
                    data={rows}
                    columns={['year', 'gp_name', 'layout_name', 'length_km', 'figures']}
                    labels={{
                      gp_name: 'Grand Prix',
                      layout_name: 'Layout',
                      length_km: 'Length (km)',
                    }}
                    render={{ year: (v) => <Link to={`/seasons/${v}`}>{v}</Link> }}
                    empty="No championship race recorded here."
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
