import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Note, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import { rows as pick, useQueries } from '../data/useQuery.js'
import { canShow, thumbUrl } from '../lib/commons.js'
import CommonsCredit from '../components/CommonsCredit.jsx'
import { span } from '../lib/format.js'
import { colourForEntry } from '../lib/liveries.js'
import { LANDMARK } from '../lib/site.js'
import { CHASSIS, CHASSIS_COLUMNS, CHASSIS_FOOTER, GALLERY } from '../queries/cars.js'

/**
 * The gallery: 24 of the 29 curated cars have a Commons photograph, which is
 * why this page can open with pictures at all; the 1,153-row register cannot,
 * and pretending otherwise would be a grid of empty frames.
 *
 * The React renders for the register's columns (queries/cars.js) — the links
 * and the landmark tag; the router is the reason they live here. The words
 * each cell carries are the column's own `text`, which scripts/prerender.js
 * prints too, so the static register is this one.
 */
const APP = {
  name: {
    render: (name, row) => (
      <>
        <Link to={`/cars/${row.id}`}>{name}</Link>
        {row.landmark ? ' ' : ''}
        {row.landmark ? <span className="tag">{LANDMARK}</span> : null}
      </>
    ),
  },
  // The builder's colour mark (AF-51): a car is a first-class constructor
  // attribute under clause 1 of AF-47. A chassis spans seasons and
  // colourForEntry takes one, so it takes the last - the site's rule for a
  // subject spanning seasons, the same one the bands on Constructor.jsx and
  // Driver.jsx read. `last_year` is the second half of the span this row
  // already prints, so the mark and the years cannot disagree.
  constructor: {
    render: (name, row) => (
      <>
        <LiveryMark
          colour={colourForEntry({
            constructorId: row.constructor_id,
            country: row.constructor_country,
            year: row.last_year,
            team: name,
          })}
          year={row.last_year}
        />
        {row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name)}
      </>
    ),
  },
  first_year: { sort: (row) => row.first_year },
}

export default function Cars() {
  const state = useQueries({ gallery: [GALLERY], register: [CHASSIS] })
  return (
    <Page
      title="Cars"
      lede="Twenty-nine designs with a page of their own, and behind them every chassis with a championship entry — 1,153 of them, most raced by a privateer for a single weekend. Filter the register to race winners, landmark designs, or the ones with a published specification. A blank is a figure nobody published, not a car with no wheelbase."
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
                drawn: it would sit on all {pick(data, 'gallery').length} and mean nothing. What
                each card carries instead is the line the database holds on what the design was
                actually for.
              </p>
              <Gallery cars={pick(data, 'gallery')} />
            </Section>
            <Section
              title="The chassis register"
              count={`${pick(data, 'register').length.toLocaleString('en-GB')} chassis`}
            >
              <Register rows={pick(data, 'register')} />
            </Section>
          </>
        )}
      </Result>

      <Onward
        items={[
          { to: '/constructors', label: 'Constructors', hint: 'The teams that built and ran them.' },
          { to: '/reference/eras', label: 'Eras and rules', hint: 'The regulations these cars were designed around.' },
          { to: '/records', label: 'Records', hint: 'What the fastest of them actually won.' },
        ]}
      />
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
            {canShow(car) ? (
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
          {canShow(car) && <CommonsCredit image={car} className="carcard-credit" />}
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
        <strong>“Raced” is not the same as a car's design life.</strong> These years are the
        seasons the chassis actually entered a championship race, which usually runs longer than
        the works team's own dates: privateers were still running the Ferrari 500 in 1957, years
        after Ferrari had moved on.
      </Note>

      <Filters showing={filtered.length} of={rows.length} noun="chassis">
        <SearchField value={term} onChange={setTerm} label="Filter cars" placeholder="A chassis or a constructor…" />
        {/* The options are <option> text and cannot carry a mark; they stay
            bare (AF-51). Clause 4 of AF-47 is what makes that safe - the name
            is always there, and the mark never stood in for it. */}
        <Select
          value={constructor}
          onChange={setConstructor}
          label="Constructor"
          all="Every constructor"
          options={constructors}
        />
        <Chips
          label="Filter cars by kind"
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
        columns={CHASSIS_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
        footer={CHASSIS_FOOTER}
      />
    </>
  )
}
