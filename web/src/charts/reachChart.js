/**
 * The reach chart's geometry (AF-132): every bar, its extension and the
 * leader's line, as plain numbers and strings, so that both renderers draw
 * the one picture - charts/ReachChart.jsx in the app, and
 * scripts/prerender.js on the static page.
 *
 * A row is a contender: a solid bar from nought to the points they have, an
 * outlined extension from there to the most they could still reach, and
 * beside it the two figures, "340 → 490". The vertical line is the leader's
 * total, named at its head. A bar whose extension stops short of the line is
 * out, and its figures say so in words as well, so the line is never the only
 * thing that says who is out.
 */
import { linear, niceDomain } from './scales.js'
import { points } from '../lib/format.js'

export const REACH_ROW = 30
export const REACH_THICKNESS = 14
export const REACH_TOP = 24
const VALUE_ROOM = 104
const RADIUS = 3
/** The name column beside the bars, as BarChart's. */
export const REACH_LABEL_WIDTH = 168
/**
 * Below this the names go above their bars rather than beside them: a
 * column wide enough for "Andrea Kimi Antonelli" would leave a phone, or one
 * half of `.split` at 768, too little bar to read along.
 */
export const REACH_STACK_BELOW = 480
/** A row's height where its name sits above the bar. */
export const REACH_STACKED_ROW = 42

/** "340 → 490", and ", out" where the most they can reach is short of the leader. */
export const reachText = (d) => `${points(d.points)} → ${points(d.reach)}${d.alive ? '' : ', out'}`

/**
 * `data` as reachFigure() in queries/season.js gives it, `lead` the leader's
 * total. Null where there is nothing to draw.
 *
 * From REACH_STACK_BELOW the names sit in a column of their own beside the
 * bars, end-aligned, as BarChart's do. Narrower, each name sits above its
 * bar from the plot's left edge, so no name is cut at the edge however long
 * it is, and the leader's line is drawn beside the bars only, in one piece
 * per row, so it never runs through a name.
 */
export function reachLayout({ data, lead, width }) {
  if (!data || data.length === 0) return null
  const stacked = width < REACH_STACK_BELOW
  const labelWidth = stacked ? 0 : REACH_LABEL_WIDTH
  const row = stacked ? REACH_STACKED_ROW : REACH_ROW
  // Where a row's bar starts below the row's top: under the name, or centred.
  const barOffset = stacked ? row - REACH_THICKNESS - 6 : (row - REACH_THICKNESS) / 2
  const height = REACH_TOP + data.length * row + 4
  const x = linear(niceDomain([lead, ...data.map((d) => d.reach)]), [labelWidth, Math.max(labelWidth + 40, width - VALUE_ROOM)])
  const zero = x(0)
  const bars = data.map((d, i) => {
    const rowTop = REACH_TOP + i * row
    const top = rowTop + barOffset
    const end = Math.max(x(d.points), zero)
    const reach = Math.max(x(d.reach), end)
    const r = Math.min(RADIUS, Math.max(0, reach - zero) / 2)
    return {
      d,
      y: top,
      middle: top + REACH_THICKNESS / 2,
      // The name: end-aligned in its column, or from the left edge above the bar.
      labelX: stacked ? 0 : labelWidth - 10,
      labelY: stacked ? top - 10 : top + REACH_THICKNESS / 2,
      labelAnchor: stacked ? 'start' : 'end',
      // The solid part: square at nought, square where the extension takes over.
      solid: end > zero ? `M${zero},${top} H${end} V${top + REACH_THICKNESS} H${zero} Z` : null,
      // The extension, rounded at its far end as a bar is.
      extension:
        reach > end
          ? `M${end},${top} H${reach - r} Q${reach},${top} ${reach},${top + r} V${top + REACH_THICKNESS - r} Q${reach},${top + REACH_THICKNESS} ${reach - r},${top + REACH_THICKNESS} H${end} Z`
          : null,
      valueX: reach + 8,
      value: reachText(d),
    }
  })
  const leadX = x(lead)
  const leadText = `Leader ${points(lead)}`
  // The line: one piece from its name to the foot, or, stacked, one piece
  // per row beside its bar, clear of the names above.
  const segments = stacked
    ? bars.map((bar) => [bar.y - 1, bar.y + REACH_THICKNESS + 3])
    : [[REACH_TOP - 6, height]]
  return {
    width,
    height,
    bars,
    stacked,
    lead: {
      x: leadX,
      segments,
      text: leadText,
      // Named above its head, kept inside the plot at either end.
      textX: Math.min(Math.max(leadX, labelWidth + 34), width - 34),
      textY: REACH_TOP - 11,
    },
  }
}
