/**
 * The line chart's geometry (VD-73): the axes, each series' path and end
 * point, and which ends carry a direct label, as plain numbers and strings,
 * so that both renderers draw the one picture - charts/LineChart.jsx in the
 * app, and scripts/prerender.js on the static page, which has no React to
 * run. What the chart is for is LineChart.jsx's to say; this is only where
 * things go.
 */
import { linear, niceDomain, ticks } from './scales.js'

export const LINE_MARGIN = { top: 14, right: 58, bottom: 26, left: 44 }

/**
 * `series` as LineChart takes it. Null where no series has a point. Each
 * series keeps its index, which is its slot in the palette and its dash.
 */
export function lineLayout({
  series,
  width,
  height = 240,
  format = (v) => v.toLocaleString('en-GB'),
  formatX = (v) => String(v),
  zero = true,
}) {
  const M = LINE_MARGIN
  const all = series.flatMap((s) => s.points)
  if (all.length === 0) return null
  const xs = all.map((p) => p.x)
  const x = linear([Math.min(...xs), Math.max(...xs)], [M.left, width - M.right])
  const y = linear(niceDomain(all.map((p) => p.y), { zero }), [height - M.bottom, M.top])

  /*
   * Which endpoints may carry a direct label.
   *
   * Lines converge at the right-hand edge far more often than they separate
   * - a two-point championship is the whole reason to draw one of these -
   * and two labels on top of each other are worse than none. Nudging them
   * apart would detach a number from its line, so a label that would collide
   * is simply dropped: the legend names the series and the crosshair gives
   * every value on demand.
   */
  const labelled = new Set()
  const ends = series
    .map((s, i) => {
      const sorted = [...s.points].sort((a, b) => a.x - b.x)
      const last = sorted[sorted.length - 1]
      return last ? { i, y: y(last.y) } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.y - b.y)
  let previous = -Infinity
  for (const end of ends) {
    if (end.y - previous >= 15) {
      labelled.add(end.i)
      previous = end.y
    }
  }

  return {
    width,
    height,
    x,
    y,
    left: M.left,
    right: width - M.right,
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
      const points = [...s.points].sort((a, b) => a.x - b.x)
      const last = points[points.length - 1]
      return {
        s,
        i,
        points,
        path: points.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' '),
        end: last ? { x: x(last.x), y: y(last.y), text: labelled.has(i) ? format(last.y) : null } : null,
      }
    }),
  }
}
