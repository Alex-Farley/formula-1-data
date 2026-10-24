/**
 * The dot plot's geometry (VD-73): the axes and where each point sits, as
 * plain numbers and strings, so that both renderers draw the one picture -
 * charts/DotPlot.jsx in the app, and scripts/prerender.js on the static
 * page, which has no React to run. What the plot means, and how a reader
 * moves through it, is DotPlot.jsx's to say; this is only where things go.
 */
import { linear, ticks } from './scales.js'

export const DOT_MARGIN = { top: 16, right: 14, bottom: 30, left: 40 }

const finite = (d) => typeof d.y === 'number' && Number.isFinite(d.y)

/**
 * `data` as DotPlot takes it. Null where no point has a value, which is a
 * plot with nothing to draw. `points` are the plotted ones, in data order,
 * each with the datum it came from.
 *
 * `xDomain`, where given, is the span the axis must cover whatever the data
 * reaches: a driver's championship chart runs the length of the career the
 * tile above it states, not from the first season with a standings row to
 * the last (IX-38). The axis is the wider of the two, so a datum outside the
 * span is never pushed off the plot.
 */
export function dotPlotLayout({
  data,
  width,
  height = 220,
  yMax,
  invert = true,
  format = (v) => String(v),
  formatX = (v) => String(v),
  xDomain = null,
}) {
  const M = DOT_MARGIN
  const plotted = data.filter(finite)
  if (plotted.length === 0) return null
  const xs = [...data.map((d) => d.x), ...(xDomain ?? [])]
  const top = yMax ?? Math.max(...plotted.map((d) => d.y))
  const x = linear([Math.min(...xs), Math.max(...xs)], [M.left, width - M.right])
  const y = invert ? linear([1, top], [M.top, height - M.bottom]) : linear([0, top], [height - M.bottom, M.top])
  // P1 is the one value this chart exists to show, and a step of 2 from 1
  // ticked 2, 4, 6... so the title-winning seasons sat above the top
  // gridline with nothing naming their value. Force 1 in, and drop a 2 that
  // would crowd it.
  const yTicks = [...new Set([1, ...ticks([1, top], 4, { integer: true }).filter((v) => v > 2), top])]
    .filter((v) => v >= 1 && v <= top)
    .map((value) => ({ value, y: y(value), text: format(value) }))
  const xTicks = ticks(x.domain, Math.max(2, Math.floor(width / 90)), { integer: true }).map((value) => ({
    value,
    x: x(value),
    text: formatX(value),
  }))
  return {
    width,
    height,
    x,
    y,
    left: M.left,
    right: width - M.right,
    labelX: M.left - 8,
    tickY: height - M.bottom + 15,
    yTicks,
    xTicks,
    points: plotted.map((d) => ({ d, cx: x(d.x), cy: y(d.y) })),
  }
}
