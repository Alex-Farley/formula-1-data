import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Confidence, Note, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips } from '../components/Filters.jsx'
import Figure from '../charts/Figure.jsx'
import BarChart from '../charts/BarChart.jsx'
import LineChart from '../charts/LineChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { percent } from '../lib/format.js'
import {
  CONSTRUCTOR_WINS,
  DECADES,
  DRIVER_POLES,
  DRIVER_WINS,
  GRAND_SLAM_COLUMNS,
  GRAND_SLAMS,
  POLE_TO_WIN,
  RECORDS,
  TIER_AFTER,
  TITLE_COLUMNS,
  TITLES,
  recordColumns,
  tierBefore,
  tiersOf,
} from '../queries/records.js'

/**
 * What only the app adds to the shared column lists: the links. The queries
 * and the columns are in queries/records.js, read by scripts/prerender.js
 * too, so the static records table is this one.
 */
const GRAND_SLAM_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  gp_name: { render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link> },
}

export default function Records() {
  const state = useQueries({
    records: [RECORDS],
    driverWins: [DRIVER_WINS],
    driverPoles: [DRIVER_POLES],
    constructorWins: [CONSTRUCTOR_WINS],
    titles: [TITLES],
    decades: [DECADES],
    poleToWin: [POLE_TO_WIN],
    grandSlams: [GRAND_SLAMS],
  })

  return (
    <Page
      title="Records"
      lede="Who has the most of everything: wins, poles, titles, grand slams, and the decade each of them owned. The records at the top are derived from the same tables as the leaderboards below on every build; the leaderboards are counted from the race records as this page loads."
    >
      <Result state={state}>{(data) => <Body data={data} />}</Result>
    </Page>
  )
}

