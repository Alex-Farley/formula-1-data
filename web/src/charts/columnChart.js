/**
 * The column chart's geometry (VD-73): the axis and every column, as plain
 * numbers and strings, so that both renderers draw the one picture -
 * charts/ColumnChart.jsx in the app, and scripts/prerender.js on the static
 * page, which has no React to run. Why the columns are capped and rounded
 * as they are is ColumnChart.jsx's to say; this is only where things go.
 */
import { MARKER, placeColumnMarkers } from './annotate.js'
import { band, linear, niceDomain, ticks } from './scales.js'

export const COLUMN_MARGIN = { top: 16, right: 10, bottom: 30, left: 44 }
export const MAX_THICKNESS = 24
/** The top margin of a chart with markers: room for a disc over its tallest column (lineChart.js's MARKED_TOP). */
export const MARKED_TOP = 28
/**
 * The room a row of squares under the baseline takes (VD-125): a
 * constructor's titles, each a square under its season's column, between
 * the baseline and the axis's labels, which stay where they were.
 */
export const SQUARE_ROOM = 10
/** A title's square: as wide as its column, to this. */
export const SQUARE = 5
/** The distance round-year labels are spaced for, centre to centre, in px (`roundLabels`). */
export const LABEL_SPACING = 60
/** The least distance between two labels' centres that keeps a four-digit year clear of the next, in px. */
export const LABEL_CLEAR = 40
/** The steps round-year labels are tried at, smallest first. */
const ROUND_STEPS = [1, 2, 5, 10, 25, 50]

/**
 * `data` as ColumnChart takes it: `{ key, value, label }` per column, and
 * optionally `print`, `mark`, `hollow`, `ahead` and `square` (VD-94, VD-123,
 * VD-125; ColumnChart says what each draws). Null where there is nothing to
 * draw.
 * Each column carries its hit target (the full step), its rounded-top path,
 * the dashed stroke over it where it has `ahead`, whether its value is
 * printed over it, and whether its axis label is drawn (every `labelEvery`th).
 *
 * The annotation pattern (VD-123; charts/annotate.js): `bands` are
 * `{ from, to }` spans of keys, shaded the full height of the plot from the
 * first one's step to the last one's; `marks` are `{ n, keys, leader }`, a
 * numbered disc over the middle of the columns `keys` names - one, or a run
 * of tied ones, which share it - over the tallest of them, on a hairline
 * unless `leader` is false. The discs are placed by placeColumnMarkers() in
 * charts/annotate.js, in `marks`' order, and the plot is lowered until every
 * disc is inside the drawing, so a chart with marks is never clipped. A mark
 * with `lift` (VD-125: a constructor's drought, columns of nothing) has its
 * disc start halfway up the plot rather than just over its point, in the
 * empty band, on a hairline down to the baseline. Two marks may share a
 * number: one note pointing at two places (tied peaks decades apart).
 *
 * A column of zero is drawn as a dashed stub on the baseline in its colour
 * (VD-125): a season entered and not won, which an empty slot would leave
 * looking like a season not on the axis. A datum with `square` has a square
 * under the baseline, ink, its column's width to SQUARE: a constructors'
 * title, a second cue that is shape rather than colour.
 *
 * `roundLabels` labels the axis at round keys (years) - every 1, 2, 5, 10,
 * 25 or 50, the smallest step that leaves LABEL_SPACING between labels at
 * this width - in place of every `labelEvery`th, as the approved mockup
 * labels the decades at 1440 and every quarter-century on a phone; and the
 * first key too, so the axis says where it starts. Left to right, a label
 * nearer than LABEL_CLEAR to the last one kept is left out: an axis of the
 * seasons entered puts 1955 and 2010 side by side for a team absent
 * between. Where fewer than two keys after the first are round,
 * `labelEvery` stands.
 *
 * The value printed is the peak's, where the column is tall enough to hold
 * the number, and every peak's where several tie (VD-125: a tie printed on
 * its first column reads as one record) - unless any datum carries `print`,
 * when it is those columns' instead: the figures the page's note states, put
 * where the reader is looking (VD-94), rather than a peak the note does not
 * mention.
 */
export function columnLayout({
  data,
  width,
  height = 230,
  format = (v) => v.toLocaleString('en-GB'),
  labelEvery = 1,
  labelPeak = true,
  integer = false,
  marks = [],
  bands = [],
  roundLabels = false,
}) {
  if (data.length === 0) return null
  // The disc's reach above its centre; a disc is inside the drawing when its
  // ring clears the top edge. Three passes settle it: the headroom a disc
  // needs barely moves as the plot is lowered for it.
  const reach = MARKER.r + MARKER.ring / 2
  let top = marks.length ? MARKED_TOP : COLUMN_MARGIN.top
  let laid = null
  for (let pass = 0; pass < 3; pass += 1) {
    laid = layColumns({ data, width, height, format, labelEvery, labelPeak, integer, marks, bands, roundLabels, top })
    const highest = Math.min(...laid.markers.map((m) => m.cy - reach), Infinity)
    if (highest >= 0) break
    top += Math.ceil(-highest)
  }
  return laid
}

