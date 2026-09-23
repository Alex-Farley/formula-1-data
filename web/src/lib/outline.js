/**
 * The circuit outlines: F1DB's drawing of every layout the championship has
 * raced on (AF-03), in the words both renderers print.
 *
 * An outline is a DRAWING — a 500-unit box, no scale, no position, no
 * direction of travel — and a different fact from the OpenStreetMap trace in
 * circuit_geometry, which is measured, geo-referenced and exists only for a
 * layout still on the ground. The trace covers 25 circuits and can never
 * cover a historic layout; the outline covers all 160 layouts of every
 * circuit. The rule below is printed wherever a shape appears, so a reader is
 * never left to guess which of the two they are looking at.
 *
 * CC BY 4.0 like the rest of F1DB, so the path lives in f1.db — unlike the
 * ODbL trace — and the credit is the licence's one obligation: F1DB, and
 * Jules Roy, who drew them. Shared by the app and scripts/prerender.js so
 * the static page and the app draw and credit the same thing.
 */
import { span } from './format.js'

export const OUTLINE_VIEWBOX = '0 0 500 500'

/** The credit line, in the footer and on /data/sources. */
export const OUTLINE_CREDIT = 'Circuit outlines from F1DB (CC BY 4.0), drawn by Jules Roy'

/** The credit as a figure caption carries it. */
export const OUTLINE_BY = 'F1DB, CC BY 4.0 · drawn by Jules Roy'

/** Printed wherever a shape appears. */
export const OUTLINE_RULE = 'The outline is F1DB’s, for every layout; the trace is OpenStreetMap’s, where it exists.'

/**
 * Printed under a GRID of outlines, where one card sits beside another and
 * invites the comparison it cannot answer (VD-44). Every path is fitted to
 * its own 500-unit box, so Silverstone's 1950 airfield perimeter is drawn
 * exactly as large as the circuit that replaced it, 27 % longer with ten more
 * corners. Nothing in the outline data can fix that — a drawing carries no
 * scale — so the page says so instead.
 */
export const OUTLINE_SCALE_NOTE =
  'Each one is fitted to its own box, so these are not to scale: a longer layout is not drawn larger, ' +
  'and none of them carries a direction, a position or a start line.'

/**
 * A circuit page's outlines, split into the one it leads with and the rest
 * (VD-37). The lead is the layout of the latest race that names one, run or
 * to come - the one a reader arriving today is looking for - and is drawn
 * large, because 42 of the 79 venues have only the one layout and a grid of
 * one drew it a sixth of the width it had. The rest keep the query's
 * chronological order. A tie goes to the later row; a row no race names
 * (`latest` NULL) leads only when nothing else can.
 */
export const leadOutline = (rows) => {
  if (!rows?.length) return { lead: null, rest: [] }
  let at = 0
  rows.forEach((row, i) => {
    if ((row.latest ?? -1) >= (rows[at].latest ?? -1)) at = i
  })
  return { lead: rows[at], rest: rows.filter((_, i) => i !== at) }
}

/**
 * The note over a circuit page's outlines: the rule and the scale caveat,
 * and - where one is drawn larger than the others - why that one.
 */
export const OUTLINE_LEAD_NOTE = 'The large one is the latest layout raced or on the calendar here, not the longest.'
export const circuitOutlinesNote = (count, timeline = false) =>
  [OUTLINE_RULE, OUTLINE_SCALE_NOTE, count > 1 ? OUTLINE_LEAD_NOTE : null, timeline ? OUTLINE_FIGURES_NOTE : null]
    .filter(Boolean)
    .join(' ')

/** The sources page's paragraph: the credit, what it obliges, and what was changed. */
export const OUTLINES_NOTE = `${OUTLINE_CREDIT}. Carry that credit with any outline you take. Shown here in the site’s own ink at a constant stroke, otherwise as drawn. ${OUTLINE_RULE}`

/**
 * Under the register's grid of shapes, where one outline stands for a whole
 * circuit: the rule, the scale caveat a grid always needs (VD-44), and the
 * credit once for the set. Every card is F1DB's drawing under one licence on
 * one page, which is what CC BY 4.0 s.3(a)(2)'s "reasonable manner" means
 * here - the strip under a season's calendar credits its outlines the same
 * way, and a circuit's own page, where each card carries figures of its own,
 * credits them card by card.
 */
export const OUTLINE_REGISTER_NOTE = `${OUTLINE_RULE} ${OUTLINE_SCALE_NOTE} ${OUTLINE_BY}.`

/**
 * Over a circuit's timeline, where the register's length sits beside F1DB's
 * for the same layout and nine circuits disagree (Silverstone's 1950 layout
 * 4.649 v 4.711 km; Spa 19 v 21 turns).
 */
export const OUTLINE_FIGURES_NOTE = 'The length in each heading is this register’s, from its own sources; the figures under its drawing are F1DB’s, and at some circuits the two disagree.'

/**
 * Where a timeline row's drawing would be, when the row names no F1DB
 * outline. The row does the naming, so the words say the row lacks one -
 * at Marina Bay the drawings of those years are on the page, unnamed.
 */
export const NO_DRAWING = 'This row names no F1DB outline'

/**
 * The heading of an outline no timeline row names. What is missing is the
 * row naming it, not the years: at Spa and Marina Bay a row covers them and
 * names no drawing.
 */
