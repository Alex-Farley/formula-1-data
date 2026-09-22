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
 * Why a driver's page can show two entry counts, and two start counts. Said
 * once, in both renderers: the review of #75 found fourteen pages printing
 * 393 beside 392 with nothing between them.
 *
 * It used to say that telling a start from an entry "needs a reason for each
 * non-start that no source here supplies", which was true until PD-15: the
 * result each source printed IS that reason, `position_text` holds it
 * losslessly, and the strip above now counts Starts from it on 447 pages. A
 * caveat that denies the figure beside it is worse than no caveat, so the
 * sentence states the rule instead - the same rule build.py's STARTED applies
 * to the records tables, in the same words as STARTED_RULE.
 *
 * The disagreement clause covers starts as well as entries for the same
 * reason: two drivers, Piquet and Raikkonen, have a published start count
 * that the race records do not reach, and a page showing both with nothing
 * between them is the defect #75 found.
 */
export const ENTRIES_NOTE =
  'Entries is counted here from the race records, one for every race a driver was entered for, and ' +
  'wins, podiums and poles are counted the same way and checked against the published totals on every ' +
  'build. Starts is counted from those records too: an entry is a start unless the result the source ' +
  'printed says it never was - did not qualify, pre-qualify, start or practise, or excluded before the ' +
  'start - so a pit-lane start counts and so does a retirement on the first lap. The published entry ' +
  'and start figures are a separate count kept for the few drivers who have one, reached by rules this ' +
  'database does not hold. Where a published figure and the counted one disagree, both are shown and ' +
  'neither is corrected.'

/**
 * What the footer promises about where the reading happens.
 *
 * The app's footer has made both claims since the database first opened in
 * the browser; the static footer made only the first half of the first one,
 * so the two things a reader most needs on arrival - that nothing they look
 * at or type is sent anywhere, and that the page keeps working once the
 * network goes - were told only to a reader who had already stayed long
 * enough for the database to load (CD-31). The search arrival and the no-JS
 * reader got neither, which is the same defect CD-04 fixed for the em dash,
 * in the same paragraph.
 *
 * It says "this tab" rather than "your browser", which is what the static
 * footer used to say, because that is the claim this site can keep: there is
 * no service worker here, so a second tab opened without a network has
 * nothing to render. It is also the phrasing the home page, /data and the SQL
 * console already use.
 */
export const IN_THIS_TAB =
  'Every page here is a query against one SQLite file, running in this tab. Nothing you look at ' +
  'or type is sent anywhere, and once it has loaded, this tab keeps working without a network.'

/**
 * What an em dash in a cell means, and where the career totals come from.
 *
 * The app's footer has said this since the totals were first counted; the
 * static footer never carried it, so the search arrival, the no-JS reader and
 * the first seconds of every cold visit got the convention's consequences
 * with the rule for reading them deleted (CD-04). A blank that is not
 * explained is read as a zero, which is the one thing it never is.
 */
export const COUNTED_TOTALS =
  'Career totals are counted from the race records wherever the records can support it, and an em ' +
  'dash means nobody has established that figure \u2014 never zero.'

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
 * The same position in one line, for the two places a paragraph will not go:
 * beside each of the four tables in the console's schema browser, and as the
 * empty result when a statement reads one of them.
 *
 * That second placement is the one that matters (CD-05). `SELECT * FROM laps`
 * answering "The statement ran and matched nothing." reads, to the developer
 * evaluating this database, as a bug in their own query - and the explanation
 * was only ever on a page they had no reason to open. The words say what
 * NOT_HELD says at length, and for the same reasons: the licences on offer
 * rather than the law, and race timing rather than lap times.
 *
 * TIMING_EMPTY_TABLES is the list both placements test against, so a fifth
 * table would not have to be remembered in two places.
 */
export const TIMING_EMPTY_TABLES = ['laps', 'stints', 'race_timing', 'race_control_messages']

export const timingEmpty = (table) =>
  'Empty by design: no source licenses Formula One race timing on terms that allow passing it ' +
  `on, so ${table ?? 'this table'} ships with no rows.`

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

/**
 * How many photographs a strip draws, and how wide each one is asked for.
 *
 * Both renderers claim they cannot draw a different six - components/
 * Photographs.jsx and scripts/prerender.js - and until these were one
 * constant that claim rested on two literals happening to agree. A strip
 * truncated to six says "6 of 51", so the number is in the heading as well as
 * in the slice; there is no second place for it to be wrong.
 */
