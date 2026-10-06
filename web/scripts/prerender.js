#!/usr/bin/env node
/**
 * Write a real HTML file for every route, straight from the database.
 *
 * WHY THIS EXISTS
 *     Until this script, the site was one HTML file behind a hash router. A
 *     fragment is never sent to a server, so `/#/drivers/hamilton` is not a
 *     URL any crawler can fetch and not a page any index can hold: every one
 *     of the 2,300-odd pages here shared a single title, a single description
 *     and a single entry in anybody's index. For a project whose whole claim
 *     is that each figure can be traced to a source, being uncitable was the
 *     largest thing wrong with it.
 *
 *     So each route now gets a file at its own path, carrying its own title,
 *     description, canonical URL, Open Graph tags, JSON-LD, and — this is the
 *     part that matters — the facts themselves as HTML. A reader with no
 *     JavaScript, a crawler that does not run it, and a model reading the page
 *     all get the same answer the app would give.
 *
 * WHY IT DOES NOT RENDER REACT
 *     Server-rendering the app would mean running 22 page components against a
 *     synchronous data layer they were not written for, then keeping the
 *     markup byte-identical so hydration does not warn. The static block here
 *     is written by this file instead and lives OUTSIDE #root, so React never
 *     tries to reconcile with it: the app mounts alongside, and main.jsx drops
 *     the static block once the database is open. Nothing can mismatch,
 *     because nothing is shared.
 *
 *     The pleasant side effect is a first paint that does not wait for twenty
 *     megabytes. The old boot screen was the first thing every new reader saw
 *     for several seconds; now they see the page, and the app quietly replaces
 *     it underneath.
 *
 * WHY THE STATIC BLOCK SURVIVES A FAILURE
 *     main.jsx removes it on 'ready' and only on 'ready'. If the database
 *     cannot be fetched at all, the reader keeps the facts this file wrote
 *     rather than being left with an error panel and nothing else.
 *
 * Run after `vite build`, from web/. Reads ../f1.db and dist/index.html;
 * writes dist/<route>/index.html, dist/404.html, dist/sitemap.xml,
 * dist/feed.xml and dist/robots.txt, and appends what it did about
 * measurement to dist/build-status.txt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { measurement } from './measurement.js'
import { deflateSync } from 'node:zlib'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// The one rule for the "Out"/"Status" column, shared with the app rather
// than restated here: a copy of it would drift, which is how the twelve
// hardcoded `circuit_geometry` columns went wrong. `formatted` is the
// app's own cell text — text() in lib/format.js — for the tables below
// that are drawn from a page's column list.
import { finished, missing, number, raceDates, result, span, text as formatted, yearList } from '../src/lib/format.js'
import { TILE_JOIN, tileSegments } from '../src/lib/tiles.js'
import { WIDE_ONLY, defaultColumns, glossaryKey, onPhone, shared, sharedLine } from '../src/lib/table.js'
// The ONE attribution rule (web/src/lib/commons.js), not a second copy of it.
// This script cannot import CommonsImage - that is a React component and this
// file emits HTML - but the question it answers, "who is credited and may this
// be shown at all", has exactly one answer on this site, and it is imported
// here for the same reason the cars gallery had to stop writing its own.
import { attribution, canShow, categoryUrl, fileTitle, photoAlt, thumbUrl } from '../src/lib/commons.js'
import {
  ABOUT,
  ABOUT_LEDE,
  ABOUT_REPOSITORY,
  COUNTED_TOTALS,
  CROSS_CHECKED,
  DIGEST_NOTE,
  DOCUMENTS,
  DOCUMENTS_NOTE,
  ENTRIES_NOTE,
  IN_THIS_TAB,
  SOURCES_LINK,
  behindThisPage,
  citation,
  LANDMARK,
  MAINTAINER,
  NOT_HELD,
  NOT_YET_RUN,
  PHOTOGRAPHS_NOTE,
  PHOTOGRAPHS_SHOWN,
  PHOTOGRAPH_WIDTH,
  RACE_CARS_NOTE,
  RACE_CARS_TITLE,
  RACE_PHOTOGRAPHS_NOTE,
  RACE_PHOTOGRAPHS_TITLE,
  photographsMore,
  raceCategoryLink,
  racePhotographAlt,
  REPORT_ASK,
  REPORT_LINK,
  REPORT_PROMISE,
  REPORT_URL,
  RAW_DATABASE_URL,
  REPOSITORY,
  SELF_DESCRIBING,
  SETTLE_ASK,
  SETTLE_LINK,
  SHARED,
  SITE,
  NAMES,
  SO_FAR,
  SPRINT,
  GUNZIP_NOTE,
  API_ENDPOINTS,
  API_HEADING,
  API_NOTE,
  TWO_FILES,
  UNCHECKED_MARK,
  UNCHECKED_NOTE,
  titled,
} from '../src/lib/site.js'
import { EXPLAINED_FOOTER, EXPLAINED_SPAN, OPEN_FOOTER, allExplained } from '../src/lib/disagreement.js'
import {
  CHANGES_DESCRIPTION,
  CHANGES_LEDE,
  CHANGES_TITLE,
  CURRENT_HEADING,
  CURRENT_NOTE,
  FEED_FILE,
  FEED_HEADING,
  FEED_LINK_TEXT,
  FEED_NOTE,
  FEED_SUBTITLE,
  FEED_TITLE,
  HISTORY_HEADING,
  HISTORY_NOTE,
  RELEASES,
  RELEASE_COLUMNS,
  currentBuild,
  entryId,
  feedEntries,
  feedRights,
} from '../src/lib/changes.js'
import { CHECKED_LABEL, CHECKED_NOTE, LAST_CHECKED } from '../src/lib/refresh.js'
import { LATEST as CHANGES_LATEST, SHAPE as CHANGES_SHAPE } from '../src/queries/changes.js'
import { SHAPE as DATA_SHAPE, fileStrip, trustStrip } from '../src/queries/data.js'
import { colourForEntry, markStyleAttr, winnerColour } from '../src/lib/liveries.js'
import { RACE_SESSIONS, SEASON_SESSIONS, SESSION_COLUMNS, TIMETABLE_NOTE, eventDay, raceStage } from '../src/queries/sessions.js'
// The pages' own queries and column lists (PD-02). A page and this script
// read the same module, so the static table is the app's table by
// construction; the rest of the pages follow these.
import { DRIVERS, DRIVER_COLUMNS, REGISTER_FOOTER, registerCount } from '../src/queries/drivers.js'
import { SEASONS, SEASONS_COLUMNS, SEASON_LIST_FOOTER } from '../src/queries/seasons.js'
import {
  CALENDAR,
  CALENDAR_COLUMNS,
  CALENDAR_FOOTER,
  CONSTRUCTORS_FINAL_COLUMNS,
  DRIVERS_FINAL_COLUMNS,
  DRIVERS_FINAL_FOOTER,
  CURRENT_GRID,
  ENTRANTS,
  ENTRANT_COLUMNS,
  ENTRANTS_FOOTER,
  FINAL,
  GRID,
  GRID_COLUMNS,
  GRID_FOOTER,
  GRID_HEADING,
  GRID_NOTE,
  NEIGHBOURS as SEASON_NEIGHBOURS,
  NEXT_HEADING,
  NEXT_ROUND,
  NOT_RUN_STANDINGS,
  REMAINING,
  SEASON,
  STANDINGS as SEASON_STANDINGS,
  WON_HERE,
  WON_HERE_COLUMNS,
  WON_HERE_HEADING,
  constructorsFooter,
  latestRound,
  nextLine,
  noConstructorsNote,
  standingsHeading,
  stillRunning,
  titlePermutations,
  titleStrip,
  wonHereNote,
} from '../src/queries/season.js'
import { LATEST as LATEST_RUN, RACES, RACE_COLUMNS, RACES_FOOTER } from '../src/queries/races.js'
import {
  BOARD,
  BOARD_HEADING,
  BOARD_NOTE,
  CHART_HEADING,
  CHART_TITLE,
  CLASSIFICATION_LINK,
  LAST_RACE,
  LEDE as HOME_LEDE,
  NEXT as HOME_NEXT,
  NEXT_RACE,
  NEXT_SEASON,
  NOTHING_SCHEDULED,
  PER_SEASON,
  READING_HEADING,
  READING_NOTE,
  SEASON_LEAD,
  SEASON_NOW,
  SHAPE as HOME_SHAPE,
  UNRECORDED_WINNER,
  WON_BY,
  WON_FOR,
  calendarLink,
  chartNote,
  reading,
  seasonComplete,
  seasonHeading,
  seasonLink,
  seasonStrip,
  stillToRunNote,
  strip as homeStrip,
} from '../src/queries/home.js'
import { CONSTRUCTOR_IMAGES, RACE_IMAGES, RACE_PHOTOGRAPHS, SEASON_IMAGES } from '../src/queries/photographs.js'
import { CONSTRUCTORS, CONSTRUCTOR_COLUMNS, CONSTRUCTORS_FOOTER } from '../src/queries/constructors.js'
import {
  CIRCUITS,
  CIRCUIT_COLUMNS,
  CIRCUITS_FOOTER,
  NO_SHAPES,
  REGISTER_OUTLINES,
  SHAPES,
  TRACED,
} from '../src/queries/circuits.js'
import { CHASSIS, CHASSIS_COLUMNS, CHASSIS_FOOTER, GALLERY, GALLERY_COLUMNS } from '../src/queries/cars.js'
import {
  CLASSIFICATION_COLUMNS,
  ENTRIES,
  NEIGHBOURS as RACE_NEIGHBOURS,
  FASTEST_LAP,
  GRID_FLAG_COLUMNS,
  GRID_FLAG_HEADING,
  GRID_FLAG_TITLE,
  PITS,
  PITS_FOOTER,
  PIT_COLUMNS,
  PRACTICE,
  PRACTICE_COLUMNS,
  PRACTICE_ONLY_MARK,
  PRACTICE_SUMMARY,
  QUALIFYING,
  QUALIFYING_FOOTER,
  SPRINT_QUALIFYING,
  practiceBySession,
  practiceFooter,
  practiceSummaryCount,
  sprintQualifyingColumns,
  sprintQualifyingFooter,
  RACE_SOURCES,
  SHARED_DRIVE_NOTE,
  SPRINT as SPRINT_RESULTS,
  SPRINT_COLUMNS,
  SPRINT_FOOTER,
  carName,
  classificationFooter,
  gridFlagLabel,
  gridFlagNote,
  inClassificationOrder,
  qualifyingColumns,
  raceLede,
  raceNote,
  raceSentence,
  raceStrip,
  railOf,
  scheduledNote,
} from '../src/queries/race.js'
import {
  BY_SEASON as TEAM_BY_SEASON,
  DERIVED as TEAM_DERIVED,
  DESIGNS,
  DESIGN_COLUMNS,
  ENGINE_SPLIT_FOOTER,
  SEASON_COLUMNS as TEAM_SEASON_COLUMNS,
  STANDINGS as TEAM_STANDINGS,
  WINS as TEAM_WINS,
  WINS_FOOTER as TEAM_WINS_FOOTER,
  WIN_COLUMNS,
  constructorSeasons,
  recordFigures,
  teamStrip,
} from '../src/queries/constructor.js'
import {
  CIRCUIT as CIRCUIT_ROW,
  GRANDS_PRIX as CIRCUIT_GRANDS_PRIX,
  LAYOUTS as CIRCUIT_LAYOUTS,
  RACES as CIRCUIT_RACES,
  RACE_COLUMNS as CIRCUIT_RACE_COLUMNS,
  TEAMS as TEAMS_HERE,
  TEAM_COLUMNS,
  OUTLINES as CIRCUIT_OUTLINES,
  PHOTOGRAPH as CIRCUIT_PHOTOGRAPH,
  WINNERS as WINNERS_HERE,
  WINNER_COLUMNS,
  circuitStrip,
  heldAs,
  photographAlt as circuitPhotographAlt,
} from '../src/queries/circuit.js'
import { GRANDS_PRIX, GRANDS_PRIX_COLUMNS, GRANDS_PRIX_FOOTER, GRANDS_PRIX_LEDE } from '../src/queries/grandsprix.js'
import {
  CIRCUITS as GP_CIRCUITS,
  CIRCUIT_COLUMNS as GP_CIRCUIT_COLUMNS,
  EDITIONS as GP_EDITIONS,
  EDITION_COLUMNS as GP_EDITION_COLUMNS,
  GRAND_PRIX,
  WINNERS as GP_WINNERS,
  WINNER_COLUMNS as GP_WINNER_COLUMNS,
  editionCar,
} from '../src/queries/grandprix.js'
import {
  AMBIGUOUS_COLUMNS as CAR_AMBIGUOUS_COLUMNS,
  AMBIGUOUS_FOOTER as CAR_AMBIGUOUS_FOOTER,
  CAR as CAR_ROW,
  CAR_DISAGREEMENTS,
  ENTRIES as CAR_ENTRIES,
  IMAGES as CAR_IMAGES,
  NO_ENTRIES,
  SEASONS as CAR_SEASONS,
  VARIANTS,
  VARIANTS_FOOTER,
  VARIANT_COLUMNS,
  carAddress,
  carFacts,
  carPageName,
  carStrip,
  winsNote,
  entryColumns,
  entryResult,
  FIGURES_HEADING,
  leadsWithPhotograph,
  specificationFields,
  wholeOfOneChassis,
} from '../src/queries/car.js'
import {
  ENGINES,
  ENGINE_COLUMNS,
  ERAS,
  GOVERNANCE,
  GOVERNANCE_COLUMNS,
  INNOVATIONS,
  INNOVATION_COLUMNS,
  LIMITS,
  LIMITS_NOTE,
  LIMIT_COLUMNS,
  POINTS,
  POINTS_COLUMNS,
  POINTS_NOTE,
  REGULATIONS,
  REGULATION_COLUMNS,
  SAFETY,
  TYRES,
  TYRE_COLUMNS,
} from '../src/queries/eras.js'
import { GLOSSARY, GLOSSARY_COLUMNS, PERSONNEL, PERSONNEL_COLUMNS } from '../src/queries/glossary.js'
import {
  OUTLINE_BY,
  OUTLINE_CREDIT,
  OUTLINE_REGISTER_NOTE,
  OUTLINE_RULE,
  OUTLINE_VIEWBOX,
  OUTLINES_NOTE,
  LAYOUT_CARDS,
  NO_DRAWING,
  STATE_WORDS,
  circuitOutlinesNote,
  layoutTimeline,
  layoutsCount,
  leadOutline,
  outlineCaption,
  outlineLabel,
  roundShortName,
  roundStates,
  stripLabel,
  timelineName,
  timelineYears,
} from '../src/lib/outline.js'
import {
  CONSEQUENCES,
  CONSEQUENCES_NOTE,
  CONSEQUENCE_COLUMNS,
  LICENCES,
  LICENCES_NOTE,
  LICENCE_COLUMNS,
  SOURCES,
  SOURCES_FOOTER,
  SOURCE_COLUMNS,
} from '../src/queries/sources.js'
import {
  AMBIGUOUS as UNATTRIBUTED,
  AMBIGUOUS_COLUMNS as UNATTRIBUTED_COLUMNS,
  AMBIGUOUS_NOTE as UNATTRIBUTED_NOTE,
  DISCREPANCIES,
  DISCREPANCIES_NOTE,
  CHASSIS_COVERAGE,
  CHASSIS_COVERAGE_COLUMNS,
  CHASSIS_NOTE,
  CHASSIS_TITLE,
  DISCREPANCY_COLUMNS,
  GAPS,
  GAP_COLUMNS,
  GAP_GROUPS,
  GEOMETRY_COLUMNS,
  GEOMETRY_FOOTER,
  IMAGES,
  LADDER_NOTE,
  MAINTAINER_NOTE,
  PHOTOGRAPHS_UNNAMED_NOTE,
  PHOTOGRAPH_STATS,
  PROVENANCE,
  PROVENANCE_COLUMNS,
  RECONCILIATION,
  RECONCILIATION_COLUMNS,
  RECONCILIATION_NOTE,
  UNVERIFIED,
  UNVERIFIED_COLUMNS,
  UNVERIFIED_FOOTER,
  photographsCatalogued,
} from '../src/queries/quality.js'
import {
  BY_SEASON,
  DERIVED,
  DRIVER,
  DRIVER_CONSTRUCTORS,
  DRIVER_SOURCES,
  RESULTS as DRIVER_RESULTS,
  SEASON_COLUMNS,
  SEASONS_FOOTER,
  STANDINGS,
  TEAM_MATES,
  TEAM_MATE_COLUMNS,
  THIS_SEASON,
  THIS_SEASON_COLUMNS,
  careerSentence,
  DRIVER_PRACTICE,
  PRACTICE_ONLY_NOTICE,
  PRACTICE_SESSION_COLUMNS,
  practiceSentence,
  careerStrip,
  lede,
  pointsDiffer,
  pointsNote,
  record,
  roundsRun,
  seasonRows,
  thisSeasonFooter,
  thisSeasonHeading,
  thisSeasonNote,
  teamMatesFooter,
} from '../src/queries/driver.js'
import {
  COMPARE_DESCRIPTION,
  COMPARE_LEDE,
  COMPARE_NOSCRIPT,
  comparePath,
  compareWith,
} from '../src/queries/compare.js'
import {
  CONSTRUCTOR_WINS,
  CONSTRUCTOR_WINS_COLUMNS,
  CONSTRUCTOR_WINS_FIGURE,
  CONSTRUCTORS_HEADING,
  DERIVATION,
  DRIVER_POLES,
  DRIVER_POLES_COLUMNS,
  DRIVER_POLES_FIGURE,
  DRIVER_WINS,
  DRIVER_WINS_COLUMNS,
  DRIVER_WINS_FIGURE,
  HEADLINE,
  KEY_SHAPE,
  LEADERBOARDS,
  RECORD,
  RECORDS,
  RECORDS_LEDE,
  TIER_AFTER,
  asOfLine,
  asOfOf,
  cardExtras,
  familiesLead,
  headlineRecords,
  holderPath,
  leadersDrawn,
  leadersDrawnLine,
  recordColumns,
  recordFamilies,
  recordPath,
  tierBefore,
  tiersOf,
} from '../src/queries/records.js'
// Where a page sits and where it leads, from the module the app reads (IA-03,
// IA-22). The trails were written out here and the onward bands existed only
// in the app, so the half a crawler and a cold arrival are given had no
// relational layer at all; both now come from one place.
import { ONWARD, TRAIL, raceSteps, seasonSteps } from '../src/lib/wayfinding.js'
import { GRID_FLAG_HEADS, crossPath, gridFlagLayout, gridFlagRows, gridFlagShown, undrawnOf } from '../src/charts/gridFlag.js'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..')
const repo = join(web, '..')
const dist = join(web, 'dist')

const die = (message) => {
  console.error(`\n${message}\n`)
  process.exit(1)
}

/**
 * Where the site will be served from, and under what path.
 *
 * SITE_ORIGIN is only used for canonical and og:url — a wrong one costs a
 * canonical tag, not a working site — so it defaults rather than failing.
 * SITE_BASE must match vite's `base`, because that is what decides whether
 * /assets/... resolves; the two read the same variable so they cannot drift.
 */
