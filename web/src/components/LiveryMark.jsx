import { inColourEra } from '../lib/liveries.js'

/**
 * The 7 px identity bar beside a constructor's or driver's name in a table
 * (AF-04, widened by AF-17 so the bands of a scheme are bands). `colour` is
 * what lib/liveries.js colourForEntry() returns: the
 * team's livery from 2010, its national racing colour before 1968, or null.
 * With a colour the element carries that colour itself in --livery, and its
 * accents in --livery-scheme (AF-17); `.livery` in styles/app.css paints and
 * rings the first and draws the second over it (AF-16: the mark sits beside
 * the name, so it draws the colour rather than a legible substitute for it).
 * The tooltip names the claim being made, and names it about the PRIMARY -
 * "the colour X raced in Y" is the one the scheme is called after. An accent
 * this project chose is drawn here and named only on the page band, where
 * the clause that says whose reading it is fits beside it.
 * Without one it is a transparent spacer of the same width, so the names in
 * a column stay aligned and nothing grey pretends to be a colour - the
 * database's rule for a missing figure, applied to a mark. In a season no
 * row of which can carry a colour - 1968 to 2009, the declared gap - there
 * is no spacer either: `year` says which, and the column keeps its indent.
 */
export default function LiveryMark({ colour, title, year }) {
  if (!colour) return inColourEra(year) ? <i className="livery livery-none" aria-hidden="true" /> : null
  return <i className="livery" style={colour.style} title={title ?? colour.title} />
}
