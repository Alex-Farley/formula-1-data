import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Disagreement, { DRIVER_DISAGREEMENTS } from '../components/Disagreement.jsx'
import Figure from '../charts/Figure.jsx'
import DotPlot from '../charts/DotPlot.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { EMPTY, missing, points as fmtPoints, result } from '../lib/format.js'
import { ENTRIES_NOTE } from '../lib/site.js'
import { colourForEntry } from '../lib/liveries.js'
import {
  BY_SEASON,
  DERIVED,
  DRIVER,
  ENTRY_COLUMNS,
  RESULTS,
  SEASON_COLUMNS,
  SEASONS_FOOTER,
  STANDINGS,
  pointsDiffer,
  pointsNote,
  record,
  seasonRows,
  strip,
} from '../queries/driver.js'

/**
 * What only the app adds to the shared column lists: links, the sort key
 * behind a text column, and the markup a result wears. Everything a cell
 * SAYS is in queries/driver.js, read by scripts/prerender.js too.
 */
const SEASON_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  championship_text: { sort: (row) => row.championship },
}

const ENTRY_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  name_used: { render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link> },
  constructor: {
    render: (name, row) =>
      row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name),
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
  const differ = pointsDiffer(driver, derived)

  return (
    <Page
      eyebrow="Driver"
      title={driver.full_name}
      back={{ to: '/drivers', label: 'The register' }}
      lede={driver.notes}
      aside={
        teamColour && (
          <p className="livery-band" style={{ marginTop: 14 }}>
            <i className="livery" style={teamColour.style} />
            {teamColour.name}
            <span>
              {teamColour.kind === 'livery'
                ? `The colour ${lastTeam.constructor} raced in ${lastTeam.year}, as the team names it - the last team on this record.`
                : `${lastTeam.constructor}'s international racing colour in ${lastTeam.year}, under the convention that painted a car for the country that entered it. Not the team's own livery.`}
            </span>
          </p>
        )
      }
    >
      <Section>
        <Stats items={strip(driver, derived)} />
      </Section>

      {standings.length > 1 && (
        <Section title="Where each championship finished">
          <Figure
            title={`${driver.full_name} in the drivers' championship`}
            note="Final classified position at the end of each season. A season with points but no position is one the driver was excluded from, so there is nothing to plot."
            table={{
              rows: standings,
              columns: [
                { key: 'year', label: 'Season', align: 'num' },
                // The chart plots `position`; its table - the non-fallback source
                // of the same numbers - must not dash a season the dot has placed.
                { key: 'position_text', label: 'Position', align: 'num', render: (v, row) => cell(v ?? row.position) },
                { key: 'points', label: 'Points', align: 'num' },
              ],
            }}
          >
            <DotPlot
              data={standings.map((s) => ({
                x: s.year,
                y: s.position,
                label: `${s.year}`,
                note: s.position ? `P${s.position} · ${fmtPoints(s.points)} points` : 'no classified position',
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
          columns={SEASON_COLUMNS.map((column) => ({ ...column, ...SEASON_APP[column.key] }))}
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
