import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import CommonsImage from '../components/CommonsImage.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { missing, number, span } from '../lib/format.js'

/**
 * Every chassis this page covers.
 *
 * An id usually names one chassis. Six of them name a CAR that no single
 * chassis shares an id with — `lotus-72` is the 72B, 72C, 72D and 72E — and
 * those pages have to cover the variants together, because no race entry is
 * ever attributed to `lotus-72` itself. Matching `car_id` only when no chassis
 * owns the id keeps every other page exactly as it was: `mclaren-mp4-4` names
 * both a car and a chassis, and resolves to the chassis.
 */
const VARIANTS = `
  SELECT ch.*, k.name AS constructor
    FROM chassis ch
    LEFT JOIN constructors k ON k.id = ch.constructor_id
   WHERE ch.id = ?1
      OR (ch.car_id = ?1 AND NOT EXISTS (SELECT 1 FROM chassis x WHERE x.id = ?1))
   ORDER BY ch.first_year, ch.id
`

const CAR = `
  SELECT c.* FROM cars c
   WHERE c.id = (SELECT car_id FROM chassis WHERE id = ?) OR c.id = ?
   LIMIT 1
`

const IMAGES = `
  SELECT * FROM article_images
   WHERE article = (SELECT article FROM chassis WHERE id = ?)
      OR article = (SELECT article FROM chassis WHERE car_id = ? LIMIT 1)
   ORDER BY name_matches DESC
`

/** Entries for every chassis this page covers — the same set VARIANTS resolves. */
const ENTRIES = `
  SELECT r.year, r.round, r.name_used, r.circuit_id, c.name AS circuit,
         e.driver_id, d.full_name AS driver, e.grid_text, e.grid,
         e.chassis_id, ch.name AS chassis,
         e.position_text, e.finish_position, e.status, e.fastest_lap
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN drivers d  ON d.id = e.driver_id
    LEFT JOIN chassis ch ON ch.id = e.chassis_id
   WHERE e.chassis_id IN (
           SELECT id FROM chassis
            WHERE id = ?1
               OR (car_id = ?1 AND NOT EXISTS (SELECT 1 FROM chassis x WHERE x.id = ?1))
         )
   ORDER BY r.year DESC, r.round DESC
`

const SEASONS = `
  SELECT cs.year, cs.corroborated, cs.other_chassis
    FROM car_seasons cs
   WHERE cs.car_id = (SELECT car_id FROM chassis WHERE id = ?) OR cs.car_id = ?
   ORDER BY cs.year
`

export default function Car() {
  const { id } = useParams()
  const state = useQueries({
    variants: [VARIANTS, [id]],
    car: [CAR, [id, id]],
    images: [IMAGES, [id, id]],
    entries: [ENTRIES, [id]],
    seasons: [SEASONS, [id, id]],
  })

  return (
    <Result state={state} context="That car could not be read">
      {(data) => {
        const variants = data.variants.rows
        const chassis = variants[0]
        if (!chassis) {
          return (
            <Page title="No such car" back={{ to: '/cars', label: 'The register' }}>
              <p className="muted">Nothing in the chassis register has the id “{id}”.</p>
              <p>
                Press <kbd>/</kbd> to search by chassis name, or{' '}
                <Link to="/cars">browse the register</Link>.
              </p>
            </Page>
          )
        }
        return <CarBody chassis={chassis} variants={variants} data={data} />
      }}
    </Result>
  )
}

