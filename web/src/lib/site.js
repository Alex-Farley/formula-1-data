/**
 * What the site calls itself, and how a page name becomes a document title.
 *
 * Shared by the app and by prerender.js rather than written twice. A page
 * that names itself one way in the static HTML and another once the app
 * takes over is the same disagreement Page.jsx's own docstring describes —
 * and the reader who bookmarks it gets whichever one happened to be there.
 */
export const SITE = 'Lap Ledger'

/**
 * The marks a table cell carries beside a name, in the words both renderers
 * use. The app sets each as a tag; the static page prints the same word, so
 * a crawler and a reader are told the same thing (PD-02, IA-17).
 */
export const NOT_YET_RUN = 'not yet run'
export const SPRINT = 'sprint'
export const SHARED = 'shared'
export const SO_FAR = 'so far'
export const LANDMARK = 'landmark'

export const titled = (headline) => `${headline} — ${SITE}`

/**
 * Why a driver's page can show two entry counts. Said once, in both
 * renderers: the review of #75 found fourteen pages printing 393 beside 392
 * with nothing between them.
 */
export const ENTRIES_NOTE =
  'Entries is counted here from the race records, one for every race a driver was entered for, and ' +
  'wins, podiums and poles are counted the same way and checked against the published totals on every ' +
  'build. The published entry and start figures are a different count, kept for the few drivers who ' +
  'have one: an entry is not a start, and telling them apart needs a reason for each non-start that no ' +
  'source here supplies. Where the two entry counts disagree, both are shown.'

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
 * repository stayed private (docs/LANDED.md, Declined: "Making the repository
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
 * Why four tables are empty, stated as the position it is rather than as an
 * apology (PD-12). A licence decision, not a missing feature —
 * docs/TIMING-ARCHITECTURE.md — and the one thing a reader comparing this
 * with its upstream most needs told before they go looking: the absence is
 * what makes every figure here one they may republish. It is a claim about
 * the licences on offer, not about what anyone may lawfully do - FOM and its
 * licensees redistribute timing every weekend - and it names race timing,
 * because the qualifying table holds 27,000 lap times F1DB publishes under
 * CC BY (the review of #94).
 */
export const NOT_HELD =
  'Nobody publishes Formula One race timing under a licence that permits passing it on, so this ' +
  'database holds none of it: lap times, stints, race timing and race control messages ship as ' +
  'four empty tables, on purpose. Everything that is here may be passed on under the licence ' +
  'shown beside it; the pit stops and the qualifying times come from F1DB, whose CC BY 4.0 ' +
  'allows exactly that.'

/**
 * The photographs section, in the words both renderers use.
 *
 * Car.jsx wrote these two sentences and scripts/prerender.js now writes the
 * same section into the static page (PD-19), so they live here for the same
 * reason ENTRIES_NOTE does: a caveat that says one thing before the app loads
 * and another after it is a caveat nobody can rely on.
 *
 * UNCHECKED_NOTE is a pair because the mark sits inside the sentence and each
 * renderer draws it differently - the app as a <span className="pill">, the
 * static page as the same span written out. Splitting the prose is what lets
 * the prose itself be written once.
 */
export const PHOTOGRAPHS_NOTE =
  'From Wikimedia Commons, each shown with the photographer and licence its terms require.'

export const UNCHECKED_MARK = 'unchecked'

export const UNCHECKED_NOTE = [
  'A photograph marked',
  'has a file name that does not name this car. Most are still the right car, filed under the ' +
    'driver rather than the machine — but nobody has confirmed these one by one.',
]