const ORIGIN = (process.env.SITE_ORIGIN ?? 'https://lapledger.org').replace(/\/$/, '')
const BASE = (process.env.SITE_BASE ?? '/').replace(/\/*$/, '/')

const template = join(dist, 'index.html')
if (!existsSync(template)) die('dist/index.html not found.\nBuild it first:  npm run build')

const dbPath = join(repo, 'f1.db')
if (!existsSync(dbPath)) die('f1.db not found at the repository root.\nBuild it first:  cd .. && python3 build.py')

const db = new DatabaseSync(dbPath, { readOnly: true })

/* One prepared statement per distinct SQL text, reused across every page:
   the per-entity loops below call the same few dozen queries thousands of
   times, and preparing each call re-parsed and re-planned it. A statement
   resets itself on each .all()/.get(), so reuse cannot leak a cursor. */
const statements = new Map()
const prepared = (sql) => {
  let statement = statements.get(sql)
  if (!statement) {
    statement = db.prepare(sql)
    statements.set(sql, statement)
  }
  return statement
}
const all = (sql, ...params) => prepared(sql).all(...params)
const one = (sql, ...params) => prepared(sql).get(...params) ?? null

/* A driver's standings, from a copy of v_standings_final. The view is
   evaluated whole for every query that reads it - its windows and CTEs run
   over all of `standings` before a driver filter applies - so each of ~915
   driver pages paid ~40 ms for a few rows, 35 s of the run. The file is
   read-only and does not change while this runs, so a second connection
   copies the view's rows once into an indexed TEMP table of the same name,
   which unqualified names resolve to first, and the shared STANDINGS query
   runs unchanged against it.

   Only that query reads the copy, and only while its ORDER BY s.year settles
   every row's place - one drivers' row per driver per season - because a tie
   is ordered by the plan, and a different plan would put the page out of step
   with the app's. The season and constructor tables do tie (Cooper's two
   1960 engines share fifth), and a copy reordered 40 season pages. If a
   driver ever holds two rows in a season, this falls back to the view. */
const standingsDb = new DatabaseSync(dbPath, { readOnly: true })
standingsDb.exec(`CREATE TEMP TABLE v_standings_final AS SELECT * FROM main.v_standings_final;
  CREATE INDEX temp.v_standings_final_driver ON v_standings_final (table_type, driver_id);`)
const driverYearTies = standingsDb
  .prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM v_standings_final WHERE table_type = 'drivers'
             GROUP BY driver_id, year HAVING COUNT(*) > 1)`)
  .get().n
const driverStandingsStatement = (driverYearTies === 0 ? standingsDb : db).prepare(STANDINGS)
const driverStandings = (id) => driverStandingsStatement.all(id)

/* The span the site describes itself by, read from the register rather than
   written down: the moment a calendar is announced for a season nobody has
   raced, the database covers a year further than any sentence here would. It
   is the same figure README.md's fig:season_span carries, and web/src/App.jsx
   prints it in the wordmark - the two renderers are compared on it. */
const { from: SPAN_FROM, to: SPAN_TO } = one('SELECT MIN(year) AS "from", MAX(year) AS "to" FROM seasons')
const SPAN = `${SPAN_FROM}–${SPAN_TO}`
// The version and build date, for the static footer: a search arrival's
// figures used to be undated until the app took over, so the page Google
// served carried numbers with no currency statement at all.
const META = Object.fromEntries(all('SELECT key, value FROM meta').map((r) => [r.key, r.value]))
// meta.current_season as the integer the pages compare a year with (PD-49);
// lib/season.js's CAST, here, where the pages' own queries do not ask for it.
const SEASON_NOW_YEAR = Number.parseInt(META.current_season, 10) || null

/*
 * The digest of the file this page was built from, from the manifest the app
 * would have loaded it by.
 *
 * Neither `meta.version` nor `meta.built` identifies a file. VERSION moves on
 * a release, BUILT only on a harvest refresh, and the copy this site serves is
 * rebuilt on every deploy; on 2026-09-21 the served f1.db and the v2.24
 * release asset both read v2.24 / 2026-09-16 and were not the same database
 * (SD-24). The digest is, and prepare-assets.js has already computed it into
 * db-manifest.json - the same string the app's footer and citation read, so
 * the two renderers cannot disagree about which file they described.
 *
 * Fatal rather than degraded, and for the same reason the licence documents
 * are: `npm run build` is `assets && parquet && vite build && prerender`, so
 * the only way this file is missing here is a chain that did not run the step
 * that writes it, and 3,541 pages citing a version-and-date pair that names
 * two different databases is the state this change exists to end.
 */
const manifestPath = join(dist, 'db-manifest.json')
if (!existsSync(manifestPath)) {
  die('dist/db-manifest.json not found.\nRun the whole chain:  npm run build')
}
const MANIFEST = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (!MANIFEST.digest || !MANIFEST.sha256) {
  die('dist/db-manifest.json carries no digest.\nEvery page cites it; prepare-assets.js writes it.')
}

// ------------------------------------------------------------------- html

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const esc = (value) =>
  value === null || value === undefined ? '' : String(value).replace(/[&<>"']/g, (c) => ESCAPES[c])

/**
 * A figure, or an em dash.
 *
 * The database's central convention is that a blank is an unestablished fact
 * and never a zero, and the static pages have to keep that promise as
 * carefully as the app does. `0` is a real answer and prints as 0; null does
 * not become one on the way through here.
 */
const num = (value) =>
  value === null || value === undefined || value === '' ? '—' : esc(String(value))

const text = (value) => (value === null || value === undefined || value === '' ? '—' : esc(value))

const href = (path) => `${BASE}${String(path).replace(/^\//, '')}`
const link = (path, label) => `<a href="${esc(href(path))}">${esc(label)}</a>`
// The marks the app sets as tags beside a name - "sprint", "not yet run",
// "so far" - in the same words (lib/site.js), so the two renderers' cells
// read the same. A table's footer is the app's footer, printed under it.
const tag = (word) => `<span class="tag">${esc(word)}</span>`
const note = (value) => (value ? `<p class="faint">${esc(value)}</p>` : '')

// `aligns` is the class per column — 'num', 'prose', a column's own
// `cellClass`, or nothing — the same classes DataTable puts on its cells, so a
// column of figures lines up and a column the stylesheet treats specially is
// not styled on one half of the site only.
//
// The two wrappers are DataTable's own (VD-01): `.table-wrap` draws the box
// and `.table-scroll` is what actually scrolls, and the static page used to
// spell a single `.tablewrap` doing both. One class means one set of rules —
// including the fade at the right edge, which is drawn on `.table-wrap` and
// so never reached the static page at all.
//
// `hidden` marks the columns DataTable takes out of the accessibility tree
// (a column's `ariaHidden`), header and cells alike.
//
// `rowHeaders` marks the columns whose cells are `<th scope="row">`, the ones
// that say which row this is (a column's `rowHeader`, AX-21), as DataTable's
// are; the smoke suite holds the two halves to the same positions.
const table = (headers, rows, options = {}) => {
  if (!rows.length) return ''
  const { aligns = [], hidden = [], rowHeaders = [] } = options
  const cls = (i, extra) => {
    const names = [aligns[i], extra].filter(Boolean).join(' ')
    return (names ? ` class="${esc(names)}"` : '') + (hidden[i] ? ' aria-hidden="true"' : '')
  }
  const cell = (c, i) => (rowHeaders[i] ? `<th scope="row"${cls(i)}>${c}</th>` : `<td${cls(i)}>${c}</td>`)
  return [
    '<div class="table-wrap"><div class="table-scroll"><table>',
    `<thead><tr>${headers
      .map((h, i) => {
        // A keyed header adds its class to the column's own, and names
        // itself by its label alone (lib/table.js).
        const own = typeof h === 'string' || !h.className ? cls(i) : cls(i, h.className)
        const named = typeof h !== 'string' && h.label ? ` aria-label="${esc(h.label)}"` : ''
        return `<th scope="col"${own}${named}>${typeof h === 'string' ? esc(h) : h.html}</th>`
      })
      .join('')}</tr></thead>`,
    '<tbody>',
    rows.map((cells) => `<tr>${cells.map(cell).join('')}</tr>`).join(''),
    '</tbody></table></div></div>',
  ].join('')
}

/**
 * A table from a page's own column list — web/src/queries/*, the list the
 * app's DataTable renders — so the headers, their order and what each cell
 * says are the app's by construction rather than by a second transcription
 * (PD-02, CR-23, CR-24). `links` gives the HTML for a cell the app renders
 * as a link, by column key; every other cell is the column's own `text`
 * formatter or lib/format.js's text(), which is what DataTable prints too.
 */
// A column with a React-only `render` and no `text` falls back to the
// formatted raw value here; a render that changes the text must come with a
// matching `text`, or the two renderers part.
const fromColumns = (declared, rows, links = {}) => {
  // The default set, never the full one: a column declared `optional` waits
  // for a reader to ask for it, in the app, through `?cols=` (IA-23). The
  // phone default is the same table with the columns it leaves out marked
  // WIDE_ONLY, which app.css hides at the width lib/table.js names.
  const columns = defaultColumns(declared)
  // The columns every row agreed on are said once above the table and dropped
  // from it (VD-29). The candidates are declared on the column, in the same
  // queries module this half and the app both read, so the two cannot lose
  // different columns - `links` and the app's renders are two lists, and
  // deriving it from each of them separately is what once put a nine-column
  // static table under a ten-column app one.
  // A declared column this half draws as a link is a contradiction - the flag
  // says the cell is its text - and it is the failure the flag exists to make
  // impossible, so it stops the build on the page where it happens rather than
  // shipping a table the app does not have.
  for (const c of columns) {
    if (c.collapse === true && Object.hasOwn(links, c.key)) {
      die(`prerender: column "${c.key}" declares collapse: true and is rendered as a link here`)
    }
  }
  const { columns: kept, shared: constants } = shared(columns, rows)
  const line = constants.length ? `<p class="table-shared">${esc(sharedLine(constants, rows.length))}</p>` : ''
  return (
    line +
    table(
      // A column marked ariaHidden has an empty header, hidden with its cells,
      // as the app's does: the classification's rail (AX-12).
      // A column that prints codes links its header to the glossary, as the
      // app's does (lib/table.js): the static race pages are where most
      // readers arrive, and they are the pages the codes are on.
      kept.map((c) => {
        if (c.ariaHidden) return { html: '' }
        const key = glossaryKey(c)
        if (!key) return c.label
        const mark = `<a class="key" href="${esc(href(key.to))}" aria-label="${esc(key.name)}" title="${esc(key.name)}"></a>`
        return {
          html: key.first ? `${mark}${esc(c.label)}` : `${esc(c.label)}${mark}`,
          className: 'keyed',
          label: key.header,
        }
      }),
      rows.map((row) =>
        kept.map((c) => {
          const value = row[c.key]
          // Own properties only: a column keyed `constructor` would otherwise
          // find Object.prototype.constructor and print "[object Object]".
          if (Object.hasOwn(links, c.key)) return links[c.key](value, row)
          return esc(c.text ? c.text(value, row) : formatted(value))
        }),
      ),
      {
        aligns: kept.map((c) =>
          [c.align, c.cellClass, onPhone(c, declared) ? null : WIDE_ONLY].filter(Boolean).join(' '),
        ),
        hidden: kept.map((c) => c.ariaHidden === true),
        rowHeaders: kept.map((c) => c.rowHeader === true),
      },
    )
  )
}

/**
 * Label/value rows, as components/Page.jsx's <Fields> draws them.
 *
 * This was `.facts`, a two-column grid with thirty lines of `#prerendered`
 * CSS describing a shape nothing else on the site had — so the same rows
 * were a bordered panel here and a run of hairline-ruled rows in the app,
 * and a reader watched the page change shape when the database opened
 * (VD-01). The markup is the app's now and app.css's `.fields` draws both.
 *
 * A pair whose value is not held is still DROPPED rather than dashed, which
 * is what this has always done and is a decision about what each page says
 * rather than about its shape; the call sites that want a dash already ask
 * for one through text().
 */
// `paired` sets two facts to a row at desktop width (app.css says where).
const fields = (pairs, { paired = false } = {}) => {
  const kept = pairs.filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (!kept.length) return ''
  return `<dl class="fields${paired ? ' fields-paired' : ''}">${kept
    .map(([label, value]) => `<dt>${esc(label)}</dt><dd>${value}</dd>`)
    .join('')}</dl>`
}

/**
 * Headline figures as tiles, as components/Page.jsx's <Stats> draws them.
 *
 * The complaint VD-01 was filed on: the app opens a page on a strip of
 * tiles and the static half opened the same page on a key/value table, so
 * the first thing a reader saw was replaced by a different thing the moment
 * the database opened. Same element, same `data-lead` and `data-kind`, so
 * the two ranks VD-28 gave the app reach the static page too.
 *
 * A null is dropped rather than dashed, as it is there — an empty tile is
 * noise where an empty table cell is information. `value` is HTML, as
 * everywhere else in this file; `label` and `note` are text.
 */
const stats = (items) => {
  const shown = items.filter(
    (item) => item && item.value !== null && item.value !== undefined && item.value !== '',
  )
  if (!shown.length) return ''
  const ranked = shown.some((item) => item.lead)
  return `<dl class="stats"${ranked ? ' data-ranked=""' : ''}>${shown
    .map(
      ({ label, value, note, lead, kind }) =>
        `<div${lead ? ' data-lead=""' : ''}${kind ? ` data-kind="${esc(kind)}"` : ''}>` +
        `<dt>${esc(label)}</dt><dd>${value}${note ? `<small>${esc(note)}</small>` : ''}</dd></div>`,
    )
    .join('')}</dl>`
}

/**
 * A strip built as data in a queries/*.js module, drawn as the app's <Stats>
 * draws it (VD-49): its links by their `href` or `links`, a number as the
 * app formats it, a `quiet` value in the class the app gives it. Each
 * page's strip is the app's own list, from the module its page reads, so
 * this file draws a strip and never writes one. lib/tiles.js says what each
 * field means.
 */
const tiles = (items) =>
  stats(
    items.map((item) => {
      if (!item || item.value === null || item.value === undefined || item.value === '') return null
      const drawn = tileSegments(item)
        .map(({ label, href }) => {
          const shown = typeof label === 'number' ? formatted(label) : label
          return href ? link(href, shown) : esc(shown)
        })
        .join(esc(TILE_JOIN))
      return { ...item, value: item.quiet ? `<span class="muted tile-quiet">${drawn}</span>` : drawn }
    }),
  )

// `.measure` is the app's class for a paragraph held to a readable line, and
// the static page's prose takes it rather than `#prerendered p` holding every
// paragraph on the page to the measure and recolouring it besides (VD-01).
const prose = (value) => (value ? `<p class="measure">${esc(value)}</p>` : '')

// A standing-out note, as components/Page.jsx's <Note> draws it: a ruled
// panel, not a paragraph. Four of these read as ordinary prose on the static
// page while the app set them apart, which is the same second vocabulary
// VD-01 is about.
const noteBox = (head, body) => `<div class="note-box"><strong>${esc(head)}</strong> ${esc(body)}</div>`

// What DataTable puts in place of a table it has no rows for. Without it a
// heading stands alone announcing a table that is not there — which is what
// a season not yet run looked like.
// The same words as DataTable's default, decided once: the static page and
// the app render the same section, and smoke.mjs compares them (CD-17).
const EMPTY_STATE = '<p class="state is-empty">No rows here.</p>'

// A Section's heading with the count beside it, as components/Page.jsx writes
// it — including the text-node space, because the visible gap is CSS and the
// accessible name is the text: "Open gaps12" is what a heading-by-heading
// reader was given the last time somebody left it out.
const heading = (title, count) =>
  `<h2>${esc(title)}${count === null || count === undefined ? '' : ` <span class="count">${esc(count)}</span>`}</h2>`

/**
 * The safety milestones, as Eras.jsx draws them: a dated timeline, not a
 * table.
 *
 * The static eras page carried the eras and seven tables and simply left this
 * section out, so the one part of that page that is a narrative was the one
 * part a reader without JavaScript never saw (VD-01). `.timeline` is the
 * app's own rule and the markup is its own markup, so nothing here needs a
 * style of its own.
 */
const timeline = (milestones) =>
  milestones.length
    ? `${heading('Safety', milestones.length)}<div class="timeline">${milestones
        .map(
          (m) =>
            `<article><h3>${esc(m.milestone)}<span class="years">${esc(m.year)}</span></h3>${
              m.trigger_event
                ? `<p class="faint small"><strong>After:</strong> ${esc(m.trigger_event)}</p>`
                : ''
            }${m.description ? `<p>${esc(m.description)}</p>` : ''}</article>`,
        )
        .join('')}</div>`
    : ''

/**
 * A figure, as charts/Figure.jsx frames one: a caption and, always, a table
 * of the same numbers.
 *
 * The drawing itself is not here — it is a React component reading a layout
 * this file has no way to run — and that is the whole of what the static
 * half is missing. THE TABLE IS NOT A FALLBACK, in Figure.jsx's own words:
 * it is the copy of the figure that a keyboard, a screen reader and anything
 * pasting it elsewhere can actually use, and it is what both halves carry.
 * It is open here rather than behind the app's disclosure, because there is
 * no chart above it to be the thing on display.
 */
const figure = (title, caption, body) =>
  `<figure class="figure"><figcaption><b>${esc(title)}</b><span>${esc(caption)}</span></figcaption>${body}</figure>`

/*
 * Grid to flag (PD-30), drawn: charts/GridFlag.jsx's elements and classes,
 * from the layout charts/gridFlag.js gives both renderers, at the width the
 * app draws at before it has measured. The first chart this half draws
 * rather than tabulates, which it can only because the layout is a function
 * of the rows and not of a DOM. Every string in it is escaped; the numbers
 * are numbers the layout rounded.
 *
 * The static drawing does not re-measure. It keeps the size it was laid out
 * at rather than stretching, which would set its text half as large again
 * in a 1,000 px column (`.grid-flag-static` in app.css); below 640 px it
 * scales down, text with it, until the app replaces it at the width it
 * occupies. The table under it is the same at every width.
 */
const gridFlagSvg = (layout, label) => {
  if (!layout) return ''
  const t = (cls, x, y, value, extra = '') =>
    `<text class="${cls}" x="${x}" y="${y}"${extra}>${esc(value)}</text>`
  const mid = ' dominant-baseline="middle"'
  return `<div class="plot-holder"><svg class="grid-flag grid-flag-static" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${esc(label)}">${layout.ticks
    .map(
      (tick) =>
        `<g><line class="grid-line" x1="${tick.x}" x2="${tick.x}" y1="${layout.top}" y2="${layout.bottom}"/>${t(
          'axis-text',
          tick.x,
          layout.tickY,
          tick.value,
          ' text-anchor="middle"',
        )}</g>`,
    )
    .join('')}${t('axis-text', (layout.start + layout.finish) / 2, layout.axisY, GRID_FLAG_HEADS.axis, ' text-anchor="middle"')}${t(
    'axis-text',
    layout.gridX,
    layout.headY,
    GRID_FLAG_HEADS.grid,
    ' text-anchor="end"',
  )}${t('axis-text', layout.labelX, layout.headY, GRID_FLAG_HEADS.result)}${layout.cars
    .map(
      (car) =>
        `<g class="${car.out ? 'flag-car flag-out' : 'flag-car'}">${t('axis-text', layout.gridX, car.y1, car.grid, ` text-anchor="end"${mid}`)}` +
        `<line class="flag-line" x1="${car.x1}" y1="${car.y1}" x2="${car.x2}" y2="${car.y2}"/>` +
        `<circle class="flag-start" cx="${car.x1}" cy="${car.y1}" r="2.5"/>` +
        (car.leader ? `<line class="flag-leader" x1="${car.leader.from}" y1="${car.y2}" x2="${car.leader.to}" y2="${car.y2}"/>` : '') +
        (car.out
          ? `<path class="flag-cross" d="${crossPath(car.x2, car.y2)}"/>`
          : `<circle class="flag-end" cx="${car.x2}" cy="${car.y2}" r="2.5"/>`) +
        `${t('axis-text flag-result', layout.labelX, car.y2, car.result, mid)}${t('flag-name', layout.nameX, car.y2, car.name, mid)}</g>`,
    )
    .join('')}</svg></div>`
}

// The circuit outlines (AF-03), as components/Outline.jsx draws them: F1DB's
// path in its 500-unit box, the current ink, a constant stroke. The path is
// SVG path data and nothing else - build.py and verify.py both refuse any
// other character - and is escaped here all the same.
//
// AX-25: an SVG with a viewBox and no width or height is sized by its
// containing block, so before app.css arrives the race page's outline drew
// itself 1,236 px square and pushed the classification off the screen - and
// the register's grid would have done it 79 times over. The attributes give
// it an intrinsic size in that window; app.css (`.outline { width: 100% }`)
// beats a presentation attribute, so nothing about the styled page changes.
// The app's own Outline needs none: React mounts after the stylesheet.
const OUTLINE_PX = 200
const outlineSvg = (path, label) =>
  path
    ? `<svg class="outline" width="${OUTLINE_PX}" height="${OUTLINE_PX}" viewBox="${OUTLINE_VIEWBOX}"${
        label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'
      }><path d="${esc(path)}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`
    : ''
const outlineCard = (path, circuit, layoutId, caption, rule = false) =>
  path
    ? `<figure class="outline-card">${outlineSvg(path, outlineLabel(circuit, layoutId))}<figcaption>${esc(caption)}<br><span class="faint">${esc(OUTLINE_BY)}</span>${
        rule ? `<br><span class="faint">${esc(OUTLINE_RULE)}</span>` : ''
      }</figcaption></figure>`
    : ''
// A confidence tier as components/Page.jsx's Confidence draws it: the pill,
// linked to the page that says what the tier means.
const confidencePill = (value) =>
  value
    ? `<a class="pill pill-${esc(String(value).toLowerCase())}" href="${esc(href('data/quality'))}" title="${esc(
        `Confidence tier "${value}" - what it means, on the quality page`,
      )}">${esc(value)}</a>`
    : ''
// A circuit's layouts as one list, as Circuit.jsx draws it (IX-32): each
// timeline row beside the drawing it names, from the same layoutTimeline, so
// the static page carries the register's history (AF-08) in the app's shape
// rather than the two lists the app used to draw. PD-60: a strip of the rows
// first, and the cards behind a disclosure, closed, as the app has them.
const layoutRows = (circuit, entries) =>
  `<ol class="layout-strip">${entries
    .map((entry) => `<li><span class="years">${esc(timelineYears(entry))}</span> ${esc(timelineName(entry))}</li>`)
    .join('')}</ol><details class="layout-cards"><summary>${esc(LAYOUT_CARDS)}</summary><div class="timeline layout-timeline">${entries
    .map(
      (entry) =>
        `<article>${
          entry.outline
            ? outlineCard(entry.outline.path, circuit, entry.outline.f1db_layout_id, outlineCaption(entry.outline))
            : `<p class="outline-none">${esc(NO_DRAWING)}</p>`
        }<div><h3>${esc(timelineName(entry))}<span class="years">${esc(timelineYears(entry))}</span>${
          entry.layout?.length_km ? `<span class="years">${esc(entry.layout.length_km)} km</span>` : ''
        }${entry.layout ? confidencePill(entry.layout.confidence) : ''}</h3>${
          entry.layout?.change_reason ? `<p>${esc(entry.layout.change_reason)}</p>` : ''
        }</div></article>`,
    )
    .join('')}</div></details>`
// The winner's colour bar under a run round, as components/Outline.jsx draws
// it: the same properties on the same element, so the static strip and the
// app's agree (AF-04). One value, both themes, since AF-16 stopped moving a
// livery hex with the theme; app.css derives the mark's edge from it.
//
// The properties come from markStyleAttr, not from a `--livery:` written out
// here: AF-17 added a second one, and a spelled-out attribute would have
// given the app the scheme and the static page the primary.
const liveryMark = (colour) =>
  colour
    ? `<i class="livery" style="${esc(markStyleAttr(colour))}" title="${esc(colour.title)}" aria-hidden="true"></i>`
    : ''
const winnerMark = (round, year) => liveryMark(winnerColour(round, year))
const outlineStrip = (year, calendar) => {
  if (!calendar.some((round) => round.outline)) return ''
  const states = roundStates(calendar)
  return `<div class="outline-strip-wrap"><ol class="outline-strip" aria-label="${esc(stripLabel(year))}">${calendar
    .map(
      (round, i) =>
        `<li data-state="${states[i]}"><a href="${esc(href(`races/${year}/${round.round}`))}">${
          round.outline ? outlineSvg(round.outline, null) : '<span class="outline outline-none" aria-hidden="true"></span>'
        }${winnerMark(round, year)}<b>R${round.round}</b><span>${esc(roundShortName(round.name_used))}</span><small>${esc(STATE_WORDS[states[i]])}</small></a></li>`,
    )
    .join('')}</ol><p class="faint outline-strip-note">${esc(OUTLINE_RULE)} ${esc(OUTLINE_BY)}.</p></div>`
}

/** A sentence trimmed to something a search result will not cut mid-word. */
const summarise = (value, limit = 160) => {
  const flat = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) return flat
  // Cut at the last sentence end that fits, so a description never breaks
  // off mid-thought - Chris Amon's used to end on "Widely held to be the fi…".
  // A word boundary with an ellipsis is the fallback, for a single sentence
  // longer than half the room.
  const sentence = flat.lastIndexOf('. ', limit - 1)
  if (sentence >= limit / 2) return flat.slice(0, sentence + 1)
  return `${flat.slice(0, flat.lastIndexOf(' ', limit - 1))}…`
}

const list = (values) => values.filter(Boolean).join(', ')

/**
 * A recorded source disagreement, rendered beside the fact it is about.
 *
 * `discrepancies` is one of the few tables this project originates rather than
 * re-exports, and it is the reason to prefer this database over its upstream:
 * where two sources differ and neither can be checked officially, both readings
 * are kept. Aggregated on one methodology page it is a footnote; beside the
 * fact it is a property of the product.
 *
 * Both values are shown because neither has been established as the right one.
 * Naming one correct here would be exactly the silent pick the table exists to
 * avoid. Markup and class names match components/Disagreement.jsx, so the static
 * page and the app render the same thing.
 */
const disagree = (rows, what) => {
  if (!rows.length) return ''
  // The same two readings as the app's Disagreement component: explained
  // rows - a span the register and the records define differently (CD-25) -
  // are introduced as readings, open ones as a disagreement to settle.
  const explained = allExplained(rows)
  return `<aside class="disagreement" aria-label="${explained ? 'Two readings, both recorded' : 'Recorded source disagreement'}">
    <h2>${
      explained
        ? `Two readings of ${esc(what)}, each right about something`
        : rows.length === 1
          ? `Two sources disagree about ${esc(what)}`
          : `Two sources disagree about ${esc(what)}, in ${rows.length} places`
    }</h2>
    <dl>${rows
      .map(
        (d) => `<div><dt>${esc(String(d.field ?? '').replace(/_/g, ' '))}</dt><dd>
          <p class="disagreement-pair num"><span>${esc(d.stored_value)}</span><span class="disagreement-vs">against</span><span>${esc(d.derived_value)}</span></p>
          <p class="disagreement-why">${esc(d.assessment)}</p>
        </dd></div>`,
      )
      .join('')}</dl>
    <p class="source-note">${
      explained ? EXPLAINED_FOOTER : OPEN_FOOTER
    }${link('data/quality', 'the quality page')}.${
      explained ? '' : ` ${esc(SETTLE_ASK)}<a href="${esc(REPORT_URL)}">${esc(SETTLE_LINK)}</a>.`
    }</p>
  </aside>`
}

// ------------------------------------------------------------------ chrome

/**
 * The masthead and footer, as static markup.
 *
 * They are here so a prerendered page looks like a page rather than like a
 * fragment, and — more usefully — so every entity page carries links to the
 * eight section indexes. That is what gives a crawler somewhere to go from a
 * page it reached out of a sitemap.
 */
const NAV = [
  ['seasons', 'Seasons'],
  ['races', 'Races'],
  ['drivers', 'Drivers'],
  ['constructors', 'Constructors'],
  ['circuits', 'Circuits'],
  ['cars', 'Cars'],
  ['records', 'Records'],
  ['data', 'Data'],
]

const chrome = (body, crumbs, citeUrl, sources = null) => `
<div class="app pre">
  <a class="skiplink" href="#main">Skip to content</a>
  <header class="masthead">
    <div class="masthead-inner">
      <a class="wordmark" href="${esc(href(''))}"><span><b>Lap Ledger</b><span>${SPAN} · every championship race</span></span></a>
      <nav>${NAV.map(([to, label]) => link(to, label)).join('')}</nav>
    </div>
  </header>
  <main id="main" tabindex="-1">
    ${crumbs ? `<nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>` : ''}
    ${body}
    ${
      citeUrl
        ? `<aside class="cite" aria-label="How to cite this page"><p>${citation(META.version, META.built, MANIFEST.digest, citeUrl)
            .split(citeUrl)
            .map(esc)
            .join(`<span class="url">${esc(citeUrl)}</span>`)}</p>${
            // The sources behind the rows, the app's Cite paragraph (CD-08).
            (() => {
              const behind = behindThisPage(sources)
              return behind
                ? `<p>${esc(behind.before)}${link('data/sources', SOURCES_LINK)}${esc(behind.after)}</p>`
                : ''
            })()
          }</aside>`
        : ''
    }
  </main>
  <footer class="sitefoot"><div class="sitefoot-inner"><div>
    <p>${esc(IN_THIS_TAB)} ${esc(COUNTED_TOTALS)} ${link('data/quality', 'How far to trust it')} · ${link('data/sources', 'sources')} · ${link('data/sql', 'write your own query')} · ${link('changes', 'what changed')} · ${link('about', 'who publishes this')}.</p>
    <p>${esc(REPORT_ASK)} <a href="${esc(REPORT_URL)}">${esc(REPORT_LINK)}</a>. ${esc(REPORT_PROMISE)}</p>
    <p class="faint">Race data from <a href="https://github.com/f1db/f1db">F1DB</a> (CC BY 4.0), prose and registers from Wikipedia (CC BY-SA 4.0), circuit geometry © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL 1.0). ${esc(OUTLINE_CREDIT)}. Unaffiliated with Formula One, the FIA or any team.</p>
  </div><dl><dt>Database</dt><dd>v${esc(META.version)}</dd><dt>Built</dt><dd>${esc(META.built)}</dd><dt>${esc(CHECKED_LABEL)}</dt><dd>${esc(LAST_CHECKED)}</dd><dt>Digest</dt><dd><code>${esc(MANIFEST.digest)}</code></dd></dl></div></footer>
</div>`

/**
 * The onward band and the step sideways, as HTML.
 *
 * Page.jsx's <Onward> and <Stepper>, element for element and class for class,
 * so app.css draws one design rather than two and the static page does not
 * change shape when the database opens. The items are lib/wayfinding.js's —
 * this writes them, it does not choose them.
 */
const onwardBand = ({ title = 'Keep going', items }) => {
  const shown = items.filter(Boolean)
  if (!shown.length) return ''
  return `<nav class="onward" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div>${shown
    .map(
      ({ to, label, hint }) =>
        `<a href="${esc(href(to))}"><b>${esc(label)}</b>${hint ? `<span>${esc(hint)}</span>` : ''}</a>`,
    )
    .join('')}</div></nav>`
}

const side = (step, arrow) =>
  step ? `<a href="${esc(href(step.to))}">${arrow === 'left' ? `← ${esc(step.label)}` : `${esc(step.label)} →`}</a>` : '<span></span>'

const stepperNav = ({ previous, next }) =>
  previous || next
    ? `<nav class="stepper" aria-label="Neighbouring pages">${side(previous, 'left')}${side(next, 'right')}</nav>`
    : ''

const crumbs = (trail) =>
  trail
    .map(([path, label], i) =>
      i === trail.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : link(path, label),
    )
    .join('<span class="sep">/</span>')

/**
 * Who a machine is told publishes this, in one object read by both pages
 * that say so.
 *
 * /data's Dataset named an Organization after the site, on a database one
 * person builds, and /about now says in prose that it is one person - so a
 * structured-data reader was being given two answers to the question this
 * item exists to answer once. The url is /about, because that is where the
 * answer is written out for a reader.
 */
const PUBLISHED_BY = { '@type': 'Person', name: MAINTAINER, url: `${ORIGIN}${href('about')}` }

// ------------------------------------------------------------------- pages

const pages = []

/*
 * SD-19: what a page's `lastmod` is.
 *
 * Every URL in the sitemap used to carry `meta.built`, so 3,539 pages claimed
 * to have last changed on the same day and a crawler was given no reason to
 * come back to any one of them sooner than the rest. In fact they move at
 * wildly different rates: a 1954 race page is finished, and the page for the
 * season being run moves every other weekend.
 *
 * So an entity page is dated by the last race it actually describes, and the
 * indexes and the static routes — whose content is a view over the whole
 * database rather than over one entity — keep the build date.
 *
 * Not by making `BUILT` a real timestamp: that is [D-01], measured and
 * rejected, and the database stays a pure function of its sources.
 */
const BUILT = ISO_DAY.test(META.built ?? '') ? META.built : new Date().toISOString().slice(0, 10)

/**
 * A page's own date, never later than the build.
 *
 * The calendar holds rounds out to 2027, and a `lastmod` in the future is a
 * date the file cannot have been written on — crawlers discard a sitemap that
 * carries them. The page for a round still to be run genuinely does change
 * with every build, so the build date is the honest answer for it.
 */
const stamp = (date) => (ISO_DAY.test(date ?? '') && date < BUILT ? date : BUILT)

/**
 * The clock the static half reads (AF-01).
 *
 * A page a crawler fetches has to be a pure function of the database, the
 * same rule [D-01] keeps `BUILT` a constant for — so "now" here is the start
 * of the database's own build day and not the machine's clock, and two
 * deploys of one database write the same bytes. It is the conservative
 * reading on purpose: a race run since the build still reads as awaited in
 * the static page, and the app, which has a real clock, corrects the sentence
 * the moment the database opens in the browser.
 */
const STATIC_NOW = Date.parse(`${BUILT}T00:00Z`)

/**
 * id -> the date of the most recent race that entity has already had.
 *
 * One aggregate per family rather than a date threaded through every page's
 * own query: what dates a page is the date of a race, and `races.date_iso` is
 * the only place that lives. `date_iso <= BUILT` is what makes it a race that
 * has been run, which is why a season part-way through is dated by its last
 * completed round and not by a December fixture.
 */
const runDates = (sql) => new Map(all(sql, BUILT).map((r) => [String(r.key), r.d]))

const LAST_RUN = {
  season: runDates(
    `SELECT year AS key, MAX(date_iso) AS d FROM races WHERE date_iso <= ? GROUP BY year`,
  ),
  circuit: runDates(
    `SELECT circuit_id AS key, MAX(date_iso) AS d
       FROM races WHERE date_iso <= ? AND circuit_id IS NOT NULL GROUP BY circuit_id`,
  ),
  grandPrix: runDates(`SELECT gp_id AS key, MAX(date_iso) AS d FROM races WHERE date_iso <= ? GROUP BY gp_id`),
  driver: runDates(
    `SELECT e.driver_id AS key, MAX(r.date_iso) AS d
       FROM race_entries e JOIN races r ON r.id = e.race_id
      WHERE r.date_iso <= ? GROUP BY e.driver_id`,
  ),
  constructor: runDates(
    `SELECT e.constructor_id AS key, MAX(r.date_iso) AS d
       FROM race_entries e JOIN races r ON r.id = e.race_id
      WHERE r.date_iso <= ? AND e.constructor_id IS NOT NULL GROUP BY e.constructor_id`,
  ),
  // /cars/<id> is one route over two registers, and which entries a page
  // shows is not `race_entries.car_id`: `ENTRIES` in queries/car.js resolves
  // the id through `chassis` — one chassis where the id is a chassis, every
  // chassis of the design where it is a curated car no chassis shares an id
  // with — and the join below is that same resolution. Keying on the entry's
  // own columns instead dated six pages by a race they do not show, three of
  // them by a later car of the same lineage.
  car: runDates(
    `SELECT p.id AS key, MAX(r.date_iso) AS d
       FROM (SELECT id FROM chassis UNION SELECT id FROM cars) p
       JOIN chassis ch
         ON ch.id = p.id
         OR (ch.car_id = p.id AND NOT EXISTS (SELECT 1 FROM chassis x WHERE x.id = p.id))
       JOIN race_entries e ON e.chassis_id = ch.id
       JOIN races r ON r.id = e.race_id
      WHERE r.date_iso <= ?
      GROUP BY p.id`,
  ),
}


// ------------------------------------------------------- photographs, cards

/*
 * A page has two pictures to settle, and they are the same picture.
 *
 * PD-19: 757 chassis pages join to a Wikimedia Commons photograph and the
 * static half of the site showed none of them, so `curl /cars/mclaren-mp4-4 |
 * grep -c "<img"` answered 0 — a crawler, a reader with no JavaScript and a
 * model reading the page all got a specification with no machine in it.
 *
 * PD-20: none of the 3,515 pages carried an `og:image`, so every link to this
 * project ever posted anywhere rendered as a grey box.
 *
 * Both are answered by the same row of `article_images`, which is why they are
 * one change: the photograph the page shows is the photograph a shared link
 * shows.
 */

/** An external link, as CommonsImage writes it. */
const outbound = (url, label) =>
  `<a href="${esc(url)}" target="_blank" rel="noreferrer noopener">${esc(label)}</a>`

/**
 * One photograph and its credit, as CommonsImage draws it.
 *
 * The markup is CommonsImage's markup — `figure.photo`, the optional subject
 * line, the caption's three parts in the same order — because app.css styles
 * it and because the reader who sees this before the database opens should
 * not watch the page change shape when it does. What it does NOT restate is
 * the licence rule: the credit comes from `attribution()` and the figure is
 * only reached through `canShow()`, so this renderer and the app's cannot
 * disagree about who is owed a credit. Nor does it restate what the picture
 * is OF: `photoAlt()` decides the alt in both (AX-13), which is the only
 * reason the two cannot drift back to captioning a car ".jpg". The `data-state` attribute is CommonsImage's own and is
 * absent here on purpose — there is no React to move it through loading,
 * ready and failed, and a static page claiming "loading" for ever would be a
 * worse answer than none.
 */
const photograph = (image, width, caption = null, alt = caption, checks = true) => {
  const title = fileTitle(image.file_name)
  const licence = (image.licence ?? '').trim()
  const size = image.width && image.height ? ` width="${esc(image.width)}" height="${esc(image.height)}"` : ''
  return `<figure class="photo">
        <img src="${esc(thumbUrl(image, width))}" alt="${esc(photoAlt(image, alt))}"${size} loading="lazy" decoding="async" />
        <figcaption>${caption ? `<div class="photo-subject">${esc(caption)}</div>` : ''}${outbound(image.description_url, title)} · ${esc(attribution(image))} · ${
          image.licence_url ? outbound(image.licence_url, licence) : esc(licence)
        }${checks && image.name_matches === 0 ? ` · <span class="pill pill-unverified">${esc(UNCHECKED_MARK)}</span>` : ''}</figcaption>
      </figure>`
}

/**
 * The caption as plain words — the same three parts, in the same order.
 *
 * This is what travels with the picture when the picture leaves the page. An
 * unfurler fetches the file named in `og:image` and draws it in its own feed
 * with none of the markup around it, so the caption it can carry is
 * `og:image:alt` and nothing else. Built from the same `attribution()` as the
 * figcaption, because a credit that differs between the page and the card is
 * two answers to the licence question again.
 */
const creditLine = (image) =>
  `${fileTitle(image.file_name)} · ${attribution(image)} · ${(image.licence ?? '').trim()}`

/**
 * The width asked of Commons for the share card.
 *
 * Special:FilePath never upscales, so a narrower original simply comes back at
 * its own size; 1200 is the width every platform documents as the one that
 * needs no cropping, and asking for it costs nothing where the file is smaller.
 * It is wider than the stored `thumb_url` (THUMB_WIDTH in lib/commons.js), so
 * the card keeps the Special:FilePath address: its redirects are paid by an
 * unfurler fetching it once, not by a reader waiting on the page.
 */
const CARD_WIDTH = 1200

/**
 * The photographs section, and the card the page's link will carry.
 *
 * The images are the app's images: `IMAGES` from queries/car.js, run with the
 * same two arguments Car.jsx passes it, so the static section holds the rows
 * the app holds rather than a second selection that could differ. They are
 * filtered through `canShow()` BEFORE the count, because a section headed
 * "Photographs 1" over an empty grid is what an unfiltered count gives the day
 * a file arrives with nobody to credit.
 *
 * Only a `name_matches = 1` photograph becomes the card. `name_matches = 0`
 * means the file name does not name the car, and while most of those are still
 * the right car filed under the driver, one of them leads its article with a
 * picture of police officers. On the page that is a labelled risk the reader
 * can see; on a share card it is the whole impression, unlabelled, in somebody
 * else's feed.
 */
/**
 * The photographs section itself, as components/Photographs.jsx draws it.
 *
 * VD-33 gave the section to the constructor, season and race pages, which
 * already join chassis, so what was one call site is four. The app draws them
 * from one component and this draws them from one function, off the same
 * queries and the same strings: the six a page shows, the subject each one is
 * of where the page is showing several cars, and the caveat.
 *
 * `subjects` is what the app's `subjects` prop is — the car a photograph is
 * of, above its credit. A car page needs none: the page is that car. The
 * rest are the app's props too (PD-64): `title` and `note` say what the
 * photographs are, `alt` describes one with no subject line, `checks` is
 * false where the `unchecked` mark's question is not one the rows answer,
 * and `more` links everything their category holds. Every photograph past
 * the six sits in the same closed disclosure Photographs.jsx draws.
 */
const photographSection = (
  rows,
  {
    subjects = false,
    width = PHOTOGRAPH_WIDTH,
    title = 'Photographs',
    note: lede = PHOTOGRAPHS_NOTE,
    alt = null,
    checks = true,
    more = null,
  } = {},
) => {
  const images = rows.filter(canShow)
  if (!images.length) return ''
  const drawn = images.slice(0, PHOTOGRAPHS_SHOWN)
  const rest = images.slice(PHOTOGRAPHS_SHOWN)
  const figures = (list) =>
    list.map((image) => photograph(image, width, subjects ? image.article : null, alt ?? (subjects ? image.article : null), checks)).join('')
  // Where the mark is, as Photographs.jsx decides it: under the strip when
  // the six DRAWN carry one - a caveat explaining a mark nowhere in sight
  // explains nothing - and inside the disclosure when only its photographs
  // do. A caveat in one renderer and not the other is worse than either.
  const marked = (list) => checks && list.some((image) => image.name_matches === 0)
  const unchecked = `\n      <p class="source-note">${esc(UNCHECKED_NOTE[0])} <span class="pill pill-unverified">${esc(
    UNCHECKED_MARK,
  )}</span> ${esc(UNCHECKED_NOTE[1])}</p>`
  return `<h2>${esc(title)}</h2>
      <p class="note">${esc(lede)}</p>
      <div class="photo-grid">${figures(drawn)}</div>${marked(drawn) ? unchecked : ''}${
        rest.length
          ? `\n      <details class="photo-more"><summary>${esc(photographsMore(rest.length))}</summary><div class="photo-grid">${figures(
              rest,
            )}</div>${!marked(drawn) && marked(rest) ? unchecked : ''}</details>`
          : ''
      }${more ? `\n      <p class="source-note">${outbound(more.href, more.label)}</p>` : ''}`
}

/**
 * A race page's two strips, as Race.jsx draws them (PD-64): the race's own
 * photographs under a heading that says they are of this race, then the
 * cars entered under one that says they are the cars.
 */
const raceStrips = (r) => {
  const own = all(RACE_PHOTOGRAPHS, r.year, r.round)
  const category = own[0]?.category
  return `${photographSection(own, {
    title: RACE_PHOTOGRAPHS_TITLE,
    note: RACE_PHOTOGRAPHS_NOTE,
    alt: racePhotographAlt(r.year, r.name_used),
    checks: false,
    more: category ? { href: categoryUrl(category), label: raceCategoryLink(category) } : null,
  })}
        ${photographSection(all(RACE_IMAGES, r.year, r.round), {
          subjects: true,
          title: RACE_CARS_TITLE,
          note: RACE_CARS_NOTE,
        })}`
}

const photographs = (id) => {
  const images = all(CAR_IMAGES, id, id).filter(canShow)
  if (!images.length) return { html: '', image: null }
  const confirmed = images.slice(0, PHOTOGRAPHS_SHOWN).find((image) => image.name_matches === 1) ?? null
  return {
    html: photographSection(images),
    image: confirmed
      ? { url: thumbUrl(confirmed, CARD_WIDTH), alt: creditLine(confirmed) }
      : null,
  }
}

/* ------------------------------------------------------------------------ *
 * The card every other page carries.
 *
 * WHY IT IS A PNG AND NOT AN SVG
 *     The item proposed a per-route SVG card, written at build time for
 *     essentially nothing. It would have shipped a grey box. No major
 *     unfurler rasterises SVG: LinkedIn, X, Facebook, WhatsApp, Slack and
 *     Discord all take PNG, JPEG, GIF or WebP and silently drop anything else,
 *     several of them explicitly because an SVG can carry script. An og:image
 *     nobody renders is the defect PD-20 already describes.
 *
 * WHY IT CARRIES NO TEXT
 *     Rasterising a per-route card means rasterising type, and type means a
 *     font engine — a dependency this build does not have and should not take
 *     for a share card. Every unfurler prints the title and the description
 *     beside the image from the tags three lines above this one, so the card's
 *     job is to be this site rather than to repeat them. What is left is the
 *     mark: the chequered field from the tab icon, one cell in accent, drawn
 *     from rectangles. A per-route card with the page's own figures is a
 *     separate item and a separate decision about that dependency.
 * ------------------------------------------------------------------------ */

const CARD = { file: 'share-card.png', width: 1200, height: 630 }
const CARD_FIELD = '#14161b'
const CARD_CELL = '#ffffff'
const CARD_ACCENT = '#c81028'

/* CRC-32, which is what a PNG checks each chunk with. */
const CRC = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

const crc32 = (buffer) => {
  let c = -1
  for (let i = 0; i < buffer.length; i += 1) c = CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const check = Buffer.alloc(4)
  check.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, check])
}

