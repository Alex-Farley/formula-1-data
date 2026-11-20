import { Fragment } from 'react'
import { Link, useParams } from 'react-router-dom'
import Disagreement, { CONSTRUCTOR_DISAGREEMENTS } from '../components/Disagreement.jsx'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Figure from '../charts/Figure.jsx'
import Photographs from '../components/Photographs.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import { ByRoundSpark } from '../charts/Spark.jsx'
import { byRoundText } from '../charts/spark.js'
import { rows, useQueries } from '../data/useQuery.js'
import { FIGHT_QUERIES, currentTitle, fightCitation, fightLine, mergeSources } from '../queries/season.js'
import { span } from '../lib/format.js'
import { FOLD_NOUN } from '../lib/table.js'
import LiveryScheme from '../components/LiveryScheme.jsx'
import { LIVERY_ERA, colourForEntry, constructorBandNote, liveryFor, nationalEntry } from '../lib/liveries.js'

import { CONSTRUCTOR_IMAGES } from '../queries/photographs.js'
import {
  BY_SEASON,
  CHAMPIONS,
  CONSTRUCTOR,
  CONSTRUCTOR_SOURCES,
  DERIVED,
  DESIGNS,
  DESIGN_COLUMNS,
  LINEAGE,
  SEASON_COLUMNS,
  STANDINGS,
  WINS,
  WIN_COLUMNS,
  WINS_FIGURE_COLUMNS,
  WINS_HEADING,
  constructorSeasons,
  lineageChains,
  recordFigures,
  seasonsFooter,
  teamStrip,
  winsByRace,
  winsFigure,
  winsFooter,
} from '../queries/constructor.js'

import { ONWARD, TRAIL, lastSeasonOf } from '../lib/wayfinding.js'
import { EYEBROWS, LABELS, NAMES } from '../lib/site.js'
import SearchKey from '../components/SearchKey.jsx'
import { TILE_JOIN } from '../lib/tiles.js'
/*
 * The React renders for the columns queries/constructor.js defines — the
 * links and the sort keys; the router is the reason they live here. The words
 * each cell carries are the column's own `text`, which scripts/prerender.js
 * prints too, so the static tables are these.
 */
const seasonLink = { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> }
const SEASON_APP = {
  year: seasonLink,
  championship_text: { sort: (row) => row.championship },
  by_round: { render: (value, row) => <ByRoundSpark value={value} rounds={row.rounds} label={byRoundText(value)} /> },
}
// A shared drive's drivers, or its designs, each linked and joined as the
// column's words join them (queries/constructor.js winsByRace).
const joined = (list, linked) =>
  list.map((item, i) => (
    <Fragment key={item.id ?? i}>
      {i > 0 && TILE_JOIN}
      {linked(item)}
    </Fragment>
  ))
const WIN_APP = {
  year: seasonLink,
  name_used: { render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link> },
  circuit: {
    render: (name, row) => (row.circuit_id ? <Link to={`/circuits/${row.circuit_id}`}>{name}</Link> : cell(name)),
  },
  driver: {
    render: (name, row) =>
      row.drivers.length > 1
        ? joined(row.drivers, (d) => (d.id ? <Link to={`/drivers/${d.id}`}>{d.name}</Link> : cell(d.name)))
        : row.driver_id
          ? <Link to={`/drivers/${row.driver_id}`}>{name}</Link>
          : cell(name),
  },
  chassis: {
    render: (name, row) =>
      row.designs.length > 1
        ? joined(row.designs, (d) => (d.id ? <Link to={`/cars/${d.id}`}>{d.name ?? d.id}</Link> : cell(d.name)))
        : row.chassis_id
          ? <Link to={`/cars/${row.chassis_id}`}>{name ?? row.chassis_id}</Link>
          : cell(name),
  },
}
const DESIGN_APP = {
  name: { render: (name, row) => <Link to={`/cars/${row.id}`}>{name}</Link> },
  first_year: { sort: (row) => row.first_year },
}
/**
 * The wins chart's kicker (VD-125): what is plotted, and the square that
 * marks a title, drawn as the plot draws it and named for a screen reader,
 * which hears the words and not the shape. scripts/prerender.js writes the
 * same.
 */
