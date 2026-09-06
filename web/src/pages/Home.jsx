import { Link } from 'react-router-dom'
import { Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import Figure from '../charts/Figure.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number } from '../lib/format.js'

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
    (SELECT COUNT(*) FROM article_images) AS images,
    (SELECT COUNT(*) FROM discrepancies)  AS discrepancies,
    (SELECT COUNT(*) FROM known_gaps)     AS gaps,
    (SELECT COUNT(*) FROM circuit_geometry) AS geometry,
    (SELECT MIN(year) FROM races)         AS from_year,
    (SELECT MAX(year) FROM races)         AS to_year
`

const PER_SEASON = `SELECT year, COUNT(*) AS rounds FROM races GROUP BY year ORDER BY year`

const LATEST = `
  SELECT r.year, r.round, r.name_used, r.dates, c.name AS circuit,
         d.full_name AS winner, d.id AS winner_id, k.name AS constructor
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
    ['/seasons', 'Seasons', shape.seasons, 'Championship tables round by round, the calendar, and who entered.'],
    ['/races', 'Races', shape.races_run, 'Every classification: grid, finish, status, laps and points.'],
    ['/drivers', 'Drivers', shape.drivers, 'The register, and every entry each of them made.'],
    ['/constructors', 'Constructors', shape.constructors, 'Records, lineage chains, and the cars they ran.'],
    ['/circuits', 'Circuits', shape.circuits, 'Layouts as they changed, and traced centrelines for 25.'],
    ['/cars', 'Cars', shape.chassis, 'The chassis register, with specifications where they are published.'],
    ['/records', 'Records', null, 'Leaderboards derived from the race records, not copied from anywhere.'],
    ['/reference', 'Reference', null, 'Eras, regulations, sources, licences, what is missing, and SQL.'],
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
      title="A Formula One database you can check"
      lede={
        <>
          Seventy-seven seasons in a single SQLite file, running in this tab. It is not the largest
          such database and it is not trying to be: the point is that every figure can be traced to
          a source, that a fact nobody has established is left blank rather than guessed, and that
          170 checks have to pass before any of it ships.
        </>
      }
    >
      <Result state={state}>
        {(data) => {
          const shape = data.shape.rows[0]
          const seasons = rows(data, 'perSeason')
          const latest = data.latest.rows[0]
          const next = data.next.rows[0]

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

              <Section title="Where to start">
                <Board shape={shape} />
              </Section>

              <Section title="The season, at both ends">
                <div className="split">
                  <div className="panel">
                    <p className="eyebrow" style={{ margin: 0, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', fontWeight: 600 }}>
                      Last race in the database
                    </p>
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
                          {latest.constructor ? ` for ${latest.constructor}` : ''}.
                        </p>
                      </>
                    ) : null}
                  </div>
                  <div className="panel">
                    <p className="eyebrow" style={{ margin: 0, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-faint)', fontWeight: 600 }}>
                      Next scheduled
                    </p>
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
                        <p style={{ margin: '10px 0 0' }} className="muted">
                          {number(shape.races_scheduled)} races are on the calendar and have not been
                          run. They carry no result, and nothing here invents one.
                        </p>
                      </>
                    ) : (
                      <p className="muted">Nothing scheduled beyond the last recorded race.</p>
                    )}
                  </div>
                </div>
              </Section>

              <Section title="The shape of the championship">
                <Figure
                  title="Championship races per season"
                  note="Seven rounds in 1950; twenty-four by 2025. The 2026 column counts a calendar rather than a set of results."
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
                    label="Number of championship races in each season from 1950 to 2026"
                  />
                </Figure>
              </Section>

              <Section title="What this database refuses to do">
                <div className="grid">
                  <div className="panel">
                    <b>It does not fill a blank.</b>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      NULL means "not established" — never zero, never a plausible guess. A missing
                      figure stays missing, and shows here as an em dash.
                    </p>
                  </div>
                  <div className="panel">
                    <b>It does not pick a side quietly.</b>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      Where two sources disagree and neither can be checked officially, the
                      disagreement is recorded. There are{' '}
                      <Link to="/reference/quality">{number(shape.discrepancies)} of them</Link>.
                    </p>
                  </div>
                  <div className="panel">
                    <b>It says how good each fact is.</b>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      Every row carries a confidence: verified, high, reference, medium or
                      unverified. Only an official source reaches the top of that ladder.
                    </p>
                  </div>
                  <div className="panel">
                    <b>It publishes its own gaps.</b>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      {number(shape.gaps)} known gaps are listed as data, not as an apology — what
                      is missing, why, and what it would take to close it.
                    </p>
                  </div>
                </div>
              </Section>
            </>
          )
        }}
      </Result>
    </Page>
  )
}
