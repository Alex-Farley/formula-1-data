/**
 * What the site calls itself, and how a page name becomes a document title.
 *
 * Shared by the app and by prerender.js rather than written twice. A page
 * that names itself one way in the static HTML and another once the app
 * takes over is the same disagreement Page.jsx's own docstring describes —
 * and the reader who bookmarks it gets whichever one happened to be there.
 */
export const SITE = 'Lap Ledger'

export const titled = (headline) => `${headline} — ${SITE}`
