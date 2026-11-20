/**
 * Grid to flag (PD-30): where each car started, and where it ended.
 *
 * The geometry only, as plain numbers and strings, so that both renderers
 * draw the one picture: charts/GridFlag.jsx in the app, and
 * scripts/prerender.js on the static page, which has no React to run and so
 * could draw no chart until the layout was a function of the rows alone.
 *
 * WHAT IT DRAWS
 *     One line per driver who started: from their grid slot on the left, at lap
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
 *
 * WHAT IT PICKS OUT (VD-113)
 *     The race's biggest moves, which queries/race.js's gridFlagStory()
 *     chooses from these same rows and words, are drawn in full ink and
 *     heavier, each with its label on its line, over a field drawn lighter;
 *     the winner keeps the accent. A label goes where it is clear of every
 *     other label and every picked line, inside the plot, or is not drawn:
 *     the line stays heavy and its name semibold, and the drawing's
 *     accessible name says every move whether its label fitted or not.
 */
import { classificationOrder, missing, result, text } from '../lib/format.js'
import { linear, ticks } from './scales.js'

/** The words drawn inside the figure, which both renderers print. */
export const GRID_FLAG_HEADS = { grid: 'Grid', result: 'Result', axis: 'Laps completed' }

/** The width the static page draws at, and the app's before it has measured. */
export const GRID_FLAG_WIDTH = 640

/** The results that mean an entry never took the start; the stint figure (PD-56) reads it too. */
export const NOT_STARTED = new Set(['DNS', 'DNQ', 'DNPQ', 'DNP', 'EX'])

const ROW = 16
const TOP = 26
const BOTTOM = 38
const LEFT = 34
const GAP = 8
// The width of a label without a DOM to measure it in: per character, a
// capital or a figure, and anything else, at the axis face's 11 px. Measured
// in Chromium on the built site (PD-30's review): capitals ran to 8.6 px -
// HAW, a tabular DNF - and mixed-case names to 6.3 px a character on
// average, so these are the widest of each rounded up. Generous rather than
// tight: a label set too narrow runs off the figure, one set too wide costs
// a few pixels of plot. M and W are wider than the rest (DOW ran a pixel past
// 375 px at 8.8 each), so they have their own.
const WIDE = 10.6
const CAPITAL = 8.8
const LOWER = 6.2
// Between a result and its name.
const SPACE = 6
// The most of the width the labels may take, whatever the names: past it a
// name is shortened, with an ellipsis, rather than left to run off the
// figure. The table under the figure carries every name whole.
const MOST = 0.6

export const textWidth = (value) =>
  [...String(value)].reduce((sum, c) => sum + (/[MW]/.test(c) ? WIDE : /[A-Z0-9]/.test(c) ? CAPITAL : LOWER), 0)

/** A name cut to `room`, with an ellipsis, where it would not fit whole. */
const fit = (name, room) => {
  if (textWidth(name) <= room) return name
  let cut = name
  while (cut.length > 1 && textWidth(`${cut}…`) > room) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

const round = (value) => Math.round(value * 10) / 10

// A label on a picked line (VD-113): set in the label register, 12 px
// semibold, which runs wider than the axis face textWidth() measures, so
// that is scaled up - generous, as textWidth is. Its middle sits NOTE_RISE
// off the line, on the side the line leaves clear, NOTE_HALF either side
// of it, and NOTE_PAD keeps two labels from touching.
const NOTE_SCALE = 1.2
const NOTE_RISE = 10
const NOTE_HALF = 7
const NOTE_PAD = 2
// Where along its line a label may stand, as a share of the line's run from
// the start, tried in this order on each side; the first that is clear wins.
const NOTE_AT = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]

