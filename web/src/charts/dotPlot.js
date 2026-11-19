/**
 * The dot plot's geometry (VD-73): the axes and where each point sits, as
 * plain numbers and strings, so that both renderers draw the one picture -
 * charts/DotPlot.jsx in the app, and scripts/prerender.js on the static
 * page, which has no React to run. What the plot means, and how a reader
 * moves through it, is DotPlot.jsx's to say; this is only where things go.
 */
import { linear, ticks } from './scales.js'
import { placeDotMarkers } from './annotate.js'
import { textWidth } from './gridFlag.js'

export const DOT_MARGIN = { top: 16, right: 14, bottom: 30, left: 40 }

const finite = (d) => typeof d.y === 'number' && Number.isFinite(d.y)

/** A dot's radius at rest, and a ringed one's out to the ring's edge (DotPlot.jsx). */
export const DOT_R = 4.5
export const RING_R = 9.5
/** The least room between two axis labels, in px. */
const LABEL_AIR = 6

/**
 * The x axis that labels every season (VD-124, after IX-50): every whole x
 * in the domain, in `formatX` where each fits in its step, in `formatShort`
 * where only that fits - '19 on a phone - and where neither does, the round
 * values ticks() picks, with both ends of the domain always labelled and an
 * inner label that would crowd an end dropped, so the axis says where the
 * career starts and ends.
 */
function everyXTicks(x, formatX, formatShort, width) {
  const [a, b] = x.domain
  const values = []
  for (let v = Math.ceil(a); v <= b; v += 1) values.push(v)
  const step = values.length > 1 ? x(values[1]) - x(values[0]) : Infinity
  const fits = (format) => values.every((v) => textWidth(format(v)) + LABEL_AIR <= step)
  const label = (format) => (value) => ({ value, x: x(value), text: format(value) })
  if (fits(formatX)) return values.map(label(formatX))
  if (formatShort && fits(formatShort)) return values.map(label(formatShort))
  const ends = [values[0], values[values.length - 1]]
  const clear = (v) =>
    ends.every((end) => Math.abs(x(v) - x(end)) >= (textWidth(formatX(v)) + textWidth(formatX(end))) / 2 + LABEL_AIR)
  const inner = ticks(x.domain, Math.max(2, Math.floor(width / 90)), { integer: true }).filter((v) => v > ends[0] && v < ends[1] && clear(v))
  return [...new Set([ends[0], ...inner, ends[1]])].map(label(formatX))
}

/**
 * The line through a career's dots (VD-124): a stretch joins two dots next
 * to each other in `data` and one x apart, so a season with no dot - not in
 * the final standings, or not raced - breaks it rather than being bridged.
 */
function lineStretches(data, x, y) {
  const out = []
  for (let i = 1; i < data.length; i += 1) {
    const a = data[i - 1]
    const b = data[i]
    if (finite(a) && finite(b) && b.x - a.x === 1) out.push({ x1: x(a.x), y1: y(a.y), x2: x(b.x), y2: y(b.y) })
  }
  return out
}

/**
 * The one colour the line takes: the pair every plotted dot shares, or
 * null - ink - where they differ, are hollow or are uncoloured, since a line
 * through two teams' seasons belongs to neither.
 */
export function lineColour(points) {
  const first = points[0]?.colour
  if (!first || points.some((d) => d.hollow || !d.colour || d.colour.light !== first.light || d.colour.dark !== first.dark)) return null
  return first
}

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
 *
 * A career's chart (VD-124) asks for more: `line` joins the dots season to
 * season (lineStretches()), `yTickValues` names the gridlines, `everyX`
 * labels every season (everyXTicks(), `formatXShort` where the full form
 * does not fit), and `marks`, each { n, x }, are the annotation pattern's
 * numbered markers at the dots of those x, placed by placeDotMarkers().
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
  line = false,
  yTickValues = null,
  formatXShort = null,
  everyX = false,
  marks = [],
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
  // A caller may name the gridlines instead: a career's are P1, P5 and P10,
  // and the tens past them (VD-124).
  const yTicks = [...new Set(yTickValues ?? [1, ...ticks([1, top], 4, { integer: true }).filter((v) => v > 2), top])]
    .filter((v) => v >= 1 && v <= top)
    .map((value) => ({ value, y: y(value), text: format(value) }))
  const xTicks = everyX
    ? everyXTicks(x, formatX, formatXShort, width)
    : ticks(x.domain, Math.max(2, Math.floor(width / 90)), { integer: true }).map((value) => ({
        value,
        x: x(value),
        text: formatX(value),
      }))
  const segments = line ? lineStretches(data, x, y) : []
  const tickY = height - M.bottom + 15
  const dots = plotted.map((d) => ({ x: x(d.x), y: y(d.y), r: d.mark ? RING_R : DOT_R }))
  // Each marker at the dot of its x; a mark whose x has no dot has nothing to point to.
  const markers = placeDotMarkers(
    marks.flatMap((m) => {
      const d = plotted.find((p) => p.x === m.x)
      return d ? [{ n: m.n, x: x(d.x), y: y(d.y), r: d.mark ? RING_R : DOT_R }] : []
    }),
    // Above the axis labels: their cap height under tickY's baseline; and
    // clear of the gridlines' labels, right-aligned at labelX, about the
    // axis face's 11 px tall.
    {
      dots,
      segments,
      boxes: yTicks.map((t) => ({ left: M.left - 8 - textWidth(t.text), right: M.left - 8, top: t.y - 6, bottom: t.y + 6 })),
      top: 0,
      bottom: tickY - 10,
    },
  )
  return {
    width,
    height,
    x,
    y,
    left: M.left,
    right: width - M.right,
    labelX: M.left - 8,
    tickY,
    yTicks,
    xTicks,
    points: plotted.map((d) => ({ d, cx: x(d.x), cy: y(d.y) })),
    segments,
    // One path for the whole line, a move at every break.
    linePath: segments
      .map((s, i) => `${i > 0 && segments[i - 1].x2 === s.x1 && segments[i - 1].y2 === s.y1 ? '' : `M${s.x1},${s.y1}`}L${s.x2},${s.y2}`)
      .join(''),
    lineColour: line ? lineColour(plotted) : null,
    markers,
  }
}
