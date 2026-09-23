import { useMemo } from 'react'
import { SEASON_SESSIONS, SESSION_COLUMNS, TIMETABLE_NOTE, clock, nextSession, until } from '../queries/sessions.js'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats, Stepper } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { OutlineCard, OutlineStrip } from '../components/Outline.jsx'
import { outlineCaption } from '../lib/outline.js'
import { measured, odblCredit } from '../lib/trace.js'
import Figure from '../charts/Figure.jsx'
import LineChart from '../charts/LineChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { currentProgress } from '../data/client.js'
import { points as fmtPoints, number } from '../lib/format.js'
import { colourForEntry, lastTeamColour } from '../lib/liveries.js'
import LiveryMark from '../components/LiveryMark.jsx'
import Photographs from '../components/Photographs.jsx'
import { NAMES, NOT_YET_RUN, SPRINT } from '../lib/site.js'
import { SEASON_IMAGES } from '../queries/photographs.js'
import {
  CALENDAR,
  CALENDAR_COLUMNS,
  CALENDAR_FOOTER,
  CONSTRUCTORS_FINAL_COLUMNS,
  DRIVERS_FINAL_COLUMNS,
  DRIVERS_FINAL_FOOTER,
  DRIVER_TEAMS,
  ENTRANTS,
  ENTRANT_COLUMNS,
  ENTRANTS_FOOTER,
  CURRENT_GRID,
  FINAL,
  GRID,
  GRID_COLUMNS,
  GRID_FOOTER,
  GRID_HEADING,
  GRID_NOTE,
  NEIGHBOURS,
  NEXT_HEADING,
  NEXT_ROUND,
  NEXT_TRACE,
  NOT_RUN_STANDINGS,
  REMAINING,
  SEASON,
  STANDINGS,
  WON_HERE,
  WON_HERE_COLUMNS,
  WON_HERE_HEADING,
  constructorsFooter,
  latestRound,
  nextLine,
  noConstructorsNote,
  progressionNote,
  standingsHeading,
  stillRunning,
  teamsByDriver,
  titleHeading,
  titlePermutations,
  wonHereNote,
} from '../queries/season.js'

import { ONWARD, TRAIL, seasonSteps } from '../lib/wayfinding.js'
/*
 * The React renders for the columns queries/season.js defines — the links
 * and the tags; the router is the reason they live here. The words each cell
 * carries are the column's own `text`, which scripts/prerender.js prints too,
 * so the static tables are these.
 */
const calendarRenders = (year) => ({
  name_used: {
    render: (name, row) => (
      <>
        <Link to={`/races/${year}/${row.round}`}>{name}</Link>
        {row.sprint ? ' ' : ''}
        {row.sprint ? <span className="tag">{SPRINT}</span> : null}
      </>
    ),
  },
  circuit: {
    render: (name, row) => (row.circuit_id ? <Link to={`/circuits/${row.circuit_id}`}>{name}</Link> : cell(name)),
  },
  winner: {
    render: (name, row) =>
      row.status !== 'completed' ? (
        <span className="tag">{NOT_YET_RUN}</span>
      ) : row.winner_id && !String(name ?? '').includes(' / ') ? (
        <Link to={`/drivers/${row.winner_id}`}>{name}</Link>
      ) : (
        cell(name)
      ),
  },
  // A round still to come has no winning car to link to, and the Winner cell
  // beside it already says so: queries/season.js roundResult (CD-37).
  winning_team: {
    render: (name, row) =>
      row.status !== 'completed' ? (
        ''
      ) : row.winning_team_id ? (
        <Link to={`/constructors/${row.winning_team_id}`}>{name}</Link>
      ) : (
        cell(name)
      ),
  },
})

/*
 * The colour mark beside a name in the two standings tables: the team's
 * livery from 2010, the national racing colour before 1968, nothing between
 * (lib/liveries.js). A driver's mark is their last team of the season, from
 * DRIVER_TEAMS through lastTeamColour(), which the driver page reads too; the
 * tooltip names every team where there was more than one.
 */