export const PHOTOGRAPHS_SHOWN = 6
export const PHOTOGRAPH_WIDTH = 600

export const UNCHECKED_MARK = 'unchecked'

export const UNCHECKED_NOTE = [
  'A photograph marked',
  'has a file name that does not name the car it is shown for. Most are still the right car, ' +
    'filed under the driver rather than the machine — but nobody has confirmed these one by one.',
]

/**
 * Where the project itself is, and the one way back into it.
 *
 * Until 2026-09-14 the repository was private, so the site published the data
 * and withheld every document that explains it, and a reader who spotted a
 * wrong value had nowhere to say so. Both addresses live here for the reason
 * every other shared string does: the app and the prerenderer must offer the
 * reader the same door, and a second copy of a URL is a copy that can rot.
 */
export const REPOSITORY = 'https://github.com/Alex-Farley/formula-1-data'
// The reader's form, named explicitly. Bare `issues/new` lands on the
// chooser and then on item.yml, which prefills an `XX-nn:` title and asks
// for a critique prefix, a `next.py --next-id` lookup and a board drag - it
// would tell a reader who has found a wrong pole position that their report
// is malformed, which is the failure SD-04 is about, one step further on.
export const REPORT_URL = `${REPOSITORY}/issues/new?template=report.yml`

/**
 * The inbound channel, in the words both renderers use.
 *
 * A report with no destination is worse than none, so the promise is the one
 * this project can keep and already documents in CONTRIBUTING.md: two sources
 * that disagree are recorded in `discrepancies` and published with the data
 * rather than one being picked silently, and a fact nobody has established is
 * listed in `known_gaps`. Neither is closed by choosing a side, which is why
 * a reader who knows something is the cross-check this project cannot
 * generate for itself.
 */
export const REPORT_ASK = 'Found something wrong?'
export const REPORT_LINK = 'Report it'
export const REPORT_PROMISE =
  'What two sources disagree about is recorded and published rather than quietly picked, and ' +
  'what nobody has established is listed as a gap.'

/**
 * The same invitation beside a disagreement the database has not settled.
 *
 * Only beside an OPEN one: a reading explained as each side being right about
 * something is not waiting for anybody, and asking a reader to settle it
 * would misdescribe the row they are looking at.
 */
export const SETTLE_ASK = 'If you can settle it against a source that can be checked, '
export const SETTLE_LINK = 'report what you have'

/**
 * The three documents that explain the database, served from the site beside
 * the files they describe.
 *
 * The obligation follows the file, not the repository: lapledger.org serves
 * the data to anyone, so the schema that documents it and the two notices
 * that set its terms are served from the same place rather than from a
 * repository a reader has no reason to look in. `f1-geometry.db`'s own `meta`
 * row and each release body already name these files; until now those names
 * resolved to nothing a downloader could reach.
 *
 * One list, read by both renderers, so the static page and the app cannot
 * offer different documents. `web/scripts/prepare-assets.js` stages exactly
 * these three and refuses to build without them.
 */
export const DOCUMENTS = [
  [
    'schema.sql',
    'The schema, commented: every table, every column, and the reasoning behind the ones that need it.',
  ],
  [
    'ATTRIBUTION.md',
    'Where each part of the data came from, what its licence requires, and what that requirement cost or bought.',
  ],
  [
    'LICENSE-DATA',
    'The terms the data is offered under \u2014 CC BY-SA 4.0 \u2014 and why share-alike rather than something looser.',
  ],
]

export const DOCUMENTS_NOTE =
  'The database is served from here, so the documents that explain it are served from here too.'

/**
 * Who publishes this, and what the site is willing to promise about it.
 *
 * Nothing on any of the 3,545 pages here said who keeps this database, what
 * goes into it, or what becomes of it if the person keeping it stops. A
 * reader deciding whether to cite it, or an editor deciding whether it can be
 * a source, had a footer crediting F1DB and Wikipedia and no answer at all
 * about the thing in front of them. The name is the one already on LICENSE
 * and LICENSE-DATA; this page is where a reader can reach it.
 *
 * The prose lives here rather than in About.jsx for the reason every other
 * shared string does: /about is prerendered as well as rendered, and a page
 * whose whole subject is what this site promises is the last page on which
 * the static half and the app may say different things.
 *
 * Two things a reader will look for are deliberately NOT claimed. There is no
 * correction route off GitHub and no stated turnaround, because neither is
 * this page's to invent; and no permanent archive is promised, because none
 * has been deposited. What is written instead is what is true today, which is
 * the only version of this page worth having.
 */
