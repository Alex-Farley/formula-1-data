import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dated, RaceDates, TimeText } from '../components/Dates.jsx'
import { FigurePart, Page, Section, Slot, Stats } from '../components/Page.jsx'
import { OutlineCard, WeekendLap } from '../components/Outline.jsx'
import { Result } from '../components/States.jsx'
import Figure from '../charts/Figure.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import GridStarts from '../charts/GridStarts.jsx'
import ReachChart from '../charts/ReachChart.jsx'
import { drawnColours } from '../charts/gridStarts.js'
import LiveryMark from '../components/LiveryMark.jsx'
import Podium from '../components/Podium.jsx'
import SeasonPlate from '../components/SeasonPlate.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number, raceDates } from '../lib/format.js'
import { colourForEntry } from '../lib/liveries.js'
import { resultsPending } from '../lib/refresh.js'
import { NAMES } from '../lib/site.js'

import { LATEST } from '../queries/races.js'
import { STARTS_COLUMNS, startsLabel, startsNote, startsTable, winnerStarts } from '../queries/circuit.js'
import { FIGHT_QUERIES, currentTitle, reachFigures, teamsByDriver } from '../queries/season.js'
import { readerZone, until } from '../queries/sessions.js'
import { LAP_WORDS, lapLayout } from '../lib/lap.js'
import {
  FORECAST_LICENCE,
  FORECAST_WORD,
  FRESH_MS,
  dayName,
  forecastRequest,
  loadForecast,
  outlookDays,
  readForecast,
  sessionForecasts,
  updatedAt,
} from '../lib/forecast.js'
import { WEATHER_CREDIT, WEATHER_MARKS } from '../queries/race.js'
import {
  CYCLE,
  FIGHT_TEAMS,
  FORECAST_POINT,
  NEXT_SESSIONS,
  NEXT_STARTS,
  PODIUM,
  THIS_WEEKEND,
  DB_LINE_LEAD,
  DB_LINE_LINK,
  dbLine,
  homeAhead,
  homeCycle,
  homePlate,
  lastPodium,
  reachHeading,
  sessionsClock,
  startsHeadingAt,
  BOARD,
  BOARD_HEADING,
  BOARD_NOTE,
  CHART_COLUMNS,
  CHART_HEADING,
  CHART_HEIGHT,
  CLASSIFICATION_LINK,
  LAST_RACE,
  LEDE,
  NEXT,
  NEXT_RACE,
  NEXT_SEASON,
  NOTHING_SCHEDULED,
  PER_SEASON,
  READING_HEADING,
  READING_NOTE,
  SEASON_LEAD,
  SEASON_NOW,
  SHAPE,
  UNRECORDED_WINNER,
  WON_BY,
  WON_FOR,
  calendarLink,
  chartData,
  chartLabel,
  chartNote,
  chartNotes,
  openingCaption,
  openingRace,
  reading,
  stillToRunNote,
  seasonHeading,
  seasonComplete,
  seasonLink,
  seasonStrip,
} from '../queries/home.js'

/**
 * The reader's clock, read again each minute, so the block moves on to the
 * weekend or the preview while the page is open rather than at a reload.
 */
function useClock(every = 60000) {
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), every)
    return () => clearInterval(id)
  }, [every])
  return clock
}

/**
 * Open-Meteo's answer for a forecastRequest() (AF-143), once it has come:
 * `{ json, at }`, or null while it is coming, where it failed, and where
 * nothing is asked for. Fetched in the browser after the page has drawn,
 * never by the prerenderer, so the static page has no forecast. Asked for
 * again each FRESH_MS of `clock`, so a page left open does not keep an old
 * answer; a failed fetch then clears the old one rather than leave it up.
 */
