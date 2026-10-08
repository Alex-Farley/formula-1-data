import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Confidence, FigurePart, Note, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Dated } from '../components/Dates.jsx'
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
  CONSTRUCTOR_WINS_COLUMNS,
  CONSTRUCTOR_WINS_FIGURE,
  CONSTRUCTORS_HEADING,
  DECADES,
  DERIVATION,
  DRIVER_POLES,
  DRIVER_POLES_COLUMNS,
  DRIVER_POLES_FIGURE,
  DRIVER_WINS,
  DRIVER_WINS_COLUMNS,
  DRIVER_WINS_FIGURE,
  GRAND_SLAM_COLUMNS,
  GRAND_SLAMS,
  HEADLINE,
  LEADERBOARDS,
  POLE_TO_WIN,
  RECORDS,
  RECORDS_LEDE,
  TIER_AFTER,
  TITLE_COLUMNS,
  TITLES,
  asOfLine,
  asOfOf,
  cardExtras,
  constructorWinsNote,
  familiesLead,
  headlineRecords,
  holderPath,
  leadersDrawn,
  recordColumns,
  recordFamilies,
  recordPath,
  tierBefore,
  tiersOf,
  RECORDS_STANDFIRST,
} from '../queries/records.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import { NAMES } from '../lib/site.js'
/**
 * What only the app adds to the shared column lists: the links. The queries
 * and the columns are in queries/records.js, read by scripts/prerender.js
 * too, so the static records table is this one.
 */
// Each record's name is its own page's link (PD-27), and its holder the
// holder's, where the record has one holder to send a reader to.
const RECORD_APP = {
  record: { render: (value, row) => <Link to={`/${recordPath(row)}`}>{value}</Link> },
  holder: {
    render: (value, row) => {
      const path = holderPath(row)
      return path ? <Link to={`/${path}`}>{value}</Link> : cell(value)
    },
  },
  confidence: { render: (value) => <Confidence value={value} /> },
}

// The champions, linked by the id v_title_count now carries (PD-27).
const TITLE_APP = {
  full_name: { render: (name, row) => <Link to={`/drivers/${row.id}`}>{name}</Link> },
}

// The leaderboards' column lists are queries/records.js's, which the static
// half draws too; the app adds the links and the constructor's colour mark.
const driverLink = { render: (name, row) => <Link to={`/drivers/${row.driver_id}`}>{name}</Link> }
const withApp = (columns, app) => columns.map((column) => ({ ...column, ...app[column.key] }))

/**
 * The headline records as cards (VD-68): the name, the value at display size,
 * the holder, and the derivation folded away under its heading. The table
 * these replace gave the derivation a quarter of the width and wrapped it to
 * six lines, so a row stood 94-132 px tall at 1440 and the page showed two of
 * its twelve records on the first screen. Each record's own page carries the
 * derivation in full. scripts/prerender.js writes the same markup.
 */
