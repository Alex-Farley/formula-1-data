import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats, Stepper } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Disagreement, { RACE_DISAGREEMENTS } from '../components/Disagreement.jsx'
import { OutlineCard } from '../components/Outline.jsx'
import Photographs from '../components/Photographs.jsx'
import { RACE_SESSIONS, SESSION_COLUMNS, TIMETABLE_NOTE, clock, nextSession, readerZone, until, yourTimeColumn } from '../queries/sessions.js'
import { rows, useQueries } from '../data/useQuery.js'
import { finished, missing, number, result } from '../lib/format.js'
import { SHARED } from '../lib/site.js'
import { outlineCaption } from '../lib/outline.js'
import { RACE_IMAGES } from '../queries/photographs.js'
import {
  CLASSIFICATION_COLUMNS,
  CLASSIFICATION_FOOTER,
  ENTRIES,
  FASTEST_LAP,
  NEIGHBOURS,
  PITS,
  PITS_FOOTER,
  PIT_COLUMNS,
  QUALIFYING,
  QUALIFYING_FOOTER,
  RACE,
  SHARED_DRIVE_NOTE,
  SPRINT,
  SPRINT_COLUMNS,
  SPRINT_FOOTER,
  inClassificationOrder,
  qualifyingColumns,
  raceLede,
  railOf,
} from '../queries/race.js'
import { colourForEntry } from '../lib/liveries.js'
import LiveryMark from '../components/LiveryMark.jsx'

/*
 * The React renders for the columns queries/race.js defines — the links, the
 * tags, the rail; the router is the reason they live here. The words each
 * cell carries are the column's own `text`, which scripts/prerender.js prints
 * too, so the static tables are these.
 */
const RAIL = {
  label: <span className="sr-only">Result</span>,
  render: (_, row) => <i className={railOf(row)} />,
}
const driverLink = {
  render: (name, row) =>
    row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name ?? row.driver_id}</Link> : cell(name),
}
/*
 * The constructor's colour mark beside its name (AF-04): the livery from
 * 2010, the national racing colour before 1968, a transparent spacer between
 * and wherever the colour is unknown - so the names stay aligned and a grey
 * bar never reads as a colour. The year is the race's, which is why these
 * renders are built per page rather than once.
 */
const constructorLink = (year) => ({
  render: (name, row) => (
    <>
      <LiveryMark
        colour={colourForEntry({ constructorId: row.constructor_id, country: row.constructor_country, year, team: name })}
        year={year}
      />
      {row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name)}
    </>
  ),
})
const outTag = {
  render: (value, row) =>
    finished(value, row.finish_position) ? 'Finished' : missing(value) ? cell(value) : <span className="tag">{value}</span>,
}

const classificationRenders = (year) => ({
  rail: RAIL,
  position_text: {
    render: (_, row) => {
      const value = result(row)
      return missing(row.finish_position) ? <span className="tag tag-dnf">{value}</span> : <b>{value}</b>
    },
  },
  driver: {
    // The mark follows the row, not the link: driverName() in queries/race.js
    // is what this cell says, with or without a driver id.
    render: (name, row) => (
      <>
        {row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name ?? row.driver_id}</Link> : cell(name)}
        {row.shared_drive === 1 ? ' ' : ''}
        {row.shared_drive === 1 ? <span className="tag">{SHARED}</span> : null}
      </>
    ),
  },
  constructor: {
    render: (name, row) => (
      <>
        <LiveryMark
          colour={colourForEntry({ constructorId: row.constructor_id, country: row.constructor_country, year, team: name })}
          year={year}
        />
        {row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(row.entrant ?? name)}
      </>
    ),
  },
  chassis: {
    render: (name, row) =>
      row.chassis_id ? <Link to={`/cars/${row.chassis_id}`}>{name ?? row.chassis_id}</Link> : cell(name),
  },
  status: outTag,
  fastest_lap: {
    render: (value) =>
      value === 1 ? (
        <>
          <span className="fl" aria-hidden="true">●</span>
          <span className="sr-only">{FASTEST_LAP}</span>
        </>
      ) : (
        ''
      ),
  },
})

const qualifyingRenders = (year) => ({ driver: driverLink, constructor: constructorLink(year) })

const sprintRenders = (year) => ({ rail: RAIL, driver: driverLink, constructor: constructorLink(year), status: outTag })

const PITS_APP = {
  driver: {
    render: (name, row) =>
      row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name ?? row.driver_id}</Link> : cell(name ?? row.driver_key),
  },
}

