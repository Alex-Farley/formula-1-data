import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import { useQuery } from '../data/useQuery.js'
import { colourForEntry } from '../lib/liveries.js'
import { NAMES, NOT_YET_RUN, SO_FAR } from '../lib/site.js'
import { SEASONS, SEASONS_COLUMNS, SEASON_LIST_FOOTER } from '../queries/seasons.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
/**
 * A name as a link where it has an id, with the undecided season's "so far"
 * mark - or "not yet run" where the season has a calendar and no rounds
 * behind it, which is the words its `text` carries and not the em dash a
 * missing name would get. scripts/prerender.js does the same.
 */
const named = (path) => (name, row) => {
  const id = row[`${path === 'drivers' ? 'champion' : 'constructors_champion'}_id`]
  if (row.not_started) return <span className="tag">{NOT_YET_RUN}</span>
  return (
    <>
      {id ? <Link to={`/${path}/${id}`}>{name}</Link> : cell(name)}
      {row.undecided && name ? ' ' : ''}
      {row.undecided && name ? <span className="tag">{SO_FAR}</span> : null}
    </>
  )
}

/**
 * One of the row's two constructors as a colour: its livery from 2010, its
 * country's racing colour before 1968 (AF-50). `key` is the column, and the
 * query carries `<key>_id` and `<key>_country` beside the name for both.
 */
const teamColour = (key, name, row) =>
  colourForEntry({
    constructorId: row[`${key}_id`],
    country: row[`${key}_country`],
    year: row.year,
    team: name,
  })

/** The constructors' champion's name, as the column drew it before the mark. */
const championConstructor = named('constructors')

/**
 * True where the row names one constructor twice: the drivers' champion
 * drove for the constructors' champion. Decided on #378 — the column keeps
 * clause 3 of AF-47, one mark per row and never one per mention, so the
 * constructors' champion is marked only where it is a *different* team, and
 * a mark there is the reading "the two titles were split that season". The
 * fact is in the two names as well as the mark, which is why absence can
 * carry it.
 */
const oneTeamTwice = (row) =>
  Boolean(row.champion_team_id) && row.champion_team_id === row.constructors_champion_id

/**
 * The React renders for the columns queries/seasons.js defines — the links
 * and the tag; the router is the reason they live here. The words each cell
 * carries are the column's own `text`, which scripts/prerender.js prints too,
 * so the static list is this one.
 */
const APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  champion: { render: named('drivers') },
  // The champion's car in its colour (AF-47 clause 1), as Races.jsx draws
  // the winning one: the mark, then the name, the year the row's own.
  champion_team: {
    render: (name, row) => (
      <>
        <LiveryMark colour={teamColour('champion_team', name, row)} year={row.year} />
        {row.champion_team_id ? <Link to={`/constructors/${row.champion_team_id}`}>{name}</Link> : cell(name)}
      </>
    ),
  },
  runner_up: {
    render: (name, row) => (row.runner_up_id ? <Link to={`/drivers/${row.runner_up_id}`}>{name}</Link> : cell(name)),
  },
  // Marked only where it is not the team already marked in "Driving for".
  // The element is drawn either way: with no colour it is LiveryMark's
  // transparent spacer, so the names stay aligned however the table is
  // sorted, and only the colour comes and goes.
  constructors_champion: {
    render: (name, row) => (
      <>
        <LiveryMark
          colour={oneTeamTwice(row) ? null : teamColour('constructors_champion', name, row)}
          year={row.year}
        />
        {championConstructor(name, row)}
      </>
    ),
  },
}

export default function Seasons() {
  const state = useQuery(SEASONS)

  return (
    <Page
      title={NAMES.seasons().headline}
      documentName={NAMES.seasons().title}
      trail={TRAIL.seasons()}
      lede="Seventy-seven championships, newest first. Pick a year for its calendar, the title race round by round, and the final tables — or sort this list by any column to find the closest finishes and the biggest walkovers."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => (
            <DataTable
              data={data}
              rowKey={(row) => row.year}
              sort="year"
              direction="desc"
              columns={SEASONS_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
              footer={SEASON_LIST_FOOTER}
            />
          )}
        </Result>
      </Section>

      <Onward {...ONWARD.seasons()} />
    </Page>
  )
}
