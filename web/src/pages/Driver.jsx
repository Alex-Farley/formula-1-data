import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Figure from '../charts/Figure.jsx'
import DotPlot from '../charts/DotPlot.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { missing, number, points as fmtPoints, result, span } from '../lib/format.js'

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
         SUM(e.grid = 1)                 AS poles,
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
         SUM(e.finish_position = 1)  AS wins,
         SUM(e.finish_position <= 3) AS podiums,
         SUM(e.grid = 1)             AS poles,
         SUM(e.fastest_lap = 1)      AS fastest_laps,
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
 * One row per season, from the table as the season finished.
 *
 * after_round IS NULL is the final classification — `as_of` reads "final" —
 * rather than a missing round. Taking the highest after_round instead is right
 * in almost every season and wrong in the ones where it matters.
 */
const STANDINGS = `
  SELECT s.year, s.position, s.position_text, s.points
    FROM standings s
   WHERE s.table_type = 'drivers' AND s.entity_id = ? AND s.after_round IS NULL
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
  })

  return (
    <Result state={state} context="That driver could not be read">
      {(data) => {
        const driver = data.driver.rows[0]
        if (!driver) {
          return (
            <Page title="No such driver" back={{ to: '/drivers', label: 'The register' }}>
              <p className="muted">Nothing in the register has the id “{id}”.</p>
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
  const standings = rows(data, 'standings')
  const results = rows(data, 'results')

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
              ? { label: 'Titles', value: number(driver.titles), note: driver.title_years ?? undefined }
              : null,
            { label: 'Best finish', value: derived.best ? `P${derived.best}` : null },
          ].filter(Boolean)}
        />
      </Section>

      {standings.length > 1 && (
        <Section title="Where each championship finished">
          <Figure
            title={`${driver.full_name} in the drivers' championship`}
            note="Final classified position at the end of each season. A season with points and no position is a season the driver was excluded from the classification, and it is not plotted — there is no position to plot."
            table={{
              rows: standings,
              columns: [
                { key: 'year', label: 'Season', align: 'num' },
                { key: 'position_text', label: 'Position', align: 'num' },
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
            },
            {
              key: 'points',
              label: 'Points scored',
              align: 'num',
              render: (value) => fmtPoints(value),
            },
          ]}
          footer="“Points scored” adds up every point in the race records. The championship column is the standing the season actually finished on, which before 1991 could be lower after the dropped-scores rule."
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
            { key: 'status', label: 'Out' },
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

      <Section title="The register's own figures">
        {pointsDiffer && (
          <Note>
            <strong>
              The register has {fmtPoints(driver.career_points)} career points; the race records add
              up to {fmtPoints(derived.points)}.
            </strong>{' '}
            Both are right. Every season up to 1990 counted only a driver's best few results, so a
            career total published at the time is net of the points that were dropped. Deriving the
            net figure means applying each season's scoring rules in turn, which this database does
            not yet do — it is listed as open work rather than papered over.
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
          Entries and starts are stored figures, not derived ones: a start is not the same as an
          entry, and telling them apart needs the reason each driver failed to start. Wins, poles
          and fastest laps <em>are</em> derived, and are reconciled against the published totals on
          every build — that reconciliation is what caught a wrong pole count in a published source.
        </p>
      </Section>
    </Page>
  )
}
