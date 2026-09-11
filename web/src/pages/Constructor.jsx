import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Figure from '../charts/Figure.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { missing, number, points as fmtPoints, span } from '../lib/format.js'
import { finalStandings } from '../lib/standings.js'
import { colourFor } from '../lib/racingColours.js'

const CONSTRUCTOR = `SELECT * FROM constructors WHERE id = ?`

const DERIVED = `
  SELECT COUNT(*)                       AS entries,
         COUNT(DISTINCT r.year)         AS seasons,
         COUNT(DISTINCT r.id)           AS races,
         SUM(e.finish_position = 1)     AS wins,
         SUM(e.finish_position <= 3)    AS podiums,
         SUM(e.pole = 1)                AS poles,
         SUM(e.fastest_lap = 1)         AS fastest_laps,
         COUNT(DISTINCT e.driver_id)    AS drivers
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE e.constructor_id = ?
`

const BY_SEASON = `
  SELECT r.year,
         COUNT(*)                    AS entries,
         SUM(e.finish_position = 1)  AS wins,
         SUM(e.finish_position <= 3) AS podiums,
         SUM(e.pole = 1)             AS poles,
         SUM(COALESCE(e.points, 0))  AS points,
         MIN(e.finish_position)      AS best,
         COUNT(DISTINCT e.driver_id) AS drivers
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE e.constructor_id = ?
   GROUP BY r.year
   ORDER BY r.year
`

/**
 * after_round IS NULL is the season's final table, not a missing round — and it
 * can legitimately hold two rows for one constructor: Force India was excluded
 * from 2018 with nothing and its successor scored 52 under the same id. Both
 * survive finalStandings; the same-fact-from-two-sources rows do not.
 */
const STANDINGS = `
  SELECT s.id, s.year, s.entity_id, s.engine_id, s.position, s.position_text, s.points, s.team
    FROM standings s
   WHERE s.table_type = 'constructors' AND s.entity_id = ? AND s.after_round IS NULL
   ORDER BY s.year
`

const WINS = `
  SELECT r.year, r.round, r.name_used, r.circuit_id, c.name AS circuit,
         e.driver_id, d.full_name AS driver, e.chassis_id, ch.name AS chassis
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN circuits c  ON c.id = r.circuit_id
    LEFT JOIN drivers d   ON d.id = e.driver_id
    LEFT JOIN chassis ch  ON ch.id = e.chassis_id
   WHERE e.constructor_id = ? AND e.finish_position = 1
   ORDER BY r.year DESC, r.round DESC
`

const DESIGNS = `
  SELECT ch.id, ch.name, ch.first_year, ch.last_year, ch.engine_name, ch.chassis_type,
         ch.power_bhp, ch.races, ch.wins, ch.confidence
    FROM chassis ch
   WHERE ch.constructor_id = ?
   ORDER BY ch.first_year, ch.name
`

const LINEAGE = `
  SELECT l.* FROM constructor_lineage l
   WHERE l.chain_id = (SELECT lineage_chain FROM constructors WHERE id = ?)
   ORDER BY l.sequence
`

export default function Constructor() {
  const { id } = useParams()
  const state = useQueries({
    constructor: [CONSTRUCTOR, [id]],
    derived: [DERIVED, [id]],
    bySeason: [BY_SEASON, [id]],
    standings: [STANDINGS, [id]],
    wins: [WINS, [id]],
    designs: [DESIGNS, [id]],
    lineage: [LINEAGE, [id]],
  })

  return (
    <Result state={state} context="That constructor could not be read">
      {(data) => {
        const constructor = data.constructor.rows[0]
        if (!constructor) {
          return (
            <Page title="No such constructor" back={{ to: '/constructors', label: 'The register' }}>
              <p className="muted">Nothing in the register has the id “{id}”.</p>
              <p>
                Press <kbd>/</kbd> to search by name, or{' '}
                <Link to="/constructors">browse the register</Link>. A few names used by other
                sources are deliberately not held here — the{' '}
                <Link to="/reference/quality">data quality page</Link> says which and why.
              </p>
            </Page>
          )
        }
        return <ConstructorBody constructor={constructor} data={data} />
      }}
    </Result>
  )
}