const channels = (hex) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]

/**
 * A PNG of solid rectangles — the whole of the image model this needs.
 *
 * Truecolour, eight bits, filter 0 on every scanline: the simplest encoding
 * the format defines, which is the right one for an image of eleven
 * rectangles. `deflateSync` writes the zlib stream and its Adler-32, so the
 * only checksum left to compute is the chunk CRC above.
 */
const pngOfRectangles = (width, height, background, rectangles) => {
  const stride = 1 + width * 3
  const raw = Buffer.alloc(height * stride)
  const paint = (x, y, w, h, hex) => {
    if (x < 0 || y < 0 || x + w > width || y + h > height) die(`share card: ${x},${y} ${w}x${h} falls outside the canvas`)
    const [r, g, b] = channels(hex)
    for (let row = y; row < y + h; row += 1) {
      const base = row * stride + 1
      for (let column = x; column < x + w; column += 1) {
        const at = base + column * 3
        raw[at] = r
        raw[at + 1] = g
        raw[at + 2] = b
      }
    }
  }
  paint(0, 0, width, height, background)
  for (const r of rectangles) paint(r.x, r.y, r.w, r.h, r.fill)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type 2: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * The mark, at card size.
 *
 * The eight cells and the accent's position are the tab icon's, cell for cell
 * (index.html), so the card and the favicon are one mark and not two. The
 * accent bar along the bottom is the rule the masthead carries above a tile.
 */
const shareCard = () => {
  const cell = 96
  const field = cell * 4
  const left = (CARD.width - field) / 2
  const top = (CARD.height - field) / 2
  const CELLS = [
    [0, 0], [2, 0],
    [1, 1], [3, 1],
    [0, 2], [2, 2, true],
    [1, 3], [3, 3],
  ]
  return pngOfRectangles(CARD.width, CARD.height, CARD_FIELD, [
    ...CELLS.map(([column, row, accent]) => ({
      x: left + column * cell,
      y: top + row * cell,
      w: cell,
      h: cell,
      fill: accent ? CARD_ACCENT : CARD_CELL,
    })),
    { x: 0, y: CARD.height - 12, w: CARD.width, h: 12, fill: CARD_ACCENT },
  ])
}

/** What a page carries when it has no photograph of its own — which is most of them. */
const SITE_CARD = {
  url: `${ORIGIN}${href(CARD.file)}`,
  alt: `${SITE}: a chequered field with one cell marked in red`,
  width: CARD.width,
  height: CARD.height,
}

/**
 * Queue one route.
 *
 * `path` is relative to the base and carries no leading slash; '' is the home
 * page. `jsonld` is an object or null — one script tag per page, because a
 * search engine reading two of them for the same thing is a warning nobody
 * needs. `image` is the page's own photograph where it has one, and the site
 * card where it does not: every page carries one, which is the whole of PD-20.
 * `lastmod` is the page's own date for the sitemap — the last race it
 * describes — and defaults to the build date, which is the right answer for
 * an index or a static route and the only answer for anything undated.
 */
/**
 * Give every static table the name the app's DataTable gives it (AX-17).
 *
 * A <caption> is how a table tells assistive technology what it holds, and no
 * table in this half had one: entering the 862 rows of /drivers with a screen
 * reader announced "table, 10 columns, 862 rows" and nothing else. The app
 * takes that name from the heading that introduces the table - the enclosing
 * Section's, or failing that the page's h1 - so this takes it from the same
 * heading in the same position, and the two halves cannot drift apart or from
 * the heading a reader can see. The alternative, a caption written out at each
 * of the forty-six call sites, is forty-six strings that can each drift from
 * the h2 on the line above it.
 *
 * sr-only, as the app's is, because that heading is right there to be read.
 *
 * A regex over markup this file generated a few lines earlier, not over
 * markup from anywhere else: table() emits a bare `<table>` and headings are
 * written as literal tags, so the two are unambiguous here in a way they
 * would not be in general.
 */
const nameTables = (body) => {
  let heading = ''
  // A table that already names itself - a figure's, named for the figure as
  // the app's is - keeps its caption.
  const named = body.replace(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>|<table>(?!<caption)/g, (match, text) => {
    if (text === undefined) {
      return heading ? `<table><caption class="sr-only">${heading}</caption>` : match
    }
    // The heading's own markup - a faint span of years, a link - is not part
    // of its name; the entities esc() wrote stay as they are. The count goes
    // with its contents: the app names a table from the Section's TITLE
    // (SectionTitle in components/Page.jsx), which the count is not, so
    // keeping it here would have a screen reader hear "Open gaps 10" on one
    // half of the site and "Open gaps" on the other.
    heading = text
      .replace(/<span class="count">[\s\S]*?<\/span>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return match
  })
  // The claim is the build's, not a sample's. The smoke suite compares the two
  // halves on the forty routes it visits; this covers all 3,540 pages, and the
  // way to leave a table unnamed is to write one above the page's first
  // heading - which is a body worth stopping for rather than shipping.
  if (/<table>(?!<caption)/.test(named)) die('prerender: a table with no heading above it, so no caption')
  return named
}

/**
 * The static page in the app's own shapes.
 *
 * Every route's body below is written the way a page in the app is built:
 * a heading, a standfirst, then a run of <h2>-led blocks. In the app that
 * is a <Page> and a run of <Section>s (components/Page.jsx). The static
 * half said the same thing in a second vocabulary — a bare h1, bare h2s,
 * bare sections — and app.css carried its own treatment for each of them,
 * a hundred-odd lines describing a design that existed on no other surface
 * (VD-01). So the reader who arrived before the database opened was shown
 * one design and then, silently, another.
 *
 * This puts the app's class names on the markup this file already writes,
 * and nothing else: `.page`, its `<header>`, and a `.section` per block.
 * One set of rules then draws both halves, and neither can drift.
 *
 * The h1 and the lede move into the header exactly as written and still
 * adjacent — smoke.mjs reads that pair straight out of the HTML, and the
 * pair is also what PD-16 put there.
 *
 * A body that already opens on its own top-level <section> — the eras page,
 * which is a run of eras before it is a run of tables — carries the class
 * itself and is left alone; wrapping it would nest a section in a section
 * for no gain.
 */
// A race page's session-sheets disclosure (PD-57) also starts a block: it
// has no h2 of its own at this depth, and Race.jsx renders it as a section
// beside the others rather than inside the one before it.
const SECTIONING = /<(\/?)(section|h2)\b|<details class="session-sheets">/g

const sectioned = (html) => {
  // A block starts at every h2 that is not already inside a section of its
  // own. Depth is counted because an era's <h2> sits inside the era's
  // <section> and is that section's heading, not the start of a new one.
  const starts = []
  let depth = 0
  // matchAll rather than exec in a loop: the regex is module-scoped and
  // global, so a loop would carry its lastIndex from one page into the next.
  for (const match of html.matchAll(SECTIONING)) {
    if (match[2] === 'section') depth += match[1] ? -1 : 1
    else if (!match[1] && depth === 0) starts.push(match.index)
  }
  // What comes before the first h2 is a block of its own — a strip of tiles
  // under the title is a titleless <Section> in the app too. A body whose
  // opening run is already its own sections (the eras page) carries the class
  // itself and is left as written, since nesting one in another gains nothing.
  const head = starts.length ? html.slice(0, starts[0]) : html
  const wrap = (part) => (part.trim() ? `<section class="section">${part}</section>` : '')
  return [
    head.includes('<section') ? head : wrap(head),
    ...starts.map((at, i) => wrap(html.slice(at, i + 1 < starts.length ? starts[i + 1] : html.length))),
  ].join('')
}

const structure = (body, tail = '') => {
  // The stepper belongs to the header, because <Page aside> renders it there:
  // a nav left in the body would be swept into the first section instead, and
  // the two halves would put the same two links in different places.
  // The circuit's photograph is the header's too (VD-62), for the same
  // reason: Circuit.jsx passes it as <Page aside>. Its wrapper closes on the
  // figure's own </figure>, which a photograph holds exactly one of.
  const opening = body.match(
    /^\s*(<h1\b[\s\S]*?<\/h1>)(\s*<p class="lede">[\s\S]*?<\/p>)?(\s*<nav class="stepper"[\s\S]*?<\/nav>)?(\s*<div class="page-photo">[\s\S]*?<\/figure>\s*<\/div>)?/,
  )
  if (!opening) die('prerender: a page body that does not open on an h1')
  return `<article class="page"><header>${opening[1]}${opening[2] ?? ''}${opening[3] ?? ''}${opening[4] ?? ''}</header>${sectioned(
    body.slice(opening[0].length),
  )}${tail}</article>`
}

const page = ({
  path,
  title,
  description,
  body,
  jsonld = null,
  trail = null,
  onward = null,
  image = null,
  lastmod = null,
  sources = null,
  // The page this one is a copy of, where it is one (IA-06): the canonical,
  // og:url and the citation name it, and the sitemap leaves this one out.
  canonical = null,
}) => {
  // The citation names the page by the address the canonical carries.
  pages.push({
    path,
    canonical: canonical ?? path,
    title,
    description,
    jsonld,
    image,
    lastmod: stamp(lastmod),
    html: chrome(
      nameTables(structure(body, onward ? onwardBand(onward) : '')),
      trail ? crumbs(trail) : '',
      `${ORIGIN}${href(canonical ?? path)}`,
      sources,
    ),
  })
}



// ------------------------------------------------------------------- home
//
// The home page, from src/queries/home.js - the same queries, figures,
// headings and sentences the app draws (PD-40, PD-48). What used to be here
// was a second home page about the same database: a different headline, a
// key/value list, the last ten champions, and nothing at all about the season
// being run. A reader who arrived cold read that one and then watched it be
// replaced, and a crawler indexed whichever half it was served.

{
  const shape = one(HOME_SHAPE)
  const seasons = all(PER_SEASON)
  const latest = one(LATEST_RUN)
  const upcoming = one(HOME_NEXT)
  // The season after this one, named only when this one is over.
  const after = one(NEXT_SEASON)?.year ?? null
  const now = one(SEASON_NOW)
  const lead = all(SEASON_LEAD)
  const { headline, title } = NAMES.home()

  // The winning car's colour, as Home.jsx takes it from the same row.
  const winner = latest
    ? colourForEntry({
        constructorId: latest.constructor_id,
        country: latest.constructor_country,
        year: latest.year,
        team: latest.constructor,
      })
    : null

  const lastPanel = `<div class="panel round-panel"><p class="eyebrow">${esc(LAST_RACE)}</p>${
    latest
      ? `<h3>${link(`races/${latest.year}/${latest.round}`, `${latest.year} ${latest.name_used}`)}</h3>
        <p class="muted small">${esc([latest.circuit, raceDates(latest)].filter(Boolean).join(' \u00b7 '))}</p>
        <p>${esc(WON_BY)}${
          latest.winner_id ? link(`drivers/${latest.winner_id}`, latest.winner) : esc(UNRECORDED_WINNER)
        }${
          latest.constructor
            ? `${esc(WON_FOR)}${liveryMark(winner)}${
                latest.constructor_id
                  ? link(`constructors/${latest.constructor_id}`, latest.constructor)
                  : esc(latest.constructor)
              }`
            : ''
        }.</p>
        <p>${link(`races/${latest.year}/${latest.round}`, CLASSIFICATION_LINK)}</p>`
      : ''
  }</div>`

  // Both panels read `now`, and the block they sit in is drawn only where
  // there is a season being run, so neither is built without one.
  const nextPanel = !now
    ? ''
    : `<div class="panel round-panel"><p class="eyebrow">${esc(NEXT_RACE)}</p>${
    upcoming
      ? `<h3>${link(`races/${upcoming.year}/${upcoming.round}`, `${upcoming.year} ${upcoming.name_used}`)}</h3>
        <p class="muted small">${esc(`${raceDates(upcoming)} \u00b7 round ${upcoming.round}`)}</p>
        <p class="muted">${esc(stillToRunNote(now))}</p>
        <p>${link(`seasons/${upcoming.year}`, calendarLink(upcoming.year))}</p>`
      : `<p class="muted">${esc(seasonComplete(now.year))}</p>${
          after ? `<p>${link(`seasons/${after}`, calendarLink(after))}</p>` : `<p class="muted">${esc(NOTHING_SCHEDULED)}</p>`
        }`
  }</div>`

  const seasonBlock = now
    ? `${heading(seasonHeading(now.year))}
      ${tiles(seasonStrip(now, lead))}
      <div class="split">${lastPanel}${nextPanel}</div>
      <p class="season-more">${link(`seasons/${now.year}`, seasonLink(now.year))}</p>`
    : ''

  page({
    path: '',
    title,
    description:
      `Every championship race, classification, qualifying sheet and pit stop from ${SPAN_FROM} to ${SPAN_TO}, queried in your browser. Every figure traceable to a source; every blank an unestablished fact rather than a zero.`,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE,
      url: `${ORIGIN}${BASE}`,
      description:
        `A normalised, verifiable SQLite database of Formula One championship racing, ${SPAN}.`,
      license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    onward: ONWARD.home({ latest }),
    body: `
      <h1>${esc(headline)}</h1>
      <p class="lede">${esc(HOME_LEDE)}</p>
      ${tiles(homeStrip(shape))}
      ${seasonBlock}
      ${heading(BOARD_HEADING)}
      <p class="note">${esc(BOARD_NOTE)}</p>
      <div class="board">${BOARD.map(
        ({ to, label, count, blurb }) =>
          `<a href="${esc(href(to.replace(/^\//, '')))}"><b>${esc(label)}${
            count ? `<span class="n">${esc(number(shape[count]))}</span>` : ''
          }</b><p>${esc(blurb)}</p></a>`,
      ).join('')}</div>
      ${heading(CHART_HEADING)}
      ${figure(
        CHART_TITLE,
        chartNote(seasons),
        table(
          ['Season', 'Rounds'],
          seasons.map((row) => [link(`seasons/${row.year}`, row.year), num(row.rounds)]),
          { aligns: ['num', 'num'], rowHeaders: [true] },
        ),
      )}
      ${heading(READING_HEADING)}
      <p class="note">${esc(READING_NOTE)}</p>
      <div class="grid">${reading(shape)
        .map(
          ({ head, body, link: to }) =>
            `<div class="panel convention"><b>${esc(head)}</b><p class="muted small">${esc(body[0])}${
              to ? link(to.to.replace(/^\//, ''), to.text) : ''
            }${esc(body[1] ?? '')}</p></div>`,
        )
        .join('')}</div>`,
  })
}

// ---------------------------------------------------------------- seasons

{
  // The list and each season's page read web/src/queries/seasons.js and
  // season.js - the app's own queries, column lists and heading rule (PD-02,
  // rung two; IA-17) - so the two renderers cannot disagree about a row, a
  // column or whether the season is over.
  const seasons = all(SEASONS)
  const names = Object.fromEntries(all('SELECT id, full_name FROM drivers').map((d) => [d.id, d.full_name]))
  const teams = Object.fromEntries(all('SELECT id, name FROM constructors').map((c) => [c.id, c.name]))
  const driver = (id) => (id ? link(`drivers/${id}`, names[id] ?? id) : '—')
  const team = (id) => (id ? link(`constructors/${id}`, teams[id] ?? id) : '—')
  // A name as the app renders it: a link where it has an id, and after it
  // the undecided season's "so far" tag - the row is a leader, not a champion.
  const marked = (path, idKey) => (name, row) =>
    row.not_started
      ? tag(NOT_YET_RUN)
      : `${row[idKey] ? link(`${path}/${row[idKey]}`, name) : text(name)}${row.undecided && name ? ` ${tag(SO_FAR)}` : ''}`

  page({
    path: 'seasons',
    title: NAMES.seasons().title,
    description: `All ${seasons.length} FIA Formula One World Championship seasons, with the drivers' and constructors' champions, points and margin for each.`,
    trail: TRAIL.seasons(),
    onward: ONWARD.seasons(),
    body: `
      <h1>${esc(NAMES.seasons().headline)}</h1>
      <p class="lede">Every FIA Formula One World Championship season from 1950.</p>
      ${fromColumns(SEASONS_COLUMNS, seasons, {
        year: (year) => link(`seasons/${year}`, year),
        champion: marked('drivers', 'champion_id'),
        champion_team: (name, row) => (row.champion_team_id ? link(`constructors/${row.champion_team_id}`, name) : text(name)),
        runner_up: (name, row) => (row.runner_up_id ? link(`drivers/${row.runner_up_id}`, name) : text(name)),
        constructors_champion: marked('constructors', 'constructors_champion_id'),
      })}
      ${note(SEASON_LIST_FOOTER)}`,
  })

  for (const { year } of all('SELECT year FROM seasons ORDER BY year DESC')) {
    const s = one(SEASON, year)
    const neighbours = one(SEASON_NEIGHBOURS, year) ?? {}
    const calendar = all(CALENDAR, year)
    const final = all(FINAL, year)
    const driversFinal = final.filter((r) => r.table_type === 'drivers')
    const constructorsFinal = final.filter((r) => r.table_type === 'constructors')
    const entrants = all(ENTRANTS, year)
    const grid = one(GRID, year)
    const currentGrid = all(CURRENT_GRID, year)
    // The next round, on the page of the season being run only (PD-49): the
    // same row, sessions and past winners Season.jsx draws. No trace - f1.db
    // carries none, and only the browser merges f1-geometry.db in.
    const next = one(NEXT_ROUND, year)
    const nextSessions = next ? all(SEASON_SESSIONS, year).filter((row) => row.round === next.round) : []
    const wonHere = next ? all(WON_HERE, year) : []
    const nextSection = (() => {
      if (!next) return ''
      const line = nextLine(next)
      return `<h2>${esc(NEXT_HEADING)}</h2>
        <p class="measure">${esc(line.before)}${link(`races/${year}/${next.round}`, next.name_used)}${
          next.sprint ? ` ${tag(SPRINT)}` : ''
        }${esc(line.at)}${next.circuit_id && next.circuit ? link(`circuits/${next.circuit_id}`, next.circuit) : esc(line.circuit)}${esc(line.after)}</p>
        <div${next.outline ? ' class="with-outline"' : ''}><div>${
          nextSessions.length ? `${fromColumns(SESSION_COLUMNS, nextSessions)}<p class="source-note">${esc(TIMETABLE_NOTE)}</p>` : ''
        }</div>${outlineCard(
          next.outline,
          next.circuit,
          next.f1db_layout_id,
          outlineCaption({ f1db_layout_id: next.f1db_layout_id, length_km: next.outline_km, turns: next.outline_turns }),
          true,
        )}</div>
        <h2>${esc(WON_HERE_HEADING)}</h2>
        ${note(wonHereNote(next, wonHere))}
        ${fromColumns(WON_HERE_COLUMNS, wonHere, {
          year: (value) => link(`seasons/${value}`, value),
          name_used: (name, row) => link(`races/${row.year}/${row.round}`, name),
          winner: (name, row) =>
            row.winner_id && !String(name ?? '').includes(' / ') ? link(`drivers/${row.winner_id}`, name) : text(name),
          constructor: (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(name)),
        })}`
    })()
    // Two different questions, as on the app's page. `running`: is there a
    // champion yet? `live`: is there a round still to run? The first decides
    // what the page opens with; the second whether its headings say final.
    const running = !s.drivers_champion && driversFinal.length >= 2
    const live = stillRunning(calendar)
    const after = latestRound(all(SEASON_STANDINGS, year))
    const run = calendar.filter((r) => r.status === 'completed').length
    const [lead, second] = driversFinal
    const teamLead = constructorsFinal[0] ?? null
    const gap = running ? lead.points - second.points : null
    // A season nobody has raced yet: its champion slots are not unknown,
    // they are NOT YET RUN, and the app's page says so too (IA-17). Null
    // drivers on v_season_grid is the same distinction - a grid nobody has
    // published is not a grid of nobody - so the sentence is dropped rather
    // than made to count to zero.
    const notRun = run === 0
    // Why there is no constructors' table, where there is none — the app's
    // sentence, from the same module (CD-32).
    const noConstructors = noConstructorsNote(year, notRun)
    // The same sentence the app prints, from the same function and the same
    // rows (PD-28): who can still win the drivers' title, what is left to win
    // and the round and build date the answer stands at.
    const permutations = running
      ? titlePermutations({
          drivers: driversFinal,
          remaining: one(REMAINING, year),
          afterRound: after,
          built: META.built,
        })
      : null
    const entered =
      grid && grid.drivers !== null
        ? `${num(grid.drivers)} drivers, ${num(grid.constructors)} constructors, ${num(grid.engine_manufacturers)} engine makers — counted from the entries, whether or not they started`
        : notRun
          ? null
          : '—'

    // What leads (PD-58), in Season.jsx's order: a season with a round still
    // to run reads its calendar before standings that are not final yet, a
    // concluded one reads who won first. The grid, the photographs and the
    // entrants follow both.
    const seasonCalendar = `
  <h2>The calendar</h2>
  ${outlineStrip(year, calendar)}
  ${fromColumns(CALENDAR_COLUMNS, calendar, {
    name_used: (name, row) => `${link(`races/${year}/${row.round}`, name)}${row.sprint ? ` ${tag(SPRINT)}` : ''}`,
    circuit: (name, row) => (row.circuit_id ? link(`circuits/${row.circuit_id}`, name ?? row.circuit_id) : text(name)),
    winner: (name, row) =>
      row.status !== 'completed'
        ? tag(NOT_YET_RUN)
        : row.winner_id && !String(name ?? '').includes(' / ')
          ? link(`drivers/${row.winner_id}`, name)
          : text(name),
    // Nothing on a round still to come, as the app draws it: the
    // Winner cell beside it carries the "not yet run" tag, and three
    // more em dashes said a fact was missing about a race that has not
    // happened (CD-37). queries/season.js roundResult is the rule.
    winning_team: (name, row) =>
      row.status !== 'completed' ? '' : row.winning_team_id ? link(`constructors/${row.winning_team_id}`, name) : text(name),
  })}
  ${note(CALENDAR_FOOTER)}`
    const seasonStandings = `
  <h2>${esc(standingsHeading("Drivers'", live, after))}</h2>
  ${
    driversFinal.length
      ? fromColumns(DRIVERS_FINAL_COLUMNS, driversFinal, {
          entity: (name, row) => (row.driver_id ? link(`drivers/${row.driver_id}`, name) : text(name)),
        }) + note(DRIVERS_FINAL_FOOTER)
      : notRun
        ? `<p class="state is-empty">${esc(NOT_RUN_STANDINGS)}</p>`
        : EMPTY_STATE
  }
  <h2>${esc(standingsHeading("Constructors'", live, after))}</h2>
  ${
    constructorsFinal.length
      ? fromColumns(CONSTRUCTORS_FINAL_COLUMNS, constructorsFinal, {
          entity: (name, row) =>
            `${row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(name)}${row.engine_id ? ` ${tag(row.engine_id)}` : ''}`,
        }) + note(constructorsFooter(constructorsFinal.some((r) => r.engine_id)))
      : noteBox(noConstructors.head, noConstructors.body)
  }`
    page({
      path: `seasons/${year}`,
      lastmod: LAST_RUN.season.get(String(year)),
      title: NAMES.season(year).title,
      description: s.champion
        ? `${s.champion} won the ${year} Formula One World Championship for ${s.champion_team_name ?? '—'} with ${s.champion_points ?? '—'} points over ${s.rounds ?? '?'} rounds. Every race, winner, pole and fastest lap.`
        : running
          ? `${lead.entity} leads the ${year} Formula One World Championship by ${num(gap)} points after ${after ?? run} of ${s.rounds ?? '?'} rounds. Every race, winner, pole and fastest lap.`
          : notRun
            ? `The ${year} Formula One World Championship: a calendar of ${s.rounds ?? '?'} announced rounds, ${NOT_YET_RUN}. Every venue, weekend and Sprint round.`
            : `The ${year} Formula One World Championship: ${s.rounds ?? '?'} rounds, with every race, winner, pole and fastest lap.`,
      trail: TRAIL.season(year),
      onward: ONWARD.season({ season: s, year, neighbours }),
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'SportsSeason',
        name: `${year} FIA Formula One World Championship`,
        startDate: String(year),
        url: `${ORIGIN}${href(`seasons/${year}`)}`,
      },
      body: `
        <h1>${esc(NAMES.season(year).headline)}</h1>
        ${stepperNav(seasonSteps(neighbours))}
        ${tiles(titleStrip({ season: s, year, running, run, notRun, lead, second, teamLead }))}
        ${permutations ? note(permutations) : ''}
        ${prose(s.notes)}
        ${nextSection}
        ${live ? seasonCalendar + seasonStandings : seasonStandings + seasonCalendar}
        ${
          currentGrid.length
            ? `<h2>${esc(GRID_HEADING)}</h2>${note(GRID_NOTE)}${fromColumns(GRID_COLUMNS, currentGrid, {
                driver: (name, row) =>
                  `${row.driver_id ? link(`drivers/${row.driver_id}`, name) : text(name)}${
                    row.role && row.role !== 'race' ? ` ${tag(row.role)}` : ''
                  }`,
                team: (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(name)),
              })}${note(GRID_FOOTER)}`
            : ''
        }
        ${photographSection(all(SEASON_IMAGES, year), { subjects: true })}
        ${
          entrants.length
            ? `<h2>Who entered</h2>${fromColumns(ENTRANT_COLUMNS, entrants, {
                constructor: (name, row) =>
                  row.constructor_id ? link(`constructors/${row.constructor_id}`, name ?? row.constructor_id) : text(name ?? row.entrant_id),
              })}${note(ENTRANTS_FOOTER)}`
            : ''
        }
        <h2>The season on the record</h2>
        ${fields([
          // What the old opening list said that the strip above does not
          // (VD-49): the strip is queries/season.js's, as the app's is, and
          // these follow it under the heading Season.jsx gives its own
          // record, at the foot where it puts it.
          ...(running || notRun
            ? []
            : [
                ['Team', team(s.champion_team)],
                ['Runner-up', `${driver(s.runner_up)} — ${num(s.runner_up_points)}`],
              ]),
          ['Engine formula', text(s.engine_formula)],
          ['Tyres', text(s.tyre_suppliers)],
          ['Entered', entered],
        ])}`,
    })
  }
}

// ------------------------------------------------------------------ races

{
  const names = Object.fromEntries(all('SELECT id, full_name FROM drivers').map((d) => [d.id, d.full_name]))
  const teams = Object.fromEntries(all('SELECT id, name FROM constructors').map((c) => [c.id, c.name]))
  const driver = (id, fallback) => (id ? link(`drivers/${id}`, names[id] ?? id) : text(fallback))
  const team = (id, fallback) => (id ? link(`constructors/${id}`, teams[id] ?? id) : text(fallback))

  const races = all(
    `SELECT r.id, r.year, r.round, r.name_used, r.date_iso, r.date_from, r.date_to, r.status, r.sprint, r.note,
            r.gp_id, g.name AS gp_full,
            r.circuit_id, c.name AS circuit, c.locality, c.country, c.length_km, c.turns,
            rr.winner_id, rr.winner, rr.constructor_id, rr.constructor, rr.entrant,
            rr.pole, rr.pole_id, rr.fastest_lap, rr.fastest_lap_id, rr.confidence, rr.source,
            r.f1db_layout_id, o.path AS outline, o.length_km AS outline_km, o.turns AS outline_turns
       FROM races r
       LEFT JOIN grands_prix g ON g.id = r.gp_id
       LEFT JOIN circuits c ON c.id = r.circuit_id
       LEFT JOIN race_results rr ON rr.year = r.year AND rr.round = r.round
       LEFT JOIN circuit_outlines o ON o.f1db_layout_id = r.f1db_layout_id
      ORDER BY r.year DESC, r.round DESC`,
  )

  page({
    path: 'races',
    title: NAMES.races().title,
    description: `All ${races.length.toLocaleString()} FIA Formula One championship Grands Prix with winner, pole, fastest lap and full classification.`,
    trail: TRAIL.races(),
    onward: ONWARD.races(),
    body: `
      <h1>${esc(NAMES.races().headline)}</h1>
      <p class="lede">${races.length.toLocaleString()} championship Grands Prix. The 200 most recently run
        are listed here; every one of them is reachable from ${link('seasons', 'its season')}.</p>
      ${fromColumns(RACE_COLUMNS, all(RACES).slice(0, 200), {
        year: (year) => link(`seasons/${year}`, year),
        gp_name: (name, row) => `${link(`races/${row.year}/${row.round}`, name)}${row.sprint ? ` ${tag(SPRINT)}` : ''}`,
        circuit: (name, row) => (row.circuit_id ? link(`circuits/${row.circuit_id}`, name ?? row.circuit_id) : text(name)),
        winner: (name, row) =>
          row.status !== 'completed'
            ? tag(NOT_YET_RUN)
            : row.winner_id
              ? `${link(`drivers/${row.winner_id}`, name)}${row.co_winner_id ? ` ${tag(SHARED)}` : ''}`
              : text(name),
        constructor: (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(name)),
        pole: (name, row) => (row.pole_id ? link(`drivers/${row.pole_id}`, name) : text(name)),
        fastest_lap: (name, row) => (row.fastest_lap_id ? link(`drivers/${row.fastest_lap_id}`, name) : text(name)),
      })}
      ${note(RACES_FOOTER)}`,
  })

  // The same recorded disagreements the app shows beside the fact, in the half
  // a crawler and the first second of a cold visit both see. Leaving this to
  // the app only would put the static page and the app back to describing
  // different documents, which is the fault the chassis pages were fixed for.
  const disagreements = db.prepare(
    `SELECT d.field, d.assessment,
            COALESCE(s.full_name, d.stored_value)  AS stored_value,
            COALESCE(v.full_name, d.derived_value) AS derived_value
       FROM discrepancies d
       LEFT JOIN drivers s ON s.id = d.stored_value
       LEFT JOIN drivers v ON v.id = d.derived_value
      WHERE d.subject = ? AND d.status = 'open'
      ORDER BY d.id`,
  )

  // The four tables read web/src/queries/race.js, the app's own queries and
  // column lists (PD-02, rung four), and the classification is put in the
  // order the app prints it by the same function.
  const rail = (_, row) => `<i class="${esc(railOf(row))}"></i>`
  const driverCell = (name, row) => (row.driver_id ? link(`drivers/${row.driver_id}`, name ?? row.driver_id) : text(name))
  const constructorCell = (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(name))
  // A session sheet's driver, marked where they never started a race - the
  // app's sessionDriverLink, and the column's own text, say the same.
  const sessionDriverCell = (name, row) =>
    driverCell(name, row) + (row.practice_only === 1 ? ` <span aria-hidden="true">${PRACTICE_ONLY_MARK}</span><span class="sr-only">(never started a Grand Prix)</span>` : '')
  const outCell = (value, row) => (finished(value, row.finish_position) ? 'Finished' : missing(value) ? '—' : tag(value))
  // PD-57: a block that leads with an h2 inside the grid at the top of the
  // page carries its own section, as Race.jsx's do. sectioned() starts a
  // block at every h2 not already inside one, so a bare h2 there would cut
  // the grid in half.
  const ownSection = (html) => (html ? `<section class="section">${html}</section>` : '')

  for (const r of races) {
    const neighbours = one(RACE_NEIGHBOURS, r.year, r.round) ?? {}
    // The rows as the query returns them, which is the order the strip lists
    // a shared pole or fastest lap in, as the app's does; the tables below
    // take the classification's order.
    const entryRows = all(ENTRIES, r.year, r.round)
    const entries = inClassificationOrder(entryRows)
    const flag = gridFlagRows(entryRows)
    const qualifying = all(QUALIFYING, r.year, r.round)
    const practice = practiceBySession(all(PRACTICE, r.year, r.round))
    const sprintQualifying = all(SPRINT_QUALIFYING, r.year, r.round)
    const sprintResults = inClassificationOrder(all(SPRINT_RESULTS, r.year, r.round))
    const pits = all(PITS, r.year, r.round)
    const scheduled = r.status === 'scheduled'
    const sessions = all(RACE_SESSIONS, r.year, r.round)
    const stage = raceStage(r, sessions, STATIC_NOW)
    const day = eventDay(sessions, r.date_iso)
    const pending = scheduled ? scheduledNote(r, stage) : null
    const headline = NAMES.race(r.year, r.name_used).headline
    // CD-03: the standfirst the page opens on and the description a search
    // result shows are one expression, queries/race.js's, so they cannot come
    // to describe different races - which is what the old description, read
    // off race_results and written only into a meta tag, was free to do. The
    // winners come from the classification this page prints rather than from
    // the view over it, so the sentence and the table below agree by
    // construction on a shared drive.
    const raceWinners = entries.filter((e) => e.finish_position === 1)
    const standfirst = raceLede(r, raceWinners, stage)
    // The description carries the derived sentence AND the note, where the
    // lede shows the note alone: read out of context a description has to
    // say what the page is, and the note explains rather than replaces it.
    // driver.js's lede and its description split the same way.
    //
    // The note used to be a bare paragraph below the timetable here and the
    // lede in the app, which was already two placements for one sentence;
    // now that the lede is the note in both halves, that paragraph would be
    // the same words twice on the page, so it has gone.
    const written = raceNote(r)
    // PD-57: the timetable leads a round not yet run and follows the
    // photographs once a result is held, as Race.jsx places it.
    const timetable = sessions.length
      ? `<h2>Timetable</h2>${fromColumns(SESSION_COLUMNS, sessions)}<p class="source-note">${esc(TIMETABLE_NOTE)}</p>`
      : ''
    const description = `${headline}. ${raceSentence(r, raceWinners, stage)}${written ? ` ${written}` : ''}${
      scheduled ? '' : ' Full classification, grid, pole and fastest lap.'
    }`

    page({
      path: `races/${r.year}/${r.round}`,
      lastmod: r.date_iso,
      title: NAMES.race(r.year, r.name_used).title,
      description: summarise(description, 300),
      trail: TRAIL.race(r.year, r.round, r.name_used),
      onward: ONWARD.race({ race: r, year: r.year, winners: raceWinners, neighbours }),
      sources: all(RACE_SOURCES, r.year, r.round),
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: headline,
        sport: 'Formula One',
        url: `${ORIGIN}${href(`races/${r.year}/${r.round}`)}`,
        ...(r.circuit
          ? { location: { '@type': 'Place', name: r.circuit, address: list([r.locality, r.country]) } }
          : {}),
        ...(r.winner && !scheduled
          ? { winner: { '@type': 'Person', name: r.winner } }
          : {}),
        // The day, not the weekend: a grand prix is a one-day event, and the
        // races that state a weekend are the SCHEDULED ones - exactly where
        // a search engine most wants a date. Still guarded on the shape,
        // because invalid structured data is worse than none.
        //
        // `endDate` beside it, under the same guard, because Search Console
        // asks for both and a grand prix is a one-day event: the same day,
        // not a range. An end date that is not a date is an error where a
        // missing one is a warning (AF-01).
        //
        // eventDay() is the circuit's day rather than `date_iso`, because
        // that is the frame schema.org reads a bare date in; the two differ
        // on Las Vegas, and date_iso is what is left where no timetable is
        // held to derive it from.
        ...(ISO_DAY.test(day ?? '') ? { startDate: day, endDate: day } : {}),
        // A constant, and true of all 1,196 rounds: `races.status` tells a
        // round that has been run from one still to come, and neither is
        // cancelled, postponed or moved online — the states schema.org keeps
        // the other values for.
        //
        // The three Search Console also names are declined. Nothing here
        // sells a ticket, so an `offers` block would be invented, and false
        // structured data is a policy matter rather than a warning; the
        // drivers are not the billed `performer` of a 1950 results page; and
        // each grand prix is organised by its own promoter under an FIA
        // permit, so one constant `organizer` would state a fact about 1,196
        // events that the database holds for none of them.
        eventStatus: 'https://schema.org/EventScheduled',
      },
      body: `
        <h1>${esc(headline)}</h1>
        <p class="lede">${esc(standfirst)}</p>
        ${stepperNav(raceSteps(neighbours))}
        <section class="section"><div${r.outline ? ' class="with-outline with-lead"' : ''}>${tiles(raceStrip(r, entryRows, qualifying))}
        ${outlineCard(
          r.outline,
          r.circuit,
          r.f1db_layout_id,
          outlineCaption({ f1db_layout_id: r.f1db_layout_id, length_km: r.outline_km, turns: r.outline_turns }),
          true,
        )}
        <div class="lead">
        ${scheduled ? noteBox(pending.head, pending.body) : ''}
        ${scheduled ? ownSection(timetable) : ''}
        ${ownSection(disagree(disagreements.all(`${r.year} round ${r.round}`), 'this race'))}
        ${
          entries.some((e) => e.shared_drive === 1)
            ? noteBox(SHARED_DRIVE_NOTE.head, SHARED_DRIVE_NOTE.body)
            : ''
        }
        ${
          entries.length
            ? `<section class="section"><h2>Classification</h2>${fromColumns(CLASSIFICATION_COLUMNS, entries, {
                rail,
                position_text: (_, row) =>
                  missing(row.finish_position) ? `<span class="tag tag-dnf">${esc(result(row))}</span>` : `<b>${esc(result(row))}</b>`,
                driver: (name, row) => `${driverCell(name, row)}${row.shared_drive === 1 ? ` ${tag(SHARED)}` : ''}`,
                constructor: (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(carName(row))),
                chassis: (name, row) => (row.chassis_id ? link(`cars/${row.chassis_id}`, name ?? row.chassis_id) : text(name)),
                status: outCell,
                fastest_lap: (value) =>
                  value === 1 ? `<span class="fl" aria-hidden="true">●</span><span class="sr-only">${esc(FASTEST_LAP)}</span>` : '',
              })}${note(classificationFooter(entries))}</section>`
            : ''
        }
        ${
          // PD-30: the figure under the classification, as Race.jsx places
          // it - the drawing, its note and its table open beneath it.
          gridFlagShown(flag)
            ? `<section class="section"><h2>${esc(GRID_FLAG_HEADING)}</h2><figure class="figure"><figcaption><b>${esc(
                GRID_FLAG_TITLE,
              )}</b><span>${esc(gridFlagNote(flag, undrawnOf(entryRows)))}</span></figcaption><div class="figure-body">${gridFlagSvg(
                gridFlagLayout(entryRows),
                gridFlagLabel(flag),
              )}</div>${fromColumns(
                GRID_FLAG_COLUMNS,
                flag.map((r) => r.entry),
              )}</figure></section>`
            : ''
        }
        </div></div></section>
        ${
          qualifying.length
            ? `<h2>Qualifying</h2>${fromColumns(qualifyingColumns(qualifying), qualifying, {
                driver: driverCell,
                constructor: constructorCell,
              })}${note(QUALIFYING_FOOTER)}`
            : ''
        }
        ${
          sprintResults.length
            ? `<h2>Sprint</h2>${fromColumns(SPRINT_COLUMNS, sprintResults, {
                rail,
                driver: driverCell,
                constructor: constructorCell,
                status: outCell,
              })}${note(SPRINT_FOOTER)}`
            : ''
        }
        ${
          sprintQualifying.length
            ? `<h2>Sprint qualifying</h2>${fromColumns(sprintQualifyingColumns(sprintQualifying), sprintQualifying, {
                driver: sessionDriverCell,
                constructor: constructorCell,
              })}${note(sprintQualifyingFooter(sprintQualifying))}`
            : ''
        }
        ${
          pits.length
            ? `<h2>Pit stops</h2>${fromColumns(PIT_COLUMNS, pits, {
                driver: (name, row) => (row.driver_id ? link(`drivers/${row.driver_id}`, name ?? row.driver_id) : text(name ?? row.driver_key)),
              })}${note(PITS_FOOTER)}`
            : ''
        }
        ${
          // PD-57: the session sheets closed, after the result and the
          // strategy - every table still in this HTML, open or not. Each
          // sheet is written as its own section, as Race.jsx renders it:
          // sectioned() starts a block at every h2 not already inside one,
          // and would otherwise end the disclosure at its first sheet.
          practice.length
            ? `<details class="session-sheets"><summary>${esc(PRACTICE_SUMMARY)} <span class="count">${esc(
                practiceSummaryCount(practice),
              )}</span></summary>${practice
                .map(
                  ({ title, rows: sheet }) =>
                    `<section class="section"><h2>${text(title)}</h2>${fromColumns(PRACTICE_COLUMNS, sheet, {
                      driver: sessionDriverCell,
                      constructor: constructorCell,
                    })}${note(practiceFooter(sheet))}</section>`,
                )
                .join('')}</details>`
            : ''
        }
        ${raceStrips(r)}
        ${scheduled ? '' : timetable}
        <h2>Where this comes from</h2>
        ${fields([
          // What the old opening list said that the strip above does not
          // (VD-49): the circuit, the result, the pole and the fastest lap
          // are queries/race.js's tiles now, as they are the app's, and the
          // rest follow under the heading Race.jsx gives its own record, at
          // the foot where it puts it.
          ['Round', `${r.round} of ${r.year}`],
          // The event this race is an edition of, linked as Race.jsx links it (IA-01).
          ['Grand Prix', r.gp_id ? link(`grands-prix/${r.gp_id}`, r.gp_full ?? r.name_used) : text(r.name_used)],
          ['Dates', text(raceDates(r))],
          ['Format', r.sprint ? 'Sprint weekend' : 'Standard weekend'],
          // The entrant's name where no constructor row exists, the rule
          // queries/race.js applies everywhere a car is named; the eleven
          // championship Indianapolis 500s are the entries that have one and
          // it is the only name they have (AF-64).
          ...(scheduled
            ? []
            : [
                ['Constructor', team(r.constructor_id, carName(r))],
                ['Entrant', text(r.entrant)],
              ]),
          ['Confidence', r.confidence ? link('data/quality', r.confidence) : text(r.confidence)],
        ])}`,
    })
  }
}

// ---------------------------------------------------------------- drivers

{
  // The register is the app's query, from the module Drivers.jsx reads; each
  // driver page then runs the app's per-driver queries from Driver.jsx's.
  const register = all(DRIVERS)
  // Joined on full_name, which is what discrepancies.subject holds for a career
  // figure. verify.py refuses a subject shape that resolves to nothing, so a
  // silent empty join cannot survive a build.
  const careerDisagreements = db.prepare(
    `SELECT d.field, d.status, d.status_note, d.assessment,
            COALESCE(s.full_name, d.stored_value)  AS stored_value,
            COALESCE(v.full_name, d.derived_value) AS derived_value
       FROM discrepancies d
       LEFT JOIN drivers s ON s.id = d.stored_value
       LEFT JOIN drivers v ON v.id = d.derived_value
      WHERE d.subject = ? AND (d.status = 'open' OR (d.status = 'explained' AND d.status_note = '${EXPLAINED_SPAN}'))
      ORDER BY d.id`,
  )
  const teams = Object.fromEntries(all('SELECT id, name FROM constructors').map((c) => [c.id, c.name]))

  page({
    path: 'drivers',
    title: NAMES.drivers().title,
    description: `All ${registerCount(register).raced} drivers who entered a championship race, and ${registerCount(register).practice} who drove only in practice, with entries, wins, podiums, poles and fastest laps counted from the race records, and titles from the championship tables.`,
    trail: TRAIL.drivers(),
    onward: ONWARD.drivers(),
    body: `
      <h1>${esc(NAMES.drivers().headline)}</h1>
      <p class="lede">${registerCount(register).raced} drivers who entered a championship race, and
        ${registerCount(register).practice} who drove in practice and never started one. Career totals are counted from the race records
        wherever the records support it; an em dash means nobody has established that figure.</p>
      ${fromColumns(DRIVER_COLUMNS, register, {
        full_name: (name, d) =>
          link(`drivers/${d.id}`, name) +
          (d.practice_only === 1 ? ` <span aria-hidden="true">${PRACTICE_ONLY_MARK}</span><span class="sr-only">(never started a Grand Prix)</span>` : ''),
      })}<p class="faint">${esc(REGISTER_FOOTER)}</p>`,
  })

  const winsOf = db.prepare(
    `SELECT rr.year, rr.round, rr.gp_name, rr.constructor_id, rr.constructor
       FROM race_results rr WHERE rr.winner_id = ? ORDER BY rr.year, rr.round`,
  )
  const constructorsOf = db.prepare(DRIVER_CONSTRUCTORS)
  const resultsOf = db.prepare(DRIVER_RESULTS)
  const thisSeasonOf = db.prepare(THIS_SEASON)
  const teamMatesOf = db.prepare(TEAM_MATES)

  for (const { id } of register) {
    const d = one(DRIVER, id)
    // The career as the race records count it, and the seasons as the app's
    // table lays them out - the same SQL and the same shaping as Driver.jsx,
    // so the strip and the table below are the app's, not a reading of the
    // stored columns that disagreed with it on 14 of 38 drivers (PD-02).
    // The description is built from the same row (CD-20) and never from
    // `entries`/`starts`/`wins` on the drivers row: the page itself labels
    // those "(published)", and a description that quoted them read "0 wins,
    // 0 poles" for 81 drivers whose lede had just moved to `provenance`.
    const derived = one(DERIVED, id) ?? {}
    const bySeason = all(BY_SEASON, id)
    const standings = driverStandings(id)
    const seasons = seasonRows(bySeason, standings)
    // A driver of the season being run has it as a section (PD-49), as
    // Driver.jsx does: the same rows, heading, sentence and table, after the
    // career strip rather than before it (PD-59). The app draws the dots
    // above the table; a page with no script has the table itself.
    const thisSeason = thisSeasonOf.all(id)
    const thisSeasonSection = (() => {
      if (!thisSeason.length) return ''
      const standing = standings.find((row) => row.year === thisSeason[0].season) ?? null
      const footer = thisSeasonFooter(thisSeason, standing)
      return `<h2>${esc(thisSeasonHeading(thisSeason))}</h2>
        <p class="note">${esc(thisSeasonNote(thisSeason, standing))}</p>
        ${fromColumns(THIS_SEASON_COLUMNS, roundsRun(thisSeason), {
          name_used: (name, row) => link(`races/${row.season}/${row.round}`, name),
          constructor: (name, row) =>
            row.entry_id && row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : esc(THIS_SEASON_COLUMNS.find((c) => c.key === 'constructor').text(name, row)),
        })}
        ${footer ? `<p class="source-note">${esc(footer)}</p>` : ''}`
    })()
    const wins = winsOf.all(id)
    // Driver.jsx's Team-mates table (PD-43): the same query with no second
    // driver, the same columns, the same footer, and no section where the
    // career had no team-mate.
    const teamMates = teamMatesOf.all(id, null)
    const constructors = constructorsOf.all(id).map((c) => c.name)
    // A Friday driver's whole record is the practice sheets (LV-03), as in
    // Driver.jsx: the sentence, the notice and the table are the app's.
    const practiceOnly = d.practice_only === 1
    const practice = practiceOnly ? all(DRIVER_PRACTICE, id) : []
    const career = practiceOnly ? practiceSentence(practice) : careerSentence(derived, constructors, d.titles)
    // The lede follows the derived sentence where there is room for a whole
    // sentence of it; a note that is one long sentence would otherwise be
    // cut mid-thought with an ellipsis, and the career alone is complete.
    const lead = `${d.full_name}${d.nationality ? `, ${d.nationality}` : ''}. ${career}`
    const withNotes = summarise(`${lead} ${d.notes ?? ''}`, 300)

    page({
      path: `drivers/${d.id}`,
      lastmod: LAST_RUN.driver.get(d.id),
      title: NAMES.driver(d.full_name).title,
      description: withNotes.endsWith('…') ? lead : withNotes,
      trail: TRAIL.driver(d.id, d.full_name),
      onward: ONWARD.driver({ results: resultsOf.all(d.id), bySeason }),
      sources: all(DRIVER_SOURCES, d.id),
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: d.full_name,
        url: `${ORIGIN}${href(`drivers/${d.id}`)}`,
        ...(d.nationality ? { nationality: d.nationality } : {}),
        ...(d.born ? { birthDate: d.born } : {}),
        ...(d.died ? { deathDate: d.died } : {}),
        jobTitle: 'Formula One driver',
      },
      body: `
        <h1>${esc(NAMES.driver(d.full_name).headline)}</h1>
        <p class="lede">${esc(lede(d, derived, constructors, practice))}</p>
        ${practiceOnly ? noteBox(PRACTICE_ONLY_NOTICE.head, PRACTICE_ONLY_NOTICE.body) : ''}
        ${
          practiceOnly
            ? ''
            : tiles(careerStrip(d, derived, thisSeason, standings))
        }
        ${thisSeasonSection}
        ${
          practice.length
            ? `<h2>Practice sessions</h2>${fromColumns(PRACTICE_SESSION_COLUMNS, practice, {
                year: (year) => link(`seasons/${year}`, year),
                name_used: (name, row) => link(`races/${row.year}/${row.round}`, name),
                constructor: (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(name)),
              })}`
            : ''
        }
        ${disagree(careerDisagreements.all(d.full_name), 'this career')}
        ${
          wins.length
            ? `<h2>Wins</h2>${table(
                ['Season', 'Grand Prix', 'Constructor'],
                wins.map((w) => [
                  link(`seasons/${w.year}`, w.year),
                  link(`races/${w.year}/${w.round}`, w.gp_name),
                  w.constructor_id ? link(`constructors/${w.constructor_id}`, teams[w.constructor_id] ?? w.constructor) : text(w.constructor),
                ]),
                // The race is its season and its Grand Prix, as on every race list.
                { rowHeaders: [true, true] },
              )}`
            : ''
        }
        ${
          seasons.length
            ? `<h2>Season by season</h2>${fromColumns(SEASON_COLUMNS, seasons, {
                year: (year) => link(`seasons/${year}`, year),
              })}<p class="faint">${esc(SEASONS_FOOTER)}</p>`
            : ''
        }
        ${
          teamMates.length
            ? `<h2>Team-mates</h2>${fromColumns(TEAM_MATE_COLUMNS, teamMates, {
                year: (year) => link(`seasons/${year}`, year),
                mate: (name, row) => link(`drivers/${row.mate_id}`, name),
                constructor: (name, row) => link(`constructors/${row.constructor_id}`, name),
              })}<p class="faint">${esc(teamMatesFooter(d.full_name))}</p>
              <p>${link(comparePath(d.id), compareWith(d.full_name))}</p>`
            : ''
        }
        <h2>On the record</h2>
        ${
          pointsDiffer(d, derived)
            ? noteBox(pointsNote(d, derived).head, pointsNote(d, derived).body)
            : ''
        }
        ${fields([
          ...record(d).map(([label, value]) => [label, esc(value)]),
          ['Confidence', d.confidence ? link('data/quality', d.confidence) : text(d.confidence)],
          ['Source', d.source ? `<a href="${esc(d.source)}">${esc(d.source)}</a>` : text(d.source)],
        ])}
        <p class="source-note">${esc(ENTRIES_NOTE)}</p>`,
    })
  }
}

// ---------------------------------------------------------------- compare
//
// Two drivers side by side (PD-43). The pair is the query string, which no
// static file can read, so this is the one page every comparison lands on:
// the name, the lede and the way onward, as Compare.jsx draws them before a
// pair is chosen. The comparison itself is drawn once the database is open.

page({
  path: 'compare',
  title: NAMES.compare().title,
  description: COMPARE_DESCRIPTION,
  trail: TRAIL.compare(),
  onward: ONWARD.compare(),
  body: `
    <h1>${esc(NAMES.compare().headline)}</h1>
    <p class="lede">${esc(COMPARE_LEDE)}</p>
    <noscript><p class="measure">${esc(COMPARE_NOSCRIPT)}</p></noscript>`,
})

// ----------------------------------------------------------- constructors

{
  const constructors = all(
    `SELECT * FROM constructors ORDER BY constructors_titles DESC, wins DESC, name`,
  )

  page({
    path: 'constructors',
    title: NAMES.constructors().title,
    description: `All ${constructors.length} constructors that have entered a championship Grand Prix, with entries, wins, poles and titles.`,
    trail: TRAIL.constructors(),
    onward: ONWARD.constructors(),
    body: `
      <h1>${esc(NAMES.constructors().headline)}</h1>
      <p class="lede">${constructors.length} constructors that have entered a championship Grand Prix.</p>
      ${fromColumns(CONSTRUCTOR_COLUMNS, all(CONSTRUCTORS), {
        name: (name, row) => link(`constructors/${row.id}`, name),
      })}
      ${note(CONSTRUCTORS_FOOTER)}`,
  })

  // A constructor's open disagreements, by its name - the driver page's
  // careerDisagreements is scoped to that section, so this is the same
  // statement for this one.
  const teamDisagreements = db.prepare(
    `SELECT d.field, d.status, d.status_note, d.assessment,
            COALESCE(s.full_name, d.stored_value)  AS stored_value,
            COALESCE(v.full_name, d.derived_value) AS derived_value
       FROM discrepancies d
       LEFT JOIN drivers s ON s.id = d.stored_value
       LEFT JOIN drivers v ON v.id = d.derived_value
      WHERE d.subject = ? AND d.status = 'open'
      ORDER BY d.id`,
  )
  for (const c of constructors) {
    // The three tables read web/src/queries/constructor.js, the app's own
    // queries and column lists (PD-02, rung five).
    // The record is counted from the race records, never read from the
    // stored column: constructors.entries is NULL for all 150 rows, so this
    // list printed "Entries -" beside an app whose Stats strip derived
    // 2,496 for the same team. Same query as Constructor.jsx (CD-30).
    const teamDerived = one(TEAM_DERIVED, c.id) ?? {}
    const teamStandings = all(TEAM_STANDINGS, c.id)
    const teamBySeason = all(TEAM_BY_SEASON, c.id)
    const seasons = constructorSeasons(teamBySeason, teamStandings)
    const engineSplit = teamStandings.some((s) => s.engine_id)
    const wins = all(TEAM_WINS, c.id)
    const designs = all(DESIGNS, c.id)
    // The description's figures. Wins are the derived count, as the Stats
    // strip gives them (CD-34), and only for a team with a race entry under
    // its own id: rob-walker has none, its wins being credited to Cooper and
    // Lotus, so a count of zero would be a figure nobody established. Joined,
    // so a team with neither figure gets no stray ". ." in its description.
    const teamFigures = [
      teamDerived.entries > 0 ? `${formatted(teamDerived.wins ?? 0)} wins` : '',
      c.constructors_titles ? `${c.constructors_titles} constructors' titles` : '',
    ]
      .filter(Boolean)
      .join(', ')
    page({
      path: `constructors/${c.id}`,
      lastmod: LAST_RUN.constructor.get(c.id),
      title: NAMES.constructor(c.name).title,
      description: summarise(
        `${c.full_name ?? c.name}${c.country ? `, ${c.country}` : ''}, Formula One ${c.first_entry ?? '?'}–${c.last_entry ?? 'present'}. ${
          teamFigures ? `${teamFigures}. ` : ''
        }${c.notes ?? ''}`,
        300,
      ),
      trail: TRAIL.constructor(c.id, c.name),
      onward: ONWARD.constructor({ constructor: c, designs, bySeason: teamBySeason }),
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'SportsOrganization',
        name: c.full_name ?? c.name,
        sport: 'Formula One',
        url: `${ORIGIN}${href(`constructors/${c.id}`)}`,
        ...(c.country ? { location: { '@type': 'Place', name: c.country } } : {}),
      },
      body: `
        <h1>${esc(NAMES.constructor(c.name).headline)}</h1>
        ${tiles(teamStrip(c, teamDerived))}
        ${prose(c.notes)}
        ${disagree(teamDisagreements.all(c.name), 'this team')}
        <h2>Season by season</h2>
        ${
          seasons.length
            ? `${fromColumns(TEAM_SEASON_COLUMNS, seasons, {
                year: (year) => link(`seasons/${year}`, year),
              })}${engineSplit ? note(ENGINE_SPLIT_FOOTER) : ''}`
            : EMPTY_STATE
        }
        ${photographSection(all(CONSTRUCTOR_IMAGES, c.id), { subjects: true })}
        ${
          wins.length
            ? `<h2>Every win</h2>${fromColumns(WIN_COLUMNS, wins, {
                year: (year) => link(`seasons/${year}`, year),
                name_used: (name, row) => link(`races/${row.year}/${row.round}`, name),
                circuit: (name, row) => (row.circuit_id ? link(`circuits/${row.circuit_id}`, name) : text(name)),
                driver: (name, row) => (row.driver_id ? link(`drivers/${row.driver_id}`, name) : text(name)),
                chassis: (name, row) => (row.chassis_id ? link(`cars/${row.chassis_id}`, name ?? row.chassis_id) : text(name)),
              })}${note(TEAM_WINS_FOOTER)}`
            : ''
        }
        ${
          designs.length
            ? `<h2>Cars built</h2>${fromColumns(DESIGN_COLUMNS, designs, {
                name: (name, row) => link(`cars/${row.id}`, name),
              })}`
            : ''
        }
        <h2>On the record</h2>
        ${fields([
          // What the old opening list said that the strip above does not
          // (VD-49): the span, the entries and the titles are
          // queries/constructor.js's tiles now, as they are the app's, and
          // the rest follow under the heading Constructor.jsx gives its own
          // record, at the foot where it puts it.
          ['Full name', text(c.full_name)],
          ['Country', text(c.country)],
          ['Base', text(c.base)],
          // Both figures, as the app's "On the record" gives them (CD-34):
          // the stored wins are published ones and part from the count on
          // four teams, so the list no longer prints one the strip contradicts.
          ...recordFigures(c, teamDerived).map(([label, value]) => [label, esc(value)]),
          ['Confidence', c.confidence ? link('data/quality', c.confidence) : text(c.confidence)],
        ])}`,
    })
  }
}