function Body({ data }) {
  const records = rows(data, 'records')
  const driverWins = rows(data, 'driverWins')
  const driverPoles = rows(data, 'driverPoles')
  const constructorWins = rows(data, 'constructorWins')
  const titles = rows(data, 'titles')
  const decades = rows(data, 'decades')
  const poleToWin = rows(data, 'poleToWin')
  const grandSlams = rows(data, 'grandSlams')

  const [category, setCategory] = useState('')
  const categories = useMemo(
    () => [...new Set(records.map((r) => r.category))].sort(),
    [records],
  )
  const shownRecords = category ? records.filter((r) => r.category === category) : records
  const tiers = useMemo(() => tiersOf(records), [records])

  const [decade, setDecade] = useState(() => String(Math.max(...decades.map((d) => d.decade))))
  const decadeRows = decades.filter((d) => String(d.decade) === decade).slice(0, 12)
  const decadeOptions = [...new Set(decades.map((d) => d.decade))].sort((a, b) => b - a)

  return (
    <>
      <Section title="Records" count={`${records.length}`}>
        {/* This sentence stays ABOVE the figures. Its predecessor caveated
            authored rows that could disagree with the leaderboards below, and
            sat 1,900 px under them; the rows are now derived from the same
            tables, so the sentence says that instead. */}
        <p className="note" style={{ marginTop: -4 }}>
          Every record here is derived from the same tables as the leaderboards below on every
          build, as of the last completed race the database holds, and each row says how.
          {tiers.length === 1 && (
            <>
              {' '}{tierBefore(records.length)}<Confidence value={tiers[0]} />{TIER_AFTER}
            </>
          )}
        </p>
        <div className="filters">
          <Chips
            label="Filter records by category"
            value={category}
            onChange={setCategory}
            options={[['', 'All'], ...categories.map((c) => [c, c])]}
          />
        </div>
        <DataTable
          rows={shownRecords}
          rowKey={(row) => row.id}
          sortable={false}
          page={60}
          columns={recordColumns(records).map((column) =>
            column.key === 'confidence' ? { ...column, render: (value) => <Confidence value={value} /> } : column,
          )}
        />
      </Section>

      <Section title="Counted from the race records">
        <div className="split">
          <Figure
            title="Most Grand Prix wins"
            note="One win per driver classified first, so a shared drive counts for both of them."
            table={{
              rows: driverWins,
              columns: [
                { key: 'full_name', label: 'Driver' },
                { key: 'wins', label: 'Wins', align: 'num' },
                { key: 'first_win', label: 'First', align: 'num' },
                { key: 'last_win', label: 'Last', align: 'num' },
              ],
            }}
          >
            <BarChart
              data={driverWins.slice(0, 15).map((d) => ({ key: d.driver_id, label: d.full_name, value: d.wins }))}
              label="The fifteen drivers with the most Grand Prix wins"
            />
          </Figure>

          <Figure
            title="Most pole positions"
            note="The driver the season record credits with pole. Not always the car at grid 1: a penalty or a sprint-set grid can part them, and each race page says so where they differ."
            table={{
              rows: driverPoles,
              columns: [
                { key: 'full_name', label: 'Driver' },
                { key: 'poles', label: 'Poles', align: 'num' },
              ],
            }}
          >
            <BarChart
              data={driverPoles.slice(0, 15).map((d) => ({ key: d.driver_id, label: d.full_name, value: d.poles }))}
              label="The fifteen drivers with the most pole positions"
            />
          </Figure>
        </div>
      </Section>

      <Section title="Constructors">
        <Figure
          title="Most wins by constructor"
          note="A constructor's win belongs to the car, so a shared drive counts once here and twice in the driver tables."
          table={{
            rows: constructorWins,
            columns: [
              { key: 'name', label: 'Constructor' },
              { key: 'country', label: 'Country' },
              { key: 'wins', label: 'Wins', align: 'num' },
              { key: 'first_win', label: 'First', align: 'num' },
              { key: 'last_win', label: 'Last', align: 'num' },
              { key: 'constructors_titles', label: "Constructors' titles", align: 'num' },
            ],
          }}
        >
          <BarChart
            data={constructorWins.slice(0, 15).map((c) => ({ key: c.name, label: c.name, value: c.wins }))}
            label="The fifteen constructors with the most Grand Prix wins"
          />
        </Figure>
      </Section>

      <Section title="Champions" count={`${titles.length}`}>
        <DataTable
          rows={titles}
          rowKey={(row) => row.full_name}
          sort="titles"
          direction="desc"
          columns={TITLE_COLUMNS}
        />
      </Section>

      <Section title="Who won the decade" count={`${decadeOptions.length} decades`}>
        <div className="filters">
          <Chips
            label="Choose a decade"
            value={decade}
            onChange={setDecade}
            options={decadeOptions.map((d) => [String(d), `${d}s`])}
          />
        </div>
        <Figure
          title={`Most wins, the ${decade}s`}
          note="A decade is the ten seasons whose year begins with it; the 2020s are still running."
          table={{
            rows: decadeRows,
            columns: [
              { key: 'full_name', label: 'Driver' },
              { key: 'wins', label: 'Wins', align: 'num' },
            ],
          }}
        >
          <BarChart
            data={decadeRows.map((d) => ({ key: d.full_name, label: d.full_name, value: d.wins }))}
            label={`Drivers with the most wins in the ${decade}s`}
          />
        </Figure>
      </Section>

      <Section title="How often pole becomes a win">
        <Figure
          title="Pole positions converted to victory, by season"
          note="The share of races each season won from the front row's first slot. It says as much about how hard a car was to pass as about who was quickest on Saturday."
          table={{
            rows: poleToWin.map((r) => ({
              ...r,
              share: percent(r.pole_converted, r.races),
            })),
            columns: [
              { key: 'year', label: 'Season', align: 'num' },
              { key: 'races', label: 'Races', align: 'num' },
              { key: 'pole_converted', label: 'Won from pole', align: 'num' },
              { key: 'share', label: 'Share', align: 'num' },
            ],
          }}
        >
          <LineChart
            series={[
              {
                name: 'Won from pole',
                points: poleToWin
                  .filter((r) => r.races > 0)
                  .map((r) => ({ x: r.year, y: Math.round((r.pole_converted / r.races) * 1000) / 10 })),
              },
            ]}
            format={(v) => `${v}%`}
            formatX={(v) => String(Math.round(v))}
            height={230}
            label="Percentage of races each season won from pole position, 1950 to 2026"
          />
        </Figure>
      </Section>

      <Section title="Grand slams" count={`${grandSlams.length}`}>
        <Note>
          <strong>Pole, win and fastest lap in the same Grand Prix.</strong> The stricter definition
          also asks for every lap led, which is not checked here — there is no lap-by-lap data for
          most of these races — so this is the three-part version.
        </Note>
        <DataTable
          rows={grandSlams}
          rowKey={(row) => `${row.year}-${row.round}`}
          sort="year"
          direction="desc"
          page={60}
          columns={GRAND_SLAM_COLUMNS.map((column) => ({ ...column, ...GRAND_SLAM_APP[column.key] }))}
        />
      </Section>

      <Onward
        items={[
          driverWins[0]
            ? {
                to: `/drivers/${driverWins[0].driver_id}`,
                label: driverWins[0].full_name,
                hint: `${driverWins[0].wins} wins — the most of anyone.`,
              }
            : null,
          { to: '/seasons', label: 'Seasons', hint: 'How each of those championships was actually won.' },
          {
            to: '/data/sql',
            label: 'Ask your own question',
            hint: 'The SQL console, for the leaderboard that is not on this page.',
          },
        ]}
      />
    </>
  )
}
