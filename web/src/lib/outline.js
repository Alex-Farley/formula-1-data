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

/** The sources page's paragraph: the credit, and what it obliges. */
export const OUTLINES_NOTE = `${OUTLINE_CREDIT}. Carry that credit with any outline you take. ${OUTLINE_RULE}`

/** The accessible name of one outline: what it is, and which F1DB layout. */
export const outlineLabel = (circuit, layoutId) => `Outline of ${circuit ?? 'the circuit'}, F1DB layout ${layoutId}`

/**
 * F1DB's figures for the layout — "5.793 km · 11 turns" — or nothing where it
 * gives none. They are F1DB's, not this register's: circuit_layouts holds the
 * lengths this project sourced, and a caption says whose figure it prints.
 */
export const outlineFigures = (row) =>
  [
    row.length_km === null || row.length_km === undefined ? null : `${row.length_km} km`,
    row.turns === null || row.turns === undefined ? null : `${row.turns} ${row.turns === 1 ? 'turn' : 'turns'}`,
  ]
    .filter(Boolean)
    .join(' · ')

/** "5 rounds", "1 round": how many races ran a layout, scheduled ones included. */
export const roundsOn = (n) => `${n} ${n === 1 ? 'round' : 'rounds'}`

/**
 * The caption under one outline: F1DB's id, its figures, and — where the row
 * carries them — the years it ran and the rounds run on it. A race page's
 * card has no years to give; a circuit page's has.
 */
export const outlineCaption = (row) =>
  [
    `F1DB layout ${row.f1db_layout_id}`,
    outlineFigures(row) || null,
    row.first_year === null || row.first_year === undefined ? null : span(row.first_year, row.last_year),
    row.rounds ? roundsOn(row.rounds) : null,
  ]
    .filter(Boolean)
    .join(' · ')

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
