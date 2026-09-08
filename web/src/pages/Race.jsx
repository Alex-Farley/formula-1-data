import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { classificationOrder, missing, number, points as fmtPoints, result } from '../lib/format.js'

const RACE = `
  SELECT r.*, c.name AS circuit, c.locality, c.country,
         cl.layout_name, cl.length_km AS layout_km, cl.turns AS layout_turns,
         g.name AS gp_full
    FROM races r
    LEFT JOIN circuits c        ON c.id = r.circuit_id
    LEFT JOIN circuit_layouts cl ON cl.circuit_id = r.circuit_id AND cl.layout_key = r.layout_key
    LEFT JOIN grands_prix g     ON g.id = r.gp_id
   WHERE r.year = ? AND r.round = ?
`

const ENTRIES = `
  SELECT e.*, d.full_name AS driver, d.nationality, k.name AS constructor,
         ch.name AS chassis
    FROM race_entries e
    JOIN races r         ON r.id = e.race_id
    LEFT JOIN drivers d  ON d.id = e.driver_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
    LEFT JOIN chassis ch ON ch.id = e.chassis_id
   WHERE r.year = ? AND r.round = ?
`

const QUALIFYING = `
  SELECT q.*, d.full_name AS driver, k.name AS constructor
    FROM qualifying q
    JOIN races r         ON r.id = q.race_id
    LEFT JOIN drivers d  ON d.id = q.driver_id
    LEFT JOIN constructors k ON k.id = q.constructor_id
   WHERE r.year = ? AND r.round = ?
   ORDER BY q.position IS NULL, q.position
`

const SPRINT = `
  SELECT s.*, d.full_name AS driver, k.name AS constructor
    FROM sprint_results s
    JOIN races r         ON r.id = s.race_id
    LEFT JOIN drivers d  ON d.id = s.driver_id
    LEFT JOIN constructors k ON k.id = s.constructor_id
   WHERE r.year = ? AND r.round = ?
`

const PITS = `
  SELECT p.*, d.full_name AS driver
    FROM pit_stops p
    JOIN races r        ON r.id = p.race_id
    LEFT JOIN drivers d ON d.id = p.driver_id
   WHERE r.year = ? AND r.round = ?
   ORDER BY p.lap_number, p.stop_number
`

const NEIGHBOURS = `
  SELECT
    (SELECT year || '/' || round FROM races
      WHERE (year < ?1) OR (year = ?1 AND round < ?2)
      ORDER BY year DESC, round DESC LIMIT 1) AS previous,
    (SELECT year || '/' || round FROM races
      WHERE (year > ?1) OR (year = ?1 AND round > ?2)
      ORDER BY year, round LIMIT 1) AS next
`

/** What a row achieved, for the rail beside it. */
function railOf(entry) {
  if (entry.finish_position >= 1 && entry.finish_position <= 3) return 'podium'
  if (entry.points > 0) return 'points'
  if (!missing(entry.finish_position)) return 'classified'
  return ''
}

export default function Race() {
  const { year, round } = useParams()
  const args = [Number(year), Number(round)]
  const state = useQueries({
    race: [RACE, args],
    entries: [ENTRIES, args],
    qualifying: [QUALIFYING, args],
    sprint: [SPRINT, args],
    pits: [PITS, args],
    neighbours: [NEIGHBOURS, args],
  })

  return (
    <Result state={state} context="That race could not be read">
      {(data) => {
        const race = data.race.rows[0]
        if (!race) {
          return (
            <Page title="No such race" back={{ to: '/races', label: 'All races' }}>
              <p className="muted">
                There is no round {round} of {year} in the register.
              </p>
            </Page>
          )
        }
        return <RaceBody race={race} data={data} year={Number(year)} round={Number(round)} />
      }}
    </Result>
  )
}