/*
 * A standings position sorts on the number: `position_text` is the source's
 * own spelling, and "EX" for a driver excluded from the classification is not
 * a place between 9 and 10. A position nobody established is NULL and sinks
 * in both directions, as the query's ORDER BY sinks it.
 */
const POSITION_SORT = { position_text: { sort: (row) => row.position } }
const STANDINGS_OPENING = { key: 'position_text', direction: 'asc' }

const driversRenders = (year, teams) => ({
  ...POSITION_SORT,
  entity: {
    render: (name, row) => {
      const { colour, title } = lastTeamColour(teams.get(row.entity_id), year)
      return (
        <>
          <LiveryMark colour={colour} title={title} year={year} />
          {row.entity_id ? <Link to={`/drivers/${row.entity_id}`}>{name}</Link> : cell(name)}
        </>
      )
    },
  },
})

const constructorsRenders = (year) => ({
  ...POSITION_SORT,
  entity: {
    render: (name, row) => {
      const colour = colourForEntry({ constructorId: row.entity_id, country: row.constructor_country, year, team: name })
      return (
        <>
          <LiveryMark colour={colour} year={year} />
          {row.entity_id ? <Link to={`/constructors/${row.entity_id}`}>{name}</Link> : cell(name)}
          {row.engine_id ? ' ' : ''}
          {row.engine_id ? <span className="tag">{row.engine_id}</span> : null}
        </>
      )
    },
  },
})

/*
 * The grid: the driver links to their page, a seat that is not a race seat
 * says so, and the colour mark sits beside the team whose livery it is
 * (AF-04) - one mark to a row, where the drivers' standings has nowhere else
 * to put it.
 */
const gridRenders = (year) => ({
  driver: {
    render: (name, row) => (
      <>
        {row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name}</Link> : cell(name)}
        {row.role && row.role !== 'race' ? ' ' : ''}
        {row.role && row.role !== 'race' ? <span className="tag">{row.role}</span> : null}
      </>
    ),
  },
  team: {
    render: (name, row) => {
      const colour = colourForEntry({
        constructorId: row.constructor_id,
        country: row.team_country,
        year,
        team: name,
      })
      return (
        <>
          <LiveryMark colour={colour} year={year} />
          {row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name)}
        </>
      )
    },
  },
})

const ENTRANTS_APP = {
  constructor: {
    render: (name, row) =>
      row.constructor_id ? (
        <Link to={`/constructors/${row.constructor_id}`}>{name ?? row.constructor_id}</Link>
      ) : (
        cell(name ?? row.entrant_id)
      ),
  },
}

const WON_HERE_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  name_used: { render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link> },
  winner: {
    render: (name, row) =>
      row.winner_id && !String(name ?? '').includes(' / ') ? <Link to={`/drivers/${row.winner_id}`}>{name}</Link> : cell(name),
  },
  constructor: {
    render: (name, row) => (row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name)),
  },
}

const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

/**
 * Where the championship goes next (PD-49): the round, its outline, its
 * weekend, its trace where the overlay has one, and who won there before.
 * Every word is queries/season.js's and the static page prints the same;
 * the trace alone is the app's, because f1.db carries none and only the
 * browser merges f1-geometry.db in.
 */
