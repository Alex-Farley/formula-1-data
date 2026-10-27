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

/** "340 → 490", and ", out" where the most they can reach is short of the leader. */
export const reachText = (d) => `${points(d.points)} → ${points(d.reach)}${d.alive ? '' : ', out'}`

/**
 * `data` as reachFigure() in queries/season.js gives it, `lead` the leader's
 * total. Null where there is nothing to draw. The label column takes a third
 * of a narrow plot and stops growing at 150 px, so at 320 px a bar still has
 * a third of the width to be read along.
 */
export function reachLayout({ data, lead, width }) {
  if (!data || data.length === 0) return null
  const labelWidth = Math.min(150, Math.round(width * 0.3))
  const height = REACH_TOP + data.length * REACH_ROW + 4
  const x = linear(niceDomain([lead, ...data.map((d) => d.reach)]), [labelWidth, Math.max(labelWidth + 40, width - VALUE_ROOM)])
  const zero = x(0)
  const bars = data.map((d, i) => {
    const top = REACH_TOP + i * REACH_ROW + (REACH_ROW - REACH_THICKNESS) / 2
    const end = Math.max(x(d.points), zero)
    const reach = Math.max(x(d.reach), end)
    const r = Math.min(RADIUS, Math.max(0, reach - zero) / 2)
    return {
      d,
      y: top,
      middle: top + REACH_THICKNESS / 2,
      labelX: labelWidth - 10,
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
  return {
    width,
    height,
    bars,
    lead: {
      x: leadX,
      y1: REACH_TOP - 6,
      y2: height,
      text: leadText,
      // Named above its head, kept inside the plot at either end.
      textX: Math.min(Math.max(leadX, labelWidth + 34), width - 34),
      textY: REACH_TOP - 11,
    },
  }
}
