import { useEffect, useState } from 'react'
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
import { rows, useQueries } from '../data/useQuery.js'
import { EMPTY, number, raceDates } from '../lib/format.js'
import { colourForEntry } from '../lib/liveries.js'
import { ownColour } from '../charts/own.js'
import { resultsPending } from '../lib/refresh.js'
import { NAMES } from '../lib/site.js'

import { LATEST } from '../queries/races.js'
import { STARTS_COLUMNS, startsLabel, startsNote, startsTable, winnerStarts } from '../queries/circuit.js'
import { FIGHT_QUERIES, currentTitle, fightAhead, reachFigures, teamsByDriver } from '../queries/season.js'
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
  PODIUM_LABEL,
  THIS_WEEKEND,
  homeCycle,
  podium,
  reachHeading,
  sessionsClock,
  startsHeadingAt,
  BOARD,
  BOARD_HEADING,
  BOARD_NOTE,
  CHART_HEADING,
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
  openingCaption,
  openingRace,
  reading,
  stillToRunNote,
  seasonHeading,
  seasonComplete,
  seasonLink,
  seasonStrip,
  strip,
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
 * The last race's top three as steps (AF-135): read first to third, and
 * stood second, first, third by app.css. Each step names its place, driver
 * and team, so the team's colour is never the only cue; a team with no
 * colour on record stands as an outline.
 */
function Podium({ steps }) {
  return (
    <ol className="podium" aria-label={PODIUM_LABEL}>
      {steps.map((step) => {
        const own = ownColour(step.colour)
        return (
          <li key={step.place} className={`podium-step podium-${step.place}`}>
            <span className="podium-place">{step.ordinal}</span>{' '}
            <span className="podium-driver">
              {step.driver_id ? <Link to={`/drivers/${step.driver_id}`}>{step.driver}</Link> : step.driver}
            </span>{' '}
            <span className="podium-team muted small">{step.constructor ?? EMPTY}</span>
            <span
              className={own.className ? `podium-block ${own.className}` : 'podium-block podium-block-none'}
              style={own.style}
              aria-hidden="true"
            />
          </li>
        )
      })}
    </ol>
  )
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
          const ahead = fightAhead(fight, next)
          const sessions = rows(data, 'sessions')
          const cycle = homeCycle({ now, latest, next, sessions }, clock)
          // The weekend as a lap (AF-156), at the reader's clock.
          const lap = cycle.state === CYCLE.weekend ? lapLayout(next.outline, sessions, clock) : null
          const zone = readerZone()
          // The next round's forecast (AF-143), asked for in the app alone.
          const forecast = forecastRequest({ cycle: cycle.state, next, sessions, point: data.forecastPoint.rows[0] }, clock)
          const steps = cycle.state === CYCLE.results ? podium(rows(data, 'podium')) : null
          // The title fight after this race: the first title still fought.
          const reach =
            cycle.state === CYCLE.results && fight
              ? (reachFigures(fight, fight.year, teamsByDriver(rows(data, 'fightTeams')))[0] ?? null)
              : null
          // The next circuit's winners and where they started (AF-133).
          const starts = cycle.state === CYCLE.off ? [] : winnerStarts(rows(data, 'nextStarts'))
          const startsRows = startsTable(starts)
          const history = Boolean(next?.circuit) && startsRows.some((row) => row.key.startsWith('slot-'))
          // The winning car's colour (AF-47 clause 1: the constructor is a
          // first-class attribute of the race), in the race's own season, as
          // /races draws it beside the same name. One mark for the sentence,
          // beside the constructor and not the driver, which is clause 3.
          // LiveryMark is given no `year`: its spacer exists to keep a table
          // column's names aligned and there is no column here, so a season
          // without a colour leaves the prose as it reads today.
          const winnerColour = latest
            ? colourForEntry({
                constructorId: latest.constructor_id,
                country: latest.constructor_country,
                year: latest.year,
                team: latest.constructor,
              })
            : null

          return (
            <>
              <Section>
                <Stats items={strip(shape)} />
              </Section>

              {/* The season being run: what it is up to, who leads it and who
                  is in the cars (PD-48), then the round either side of today.
                  scripts/prerender.js draws this same block from the same
                  module, so the static half opens on it too. */}
              {now ? (
                <Section title={seasonHeading(now.year)}>
                  <Stats items={seasonStrip(now, lead)} />
                  <div className="split">
                    <div className="round-panel">
                      <p className="eyebrow">{LAST_RACE}</p>
                      {latest && steps ? (
                        <>
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
                          <Podium steps={steps} />
                          <p>
                            <Link to={`/races/${latest.year}/${latest.round}`}>{CLASSIFICATION_LINK}</Link>
                          </p>
                        </>
                      ) : latest ? (
                        <>
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
                          <p>
                            {WON_BY}
                            {latest.winner_id ? (
                              <Link to={`/drivers/${latest.winner_id}`}>{latest.winner}</Link>
                            ) : (
                              UNRECORDED_WINNER
                            )}
                            {latest.constructor ? (
                              <>
                                {WON_FOR}
                                <LiveryMark colour={winnerColour} />
                                {latest.constructor_id ? (
                                  <Link to={`/constructors/${latest.constructor_id}`}>{latest.constructor}</Link>
                                ) : (
                                  latest.constructor
                                )}
                              </>
                            ) : null}
                            .
                          </p>
                          <p>
                            <Link to={`/races/${latest.year}/${latest.round}`}>{CLASSIFICATION_LINK}</Link>
                          </p>
                        </>
                      ) : null}
                    </div>
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

              {/* The opening slot (VD-92, DR-06): the outline of the last
                  race run, or of the opener before a season has run one
                  (openingRace), beside the header from 1180 px. Written
                  after the season block, as a race writes its outline after
                  its classification, so below 1180 it follows the block that
                  names the race rather than standing between the tiles and
                  the season. scripts/prerender.js writes the same card. */}
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

              <Section title={BOARD_HEADING} note={BOARD_NOTE}>
                <Board shape={shape} />
              </Section>

              <Section title={CHART_HEADING}>
                <Figure
                  note={chartNote(seasons)}
                  table={{
                    rows: seasons,
                    columns: [
                      { key: 'year', label: 'Season', align: 'num', rowHeader: true, text: (year) => String(year) },
                      { key: 'rounds', label: 'Rounds', align: 'num' },
                    ],
                  }}
                >
                  <ColumnChart
                    data={chartData(seasons)}
                    labelEvery={1}
                    height={200}
                    label={chartLabel(shape)}
                  />
                </Figure>
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
