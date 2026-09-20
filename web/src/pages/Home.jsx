import { Link } from 'react-router-dom'
import { Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import Figure from '../charts/Figure.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number } from '../lib/format.js'
import { colourForEntry } from '../lib/liveries.js'

const SHAPE = `
  SELECT
    (SELECT COUNT(*) FROM races WHERE status = 'completed') AS races_run,
    (SELECT COUNT(*) FROM races WHERE status = 'scheduled') AS races_scheduled,
    (SELECT COUNT(*) FROM race_entries)   AS entries,
    (SELECT COUNT(*) FROM qualifying)     AS qualifying,
    (SELECT COUNT(*) FROM standings)      AS standings,
    (SELECT COUNT(*) FROM pit_stops)      AS pit_stops,
    (SELECT COUNT(*) FROM drivers)        AS drivers,
    (SELECT COUNT(*) FROM constructors)   AS constructors,
    (SELECT COUNT(*) FROM chassis)        AS chassis,
    (SELECT COUNT(*) FROM circuits)       AS circuits,
    (SELECT COUNT(*) FROM seasons)        AS seasons,
    (SELECT COUNT(*) FROM article_images WHERE route = 'article') AS images,
    (SELECT COUNT(*) FROM discrepancies)  AS discrepancies,
    (SELECT COUNT(*) FROM v_open_gaps)    AS gaps,
    (SELECT COUNT(*) FROM circuit_geometry) AS geometry,
    (SELECT MIN(year) FROM races)         AS from_year,
    (SELECT MAX(year) FROM races)         AS to_year
`

const PER_SEASON = `SELECT year, COUNT(*) AS rounds FROM races GROUP BY year ORDER BY year`

const LATEST = `
  SELECT r.year, r.round, r.name_used, r.dates, c.name AS circuit,
         d.full_name AS winner, d.id AS winner_id,
         k.name AS constructor, k.id AS constructor_id, k.country AS constructor_country
    FROM races r
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN race_entries e ON e.race_id = r.id AND e.finish_position = 1
    LEFT JOIN drivers d ON d.id = e.driver_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE r.status = 'completed'
   ORDER BY r.year DESC, r.round DESC
   LIMIT 1
`

const NEXT = `
  SELECT year, round, name_used, dates
    FROM races WHERE status = 'scheduled'
   ORDER BY year, round LIMIT 1
`

function Board({ shape }) {
  const cards = [
    ['/seasons', 'Seasons', shape.seasons, 'Championship tables, calendars and entry lists, year by year.'],
    ['/races', 'Races', shape.races_run, 'Every classification: grid, finish, status, laps and points.'],
    ['/drivers', 'Drivers', shape.drivers, 'Look up a career — every entry, season by season.'],
    ['/constructors', 'Constructors', shape.constructors, 'Team records, the cars they built, and who they became.'],
    ['/circuits', 'Circuits', shape.circuits, 'Venues, the layouts as they changed, and 25 traced laps.'],
    ['/cars', 'Cars', shape.chassis, 'The chassis register, with specifications where they exist.'],
    ['/records', 'Records', null, 'Leaderboards, champions, grand slams and who won each decade.'],
    ['/data', 'Data', null, 'The database itself: download it, query it, and see how far to trust it.'],
  ]
  return (
    <div className="board">
      {cards.map(([to, title, n, blurb]) => (
        <Link key={to} to={to}>
          <b>
            {title}
            {n ? <span className="n">{number(n)}</span> : null}
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
  })

  return (
    <Page
      title="Every Formula One race since 1950"
      lede={
        <>
          Seventy-seven seasons of results, grids, championship tables and pit stops — from
          Silverstone in May 1950 to the calendar still to be run. Search it, sort it, or write your
          own SQL. It all runs in this tab, so it is quick and nothing you look at is sent anywhere.
        </>
      }
    >
      <Result state={state}>
        {(data) => {
          const shape = data.shape.rows[0]
          const seasons = rows(data, 'perSeason')
          const latest = data.latest.rows[0]
          const next = data.next.rows[0]
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
                <Stats
                  items={[
                    { label: 'Races run', value: number(shape.races_run), note: `${shape.from_year}–${shape.to_year}` },
                    { label: 'Race entries', value: number(shape.entries), note: 'one row per driver per race' },
                    { label: 'Qualifying rows', value: number(shape.qualifying) },
                    { label: 'Standings rows', value: number(shape.standings), note: 'after every round' },
                    { label: 'Pit stops', value: number(shape.pit_stops), note: 'from 1994' },
                    { label: 'Photographs', value: number(shape.images), note: 'referenced, not stored' },
                  ]}
                />
              </Section>

              <Section title="The season, at both ends">
                <div className="split">
                  <div className="panel">
                    <p className="eyebrow" style={{ margin: 0 }}>Last race run</p>
                    {latest ? (
                      <>
                        <h3 style={{ margin: '6px 0 2px' }}>
                          <Link to={`/races/${latest.year}/${latest.round}`}>
                            {latest.year} {latest.name_used}
                          </Link>
                        </h3>
                        <p className="muted small" style={{ margin: 0 }}>
                          {[latest.circuit, latest.dates].filter(Boolean).join(' · ')}
                        </p>
                        <p style={{ margin: '10px 0 0' }}>
                          Won by{' '}
                          {latest.winner_id ? (
                            <Link to={`/drivers/${latest.winner_id}`}>{latest.winner}</Link>
                          ) : (
                            'an unrecorded driver'
                          )}
                          {latest.constructor ? (
                            <>
                              {' for '}
                              <LiveryMark colour={winnerColour} />
                              {latest.constructor}
                            </>
                          ) : null}
                          .
                        </p>
                        <p style={{ margin: '10px 0 0' }}>
                          <Link to={`/races/${latest.year}/${latest.round}`}>
                            See the full classification →
                          </Link>
                        </p>
                      </>
                    ) : null}
                  </div>
                  <div className="panel">
                    <p className="eyebrow" style={{ margin: 0 }}>Next on the calendar</p>
                    {next ? (
                      <>
                        <h3 style={{ margin: '6px 0 2px' }}>
                          <Link to={`/races/${next.year}/${next.round}`}>
                            {next.year} {next.name_used}
                          </Link>
                        </h3>
                        <p className="muted small" style={{ margin: 0 }}>
                          {next.dates} · round {next.round}
                        </p>
                        <p className="muted" style={{ margin: '10px 0 0' }}>
                          {number(shape.races_scheduled)} races on the calendar have not been run
                          yet, so they carry no result.
                        </p>
                        <p style={{ margin: '10px 0 0' }}>
                          <Link to={`/seasons/${next.year}`}>Open the {next.year} calendar →</Link>
                        </p>
                      </>
                    ) : (
                      <p className="muted">Nothing scheduled beyond the last recorded race.</p>
                    )}
                  </div>
                </div>
              </Section>

              <Section
                title="Where to start"
                note="Or press / from anywhere to jump straight to a driver, team, circuit, car, season or race."
              >
                <Board shape={shape} />
              </Section>

              <Section title="The shape of the championship">
                <Figure
                  title="Championship races per season"
                  note="Seven rounds in 1950; twenty-four by 2025. The 2026 and 2027 columns are calendars, not sets of results."
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
                    label="Number of championship races in each season from 1950 to 2027"
                  />
                </Figure>
              </Section>

              <Section
                title="Reading the numbers here"
                note="Four things worth knowing before you quote anything off this site."
              >
                <div className="grid">
                  <div className="panel">
                    <b>A blank means unknown.</b>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      An em dash is a figure nobody has established — never a zero, never a
                      plausible guess.
                    </p>
                  </div>
                  <div className="panel">
                    <b>Disagreements are shown, not settled.</b>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      Where two sources conflict you see both. There are{' '}
                      <Link to="/data/quality">{number(shape.discrepancies)} on record</Link>.
                    </p>
                  </div>
                  <div className="panel">
                    <b>Every row says how solid it is.</b>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      Verified, high, reference, medium or unverified — only an official source
                      reaches the top. Photographs have a sixth rung below those.
                    </p>
                  </div>
                  <div className="panel">
                    <b>The gaps are published too.</b>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      <Link to="/data/quality">{number(shape.gaps)} open gaps</Link> — what is
                      missing, why, and what would close it.
                    </p>
                  </div>
                </div>
              </Section>

              <Onward
                title="Popular ways in"
                items={[
                  {
                    to: latest ? `/seasons/${latest.year}` : '/seasons',
                    label: `The ${latest ? latest.year : 'latest'} season`,
                    hint: 'Calendar, title race and final standings.',
                  },
                  { to: '/records', label: 'Records', hint: 'Most wins, most poles, champions, grand slams.' },
                  { to: '/data/sql', label: 'SQL console', hint: 'Ask the database your own question.' },
                  { to: '/reference/eras', label: 'Eras and rules', hint: 'How the rules changed, and the words they are written in.' },
                ]}
              />
            </>
          )
        }}
      </Result>
    </Page>
  )
}
