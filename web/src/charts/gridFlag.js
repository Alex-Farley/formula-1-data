/**
 * Grid to flag (PD-30): where each car started, and where it ended.
 *
 * The geometry only, as plain numbers and strings, so that both renderers
 * draw the one picture: charts/GridFlag.jsx in the app, and
 * scripts/prerender.js on the static page, which has no React to run and so
 * could draw no chart until the layout was a function of the rows alone.
 *
 * WHAT IT DRAWS
 *     One line per car that started: from its grid slot on the left, at lap
 *     0, to its place in the result on the right, at the lap it last
 *     completed. A finisher's line runs to the flag (a lapped one stops a lap
 *     or two short of it); a car that was not classified stops at the lap it
 *     retired on, so the retirements fall out of the field where they
 *     happened. The right-hand order is the classification's own -
 *     finishers by position, then everyone else by how far they got - which
 *     is what makes the dropped lines a staircase rather than a tangle.
 *
 * WHAT IT DOES NOT
 *     The record holds two positions per car and a lap count. It holds no
 *     position in between: lap-by-lap order is FOM's timing, which `laps`
 *     stays empty of for licence reasons (docs/TIMING-ARCHITECTURE.md). So
 *     every line is straight, and the note under the figure says that a
 *     crossing is not an overtake at that lap.
 *
 * WHO IS DRAWN
 *     An entry with a start - a grid slot, or the pit lane, which `grid_text`
 *     holds and `grid` cannot - and a lap count. An entry that did not start
 *     (DNS, DNQ, DNPQ, DNP, or excluded before the race) has no line to draw.
 *     An entry that raced but has no recorded slot or lap count - mostly the
 *     second driver of a 1950s shared car - cannot be placed and is left out
 *     rather than guessed, and the note counts it.
 *
 * Rows are slots, not grid numbers: two columns of the same height, so a
 * grid with a gap in it (a car withdrawn after qualifying) or a shared drive
 * (two drivers, one slot) still lines up, and each label says the number the
 * source gives.
 */
import { classificationOrder, missing, result, text } from '../lib/format.js'
import { linear, ticks } from './scales.js'

/** The words drawn inside the figure, which both renderers print. */
export const GRID_FLAG_HEADS = { grid: 'Grid', result: 'Result', axis: 'Laps completed' }

/** The width the static page draws at, and the app's before it has measured. */
export const GRID_FLAG_WIDTH = 640

const NOT_STARTED = new Set(['DNS', 'DNQ', 'DNPQ', 'DNP', 'EX'])

const ROW = 16
const TOP = 26
const BOTTOM = 38
const LEFT = 34
const GAP = 8
// An average character of the axis face at its size, for laying out a label
// column without a DOM to measure it in. Generous rather than tight: a label
// set too narrow runs off the figure, one set too wide costs a few pixels of
// plot.
const CHAR = 6.4

const round = (value) => Math.round(value * 10) / 10

/** Whether an entry has a line: it started, from a slot or the pit lane, and its laps are recorded. */
export const drawnOf = (entry) =>
  (!missing(entry.grid) || entry.grid_text === 'PL') &&
  !missing(entry.laps_completed) &&
  !NOT_STARTED.has(entry.position_text)

/** Entries that raced and cannot be placed: no slot or no lap count. */
export const undrawnOf = (entries) => entries.filter((e) => !NOT_STARTED.has(e.position_text) && !drawnOf(e))

const startKey = (entry) => (missing(entry.grid) ? Number.MAX_SAFE_INTEGER : entry.grid)

/**
 * The cars drawn, in the order they ended, each with the slot it started
 * from and the one it ended in. Ties at the start - a shared car's slot -
 * keep the order of the end, so two lines of one car do not cross each
 * other for nothing.
 */
export function gridFlagRows(entries) {
  const drawn = entries.filter(drawnOf)
  const ended = [...drawn].sort((a, b) => classificationOrder(a) - classificationOrder(b))
  const started = [...ended].sort((a, b) => startKey(a) - startKey(b))
  const start = new Map(started.map((entry, i) => [entry, i]))
  return ended.map((entry, i) => ({ entry, start: start.get(entry), end: i, out: missing(entry.finish_position) }))
}

/** Whether a race has a figure to draw: two cars, and a lap between them. */
export const gridFlagShown = (rows) => rows.length >= 2 && Math.max(...rows.map((r) => r.entry.laps_completed)) > 0

const gridText = (entry) => text(entry.grid_text ?? entry.grid)

/**
 * The figure at `width`, or null where there is nothing to draw.
 *
 * Names are the drivers' own where the label column can carry them in
 * two-fifths of the width, and their three-letter abbreviations where it
 * cannot - except an abbreviation two drivers in the race share, which would
 * name neither, and keeps the full name.
 */
export function gridFlagLayout(entries, width = GRID_FLAG_WIDTH) {
  const rows = gridFlagRows(entries)
  if (!gridFlagShown(rows)) return null
  const laps = Math.max(...rows.map((r) => r.entry.laps_completed))

  const full = (entry) => text(entry.driver ?? entry.driver_id)
  const codes = new Map()
  for (const { entry } of rows) if (entry.abbreviation) codes.set(entry.abbreviation, (codes.get(entry.abbreviation) ?? 0) + 1)
  const short = (entry) => (entry.abbreviation && codes.get(entry.abbreviation) === 1 ? entry.abbreviation : full(entry))
  const resultChars = Math.max(...rows.map((r) => result(r.entry).length))
  const column = (names) => (resultChars + 1 + Math.max(...names.map((n) => n.length))) * CHAR
  let names = rows.map((r) => full(r.entry))
  if (column(names) > width * 0.4) names = rows.map((r) => short(r.entry))

  const right = Math.min(width * 0.55, GAP + column(names))
  const x = linear([0, laps], [LEFT, width - right])
  const y = (slot) => TOP + slot * ROW + ROW / 2
  const height = TOP + rows.length * ROW + BOTTOM
  const plotBottom = TOP + rows.length * ROW
  const labelX = x(laps) + GAP
  const nameX = labelX + (resultChars + 1) * CHAR

  return {
    width,
    height,
    laps,
    start: round(x(0)),
    finish: round(x(laps)),
    top: TOP,
    bottom: plotBottom,
    gridX: LEFT - GAP,
    labelX: round(labelX),
    nameX: round(nameX),
    headY: TOP - 10,
    ticks: ticks([0, laps], Math.max(2, Math.floor((x(laps) - x(0)) / 70)), { integer: true }).map((value) => ({
      value,
      x: round(x(value)),
    })),
    tickY: plotBottom + 14,
    axisY: plotBottom + 30,
    cars: rows.map((r, i) => {
      const end = x(r.entry.laps_completed)
      return {
        key: r.entry.id ?? r.entry.driver_id,
        out: r.out,
        x1: round(x(0)),
        y1: round(y(r.start)),
        x2: round(end),
        y2: round(y(r.end)),
        // A dotted rule from a line that stops short of the flag - a
        // retirement, or a finisher laps down - to its label, so the eye
        // can carry the row across the gap.
        leader: end + 5 < labelX - 3 ? { from: round(end + 5), to: round(labelX - 3) } : null,
        grid: gridText(r.entry),
        result: result(r.entry),
        name: names[i],
      }
    }),
  }
}

/** The cross a car that was not classified ends on, as path data. */
export const crossPath = (x, y, size = 3) =>
  `M${round(x - size)} ${round(y - size)}L${round(x + size)} ${round(y + size)}M${round(x + size)} ${round(y - size)}L${round(x - size)} ${round(y + size)}`