// --------------------------------------------------------------- circuits

{
  const circuits = all(`SELECT * FROM circuits ORDER BY gp_count DESC, name`)
  // The register is the app's (queries/circuits.js). Its Traced column counts
  // the OpenStreetMap centrelines, which are not in f1.db - the browser
  // overlays f1-geometry.db at runtime - so this database answers 0 for every
  // circuit. Whether a trace exists is a fact about this project's own file,
  // not a centreline copied out of it, so the column is answered from the
  // sibling database. Anything that publishes f1.db must publish
  // f1-geometry.db beside it (CLAUDE.md), so its absence is a broken build,
  // not eighty dashes nobody would notice.
  const register = all(CIRCUITS)
  const geoPath = join(repo, 'f1-geometry.db')
  if (!existsSync(geoPath)) {
    die(`${geoPath} is missing. The circuits register's Traced column is answered from it, and\nanything that publishes f1.db must publish f1-geometry.db beside it.`)
  }
  const geo = new DatabaseSync(geoPath, { readOnly: true })
  const traced = new Set(geo.prepare('SELECT DISTINCT circuit_id FROM circuit_geometry').all().map((r) => r.circuit_id))
  geo.close()
  for (const row of register) row.traced = traced.has(row.id) ? 1 : 0

  // VD-50: one outline per venue, the app's own query, so the static register
  // and the app draw the same layout of the same circuit in the same order.
  const shapes = all(REGISTER_OUTLINES)

  page({
    path: 'circuits',
    title: NAMES.circuits().title,
    description: `All ${circuits.length} circuits that have held a championship Grand Prix, with length, turns, location and the races held there.`,
    trail: TRAIL.circuits(),
    onward: ONWARD.circuits(),
    body: `
      <h1>${esc(NAMES.circuits().headline)}</h1>
      <p class="lede">${circuits.length} circuits that have held a championship Grand Prix.</p>
      ${heading(SHAPES, `${shapes.length} of ${register.length}`)}
      ${note(OUTLINE_REGISTER_NOTE)}
      ${
        shapes.length
          ? `<ul class="lapgrid">${shapes
              .map(
                (shape) =>
                  `<li><a class="lapcard shapecard" href="${esc(href(`circuits/${shape.circuit_id}`))}">${outlineSvg(
                    shape.path,
                    null,
                  )}<b>${esc(shape.name)}</b><span>${esc(shape.country ?? '')}</span></a></li>`,
              )
              .join('')}</ul>`
          : `<p class="state is-empty">${esc(NO_SHAPES)}</p>`
      }
      <h2>Every venue</h2>
      ${fromColumns(CIRCUIT_COLUMNS, register, {
        name: (name, row) => link(`circuits/${row.id}`, name),
        traced: (value) => (value ? `<span aria-hidden="true">●</span><span class="sr-only">${esc(TRACED)}</span>` : '—'),
      })}
      ${note(CIRCUITS_FOOTER)}`,
  })

  for (const c of circuits) {
    // The three tables read web/src/queries/circuit.js, the app's own
    // queries and column lists (PD-02, rung five).
    const racesHere = all(CIRCUIT_RACES, c.id)
    // The derived figures the app's strip shows: the stored last_gp is NULL
    // for every venue still in use, and the stored count is not the races.
    const cv = one(CIRCUIT_ROW, c.id) ?? {}
    const winnersHere = all(WINNERS_HERE, c.id)
    const teamsHere = all(TEAMS_HERE, c.id)
    const outlinesHere = all(CIRCUIT_OUTLINES, c.id)
    const layoutsHere = all(CIRCUIT_LAYOUTS, c.id)
    const outlineSplit = leadOutline(outlinesHere)
    // The photograph beside the heading, as Circuit.jsx draws it (VD-62):
    // the same query, through canShow() first, and nothing where there is none.
    const pictured = all(CIRCUIT_PHOTOGRAPH, c.id).find(canShow) ?? null
    const card = (row) => outlineCard(row.path, c.name, row.f1db_layout_id, outlineCaption(row))
    // The events held here, in Circuit.jsx's words (IA-01).
    const held = heldAs(all(CIRCUIT_GRANDS_PRIX, c.id))
    const heldLine = held.length
      ? `<p class="measure">${held.map((segment) => (segment.id ? link(`grands-prix/${segment.id}`, segment.name) : esc(segment.text))).join('')}</p>`
      : ''
    page({
      path: `circuits/${c.id}`,
      lastmod: LAST_RUN.circuit.get(c.id),
      title: NAMES.circuit(c.name).title,
      description: summarise(
        `${c.official_name ?? c.name}${c.locality ? `, ${c.locality}` : ''}${c.country ? `, ${c.country}` : ''}. ${
          c.length_km ? `${c.length_km} km` : ''
        }${c.turns ? `, ${c.turns} turns` : ''}${c.gp_count ? `, ${c.gp_count} championship Grands Prix` : ''}${
          c.first_gp ? ` from ${c.first_gp}` : ''
        }. ${c.characteristics ?? ''}`,
        300,
      ),
      trail: TRAIL.circuit(c.id, c.name),
      onward: ONWARD.circuit({ races: racesHere, winners: winnersHere }),
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'Place',
        name: c.official_name ?? c.name,
        url: `${ORIGIN}${href(`circuits/${c.id}`)}`,
        ...(c.locality || c.country
          ? {
              address: {
                '@type': 'PostalAddress',
                addressLocality: c.locality ?? undefined,
                addressCountry: c.country ?? undefined,
              },
            }
          : {}),
      },
      body: `
        <h1>${esc(NAMES.circuit(c.name).headline)}</h1>
        ${pictured ? `<div class="page-photo">${photograph(pictured, PHOTOGRAPH_WIDTH, null, circuitPhotographAlt(c.name))}</div>` : ''}
        ${tiles(circuitStrip(cv))}
        ${prose(c.characteristics)}
        ${prose(c.notes)}
        ${
          // PD-60, as Circuit.jsx: with a timeline, the lead alone here,
          // carrying the rule, and the history after the winners.
          layoutsHere.length
            ? outlineSplit.lead
              ? `<div class="outline-set">${outlineCard(
                  outlineSplit.lead.path,
                  c.name,
                  outlineSplit.lead.f1db_layout_id,
                  outlineCaption(outlineSplit.lead),
                  true,
                )}</div>`
              : ''
            : outlinesHere.length
              ? `${heading('Every layout raced here', layoutsCount(layoutsHere, outlinesHere))}${note(
                  circuitOutlinesNote(outlinesHere.length),
                )}<div class="outline-set">${card(outlineSplit.lead)}${
                  outlineSplit.rest.length ? `<div class="outline-grid">${outlineSplit.rest.map(card).join('')}</div>` : ''
                }</div>`
              : ''
        }
        ${
          winnersHere.length
            ? `<h2>Most wins here</h2>${fromColumns(WINNER_COLUMNS, winnersHere, {
                driver: (name, row) => link(`drivers/${row.driver_id}`, name),
              })}`
            : ''
        }
        ${
          teamsHere.length
            ? `<h2>Constructors here</h2>${fromColumns(TEAM_COLUMNS, teamsHere, {
                constructor: (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(name)),
              })}`
            : ''
        }
        ${
          layoutsHere.length
            ? `${heading('Every layout raced here', layoutsCount(layoutsHere, outlinesHere))}${note(
                circuitOutlinesNote(outlinesHere.length, true),
              )}${layoutRows(c.name, layoutTimeline(layoutsHere, outlinesHere))}`
            : ''
        }
        <h2>Every race held here</h2>
        ${heldLine}
        ${
          racesHere.length
            ? `${fromColumns(CIRCUIT_RACE_COLUMNS, racesHere, {
                year: (year) => link(`seasons/${year}`, year),
                name_used: (name, row) => link(`races/${row.year}/${row.round}`, name),
                winner: (name, row) =>
                  row.status !== 'completed'
                    ? tag(NOT_YET_RUN)
                    : row.winner_id && !String(name ?? '').includes(' / ')
                      ? link(`drivers/${row.winner_id}`, name)
                      : text(name),
              })}`
            : EMPTY_STATE
        }
        <h2>On the record</h2>
        ${fields([
          // What the old opening list said that the strip above does not
          // (VD-49): the races, the span and the layout's figures are
          // queries/circuit.js's tiles now, as they are the app's, and the
          // rest follow under the heading Circuit.jsx gives its own record,
          // at the foot where it puts it.
          ['Official name', text(c.official_name)],
          ['Location', text(list([c.locality, c.country]))],
          ['Confidence', c.confidence ? link('data/quality', c.confidence) : text(c.confidence)],
        ])}`,
    })
  }
}

