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
// hardcoded `circuit_geometry` columns went wrong.
import { finished, yearList } from '../src/lib/format.js'
import { SITE, titled } from '../src/lib/site.js'

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

const table = (headers, rows, options = {}) => {
  if (!rows.length) return ''
  const { caption } = options
  return [
    '<div class="tablewrap"><table>',
    caption ? `<caption>${esc(caption)}</caption>` : '',
    `<thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>`,
    '<tbody>',
    rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join(''),
    '</tbody></table></div>',
  ].join('')
}

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
  return `<aside class="disagreement" aria-label="Recorded source disagreement">
    <h2>${
      rows.length === 1
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
    <p class="source-note">Recorded rather than resolved, and open for somebody to settle. Every one is listed on ${link('reference/quality', 'the quality page')}.</p>
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
  ['reference', 'Reference'],
]

const chrome = (body, crumbs) => `
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
  </main>
  <footer class="sitefoot"><div class="sitefoot-inner"><div>
    <p>Every page here is a query against one SQLite file, running in your browser. ${link('reference/quality', 'How far to trust it')} · ${link('reference/sources', 'sources')} · ${link('reference/sql', 'write your own query')}.</p>
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
  pages.push({ path, title, description, jsonld, html: chrome(body, trail ? crumbs(trail) : '') })
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
  const seasons = all(`SELECT * FROM seasons ORDER BY year DESC`)
  const names = Object.fromEntries(all('SELECT id, full_name FROM drivers').map((d) => [d.id, d.full_name]))
  const teams = Object.fromEntries(all('SELECT id, name FROM constructors').map((c) => [c.id, c.name]))
  const driver = (id) => (id ? link(`drivers/${id}`, names[id] ?? id) : '—')
  const team = (id) => (id ? link(`constructors/${id}`, teams[id] ?? id) : '—')

  page({
    path: 'seasons',
    title: titled('Every season, 1950–2026'),
    description: `All ${seasons.length} FIA Formula One World Championship seasons, with the drivers' and constructors' champions, points and margin for each.`,
    trail: [['', 'Home'], ['seasons', 'Seasons']],
    body: `
      <h1>Seasons</h1>
      <p class="lede">Every FIA Formula One World Championship season from 1950.</p>
      ${table(
        ['Season', 'Rounds', "Drivers' champion", 'Team', 'Points', 'Runner-up', "Constructors' champion"],
        seasons.map((s) => [
          link(`seasons/${s.year}`, s.year),
          num(s.rounds),
          driver(s.drivers_champion),
          team(s.champion_team),
          num(s.champion_points),
          driver(s.runner_up),
          team(s.constructors_champion),
        ]),
      )}`,
  })

  for (const s of seasons) {
    const races = all(
      `SELECT r.round, r.name_used, r.dates, r.status, r.circuit_id, c.name AS circuit,
              rr.winner_id, rr.winner, rr.constructor_id, rr.constructor, rr.pole, rr.fastest_lap
         FROM races r
         LEFT JOIN circuits c ON c.id = r.circuit_id
         LEFT JOIN race_results rr ON rr.year = r.year AND rr.round = r.round
        WHERE r.year = ? ORDER BY r.round`,
      s.year,
    )
    const finalRound = one(
      `SELECT MAX(after_round) AS r FROM standings WHERE year = ? AND table_type = 'drivers'`,
      s.year,
    )?.r
    const standings = finalRound
      ? all(
          `SELECT position, entity, entity_id, team, points FROM standings
            WHERE year = ? AND table_type = 'drivers' AND after_round = ?
            ORDER BY position LIMIT 12`,
          s.year,
          finalRound,
        )
      : []

    const champion = s.drivers_champion ? names[s.drivers_champion] ?? s.drivers_champion : null
    page({
      path: `seasons/${s.year}`,
      title: titled(`${s.year} Formula One World Championship`),
      description: champion
        ? `${champion} won the ${s.year} Formula One World Championship for ${teams[s.champion_team] ?? '—'} with ${s.champion_points ?? '—'} points over ${s.rounds ?? '?'} rounds. Every race, winner, pole and fastest lap.`
        : `The ${s.year} Formula One World Championship: ${s.rounds ?? '?'} rounds, with every race, winner, pole and fastest lap.`,
      trail: [['', 'Home'], ['seasons', 'Seasons'], [`seasons/${s.year}`, String(s.year)]],
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'SportsSeason',
        name: `${s.year} FIA Formula One World Championship`,
        startDate: String(s.year),
        url: `${ORIGIN}${href(`seasons/${s.year}`)}`,
      },
      body: `
        <h1>${s.year} FIA Formula One World Championship</h1>
        ${facts([
          ["Drivers' champion", driver(s.drivers_champion)],
          ['Team', team(s.champion_team)],
          ['Points', num(s.champion_points)],
          ['Runner-up', `${driver(s.runner_up)} — ${num(s.runner_up_points)}`],
          ['Margin', num(s.margin)],
          ["Constructors' champion", team(s.constructors_champion)],
          ['Rounds', num(s.rounds)],
          ['Engine formula', text(s.engine_formula)],
          ['Tyres', text(s.tyre_suppliers)],
        ])}
        ${prose(s.notes)}
        <h2>Races</h2>
        ${table(
          ['Rd', 'Grand Prix', 'Circuit', 'Dates', 'Winner', 'Constructor', 'Pole', 'Fastest lap'],
          races.map((r) => [
            String(r.round),
            link(`races/${s.year}/${r.round}`, r.name_used),
            r.circuit_id ? link(`circuits/${r.circuit_id}`, r.circuit ?? r.circuit_id) : '—',
            text(r.dates),
            r.winner_id ? driver(r.winner_id) : r.status === 'scheduled' ? '<span class="faint">to come</span>' : '—',
            r.constructor_id ? team(r.constructor_id) : '—',
            text(r.pole),
            text(r.fastest_lap),
          ]),
        )}
        ${
          standings.length
            ? `<h2>Championship standings after round ${finalRound}</h2>${table(
                ['Pos', 'Driver', 'Team', 'Points'],
                standings.map((row) => [
                  String(row.position),
                  row.entity_id ? driver(row.entity_id) : text(row.entity),
                  text(row.team),
                  num(row.points),
                ]),
              )}`
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
      <p class="lede">${races.length.toLocaleString()} championship Grands Prix. The 200 most recent
        are listed here; every one of them is reachable from ${link('seasons', 'its season')}.</p>
      ${table(
        ['Season', 'Rd', 'Grand Prix', 'Circuit', 'Winner', 'Constructor'],
        races.slice(0, 200).map((r) => [
          link(`seasons/${r.year}`, r.year),
          String(r.round),
          link(`races/${r.year}/${r.round}`, r.name_used),
          r.circuit_id ? link(`circuits/${r.circuit_id}`, r.circuit ?? r.circuit_id) : '—',
          driver(r.winner_id, r.winner),
          team(r.constructor_id, r.constructor),
        ]),
      )}`,
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

  const classify = db.prepare(
    `SELECT e.finish_position, e.position_text, e.grid, e.grid_text, e.laps_completed,
            e.points, e.status, e.classified, e.fastest_lap, e.driver_id, e.constructor_id,
            d.full_name AS driver, c.name AS team
       FROM race_entries e
       LEFT JOIN drivers d ON d.id = e.driver_id
       LEFT JOIN constructors c ON c.id = e.constructor_id
      WHERE e.race_id = ?
      ORDER BY (e.finish_position IS NULL), e.finish_position, e.grid`,
  )

  for (const r of races) {
    const entries = classify.all(r.id)
    const scheduled = r.status === 'scheduled'
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
                ['Confidence', text(r.confidence)],
              ]),
        ])}
        ${prose(r.note)}
        ${disagree(disagreements.all(`${r.year} round ${r.round}`), 'this race')}
        ${
          entries.length
            ? `<h2>Classification</h2>${table(
                ['Pos', 'Driver', 'Constructor', 'Grid', 'Laps', 'Points', 'Status'],
                entries.map((e) => [
                  esc(e.position_text ?? (e.finish_position ?? '—')),
                  driver(e.driver_id, e.driver),
                  team(e.constructor_id, e.team),
                  esc(e.grid_text ?? (e.grid ?? '—')),
                  num(e.laps_completed),
                  num(e.points),
                  `${finished(e.status, e.finish_position) ? 'Finished' : text(e.status)}${e.fastest_lap ? ' · fastest lap' : ''}`,
                ]),
              )}`
            : scheduled
              ? '<p>This race has not been run. The classification will appear here once it has.</p>'
              : ''
        }`,
    })
  }
}

// ---------------------------------------------------------------- drivers

{
  const drivers = all(`SELECT * FROM drivers ORDER BY titles DESC, wins DESC, full_name`)
  // Joined on full_name, which is what discrepancies.subject holds for a career
  // figure. verify.py refuses a subject shape that resolves to nothing, so a
  // silent empty join cannot survive a build.
  const careerDisagreements = db.prepare(
    `SELECT d.field, d.assessment,
            COALESCE(s.full_name, d.stored_value)  AS stored_value,
            COALESCE(v.full_name, d.derived_value) AS derived_value
       FROM discrepancies d
       LEFT JOIN drivers s ON s.id = d.stored_value
       LEFT JOIN drivers v ON v.id = d.derived_value
      WHERE d.subject = ? AND d.status LIKE 'open%'
      ORDER BY d.id`,
  )
  const teams = Object.fromEntries(all('SELECT id, name FROM constructors').map((c) => [c.id, c.name]))

  page({
    path: 'drivers',
    title: titled('Every driver, 1950–2026'),
    description: `All ${drivers.length} drivers in the register, with titles, wins, poles, podiums and career points counted from the race records.`,
    trail: [['', 'Home'], ['drivers', 'Drivers']],
    body: `
      <h1>Drivers</h1>
      <p class="lede">${drivers.length} drivers. Career totals are counted from the race records
        wherever the records support it; an em dash means nobody has established that figure.</p>
      ${table(
        ['Driver', 'Nationality', 'Seasons', 'Starts', 'Wins', 'Poles', 'Podiums', 'Titles'],
        drivers.map((d) => [
          link(`drivers/${d.id}`, d.full_name),
          text(d.nationality),
          `${d.first_season ?? '?'}–${d.last_season ?? 'present'}`,
          num(d.starts),
          num(d.wins),
          num(d.poles),
          num(d.podiums),
          num(d.titles),
        ]),
      )}`,
  })

  const winsOf = db.prepare(
    `SELECT rr.year, rr.round, rr.gp_name, rr.constructor_id, rr.constructor
       FROM race_results rr WHERE rr.winner_id = ? ORDER BY rr.year, rr.round`,
  )
  const seasonsOf = db.prepare(
    `SELECT r.year,
            COUNT(*) AS starts,
            SUM(COALESCE(e.points, 0)) AS points,
            GROUP_CONCAT(DISTINCT c.name) AS teams
       FROM race_entries e
       JOIN races r ON r.id = e.race_id
       LEFT JOIN constructors c ON c.id = e.constructor_id
      WHERE e.driver_id = ? GROUP BY r.year ORDER BY r.year`,
  )

  for (const d of drivers) {
    const wins = winsOf.all(d.id)
    const seasons = seasonsOf.all(d.id)
    const summary = [
      d.titles ? `${d.titles} world ${d.titles === 1 ? 'title' : 'titles'}` : null,
      d.wins !== null ? `${d.wins} wins` : null,
      d.poles !== null ? `${d.poles} poles` : null,
      d.starts !== null ? `${d.starts} starts` : null,
    ].filter(Boolean)

    page({
      path: `drivers/${d.id}`,
      title: titled(d.full_name),
      description: summarise(
        `${d.full_name}${d.nationality ? `, ${d.nationality}` : ''}${
          d.first_season ? `, Formula One ${d.first_season}–${d.last_season ?? 'present'}` : ''
        }. ${summary.join(', ')}${summary.length ? '. ' : ''}${d.notes ?? ''}`,
        300,
      ),
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
        ${facts([
          ['Nationality', text(d.nationality)],
          ['Born', text(d.born)],
          ['Died', d.died ? text(d.died) : null],
          ['Seasons', `${d.first_season ?? '?'}–${d.last_season ?? 'present'}`],
          ['Entries', num(d.entries)],
          ['Starts', num(d.starts)],
          ['Wins', num(d.wins)],
          ['Podiums', num(d.podiums)],
          ['Poles', num(d.poles)],
          ['Fastest laps', num(d.fastest_laps)],
          ['Career points', num(d.career_points)],
          ['Titles', d.titles ? `${d.titles} (${yearList(d.title_years)})` : num(d.titles)],
          ['Status', text(d.status)],
          ['Confidence', text(d.confidence)],
        ])}
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
            ? `<h2>Seasons</h2>${table(
                ['Season', 'Starts', 'Points', 'Team'],
                seasons.map((s) => [
                  link(`seasons/${s.year}`, s.year),
                  String(s.starts),
                  num(s.points),
                  text(s.teams),
                ]),
              )}`
            : ''
        }`,
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
      ${table(
        ['Constructor', 'Country', 'Entered', 'Entries', 'Wins', 'Poles', "Constructors' titles"],
        constructors.map((c) => [
          link(`constructors/${c.id}`, c.name),
          text(c.country),
          `${c.first_entry ?? '?'}–${c.last_entry ?? 'present'}`,
          num(c.entries),
          num(c.wins),
          num(c.poles),
          num(c.constructors_titles),
        ]),
      )}`,
  })

  const winsOf = db.prepare(
    `SELECT rr.year, rr.round, rr.gp_name, rr.winner_id, rr.winner FROM race_results rr
      WHERE rr.constructor_id = ? ORDER BY rr.year, rr.round`,
  )

  // A constructor's open disagreements, by its name - the driver page's
  // careerDisagreements is scoped to that section, so this is the same
  // statement for this one.
  const teamDisagreements = db.prepare(
    `SELECT d.field, d.assessment,
            COALESCE(s.full_name, d.stored_value)  AS stored_value,
            COALESCE(v.full_name, d.derived_value) AS derived_value
       FROM discrepancies d
       LEFT JOIN drivers s ON s.id = d.stored_value
       LEFT JOIN drivers v ON v.id = d.derived_value
      WHERE d.subject = ? AND d.status LIKE 'open%'
      ORDER BY d.id`,
  )
  for (const c of constructors) {
    const wins = winsOf.all(c.id)
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
          ['Confidence', text(c.confidence)],
        ])}
        ${prose(c.notes)}
        ${disagree(teamDisagreements.all(c.name), 'this team')}
        ${
          wins.length
            ? `<h2>Wins</h2>${table(
                ['Season', 'Grand Prix', 'Driver'],
                wins.map((w) => [
                  link(`seasons/${w.year}`, w.year),
                  link(`races/${w.year}/${w.round}`, w.gp_name),
                  w.winner_id ? link(`drivers/${w.winner_id}`, w.winner) : text(w.winner),
                ]),
              )}`
            : ''
        }`,
    })
  }
}

