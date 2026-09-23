/**
 * What changed, and when: the record behind /changes and feed.xml (SD-20).
 *
 * WHY THIS FILE EXISTS
 *     `refresh.yml` rebuilds the harvest from F1DB every morning at 06:00 UTC
 *     and commits the result when, and only when, the rebuilt database has
 *     passed every check. Until now that was invisible from outside. There was
 *     no feed, no page saying what had moved, and nothing a reader could
 *     subscribe to — so the one genuinely recurring reason to come back, that
 *     the data changed, was the one thing the site never said. The facts an
 *     entry needs were computed every day and then dropped.
 *
 * WHAT AN ENTRY IS
 *     A published state of the database, identified by the PAIR
 *     (`meta.version`, `meta.built`). Both halves are needed because the two
 *     ways this database changes move different halves:
 *
 *       - a release bumps `VERSION` in build.py, and `release.yml` tags it;
 *       - a refresh leaves `VERSION` alone and moves `BUILT`, because
 *         refresh.yml dates the build on the one morning the data genuinely
 *         changed. It commits nothing when F1DB matches the harvest already.
 *
 *     So a refresh that changed something always produces an entry with an id
 *     no previous entry had, and a refresh that changed nothing produces no
 *     entry at all — which is the behaviour SD-20 asks for, obtained from the
 *     dating rule that was already there rather than from a second record that
 *     could disagree with it.
 *
 * WHERE THE CURRENT ENTRY COMES FROM
 *     Not from this file. It is composed at build time from the database's own
 *     `meta` table and counted from its own rows, by `currentBuild()` below,
 *     so it cannot describe a version other than the one it ships with and no
 *     morning's refresh needs a human to write it down. This file holds only
 *     what is already PAST — releases that have been tagged — because those
 *     are the entries the current database can no longer be asked about.
 *
 *     The consequence, stated rather than hidden: when a refresh supersedes the
 *     current build, that build's entry is replaced rather than kept, and the
 *     durable record is the release history below. A subscriber is still told
 *     each time the data moves, which is what the feed is for; the permanent
 *     account of a given day's rows is the git history and the release assets.
 *
 * WHY NOT READ THE TAGS AT BUILD TIME
 *     Because the prerender runs on Cloudflare, whose checkout depth this
 *     project does not control, and a build step whose execution you cannot
 *     establish is worth less than no build step [D-09]. The tags are read
 *     once, by a person, and committed here as ordinary source.
 */

/**
 * Every tagged release, newest first.
 *
 * `version` and `built` are what build.py carried at that tag; `published` is
 * the day the tag was made, which is the day the release reached a reader and
 * so the day the entry is dated by.
 *
 * `title` is the release's own words from the repository's history rather than
 * a summary written afterwards - but not from one place, because the releases
 * were not all made the same way. Whichever of these the release actually has,
 * in this order: the annotated tag's own subject; the release commit's subject
 * where the tag points at a merge whose body carries it; the version-bump
 * commit's subject otherwise. Adding a row means reading that release's
 * history, not inventing a line that reads like the others.
 *
 * v2.22 is absent because it was never tagged: this lists what was published,
 * not what the version counter passed through.
 *
 * The current build is NOT here: `currentBuild()` composes it from the
 * database. Appending a superseded build to the top of this list is how one
 * becomes part of the permanent record.
 */
export const RELEASES = [
  {
    version: '2.24',
    built: '2026-09-16',
    published: '2026-09-16',
    title: 'v2.24, and a release reminder measured against this project’s own releases',
  },
  {
    version: '2.23',
    built: '2026-09-09',
    published: '2026-09-13',
    title: 'v2.23 — the records are derived, not published',
  },
  {
    version: '2.21',
    built: '2026-09-09',
    published: '2026-09-11',
    title: 'v2.21: pole is its own column',
  },
  {
    version: '2.20',
    built: '2026-09-09',
    published: '2026-09-09',
    title: 'v2.20: release the Parquet export',
  },
  {
    version: '2.19',
    built: '2026-09-09',
    published: '2026-09-09',
    title: 'v2.19: split the race date into a display value and an ISO day',
  },
  {
    version: '2.18',
    built: '2026-09-09',
    published: '2026-09-09',
    title: 'v2.18: give every race a date, and close the last fastest-lap gap',
  },
  {
    version: '2.17',
    built: '2026-09-09',
    published: '2026-09-09',
    title: 'v2.17: fix three silent release defects, and write down the conventions',
  },
]

