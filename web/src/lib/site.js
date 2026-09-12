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
 * How to cite a page. The page is named by its address, not its title: the
 * app and the static page have titled the same route differently since the
 * prerenderer was written, and a citation is the one place that difference
 * must not show. The version and build date fix which figures were seen.
 */
export const citation = (version, built, url) =>
  `Cite this page as Lap Ledger, database v${version} built ${built}, ${url}. The version and build date fix which figures you saw.`

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

/**
 * The claim `/data` makes, in the words the project settled on when the
 * repository stayed private (BACKLOG: Declined, "Making the repository
 * public"). Not "audited": the pipeline half of that word — the checks, the
 * source literals, rebuild-and-compare — is not readable by anyone outside.
 * What remains checkable from the artefact alone is what is claimed, and the
 * app and the static page must claim the same thing.
 */
export const CROSS_CHECKED =
  'Every figure is cross-checked against independent sources, with every disagreement and ' +
  'every gap published in the data: a confidence tier on every row, both readings wherever ' +
  'two sources differ, and a register of what nobody has established.'

/**
 * Why four tables are empty. A licence decision, not a missing feature —
 * docs/TIMING-ARCHITECTURE.md — and the one thing a reader comparing this
 * with its upstream most needs told before they go looking.
 */
export const NOT_HELD =
  'Lap times, stints, race timing and race control messages are not held. No source publishes ' +
  'them under a licence that permits passing them on, so those four tables ship empty on ' +
  'purpose; the pit stops that are here come from F1DB, whose licence does.'
