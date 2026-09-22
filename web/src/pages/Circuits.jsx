import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Outline from '../components/Outline.jsx'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, NoMatch, SearchField, Select, Toggle } from '../components/Filters.jsx'
import { currentProgress } from '../data/client.js'
import { rows as pick, useQueries } from '../data/useQuery.js'
import { anyThisSeason, calendarLabel, seasonOf } from '../lib/season.js'
import { TRACE_COLUMN_UNKNOWN, TRACE_NOT_LOADED, traceRegisterNote } from '../lib/trace.js'
import { OUTLINE_REGISTER_NOTE } from '../lib/outline.js'
import { oneOf, useUrlState } from '../lib/urlstate.js'
import {
  CIRCUITS,
  CIRCUIT_COLUMNS,
  CIRCUITS_FOOTER,
  NO_SHAPES,
  REGISTER_OUTLINES,
  SHAPES,
  TRACED,
} from '../queries/circuits.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import { NAMES } from '../lib/site.js'
/**
 * Race counts and first/last Grand Prix come from v_circuits, which derives
 * them from the races. The stored circuits.last_gp is NULL for the 27 venues
 * still in use, and reading it would report every current circuit as never
 * having held its most recent race.
 */
/**
 * The React renders for the columns queries/circuits.js defines — the link
 * and a sort key; the router is the reason they live here. The words each
 * cell carries are the column's own `text`, which scripts/prerender.js prints
 * too, so the static register is this one.
 */
const APP = {
  name: { render: (name, row) => <Link to={`/circuits/${row.id}`}>{name}</Link> },
  first_gp: { sort: (row) => row.first_gp },
  traced: {
    render: (value) =>
      value ? (
        <>
          <span aria-hidden="true">●</span>
          <span className="sr-only">{TRACED}</span>
        </>
      ) : (
        cell(null)
      ),
  },
}

/**
 * The traced centrelines, for the cards at the top of the page.
 *
 * 25 of the 80 circuits have one. That is a minority, and the section says so
 * rather than implying the other 55 are missing something — a trace exists
 * where somebody could match an OSM relation to a length this database
 * already held, and most venues in the register have been gone for decades.
 *
 * AF-23: what each card carries is the measurement, not the shape. This was
 * the third place the site drew the same circuit, after the trace and the
 * F1DB outlines on the circuit's own page; the outline is the picture now,
 * and the centreline is what it cannot be. The centreline itself is no longer
 * read here at all, which is a few hundred kilobytes of coordinates the
 * register no longer parses to draw 25 thumbnails.
 */
const TRACES = `
  SELECT g.circuit_id, c.name, c.country, g.measured_km, g.closes, g.licence
    FROM circuit_geometry g
    JOIN circuits c ON c.id = g.circuit_id
   ORDER BY c.name
`

export default function Circuits() {
  const state = useQueries({ register: [CIRCUITS], traces: [TRACES], shapes: [REGISTER_OUTLINES] })
  return (
    <Page
      title={NAMES.circuits().headline}
      documentName={NAMES.circuits().title}
      trail={TRAIL.circuits()}
      lede="Eighty venues, from airfield perimeters to street courses laid out for a single season. Drawn below, then listed by races held: open one for how its shape changed, who has won there most, and every Grand Prix it has staged."
    >
      <Result state={state} skeleton>
        {(data) => (
          <Register rows={pick(data, 'register')} traces={pick(data, 'traces')} shapes={pick(data, 'shapes')} />
        )}
      </Result>

      <Onward {...ONWARD.circuits()} />
    </Page>
  )
}

/**
 * The register in both the encodings this page draws it in — the cards for
 * the traced centrelines and the table of every venue — under one filter bar
 * that governs both.
 *
 * IX-33: the bar used to sit inside the table's section with its state local
 * to it, roughly two thousand pixels below the cards. Asking for the street
 * circuits took the table to sixteen rows and left twenty-five cards standing
 * above it, off screen by then and contradicting the count line the reader had
 * just read — two answers to one question, with nothing on the page saying
 * which of them the control had been aimed at. Both sections draw the same
 * venues, so one predicate settles both, and the bar is above the first thing
 * it moves.
 */
