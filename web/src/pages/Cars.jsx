import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Note, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { rows as pick, useQueries } from '../data/useQuery.js'
import { fileTitle, thumbUrl } from '../lib/commons.js'
import { span } from '../lib/format.js'

/**
 * The curated cars, with a photograph where one has been matched.
 *
 * These 29 are not a subset of the register below by size — they are the
 * designs somebody wrote a page about, with a designer, a concept and a
 * record. 24 of them have a Commons photograph, which is why this page can
 * open with pictures at all; the 1,153-row register cannot, and pretending
 * otherwise would be a grid of empty frames.
 */
const GALLERY = `
  SELECT v.id, v.car, v.constructor, v.from_year, v.to_year, v.concept,
         v.wins, v.drivers_titles, v.constructors_titles,
         i.file_name, i.licence, i.licence_url, i.artist,
         i.description_url, i.width, i.height, i.name_matches
    FROM v_cars v
    LEFT JOIN v_car_images i ON i.car_id = v.id
   ORDER BY v.from_year, v.car
`

const SQL = `
  SELECT ch.id, ch.name, ch.full_name, ch.constructor_id, k.name AS constructor,
         ch.first_year, ch.last_year, ch.engine_name, ch.chassis_type,
         ch.power_bhp, ch.wheelbase_mm, ch.weight_kg,
         ch.races, ch.wins, ch.published_wins, ch.car_id, ch.article, ch.confidence,
         CASE WHEN ch.chassis_type IS NULL AND ch.engine_name IS NULL
              THEN 0 ELSE 1 END AS has_spec,
         (SELECT landmark FROM cars WHERE cars.id = ch.car_id) AS landmark
    FROM chassis ch
    LEFT JOIN constructors k ON k.id = ch.constructor_id
   ORDER BY ch.first_year, ch.name
`

export default function Cars() {
  const state = useQueries({ gallery: [GALLERY], register: [SQL] })
  return (
    <Page
      title="Cars"
      lede="Twenty-nine designs with a page of their own, and behind them every chassis the championship has an entry for — 1,153 of them, most raced by a privateer for one weekend. Specifications come from the {{Racing car}} infobox of the car's own article where it has one, which is why some rows are a full spec sheet and most are a name and a year. A blank is a figure nobody published, not a car with no wheelbase."
    >
      <Result state={state} skeleton>
        {(data) => (
          <>
            <Section
              title="The cars with a page of their own"
              count={`${pick(data, 'gallery').length} designs, in order`}
            >
              <p className="note" style={{ marginTop: 0 }}>
                Every one of these is flagged a landmark in the register, so the flag is not
                drawn: it would sit on all twenty-nine and mean nothing. What each card carries
                instead is the line the database holds on what the design was actually for.
              </p>
              <Gallery cars={pick(data, 'gallery')} />
            </Section>
            <Section title="The chassis register" count="1,153 chassis">
              <Register rows={pick(data, 'register')} />
            </Section>
          </>
        )}
      </Result>
    </Page>
  )
}

/**
 * A card per curated car: the photograph, what it was for, what it won.
 *
 * The credit line is the licence obligation and is not optional, so it sits
 * on the card rather than being collected into a footnote. A car with no
 * matched photograph still gets a card — its concept line is the reason it is
 * here — and the frame simply carries no picture rather than a placeholder
 * pretending one is coming.
 */
function Gallery({ cars }) {
  return (
    <ul className="cardgrid">
      {cars.map((car) => (
        <li key={car.id} className="carcard">
          <Link to={`/cars/${car.id}`} className="carcard-shot">
            {car.file_name ? (
              <img
                src={thumbUrl(car.file_name, 640)}
                alt={car.car}
                loading="lazy"
                decoding="async"
                width={car.width || undefined}
                height={car.height || undefined}
              />
            ) : (
              <span className="carcard-nophoto">no photograph matched</span>
            )}
          </Link>
          <div className="carcard-body">
            <h3>
              <Link to={`/cars/${car.id}`}>{car.car}</Link>
            </h3>
            <p className="carcard-meta num">
              {car.constructor} · {span(car.from_year, car.to_year)}
            </p>
            {car.concept && <p className="carcard-concept">{car.concept}</p>}
            <p className="carcard-record num">
              {cell(car.wins)} {car.wins === 1 ? 'win' : 'wins'}
              {car.drivers_titles > 0 && ` · ${car.drivers_titles} drivers' title${car.drivers_titles > 1 ? 's' : ''}`}
              {car.constructors_titles > 0 &&
                ` · ${car.constructors_titles} constructors'`}
            </p>
          </div>
          {car.file_name && (
            <p className="carcard-credit">
              <a href={car.description_url} target="_blank" rel="noreferrer noopener">
                {fileTitle(car.file_name)}
              </a>
              {' · '}
              {car.artist || 'photographer not recorded'}
              {' · '}
              {car.licence_url ? (
                <a href={car.licence_url} target="_blank" rel="noreferrer noopener">
                  {car.licence}
                </a>
              ) : (
                car.licence || 'licence not recorded'
              )}
              {car.name_matches === 0 && ' · unchecked'}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function Register({ rows }) {
  const [term, setTerm] = useState('')
  const [constructor, setConstructor] = useState('')
  const [kind, setKind] = useState('')

  const constructors = useMemo(
    () =>
      [...new Set(rows.map((r) => r.constructor).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'en'),
      ),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (constructor && row.constructor !== constructor) return false
      if (kind === 'landmark' && !row.landmark) return false
      if (kind === 'spec' && !row.has_spec) return false
      if (kind === 'winners' && !row.wins) return false
      if (!needle) return true
      return [row.name, row.full_name, row.constructor]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    })
  }, [rows, term, constructor, kind])

  const landmarks = rows.filter((r) => r.landmark).length

  return (
    <>
      <Note>
        <strong>A car's design life is not its racing life.</strong> The years below are the years
        the chassis is recorded as entering a championship race. A works team's own dates for a car
        are usually shorter: privateers ran the Ferrari 500 until 1957, years after Ferrari had
        moved on. Anything about when a car raced comes from the chassis register, never from a
        design date.
      </Note>

      <Filters showing={filtered.length} of={rows.length} noun="chassis">
        <SearchField value={term} onChange={setTerm} label="Filter cars" placeholder="A chassis or a constructor…" />
        <Select
          value={constructor}
          onChange={setConstructor}
          label="Constructor"
          all="Every constructor"
          options={constructors}
        />
        <Chips
          value={kind}
          onChange={setKind}
          options={[
            ['', 'All'],
            ['winners', 'Race winners'],
            ['spec', 'With a spec'],
            ['landmark', `Landmark (${landmarks})`],
          ]}
        />
      </Filters>

      <DataTable
        rows={filtered}
        rowKey={(row) => row.id}
        sort="first_year"
        direction="asc"
        page={150}
        columns={[
          {
            key: 'name',
            label: 'Chassis',
            render: (name, row) => (
              <>
                <Link to={`/cars/${row.id}`}>{name}</Link>
                {row.landmark ? <span className="tag" style={{ marginLeft: 6 }}>landmark</span> : null}
              </>
            ),
          },
          {
            key: 'constructor',
            label: 'Constructor',
            render: (name, row) =>
              row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name),
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
          {
            key: 'published_wins',
            label: 'Published wins',
            align: 'num',
          },
        ]}
        footer="Where “wins” and “published wins” differ, the derived figure counts the races this database can attribute to this chassis and the published one is what the car's article claims — a difference is a season the constructor ran more than one design, not an error."
      />
    </>
  )
}
