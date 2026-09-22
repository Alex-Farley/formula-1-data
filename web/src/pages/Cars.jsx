import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Note, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, NoMatch, SearchField, Select } from '../components/Filters.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import { rows as pick, useQueries } from '../data/useQuery.js'
import { canShow, thumbUrl } from '../lib/commons.js'
import CommonsCredit from '../components/CommonsCredit.jsx'
import { span } from '../lib/format.js'
import { colourForEntry } from '../lib/liveries.js'
import { oneOf, useUrlState } from '../lib/urlstate.js'
import { anyThisSeason, gridLabel, seasonOf } from '../lib/season.js'
import { LANDMARK, NAMES } from '../lib/site.js'
import { CHASSIS, CHASSIS_COLUMNS, CHASSIS_FOOTER, GALLERY } from '../queries/cars.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
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
      title={NAMES.cars().headline}
      documentName={NAMES.cars().title}
      trail={TRAIL.cars()}
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

      <Onward {...ONWARD.cars()} />
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
  // IA-19: this register had no route to this year's chassis at all, in a
  // page of 1,153 rows opening on 1950.
  const gridSeason = seasonOf(rows)
  const hasGrid = anyThisSeason(rows, 'on_grid')

  const constructors = useMemo(
    () =>
      [...new Set(rows.map((r) => r.constructor).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'en'),
      ),
    [rows],
  )

  const landmarks = rows.filter((r) => r.landmark).length
  const kinds = [
    ['', 'All'],
    ['winners', 'Race winners'],
    ['spec', 'With a spec'],
    ['landmark', `Landmark (${landmarks})`],
    ...(hasGrid ? [['grid', gridLabel(gridSeason)]] : []),
  ]

  // In the address, and clamped to what this register actually holds (IA-08).
  const [params, set, clear] = useUrlState({ q: '', constructor: '', kind: '' })
  const term = params.q
  const constructor = oneOf(params.constructor, constructors)
  const kind = oneOf(params.kind, kinds)

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (constructor && row.constructor !== constructor) return false
      if (kind === 'landmark' && !row.landmark) return false
      if (kind === 'grid' && !row.on_grid) return false
      if (kind === 'spec' && !row.has_spec) return false
      if (kind === 'winners' && !row.wins) return false
      if (!needle) return true
      return [row.name, row.full_name, row.constructor]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    })
  }, [rows, term, constructor, kind])

  // The filters as a plural noun phrase, for the empty state (IX-28).
  const among = kind
    ? `${
        kind === 'winners'
          ? 'race winners'
          : kind === 'spec'
            ? 'chassis with a spec'
            : kind === 'landmark'
              ? 'landmark chassis'
              : `chassis on the ${gridSeason} grid`
      }${constructor ? ` from ${constructor}` : ''}`
    : constructor
      ? `${constructor} chassis`
      : ''

  return (
    <>
      <Note>
        <strong>“Raced” is not the same as a car's design life.</strong> These years are the
        seasons the chassis actually entered a championship race, which usually runs longer than
        the works team's own dates: privateers were still running the Ferrari 500 in 1957, years
        after Ferrari had moved on.
      </Note>

      <Filters showing={filtered.length} of={rows.length} noun="chassis">
        <SearchField
          value={term}
          onChange={(value) => set({ q: value })}
          label="Filter cars"
          placeholder="A chassis or a constructor…"
        />
        {/* The options are <option> text and cannot carry a mark; they stay
            bare (AF-51). Clause 4 of AF-47 is what makes that safe - the name
            is always there, and the mark never stood in for it. */}
        <Select
          value={constructor}
          onChange={(value) => set({ constructor: value })}
          label="Constructor"
          all="Every constructor"
          options={constructors}
        />
        <Chips
          label="Filter cars by kind"
          value={kind}
          onChange={(value) => set({ kind: value })}
          options={kinds}
        />
      </Filters>

      <DataTable
        addressed
        rows={filtered}
        rowKey={(row) => row.id}
        sort="first_year"
        direction="asc"
        page={150}
        columns={CHASSIS_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
        empty={<NoMatch noun="chassis" term={term} among={among} onClear={clear} />}
        footer={CHASSIS_FOOTER}
      />
    </>
  )
}