// ------------------------------------------------------------ grands prix
//
// IA-01: the event a race is an edition of, which had a table, a view and no
// page. The register and each event's page read web/src/queries/grandsprix.js
// and grandprix.js, the app's own queries and column lists.

{
  const register = all(GRANDS_PRIX)
  const lastWinner = (name, row) =>
    row.last_winner_id
      ? `${link(`drivers/${row.last_winner_id}`, name)}${row.last_co_winner_id ? ` ${tag(SHARED)}` : ''}`
      : text(name)

  page({
    path: 'grands-prix',
    title: NAMES.grandsPrix().title,
    description: `All ${register.length} Formula One Grands Prix, with how often each has been held, when, at how many circuits, and who won it last.`,
    trail: TRAIL.grandsPrix(),
    onward: ONWARD.grandsPrix(),
    body: `
      <h1>${esc(NAMES.grandsPrix().headline)}</h1>
      <p class="lede">${esc(GRANDS_PRIX_LEDE)}</p>
      ${fromColumns(GRANDS_PRIX_COLUMNS, register, {
        name: (name, row) => link(`grands-prix/${row.id}`, name),
        last_winner: lastWinner,
      })}
      ${note(GRANDS_PRIX_FOOTER)}`,
  })

  for (const { id } of register) {
    const gp = one(GRAND_PRIX, id)
    const circuitsHere = all(GP_CIRCUITS, id)
    const editions = all(GP_EDITIONS, id)
    const winners = all(GP_WINNERS, id)
    const venue = (name, row) => (row.circuit_id ? link(`circuits/${row.circuit_id}`, name ?? row.circuit_id) : text(name))
    page({
      path: `grands-prix/${id}`,
      lastmod: LAST_RUN.grandPrix.get(id),
      title: NAMES.grandPrix(gp.name).title,
      description: summarise(
        `The ${gp.name}: ${gp.held} ${gp.held === 1 ? 'edition' : 'editions'} run${
          gp.first_held ? `, ${span(gp.first_held, gp.last_held)}` : ''
        }, at ${gp.circuits} ${gp.circuits === 1 ? 'circuit' : 'circuits'}. ${gp.notes ?? ''}`,
        300,
      ),
      trail: TRAIL.grandPrix(id, gp.name),
      onward: ONWARD.grandPrix({ editions, winners }),
      body: `
        <h1>${esc(NAMES.grandPrix(gp.name).headline)}</h1>
        ${gp.notes ? `<p class="lede">${esc(gp.notes)}</p>` : ''}
        ${stats([
          { label: 'Times held', value: esc(number(gp.held)) },
          { label: 'Span', value: esc(span(gp.first_held, gp.last_held)) },
          { label: 'Circuits', value: esc(number(gp.circuits)) },
          gp.scheduled ? { label: 'Still to come', value: esc(number(gp.scheduled)) } : null,
        ])}
        <h2>Where it has been held</h2>
        ${fromColumns(GP_CIRCUIT_COLUMNS, circuitsHere, {
          circuit: venue,
          first_year: (_, row) =>
            row.first_year === null && row.scheduled ? tag(NOT_YET_RUN) : esc(span(row.first_year, row.last_year)),
        })}
        ${
          winners.length
            ? `<h2>Most wins</h2>${fromColumns(
                GP_WINNER_COLUMNS,
                winners,
                { driver: (name, row) => link(`drivers/${row.driver_id}`, name) },
              )}`
            : ''
        }
        <h2>Every edition</h2>
        ${fromColumns(GP_EDITION_COLUMNS, editions, {
          year: (year) => link(`seasons/${year}`, year),
          name_used: (name, row) => `${link(`races/${row.year}/${row.round}`, name)}${row.sprint ? ` ${tag(SPRINT)}` : ''}`,
          circuit: venue,
          winner: (name, row) =>
            row.status !== 'completed'
              ? tag(NOT_YET_RUN)
              : row.winner_id
                ? `${link(`drivers/${row.winner_id}`, name)}${row.co_winner_id ? ` ${tag(SHARED)}` : ''}`
                : text(name),
          constructor: (name, row) =>
            row.status === 'completed' && row.constructor_id
              ? link(`constructors/${row.constructor_id}`, name)
              : esc(editionCar(name, row)),
        })}
        <h2>On the record</h2>
        ${fields([
          ['Also run as', gp.aliases ? esc(gp.aliases) : null],
          ['Confidence', gp.confidence ? link('data/quality', gp.confidence) : text(gp.confidence)],
        ])}`,
    })
  }
}