function CarBody({ chassis, variants, data }) {
  const car = data.car.rows[0]
  const images = rows(data, 'images')
  const entries = rows(data, 'entries')
  const seasons = rows(data, 'seasons')

  const wins = entries.filter((e) => e.finish_position === 1).length
  const poles = entries.filter((e) => e.grid === 1).length
  const fastest = entries.filter((e) => e.fastest_lap === 1).length
  const ambiguous = seasons.filter((s) => !s.corroborated)

  const several = variants.length > 1
  // Entries come back newest first, so the last winning row is the first win.
  const firstWin = [...entries].reverse().find((entry) => entry.finish_position === 1) ?? null
  const notableRace = firstWin ?? entries[entries.length - 1] ?? null

  // chassis.published_wins is the CAR's figure, taken from the article the
  // whole family shares, and it is repeated verbatim on every variant row —
  // all eleven multi-variant cars in the register carry one distinct value
  // across their variants. So it is read once, never added up: summing the
  // four Lotus 72 rows would claim the 72 won sixty Grands Prix.
  const publishedWins = variants.map((row) => row.published_wins).find((value) => !missing(value)) ?? null
  const winsDiffer = !missing(publishedWins) && publishedWins !== wins
  const raced = [
    Math.min(...variants.map((v) => v.first_year).filter((y) => !missing(y))),
    Math.max(...variants.map((v) => v.last_year ?? v.first_year).filter((y) => !missing(y))),
  ]

  return (
    <Page
      eyebrow={chassis.constructor ?? 'Chassis'}
      title={(several ? car?.full_name : null) || chassis.full_name || chassis.name}
      back={{ to: '/cars', label: 'The register' }}
      lede={car?.story}
    >
      <Section>
        <Stats
          items={[
            { label: 'Raced', value: span(raced[0], raced[1]) },
            several ? { label: 'Variants', value: number(variants.length) } : null,
            { label: 'Recorded entries', value: number(entries.length) },
            { label: 'Wins', value: number(wins) },
            { label: 'Poles', value: number(poles) },
            { label: 'Fastest laps', value: number(fastest) },
            car?.constructors_titles ? { label: "Constructors' titles", value: car.constructors_titles } : null,
            car?.drivers_titles ? { label: "Drivers' titles", value: car.drivers_titles } : null,
          ].filter(Boolean)}
        />
      </Section>

      {images.length > 0 && (
        <Section
          title="Photographs"
          count={`${images.length}`}
          note="From Wikimedia Commons, each shown with the photographer and licence its terms require."
        >
          <div className="photo-grid">
            {images.slice(0, 6).map((image) => (
              <CommonsImage key={image.file_name} image={image} width={600} />
            ))}
          </div>
          {images.some((image) => image.name_matches === 0) && (
            <p className="source-note">
              A photograph marked <span className="pill pill-unverified">unchecked</span> has a file
              name that does not name this car. Most are still the right car, filed under the driver
              rather than the machine — but nobody has confirmed these one by one.
            </p>
          )}
        </Section>
      )}

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
                { label: 'Designers', value: car.designers ?? chassis.designers },
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
            columns={[
              {
                key: 'name',
                label: 'Chassis',
                render: (name, row) => <Link to={`/cars/${row.id}`}>{name}</Link>,
              },
              {
                key: 'first_year',
                label: 'Raced',
                align: 'num',
                render: (_, row) => span(row.first_year, row.last_year),
                sort: (row) => row.first_year,
              },
              { key: 'engine_name', label: 'Engine', align: 'prose' },
              { key: 'power_bhp', label: 'Power (bhp)', align: 'num' },
              { key: 'wheelbase_mm', label: 'Wheelbase (mm)', align: 'num' },
              { key: 'races', label: 'Races', align: 'num' },
              { key: 'wins', label: 'Wins', align: 'num' },
            ]}
            footer="Races and wins here belong to that particular variant. The published figure covers the whole car and is shown once, below."
          />
        </Section>
      )}

      <Section title={several ? `Specification — ${chassis.name}` : 'Specification'}>
        <div className="split">
          <Fields
            items={[
              { label: 'Chassis', value: chassis.chassis_type },
              { label: 'Front suspension', value: chassis.susp_front },
              { label: 'Rear suspension', value: chassis.susp_rear },
              { label: 'Brakes', value: chassis.brakes ?? car?.brakes },
              { label: 'Gearbox', value: chassis.gearbox },
              { label: 'Gears', value: chassis.gears },
              { label: 'Tyres', value: chassis.tyres ?? car?.tyres },
              { label: 'Fuel', value: chassis.fuel },
            ]}
          />
          <Fields
            items={[
              { label: 'Engine', value: chassis.engine_name ?? car?.engine_name },
              { label: 'Configuration', value: chassis.engine_config ?? car?.engine_config },
              { label: 'Capacity', value: (chassis.capacity_cc ?? car?.capacity_cc) ? `${number(chassis.capacity_cc ?? car.capacity_cc)} cc` : null },
              { label: 'Aspiration', value: chassis.aspiration ?? car?.aspiration },
              { label: 'Power', value: chassis.power_bhp ? `${number(chassis.power_bhp)} bhp` : null },
              { label: 'Power note', value: chassis.power_note ?? car?.power_note },
              { label: 'Weight', value: chassis.weight_kg ? `${chassis.weight_kg} kg` : null },
              { label: 'Wheelbase', value: chassis.wheelbase_mm ? `${number(chassis.wheelbase_mm)} mm` : null },
              { label: 'Track, front', value: chassis.track_front_mm ? `${number(chassis.track_front_mm)} mm` : null },
              { label: 'Track, rear', value: chassis.track_rear_mm ? `${number(chassis.track_rear_mm)} mm` : null },
            ]}
          />
        </div>
        <p className="source-note">
          A blank is a figure nobody published for this car. Where several teams quote the same
          number in a season it is usually the rule they were all built to rather than a
          measurement, so it is kept with the{' '}
          <Link to="/reference/eras">regulation limits</Link> instead of here.
        </p>
      </Section>

      {winsDiffer && (
        <Note>
          <strong>
            {number(wins)} wins can be traced to {several ? 'this car' : 'this chassis'}; its
            article publishes {number(publishedWins)}.
          </strong>{' '}
          Neither is wrong. A win counts here only where the entry list says which car the driver
          was in, and a team running two designs in a season does not always say. The unresolved
          seasons are listed below.
        </Note>
      )}

      {ambiguous.length > 0 && (
        <Section title="Seasons that cannot be attributed" count={`${ambiguous.length}`}>
          <DataTable
            rows={ambiguous}
            rowKey={(row) => row.year}
            sortable={false}
            columns={[
              {
                key: 'year',
                label: 'Season',
                align: 'num',
                render: (year) => <Link to={`/seasons/${year}`}>{year}</Link>,
              },
              { key: 'other_chassis', label: 'Also entered by this constructor', align: 'prose' },
            ]}
            footer="In these seasons the team ran more than one design and no source says which car raced which round, so the results are left unattributed rather than guessed."
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
          empty="No race entry in this database resolves here. That is usually a constructor that ran several designs in a season and no source saying which raced when, not a car that never raced."
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
              key: 'driver',
              label: 'Driver',
              render: (name, row) =>
                row.driver_id ? <Link to={`/drivers/${row.driver_id}`}>{name}</Link> : cell(name),
            },
            ...(several
              ? [
                  {
                    key: 'chassis',
                    label: 'Chassis',
                    render: (name, row) =>
                      row.chassis_id ? <Link to={`/cars/${row.chassis_id}`}>{name}</Link> : cell(name),
                  },
                ]
              : []),
            { key: 'grid_text', label: 'Grid', align: 'num', sort: (row) => row.grid },
            {
              key: 'position_text',
              label: 'Result',
              align: 'num',
              sort: (row) => row.finish_position,
              render: (value, row) =>
                missing(row.finish_position) ? (
                  <span className="tag tag-dnf">{value ?? '—'}</span>
                ) : (
                  <b>{value}</b>
                ),
            },
            { key: 'status', label: 'Out' },
          ]}
        />
      </Section>

      <Section title="On the record">
        <Fields
          items={[
            { label: 'Constructor', value: chassis.constructor_id ? <Link to={`/constructors/${chassis.constructor_id}`}>{chassis.constructor}</Link> : null },
            { label: 'Predecessor', value: chassis.predecessor },
            { label: 'Successor', value: chassis.successor },
            { label: 'Races (published)', value: number(chassis.published_races) },
            { label: 'Wins (published)', value: number(publishedWins) },
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

      <Onward
        items={[
          chassis.constructor_id
            ? {
                to: `/constructors/${chassis.constructor_id}`,
                label: chassis.constructor,
                hint: 'The team that built it, and everything else it made.',
              }
            : null,
          notableRace
            ? {
                to: `/races/${notableRace.year}/${notableRace.round}`,
                label: `${notableRace.year} ${notableRace.name_used}`,
                hint: firstWin ? 'Its first win, in full.' : 'A race it entered, in full.',
              }
            : null,
          car?.supersedes_id
            ? { to: `/cars/${car.supersedes_id}`, label: 'The car before it', hint: 'What this design replaced.' }
            : null,
          { to: '/cars', label: 'All cars', hint: '1,153 chassis, filterable by team and era.' },
        ]}
      />
    </Page>
  )
}
