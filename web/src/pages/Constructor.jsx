import { Link, useParams } from 'react-router-dom'
import Disagreement, { CONSTRUCTOR_DISAGREEMENTS } from '../components/Disagreement.jsx'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Figure from '../charts/Figure.jsx'
import Photographs from '../components/Photographs.jsx'
import ColumnChart from '../charts/ColumnChart.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { missing, number, span, yearList } from '../lib/format.js'
import LiveryScheme from '../components/LiveryScheme.jsx'
import { LIVERY_ERA, colourForEntry, liveryFor, nationalEntry, sourceHost } from '../lib/liveries.js'

import { CONSTRUCTOR_IMAGES } from '../queries/photographs.js'
import {
  BY_SEASON,
  CONSTRUCTOR,
  DERIVED,
  DESIGNS,
  DESIGN_COLUMNS,
  ENGINE_SPLIT_FOOTER,
  LINEAGE,
  SEASON_COLUMNS,
  STANDINGS,
  WINS,
  WINS_FOOTER,
  WIN_COLUMNS,
  constructorSeasons,
} from '../queries/constructor.js'

import { ONWARD, TRAIL, lastSeasonOf } from '../lib/wayfinding.js'
import { NAMES } from '../lib/site.js'
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
}
const WIN_APP = {
  year: seasonLink,
  name_used: { render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link> },
  circuit: {
    render: (name, row) => (row.circuit_id ? <Link to={`/circuits/${row.circuit_id}`}>{name}</Link> : cell(name)),
  },
  driver: {
    render: (name, row) => (row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name}</Link> : cell(name)),
  },
  chassis: {
    render: (name, row) =>
      row.chassis_id ? <Link to={`/cars/${row.chassis_id}`}>{name ?? row.chassis_id}</Link> : cell(name),
  },
}
const DESIGN_APP = {
  name: { render: (name, row) => <Link to={`/cars/${row.id}`}>{name}</Link> },
  first_year: { sort: (row) => row.first_year },
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
    wins: [WINS, [id]],
    designs: [DESIGNS, [id]],
    lineage: [LINEAGE, [id]],
    images: [CONSTRUCTOR_IMAGES, [id]],
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
                Press <kbd>/</kbd> to search by name, or{' '}
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
  const wins = rows(data, 'wins')
  const designs = rows(data, 'designs')
  const lineage = rows(data, 'lineage')
  const images = rows(data, 'images')

  const winsBySeason = bySeason.filter((s) => s.wins > 0)
  // The chart used to draw only these, on a band scale, so the pixels between
  // 1990 and 1994 were as wide as those between 1996 and 1997 and a reader saw
  // an unbroken run of wins. Every season entered goes on the axis now.
  const seasonsAsc = [...bySeason].sort((a, b) => a.year - b.year)
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

  return (
    <Page
      eyebrow="Constructor"
      title={NAMES.constructor(constructor.name).headline}
      trail={TRAIL.constructor(constructor.id, constructor.name)}
      lede={constructor.notes}
      aside={
        <LiveryScheme
          colour={identity}
          note={
            livery ? (
              <>
                The colour {constructor.name} raced in {lastSeason.year}, {identity.claim}. Read from{' '}
                {[...new Set(livery.source.map(sourceHost))].join(' and ')}; the shades here are this
                site's rendering of them, not a measurement.
              </>
            ) : (
              <>
                {constructor.country}'s international racing colour, under the convention that
                painted a car for the country that entered it until sponsor liveries took over around
                1968. Not this team's own livery.
              </>
            )
          }
        />
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
            // VD-28: wins and the constructors' titles lead, the same two
            // ranks the driver page takes and for the same reason - and, for
            // the same reason, a zero does not lead: of the constructors in
            // the register most never won, and leading their 0 would point
            // the emphasis at what is not there. A strip with no lead keeps
            // the one rank it always had.
            { label: 'Wins', value: number(derived.wins ?? 0), lead: Number(derived.wins) > 0 },
            { label: 'Podiums', value: number(derived.podiums ?? 0) },
            { label: 'Poles', value: number(derived.poles ?? 0) },
            { label: 'Drivers', value: number(derived.drivers) },
            constructor.constructors_titles
              ? {
                  label: "Constructors' titles",
                  value: number(constructor.constructors_titles),
                  note: missing(constructor.title_years) ? undefined : yearList(constructor.title_years),
                  lead: true,
                }
              : null,
            constructor.drivers_titles
              ? { label: "Drivers' titles", value: number(constructor.drivers_titles) }
              : null,
          ].filter(Boolean)}
        />
      </Section>

      {/* The cars, oldest first - the order "Cars built" prints them in
          further down. Six of them: this is a team's page, not a gallery, and
          the table below it lists every design with a link to its own page. */}
      <Photographs images={images} subjects />

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
            note="Every season entered, winless ones included, so a drought is visible as a gap. A shared drive counts once, to the car."
            table={{
              rows: seasonsAsc,
              columns: [
                { key: 'year', label: 'Season', align: 'num' },
                { key: 'wins', label: 'Wins', align: 'num' },
                { key: 'entries', label: 'Entries', align: 'num' },
              ],
            }}
          >
            {/* VD-34: the team's own colour, falling back to the national
                convention and then to the series palette. The pair, not the
                base - a single-hue chart is read by colour against the panel,
                which is the one surface AF-16 left the moved pair on. */}
            <ColumnChart
              data={seasonsAsc.map((s) => ({ key: s.year, value: s.wins, label: String(s.year) }))}
              labelEvery={Math.max(1, Math.ceil(seasonsAsc.length / 12))}
              integer
              height={200}
              colour={identity}
              label={`Race wins per season for ${constructor.name}`}
            />
          </Figure>
        </Section>
      )}

      <Disagreement rows={rows(data, 'disagreements')} what="this team" />

      <Section title="Season by season" count={`${bySeason.length} seasons`}>
        <DataTable
          rows={constructorSeasons(bySeason, standings)}
          rowKey={(row) => row.year}
          sort="year"
          direction="desc"
          columns={withRenders(SEASON_COLUMNS, SEASON_APP)}
          footer={engineSplit ? ENGINE_SPLIT_FOOTER : undefined}
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
            columns={withRenders(WIN_COLUMNS, WIN_APP)}
            footer={WINS_FOOTER}
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
            columns={withRenders(DESIGN_COLUMNS, DESIGN_APP)}
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

      <Onward {...ONWARD.constructor({ constructor, designs, bySeason })} />
    </Page>
  )
}
