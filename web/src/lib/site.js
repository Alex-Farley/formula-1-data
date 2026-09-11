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

/**
 * The download paragraph's two sentences that must not drift between the
 * static SQL page and the app's. IA-15 landed the links on the prerendered
 * page and the app never carried them, so the two renderers disagreed about
 * whether the file could be had at all; SD-09 adds the sentence that the
 * artefact answers its own documentation questions offline, which nothing
 * public said.
 */
export const TWO_FILES =
  'Two files rather than one because distributing them together keeps them a collective ' +
  'database: merging them would pull 117,000 unrelated rows under the centrelines\u2019 ' +
  'share-alike licence. Take both, or you have no geometry and no way to get it.'

export const SELF_DESCRIBING =
  'Everything you need to read it is inside it: SELECT sql FROM sqlite_master for the ' +
  'commented schema, SELECT * FROM meta for the version, the build date and what is held, ' +
  'and SELECT * FROM source_registry for the licence of every row.'
