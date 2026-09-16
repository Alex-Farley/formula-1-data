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

/** The sources page's paragraph: the credit, what it obliges, and what was changed. */
export const OUTLINES_NOTE = `${OUTLINE_CREDIT}. Carry that credit with any outline you take. Shown here in the site’s own ink at a constant stroke, otherwise as drawn. ${OUTLINE_RULE}`

/**
 * Under a circuit's timeline, where the register's length sits a few lines
 * below F1DB's for the same layout and nine circuits disagree (Silverstone's
 * 1950 layout 4.649 v 4.711 km; Spa 19 v 21 turns).
 */
export const OUTLINE_FIGURES_NOTE = 'Lengths here are this register’s, from its own sources; the figures under each outline above are F1DB’s, and at some circuits the two disagree.'

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