function Register({ rows, traces, shapes }) {
  // IA-19: the same question the other three registers ask, in the same
  // words - but a toggle rather than a fifth chip, because the chip group
  // here is the type axis and IX-35 is the record of what happens when a
  // second question is filed into it: the sixteen street circuits and the
  // ones among them on this year's calendar could not both be asked for.
  const calendarSeason = seasonOf(rows)
  const hasCalendar = anyThisSeason(rows, 'on_calendar')

  // IX-31: "0 of 80" is a claim about the database, made in the database's
  // voice, when what happened is that an ODbL file did not arrive — and the
  // register's Traced column empties with it, so the page is internally
  // consistent and wrong throughout. The overlay's own state is the only
  // thing that can tell the two apart.
  const overlay = currentProgress().manifest?.geometry ?? null

  const countries = useMemo(
    () => [...new Set(rows.map((r) => r.country).filter(Boolean))].sort(),
    [rows],
  )
  const types = useMemo(
    () => [...new Set(rows.map((r) => r.circuit_type).filter(Boolean))].sort(),
    [rows],
  )
  const kinds = [['', 'All types'], ...types.map((t) => [t, t])]

  // In the address (IA-08). The two toggles answer to whether their control
  // is there at all: `?traced=1` without the overlay, or `?calendar=1` in a
  // season with no calendar yet, would filter eighty circuits to none with
  // nothing on the page to say what had been asked.
  const [params, set, clear] = useUrlState({
    q: '',
    country: '',
    kind: '',
    traced: false,
    calendar: false,
  })
  const term = params.q
  const country = oneOf(params.country, countries)
  const kind = oneOf(params.kind, kinds)
  const tracedOnly = Boolean(overlay) && params.traced
  const onCalendar = hasCalendar && params.calendar

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (country && row.country !== country) return false
      // IX-35: the type and the trace are two questions, and they compose.
      // While "Traced" was a sixth type chip, sixteen street circuits and the
      // ones among them with a centreline could not both be asked for.
      if (kind && row.circuit_type !== kind) return false
      if (tracedOnly && !row.traced) return false
      if (onCalendar && !row.on_calendar) return false
      if (!needle) return true
      return [row.name, row.locality, row.country]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    })
  }, [rows, term, country, kind, tracedOnly, onCalendar])

  // The cards are the filtered register's traced subset, taken by id. Every
  // row of circuit_geometry joins a circuit and v_circuits is every circuit,
  // so with nothing filtered this is the whole set — which is what the cards
  // showed when they answered to no control at all.
  const shown = useMemo(() => {
    const ids = new Set(filtered.map((row) => row.id))
    return traces.filter((trace) => ids.has(trace.circuit_id))
  }, [filtered, traces])

  // VD-50: the same take as the cards above, on the same ids. 79 of the 80
  // venues have an F1DB outline, so with nothing filtered the count reads
  // "79 of 80" - the venue without one is in the table below like every
  // other, and the figure says so rather than the grid quietly being short.
  const drawn = useMemo(() => {
    const ids = new Set(filtered.map((row) => row.id))
    return shapes.filter((shape) => ids.has(shape.circuit_id))
  }, [filtered, shapes])

  // The five filters as a plural noun phrase, for the empty state (IX-28).
  // The two toggles are their own axis, so they read as trailing clauses
  // rather than as adjectives on the type.
  const among =
    country || kind || tracedOnly || onCalendar
      ? [
          kind ? `${kind} circuits` : 'circuits',
          country ? `in ${country}` : '',
          onCalendar ? `on the ${calendarSeason} calendar` : '',
          tracedOnly ? 'with a traced centreline' : '',
        ]
          .filter(Boolean)
          .join(' ')
      : ''

  return (
    <>
      <Filters showing={filtered.length} of={rows.length} noun="circuits">
        <SearchField
          value={term}
          onChange={(value) => set({ q: value })}
          label="Filter circuits"
          placeholder="A circuit or a place…"
        />
        <Select
          value={country}
          onChange={(value) => set({ country: value })}
          label="Country"
          all="Every country"
          options={countries}
        />
        <Chips
          label="Filter circuits by type"
          value={kind}
          onChange={(value) => set({ kind: value })}
          // "All types", not "All": the toggle beside this group is a
          // second axis now, and a chip reading "All" beside a pressed
          // Traced would name a state the bar is not in.
          options={kinds}
        />
        {hasCalendar && (
          <Toggle
            value={onCalendar}
            onChange={(value) => set({ calendar: value })}
            label={`${calendarLabel(calendarSeason)} only`}
          >
            {calendarLabel(calendarSeason)}
          </Toggle>
        )}
        {/* Without the overlay every row's Traced is unestablished, so this
            would filter eighty circuits down to none and read as an answer
            (IX-31). */}
        {overlay && (
          <Toggle
            value={tracedOnly}
            onChange={(value) => set({ traced: value })}
            label="Traced centrelines only"
          >
            Traced
          </Toggle>
        )}
      </Filters>

      {/* VD-50: the register drew nothing at all - 4,838 px of table and no
          picture of a circuit in it - while the outline it needs was already
          in f1.db and drawn on four other surfaces. AF-23's argument holds:
          this is the DRAWING, once per venue, and the cards below carry the
          measurement the drawing cannot. One card rule and one stroke rule
          serve both, so a third is not invented here. */}
      <Section title={SHAPES} count={`${drawn.length} of ${filtered.length}`} note={OUTLINE_REGISTER_NOTE}>
        {drawn.length > 0 ? (
          <ul className="lapgrid">
            {drawn.map((shape) => (
              <li key={shape.circuit_id}>
                <Link to={`/circuits/${shape.circuit_id}`} className="lapcard shapecard">
                  {/* Decorative: the link's own name says which circuit this
                      is, and an outline announcing itself beside it would be
                      the name twice. */}
                  <Outline path={shape.path} decorative />
                  <b>{shape.name}</b>
                  <span>{shape.country}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="state is-empty">{NO_SHAPES}</p>
        )}
      </Section>

      <Section title="The traced centrelines" count={overlay ? `${shown.length} of ${filtered.length}` : null}>
        {/* One credit for the set, from the rows themselves: every row of
            circuit_geometry states the same licence today, and a circuit's
            own page prints its own row's. */}
        <p className="note" style={{ marginTop: 0 }}>
          {overlay ? traceRegisterNote(traces[0]?.licence) : TRACE_NOT_LOADED}
        </p>
        {overlay &&
          (shown.length > 0 ? (
            <ul className="lapgrid">
              {shown.map((trace) => (
                <li key={trace.circuit_id}>
                  <Link to={`/circuits/${trace.circuit_id}`} className="lapcard">
                    <b>{trace.name}</b>
                    <span>{trace.country}</span>
                    <span>
                      {trace.measured_km?.toFixed(3)} km measured
                      {/* Strictly 0, not falsy: a NULL verdict is
                          unestablished, not a trace that does not
                          close. */}
                      {trace.closes === 0 ? ' · does not close' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            // The filter emptied this section while the one below it may still
            // have rows, so the section says which of the two happened rather
            // than disappearing and leaving a heading over a credit.
            <p className="state is-empty">No traced centreline among these circuits.</p>
          ))}
      </Section>

      {/* The Traced column is answered from the same overlay, so without it
          every row reads as an em dash — the register saying "unestablished"
          eighty times when what happened was a download (IX-31). The column
          stays, because dropping a column would make the static and app
          tables disagree; what it means today is said beside it, and the
          toggle that reads it goes, because it would return nothing. */}
      <Section
        title="Every venue"
        count={
          filtered.length === rows.length
            ? `${rows.length} circuits`
            : `${filtered.length} of ${rows.length} circuits`
        }
        note={overlay ? undefined : TRACE_COLUMN_UNKNOWN}
      >
        <DataTable
          addressed
          rows={filtered}
          rowKey={(row) => row.id}
          sort="races"
          direction="desc"
          page={100}
          columns={CIRCUIT_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
          // A filter that matched nothing, said the way the section above
          // says it about its own cards - and now naming which of five
          // filters did it, with the way back (IX-28).
          empty={<NoMatch noun="circuit" term={term} among={among} onClear={clear} />}
          footer={CIRCUITS_FOOTER}
        />
      </Section>
    </>
  )
}
