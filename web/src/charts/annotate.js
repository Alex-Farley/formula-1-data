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
 * placeDotMarkers() is a dot plot's (VD-124): under its dot, in the space
 * a career's line leaves open, clear of every dot and every stretch of the
 * line.
 * placeColumnMarkers() is a column chart's (VD-123): a column fills the
 * space under its top, so a marker never goes below it; where two would
 * touch, the earlier one steps aside on an angled hairline, and where a
 * disc would cover a column or a hairline, it is raised.
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

/** The least distance between two discs' centres: their rings and two pixels of air. */
const APART = 2 * (MARKER.r + MARKER.ring / 2) + 2

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
  let cy = y - MARKER.offset
  // Each pass only raises the disc, past the first disc it touches, so the
  // loop ends: at most once per disc placed.
  for (let pass = 0; pass <= taken.length; pass += 1) {
    const hit = taken.find((t) => Math.hypot(t.cx - x, t.cy - cy) < APART - 0.01)
    if (!hit) break
    cy = hit.cy - Math.sqrt(APART ** 2 - Math.min(APART, Math.abs(hit.cx - x)) ** 2) - 0.01
  }
  return {
    cx: x,
    cy,
    leader: leader ? { x1: x, y1: y - MARKER.gap, x2: x, y2: cy + MARKER.r } : null,
  }
}

/**
 * The hairline from a point to a disc set to one side of it: from just
 * above the point to the disc's edge, along the line between them.
 */
function angled(point, cx, cy) {
  const x1 = point.x
  const y1 = point.y - MARKER.gap
  const dx = cx - x1
  const dy = cy - y1
  const length = Math.hypot(dx, dy)
  return { x1, y1, x2: cx - (dx / length) * MARKER.r, y2: cy - (dy / length) * MARKER.r }
}

/** How near a hairline comes to a point: the least distance from (px, py) to the segment. */
function nearest({ x1, y1, x2, y2 }, px, py) {
  const length = (x2 - x1) ** 2 + (y2 - y1) ** 2
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / length))
  return Math.hypot(x1 + t * (x2 - x1) - px, y1 + t * (y2 - y1) - py)
}

/**
 * Every marker on a column chart (VD-123), in the order given: each `{ n,
 * x, y, leader }`, the top of the columns it marks at (x, y). A disc is
 * sound where it lies inside [left, right], over no column within its
 * reach (`floor(cx)`: the highest column top a disc centred at cx would
 * cover), apart from every other disc, with its hairline clear of every
 * other disc and every other hairline clear of it. Each disc is tried, in
 * this order, until it and any disc it moved are sound:
 *
 * - MARKER.offset above its point;
 * - there, or raised, with the disc it would touch stepped aside, away from
 *   it, level, on an angled hairline, as the approved mockup sets home's
 *   2024-25 beside 2026 - raising the later one straight over it would run
 *   its hairline through the earlier disc on a phone;
 * - raised straight up, by no more than it must (a narrow chart's first
 *   season, under a taller column beside it);
 * - and only where none is sound, raised clear of the discs placed, as
 *   placeAbove() does.
 *
 * Never down: under the top is the column. A disc with no hairline (a
 * band's) is never stepped aside.
 */
