import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Confidence, Note, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips } from '../components/Filters.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import Figure from '../charts/Figure.jsx'
import BarChart from '../charts/BarChart.jsx'
import LineChart from '../charts/LineChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { percent } from '../lib/format.js'
import { oneOf, useUrlState } from '../lib/urlstate.js'
import { colourForEntry, colourSource } from '../lib/liveries.js'
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
  holderPath,
  tierBefore,
  tiersOf, RECORDS_LEDE } from '../queries/records.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
/**
 * What only the app adds to the shared column lists: the links. The queries
 * and the columns are in queries/records.js, read by scripts/prerender.js
 * too, so the static records table is this one.
 */
const GRAND_SLAM_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  gp_name: { render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link> },
}

/**
 * The colour a career-long constructor row wears (AF-53).
 *
 * WHICH SEASON. The last one, as the constructor page's band takes the last
 * season a team raced — here the row's own `last_win`, which is the only year
 * this row is about and the one already printed in it. A second date in the
 * view, for a colour and nothing else, would be a column no reader of
 * `SELECT * FROM v_wins_by_constructor` could account for.
 *
 * WHICH COLOUR. colourForEntry(), which is what a MARK takes: the livery from
 * 2010, the national convention before 1968, and nothing between. The
 * constructor page's band falls back to the convention for the 1968–2009 gap
 * as well, but it does that with a sentence beside it saying which convention
 * it is showing; a mark in a table and a bar on a chart have no room for that
 * clause, so they keep the gap the rest of the site keeps.
 */
const constructorColour = (row) =>
  colourForEntry({ constructorId: row.id, country: row.country, year: row.last_win, team: row.name })

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
      trail={TRAIL.records()}
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

  const categories = useMemo(
    () => [...new Set(records.map((r) => r.category))].sort(),
    [records],
  )
  const chips = [['', 'All'], ...categories.map((c) => [c, c])]
  const decadeOptions = [...new Set(decades.map((d) => d.decade))].sort((a, b) => b - a)
  const latestDecade = String(Math.max(...decades.map((d) => d.decade)))

  // Both choices on this page, in the address (IA-08). The decade opens on
  // the most recent one, so that is its default and the address stays clean
  // until a reader picks another; `?decade=1730` is not one of the ten this
  // page holds, and falls back to the same.
  const [params, set] = useUrlState({ category: '', decade: latestDecade })
  const category = oneOf(params.category, chips)
  const decade = oneOf(
    params.decade,
    decadeOptions.map((d) => String(d)),
    latestDecade,
  )
  const shownRecords = category ? records.filter((r) => r.category === category) : records
  const tiers = useMemo(() => tiersOf(records), [records])

  // The fifteen bars of the constructor chart, in their teams' colours where
  // they have one (AF-55). This chart used to be all-or-nothing, and enough
  // of the fifteen last won inside the declared 1968-2009 gap that it drew
  // neutral throughout - Ferrari, McLaren, Mercedes and Red Bull losing their
  // colours because Team Lotus, Brabham and Tyrrell cannot have one. A
  // bar without a colour is now drawn hollow: outlined, unfilled, visibly a
  // non-colour rather than a neutral that could be read as a livery, which is
  // the same mark DotPlot gives a colourless season and the same rule.
  //
  // As on the driver page, a chart no bar of which has a colour keeps the
  // plain neutral series: nothing is there for a neutral to be misread
  // against. No figure is written down for how many of the fifteen fall
  // either side, because the split turns as the top fifteen does and nothing
  // would check a number stated here.
  const constructorBars = useMemo(() => {
    // Keyed on the id, not the name: the view groups on constructors.id, so
    // every row has one and no row needs a fallback.
    const bars = constructorWins.slice(0, 15).map((c) => ({
      key: c.id,
      label: c.name,
      value: c.wins,
      colour: constructorColour(c),
    }))
    if (bars.some((bar) => bar.colour)) return bars.map((bar) => ({ ...bar, hollow: !bar.colour }))
    return bars.map((bar) => ({ key: bar.key, label: bar.label, value: bar.value }))
  }, [constructorWins])

  const decadeRows = decades.filter((d) => String(d.decade) === decade).slice(0, 12)

  return (
    <>
      <Section title="Records" count={`${records.length}`}>
        {/* This sentence stays ABOVE the figures. Its predecessor caveated
            authored rows that could disagree with the leaderboards below, and
            sat 1,900 px under them; the rows are now derived from the same
            tables, so the sentence says that instead. */}
        <p className="note" style={{ marginTop: -4 }}>
          {RECORDS_LEDE}
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
            onChange={(value) => set({ category: value })}
            options={chips}
          />
        </div>
        <DataTable
          rows={shownRecords}
          rowKey={(row) => row.id}
          sortable={false}
          page={60}
          columns={recordColumns(records).map((column) =>
            column.key === 'confidence'
              ? { ...column, render: (value) => <Confidence value={value} /> }
              : column.key === 'holder'
                ? {
                    ...column,
                    render: (value, row) => {
                      const path = holderPath(row)
                      return path ? <Link to={`/${path}`}>{value}</Link> : cell(value)
                    },
                  }
                : column,
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
                { key: 'full_name', label: 'Driver', render: (name, row) => <Link to={`/drivers/${row.driver_id}`}>{name}</Link> },
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
                { key: 'full_name', label: 'Driver', render: (name, row) => <Link to={`/drivers/${row.driver_id}`}>{name}</Link> },
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
          note={`A constructor's win belongs to the car, so a shared drive counts once here and twice in the driver tables.${
            constructorBars.some((bar) => bar.colour)
              ? ` Each bar is coloured for that constructor as of its last win, the year the table gives: ${colourSource(constructorBars.map((bar) => bar.colour))}.${
                  constructorBars.some((bar) => bar.hollow)
                    ? ' A hollow bar is a team this record holds no colour for: between 1968 and 2009 the national convention no longer described the grid and the liveries are not recorded here.'
                    : ''
                }`
              : ''
          }`}
          table={{
            rows: constructorWins,
            columns: [
              // The team's colour mark and a link to its page, as /races
              // draws the same constructor (AF-47). The view carries c.id so
              // both can be keyed to the constructor rather than its name.
              {
                key: 'name',
                label: 'Constructor',
                render: (name, row) => (
                  <>
                    <LiveryMark colour={constructorColour(row)} year={row.last_win} />
                    <Link to={`/constructors/${row.id}`}>{name}</Link>
                  </>
                ),
              },
              { key: 'country', label: 'Country' },
              { key: 'wins', label: 'Wins', align: 'num' },
              { key: 'first_win', label: 'First', align: 'num' },
              { key: 'last_win', label: 'Last', align: 'num' },
              { key: 'constructors_titles', label: "Constructors' titles", align: 'num' },
            ],
          }}
        >
          <BarChart
            data={constructorBars}
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
            onChange={(value) => set({ decade: value })}
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

      <Onward {...ONWARD.records({ driverWins })} />
    </>
  )
}
