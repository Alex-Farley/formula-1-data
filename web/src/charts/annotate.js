/**
 * The annotation pattern (VD-121; docs/design-system.md section 3, *Figure*,
 * *Annotation*), as plain numbers, so that both renderers draw one picture:
 * the app's chart components, and scripts/prerender.js on the static page.
 *
 * Three parts live here, because each is geometry every annotated chart
 * shares:
 *
 * - line-end labels in a gutter at the plot's right, pushed apart so that
 *   converging lines never hide a value (nudge(), gutterWidth());
 * - numbered markers, a disc in ink with a ring of the panel's colour, set
 *   in the empty space beside the point they mark and joined to it by a
 *   hairline (placeMarker());
 * - spans as shaded bands under the marks, explained in the key.
 *
 * What a note says, and which point it marks, is the caller's: the figure
 * works it out from the data, and the key under the plot carries every word
 * of it, so nothing lives only in the drawing.
 */
import { textWidth } from './gridFlag.js'

/** The least distance between two line-end labels' centres, in px. */
export const LABEL_GAP = 16
/** From a line's end to its label's text: the hairline and the space either side. */
export const LEADER = 14
/** A marker's disc, and the hairline from the point to it. */
export const MARKER = { r: 8, ring: 3, offset: 18, gap: 4 }
/**
 * How much nearer than this another line may come to a marker's centre
 * before the marker moves to the other side of its point.
 */
const CLEAR = MARKER.r + 3

/*
 * textWidth() is measured at the axis face's 11 px; a line-end label is set
 * at --size-3, 12 px, its name semibold. Generous rather than tight, as
 * textWidth is: a gutter set too wide costs a few pixels of plot, one too
 * narrow runs a name off the figure.
 */
const LABEL_SCALE = 1.2
export const labelWidth = (value) => textWidth(value) * LABEL_SCALE

/**
 * The gutter the line-end labels need: the hairline to them, the widest
 * label, and a few pixels before the figure's edge. `labels` are
 * { name, value }, the name null where a chart has one series and its
 * title already names it.
 */
export function gutterWidth(labels) {
  if (labels.length === 0) return 0
  const widest = Math.max(...labels.map((l) => labelWidth(l.name ? `${l.name} ${l.value}` : l.value)))
  return Math.ceil(LEADER + widest + 4)
}

/**
 * Where each label goes, given where each wants to be: the same order top
 * to bottom, no two closer than `gap`, each as near its own line's end as
 * that allows, and the whole stack inside [min, max] where it fits.
 *
 * Labels that would collide are taken as one group, centred on the mean of
 * where they wanted to be and spread `gap` apart, and a group that then
 * reaches the one above is merged with it, so a label moves no further than
 * its neighbours make it. Two lines ending level keep their input order -
 * the caller's, which for a championship is the standing - the first above.
 * Returns the positions in the input's order.
 */
export function nudge(wanted, { gap = LABEL_GAP, min = -Infinity, max = Infinity } = {}) {
  const order = wanted.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i)
  const groups = []
  for (const item of order) {
    groups.push({ items: [item], top: item.y })
    while (groups.length > 1) {
      const below = groups[groups.length - 1]
      const above = groups[groups.length - 2]
      if (above.top + above.items.length * gap <= below.top) break
      const items = [...above.items, ...below.items]
      const mean = items.reduce((sum, it) => sum + it.y, 0) / items.length
      groups.splice(-2, 2, { items, top: mean - ((items.length - 1) * gap) / 2 })
    }
  }
  const placed = groups.flatMap((g) => g.items.map((it, k) => ({ i: it.i, y: g.top + k * gap })))
  // Inside the bounds: down from the top edge, then up from the bottom one.
  for (let k = 0; k < placed.length; k += 1) placed[k].y = Math.max(placed[k].y, k === 0 ? min : placed[k - 1].y + gap)
  for (let k = placed.length - 1; k >= 0; k -= 1)
    placed[k].y = Math.min(placed[k].y, k === placed.length - 1 ? max : placed[k + 1].y - gap)
  const out = new Array(wanted.length)
  for (const p of placed) out[p.i] = p.y
  return out
}

/**
 * The hairline from a line's end at (x, y) to its label at (labelX, labelY):
 * straight where the label stayed level with the end, and where it moved, a
 * short run out of the end, an angle to the label's height and a short run
 * into it. As points, for a <polyline>.
 */
export function leaderPoints(x, y, labelX, labelY) {
  const from = x + MARKER.gap + 1
  const to = labelX - 3
  if (Math.abs(labelY - y) < 0.5) return [[from, y], [to, y]]
  return [
    [from, y],
    [from + 5, y],
    [to - 5, labelY],
    [to, labelY],
  ]
}

/**
 * Where a marker goes for the point (x, y): above it by default, below it
 * where above would leave the drawing or sit on another line, as `others`
 * (the y of every other line at that x) says, and a disc further out where
 * both of those would touch a marker already placed (`taken`, each
 * { cx, cy }) - two notes a round apart on a phone. `top` and `bottom` are
 * the drawing's edges the disc must stay inside. Returns the disc's centre
 * and the hairline from the point to it.
 */
export function placeMarker(x, y, others, { top = 0, bottom = Infinity, taken = [] } = {}) {
  const reach = MARKER.r + MARKER.ring / 2
  const further = MARKER.offset + 2 * reach + 2
  const sides = [y - MARKER.offset, y + MARKER.offset, y - further, y + further].map((cy) => ({
    cy,
    fits: cy - reach >= top && cy + reach <= bottom,
    clear: others.every((o) => Math.abs(o - cy) >= CLEAR),
    apart: taken.every((t) => Math.hypot(t.cx - x, t.cy - cy) >= 2 * reach + 2),
  }))
  const side =
    sides.find((s) => s.fits && s.clear && s.apart) ?? sides.find((s) => s.fits && s.apart) ?? sides.find((s) => s.fits) ?? sides[0]
  const up = side.cy < y
  return {
    cx: x,
    cy: side.cy,
    leader: { x1: x, y1: up ? y - MARKER.gap : y + MARKER.gap, x2: x, y2: up ? side.cy + MARKER.r : side.cy - MARKER.r },
  }
}
