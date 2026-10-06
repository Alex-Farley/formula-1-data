import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import Photographs from '../components/Photographs.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { missing, number, span } from '../lib/format.js'
import { colourForEntry } from '../lib/liveries.js'
import { CURRENT_SEASON } from '../lib/season.js'
import { canShow } from '../lib/commons.js'
import Disagreement from '../components/Disagreement.jsx'
import {
  AMBIGUOUS_COLUMNS,
  AMBIGUOUS_FOOTER,
  CAR,
  CAR_DISAGREEMENTS,
  FIGURES_HEADING,
  ENTRIES,
  IMAGES,
  NO_ENTRIES,
  NO_SPECIFICATION,
  SEASONS,
  VARIANTS,
  VARIANTS_FOOTER,
  VARIANT_COLUMNS,
  carAddress,
  carFacts,
  carPageName,
  carRecord,
  carStrip,
  entryColumns,
  entryResult,
  leadsWithPhotograph as photographLeads,
  publishedWins,
  specificationFields,
  specified,
  winsNote,
} from '../queries/car.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import { EYEBROWS, NAMES } from '../lib/site.js'
import SearchKey from '../components/SearchKey.jsx'
/*
 * The React renders for the columns queries/car.js defines — the links and
 * the result's styling; the router is the reason they live here. The words
 * each cell carries are the column's own `text`, which scripts/prerender.js
 * prints too, so the static tables are these.
 */
const VARIANT_APP = {
  name: { render: (name, row) => <Link to={`/cars/${row.id}`}>{name}</Link> },
  first_year: { sort: (row) => row.first_year },
}
const AMBIGUOUS_APP = { year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> } }
const ENTRY_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  name_used: { render: (name, row) => <Link to={`/races/${row.year}/${row.round}`}>{name}</Link> },
  driver: {
    render: (name, row) => (row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name}</Link> : cell(name)),
  },
  chassis: {
    render: (name, row) => (row.chassis_id ? <Link to={`/cars/${row.chassis_id}`}>{name}</Link> : cell(name)),
  },
  grid_text: { sort: (row) => row.grid },
  position_text: {
    sort: (row) => row.finish_position,
    render: (value, row) =>
      missing(row.finish_position) ? (
        <span className="tag tag-dnf">{entryResult(value, row)}</span>
      ) : (
        <b>{entryResult(value, row)}</b>
      ),
  },
}
const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

export default function Car() {
  const { id } = useParams()
  const state = useQueries({
    variants: [VARIANTS, [id]],
    car: [CAR, [id, id]],
    images: [IMAGES, [id, id]],
    entries: [ENTRIES, [id]],
    seasons: [SEASONS, [id, id]],
    disagreements: [CAR_DISAGREEMENTS, [id]],
    current: [CURRENT_SEASON],
  })

  return (
    <Result state={state} context="That car could not be read">
      {(data) => {
        const variants = data.variants.rows
        const chassis = variants[0]
        if (!chassis) {
          return (
            <Page title="No such car" cite={false} trail={TRAIL.missing('/cars', 'Cars')}>
              <p className="muted">Nothing in the chassis register has the id “{id}”.</p>
              <p>
                Press <SearchKey /> to search by chassis name, or{' '}
                <Link to="/cars">browse the register</Link>.
              </p>
            </Page>
          )
        }
        return <CarBody id={id} chassis={chassis} variants={variants} data={data} />
      }}
    </Result>
  )
}

