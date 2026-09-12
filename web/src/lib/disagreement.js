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
