/**
 * The column chart's geometry (VD-73): the axis and every column, as plain
 * numbers and strings, so that both renderers draw the one picture -
 * charts/ColumnChart.jsx in the app, and scripts/prerender.js on the static
 * page, which has no React to run. Why the columns are capped and rounded
 * as they are is ColumnChart.jsx's to say; this is only where things go.
 */
import { band, linear, niceDomain, ticks } from './scales.js'

export const COLUMN_MARGIN = { top: 16, right: 10, bottom: 30, left: 44 }
export const MAX_THICKNESS = 24

/**
 * `data` as ColumnChart takes it: `{ key, value, label }` per column. Null
 * where there is nothing to draw. Each column carries its hit target (the
 * full step), its rounded-top path, whether its value is printed over it
 * (the peak, where the column is tall enough to hold the number), and
 * whether its axis label is drawn (every `labelEvery`th).
 */
export function columnLayout({
  data,
  width,
  height = 230,
  format = (v) => v.toLocaleString('en-GB'),
  labelEvery = 1,
  labelPeak = true,
  integer = false,
}) {
  if (data.length === 0) return null
  const M = COLUMN_MARGIN
  const keys = data.map((d) => d.key)
  const x = band(keys, [M.left, width - M.right], 0.28)
  const y = linear(niceDomain(data.map((d) => d.value)), [height - M.bottom, M.top])
  const thickness = Math.min(x.bandwidth, MAX_THICKNESS)
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0])
  const radius = Math.min(4, thickness / 2)
  const columns = data.map((d, i) => {
    const centre = x.centre(d.key)
    const left = centre - thickness / 2
    const top = y(Math.max(0, d.value))
    const bottom = y(0)
    const tall = Math.abs(bottom - top)
    return {
      d,
      centre,
      top,
      hit: { x: centre - x.step / 2, y: M.top, width: x.step, height: height - M.bottom - M.top },
      path: `M${left},${bottom} L${left},${top + radius} Q${left},${top} ${left + radius},${top}
                    L${left + thickness - radius},${top} Q${left + thickness},${top} ${left + thickness},${top + radius}
                    L${left + thickness},${bottom} Z`,
      value: labelPeak && d.key === peak.key && tall > 14 ? format(d.value) : null,
      label: i % labelEvery === 0 ? (d.label ?? d.key) : null,
    }
  })
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
  }
}