function ConstructorBody({ constructor, data }) {
  const derived = data.derived.rows[0] ?? {}
  const bySeason = rows(data, 'bySeason')
  const standings = finalStandings(rows(data, 'standings'))
  const wins = rows(data, 'wins')
  const designs = rows(data, 'designs')
  const lineage = rows(data, 'lineage')

  const winsBySeason = bySeason.filter((s) => s.wins > 0)
  // The two routes out of here a reader most often wants: the car that won the
  // most, and the season they were last part of.
  const bestCar = [...designs].sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (b.races ?? 0) - (a.races ?? 0))[0] ?? null
  const lastSeason = bySeason[bySeason.length - 1] ?? null
  const engineSplit = standings.some((s) => s.engine_id)
  const colour = colourFor(constructor.country)

  return (
    <Page
      eyebrow="Constructor"
      title={constructor.name}
      back={{ to: '/constructors', label: 'The register' }}
      lede={constructor.notes}
      aside={
        colour && (
          <p className="livery-band" style={{ marginTop: 14 }}>
            <i style={{ background: colour.hex }} />
            {colour.name}
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>
              — {constructor.country}'s international racing colour, under the convention that
              painted a car for the country that entered it until sponsor liveries took over around
              1968. Not this team's own livery.
            </span>
          </p>
        )
      }
    >
      <Section>
        <Stats
          items={[
            {
              label: 'Entered',
              value: span(constructor.first_entry, constructor.active ? null : constructor.last_entry),
              note: `${derived.seasons ?? 0} seasons`,
            },
            { label: 'Race entries', value: number(derived.entries) },
            { label: 'Wins', value: number(derived.wins ?? 0) },
            { label: 'Podiums', value: number(derived.podiums ?? 0) },
            { label: 'Poles', value: number(derived.poles ?? 0) },
            { label: 'Drivers', value: number(derived.drivers) },
            constructor.constructors_titles
              ? {
                  label: "Constructors' titles",
                  value: number(constructor.constructors_titles),
                  note: constructor.title_years ?? undefined,
                }
              : null,
            constructor.drivers_titles
              ? { label: "Drivers' titles", value: number(constructor.drivers_titles) }
              : null,
          ].filter(Boolean)}
        />
      </Section>

      {lineage.length > 1 && (
        <Section
          title={lineage[0].chain_name}
          note="One factory, several names. Each name keeps its own record here; the chain is what connects them."
        >
          <div className="timeline">
            {lineage.map((step) => (
              <article key={step.id}>
                <h3>
                  {step.entity_name}
                  <span className="years">{span(step.from_year, step.to_year)}</span>
                  {step.entity_name === constructor.name && <span className="pill">this page</span>}
                </h3>
                {step.note && <p>{step.note}</p>}
              </article>
            ))}
          </div>
        </Section>
      )}

      {winsBySeason.length > 1 && (
        <Section title="Wins by season">
          <Figure
            title={`${constructor.name} race wins`}
            note="Only seasons with a win are drawn. A shared drive counts once, to the car."
            table={{
              rows: winsBySeason,
              columns: [
                { key: 'year', label: 'Season', align: 'num' },
                { key: 'wins', label: 'Wins', align: 'num' },
                { key: 'entries', label: 'Entries', align: 'num' },
              ],
            }}
          >
            <ColumnChart
              data={winsBySeason.map((s) => ({ key: s.year, value: s.wins, label: String(s.year) }))}
              labelEvery={Math.max(1, Math.ceil(winsBySeason.length / 12))}
              height={200}
              label={`Race wins per season for ${constructor.name}`}
            />
          </Figure>
        </Section>
      )}

      <Section title="Season by season" count={`${bySeason.length} seasons`}>
        <DataTable
          rows={bySeason.map((season) => {
            const standing = standings.find((s) => s.year === season.year)
            return {
              ...season,
              championship: standing?.position ?? null,
              championship_text: standing?.position_text ?? null,
            }
          })}
          rowKey={(row) => row.year}
          sort="year"
          direction="desc"
          columns={[
            {
              key: 'year',
              label: 'Season',
              align: 'num',
              render: (year) => <Link to={`/seasons/${year}`}>{year}</Link>,
            },
            { key: 'entries', label: 'Entries', align: 'num' },
            { key: 'drivers', label: 'Drivers', align: 'num' },
            { key: 'wins', label: 'Wins', align: 'num' },
            { key: 'podiums', label: 'Podiums', align: 'num' },
            { key: 'poles', label: 'Poles', align: 'num' },
            {
              key: 'best',
              label: 'Best',
              align: 'num',
              render: (value) => (missing(value) ? cell(value) : `P${value}`),
            },
            { key: 'points', label: 'Points scored', align: 'num', render: (v) => fmtPoints(v) },
            {
              key: 'championship_text',
              label: 'Championship',
              align: 'num',
              sort: (row) => row.championship,
            },
          ]}
          footer={
            engineSplit
              ? "The constructors' championship is contested by a chassis–engine pair, so a season can carry more than one entry for the same name. Open the season to see both."
              : undefined
          }
        />
      </Section>

      {wins.length > 0 && (
        <Section title="Every win" count={`${wins.length}`}>
          <DataTable
            rows={wins}
            rowKey={(row) => `${row.year}-${row.round}-${row.driver_id}`}
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
                key: 'circuit',
                label: 'Circuit',
                render: (name, row) =>
                  row.circuit_id ? <Link to={`/circuits/${row.circuit_id}`}>{name}</Link> : cell(name),
              },
              {
                key: 'driver',
                label: 'Driver',
                render: (name, row) =>
                  row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name}</Link> : cell(name),
              },
              {
                key: 'chassis',
                label: 'Chassis',
                render: (name, row) =>
                  row.chassis_id ? <Link to={`/cars/${row.chassis_id}`}>{name ?? row.chassis_id}</Link> : cell(name),
              },
            ]}
            footer="A blank chassis is a season this team ran more than one design and no source records which car raced which round."
          />
        </Section>
      )}

      {designs.length > 0 && (
        <Section title="Cars built" count={`${designs.length} designs`}>
          <DataTable
            rows={designs}
            rowKey={(row) => row.id}
            sort="first_year"
            direction="asc"
            page={80}
            columns={[
              {
                key: 'name',
                label: 'Chassis',
                render: (name, row) => <Link to={`/cars/${row.id}`}>{name}</Link>,
              },
              {
                key: 'first_year',
                label: 'Years',
                align: 'num',
                render: (_, row) => span(row.first_year, row.last_year),
                sort: (row) => row.first_year,
              },
              { key: 'engine_name', label: 'Engine' },
              { key: 'power_bhp', label: 'Power (bhp)', align: 'num' },
              { key: 'races', label: 'Races', align: 'num' },
              { key: 'wins', label: 'Wins', align: 'num' },
            ]}
          />
        </Section>
      )}

      <Section title="On the record">
        {constructor.confidence === 'medium' && (
          <Note>
            <strong>Trust the tables above this one.</strong> The figures counted from the races
            carry more weight than the summary values in this panel, which is why the two are kept
            apart.
          </Note>
        )}
        <Fields
          items={[
            { label: 'Full name', value: constructor.full_name },
            { label: 'Country', value: constructor.country },
            { label: 'Base', value: constructor.base },
            { label: 'Wins (register)', value: number(constructor.wins) },
            { label: 'Poles (register)', value: number(constructor.poles) },
            { label: 'Lineage chain', value: constructor.lineage_chain },
            { label: 'Confidence', value: <Confidence value={constructor.confidence} /> },
            {
              label: 'Source',
              value: constructor.source ? (
                <a href={constructor.source} target="_blank" rel="noreferrer noopener">
                  {constructor.source}
                </a>
              ) : null,
            },
          ]}
        />
      </Section>

      <Onward
        items={[
          bestCar
            ? {
                to: `/cars/${bestCar.id}`,
                label: bestCar.name,
                hint: bestCar.wins
                  ? `Their most successful design — ${bestCar.wins} ${bestCar.wins === 1 ? 'win' : 'wins'}.`
                  : 'Specification, entries and results.',
              }
            : null,
          lastSeason
            ? {
                to: `/seasons/${lastSeason.year}`,
                label: `The ${lastSeason.year} season`,
                hint: constructor.active ? 'The championship as it stands.' : 'Their last season in the championship.',
              }
            : null,
          { to: '/records', label: 'Records', hint: 'Most wins by constructor, and every title.' },
          { to: '/constructors', label: 'All constructors', hint: 'The other 149, filterable by country and era.' },
        ]}
      />
    </Page>
  )
}
