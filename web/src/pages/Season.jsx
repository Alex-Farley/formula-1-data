import { Link, useParams } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import { cell } from '../format.js'

const HEADER = `
SELECT c.year, c.champion, c.nationality, c.team, c.points, c.wins, c.runner_up,
       c.runner_up_points, c.margin, c.constructors_champion, c.rounds,
       t.engine_formula, t.tyre_suppliers, t.notes,
       s.drivers_champion AS champion_id, s.constructors_champion AS constructors_champion_id
FROM v_champions c
JOIN v_season_timeline t ON t.year = c.year
JOIN seasons s ON s.year = c.year
WHERE c.year = ?`

const RACES = `
SELECT rr.round, rr.gp_name, rv.circuit, rv.circuit_id, rv.country,
       rr.pole, rr.pole_id, rr.winner, rr.winner_id, cw.full_name AS co_winner,
       rr.constructor, rr.constructor_id, rr.fastest_lap, rr.fastest_lap_id, rr.note
FROM race_results rr
LEFT JOIN v_race_venues rv ON rv.race_id = rr.id
LEFT JOIN drivers cw ON cw.id = rr.co_winner_id
WHERE rr.year = ?
ORDER BY rr.round`

/** A driver name that links to the driver, when the row carries their id. */
function driver(name, id) {
  if (!name) return cell(name)
  return id ? <Link to={`/drivers/${id}`}>{name}</Link> : name
}

export default function Season() {
  const { year } = useParams()
  const header = useQuery(HEADER, [Number(year)])
  const races = useQuery(RACES, [Number(year)])

  return (
    <Page title={`${year} season`} back={{ to: '/', label: 'All seasons' }}>
      <Result state={header} what="Loading the season">
        {(data) => {
          const s = data.rows[0]
          if (!s) return <p className="muted">No season {year} in this database.</p>
          return (
            <>
              <Stats
                items={[
                  { label: 'Champion', value: s.champion },
                  { label: 'Team', value: s.team },
                  { label: 'Points', value: s.points },
                  { label: 'Wins', value: s.wins },
                  { label: 'Runner-up', value: s.runner_up },
                  { label: 'Margin', value: s.margin },
                  { label: "Constructors'", value: s.constructors_champion },
                  { label: 'Races', value: s.rounds },
                ]}
              />
              {s.notes && <p className="lede">{s.notes}</p>}
              <dl className="inline-facts">
                <dt>Engine formula</dt>
                <dd>{cell(s.engine_formula)}</dd>
                <dt>Tyres</dt>
                <dd>{cell(s.tyre_suppliers)}</dd>
              </dl>
            </>
          )
        }}
      </Result>

      <Section
        title="Races"
        note="Pole, winner and fastest lap for every round. A round with no winner has not been run yet."
      >
        <Result state={races} what="Loading the races">
          {(data) => (
            <DataTable
              data={data}
              columns={[
                'round',
                'gp_name',
                'circuit',
                'pole',
                'winner',
                'constructor',
                'fastest_lap',
                'note',
              ]}
              labels={{ gp_name: 'Grand Prix', fastest_lap: 'Fastest lap' }}
              render={{
                circuit: (v, row) =>
                  v ? <Link to={`/circuits/${row.circuit_id}`}>{v}</Link> : cell(v),
                pole: (v, row) => driver(v, row.pole_id),
                winner: (v, row) => (
                  <>
                    {driver(v, row.winner_id)}
                    {row.co_winner && <> / {row.co_winner}</>}
                  </>
                ),
                constructor: (v, row) =>
                  v ? <Link to={`/constructors/${row.constructor_id}`}>{v}</Link> : cell(v),
                fastest_lap: (v, row) => driver(v, row.fastest_lap_id),
              }}
            />
          )}
        </Result>
      </Section>
    </Page>
  )
}