export function placeColumnMarkers(points, { left = -Infinity, right = Infinity, floor = () => Infinity } = {}) {
  const reach = MARKER.r + MARKER.ring / 2
  const RISE = 0.5
  const STEPS = Math.ceil((4 * APART) / RISE)
  const placed = []
  const vertical = (point, cy) => (point ? { x1: point.x, y1: point.y - MARKER.gap, x2: point.x, y2: cy + MARKER.r } : null)
  // Sound: every constraint that involves one of `changed`, against the rest.
  const sound = (set, changed) =>
    changed.every((m) => m.cx - reach >= left - 1e-9 && m.cx + reach <= right + 1e-9 && m.cy + reach <= floor(m.cx) - 1 + 1e-9) &&
    set.every((m) =>
      set.every(
        (o) =>
          o === m ||
          (!changed.includes(m) && !changed.includes(o)) ||
          (Math.hypot(m.cx - o.cx, m.cy - o.cy) >= APART - 0.01 && (!m.leader || nearest(m.leader, o.cx, o.cy) >= reach)),
      ),
    )
  for (const p of points) {
    const point = p.leader === false ? null : { x: p.x, y: p.y }
    const at = (k) => {
      const cy = p.y - MARKER.offset - k * RISE
      return { n: p.n, cx: p.x, cy, leader: vertical(point, cy), point }
    }
    const first = at(0)
    const hit = placed.find((t) => Math.hypot(t.cx - first.cx, t.cy - first.cy) < APART - 0.01)
    let chosen = sound([...placed, first], [first]) ? { disc: first } : null
    if (!chosen && hit?.point) {
      const side = hit.point.x <= p.x ? -1 : 1
      for (let k = 0; k <= STEPS && !chosen; k += 1) {
        const disc = at(k)
        const away = Math.sqrt(Math.max(0, APART ** 2 - (disc.cy - hit.cy) ** 2))
        const cx = side * (disc.cx + side * away - hit.cx) > 0 ? disc.cx + side * away : hit.cx
        const moved = { ...hit, cx, leader: angled(hit.point, cx, hit.cy) }
        const set = [...placed.filter((t) => t !== hit), moved, disc]
        if (sound(set, [moved, disc])) chosen = { disc, moved }
      }
    }
    for (let k = 1; k <= STEPS && !chosen; k += 1) {
      const disc = at(k)
      if (sound([...placed, disc], [disc])) chosen = { disc }
    }
    if (chosen?.moved) Object.assign(hit, chosen.moved)
    placed.push(chosen ? chosen.disc : { n: p.n, ...placeAbove(p.x, p.y, { taken: placed, leader: p.leader !== false }), point })
  }
  return placed.map(({ point, ...marker }) => marker)
}

/**
 * Every marker on a dot plot (VD-124), in the order given: each `{ n, x, y,
 * r }`, the dot it marks centred at (x, y), `r` out to its edge - its ring,
 * where a title is ringed. A disc goes under its dot, in the space a
 * career's line leaves open below its best seasons, and over it only where
 * no distance under it is sound; as near the dot as is sound either way. A
 * disc is sound where it lies inside [top, bottom], clear of every dot
 * (`dots`, each { x, y, r }), of every stretch of the line (`segments`, each
 * { x1, y1, x2, y2 }), of every label on the axes (`boxes`, each { left,
 * right, top, bottom }) - a first season's disc beside "P5" - and of every
 * disc placed before it, with its hairline
 * through no disc and no other hairline through it. Where none is, it is
 * placed as placeMarker() places one, clear of the discs before it. Returns
 * `{ n, cx, cy, leader }` for each, the hairline from the dot's edge to the
 * disc's.
 */
export function placeDotMarkers(marks, { dots = [], segments = [], boxes = [], top = 0, bottom = Infinity } = {}) {
  const reach = MARKER.r + MARKER.ring / 2
  const FURTHEST = 48
  const placed = []
  for (const m of marks) {
    const leaderTo = (cy) => {
      const down = cy > m.y
      return { x1: m.x, y1: down ? m.y + m.r + 1 : m.y - m.r - 1, x2: m.x, y2: down ? cy - MARKER.r : cy + MARKER.r }
    }
    const sound = (cy) => {
      if (cy - reach < top || cy + reach > bottom) return false
      if (dots.some((d) => Math.hypot(d.x - m.x, d.y - cy) < reach + d.r + 1)) return false
      if (segments.some((s) => nearest(s, m.x, cy) < reach + 1)) return false
      const off = (b) => Math.hypot(Math.max(b.left - m.x, 0, m.x - b.right), Math.max(b.top - cy, 0, cy - b.bottom))
      if (boxes.some((b) => off(b) < reach + 1)) return false
      const leader = leaderTo(cy)
      return placed.every(
        (p) => Math.hypot(p.cx - m.x, p.cy - cy) >= APART - 0.01 && nearest(leader, p.cx, p.cy) >= reach && nearest(p.leader, m.x, cy) >= reach,
      )
    }
    let cy = null
    for (const sign of [1, -1]) {
      for (let d = MARKER.offset; d <= MARKER.offset + FURTHEST && cy === null; d += 1) if (sound(m.y + sign * d)) cy = m.y + sign * d
      if (cy !== null) break
    }
    if (cy === null) {
      const fallback = placeMarker(m.x, m.y, [], { top, bottom, taken: placed })
      placed.push({ n: m.n, cx: fallback.cx, cy: fallback.cy, leader: leaderTo(fallback.cy) })
    } else placed.push({ n: m.n, cx: m.x, cy, leader: leaderTo(cy) })
  }
  return placed
}