/** The feed's address, relative to the base, in one place. */
export const FEED_FILE = 'feed.xml'

/**
 * An entry's permanent id.
 *
 * A tag: URI rather than the page's URL, because every entry links to the same
 * page — /changes — and a feed reader that keyed on the link would treat the
 * whole history as one item it had already seen. The date part is the
 * authority date, fixed at this project's first release year, so the id of a
 * given build never changes; the specific part is the pair that defines the
 * entry.
 */
export const entryId = ({ version, built }) => `tag:lapledger.org,2026:db/${version}/${built}`

/**
 * The entry for the database as it stands, from its own meta and its own rows.
 *
 * `figures` are the counts a reader would want to know had moved. They are
 * counted here rather than stored, so they are the database's answer and not a
 * claim about it that could go stale — the same reason README's figures are
 * spans written from f1.db and checked by verify.py.
 */
export const currentBuild = ({ version, built, figures }) => ({
  version,
  built,
  published: built,
  title: `Database v${version}, built ${built}`,
  figures,
  isCurrent: true,
})

/**
 * The feed's entries: the current build, then every release before it.
 *
 * A release whose pair matches the current build is dropped rather than shown
 * twice — that is the normal state between a tag and the next refresh, when
 * the tagged release IS the current build. The current entry wins because it
 * is the one carrying the figures.
 */
export const feedEntries = (now) => [
  now,
  ...RELEASES.filter((r) => !(r.version === now.version && r.built === now.built)),
]

// ---------------------------------------------------------------- the words

export const CHANGES_TITLE = 'What changed'

export const CHANGES_DESCRIPTION =
  'What this database holds today, when it last moved, and every released version before it — with an Atom feed, so you do not have to keep checking.'

export const CHANGES_LEDE =
  'This database is rebuilt from its sources every morning, and published again when something has actually changed. This page is what it holds now and what moved before it.'

export const CURRENT_HEADING = 'The database as it stands'

export const CURRENT_NOTE =
  'Counted from the database this page was built from, not stored anywhere: every figure here is its own answer to the question.'

export const HISTORY_HEADING = 'Released versions'

export const HISTORY_NOTE =
  'Each release carries the version stamped into the database’s own meta table. That places a '
  + 'released file in this list, but it does not identify one: the copy this site serves is '
  + 'rebuilt on every deploy and moves ahead of the tag it still names. The digest on the data '
  + 'page is what tells two files with the same version and build date apart.'

export const FEED_HEADING = 'Subscribe'

/**
 * The refresh's cadence, stated once. The schedule is refresh.yml's `cron` and
 * this sentence is the reader-facing half of it; a claim about how often the
 * data moves has to be the schedule's claim or it is just a hope.
 */
export const FEED_NOTE =
  'The harvest is refreshed daily at 06:00 UTC and rebuilt only if F1DB has published something new, so an entry appears when the data has genuinely moved and not otherwise.'

export const FEED_LINK_TEXT = 'Atom feed'

export const FEED_TITLE = 'Lap Ledger — what changed'

/*
 * The feed is a syndication surface, so it carries its own licence line: an
 * entry can be read in a reader that never fetched the page the footer is on,
 * which makes the pointer part of the attribution rather than a convenience.
 * Every clause is a claim the site already makes - the footer's source list
 * and the home page's JSON-LD `license` - and not a new one. The sources URL
 * is passed in rather than written here, so it is the origin this build is
 * for and cannot become a second, staler copy of the address.
 */
export const feedRights = (sourcesUrl) =>
  'Summaries CC BY-SA 4.0. Race data from F1DB (CC BY 4.0), prose and registers from ' +
  'Wikipedia (CC BY-SA 4.0), circuit geometry © OpenStreetMap contributors (ODbL 1.0); ' +
  `full attribution at ${sourcesUrl}. Unaffiliated with Formula One, the FIA or any team.`

export const FEED_SUBTITLE =
  'Every published state of the Lap Ledger Formula One database: what it holds, and when it last moved.'

/** The columns of the release table, shared by the app and the prerenderer. */
export const RELEASE_COLUMNS = [
  { key: 'version', rowHeader: true, label: 'Version' },
  { key: 'published', label: 'Published' },
  { key: 'title', label: 'What changed' },
]
