/**
 * The 3 px identity bar beside a constructor's or driver's name in a table
 * (AF-04). `colour` is what lib/liveries.js colourForEntry() returns: the
 * team's livery from 2010, its national racing colour before 1968, or null.
 * With a colour the element carries the {light, dark} pair and `.livery` in
 * styles/app.css picks one per theme; the tooltip names the claim being made.
 * Without one it is a transparent spacer of the same width, so the names in
 * a column stay aligned and nothing grey pretends to be a colour - the
 * database's rule for a missing figure, applied to a mark.
 */
export default function LiveryMark({ colour, title }) {
  if (!colour) return <i className="livery livery-none" aria-hidden="true" />
  return <i className="livery" style={colour.style} title={title ?? colour.title} />
}
