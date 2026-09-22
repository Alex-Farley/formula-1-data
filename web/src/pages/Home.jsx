import { Link } from 'react-router-dom'
import { Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import Figure from '../charts/Figure.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number } from '../lib/format.js'
import { colourForEntry } from '../lib/liveries.js'
import { NAMES } from '../lib/site.js'

import { LATEST } from '../queries/races.js'
import { ONWARD } from '../lib/wayfinding.js'
import {
  BOARD,
  BOARD_HEADING,
  BOARD_NOTE,
  CHART_HEADING,
  CHART_TITLE,
  CLASSIFICATION_LINK,
  LAST_RACE,
  LEDE,
  NEXT,
  NEXT_RACE,
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
  chartLabel,
  chartNote,
  reading,
  stillToRunNote,
  seasonHeading,
  seasonLink,
  seasonStrip,
  strip,
} from '../queries/home.js'

function Board({ shape }) {
  return (
    <div className="board">
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
    now: [SEASON_NOW],
    lead: [SEASON_LEAD],
  })

  const { headline, title } = NAMES.home()

  return (
    <Page title={headline} documentName={title} lede={LEDE}>
      <Result state={state}>
        {(data) => {
          const shape = data.shape.rows[0]
          const seasons = rows(data, 'perSeason')
          const latest = data.latest.rows[0]
          const next = data.next.rows[0]
          const now = data.now.rows[0]
          const lead = rows(data, 'lead')
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
                    <div className="panel round-panel">
                      <p className="eyebrow">{LAST_RACE}</p>
                      {latest ? (
                        <>
                          <h3>
                            <Link to={`/races/${latest.year}/${latest.round}`}>
                              {latest.year} {latest.name_used}
                            </Link>
                          </h3>
                          <p className="muted small">
                            {[latest.circuit, latest.dates].filter(Boolean).join(' · ')}
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
                    <div className="panel round-panel">
                      <p className="eyebrow">{NEXT_RACE}</p>
                      {next ? (
                        <>
                          <h3>
                            <Link to={`/races/${next.year}/${next.round}`}>
                              {next.year} {next.name_used}
                            </Link>
                          </h3>
                          <p className="muted small">
                            {next.dates} · round {next.round}
                          </p>
                          <p className="muted">{stillToRunNote(shape.races_scheduled)}</p>
                          <p>
                            <Link to={`/seasons/${next.year}`}>{calendarLink(next.year)}</Link>
                          </p>
                        </>
                      ) : (
                        <p className="muted">{NOTHING_SCHEDULED}</p>
                      )}
                    </div>
                  </div>
                  <p className="season-more">
                    <Link to={`/seasons/${now.year}`}>{seasonLink(now.year)}</Link>
                  </p>
                </Section>
              ) : null}

              <Section title={BOARD_HEADING} note={BOARD_NOTE}>
                <Board shape={shape} />
              </Section>

              <Section title={CHART_HEADING}>
                <Figure
                  title={CHART_TITLE}
                  note={chartNote(seasons)}
                  table={{
                    rows: seasons,
                    columns: [
                      { key: 'year', label: 'Season', align: 'num' },
                      { key: 'rounds', label: 'Rounds', align: 'num' },
                    ],
                  }}
                >
                  <ColumnChart
                    data={seasons.map((s) => ({ key: s.year, value: s.rounds, label: s.year % 10 === 0 ? s.year : '' }))}
                    labelEvery={1}
                    height={200}
                    label={chartLabel(shape)}
                  />
                </Figure>
              </Section>

              <Section title={READING_HEADING} note={READING_NOTE}>
                <div className="grid">
                  {reading(shape).map(({ head, body, link }) => (
                    <div className="panel convention" key={head}>
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

              <Onward {...ONWARD.home({ latest })} />
            </>
          )
        }}
      </Result>
    </Page>
  )
}
