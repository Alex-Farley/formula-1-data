import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats, Stepper } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Disagreement, { RACE_DISAGREEMENTS } from '../components/Disagreement.jsx'
import { OutlineCard } from '../components/Outline.jsx'
import Photographs from '../components/Photographs.jsx'
import { RACE_SESSIONS, SESSION_COLUMNS, TIMETABLE_NOTE, clock, nextSession, raceStage, readerZone, until, yourTimeColumn } from '../queries/sessions.js'
import { rows, useQueries } from '../data/useQuery.js'
import { finished, missing, number, raceDates, result } from '../lib/format.js'
import {
  NAMES,
  RACE_CARS_NOTE,
  RACE_CARS_TITLE,
  RACE_PHOTOGRAPHS_NOTE,
  RACE_PHOTOGRAPHS_TITLE,
  SHARED,
  raceCategoryLink,
  racePhotographAlt,
} from '../lib/site.js'
import { categoryUrl } from '../lib/commons.js'
import { outlineCaption } from '../lib/outline.js'
import { RACE_IMAGES, RACE_PHOTOGRAPHS } from '../queries/photographs.js'
import {
  CLASSIFICATION_COLUMNS,
  ENTRIES,
  FASTEST_LAP,
  NEIGHBOURS,
  PITS,
  PITS_FOOTER,
  PIT_COLUMNS,
  QUALIFYING,
  QUALIFYING_FOOTER,
  RACE,
  RACE_SOURCES,
  SHARED_DRIVE_NOTE,
  SPRINT,
  SPRINT_COLUMNS,
  SPRINT_FOOTER,
  carName,
  classificationFooter,
  inClassificationOrder,
  qualifyingColumns,
  raceLede,
  railOf,
  scheduledNote,
  PRACTICE,
  PRACTICE_COLUMNS,
  PRACTICE_ONLY_MARK,
  PRACTICE_SUMMARY,
  SPRINT_QUALIFYING,
  practiceBySession,
  practiceFooter,
  practiceSummaryCount,
  sprintQualifyingColumns,
  sprintQualifyingFooter,
} from '../queries/race.js'
import { colourForEntry } from '../lib/liveries.js'
import LiveryMark from '../components/LiveryMark.jsx'

import { ONWARD, TRAIL, raceSteps } from '../lib/wayfinding.js'
/*
 * The React renders for the columns queries/race.js defines — the links, the
 * tags, the rail; the router is the reason they live here. The words each
 * cell carries are the column's own `text`, which scripts/prerender.js prints
 * too, so the static tables are these.
 */