const withRenders = (columns, renders) => columns.map((column) => ({ ...column, ...renders[column.key] }))

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
    sessions: [RACE_SESSIONS, args],
    images: [RACE_IMAGES, args],
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
  const sprint = useMemo(() => inClassificationOrder(rows(data, 'sprint')), [data])
  const neighbours = data.neighbours.rows[0] ?? {}
  const sessions = rows(data, 'sessions')
  const zone = readerZone()
  // One reading of the clock for both the choice of session and the countdown.
  const now = Date.now()
  const upcoming = nextSession(sessions, now)

  // In the order a classification is printed; queries/race.js says why.
  const classified = useMemo(() => inClassificationOrder(entries), [entries])

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
      lede={raceLede(race, winners)}
      aside={
        <Stepper
          previous={neighbours.previous ? { to: `/races/${neighbours.previous}`, label: 'Previous race' } : null}
          next={neighbours.next ? { to: `/races/${neighbours.next}`, label: 'Next race' } : null}
        />
      }
    >
      <Section>
        {/* The outline beside the figures, where the circuit used to be a
            text link alone (VD-32). F1DB's drawing of the layout this race
            ran, credited on the card; the caption says whose figures. */}
        <div className={race.outline ? 'with-outline' : undefined}>
          <Stats
            items={[
              {
                // VD-28: a name is set in the sans face at a reading size by
                // the rule in app.css, not by an inline size on this one link
                // - which is what was here, this fix applied by hand to the
                // first tile that needed it while four others went without.
                label: 'Circuit',
                kind: 'name',
                value: race.circuit_id ? (
                  <Link to={`/circuits/${race.circuit_id}`}>{race.circuit}</Link>
                ) : null,
                note: [race.locality, race.country].filter(Boolean).join(', ') || undefined,
              },
              scheduled
                ? { label: 'Status', value: 'Scheduled', note: race.dates ?? undefined }
                : { label: 'Winner', kind: 'name', value: nameList(winners), note: winners[0]?.constructor ?? undefined },
              scheduled ? null : { label: 'Pole', kind: 'name', value: nameList(poles) },
              scheduled || !startedFirst
                ? null
                : {
                    label: 'Started first',
                    kind: 'name',
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
                    kind: 'name',
                    value: (
                      <Link to={`/drivers/${outqualified.driver_id}`}>
                        {outqualified.driver ?? outqualified.driver_id}
                      </Link>
                    ),
                    note: `started ${
                      entries.find((e) => e.driver_id === outqualified.driver_id)?.grid_text ?? '—'
                    }${race.sprint ? ', the grid set by the sprint' : ''}`,
                  },
              scheduled ? null : { label: 'Fastest lap', kind: 'name', value: nameList(fastest) },
              {
                label: 'Entries',
                value: number(entries.length),
                note: scheduled ? undefined : `${finishers} classified`,
              },
            ].filter(Boolean)}
          />
          {race.outline && (
            <OutlineCard
              path={race.outline}
              circuit={race.circuit}
              layoutId={race.f1db_layout_id}
              caption={outlineCaption({
                f1db_layout_id: race.f1db_layout_id,
                length_km: race.outline_km,
                turns: race.outline_turns,
              })}
              rule
            />
          )}
        </div>
      </Section>

      {scheduled && (
        <Note>
          <strong>This race has not been run.</strong> It is on the {year} calendar and carries no
          result yet.
        </Note>
      )}

      {/* The cars entered, the best finisher first (VD-33). Six of them,
          captioned with the car each one is - a race is twenty machines and an
          uncaptioned strip is twenty red cars. */}
      <Photographs images={rows(data, 'images')} subjects />

      {sessions.length > 0 && (
        <Section title="Timetable" count={`${sessions.length} sessions`}>
          <DataTable
            rows={sessions}
            rowKey={(row) => row.kind}
            sortable={false}
            columns={[...SESSION_COLUMNS, ...(zone ? [yourTimeColumn(zone)] : [])]}
            footer={TIMETABLE_NOTE}
          />
          {upcoming && (
            <p className="note" style={{ marginTop: 10 }}>
              Next: {upcoming.name}, {clock(upcoming.start_utc, upcoming.zone)} at the circuit — {until(upcoming.start_utc, now)}.
            </p>
          )}
        </Section>
      )}

      <Disagreement rows={rows(data, 'disagreements')} what="this race" />

      {shared && (
        <Note>
          <strong>{SHARED_DRIVE_NOTE.head}</strong> {SHARED_DRIVE_NOTE.body}
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
            columns={withRenders(CLASSIFICATION_COLUMNS, classificationRenders(year))}
            footer={CLASSIFICATION_FOOTER}
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
            columns={withRenders(qualifyingColumns(qualifying), qualifyingRenders(year))}
            footer={QUALIFYING_FOOTER}
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
            columns={withRenders(SPRINT_COLUMNS, sprintRenders(year))}
            footer={SPRINT_FOOTER}
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
            columns={withRenders(PIT_COLUMNS, PITS_APP)}
            footer={PITS_FOOTER}
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