function RecordCards({ rows, extras }) {
  return (
    <ul className="record-cards">
      {rows.map((row) => {
        const path = holderPath(row)
        return (
          <li key={row.id} className="record-card">
            <h3 className="record-card-name">
              <Link to={`/${recordPath(row)}`}>{row.record}</Link>
            </h3>
            <p className="record-card-value">{row.value}</p>
            <p className="record-card-holder">{path ? <Link to={`/${path}`}>{row.holder}</Link> : row.holder}</p>
            {extras.map((column) => (
              <p key={column.key} className="record-card-extra">
                {column.label}: {column.key === 'confidence' ? <Confidence value={row.confidence} /> : row[column.key]}
              </p>
            ))}
            {/* Named for its record as well as for what it holds: twelve cards
                saying "How it is derived" read alike in a screen reader's
                list of controls (DP-30), as the folds' would without the
                table's name. scripts/prerender.js writes the same words. */}
            <details className="record-card-how">
              <summary>
                {DERIVATION}
                <span className="sr-only">, {row.record}</span>
              </summary>
              <p>
                <Dated>{row.detail}</Dated>
              </p>
            </details>
          </li>
        )
      })}
    </ul>
  )
}

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
      title={NAMES.records().headline}
      documentName={NAMES.records().title}
      trail={TRAIL.records()}
      lede={RECORDS_STANDFIRST}
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

  const decadeOptions = [...new Set(decades.map((d) => d.decade))].sort((a, b) => b - a)
  const latestDecade = String(Math.max(...decades.map((d) => d.decade)))

  // The choice on this page, in the address (IA-08). The decade opens on
  // the most recent one, so that is its default and the address stays clean
  // until a reader picks another; `?decade=1730` is not one of the ten this
  // page holds, and falls back to the same.
  //
  // The records had a category filter too - drivers, constructors, races. The
  // families replace it (WK-08): a filter over one table of sixty was worth
  // having, and over a headline table and a section per family it would be a
  // second grouping across the first. An old `?category=` is simply ignored.
  const [params, set] = useUrlState({ decade: latestDecade })
  const decade = oneOf(
    params.decade,
    decadeOptions.map((d) => String(d)),
    latestDecade,
  )
  const tiers = useMemo(() => tiersOf(records), [records])
  const asOf = useMemo(() => asOfOf(records), [records])
  const headline = useMemo(() => headlineRecords(records), [records])
  const families = useMemo(() => recordFamilies(records), [records])
  // One column list for every family's table, from all the records, so the
  // families read alike; the cards say what those columns say (cardExtras).
  const columns = recordColumns(records).map((column) => ({ ...column, ...RECORD_APP[column.key] }))
  const extras = useMemo(() => cardExtras(records), [records])
  const below = records.length - headline.length

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
    const bars = leadersDrawn(constructorWins, CONSTRUCTOR_WINS_FIGURE.key).map((c) => ({
      key: c.id,
      label: c.name,
      value: c.wins,
      colour: constructorColour(c),
    }))
    if (bars.some((bar) => bar.colour)) return bars.map((bar) => ({ ...bar, hollow: !bar.colour }))
    return bars.map((bar) => ({ key: bar.key, label: bar.label, value: bar.value }))
  }, [constructorWins])

  const winBars = leadersDrawn(driverWins, DRIVER_WINS_FIGURE.key)
  const poleBars = leadersDrawn(driverPoles, DRIVER_POLES_FIGURE.key)

  const decadeRows = decades.filter((d) => String(d.decade) === decade).slice(0, 12)

  return (
    <>
      <Section title={HEADLINE} count={`${headline.length}`}>
        {/* This sentence stays ABOVE the figures. Its predecessor caveated
            authored rows that could disagree with the leaderboards below, and
            sat 1,900 px under them; the rows are now derived from the same
            tables, so the sentence says that instead. */}
        <p className="note">
          {RECORDS_LEDE}
          {asOf && (
            <>
              {' '}
              <Dated>{asOfLine(asOf)}</Dated>
            </>
          )}
          {tiers.length === 1 && (
            <>
              {' '}{tierBefore(records.length)}<Confidence value={tiers[0]} />{TIER_AFTER}
            </>
          )}
        </p>
        <RecordCards rows={headline} extras={extras} />
        {families.length > 0 && (
          <nav className="note" aria-label="Records by family">
            {familiesLead(below)}{' '}
            {families.map((f, i) => (
              <span key={f.anchor}>
                {i > 0 && ' · '}
                <a href={`#${f.anchor}`}>{f.family}</a> <span className="faint">{f.rows.length}</span>
              </span>
            ))}
          </nav>
        )}
      </Section>

      {/* The leaderboards straight after the headline records (VD-68), and
          the families after them. The two halves have to agree on that order:
          handOver() puts back the reader's scroll offset, and when the
          families stood elsewhere here than on the static page, a reader who
          arrived at /records#wins, or scrolled into the families before the
          database opened, was put down 7,000 px away in the decade chart
          (WK-08 review). The static half now carries these two sections too,
          each figure's table open where the chart is drawn here. */}
      <Section title={LEADERBOARDS}>
        {/* Two figures in one section: each is named by an h3 of its own,
            which names its table too (AX-28), rather than by a second title. */}
        <div className="split">
          <FigurePart title={DRIVER_WINS_FIGURE.title}>
            <Figure
              note={DRIVER_WINS_FIGURE.note}
              table={{ rows: driverWins, columns: withApp(DRIVER_WINS_COLUMNS, { full_name: driverLink }) }}
            >
              <BarChart
                data={winBars.map((d) => ({ key: d.driver_id, label: d.full_name, value: d.wins }))}
                label={DRIVER_WINS_FIGURE.label(winBars.length)}
              />
            </Figure>
          </FigurePart>

          <FigurePart title={DRIVER_POLES_FIGURE.title}>
            <Figure
              note={DRIVER_POLES_FIGURE.note}
              table={{ rows: driverPoles, columns: withApp(DRIVER_POLES_COLUMNS, { full_name: driverLink }) }}
            >
              <BarChart
                data={poleBars.map((d) => ({ key: d.driver_id, label: d.full_name, value: d.poles }))}
                label={DRIVER_POLES_FIGURE.label(poleBars.length)}
              />
            </Figure>
          </FigurePart>
        </div>
      </Section>

      <Section title={CONSTRUCTORS_HEADING}>
        {/* Named for what it measures, as the drivers' two are, rather than
            for the section: a table list that read only "Constructors"
            beside the record families said nothing of wins. */}
        <FigurePart title={CONSTRUCTOR_WINS_FIGURE.title}>
          <Figure
            note={constructorWinsNote(
              constructorBars.some((bar) => bar.colour) ? colourSource(constructorBars.map((bar) => bar.colour)) : null,
              constructorBars.some((bar) => bar.hollow),
            )}
            table={{
              rows: constructorWins,
              columns: withApp(CONSTRUCTOR_WINS_COLUMNS, {
                // The team's colour mark and a link to its page, as /races
                // draws the same constructor (AF-47). The view carries c.id so
                // both can be keyed to the constructor rather than its name.
                name: {
                  render: (name, row) => (
                    <>
                      <LiveryMark colour={constructorColour(row)} year={row.last_win} />
                      <Link to={`/constructors/${row.id}`}>{name}</Link>
                    </>
                  ),
                },
              }),
            }}
          >
            <BarChart data={constructorBars} label={CONSTRUCTOR_WINS_FIGURE.label(constructorBars.length)} />
          </Figure>
        </FigurePart>
      </Section>

      {/* Every record not in the headline cards, once, under its family. */}
      {families.map((f) => (
        <Section key={f.anchor} id={f.anchor} title={f.family} count={`${f.rows.length}`}>
          <DataTable rows={f.rows} rowKey={(row) => row.id} sortable={false} columns={columns} />
        </Section>
      ))}

      <Section title="Champions" count={`${titles.length}`}>
        <DataTable
          rows={titles}
          rowKey={(row) => row.id}
          sort="titles"
          direction="desc"
          columns={TITLE_COLUMNS.map((column) => ({ ...column, ...TITLE_APP[column.key] }))}
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
        {/* The decade the chips chose, named over its figure. */}
        <FigurePart title={`Most wins, the ${decade}s`}>
          <Figure
            note="A decade is the ten seasons whose year begins with it; the 2020s are still running."
            table={{
              rows: decadeRows,
              columns: [
                {
                  key: 'full_name',
                  label: 'Driver',
                  rowHeader: true,
                  render: (name, row) => <Link to={`/drivers/${row.driver_id}`}>{name}</Link>,
                },
                { key: 'wins', label: 'Wins', align: 'num' },
              ],
            }}
          >
            <BarChart
              data={decadeRows.map((d) => ({ key: d.driver_id, label: d.full_name, value: d.wins }))}
              label={`Drivers with the most wins in the ${decade}s`}
            />
          </Figure>
        </FigurePart>
      </Section>

      <Section title="How often pole becomes a win">
        <Figure
          note="The share of races each season won from the front row's first slot. It says as much about how hard a car was to pass as about who was quickest on Saturday."
          table={{
            rows: poleToWin.map((r) => ({
              ...r,
              share: percent(r.pole_converted, r.races),
            })),
            columns: [
              { key: 'year', label: 'Season', align: 'num', rowHeader: true, text: (year) => String(year) },
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