/** Whether the segment from (x1, y1) to (x2, y2) passes through the box (Liang-Barsky). */
const crosses = ({ x1, y1, x2, y2 }, box) => {
  const dx = x2 - x1
  const dy = y2 - y1
  let lo = 0
  let hi = 1
  for (const [p, q] of [
    [-dx, x1 - box.left],
    [dx, box.right - x1],
    [-dy, y1 - box.top],
    [dy, box.bottom - y1],
  ]) {
    if (p === 0) {
      if (q < 0) return false
    } else {
      const r = q / p
      if (p < 0) lo = Math.max(lo, r)
      else hi = Math.min(hi, r)
      if (lo > hi) return false
    }
  }
  return true
}

/** How far the point (x, y) is from the segment. */
const distance = ({ x1, y1, x2, y2 }, x, y) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = dx || dy ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

const overlaps = (a, b) =>
  a.left < b.right + NOTE_PAD && b.left < a.right + NOTE_PAD && a.top < b.bottom + NOTE_PAD && b.top < a.bottom + NOTE_PAD

/**
 * Each picked line's label, where one fits: on the side of its line the line
 * itself leaves clear - above and to the left of a point on a climbing line,
 * above and to the right on a falling one, or the opposite corner below -
 * inside the plot, clear of the labels already set and of every marked
 * line, and with the end it is anchored at nearer its own line than any
 * other marked one, so that it cannot be read as another's. In the order
 * given: gridFlagLayout() gives the finding's moves first.
 */
function placeNotes(picked, marked, bounds) {
  const notes = []
  for (const { car, text } of picked) {
    const width = textWidth(text) * NOTE_SCALE
    const climbs = car.y2 <= car.y1
    const sides = climbs
      ? [
          { anchor: 'end', rise: -1, at: NOTE_AT },
          { anchor: 'start', rise: 1, at: [...NOTE_AT].reverse() },
        ]
      : [
          { anchor: 'start', rise: -1, at: [...NOTE_AT].reverse() },
          { anchor: 'end', rise: 1, at: NOTE_AT },
        ]
    let set = null
    for (const side of sides) {
      for (const t of side.at) {
        const x = car.x1 + (car.x2 - car.x1) * t
        const y = car.y1 + (car.y2 - car.y1) * t + side.rise * NOTE_RISE
        const box = {
          left: side.anchor === 'end' ? x - width : x,
          right: side.anchor === 'end' ? x : x + width,
          top: y - NOTE_HALF,
          bottom: y + NOTE_HALF,
        }
        if (box.left < bounds.left || box.right > bounds.right || box.top < bounds.top || box.bottom > bounds.bottom) continue
        if (notes.some((n) => overlaps(n.box, box))) continue
        if (marked.some((line) => crosses(line, box))) continue
        const own = distance(car, x, y)
        if (marked.some((line) => line !== car && distance(line, x, y) <= own)) continue
        set = { key: car.key, x: round(x), y: round(y), anchor: side.anchor, text, box }
        break
      }
      if (set) break
    }
    if (set) notes.push(set)
  }
  return notes.map(({ box, ...note }) => note)
}

/**
 * The name each driver is labelled with inside a figure, given the width of
 * the figure and the width the label column needs besides the name (a
 * result, the gaps). Full names where the column carries them in two-fifths
 * of the width; three-letter abbreviations where it cannot, except one two
 * drivers in the race share, which would name neither and keeps the full
 * name; and any name past MOST of the width cut, with an ellipsis, to fit.
 * Grid to flag labels its right-hand column with it, and the stint figure
 * (PD-56, charts/stints.js) its left-hand one.
 */