function layColumns({ data, width, height, format, labelEvery, labelPeak, integer, marks, bands, roundLabels, top: marginTop }) {
  const squared = data.some((d) => d.square)
  const M = { ...COLUMN_MARGIN, top: marginTop, bottom: COLUMN_MARGIN.bottom + (squared ? SQUARE_ROOM : 0) }
  const keys = data.map((d) => d.key)
  const x = band(keys, [M.left, width - M.right], 0.28)
  // Round keys, where asked for and where at least two of them are on the
  // axis; otherwise every labelEvery-th.
  const step = roundLabels ? (ROUND_STEPS.find((k) => k * x.step >= LABEL_SPACING) ?? ROUND_STEPS[ROUND_STEPS.length - 1]) : null
  const round = step !== null && keys.slice(1).filter((k) => Number(k) % step === 0).length >= 2
  const shown = new Set()
  if (round) {
    let last = -Infinity
    keys.forEach((k, i) => {
      if ((i === 0 || Number(k) % step === 0) && x.centre(k) - last >= LABEL_CLEAR) {
        shown.add(i)
        last = x.centre(k)
      }
    })
  }
  const labelled = (d, i) => (round ? shown.has(i) : i % labelEvery === 0)
  // A column's full height is its value and what is still ahead of it.
  const y = linear(niceDomain(data.map((d) => d.value + (d.ahead ?? 0))), [height - M.bottom, M.top])
  const thickness = Math.min(x.bandwidth, MAX_THICKNESS)
  const peak = Math.max(...data.map((d) => d.value))
  const printed = data.some((d) => d.print)
  const prints = (d) => (printed ? Boolean(d.print) : labelPeak && d.value === peak)
  const radius = Math.min(4, thickness / 2)
  const columns = data.map((d, i) => {
    const centre = x.centre(d.key)
    const left = centre - thickness / 2
    const top = y(Math.max(0, d.value))
    const bottom = y(0)
    const tall = Math.abs(bottom - top)
    // Still to come (VD-123): the rounds of a season not yet run, dashed
    // over the solid column the column's width, from the calendar's top down
    // to a pixel and a half above the rounds run, whose column loses its
    // rounded top under it. A stroke the column's width, not an outline:
    // an outline on a phone's 2.3 px column is all stroke, and reads as solid.
    const ahead = d.ahead > 0 ? y(d.value + d.ahead) : null
    // Nothing, and nothing to come: a stub on the baseline, not a column.
    const zero = d.value === 0 && ahead === null
    const side = Math.min(thickness, SQUARE)
    return {
      d,
      centre,
      top,
      // The column's top, what is ahead of it included: where a marker over
      // it stands.
      peak: ahead ?? top,
      ahead: ahead === null ? null : { x: centre, y1: ahead, y2: top - 1.5, width: thickness },
      hit: { x: centre - x.step / 2, y: M.top, width: x.step, height: height - M.bottom - M.top },
      zero: zero ? { x1: left, x2: left + thickness, y: bottom - 1 } : null,
      square: d.square ? { x: centre - side / 2, y: bottom + 4, size: side } : null,
      path: zero
        ? null
        : ahead === null
          ? `M${left},${bottom} L${left},${top + radius} Q${left},${top} ${left + radius},${top}
                    L${left + thickness - radius},${top} Q${left + thickness},${top} ${left + thickness},${top + radius}
                    L${left + thickness},${bottom} Z`
          : `M${left},${bottom} L${left},${top} L${left + thickness},${top} L${left + thickness},${bottom} Z`,
      value: prints(d) && tall > 14 ? format(d.value) : null,
      label: labelled(d, i) ? (d.label ?? d.key) : null,
    }
  })
  const byKey = new Map(columns.map((c) => [c.d.key, c]))
  const shaded = bands
    .map((b) => [byKey.get(b.from), byKey.get(b.to)])
    .filter(([a, b]) => a && b)
    .map(([a, b]) => ({ x: a.hit.x, width: b.hit.x + b.hit.width - a.hit.x, y: M.top, height: height - M.bottom - M.top }))
  const points = marks.flatMap((mark) => {
    const over = mark.keys.map((k) => byKey.get(k)).filter(Boolean)
    if (over.length === 0) return []
    const centres = over.map((c) => c.centre)
    const middle = (M.top + height - M.bottom) / 2
    return [
      {
        n: mark.n,
        x: (Math.min(...centres) + Math.max(...centres)) / 2,
        y: Math.min(...over.map((c) => c.peak)),
        leader: mark.leader !== false,
        lift: mark.lift ? middle : null,
      },
    ]
  })
  // The highest column top a disc centred at cx would reach over.
  const reach = MARKER.r + MARKER.ring / 2
  const floor = (cx) =>
    Math.min(...columns.filter((c) => Math.abs(c.centre - cx) <= reach + thickness / 2).map((c) => c.peak), Infinity)
  const markers = placeColumnMarkers(points, { left: 0, right: width, floor })
  return {
    width,
    height,
    x,
    y,
    left: M.left,
    right: width - M.right,
    labelX: M.left - 8,
    // Where the labels stood before any squares: the squares take the room
    // between them and the baseline, which rises to make it.
    tickY: height - COLUMN_MARGIN.bottom + 15,
    yTicks: ticks(y.domain, 4, { integer }).map((value) => ({ value, y: y(value), text: format(value) })),
    columns,
    bands: shaded,
    markers,
  }
}
