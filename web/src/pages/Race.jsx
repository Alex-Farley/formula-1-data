import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Slot, Stats, Stepper } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { UNFOLDED } from '../lib/table.js'
import { Dated, RaceDates } from '../components/Dates.jsx'
import Disagreement, { RACE_DISAGREEMENTS } from '../components/Disagreement.jsx'
import { OutlineCard } from '../components/Outline.jsx'
import Photographs from '../components/Photographs.jsx'
import { RACE_SESSIONS, SESSION_COLUMNS, TIMETABLE_NOTE, clock, nextSession, raceStage, readerZone, until, yourTimeColumn } from '../queries/sessions.js'
import { lateDays, readerDay } from '../lib/refresh.js'
import { rows, useQueries } from '../data/useQuery.js'
import { finished, missing, raceDates, result } from '../lib/format.js'
import {
  NAMES,
  RACE_CARS_NOTE,
  RACE_CARS_TITLE,
  RACE_PHOTOGRAPHS_NOTE,
  RACE_PHOTOGRAPHS_TITLE,
  SHARED,
  raceCategoryLink,
  racePhotographAlt,
  EYEBROWS,
  LABELS,
} from '../lib/site.js'
import { categoryUrl } from '../lib/commons.js'
import { outlineCaption } from '../lib/outline.js'
import { RACE_IMAGES, RACE_PHOTOGRAPHS } from '../queries/photographs.js'
import {
  CLASSIFICATION_COLUMNS,
  ENTRY_NOTE_MARK,
  ENTRY_NOTE_SPOKEN,
  ENTRIES,
  FASTEST_LAP,
  GRID_FLAG_COLUMNS,
  GRID_FLAG_HEADING,
  NEIGHBOURS,
  PITS,
  PITS_FROM,
  PITS_HEADING,
  PIT_ORDER_COLUMNS,
  PIT_ORDER_HEADING,
  PIT_ORDER_NOTE,
  QUALIFYING,
  QUALIFYING_FOOTER,
  RACE,
  RACE_SOURCES,
  SHARED_DRIVE_NOTE,
  SPRINT,
  SPRINT_COLUMNS,
  SPRINT_FOOTER,
  STINT_COLUMNS,
  carName,
  classificationFooter,
  hasEntryNote,
  gridFlagLabel,
  gridFlagNote,
  gridFlagUndrawn,
  inClassificationOrder,
  qualifyingColumns,
  raceLede,
  raceStrip,
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
  stintsEmpty,
  stintsLabel,
  stintsNote,
  stintsUnbarred,
} from '../queries/race.js'
import { colourForEntry } from '../lib/liveries.js'
import LiveryMark from '../components/LiveryMark.jsx'
import Figure from '../charts/Figure.jsx'
import GridFlag from '../charts/GridFlag.jsx'
import { gridFlagRows, gridFlagShown, undrawnOf } from '../charts/gridFlag.js'
import Stints from '../charts/Stints.jsx'
import { lateStops, pitPairs, stintRows, stintTableRows, stintsShown, unbarredOf } from '../charts/stints.js'

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
    // The marks follow the row, not the link: classifiedName() in
    // queries/race.js is what this cell says, with or without a driver id.
    render: (name, row) => (
      <>
        {row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name ?? row.driver_id}</Link> : cell(name)}
        {row.shared_drive === 1 ? ' ' : ''}
        {row.shared_drive === 1 ? <span className="tag">{SHARED}</span> : null}
        {hasEntryNote(row) && (
          <>
            {' '}
            <span aria-hidden="true">{ENTRY_NOTE_MARK}</span>
            <span className="sr-only">{ENTRY_NOTE_SPOKEN}</span>
          </>
        )}
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
    pitsFrom: [PITS_FROM],
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
  // PD-30: the cars the grid-to-flag figure draws, in the order it ends them.
  const flag = useMemo(() => gridFlagRows(entries), [entries])
  // PD-56: the drivers the stint figure draws, and the pairs the pit order reads.
  const stints = useMemo(() => stintRows(entries, pits), [entries, pits])
  const pairs = useMemo(() => pitPairs(entries, pits), [entries, pits])

  const winners = classified.filter((e) => e.finish_position === 1)
  // The pole, the car that started first, the fastest qualifier and the
  // fastest lap are the strip's, and queries/race.js's raceStrip says which.
  const shared = entries.some((e) => e.shared_drive === 1)
  const scheduled = race.status === 'scheduled'
  // SD-37: late by the reader's own date, and only with no result held - the
  // rule lib/refresh.js keeps for /changes too.
  const late = entries.length === 0 ? lateDays(race, readerDay(now)) : null
  // Late is shown whatever `status` says: a round authored `completed` by
  // hand with no result held is late on /changes, so it is late here too.
  const pending = scheduled || late !== null ? scheduledNote(race, stage, late) : null

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
        <p className="note follows">
          Next: {upcoming.name}, {clock(upcoming.start_utc, upcoming.zone)} at the circuit — {until(upcoming.start_utc, now)}.
        </p>
      )}
    </Section>
  )

  return (
    <Page
      eyebrow={EYEBROWS.race(round, neighbours.rounds, race.date_iso)}
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
        {/* queries/race.js's strip, which the static page draws too (VD-49). */}
        <Stats items={raceStrip(race, entries, qualifying)} />
      </Section>

      {/* PD-57: what the reader came for, straight under the figures - the
          classification once a result is held, the timetable before. */}
      {pending && (
        <Note>
          <strong>{pending.head}</strong> <Dated>{pending.body}</Dated>
        </Note>
      )}

      {/* PD-57: before a round is run its timetable is the answer, so it
          leads; once a result is held it follows the strategy, near the
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
            unfolded={UNFOLDED.subject}
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

      {/* The opening slot (DP-11, VD-84): F1DB's drawing of the layout this
          race ran, credited on the card, beside the header from 1180 px.
          It is written after the classification, so below 1180 the result
          is never beside it and never under it: the table has the column
          to itself at every width (IX-45), and on a phone the outline
          follows the result (visual defect 7). */}
      <Slot>
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
      </Slot>

      {/* PD-30: the result as a picture, under the table it draws -
          charts/gridFlag.js says what the lines can and cannot claim,
          and scripts/prerender.js draws the same figure. */}
      {gridFlagShown(flag) && (
        <Section title={GRID_FLAG_HEADING}>
          <Figure
            note={gridFlagNote(flag)}
            table={{ rows: flag.map((r) => r.entry), columns: GRID_FLAG_COLUMNS, footer: gridFlagUndrawn(undrawnOf(entries)) }}
          >
            <GridFlag entries={entries} label={gridFlagLabel(flag)} />
          </Figure>
        </Section>
      )}

      {qualifying.length > 0 && (
        <Section title="Qualifying" count={`${qualifying.length} entries`}>
          <DataTable
            unfolded={UNFOLDED.subject}
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
            unfolded={UNFOLDED.subject}
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
            unfolded={UNFOLDED.subject}
            rows={sprintQualifying}
            rowKey={(row) => row.id}
            sortable={false}
            page={40}
            columns={withRenders(sprintQualifyingColumns(sprintQualifying), sessionRenders(year))}
            footer={sprintQualifyingFooter(sprintQualifying)}
          />
        </Section>
      )}

      {/* PD-56: each driver's race split at their stops, then who stopped
          first between neighbours - charts/stints.js says what neither can
          claim, and scripts/prerender.js draws the same. A race run with no
          figure says why, rather than losing the section. */}
      {!scheduled && classified.length > 0 && (
        <Section title={PITS_HEADING} count={pits.length > 0 ? `${pits.length} stops` : undefined}>
          {stintsShown(stints) ? (
            <>
              <Figure
                note={stintsNote(stints, lateStops(stints))}
                table={{ rows: stintTableRows(entries, pits), columns: STINT_COLUMNS, footer: stintsUnbarred(unbarredOf(entries, pits)) }}
              >
                <Stints entries={entries} pits={pits} label={stintsLabel(stints)} />
              </Figure>
              {pairs.length > 0 && (
                <>
                  <h3>{PIT_ORDER_HEADING}</h3>
                  <DataTable
                    unfolded={UNFOLDED.subject}
                    rows={pairs}
                    rowKey={(row) => `${row.ahead.id}-${row.behind.id}`}
                    caption={PIT_ORDER_HEADING}
                    sortable={false}
                    page={80}
                    columns={PIT_ORDER_COLUMNS}
                    footer={PIT_ORDER_NOTE}
                  />
                </>
              )}
            </>
          ) : (
            <p className="muted">{stintsEmpty(race, data.pitsFrom.rows[0])}</p>
          )}
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
                  unfolded={UNFOLDED.subject}
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

      {/* PD-57: once a result is held the timetable follows the result and
          the strategy, as the last of the page's own sections. */}
      {!scheduled && timetable}

      {/* The race's own photographs first, filed under its Commons category,
          then the cars entered, the best finisher first (VD-33), captioned
          with the car each one is - a race is twenty machines and an
          uncaptioned strip is twenty red cars. Each strip is headed with
          what it is (PD-64): a car's photograph was taken wherever its
          article's editors found it, and must not pass for this race's.
          Below the tables since PD-57, a reader having come for the result,
          and after every section of the page's own, before where they come
          from, as on every page type (VD-83). */}
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

      <Section title={LABELS.provenance}>
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
            { label: 'Dates', value: raceDates(race) === null ? null : <RaceDates race={race} /> },
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