export function driverLabels(entries, width, reserved) {
  const full = (entry) => text(entry.driver ?? entry.driver_id)
  const codes = new Map()
  for (const entry of entries) if (entry.abbreviation) codes.set(entry.abbreviation, (codes.get(entry.abbreviation) ?? 0) + 1)
  const short = (entry) => (entry.abbreviation && codes.get(entry.abbreviation) === 1 ? entry.abbreviation : full(entry))
  const column = (names) => reserved + Math.max(...names.map(textWidth))
  let names = entries.map(full)
  if (column(names) > width * 0.4) names = entries.map(short)
  const room = width * MOST - reserved
  return names.map((name) => fit(name, room))
}

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
 * name neither, and keeps the full name. That name is the one that can be too
 * long for a phone (Alessandro Pesenti-Rossi, who shares PES with
 * Pescarolo), so the column stops at MOST of the width and a name past it is
 * shortened to fit: a cut name with an ellipsis says it was cut, where a
 * cropped one does not.
 *
 * `moves` are gridFlagStory()'s (queries/race.js), each an entry with the
 * words for its line: `long` where the column names drivers in full,
 * `short` where it names them by their codes. The cars come field first,
 * in the order they ended, then the marked ones - the winner and the moves -
 * in the same order, so that a marked line is drawn over the field and
 * never under it; `notes` are the labels that fitted.
 */
export function gridFlagLayout(entries, width = GRID_FLAG_WIDTH, moves = []) {
  const rows = gridFlagRows(entries)
  if (!gridFlagShown(rows)) return null
  const laps = Math.max(...rows.map((r) => r.entry.laps_completed))

  const resultWidth = Math.max(...rows.map((r) => textWidth(result(r.entry))))
  const reserved = GAP + resultWidth + SPACE
  const names = driverLabels(
    rows.map((r) => r.entry),
    width,
    reserved,
  )

  const right = reserved + Math.max(...names.map(textWidth))
  const x = linear([0, laps], [LEFT, width - right])
  const y = (slot) => TOP + slot * ROW + ROW / 2
  const height = TOP + rows.length * ROW + BOTTOM
  const plotBottom = TOP + rows.length * ROW
  const labelX = x(laps) + GAP
  const nameX = labelX + resultWidth + SPACE
  const picks = new Map(moves.map((m) => [m.entry, m]))

  const cars = rows.map((r, i) => {
    const end = x(r.entry.laps_completed)
    const move = picks.get(r.entry)
    const coded = r.entry.abbreviation && names[i] === r.entry.abbreviation
    return {
      key: r.entry.id ?? r.entry.driver_id,
      out: r.out,
      // The winner's line wears the accent (VD-94): the race's lede says
      // who won, and this is that line. Every car classified first, so a
      // shared winning drive marks both of its drivers.
      won: r.entry.finish_position === 1,
      // One of the race's biggest moves (VD-113), in full ink.
      strong: Boolean(move),
      note: move ? ((coded && move.short) || move.long) : null,
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
  })
  const marked = cars.filter((car) => car.won || car.strong)
  // The finding's moves are labelled first, so that where there is room for
  // only some labels the line the finding names has one.
  const notes = placeNotes(
    [...moves.filter((m) => m.lead), ...moves.filter((m) => !m.lead)]
      .map((m) => cars[rows.findIndex((r) => r.entry === m.entry)])
      .filter((car) => car?.strong)
      .map((car) => ({ car, text: car.note })),
    marked,
    { left: x(0), right: x(laps), top: TOP, bottom: plotBottom },
  )

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
    cars: [...cars.filter((car) => !car.won && !car.strong), ...marked],
    notes,
  }
}

/**
 * A car's group class, which both renderers write: a car that was not
 * classified is `flag-out`, dashed and ending on a cross, the winner
 * `flag-won`, in the accent, and one of the race's biggest moves
 * `flag-strong`, in full ink (styles/app.css).
 */
export const flagCarClass = (car) =>
  `flag-car${car.out ? ' flag-out' : ''}${car.won ? ' flag-won' : ''}${car.strong ? ' flag-strong' : ''}`

/** The cross a car that was not classified ends on, as path data. */
export const crossPath = (x, y, size = 3) =>
  `M${round(x - size)} ${round(y - size)}L${round(x + size)} ${round(y + size)}M${round(x + size)} ${round(y - size)}L${round(x - size)} ${round(y + size)}`