function WinsKicker({ chart }) {
  return (
    <>
      {chart.kicker}
      {chart.titleKey && (
        <>
          {' · '}
          <i className="title-square" aria-hidden="true" />
          <span className="sr-only">a square under a season is </span>
          {chart.titleKey}
        </>
      )}
    </>
  )
}

const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

export default function Constructor() {
  const { id } = useParams()
  const state = useQueries({
    constructor: [CONSTRUCTOR, [id]],
    derived: [DERIVED, [id]],
    bySeason: [BY_SEASON, [id]],
    standings: [STANDINGS, [id]],
    disagreements: [CONSTRUCTOR_DISAGREEMENTS, [id]],
    // AF-132: where a contender stands in the title fight being run.
    ...FIGHT_QUERIES,
    wins: [WINS, [id]],
    champions: [CHAMPIONS, [id]],
    designs: [DESIGNS, [id]],
    lineage: [LINEAGE, [id]],
    images: [CONSTRUCTOR_IMAGES, [id]],
    sources: [CONSTRUCTOR_SOURCES, [id]],
  })

  return (
    <Result state={state} context="That constructor could not be read">
      {(data) => {
        const constructor = data.constructor.rows[0]
        if (!constructor) {
          return (
            <Page title="No such constructor" cite={false} trail={TRAIL.missing('/constructors', 'Constructors')}>
              <p className="muted">Nothing in the register has the id “{id}”.</p>
              <p>
                Press <SearchKey /> to search by name, or{' '}
                <Link to="/constructors">browse the register</Link>. A few names used by other
                sources are deliberately not held here — the{' '}
                <Link to="/data/quality">data quality page</Link> says which and why.
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
  const standings = rows(data, 'standings')
  // A row a race, a shared drive once (VD-117), as the tile counts them.
  const wins = winsByRace(rows(data, 'wins'))
  const designs = rows(data, 'designs')
  const lineage = lineageChains(rows(data, 'lineage'), constructor)
  const images = rows(data, 'images')

  // The season they were last part of, which is the one the header's livery
  // is read from; the onward band picks it the same way (lib/wayfinding.js).
  const lastSeason = lastSeasonOf(bySeason)
  const engineSplit = standings.some((s) => s.engine_id)
  // The team's own colour where the record has it: the livery of the last
  // season it raced, 2010 onwards (lib/liveries.js). The national convention
  // stays the aside for everyone else - including a 2010+ season this map
  // has no source for, where the sentence says which convention it shows.
  //
  // Both arrive in one shape (AF-17), so the band, its names and the chart
  // below read the same object and a team without a livery is not a special
  // case three times over.
  const livery = lastSeason && lastSeason.year >= LIVERY_ERA ? liveryFor(constructor.id, lastSeason.year) : null
  const identity = livery
    ? colourForEntry({
        constructorId: constructor.id,
        country: constructor.country,
        year: lastSeason.year,
        team: constructor.name,
      })
    : nationalEntry(constructor.country)

  // The wins chart, worked out in queries/constructor.js so the static page
  // draws the same columns (VD-73), finding, squares and notes (VD-125).
  const winsChart = winsFigure(constructor, bySeason, {
    standings,
    champions: rows(data, 'champions'),
    colour: identity,
  })

  // Where this team stands in the constructors' title fight of the season
  // being run (AF-132): queries/season.js's line, printed by both halves.
  const title = currentTitle((key) => rows(data, key))
  const fight = fightLine(title, 'constructors', constructor.id)

  return (
    <Page
      eyebrow={EYEBROWS.constructor(constructor.country, constructor.base)}
      title={NAMES.constructor(constructor.name).headline}
      trail={TRAIL.constructor(constructor.id, constructor.name)}
      lede={constructor.notes}
      sources={
        fight
          ? mergeSources(rows(data, 'sources'), fightCitation((key) => rows(data, key), title, 'constructors', constructor.id))
          : rows(data, 'sources')
      }
      aside={
        <LiveryScheme colour={identity} note={constructorBandNote(constructor, lastSeason, livery, identity)} />
      }
    >
      <Section>
        {/* queries/constructor.js's strip, which the static page draws too (VD-49). */}
        <Stats items={teamStrip(constructor, derived)} />
        {fight && <p className="note follows">{fight}</p>}
      </Section>

      {/* What leads (PD-58): the tiles, then the shape of the team's
          success, then the season table - after the lineage and any
          disagreement, which say how to read it. The exhaustive lists and
          then the photographs follow; scripts/prerender.js keeps the order. */}
      {/* In the opening slot beside the header (VD-84), unless the team has
          entered more seasons than the slot can draw at a usable width
          (SLOT_MARKS); then it leads under the tiles at the full width. */}
      {winsChart && (
        <Section lead={winsChart.lead} title={WINS_HEADING}>
          <Figure
            lead
            note={winsChart.note}
            finding={winsChart.finding}
            kicker={<WinsKicker chart={winsChart} />}
            annotations={winsChart.annotations}
            keyBeside={winsChart.keyBeside}
            table={{ rows: winsChart.rows, columns: WINS_FIGURE_COLUMNS }}
          >
            {/* VD-34: the team's own colour, falling back to the national
                convention and then to the series palette. The pair, not the
                base - a single-hue chart is read by colour against the panel,
                which is the one surface AF-16 left the moved pair on. */}
            <ColumnChart
              data={winsChart.data}
              labelEvery={winsChart.labelEvery}
              roundLabels={winsChart.roundLabels}
              stubs={winsChart.stubs}
              labelPeak={winsChart.labelPeak}
              integer={winsChart.integer}
              height={winsChart.height}
              colour={identity}
              label={winsChart.label}
              marks={winsChart.marks}
              bands={winsChart.bands}
            />
          </Figure>
        </Section>
      )}

      {lineage.map((steps) => (
        <Section
          key={steps[0].chain_id}
          title={steps[0].chain_name}
          note={
            steps.length > 1
              ? 'One factory, several names. Each name keeps its own record here; the chain is what connects them.'
              : undefined
          }
        >
          <div className="timeline">
            {steps.map((step) => (
              <article key={step.id}>
                <h3>
                  {step.entity_name}
                  <span className="years">{span(step.from_year, step.to_year)}</span>
                  {step.constructor_id === constructor.id && <span className="pill">this page</span>}
                </h3>
                {step.note && <p>{step.note}</p>}
              </article>
            ))}
          </div>
        </Section>
      ))}

      <Disagreement rows={rows(data, 'disagreements')} what="this team" />

      <Section title="Season by season" count={`${bySeason.length} seasons`}>
        <DataTable
          rows={constructorSeasons(bySeason, standings)}
          fold={FOLD_NOUN.seasons}
          rowKey={(row) => row.year}
          sort="year"
          direction="desc"
          columns={withRenders(SEASON_COLUMNS, SEASON_APP)}
          footer={seasonsFooter(engineSplit)}
        />
      </Section>

      {wins.length > 0 && (
        <Section title="Every win" count={`${wins.length}`}>
          <DataTable
            rows={wins}
            fold={FOLD_NOUN.wins}
            rowKey={(row) => `${row.year}-${row.round}`}
            sort="year"
            direction="desc"
            page={100}
            columns={withRenders(WIN_COLUMNS, WIN_APP)}
            footer={winsFooter(wins)}
          />
        </Section>
      )}

      {designs.length > 0 && (
        <Section title="Cars built" count={`${designs.length} designs`}>
          <DataTable
            rows={designs}
            fold={FOLD_NOUN.designs}
            rowKey={(row) => row.id}
            sort="first_year"
            direction="asc"
            page={80}
            columns={withRenders(DESIGN_COLUMNS, DESIGN_APP)}
          />
        </Section>
      )}

      {/* The cars, oldest first - the order "Cars built" prints them in
          above. Six of them: this is a team's page, not a gallery, and that
          table lists every design with a link to its own page. After the
          page's own sections and before where they come from, as on every
          page type (VD-83): the strip used to stand between the tiles and
          *Wins by season* (PD-58), and then between the season table and
          the wins. */}
      <Photographs images={images} subjects />

      <Section title={LABELS.provenance}>
        {constructor.confidence === 'medium' && (
          <Note>
            <strong>Trust the counted figures.</strong> Where this panel gives a figure twice, the
            derived one is counted from the race records above and carries more weight than the
            published one beside it, which is why both are shown.
          </Note>
        )}
        <Fields
          items={[
            { label: 'Full name', value: constructor.full_name },
            { label: 'Country', value: constructor.country },
            { label: 'Base', value: constructor.base },
            ...recordFigures(constructor, derived).map(([label, value]) => ({ label, value })),
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

      <Onward {...ONWARD.constructor({ constructor, designs, bySeason })} />
    </Page>
  )
}
