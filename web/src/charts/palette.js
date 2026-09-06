/**
 * The chart colours, and the record of how they were checked.
 *
 * These are slots 1-3 of the reference categorical palette. They were not
 * chosen by eye: the palette validator was run against this app's own chart
 * surface — white in light, #191920 in dark — with every pair in play, and
 * these are the numbers it returned.
 *
 *   light (surface #ffffff)   CVD ΔE 9.2 worst pair · normal-vision ΔE 24.0
 *                             aqua at 2.82:1 contrast — below 3:1, which is a
 *                             conditional relax, not a pass: it obliges every
 *                             figure to carry visible labels or a table view.
 *                             Every figure here carries its own data table.
 *   dark  (surface #191920)   CVD ΔE 9.4 worst pair · normal-vision ΔE 20.9
 *                             all three at or above 3:1
 *
 * Three is the cap, and it is the reason charts here fold everything else into
 * a single "other" or split into small multiples rather than reaching for a
 * fourth hue: the fourth slot puts yellow beside orange, and that pair fails
 * the all-pairs floors.
 *
 * The brand red is deliberately absent. It is this app's one interactive
 * colour — links, the focus ring, the current nav item — and a data mark
 * wearing it would be a mark that looks clickable. It also fails the dark
 * lightness band.
 */
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)']

export const seriesColour = (i) => SERIES[i % SERIES.length]

/** Text never wears a series colour. Values, labels and ticks use ink tokens. */
export const INK = 'var(--ink)'
export const INK_FAINT = 'var(--ink-faint)'
