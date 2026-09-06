/** Scales and ticks, hand-rolled because four chart types do not justify a library. */

/** A continuous scale from a data domain onto a pixel range. */
export function linear([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1
  const scale = (value) => r0 + ((value - d0) / span) * (r1 - r0)
  scale.invert = (pixel) => d0 + ((pixel - r0) / (r1 - r0 || 1)) * span
  scale.domain = [d0, d1]
  scale.range = [r0, r1]
  return scale
}

/** Evenly spaced slots, one per category, with the mark centred in each. */
export function band(values, [r0, r1], padding = 0.2) {
  const n = Math.max(values.length, 1)
  const step = (r1 - r0) / n
  const width = step * (1 - padding)
  const scale = (value) => {
    const i = values.indexOf(value)
    return r0 + (i < 0 ? 0 : i) * step + (step - width) / 2
  }
  scale.centre = (value) => scale(value) + width / 2
  scale.bandwidth = width
  scale.step = step
  return scale
}

/**
 * Round tick values covering a domain.
 *
 * A tick drawn at 0.25 and printed as "0.3" is an axis that lies, so the step
 * is always 1, 2, 2.5 or 5 times a power of ten. Asking for many ticks in a
 * small range is what pushes a scale off those steps, so `count` is a target
 * rather than a promise.
 */
export function ticks([d0, d1], count = 5, { integer = false } = {}) {
  const span = d1 - d0
  if (!Number.isFinite(span) || span <= 0) return [d0]
  const rough = span / Math.max(count, 2)
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalised = rough / magnitude
  let step = (normalised >= 5 ? 5 : normalised >= 2.5 ? 2.5 : normalised >= 2 ? 2 : 1) * magnitude
  // A years axis asked for more ticks than it has years lands on a step of 0.5
  // and prints 1985 twice. Whole numbers are the only honest ticks on an axis
  // whose values are whole.
  if (integer) step = Math.max(1, Math.round(step))

  const out = []
  for (let value = Math.ceil(d0 / step) * step; value <= d1 + step / 1e6; value += step) {
    // Floating point leaves 0.30000000000000004 lying around; the step's own
    // precision is the right number of places to round to.
    out.push(Number(value.toFixed(10)))
  }
  return out
}

/**
 * A domain that includes zero and ends on a round number.
 *
 * Bars are read as lengths, so their baseline has to be zero or the picture
 * exaggerates every difference on it.
 */
export function niceDomain(values, { zero = true, count = 5 } = {}) {
  const clean = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (clean.length === 0) return [0, 1]
  let min = Math.min(...clean)
  let max = Math.max(...clean)
  if (zero) {
    min = Math.min(0, min)
    max = Math.max(0, max)
  }
  if (min === max) {
    max = min + 1
  }
  const marks = ticks([min, max], count)
  const step = marks.length > 1 ? marks[1] - marks[0] : (max - min) / count
  return [Math.min(min, marks[0]), Math.max(max, Math.ceil(max / step) * step)]
}
