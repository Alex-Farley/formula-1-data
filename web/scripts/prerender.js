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
 * writes dist/<route>/index.html, dist/404.html, dist/sitemap.xml and
 * dist/robots.txt.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// The one rule for the "Out"/"Status" column, shared with the app rather
// than restated here: a copy of it would drift, which is how the twelve
// hardcoded `circuit_geometry` columns went wrong. `formatted` is the
// app's own cell text — text() in lib/format.js — for the tables below
// that are drawn from a page's column list.
import { finished, missing, result, text as formatted, yearList } from '../src/lib/format.js'
import {
  CROSS_CHECKED,
  ENTRIES_NOTE,
  citation,
  LANDMARK,
  NOT_HELD,
  NOT_YET_RUN,
  SELF_DESCRIBING,
  SHARED,
  SITE,
  SO_FAR,
  SPRINT,
  TWO_FILES,
  titled,
} from '../src/lib/site.js'
import { EXPLAINED_FOOTER, OPEN_FOOTER, allExplained } from '../src/lib/disagreement.js'
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
  CONSTRUCTORS_PAIR_FOOTER,
  DRIVERS_FINAL_COLUMNS,
  DRIVERS_FINAL_FOOTER,
  ENTRANTS,
  ENTRANT_COLUMNS,
  ENTRANTS_FOOTER,
  FINAL,
  GRID,
  NO_CONSTRUCTORS_TITLE,
  SEASON,
  STANDINGS as SEASON_STANDINGS,
  latestRound,
  standingsHeading,
  stillRunning,
} from '../src/queries/season.js'
import { RACES, RACE_COLUMNS, RACES_FOOTER } from '../src/queries/races.js'
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
  SPRINT as SPRINT_RESULTS,
  SPRINT_COLUMNS,
  SPRINT_FOOTER,
  inClassificationOrder,
  qualifyingColumns,
  railOf,
} from '../src/queries/race.js'
import {
  BY_SEASON as TEAM_BY_SEASON,
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
  WINNERS as WINNERS_HERE,
  WINNER_COLUMNS,
} from '../src/queries/circuit.js'
import {
  BY_SEASON,
  DERIVED,
  DRIVER,
  SEASON_COLUMNS,
  SEASONS_FOOTER,
  STANDINGS,
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
const table = (headers, rows, options = {}) => {
  if (!rows.length) return ''
  const { caption, aligns = [] } = options
  const cls = (i) => (aligns[i] ? ` class="${esc(aligns[i])}"` : '')
  return [
    '<div class="tablewrap"><table>',
    caption ? `<caption>${esc(caption)}</caption>` : '',
    `<thead><tr>${headers.map((h, i) => `<th scope="col"${cls(i)}>${typeof h === 'string' ? esc(h) : h.html}</th>`).join('')}</tr></thead>`,
    '<tbody>',
    rows.map((cells) => `<tr>${cells.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>`).join(''),
    '</tbody></table></div>',
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
const fromColumns = (columns, rows, links = {}, options = {}) =>
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
    { ...options, aligns: columns.map((c) => c.align ?? '') },
  )

const facts = (pairs) => {
  const kept = pairs.filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (!kept.length) return ''
  return `<dl class="facts">${kept
    .map(([label, value]) => `<dt>${esc(label)}</dt><dd>${value}</dd>`)
    .join('')}</dl>`
}

const prose = (value) => (value ? `<p>${esc(value)}</p>` : '')

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

/** "Ferrari", "Ferrari and Matra", "Mercedes, McLaren and Ferrari", "Ferrari, Matra and 6 other constructors". */
const constructorList = (names) => {
  if (names.length <= 3) return names.length < 3 ? names.join(' and ') : `${names[0]}, ${names[1]} and ${names[2]}`
  const rest = names.length - 2
  return `${names[0]}, ${names[1]} and ${rest} other ${rest === 1 ? 'constructor' : 'constructors'}`
}

// Digits throughout: "best finish 4th" and "best finish 33rd" read as one
// system, where words to twelfth and digits beyond did not.
const ordinal = (n) => {
  const tail = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'
  return `${n}${tail}`
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * A driver's career as one sentence a search snippet can show, from the
 * figures counted out of the race records - the ones the strip at the top of
 * the page derives - and never from a stored column the page labels as
 * published. For a winner: what they won. For everyone else: what is true.
 *
 *     Entered 88 championship Grands Prix across 1979–1986 for Arrows,
 *     Brabham and 5 other constructors; best finish 4th.
 *
 * `finish_position` is NULL for a DNF, a DNQ and a DNS alike, so a career
 * with no classified finish says exactly that rather than guessing why.
 */
const careerSentence = (derived, constructors, titles) => {
  if (!derived || !derived.entries) return 'No championship race entry in the records.'
  const when =
    derived.first_year === derived.last_year
      ? `in ${derived.first_year}`
      : `across ${derived.first_year}–${derived.last_year}`
  const who = constructors.length ? ` for ${constructorList(constructors)}` : ''
  const entered = `Entered ${plural(derived.entries, 'championship Grand Prix', 'championship Grands Prix')} ${when}${who}`

  const tally = [
    titles ? plural(titles, 'world title') : null,
    derived.wins ? plural(derived.wins, 'win') : null,
    derived.podiums ? plural(derived.podiums, 'podium') : null,
    derived.poles ? plural(derived.poles, 'pole') : null,
  ].filter(Boolean)
  const counted = tally.length > 1 ? `${tally.slice(0, -1).join(', ')} and ${tally.at(-1)}` : tally[0] ?? null

  // A winner's best finish is the win; anyone else is described by their best
  // result, or by the absence of one.
  const best = derived.wins
    ? null
    : derived.best
      ? `best finish ${ordinal(derived.best)}`
      : 'no classified finish'

  return `${entered}; ${[counted, best].filter(Boolean).join(', ')}.`
}

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
    }${link('data/quality', 'the quality page')}.</p>
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
  <header class="masthead">
    <div class="masthead-inner">
      <a class="wordmark" href="${esc(href(''))}"><span><b>Lap Ledger</b><span>1950–2026 · every championship race</span></span></a>
      <nav>${NAV.map(([to, label]) => link(to, label)).join('')}</nav>
    </div>
  </header>
  <main>
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
    <p>Every page here is a query against one SQLite file, running in your browser. ${link('data/quality', 'How far to trust it')} · ${link('data/sources', 'sources')} · ${link('data/sql', 'write your own query')}.</p>
    <p class="faint">Race data from <a href="https://github.com/f1db/f1db">F1DB</a> (CC BY 4.0), prose and registers from Wikipedia (CC BY-SA 4.0), circuit geometry © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL 1.0). Unaffiliated with Formula One, the FIA or any team.</p>
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

/**
 * Queue one route.
 *
 * `path` is relative to the base and carries no leading slash; '' is the home
 * page. `jsonld` is an object or null — one script tag per page, because a
 * search engine reading two of them for the same thing is a warning nobody
 * needs.
 */
const page = ({ path, title, description, body, jsonld = null, trail = null }) => {
  // The citation names the page by the address the canonical carries.
  pages.push({ path, title, description, jsonld, html: chrome(body, trail ? crumbs(trail) : '', `${ORIGIN}${href(path)}`) })
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
      'Every championship race, classification, qualifying sheet and pit stop from 1950 to 2026, queried in your browser. Every figure traceable to a source; every blank an unestablished fact rather than a zero.',
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE,
      url: `${ORIGIN}${BASE}`,
      description:
        'A normalised, verifiable SQLite database of Formula One championship racing, 1950–2026.',
      license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    body: `
      <h1>Formula One, 1950–2026, with its sources attached</h1>
      <p class="lede">Seventy-seven seasons as one SQLite file, queried in this tab. Every figure
        is traceable to the source it came from, and a blank means nobody has established that
        fact — never zero.</p>
      ${facts([
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
    `${row[idKey] ? link(`${path}/${row[idKey]}`, name) : text(name)}${row.undecided && name ? ` ${tag(SO_FAR)}` : ''}`

  page({
    path: 'seasons',
    title: titled('Every season, 1950–2026'),
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
    const entered = grid
      ? `${num(grid.drivers)} drivers, ${num(grid.constructors)} constructors, ${num(grid.engine_manufacturers)} engine makers — counted from the entries, whether or not they started`
      : '—'

    page({
      path: `seasons/${year}`,
      title: titled(`${year} Formula One World Championship`),
      description: s.champion
        ? `${s.champion} won the ${year} Formula One World Championship for ${s.champion_team_name ?? '—'} with ${s.champion_points ?? '—'} points over ${s.rounds ?? '?'} rounds. Every race, winner, pole and fastest lap.`
        : running
          ? `${lead.entity} leads the ${year} Formula One World Championship by ${num(gap)} points after ${after ?? run} of ${s.rounds ?? '?'} rounds. Every race, winner, pole and fastest lap.`
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
          running
            ? facts([
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
            : facts([
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
        ${prose(s.notes)}
        <h2>The calendar</h2>
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
        ${fromColumns(DRIVERS_FINAL_COLUMNS, driversFinal, {
          entity: (name, row) => (row.entity_id ? link(`drivers/${row.entity_id}`, name) : text(name)),
        })}
        ${driversFinal.length ? note(DRIVERS_FINAL_FOOTER) : ''}
        <h2>${esc(standingsHeading("Constructors'", live, after))}</h2>
        ${
          constructorsFinal.length
            ? fromColumns(CONSTRUCTORS_FINAL_COLUMNS, constructorsFinal, {
                entity: (name, row) =>
                  `${row.entity_id ? link(`constructors/${row.entity_id}`, name) : text(name)}${row.engine_id ? ` ${tag(row.engine_id)}` : ''}`,
              }) + (constructorsFinal.some((r) => r.engine_id) ? note(CONSTRUCTORS_PAIR_FOOTER) : '')
            : `<p><strong>No constructors' championship.</strong> ${esc(NO_CONSTRUCTORS_TITLE)}</p>`
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
            (SELECT q.driver_id FROM qualifying q
              WHERE q.race_id = r.id AND q.position = 1) AS quickest_id,
            (SELECT e.driver_id FROM race_entries e
              WHERE e.race_id = r.id AND e.grid = 1) AS front_id
       FROM races r
       LEFT JOIN circuits c ON c.id = r.circuit_id
       LEFT JOIN race_results rr ON rr.year = r.year AND rr.round = r.round
      ORDER BY r.year DESC, r.round DESC`,
  )

  page({
    path: 'races',
    title: titled('Every championship race, 1950–2026'),
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
    const description = scheduled
      ? `${headline}: round ${r.round}${r.circuit ? ` at ${r.circuit}` : ''}${r.dates ? `, ${r.dates}` : ''}. Scheduled — no classification yet.`
      : `${r.winner ?? 'Nobody recorded'} won the ${headline}${r.constructor ? ` for ${r.constructor}` : ''}${r.circuit ? ` at ${r.circuit}` : ''}. Full classification, grid, pole and fastest lap.`

    page({
      path: `races/${r.year}/${r.round}`,
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
        ${facts([
          ['Round', `${r.round} of ${r.year}`],
          ['Circuit', r.circuit_id ? link(`circuits/${r.circuit_id}`, r.circuit ?? r.circuit_id) : '—'],
          ['Location', text(list([r.locality, r.country]))],
          ['Dates', text(r.dates)],
          ['Format', r.sprint ? 'Sprint weekend' : 'Standard weekend'],
          ...(scheduled
            ? [['Status', 'Scheduled — not yet run']]
            : [
                ['Winner', driver(r.winner_id, r.winner)],
                ['Constructor', team(r.constructor_id, r.constructor)],
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
        ${
          sessions.length
            ? `<h2>Timetable</h2>${fromColumns(SESSION_COLUMNS, sessions)}<p class="source-note">${esc(TIMETABLE_NOTE)}</p>`
            : ''
        }
        ${prose(r.note)}
        ${disagree(disagreements.all(`${r.year} round ${r.round}`), 'this race')}
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
              ? '<p>This race has not been run. The classification will appear here once it has.</p>'
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
    title: titled('Every driver, 1950–2026'),
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
  // Constructors entered for, most often first; 377 entries name none.
  const constructorsOf = db.prepare(
    `SELECT c.name, COUNT(*) AS n
       FROM race_entries e
       JOIN constructors c ON c.id = e.constructor_id
      WHERE e.driver_id = ?
      GROUP BY c.id ORDER BY n DESC, c.name`,
  )

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
    const career = careerSentence(derived, constructorsOf.all(id).map((c) => c.name), d.titles)
    // The lede follows the derived sentence where there is room for a whole
    // sentence of it; a note that is one long sentence would otherwise be
    // cut mid-thought with an ellipsis, and the career alone is complete.
    const lead = `${d.full_name}${d.nationality ? `, ${d.nationality}` : ''}. ${career}`
    const withNotes = summarise(`${lead} ${d.notes ?? ''}`, 300)

    page({
      path: `drivers/${d.id}`,
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
        ${facts(
          strip(d, derived).map(({ label, value, note }) => [
            label,
            value === null ? null : `${esc(value)}${note ? ` <small>${esc(note)}</small>` : ''}`,
          ]),
        )}
        ${prose(d.notes)}
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
            ? `<p class="note"><strong>${esc(pointsNote(d, derived).head)}</strong> ${esc(pointsNote(d, derived).body)}</p>`
            : ''
        }
        ${facts([
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
    title: titled('Every constructor, 1950–2026'),
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
    const teamStandings = all(TEAM_STANDINGS, c.id)
    const seasons = constructorSeasons(all(TEAM_BY_SEASON, c.id), teamStandings)
    const engineSplit = teamStandings.some((s) => s.engine_id)
    const wins = all(TEAM_WINS, c.id)
    const designs = all(DESIGNS, c.id)
    page({
      path: `constructors/${c.id}`,
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
        ${facts([
          ['Full name', text(c.full_name)],
          ['Country', text(c.country)],
          ['Base', text(c.base)],
          ['Entered', `${c.first_entry ?? '?'}–${c.last_entry ?? 'present'}`],
          ['Entries', num(c.entries)],
          ['Wins', num(c.wins)],
          ['Poles', num(c.poles)],
          ["Constructors' titles", c.constructors_titles ? `${c.constructors_titles} (${yearList(c.title_years)})` : num(c.constructors_titles)],
          ["Drivers' titles", num(c.drivers_titles)],
          ['Active', c.active === null ? null : c.active ? 'Yes' : 'No'],
          ['Confidence', c.confidence ? link('data/quality', c.confidence) : text(c.confidence)],
        ])}
        ${prose(c.notes)}
        ${disagree(teamDisagreements.all(c.name), 'this team')}
        <h2>Season by season</h2>
        ${
          seasons.length
            ? `${fromColumns(TEAM_SEASON_COLUMNS, seasons, {
                year: (year) => link(`seasons/${year}`, year),
              })}${engineSplit ? note(ENGINE_SPLIT_FOOTER) : ''}`
            : '<p>Nothing recorded.</p>'
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
    title: titled('Every circuit, 1950–2026'),
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
    page({
      path: `circuits/${c.id}`,
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
        ${facts([
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
            : '<p>Nothing recorded.</p>'
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
      ${fromColumns(GALLERY_COLUMNS, all(GALLERY), { car: (name, row) => link(`cars/${row.id}`, name) }, { caption: 'Landmark cars' })}
      <h2>The chassis register</h2>
      <p>Every chassis that has started a championship Grand Prix, whether or not anybody
        has published a specification for it.</p>
      ${fromColumns(
        CHASSIS_COLUMNS,
        all(CHASSIS),
        {
          name: (name, row) => `${link(`cars/${row.id}`, name)}${row.landmark ? ` ${tag(LANDMARK)}` : ''}`,
          constructor: (name, row) => (row.constructor_id ? link(`constructors/${row.constructor_id}`, name ?? row.constructor_id) : text(name)),
        },
        { caption: 'Chassis register' },
      )}
      ${note(CHASSIS_FOOTER)}`,
  })

  for (const c of cars) {
    const name = c.full_name ?? c.designation
    page({
      path: `cars/${c.id}`,
      title: titled(name),
      description: summarise(
        `${name}, ${c.from_year ?? '?'}–${c.to_year ?? '?'}${c.engine_name ? `, ${c.engine_name}` : ''}${
          c.designers ? `, designed by ${c.designers}` : ''
        }. ${c.concept ?? c.story ?? ''}`,
        300,
      ),
      trail: [['', 'Home'], ['cars', 'Cars'], [`cars/${c.id}`, name]],
      body: `
        <h1>${esc(name)}</h1>
        ${facts([
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
        ${prose(c.concept)}
        ${prose(c.innovations)}
        ${prose(c.story)}
        ${prose(c.outcome)}`,
    })
  }

  // The rest of the register. `cars` ids are skipped because the loop above has
  // already written those pages from the richer curated row.
  //
  // Facts are passed RAW rather than through text(), so facts() drops the ones
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

    page({
      path: `cars/${ch.id}`,
      title: titled(name),
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
        ${facts([
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
        ${
          ch.car_id && curated.has(ch.car_id)
            ? `<p>One of the ${link(`cars/${ch.car_id}`, 'design family')} that has a specified page of its own.</p>`
            : ''
        }
        ${
          entries.length
            ? `<h2>Every championship entry</h2>${table(
                ['Year', 'Round', 'Grand Prix', 'Driver', 'Grid', 'Result'],
                entries.map((e) => [
                  link(`seasons/${e.year}`, e.year),
                  num(e.round),
                  link(`races/${e.year}/${e.round}`, e.name_used),
                  e.driver_id ? link(`drivers/${e.driver_id}`, e.driver ?? e.driver_id) : '—',
                  text(e.grid_text),
                  text(e.position_text ?? e.status),
                ]),
                { caption: 'Championship entries' },
              )}`
            : '<p>No championship entry is recorded against this chassis.</p>'
        }`,
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

  const eras = all(`SELECT * FROM eras ORDER BY from_year`)
  page({
    path: 'reference/eras',
    title: titled('Eras'),
    description: 'Formula One divided into eras, with the dominant teams and defining features of each.',
    trail: [['', 'Home'], ['reference/eras', 'Eras']],
    body: `
      <h1>Eras</h1>
      ${eras
        .map(
          (e) => `<section>
            <h2>${esc(e.era_name)} <span class="faint">${e.from_year}–${e.to_year ?? 'present'}</span></h2>
            ${prose(e.summary)}
            ${facts([
              ['Dominant teams', text(e.dominant_teams)],
              ['Defining features', text(e.defining_features)],
            ])}
          </section>`,
        )
        .join('')}`,
  })

  const glossary = all(`SELECT * FROM glossary ORDER BY term`)
  page({
    path: 'reference/glossary',
    title: titled('Glossary'),
    description: `${glossary.length} Formula One terms defined — the vocabulary the rest of this database uses.`,
    trail: [['', 'Home'], ['reference/glossary', 'Glossary']],
    body: `
      <h1>Glossary</h1>
      <dl class="glossary">${glossary
        .map((g) => `<dt>${esc(g.term)}</dt><dd>${esc(g.definition)}</dd>`)
        .join('')}</dl>`,
  })

  const sources = all(`SELECT * FROM source_registry ORDER BY id`)
  page({
    path: 'data/sources',
    title: titled('Sources'),
    description:
      'Every source this database draws on, what it is trusted for, its licence, and how its claims are cross-checked.',
    trail: [['', 'Home'], ['data', 'Data'], ['data/sources', 'Sources']],
    body: `
      <h1>Sources</h1>
      <p class="lede">What each source is trusted for, under what licence, and what constrains it.</p>
      ${sources
        .map(
          (s) => `<section>
            <h2>${esc(s.source)}</h2>
            ${facts([
              ['Authority', text(s.authority)],
              ['Licence', text(s.licence)],
              ['Updated', text(s.cadence)],
              ['Cross-checked by', text(s.checkability)],
              ['URL', s.url && s.url !== 'None' ? `<a href="${esc(s.url)}">${esc(s.url)}</a>` : null],
            ])}
            ${prose(s.use)}
          </section>`,
        )
        .join('')}`,
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
      description: `The whole site is one SQLite file, and you can have it. Formula One 1950–2026, v${META.version}, built ${META.built}. ${CROSS_CHECKED}`,
      trail: [['', 'Home'], ['data', 'Data']],
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: `${SITE} — Formula One, 1950–2026`,
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
      ${facts([
        ['Database', `v${esc(META.version)}`],
        ['Built', esc(META.built)],
        ['Covers', esc(META.coverage_seasons)],
        ['Tables', `${shape.tables.toLocaleString()}, and ${shape.views.toLocaleString()} views`],
        ['Races', `${shape.races.toLocaleString()}, in ${shape.entries.toLocaleString()} race entries`],
      ])}
      <p>${esc(CROSS_CHECKED)}</p>
      <h2>The files</h2>
      <ul class="cards">
        <li><a href="${esc(href('f1.db'))}"><code>f1.db</code></a> — the database, as built. Open it with any SQLite client; <code>circuit_geometry</code> in it is deliberately empty.</li>
        <li><a href="${esc(href('f1-geometry.db'))}"><code>f1-geometry.db</code></a> — the circuit centrelines, © OpenStreetMap contributors under ODbL 1.0, in a file of their own.</li>
        <li><a href="${esc(href('f1-parquet.zip'))}"><code>f1-parquet.zip</code></a> — every table as Parquet, one file each; pandas, polars and DuckDB read it directly.</li>
      </ul>
      <p>${esc(TWO_FILES)} ${esc(SELF_DESCRIBING)}</p>
      <p class="faint">Two JSON exports — <code>f1_database.json.gz</code>, every table, and
        <code>f1_compat.json</code>, the original v1 key layout — are written by the same build
        and travel with each release rather than being served from here.</p>
      <h2>How far to trust it</h2>
      ${facts([
        ['Disagreements on record', `${shape.discrepancies.toLocaleString()}, ${shape.open_discrepancies.toLocaleString()} still open`],
        ['Open gaps', `${shape.gaps.toLocaleString()}, and what would close each`],
        ['Sources', `${shape.sources.toLocaleString()}, each with its licence`],
        ['The ladder', esc(ladder.join(' › '))],
      ])}
      <p>Only an official source — the FIA or formula1.com — carries a row to the top. Where a
        career total derived from the race records differs from a published one, both are shown.
        ${link('data/quality', 'The full account')}: the ladder defined, every gap, every
        disagreement, and the reconciliation that runs on each build.</p>
      <h2>What you may do with it</h2>
      ${facts([
        ['Redistributable', `${(classes.yes ?? 0).toLocaleString()} sources — their rows may be passed on under the licence shown beside them.`],
        ['Facts only', `${(classes['facts-only'] ?? 0).toLocaleString()} sources — the facts are used; nothing is copied.`],
        ['Not redistributable', `${(classes.no ?? 0).toLocaleString()} sources — on the register so the position is on record; no row may cite one.`],
      ])}
      <p>${esc(NOT_HELD)}</p>
      <p>Race data from F1DB is CC BY 4.0; prose and registers from Wikipedia are CC BY-SA 4.0 and
        carry share-alike; the centrelines are ODbL and the obligation follows
        <code>f1-geometry.db</code> alone. ${link('data/sources', 'Every source')}, what it is
        trusted for, and what each licence cost or bought.</p>
      <h2>Ask it something</h2>
      <p>${link('data/sql', 'The SQL console')} runs any read against the whole database in your
        browser. Nothing is sent anywhere, and a query&rsquo;s address is a link to it.</p>`,
    })
  }

  // Three groups, the same three Quality.jsx renders: the reader's sentence
  // first, the maintainer's note behind a disclosure. A closed gap is kept
  // and shown as closed, never dropped from the page.
  const gaps = all(`SELECT * FROM known_gaps ORDER BY id`)
  const gapGroup = (state, heading, intro) => {
    const rows = gaps.filter((g) => g.state === state)
    if (!rows.length) return ''
    return `<h2>${esc(heading)}</h2><p>${esc(intro)}</p>${rows
      .map(
        (g) =>
          `<section><h3>${esc(g.field)} — ${esc(g.area)}</h3>${prose(g.reader)}<details><summary>Maintainer’s note</summary>${prose(g.description)}${prose(g.resolution)}</details></section>`,
      )
      .join('')}`
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
      ${gapGroup('open', 'Open gaps', 'What is missing, and what it would take to close each one. Several need a person to read something rather than a script to fetch it.')}
      ${gapGroup('position', 'Positions, not gaps', 'Deliberate absences. Each is the right state for this database, stated so it is not mistaken for something unfinished.')}
      ${gapGroup('closed', 'Closed', 'Gaps that have since been filled, kept so the closure is on record.')}`,
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
      <p>The database is a plain SQLite file. If you would rather query it with your own tools,
        download <a href="${esc(href('f1.db'))}"><code>f1.db</code></a> and open it with any
        SQLite client. The circuit centrelines are not in it — <code>circuit_geometry</code>
        there is deliberately empty — and ship beside it as
        <a href="${esc(href('f1-geometry.db'))}"><code>f1-geometry.db</code></a>.
        ${esc(TWO_FILES)} ${esc(SELF_DESCRIBING)}</p>`,
  })

  page({
    path: 'circuits/atlas',
    title: titled('Track atlas'),
    description:
      'Every circuit traced from OpenStreetMap and measured against its published length, drawn to a common scale.',
    trail: [['', 'Home'], ['circuits', 'Circuits'], ['circuits/atlas', 'Atlas']],
    body: `
      <h1>Track atlas</h1>
      <p class="lede">Circuit centrelines traced from OpenStreetMap, each checked against the
        length this database already held. The drawings need JavaScript; the measurements are on
        each ${link('circuits', 'circuit page')}.</p>`,
  })
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
const render = ({ path, title, description, jsonld, html }) => {
  const url = `${ORIGIN}${href(path)}`
  const head = [
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(SITE)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
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
for (const [from, to] of MOVED) {
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
    <title>${esc(titled('Moved'))}</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${esc(url)}" />
    <meta http-equiv="refresh" content="0; url=${esc(target)}" />
    <script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
  </head>
  <body>
    <p>This page has moved to <a href="${esc(target)}">${esc(url)}</a>.</p>
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
    html: chrome(
      `<h1>Not found</h1>
       <p class="lede">There is no page at this address. It may have been a typo, or a link to
         something this database does not hold.</p>
       <ul class="cards">${NAV.map(([to, label]) => `<li>${link(to, label)}</li>`).join('')}</ul>`,
      '',
    ),
  }),
)

// The sitemap is what makes 2,000-odd pages discoverable without relying on a
// crawler walking every index table. lastmod is the database build date: the
// pages are a pure function of it, so they change exactly when it does.
const built = one(`SELECT value FROM meta WHERE key = 'built'`)?.value ?? new Date().toISOString().slice(0, 10)
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${esc(`${ORIGIN}${href(p.path)}`)}</loc><lastmod>${esc(built)}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
)

writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n\n# The database itself is 20 MB and is not a page. Crawling it helps nobody.\nDisallow: ${href('f1.db')}\nDisallow: ${href('f1.db.gz')}\nDisallow: ${href('f1-parquet.zip')}\n\nSitemap: ${ORIGIN}${href('sitemap.xml')}\n`,
)

db.close()

console.log(`  prerendered ${written.toLocaleString()} pages (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
console.log(`  dist/sitemap.xml, dist/robots.txt, dist/404.html, ${MOVED.length} redirecting pages`)
console.log(`  origin ${ORIGIN}${BASE}`)
