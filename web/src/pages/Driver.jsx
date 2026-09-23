import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import LiveryMark from '../components/LiveryMark.jsx'
import LiveryScheme from '../components/LiveryScheme.jsx'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Disagreement, { DRIVER_DISAGREEMENTS } from '../components/Disagreement.jsx'
import Figure from '../charts/Figure.jsx'
import DotPlot from '../charts/DotPlot.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { EMPTY, missing, points as fmtPoints, result, text as valueText } from '../lib/format.js'
import { ENTRIES_NOTE, NAMES } from '../lib/site.js'
import { colourForEntry, colourSource, lastTeamColour } from '../lib/liveries.js'
import { canonicalCountry } from '../lib/racingColours.js'
import {
  BY_SEASON,
  DERIVED,
  DRIVER,
  DRIVER_CONSTRUCTORS,
  DRIVER_SOURCES,
  ENTRY_COLUMNS,
  RESULTS,
  SEASON_COLUMNS,
  SEASONS_FOOTER,
  SEASON_TEAMS,
  CAREER_HEADING,
  STANDINGS,
  TEAM_MATES,
  TEAM_MATE_COLUMNS,
  THIS_SEASON,
  THIS_SEASON_COLUMNS,
  lede,
  pointsDiffer,
  pointsNote,
  record,
  seasonRows,
  leading,
  strip,
  teamsBySeason,
  roundsRun,
  thisSeasonFooter,
  thisSeasonHeading,
  thisSeasonNote,
  teamMateCount,
  teamMatesFooter,
} from '../queries/driver.js'
import { comparePath, compareWith } from '../queries/compare.js'

import { ONWARD, TRAIL, lastTeamOf } from '../lib/wayfinding.js'
import SearchKey from '../components/SearchKey.jsx'
/**
 * What only the app adds to the shared column lists: links, the sort key
 * behind a text column, and the markup a result wears. Everything a cell
 * SAYS is in queries/driver.js, read by scripts/prerender.js too.
 *
 * The colour marks (AF-47): a constructor is a first-class attribute of both
 * tables' rows, so each row wears one mark beside the constructor it names.
 * "Season by season" can name two; its mark is the team the season finished
 * with and the tooltip names the others, exactly as the season standings do
 * (lib/liveries.js lastTeamColour). The text is BY_SEASON's, unchanged.
 */
const seasonApp = (teams) => ({
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  teams: {
    render: (names, row) => {
      const { colour, title } = lastTeamColour(teams.get(row.year), row.year)
      return (
        <>
          <LiveryMark colour={colour} title={title} year={row.year} />
          {cell(names)}
        </>
      )
    },
  },
  championship_text: { sort: (row) => row.championship },
})

const ENTRY_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  name_used: { render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link> },
  constructor: {
    render: (name, row) => (
      <>
        <LiveryMark
          colour={colourForEntry({
            constructorId: row.constructor_id,
            country: row.constructor_country,
            year: row.year,
            team: name,
          })}
          year={row.year}
        />
        {row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name)}
      </>
    ),
  },
  chassis: {
    render: (name, row) =>
      row.chassis_id ? <Link to={`/cars/${row.chassis_id}`}>{name ?? row.chassis_id}</Link> : cell(name),
  },
  grid_text: { sort: (row) => row.grid },
  position_text: {
    sort: (row) => row.finish_position,
    render: (_, row) => {
      const value = result(row)
      return missing(row.finish_position) ? <span className="tag tag-dnf">{value}</span> : <b>{value}</b>
    },
  },
}

/**
 * What the app adds to the Team-mates table (PD-43): the links, the entry
 * table's livery mark beside the constructor - the rows carry the same three
 * keys it reads - and, for each head-to-head column, a sort on the margin
 * rather than on the first figure, so "14–2" sorts above "15–9". A row whose
 * qualifying is not established sorts last, as its em dash says.
 */
const margin = (ahead, behind) => (row) => row[ahead] - row[behind]
const TEAM_MATE_APP = {
  year: ENTRY_APP.year,
  mate: { render: (name, row) => <Link to={`/drivers/${row.mate_id}`}>{name}</Link> },
  constructor: ENTRY_APP.constructor,
  qualified_ahead: {
    sort: (row) => (row.both_qualified ? margin('qualified_ahead', 'qualified_behind')(row) : null),
  },
  finished_ahead: { sort: margin('finished_ahead', 'finished_behind') },
  points: { sort: margin('points', 'mate_points') },
}
const teamMateColumns = TEAM_MATE_COLUMNS.map((column) => ({ ...column, ...TEAM_MATE_APP[column.key] }))

