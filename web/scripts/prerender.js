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
 * dist/feed.xml and dist/robots.txt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// The one rule for the "Out"/"Status" column, shared with the app rather
// than restated here: a copy of it would drift, which is how the twelve
// hardcoded `circuit_geometry` columns went wrong. `formatted` is the
// app's own cell text — text() in lib/format.js — for the tables below
// that are drawn from a page's column list.
import { finished, missing, result, span, text as formatted, yearList } from '../src/lib/format.js'
// The ONE attribution rule (web/src/lib/commons.js), not a second copy of it.
// This script cannot import CommonsImage - that is a React component and this
// file emits HTML - but the question it answers, "who is credited and may this
// be shown at all", has exactly one answer on this site, and it is imported
// here for the same reason the cars gallery had to stop writing its own.
import { attribution, canShow, fileTitle, photoAlt, thumbUrl } from '../src/lib/commons.js'
import {
  COUNTED_TOTALS,
  CROSS_CHECKED,
  DOCUMENTS,
  DOCUMENTS_NOTE,
  ENTRIES_NOTE,
  citation,
  LANDMARK,
  NOT_HELD,
  NOT_YET_RUN,
  PHOTOGRAPHS_NOTE,
  PHOTOGRAPHS_SHOWN,
  PHOTOGRAPH_WIDTH,
  REPORT_ASK,
  REPORT_LINK,
  REPORT_PROMISE,
  REPORT_URL,
  REPOSITORY,
  SELF_DESCRIBING,
  SETTLE_ASK,
  SETTLE_LINK,
  SHARED,
  SITE,
  SO_FAR,
  SPRINT,
  TWO_FILES,
  UNCHECKED_MARK,
  UNCHECKED_NOTE,
  titled,
} from '../src/lib/site.js'
import { EXPLAINED_FOOTER, OPEN_FOOTER, allExplained } from '../src/lib/disagreement.js'
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
import { LATEST as CHANGES_LATEST, SHAPE as CHANGES_SHAPE } from '../src/queries/changes.js'
import { markStyleAttr, winnerColour } from '../src/lib/liveries.js'
import { RACE_SESSIONS, SESSION_COLUMNS, TIMETABLE_NOTE } from '../src/queries/sessions.js'
// The pages' own queries and column lists (PD-02). A page and this script
// read the same module, so the static table is the app's table by
// construction; the rest of the pages follow these.
import { DRIVERS, DRIVER_COLUMNS } from '../src/queries/drivers.js'
import { SEASONS, SEASONS_COLUMNS, SEASON_LIST_FOOTER } from '../src/queries/seasons.js'
import {
  CALENDAR,
  CALENDAR_COLUMNS,
  CALENDAR_FOOTER,
  CONSTRUCTORS_FINAL_COLUMNS,
  DRIVERS_FINAL_COLUMNS,
  DRIVERS_FINAL_FOOTER,
  ENTRANTS,
  ENTRANT_COLUMNS,
  ENTRANTS_FOOTER,
  FINAL,
  GRID,
  NO_CONSTRUCTORS_TITLE,
  REMAINING,
  SEASON,
  STANDINGS as SEASON_STANDINGS,
  constructorsFooter,
  latestRound,
  standingsHeading,
  stillRunning,
  titlePermutations,
} from '../src/queries/season.js'
import { RACES, RACE_COLUMNS, RACES_FOOTER } from '../src/queries/races.js'
import { CONSTRUCTOR_IMAGES, RACE_IMAGES, SEASON_IMAGES } from '../src/queries/photographs.js'
import { CONSTRUCTORS, CONSTRUCTOR_COLUMNS, CONSTRUCTORS_FOOTER } from '../src/queries/constructors.js'
import { CIRCUITS, CIRCUIT_COLUMNS, CIRCUITS_FOOTER, TRACED } from '../src/queries/circuits.js'
import { CHASSIS, CHASSIS_COLUMNS, CHASSIS_FOOTER, GALLERY, GALLERY_COLUMNS } from '../src/queries/cars.js'
import {
  CLASSIFICATION_COLUMNS,
  CLASSIFICATION_FOOTER,
  ENTRIES,
  FASTEST_LAP,
  PITS,
  PITS_FOOTER,
  PIT_COLUMNS,
  QUALIFYING,
  QUALIFYING_FOOTER,
  SHARED_DRIVE_NOTE,
  SPRINT as SPRINT_RESULTS,
  SPRINT_COLUMNS,
  SPRINT_FOOTER,
  carName,
  inClassificationOrder,
  qualifyingColumns,
  raceLede,
  raceNote,
  raceSentence,
  railOf,
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
} from '../src/queries/constructor.js'
import {
  CIRCUIT as CIRCUIT_ROW,
  RACES as CIRCUIT_RACES,
  RACE_COLUMNS as CIRCUIT_RACE_COLUMNS,
  TEAMS as TEAMS_HERE,
  TEAM_COLUMNS,
  OUTLINES as CIRCUIT_OUTLINES,
  WINNERS as WINNERS_HERE,
  WINNER_COLUMNS,
} from '../src/queries/circuit.js'
import {
  AMBIGUOUS_COLUMNS as CAR_AMBIGUOUS_COLUMNS,
  AMBIGUOUS_FOOTER as CAR_AMBIGUOUS_FOOTER,
  ENTRIES as CAR_ENTRIES,
  IMAGES as CAR_IMAGES,
  NO_ENTRIES,
  SEASONS as CAR_SEASONS,
  VARIANTS,
  VARIANTS_FOOTER,
  VARIANT_COLUMNS,
  entryColumns,
  entryResult,
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
  OUTLINE_RULE,
  OUTLINE_SCALE_NOTE,
  OUTLINE_VIEWBOX,
  OUTLINES_NOTE,
  STATE_WORDS,
  outlineCaption,
  outlineLabel,
  roundShortName,
  roundStates,
  stripLabel,
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
  SEASON_COLUMNS,
  SEASONS_FOOTER,
  STANDINGS,
  careerSentence,
  leading,
  lede,
  pointsDiffer,
  pointsNote,
  record,
  seasonRows,
  strip,
} from '../src/queries/driver.js'
import { RECORDS, TIER_AFTER, holderPath, recordColumns, tierBefore, tiersOf, RECORDS_LEDE } from '../src/queries/records.js'

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
const all = (sql, ...params) => db.prepare(sql).all(...params)
const one = (sql, ...params) => db.prepare(sql).get(...params) ?? null

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

