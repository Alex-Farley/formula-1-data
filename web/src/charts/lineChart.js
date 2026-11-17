/**
 * The line chart's geometry (VD-73): the axes, each series' path and end
 * point, each end's label in the gutter, and the annotation's markers and
 * bands (VD-121), as plain numbers and strings, so that both renderers draw
 * the one picture - charts/LineChart.jsx in the app, and
 * scripts/prerender.js on the static page, which has no React to run. What
 * the chart is for is LineChart.jsx's to say; this is only where things go.
 */
import { LEADER, STACKED_GAP, STACK_HALF, gutterWidth, labelReach, leaderPoints, nudge, placeMarker, stackLabels } from './annotate.js'
import { linear, niceDomain, ticks } from './scales.js'

export const LINE_MARGIN = { top: 14, right: 12, bottom: 26, left: 44 }
/** The top margin of a chart with markers: room for a disc above its highest point. */
export const MARKED_TOP = 28

/**
 * `series` as LineChart takes it, each with an optional `label`, the short
 * name its end is labelled with. Null where no series has a point. Each
 * series keeps its index, which is its slot in the palette and its dash.
 *
 * `xMax` runs the x axis on past the last point - a season's calendar past
 * the rounds run - so the lines stop where the season has got to. `marks`
 * are the annotation's markers, each `{ n, series, x }`: the number in its
 * disc, the index of the series it marks and the x of the point. `bands`
 * are `{ from, to }` spans of x, shaded under the lines.
 */
export function lineLayout({
  series,
  width,
  height = 240,
  format = (v) => v.toLocaleString('en-GB'),
  formatX = (v) => String(v),
  zero = true,
  xMax = null,
  marks = [],
  bands = [],
}) {
  const all = series.flatMap((s) => s.points)
  if (all.length === 0) return null
  const sorted = series.map((s) => [...s.points].sort((a, b) => a.x - b.x))

  /*
   * Every line's end is labelled, in a gutter at the plot's right: its
   * name and its value, or the value alone where one series is the whole
   * chart. Lines converge at the right-hand edge far more often than they
   * separate - a one-point championship is the whole reason to draw one of
   * these - so labels that would collide are pushed apart rather than
   * dropped, and a hairline that bends where one moved keeps each with its
   * line (VD-121; Lauda's 68 in 1976 and Russell's 262 in 2026 were dropped
   * before it). The gutter is as wide as the widest label; where that
   * would take more than GUTTER_SHARE of the chart - a phone - each named
   * label is set on two lines, the name over the value, pushed apart
   * STACKED_GAP rather than LABEL_GAP.
   */
  const words = sorted.map((points, i) => {
    const last = points[points.length - 1]
    return last ? { name: series.length > 1 ? (series[i].label ?? series[i].name) : null, value: format(last.y) } : null
  })
  const stacked = stackLabels(words.filter(Boolean), width)
  const M = {
    ...LINE_MARGIN,
    top: marks.length ? MARKED_TOP : LINE_MARGIN.top,
    right: Math.max(LINE_MARGIN.right, gutterWidth(words.filter(Boolean), { stacked })),
  }
  const xs = all.map((p) => p.x)
  const x = linear([Math.min(...xs), Math.max(...xs, xMax ?? -Infinity)], [M.left, width - M.right])
  const y = linear(niceDomain(all.map((p) => p.y), { zero }), [height - M.bottom, M.top])

  const right = width - M.right
  const labelX = right + LEADER
  const ends = sorted.map((points) => points[points.length - 1] ?? null)
  const endY = ends.map((last) => (last ? y(last.y) : null))
  const drawn = endY.flatMap((value, i) => (value === null ? [] : [i]))
  // Every label's box inside the drawing.
  const edge = labelReach(stacked)
  const placed = nudge(
    drawn.map((i) => endY[i]),
    stacked ? { gap: STACKED_GAP, min: edge, max: height - edge } : { min: edge, max: height - edge },
  )
  const labelY = new Map(drawn.map((i, k) => [i, placed[k]]))

  // The y of each line at one x, for where a marker may sit clear of them.
  const yAt = (i, value) => {
    const point = sorted[i].find((p) => p.x === value)
    return point ? y(point.y) : null
  }
  const markers = []
  for (const mark of marks) {
    const at = yAt(mark.series, mark.x)
    if (at === null) continue
    const others = sorted.flatMap((_, j) => (j === mark.series || yAt(j, mark.x) === null ? [] : [yAt(j, mark.x)]))
    markers.push({ n: mark.n, ...placeMarker(x(mark.x), at, others, { top: 0, bottom: height - M.bottom, taken: markers }) })
  }
  const [x0, x1] = x.domain
  const shaded = bands
    .map((b) => ({ from: Math.max(b.from, x0), to: Math.min(b.to, x1) }))
    .filter((b) => b.to > b.from)
    .map((b) => ({ x: x(b.from), width: x(b.to) - x(b.from), y: M.top, height: height - M.bottom - M.top }))

  return {
    width,
    height,
    x,
    y,
    left: M.left,
    right,
    top: M.top,
    bottom: height - M.bottom,
    labelX: M.left - 8,
    tickY: height - M.bottom + 15,
    yTicks: ticks(y.domain, 4).map((value) => ({ value, y: y(value), text: format(value) })),
    xTicks: ticks(x.domain, Math.max(2, Math.floor(width / 110)), { integer: true }).map((value) => ({
      value,
      x: x(value),
      text: formatX(value),
    })),
    // One x per column of the crosshair. Series may not share every x - a
    // constructor that entered half a season has half the rounds - so the
    // union is what the pointer snaps to.
    columns: [...new Set(all.map((p) => p.x))].sort((a, b) => a - b),
    lines: series.map((s, i) => {
      const points = sorted[i]
      const last = ends[i]
      const end = last ? { x: x(last.x), y: endY[i] } : null
      return {
        s,
        i,
        points,
        path: points.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' '),
        end: end && {
          ...end,
          label: {
            x: labelX,
            y: labelY.get(i),
            name: words[i].name,
            value: words[i].value,
            // Set on two lines where `stacked`: the name over the value,
            // each line's centre STACK_HALF from the label's.
            stacked: stacked && words[i].name !== null,
            nameY: labelY.get(i) - STACK_HALF,
            valueY: labelY.get(i) + STACK_HALF,
            leader: leaderPoints(end.x, end.y, labelX, labelY.get(i)),
          },
        },
      }
    }),
    markers,
    bands: shaded,
  }
}