// --------------------------------------------------------------- circuits

{
  const circuits = all(`SELECT * FROM circuits ORDER BY gp_count DESC, name`)

  page({
    path: 'circuits',
    title: titled('Every circuit, 1950–2026'),
    description: `All ${circuits.length} circuits that have held a championship Grand Prix, with length, turns, location and the races held there.`,
    trail: [['', 'Home'], ['circuits', 'Circuits']],
    body: `
      <h1>Circuits</h1>
      <p class="lede">${circuits.length} circuits that have held a championship Grand Prix.</p>
      ${table(
        ['Circuit', 'Location', 'Country', 'Type', 'Length', 'Turns', 'Grands Prix'],
        circuits.map((c) => [
          link(`circuits/${c.id}`, c.name),
          text(c.locality),
          text(c.country),
          text(c.circuit_type),
          c.length_km === null ? '—' : `${c.length_km} km`,
          num(c.turns),
          num(c.gp_count),
        ]),
      )}`,
  })

  const racesAt = db.prepare(
    `SELECT r.year, r.round, r.name_used, rr.winner_id, rr.winner, rr.constructor_id, rr.constructor
       FROM races r LEFT JOIN race_results rr ON rr.year = r.year AND rr.round = r.round
      WHERE r.circuit_id = ? ORDER BY r.year, r.round`,
  )

  for (const c of circuits) {
    const races = racesAt.all(c.id)
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
          ['Grands Prix', num(c.gp_count)],
          ['First', c.first_gp ? link(`seasons/${c.first_gp}`, c.first_gp) : '—'],
          ['Last', c.last_gp ? link(`seasons/${c.last_gp}`, c.last_gp) : '—'],
          ['Confidence', text(c.confidence)],
        ])}
        ${prose(c.characteristics)}
        ${prose(c.notes)}
        ${
          races.length
            ? `<h2>Grands Prix held here</h2>${table(
                ['Season', 'Grand Prix', 'Winner', 'Constructor'],
                races.map((r) => [
                  link(`seasons/${r.year}`, r.year),
                  link(`races/${r.year}/${r.round}`, r.name_used),
                  r.winner_id ? link(`drivers/${r.winner_id}`, r.winner) : text(r.winner),
                  r.constructor_id ? link(`constructors/${r.constructor_id}`, r.constructor) : text(r.constructor),
                ]),
              )}`
            : ''
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
      ${table(
        ['Car', 'Constructor', 'Years', 'Engine', 'Races', 'Wins', 'Poles'],
        cars.map((c) => [
          link(`cars/${c.id}`, c.full_name ?? c.designation),
          c.constructor_id ? link(`constructors/${c.constructor_id}`, c.constructor_id) : '—',
          `${c.from_year ?? '?'}–${c.to_year ?? '?'}`,
          text(c.engine_name),
          num(c.races),
          num(c.wins),
          num(c.poles),
        ]),
        { caption: 'Landmark cars' },
      )}
      <h2>The chassis register</h2>
      <p>Every chassis that has started a championship Grand Prix, whether or not anybody
        has published a specification for it.</p>
      ${table(
        ['Chassis', 'Constructor', 'Years', 'Engine', 'Races', 'Wins'],
        chassis.map((ch) => [
          link(`cars/${ch.id}`, ch.full_name ?? ch.name),
          ch.constructor_id ? link(`constructors/${ch.constructor_id}`, ch.constructor ?? ch.constructor_id) : '—',
          ch.first_year === ch.last_year ? text(ch.first_year) : `${ch.first_year ?? '?'}–${ch.last_year ?? '?'}`,
          text(ch.engine_name),
          num(ch.races),
          num(ch.wins),
        ]),
        { caption: 'Chassis register' },
      )}`,
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
          ['Confidence', ch.confidence],
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

// -------------------------------------------------------------- reference

{
  const records = all(`SELECT * FROM records ORDER BY category, record`)
  page({
    path: 'records',
    title: titled('Records'),
    description: `${records.length} Formula One records, each with the figure this database derives and the source it is checked against.`,
    trail: [['', 'Home'], ['records', 'Records']],
    body: `
      <h1>Records</h1>
      <p class="lede">Each figure here is derived from the race records and checked against the
        published one.</p>
      ${table(
        ['Category', 'Record', 'Holder', 'Value', 'As of'],
        records.map((r) => [esc(r.category), esc(r.record), text(r.holder), num(r.value), text(r.as_of)]),
      )}`,
  })

  const eras = all(`SELECT * FROM eras ORDER BY from_year`)
  page({
    path: 'reference/eras',
    title: titled('Eras'),
    description: 'Formula One divided into eras, with the dominant teams and defining features of each.',
    trail: [['', 'Home'], ['reference', 'Reference'], ['reference/eras', 'Eras']],
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
    trail: [['', 'Home'], ['reference', 'Reference'], ['reference/glossary', 'Glossary']],
    body: `
      <h1>Glossary</h1>
      <dl class="glossary">${glossary
        .map((g) => `<dt>${esc(g.term)}</dt><dd>${esc(g.definition)}</dd>`)
        .join('')}</dl>`,
  })

  const sources = all(`SELECT * FROM source_registry ORDER BY id`)
  page({
    path: 'reference/sources',
    title: titled('Sources'),
    description:
      'Every source this database draws on, what it is trusted for, its licence, and how its claims are cross-checked.',
    trail: [['', 'Home'], ['reference', 'Reference'], ['reference/sources', 'Sources']],
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

  page({
    path: 'reference',
    title: titled('Reference'),
    description:
      'Eras, glossary, sources, data quality and a SQL console — the apparatus behind the figures.',
    trail: [['', 'Home'], ['reference', 'Reference']],
    body: `
      <h1>Reference</h1>
      <ul class="cards">
        <li>${link('reference/eras', 'Eras')} — Formula One divided into periods.</li>
        <li>${link('reference/glossary', 'Glossary')} — the vocabulary.</li>
        <li>${link('reference/sources', 'Sources')} — where every figure comes from.</li>
        <li>${link('reference/quality', 'Data quality')} — what is verified, what is not, what is missing.</li>
        <li>${link('reference/sql', 'SQL console')} — ask the database yourself.</li>
      </ul>`,
  })

  const gaps = all(`SELECT * FROM known_gaps ORDER BY id`)
  page({
    path: 'reference/quality',
    title: titled('Data quality'),
    description:
      'The confidence model, the open discrepancies and every known gap — what this database does not know, stated rather than hidden.',
    trail: [['', 'Home'], ['reference', 'Reference'], ['reference/quality', 'Data quality']],
    body: `
      <h1>Data quality</h1>
      <p class="lede">A blank in this database is an unestablished fact, never a zero. These are
        the gaps that are known and stated.</p>
      <h2>Known gaps</h2>
      ${gaps
        .map(
          (g) => `<section><h3>${esc(g.field)} — ${esc(g.area)}</h3>${prose(g.description)}${prose(g.resolution)}</section>`,
        )
        .join('')}`,
  })

  page({
    path: 'reference/sql',
    title: titled('SQL console'),
    description:
      'Run your own SQL against the whole database in your browser. Nothing is sent anywhere; the query runs in this tab.',
    trail: [['', 'Home'], ['reference', 'Reference'], ['reference/sql', 'SQL console']],
    body: `
      <h1>SQL console</h1>
      <p class="lede">The console needs JavaScript: it runs SQLite compiled to WebAssembly against
        the database file in your own browser. Nothing you type is sent anywhere.</p>
      <p>The database is a plain SQLite file. If you would rather query it with your own tools,
        download <a href="${esc(href('f1.db'))}"><code>f1.db</code></a> and open it with any
        SQLite client. The circuit centrelines are not in it — <code>circuit_geometry</code>
        there is deliberately empty — and ship beside it as
        <a href="${esc(href('f1-geometry.db'))}"><code>f1-geometry.db</code></a>. Two files
        rather than one because distributing them together keeps them a collective database:
        merging them would pull 117,000 unrelated rows under the centrelines' share-alike
        licence. Take both, or you have no geometry and no way to get it.</p>`,
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
console.log(`  dist/sitemap.xml, dist/robots.txt, dist/404.html`)
console.log(`  origin ${ORIGIN}${BASE}`)
