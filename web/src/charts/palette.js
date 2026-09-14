/**
 * The chart colours, and the record of how they were checked.
 *
 * These are slots 1-3 of the reference categorical palette. They were not
 * chosen by eye: the palette validator was run against this app's own chart
 * surface — white in light, #191920 in dark — with every pair in play, and
 * these are the numbers it returned.
 *
 *   light (surface #ffffff)   CVD ΔE 9.3 worst pair · normal-vision ΔE 27.2
 *                             all three at or above 3:1. The reference green,
 *                             #1baf7a, sat at 2.82:1, which the validator
 *                             calls a conditional relax - legal only because
 *                             every figure carries a table. AX-07 held that
 *                             the table gets a reader the value and does not
 *                             make the line perceivable, which is what 1.4.11
 *                             asks, so slot 3 is stepped down to #15a174
 *                             (3.29:1) instead; web/test/conventions.mjs
 *                             measures all three against --panel.
 *   dark  (surface #14161b)   CVD ΔE 9.4 worst pair · normal-vision ΔE 20.9
 *                             all three at or above 3:1
 *
 * Re-run when a surface moves. The Pit Wall restyle took the dark panel from
 * #191920 to #14161b, which made this note false until it was checked again;
 * a claim about a measurement is only worth having if it names the surface it
 * was measured against.
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

/**
 * Text never wears a series colour. Values, labels and ticks take ink tokens
 * from the stylesheet — `.figure .axis-text` and `.figure .value-text` — which
 * is why there is nothing to export here for them.
 */