/**
 * The season being run, a dot per round (PD-49): where the driver finished,
 * P1 at the top, across the whole calendar, so the rounds still to come are
 * the space to the right. The words above it and the table under it are
 * queries/driver.js's, which scripts/prerender.js prints too.
 */
function ThisSeason({ name, rows: calendar, standings }) {
  const season = calendar[0].season
  const standing = standings.find((s) => s.year === season) ?? null
  const run = roundsRun(calendar)
  const footer = thisSeasonFooter(calendar, standing)
  // Each dot in the team that weekend (AF-47), hollow where the record holds
  // no colour for it, and plainly neutral only where no dot has one - the
  // championship chart's rule (AF-55), for the same reasons.
  const dots = calendar.map((row) => ({
    row,
    colour: row.entry_id
      ? colourForEntry({ constructorId: row.constructor_id, country: row.constructor_country, year: season, team: row.constructor })
      : null,
  }))
  const placed = dots.filter((d) => typeof d.row.finish_position === 'number')
  const toCome = calendar.some((row) => row.status !== 'completed')
  const inColour = placed.some((d) => d.colour)
  const mixed = inColour && !placed.every((d) => d.colour)

  return (
    <Section title={thisSeasonHeading(calendar)} note={thisSeasonNote(calendar, standing)}>
      <Figure
        title={`${name}'s finishes, round by round`}
        note={`Where ${name} finished in each round of ${season}, P1 at the top. A round with no dot is one ${name} was not classified in or not entered for, and the table says which${toCome ? '; the space to the right is the rounds still to run' : ''}. A win is ringed. ${
          inColour
            ? `Each dot is in the colour of the team raced that weekend: ${colourSource(placed.map((d) => d.colour))}.${
                mixed ? ' A hollow dot is a round this record holds no colour for.' : ''
              }`
            : 'The dots are not in team colours: no round on this record has one.'
        }`}
        table={{
          rows: run,
          columns: THIS_SEASON_COLUMNS.map((column) => ({ ...column, ...THIS_SEASON_APP[column.key] })),
        }}
      >
        <DotPlot
          data={dots.map(({ row, colour }) => ({
            x: row.round,
            y: row.finish_position,
            label: `R${row.round} ${row.name_used}`,
            colour: inColour ? colour : null,
            hollow: inColour && !colour,
            mark: row.finish_position === 1,
            // No points clause where the entry carries none: a finish outside
            // the points holds NULL, and "— points" would claim a gap.
            note: `P${row.finish_position}${
              row.points === null || row.points === undefined
                ? ''
                : ` · ${fmtPoints(row.points)} ${row.points === 1 ? 'point' : 'points'}`
            }${row.constructor ? ` · ${row.constructor}` : ''}`,
          }))}
          yMax={Math.max(10, ...placed.map((d) => d.row.finish_position))}
          format={(v) => `P${Math.round(v)}`}
          formatX={(v) => `R${Math.round(v)}`}
          height={180}
          label={`Finishing position in each round of ${season} for ${name}`}
        />
      </Figure>
      {footer && <p className="source-note">{footer}</p>}
    </Section>
  )
}

/** The links the season table's cells carry in the app; the words are THIS_SEASON_COLUMNS'. */
const THIS_SEASON_APP = {
  name_used: { render: (name, row) => <Link to={`/races/${row.season}/${row.round}`}>{name}</Link> },
  constructor: {
    render: (name, row) =>
      row.entry_id && row.constructor_id ? (
        <Link to={`/constructors/${row.constructor_id}`}>{name}</Link>
      ) : (
        THIS_SEASON_COLUMNS.find((c) => c.key === 'constructor').text(name, row)
      ),
  },
}

export default function Driver() {
  const { id } = useParams()
  const state = useQueries({
    driver: [DRIVER, [id]],
    derived: [DERIVED, [id]],
    bySeason: [BY_SEASON, [id]],
    standings: [STANDINGS, [id]],
    results: [RESULTS, [id]],
    constructors: [DRIVER_CONSTRUCTORS, [id]],
    seasonTeams: [SEASON_TEAMS, [id]],
    disagreements: [DRIVER_DISAGREEMENTS, [id]],
    thisSeason: [THIS_SEASON, [id]],
    teamMates: [TEAM_MATES, [id, null]],
    sources: [DRIVER_SOURCES, [id]],
  })

  return (
    <Result state={state} context="That driver could not be read">
      {(data) => {
        const driver = data.driver.rows[0]
        if (!driver) {
          return (
            <Page title="No such driver" cite={false} trail={TRAIL.missing('/drivers', 'Drivers')}>
              <p className="muted">Nothing in the register has the id “{id}”.</p>
              <p>
                Press <SearchKey /> to search every driver by name, or{' '}
                <Link to="/drivers">browse the register</Link>.
              </p>
            </Page>
          )
        }
        return <DriverBody driver={driver} data={data} />
      }}
    </Result>
  )
}

