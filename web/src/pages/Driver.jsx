import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Disagreement, { DRIVER_DISAGREEMENTS } from '../components/Disagreement.jsx'
import Figure from '../charts/Figure.jsx'
import DotPlot from '../charts/DotPlot.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { finished, missing, number, points as fmtPoints, result, span, yearList } from '../lib/format.js'

const DRIVER = `SELECT * FROM drivers WHERE id = ?`

/**
 * The career, counted from the race records rather than read from a column.
 *
 * The stored figures are shown beside these on the page, because where they
 * differ the difference is the interesting part: career_points is a gross
 * total here and a net one in the register for every season that ran the
 * best-N-results rule, which is every season up to 1990.
 */
const DERIVED = `
  SELECT COUNT(*)                        AS entries,
         COUNT(DISTINCT r.year)          AS seasons,
         SUM(e.finish_position = 1)      AS wins,
         SUM(e.finish_position <= 3)     AS podiums,
         SUM(e.pole = 1)                 AS poles,
         SUM(e.fastest_lap = 1)          AS fastest_laps,
         SUM(COALESCE(e.points, 0))      AS points,
         MIN(e.finish_position)          AS best,
         SUM(e.finish_position IS NOT NULL) AS classified,
         SUM(e.shared_drive = 1)         AS shared
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE e.driver_id = ?
`

const BY_SEASON = `
  SELECT r.year,
         COUNT(*)                    AS entries,
         -- COALESCE, because SUM over a season with no classified finish is
         -- NULL, which rendered as the em dash meaning "not established" on
         -- 591 driver-seasons whose true figure is zero - beside a strip that
         -- said WINS 0 forty pixels above.
         COALESCE(SUM(e.finish_position = 1), 0)  AS wins,
         COALESCE(SUM(e.finish_position <= 3), 0) AS podiums,
         COALESCE(SUM(e.pole = 1), 0)             AS poles,
         COALESCE(SUM(e.fastest_lap = 1), 0)      AS fastest_laps,
         SUM(COALESCE(e.points, 0))  AS points,
         MIN(e.finish_position)      AS best,
         group_concat(DISTINCT k.name) AS teams
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE e.driver_id = ?
   GROUP BY r.year
   ORDER BY r.year
`

/**
 * The table as each season finished, one row per season. v_standings_final
 * folds the two sources that describe 2026 into one row and says why in
 * schema.sql; a driver can still hold two rows in one season only where one
 * source asserts two entries, which never happens for a driver.
 */
const STANDINGS = `
  SELECT s.id, s.year, s.entity_id, s.engine_id, s.position, s.position_text, s.points, s.team
    FROM v_standings_final s
   WHERE s.table_type = 'drivers' AND s.entity_id = ?
   ORDER BY s.year
`

