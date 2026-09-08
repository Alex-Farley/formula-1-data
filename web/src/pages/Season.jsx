import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats, Stepper } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Figure from '../charts/Figure.jsx'
import LineChart from '../charts/LineChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { points as fmtPoints, missing, number } from '../lib/format.js'
import { finalStandings } from '../lib/standings.js'

const SEASON = `
  SELECT s.*, d.full_name AS champion, t.name AS champion_team,
         ru.full_name AS runner_up_name, cc.name AS constructors_champion_name
    FROM seasons s
    LEFT JOIN drivers d       ON d.id  = s.drivers_champion
    LEFT JOIN drivers ru      ON ru.id = s.runner_up
    LEFT JOIN constructors t  ON t.id  = s.champion_team
    LEFT JOIN constructors cc ON cc.id = s.constructors_champion
   WHERE s.year = ?
`

const CALENDAR = `
  SELECT r.round, r.name_used, r.dates, r.status, r.sprint, r.circuit_id, c.name AS circuit,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.finish_position = 1)      AS winner,
         (SELECT e.driver_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winner_id,
         (SELECT k.name FROM race_entries e JOIN constructors k ON k.id = e.constructor_id
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winning_team,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.grid = 1)                 AS pole,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.fastest_lap = 1)          AS fastest
    FROM races r
    LEFT JOIN circuits c ON c.id = r.circuit_id
   WHERE r.year = ?
   ORDER BY r.round
`

const STANDINGS = `
  SELECT id, year, table_type, after_round, position, position_text,
         entity, entity_id, engine_id, team, points
    FROM standings
   WHERE year = ?
   ORDER BY after_round, table_type, position
`

const NEIGHBOURS = `
  SELECT (SELECT MAX(year) FROM seasons WHERE year < ?1) AS previous,
         (SELECT MIN(year) FROM seasons WHERE year > ?1) AS next
`

const ENTRANTS = `
  SELECT se.id, se.entrant_id, se.constructor_id, k.name AS constructor,
         se.chassis_ids, se.chassis_count, se.engine_ids, se.tyre_ids
    FROM season_entrants se
    LEFT JOIN constructors k ON k.id = se.constructor_id
   WHERE se.year = ?
   ORDER BY COALESCE(k.name, se.entrant_id)
`

/**
 * The final classification of one championship table.
 *
 * after_round IS NULL is the season as it finished — `as_of` reads "final" —
 * and not a missing round. Reading after_round arithmetically turns those
 * NULLs into round zero, which plots a champion's season total before the
 * first race of the year. finalStandings then resolves the two reasons a
 * season can hold more than one final row per entity; see lib/standings.js.
 */
function finalTable(standings, type) {
  return finalStandings(standings.filter((row) => row.table_type === type && row.after_round === null))
}

export default function Season() {
  const { year } = useParams()
  const state = useQueries({
    season: [SEASON, [Number(year)]],
    calendar: [CALENDAR, [Number(year)]],
    standings: [STANDINGS, [Number(year)]],
    entrants: [ENTRANTS, [Number(year)]],
    neighbours: [NEIGHBOURS, [Number(year)]],
  })

  return (
    <Result state={state} context={`Season ${year} could not be read`}>
      {(data) => {
        const season = data.season.rows[0]
        if (!season) {
          return (
            <Page title={`No season ${year}`} back={{ to: '/seasons', label: 'All seasons' }}>
              <p className="muted">The championship register runs from 1950 to 2026.</p>
            </Page>
          )
        }
        return <SeasonBody year={Number(year)} season={season} data={data} />
      }}
    </Result>
  )
}