function RaceBody({ race, data, year, round }) {
  const entries = rows(data, 'entries')
  const qualifying = rows(data, 'qualifying')
  const pits = rows(data, 'pits')
  /* The sprint is a separate race on the same weekend, so it is ordered the
     same way a race is: finishers by position, then everyone else. */
  const sprint = useMemo(
    () => [...rows(data, 'sprint')].sort((a, b) => classificationOrder(a) - classificationOrder(b)),
    [data],
  )
  const neighbours = data.neighbours.rows[0] ?? {}

  /**
   * The classification, in the order a classification is printed: finishers by
   * position, then everyone else by how far they got. finish_position is NULL
   * for a retirement, so ordering on it alone would put every DNF first —
   * SQLite sorts NULL first — which is why this is done here rather than in
   * the query.
   */
  const classified = useMemo(
    () => [...entries].sort((a, b) => classificationOrder(a) - classificationOrder(b)),
    [entries],
  )

  const winners = classified.filter((e) => e.finish_position === 1)
  const poles = entries.filter((e) => e.grid === 1)
  const fastest = entries.filter((e) => e.fastest_lap === 1)
  const finishers = entries.filter((e) => !missing(e.finish_position)).length
  const shared = entries.some((e) => e.shared_drive === 1)
  const scheduled = race.status === 'scheduled'

  const nameList = (list) =>
    list.length === 0 ? null : (
      <>
        {list.map((entry, i) => (
          <span key={entry.id}>
            {i > 0 && ' / '}
            <Link to={`/drivers/${entry.driver_id}`}>{entry.driver ?? entry.driver_id}</Link>
          </span>
        ))}
      </>
    )

  return (
    <Page
      eyebrow={`Round ${round} of ${year}`}
      title={race.name_used}
      back={{ to: `/seasons/${year}`, label: `${year} season` }}
      lede={race.note}
      aside={
        <p className="crumb plain" style={{ marginTop: 12 }}>
          {neighbours.previous && <Link to={`/races/${neighbours.previous}`}>← Previous race</Link>}
          {neighbours.previous && neighbours.next && <span className="faint"> · </span>}
          {neighbours.next && <Link to={`/races/${neighbours.next}`}>Next race →</Link>}
        </p>
      }
    >
      <Section>
        <Stats
          items={[
            {
              label: 'Circuit',
              value: race.circuit_id ? (
                <Link to={`/circuits/${race.circuit_id}`} style={{ fontSize: 17 }}>
                  {race.circuit}
                </Link>
              ) : null,
              note: [race.locality, race.country].filter(Boolean).join(', ') || undefined,
            },
            scheduled
              ? { label: 'Status', value: 'Scheduled', note: race.dates ?? undefined }
              : { label: 'Winner', value: nameList(winners), note: winners[0]?.constructor ?? undefined },
            scheduled ? null : { label: 'Pole', value: nameList(poles) },
            scheduled ? null : { label: 'Fastest lap', value: nameList(fastest) },
            {
              label: 'Entries',
              value: number(entries.length),
              note: scheduled ? undefined : `${finishers} classified`,
            },
          ].filter(Boolean)}
        />
      </Section>

      {scheduled && (
        <Note>
          <strong>This race has not been run.</strong> It is on the {year} calendar and carries no
          result. Nothing here fills that in with a prediction.
        </Note>
      )}

      {shared && (
        <Note>
          <strong>This race includes a shared drive.</strong> Two drivers took turns in one car, and
          both are classified in the same position — so the classification below has a repeated
          number in it, and that is correct, not a duplicate.
        </Note>
      )}

      {classified.length > 0 && (
        <Section title="Classification" count={`${classified.length} entries`}>
          <DataTable
            rows={classified}
            rowKey={(row) => row.id}
            sortable={false}
            page={60}
            highlight={(row) => row.finish_position === 1}
            columns={[
              {
                // Data, not decoration: what the row achieved, read before any
                // of the numbers do. Always paired with the position beside it,
                // so the colour never carries the meaning on its own.
                key: 'rail',
                label: <span className="sr-only">Result</span>,
                align: 'rail',
                sortable: false,
                render: (_, row) => <i className={railOf(row)} />,
              },
              {
                key: 'position_text',
                label: 'Pos',
                align: 'num',
                render: (_, row) => {
                  const value = result(row)
                  const retired = missing(row.finish_position)
                  return retired ? <span className="tag tag-dnf">{value}</span> : <b>{value}</b>
                },
              },
              {
                key: 'driver',
                label: 'Driver',
                render: (name, row) =>
                  row.driver_id ? (
                    <>
                      <Link to={`/drivers/${row.driver_id}`}>{name ?? row.driver_id}</Link>
                      {row.shared_drive === 1 && (
                        <span className="tag" style={{ marginLeft: 6 }}>
                          shared
                        </span>
                      )}
                    </>
                  ) : (
                    cell(name)
                  ),
              },
              {
                key: 'constructor',
                label: 'Constructor',
                render: (name, row) =>
                  row.constructor_id ? (
                    <Link to={`/constructors/${row.constructor_id}`}>{name}</Link>
                  ) : (
                    cell(row.entrant ?? name)
                  ),
              },
              {
                key: 'chassis',
                label: 'Chassis',
                render: (name, row) =>
                  row.chassis_id ? <Link to={`/cars/${row.chassis_id}`}>{name ?? row.chassis_id}</Link> : cell(name),
              },
              { key: 'grid_text', label: 'Grid', align: 'num' },
              { key: 'laps_completed', label: 'Laps', align: 'num' },
              { key: 'status', label: 'Out', render: (value) => (missing(value) ? cell(value) : <span className="tag">{value}</span>) },
              {
                key: 'points',
                label: 'Points',
                align: 'num',
                render: (value) => (missing(value) ? cell(value) : fmtPoints(value)),
              },
              {
                key: 'fastest_lap',
                label: 'FL',
                align: 'num',
                render: (value) => (value === 1 ? '●' : ''),
              },
            ]}
            footer="An empty “Out” column is a driver the source records no retirement reason for, not a driver who finished. A blank chassis is a constructor that ran more than one design that season and no source says which raced this round."
          />
        </Section>
      )}

      {qualifying.length > 0 && (
        <Section title="Qualifying" count={`${qualifying.length} entries`}>
          <DataTable
            rows={qualifying}
            rowKey={(row) => row.id}
            sortable={false}
            page={60}
            columns={[
              { key: 'position_text', label: 'Pos', align: 'num' },
              {
                key: 'driver',
                label: 'Driver',
                render: (name, row) =>
                  row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name ?? row.driver_id}</Link> : cell(name),
              },
              {
                key: 'constructor',
                label: 'Constructor',
                render: (name, row) =>
                  row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name),
              },
              { key: 'driver_number', label: 'No.', align: 'num' },
              ...(qualifying.some((q) => q.q1)
                ? [
                    { key: 'q1', label: 'Q1', align: 'num' },
                    { key: 'q2', label: 'Q2', align: 'num' },
                    { key: 'q3', label: 'Q3', align: 'num' },
                  ]
                : [{ key: 'time', label: 'Time', align: 'num' }]),
              { key: 'gap', label: 'Gap', align: 'num' },
              { key: 'interval', label: 'Interval', align: 'num' },
            ]}
            footer="Before knock-out qualifying arrived in 2006 there is one time per driver; from 2006 there are three sessions and the fastest of each is shown."
          />
        </Section>
      )}

      {sprint.length > 0 && (
        <Section title="Sprint" count={`${sprint.length} entries`}>
          <DataTable
            rows={sprint}
            rowKey={(row) => row.id}
            sortable={false}
            page={40}
            columns={[
              {
                key: 'rail',
                label: <span className="sr-only">Result</span>,
                className: 'rail',
                render: (_value, row) => <span className={`rail-${railOf(row)}`} />,
              },
              { key: 'position_text', label: 'Pos', align: 'num' },
              {
                key: 'driver',
                label: 'Driver',
                render: (name, row) =>
                  row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name ?? row.driver_id}</Link> : cell(name),
              },
              {
                key: 'constructor',
                label: 'Constructor',
                render: (name, row) =>
                  row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name),
              },
              { key: 'grid', label: 'Grid', align: 'num', render: (v) => cell(number(v)) },
              { key: 'laps_completed', label: 'Laps', align: 'num', render: (v) => cell(number(v)) },
              { key: 'status', label: 'Out', render: (v) => result(v) },
              { key: 'gap', label: 'Gap', align: 'num' },
              { key: 'points', label: 'Points', align: 'num', render: (v) => cell(fmtPoints(v)) },
            ]}
            footer="A sprint is a separate, shorter race held on the grand prix weekend, with its own grid and its own points — and those points count towards the championship. The grid column is the sprint grid, not the grand prix one."
          />
        </Section>
      )}

      {pits.length > 0 && (
        <Section title="Pit stops" count={`${pits.length} stops`}>
          <DataTable
            rows={pits}
            rowKey={(row) => row.id}
            sortable
            sort="lap_number"
            direction="asc"
            page={80}
            columns={[
              { key: 'lap_number', label: 'Lap', align: 'num' },
              {
                key: 'driver',
                label: 'Driver',
                render: (name, row) =>
                  row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name ?? row.driver_id}</Link> : cell(name ?? row.driver_key),
              },
              { key: 'stop_number', label: 'Stop', align: 'num' },
              { key: 'stationary_seconds', label: 'Stationary (s)', align: 'num' },
              { key: 'pit_lane_seconds', label: 'Pit lane (s)', align: 'num' },
              { key: 'source', label: 'Source' },
            ]}
            footer="Pit stops are keyed on the race, the source and the driver together, so more than one source can hold the same stop side by side and be compared rather than overwrite each other."
          />
        </Section>
      )}

      <Section title="Where this comes from">
        <Fields
          items={[
            { label: 'Grand Prix', value: race.gp_full ?? race.name_used },
            { label: 'Dates', value: race.dates },
            {
              label: 'Layout raced',
              value: race.layout_name
                ? `${race.layout_name}${race.layout_km ? ` · ${race.layout_km} km` : ''}${race.layout_turns ? ` · ${race.layout_turns} turns` : ''}`
                : null,
            },
            { label: 'Confidence', value: <Confidence value={race.confidence} /> },
            {
              label: 'Source',
              value: race.source ? (
                <a href={race.source} target="_blank" rel="noreferrer noopener">
                  {race.source}
                </a>
              ) : null,
            },
          ]}
        />
        {!race.layout_name && (
          <p className="source-note">
            Only 13 of the 80 circuits have a layout timeline, so a race before a rebuild may have
            no layout recorded against it rather than the wrong one.
          </p>
        )}
      </Section>
    </Page>
  )
}