const RESULTS = `
  SELECT r.year, r.round, r.name_used, r.circuit_id, c.name AS circuit,
         e.grid_text, e.grid, e.position_text, e.finish_position, e.status,
         e.points, e.fastest_lap, e.shared_drive, e.laps_completed,
         k.id AS constructor_id, k.name AS constructor,
         e.chassis_id, ch.name AS chassis
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
    LEFT JOIN chassis ch ON ch.id = e.chassis_id
   WHERE e.driver_id = ?
   ORDER BY r.year DESC, r.round DESC
`

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
            <Page title="No such driver" back={{ to: '/drivers', label: 'The register' }}>
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
  const bestSeason = useMemo(
    () =>
      [...bySeason].sort(
        (a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (b.podiums ?? 0) - (a.podiums ?? 0) || b.year - a.year,
      )[0] ?? null,
    [bySeason],
  )

  const standingByYear = useMemo(
    () => new Map(standings.map((s) => [s.year, s])),
    [standings],
  )

  const seasonRows = useMemo(
    () =>
      bySeason.map((season) => ({
        ...season,
        championship: standingByYear.get(season.year)?.position ?? null,
        championship_text: standingByYear.get(season.year)?.position_text ?? null,
        championship_points: standingByYear.get(season.year)?.points ?? null,
      })),
    [bySeason, standingByYear],
  )

  // The stored career total is net of dropped scores wherever the season's
  // rules dropped any; the derived one adds up every point scored. Saying so
  // is better than showing one and hiding the other.
  const pointsDiffer =
    !missing(driver.career_points) &&
    !missing(derived.points) &&
    Math.abs(driver.career_points - derived.points) > 0.01

  return (
    <Page
      eyebrow="Driver"
      title={driver.full_name}
      back={{ to: '/drivers', label: 'The register' }}
      lede={driver.notes}
    >
      <Section>
        <Stats
          items={[
            { label: 'Seasons', value: span(driver.first_season, driver.last_season), note: `${derived.seasons ?? 0} with an entry` },
            { label: 'Entries', value: number(derived.entries) },
            { label: 'Wins', value: number(derived.wins ?? 0) },
            { label: 'Podiums', value: number(derived.podiums ?? 0) },
            { label: 'Poles', value: number(derived.poles ?? 0) },
            { label: 'Fastest laps', value: number(derived.fastest_laps ?? 0) },
            driver.titles
              ? { label: 'Titles', value: number(driver.titles), note: missing(driver.title_years) ? undefined : yearList(driver.title_years) }
              : null,
            { label: 'Best finish', value: derived.best ? `P${derived.best}` : null },
          ].filter(Boolean)}
        />
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

      <Section title="Season by season" count={`${seasonRows.length} seasons`}>
        <DataTable
          rows={seasonRows}
          rowKey={(row) => row.year}
          sortable
          sort="year"
          direction="desc"
          columns={[
            {
              key: 'year',
              label: 'Season',
              align: 'num',
              render: (year) => <Link to={`/seasons/${year}`}>{year}</Link>,
            },
            { key: 'teams', label: 'Constructor', align: 'prose' },
            { key: 'entries', label: 'Entries', align: 'num' },
            { key: 'wins', label: 'Wins', align: 'num' },
            { key: 'podiums', label: 'Podiums', align: 'num' },
            { key: 'poles', label: 'Poles', align: 'num' },
            { key: 'fastest_laps', label: 'FL', align: 'num' },
            {
              key: 'best',
              label: 'Best',
              align: 'num',
              render: (value) => (missing(value) ? cell(value) : `P${value}`),
            },
            {
              key: 'championship_text',
              label: 'Championship',
              align: 'num',
              sort: (row) => row.championship,
              render: (v, row) => cell(v ?? row.championship),
            },
            {
              key: 'points',
              label: 'Points scored',
              align: 'num',
              render: (value) => fmtPoints(value),
            },
          ]}
          footer="“Points scored” adds up every point from the races. The championship column is where the season actually finished, which before 1991 could be lower once dropped scores were applied. Open a season for its full table."
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
          columns={[
            {
              key: 'year',
              label: 'Season',
              align: 'num',
              render: (year) => <Link to={`/seasons/${year}`}>{year}</Link>,
            },
            {
              key: 'name_used',
              label: 'Grand Prix',
              render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link>,
            },
            {
              key: 'constructor',
              label: 'Constructor',
              render: (name, row) =>
                row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name),
            },
            {
              key: 'chassis',
              label: 'Chassis',
              render: (name, row) =>
                row.chassis_id ? <Link to={`/cars/${row.chassis_id}`}>{name ?? row.chassis_id}</Link> : cell(name),
            },
            { key: 'grid_text', label: 'Grid', align: 'num', sort: (row) => row.grid },
            {
              key: 'position_text',
              label: 'Result',
              align: 'num',
              sort: (row) => row.finish_position,
              render: (_, row) => {
                const value = result(row)
                return missing(row.finish_position) ? (
                  <span className="tag tag-dnf">{value}</span>
                ) : (
                  <b>{value}</b>
                )
              },
            },
            {
              key: 'status',
              label: 'Out',
              render: (value, row) =>
                finished(value, row.finish_position) ? 'Finished' : cell(value),
            },
            { key: 'laps_completed', label: 'Laps', align: 'num' },
            {
              key: 'points',
              label: 'Points',
              align: 'num',
              render: (value) => (missing(value) ? cell(value) : fmtPoints(value)),
            },
          ]}
        />
      </Section>

      <Disagreement rows={rows(data, 'disagreements')} what="this career" />

      <Section title="On the record">
        {pointsDiffer && (
          <Note>
            <strong>
              Two career points totals: {fmtPoints(driver.career_points)} published,{' '}
              {fmtPoints(derived.points)} scored.
            </strong>{' '}
            Both are right. Up to 1990 only a driver's best few results counted towards the
            championship, so the published total is net of the points that were dropped.
          </Note>
        )}
        <Fields
          items={[
            { label: 'Born', value: driver.born },
            { label: 'Died', value: driver.died },
            { label: 'Nationality', value: driver.nationality },
            { label: 'Status', value: driver.status },
            { label: 'Entries (stored)', value: number(driver.entries) },
            { label: 'Starts (stored)', value: number(driver.starts) },
            {
              label: 'Wins',
              value: `${number(driver.wins)} derived${
                missing(driver.wins_external) ? '' : ` · ${number(driver.wins_external)} published`
              }`,
            },
            {
              label: 'Poles',
              value: `${number(driver.poles)} derived${
                missing(driver.poles_external) ? '' : ` · ${number(driver.poles_external)} published`
              }`,
            },
            {
              label: 'Fastest laps',
              value: `${number(driver.fastest_laps)} derived${
                missing(driver.fastest_laps_external)
                  ? ''
                  : ` · ${number(driver.fastest_laps_external)} published`
              }`,
            },
            { label: 'External source', value: driver.external_source },
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
        <p className="source-note">
          Wins, poles and fastest laps are counted from the races above and checked against the
          published totals on every build; where the two disagree, both are shown. Entries and
          starts are the published figures — an entry is not a start, and telling them apart needs
          a reason for each non-start that no source here supplies.
        </p>
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