function SeasonBody({ year, season, data }) {
  const calendar = rows(data, 'calendar')
  const standings = rows(data, 'standings')
  const entrants = rows(data, 'entrants')
  const neighbours = data.neighbours.rows[0] ?? {}

  const driversFinal = useMemo(() => finalTable(standings, 'drivers'), [standings])
  const constructorsFinal = useMemo(() => finalTable(standings, 'constructors'), [standings])

  /**
   * The title race, as it actually ran.
   *
   * Three series, because three is what the palette validates to and what a
   * reader can follow at once — the eventual top three, tracked round by
   * round. A points total that goes flat is a driver who scored nothing that
   * weekend; it never falls, because a championship total cannot.
   */
  const progression = useMemo(() => {
    const contenders = driversFinal.slice(0, 3).filter((d) => d.entity_id)
    return contenders.map((driver) => ({
      name: driver.entity,
      points: standings
        // The NULL row is the season's end, not a round: including it would
        // draw the final total at the left-hand edge of the chart.
        .filter(
          (r) =>
            r.table_type === 'drivers' && r.entity_id === driver.entity_id && r.after_round !== null,
        )
        .sort((a, b) => a.after_round - b.after_round)
        .map((r) => ({ x: r.after_round, y: r.points })),
    }))
  }, [driversFinal, standings])

  const run = calendar.filter((r) => r.status === 'completed').length
  const ambiguous = constructorsFinal.some((r) => r.engine_id)

  return (
    <Page
      eyebrow="Season"
      title={`${year}`}
      back={{ to: '/seasons', label: 'All seasons' }}
      lede={season.notes}
      aside={
        <Stepper
          previous={
            neighbours.previous
              ? { to: `/seasons/${neighbours.previous}`, label: `${neighbours.previous} season` }
              : null
          }
          next={
            neighbours.next
              ? { to: `/seasons/${neighbours.next}`, label: `${neighbours.next} season` }
              : null
          }
        />
      }
    >
      <Section>
        <Stats
          items={[
            { label: 'Rounds', value: number(season.rounds), note: run === season.rounds ? 'all run' : `${run} run` },
            {
              label: "Drivers' champion",
              value: season.drivers_champion ? (
                <Link to={`/drivers/${season.drivers_champion}`}>{season.champion}</Link>
              ) : null,
              note: season.champion_points !== null ? `${fmtPoints(season.champion_points)} points` : undefined,
            },
            {
              label: "Constructors' champion",
              value: season.constructors_champion ? (
                <Link to={`/constructors/${season.constructors_champion}`}>
                  {season.constructors_champion_name}
                </Link>
              ) : year < 1958 ? (
                <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>
                  not contested
                </span>
              ) : null,
              note:
                season.constructors_points !== null && season.constructors_points !== undefined
                  ? `${fmtPoints(season.constructors_points)} points`
                  : undefined,
            },
            {
              label: 'Margin',
              value: season.margin !== null ? fmtPoints(season.margin) : null,
              note: season.runner_up_name ? `over ${season.runner_up_name}` : undefined,
            },
          ]}
        />
      </Section>

      {progression.length > 1 && (
        <Section title="How the title was decided">
          <Figure
            title={`Championship points after each round, ${year}`}
            note="The three drivers who finished highest, tracked from the opening round. Before 1991 only a driver's best few results counted, so a line can rise by less than they scored that weekend."
            legend={progression.map((s) => s.name)}
            table={{
              rows: progression.flatMap((s) => s.points.map((p) => ({ driver: s.name, round: p.x, points: p.y }))),
              columns: [
                { key: 'driver', label: 'Driver' },
                { key: 'round', label: 'After round', align: 'num' },
                { key: 'points', label: 'Points', align: 'num' },
              ],
            }}
          >
            <LineChart
              series={progression.map((s) => ({ name: s.name, points: s.points }))}
              format={(v) => fmtPoints(v)}
              formatX={(v) => `R${Math.round(v)}`}
              height={250}
              label={`Championship points by round for the top three drivers of ${year}`}
            />
          </Figure>
        </Section>
      )}

      <Section title="The calendar" count={`${calendar.length} rounds`}>
        <DataTable
          rows={calendar}
          rowKey={(row) => row.round}
          sortable={false}
          columns={[
            { key: 'round', label: 'R', align: 'num' },
            {
              key: 'name_used',
              label: 'Grand Prix',
              render: (name, row) => (
                <Link to={`/races/${year}/${row.round}`}>
                  {name}
                  {row.sprint ? ' ' : ''}
                  {row.sprint ? <span className="tag">sprint</span> : null}
                </Link>
              ),
            },
            {
              key: 'circuit',
              label: 'Circuit',
              render: (name, row) =>
                row.circuit_id ? <Link to={`/circuits/${row.circuit_id}`}>{name}</Link> : cell(name),
            },
            { key: 'dates', label: 'Dates' },
            {
              key: 'winner',
              label: 'Winner',
              render: (name, row) =>
                row.status !== 'completed' ? (
                  <span className="tag">not yet run</span>
                ) : row.winner_id && !String(name ?? '').includes(' / ') ? (
                  <Link to={`/drivers/${row.winner_id}`}>{name}</Link>
                ) : (
                  cell(name)
                ),
            },
            { key: 'winning_team', label: 'Car' },
            { key: 'pole', label: 'Pole' },
            { key: 'fastest', label: 'Fastest lap' },
          ]}
          footer="Two names in one cell is a shared drive: both drivers are classified in that position, and both are winners. Open any round for its full classification."
        />
      </Section>

      <div className="split" style={{ marginTop: 34 }}>
        <Section title="Final drivers' standings" count={`${driversFinal.length}`}>
          <DataTable
            rows={driversFinal}
            rowKey={(row) => row.entity_id ?? row.entity}
            sortable={false}
            page={40}
            columns={[
              { key: 'position_text', label: 'Pos', align: 'num' },
              {
                key: 'entity',
                label: 'Driver',
                render: (name, row) =>
                  row.entity_id ? <Link to={`/drivers/${row.entity_id}`}>{name}</Link> : cell(name),
              },
              { key: 'points', label: 'Points', align: 'num', render: (v) => (missing(v) ? cell(v) : fmtPoints(v)) },
            ]}
            footer="A driver with points and no position was excluded from the classification: the points stand, the position does not."
          />
        </Section>

        <Section title="Final constructors' standings" count={`${constructorsFinal.length}`}>
          {constructorsFinal.length === 0 ? (
            <Note>
              <strong>No constructors' championship.</strong> It was not contested until 1958.
            </Note>
          ) : (
            <DataTable
              rows={constructorsFinal}
              rowKey={(row) => `${row.entity_id}-${row.engine_id ?? ''}`}
              sortable={false}
              page={40}
              columns={[
                { key: 'position_text', label: 'Pos', align: 'num' },
                {
                  key: 'entity',
                  label: 'Constructor',
                  render: (name, row) => (
                    <>
                      {row.entity_id ? <Link to={`/constructors/${row.entity_id}`}>{name}</Link> : cell(name)}
                      {row.engine_id ? <span className="tag" style={{ marginLeft: 6 }}>{row.engine_id}</span> : null}
                    </>
                  ),
                },
                { key: 'points', label: 'Points', align: 'num', render: (v) => (missing(v) ? cell(v) : fmtPoints(v)) },
              ]}
              footer={
                ambiguous
                  ? 'The championship is contested by a chassis–engine pair, so one name can appear more than once with different engines.'
                  : undefined
              }
            />
          )}
        </Section>
      </div>

      <Section title="Who entered" count={`${entrants.length} entrants`}>
        <DataTable
          rows={entrants}
          rowKey={(row) => row.id}
          sortable
          sort="constructor"
          columns={[
            {
              key: 'constructor',
              label: 'Constructor',
              render: (name, row) =>
                row.constructor_id ? (
                  <Link to={`/constructors/${row.constructor_id}`}>{name ?? row.constructor_id}</Link>
                ) : (
                  cell(name ?? row.entrant_id)
                ),
            },
            { key: 'entrant_id', label: 'Entered as' },
            { key: 'chassis_ids', label: 'Chassis', align: 'prose' },
            { key: 'chassis_count', label: 'Designs', align: 'num' },
            { key: 'engine_ids', label: 'Engines' },
            { key: 'tyre_ids', label: 'Tyres' },
          ]}
          footer="Where an entrant ran more than one design, no source records which car raced which round — so those race results carry no chassis."
        />
      </Section>

      <Section title="The season on the record">
        <Fields
          items={[
            { label: 'Engine formula', value: season.engine_formula },
            { label: 'Tyre suppliers', value: season.tyre_suppliers },
            {
              label: 'Confidence',
              value: <Confidence value={season.confidence} />,
            },
            {
              label: 'Source',
              value: season.source ? (
                <a href={season.source} target="_blank" rel="noreferrer noopener">
                  {season.source}
                </a>
              ) : null,
            },
          ]}
        />
      </Section>

      <Onward
        items={[
          season.drivers_champion
            ? {
                to: `/drivers/${season.drivers_champion}`,
                label: season.champion,
                hint: `The champion's full career, ${year} and everything either side of it.`,
              }
            : null,
          season.constructors_champion
            ? {
                to: `/constructors/${season.constructors_champion}`,
                label: season.constructors_champion_name,
                hint: 'The winning constructor, its cars and its record.',
              }
            : null,
          neighbours.next
            ? { to: `/seasons/${neighbours.next}`, label: `The ${neighbours.next} season`, hint: 'What happened next.' }
            : null,
          season.drivers_champion
            ? null
            : { to: '/races', label: 'Every race', hint: 'The rounds of this season beside all the others.' },
          { to: '/seasons', label: 'All seasons', hint: 'Seventy-seven championships, compared in one table.' },
        ]}
      />
    </Page>
  )
}
