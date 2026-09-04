/** Linear scale: a domain onto a pixel range, plus its inverse. */
export function linear([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1
  const fn = (v) => r0 + ((v - d0) / span) * (r1 - r0)
  fn.invert = (p) => d0 + ((p - r0) / (r1 - r0 || 1)) * span
  fn.domain = [d0, d1]
  fn.range = [r0, r1]
  return fn
}

/**
 * Round tick values — 0 / 5 / 10, never 0 / 3.7 / 7.4. Axis ticks carry the
 * values that are not directly labelled, so they have to be readable numbers.
 */
export function ticks(min, max, count = 5) {
  if (min === max) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const out = []
  for (let t = Math.ceil(min / step) * step; t <= max + step / 1000; t += step) {
    // Floating point: 0.1 + 0.2 style drift shows up in axis labels.
    out.push(Number(t.toPrecision(12)))
  }
  return out
}

/** A y-domain that starts at zero and ends on a round tick above the data. */
export function zeroTo(values, count = 5) {
  const max = Math.max(...values, 0)
  const t = ticks(0, max, count)
  return [0, Math.max(t[t.length - 1], max)]
}

export function fmt(n, digits = 0) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