// `aligns` is a class per column — 'num', 'prose' or nothing — the same
// classes DataTable puts on its cells, so a column of figures lines up.
//
// The two wrappers are DataTable's own (VD-01): `.table-wrap` draws the box
// and `.table-scroll` is what actually scrolls, and the static page used to
// spell a single `.tablewrap` doing both. One class means one set of rules —
// including the fade at the right edge, which is drawn on `.table-wrap` and
// so never reached the static page at all.
const table = (headers, rows, options = {}) => {
  if (!rows.length) return ''
  const { aligns = [] } = options
  const cls = (i) => (aligns[i] ? ` class="${esc(aligns[i])}"` : '')
  return [
    '<div class="table-wrap"><div class="table-scroll"><table>',
    `<thead><tr>${headers.map((h, i) => `<th scope="col"${cls(i)}>${typeof h === 'string' ? esc(h) : h.html}</th>`).join('')}</tr></thead>`,
    '<tbody>',
    rows.map((cells) => `<tr>${cells.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>`).join(''),
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
const fromColumns = (columns, rows, links = {}) =>
  table(
    // A column marked srOnly names itself to a screen reader only, as the
    // app's does: the classification's rail has a header and no visible word.
    columns.map((c) => (c.srOnly ? { html: `<span class="sr-only">${esc(c.label)}</span>` } : c.label)),
    rows.map((row) =>
      columns.map((c) => {
        const value = row[c.key]
        // Own properties only: a column keyed `constructor` would otherwise
        // find Object.prototype.constructor and print "[object Object]".
        if (Object.hasOwn(links, c.key)) return links[c.key](value, row)
        return esc(c.text ? c.text(value, row) : formatted(value))
      }),
    ),
    { aligns: columns.map((c) => c.align ?? '') },
  )

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
const fields = (pairs) => {
  const kept = pairs.filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (!kept.length) return ''
  return `<dl class="fields">${kept
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
const EMPTY_STATE = '<p class="state is-empty">Nothing recorded.</p>'

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

// The circuit outlines (AF-03), as components/Outline.jsx draws them: F1DB's
// path in its 500-unit box, the current ink, a constant stroke. The path is
// SVG path data and nothing else - build.py and verify.py both refuse any
// other character - and is escaped here all the same.
const outlineSvg = (path, label) =>
  path
    ? `<svg class="outline" viewBox="${OUTLINE_VIEWBOX}"${
        label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'
      }><path d="${esc(path)}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`
    : ''
const outlineCard = (path, circuit, layoutId, caption, rule = false) =>
  path
    ? `<figure class="outline-card">${outlineSvg(path, outlineLabel(circuit, layoutId))}<figcaption>${esc(caption)}<br><span class="faint">${esc(OUTLINE_BY)}</span>${
        rule ? `<br><span class="faint">${esc(OUTLINE_RULE)}</span>` : ''
      }</figcaption></figure>`
    : ''
// The winner's colour bar under a run round, as components/Outline.jsx draws
// it: the same properties on the same element, so the static strip and the
// app's agree (AF-04). One value, both themes, since AF-16 stopped moving a
// livery hex with the theme; app.css derives the mark's edge from it.
//
// The properties come from markStyleAttr, not from a `--livery:` written out
// here: AF-17 added a second one, and a spelled-out attribute would have
// given the app the scheme and the static page the primary.
const winnerMark = (round, year) => {
  const colour = winnerColour(round, year)
  return colour
    ? `<i class="livery" style="${esc(markStyleAttr(colour))}" title="${esc(colour.title)}" aria-hidden="true"></i>`
    : ''
}
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

const chrome = (body, crumbs, citeUrl) => `
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
        ? `<aside class="cite" aria-label="How to cite this page"><p>${citation(META.version, META.built, citeUrl)
            .split(citeUrl)
            .map(esc)
            .join(`<span class="url">${esc(citeUrl)}</span>`)}</p></aside>`
        : ''
    }
  </main>
  <footer class="sitefoot"><div class="sitefoot-inner"><div>
    <p>Every page here is a query against one SQLite file, running in your browser. ${esc(COUNTED_TOTALS)} ${link('data/quality', 'How far to trust it')} · ${link('data/sources', 'sources')} · ${link('data/sql', 'write your own query')} · ${link('changes', 'what changed')}.</p>
    <p>${esc(REPORT_ASK)} <a href="${esc(REPORT_URL)}">${esc(REPORT_LINK)}</a>. ${esc(REPORT_PROMISE)}</p>
    <p class="faint">Race data from <a href="https://github.com/f1db/f1db">F1DB</a> (CC BY 4.0), prose and registers from Wikipedia (CC BY-SA 4.0), circuit geometry © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL 1.0). ${esc(OUTLINE_CREDIT)}. Unaffiliated with Formula One, the FIA or any team.</p>
  </div><dl><dt>Database</dt><dd>v${esc(META.version)}</dd><dt>Built</dt><dd>${esc(META.built)}</dd></dl></div></footer>
</div>`

const crumbs = (trail) =>
  trail
    .map(([path, label], i) =>
      i === trail.length - 1 ? `<span aria-current="page">${esc(label)}</span>` : link(path, label),
    )
    .join('<span class="sep">/</span>')

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
const photograph = (image, width, caption = null) => {
  const title = fileTitle(image.file_name)
  const licence = (image.licence ?? '').trim()
  const size = image.width && image.height ? ` width="${esc(image.width)}" height="${esc(image.height)}"` : ''
  return `<figure class="photo">
        <img src="${esc(thumbUrl(image.file_name, width))}" alt="${esc(photoAlt(image, caption))}"${size} loading="lazy" decoding="async" />
        <figcaption>${caption ? `<div class="photo-subject">${esc(caption)}</div>` : ''}${outbound(image.description_url, title)} · ${esc(attribution(image))} · ${
          image.licence_url ? outbound(image.licence_url, licence) : esc(licence)
        }${image.name_matches === 0 ? ` · <span class="pill pill-unverified">${esc(UNCHECKED_MARK)}</span>` : ''}</figcaption>
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
 * of, above its credit. A car page needs none: the page is that car.
 */
const photographSection = (rows, { subjects = false, width = PHOTOGRAPH_WIDTH } = {}) => {
  const images = rows.filter(canShow)
  if (!images.length) return ''
  const drawn = images.slice(0, PHOTOGRAPHS_SHOWN)
  return `<h2>Photographs</h2>
      <p class="note">${esc(PHOTOGRAPHS_NOTE)}</p>
      <div class="photo-grid">${drawn
        .map((image) => photograph(image, width, subjects ? image.article : null))
        .join('')}</div>${
        // Over the six DRAWN, which is what Photographs.jsx tests: a
        // constructor draws six of fifty-one, and a caveat explaining a mark
        // that is nowhere on the page explains nothing. A caveat that appears
        // in one renderer and not the other is worse than either, so both
        // renderers slice first and ask afterwards.
        drawn.some((image) => image.name_matches === 0)
          ? `\n      <p class="source-note">${esc(UNCHECKED_NOTE[0])} <span class="pill pill-unverified">${esc(
              UNCHECKED_MARK,
            )}</span> ${esc(UNCHECKED_NOTE[1])}</p>`
          : ''
      }`
}

const photographs = (id) => {
  const images = all(CAR_IMAGES, id, id).filter(canShow)
  if (!images.length) return { html: '', image: null }
  const confirmed = images.slice(0, PHOTOGRAPHS_SHOWN).find((image) => image.name_matches === 1) ?? null
  return {
    html: photographSection(images),
    image: confirmed
      ? { url: thumbUrl(confirmed.file_name, CARD_WIDTH), alt: creditLine(confirmed) }
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
  const named = body.replace(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>|<table>/g, (match, text) => {
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
const SECTIONING = /<(\/?)(section|h2)\b/g

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

const structure = (body) => {
  const opening = body.match(/^\s*(<h1\b[\s\S]*?<\/h1>)(\s*<p class="lede">[\s\S]*?<\/p>)?/)
  if (!opening) die('prerender: a page body that does not open on an h1')
  return `<article class="page"><header>${opening[1]}${opening[2] ?? ''}</header>${sectioned(
    body.slice(opening[0].length),
  )}</article>`
}

const page = ({ path, title, description, body, jsonld = null, trail = null, image = null, lastmod = null }) => {
  // The citation names the page by the address the canonical carries.
  pages.push({
    path,
    title,
    description,
    jsonld,
    image,
    lastmod: stamp(lastmod),
    html: chrome(nameTables(structure(body)), trail ? crumbs(trail) : '', `${ORIGIN}${href(path)}`),
  })
}



// ------------------------------------------------------------------- home

{
  const counts = Object.fromEntries(
    ['drivers', 'constructors', 'circuits', 'races', 'race_entries', 'qualifying', 'chassis'].map(
      (t) => [t, one(`SELECT COUNT(*) AS n FROM ${t}`).n],
    ),
  )
  const champions = all(
    `SELECT year, drivers_champion, champion_team, champion_points
       FROM seasons WHERE drivers_champion IS NOT NULL ORDER BY year DESC LIMIT 10`,
  )
  const names = Object.fromEntries(all('SELECT id, full_name FROM drivers').map((d) => [d.id, d.full_name]))
  const teams = Object.fromEntries(all('SELECT id, name FROM constructors').map((c) => [c.id, c.name]))

  page({
    path: '',
    title: `${SITE} — a Formula One database you can check`,
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
    body: `
      <h1>Formula One, ${SPAN}, with its sources attached</h1>
      <p class="lede">Seventy-seven seasons as one SQLite file, queried in this tab. Every figure
        is traceable to the source it came from, and a blank means nobody has established that
        fact — never zero.</p>
      ${fields([
        ['Races', `${counts.races.toLocaleString()} championship Grands Prix`],
        ['Classifications', `${counts.race_entries.toLocaleString()} race entries`],
        ['Qualifying', `${counts.qualifying.toLocaleString()} rows`],
        ['Drivers', counts.drivers.toLocaleString()],
        ['Constructors', counts.constructors.toLocaleString()],
        ['Chassis', counts.chassis.toLocaleString()],
        ['Circuits', counts.circuits.toLocaleString()],
      ])}
      <h2>The last ten champions</h2>
      ${table(
        ['Season', 'Champion', 'Team', 'Points'],
        champions.map((s) => [
          link(`seasons/${s.year}`, s.year),
          link(`drivers/${s.drivers_champion}`, names[s.drivers_champion] ?? s.drivers_champion),
          s.champion_team ? link(`constructors/${s.champion_team}`, teams[s.champion_team] ?? s.champion_team) : '—',
          num(s.champion_points),
        ]),
      )}
      <h2>Browse</h2>
      <ul class="cards">${NAV.map(([to, label]) => `<li>${link(to, label)}</li>`).join('')}</ul>`,
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
    title: titled(`Every season, ${SPAN}`),
    description: `All ${seasons.length} FIA Formula One World Championship seasons, with the drivers' and constructors' champions, points and margin for each.`,
    trail: [['', 'Home'], ['seasons', 'Seasons']],
    body: `
      <h1>Seasons</h1>
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
    const calendar = all(CALENDAR, year)
    const final = all(FINAL, year)
    const driversFinal = final.filter((r) => r.table_type === 'drivers')
    const constructorsFinal = final.filter((r) => r.table_type === 'constructors')
    const entrants = all(ENTRANTS, year)
    const grid = one(GRID, year)
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

    page({
      path: `seasons/${year}`,
      lastmod: LAST_RUN.season.get(String(year)),
      title: titled(`${year} Formula One World Championship`),
      description: s.champion
        ? `${s.champion} won the ${year} Formula One World Championship for ${s.champion_team_name ?? '—'} with ${s.champion_points ?? '—'} points over ${s.rounds ?? '?'} rounds. Every race, winner, pole and fastest lap.`
        : running
          ? `${lead.entity} leads the ${year} Formula One World Championship by ${num(gap)} points after ${after ?? run} of ${s.rounds ?? '?'} rounds. Every race, winner, pole and fastest lap.`
          : notRun
            ? `The ${year} Formula One World Championship: a calendar of ${s.rounds ?? '?'} announced rounds, ${NOT_YET_RUN}. Every venue, weekend and Sprint round.`
            : `The ${year} Formula One World Championship: ${s.rounds ?? '?'} rounds, with every race, winner, pole and fastest lap.`,
      trail: [['', 'Home'], ['seasons', 'Seasons'], [`seasons/${year}`, String(year)]],
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'SportsSeason',
        name: `${year} FIA Formula One World Championship`,
        startDate: String(year),
        url: `${ORIGIN}${href(`seasons/${year}`)}`,
      },
      body: `
        <h1>${year} FIA Formula One World Championship</h1>
        ${
          notRun
            ? fields([
                ['Rounds', num(s.rounds)],
                ["Drivers' champion", NOT_YET_RUN],
                ["Constructors' champion", NOT_YET_RUN],
                ['Engine formula', text(s.engine_formula)],
                ['Tyres', text(s.tyre_suppliers)],
                ['Entered', entered],
              ])
            : running
            ? fields([
                ['After', `${run} of ${num(s.rounds)} rounds`],
                ['Leads', `${lead.entity_id ? driver(lead.entity_id) : text(lead.entity)} — ${num(lead.points)}`],
                ['Second', `${second.entity_id ? driver(second.entity_id) : text(second.entity)} — ${num(second.points)}`],
                ['Gap', num(gap)],
                [
                  "Constructors' leader",
                  teamLead ? `${teamLead.entity_id ? team(teamLead.entity_id) : text(teamLead.entity)} — ${num(teamLead.points)}` : '—',
                ],
                ['Engine formula', text(s.engine_formula)],
                ['Tyres', text(s.tyre_suppliers)],
                ['Entered', entered],
              ])
            : fields([
                ["Drivers' champion", driver(s.drivers_champion)],
                ['Team', team(s.champion_team)],
                ['Points', num(s.champion_points)],
                ['Runner-up', `${driver(s.runner_up)} — ${num(s.runner_up_points)}`],
                ['Margin', num(s.margin)],
                ["Constructors' champion", s.constructors_champion ? team(s.constructors_champion) : year < 1958 ? 'not contested' : '—'],
                ['Rounds', num(s.rounds)],
                ['Engine formula', text(s.engine_formula)],
                ['Tyres', text(s.tyre_suppliers)],
                ['Entered', entered],
              ])
        }
        ${permutations ? note(permutations) : ''}
        ${prose(s.notes)}
        ${photographSection(all(SEASON_IMAGES, year), { subjects: true })}
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
          winning_team: (name, row) => (row.winning_team_id ? link(`constructors/${row.winning_team_id}`, name) : text(name)),
        })}
        ${note(CALENDAR_FOOTER)}
        <h2>${esc(standingsHeading("Drivers'", live, after))}</h2>
        ${
          driversFinal.length
            ? fromColumns(DRIVERS_FINAL_COLUMNS, driversFinal, {
                entity: (name, row) => (row.entity_id ? link(`drivers/${row.entity_id}`, name) : text(name)),
              }) + note(DRIVERS_FINAL_FOOTER)
            : EMPTY_STATE
        }
        <h2>${esc(standingsHeading("Constructors'", live, after))}</h2>
        ${
          constructorsFinal.length
            ? fromColumns(CONSTRUCTORS_FINAL_COLUMNS, constructorsFinal, {
                entity: (name, row) =>
                  `${row.entity_id ? link(`constructors/${row.entity_id}`, name) : text(name)}${row.engine_id ? ` ${tag(row.engine_id)}` : ''}`,
              }) + note(constructorsFooter(constructorsFinal.some((r) => r.engine_id)))
            : noteBox("No constructors' championship.", NO_CONSTRUCTORS_TITLE)
        }
        ${
          entrants.length
            ? `<h2>Who entered</h2>${fromColumns(ENTRANT_COLUMNS, entrants, {
                constructor: (name, row) =>
                  row.constructor_id ? link(`constructors/${row.constructor_id}`, name ?? row.constructor_id) : text(name ?? row.entrant_id),
              })}${note(ENTRANTS_FOOTER)}`
            : ''
        }`,
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
    `SELECT r.id, r.year, r.round, r.name_used, r.dates, r.date_iso, r.status, r.sprint, r.note,
            r.circuit_id, c.name AS circuit, c.locality, c.country, c.length_km, c.turns,
            rr.winner_id, rr.winner, rr.constructor_id, rr.constructor, rr.entrant,
            rr.pole, rr.pole_id, rr.fastest_lap, rr.fastest_lap_id, rr.confidence, rr.source,
            r.f1db_layout_id, o.path AS outline, o.length_km AS outline_km, o.turns AS outline_turns,
            (SELECT q.driver_id FROM qualifying q
              WHERE q.race_id = r.id AND q.position = 1) AS quickest_id,
            (SELECT e.driver_id FROM race_entries e
              WHERE e.race_id = r.id AND e.grid = 1) AS front_id
       FROM races r
       LEFT JOIN circuits c ON c.id = r.circuit_id
       LEFT JOIN race_results rr ON rr.year = r.year AND rr.round = r.round
       LEFT JOIN circuit_outlines o ON o.f1db_layout_id = r.f1db_layout_id
      ORDER BY r.year DESC, r.round DESC`,
  )

  page({
    path: 'races',
    title: titled(`Every championship race, ${SPAN}`),
    description: `All ${races.length.toLocaleString()} FIA Formula One championship Grands Prix with winner, pole, fastest lap and full classification.`,
    trail: [['', 'Home'], ['races', 'Races']],
    body: `
      <h1>Races</h1>
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
      WHERE d.subject = ? AND d.status LIKE 'open%'
      ORDER BY d.id`,
  )

  // The four tables read web/src/queries/race.js, the app's own queries and
  // column lists (PD-02, rung four), and the classification is put in the
  // order the app prints it by the same function.
  const rail = (_, row) => `<i class="${esc(railOf(row))}"></i>`
  const driverCell = (name, row) => (row.driver_id ? link(`drivers/${row.driver_id}`, name ?? row.driver_id) : text(name))
  const constructorCell = (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(name))
  const outCell = (value, row) => (finished(value, row.finish_position) ? 'Finished' : missing(value) ? '—' : tag(value))

  for (const r of races) {
    const entries = inClassificationOrder(all(ENTRIES, r.year, r.round))
    const qualifying = all(QUALIFYING, r.year, r.round)
    const sprintResults = inClassificationOrder(all(SPRINT_RESULTS, r.year, r.round))
    const pits = all(PITS, r.year, r.round)
    const scheduled = r.status === 'scheduled'
    const sessions = all(RACE_SESSIONS, r.year, r.round)
    const headline = `${r.year} ${r.name_used}`
    // CD-03: the standfirst the page opens on and the description a search
    // result shows are one expression, queries/race.js's, so they cannot come
    // to describe different races - which is what the old description, read
    // off race_results and written only into a meta tag, was free to do. The
    // winners come from the classification this page prints rather than from
    // the view over it, so the sentence and the table below agree by
    // construction on a shared drive.
    const raceWinners = entries.filter((e) => e.finish_position === 1)
    const standfirst = raceLede(r, raceWinners)
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
    const description = `${headline}. ${raceSentence(r, raceWinners)}${written ? ` ${written}` : ''}${
      scheduled ? '' : ' Full classification, grid, pole and fastest lap.'
    }`

    page({
      path: `races/${r.year}/${r.round}`,
      lastmod: r.date_iso,
      title: titled(headline),
      description: summarise(description, 300),
      trail: [
        ['', 'Home'],
        ['seasons', 'Seasons'],
        [`seasons/${r.year}`, String(r.year)],
        [`races/${r.year}/${r.round}`, r.name_used],
      ],
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
        // startDate comes from date_iso, not from the display value. The
        // two columns exist precisely so this can be emitted for every
        // race: `dates` may be a weekend range no parser can read, and the
        // races that carry one are the SCHEDULED ones - exactly where a
        // search engine most wants a date. Still guarded on the shape,
        // because invalid structured data is worse than none.
        ...(ISO_DAY.test(r.date_iso ?? '') ? { startDate: r.date_iso } : {}),
      },
      body: `
        <h1>${esc(headline)}</h1>
        <p class="lede">${esc(standfirst)}</p>
        ${fields([
          ['Round', `${r.round} of ${r.year}`],
          ['Circuit', r.circuit_id ? link(`circuits/${r.circuit_id}`, r.circuit ?? r.circuit_id) : '—'],
          ['Location', text(list([r.locality, r.country]))],
          ['Dates', text(r.dates)],
          ['Format', r.sprint ? 'Sprint weekend' : 'Standard weekend'],
          ...(scheduled
            ? [['Status', 'Scheduled — not yet run']]
            : [
                ['Winner', driver(r.winner_id, r.winner)],
                // The entrant's name where no constructor row exists, the
                // rule queries/race.js applies everywhere a car is named; the
                // eleven championship Indianapolis 500s are the entries that
                // have one and it is the only name they have (AF-64). The
                // Entrant row below repeats it there, as it already repeats
                // the constructor wherever the two designations agree.
                ['Constructor', team(r.constructor_id, carName(r))],
                ['Entrant', text(r.entrant)],
                // "Pole position" is the driver the season record credits,
                // which is what race_results holds. Where the car at grid 1
                // or the fastest qualifier was someone else, saying so is the
                // difference between a page that looks wrong and a page that
                // explains itself. The database records that they differ,
                // not why, so no cause is stated (Race.jsx says the same).
                ['Pole position', r.pole_id ? driver(r.pole_id, r.pole) : text(r.pole)],
                ...(r.front_id && r.pole_id && r.front_id !== r.pole_id
                  ? [[
                      'Started first',
                      `${driver(r.front_id)} <span class="faint">— the pole-sitter started ${text(
                        one(
                          'SELECT grid_text FROM race_entries WHERE race_id = ? AND driver_id = ?',
                          r.id,
                          r.pole_id,
                        )?.grid_text,
                      )}</span>`,
                    ]]
                  : []),
                ...(r.quickest_id && r.pole_id && r.quickest_id !== r.pole_id
                  ? [[
                      'Fastest qualifier',
                      `${driver(r.quickest_id)} <span class="faint">— started ${text(
                        one(
                          'SELECT grid_text FROM race_entries WHERE race_id = ? AND driver_id = ?',
                          r.id,
                          r.quickest_id,
                        )?.grid_text,
                      )}${r.sprint ? ', the grid set by the sprint' : ''}</span>`,
                    ]]
                  : []),
                // Every setter, not race_results' one: eight races share the
                // fastest lap between two or more drivers, and the app lists
                // them all, so the static page has to as well.
                [
                  'Fastest lap',
                  (() => {
                    const setters = all(
                      'SELECT driver_id FROM race_entries WHERE race_id = ? AND fastest_lap = 1 ORDER BY id',
                      r.id,
                    )
                    return setters.length
                      ? setters.map((e) => driver(e.driver_id)).join(' / ')
                      : text(r.fastest_lap)
                  })(),
                ],
                ['Confidence', r.confidence ? link('data/quality', r.confidence) : text(r.confidence)],
              ]),
        ])}
        ${outlineCard(
          r.outline,
          r.circuit,
          r.f1db_layout_id,
          outlineCaption({ f1db_layout_id: r.f1db_layout_id, length_km: r.outline_km, turns: r.outline_turns }),
          true,
        )}
        ${photographSection(all(RACE_IMAGES, r.year, r.round), { subjects: true })}
        ${
          sessions.length
            ? `<h2>Timetable</h2>${fromColumns(SESSION_COLUMNS, sessions)}<p class="source-note">${esc(TIMETABLE_NOTE)}</p>`
            : ''
        }
        ${disagree(disagreements.all(`${r.year} round ${r.round}`), 'this race')}
        ${
          entries.some((e) => e.shared_drive === 1)
            ? noteBox(SHARED_DRIVE_NOTE.head, SHARED_DRIVE_NOTE.body)
            : ''
        }
        ${
          entries.length
            ? `<h2>Classification</h2>${fromColumns(CLASSIFICATION_COLUMNS, entries, {
                rail,
                position_text: (_, row) =>
                  missing(row.finish_position) ? `<span class="tag tag-dnf">${esc(result(row))}</span>` : `<b>${esc(result(row))}</b>`,
                driver: (name, row) => `${driverCell(name, row)}${row.shared_drive === 1 ? ` ${tag(SHARED)}` : ''}`,
                constructor: (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name) : text(row.entrant ?? name)),
                chassis: (name, row) => (row.chassis_id ? link(`cars/${row.chassis_id}`, name ?? row.chassis_id) : text(name)),
                status: outCell,
                fastest_lap: (value) =>
                  value === 1 ? `<span class="fl" aria-hidden="true">●</span><span class="sr-only">${esc(FASTEST_LAP)}</span>` : '',
              })}${note(CLASSIFICATION_FOOTER)}`
            : scheduled
              ? noteBox('This race has not been run.', 'The classification will appear here once it has.')
              : ''
        }
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
          pits.length
            ? `<h2>Pit stops</h2>${fromColumns(PIT_COLUMNS, pits, {
                driver: (name, row) => (row.driver_id ? link(`drivers/${row.driver_id}`, name ?? row.driver_id) : text(name ?? row.driver_key)),
              })}${note(PITS_FOOTER)}`
            : ''
        }`,
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
    `SELECT d.field, d.status, d.assessment,
            COALESCE(s.full_name, d.stored_value)  AS stored_value,
            COALESCE(v.full_name, d.derived_value) AS derived_value
       FROM discrepancies d
       LEFT JOIN drivers s ON s.id = d.stored_value
       LEFT JOIN drivers v ON v.id = d.derived_value
      WHERE d.subject = ? AND (d.status LIKE 'open%' OR d.status LIKE 'explained - each side%')
      ORDER BY d.id`,
  )
  const teams = Object.fromEntries(all('SELECT id, name FROM constructors').map((c) => [c.id, c.name]))

  page({
    path: 'drivers',
    title: titled(`Every driver, ${SPAN}`),
    description: `All ${register.length} drivers in the register, with entries, wins, podiums, poles and fastest laps counted from the race records, and titles from the championship tables.`,
    trail: [['', 'Home'], ['drivers', 'Drivers']],
    body: `
      <h1>Drivers</h1>
      <p class="lede">${register.length} drivers. Career totals are counted from the race records
        wherever the records support it; an em dash means nobody has established that figure.</p>
      ${fromColumns(DRIVER_COLUMNS, register, {
        full_name: (name, d) => link(`drivers/${d.id}`, name),
      })}`,
  })

  const winsOf = db.prepare(
    `SELECT rr.year, rr.round, rr.gp_name, rr.constructor_id, rr.constructor
       FROM race_results rr WHERE rr.winner_id = ? ORDER BY rr.year, rr.round`,
  )
  const constructorsOf = db.prepare(DRIVER_CONSTRUCTORS)

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
    const seasons = seasonRows(all(BY_SEASON, id), all(STANDINGS, id))
    const wins = winsOf.all(id)
    const constructors = constructorsOf.all(id).map((c) => c.name)
    const career = careerSentence(derived, constructors, d.titles)
    // The lede follows the derived sentence where there is room for a whole
    // sentence of it; a note that is one long sentence would otherwise be
    // cut mid-thought with an ellipsis, and the career alone is complete.
    const lead = `${d.full_name}${d.nationality ? `, ${d.nationality}` : ''}. ${career}`
    const withNotes = summarise(`${lead} ${d.notes ?? ''}`, 300)

    page({
      path: `drivers/${d.id}`,
      lastmod: LAST_RUN.driver.get(d.id),
      title: titled(d.full_name),
      description: withNotes.endsWith('…') ? lead : withNotes,
      trail: [['', 'Home'], ['drivers', 'Drivers'], [`drivers/${d.id}`, d.full_name]],
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
        <h1>${esc(d.full_name)}</h1>
        <p class="lede">${esc(lede(d, derived, constructors))}</p>
        ${stats(
          leading(strip(d, derived)).map((item) => ({ ...item, value: esc(item.value) })),
        )}
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

// ----------------------------------------------------------- constructors

{
  const constructors = all(
    `SELECT * FROM constructors ORDER BY constructors_titles DESC, wins DESC, name`,
  )

  page({
    path: 'constructors',
    title: titled(`Every constructor, ${SPAN}`),
    description: `All ${constructors.length} constructors that have entered a championship Grand Prix, with entries, wins, poles and titles.`,
    trail: [['', 'Home'], ['constructors', 'Constructors']],
    body: `
      <h1>Constructors</h1>
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
    `SELECT d.field, d.status, d.assessment,
            COALESCE(s.full_name, d.stored_value)  AS stored_value,
            COALESCE(v.full_name, d.derived_value) AS derived_value
       FROM discrepancies d
       LEFT JOIN drivers s ON s.id = d.stored_value
       LEFT JOIN drivers v ON v.id = d.derived_value
      WHERE d.subject = ? AND d.status LIKE 'open%'
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
    const seasons = constructorSeasons(all(TEAM_BY_SEASON, c.id), teamStandings)
    const engineSplit = teamStandings.some((s) => s.engine_id)
    const wins = all(TEAM_WINS, c.id)
    const designs = all(DESIGNS, c.id)
    page({
      path: `constructors/${c.id}`,
      lastmod: LAST_RUN.constructor.get(c.id),
      title: titled(c.name),
      description: summarise(
        `${c.full_name ?? c.name}${c.country ? `, ${c.country}` : ''}, Formula One ${c.first_entry ?? '?'}–${c.last_entry ?? 'present'}. ${
          c.wins !== null ? `${c.wins} wins` : ''
        }${c.constructors_titles ? `, ${c.constructors_titles} constructors' titles` : ''}. ${c.notes ?? ''}`,
        300,
      ),
      trail: [['', 'Home'], ['constructors', 'Constructors'], [`constructors/${c.id}`, c.name]],
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'SportsOrganization',
        name: c.full_name ?? c.name,
        sport: 'Formula One',
        url: `${ORIGIN}${href(`constructors/${c.id}`)}`,
        ...(c.country ? { location: { '@type': 'Place', name: c.country } } : {}),
      },
      body: `
        <h1>${esc(c.name)}</h1>
        ${fields([
          ['Full name', text(c.full_name)],
          ['Country', text(c.country)],
          ['Base', text(c.base)],
          ['Entered', `${c.first_entry ?? '?'}–${c.last_entry ?? 'present'}`],
          // `formatted`, not `num`: the app's own lib/format.js `text`,
          // which routes a number through `number()` and separates
          // thousands. `num` would print 2496 against the app's 2,496 and
          // the /constructors table's, which is the divergence this row was
          // changed to close. A zero stays 0 - rob-walker has no race entry
          // and both halves say so.
          ['Race entries', esc(formatted(teamDerived.entries))],
          ['Wins', num(c.wins)],
          ['Poles', num(c.poles)],
          ["Constructors' titles", c.constructors_titles ? `${c.constructors_titles} (${yearList(c.title_years)})` : num(c.constructors_titles)],
          ["Drivers' titles", num(c.drivers_titles)],
          // No "Active" row: the app has no such field, and "Entered" above
          // already says it - an open span ends in "present" (CD-30).
          ['Confidence', c.confidence ? link('data/quality', c.confidence) : text(c.confidence)],
        ])}
        ${prose(c.notes)}
        ${photographSection(all(CONSTRUCTOR_IMAGES, c.id), { subjects: true })}
        ${disagree(teamDisagreements.all(c.name), 'this team')}
        <h2>Season by season</h2>
        ${
          seasons.length
            ? `${fromColumns(TEAM_SEASON_COLUMNS, seasons, {
                year: (year) => link(`seasons/${year}`, year),
              })}${engineSplit ? note(ENGINE_SPLIT_FOOTER) : ''}`
            : EMPTY_STATE
        }
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
        }`,
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

  page({
    path: 'circuits',
    title: titled(`Every circuit, ${SPAN}`),
    description: `All ${circuits.length} circuits that have held a championship Grand Prix, with length, turns, location and the races held there.`,
    trail: [['', 'Home'], ['circuits', 'Circuits']],
    body: `
      <h1>Circuits</h1>
      <p class="lede">${circuits.length} circuits that have held a championship Grand Prix.</p>
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
    page({
      path: `circuits/${c.id}`,
      lastmod: LAST_RUN.circuit.get(c.id),
      title: titled(c.name),
      description: summarise(
        `${c.official_name ?? c.name}${c.locality ? `, ${c.locality}` : ''}${c.country ? `, ${c.country}` : ''}. ${
          c.length_km ? `${c.length_km} km` : ''
        }${c.turns ? `, ${c.turns} turns` : ''}${c.gp_count ? `, ${c.gp_count} championship Grands Prix` : ''}${
          c.first_gp ? ` from ${c.first_gp}` : ''
        }. ${c.characteristics ?? ''}`,
        300,
      ),
      trail: [['', 'Home'], ['circuits', 'Circuits'], [`circuits/${c.id}`, c.name]],
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
        <h1>${esc(c.name)}</h1>
        ${fields([
          ['Official name', text(c.official_name)],
          ['Location', text(list([c.locality, c.country]))],
          ['Type', text(c.circuit_type)],
          ['Length', c.length_km === null ? '—' : `${c.length_km} km`],
          ['Turns', num(c.turns)],
          ['Direction', text(c.direction)],
          ['Championship races', num(cv.races)],
          ['First', cv.derived_first ? link(`seasons/${cv.derived_first}`, cv.derived_first) : '—'],
          ['Last', cv.derived_last ? link(`seasons/${cv.derived_last}`, cv.derived_last) : '—'],
          ['Confidence', c.confidence ? link('data/quality', c.confidence) : text(c.confidence)],
        ])}
        ${prose(c.characteristics)}
        ${prose(c.notes)}
        ${
          outlinesHere.length
            ? `<h2>Every layout raced here</h2>${note(`${OUTLINE_RULE} ${OUTLINE_SCALE_NOTE}`)}<div class="outline-grid">${outlinesHere
                .map((row) => outlineCard(row.path, c.name, row.f1db_layout_id, outlineCaption(row)))
                .join('')}</div>`
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
        <h2>Every race held here</h2>
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
        }`,
    })
  }
}

// ------------------------------------------------------------------- cars

{
  const cars = all(`SELECT * FROM cars ORDER BY from_year, designation`)

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
  const carTables = (id) => {
    const variants = all(VARIANTS, id)
    const several = variants.length > 1
    const entries = all(CAR_ENTRIES, id)
    const ambiguous = all(CAR_SEASONS, id, id).filter((s) => !s.corroborated)
    return `${
      several
        ? `<h2>Variants</h2>${fromColumns(VARIANT_COLUMNS, variants, {
            name: (name, row) => link(`cars/${row.id}`, name),
          })}${note(VARIANTS_FOOTER)}`
        : ''
    }${
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
    title: titled('Cars'),
    description: `${cars.length} landmark Formula One chassis specified in full, and the register of all ${chassis.length} chassis that have started a Grand Prix.`,
    trail: [['', 'Home'], ['cars', 'Cars']],
    body: `
      <h1>Cars</h1>
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

  for (const c of cars) {
    const name = c.full_name ?? c.designation
    // Second on the page, where Car.jsx puts it: after the figures that say
    // what the car is and before the prose that says why it mattered.
    const photos = photographs(c.id)
    page({
      path: `cars/${c.id}`,
      lastmod: LAST_RUN.car.get(c.id),
      title: titled(name),
      image: photos.image,
      description: summarise(
        `${name}, ${c.from_year ?? '?'}–${c.to_year ?? '?'}${c.engine_name ? `, ${c.engine_name}` : ''}${
          c.designers ? `, designed by ${c.designers}` : ''
        }. ${c.concept ?? c.story ?? ''}`,
        300,
      ),
      trail: [['', 'Home'], ['cars', 'Cars'], [`cars/${c.id}`, name]],
      body: `
        <h1>${esc(name)}</h1>
        ${fields([
          ['Constructor', c.constructor_id ? link(`constructors/${c.constructor_id}`, c.constructor_id) : '—'],
          ['Years', `${c.from_year ?? '?'}–${c.to_year ?? '?'}`],
          ['Designers', text(c.designers)],
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
          ['Races', num(c.races)],
          ['Wins', num(c.wins)],
          ['Poles', num(c.poles)],
          ["Drivers' titles", num(c.drivers_titles)],
          ["Constructors' titles", num(c.constructors_titles)],
          ['Specification confidence', text(c.spec_confidence)],
        ])}
        ${photos.html}
        ${prose(c.concept)}
        ${prose(c.innovations)}
        ${prose(c.story)}
        ${prose(c.outcome)}
        ${carTables(c.id)}`,
    })
  }

  // The rest of the register. `cars` ids are skipped because the loop above has
  // already written those pages from the richer curated row.
  //
  // Facts are passed RAW rather than through text(), so fields() drops the ones
  // nothing is known for. 376 of these chassis carry no specification at all,
  // and a page of twenty em dashes claims twenty times over that nobody has
  // established a figure — which is true, and is not worth saying twenty times.
  const curated = new Set(cars.map((c) => c.id))

  for (const ch of chassis) {
    if (curated.has(ch.id)) continue

    const name = ch.full_name ?? ch.name
    const years = ch.first_year === ch.last_year
      ? String(ch.first_year ?? '?')
      : `${ch.first_year ?? '?'}–${ch.last_year ?? '?'}`
    const entries = raced.get(ch.id) ?? []
    const constructor = ch.constructor ?? ch.constructor_id
    const photos = photographs(ch.id)

    page({
      path: `cars/${ch.id}`,
      lastmod: LAST_RUN.car.get(ch.id),
      title: titled(name),
      image: photos.image,
      description: summarise(
        `${name}, ${constructor ? `entered by ${constructor}, ` : ''}${years}. ` +
          `${entries.length ? `${entries.length} championship ${entries.length === 1 ? 'entry' : 'entries'}` : 'No championship entry recorded'}` +
          `${ch.wins ? `, ${ch.wins} ${ch.wins === 1 ? 'win' : 'wins'}` : ''}` +
          `${ch.engine_name ? `. ${ch.engine_name} engine` : ''}.`,
        300,
      ),
      trail: [['', 'Home'], ['cars', 'Cars'], [`cars/${ch.id}`, name]],
      body: `
        <h1>${esc(name)}</h1>
        ${fields([
          ['Constructor', ch.constructor_id ? link(`constructors/${ch.constructor_id}`, constructor) : null],
          ['Years', years],
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
          ['Races', num(entries.length)],
          ['Wins', num(ch.wins)],
          ['Published wins', ch.published_wins === null ? null : num(ch.published_wins)],
          ['Confidence', ch.confidence ? link('data/quality', ch.confidence) : text(ch.confidence)],
        ])}
        ${photos.html}
        ${
          ch.car_id && curated.has(ch.car_id)
            ? `<p class="measure">One of the ${link(`cars/${ch.car_id}`, 'design family')} that has a specified page of its own.</p>`
            : ''
        }
        ${carTables(ch.id)}`,
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
  const records = all(RECORDS)
  const tiers = tiersOf(records)
  page({
    path: 'records',
    title: titled('Records'),
    description: `${records.length} Formula One records, each derived from the database's own race records and stating how.`,
    trail: [['', 'Home'], ['records', 'Records']],
    body: `
      <h1>Records</h1>
      <p class="lede">${esc(RECORDS_LEDE)}${
          tiers.length === 1
            ? ` ${esc(tierBefore(records.length))}${link('data/quality', tiers[0])}${esc(TIER_AFTER)}`
            : ''
        }</p>
      ${fromColumns(recordColumns(records), records, {
        confidence: (value) => (value ? link('data/quality', value) : text(value)),
        holder: (value, row) => {
          const path = holderPath(row)
          return path ? link(path, value) : text(value)
        },
      })}`,
  })

  const eras = all(ERAS)
  page({
    path: 'reference/eras',
    title: titled('Eras'),
    description: 'Formula One divided into eras, with the dominant teams and defining features of each.',
    trail: [['', 'Home'], ['reference/eras', 'Eras']],
    body: `
      <h1>Eras</h1>
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
    title: titled('Glossary'),
    description: `${glossary.length} Formula One terms defined — the vocabulary the rest of this database uses.`,
    trail: [['', 'Home'], ['reference/glossary', 'Glossary']],
    body: `
      <h1>Glossary</h1>
      <h2>Glossary</h2>
      ${fromColumns(GLOSSARY_COLUMNS, glossary)}
      <h2>People</h2>
      ${fromColumns(PERSONNEL_COLUMNS, all(PERSONNEL))}`,
  })

  const sources = all(SOURCES)
  page({
    path: 'data/sources',
    title: titled('Sources'),
    description:
      'Every source this database draws on, what it is trusted for, its licence, and how its claims are cross-checked.',
    trail: [['', 'Home'], ['data', 'Data'], ['data/sources', 'Sources']],
    body: `
      <h1>Sources</h1>
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
    const shape = one(`
      SELECT (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table') AS tables,
             (SELECT COUNT(*) FROM sqlite_master WHERE type = 'view')  AS views,
             (SELECT COUNT(*) FROM source_registry)                    AS sources,
             (SELECT COUNT(*) FROM discrepancies)                      AS discrepancies,
             (SELECT COUNT(*) FROM discrepancies WHERE status LIKE 'open%') AS open_discrepancies,
             (SELECT COUNT(*) FROM v_open_gaps)                        AS gaps,
             (SELECT COUNT(*) FROM races)                              AS races,
             (SELECT COUNT(*) FROM race_entries)                       AS entries`)
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
      title: titled('Data'),
      description: `The whole site is one SQLite file, and you can have it. Formula One ${SPAN}, v${META.version}, built ${META.built}. ${CROSS_CHECKED}`,
      trail: [['', 'Home'], ['data', 'Data']],
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: `${SITE} — Formula One, ${SPAN}`,
        description: CROSS_CHECKED,
        url: `${ORIGIN}${href('data')}`,
        version: META.version,
        dateModified: META.built,
        temporalCoverage: String(META.coverage_seasons ?? '').replace('-', '/'),
        license: 'https://creativecommons.org/licenses/by-sa/4.0/',
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: SITE, url: `${ORIGIN}${BASE}` },
        distribution: [
          { ...download('f1.db', 'f1.db — the SQLite database'), encodingFormat: 'application/vnd.sqlite3' },
          { ...download('f1.db.gz', 'f1.db.gz — the same, gzipped'), encodingFormat: 'application/gzip' },
          {
            ...download('f1-geometry.db', 'f1-geometry.db — circuit centrelines, © OpenStreetMap contributors, ODbL 1.0'),
            encodingFormat: 'application/vnd.sqlite3',
            license: 'https://opendatacommons.org/licenses/odbl/1-0/',
          },
          { ...download('f1-parquet.zip', 'f1-parquet.zip — every table as Parquet'), encodingFormat: 'application/zip' },
        ],
      },
      body: `
      <h1>Data</h1>
      <p class="lede">The whole site is one SQLite file, and you can have it. What it is, the files
        it comes as, how far to trust it, and what you may do with it.</p>
      ${fields([
        ['Database', `v${esc(META.version)}`],
        ['Built', esc(META.built)],
        ['Covers', esc(META.coverage_seasons)],
        ['Tables', `${shape.tables.toLocaleString()}, and ${shape.views.toLocaleString()} views`],
        ['Races', `${shape.races.toLocaleString()}, in ${shape.entries.toLocaleString()} race entries`],
      ])}
      <p class="measure">${esc(CROSS_CHECKED)}</p>
      <h2>The files</h2>
      <ul class="cards">
        <li><a href="${esc(href('f1.db'))}"><code>f1.db</code></a> — the database, as built. Open it with any SQLite client; <code>circuit_geometry</code> in it is deliberately empty.</li>
        <li><a href="${esc(href('f1-geometry.db'))}"><code>f1-geometry.db</code></a> — the circuit centrelines, © OpenStreetMap contributors under ODbL 1.0, in a file of their own.</li>
        <li><a href="${esc(href('f1-parquet.zip'))}"><code>f1-parquet.zip</code></a> — every table as Parquet, one file each; pandas, polars and DuckDB read it directly.</li>
      </ul>
      <p class="measure">${esc(TWO_FILES)} ${esc(SELF_DESCRIBING)}</p>
      <p class="faint">Two JSON exports — <code>f1_database.json.gz</code>, every table, and
        <code>f1_compat.json</code>, the original v1 key layout — are written by the same build
        and travel with each release rather than being served from here.</p>
      <h2>What explains it</h2>
      <ul class="cards">
        ${DOCUMENTS.map(([file, what]) => `<li><a href="${esc(href(file))}"><code>${esc(file)}</code></a> — ${esc(what)}</li>`).join('')}
      </ul>
      <p class="measure">${esc(DOCUMENTS_NOTE)} <a href="${esc(REPOSITORY)}">The repository</a> holds the build, the
        checks that gate it and the source data they read, so the cross-checking claimed above can
        be read rather than taken on trust.</p>
      <h2>How far to trust it</h2>
      ${fields([
        ['Disagreements on record', `${shape.discrepancies.toLocaleString()}, ${shape.open_discrepancies.toLocaleString()} still open`],
        ['Open gaps', `${shape.gaps.toLocaleString()}, and what would close each`],
        ['Sources', `${shape.sources.toLocaleString()}, each with its licence`],
        ['The ladder', esc(ladder.join(' › '))],
      ])}
      <p class="measure">Only an official source — the FIA or formula1.com — carries a row to the top. Where a
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
        <code>f1-geometry.db</code> alone. ${link('data/sources', 'Every source')}, what it is
        trusted for, and what each licence cost or bought.</p>
      <h2>Ask it something</h2>
      <p class="measure">${link('data/sql', 'The SQL console')} runs any read against the whole database in your
        browser. Nothing is sent anywhere, and a query&rsquo;s address is a link to it.</p>`,
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
    title: titled('Data quality'),
    description:
      'The confidence model, the open discrepancies and every known gap — what this database does not know, stated rather than hidden.',
    trail: [['', 'Home'], ['data', 'Data'], ['data/quality', 'Data quality']],
    body: `
      <h1>Data quality</h1>
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
    title: titled('SQL console'),
    description:
      'Run your own SQL against the whole database in your browser. Nothing is sent anywhere; the query runs in this tab.',
    trail: [['', 'Home'], ['data', 'Data'], ['data/sql', 'SQL console']],
    body: `
      <h1>SQL console</h1>
      <p class="lede">The console needs JavaScript: it runs SQLite compiled to WebAssembly against
        the database file in your own browser. Nothing you type is sent anywhere.</p>
      <p class="measure">The database is a plain SQLite file. If you would rather query it with your own tools,
        download <a href="${esc(href('f1.db'))}"><code>f1.db</code></a> and open it with any
        SQLite client. The circuit centrelines are not in it — <code>circuit_geometry</code>
        there is deliberately empty — and ship beside it as
        <a href="${esc(href('f1-geometry.db'))}"><code>f1-geometry.db</code></a>.
        ${esc(TWO_FILES)} ${esc(SELF_DESCRIBING)}</p>`,
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
    trail: [['', 'Home'], ['changes', CHANGES_TITLE]],
    body: `
      <h1>${esc(CHANGES_TITLE)}</h1>
      <p class="lede">${esc(CHANGES_LEDE)}</p>
      <h2>${esc(CURRENT_HEADING)}</h2>
      ${fields([
        ['Version', `v${esc(META.version)}`],
        ['Built', esc(META.built)],
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
  <author><name>${esc(SITE)}</name></author>
  <rights>${esc(feedRights(`${ORIGIN}${href('data/sources')}`))}</rights>
${timeline.map(entry).join('\n')}
</feed>
`,
  )
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
const render = ({ path, title, description, jsonld, image = null, html }) => {
  const url = `${ORIGIN}${href(path)}`
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
    title: titled('Not found'),
    description: 'No page at this address.',
    jsonld: null,
    // Through structure() like every other page: it is the one route that does
    // not go through page(), and a 404 outside `.page` would be the only
    // heading on the site set in a third treatment again.
    html: chrome(
      structure(
        `<h1>Not found</h1>
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
const sitemapUrls = [
  ...pages.map((p) => ({ loc: `${ORIGIN}${href(p.path)}`, lastmod: p.lastmod })),
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
  `User-agent: *\nAllow: /\n\n# The database itself is 20 MB and is not a page. Crawling it helps nobody.\nDisallow: ${href('f1.db')}\nDisallow: ${href('f1.db.gz')}\nDisallow: ${href('f1-parquet.zip')}\n\nSitemap: ${ORIGIN}${href('sitemap.xml')}\n`,
)

db.close()

console.log(`  prerendered ${written.toLocaleString()} pages (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
console.log(
  `  dist/sitemap.xml, dist/feed.xml, dist/robots.txt, dist/404.html, ${REDIRECTS.length} redirecting pages`,
)
console.log(`  origin ${ORIGIN}${BASE}`)
