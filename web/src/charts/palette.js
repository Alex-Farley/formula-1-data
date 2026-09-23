/**
 * The chart colours, and the record of how they were checked.
 *
 * These are slots 1-3 of the reference categorical palette. They were not
 * chosen by eye: the palette validator was run against this app's own chart
 * surface — white in light, #191920 in dark — with every pair in play, and
 * these are the numbers it returned.
 *
 *   light (surface #ffffff)   CVD ΔE 9.3 worst pair (green-orange, protan) ·
 *                             normal-vision ΔE 21.7 (green-blue) · all three
 *                             at or above 3:1. The reference green, #1baf7a,
 *                             sat at 2.82:1, which the validator calls a
 *                             conditional relax - legal only because every
 *                             figure carries a table. AX-07 held that the
 *                             table gets a reader the value and does not make
 *                             the line perceivable, which is what 1.4.11 asks,
 *                             so slot 3 is stepped down to #15a174 (3.29:1).
 *                             The cost: with the old green the validator gave
 *                             CVD 9.2 (deutan), normal-vision 24.0 and a
 *                             tritan worst pair of 9.6; the new one is 9.3,
 *                             21.7 and 6.2. web/test/conventions.mjs measures
 *                             all three against --panel.
 *
 *   The tool is the dataviz skill's scripts/validate_palette.js: OKLab ΔE
 *   x100 under a Viénot protan/deutan simulation, worst pair over all pairs
 *   (--pairs all), target 8, floor 6; normal-vision floor 15 unsimulated;
 *   WCAG 2 contrast against the named surface. Another metric gives another
 *   number - a ΔE2000 reading of the same pair moves the other way - so a
 *   figure here means nothing without this paragraph.
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
 * The second channel: every series its own stroke, solid, dashed, dotted
 * (AX-16).
 *
 * A line chart's direct end labels carry the value, and one that would
 * collide with its neighbour is dropped, which leaves the legend as the only
 * key to that line. A key that differs only in hue is a key that 1.4.1 says
 * may not be the only one, and it is the one a reader with a colour-vision
 * deficiency, or anyone on a washed-out screen, cannot use - and the chart
 * wearing liveries (AF-04) makes that likelier rather than rarer, because two
 * teams' colours are not chosen to be told apart. So the dash follows the
 * series slot, livery or not, and the legend and the tooltip draw a stroke
 * sample in it rather than a square: the pattern on the line is the pattern
 * in the key. It also does the work the old teammate-dash did, since two
 * drivers of one team sit in two slots.
 *
 * Measured at the chart's 2px width with round caps, which add a pixel at
 * each end of every dash: 7-on 5-off reads as 9 and 3, and 1-on 4.5-off as
 * three-pixel dots two and a half apart - apart in a 16px key as well as on
 * the line.
 */
export const DASHES = [undefined, '7 5', '1 4.5']

export const seriesDash = (i) => DASHES[i % DASHES.length]

/**
 * Text never wears a series colour. Values, labels and ticks take ink tokens
 * from the stylesheet — `.figure .axis-text` and `.figure .value-text` — which
 * is why there is nothing to export here for them.
 */