// ------------------------------------------------------------------- cars

{
  const cars = all(`
    SELECT c.*, k.name AS constructor_name
      FROM cars c
      LEFT JOIN constructors k ON k.id = c.constructor_id
     ORDER BY c.from_year, c.designation
  `)

  // EVERY chassis, because the app links every one of them. Cars.jsx builds its
  // register from `chassis` and links each row to /cars/<id>, so writing pages
  // from `cars` alone left 1,130 routes that worked in the app and answered 404
  // to anyone who followed a shared link — the static half of the site
  // contradicting the half that replaces it.
  //
  // The set is the UNION rather than a swap. Car.jsx resolves /cars/:id against
  // a chassis id OR, where no chassis owns the id, a car id: six ids name a car
  // whose variants are separate chassis rows (`lotus-72` is the 72B, 72C, 72D
  // and 72E, and no race entry is ever attributed to `lotus-72` itself).
  // Iterating `chassis` alone would have generated 1,130 new pages and deleted
  // those six.
  const chassis = all(`
    SELECT ch.*, k.name AS constructor
      FROM chassis ch
      LEFT JOIN constructors k ON k.id = ch.constructor_id
     ORDER BY ch.first_year, ch.name
  `)

  // One pass, grouped in memory: 20,737 rows against 1,130 queries.
  const raced = new Map()
  for (const e of all(`
    SELECT e.chassis_id, e.driver_id, r.year, r.round, r.name_used,
           d.full_name AS driver, e.grid_text, e.position_text, e.status
      FROM race_entries e
      JOIN races r ON r.id = e.race_id
      LEFT JOIN drivers d ON d.id = e.driver_id
     WHERE e.chassis_id IS NOT NULL
     ORDER BY r.year, r.round
  `)) {
    if (!raced.has(e.chassis_id)) raced.set(e.chassis_id, [])
    raced.get(e.chassis_id).push(e)
  }

  // The car page's tables read web/src/queries/car.js (PD-02, rung six):
  // the variants of a multi-chassis design, the seasons whose results cannot
  // be attributed, and every entry. A page for one chassis covers that
  // chassis; a page for a car no chassis shares an id with covers them all,
  // which is what VARIANTS resolves either way.
  const carTables = (id, variants, entries) => {
    const several = variants.length > 1
    const ambiguous = all(CAR_SEASONS, id, id).filter((s) => !s.corroborated)
    // Where the strip's derived wins and the article's figure differ, both
    // and why, in Car.jsx's words and where it puts them: before the seasons
    // that cannot be attributed, which are the reason (VD-49).
    const wins = winsNote(variants, entries)
    return `${
      several
        ? `<h2>Variants</h2>${fromColumns(VARIANT_COLUMNS, variants, {
            name: (name, row) => link(`cars/${row.id}`, name),
          })}${note(VARIANTS_FOOTER)}`
        : ''
    }${wins ? noteBox(wins.head, wins.body) : ''}${
      ambiguous.length
        ? `<h2>Seasons that cannot be attributed</h2>${fromColumns(CAR_AMBIGUOUS_COLUMNS, ambiguous, {
            year: (year) => link(`seasons/${year}`, year),
          })}${note(CAR_AMBIGUOUS_FOOTER)}`
        : ''
    }<h2>Every entry</h2>${
      entries.length
        ? fromColumns(entryColumns(several), entries, {
            year: (year) => link(`seasons/${year}`, year),
            name_used: (name, row) => link(`races/${row.year}/${row.round}`, name),
            driver: (name, row) => (row.driver_id ? link(`drivers/${row.driver_id}`, name) : text(name)),
            chassis: (name, row) => (row.chassis_id ? link(`cars/${row.chassis_id}`, name) : text(name)),
            position_text: (value, row) =>
              missing(row.finish_position)
                ? `<span class="tag tag-dnf">${esc(entryResult(value, row))}</span>`
                : `<b>${esc(entryResult(value, row))}</b>`,
          })
        : `<p class="measure">${esc(NO_ENTRIES)}</p>`
    }`
  }

  page({
    path: 'cars',
    title: NAMES.cars().title,
    description: `${cars.length} landmark Formula One chassis specified in full, and the register of all ${chassis.length} chassis that have started a Grand Prix.`,
    trail: TRAIL.cars(),
    onward: ONWARD.cars(),
    body: `
      <h1>${esc(NAMES.cars().headline)}</h1>
      <p class="lede">${cars.length} landmark chassis, specified and sourced, and behind them
        every chassis with a championship entry — ${num(chassis.length)} of them, most raced by a
        privateer for a single weekend. A blank is a figure nobody published, not a car
        with no wheelbase.</p>
      <h2>The cars with a page of their own</h2>
      ${fromColumns(GALLERY_COLUMNS, all(GALLERY), { car: (name, row) => link(`cars/${row.id}`, name) })}
      <h2>The chassis register</h2>
      <p class="measure">Every chassis that has started a championship Grand Prix, whether or not anybody
        has published a specification for it.</p>
      ${fromColumns(
        CHASSIS_COLUMNS,
        all(CHASSIS),
        {
          name: (name, row) => `${link(`cars/${row.id}`, name)}${row.landmark ? ` ${tag(LANDMARK)}` : ''}`,
          constructor: (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name ?? row.constructor_id) : text(name)),
        },
      )}
      ${note(CHASSIS_FOOTER)}`,
  })

  // A curated car's page. `at` is the address: the car's own, or - where the
  // car is the whole of one chassis - the chassis's, which is a declared copy
  // of it (IA-06). The app draws the one page at both, so the static half
  // does too, and names the car's as canonical from the copy.
  const curatedPage = (c, at) => {
    const variants = all(VARIANTS, c.id)
    // The app's name for the page, from the same function (IA-06).
    const name = carPageName(variants, c)
    const carEntries = all(CAR_ENTRIES, c.id)
    // Second on the page, where Car.jsx puts it: after the figures that say
    // what the car is and before the prose that says why it mattered.
    const photos = photographs(at)
    const photoFirst = leadsWithPhotograph(variants, SEASON_NOW_YEAR)
    // Where the car is one chassis, its figures are the ones Car.jsx prints,
    // resolved by the same precedence (IA-28): the chassis's where it has
    // one, the curated row's where it does not. Every other curated page
    // still prints its curated row.
    const row = one(CAR_ROW, c.id, c.id)
    const whole = wholeOfOneChassis(row)
    const facts = whole ? carFacts(variants[0], row) : c
    const specification = whole
      ? (({ chassis: build, engine }) => [...build, ...engine].map(({ label, value }) => [label, text(value)]))(
          specificationFields(facts),
        )
      : [
          ['Engine', text(c.engine_name)],
          ['Configuration', text(list([c.engine_config, c.capacity_cc ? `${c.capacity_cc} cc` : null, c.aspiration]))],
          ['Power', c.power_bhp ? `${c.power_bhp} bhp${c.power_note ? ` (${c.power_note})` : ''}` : '—'],
          ['Chassis', text(c.chassis_type)],
          ['Gearbox', text(c.gearbox)],
          ['Suspension', text(c.suspension)],
          ['Brakes', text(c.brakes)],
          ['Weight', c.weight_kg ? `${c.weight_kg} kg` : '—'],
          ['Wheelbase', c.wheelbase_mm ? `${c.wheelbase_mm} mm` : '—'],
          ['Tyres', text(c.tyres)],
        ]
    page({
      path: `cars/${at}`,
      canonical: at === c.id ? null : `cars/${c.id}`,
      lastmod: LAST_RUN.car.get(at),
      title: NAMES.car(name).title,
      image: photos.image,
      description: summarise(
        `${name}, ${c.from_year ?? '?'}–${c.to_year ?? '?'}${facts.engine_name ? `, ${facts.engine_name}` : ''}${
          facts.designers ? `, designed by ${facts.designers}` : ''
        }. ${c.concept ?? c.story ?? ''}`,
        300,
      ),
      trail: TRAIL.car(at, name),
      onward: ONWARD.car({ chassis: variants[0] ?? c, car: c, entries: carEntries }),
      body: `
        <h1>${esc(NAMES.car(name).headline)}</h1>
        ${photoFirst && photos.html ? `${photos.html}<h2>${esc(FIGURES_HEADING)}</h2>` : ''}
        ${tiles(carStrip(variants, row, carEntries))}
        ${disagree(all(CAR_DISAGREEMENTS, at), 'this car')}
        ${photoFirst ? '' : photos.html}
        ${prose(c.concept)}
        ${prose(c.innovations)}
        ${prose(c.story)}
        ${prose(c.outcome)}
        ${carTables(c.id, variants, carEntries)}
        <h2>On the record</h2>
        ${fields([
          // What the old opening list said that the strip above does not
          // (VD-49). The strip is queries/car.js's, as the app's is, so its
          // entries, wins and poles are counted from the race records; the
          // curated row's own races, wins and poles, which the app prints
          // nowhere and which part from the count on several of these cars,
          // are no longer printed beside them as a second "Wins".
          // The name, as the app prints it: the id was the storage model on
          // the six most famous pages in the register (IA-06).
          ['Constructor', c.constructor_id ? link(`constructors/${c.constructor_id}`, c.constructor_name ?? c.constructor_id) : '—'],
          ['Years', `${c.from_year ?? '?'}–${c.to_year ?? '?'}`],
          ['Designers', text(facts.designers)],
          ...specification,
          // The curated row's grade of its own figures, which a page showing
          // the chassis's does not print; nor does the app.
          ['Specification confidence', whole ? null : text(c.spec_confidence)],
        ])}`,
    })
  }

  for (const c of cars) curatedPage(c, c.id)

  // The rest of the register. `cars` ids are skipped because the loop above has
  // already written those pages from the richer curated row.
  //
  // Facts are passed RAW rather than through text(), so fields() drops the ones
  // nothing is known for. 376 of these chassis carry no specification at all,
  // and a page of twenty em dashes claims twenty times over that nobody has
  // established a figure — which is true, and is not worth saying twenty times.
  const curated = new Set(cars.map((c) => c.id))

  const byId = new Map(cars.map((c) => [c.id, c]))
  for (const ch of chassis) {
    if (curated.has(ch.id)) continue
    // The chassis address of a car that is this chassis and nothing else is
    // the car's page again, as it is in the app (IA-06, IA-28).
    const carRow = one(CAR_ROW, ch.id, ch.id)
    if (ch.car_id && wholeOfOneChassis(carRow)) {
      curatedPage(byId.get(ch.car_id), ch.id)
      continue
    }

    const name = ch.full_name ?? ch.name
    const years = ch.first_year === ch.last_year
      ? String(ch.first_year ?? '?')
      : `${ch.first_year ?? '?'}–${ch.last_year ?? '?'}`
    const entries = raced.get(ch.id) ?? []
    const variants = all(VARIANTS, ch.id)
    const carEntries = all(CAR_ENTRIES, ch.id)
    const constructor = ch.constructor ?? ch.constructor_id
    const photos = photographs(ch.id)
    // This year's chassis opens on its photograph, as Car.jsx's does (PD-49).
    const photoFirst = leadsWithPhotograph(variants.length ? variants : [ch], SEASON_NOW_YEAR)
    // A chassis that is the whole of a curated car is a copy of the car's
    // page, and says so (IA-06); queries/car.js holds the rule for both halves.
    const address = carAddress(ch.id, carRow)

    page({
      path: `cars/${ch.id}`,
      canonical: address.slice(1),
      lastmod: LAST_RUN.car.get(ch.id),
      title: NAMES.car(name).title,
      image: photos.image,
      description: summarise(
        `${name}, ${constructor ? `entered by ${constructor}, ` : ''}${years}. ` +
          `${entries.length ? `${entries.length} championship ${entries.length === 1 ? 'entry' : 'entries'}` : 'No championship entry recorded'}` +
          `${ch.wins ? `, ${ch.wins} ${ch.wins === 1 ? 'win' : 'wins'}` : ''}` +
          `${ch.engine_name ? `. ${ch.engine_name} engine` : ''}.`,
        300,
      ),
      trail: TRAIL.car(ch.id, name),
      onward: ONWARD.car({ chassis: variants[0] ?? ch, car: null, entries: carEntries }),
      body: `
        <h1>${esc(NAMES.car(name).headline)}</h1>
        ${photoFirst && photos.html ? `${photos.html}<h2>${esc(FIGURES_HEADING)}</h2>` : ''}
        ${tiles(carStrip(variants, carRow, carEntries))}
        ${photoFirst ? '' : photos.html}
        ${
          ch.car_id && curated.has(ch.car_id)
            ? `<p class="measure">One of the ${link(`cars/${ch.car_id}`, 'design family')} that has a specified page of its own.</p>`
            : ''
        }
        ${carTables(ch.id, variants, carEntries)}
        <h2>On the record</h2>
        ${fields([
          // What the old opening list said that the strip above does not
          // (VD-49): the seasons, the entries and the wins are
          // queries/car.js's tiles now, counted from the race records as the
          // app's are, so the stored wins - which part from that count on
          // some chassis - are no longer a second "Wins" beside them.
          ['Constructor', ch.constructor_id ? link(`constructors/${ch.constructor_id}`, constructor) : null],
          ['Designers', ch.designers],
          ['Engine', ch.engine_name],
          ['Configuration', list([ch.engine_config, ch.capacity_cc ? `${ch.capacity_cc} cc` : null, ch.aspiration]) || null],
          ['Power', ch.power_bhp ? `${ch.power_bhp} bhp${ch.power_note ? ` (${ch.power_note})` : ''}` : null],
          ['Chassis', ch.chassis_type],
          ['Gearbox', ch.gearbox],
          ['Brakes', ch.brakes],
          ['Tyres', ch.tyres],
          ['Weight', ch.weight_kg ? `${ch.weight_kg} kg` : null],
          ['Wheelbase', ch.wheelbase_mm ? `${ch.wheelbase_mm} mm` : null],
          ['Published wins', ch.published_wins === null ? null : num(ch.published_wins)],
          ['Confidence', ch.confidence ? link('data/quality', ch.confidence) : text(ch.confidence)],
        ])}`,
    })
  }
}