function CarBody({ id, chassis, variants, data }) {
  const car = data.car.rows[0]
  // The name both renderers print, from queries/car.js.
  const name = carPageName(variants, car)
  // Fail closed before the count, not just before each figure: the section
  // is headed "Photographs 1" over an empty grid otherwise, the day a file
  // arrives with nobody to credit. components/Photographs.jsx does it, for
  // every surface that shows one.
  const images = rows(data, 'images')
  const entries = rows(data, 'entries')
  const seasons = rows(data, 'seasons')

  // The span, as the strip counts it (queries/car.js).
  const { raced } = carRecord(variants, entries)
  const ambiguous = seasons.filter((s) => !s.corroborated)

  const several = variants.length > 1
  // The car's published wins, read once (queries/car.js says why), and the
  // note that sets them beside the derived count where the two differ -
  // which the static page prints too (VD-49).
  const published = publishedWins(variants)
  const winsDiffer = winsNote(variants, entries)

  // THE SPECIFICATION, WHERE THERE IS ONE (CD-37). The two lists are built
  // here rather than inline so the section can ask whether any of the
  // eighteen fields holds anything before drawing eighteen em dashes at a
  // reader - which is what 339 of the 1,153 chassis pages did, each dash a
  // claim that nobody had established that figure, where one sentence says
  // the whole of it. Which of the two rows each field comes from is
  // carFacts() in queries/car.js, which the static half reads too (IA-28).
  const facts = carFacts(chassis, car)
  const { chassis: specChassis, engine: specEngine } = specificationFields(facts)
  const hasSpecification = specified([...specChassis, ...specEngine])
  // This year's chassis opens on its photograph (PD-49); queries/car.js says why.
  const leadsWithPhotograph = photographLeads(variants, data.current.rows[0]?.season)

  return (
    <Page
      eyebrow={EYEBROWS.car(chassis.constructor)}
      title={NAMES.car(name).headline}
      trail={TRAIL.car(chassis.id, name)}
      canonical={carAddress(id, car)}
      lede={car?.story}
    >
      {leadsWithPhotograph && <Photographs images={images} />}

      {/* A heading only when the photograph is above it and something is
          drawn there; otherwise the strip sits under the h1 as before. */}
      <Section title={leadsWithPhotograph && images.some(canShow) ? FIGURES_HEADING : undefined}>
        {/* queries/car.js's strip, which the static page draws too (VD-49). */}
        <Stats items={carStrip(variants, car, entries)} />
      </Section>

      {/* The section itself is components/Photographs.jsx, which the
          constructor, season and race pages draw too (VD-33). No `subjects`:
          this page is the car, and captioning six photographs with its own
          title says nothing the heading has not. */}
      {!leadsWithPhotograph && <Photographs images={images} />}

      {car && (
        <Section title="Why it mattered">
          <div className="split">
            <div>
              {car.concept && (
                <p>
                  <strong>The idea.</strong> {car.concept}
                </p>
              )}
              {car.innovations && (
                <p>
                  <strong>New on this car.</strong> {car.innovations}
                </p>
              )}
              {car.outcome && (
                <p>
                  <strong>What it did.</strong> {car.outcome}
                </p>
              )}
            </div>
            <Fields
              items={[
                { label: 'Designers', value: facts.designers },
                { label: 'Supersedes', value: car.supersedes_id ? <Link to={`/cars/${car.supersedes_id}`}>{car.supersedes_id}</Link> : null },
                { label: 'Design life', value: span(car.from_year, car.to_year) },
                { label: 'Confidence', value: <Confidence value={car.confidence} /> },
              ]}
            />
          </div>
        </Section>
      )}

      {several && (
        <Section
          title="Variants"
          count={`${variants.length}`}
          note="Every race entry names a variant rather than the car as a whole, so the figures above are these rows added together. Each variant has a page of its own."
        >
          <DataTable
            rows={variants}
            rowKey={(row) => row.id}
            sortable
            sort="first_year"
            direction="asc"
            columns={withRenders(VARIANT_COLUMNS, VARIANT_APP)}
            footer={VARIANTS_FOOTER}
          />
        </Section>
      )}

      <Section title={several ? `Specification — ${chassis.name}` : 'Specification'}>
        {hasSpecification ? (
          <>
            <div className="split">
              <Fields items={specChassis} />
              <Fields items={specEngine} />
            </div>
            <p className="source-note">
              A blank is a figure nobody published for this car. Where several teams quote the same
              number in a season it is usually the rule they were all built to rather than a
              measurement, so it is kept with the{' '}
              <Link to="/reference/eras">regulation limits</Link> instead of here.
            </p>
          </>
        ) : (
          <p className="source-note">{NO_SPECIFICATION}</p>
        )}
      </Section>

      {/* Where the car's two rows give a figure differently, both readings,
          beside the figure shown from one of them (IA-28). */}
      <Disagreement rows={rows(data, 'disagreements')} what="this car" />

      {winsDiffer && (
        <Note>
          <strong>{winsDiffer.head}</strong> {winsDiffer.body}
        </Note>
      )}

      {ambiguous.length > 0 && (
        <Section title="Seasons that cannot be attributed" count={`${ambiguous.length}`}>
          <DataTable
            rows={ambiguous}
            rowKey={(row) => row.year}
            sortable={false}
            columns={withRenders(AMBIGUOUS_COLUMNS, AMBIGUOUS_APP)}
            footer={AMBIGUOUS_FOOTER}
          />
        </Section>
      )}

      <Section title="Every entry" count={`${entries.length} races`}>
        <DataTable
          rows={entries}
          rowKey={(row) => `${row.year}-${row.round}-${row.driver_id}`}
          sortable
          sort="year"
          direction="desc"
          page={100}
          empty={NO_ENTRIES}
          columns={withRenders(entryColumns(several), ENTRY_APP)}
        />
      </Section>

      <Section title="On the record">
        <Fields
          items={[
            // The builder's colour mark (AF-51), for the last season this
            // PAGE covers - `raced[1]`, the same figure the "Raced" stat
            // prints. `chassis` is variants[0], so reading its `last_year`
            // would take the first variant's last season and contradict the
            // span shown above it. No `year` is passed:
            // LiveryMark's spacer exists to keep a table column's names
            // aligned, and a field list has no column to align, so a season
            // with no colour draws nothing rather than an indent.
            {
              label: 'Constructor',
              value: chassis.constructor_id ? (
                <>
                  <LiveryMark
                    colour={colourForEntry({
                      constructorId: chassis.constructor_id,
                      country: chassis.constructor_country,
                      year: raced[1],
                      team: chassis.constructor,
                    })}
                  />
                  <Link to={`/constructors/${chassis.constructor_id}`}>{chassis.constructor}</Link>
                </>
              ) : null,
            },
            { label: 'Predecessor', value: chassis.predecessor },
            { label: 'Successor', value: chassis.successor },
            { label: 'Races (published)', value: number(chassis.published_races) },
            { label: 'Wins (published)', value: number(published) },
            { label: 'Poles (published)', value: number(chassis.published_poles) },
            { label: 'Confidence', value: <Confidence value={chassis.confidence} /> },
            {
              label: 'Specification source',
              value: chassis.spec_source ? (
                <a href={chassis.spec_source} target="_blank" rel="noreferrer noopener">
                  {chassis.spec_source}
                </a>
              ) : null,
            },
            {
              label: 'Register source',
              value: chassis.source ? (
                <a href={chassis.source} target="_blank" rel="noreferrer noopener">
                  {chassis.source}
                </a>
              ) : null,
            },
          ]}
        />
      </Section>

      <Onward {...ONWARD.car({ chassis, car, entries })} />
    </Page>
  )
}
