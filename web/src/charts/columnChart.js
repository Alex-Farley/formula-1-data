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
 * `data` as ColumnChart takes it: `{ key, value, label }` per column, and
 * optionally `print`, `mark`, `hollow` and `ahead` (VD-94, VD-123;
 * ColumnChart says what each draws). Null where there is nothing to draw.
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
 * disc is inside the drawing, so a chart with marks is never clipped.
 *
 * The value printed is the peak's, where the column is tall enough to hold
 * the number - unless any datum carries `print`, when it is those columns'
 * instead: the figures the page's note states, put where the reader is
 * looking (VD-94), rather than a peak the note does not mention.
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
}) {
  if (data.length === 0) return null
  // The disc's reach above its centre; a disc is inside the drawing when its
  // ring clears the top edge. Three passes settle it: the headroom a disc
  // needs barely moves as the plot is lowered for it.
  const reach = MARKER.r + MARKER.ring / 2
  let top = marks.length ? MARKED_TOP : COLUMN_MARGIN.top
  let laid = null
  for (let pass = 0; pass < 3; pass += 1) {
    laid = layColumns({ data, width, height, format, labelEvery, labelPeak, integer, marks, bands, top })
    const highest = Math.min(...laid.markers.map((m) => m.cy - reach), Infinity)
    if (highest >= 0) break
    top += Math.ceil(-highest)
  }
  return laid
}

function layColumns({ data, width, height, format, labelEvery, labelPeak, integer, marks, bands, top: marginTop }) {
  const M = { ...COLUMN_MARGIN, top: marginTop }
  const keys = data.map((d) => d.key)
  const x = band(keys, [M.left, width - M.right], 0.28)
  // A column's full height is its value and what is still ahead of it.
  const y = linear(niceDomain(data.map((d) => d.value + (d.ahead ?? 0))), [height - M.bottom, M.top])
  const thickness = Math.min(x.bandwidth, MAX_THICKNESS)
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0])
  const printed = data.some((d) => d.print)
  const prints = (d) => (printed ? Boolean(d.print) : labelPeak && d.key === peak.key)
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
    return {
      d,
      centre,
      top,
      // The column's top, what is ahead of it included: where a marker over
      // it stands.
      peak: ahead ?? top,
      ahead: ahead === null ? null : { x: centre, y1: ahead, y2: top - 1.5, width: thickness },
      hit: { x: centre - x.step / 2, y: M.top, width: x.step, height: height - M.bottom - M.top },
      path:
        ahead === null
          ? `M${left},${bottom} L${left},${top + radius} Q${left},${top} ${left + radius},${top}
                    L${left + thickness - radius},${top} Q${left + thickness},${top} ${left + thickness},${top + radius}
                    L${left + thickness},${bottom} Z`
          : `M${left},${bottom} L${left},${top} L${left + thickness},${top} L${left + thickness},${bottom} Z`,
      value: prints(d) && tall > 14 ? format(d.value) : null,
      label: i % labelEvery === 0 ? (d.label ?? d.key) : null,
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
    return [{ n: mark.n, x: (Math.min(...centres) + Math.max(...centres)) / 2, y: Math.min(...over.map((c) => c.peak)), leader: mark.leader !== false }]
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
    tickY: height - M.bottom + 15,
    yTicks: ticks(y.domain, 4, { integer }).map((value) => ({ value, y: y(value), text: format(value) })),
    columns,
    bands: shaded,
    markers,
  }
}