function useForecast(request, clock) {
  const url = request?.url ?? null
  const period = Math.floor(clock / FRESH_MS)
  const [answer, setAnswer] = useState(null)
  useEffect(() => {
    if (!url) return undefined
    let live = true
    loadForecast(url, undefined, period * FRESH_MS).then(
      (got) => {
        if (live) setAnswer({ url, ...got })
      },
      // Fails closed: a refused or failed fetch shows nothing.
      () => {
        if (live) setAnswer(null)
      },
    )
    return () => {
      live = false
    }
  }, [url, period])
  return answer && answer.url === url ? answer : null
}

/** A forecast's mark, in the line's ink, beside the word that says the same. */
function ForecastFigure({ figure, className }) {
  return (
    <span className={className}>
      {figure.mark && (
        <svg className="weather-mark" viewBox="0 0 16 16" aria-hidden="true">
          <path d={WEATHER_MARKS[figure.mark]} />
        </svg>
      )}
      {figure.text}
    </span>
  )
}

/** The credit Open-Meteo asks for, beside its figures, with when they came. */
function ForecastCredit({ at, zone, clock }) {
  const updated = updatedAt(at, zone, undefined, clock)
  return (
    <p className="forecast-credit muted small">
      {FORECAST_WORD} ·{' '}
      <a href={WEATHER_CREDIT.href} target="_blank" rel="noreferrer noopener">
        {WEATHER_CREDIT.text}
      </a>{' '}
      (
      <a href={FORECAST_LICENCE.href} target="_blank" rel="noreferrer noopener">
        {FORECAST_LICENCE.text}
      </a>
      ){updated ? ` · updated ${updated}` : null}
    </p>
  )
}

/**
 * The next round's outlook before its weekend (AF-143): a line a day, for
 * the days Open-Meteo gave a figure for, and nothing at all where it gave
 * none or the fetch failed.
 */
function Outlook({ request, zone, clock }) {
  const answer = useForecast(request, clock)
  const lines = answer ? outlookDays(readForecast(answer.json, request), request.days) : []
  if (lines.length === 0) return null
  return (
    <>
      <ul className="forecast-days">
        {lines.map((line) => (
          <li key={line.day}>
            <span>{dayName(line.day)}</span>
            <ForecastFigure figure={line} />
          </li>
        ))}
      </ul>
      <ForecastCredit at={answer.at} zone={zone} clock={clock} />
    </>
  )
}

/**
 * The weekend's sessions as words, the text the lap stands for (AF-156):
 * each one's mark and state as the lap draws it, its name, and its start on
 * the reader's clock; and, in the app, the forecast for each session still
 * to start (AF-143), under it.
 */
function WeekendSessions({ sessions, lap, zone, request, clock }) {
  const answer = useForecast(request, clock)
  const forecasts = answer ? sessionForecasts(readForecast(answer.json, request), sessions, request.zone, clock) : []
  return (
    <>
      <p className="muted small">{sessionsClock(zone)}</p>
      <ol className="weekend-sessions">
        {sessions.map((s, k) => {
          const state = lap?.stops[k]?.state
          const forecast = forecasts[k]
          return (
            <li key={s.kind} data-state={state}>
              <span>
                {state && <i className="lap-mark" aria-hidden="true" />}
                {s.name}
                {state && <span className="sr-only">, {LAP_WORDS[state]}</span>}
              </span>
              <TimeText iso={s.start_utc} zone={zone ?? 'UTC'} />
              {forecast && <ForecastFigure figure={forecast} className="weekend-forecast" />}
            </li>
          )
        })}
      </ol>
      {forecasts.some(Boolean) && <ForecastCredit at={answer.at} zone={zone} clock={clock} />}
    </>
  )
}

/**
 * What the database holds, in one line under the season plate (VD-109):
 * queries/home.js dbLine()'s counts, each figure in bold, and the way to how
 * far they can be trusted. scripts/prerender.js writes the same line.
 */
function HoldingsLine({ shape }) {
  return (
    <p className="db-line">
      {DB_LINE_LEAD}
      {dbLine(shape).map((part, k) => (
        <Fragment key={part.words}>
          {k > 0 ? ' · ' : null}
          <b>{part.value}</b> {part.words}
        </Fragment>
      ))}
      . <Link to={DB_LINE_LINK.to}>{DB_LINE_LINK.text}</Link>
    </p>
  )
}

