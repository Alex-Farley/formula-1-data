import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { useQuery } from '../data/useQuery.js'
import { NOT_YET_RUN, SO_FAR } from '../lib/site.js'
import { SEASONS, SEASONS_COLUMNS, SEASON_LIST_FOOTER } from '../queries/seasons.js'

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
 * The React renders for the columns queries/seasons.js defines — the links
 * and the tag; the router is the reason they live here. The words each cell
 * carries are the column's own `text`, which scripts/prerender.js prints too,
 * so the static list is this one.
 */
const APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  champion: { render: named('drivers') },
  champion_team: {
    render: (name, row) =>
      row.champion_team_id ? <Link to={`/constructors/${row.champion_team_id}`}>{name}</Link> : cell(name),
  },
  runner_up: {
    render: (name, row) => (row.runner_up_id ? <Link to={`/drivers/${row.runner_up_id}`}>{name}</Link> : cell(name)),
  },
  constructors_champion: { render: named('constructors') },
}

export default function Seasons() {
  const state = useQuery(SEASONS)

  return (
    <Page
      title="Seasons"
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

      <Onward
        items={[
          { to: '/races', label: 'Every race', hint: 'All 1,000-plus rounds in one filterable list.' },
          { to: '/records', label: 'Records', hint: 'Champions, most wins, most poles, grand slams.' },
          { to: '/reference/eras', label: 'Eras and rules', hint: 'Why a 1955 points total cannot be compared with a 2025 one.' },
        ]}
      />
    </Page>
  )
}