// ------------------------------------------------- records, sport, data

{
  // The app's query and the app's column list, from the module Records.jsx
  // reads: the static table had a Category column the app never shows and
  // sorted by a different key (CR-23), and said nothing about the tier the
  // app states once above its table (CR-22). Where every record shares a
  // tier that sentence is the app's, around a link to the ladder.
  //
  // WK-08: the headline records, then every other record once under its
  // family, from the same helpers the app groups them with, and in the app's
  // order: the headline cards, the two leaderboard sections, then the
  // families (VD-68), so the offset handOver() puts back lands on the same
  // section. The app draws each leaderboard as a chart of its first
  // LEADERS_DRAWN rows; this half has no chart and carries those rows as the
  // figure's table, open, which stands about as tall as the chart does - all
  // forty rows would put the families a screen or two lower here than in the
  // app. Each family's heading carries its section's address, which the line
  // under the headline cards links, as the app's does.
  const records = all(RECORDS)
  const tiers = tiersOf(records)
  const asOf = asOfOf(records)
  const headline = headlineRecords(records)
  const families = recordFamilies(records)
  const extras = cardExtras(records)
  // The cards, as Records.jsx's RecordCards draws them.
  const recordCards = (rows) =>
    `<ul class="record-cards">${rows
      .map((row) => {
        const path = holderPath(row)
        return `<li class="record-card"><h3 class="record-card-name">${link(recordPath(row), row.record)}</h3><p class="record-card-value">${esc(
          row.value,
        )}</p><p class="record-card-holder">${path ? link(path, row.holder) : esc(row.holder)}</p>${extras
          .map(
            (c) =>
              `<p class="record-card-extra">${esc(c.label)}: ${c.key === 'confidence' ? confidencePill(row.confidence) : esc(row[c.key])}</p>`,
          )
          .join('')}<details class="record-card-how"><summary>${esc(DERIVATION)}</summary><p>${esc(row.detail)}</p></details></li>`
      })
      .join('')}</ul>`
  const driverLink = { full_name: (name, row) => link(`drivers/${row.driver_id}`, name) }
  // Each table named for its figure, as the app's Figure names it, rather
  // than for the section heading two of them share (AX-28).
  const leaders = (spec, columns, rows, links) => {
    const drawn = leadersDrawn(rows, spec.key)
    const body = fromColumns(columns, drawn, links)
    if (body.split('<table>').length !== 2) die(`prerender: the ${spec.title} figure is not one table`)
    return figure(
      spec.title,
      `${spec.note} ${leadersDrawnLine(drawn.length)}`,
      body.replace('<table>', `<table><caption class="sr-only">${esc(spec.title)}</caption>`),
    )
  }
  const recordTable = (rows) =>
    fromColumns(recordColumns(records), rows, {
      record: (value, row) => link(recordPath(row), value),
      confidence: (value) => (value ? link('data/quality', value) : text(value)),
      holder: (value, row) => {
        const path = holderPath(row)
        return path ? link(path, value) : text(value)
      },
    })
  page({
    path: 'records',
    title: NAMES.records().title,
    description: `${records.length} Formula One records, each derived from the database's own race records and stating how.`,
    trail: TRAIL.records(),
    onward: ONWARD.records({ driverWins: all(DRIVER_WINS) }),
    body: `
      <h1>${esc(NAMES.records().headline)}</h1>
      <p class="lede">${esc(RECORDS_LEDE)}${asOf ? ` ${esc(asOfLine(asOf))}` : ''}${
          tiers.length === 1
            ? ` ${esc(tierBefore(records.length))}${link('data/quality', tiers[0])}${esc(TIER_AFTER)}`
            : ''
        }</p>
      <h2>${esc(HEADLINE)} <span class="count">${headline.length}</span></h2>
      ${recordCards(headline)}
      ${
        families.length
          ? `<nav class="note" aria-label="Records by family">${esc(familiesLead(records.length - headline.length))} ${families
              .map((f) => `<a href="#${esc(f.anchor)}">${esc(f.family)}</a> <span class="faint">${f.rows.length}</span>`)
              .join(' · ')}</nav>`
          : ''
      }
      ${heading(LEADERBOARDS)}
      <div class="split">${leaders(DRIVER_WINS_FIGURE, DRIVER_WINS_COLUMNS, all(DRIVER_WINS), driverLink)}${leaders(
        DRIVER_POLES_FIGURE,
        DRIVER_POLES_COLUMNS,
        all(DRIVER_POLES),
        driverLink,
      )}</div>
      ${heading(CONSTRUCTORS_HEADING)}
      ${leaders(CONSTRUCTOR_WINS_FIGURE, CONSTRUCTOR_WINS_COLUMNS, all(CONSTRUCTOR_WINS), {
        name: (name, row) => link(`constructors/${row.id}`, name),
      })}
      ${families
        .map(
          (f) =>
            `<h2 id="${esc(f.anchor)}">${esc(f.family)} <span class="count">${f.rows.length}</span></h2>${recordTable(f.rows)}`,
        )
        .join('')}`,
  })

  // One page per record, at its key (PD-27): the row, and the citation
  // block every page carries. The key is the address because the id moves
  // (DA-26); a key that is not a slug would write a path that is not one
  // record, so it stops the build here rather than shipping.
  for (const { key } of records) {
    if (!KEY_SHAPE.test(key)) die(`prerender: records.key "${key}" is not a slug, so it cannot be an address`)
    const record = one(RECORD, key)
    const holder = holderPath(record)
    page({
      path: recordPath(record),
      title: NAMES.record(record.record).title,
      description: summarise(`${record.record}: ${record.holder}, ${record.value}. ${record.detail}`, 300),
      trail: TRAIL.record(record.key, record.record),
      onward: ONWARD.record({ record, holder }),
      body: `
        <h1>${esc(NAMES.record(record.record).headline)}</h1>
        ${stats([
          { label: 'Value', value: esc(record.value), lead: true },
          { label: 'Holder', value: holder ? link(holder, record.holder) : esc(record.holder) },
        ])}
        <h2>${esc(DERIVATION)}</h2>
        ${prose(record.detail)}
        <h2>On the record</h2>
        ${fields([
          ['As of', esc(record.as_of)],
          ['Confidence', confidencePill(record.confidence)],
          ['Category', esc(record.category)],
          ['Family', esc(record.family)],
          ['Comparable figure', esc(number(record.value_num))],
          ['Unit', esc(record.unit)],
          ['Key', `<code>${esc(record.key)}</code>`],
        ])}`,
    })
  }

  const eras = all(ERAS)
  page({
    path: 'reference/eras',
    title: NAMES.eras().title,
    description: 'Formula One divided into eras, with the dominant teams and defining features of each.',
    trail: TRAIL.eras(),
    onward: ONWARD.eras(),
    body: `
      <h1>${esc(NAMES.eras().headline)}</h1>
      ${eras
        .map(
          (e) => `<section class="section">
            <h2>${esc(e.era_name)} <span class="faint">${e.from_year}–${e.to_year ?? 'present'}</span></h2>
            ${prose(e.summary)}
            ${fields([
              ['Dominant teams', text(e.dominant_teams)],
              ['Defining features', text(e.defining_features)],
            ])}
          </section>`,
        )
        .join('')}
      <h2>Engine formulae</h2>
      ${fromColumns(ENGINE_COLUMNS, all(ENGINES), {
        era_name: (name, row) =>
          `<b>${esc(name)}</b> <br><span class="faint small">${esc(span(row.from_year, row.to_year))}</span>`,
      })}
      <h2>Scoring systems</h2>
      <p class="note">${esc(POINTS_NOTE)}</p>
      ${fromColumns(POINTS_COLUMNS, all(POINTS))}
      <h2>Regulation changes</h2>
      ${fromColumns(REGULATION_COLUMNS, all(REGULATIONS))}
      <h2>Regulation limits</h2>
      <p class="note">${esc(LIMITS_NOTE)}</p>
      ${fromColumns(LIMIT_COLUMNS, all(LIMITS))}
      <h2>Technical innovations</h2>
      ${fromColumns(INNOVATION_COLUMNS, all(INNOVATIONS))}
      ${timeline(all(SAFETY))}
      <h2>Governance</h2>
      ${fromColumns(GOVERNANCE_COLUMNS, all(GOVERNANCE))}
      <h2>Tyre suppliers</h2>
      ${fromColumns(TYRE_COLUMNS, all(TYRES))}`,
  })

  const glossary = all(GLOSSARY)
  page({
    path: 'reference/glossary',
    title: NAMES.glossary().title,
    description: `${glossary.length} Formula One terms defined — the vocabulary the rest of this database uses.`,
    trail: TRAIL.glossary(),
    onward: ONWARD.glossary(),
    body: `
      <h1>${esc(NAMES.glossary().headline)}</h1>
      <h2>Glossary</h2>
      ${fromColumns(GLOSSARY_COLUMNS, glossary)}
      <h2>People</h2>
      ${fromColumns(PERSONNEL_COLUMNS, all(PERSONNEL))}`,
  })

  const sources = all(SOURCES)
  page({
    path: 'data/sources',
    title: NAMES.sources().title,
    description:
      'Every source this database draws on, what it is trusted for, its licence, and how its claims are cross-checked.',
    trail: TRAIL.sources(),
    onward: ONWARD.sources(),
    body: `
      <h1>${esc(NAMES.sources().headline)}</h1>
      <p class="lede">What each source is trusted for, under what licence, and what constrains it.</p>
      <h2>What a licence cost, or bought</h2>
      <p class="note">${esc(CONSEQUENCES_NOTE)}</p>
      ${fromColumns(CONSEQUENCE_COLUMNS, CONSEQUENCES)}
      <h2>The source registry</h2>
      ${fromColumns(SOURCE_COLUMNS, sources, {
        source: (name, row) => (row.url && row.url !== 'None' ? `<a href="${esc(row.url)}">${esc(name)}</a>` : text(name)),
      })}
      ${note(SOURCES_FOOTER)}
      <p class="measure">${esc(OUTLINES_NOTE)}</p>
      <h2>Photograph licences</h2>
      <p class="note">${esc(LICENCES_NOTE)}</p>
      ${fromColumns(LICENCE_COLUMNS, all(LICENCES), {
        licence: (name, row) => (row.licence_url ? `<a href="${esc(row.licence_url)}">${esc(name)}</a>` : text(name)),
      })}`,
  })

  // The database's front door — the one crawlable surface that can carry the
  // claim, since robots.txt keeps crawlers off the files it links. The
  // wording is site.js's, shared with Data.jsx, so the static page and the
  // app cannot claim different things. The JSON-LD is a Dataset: the one
  // search surface built for the reader this page is for.
  {
    // The app's query, from the module Data.jsx reads (VD-49).
    const shape = one(DATA_SHAPE)
    const classes = Object.fromEntries(
      all('SELECT redistributable, COUNT(*) AS n FROM source_registry GROUP BY redistributable').map((r) => [r.redistributable, r.n]),
    )
    const ladder = all('SELECT confidence FROM provenance ORDER BY rank').map((r) => r.confidence)
    const download = (file, label) => ({
      '@type': 'DataDownload',
      name: label,
      contentUrl: `${ORIGIN}${href(file)}`,
    })
    page({
      path: 'data',
      title: NAMES.data().title,
      description: `The whole site is one SQLite file, and you can have it. Formula One ${SPAN}, v${META.version}, built ${META.built}. ${CROSS_CHECKED}`,
      trail: TRAIL.data(),
      onward: ONWARD.data(),
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: `${SITE} — Formula One, ${SPAN}`,
        description: CROSS_CHECKED,
        url: `${ORIGIN}${href('data')}`,
        version: META.version,
        // The one field in here that names a file rather than a release. A
        // consumer that pinned `version` alone pinned nothing (SD-24).
        identifier: `sha256:${MANIFEST.sha256}`,
        dateModified: META.built,
        temporalCoverage: String(META.coverage_seasons ?? '').replace('-', '/'),
        license: 'https://creativecommons.org/licenses/by-sa/4.0/',
        isAccessibleForFree: true,
        creator: PUBLISHED_BY,
        publisher: PUBLISHED_BY,
        distribution: [
          { ...download('f1.db.gz', 'f1.db.gz — the SQLite database, gzipped'), encodingFormat: 'application/gzip' },
          {
            '@type': 'DataDownload',
            name: 'f1.db — the SQLite database, uncompressed, from the repository',
            contentUrl: RAW_DATABASE_URL,
            encodingFormat: 'application/vnd.sqlite3',
          },
          {
            ...download('f1-geometry.db', 'f1-geometry.db — circuit centrelines, © OpenStreetMap contributors, ODbL 1.0'),
            encodingFormat: 'application/vnd.sqlite3',
            license: 'https://opendatacommons.org/licenses/odbl/1-0/',
          },
          { ...download('f1-parquet.zip', 'f1-parquet.zip — every table as Parquet'), encodingFormat: 'application/zip' },
        ],
      },
      body: `
      <h1>${esc(NAMES.data().headline)}</h1>
      <p class="lede">The whole site is one SQLite file, and you can have it. What it is, the files
        it comes as, how far to trust it, and what you may do with it.</p>
      ${tiles(fileStrip(META, shape))}
      <p class="measure">${esc(CROSS_CHECKED)}</p>
      <h2>The files</h2>
      <ul class="cards">
        <li><a href="${esc(href('f1.db.gz'))}"><code>f1.db.gz</code></a> — the database, gzipped. ${esc(GUNZIP_NOTE)} <code>gunzip f1.db.gz</code>, then open it with any SQLite client; <code>circuit_geometry</code> in it is deliberately empty.</li>
        <li><a href="${esc(RAW_DATABASE_URL)}"><code>f1.db</code></a> — the same file uncompressed, too large for this host to serve: the repository’s current copy, which the next deploy is built from.</li>
        <li><a href="${esc(href('f1-geometry.db'))}"><code>f1-geometry.db</code></a> — the circuit centrelines, © OpenStreetMap contributors under ODbL 1.0, in a file of their own.</li>
        <li><a href="${esc(href('f1-parquet.zip'))}"><code>f1-parquet.zip</code></a> — every table as Parquet, one file each; pandas, polars and DuckDB read it directly.</li>
      </ul>
      <p class="measure">${esc(TWO_FILES)} ${esc(SELF_DESCRIBING)}</p>
      <p class="faint">Two JSON exports — <code>f1_database.json.gz</code>, every table, and
        <code>f1_compat.json</code>, the original v1 key layout — are written by the same build
        and travel with each release rather than being served from here.</p>
      ${fields([
        ['f1.db digest', `<code>${esc(MANIFEST.digest)}</code>`],
        ['f1-geometry.db digest', MANIFEST.geometry?.digest ? `<code>${esc(MANIFEST.geometry.digest)}</code>` : null],
      ])}
      <p class="source-note">${DIGEST_NOTE.split('SHA256SUMS')
        .map(esc)
        .join(`<a href="${esc(href('SHA256SUMS'))}"><code>SHA256SUMS</code></a>`)}</p>
      <h2>${esc(API_HEADING)}</h2>
      <p class="measure">${esc(API_NOTE)}</p>
      <ul class="cards">
        ${API_ENDPOINTS.map(([path, what]) => `<li><a href="${esc(href(path))}"><code>/${esc(path)}</code></a> — ${esc(what)}</li>`).join('')}
      </ul>
      <h2>What explains it</h2>
      <ul class="cards">
        ${DOCUMENTS.map(([file, what]) => `<li><a href="${esc(href(file))}"><code>${esc(file)}</code></a> — ${esc(what)}</li>`).join('')}
      </ul>
      <p class="measure">${esc(DOCUMENTS_NOTE)} <a href="${esc(REPOSITORY)}">The repository</a> holds the build, the
        checks that gate it and the source data they read, so the cross-checking claimed above can
        be read rather than taken on trust.</p>
      <h2>How far to trust it</h2>
      ${tiles(trustStrip(shape))}
      <p class="measure">The ladder, from the top: ${ladder.map(confidencePill).join(' ')}. Only an official source — the FIA or formula1.com — carries a row to the top. Where a
        career total derived from the race records differs from a published one, both are shown.
        ${link('data/quality', 'The full account')}: the ladder defined, every gap, every
        disagreement, and the reconciliation that runs on each build.</p>
      <h2>What you may do with it</h2>
      ${fields([
        ['Redistributable', `${(classes.yes ?? 0).toLocaleString()} sources — their rows may be passed on under the licence shown beside them.`],
        ['Facts only', `${(classes['facts-only'] ?? 0).toLocaleString()} sources — the facts are used; nothing is copied.`],
        ['Not redistributable', `${(classes.no ?? 0).toLocaleString()} sources — on the register so the position is on record; no row may cite one.`],
      ])}
      <p class="measure">${esc(NOT_HELD)}</p>
      <p class="measure">Race data from F1DB is CC BY 4.0; prose and registers from Wikipedia are CC BY-SA 4.0 and
        carry share-alike; the centrelines are ODbL and the obligation follows
        <code>f1-geometry.db</code> alone. What this project wrote itself — its reading of every
        disagreement and its account of every gap — is CC BY 4.0 and carries no share-alike;
        <code>meta.project_prose_columns</code> names those columns inside the database.
        ${link('data/sources', 'Every source')}, what it is
        trusted for, and what each licence cost or bought.</p>
      <h2>Ask it something</h2>
      <p class="measure">${link('data/sql', 'The SQL console')} runs any read against the whole database in your
        browser &mdash; and a query&rsquo;s address is a link to it.</p>
      <p class="measure">Where a view exists, start from it. <code>standings</code> keeps a row after every round
        and more than one source&rsquo;s reading of each, so the obvious query over it answers with the season
        several times over. <code>v_standings_final</code> folds both away: the end-of-season rows, one
        source&rsquo;s reading of each entrant. What it does not fold is the constructors&rsquo;
        championship&rsquo;s own grain &mdash; Cooper-Climax and Cooper-Maserati are two 1960 entries and not
        one &mdash; so count that side on <code>constructor_id</code> and <code>engine_id</code> together. The
        console&rsquo;s schema panel prints the commented schema of every table and view, which is where each
        column says what it means.</p>`,
    })
  }

  // Three groups, the same three Quality.jsx renders: the reader's sentence
  // first, the maintainer's note behind a disclosure. A closed gap is kept
  // and shown as closed, never dropped from the page.
  const gaps = all(GAPS)
  // The geometry coverage counts centrelines, which are not in f1.db (see
  // the circuits register above): the view's own SQL is run against the
  // sibling file, attached for the one query, so the figure is the view's and
  // not a second statement of it.
  const geoFile = join(repo, 'f1-geometry.db')
  db.exec(`ATTACH DATABASE '${geoFile.replace(/'/g, "''")}' AS geo`)
  const coverage = all(
    one("SELECT sql FROM sqlite_master WHERE name = 'v_geometry_coverage'")
      .sql.replace(/^CREATE VIEW \w+ AS\s*/i, '')
      .replace('LEFT JOIN circuit_geometry g', 'LEFT JOIN geo.circuit_geometry g'),
  )
  db.exec('DETACH DATABASE geo')
  const images = one(IMAGES) ?? {}
  // The register as Quality.jsx's <Gaps> draws it: the same three groups from
  // the same list, each a Section with its count, and one table per group with
  // the maintainer's note behind the same disclosure (VD-01). It was a run of
  // <section><h3> blocks here and a table there, from two copies of the three
  // headings and their notes.
  const gapGroup = ({ state, title, note: intro }) => {
    const rows = gaps.filter((g) => g.state === state)
    if (!rows.length) return ''
    return `${heading(title, rows.length)}<p class="note">${esc(intro)}</p>${fromColumns(GAP_COLUMNS, rows, {
      reader: (value, row) =>
        `<p class="gap-reader">${esc(value)}</p><details class="gap-note"><summary>${esc(
          MAINTAINER_NOTE,
        )}</summary>${prose(row.description)}${prose(row.resolution)}</details>`,
    })}`
  }
  page({
    path: 'data/quality',
    title: NAMES.quality().title,
    description:
      'The confidence model, the open discrepancies and every known gap — what this database does not know, stated rather than hidden.',
    trail: TRAIL.quality(),
    onward: ONWARD.quality(),
    body: `
      <h1>${esc(NAMES.quality().headline)}</h1>
      <p class="lede">A blank in this database is an unestablished fact, never a zero. These are
        the gaps that are known and stated.</p>
      ${GAP_GROUPS.map(gapGroup).join('')}
      <h2>The confidence ladder</h2>
      ${fromColumns(PROVENANCE_COLUMNS, all(PROVENANCE))}
      <p class="source-note">${esc(LADDER_NOTE)}</p>
      <h2>Disagreements kept rather than resolved</h2>
      <p class="note">${esc(DISCREPANCIES_NOTE)}</p>
      ${fromColumns(DISCREPANCY_COLUMNS, all(DISCREPANCIES))}
      <h2>Career totals against published ones</h2>
      <p class="note">${esc(RECONCILIATION_NOTE)}</p>
      ${fromColumns(RECONCILIATION_COLUMNS, all(RECONCILIATION))}
      <h2>Coverage</h2>
      ${figure(CHASSIS_TITLE, CHASSIS_NOTE, fromColumns(CHASSIS_COVERAGE_COLUMNS, all(CHASSIS_COVERAGE)))}
      <h2>Circuit geometry</h2>
      ${fromColumns(GEOMETRY_COLUMNS, coverage)}
      ${note(GEOMETRY_FOOTER)}
      <h2>Photographs</h2>
      ${stats(PHOTOGRAPH_STATS.map(({ key, label }) => ({ label, value: esc(formatted(images[key])) })))}
      <p class="source-note">${esc(PHOTOGRAPHS_UNNAMED_NOTE)}</p>
      <p class="source-note">${esc(photographsCatalogued(formatted(images.catalogued)))}</p>
      <h2>Where a result cannot be attributed to a car</h2>
      <p class="note">${esc(UNATTRIBUTED_NOTE)}</p>
      ${fromColumns(UNATTRIBUTED_COLUMNS, all(UNATTRIBUTED), { year: (year) => link(`seasons/${year}`, year) })}
      <h2>Rows nobody has checked</h2>
      ${fromColumns(UNVERIFIED_COLUMNS, all(UNVERIFIED))}
      ${note(UNVERIFIED_FOOTER)}`,
  })

  page({
    path: 'data/sql',
    title: NAMES.sql().title,
    description:
      // esc() runs over every description, so a named entity here ships as
      // `&amp;rsquo;`; the character itself does not (review finding, #580).
      'Run your own SQL against the whole database in your browser: it runs in this tab, and a query\u2019s address is a link you can share.',
    trail: TRAIL.sql(),
    onward: ONWARD.sql(),
    body: `
      <h1>${esc(NAMES.sql().headline)}</h1>
      <p class="lede">Every page on this site is a query against one SQLite file. Here you write
        your own: SQLite compiled to WebAssembly, running against the database file in your own
        browser. Nothing you type is sent as you write it &mdash; though running a statement keeps
        it in the address, so a link you share or reload carries it.</p>
      <!-- The JavaScript requirement belongs to the reader who has none. As a
           lede it was the whole visible prose of this page whenever the
           database failed to open, which diagnosed the one failure that had
           not happened (CD-40). -->
      <noscript><p class="measure">Running the console needs JavaScript. Downloading the file
        below does not.</p></noscript>
      <p class="measure">The database is a plain SQLite file. If you would rather query it with your own tools,
        download <a href="${esc(href('f1.db.gz'))}"><code>f1.db.gz</code></a>, gunzip it and open it with any
        SQLite client. The circuit centrelines are not in it — <code>circuit_geometry</code>
        there is deliberately empty — and ship beside it as
        <a href="${esc(href('f1-geometry.db'))}"><code>f1-geometry.db</code></a>.
        ${esc(TWO_FILES)} ${esc(SELF_DESCRIBING)}</p>`,
  })
}