/**
 * The last race run, as a round panel: its name, place and dates, then its
 * podium with where each driver started (VD-109, in every state of the
 * cycle), or, where podium() declines a shared or empty place, who won it
 * for whom. Beside the champion on the season plate, or in the season block
 * where there is no plate.
 */
function LastRace({ latest, steps }) {
  // The winning car's colour (AF-47 clause 1: the constructor is a
  // first-class attribute of the race), in the race's own season, as
  // /races draws it beside the same name. One mark for the sentence,
  // beside the constructor and not the driver, which is clause 3.
  // LiveryMark is given no `year`: its spacer exists to keep a table
  // column's names aligned and there is no column here, so a season
  // without a colour leaves the prose as it reads today. It is given
  // `prose`, because a word precedes it here, and it rides in a
  // .livery-prose-pair with the name, so a line never breaks between
  // the two (VD-45).
  const winnerColour = colourForEntry({
    constructorId: latest.constructor_id,
    country: latest.constructor_country,
    year: latest.year,
    team: latest.constructor,
  })
  return (
    <div className="round-panel">
      <p className="eyebrow">{LAST_RACE}</p>
      <h3>
        <Link to={`/races/${latest.year}/${latest.round}`}>
          {latest.year} {latest.name_used}
        </Link>
      </h3>
      <p className="muted small">
        {latest.circuit}
        {latest.circuit && raceDates(latest) ? ' · ' : null}
        {raceDates(latest) ? <RaceDates race={latest} /> : null}
      </p>
      {steps ? (
        <Podium steps={steps} />
      ) : (
        <p>
          {WON_BY}
          {latest.winner_id ? <Link to={`/drivers/${latest.winner_id}`}>{latest.winner}</Link> : UNRECORDED_WINNER}
          {latest.constructor ? (
            <>
              {WON_FOR}
              <span className="livery-prose-pair">
                <LiveryMark colour={winnerColour} prose />
                {latest.constructor_id ? (
                  <Link to={`/constructors/${latest.constructor_id}`}>{latest.constructor}</Link>
                ) : (
                  <span>{latest.constructor}</span>
                )}
              </span>
            </>
          ) : null}
          .
        </p>
      )}
      <p>
        <Link to={`/races/${latest.year}/${latest.round}`}>{CLASSIFICATION_LINK}</Link>
      </p>
    </div>
  )
}

function Board({ shape }) {
  return (
    <div className="board index">
      {BOARD.map(({ to, label, count, blurb }) => (
        <Link key={to} to={to}>
          <b>
            {label}
            {count ? <span className="n">{number(shape[count])}</span> : null}
          </b>
          <p>{blurb}</p>
        </Link>
      ))}
    </div>
  )
}

