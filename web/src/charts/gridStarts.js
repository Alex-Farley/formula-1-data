/**
 * Where winners start (AF-133): the geometry of the starting-grid diagram
 * and of its phone form, the dot strip, as plain numbers, so that both
 * renderers draw the one picture - charts/GridStarts.jsx in the app and
 * scripts/prerender.js on the static page.
 *
 * Both draw the same thing: one dot for every race won from a grid slot,
 * oldest first, and a count in place of the dots where a slot holds more
 * than STARTS_CAP (Monza's first slot holds 26). They are drawn from
 * `races` as winnerStarts() in queries/circuit.js gives them, and only the
 * races with a slot are drawn: a pit-lane start, a slot not recorded and a
 * shared drive are in the table and the figures above it, never a box.
 *
 * Neither depends on the width it is drawn at. Each has a natural size,
 * which its <svg> is given, and scales down to fit a narrower box; the app
 * draws both and app.css shows one, the grid from 768 px and the strip
 * below, so the static page and the app are the same markup at every width
 * and nothing moves at the handover.
 */
import { bySlot } from '../queries/circuit.js'

/** More dots than this in one slot, and the slot shows how many instead. */
export const STARTS_CAP = 8

/**
 * How many slots are drawn: as far as the furthest one won from, at least
 * the front row, and always a whole row of two, so the last box has its
 * partner.
 */
export function slotsDrawn(slots) {
  const furthest = Math.max(2, ...slots.keys())
  return furthest + (furthest % 2)
}

// The grid: two lanes, the even slots set half a box back, front at the left.
const BOX_W = 60
const BOX_H = 34
const GAP_X = 12
const LANE_GAP = 10
const LABEL = 16
const PAD = 2
const DOT_R = 5
const DOT_PITCH = 13
const DOTS_ACROSS = 4

/**
 * The starting grid: { width, height, boxes }, a box being { slot, x, y,
 * width, height, labelX, labelY, count, dots }, and a dot { race, cx, cy, r }.
 * `count` is the slot's wins where they are more than STARTS_CAP and there
 * are no dots, and null otherwise. Null where no race here has a slot.
 */
export function gridDiagram(races) {
  const slots = bySlot(races)
  if (!slots.size) return null
  const n = slotsDrawn(slots)
  const pitch = BOX_W + GAP_X
  const lanes = [LABEL, LABEL + BOX_H + LANE_GAP]
  const width = PAD * 2 + (n / 2 - 1) * pitch + pitch / 2 + BOX_W
  const height = lanes[1] + BOX_H + LABEL
  // The dots sit in a block of DOTS_ACROSS by two, centred in the box.
  const across = (DOTS_ACROSS - 1) * DOT_PITCH + 2 * DOT_R
  const down = DOT_PITCH + 2 * DOT_R
  const boxes = []
  for (let slot = 1; slot <= n; slot++) {
    const back = slot % 2 === 0
    const x = PAD + Math.floor((slot - 1) / 2) * pitch + (back ? pitch / 2 : 0)
    const y = lanes[back ? 1 : 0]
    const won = slots.get(slot) ?? []
    const count = won.length > STARTS_CAP ? won.length : null
    boxes.push({
      slot,
      x,
      y,
      width: BOX_W,
      height: BOX_H,
      labelX: x + BOX_W / 2,
      // Above a front-lane box, below a back-lane one, clear of the other lane.
      labelY: back ? y + BOX_H + 12 : y - 5,
      count,
      dots: count
        ? []
        : won.map((race, i) => ({
            race,
            cx: x + (BOX_W - across) / 2 + DOT_R + (i % DOTS_ACROSS) * DOT_PITCH,
            cy: y + (BOX_H - down) / 2 + DOT_R + Math.floor(i / DOTS_ACROSS) * DOT_PITCH,
            r: DOT_R,
          })),
    })
  }
  return { width, height, boxes }
}

// The strip: one column per slot, the dots stacked up from a baseline.
const STRIP_PITCH = 16
const STRIP_STEP = 12
const STRIP_TOP = 16
/** How far a count is lifted over its neighbour's, so two counts side by side do not run together. */
const STRIP_LIFT = 12
const STRIP_LABEL = 14

/**
 * The dot strip, the grid's phone form: { width, height, baseline,
 * columns }, a column being { slot, x, labelY, count, bar, dots }. Where a
 * slot holds more than STARTS_CAP, `bar` is the full-height outline its
 * count is written over, and there are no dots. Null where no race here has
 * a slot.
 */
export function dotStrip(races) {
  const slots = bySlot(races)
  if (!slots.size) return null
  const n = slotsDrawn(slots)
  // As tall as the tallest stack, or as STARTS_CAP where a count stands in
  // for one, so a circuit of a few races is not a strip of empty height.
  const tallest = Math.max(...[...slots.values()].map((won) => won.length))
  const counted = (slot) => (slots.get(slot) ?? []).length > STARTS_CAP
  // A count beside another is written a line higher than it, alternately
  // (Monza's first three slots are 26, 14 and 12, and at 16 px apart their
  // figures ran into one), and the strip is that much taller where it is.
  const lift = (slot) => (counted(slot) && counted(slot - 1) && !lift(slot - 1) ? 1 : 0)
  let lifted = 0
  for (let slot = 1; slot <= n; slot++) lifted = Math.max(lifted, lift(slot))
  const top = STRIP_TOP + lifted * STRIP_LIFT
  const baseline = top + Math.min(STARTS_CAP, tallest) * STRIP_STEP
  const width = PAD * 2 + n * STRIP_PITCH
  const height = baseline + STRIP_LABEL
  const columns = []
  for (let slot = 1; slot <= n; slot++) {
    const x = PAD + (slot - 0.5) * STRIP_PITCH
    const won = slots.get(slot) ?? []
    const count = won.length > STARTS_CAP ? won.length : null
    columns.push({
      slot,
      x,
      labelY: baseline + 11,
      count,
      countY: top - 4 - lift(slot) * STRIP_LIFT,
      bar: count ? { x: x - DOT_R, y: top, width: 2 * DOT_R, height: baseline - top - 1 } : null,
      dots: count ? [] : won.map((race, i) => ({ race, cx: x, cy: baseline - DOT_R - 1 - i * STRIP_STEP, r: DOT_R })),
    })
  }
  return { width, height, baseline, columns }
}