function DriverBody({ driver, data }) {
  const derived = data.derived.rows[0] ?? {}
  const bySeason = rows(data, 'bySeason')
  const standings = useMemo(
    () => rows(data, 'standings'),
    [data],
  )
  const results = rows(data, 'results')
  // The opening sentence (PD-16). `notes` is the override and 699 of the 862
  // rows have none; lede() writes those from the race records, in
  // queries/driver.js so scripts/prerender.js writes the same sentence rather
  // than a second reading of it.
  const constructors = useMemo(() => rows(data, 'constructors').map((c) => c.name), [data])

  // The team a reader is most likely to want next is the one they drove for
  // last — the same pick the onward band makes, from lib/wayfinding.js.
  const lastTeam = lastTeamOf(results)
  // The stripe in the header: the colour of the team the driver raced for
  // last, in the season they last raced for it - the livery from 2010, the
  // national convention before 1968, nothing between (AF-04). RESULTS is
  // newest first, so the first row with a constructor is that team.
  const teamColour = lastTeam
    ? colourForEntry({
        constructorId: lastTeam.constructor_id,
        country: lastTeam.constructor_country,
        year: lastTeam.year,
        team: lastTeam.constructor,
      })
    : null
  const seasons = useMemo(() => seasonRows(bySeason, standings), [bySeason, standings])
  const teams = useMemo(() => teamsBySeason(rows(data, 'seasonTeams')), [data])
  // Each championship dot in the team that season finished with (AF-47),
  // from the same lastTeamColour() the season table's marks read.
  const finishes = useMemo(
    () =>
      standings.map((s) => {
        const raced = teams.get(s.year)
        return { ...s, constructor: raced?.[0]?.constructor ?? null, colour: lastTeamColour(raced, s.year).colour }
      }),
    [standings, teams],
  )
  const seasonColumns = useMemo(() => {
    const app = seasonApp(teams)
    return SEASON_COLUMNS.map((column) => ({ ...column, ...app[column.key] }))
  }, [teams])
  // WHICH DOTS WEAR A COLOUR (AF-55). Any that has one. The chart used to
  // wear liveries only when EVERY dot had one, which silenced colour for
  // precisely the careers most likely to be opened - Hamilton, Alonso,
  // Button, Raikkonen, Schumacher all cross the declared 1968-2009 gap. A
  // season that gap covers is now drawn hollow instead: outlined and
  // unfilled, visibly a non-colour rather than a neutral that could be read
  // as a team, which is the objection the old rule existed to answer.
  //
  // A chart NO dot of which has a colour keeps the plain neutral series, as
  // every other chart on the site does: there are no liveries for a neutral
  // to be misread against, and a page of outlines would say "missing" about
  // a career where nothing is missing that the site records anywhere.
  const plotted = finishes.filter((s) => typeof s.position === 'number')
  const finishesInColour = plotted.some((s) => s.colour)
  const finishesMixed = finishesInColour && !plotted.every((s) => s.colour)
  const differ = pointsDiffer(driver, derived)
  const thisSeason = rows(data, 'thisSeason')
  const teamMates = rows(data, 'teamMates')

  return (
    <Page
      eyebrow="Driver"
      title={NAMES.driver(driver.full_name).headline}
      trail={TRAIL.driver(driver.id, driver.full_name)}
      lede={lede(driver, derived, constructors)}
      sources={rows(data, 'sources')}
      aside={
        <LiveryScheme
          colour={teamColour}
          note={
            teamColour?.kind === 'livery'
              ? `The colour ${lastTeam.constructor} raced in ${lastTeam.year}, ${teamColour.claim} - the last team on this record.`
              : `${canonicalCountry(lastTeam?.constructor_country)}'s international racing colour, under the convention that painted a car for the country that entered it, as it stood when ${lastTeam?.constructor} raced in ${lastTeam?.year}. Not the team's own livery.`
          }
        />
      }
    >
      {/* A driver of the season being run opens on it, the career below
          (PD-49). Absent for every other driver: no rows, no section. */}
      {thisSeason.length > 0 && (
        <ThisSeason name={driver.full_name} rows={thisSeason} standings={standings} />
      )}

      <Section title={thisSeason.length > 0 ? CAREER_HEADING : undefined}>
        <Stats items={leading(strip(driver, derived))} />
      </Section>

      {standings.length > 1 && (
        <Section title="Where each championship finished">
          <Figure
            title={`${driver.full_name} in the drivers' championship`}
            note={`Final classified position at the end of each season. A season with points but no position is one the driver was excluded from, so there is nothing to plot. A season finished first is ringed. ${
              finishesInColour
                ? `Each dot is coloured for the team that season finished with, named in the table: ${colourSource(plotted.map((s) => s.colour))}.${
                    finishesMixed
                      ? ' A hollow dot is a season this record holds no colour for: between 1968 and 2009 the national convention no longer described the grid and the liveries are not recorded here, so the dot names its team on hover rather than wearing one.'
                      : ''
                  }`
                : 'The dots are not in team colours: no season on this record has one.'
            }`}
            table={{
              rows: finishes,
              columns: [
                { key: 'year', label: 'Season', align: 'num', rowHeader: true },
                { key: 'constructor', label: 'Constructor' },
                // The chart plots `position`; its table - the non-fallback source
                // of the same numbers - must not dash a season the dot has placed.
                //
                // `text` as well as `render`, and they must agree: the fallback
                // is the whole point of the cell, and a column whose render
                // holds a fallback its `text` does not is a column that reads
                // one way on the page and another in the file a reader takes
                // away (IX-26). 21 drivers in 2025 alone have a null
                // position_text and a position.
                {
                  key: 'position_text',
                  label: 'Position',
                  align: 'num',
                  render: (v, row) => cell(v ?? row.position),
                  text: (v, row) => valueText(v ?? row.position),
                  glossary: 'results',
                },
                { key: 'points', label: 'Points', align: 'num' },
              ],
            }}
          >
            <DotPlot
              data={finishes.map((s) => ({
                x: s.year,
                y: s.position,
                label: `${s.year}`,
                colour: finishesInColour ? s.colour : null,
                // Only where some other dot is coloured: see finishesInColour.
                hollow: finishesInColour && !s.colour,
                // The halo says nothing the dot does not: position 1 is what
                // is already plotted at the top of the axis.
                mark: s.position === 1,
                // The team is named wherever its colour is read (clause 4 of AF-47).
                note: `${s.position ? `P${s.position} · ${fmtPoints(s.points)} points` : 'no classified position'}${
                  s.constructor ? ` · ${s.constructor}` : ''
                }`,
              }))}
              yMax={Math.max(10, ...standings.map((s) => s.position ?? 0))}
              format={(v) => `P${Math.round(v)}`}
              formatX={(v) => String(Math.round(v))}
              height={210}
              label={`Championship finishing position by season for ${driver.full_name}`}
            />
          </Figure>
        </Section>
      )}

      <Section title="Season by season" count={`${seasons.length} seasons`}>
        <DataTable
          rows={seasons}
          rowKey={(row) => row.year}
          sortable
          sort="year"
          direction="desc"
          columns={seasonColumns}
          footer={SEASONS_FOOTER}
        />
      </Section>

      {/* A career with no team-mate on the record - 132 of the 862 - has
          no section, as it has no rows (PD-43). */}
      {teamMates.length > 0 && (
        <Section title="Team-mates" count={teamMateCount(teamMates)}>
          <DataTable
            rows={teamMates}
            rowKey={(row) => `${row.year}-${row.constructor_id}-${row.mate_id}`}
            sortable
            sort="year"
            direction="desc"
            page={100}
            columns={teamMateColumns}
            footer={teamMatesFooter(driver.full_name)}
          />
          {/* A plain paragraph: .source-note is the page's sentence about
              its sources, and the first of them is ENTRIES_NOTE's. */}
          <p>
            <Link to={comparePath(driver.id)}>{compareWith(driver.full_name)}</Link>
          </p>
        </Section>
      )}

      <Section title="Every entry" count={`${results.length} races`}>
        <DataTable
          rows={results}
          rowKey={(row) => `${row.year}-${row.round}`}
          sortable
          sort="year"
          direction="desc"
          page={100}
          columns={ENTRY_COLUMNS.map((column) => ({ ...column, ...ENTRY_APP[column.key] }))}
        />
      </Section>

      <Disagreement rows={rows(data, 'disagreements')} what="this career" />

      <Section title="On the record">
        {differ && (
          <Note>
            <strong>{pointsNote(driver, derived).head}</strong> {pointsNote(driver, derived).body}
          </Note>
        )}
        <Fields
          items={[
            // The strings both renderers print, from queries/driver.js. A
            // dashed one goes back to null so Fields sets it faint like every
            // other missing value.
            ...record(driver).map(([label, value]) => ({ label, value: value === EMPTY ? null : value })),
            { label: 'Confidence', value: <Confidence value={driver.confidence} /> },
            {
              label: 'Source',
              value: driver.source ? (
                <a href={driver.source} target="_blank" rel="noreferrer noopener">
                  {driver.source}
                </a>
              ) : null,
            },
          ]}
        />
        <p className="source-note">{ENTRIES_NOTE}</p>
      </Section>

      <Onward {...ONWARD.driver({ results, bySeason })} />
    </Page>
  )
}