export const NO_TIMELINE_ROW = 'No timeline row names this drawing'

/** The count beside a circuit's layouts: the timeline's rows and the drawings, which need not agree. */
export const layoutsCount = (layouts, outlines) =>
  layouts.length ? `${layouts.length} in the timeline, ${outlines.length} drawn` : `${outlines.length}`

/**
 * A circuit's layout timeline and F1DB's outlines as one list (IX-32). They
 * were two sections - the drawings, then the register's rows - joined only by
 * a "drawn as monza-5" string the reader carried back up the page, and at
 * Monza they disagreed with nothing on screen saying so. Here each
 * circuit_layouts row carries the outline it names (`outline` null where it
 * names none, or names one this circuit has no outline for), and each outline
 * no row names is a row of its own with `layout` null. Neither side is
 * dropped or matched by guesswork: the only join is `f1db_layout_id`, and a
 * drawing two rows name (Monza's banked oval, 1955-56 and 1960-61) is drawn
 * beside both.
 *
 * In order of the row's first year - the register's `from_year`, or for an
 * unnamed outline the first completed race run on it - a year nobody holds
 * last, and a tie in the order given: the register's rows before the
 * outlines, each in its query's order.
 */
export const layoutTimeline = (layouts, outlines) => {
  const drawn = new Map((outlines ?? []).map((outline) => [outline.f1db_layout_id, outline]))
  const named = new Set((layouts ?? []).map((layout) => layout.f1db_layout_id).filter(Boolean))
  const at = (year) => (year === null || year === undefined ? Number.POSITIVE_INFINITY : year)
  return [
    ...(layouts ?? []).map((layout) => ({
      key: `layout-${layout.id}`,
      layout,
      outline: (layout.f1db_layout_id && drawn.get(layout.f1db_layout_id)) || null,
      year: layout.from_year,
    })),
    ...(outlines ?? [])
      .filter((outline) => !named.has(outline.f1db_layout_id))
      .map((outline) => ({ key: `outline-${outline.f1db_layout_id}`, layout: null, outline, year: outline.first_year })),
  ].sort((a, b) => (at(a.year) === at(b.year) ? 0 : at(a.year) < at(b.year) ? -1 : 1))
}

/** The accessible name of one outline: what it is, and which F1DB layout. */
export const outlineLabel = (circuit, layoutId) => `Outline of ${circuit ?? 'the circuit'}, F1DB layout ${layoutId}`

/**
 * F1DB's figures for the layout — "5.793 km · 11 turns" — or nothing where it
 * gives none. They are F1DB's, not this register's: circuit_layouts holds the
 * lengths this project sourced, and outlineCaption says whose figure it prints.
 */
export const outlineFigures = (row) =>
  [
    row.length_km === null || row.length_km === undefined ? null : `${row.length_km} km`,
    row.turns === null || row.turns === undefined ? null : `${row.turns} ${row.turns === 1 ? 'turn' : 'turns'}`,
  ]
    .filter(Boolean)
    .join(' · ')

/** "5 rounds", "1 round": how many completed races ran a layout. */
export const roundsOn = (n) => `${n} ${n === 1 ? 'round' : 'rounds'}`

/** "1 round to come": races on the calendar that name the layout and have not run. */
export const roundsToCome = (n) => `${roundsOn(n)} to come`

/**
 * The caption under one outline: F1DB's id, its figures marked as F1DB's —
 * the register's own length may sit beside the card and differ — and, where
 * the row carries them, the years it ran, the rounds run on it and the
 * rounds still to come. A race page's card has no years to give; a circuit
 * page's has.
 */
export const outlineCaption = (row) => {
  const figures = outlineFigures(row)
  return [
    `F1DB layout ${row.f1db_layout_id}`,
    figures ? `${figures}, F1DB’s figures` : null,
    row.first_year === null || row.first_year === undefined ? null : span(row.first_year, row.last_year),
    row.rounds ? roundsOn(row.rounds) : null,
    row.scheduled ? roundsToCome(row.scheduled) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * The state of each round for the season strip: `run`, `next` for the first
 * round still to run, `to-come` for the rest. From the database's status,
 * not the clock — a round is run when it carries a classification, and the
 * static page has no clock. STATE_WORDS is what a reader is told.
 */
export const RUN = 'run'
export const NEXT = 'next'
export const TO_COME = 'to-come'
export const STATE_WORDS = { [RUN]: 'run', [NEXT]: 'next', [TO_COME]: 'to come' }

export const roundStates = (calendar) => {
  let named = false
  return calendar.map((round) => {
    if (round.status === 'completed') return RUN
    if (named) return TO_COME
    named = true
    return NEXT
  })
}

/**
 * The name under a strip's thumbnail: "Australian" for the Australian Grand
 * Prix, "Europe" for the Grand Prix of Europe; a name without the words —
 * "Indianapolis 500" — stays as it is.
 */
export const roundShortName = (name) => {
  const full = String(name ?? '')
  if (/^Grand Prix of /.test(full)) return full.replace(/^Grand Prix of /, '')
  return full.replace(/ Grand Prix\b/, '').trim() || full
}

/** The strip's accessible name. */
export const stripLabel = (year) => `The ${year} calendar as circuit outlines`