export const MAINTAINER = 'Alex Farley'

export const ABOUT_LEDE =
  'Who keeps this database, what goes into it and what is refused, how to say it is wrong, how ' +
  'often it changes, and what becomes of it if the person keeping it stops.'

/**
 * The link out to the project itself, split around its own anchor text for
 * the same reason UNCHECKED_NOTE is: the words are decided once and each
 * renderer draws the anchor in its own markup.
 */
export const ABOUT_REPOSITORY = [
  'The build, the checks that gate it and the source data they read are all public, so what this ' +
    'page says about itself can be read rather than taken on trust: ',
  'the repository',
  '.',
]

/**
 * The page itself: six questions, in the order a reader asks them.
 *
 * `after` names the one linked block a section ends on, so both renderers put
 * it in the same place and neither decides for itself which section gets it.
 */
export const ABOUT = [
  {
    title: 'Who publishes this',
    after: 'repository',
    paragraphs: [
      `Lap Ledger is built and kept by ${MAINTAINER}, one person, in the open. It is not a Formula ` +
        'One publication: it is unaffiliated with Formula One, with the FIA and with every team, ' +
        'nothing here is licensed from any of them, and nobody at any of them has checked it.',
    ],
  },
  {
    title: 'What goes in, and what is refused',
    paragraphs: [
      'A fact goes in only with a source somebody else can check, and it carries the standing of ' +
        'that source with it — an official FIA or formula1.com source is the only thing that ' +
        'reaches the top of the confidence ladder, and nothing is promoted to it without one. A ' +
        'figure nobody has established is left empty rather than guessed at, and an empty figure ' +
        'is never a zero.',
      'Two things are refused outright. A source whose licence does not allow its rows to be passed ' +
        'on is classified as such on the register, and the build refuses a database in which any ' +
        'row cites one. And Formula One race timing, which nobody publishes under terms that permit ' +
        'passing it on, so lap times, stints, race timing and race control messages ship as four ' +
        'empty tables on purpose.',
    ],
  },
  {
    title: 'When two sources disagree',
    paragraphs: [
      'Neither reading is picked quietly. The disagreement is written into the database as a row of ' +
        'its own — both figures, and what each source says — and published beside the data; a ' +
        'fact nobody has established is listed in the gap register with what would close it. Both ' +
        'registers ship inside the file you can download, so a question this database has not ' +
        'settled is one you can see rather than one you have to catch it out on.',
    ],
  },
  {
    title: 'If something here is wrong',
    after: 'report',
    paragraphs: [
      'A reader who has spotted a wrong figure is the cross-check this project cannot run on ' +
        'itself. The report form asks for the page, the figure and what says otherwise, and for ' +
        'nothing about how this project files its own work.',
      'What a report gets is an answer on the issue it opens and one of four outcomes: a ' +
        'correction, a recorded disagreement, a recorded gap, or a reason it was not taken. It is ' +
        'read by the one person named above, who does not do this full time. There is no desk ' +
        'behind it and no promised turnaround, and saying so is better than promising one nobody ' +
        'is staffed to keep.',
    ],
  },
  {
    title: 'How often it changes',
    paragraphs: [
      'F1DB publishes a race within a day or two of it being run; the harvest here is re-fetched ' +
        'from it every morning at 06:00 UTC and committed only once the rebuilt database has ' +
        'passed every check, so the race record follows a race weekend by a few days rather than ' +
        'by a week. Everything else — the eras, the regulations, the registers, the prose — ' +
        'moves when somebody works on it.',
      'Every page names the database version it is running on and the date that database was ' +
        'built, and the version is what fixes which figures you were shown.',
    ],
  },
  {
    title: 'If this stops',
    paragraphs: [
      'The database is a pure function of its sources and a published build script: the same inputs ' +
        'produce the same bytes, which is why the build date inside it is a constant rather than a ' +
        'timestamp. Every release carries a SHA256SUMS file, so a copy can be checked against the ' +
        'digests the build produced rather than against this site still being up.',
      'The data is offered under CC BY-SA 4.0 and the code under the MIT licence; the circuit ' +
        'centrelines are © OpenStreetMap contributors under ODbL 1.0, and that obligation follows ' +
        'f1-geometry.db alone. So if the person ' +
        'named above stops, what has already been published stays readable, checkable and ' +
        'rebuildable by anybody holding a copy — which is the most this page can honestly ' +
        'promise, and worth more than a promise to carry on.',
    ],
  },
]