const RAIL = {
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

/*
 * Every column of the classification sorts on what it means rather than on
 * the string it prints (IX-20): a position on the number, so a retirement
 * sinks in both directions as it does in the classification; a grid slot on
 * `grid`, so "PL" is not a slot; a car on the name the cell shows.
 */
const classificationRenders = (year) => ({
  rail: RAIL,
  position_text: {
    sort: (row) => row.finish_position,
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
    sort: (row) => carName(row),
    render: (name, row) => (
      <>
        <LiveryMark
          colour={colourForEntry({ constructorId: row.constructor_id, country: row.constructor_country, year, team: name })}
          year={year}
        />
        {row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(carName(row))}
      </>
    ),
  },
  chassis: {
    sort: (row) => row.chassis ?? row.chassis_id,
    render: (name, row) =>
      row.chassis_id ? <Link to={`/cars/${row.chassis_id}`}>{name ?? row.chassis_id}</Link> : cell(name),
  },
  grid_text: { sort: (row) => row.grid },
  status: { ...outTag, sort: (row) => (finished(row.status, row.finish_position) ? 'Finished' : row.status) },
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

/* A session sheet's driver: the link, and the mark with its meaning spoken
   for a screen reader, which would otherwise read a dagger. */
const sessionDriverLink = {
  render: (name, row) => (
    <>
      {driverLink.render(name, row)}
      {row.practice_only === 1 && (
        <>
          {' '}
          <span aria-hidden="true">{PRACTICE_ONLY_MARK}</span>
          <span className="sr-only">(never started a Grand Prix)</span>
        </>
      )}
    </>
  ),
}

const sessionRenders = (year) => ({ driver: sessionDriverLink, constructor: constructorLink(year) })

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
    practice: [PRACTICE, args],
    sprintQualifying: [SPRINT_QUALIFYING, args],
    sprint: [SPRINT, args],
    pits: [PITS, args],
    neighbours: [NEIGHBOURS, args],
    disagreements: [RACE_DISAGREEMENTS, args],
    sessions: [RACE_SESSIONS, args],
    images: [RACE_IMAGES, args],
    photographs: [RACE_PHOTOGRAPHS, args],
    sources: [RACE_SOURCES, args],
  })

  return (
    <Result state={state} context="That race could not be read">
      {(data) => {
        const race = data.race.rows[0]
        if (!race) {
          return (
            <Page title="No such race" cite={false} trail={TRAIL.missing('/races', 'Races')}>
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
  const practice = practiceBySession(rows(data, 'practice'))
  const sprintQualifying = rows(data, 'sprintQualifying')
  const pits = rows(data, 'pits')
  const photographs = rows(data, 'photographs')
  /* The sprint is a separate race on the same weekend, so it is ordered the
     same way a race is: finishers by position, then everyone else. */
  const sprint = useMemo(() => inClassificationOrder(rows(data, 'sprint')), [data])
  const neighbours = data.neighbours.rows[0] ?? {}
  const sessions = rows(data, 'sessions')
  const zone = readerZone()
  // One reading of the clock for both the choice of session and the countdown.
  const now = Date.now()
  const upcoming = nextSession(sessions, now)
  // Whether the race has happened, which is not what `status` records; the
  // browser is the half of the site that has a real clock to answer it with.
  const stage = raceStage(race, sessions, now)

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
  const pending = scheduled ? scheduledNote(race, stage) : null

  const timetable = sessions.length > 0 && (
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
  )

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
      title={NAMES.race(year, race.name_used).headline}
      documentName={NAMES.race(year, race.name_used).title}
      trail={TRAIL.race(year, round, race.name_used)}
      lede={raceLede(race, winners, stage)}
      sources={rows(data, 'sources')}
      aside={
        <Stepper {...raceSteps(neighbours)} />
      }
    >
      <Section>
        {/* The outline beside the figures, where the circuit used to be a
            text link alone (VD-32). F1DB's drawing of the layout this race
            ran, credited on the card; the caption says whose figures. */}
        <div className={race.outline ? 'with-outline with-lead' : undefined}>
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
                ? { label: 'Status', value: 'Scheduled', note: raceDates(race) ?? undefined }
                : {
                    label: 'Winner',
                    kind: 'name',
                    value: nameList(winners),
                    // The car by the classification's own rule, so the tile,
                    // the standfirst above it and the table below it name the
                    // same one on the eleven Indianapolis 500s (AF-64).
                    note: carName(winners[0]) ?? undefined,
                  },
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
              // No tile where no entry is held (PD-47, UR-20). A round not yet
              // run has no entries recorded, and "0" on this site is a
              // positive claim that nobody entered; the Status tile and the
              // note below already say what the round is. The static page
              // prints no entries figure at all, so the two now agree.
              entries.length === 0
                ? null
                : {
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
          {/* PD-57: what the reader came for, under the figures and beside
              the outline rather than below its caption - the classification
              once a result is held, the timetable before. On a phone the
              grid is one column and this follows the outline. */}
          <div className="lead">
            {pending && (
              <Note>
                <strong>{pending.head}</strong> {pending.body}
              </Note>
            )}

            {/* PD-57: before a round is run its timetable is the answer, so it
                leads; once a result is held it follows the photographs, near the
                end. `scheduled` rather than the clock's stage, because it is what
                the static page can know too, and a round past its date with no
                result held still has nothing to put above its timetable. */}
            {scheduled && timetable}

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
                  sortable
                  // Already in classification order, from inClassificationOrder().
                  opening={{ key: 'position_text', direction: 'asc' }}
                  page={60}
                  highlight={(row) => row.finish_position === 1}
                  columns={withRenders(CLASSIFICATION_COLUMNS, classificationRenders(year))}
                  footer={classificationFooter(classified)}
                />
              </Section>
            )}
          </div>
        </div>
      </Section>

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

      {sprintQualifying.length > 0 && (
        <Section title="Sprint qualifying" count={`${sprintQualifying.length} entries`}>
          <DataTable
            rows={sprintQualifying}
            rowKey={(row) => row.id}
            sortable={false}
            page={40}
            columns={withRenders(sprintQualifyingColumns(sprintQualifying), sessionRenders(year))}
            footer={sprintQualifyingFooter(sprintQualifying)}
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

      {/* PD-57: the session sheets after the result and the strategy, closed;
          queries/race.js says why, and the static page draws the same. */}
      {practice.length > 0 && (
        <section className="section">
          <details className="session-sheets">
            <summary>
              {PRACTICE_SUMMARY} <span className="count">{practiceSummaryCount(practice)}</span>
            </summary>
            {practice.map(({ session, title, rows: sheet }) => (
              <Section key={session} title={title} count={`${sheet.length} entries`}>
                <DataTable
                  rows={sheet}
                  rowKey={(row) => row.id}
                  sortable={false}
                  page={40}
                  columns={withRenders(PRACTICE_COLUMNS, sessionRenders(year))}
                  footer={practiceFooter(sheet)}
                />
              </Section>
            ))}
          </details>
        </section>
      )}

      {/* The race's own photographs first, filed under its Commons category,
          then the cars entered, the best finisher first (VD-33), captioned
          with the car each one is - a race is twenty machines and an
          uncaptioned strip is twenty red cars. Each strip is headed with
          what it is (PD-64): a car's photograph was taken wherever its
          article's editors found it, and must not pass for this race's.
          Below the tables since PD-57: a reader came for the result. */}
      <Photographs
        images={photographs}
        title={RACE_PHOTOGRAPHS_TITLE}
        note={RACE_PHOTOGRAPHS_NOTE}
        alt={racePhotographAlt(year, race.name_used)}
        checks={false}
        more={
          photographs[0]?.category
            ? { href: categoryUrl(photographs[0].category), label: raceCategoryLink(photographs[0].category) }
            : null
        }
      />
      <Photographs images={rows(data, 'images')} title={RACE_CARS_TITLE} note={RACE_CARS_NOTE} subjects />

      {!scheduled && timetable}

      <Section title="Where this comes from">
        <Fields
          items={[
            // The event this race is an edition of, and the way to every other
            // edition of it and every circuit it has used (IA-01). It was
            // printed as dead text for want of a page to link to.
            {
              label: 'Grand Prix',
              value: race.gp_id ? (
                <Link to={`/grands-prix/${race.gp_id}`}>{race.gp_full ?? race.name_used}</Link>
              ) : (
                race.name_used
              ),
            },
            { label: 'Dates', value: raceDates(race) },
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

      <Onward {...ONWARD.race({ race, year, winners, neighbours })} />
    </Page>
  )
}
