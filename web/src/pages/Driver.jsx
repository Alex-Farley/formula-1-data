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
import { EMPTY, missing, points as fmtPoints, result } from '../lib/format.js'
import { ENTRIES_NOTE } from '../lib/site.js'
import { colourForEntry, colourSource, lastTeamColour } from '../lib/liveries.js'
import { canonicalCountry } from '../lib/racingColours.js'
import {
  BY_SEASON,
  DERIVED,
  DRIVER,
  ENTRY_COLUMNS,
  RESULTS,
  SEASON_COLUMNS,
  SEASONS_FOOTER,
  SEASON_TEAMS,
  STANDINGS,
  pointsDiffer,
  pointsNote,
  record,
  seasonRows,
  strip,
  teamsBySeason,
} from '../queries/driver.js'

/**
 * Which figures lead the strip (VD-28).
 *
 * Emphasis is presentation, so it is added here rather than in
 * queries/driver.js: that module says what a cell SAYS, and scripts/prerender
 * reads the same list for a static facts table that has no ranks to give.
 *
 * Wins and titles are what a reader came for, and they are the two the
 * critique named. Which figures a strip should carry AT ALL - 625 of 862
 * pages show four zeros - is PD-15 (#147), and is not decided here: this
 * ranks whatever the strip returns, and a lead tile that is not present is
 * simply not led.
 *
 * A ZERO NEVER LEADS. Those 625 pages are the reason: on a privateer's page
 * "Wins" is 0, and leading it would set the one figure the driver does not
 * have at twice the size of the seventeen entries he does - emphasis pointing
 * at an absence. A strip with nothing to lead keeps the single rank it has
 * always had, which is the right answer for a page where no figure stands
 * out. `number()` groups thousands, so the test is for a digit that is not a
 * zero rather than for the string '0'; and it fails safe for everything else
 * that could arrive here - an em dash carries no digit, and a value that was
 * somehow an element stringifies to none either, so neither leads.
 */
const LEAD_FIGURES = new Set(['Wins', 'Titles'])

const worthLeading = (item) => LEAD_FIGURES.has(item.label) && /[1-9]/.test(String(item.value))

const leading = (items) => items.map((item) => (worthLeading(item) ? { ...item, lead: true } : item))

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

export default function Driver() {
  const { id } = useParams()
  const state = useQueries({
    driver: [DRIVER, [id]],
    derived: [DERIVED, [id]],
    bySeason: [BY_SEASON, [id]],
    standings: [STANDINGS, [id]],
    results: [RESULTS, [id]],
    seasonTeams: [SEASON_TEAMS, [id]],
    disagreements: [DRIVER_DISAGREEMENTS, [id]],
  })

  return (
    <Result state={state} context="That driver could not be read">
      {(data) => {
        const driver = data.driver.rows[0]
        if (!driver) {
          return (
            <Page title="No such driver" cite={false} back={{ to: '/drivers', label: 'The register' }}>
              <p className="muted">Nothing in the register has the id “{id}”.</p>
              <p>
                Press <kbd>/</kbd> to search every driver by name, or{' '}
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

  // The team a reader is most likely to want next is the one they drove for
  // last, and the season worth offering is the one they won most in.
  const lastTeam = results.find((row) => row.constructor_id)
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
  const bestSeason = useMemo(
    () =>
      [...bySeason].sort(
        (a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (b.podiums ?? 0) - (a.podiums ?? 0) || b.year - a.year,
      )[0] ?? null,
    [bySeason],
  )

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

  return (
    <Page
      eyebrow="Driver"
      title={driver.full_name}
      back={{ to: '/drivers', label: 'The register' }}
      lede={driver.notes}
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
      <Section>
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
                { key: 'year', label: 'Season', align: 'num' },
                { key: 'constructor', label: 'Constructor' },
                // The chart plots `position`; its table - the non-fallback source
                // of the same numbers - must not dash a season the dot has placed.
                { key: 'position_text', label: 'Position', align: 'num', render: (v, row) => cell(v ?? row.position) },
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

      <Onward
        items={[
          lastTeam
            ? {
                to: `/constructors/${lastTeam.constructor_id}`,
                label: lastTeam.constructor,
                hint: 'The team, its cars and everyone else who drove for it.',
              }
            : null,
          bestSeason
            ? {
                to: `/seasons/${bestSeason.year}`,
                label: `The ${bestSeason.year} season`,
                hint: bestSeason.wins
                  ? `Their best year here — ${bestSeason.wins} ${bestSeason.wins === 1 ? 'win' : 'wins'} from ${bestSeason.entries} entries.`
                  : 'The championship they were part of, round by round.',
              }
            : null,
          { to: '/records', label: 'Records', hint: 'Where this career sits against everyone else.' },
          { to: '/drivers', label: 'All drivers', hint: 'Filter the register by nationality or era.' },
        ]}
      />
    </Page>
  )
}
