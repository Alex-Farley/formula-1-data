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
 * placeMarker() is a line's: above or below a point between other lines.
 * placeAbove() is a column's (VD-123): a column fills the space under its
 * top, so its marker only ever goes up, and further up where it would touch
 * one already placed.
 *
 * What a note says, and which point it marks, is the caller's: the figure
 * works it out from the data, and the key under the plot carries every word
 * of it, so nothing lives only in the drawing.
 */
import { textWidth } from './gridFlag.js'

/** The least distance between two line-end labels' centres, in px. */
export const LABEL_GAP = 16
/**
 * The same for a label set on two lines, the name over the value: the two
 * lines' boxes of --size-3, STACK_HALF apart either side of the centre, and
 * a pixel of air.
 */
export const STACKED_GAP = 34
/** From a stacked label's centre to either line's centre. */
export const STACK_HALF = 7
/** From a label's centre to the edge of its text's box: half a line box of --size-3 (about 19 px) and a pixel, and its other line where stacked. */
export const labelReach = (stacked) => (stacked ? STACK_HALF + 12 : 10)
/**
 * The most of a chart's width the gutter may take with each label on one
 * line: past it - a phone, a long name and a decimal value - the value goes
 * under the name, so the plot keeps the room it needs (VD-121).
 */
export const GUTTER_SHARE = 0.3
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
 * textWidth() is measured for the axis face's 11 px and is already generous
 * (charts/gridFlag.js); a line-end label is set at --size-3, 12 px, its name
 * semibold, and comes out narrower than textWidth says ("Verstappen 395.5"
 * is estimated at 112 px and measures about 100). So it is taken as it is:
 * a gutter a little wide costs a few pixels of plot.
 */
export const labelWidth = (value) => textWidth(value)

/**
 * The gutter the line-end labels need: the hairline to them, the widest
 * label, and a few pixels before the figure's edge. `labels` are
 * { name, value }, the name null where a chart has one series and its
 * title already names it. `stacked` sets a named label on two lines, the
 * name over the value, so the widest line is what counts.
 */
export function gutterWidth(labels, { stacked = false } = {}) {
  if (labels.length === 0) return 0
  const width = (l) =>
    !l.name ? labelWidth(l.value) : stacked ? Math.max(labelWidth(l.name), labelWidth(l.value)) : labelWidth(`${l.name} ${l.value}`)
  return Math.ceil(LEADER + Math.max(...labels.map(width)) + 4)
}

/**
 * Whether a chart `width` wide sets its named labels on two lines: where on
 * one they would take more than GUTTER_SHARE of it, and two would take less.
 */
export const stackLabels = (labels, width) =>
  labels.some((l) => l.name) && gutterWidth(labels) > width * GUTTER_SHARE && gutterWidth(labels, { stacked: true }) < gutterWidth(labels)

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

/**
 * Where a marker goes over the top of a column, or of several (VD-123): the
 * disc MARKER.offset above (x, y), and where that would touch a disc already
 * placed (`taken`, each { cx, cy }) - home's 2024-25 and 2026, a few pixels
 * apart on a phone - raised until it clears it, by no more than it must.
 * Never down: under the top is the column. The hairline runs from the top
 * to the disc; `leader: false` leaves it out, for a disc set over a shaded
 * band, which marks the band rather than a point in it. The caller makes
 * the headroom: columnLayout() raises the plot until every disc is inside
 * the drawing.
 */
export function placeAbove(x, y, { taken = [], leader = true } = {}) {
  const apart = 2 * (MARKER.r + MARKER.ring / 2) + 2
  let cy = y - MARKER.offset
  // Each pass only raises the disc, past the first disc it touches, so the
  // loop ends: at most once per disc placed.
  for (let pass = 0; pass <= taken.length; pass += 1) {
    const hit = taken.find((t) => Math.hypot(t.cx - x, t.cy - cy) < apart - 0.01)
    if (!hit) break
    cy = hit.cy - Math.sqrt(apart ** 2 - Math.min(apart, Math.abs(hit.cx - x)) ** 2) - 0.01
  }
  return {
    cx: x,
    cy,
    leader: leader ? { x1: x, y1: y - MARKER.gap, x2: x, y2: cy + MARKER.r } : null,
  }
}
