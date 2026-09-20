/**
 * The colour a chart belonging to ONE entity wears (VD-34).
 *
 * A constructor's wins and a driver's championship finishes were drawn in
 * `--series-1` - the same blue as every other first series on the site - on
 * the two pages where the site knows exactly whose numbers these are. The
 * excitement is in the data, and this is where it is spent.
 *
 * `colour` is a colourForEntry() or nationalEntry() result, or null. It
 * returns the class and the custom properties a chart's wrapper carries;
 * `.livery-series` in styles/app.css picks the light or the dark value, and
 * everything inside paints `var(--livery)`.
 *
 * THE PAIR, NOT THE BASE. AF-16 took the moved pair off the MARK, where the
 * name beside it carries the meaning, and left it on the chart series, where
 * a colour is read against the panel with nothing else to say what it is.
 * A chart is that surface: test/conventions.mjs holds every pair to 3:1 on
 * the panels, and a chart drawing `base` would be drawing the one value
 * nothing checks against a background.
 *
 * The pair renders the MARK'S LEAD, moved only far enough to clear that 3:1
 * (AF-57). So this series and the mark for the same entry are the same
 * colour to a reader - which is the whole of what a chart wearing a livery
 * is for - and the recognition colour AF-45 established reaches the charts
 * and not the marks alone.
 *
 * With no colour the caller gets no class and no properties, and the chart's
 * own `seriesColour(0)` fallback stands - which is what a constructor with no
 * sourced livery and no recognised national colour gets.
 */
export function ownColour(colour) {
  if (!colour) return { className: undefined, style: undefined, paint: null }
  return {
    className: 'livery-series',
    style: { '--livery-light': colour.light, '--livery-dark': colour.dark },
    paint: 'var(--livery)',
  }
}
