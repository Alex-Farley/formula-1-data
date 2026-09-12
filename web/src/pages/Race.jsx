import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats, Stepper } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Disagreement, { RACE_DISAGREEMENTS } from '../components/Disagreement.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { classificationOrder, finished, missing, number, points as fmtPoints, result } from '../lib/format.js'

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
    disagreements: [RACE_DISAGREEMENTS, args],
  })

  return (
    <Result state={state} context="That race could not be read">
      {(data) => {
        const race = data.race.rows[0]
        if (!race) {
          return (
            <Page title="No such race" cite={false} back={{ to: '/races', label: 'All races' }}>
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
  const poles = entries.filter((e) => e.pole === 1)

  /*
   * "Pole" on this page is the driver the season record credits with pole
   * position. Two neighbouring facts are held separately and shown only
   * where they name someone else: the fastest qualifier (thirteen races,
   * where a penalty or a sprint-set grid moved the quickest driver back) and
   * the car that actually started from grid 1 (one race, 2022 Brazil, where
   * the sprint winner started first and pole stayed with the fastest
   * qualifier). Naming them, and where each started, is the difference
   * between a page that looks wrong and a page that explains itself. The
   * database records that they differ, not why, so neither line states a
   * cause.
   */
  const quickest = qualifying.find((q) => q.position === 1)
  const outqualified =
    quickest && poles.length === 1 && quickest.driver_id !== poles[0].driver_id ? quickest : null
  const front = entries.filter((e) => e.grid === 1)
  const startedFirst =
    front.length === 1 && poles.length === 1 && front[0].driver_id !== poles[0].driver_id ? front[0] : null
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
        <Stepper
          previous={neighbours.previous ? { to: `/races/${neighbours.previous}`, label: 'Previous race' } : null}
          next={neighbours.next ? { to: `/races/${neighbours.next}`, label: 'Next race' } : null}
        />
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
            scheduled || !startedFirst
              ? null
              : {
                  label: 'Started first',
                  value: (
                    <Link to={`/drivers/${startedFirst.driver_id}`}>
                      {startedFirst.driver ?? startedFirst.driver_id}
                    </Link>
                  ),
                  note: `the pole-sitter started ${poles[0].grid_text ?? '—'}`,
                },
            scheduled || !outqualified
              ? null
              : {
                  label: 'Fastest qualifier',
                  value: (
                    <Link to={`/drivers/${outqualified.driver_id}`}>
                      {outqualified.driver ?? outqualified.driver_id}
                    </Link>
                  ),
                  note: `started ${
                    entries.find((e) => e.driver_id === outqualified.driver_id)?.grid_text ?? '—'
                  }${race.sprint ? ', the grid set by the sprint' : ''}`,
                },
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
          result yet.
        </Note>
      )}

      <Disagreement rows={rows(data, 'disagreements')} what="this race" />

      {shared && (
        <Note>
          <strong>This race includes a shared drive.</strong> Two drivers took turns in one car and
          both are classified in the same position, so a position below appears twice. That is
          correct, not a duplicated row.
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
              {
                key: 'status',
                label: 'Out',
                render: (value, row) =>
                  finished(value, row.finish_position) ? (
                    'Finished'
                  ) : missing(value) ? (
                    cell(value)
                  ) : (
                    <span className="tag">{value}</span>
                  ),
              },
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
                render: (value) => (value === 1 ? <span className="fl">●</span> : ''),
              },
            ]}
            footer="An empty “Out” is a retirement nobody recorded a reason for, not a driver who finished. A blank chassis is a season the team ran more than one design and no source says which car raced here."
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
            footer="Before knock-out qualifying arrived in 2006 there is one time per driver; from 2006, the best lap of each of the three sessions."
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
                // Identical to the classification table's rail above, and it
                // has to be: DataTable calls column.className as a FUNCTION of
                // the row, so the string this used to pass threw on render and
                // took the whole page down with it. Every sprint weekend since
                // 2021 — thirty races — was a blank page, because no test
                // opened one. The class names were wrong too: railOf already
                // returns the class, and `rail-${...}` matched no rule.
                key: 'rail',
                label: <span className="sr-only">Result</span>,
                align: 'rail',
                sortable: false,
                render: (_, row) => <i className={railOf(row)} />,
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
              // render is handed the VALUE, not the row — so this was calling
              // result(entry) on a bare status string, and on the many rows
              // where status is null it read position_text off null and threw.
              // Rendered the way the classification table above renders the
              // same column.
              {
                key: 'status',
                label: 'Out',
                render: (value, row) =>
                  finished(value, row.finish_position) ? (
                    'Finished'
                  ) : missing(value) ? (
                    cell(value)
                  ) : (
                    <span className="tag">{value}</span>
                  ),
              },
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
            footer="Stationary time is the car standing still; pit-lane time is the whole detour. Where two sources record the same stop, both are kept so you can compare them."
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
            No layout is recorded for this round: only 13 of the 80 circuits have a layout
            timeline, and a blank here is better than the wrong shape.
          </p>
        )}
      </Section>

      <Onward
        items={[
          race.circuit_id
            ? {
                to: `/circuits/${race.circuit_id}`,
                label: race.circuit,
                hint: 'The venue, its layouts and every race held there.',
              }
            : null,
          { to: `/seasons/${year}`, label: `The ${year} season`, hint: 'Calendar, title race and final standings.' },
          winners[0]?.driver_id
            ? {
                to: `/drivers/${winners[0].driver_id}`,
                label: winners[0].driver ?? 'The winner',
                hint: 'Their full career, race by race.',
              }
            : null,
          neighbours.next
            ? { to: `/races/${neighbours.next}`, label: 'The next race', hint: 'Where the championship went from here.' }
            : null,
        ]}
      />
    </Page>
  )
}