function NextRound({ year, next, sessions, traces, wonHere }) {
  const line = nextLine(next)
  return (
    <>
      <Section title={NEXT_HEADING}>
        <p className="measure">
          {line.before}
          <Link to={`/races/${year}/${next.round}`}>{next.name_used}</Link>
          {next.sprint ? ' ' : ''}
          {next.sprint ? <span className="tag">{SPRINT}</span> : null}
          {line.at}
          {next.circuit_id && next.circuit ? <Link to={`/circuits/${next.circuit_id}`}>{next.circuit}</Link> : line.circuit}
          {line.after}
        </p>
        {/* The race page's own arrangement: the weekend, and the outline
            beside it at a fixed width, below it on a phone. */}
        <div className={next.outline ? 'with-outline' : undefined}>
          <div>
            {sessions.length > 0 ? (
              <DataTable
                rows={sessions}
                rowKey={(row) => row.kind}
                sortable={false}
                columns={SESSION_COLUMNS}
                footer={TIMETABLE_NOTE}
              />
            ) : null}
          </div>
          {next.outline ? (
            <OutlineCard
              path={next.outline}
              circuit={next.circuit}
              layoutId={next.f1db_layout_id}
              caption={outlineCaption({ f1db_layout_id: next.f1db_layout_id, length_km: next.outline_km, turns: next.outline_turns })}
              rule
            />
          ) : null}
        </div>
        {traces
          .filter((geometry) => measured(geometry))
          .map((geometry) => (
            <p className="faint" key={`${geometry.circuit_id}-${geometry.layout_key ?? ''}`}>
              Traced from OpenStreetMap: {measured(geometry)}. {odblCredit(geometry.licence)}
            </p>
          ))}
      </Section>

      <Section title={WON_HERE_HEADING} note={wonHereNote(next, wonHere)}>
        {wonHere.length > 0 && (
          <DataTable
            rows={wonHere}
            rowKey={(row) => `${row.year}-${row.round}`}
            sortable={false}
            columns={withRenders(WON_HERE_COLUMNS, WON_HERE_APP)}
          />
        )}
      </Section>
    </>
  )
}

export default function Season() {
  const { year } = useParams()
  const state = useQueries({
    season: [SEASON, [Number(year)]],
    calendar: [CALENDAR, [Number(year)]],
    standings: [STANDINGS, [Number(year)]],
    final: [FINAL, [Number(year)]],
    entrants: [ENTRANTS, [Number(year)]],
    neighbours: [NEIGHBOURS, [Number(year)]],
    grid: [GRID, [Number(year)]],
    currentGrid: [CURRENT_GRID, [Number(year)]],
    sessions: [SEASON_SESSIONS, [Number(year)]],
    teams: [DRIVER_TEAMS, [Number(year)]],
    images: [SEASON_IMAGES, [Number(year)]],
    remaining: [REMAINING, [Number(year)]],
    next: [NEXT_ROUND, [Number(year)]],
    wonHere: [WON_HERE, [Number(year)]],
    nextTrace: [NEXT_TRACE, [Number(year)]],
  })

  return (
    <Result state={state} context={`Season ${year} could not be read`}>
      {(data) => {
        const season = data.season.rows[0]
        if (!season) {
          return (
            <Page title={`No season ${year}`} cite={false} trail={TRAIL.missing('/seasons', 'Seasons')}>
              <p className="muted">The championship register runs from 1950 to 2027.</p>
            </Page>
          )
        }
        return <SeasonBody year={Number(year)} season={season} data={data} />
      }}
    </Result>
  )
}

