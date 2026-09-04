/** Linear scale: a domain onto a pixel range, plus its inverse. */
export function linear([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1
  const fn = (v) => r0 + ((v - d0) / span) * (r1 - r0)
  fn.invert = (p) => d0 + ((p - r0) / (r1 - r0 || 1)) * span
  fn.domain = [d0, d1]
  fn.range = [r0, r1]
  return fn
}

/** The round step nearest to dividing a span into `count` parts. */
function stepFor(span, count) {
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
}

/**
 * Round tick values — 0 / 5 / 10, never 0 / 3.7 / 7.4. Axis ticks carry the
 * values that are not directly labelled, so they have to be readable numbers.
 */
export function ticks(min, max, count = 5) {
  if (min === max) return [min]
  const step = stepFor(max - min, count)
  const out = []
  for (let t = Math.ceil(min / step) * step; t <= max + step / 1000; t += step) {
    // Floating point: 0.1 + 0.2 style drift shows up in axis labels.
    out.push(Number(t.toPrecision(12)))
  }
  return out
}

/**
 * A zero-based axis: the domain, and the ticks that label it, from one
 * computation.
 *
 * They have to be derived together. Two earlier versions of this got it wrong
 * in two different ways, and both looked fine until measured:
 *
 *   - taking the domain as "the last tick, or the data max, whichever is
 *     larger" can never round up, because ticks() by construction never emits
 *     a value above max — so the domain was always the data max, and the peak
 *     sat above the top gridline, flush against the frame;
 *   - rounding the domain up using one tick count and then labelling it with
 *     another gave a domain of [0,25] carrying ticks at 0/10/20 — the top of
 *     the axis unlabelled, and the peak above the last gridline again.
 *
 * One function, one count, one step: the top of the domain is always a tick.
 */
export function zeroAxis(values, count = 4) {
  const max = Math.max(...values, 0)
  if (max <= 0) return { domain: [0, 1], ticks: [0, 1] }
  const step = stepFor(max, count)
  const top = Math.ceil(max / step) * step
  const out = []
  for (let t = 0; t <= top + step / 1000; t += step) out.push(Number(t.toPrecision(12)))
  return { domain: [0, top], ticks: out }
}

export function fmt(n, digits = 0) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