export default function Home() {
  const state = useQueries({
    shape: [SHAPE],
    perSeason: [PER_SEASON],
    latest: [LATEST],
    next: [NEXT],
    nextSeason: [NEXT_SEASON],
    now: [SEASON_NOW],
    lead: [SEASON_LEAD],
    // Who can still win (AF-132), the season page's answer, under the next race.
    ...FIGHT_QUERIES,
    // The season cycle (AF-135): the next round's timetable, the last
    // race's podium, the contenders' colours and the next circuit's winners.
    sessions: [NEXT_SESSIONS],
    podium: [PODIUM],
    fightTeams: [FIGHT_TEAMS],
    nextStarts: [NEXT_STARTS],
    // Where the next round's forecast is asked for (AF-143).
    forecastPoint: [FORECAST_POINT],
  })
  const clock = useClock()

  const { headline, title } = NAMES.home()

  return (
    <Page title={headline} documentName={title} lede={LEDE}>
      <Result state={state}>
        {(data) => {
          const shape = data.shape.rows[0]
          const seasons = rows(data, 'perSeason')
          const latest = data.latest.rows[0]
          const next = data.next.rows[0]
          // The season after this one, named only when this one is over.
          const after = data.nextSeason.rows[0]?.year ?? null
          const now = data.now.rows[0]
          const lead = rows(data, 'lead')
          const opening = openingRace(latest, next, now)
          const caption = opening ? openingCaption(opening) : null
          const fight = currentTitle((key) => rows(data, key))
          // The season plate (VD-109): who leads the season being run, by
          // how much, and where any title on the record was settled, in
          // place of the strip of row counts that used to open the page.
          const plate = homePlate({ now, lead, title: fight })
          // What the next race says of the titles, less what the plate says.
          const ahead = homeAhead(fight, next, plate?.said)
          const sessions = rows(data, 'sessions')
          const cycle = homeCycle({ now, latest, next, sessions }, clock)
          // The weekend as a lap (AF-156), at the reader's clock.
          const lap = cycle.state === CYCLE.weekend ? lapLayout(next.outline, sessions, clock) : null
          const zone = readerZone()
          // The next round's forecast (AF-143), asked for in the app alone.
          const forecast = forecastRequest({ cycle: cycle.state, next, sessions, point: data.forecastPoint.rows[0] }, clock)
          // The last race's podium, in every state of the cycle (VD-109).
          const steps = latest ? lastPodium(rows(data, 'podium')) : null
          const last = latest ? <LastRace latest={latest} steps={steps} /> : null
          // The title fight after this race: the first title still fought.
          const reach =
            cycle.state === CYCLE.results && fight
              ? (reachFigures(fight, fight.year, teamsByDriver(rows(data, 'fightTeams')))[0] ?? null)
              : null
          // The next circuit's winners and where they started (AF-133).
          const starts = cycle.state === CYCLE.off ? [] : winnerStarts(rows(data, 'nextStarts'))
          const startsRows = startsTable(starts)
          const history = Boolean(next?.circuit) && startsRows.some((row) => row.key.startsWith('slot-'))

          return (
            <>
              {/* The season plate (VD-109) with the last race beside it,
                  and under them what the database holds, in a line.
                  scripts/prerender.js draws the same block from the same
                  module, so the static half opens on it too. */}
              <Section>
                <SeasonPlate plate={plate} aside={last} />
                <HoldingsLine shape={shape} />
              </Section>

              {/* The opening slot (VD-92, DR-06): the outline of the last
                  race run, or of the opener before a season has run one
                  (openingRace), beside the header from 1180 px. Written
                  after the plate, as a race writes its outline after its
                  classification, so below 1180 it follows the block that
                  names the race rather than standing between the header
                  and the season. scripts/prerender.js writes the same card. */}
              <Slot>
                {opening && (
                  <OutlineCard
                    path={opening.race.outline}
                    circuit={opening.race.circuit}
                    layoutId={opening.race.f1db_layout_id}
                    caption={
                      <>
                        {caption.text}
                        {caption.dates ? (
                          <>
                            , <RaceDates race={caption.dates} />
                          </>
                        ) : null}
                        .
                      </>
                    }
                  />
                )}
              </Slot>

              {/* The season being run: who is in the cars (PD-48), then the
                  round either side of today - the last one here only where
                  there is no plate to stand beside. */}
              {now ? (
                <Section title={seasonHeading(now.year)}>
                  <Stats items={seasonStrip(now, plate)} />
                  <div className="split">
                    {plate ? null : last}
                    <div className="round-panel">
                      <p className="eyebrow">{cycle.state === CYCLE.weekend ? THIS_WEEKEND : NEXT_RACE}</p>
                      {next && cycle.state === CYCLE.weekend ? (
                        <>
                          <h3>
                            <Link to={`/races/${next.year}/${next.round}`}>
                              {next.year} {next.name_used}
                            </Link>
                          </h3>
                          <p className="muted small">
                            <RaceDates race={next} /> · round {next.round}
                          </p>
                          {cycle.run && (
                            <p>
                              <Dated>{resultsPending(next)}</Dated>
                            </p>
                          )}
                          <WeekendLap race={next} lap={lap} zone={zone} until={lap?.next ? until(lap.next.start_utc, clock) : null} />
                          {sessions.length > 0 && (
                            <WeekendSessions sessions={sessions} lap={lap} zone={zone} request={forecast} clock={clock} />
                          )}
                          {ahead && <p>{ahead}</p>}
                          <p>
                            <Link to={`/seasons/${next.year}`}>{calendarLink(next.year)}</Link>
                          </p>
                        </>
                      ) : next ? (
                        <>
                          <h3>
                            <Link to={`/races/${next.year}/${next.round}`}>
                              {next.year} {next.name_used}
                            </Link>
                          </h3>
                          <p className="muted small">
                            <RaceDates race={next} /> · round {next.round}
                          </p>
                          <p className="muted">{stillToRunNote(now)}</p>
                          {forecast && <Outlook request={forecast} zone={zone} clock={clock} />}
                          {ahead && <p>{ahead}</p>}
                          <p>
                            <Link to={`/seasons/${next.year}`}>{calendarLink(next.year)}</Link>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="muted">{seasonComplete(now.year)}</p>
                          {after ? (
                            <p>
                              <Link to={`/seasons/${after}`}>{calendarLink(after)}</Link>
                            </p>
                          ) : (
                            <p className="muted">{NOTHING_SCHEDULED}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {reach && (
                    <FigurePart title={reachHeading(reach.title)}>
                      <Figure note={reach.note} table={{ rows: reach.rows, columns: reach.columns }}>
                        <ReachChart data={reach.data} lead={reach.lead} label={reach.label} />
                      </Figure>
                    </FigurePart>
                  )}
                  {history && (
                    <FigurePart title={startsHeadingAt(next.circuit)}>
                      <Figure note={startsNote(drawnColours(starts))} table={{ rows: startsRows, columns: STARTS_COLUMNS }}>
                        <GridStarts races={starts} label={startsLabel(startsRows)} />
                      </Figure>
                    </FigurePart>
                  )}
                  <p className="season-more">
                    <Link to={`/seasons/${now.year}`}>{seasonLink(now.year)}</Link>
                  </p>
                </Section>
              ) : null}

              <Section title={BOARD_HEADING} note={BOARD_NOTE}>
                <Board shape={shape} />
              </Section>

              <Section title={CHART_HEADING}>
                {(() => {
                  // The finding, the notes and where their markers stand,
                  // worked out from the rows (VD-123): the static page reads
                  // the same function.
                  const shown = chartNotes(seasons)
                  return (
                    <Figure
                      note={chartNote(seasons)}
                      finding={shown.finding}
                      kicker={shown.kicker}
                      annotations={shown.notes}
                      keyBeside
                      table={{ rows: seasons, columns: CHART_COLUMNS }}
                    >
                      <ColumnChart
                        data={chartData(seasons)}
                        labelEvery={1}
                        labelPeak={false}
                        height={CHART_HEIGHT}
                        label={chartLabel(shape)}
                        marks={shown.marks}
                        bands={shown.bands}
                      />
                    </Figure>
                  )
                })()}
              </Section>

              <Section title={READING_HEADING} note={READING_NOTE}>
                <div className="grid">
                  {reading(shape).map(({ head, body, link }) => (
                    <div className="convention" key={head}>
                      <b>{head}</b>
                      <p className="muted small">
                        {body[0]}
                        {link ? <Link to={link.to}>{link.text}</Link> : null}
                        {body[1] ?? ''}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* No onward band: the index above is home's one way on
                  (VD-93). The band's four routes are the index's doors, the
                  SQL console behind one of them, and the season block's
                  link. */}
            </>
          )
        }}
      </Result>
    </Page>
  )
}
