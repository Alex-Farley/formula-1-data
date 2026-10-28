/**
 * Whether a recorded row is an explained reading rather than an open
 * disagreement. Two kinds are: the register and the race records defining a
 * span differently, each right about something (CD-25); and a driver's
 * stored entries, starts or career points against the race records' count,
 * where the gap has a reason on the record - a championship total net of
 * dropped scores, an entry or a car the records hold no row for, a figure
 * read before the races since (DA-42, DA-43). Shared by the app's
 * Disagreement component and the prerenderer's disagree(), so the two
 * introduce the same rows the same way.
 */
// The status_note the span rows are selected on - build.py's EACH_SIDE_RIGHT,
// the phrase it files them with (DA-09) - and the kind build.py files every
// stored total under. A row of another explained kind is never introduced as
// one of these.
export const EXPLAINED_SPAN = 'each side is right about something'
export const STORED_TOTAL = 'stored-total'
export const isExplained = (r) =>
  r.status === 'explained' && (r.status_note === EXPLAINED_SPAN || r.kind === STORED_TOTAL)
export const allExplained = (rows) => rows.length > 0 && rows.every(isExplained)

/**
 * A driver page's rows, split into what each aside introduces: the open
 * disagreements first, then the explained readings. A driver can have both -
 * Alonso's entries are open while his points are explained - and one aside
 * for the lot would either ask a reader to settle a gap already explained or
 * call an open one explained. Empty groups are left out.
 */
export const byReading = (rows) =>
  [rows.filter((r) => !isExplained(r)), rows.filter(isExplained)].filter((group) => group.length > 0)

/**
 * The WHERE clause both renderers select a driver's rows with: every open row,
 * and the two explained kinds above. `d` is discrepancies.
 */
export const DRIVER_READINGS = `(d.status = 'open' OR (d.status = 'explained' AND (d.status_note = '${EXPLAINED_SPAN}' OR d.kind = '${STORED_TOTAL}')))`

/**
 * The aside's closing sentences, one string for both renderers. "Published"
 * is the site's word for a figure a source states as against one the race
 * records derive - the strip, the record list and the quality page all use
 * it - so the aside does too (CD-27).
 */
export const EXPLAINED_FOOTER =
  'Recorded and explained rather than resolved: the published figure and the one the race records give differ, and the page shows both. Every recorded reading is listed on '
export const explainedHeading = (what) => `Two readings of ${what}, and why they differ`
export const OPEN_FOOTER = 'Recorded rather than resolved, and open for somebody to settle. Every one is listed on '