// ------------------------------------------------------------------- about

/*
 * Who publishes this, and how to tell it it is wrong.
 *
 * UR-05: four of seven simulated readers stopped at the same place, because
 * no page on the site named a publisher, an editorial rule or a way in. The
 * prose is site.js's, shared with pages/About.jsx, so the page a crawler
 * reads and the page a reader reads make the same promises.
 */
{
  const linked = (after) => {
    if (after === 'repository') {
      return `<p class="measure">${esc(ABOUT_REPOSITORY[0])}<a href="${esc(REPOSITORY)}">${esc(
        ABOUT_REPOSITORY[1],
      )}</a>${esc(ABOUT_REPOSITORY[2])}</p>`
    }
    if (after === 'report') {
      return `<p class="measure">${esc(REPORT_ASK)} <a href="${esc(REPORT_URL)}">${esc(
        REPORT_LINK,
      )}</a>. ${esc(REPORT_PROMISE)}</p>`
    }
    return ''
  }
  page({
    path: 'about',
    title: NAMES.about().title,
    description: `${SITE} is built and kept by ${MAINTAINER}, one person, in the open. ${ABOUT_LEDE}`,
    trail: TRAIL.about(),
    onward: ONWARD.about(),
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: titled('About'),
      url: `${ORIGIN}${href('about')}`,
      description: ABOUT_LEDE,
      publisher: PUBLISHED_BY,
      about: { '@type': 'Dataset', name: `${SITE} — Formula One, ${SPAN}`, url: `${ORIGIN}${href('data')}` },
    },
    body: `
      <h1>${esc(NAMES.about().headline)}</h1>
      <p class="lede">${esc(ABOUT_LEDE)}</p>
      ${ABOUT.map(
        ({ title, paragraphs, after }) =>
          `${heading(title)}${paragraphs.map(prose).join('')}${linked(after)}`,
      ).join('')}`,
  })
}

// ----------------------------------------------------------------- changes
//
// SD-20: the harvest refreshed every morning and there was no way to learn
// that it had. The facts an entry needs - the version, the build date, what
// the file now holds - were computed daily and dropped. This is the page that
// says so and the feed that carries it; lib/changes.js holds the record and
// the reasoning behind what counts as an entry.
{
  const figures = one(CHANGES_SHAPE)
  const latest = one(CHANGES_LATEST)
  const now = currentBuild({ version: META.version, built: META.built, figures })
  // The feed's entries and the table's rows are deliberately not the same
  // list. The table is the release history - every tagged release, including
  // the one the current build happens to be - and Changes.jsx renders exactly
  // the same array, so the static page and the app agree row for row. The feed
  // drops a release that IS the current build, because the current entry
  // already carries that pair and a reader would otherwise be told twice.
  const timeline = feedEntries(now)
  const feedUrl = `${ORIGIN}${href(FEED_FILE)}`
  const changesUrl = `${ORIGIN}${href('changes')}`

  page({
    path: 'changes',
    title: titled(CHANGES_TITLE),
    description: CHANGES_DESCRIPTION,
    trail: TRAIL.changes(CHANGES_TITLE),
    onward: ONWARD.changes({ latest }),
    body: `
      <h1>${esc(CHANGES_TITLE)}</h1>
      <p class="lede">${esc(CHANGES_LEDE)}</p>
      <h2>${esc(CURRENT_HEADING)}</h2>
      ${fields([
        ['Version', `v${esc(META.version)}`],
        ['Built', esc(META.built)],
        [CHECKED_LABEL, esc(LAST_CHECKED)],
        [
          'Races',
          `${figures.races_run.toLocaleString()} run, of ${figures.races.toLocaleString()} on the calendar`,
        ],
        [
          'Most recent',
          latest
            ? `${link(`races/${latest.year}/${latest.round}`, latest.name_used)}, ${esc(latest.date_iso)}`
            : null,
        ],
        ['Race entries', figures.entries.toLocaleString()],
        ['Qualifying rows', figures.qualifying.toLocaleString()],
        ['Drivers', figures.drivers.toLocaleString()],
        ['Constructors', figures.constructors.toLocaleString()],
        [
          'Open disagreements',
          link('data/quality', `${figures.open_discrepancies.toLocaleString()} recorded, not resolved`),
        ],
        ['Known gaps', link('data/quality', `${figures.open_gaps.toLocaleString()} stated`)],
      ])}
      ${note(CHECKED_NOTE)}
      ${note(CURRENT_NOTE)}
      <h2>${esc(FEED_HEADING)}</h2>
      <p class="measure">${esc(FEED_NOTE)} <a href="${esc(href(FEED_FILE))}">${esc(FEED_LINK_TEXT)}</a>.</p>
      <h2>${esc(HISTORY_HEADING)}</h2>
      ${fromColumns(RELEASE_COLUMNS, RELEASES)}
      ${note(HISTORY_NOTE)}`,
  })

  /*
   * The feed.
   *
   * Atom rather than RSS: an entry's `id` is required and is a plain string,
   * which is what lets every entry point at the same page without a reader
   * treating the history as one item it has already seen. `updated` must be a
   * full RFC 3339 timestamp, and the dates here are days - the build date is a
   * day by construction, since BUILT is a constant and not a clock [D-01] - so
   * they are widened to midnight UTC rather than given a time nobody measured.
   *
   * Written here, beside the page it summarises, so a change to one is a
   * change to the other in the same place.
   */
  const rfc3339 = (day) => `${day}T00:00:00Z`
  const entry = (e) => `  <entry>
    <title>${esc(e.title)}</title>
    <id>${esc(entryId(e))}</id>
    <updated>${esc(rfc3339(e.published))}</updated>
    <link rel="alternate" type="text/html" href="${esc(changesUrl)}" />
    <summary>${esc(
      e.isCurrent
        ? `Database v${e.version}, built ${e.built}: ${e.figures.races_run.toLocaleString()} races run of ${e.figures.races.toLocaleString()} on the calendar, ${e.figures.entries.toLocaleString()} race entries, ${e.figures.qualifying.toLocaleString()} qualifying rows, ${e.figures.open_discrepancies.toLocaleString()} open disagreements and ${e.figures.open_gaps.toLocaleString()} known gaps.`
        : `Released ${e.published}, built ${e.built}.`,
    )}</summary>
  </entry>`

  writeFileSync(
    join(dist, FEED_FILE),
    `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(FEED_TITLE)}</title>
  <subtitle>${esc(FEED_SUBTITLE)}</subtitle>
  <id>${esc(`${ORIGIN}${href('')}`)}</id>
  <link rel="self" type="application/atom+xml" href="${esc(feedUrl)}" />
  <link rel="alternate" type="text/html" href="${esc(changesUrl)}" />
  <updated>${esc(rfc3339(timeline[0].published))}</updated>
  <author><name>${esc(MAINTAINER)}</name></author>
  <rights>${esc(feedRights(`${ORIGIN}${href('data/sources')}`))}</rights>
${timeline.map(entry).join('\n')}
</feed>
`,
  )
}

// ------------------------------------------------------------ measurement

// The tags, their shapes and the whole of the reasoning are in
// scripts/measurement.js. They live there rather than here because a test can
// call a function and can only grep a script: the assertion that used to pin
// the beacon's `"spa": false` was satisfied by this file's own status line,
// and deleting the tag left it passing (review finding, 2026-09-22).
const { tags: MEASUREMENT, status: MEASUREMENT_STATUS } = measurement(process.env, esc)
for (const line of MEASUREMENT_STATUS) {
  // Never fatal, never silent: a malformed token is reported here and in
  // build-status.txt, and the site deploys without the tag [D-10].
  if (line.includes('OFF —')) console.warn(`  ${line}`)
}

// ------------------------------------------------------------------ write

// index.html preloads ./db-manifest.json, which is right for the file Vite
// emits at the root and wrong for every prerendered path below it: on
// /drivers/hamilton/ a relative preload asks for
// /drivers/hamilton/db-manifest.json and warms nothing. Point it at the base
// once, here, rather than hard-coding a root path in index.html and giving up
// on subdirectory deploys.
const source = readFileSync(template, 'utf8').replace(
  'href="./db-manifest.json"',
  `href="${href('db-manifest.json')}"`,
)
if (!source.includes('<div id="prerendered"></div>')) {
  die('dist/index.html has no <div id="prerendered"></div> for this script to fill.\nIs index.html up to date?')
}

/**
 * Put one page's head and body into the built template.
 *
 * The template is whatever Vite emitted, so the script and stylesheet tags —
 * and their content hashes — come along untouched. Only the parts that differ
 * per route are replaced.
 */
const render = ({ path, canonical = path, title, description, jsonld, image = null, html }) => {
  const url = `${ORIGIN}${href(canonical)}`
  // The site card is the default HERE rather than in page(), because 404.html
  // is rendered without going through it — and a page with no og:image is the
  // defect, whichever door it came in by.
  const card = image ?? SITE_CARD
  const head = [
    `<link rel="canonical" href="${esc(url)}" />`,
    // On every page, not only /changes: `rel="alternate"` is how a reader's
    // browser and a feed reader find the subscription from wherever the reader
    // happens to have arrived, which is the whole of the return path SD-20 is
    // about. The title is what a reader shows in its subscribe prompt.
    `<link rel="alternate" type="application/atom+xml" title="${esc(FEED_TITLE)}" href="${esc(`${ORIGIN}${href(FEED_FILE)}`)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    // Every page carries one (PD-20). The width and the height are written only
    // for the card, whose size this file decides; a Commons thumbnail's is
    // negotiated server-side and the stored figures are the harvest's, so
    // declaring them here would be asserting a size nobody measured.
    `<meta property="og:image" content="${esc(card.url)}" />`,
    `<meta property="og:image:alt" content="${esc(card.alt)}" />`,
    card.width ? `<meta property="og:image:width" content="${esc(card.width)}" />` : '',
    card.height ? `<meta property="og:image:height" content="${esc(card.height)}" />` : '',
    // Justified now, and only now: `summary` is the card for a page with no
    // image, and that is what every page was until this one.
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(card.url)}" />`,
    `<meta name="twitter:image:alt" content="${esc(card.alt)}" />`,
    jsonld
      ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`
      : '',
    // Last, and on 404.html too: a reader who arrived at an address that does
    // not exist is an arrival, and the page it should have been is the thing
    // PD-0 most wants to know.
    ...MEASUREMENT,
  ]
    .filter(Boolean)
    .join('\n    ')

  return source
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${esc(description)}" />`,
    )
    .replace('</head>', `  ${head}\n  </head>`)
    .replace('<div id="prerendered"></div>', `<div id="prerendered">${html}</div>`)
}

// The card first: a page written with an og:image pointing at a file the
// build did not produce is the grey box again, one redirect further on.
writeFileSync(join(dist, CARD.file), shareCard())

let written = 0
let bytes = 0
for (const p of pages) {
  const dir = p.path === '' ? dist : join(dist, p.path)
  mkdirSync(dir, { recursive: true })
  const html = render(p)
  writeFileSync(join(dir, 'index.html'), html)
  written += 1
  bytes += Buffer.byteLength(html)
}

/**
 * The addresses that moved, still answering.
 *
 * /reference held two drawers with no reader in common; the database drawer
 * became /data and took the masthead slot. A cold arrival at an old address
 * — a bookmark, a citation, a search result not yet recrawled — gets a page
 * that says where the content went, sends the browser there at once, and
 * tells a crawler the new address is the canonical one. The query string is
 * carried across by script, because a meta refresh cannot: /reference/sql?q=
 * is the console's permalink and the whole point of keeping it is that a
 * cited query still runs.
 *
 * These are not in `pages`, so they are not in the sitemap: a sitemap lists
 * the addresses to index, and these ask not to be. Eras and the glossary did
 * not move.
 */
const MOVED = [
  ['reference', 'data'],
  ['reference/quality', 'data/quality'],
  ['reference/sources', 'data/sources'],
  ['reference/sql', 'data/sql'],
]

/**
 * And the one address that has not moved and never will.
 *
 * /now is an alias rather than a forwarding note: the one URL a returning
 * reader can type, and a link can point at, without going stale each January.
 * The target is `meta.current_season` - the season data/current.py declares
 * is being run - and NOT MAX(seasons.year), which is 2027 here and has run no
 * race; schema.sql's views anchor on the same row. web/src/App.jsx answers
 * /now the same way in-app, by reading that row itself.
 *
 * It is written with the machinery above and inherits its terms: noindex, the
 * season page named canonical, and no sitemap entry, because /seasons/2026 is
 * the address to index and this one exists to be left immediately.
 */
const CURRENT_SEASON = META.current_season
if (!CURRENT_SEASON) {
  die(
    'meta.current_season is missing from f1.db, so /now has no target.\n' +
      'It comes from CURRENT_SEASON in data/current.py:  cd .. && python3 build.py',
  )
}
const ALIASES = [['now', `seasons/${CURRENT_SEASON}`]]

// The two differ only in what the page says while it is on screen. A stub
// that tells a reader /now has "moved" would be the one false sentence on the
// site, and it is the sentence a reader sees if the redirect ever fails.
const REDIRECTS = [
  ...MOVED.map(([from, to]) => ({ from, to, title: 'Moved', lead: 'This page has moved to' })),
  ...ALIASES.map(([from, to]) => ({
    from,
    to,
    title: 'The season being run',
    lead: 'The season being run is',
  })),
]
for (const { from, to, title, lead } of REDIRECTS) {
  const target = href(to)
  const url = `${ORIGIN}${target}`
  const dir = join(dist, from)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(titled(title))}</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${esc(url)}" />
    <meta http-equiv="refresh" content="0; url=${esc(target)}" />
    <script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
  </head>
  <body>
    <p>${esc(lead)} <a href="${esc(target)}">${esc(url)}</a>.</p>
  </body>
</html>
`,
  )
}

// A 404 that is a real 404. wrangler.jsonc serves this file with a 404 status
// for any path that is not one of the above, so a mistyped URL gets an honest
// status and a page that can navigate, rather than a silent rewrite to the
// home page — which is what would hide a missing f1.db as a 200.
writeFileSync(
  join(dist, '404.html'),
  render({
    path: '404',
    title: NAMES.notFound().title,
    description: 'No page at this address.',
    jsonld: null,
    // Through structure() like every other page: it is the one route that does
    // not go through page(), and a 404 outside `.page` would be the only
    // heading on the site set in a third treatment again.
    html: chrome(
      structure(
        `<h1>${esc(NAMES.notFound().headline)}</h1>
       <p class="lede">There is no page at this address. It may have been a typo, or a link to
         something this database does not hold.</p>
       <ul class="cards">${NAV.map(([to, label]) => `<li>${link(to, label)}</li>`).join('')}</ul>`,
      ),
      '',
    ),
  }),
)

// The sitemap is what makes 2,000-odd pages discoverable without relying on a
// crawler walking every index table. Each URL carries its own `lastmod`: the
// date of the last race the page describes, or the build date where the page
// describes no single entity. See `stamp()` and `LAST_RUN` above.
// The feed is listed too. It is not a page, but it is an address a crawler
// should know about and come back to, and its `lastmod` is the one date on the
// site that moves whenever the data does - which is exactly the signal the rest
// of this sitemap exists to give.
// A page that names another as its canonical is left out: a sitemap lists
// the addresses an index should hold, and that one has said it is not one.
const sitemapUrls = [
  ...pages.filter((p) => p.canonical === p.path).map((p) => ({ loc: `${ORIGIN}${href(p.path)}`, lastmod: p.lastmod })),
  { loc: `${ORIGIN}${href(FEED_FILE)}`, lastmod: BUILT },
]

writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls
    .map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${esc(u.lastmod)}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
)

writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n\n# The data files are not pages. Crawling them helps nobody.\nDisallow: ${href('f1.db')}\nDisallow: ${href('f1.db.gz')}\nDisallow: ${href('f1-geometry.db')}\nDisallow: ${href('f1-parquet.zip')}\n\nSitemap: ${ORIGIN}${href('sitemap.xml')}\n`,
)

db.close()

// Where the measurement tags can be read without a deploy log.
//
// parquet-bundle.mjs writes public/build-status.txt earlier in the same chain
// and vite copies it here, so this adds to a file it did not create: one file,
// at /build-status.txt, saying what this deploy did. Build logs are off for
// this project, so a beacon that silently did not ship would look exactly like
// a site nobody visits [D-10] - which is the one mistake PD-0 cannot afford to
// make, since it would answer its own question wrongly.
//
// A REPLACED SPAN RATHER THAN AN APPEND. The npm chain empties dist on every
// run, so appending was correct for every path Cloudflare takes - but `npm run
// prerender` on its own, which is how this script is worked on, stacked a
// second `measurement` block on the first and the older one read as current
// (review finding, 2026-09-22). The block is always last and always starts
// with its own name, so rewriting from that name is the whole of it.
const statusPath = join(dist, 'build-status.txt')
const before = existsSync(statusPath) ? readFileSync(statusPath, 'utf8') : 'lapledger build\n'
writeFileSync(
  statusPath,
  `${before.replace(/\n*measurement\n[\s\S]*$/, '\n')}\nmeasurement\n${MEASUREMENT_STATUS.join('\n')}\n`,
)

console.log(`  prerendered ${written.toLocaleString()} pages (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
console.log(
  `  dist/sitemap.xml, dist/feed.xml, dist/robots.txt, dist/404.html, ${REDIRECTS.length} redirecting pages`,
)
console.log(`  origin ${ORIGIN}${BASE}`)
for (const line of MEASUREMENT_STATUS) console.log(`  ${line}`)
