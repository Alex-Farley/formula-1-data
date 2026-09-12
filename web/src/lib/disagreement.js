/**
 * Whether every recorded row is an explained reading rather than an open
 * disagreement: the register and the race records defining a span
 * differently, each right about something (CD-25). Shared by the app's
 * Disagreement component and the prerenderer's disagree(), so the two
 * introduce the same rows the same way. A driver with one of each gets the
 * open wording for both, which is the cautious side to fall on; no driver
 * has both today.
 */
// The same prefix the queries select on, so a row of another explained kind
// could never be introduced as this one.
export const EXPLAINED_SPAN = 'explained - each side'
export const allExplained = (rows) =>
  rows.length > 0 && rows.every((r) => String(r.status ?? '').startsWith(EXPLAINED_SPAN))

/**
 * The aside's closing sentences, one string for both renderers. "Published"
 * is the site's word for a figure a source states as against one the race
 * records derive - the strip, the record list and the quality page all use
 * it - so the aside does too (CD-27).
 */
export const EXPLAINED_FOOTER =
  'Recorded and explained rather than resolved: the published span and the one the race records give differ, and the page shows both. Every recorded reading is listed on '
export const OPEN_FOOTER = 'Recorded rather than resolved, and open for somebody to settle. Every one is listed on ' 
