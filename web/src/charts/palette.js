/**
 * The chart colours, and the record of how they were checked.
 *
 * WHICH COLOUR A CHART DRAWS IN (VD-94, [D-61]), in order:
 *
 *   1. A series that belongs to a team or a driver wears its sourced colour -
 *      the livery from 2010, the national racing colour before 1968 - as the
 *      {light, dark} pair charts/own.js hands an element.
 *   2. A chart with ONE series and no such colour is drawn in INK, with MARK
 *      on the one value its page states: the season a note names, the
 *      record's holder, the race's winner. Colour then means something on the
 *      one mark it is spent on, rather than being the same blue on every
 *      first series on the site, which is what the reference palette was.
 *   3. Several series with no sourced colour, or with colours that cannot be
 *      told apart, take slots 1-3 below.
 *
 * Slots 1-3 of the reference categorical palette. They were not
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
 * The brand red is absent from the slots. It is this app's one interactive
 * colour — links, the focus ring, the current nav item — and a series wearing
 * it would be a line that looks clickable; it also fails the dark lightness
 * band as a categorical hue. It is drawn on ONE mark of an ink chart, as
 * MARK, where it says "this is the value the page states", the same job it
 * already did for the fastest lap; the maintainer accepted that on #924.
 */
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)']

export const seriesColour = (i) => SERIES[i % SERIES.length]

/**
 * The ink pair (VD-94): --series-ink is --ink-soft and --series-mark is
 * --accent, in each theme (styles/tokens.css). The same validator, run on the
 * pair with --pairs all:
 *
 *   light (surface #ffffff)   #4f5561 / #c81028: CVD ΔE 8.5 (protan) ·
 *                             tritan 27.2 · normal-vision 23.4 · both at or
 *                             above 3:1
 *   dark  (surface #14161b)   #9aa1ae / #ff4757: CVD ΔE 11.8 (deutan) ·
 *                             tritan 27.9 · normal-vision 23.2 · both at or
 *                             above 3:1
 *
 * It reports the ink as under its chroma floor, and in dark outside its
 * lightness band: those are the checks that a categorical HUE reads as one,
 * and the ink is meant to read as no hue at all - the grey the dataviz
 * method's emphasis pattern ("highlight one, grey the rest") asks for. The
 * mark is never the only cue either: the value it carries, or the name it
 * belongs to, is printed on or beside it.
 */
export const INK = 'var(--series-ink)'
export const MARK = 'var(--series-mark)'

/**
 * Slot `i` of `count` series with no sourced colour: ink where it is the
 * only one (rule 2 above), the palette's slot otherwise (rule 3).
 */
export const slotColour = (i, count) => (count === 1 ? INK : seriesColour(i))

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
