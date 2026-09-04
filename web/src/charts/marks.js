/**
 * Bar and column outlines.
 *
 * A bar is rounded at the data end only and square at the baseline: the
 * rounded cap says "this is where the value stops", and a rounded foot would
 * lift the mark off the axis it is measured from.
 */
const R = 4

/** A column growing up from the baseline at y + h. */
export function columnPath(x, y, w, h) {
  const r = Math.min(R, h, w / 2)
  if (h <= 0) return ''
  return [
    `M${x},${y + h}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + w - r},${y}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `L${x + w},${y + h}`,
    'Z',
  ].join(' ')
}

/** A bar growing right from the baseline at x. */
export function barPath(x, y, w, h) {
  const r = Math.min(R, w, h / 2)
  if (w <= 0) return ''
  return [
    `M${x},${y}`,
    `L${x + w - r},${y}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `L${x + w},${y + h - r}`,
    `Q${x + w},${y + h} ${x + w - r},${y + h}`,
    `L${x},${y + h}`,
    'Z',
  ].join(' ')
}

/**
 * Mark thickness. Capped at 24px so a chart with few categories does not draw
 * slabs, and reduced by the 2px surface gap that separates neighbours — the
 * gap is what makes adjacent marks read as distinct, not a stroke around them.
 */
export const MAX_THICKNESS = 24
export const GAP = 2

export function thickness(band) {
  return Math.max(2, Math.min(MAX_THICKNESS, band - GAP))
}