function SeasonBody({ year, season, data }) {
  const calendar = rows(data, 'calendar')
  const standings = rows(data, 'standings')
  const final = rows(data, 'final')
  const entrants = rows(data, 'entrants')
  const currentGrid = rows(data, 'currentGrid')
  const neighbours = data.neighbours.rows[0] ?? {}
  const grid = data.grid.rows[0] ?? null
  const teams = useMemo(() => teamsByDriver(rows(data, 'teams')), [data])
  const now = Date.now()
  const upcoming = nextSession(data.sessions.rows, now)
  const next = data.next.rows[0] ?? null

  const driversFinal = useMemo(() => final.filter((r) => r.table_type === 'drivers'), [final])
  const constructorsFinal = useMemo(() => final.filter((r) => r.table_type === 'constructors'), [final])
  // Two different questions (IA-17). `running`: is there a champion yet? It
  // decides whether the strip leads with a champion or a leader. `live`: is
  // there a round still to run? It decides whether the headings below call
  // the tables final - a title can be settled with three rounds to go, and
  // those tables are not final until the last of them has run.
  const running = !season.drivers_champion && driversFinal.length >= 2
  const live = stillRunning(calendar)
  const after = latestRound(standings)
  const [lead, second] = driversFinal
  const teamLead = constructorsFinal[0] ?? null

  /**
   * The title race, as it actually ran.
   *
   * Three series, because three is what the palette validates to and what a
   * reader can follow at once — the eventual top three, tracked round by
   * round. A points total that goes flat is a driver who scored nothing that
   * weekend; it never falls, because a championship total cannot.
   */
  const progression = useMemo(() => {
    const contenders = driversFinal.slice(0, 3).filter((d) => d.entity_id)
    // Each line in its driver's team colour where the season has one (AF-04):
    // the livery from 2010, the national colour before 1968, the neutral
    // series palette between and wherever a colour is missing. Two drivers
    // of one team share the colour; every line has its slot's dash as well
    // (AX-16), so they are still two lines. A driver who changed teams wears
    // the one they finished with.
    return contenders.map((driver) => {
      const last = (teams.get(driver.entity_id) ?? [])[0]
      const colour = last
        ? colourForEntry({ constructorId: last.constructor_id, country: last.country, year, team: last.constructor })
        : null
      return {
        name: driver.entity,
        colour,
        // STANDINGS holds the running table only; the season's end is FINAL,
        // and drawing it here would put the final total at round zero.
        points: standings
          .filter((r) => r.table_type === 'drivers' && r.entity_id === driver.entity_id)
          .sort((a, b) => a.after_round - b.after_round)
          .map((r) => ({ x: r.after_round, y: r.points })),
      }
    })
  }, [driversFinal, standings, teams, year])
  // The chart wears liveries only when every contender has one: a mix of
  // one papaya line and two neutral blues would read as a claim about the
  // blues.
  const inColour = progression.length > 0 && progression.every((s) => s.colour)

  const run = calendar.filter((r) => r.status === 'completed').length
  // A third state beside `running` and a concluded season: the calendar is
  // out and nobody has raced it. Its champion slots are not unknown, they are
  // not yet run, and IA-17 is the rule that they must not read the same.
  const notRun = run === 0
  // The words a champion slot carries where there is no fact to miss.
  const notYet = <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>{NOT_YET_RUN}</span>
  const ambiguous = constructorsFinal.some((r) => r.engine_id)
  // Why there is no constructors' table, where there is none: the 1950-1957
  // sentence, or the one a season nobody has raced needs (CD-32).
  const noConstructors = noConstructorsNote(year, notRun)

  // The September question, answered from the standings, the calendar and the
  // season's own scoring rule (PD-28). Only where there is no champion yet:
  // once there is one, the strip above has already said who won, and a second
  // sentence working out who could have is noise at best and a contradiction
  // at worst. queries/season.js decides where the arithmetic will not carry.
  const permutations = running
    ? titlePermutations({
        drivers: driversFinal,
        remaining: data.remaining.rows[0] ?? null,
        afterRound: after,
        built: currentProgress().manifest?.built,
      })
    : null

  // The one hourly-changing fact on the page, as a tile among the others
  // rather than a paragraph beneath them (IA-17). Only a browser knows how
  // long until it starts, so the static page carries no such tile; the race
  // page has the whole timetable on the circuit's clock and in UTC.
  const nextTile = upcoming
    ? {
        label: 'Next session',
        kind: 'name',
        value: <Link to={`/races/${year}/${upcoming.round}`}>{upcoming.name}</Link>,
        note: `${upcoming.name_used}, ${clock(upcoming.start_utc, upcoming.zone)} at the circuit, ${until(upcoming.start_utc, now)}`,
      }
    : null

  return (
    // No eyebrow: the h1 is "2026 FIA Formula One World Championship" now
    // rather than the bare year (PD-40), so the "Season" above it restated
    // the heading it was there to explain.
    <Page
      title={NAMES.season(year).headline}
      documentName={NAMES.season(year).title}
      trail={TRAIL.season(year)}
      lede={season.notes}
      aside={
        <Stepper {...seasonSteps(neighbours)} />
      }
    >
      <Section>
        {/* A season still running leads with who leads, by how much, after how
            many rounds. The champion's slots would be a row of em dashes on
            the most-searched page of the year. */}
        {running ? (
          <Stats
            items={[
              { label: 'Rounds', value: number(season.rounds), note: `${run} run` },
              {
                label: 'Leads',
                kind: 'name',
                value: lead.entity_id ? <Link to={`/drivers/${lead.entity_id}`}>{lead.entity}</Link> : lead.entity,
                note: `${fmtPoints(lead.points)} points`,
              },
              {
                label: 'Gap',
                value: fmtPoints(lead.points - second.points),
                note: `over ${second.entity}`,
              },
              {
                label: "Constructors' leader",
                kind: 'name',
                value: teamLead ? (
                  teamLead.entity_id ? (
                    <Link to={`/constructors/${teamLead.entity_id}`}>{teamLead.entity}</Link>
                  ) : (
                    teamLead.entity
                  )
                ) : null,
                note: teamLead ? `${fmtPoints(teamLead.points)} points` : undefined,
              },
              nextTile,
            ]}
          />
        ) : (
          <Stats
            items={[
              {
                label: 'Rounds',
                value: number(season.rounds),
                note: notRun ? NOT_YET_RUN : run === season.rounds ? 'all run' : `${run} run`,
              },
              {
                label: "Drivers' champion",
                kind: 'name',
                value: season.drivers_champion ? (
                  <Link to={`/drivers/${season.drivers_champion}`}>{season.champion}</Link>
                ) : notRun ? (
                  notYet
                ) : null,
                note: season.champion_points !== null ? `${fmtPoints(season.champion_points)} points` : undefined,
              },
              {
                label: "Constructors' champion",
                kind: 'name',
                value: season.constructors_champion ? (
                  <Link to={`/constructors/${season.constructors_champion}`}>
                    {season.constructors_champion_name}
                  </Link>
                ) : year < 1958 ? (
                  <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>
                    not contested
                  </span>
                ) : notRun ? (
                  notYet
                ) : null,
                note:
                  season.constructors_points !== null && season.constructors_points !== undefined
                    ? `${fmtPoints(season.constructors_points)} points`
                    : undefined,
              },
              {
                label: 'Margin',
                value: season.margin !== null ? fmtPoints(season.margin) : notRun ? notYet : null,
                note: season.runner_up_name ? `over ${season.runner_up_name}` : undefined,
              },
              nextTile,
            ]}
          />
        )}
        {permutations && (
          <p className="note" style={{ marginTop: 10 }}>
            {permutations}
          </p>
        )}
        {/* v_season_grid returns NULL, not 0, for a season nobody has entered
            yet - so the sentence is absent rather than counting nobody. */}
        {grid && grid.drivers !== null && (
          <p className="note" style={{ marginTop: 10 }}>
            The grid: {number(grid.drivers)} drivers, {number(grid.constructors)} constructors and{' '}
            {number(grid.engine_manufacturers)} engine makers, counted from the entries — a driver
            entered for one race counts once, whether or not they started.
          </p>
        )}
      </Section>

      {next && (
        <NextRound
          year={year}
          next={next}
          sessions={data.sessions.rows.filter((row) => row.round === next.round)}
          traces={rows(data, 'nextTrace')}
          wonHere={rows(data, 'wonHere')}
        />
      )}

      {/* Who is in the cars this season (PD-38). Only a season with a
          declared entry list has one, so the section is absent rather than
          empty on the 76 that have only the record of who entered. */}
      {currentGrid.length > 0 && (
        <Section title={GRID_HEADING} count={`${currentGrid.length} drivers`} note={GRID_NOTE}>
          {/* No opening sort, as with the entrants below: the query's ORDER BY
              is the order the table opens in, and the static page prints the
              rows as they come. */}
          <DataTable
            rows={currentGrid}
            rowKey={(row) => row.id}
            sortable
            columns={withRenders(GRID_COLUMNS, gridRenders(year))}
            footer={GRID_FOOTER}
          />
        </Section>
      )}

      {/* The cars of the year, what they won first (VD-33). A season that
          has not run yet has no entries and so no strip, which is right: the
          photographs are of cars that raced. */}
      <Photographs images={rows(data, 'images')} subjects />

      {progression.length > 1 && (
        <Section title={titleHeading(live)}>
          <Figure
            title={`Championship points after each round, ${year}`}
            note={progressionNote(live)}
            legend={progression.map((s) => ({ name: s.name, colour: inColour ? s.colour : null }))}
            marks="line"
            table={{
              rows: progression.flatMap((s) => s.points.map((p) => ({ driver: s.name, round: p.x, points: p.y }))),
              columns: [
                { key: 'driver', label: 'Driver' },
                { key: 'round', label: 'After round', align: 'num' },
                { key: 'points', label: 'Points', align: 'num' },
              ],
            }}
          >
            <LineChart
              series={progression.map((s) => ({
                name: s.name,
                points: s.points,
                colour: inColour ? s.colour : null,
              }))}
              format={(v) => fmtPoints(v)}
              formatX={(v) => `R${Math.round(v)}`}
              height={250}
              label={`Championship points by round for the top three drivers of ${year}`}
            />
          </Figure>
        </Section>
      )}

      <Section title="The calendar" count={`${calendar.length} rounds`}>
        {/* The season as a strip of outlines — run, next, to come — above
            the table that carries the facts (AF-03, PD-28). */}
        <OutlineStrip year={year} calendar={calendar} />
        <DataTable
          rows={calendar}
          rowKey={(row) => row.round}
          sortable={false}
          columns={withRenders(CALENDAR_COLUMNS, calendarRenders(year))}
          footer={CALENDAR_FOOTER}
        />
      </Section>

      <div className="split" style={{ marginTop: 34 }}>
        <Section title={standingsHeading("Drivers'", live, after)} count={`${driversFinal.length} drivers`}>
          <DataTable
            rows={driversFinal}
            rowKey={(row) => row.entity_id ?? row.entity}
            sortable
            opening={STANDINGS_OPENING}
            page={40}
            columns={withRenders(DRIVERS_FINAL_COLUMNS, driversRenders(year, teams))}
            footer={DRIVERS_FINAL_FOOTER}
            // "No rows here." is true of a season nobody has raced and says
            // nothing about it; the reason is the whole of what the page has
            // (CD-32). Both renderers print this string.
            empty={notRun ? NOT_RUN_STANDINGS : undefined}
          />
        </Section>

        <Section title={standingsHeading("Constructors'", live, after)} count={`${constructorsFinal.length} constructors`}>
          {constructorsFinal.length === 0 ? (
            <Note>
              <strong>{noConstructors.head}</strong> {noConstructors.body}
            </Note>
          ) : (
            <DataTable
              rows={constructorsFinal}
              rowKey={(row) => `${row.entity_id}-${row.engine_id ?? ''}`}
              sortable
              opening={STANDINGS_OPENING}
              page={40}
              columns={withRenders(CONSTRUCTORS_FINAL_COLUMNS, constructorsRenders(year))}
              footer={constructorsFooter(ambiguous)}
            />
          )}
        </Section>
      </div>

      <Section title="Who entered" count={`${entrants.length} entrants`}>
        {/* No opening sort: the query's ORDER BY is the order the table opens
            in, and the static page prints the rows as they come. The header
            says so without re-sorting them. */}
        <DataTable
          rows={entrants}
          rowKey={(row) => row.id}
          sortable
          opening={{ key: 'constructor', direction: 'asc' }}
          columns={withRenders(ENTRANT_COLUMNS, ENTRANTS_APP)}
          footer={ENTRANTS_FOOTER}
        />
      </Section>

      <Section title="The season on the record">
        <Fields
          items={[
            { label: 'Engine formula', value: season.engine_formula },
            { label: 'Tyre suppliers', value: season.tyre_suppliers },
            {
              label: 'Confidence',
              value: <Confidence value={season.confidence} />,
            },
            {
              label: 'Source',
              value: season.source ? (
                <a href={season.source} target="_blank" rel="noreferrer noopener">
                  {season.source}
                </a>
              ) : null,
            },
          ]}
        />
      </Section>

      <Onward {...ONWARD.season({ season, year, neighbours })} />
    </Page>
  )
}
