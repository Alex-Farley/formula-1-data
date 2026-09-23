#!/usr/bin/env node
/**
 * Drive the built site in a real browser and check what it renders against the
 * database it renders from.
 *
 * WHY THE EXPECTATIONS COME OUT OF f1.db
 *     Hard-coding "the drivers page shows 862 rows" fails the day someone adds
 *     a driver, and a test that cries wolf gets deleted. Every number below is
 *     read from the same database the page is querying, so the test asserts
 *     that the page and the database agree — which stays true as the data grows
 *     and false when the page breaks.
 *
 * WHY IT EXISTS AT ALL
 *     `npm run build` proves the JavaScript compiles. It cannot tell you that
 *     the worker started, that 20 MB of gzip decompressed, that SQLite
 *     instantiated, that a query returned, or that a chart drew anything. All
 *     of those fail silently at build time and blankly in a browser.
 *
 * USE
 *     npm run build && npm test
 *     node test/smoke.mjs --only /drivers      one page's sections (a substring
 *                                              of the heading; repeatable)
 *     node test/smoke.mjs --quiet              failures and the summary only
 *     node test/smoke.mjs --list               the section headings
 *     npm run test:page -- /races              the two above, for one page
 *     CHROME_PATH=/path/to/chrome npm test    reuse a browser you already have
 *
 * WHY THE SECTIONS ARE SELECTABLE
 *     The whole run is about fifteen seconds and 470 lines. Neither is much,
 *     until an agent runs it after every edit to one page and reads all of it
 *     back: then it is the most expensive thing in the loop, and it says
 *     nothing about the page that changed that the rest does not drown. Boot
 *     always runs — it loads the app — and Console always runs, because it
 *     reports what the selected sections logged. A passing subset is not a
 *     passing site, and the summary says so.
 *
 * The whole app is loaded ONCE and then navigated through its own router: a
 * page.goto per route would re-download the database and re-instantiate the
 * wasm every time. The preview server is spawned detached and killed as a
 * process group, so a cancelled run does not leak a server holding the port.
 */
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join, relative } from 'node:path'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { CHASSIS_NOTE, OUT_NOTE, RACE_SOURCES } from '../src/queries/race.js'
import { CURRENT_SEASON_SQL } from '../src/lib/season.js'
import { fileURLToPath } from 'node:url'
// The heading rule and the cell marks both renderers share, so the checks
// below ask for the strings the pages compute rather than copies of them.
import { NEXT_HEADING, NEXT_ROUND, WON_HERE, WON_HERE_HEADING, standingsHeading, titleHeading } from '../src/queries/season.js'
import { CAREER_HEADING, DRIVER_SOURCES, THIS_SEASON, roundsRun, thisSeasonHeading } from '../src/queries/driver.js'
import { ABOUT, DOCUMENTS, MAINTAINER, NOT_YET_RUN, PHOTOGRAPHS_SHOWN, SO_FAR, licenceTerms } from '../src/lib/site.js'
// The rule that decides who is credited and whether a file may be shown at
// all — asked of the served HTML below rather than restated in it.
import { attribution, canShow, fileTitle } from '../src/lib/commons.js'
import { ENTRIES as CAR_ENTRIES, FIGURES_HEADING, IMAGES as CAR_IMAGES } from '../src/queries/car.js'
import { CHECKED_LABEL, LAST_CHECKED } from '../src/lib/refresh.js'
import { EXAMPLES } from '../src/lib/questions.js'
import { NO_DRAWING, NO_TIMELINE_ROW } from '../src/lib/outline.js'
// The three surfaces VD-33 gave the photographs to, read from the app's own
// queries so that the static pages are checked against what the app shows.
import { CONSTRUCTOR_IMAGES, RACE_IMAGES, SEASON_IMAGES } from '../src/queries/photographs.js'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..')
const PORT = 4179
const BASE = `http://localhost:${PORT}`

const argv = process.argv.slice(2)
const QUIET = argv.includes('--quiet') || argv.includes('-q')
const ONLY = argv.flatMap((a, i) => (a === '--only' && argv[i + 1] ? [argv[i + 1].toLowerCase()] : []))
if (argv.includes('--only') && ONLY.length === 0) {
  console.error('--only needs a pattern: a substring of a section heading. `--list` prints them.')
  process.exit(2)
}
if (argv.includes('--list')) {
  // The headings are string literals, so the file can list its own without
  // starting a server or a browser.
  const source = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  for (const m of source.matchAll(/^\s+await section\('((?:[^'\\]|\\.)*)'/gm)) console.log(m[1])
  process.exit(0)
}

if (!existsSync(join(web, 'dist', 'index.html'))) {
  console.error('\ndist/ is missing. Build it first:  npm run build\n')
  process.exit(1)
}

const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })

// The ODbL centrelines are not in f1.db — OpenStreetMap's share-alike and
// database right would reach the whole file, so build.py writes them to
// f1-geometry.db and the two ship side by side as a Collective Database. The
// app merges them in the browser; this attaches them so the test can ask the
// same questions of the same rows. See tools/geometry_overlay.py.
const geometryPath = join(web, '..', 'f1-geometry.db')
const hasGeometry = existsSync(geometryPath)
if (hasGeometry) db.exec(`ATTACH DATABASE '${geometryPath}' AS geo`)
const one = (sql, ...args) => Object.values(db.prepare(sql).get(...args))[0]
/* The season being RUN, which since the 2027 calendar landed is no longer
   MAX(year): a season announced and not started has no leader, no standings
   and no layouts, so every check below that means "the season in progress"
   has to ask for the latest season with a round already completed. */
const inProgress = () => one("SELECT MAX(year) FROM races WHERE status = 'completed'")
const count = (sql, ...args) => one(sql, ...args)

/* The five entities esc() in prerender.js writes, read back. Two sections now
   compare served HTML with what the database holds, and both have to undo the
   same escaping — &amp; last, so an escaped ampersand is not decoded twice. */
const unescaped = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

const failures = []
let passed = 0
let skipped = 0
let matched = 0
let current = ''
const fail = (message) => {
  failures.push(`${current}: ${message}`)
  console.log(`  FAIL  ${QUIET ? `[${current}] ` : ''}${message}`)
}
const pass = (message) => {
  passed += 1
  if (!QUIET) console.log(`  ok    ${message}`)
}
// A sub-heading inside a section — a page the section reaches by a query
// rather than by name. Silent under --quiet, like the headings.
const note = (label) => {
  if (!QUIET) console.log(label)
}

/**
 * One named group of checks. Runs unless --only was given and no pattern
 * matches the heading; Boot and Console run regardless. An exception inside
 * a section is that section's failure, not the end of the run: the sections
 * after it still report, which is what a reader fixing several things at
 * once needs. A throw can leave the page mid-state — a viewport not
 * restored, a palette left open — and a later failure caused that way is
 * still worth seeing, because the throw is reported first.
 */
const ALWAYS = new Set(['Boot', 'Console'])
const section = async (label, run) => {
  if (ONLY.length && !ALWAYS.has(label) && !ONLY.some((p) => label.toLowerCase().includes(p))) {
    skipped += 1
    return
  }
  if (!ALWAYS.has(label)) matched += 1
  current = label
  if (!QUIET) console.log(label === 'Boot' ? label : `\n${label}`)
  try {
    await run()
  } catch (error) {
    fail(`threw: ${String(error.message ?? error).split('\n')[0]}`)
  }
}

const is = (actual, expected, what) => {
  if (actual === expected) pass(`${what} — ${actual}`)
  else fail(`${what}: page says ${actual}, database says ${expected}`)
}

const atLeast = (actual, floor, what) => {
  if (actual >= floor) pass(`${what} — ${actual}`)
  else fail(`${what}: got ${actual}, expected at least ${floor}`)
}

const truthy = (value, what) => {
  if (value) pass(what)
  else fail(what)
}

// --------------------------------------------------------------- the server

async function listening() {
  try {
    const response = await fetch(BASE, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

async function serve() {
  if (await listening()) {
    if (!QUIET) console.log(`Reusing the server already on ${BASE}\n`)
    return null
  }
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: web,
    detached: true,
    stdio: 'ignore',
  })
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    if (await listening()) {
      if (!QUIET) console.log(`Preview server on ${BASE}\n`)
      return server
    }
  }
  throw new Error('the preview server never came up')
}

// --------------------------------------------------- attribution, structurally
//
// The structural check — that every surface showing a Commons photograph
// imports the shared credit — read source files, not pages, so it never
// needed the browser. It moved to test/conventions.mjs on 2026-09-13, where
// `npm run test:units` runs it in a millisecond and a reviewer can run it
// alone. `npm test` still runs it first.

// -------------------------------------------------------------- the browser

const { chromium } = await import('playwright')

/**
 * Which browser to drive.
 *
 * Playwright's own download is the normal answer and needs nothing here. The
 * fallbacks are for a machine that already has a browser Playwright did not
 * install — CI runners with a shared browser cache, and containers that
 * pre-install one at PLAYWRIGHT_BROWSERS_PATH. Returning undefined lets
 * Playwright resolve its own.
 */
function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PLAYWRIGHT_BROWSERS_PATH && join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium'),
  ].filter(Boolean)
  return candidates.find((path) => existsSync(path))
}

const server = await serve()
let browser
const stop = () => {
  if (server?.pid) {
    try {
      process.kill(-server.pid)
    } catch {
      /* already gone */
    }
  }
}
process.on('exit', stop)
process.on('SIGINT', () => {
  stop()
  process.exit(130)
})

try {
    browser = await chromium.launch({ executablePath: chromePath() })
    // An explicit context, not browser.newPage(): the shortcut owns its context,
  // and @axe-core/playwright opens a page in the same context to run in, which
  // Playwright refuses on an owned one ("Please use browser.newContext()").
  // The clipboard is granted because IX-26 put a copy button under every
  // table, and the only check worth making of a copy button is what landed on
  // the clipboard. Chromium refuses navigator.clipboard to a page that has
  // never been granted it, headless or not.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await context.newPage()

    const consoleErrors = []
    // What counts as the site's error, in one place. A photograph Commons
    // declined, or any transport failure, is not something this test can hold
    // the site to - the Console section has said so for as long as it has
    // existed, and the Shapes loop below has to agree with it or the two read
    // the same run differently. They did: behind an HTTPS-intercepting proxy
    // every Commons request fails certificate validation, Console stayed green
    // because it filters them, and Shapes went red on whichever route happened
    // to ask for a portrait first.
    const siteError = (message) => !/commons\.wikimedia\.org|ERR_|net::/i.test(message)
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => consoleErrors.push(String(error)))

    /**
     * Wait until the page has finished answering its queries.
     *
     * A page renders its heading BEFORE its data arrives — that is deliberate, so
     * a reader gets the title immediately — which means `main h1` is not the
     * signal that a page is ready. The placeholders are. Then two frames, because
     * a component reused across a param change can satisfy both conditions on the
     * render still showing the previous route's data, and the assertions read the
     * DOM over a separate round trip.
     */
    const settle = async () => {
      await page.waitForFunction(
        // .is-empty is excluded deliberately: it means the query finished and
        // returned nothing, which is a settled page. Waiting for it to go is
        // waiting for something that never happens.
        () =>
          !document.querySelector('#root main .state:not(.is-empty), #root main .skeleton-table'),
        null,
        { timeout: 20000 },
      )
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
    }

    /**
     * Navigate through the app's own router and wait for the new page.
     *
     * pushState plus a popstate event, because the router is a BrowserRouter now
     * and there is no hash to assign to. A page.goto would work too and would be
     * closer to a real visit, but it would re-download the database and
     * re-instantiate SQLite on every route, which is the whole reason this test
     * navigates in-app instead.
     */
    /**
     * The stat strip as it is laid out, for VD-28's three rules: a label
     * never wraps, the figures share a baseline, and one or two lead.
     *
     * Read from the rendered box rather than from the stylesheet - the defect
     * was a layout, not a declaration, and a rule that is written but loses to
     * another would pass a test that only read the CSS.
     */
    const statStrip = async () =>
      page.$eval('#root main .stats', (dl) => {
        const tiles = [...dl.querySelectorAll(':scope > div')].map((el) => {
          const dt = el.querySelector('dt')
          const dd = el.querySelector('dd')
          const style = getComputedStyle(dd)
          return {
            label: dt.textContent,
            lead: el.hasAttribute('data-lead'),
            kind: el.dataset.kind ?? null,
            size: parseFloat(style.fontSize),
            family: style.fontFamily,
            lines: Math.round(dt.getBoundingClientRect().height / parseFloat(getComputedStyle(dt).lineHeight)),
            row: Math.round(el.getBoundingClientRect().top),
            ddTop: Math.round(dd.getBoundingClientRect().top),
          }
        })
        // A strip wide enough for every tile has one row; a narrower one
        // wraps, which is not a defect. The claim is per row: no figure sits
        // below the figures beside it.
        const rows = new Map()
        for (const tile of tiles) rows.set(tile.row, [...(rows.get(tile.row) ?? []), tile])
        return {
          wrapped: tiles.filter((t) => t.lines > 1).map((t) => t.label),
          misalignedRows: [...rows.values()]
            .filter((row) => new Set(row.map((t) => t.ddTop)).size > 1)
            .map((row) => row.map((t) => t.label).join(', ')),
          lead: tiles.filter((t) => t.lead),
          rest: tiles.filter((t) => !t.lead),
          names: tiles.filter((t) => t.kind === 'name'),
          figures: tiles.filter((t) => t.kind !== 'name'),
        }
      })

    const go = async (route, heading) => {
      // <main> is a stable node — only what Routes renders inside it changes — so
      // "an h2 exists" is still true of the page being NAVIGATED AWAY FROM, and
      // settle() then finds that old page perfectly settled. Callers that pass a
      // heading discriminate old from new by its text; the shape loop passes none
      // and had nothing to wait for, so an assertion could run against a DOM
      // mid-transition and count zero blocks. It held locally and broke on CI,
      // where a slower machine widens the window.
      //
      // Route elements are different component types, so React unmounts the old
      // subtree rather than reusing it: the old h2 leaves the document. Waiting
      // for that is a signal that needs no knowledge of the new page.
      // Two routes onto the SAME component (/seasons/1950 -> /seasons/2026) keep
      // the node and change its text; two onto different components replace it.
      // Either is proof the new route rendered. Best-effort: a page that
      // legitimately repeats the outgoing heading falls through to the waits
      // below, which is exactly the old behaviour rather than a hang.
      const outgoing = await page.$('#root main h1')
      const was = outgoing ? await outgoing.textContent() : null
      const samePage = await page.evaluate((to) => window.location.pathname === to, route)
      await page.evaluate((to) => {
        window.history.pushState({}, '', to)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, route)
      if (outgoing && !samePage) {
        await page
          .waitForFunction(
            ({ node, text }) => !node.isConnected || node.textContent !== text,
            { node: outgoing, text: was },
            { timeout: 10000 },
          )
          .catch(() => {})
      }
      await page.waitForFunction(
        (expected) => {
          const h1 = document.querySelector('#root main h1')
          return h1 && (!expected || h1.textContent.includes(expected))
        },
        heading,
        { timeout: 20000 },
      )
      await settle()
    }

    /**
     * Open the search palette with the key that opens it, and prove it opened.
     *
     * The key is Ctrl+K; App.jsx takes Cmd as well, and a bare `/` no longer
     * opens it at all (AX-15). One press is only reliable from a settled page:
     * the palette closes itself on a route change (AF-60), so a press made
     * while the previous navigation is still committing either lands in a
     * dying palette's own input or opens one the route change immediately
     * closes, and the wait spends its whole timeout on an element that will
     * never appear. That is what failed once in CI and
     * passed on a re-run of the same commit (AF-61): nothing the site did
     * wrong, and a red build either way.
     *
     * So press from a page with no palette on it and focus outside any field,
     * give the press a second to produce one, and press again if it did not.
     * Raising the timeout instead would have made the flake rarer and slower;
     * this makes it a press that either opens the palette or says it could not.
     */
    const openPalette = async (target, timeout = 10000) => {
      await target.waitForFunction(
        () =>
          !document.querySelector('.palette') &&
          !/^(input|textarea|select)$/i.test(document.activeElement?.tagName ?? ''),
        null,
        { timeout },
      )
      const deadline = Date.now() + timeout
      for (let attempt = 1; ; attempt += 1) {
        await target.keyboard.press('Control+k')
        const opened = await target
          .waitForSelector('.palette input', { timeout: 1000 })
          .then(() => true)
          .catch(() => false)
        if (opened) {
          // A retry that succeeds is a press the app swallowed from a page
          // that was settled and had focus outside every field — the one case
          // this loop would otherwise absorb, and the shape of a real
          // regression rather than of the race it was written for. Said out
          // loud rather than through note(), which is silent under --quiet
          // and so silent in CI, which is where it would matter. It costs a
          // line that should never be printed.
          if (attempt > 1) console.log(`  NOTE  Ctrl+K opened the palette on attempt ${attempt}, not the first`)
          return
        }
        if (Date.now() >= deadline) throw new Error('Ctrl+K did not open the search palette')
      }
    }

    /**
     * The total each table on the page holds, in document order.
     *
     * Every chart carries a table of its own numbers, which is the point of the
     * charts but is not what any of these assertions are about — so those are
     * skipped and the indexes below count the page's real tables.
     */
    const tableRows = () =>
      page.$$eval('#root main .table-wrap', (nodes) =>
        nodes.filter((node) => !node.closest('figure.figure')).map((node) => Number(node.dataset.rows)),
      )

    const text = (selector) => page.$eval(selector, (node) => node.textContent.trim()).catch(() => null)

    // The rows of the table under the h2 that starts with `heading`, where a
    // page's tables are not in a fixed order: the season being run gains the
    // next round's two above its standings (PD-49), and an index into
    // tableRows() would silently count the wrong one.
    const rowsUnder = (heading) =>
      page.$$eval(
        '#root main h2',
        (nodes, heading) => {
          const h2 = nodes.find((node) => node.textContent.trim().startsWith(heading))
          const wrap = [...(h2?.closest('section')?.querySelectorAll('.table-wrap') ?? [])].find((n) => !n.closest('figure.figure'))
          return wrap ? Number(wrap.dataset.rows) : null
        },
        heading,
      )

  // ---------------------------------------------------------------- booting

  await section('Boot', async () => {
    const started = Date.now()
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root main h1', { timeout: 60000 })
    // The handover moves focus to the new page's heading, so a screen reader
    // learns the document changed; it used to land on <body>.
    const focused = await page
      .waitForFunction(() => document.activeElement === document.querySelector('#root main h1'), null, { timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    truthy(focused, 'the heading takes focus at handover')
    await settle()
    pass(`database opened and the first page rendered in ${Date.now() - started} ms`)

    const version = await text('#root .sitefoot dd')
    is(version, `v${one('SELECT value FROM meta WHERE key = ?', 'version')}`, 'footer reports the database version')

  })

  // -------------------------------------------------------------- landing

  /**
   * Where a reader lands, in the three moments that decide it: the offset the
   * handover puts back, the focus a client-side navigation moves, and the way
   * into the content that skips the header.
   *
   * A fresh page is a fresh IndexedDB, so the database is fetched again and
   * the handover window is wide enough to read inside. The init script holds
   * the reader at y = 1500 for exactly as long as the static page is there and
   * lets go the instant it is removed - a reader who scrolled once and then
   * stopped, without this test having to guess when 'ready' arrives.
   */
  await section('Landing  (the offset, the focus and the skip link)', async () => {
    /*
     * A page of its own for each arrival: an empty IndexedDB means the
     * database is fetched again, which is what makes the handover window wide
     * enough to read inside. Brought to the front and held with a timer rather
     * than requestAnimationFrame — a background tab's frames are paused, and a
     * hold that never runs reads as a reader who never scrolled, which is this
     * test passing itself.
     */
    const fresh = async (route) => {
      const target = await browser.newPage({ viewport: { width: 1280, height: 900 } })
      await target.bringToFront()
      await target.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
      return target
    }
    const holdScroll = (target) =>
      target.addInitScript(() => {
        // `seen` because this starts before the document has been parsed: the
        // first tick can run while #prerendered does not exist YET, and a hold
        // that stops there is a reader who never scrolled - which reads as a
        // pass on the machine where the static page survives longest and a
        // failure on the one where it does not. It stops when the page it was
        // holding has gone, never before it has arrived.
        let seen = false
        window.__heldTo = 0
        // Every heading the static page carried, in order. A click on it
        // before the database opens fetches the asked-for page's prerendered
        // half and puts it there (IX-37), and the whole thing is gone the
        // moment the database is ready - so what it showed in between is
        // recorded as it happens rather than caught in flight.
        window.__staticHeadings = []
        const id = setInterval(() => {
          const pre = document.getElementById('prerendered')
          if (pre) {
            seen = true
            const heading = pre.querySelector('h1')?.textContent?.trim()
            if (heading && window.__staticHeadings.at(-1) !== heading) {
              window.__staticHeadings.push(heading)
            }
            window.scrollTo(0, 1500)
            window.__heldTo = Math.max(window.__heldTo, window.scrollY)
          } else if (seen) {
            clearInterval(id)
          }
        }, 16)
      })
    // What the hold actually achieved, so neither assertion below can pass by
    // never having scrolled in the first place.
    const wasHeld = async (target, where) =>
      atLeast(await target.evaluate(() => window.__heldTo), 1000, `the static ${where} was read down before the database opened`)
    // handOver() restores two frames after the removal. A settled read, not a
    // poll: polling accepts a value that something later undoes, which is the
    // whole failure being tested for.
    const settled = (target) => target.waitForTimeout(1500)

    const held = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await holdScroll(held)
    await held.bringToFront()
    await held.goto(`${BASE}/circuits/monza`, { waitUntil: 'domcontentloaded' })
    await held.waitForSelector('#root main h1', { timeout: 60000 })
    await held.waitForFunction(() => !document.getElementById('prerendered'), null, { timeout: 60000 })
    await settled(held)
    await wasHeld(held, 'circuit page')
    atLeast(
      await held.evaluate(() => window.scrollY),
      1000,
      'the handover leaves the reader where they were reading, not at the top of the page',
    )

    // /circuits renders a different component from /circuits/monza, so React
    // unmounts Page and mounts a new one. That is the navigation a per-instance
    // guard could not tell from the arrival, and it is every navigation out of
    // an index.
    await held.evaluate(() => {
      window.history.pushState({}, '', '/circuits')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await held.waitForFunction(
      () => document.querySelector('#root main h1')?.textContent.includes('Circuits'),
      null,
      { timeout: 20000 },
    )
    truthy(
      await held
        .waitForFunction(() => document.activeElement === document.querySelector('#root main h1'), null, {
          timeout: 5000,
        })
        .then(() => true)
        .catch(() => false),
      'an in-app navigation moves focus to the new page\'s heading, not to <body>',
    )

    // Document order rather than a Tab press: the handover and every
    // navigation leave focus on the h1, so Tab from there runs FORWARD out of
    // the heading and never reaches a link that sits above it. What has to be
    // true is that a reader at the top of the document meets this first.
    is(
      await held.evaluate(
        () =>
          document.querySelector(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          )?.className ?? '',
      ),
      'skiplink',
      'the skip link is the first focusable thing in the document, before the wordmark',
    )
    await held.evaluate(() => document.querySelector('.skiplink').focus())
    truthy(
      await held.evaluate(() => {
        const box = document.querySelector('.skiplink').getBoundingClientRect()
        return box.width > 40 && box.height > 20 && box.top >= 0 && box.bottom < window.innerHeight
      }),
      'and is drawn on screen once it has focus, rather than staying hidden where it cannot be used',
    )
    await held.keyboard.press('Enter')
    truthy(
      await held.evaluate(() => document.activeElement === document.querySelector('#root main')),
      'and taking it puts focus inside <main>, past the eleven header stops',
    )

    // A route change that commits UNDER an open modal. Found by this suite:
    // the search palette is opened, the router catches up with a click made a
    // moment earlier, focus goes to the heading behind the palette -- and
    // Escape, pressed into the page, misses the dialog, which stays open over
    // a page nothing can click through to.
    //
    // The palette no longer survives that navigation to be stranded by it
    // (AF-60): a modal is about the page it was opened on. What still has to
    // hold is the half this found -- the reader is not left on <body> with the
    // page changed under them -- so both are asserted here.
    await openPalette(held)
    await held.evaluate(() => {
      window.history.pushState({}, '', '/drivers')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await held.waitForFunction(
      () => document.querySelector('#root main h1')?.textContent.includes('Drivers'),
      null,
      { timeout: 20000 },
    )
    truthy(
      await held
        .waitForFunction(() => !document.querySelector('.palette'), null, { timeout: 5000 })
        .then(() => true)
        .catch(() => false),
      'a route change closes the search palette, which described the page it was opened on',
    )
    truthy(
      await held
        .waitForFunction(
          () => document.activeElement === document.querySelector('#root main h1'),
          null,
          { timeout: 5000 },
        )
        .then(() => true)
        .catch(() => false),
      'and hands focus to the new heading rather than stranding it on <body>',
    )
    await held.close()

    /*
     * The same three things on the static page, which is the half a cold
     * arrival actually reads — and where main.jsx's holdLinks() turns a click
     * into a route change. A fragment link into the page the reader is
     * already on is not one: held, the skip link left focus on itself and put
     * "opening Skip to content" in the boot strip.
     */
    const cold = await fresh('/circuits/monza')
    truthy(
      await cold.evaluate(() => {
        const link = document.querySelector('#prerendered .skiplink')
        if (!document.getElementById('prerendered') || !link) return false
        link.focus()
        return document.activeElement === link
      }),
      'the static page carries the skip link, and it takes focus before the database is ready',
    )
    await cold.keyboard.press('Enter')
    is(
      await cold.evaluate(() => {
        const main = document.querySelector('#prerendered main#main')
        if (document.activeElement === main) return true
        return `focus went to .${document.activeElement?.className || document.activeElement?.tagName}`
      }),
      true,
      'and taking it reaches the static page\'s own content rather than being held as a route change',
    )
    await cold.close()

    /*
     * The other arrival. A click on the static page before the database is
     * open moves the router on — and now moves the static page with it: the
     * asked-for page's own prerendered half is fetched and put on screen, so
     * the reader has the page they clicked in a few hundred milliseconds
     * rather than at the end of a twenty-megabyte download (IX-37). The
     * download itself is never restarted, which is what holding the click has
     * always been for.
     *
     * So the offset then belongs to the page they asked for, because that is
     * the page they are reading: handOver() takes its arrival from the static
     * page actually in the document rather than from the route the app booted
     * on. Before this, the click left the register up and the offset was
     * dropped — 1,500 px into the circuit register being nowhere in
     * particular on one circuit's page.
     */
    const clicked = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await holdScroll(clicked)
    await clicked.bringToFront()
    await clicked.goto(`${BASE}/circuits`, { waitUntil: 'domcontentloaded' })
    truthy(
      await clicked.evaluate(() => {
        const link = document.querySelector('#prerendered a[href="/circuits/monza"]')
        if (!document.getElementById('prerendered') || !link) return false
        link.click()
        return true
      }),
      'the static register is still there to click through before the database is ready',
    )
    await clicked.waitForFunction(
      () => document.querySelector('#root main h1')?.textContent.includes('Monza'),
      null,
      { timeout: 60000 },
    )
    await clicked.waitForFunction(() => !document.getElementById('prerendered'), null, { timeout: 60000 })
    await settled(clicked)
    await wasHeld(clicked, 'register')
    const headings = await clicked.evaluate(() => window.__staticHeadings)
    truthy(
      headings.some((heading) => heading.includes('Monza')),
      `and the page they asked for is on screen from its own prerendered half while the database is still coming — the static page read ${headings.join(' then ') || '(nothing)'}`,
    )
    atLeast(
      await clicked.evaluate(() => window.scrollY),
      1000,
      'and the handover leaves them where they were reading on it, rather than at its top',
    )
    await clicked.close()

    /*
     * And the rows themselves (IX-19). The static /drivers is every one of the
     * 862; the app pages the register at 150, so the handover used to end a
     * table the reader had scrolled into at row 150 and say nothing. What has
     * to hold is that the app opens on at least what the static page drew —
     * counted from the static table itself rather than from a number written
     * here, because the register grows.
     */
    const register = await fresh('/drivers')
    const staticRows = await register.evaluate(() => {
      const table = document.querySelector('#prerendered table')
      return table ? table.querySelectorAll('tbody tr').length : 0
    })
    atLeast(staticRows, 200, 'the static register draws its rows before the database opens')
    await register.waitForFunction(() => !document.getElementById('prerendered'), null, { timeout: 60000 })
    await register.waitForSelector('#root main .table-wrap', { timeout: 20000 })
    const appShown = await register.evaluate(
      () => Number(document.querySelector('#root main .table-wrap')?.dataset.shown),
    )
    atLeast(
      appShown,
      staticRows,
      `the app takes over without deleting rows — ${appShown} drawn where the static page drew ${staticRows}`,
    )
    await register.close()

    /*
     * And the other half of it: the table still collapses, by the reader's
     * hand. /races is the one static table that is a declared leading slice -
     * its lede says the 200 most recently run - so a seeded /races opens on
     * 200 of its rows with "Show the remaining" under it for the rest. A
     * seeded table that had lost that button would have taken the reader's
     * way to the whole register with it.
     */
    const sliced = await fresh('/races')
    const slice = await sliced.evaluate(() => {
      const table = document.querySelector('#prerendered table')
      return table ? table.querySelectorAll('tbody tr').length : 0
    })
    await sliced.waitForFunction(() => !document.getElementById('prerendered'), null, { timeout: 60000 })
    await sliced.waitForSelector('#root main .table-wrap', { timeout: 20000 })
    const race = await sliced.evaluate(() => {
      const wrap = document.querySelector('#root main .table-wrap')
      return {
        total: Number(wrap?.dataset.rows),
        shown: Number(wrap?.dataset.shown),
        more: wrap?.querySelector('.table-foot button.more')?.textContent.trim() ?? '',
      }
    })
    is(race.shown, slice, `a static table that is a declared slice seeds that slice — ${slice} of ${race.total}`)
    truthy(
      race.more.startsWith('Show the remaining'),
      `and the rest is still the reader's to ask for — “${race.more}”`,
    )
    await sliced.close()

    /*
     * And the links that are not routes at all. /data links to /f1.db,
     * /f1-geometry.db, /f1-parquet.zip, /schema.sql and /db-manifest.json,
     * none of them with a `download` attribute — a static host's
     * Content-Disposition is its own. Held as a route change, such a click
     * moved the address bar and fetched nothing; held and then served from
     * the prerendered page, /f1.db is twenty-three megabytes pulled alongside
     * the download the hold exists to protect, and parsed as HTML.
     */
    const fileLink = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    // Answered here rather than served, so the assertion costs a request and
    // not twenty-three megabytes. What it reads is how the request was made:
    // a navigation the browser owns is a `document` request, and the hold
    // fetching a page to swap in is a `fetch` one.
    const askedFor = []
    await fileLink.route('**/f1.db', (route) => {
      askedFor.push(route.request().resourceType())
      return route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: 'stands in for the database file',
      })
    })
    await fileLink.goto(`${BASE}/data`, { waitUntil: 'domcontentloaded' })
    truthy(
      await fileLink.evaluate(() => {
        const link = document.querySelector('#prerendered a[href="/f1.db"]')
        if (!link || !document.getElementById('prerendered')) return false
        link.click()
        return true
      }),
      'the static data page offers the database file before the database is open',
    )
    await fileLink.waitForTimeout(500)
    is(
      askedFor.join(', ') || '(no request)',
      'document',
      'and a click on it is the browser downloading a file, not the boot window fetching a page',
    )
    is(
      await fileLink.evaluate(() => location.pathname),
      '/data',
      'and the reader is left on the page they were reading',
    )
    await fileLink.close()

    // And the file links with no extension to give them away, on a page of
    // their own so the first click's download cannot have taken the static
    // page with it. Answered as the host answers this one — text/plain, which
    // the browser renders rather than saves.
    const plainFile = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const askedPlain = []
    await plainFile.route('**/SHA256SUMS', (route) => {
      askedPlain.push(route.request().resourceType())
      return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: 'a digest' })
    })
    await plainFile.goto(`${BASE}/data`, { waitUntil: 'domcontentloaded' })
    truthy(
      await plainFile.evaluate(() => {
        const link = document.querySelector('#prerendered a[href="/SHA256SUMS"]')
        if (!link) return false
        link.click()
        return true
      }),
      'the static data page offers SHA256SUMS, which has no extension to give it away',
    )
    await plainFile.waitForTimeout(500)
    is(
      askedPlain.join(', ') || '(no request)',
      'document',
      'and a click on it is the browser\'s as well, not a page fetched into the boot window',
    )
    await plainFile.close()

    // Every section after this one drives the shared page, which has been in
    // the background throughout.
    await page.bringToFront()
  })

  /**
   * The arrival where the database never comes at all.
   *
   * A blocked host, a captive portal, a file the deploy lost: the app cannot
   * open, and the 2,385 prerendered pages are the whole of what the reader
   * has. Holding a click then strands them for good — no router is coming to
   * render the route the address bar now names, so the URL read /records
   * while the heading still said Drivers, with no way out but a reload
   * nobody was told to attempt (IX-37). The anchors have to come back.
   *
   * And the console is the one page with no figures to fall back to, so the
   * strip cannot offer it the reassurance it offers everywhere else (CD-40).
   */
  await section('A database that never arrives  (the links come back)', async () => {
    const blocked = await browser.newContext()
    // The manifest still answers, so this is the download failing rather than
    // a site that was never deployed — the failure a reader actually meets.
    await blocked.route('**/f1.db*', (route) => route.abort())
    const stranded = await blocked.newPage()
    const failed = () =>
      stranded.waitForFunction(
        () => document.querySelector('.boot-strip .boot-phase')?.textContent.includes('could not be opened'),
        null,
        { timeout: 60000 },
      )

    await stranded.goto(`${BASE}/circuits`, { waitUntil: 'domcontentloaded' })
    await failed()
    truthy(
      await stranded.$eval('#prerendered', (node) => node.textContent.includes('Monza')),
      'the static register is still the page, with the figures from the last published build',
    )
    await stranded.click('#prerendered a[href="/circuits/monza"]')
    await stranded.waitForURL(`${BASE}/circuits/monza`, { timeout: 20000 })
    await failed()
    truthy(
      await stranded.evaluate(
        () =>
          location.pathname === '/circuits/monza' &&
          Boolean(document.querySelector('#prerendered h1')?.textContent.includes('Monza')),
      ),
      'and a click on it still navigates, so the address bar and the heading name the same page',
    )

    await stranded.goto(`${BASE}/data/sql`, { waitUntil: 'domcontentloaded' })
    await failed()
    const strip = await stranded.$eval('.boot-strip .boot-phase', (node) => node.textContent)
    truthy(
      strip.includes('nothing here to query') && !strip.includes('figures on this page'),
      `the console is not told its missing figures are from the last build — “${strip.trim()}”`,
    )
    truthy(
      !(await stranded.innerText('#prerendered')).includes('needs JavaScript'),
      'and is not told it needs JavaScript in a tab that is running it',
    )

    /*
     * And the other order: the click first, the failure after it. The
     * connection drops mid-thought, so the held route's own page cannot be
     * fetched either — and the reader is left standing on the register with
     * the address bar naming a circuit, no router coming to render it, and a
     * strip offering figures that belong to a page they cannot see. The
     * address bar goes back to the page on screen.
     */
    const stalled = await blocked.newPage()
    // A page route is answered before the context's, so the failure arrives
    // four seconds in - long enough to click inside - rather than at once.
    await stalled.route('**/f1.db*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000))
      await route.abort()
    })
    await stalled.route('**/circuits/monza', (route) => route.abort())
    await stalled.goto(`${BASE}/circuits`, { waitUntil: 'domcontentloaded' })
    await stalled.click('#prerendered a[href="/circuits/monza"]')
    await stalled.waitForFunction(() => location.pathname === '/circuits/monza', null, { timeout: 15000 })
    await stalled.waitForFunction(
      () => document.querySelector('.boot-strip .boot-phase')?.textContent.includes('could not be opened'),
      null,
      { timeout: 60000 },
    )
    await stalled.waitForTimeout(250)
    is(
      await stalled.evaluate(
        () => `${location.pathname} ${document.querySelector('#prerendered h1')?.textContent}`,
      ),
      '/circuits Circuits',
      'a click held before the failure leaves the address bar naming the page the reader can see',
    )
    truthy(
      !(await stalled.$eval('.boot-strip .boot-phase', (node) => node.textContent)).includes('opening'),
      'and the strip stops promising a page nothing is going to open',
    )
    await blocked.close()
  })

  // ------------------------------------------------------------------ home

  await section('/  (overview)', async () => {
    const racesRun = count("SELECT COUNT(*) FROM races WHERE status = 'completed'")
    const homeStats = await page.$$eval('#root main .stats dd', (nodes) => nodes.map((n) => n.textContent))
    truthy(
      homeStats.some((value) => value.includes(racesRun.toLocaleString('en-GB'))),
      `the overview leads with ${racesRun.toLocaleString('en-GB')} races run`,
    )

  })

  // --------------------------------------------------------------- seasons

  await section('/seasons', async () => {
    await go('/seasons', 'Seasons')
    is((await tableRows())[0], count('SELECT COUNT(*) FROM seasons'), 'every season is listed')

  })

  // One row per driver. The end-of-season rows hold two sources' descriptions
  // of 2026; the page reads v_standings_final, which folds them, and the
  // count here is the view's own, so the assertion and the page cannot drift.
  await section('/seasons/2026  (one row per driver in the final table)', async () => {
    await go('/seasons/2026', '2026')
    const finalRows = await page.$$eval('#root main table', (tables) => {
      const t = tables.find((el) => el.closest('section')?.querySelector('h2')?.textContent.toLowerCase().includes("drivers' standings"))
      return t ? t.querySelectorAll('tbody tr').length : -1
    })
    is(
      finalRows,
      count(`SELECT COUNT(*) FROM v_standings_final WHERE year = 2026 AND table_type = 'drivers'`),
      "the 2026 drivers' table is one row per driver",
    )
    // And the row that survived is the current one: the leader's points on the
    // page equal the LARGER of the two sources' totals for them, straight from
    // the table rather than the view, so a view that kept the stale row fails
    // here even though the count above would still be right.
    const leader = one(`SELECT entity_id FROM v_standings_final
                       WHERE year = 2026 AND table_type = 'drivers' ORDER BY position LIMIT 1`)
    const leaderPoints = await page.$$eval('#root main table', (tables) => {
      const t = tables.find((el) => el.closest('section')?.querySelector('h2')?.textContent.toLowerCase().includes("drivers' standings"))
      const cells = [...(t?.querySelector('tbody tr')?.querySelectorAll('td') ?? [])].map((c) => c.textContent.trim())
      return cells
    })
    const leaderExpected = String(one(`SELECT MAX(points) FROM standings
                                WHERE year = 2026 AND table_type = 'drivers' AND after_round IS NULL AND entity_id = ?`, leader))
    truthy(
      leaderPoints.some((c) => c.replace(/,/g, '') === leaderExpected || c.replace(/,/g, '') === leaderExpected.replace(/\.0$/, '')),
      `the leader's points are the current source's — ${leaderExpected}`,
    )

    /*
     * The reigning champion has a championship position. The 2025-26 rows are
     * hand-maintained from formula1.com and carry `position` with no
     * `position_text`; the tables rendered position_text alone, so every 2025
     * driver and constructor read as an em dash - under a footer saying the dash
     * means "excluded". The app was wrong and the static page was right, which
     * is the one direction PD-02 had never been seen in. Read the expectation
     * from the database, as everything here does.
     */
    // A constructor with an open disagreement shows it, in the app as the
    // static page does. The subject join is by name, resolved from the id in
    // SQL; a reworded query that stopped matching would return null silently,
    // and this is what would say so.
    const disputed = one(`SELECT c.id FROM constructors c JOIN discrepancies d ON d.subject = c.name
                         WHERE d.status LIKE 'open%' LIMIT 1`)
    if (disputed) {
      note(`\n/constructors/${disputed}  (an open disagreement is shown)`)
      await go(`/constructors/${disputed}`)
      truthy(
        (await page.$$('#root main aside.disagreement')).length > 0,
        'the constructor page shows its open disagreement',
      )
      // SD-04: an OPEN disagreement is the one place a reader most likely
      // knows something, so the aside itself asks - in both renderers, and
      // only when the row is open.
      atLeast(
        await page.$$eval('#root main aside.disagreement a[href*="/issues/new"]', (n) => n.length),
        1,
        'and asks the reader to settle it',
      )
      const staticDispute = await (await fetch(`${BASE}/constructors/${disputed}`)).text()
      const aside = staticDispute.slice(staticDispute.indexOf('<aside class="disagreement"'))
      truthy(
        aside.slice(0, aside.indexOf('</aside>')).includes('/issues/new'),
        'and the prerendered aside asks too',
      )
    }

  })

  /*
   * Who is in the cars (PD-38). The database has held `season_entries` and
   * `v_current_grid` all along and no page read either, so a reader could not
   * find out who drives car 12; the expectation is read from the entry list
   * itself, as everything here is.
   */
  await section('/seasons/2026  (who is in the cars)', async () => {
    const year = inProgress()
    await go(`/seasons/${year}`, String(year))
    const grid = await page.evaluate(() => {
      const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.startsWith('On the grid'))
      const table = h2?.closest('section')?.querySelector('table')
      return [...(table?.querySelectorAll('tbody tr') ?? [])].map((tr) =>
        [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
      )
    })
    is(
      grid.length,
      count('SELECT COUNT(*) FROM season_entries WHERE year = ?', year),
      `the grid is one row per entry declared for ${year}`,
    )
    // The cell is the site's em dash where the database has nothing, so the
    // expectation is read through the same rule: a NULL that lands on this
    // seat is the page being right, not the suite catching it out.
    const shown = (value) => (value === null || value === undefined || value === '' ? '\u2014' : String(value))
    const seat = db
      .prepare(`SELECT e.car_number, d.full_name AS driver, d.abbreviation, k.name AS team, e.car, e.power_unit
                  FROM season_entries e
                  LEFT JOIN drivers d      ON d.id = e.driver_id
                  LEFT JOIN constructors k ON k.id = e.constructor_id
                 WHERE e.year = ? AND e.role = 'race' AND e.car_number IS NOT NULL
                 ORDER BY e.car_number LIMIT 1`)
      .get(year)
    truthy(
      grid.some(
        (r) =>
          r[0] === String(seat.car_number) &&
          r[1] === shown(seat.driver) &&
          r[2] === shown(seat.abbreviation) &&
          r[3] === shown(seat.team) &&
          r[4] === shown(seat.car) &&
          r[5] === shown(seat.power_unit),
      ),
      `car ${seat.car_number} is ${seat.driver} (${seat.abbreviation}), ${seat.team} ${seat.car}, ${seat.power_unit}`,
    )
    // A reserve is a row and says so, which is the difference between the
    // entry list and a count of who has started.
    const reserve = one("SELECT COUNT(*) FROM season_entries WHERE year = ? AND role <> 'race'", year)
    if (reserve) {
      const role = one("SELECT role FROM season_entries WHERE year = ? AND role <> 'race' LIMIT 1", year)
      truthy(
        grid.some((r) => r[1].endsWith(role)),
        `a seat that is not a race seat carries the word “${role}”`,
      )
    } else pass('no reserve is declared this season, so there is no role to mark')
    const html = await (await fetch(`${BASE}/seasons/${year}`)).text()
    truthy(
      html.includes('On the grid') && html.includes(seat.driver) && html.includes(String(seat.car)),
      'the static season page carries the grid too',
    )

  })

  // The app's SQL page carries the download paragraph the static one does,
  // with both files named: the two renderers used to disagree about whether
  // the file could be had at all.
  await section('/data/sql  (the download paragraph, in the app)', async () => {
    await go('/data/sql', 'SQL console')
    const sqlPage = await page.content()
    truthy(
      sqlPage.includes('f1-geometry.db') && sqlPage.includes('sqlite_master'),
      'the app names both files and says the file documents itself',
    )

  })

  await section('/seasons/2025  (the champion is P1, not an em dash)', async () => {
    await go('/seasons/2025', '2025')
    const championPos = await page.evaluate(() => {
      const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.startsWith('Final drivers'))
      const block = h2?.closest('section') ?? h2?.parentElement
      return block?.querySelector('tbody tr td')?.textContent.trim() ?? null
    })
    is(
      championPos,
      String(one(`SELECT position FROM standings WHERE year = 2025 AND table_type = 'drivers'
                  AND after_round IS NULL ORDER BY points DESC LIMIT 1`)),
      "the 2025 champion's position is rendered",
    )

    /*
     * A season with no classified finish has zero wins, not an unestablished
     * number of them. SUM over such a season is NULL in SQLite, which rendered
     * as the em dash on 591 driver-seasons whose strip said WINS 0 forty pixels
     * above. Gabbiani (1981, Osella, never classified) is the representative.
     */
  })

  await section('/drivers/beppe-gabbiani  (a winless season reads 0, not an em dash)', async () => {
    await go('/drivers/beppe-gabbiani', 'Beppe Gabbiani')
    truthy(
      await page.waitForSelector('a.pill[href$="/data/quality"]', { timeout: 20000 }).catch(() => null),
      'the confidence pill is a link to the quality ladder',
    )
    const dashedWins = await page.evaluate(() => {
      const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.startsWith('Season by season'))
      const table = (h2?.closest('section') ?? h2?.parentElement)?.querySelector('table')
      const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
      const col = heads.indexOf('Wins')
      return [...table.querySelectorAll('tbody tr')].filter((tr) => tr.children[col]?.textContent.trim() === '—').length
    })
    is(dashedWins, 0, 'no season dashes a wins figure the page knows is zero')

    // VD-28: and the same zero does not LEAD the strip. Gabbiani's page is
    // one of the 625 that show four of them; setting the win he never had at
    // twice the size of the seventeen entries he did would point the emphasis
    // at an absence. With nothing to lead, the strip keeps one rank.
    const winless = await statStrip()
    is(winless.lead.length, 0, 'a winless strip leads with nothing')
    // The size, not just its uniformity: a regression that ranked a strip
    // with no lead and shrank every figure to the secondary 16px would
    // satisfy "they all match" while losing the rank this page should keep.
    is(
      [...new Set(winless.rest.map((t) => t.size))].join('/'),
      '25',
      'and so keeps the single display rank it always had',
    )

    // PD-15: and it no longer shows the four zeros at all. Gabbiani entered
    // 17 races, started 3 of them and retired from all 3 - which is the page
    // the strip now leads with, in place of WINS 0 PODIUMS 0 POLES 0 FL 0.
    // The figures are asserted, not just the labels: a strip that dropped the
    // four and put an em dash in every substitute would pass a label test.
    const tiles = await page.$eval('#root main .stats', (dl) =>
      Object.fromEntries(
        [...dl.querySelectorAll(':scope > div')].map((el) => [
          el.querySelector('dt').textContent.trim(),
          // <small> is the note; the figure is what precedes it.
          [...el.querySelector('dd').childNodes]
            .filter((n) => n.nodeName !== 'SMALL')
            .map((n) => n.textContent)
            .join('')
            .trim(),
        ]),
      ),
    )
    is(
      ['Wins', 'Podiums', 'Poles', 'Fastest laps'].filter((label) => label in tiles).join(', '),
      '',
      'a strip with nothing to report drops the four results figures rather than zeroing them',
    )
    is(tiles.Entries, '17', 'the entries stay')
    is(tiles.Starts, '3', 'and the starts say how few of them were races')
    is(tiles['Best grid'], 'P20', 'the best grid slot on record')
    is(tiles.Laps, '79', 'the laps he did complete')
    is(tiles.Retirements, '3', 'every start retired')
    is(tiles.Constructors, '2', 'two constructors')

    // ENTRIES_NOTE under "On the record" used to say that telling a start
    // from an entry needs a reason "no source here supplies", which the tile
    // forty pixels above now contradicts. It states the rule instead.
    const note = (await text('#root main .source-note')) ?? ''
    truthy(!note.includes('no source here supplies'), 'the note no longer denies the Starts tile above it')
    truthy(note.includes('did not qualify'), 'and says what the site counts as a start')

    // A PIT-LANE START IS NOT A MISSING GRID, checked through the real query
    // rather than a fixture, because the fixtures cannot reach the SQL. All
    // 97 of Marcus Ericsson's entries are starts and five of them began in
    // the pit lane, which carries no grid NUMBER but says exactly where the
    // car started in grid_text ('PL', 237 entries site-wide). Counting those
    // as gaps put "5 starts with no grid recorded" on his page and on 39
    // others, under a note two paragraphs below saying a pit-lane start
    // counts. schema.sql: "NULLing those would say we do not know where they
    // started, which is the opposite of the truth."
    await go('/drivers/marcus-ericsson', 'Marcus Ericsson')
    const pit = await page.$eval('#root main .stats', (dl) =>
      Object.fromEntries(
        [...dl.querySelectorAll(':scope > div')].map((el) => [
          el.querySelector('dt').textContent.trim(),
          el.querySelector('dd small')?.textContent.trim() ?? null,
        ]),
      ),
    )
    is(pit['Best grid'], null, 'a pit-lane start is not a grid slot nobody recorded')
    truthy(!('Starts' in pit), 'and all 97 entries were starts, so no Starts tile')

    await go('/drivers/beppe-gabbiani', 'Beppe Gabbiani')

    // The dropped zero is still ON THE PAGE, which is the condition on
    // dropping it from the strip: "Season by season" carries a Wins column
    // and every row of it reads 0 (the dashedWins check above), and "On the
    // record" states Wins derived and published.
    truthy(
      ((await text('#root main')) ?? '').includes('0 derived'),
      'and the zero it dropped is still stated under On the record',
    )

    /*
     * A declared oddity reaches the reader. The 2026 calendar says "Bahrain
     * (hosted at Sepang, Malaysia)" and the page showed a Bahrain Grand Prix at a
     * Malaysian circuit with no note, because that field was the one nothing
     * read. It is the race's note now, and the note is the lede.
     */
  })

  await section('/races/2026/16  (the Sepang note reaches the page)', async () => {
    await go('/races/2026/16', 'Bahrain Grand Prix')
    truthy(((await text('#root main .lede')) ?? '').includes('Sepang'), 'the calendar\'s explanation is the lede')
    // CD-03: and the static half opens on the note too, rather than on the
    // derived sentence that would say only where the round is scheduled.
    const written = one('SELECT note FROM races WHERE year = 2026 AND round = 16')
    const staticNote = (await (await fetch(`${BASE}/races/2026/16`)).text())
      .match(/<h1>[^<]*<\/h1>\s*<p class="lede">([^<]*)<\/p>/)?.[1]
      ?.replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
    is(staticNote, written, 'the static page does not overwrite the note with the derived sentence')
    // And says it once. The note was a bare paragraph below the timetable in
    // the static half and the lede in the app; the lede is the note in both
    // now, so a second copy would be the same words twice on one page.
    // As element text, so the meta description - which carries the note as
    // well as the derived sentence, on purpose - is not counted.
    const staticRaceHtml = await (await fetch(`${BASE}/races/2026/16`)).text()
    is(
      staticRaceHtml.split(`>${written}<`).length - 1,
      1,
      'and prints it once, not once as the lede and again below',
    )
    // AF-03: the race page draws the F1DB layout the round runs, named in
    // the drawing's accessible name, and the static page carries the same.
    const layout = one('SELECT f1db_layout_id FROM races WHERE year = 2026 AND round = 16')
    if (layout) {
      await page.waitForSelector('#root main svg.outline[role="img"]', { timeout: 20000 })
      truthy(
        (await page.$eval('#root main svg.outline[role="img"]', (n) => n.getAttribute('aria-label'))).includes(layout),
        `the race page draws F1DB layout ${layout}`,
      )
      const staticRace = await (await fetch(`${BASE}/races/2026/16`)).text()
      truthy(staticRace.includes(`F1DB layout ${layout}`) && staticRace.includes('Jules Roy'), 'the static race page draws and credits it')
    }

  })

  // AF-03: the season's calendar as a strip of outlines, one per round, in
  // the state the database gives it - run, next, to come - with exactly one
  // round marked next while any is still to run, in the app and the static
  // page alike.
  await section('/seasons/2026  (the calendar as outlines)', async () => {
    const year = inProgress()
    const rounds = count('SELECT COUNT(*) FROM races WHERE year = ?', year)
    const toRun = count("SELECT COUNT(*) FROM races WHERE year = ? AND status != 'completed'", year)
    await go(`/seasons/${year}`, String(year))
    await page.waitForSelector('#root main .outline-strip li', { timeout: 20000 })
    is(await page.$$eval('#root main .outline-strip li', (n) => n.length), rounds, `one outline per round of ${year}`)
    is(
      await page.$$eval('#root main .outline-strip li[data-state="next"]', (n) => n.length),
      toRun > 0 ? 1 : 0,
      toRun > 0 ? 'exactly one round is marked next' : 'a finished season marks no round next',
    )
    is(
      await page.$$eval('#root main .outline-strip li[data-state="run"]', (n) => n.length),
      rounds - toRun,
      'every completed round is marked run',
    )
    const staticSeason = await (await fetch(`${BASE}/seasons/${year}`)).text()
    is((staticSeason.match(/<li data-state="/g) ?? []).length, rounds, 'the static page carries the same strip')
    is((staticSeason.match(/<li data-state="next"/g) ?? []).length, toRun > 0 ? 1 : 0, 'and marks the same round next')
  })

  /*
   * PD-49: three pages that open on the season being run where the reader is
   * in it. The season page carries the next round and who won there before;
   * a driver of the season opens on a dot per round; this year's chassis
   * opens on its photograph. Each is checked in both halves, and each against
   * a page it must NOT appear on, because a section gated on the wrong year
   * shows up everywhere or nowhere and both read as a working page.
   */
  await section('/seasons, /drivers and /cars open on the season being run (PD-49)', async () => {
    const season = one("SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'current_season'")
    const flat = (html) => unescaped(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    const served = async (route) => (await (await fetch(`${BASE}${route}`)).text()).split('<div id="prerendered">')[1] ?? ''
    const staticHeadings = (html) => [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map((m) => flat(m[1]))
    const appHeadings = () =>
      page.$$eval('#root main h2', (nodes) => nodes.map((node) => node.textContent.replace(/\s+/g, ' ').trim()))
    // The body rows of the first table after an h2, in the served HTML.
    const staticRowsUnder = (html, heading) => {
      const from = html.indexOf(`<h2>${heading}</h2>`)
      if (from < 0) return null
      const start = html.indexOf('<tbody>', from)
      return (html.slice(start, html.indexOf('</tbody>', start)).match(/<tr>/g) ?? []).length
    }

    // The next round: the round the strip marks next, in both halves, and
    // only on the page of the season being run.
    const next = db.prepare(NEXT_ROUND).get(season)
    await go(`/seasons/${season}`, String(season))
    const seasonHtml = await served(`/seasons/${season}`)
    if (next) {
      truthy(
        (await appHeadings()).includes(NEXT_HEADING) && staticHeadings(seasonHtml).includes(NEXT_HEADING),
        `both halves of /seasons/${season} carry “${NEXT_HEADING}”`,
      )
      const named = await page.$$eval(
        '#root main h2',
        (nodes, heading) =>
          nodes.find((node) => node.textContent.trim() === heading)?.closest('section')?.querySelector('a[href*="/races/"]')?.getAttribute('href') ?? null,
        NEXT_HEADING,
      )
      const marked = await page.$eval('#root main .outline-strip li[data-state="next"] a', (a) => a.getAttribute('href')).catch(() => null)
      truthy(
        named?.endsWith(`/races/${season}/${next.round}`) && named === marked,
        `and it names round ${next.round}, the round the calendar strip marks next — ${named}`,
      )
      const won = db.prepare(WON_HERE).all(season).length
      if (won > 0) {
        is(await rowsUnder(WON_HERE_HEADING), won, `“${WON_HERE_HEADING}” holds the ${won} past winners at ${next.circuit}`)
        is(staticRowsUnder(seasonHtml, WON_HERE_HEADING), won, 'and the static page holds the same rows')
      }
    } else {
      truthy(
        !(await appHeadings()).includes(NEXT_HEADING) && !staticHeadings(seasonHtml).includes(NEXT_HEADING),
        `a season with nothing left to run carries no “${NEXT_HEADING}”`,
      )
    }
    const later = one('SELECT MIN(year) FROM seasons WHERE year > ?', season)
    if (later) {
      await go(`/seasons/${later}`, String(later))
      truthy(
        !(await appHeadings()).includes(NEXT_HEADING) && !staticHeadings(await served(`/seasons/${later}`)).includes(NEXT_HEADING),
        `next season's page, ${later}, has no “${NEXT_HEADING}” a year away`,
      )
    }

    // A driver of the season opens on it: its heading first, a dot per
    // classified round, the table the rounds run. A driver of another era
    // does not.
    const racer = db
      .prepare('SELECT d.id, d.full_name FROM race_entries e JOIN races r ON r.id = e.race_id JOIN drivers d ON d.id = e.driver_id WHERE r.year = ? ORDER BY e.id LIMIT 1')
      .get(season)
    if (racer) {
      const calendar = db.prepare(THIS_SEASON).all(racer.id)
      const heading = thisSeasonHeading(calendar)
      const run = roundsRun(calendar).length
      const placed = calendar.filter((row) => typeof row.finish_position === 'number').length
      await go(`/drivers/${racer.id}`, racer.full_name)
      is((await appHeadings())[0], heading, `/drivers/${racer.id} opens on “${heading}”`)
      // The career strip below it has a heading of its own, so it does not
      // read as the season section's figures.
      is((await appHeadings())[1], CAREER_HEADING, `and the career below it is headed “${CAREER_HEADING}”`)
      const drawn = await page.$$eval(
        '#root main h2',
        (nodes, heading) => {
          const scope = nodes.find((node) => node.textContent.trim() === heading)?.closest('section')
          return {
            dots: scope?.querySelectorAll('figure.figure svg circle.mark-ring, figure.figure svg circle.mark-hollow').length ?? 0,
            rows: Number(scope?.querySelector('figure.figure .table-wrap')?.dataset.rows ?? -1),
          }
        },
        heading,
      )
      is(drawn.dots, placed, `a dot for each of the ${placed} rounds ${racer.full_name} was classified in`)
      is(drawn.rows, run, `and the table under it holds the ${run} rounds run`)
      const html = await served(`/drivers/${racer.id}`)
      is(staticHeadings(html)[0], heading, 'the static page opens on the same heading')
      is(staticHeadings(html)[1], CAREER_HEADING, 'and heads the career the same way')
      is(staticRowsUnder(html, heading), run, 'and holds the same rounds')
    }
    await go('/drivers/senna', 'Senna')
    truthy(
      !(await appHeadings()).some((h) => h.startsWith(`The ${season} season`)) &&
        !staticHeadings(await served('/drivers/senna')).some((h) => h.startsWith(`The ${season} season`)),
      `a driver with no ${season} entry has no ${season} section`,
    )

    // This year's chassis opens on its photograph; a car of another year
    // opens on its figures, the photographs after them.
    const pictured = db
      .prepare('SELECT id FROM chassis WHERE COALESCE(last_year, first_year) = ? ORDER BY id')
      .all(season)
      .map((row) => row.id)
      .find((id) => db.prepare(CAR_IMAGES).all(id, id).some(canShow))
    const firstSection = () =>
      page.$eval('#root main section.section', (node) => node.querySelector('h2')?.textContent.trim() ?? '')
    const photoFirst = (html) => {
      const photo = html.indexOf('<h2>Photographs')
      return photo >= 0 && photo < html.indexOf('<dl class=')
    }
    if (pictured) {
      await go(`/cars/${pictured}`)
      truthy((await firstSection()).startsWith('Photographs'), `/cars/${pictured}, a ${season} chassis, opens on its photograph`)
      const carHtml = await served(`/cars/${pictured}`)
      truthy(photoFirst(carHtml), 'and so does its static page')
      truthy(
        (await appHeadings()).includes(FIGURES_HEADING) && staticHeadings(carHtml).includes(FIGURES_HEADING),
        `and its figures are headed “${FIGURES_HEADING}” in both halves, not read as the photographs' own`,
      )
    }
    await go('/cars/lotus-72', 'Lotus 72')
    truthy(!(await firstSection()).startsWith('Photographs'), 'a car of another year opens on its figures')
    truthy(!photoFirst(await served('/cars/lotus-72')), 'in both halves')
    truthy(!(await appHeadings()).includes(FIGURES_HEADING), `and needs no “${FIGURES_HEADING}” heading`)
  })

  await section('/seasons/1976', async () => {
    await go('/seasons/1976', '1976')
    const s76 = await tableRows()
    is(s76[0], count('SELECT COUNT(*) FROM races WHERE year = 1976'), '1976 calendar rounds')
    is(
      s76[1],
      // after_round IS NULL is the season as it finished, which is what the page
      // shows — not the last round it happens to hold a running table for.
      count(
        "SELECT COUNT(*) FROM standings WHERE year = 1976 AND table_type = 'drivers' AND after_round IS NULL",
      ),
      "1976 final drivers' standings",
    )
    atLeast(await page.$$eval('#root main .figure', (n) => n.length), 1, 'the title race is charted')
    atLeast(
      await page.$$eval('#root main .figure svg path', (n) => n.length),
      2,
      'the championship chart drew its lines',
    )
    // AX-16: each line has its own dash, and the legend's key to it is the
    // same stroke, in the same order - a key in hue alone is what 1.4.1
    // forbids once an end label is dropped.
    const dashes = await page.$eval('#root main .figure:has(.legend)', (figure) => ({
      lines: [...figure.querySelectorAll('.figure-body svg path')].map((p) => p.getAttribute('stroke-dasharray') ?? 'solid'),
      keys: [...figure.querySelectorAll('.legend svg.line-key line')].map((l) => l.getAttribute('stroke-dasharray') ?? 'solid'),
    }))
    is(dashes.keys.join(' | '), dashes.lines.join(' | '), 'the legend keys each line with its own dash')
    is(new Set(dashes.lines).size, dashes.lines.length, 'no two lines of the title race share a dash')
  })

  // A calendar that has been announced and not raced. Its blanks are not
  // unestablished facts: nobody has won a round of it, and the page used to
  // say the constructors' championship "was not contested until 1958" and dash
  // the Car, Pole and Fastest lap of every round (CD-32, CD-37).
  await section('a season not yet run  (the blanks it has are not gaps)', async () => {
    const awaited = one(
      `SELECT MIN(year) FROM races
        GROUP BY year HAVING SUM(status = 'completed') = 0 ORDER BY year LIMIT 1`,
    )
    if (!awaited) {
      note('no season on the calendar is unraced — nothing to check')
    } else {
      await go(`/seasons/${awaited}`, String(awaited))
      const main = await page.$eval('#root main', (node) => node.textContent)
      truthy(
        !main.includes('not contested until 1958'),
        `${awaited} is not told about the 1958 championship`,
      )
      truthy(main.includes('Not yet run.'), 'its constructors\' standings say why they are empty')
      // The calendar's own table, found by a header no other table has.
      const dashed = await page.$$eval('#root main table', (tables) => {
        const calendar = tables.find((table) =>
          [...table.querySelectorAll('th')].some((th) => th.textContent.trim() === 'Fastest lap'),
        )
        if (!calendar) return -1
        return [...calendar.querySelectorAll('td')].filter((td) => td.textContent.trim() === '—').length
      })
      is(dashed, 0, 'and no round of it dashes a result it cannot have yet')
    }

  })

  // ---------------------------------------------------------------- a race

  // 2026 carries two final standings rows per driver — formula1.com records the
  // team, F1DB the position — so a page that does not collapse them lists every
  // driver twice.
  await section('/seasons/2026  (the same fact from two sources)', async () => {
    await go('/seasons/2026', '2026')
    is(
      await rowsUnder("Drivers'"),
      count(
        `SELECT COUNT(DISTINCT entity_id) FROM standings
        WHERE year = 2026 AND table_type = 'drivers' AND after_round IS NULL`,
      ),
      'each driver appears once in the final table',
    )

  })

  // 2018 is the opposite case: Force India was excluded with nothing and its
  // successor scored 52 under the same id. Both rows belong in that table.
  await section('/seasons/2018  (an entity that finished twice)', async () => {
    await go('/seasons/2018', '2018')
    is(
      (await tableRows())[2],
      count(
        `SELECT COUNT(*) FROM standings
        WHERE year = 2018 AND table_type = 'constructors' AND after_round IS NULL`,
      ),
      "the excluded constructor and its successor both stand",
    )

  })

  await section('/races/1976/9  (the classification)', async () => {
    const raceId = one('SELECT id FROM races WHERE year = 1976 AND round = 9')
    await go('/races/1976/9')
    const race = await tableRows()
    is(race[0], count('SELECT COUNT(*) FROM race_entries WHERE race_id = ?', raceId), 'classification entries')
    is(race[1], count('SELECT COUNT(*) FROM qualifying WHERE race_id = ?', raceId), 'qualifying entries')

    // VD-28: most of a race page's tiles hold a name, not a figure. The
    // display face is condensed and drawn for numerals, so a name set in it
    // at the figure size reads as a headline - three of five tiles were
    // underlined names in 22px display type. A name takes the sans face, and
    // every tile that is not a name keeps the display face it had.
    const strip = await statStrip()
    truthy(strip.names.length >= 3, `${strip.names.length} tiles hold a name`)
    is(
      strip.names.filter((t) => /Condensed/.test(t.family)).map((t) => t.label).join(' · '),
      '',
      'a name is set in the sans face, not the display face',
    )
    is(
      strip.figures.filter((t) => !/Condensed/.test(t.family)).map((t) => t.label).join(' · '),
      '',
      'a figure keeps the display face',
    )
    is(strip.wrapped.join(' · '), '', 'no stat label wraps')
    is(strip.misalignedRows.join(' · '), '', 'no value sits below the values beside it')

    // CD-03: the largest page type opens on a sentence. 1,194 of the 1,196
    // rounds carry no written note, and get it from the race records through
    // raceLede() in queries/race.js - the same expression the description is
    // built from, so the page and the search result cannot describe different
    // races the way they were free to before.
    const winner = one(
      `SELECT d.full_name FROM race_entries e LEFT JOIN drivers d ON d.id = e.driver_id
        WHERE e.race_id = ? AND e.finish_position = 1`,
      raceId,
    )
    const plain = (s) =>
      s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    const html = await (await fetch(`${BASE}/races/1976/9`)).text()
    const staticLede = plain(html.match(/<h1>[^<]*<\/h1>\s*<p class="lede">([^<]*)<\/p>/)?.[1] ?? '')
    truthy(
      staticLede.startsWith(`${winner} won for `) && staticLede.endsWith('.'),
      `the static page opens on the derived sentence — "${staticLede}"`,
    )
    is(await text('#root main .lede'), staticLede, 'and the app opens on the same sentence')
    truthy(
      plain(html.match(/<meta name="description" content="([^"]*)" \/>/)?.[1] ?? '').includes(staticLede),
      'and the description is built from that same sentence',
    )

    /*
     * CD-36: the classification's footnote explains the blanks that are on
     * this page and no others. Both sentences were printed beneath all 1,163
     * classifications; the one about an empty "Out" matched no row in the
     * database at all, because CD-01 had made that cell read "Finished".
     * Eleven of these thirty entries have no chassis, so this page gets the
     * chassis sentence and not the other -- in both renderers.
     */
    const blankChassis = count(
      'SELECT COUNT(*) FROM race_entries WHERE race_id = ? AND chassis_id IS NULL',
      raceId,
    )
    truthy(blankChassis > 0, `${blankChassis} of this classification's entries have no chassis`)
    const app76 = await page.content()
    truthy(html.includes(CHASSIS_NOTE) && app76.includes(CHASSIS_NOTE), 'the blank chassis is explained')
    is(html.includes(OUT_NOTE), false, 'and the static page does not explain a blank that is not there')
    is(app76.includes(OUT_NOTE), false, 'nor does the app')

    // AX-12: the rail says in colour what Pos says in words, so a screen
    // reader is spared it - it was an empty cell named "Result" on every
    // row. Hidden, header and cells, in both renderers, and named nowhere.
    const appRail = await page.evaluate(() => {
      const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.trim().startsWith('Classification'))
      const table = h2.closest('section').querySelector('.table-wrap table')
      const cells = [table.querySelector('thead th'), ...[...table.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('td'))]
      return {
        rail: cells.every((c) => c.classList.contains('rail')),
        hidden: cells.filter((c) => c.getAttribute('aria-hidden') !== 'true').length,
        named: cells[0].textContent.trim(),
      }
    })
    truthy(appRail.rail, "the app's classification leads on the rail")
    is(appRail.hidden, 0, "and every cell of it, header included, is aria-hidden")
    is(appRail.named, '', 'with no header text to announce')
    const staticRail = html.match(/<th scope="col" class="rail"[^>]*>([^<]*)<\/th>/)
    truthy(staticRail?.[0].includes('aria-hidden="true"') && staticRail[1] === '', 'the static rail header is hidden and empty')
    const railCells = html.match(/<td class="rail"[^>]*>/g) ?? []
    is(railCells.length, race[0], 'the static classification draws a rail cell per entry')
    is(railCells.filter((c) => !c.includes('aria-hidden="true"')).length, 0, 'and every one is aria-hidden')
  })

  await section('/races/1955/1  (a shared drive)', async () => {
    const shared = one('SELECT id FROM races WHERE year = 1955 AND round = 1')
    await go('/races/1955/1')
    is(
      (await tableRows())[0],
      count('SELECT COUNT(*) FROM race_entries WHERE race_id = ?', shared),
      'a shared-drive classification keeps every entry',
    )
    truthy(
      (await page.content()).includes('shared drive'),
      'the page explains why a position repeats',
    )

    /*
     * A race where the driver on pole is not the driver who was quickest. The
     * page holds race_results' pole -- the driver the season record credits --
     * and a reader who knows the sport reads that as an error unless the page
     * names the quickest driver too. There are thirteen such races and
     * verify.py pins the count.
     */
  })

  await section('/races/1950/3  (a winner whose car is not a constructor)', async () => {
    /*
     * The eleven Indianapolis 500s that counted for the championship, 1950 to
     * 1960. Their winning entries name a car -- "Kurtis Kraft-Offenhauser",
     * "Watson-Offenhauser" -- that no constructor row holds, so constructor_id
     * is NULL. carName() in queries/race.js falls back to the entrant, and the
     * claim here is that all four surfaces on the page apply it: the
     * standfirst, the Winner tile, the classification's Constructor cell and
     * the static Constructor fact row. Two of the four did and two did not,
     * so the page named the car above and below a blank (AF-64).
     */
    const car = one(
      `SELECT e.entrant FROM race_entries e JOIN races r ON r.id = e.race_id
        WHERE r.year = 1950 AND r.round = 3 AND e.finish_position = 1`,
    )
    truthy(car, `the winning entry names a car — "${car}"`)

    await go('/races/1950/3')
    is(
      await page.$eval('#root main .stats', (dl) => {
        const tile = [...dl.querySelectorAll(':scope > div')].find(
          (el) => el.querySelector('dt')?.textContent === 'Winner',
        )
        return tile?.querySelector('dd small')?.textContent ?? ''
      }),
      car,
      'the Winner tile names the car under the driver',
    )
    truthy((await text('#root main .lede')).includes(car), 'and the standfirst names it')
    is(
      await page.$eval('#root main table', (t) => {
        const head = [...t.querySelectorAll('thead th')].map((th) => th.textContent)
        const row = t.querySelector('tbody tr')
        // Every cell of the row, the driver's row header among them (AX-21).
        return row.children[head.indexOf('Constructor')]?.textContent ?? ''
      }),
      car,
      "and the classification's Constructor cell names it for the winner",
    )

    const html = await (await fetch(`${BASE}/races/1950/3`)).text()
    is(
      html.match(/<dt>Constructor<\/dt><dd>([^<]*)<\/dd>/)?.[1] ?? '',
      car,
      'and the static Constructor fact row names it rather than an em dash',
    )
  })

  await section('/races/2021/10  (pole is not the fastest qualifier)', async () => {
    await go('/races/2021/10')
    const front = await page.content()
    truthy(front.includes('Fastest qualifier'), 'the page distinguishes pole from the fastest qualifier')
    truthy(
      front.includes(one(`SELECT d.full_name FROM qualifying q JOIN drivers d ON d.id = q.driver_id
                         JOIN races r ON r.id = q.race_id
                        WHERE r.year = 2021 AND r.round = 10 AND q.position = 1`)),
      'and names the driver who actually set the time',
    )

    truthy(front.includes('set by the sprint'), 'and says the sprint set the grid')

    /*
     * CD-36, the other side of it: every one of these twenty entries has a
     * chassis and a status, so the classification has no blank to explain and
     * carries no footnote at all. 402 of the 1,163 completed races are this
     * page, and each of them used to carry two sentences about blanks it does
     * not have.
     */
    is(
      count(`SELECT COUNT(*) FROM race_entries e JOIN races r ON r.id = e.race_id
              WHERE r.year = 2021 AND r.round = 10 AND e.chassis_id IS NULL`),
      0,
      'no entry on this page is missing its chassis',
    )
    const static21 = await (await fetch(`${BASE}/races/2021/10`)).text()
    is(front.includes(CHASSIS_NOTE) || front.includes(OUT_NOTE), false, 'the app prints no footnote')
    is(static21.includes(CHASSIS_NOTE) || static21.includes(OUT_NOTE), false, 'nor does the static page')

    /*
     * The one race where the credited pole-sitter did not start from the front:
     * a 2022 sprint weekend, pole to the fastest qualifier, grid 1 to the sprint
     * winner. Pole and grid 1 are two columns for this reason, and the page has
     * to show both or the classification's grid column contradicts the summary.
     */
  })

  await section('/races/2022/21  (pole is not the car at grid 1)', async () => {
    await go('/races/2022/21')
    truthy((await page.content()).includes('Started first'), 'the page names the car that started from the front')

  })

  await section('/races', async () => {
    await go('/races', 'Races')
    is((await tableRows())[0], count('SELECT COUNT(*) FROM races'), 'every race is listed')

  })

  // ---------------------------------------------------------------- people

  await section('/drivers', async () => {
    await go('/drivers', 'Drivers')
    truthy(
      await page.waitForSelector('[role="group"][aria-label="Filter drivers by kind"] button', { timeout: 20000 }).catch(() => null),
      'the kind filter is a named group of toggle buttons',
    )
    is((await tableRows())[0], count('SELECT COUNT(*) FROM drivers'), 'the driver register')
    {
      const top = db.prepare('SELECT full_name, wins FROM drivers ORDER BY wins DESC, podiums DESC LIMIT 1').get()
      const first = await page.$eval('#root main tbody tr', (tr) => tr.textContent)
      truthy(first.includes(top.full_name), `the register opens on the most successful driver, ${top.full_name}`)
      const heads = await page.$$eval('#root main thead th', (ths) => ths.map((th) => th.textContent.trim()))
      // One word for the derived count, here and in the strip on the driver's
      // page: a race_entries row is an entry, not a start, and the published
      // `entries`/`starts` columns stay off the register.
      truthy(heads.includes('Entries') && !heads.includes('Races') && !heads.includes('Starts'), 'Entries is counted from the race records; Races and Starts are gone')
      // The grid filter keeps the current grid - it matched nobody for a
      // version, testing last_season against a year the open span never holds.
      //
      // The season is meta.current_season, what data/current.py declares, and
      // the set is that season's entry list (IA-19, CR-07). NOT MAX(year) over
      // the completed races: that names last season for the whole of a winter,
      // while the chip beside it on /circuits would be naming this one.
      const latest = one("SELECT value FROM meta WHERE key = 'current_season'")
      const gridCount = count(
        'SELECT COUNT(DISTINCT driver_id) FROM season_entries WHERE year = ?',
        latest,
      )
      truthy(gridCount > 0, `there is a ${latest} grid to keep`)
      const rowsAre = (n) => page.waitForFunction((n) => document.querySelector('#root main .table-wrap')?.dataset.rows === String(n), n, { timeout: 10000 })
      await page.click(`[role="group"][aria-label="Filter drivers by kind"] button:has-text("On the ${latest} grid")`)
      await rowsAre(gridCount)
      is((await tableRows())[0], gridCount, `the grid filter keeps the ${gridCount} drivers entered in ${latest}`)
      await page.click('[role="group"][aria-label="Filter drivers by kind"] button:has-text("All")')
      await rowsAre(count('SELECT COUNT(*) FROM drivers'))
      const entries = one('SELECT COUNT(*) FROM race_entries WHERE driver_id = (SELECT id FROM drivers ORDER BY wins DESC, podiums DESC LIMIT 1)')
      is(
        await page.$eval('#root main tbody tr td:nth-child(4)', (td) => Number(td.textContent.replace(/[^0-9]/g, ''))),
        entries,
        `${top.full_name}'s Entries is the race-record count`,
      )
      const html = await (await fetch(`${BASE}/drivers`)).text()
      // fromColumns() gives a numeric header its alignment class, so the tag
      // carries attributes; the word is what is being checked.
      truthy(/<th scope="col"[^>]*>Entries<\/th>/.test(html) && !/<th scope="col"[^>]*>Races<\/th>/.test(html), 'the static register uses the same word')
      const firstStatic = html.slice(html.indexOf('<tbody>'), html.indexOf('</tr>', html.indexOf('<tbody>')))
      truthy(firstStatic.includes(top.full_name), 'the static register opens on the same driver')
      // Row for row, not only the first: the tie-break must collate as SQLite
      // does, or 518 of 862 positions differ while the first row agrees.
      await page.click('#root main .table-foot button.more')
      await page.waitForFunction(() => document.querySelectorAll('#root main tbody tr').length > 150, null, { timeout: 20000 })
      const appOrder = await page.$$eval('#root main tbody tr > :first-child', (cells) => cells.map((c) => c.textContent.trim()))
      const staticOrder = ([...html.matchAll(/<tbody>[\s\S]*?<\/tbody>/g)][0][0].match(/<tr>[\s\S]*?<\/tr>/g) ?? []).map(
        (tr) =>
          tr
            .match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/)[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .trim(),
      )
      is(
        appOrder.findIndex((name, k) => name !== staticOrder[k]),
        -1,
        `the static register is in the app's order for all ${appOrder.length} rows (first difference at)`,
      )
    }
    // Filtering the register to nothing is an ordinary act and must not crash
    // the page: the first cut of the scroll fade declared its hooks after the
    // empty-state return, and React threw on the first empty search.
    await page.fill('input[type="search"]', 'zzzz-no-such-driver')
    const emptied = await page.waitForSelector('#root main .state.is-empty', { timeout: 10000 })
    truthy(await page.$('#root main h1'), 'a register filtered to no rows shows its empty state, and the page stands')
    // IX-28: that state names the filter that emptied the register and offers
    // the way back. "Nothing recorded." did neither, and read as a claim about
    // the database rather than about the search box (CD-17).
    const said = (await emptied.textContent()).trim()
    truthy(
      said.includes('zzzz-no-such-driver'),
      `the filtered empty state names the term that emptied it - "${said}"`,
    )
    const clear = await page.$('#root main .state.is-empty button')
    truthy(clear, 'the filtered empty state offers a way back out of the filters')
    await clear.click()
    await page.waitForSelector('#root main tbody tr', { timeout: 10000 })
    is(
      await page.$eval('input[type="search"]', (node) => node.value),
      '',
      'Clear filters empties the search box and the register comes back',
    )

  })

  await section('/drivers/senna', async () => {
    await go('/drivers/senna', 'Ayrton Senna')
    const senna = await tableRows()
    is(
      senna[senna.length - 1],
      count('SELECT COUNT(*) FROM race_entries WHERE driver_id = ?', 'senna'),
      "every one of Senna's entries",
    )
    const sennaWins = count("SELECT COUNT(*) FROM race_entries WHERE driver_id = 'senna' AND finish_position = 1")
    truthy(
      (await page.$$eval('#root main .stats dd', (n) => n.map((x) => x.textContent))).includes(String(sennaWins)),
      `wins derived from the race records — ${sennaWins}`,
    )

    // A driver with no lede gets a description built from the race records —
    // the entry count the strip derives — and never "0 wins, 0 poles" read off
    // the published columns the page labels as such. The first NULL-notes
    // driver by id, so the check survives any one note being written.
    {
      const quiet = db
        .prepare(
          `SELECT d.id, d.full_name FROM drivers d
          WHERE d.notes IS NULL AND EXISTS (SELECT 1 FROM race_entries e WHERE e.driver_id = d.id)
          ORDER BY d.id LIMIT 1`,
        )
        .get()
      if (quiet) {
        note(`\n/drivers/${quiet.id}  (a lede-less driver's description is derived)`)
        const entries = count('SELECT COUNT(*) FROM race_entries WHERE driver_id = ?', quiet.id)
        const html = await (await fetch(`${BASE}/drivers/${quiet.id}`)).text()
        const description = (html.match(/<meta name="description" content="([^"]*)" \/>/)?.[1] ?? '')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
        truthy(
          description.startsWith(quiet.full_name) &&
            description.includes(`Entered ${entries} championship Grand`),
          `the description names the ${entries} entries the records hold — "${description}"`,
        )
        truthy(!/\b0 (wins|poles)\b/.test(description), 'and does not read "0 wins" or "0 poles" off a published column')
        truthy(/\.$/.test(description), 'and ends at a sentence')
        // A published entry count exists for 38 of the 862 drivers and a
        // published start count for 31. The row appears exactly where one
        // does: an em dash there claimed nobody had established a figure the
        // strip above counts, on 824 pages (CD-37). Both renderers read
        // record() in queries/driver.js, so this pins the pair.
        const held = db.prepare('SELECT entries, starts FROM drivers WHERE id = ?').get(quiet.id)
        is(
          html.includes('<dt>Entries (published)</dt>'),
          held.entries !== null,
          'the static facts carry a published entry count only where the register holds one',
        )
        is(
          html.includes('<dt>Starts (published)</dt>'),
          held.starts !== null,
          'and a published start count only where it holds one',
        )
        const published = db
          .prepare('SELECT id FROM drivers WHERE entries IS NOT NULL AND starts IS NOT NULL ORDER BY id LIMIT 1')
          .get()
        const publishedHtml = await (await fetch(`${BASE}/drivers/${published.id}`)).text()
        truthy(
          publishedHtml.includes('<dt>Entries (published)</dt>') &&
            publishedHtml.includes('<dt>Starts (published)</dt>'),
          `and both rows stand on a driver who has them — /drivers/${published.id}`,
        )

        // A DATE OF DEATH A LIVING DRIVER DOES NOT HAVE IS NOT A MISSING FACT.
        // 310 pages read "Died —" directly above "Status active" or
        // "Status retired", which is the em-dash convention contradicting the
        // row beneath it; a deceased driver with no date keeps the dash,
        // because there it is true (CD-37).
        const living = db
          .prepare("SELECT id FROM drivers WHERE status IN ('active', 'retired') ORDER BY id LIMIT 1")
          .get()
        const dead = db
          .prepare("SELECT id FROM drivers WHERE status = 'deceased' AND died IS NULL ORDER BY id LIMIT 1")
          .get()
        truthy(
          !(await (await fetch(`${BASE}/drivers/${living.id}`)).text()).includes('<dt>Died</dt>'),
          `a living driver's page has no Died row — /drivers/${living.id}`,
        )
        if (dead) {
          truthy(
            (await (await fetch(`${BASE}/drivers/${dead.id}`)).text()).includes('<dt>Died</dt>'),
            `and a death nobody has dated keeps its em dash — /drivers/${dead.id}`,
          )
        }

        // PD-16: the same sentence is the page's OPENING one, in both
        // renderers, from lede() in queries/driver.js. Before this the 699
        // note-less pages opened straight onto the strip of tiles.
        const staticLede = (html.match(/<h1>[^<]*<\/h1>\s*<p class="lede">([^<]*)<\/p>/)?.[1] ?? '')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
        truthy(
          staticLede.startsWith(`Entered ${entries} championship Grand`),
          `the static page opens on the derived sentence — "${staticLede}"`,
        )
        await go(`/drivers/${quiet.id}`, quiet.full_name)
        is(await text('#root main .lede'), staticLede, 'and the app opens on the same sentence')
      }
    }

    // The override: a driver with a note keeps it as the lede, in both halves.
    {
      const written = db
        .prepare(
          `SELECT id, full_name, notes FROM drivers
            WHERE notes IS NOT NULL AND TRIM(notes) <> '' ORDER BY id LIMIT 1`,
        )
        .get()
      note(`\n/drivers/${written.id}  (a written note is still the lede)`)
      await go(`/drivers/${written.id}`, written.full_name)
      is(await text('#root main .lede'), written.notes, 'the app shows the written note, not the derived sentence')
      const html = await (await fetch(`${BASE}/drivers/${written.id}`)).text()
      truthy(
        !html.includes('<p class="lede">Entered '),
        'and the static page does not overwrite it with the derived sentence',
      )
    }

  })

  await section('/constructors', async () => {
    await go('/constructors', 'Constructors')
    const everyConstructor = count('SELECT COUNT(*) FROM constructors')
    is((await tableRows())[0], everyConstructor, 'the constructor register')

    // VD-30: it opened on AFM, AGS, Alfa Special - roughly sixty of the
    // seventy-eight figures on the first screen were zero. Most race entries
    // first now, with alphabetical one click on the header away.
    {
      const busiest = db
        .prepare(
          `SELECT k.name, (SELECT COUNT(*) FROM race_entries e WHERE e.constructor_id = k.id) AS entries
             FROM constructors k ORDER BY entries DESC, k.name COLLATE NOCASE, k.id LIMIT 1`,
        )
        .get()
      const first = await page.$eval('#root main tbody tr', (tr) => tr.textContent)
      truthy(first.includes(busiest.name), `the register opens on the busiest constructor, ${busiest.name}`)
      const first_ = one('SELECT name FROM constructors ORDER BY name COLLATE NOCASE, id LIMIT 1')
      await page.click('#root main thead th:first-child button')
      await page.waitForFunction(
        (name) => document.querySelector('#root main tbody tr')?.textContent.includes(name),
        first_,
        { timeout: 10000 },
      )
      is(
        await page.$eval('#root main thead th:first-child', (th) => th.getAttribute('aria-sort')),
        'ascending',
        `alphabetical is one click on the Constructor header away, and it opens on ${first_}`,
      )
    }

    // IA-19: the same chip, in the same words, as /drivers and /cars - it
    // read "Active" here, which named a stored column rather than a season.
    {
      const season = one("SELECT value FROM meta WHERE key = 'current_season'")
      const onGrid = count('SELECT COUNT(DISTINCT constructor_id) FROM season_entries WHERE year = ?', season)
      truthy(onGrid > 0, `there is a ${season} grid of constructors to keep`)
      const group = '[role="group"][aria-label="Filter constructors by kind"]'
      is(
        await page.$$eval(`${group} button`, (bs) => bs.map((b) => b.textContent.trim()).join(' | ')),
        `All | Race winners | Champions | On the ${season} grid`,
        'the chip names the season, and "Active" is gone',
      )
      await page.click(`${group} button:has-text("On the ${season} grid")`)
      await page.waitForFunction(
        (n) => document.querySelector('#root main .table-wrap')?.dataset.rows === String(n),
        onGrid,
        { timeout: 10000 },
      )
      is((await tableRows())[0], onGrid, `the grid chip keeps the ${onGrid} constructors entered in ${season}`)
      await page.click(`${group} button:has-text("All")`)
      await page.waitForFunction(
        (n) => document.querySelector('#root main .table-wrap')?.dataset.rows === String(n),
        everyConstructor,
        { timeout: 10000 },
      )
    }
  })

  await section('/constructors/ferrari', async () => {
    await go('/constructors/ferrari', 'Ferrari')
    const ferrari = await tableRows()
    truthy(
      ferrari.includes(
        count("SELECT COUNT(*) FROM race_entries WHERE constructor_id = 'ferrari' AND finish_position = 1"),
      ),
      'every Ferrari win is listed',
    )

    // VD-28, and this page is where it was measured: eight tiles, and
    // "Constructors' titles" took two lines for its label and dropped its own
    // figure below every figure beside it. A shared top is the whole of the
    // claim - a strip whose labels all fit on one line has nothing to drop.
    const strip = await statStrip()
    is(strip.wrapped.join(' · '), '', 'no stat label wraps')
    // Per row, not per strip. A strip wide enough to hold every tile on one
    // row proves the claim only while it stays that wide: add a title, or
    // read the page at 1024, and a check on one shared top would fail for
    // "the row wrapped" rather than for "a label wrapped", which is a
    // different thing and not a defect. What VD-28 asks is that no figure
    // drops below the figures BESIDE it.
    is(strip.misalignedRows.join(' · '), '', 'no figure sits below the figures beside it')
    truthy(strip.lead.length > 0 && strip.lead.length <= 2, `${strip.lead.length} figures lead, not eight`)
    truthy(
      Math.min(...strip.lead.map((t) => t.size)) > Math.max(...strip.rest.map((t) => t.size)),
      'a lead figure is set larger than every figure that does not lead',
    )

    /*
     * VD-33 and AX-13, on the surface VD-33 was filed about.
     *
     * The licence obligation travels with the photograph, so every figure is
     * asked for its credit rather than one of them — the failure this guards
     * against is a page crediting the first of six. The alt is asked at the
     * same time because the two are one figure: it must say what the picture
     * is OF, which is the car, and never the file name it used to read.
     */
    const team = await page.$$eval('figure.photo', (figures) =>
      figures.map((figure) => ({
        subject: figure.querySelector('.photo-subject')?.textContent?.trim() ?? '',
        alt: figure.querySelector('img')?.getAttribute('alt') ?? '',
        file: figure.querySelector('figcaption a')?.textContent?.trim() ?? '',
        caption: figure.querySelector('figcaption')?.textContent ?? '',
      })),
    )
    is(team.length, PHOTOGRAPHS_SHOWN, `the constructor page shows ${PHOTOGRAPHS_SHOWN} photographs`)
    is(new Set(team.map((figure) => figure.subject)).size, team.length, 'each one a different Ferrari')
    const unnamed = team.filter((figure) => figure.alt !== figure.subject || /\.(jpe?g|png)$/i.test(figure.alt))
    if (unnamed.length === 0) pass('every alt names the car, not the file')
    else for (const figure of unnamed) fail(`alt is "${figure.alt}" for ${figure.subject || figure.file}`)

    const teamCredits = db.prepare(
      `SELECT file_name, licence,
            COALESCE(NULLIF(TRIM(COALESCE(artist, '')), ''),
                     NULLIF(TRIM(COALESCE(credit, '')), '')) AS credit
       FROM article_images WHERE route = 'article'`,
    ).all()
    const teamByTitle = new Map(
      teamCredits.map((row) => [row.file_name.replace(/^File:/, '').replace(/_/g, ' '), row]),
    )
    const teamUncredited = team.filter((figure) => {
      const row = teamByTitle.get(figure.file)
      if (!row) return true
      return !figure.caption.includes(row.licence) || !figure.caption.includes(row.credit)
    })
    if (teamUncredited.length === 0) {
      pass(`all ${team.length} photograph(s) carry their licence and their credit`)
    } else {
      for (const figure of teamUncredited) fail(`photograph shown without full credit: ${figure.file}`)
    }
  })

  // -------------------------------------------------------------- circuits

  await section('/circuits', async () => {
    await go('/circuits', 'Circuits')
    const everyVenue = count('SELECT COUNT(*) FROM v_circuits')
    is((await tableRows())[0], everyVenue, 'the circuit register')

    // IA-19: this year's calendar, the fourth register's share of the one
    // chip. A toggle and not a fifth type chip, because IX-35 is the record
    // of what happens when a second axis is filed into that group - and it
    // composes with the type, which is the whole point.
    //
    // The season is meta.current_season and NOT MAX(races.year): the 2027
    // calendar was announced on 2026-09-16 and is already in the register.
    {
      const season = one("SELECT value FROM meta WHERE key = 'current_season'")
      const onCalendar = count('SELECT COUNT(DISTINCT circuit_id) FROM races WHERE year = ?', season)
      truthy(onCalendar > 0 && onCalendar < everyVenue, `there is a ${season} calendar to keep`)
      truthy(
        count('SELECT COUNT(*) FROM races WHERE year > ?', season) > 0,
        'a later calendar is already in the register, which is what the anchor is for',
      )
      const label = `On the ${season} calendar`
      const toggle = `.filters button[aria-label="${label} only"]`
      truthy(
        (await page.$eval(toggle, (b) => b.textContent.trim())) === label,
        'the toggle carries the same words the other three registers put on their chip',
      )
      await page.click(toggle)
      await page.waitForFunction(
        (n) => document.querySelector('#root main .table-wrap')?.dataset.rows === String(n),
        onCalendar,
        { timeout: 10000 },
      )
      is((await tableRows())[0], onCalendar, `the calendar toggle keeps the ${onCalendar} venues run in ${season}`)

      // It composes with the type chips, which is what a toggle buys over a
      // fifth chip in that group (IX-35).
      const type = one('SELECT circuit_type FROM v_circuits WHERE circuit_type IS NOT NULL GROUP BY circuit_type ORDER BY COUNT(*) DESC LIMIT 1')
      const both = count(
        `SELECT COUNT(DISTINCT v.id) FROM v_circuits v
          WHERE v.circuit_type = ? AND EXISTS (SELECT 1 FROM races r WHERE r.circuit_id = v.id AND r.year = ?)`,
        type,
        season,
      )
      await page.click(`[role="group"][aria-label="Filter circuits by type"] button:has-text("${type}")`)
      await page.waitForFunction(
        (n) => document.querySelector('#root main .table-wrap')?.dataset.rows === String(n),
        both,
        { timeout: 10000 },
      )
      is((await tableRows())[0], both, `the calendar and the type compose: ${both} ${type} venues in ${season}`)
      await page.click(toggle)
      await page.click('[role="group"][aria-label="Filter circuits by type"] button:has-text("All types")')
      await page.waitForFunction(
        (n) => document.querySelector('#root main .table-wrap')?.dataset.rows === String(n),
        everyVenue,
        { timeout: 10000 },
      )
    }

    // VD-50: the register draws each venue once, from F1DB's outline - the
    // drawing that is already in f1.db and needs no centreline parsed. One
    // card per circuit that has one; 79 of the 80 do, and the count says so.
    {
      const drawn = count('SELECT COUNT(DISTINCT circuit_id) FROM circuit_outlines')
      const venues = count('SELECT COUNT(*) FROM v_circuits')
      truthy(drawn < venues, 'at least one venue has no outline, which is what the count is for')
      await page.waitForSelector('#root main .shapecard svg.outline path', { timeout: 20000 })
      is(await page.$$eval('#root main .shapecard', (n) => n.length), drawn, 'every venue F1DB draws has a card')
      is(
        await page.$eval('#root main .section:has(.shapecard) .count', (n) => n.textContent.trim()),
        `${drawn} of ${venues}`,
        'the count names the venues without an outline rather than leaving the grid quietly short',
      )
      const shapes = await page.$eval('#root main .section:has(.shapecard)', (n) => n.textContent)
      truthy(
        shapes.includes('Jules Roy') && shapes.includes('not to scale'),
        'the grid carries its credit once and says the drawings are not to scale',
      )
      // The static register draws the same ones: the pick is SQL, not a
      // renderer's choice, so both halves show the same layout of each venue.
      const staticRegister = await (await fetch(`${BASE}/circuits`)).text()
      is(
        (staticRegister.match(/class="lapcard shapecard"/g) ?? []).length,
        drawn,
        'the static register draws the same venues',
      )
      // AX-25: sized, so a page whose CSS has not arrived draws a 200 px
      // square rather than one the width of the viewport, 79 times over.
      truthy(
        (staticRegister.match(/<svg class="outline" width="\d+" height="\d+"/g) ?? []).length === drawn,
        'every prerendered outline carries an intrinsic size',
      )
      const raceRoute = one(`SELECT '/races/' || r.year || '/' || r.round FROM races r
                               JOIN circuit_outlines o ON o.f1db_layout_id = r.f1db_layout_id
                              WHERE r.status = 'completed' ORDER BY r.year DESC LIMIT 1`)
      const staticRace = await (await fetch(`${BASE}${raceRoute}`)).text()
      truthy(
        !/<svg class="outline" viewBox/.test(staticRace) && /<svg class="outline" width=/.test(staticRace),
        'the race page\u2019s prerendered outline is sized too',
      )
    }

    // AF-23: the strip of 25 thumbnails was the third place the site drew the
    // same circuit. The cards carry what each trace measures instead, and the
    // ODbL credit travels with the figures now that no line is drawn from them.
    // The shapes above are F1DB's drawing, not the trace: the centreline is
    // still not drawn here, which is what this asks.
    if (hasGeometry) {
      await page.waitForSelector('.lapcard', { timeout: 20000 })
      const register = await page.$eval('#root main', (n) => n.textContent)
      is(
        await page.$$eval('.lapcard:not(.shapecard) svg', (n) => n.length),
        0,
        'the register does not draw the traced centrelines a third time',
      )
      is(
        await page.$$eval('.lapcard:not(.shapecard)', (n) => n.length),
        count('SELECT COUNT(DISTINCT circuit_id) FROM geo.circuit_geometry'),
        'every traced centreline has a card',
      )
      truthy(
        register.includes('OpenStreetMap contributors'),
        'the ODbL credit travels with the figures on the register',
      )
    }
  })

  await section('/circuits/silverstone', async () => {
    await go('/circuits/silverstone', 'Silverstone')
    const silverstone = await tableRows()
    truthy(
      silverstone.includes(count("SELECT COUNT(*) FROM races WHERE circuit_id = 'silverstone'")),
      'every race held at Silverstone',
    )
    // AF-03: F1DB's outline of every layout raced here - eight at
    // Silverstone, which no trace could hold - each with its credit, in the
    // app and in the static page alike. IX-32 draws one beside each timeline
    // row, so a drawing can appear more than once: every one of the eight
    // is drawn, and nothing that is not one of them.
    const outlinesHere = count("SELECT COUNT(*) FROM circuit_outlines WHERE circuit_id = 'silverstone'")
    await page.waitForSelector('#root main .outline-card svg.outline path', { timeout: 20000 })
    const drawnLabels = await page.$$eval('#root main .outline-card svg.outline', (n) => n.map((svg) => svg.getAttribute('aria-label')))
    is(new Set(drawnLabels).size, outlinesHere, 'every F1DB layout of Silverstone is drawn')
    truthy(
      await page.$$eval('#root main .outline-card figcaption', (n) => n.length > 0 && n.every((c) => c.textContent.includes('Jules Roy'))),
      'every outline carries its credit',
    )
    const staticCircuit = await (await fetch(`${BASE}/circuits/silverstone`)).text()
    is(
      (staticCircuit.match(/<figure class="outline-card">/g) ?? []).length,
      drawnLabels.length,
      'the static page draws the same outlines',
    )
    // IX-32/AF-08: the register's timeline is one list with the drawings,
    // one row per circuit_layouts row and per outline no row names, in the
    // app and - it had none at all - the static page, in the same words.
    const timelineRows = count(
      `SELECT (SELECT COUNT(*) FROM circuit_layouts WHERE circuit_id = 'silverstone')
            + (SELECT COUNT(*) FROM circuit_outlines o WHERE o.circuit_id = 'silverstone'
                  AND NOT EXISTS (SELECT 1 FROM circuit_layouts l WHERE l.circuit_id = o.circuit_id AND l.f1db_layout_id = o.f1db_layout_id))`,
    )
    const appRows = await page.$$eval('#root main .layout-timeline > article h3', (n) => n.map((h) => h.textContent))
    is(appRows.length, timelineRows, 'one row per layout in the timeline, and per drawing it does not name')
    truthy(
      !(await page.$$eval('#root main h2', (n) => n.some((h) => h.textContent.startsWith('How it changed')))),
      'the timeline is not drawn a second time as its own section',
    )
    const staticTimeline = staticCircuit.slice(staticCircuit.indexOf('<div class="timeline layout-timeline">'))
    const staticRows = [...staticTimeline.matchAll(/<h3>(.*?)<\/h3>/g)].slice(0, timelineRows).map((m) => unescaped(m[1].replace(/<[^>]+>/g, '')))
    is(JSON.stringify(staticRows), JSON.stringify(appRows), 'the static page carries the same timeline rows, in the same words and order')
    // AF-23/VD-44: the cards are all fitted to one box, so the page says they
    // are not to scale - in both renderers, from the one string.
    truthy(
      (await page.$eval('#root main', (n) => n.textContent)).includes('not to scale') &&
        staticCircuit.includes('not to scale'),
      'the app and the static page both say the outlines are not to scale',
    )
    // VD-37: the latest layout leads, drawn large, in both renderers - it
    // was the eighth card, alone under a row of seven, and 42 venues with a
    // single layout drew nothing larger than a card a sixth of the row.
    const latestHere = one(
      "SELECT f1db_layout_id FROM races WHERE circuit_id = 'silverstone' AND f1db_layout_id IS NOT NULL ORDER BY year DESC, round DESC LIMIT 1",
    )
    const leadLabel = await page.$eval('#root main .outline-set > .outline-card svg.outline', (n) => n.getAttribute('aria-label'))
    truthy(leadLabel.endsWith(`F1DB layout ${latestHere}`), `the latest layout, ${latestHere}, leads`)
    const [leadWidth, cardWidth] = await page.$eval('#root main', (n) => [
      n.querySelector('.outline-set > .outline-card svg').getBoundingClientRect().width,
      n.querySelector('.layout-timeline .outline-card svg').getBoundingClientRect().width,
    ])
    truthy(leadWidth > 2 * cardWidth, `the lead is drawn large (${Math.round(leadWidth)} px against ${Math.round(cardWidth)} px)`)
    truthy(
      staticCircuit.includes(`<div class="outline-set"><figure class="outline-card"><svg class="outline"`) &&
        new RegExp(`<div class="outline-set"><figure class="outline-card"><svg[^>]*aria-label="[^"]*F1DB layout ${latestHere}"`).test(staticCircuit),
      'the static page leads with the same layout',
    )
    // IX-31: Silverstone has no trace, and 55 of the 80 are in the same
    // position. Saying nothing made an untraced circuit and a failed download
    // the same page.
    truthy(
      (await page.$eval('#root main', (n) => n.textContent)).includes('No traced centreline for this circuit'),
      'a circuit with no trace says so',
    )

    // IX-32: at Monza the two sides disagree, and the list shows both gaps
    // as what they are - a timeline row naming no drawing, and a drawing no
    // row names - where the two sections used to leave them to be found.
    {
      const monzaStatic = await (await fetch(`${BASE}/circuits/monza`)).text()
      await go('/circuits/monza', 'Monza')
      await page.waitForSelector('#root main .layout-timeline > article', { timeout: 20000 })
      const undrawn = count("SELECT COUNT(*) FROM circuit_layouts WHERE circuit_id = 'monza' AND f1db_layout_id IS NULL")
      const unnamed = count(
        `SELECT COUNT(*) FROM circuit_outlines o WHERE o.circuit_id = 'monza'
            AND NOT EXISTS (SELECT 1 FROM circuit_layouts l WHERE l.circuit_id = o.circuit_id AND l.f1db_layout_id = o.f1db_layout_id)`,
      )
      truthy(undrawn > 0 && unnamed > 0, 'Monza still has a row with no drawing and a drawing with no row')
      is(await page.$$eval('#root main .layout-timeline .outline-none', (n) => n.length), undrawn, `the ${undrawn} undrawn layouts say so`)
      is(
        await page.$$eval('#root main .layout-timeline h3', (n, words) => n.filter((h) => h.textContent.startsWith(words)).length, NO_TIMELINE_ROW),
        unnamed,
        `the ${unnamed} drawings the timeline does not name say so`,
      )
      truthy(
        monzaStatic.split(`<p class="outline-none">${NO_DRAWING}</p>`).length - 1 === undrawn &&
          monzaStatic.split(`<h3>${NO_TIMELINE_ROW.replace(/'/g, '&#39;')}`).length - 1 === unnamed,
        'the static page shows the same two gaps',
      )
    }

    // Skipped rather than failed when the overlay is absent: a build without
    // f1-geometry.db is a legitimate one, and the track maps are the only thing
    // it costs. Everything inside needs the centrelines.
    if (!hasGeometry) {
      note('\n(no f1-geometry.db — skipping the traced-circuit checks)')
    } else {
      const traced = one('SELECT circuit_id FROM geo.circuit_geometry WHERE closes = 1 ORDER BY node_count DESC LIMIT 1')

      note(`\n/circuits/${traced}  (traced geometry)`)
      await go(`/circuits/${traced}`)
      await page.waitForSelector('#root main a[href*="openstreetmap.org/relation"]', { timeout: 20000 })
      const relation = one('SELECT osm_relation FROM geo.circuit_geometry WHERE circuit_id = ?', traced)
      const measured = one('SELECT measured_km FROM geo.circuit_geometry WHERE circuit_id = ?', traced)
      const traceText = await page.$eval('#root main', (n) => n.textContent)
      truthy(
        await page.$(`#root main a[href="https://www.openstreetmap.org/relation/${relation}"]`),
        'the relation the trace came from is named and linked',
      )
      truthy(traceText.includes(`${measured.toFixed(3)} km`), 'the measured length is the one the build stored')
      truthy(traceText.includes('OpenStreetMap contributors'), 'the ODbL attribution travels with the figures')
      // AF-23: one circuit, one picture. The trace is not drawn a second time
      // beside the outlines, here or anywhere.
      truthy(!(await page.$('svg.lapfigure')), 'the trace is stated, not drawn again')
      const headings = await page.$$eval('#root main h2', (n) => n.map((h) => h.textContent))
      const outlineAt = headings.findIndex((h) => h.startsWith('Every layout raced here'))
      const traceAt = headings.findIndex((h) => h.startsWith('Traced and measured'))
      truthy(outlineAt >= 0 && traceAt > outlineAt, 'the outlines lead and the trace follows them')
      pass(`the overlay merged in the browser — ${traced} read its figures from f1-geometry.db`)
    }

  })

  // ----------------------------------------------------------- grands prix

  // IA-01: the event a race is an edition of, which had a table, a view and
  // no page. Three ways in - the race page's Grand Prix field, the circuit
  // page's race list and /races - and the event's own page holding what no
  // circuit page can: the French Grand Prix's seven venues on one page.
  await section('/grands-prix  (the event, across its venues)', async () => {
    await go('/grands-prix', 'Grands Prix')
    is((await tableRows())[0], count('SELECT COUNT(*) FROM grands_prix'), 'every Grand Prix in the register')

    await go('/grands-prix/french', 'French Grand Prix')
    is(
      await rowsUnder('Where it has been held'),
      count("SELECT COUNT(DISTINCT circuit_id) FROM races WHERE gp_id = 'french'"),
      'every circuit the French Grand Prix has used',
    )
    is(
      await rowsUnder('Every edition'),
      count("SELECT COUNT(*) FROM races WHERE gp_id = 'french'"),
      'and every edition of it',
    )

    // A venue booked and not yet raced is a row, marked, and is not counted
    // among the circuits the event has used.
    const booked = db
      .prepare(`SELECT gp_id FROM races GROUP BY gp_id, circuit_id HAVING SUM(status = 'completed') = 0 LIMIT 1`)
      .get()?.gp_id
    if (booked) {
      await go(`/grands-prix/${booked}`)
      const venues = await page.$$eval('#root main h2', (nodes) =>
        nodes.find((h) => h.textContent.startsWith('Where it has been held'))?.closest('section')?.textContent ?? '',
      )
      truthy(venues.includes(NOT_YET_RUN) && venues.includes('to come'), `/grands-prix/${booked}: a booked venue is marked, and counted apart`)
    } else pass('no Grand Prix is booked at a venue it has not raced at')

    // The race page's field, which was dead text, in both renderers.
    const british = db.prepare("SELECT year, round FROM races WHERE gp_id = 'british' AND status = 'completed' ORDER BY year LIMIT 1").get()
    await go(`/races/${british.year}/${british.round}`, 'British Grand Prix')
    truthy(
      (await page.$$eval('#root main dl.fields a', (nodes) => nodes.map((a) => a.getAttribute('href')))).includes('/grands-prix/british'),
      'a race page links its Grand Prix',
    )
    truthy(
      (await (await fetch(`${BASE}/races/${british.year}/${british.round}`)).text()).includes('href="/grands-prix/british"'),
      'and so does its static page',
    )

    // The circuit page's race list names the events held there.
    await go('/circuits/silverstone', 'Silverstone')
    truthy(
      (await page.$$eval('#root main p.measure a', (nodes) => nodes.map((a) => a.getAttribute('href')))).includes('/grands-prix/british'),
      'a circuit page links the Grands Prix held there',
    )
    truthy(
      (await (await fetch(`${BASE}/circuits/silverstone`)).text()).includes('href="/grands-prix/british"'),
      'and so does its static page',
    )

    // And /races offers the way in.
    await go('/races', 'Races')
    truthy(
      (await page.$$eval('#root main nav.onward a', (nodes) => nodes.map((a) => a.getAttribute('href')))).includes('/grands-prix'),
      '/races leads to the Grands Prix',
    )
  })

  // ------------------------------------------------------------------ cars

  await section('/cars', async () => {
    await go('/cars', 'Cars')
    is((await tableRows())[0], count('SELECT COUNT(*) FROM chassis'), 'the chassis register')

    // AX-22: each card's frame and heading are links to one page. The heading
    // is the one a keyboard or a screen reader meets; the frame is hidden from
    // both, so a card is one tab stop, not two with the same destination.
    {
      const cards = await page.$$eval('#root main .carcard', (els) =>
        els.map((card) => {
          const reachable = [...card.querySelectorAll('a[href]')].filter(
            (a) => a.tabIndex >= 0 && !a.closest('[aria-hidden="true"]'),
          )
          return reachable.filter((a) => a.getAttribute('href').startsWith('/cars/')).length
        }),
      )
      is(cards.length, count('SELECT COUNT(*) FROM cars'), 'a card per curated car')
      truthy(
        cards.every((n) => n === 1),
        `every card reaches its car page once from the keyboard (${cards.join(',')})`,
      )
    }

    // IA-19: 1,153 rows opening on 1950, and no route at all to this year's
    // chassis until now. The register's own Raced span is the test, because
    // season_entries carries the car as the team names it and will not join.
    {
      const season = one("SELECT value FROM meta WHERE key = 'current_season'")
      const thisYear = count(
        'SELECT COUNT(*) FROM chassis WHERE first_year <= ? AND last_year >= ?',
        season,
        season,
      )
      truthy(thisYear > 0, `there are ${season} chassis to keep`)
      const group = '[role="group"][aria-label="Filter cars by kind"]'
      truthy(
        await page.$(`${group} button:has-text("On the ${season} grid")`),
        'the chip is the one /drivers and /constructors carry, in the same words',
      )
      await page.click(`${group} button:has-text("On the ${season} grid")`)
      await page.waitForFunction(
        (n) => document.querySelector('#root main .table-wrap')?.dataset.rows === String(n),
        thisYear,
        { timeout: 10000 },
      )
      is((await tableRows())[0], thisYear, `the grid chip keeps the ${thisYear} chassis raced in ${season}`)
    }
  })

  // Six ids name a car that no single chassis shares an id with. No race entry
  // is ever attributed to `lotus-72` itself, so a page that queries only that
  // id shows nothing and then reports a discrepancy it invented.
  await section('/cars/lotus-72  (a car, not a chassis)', async () => {
    await go('/cars/lotus-72')
    const variants = count("SELECT COUNT(*) FROM chassis WHERE car_id = 'lotus-72'")
    atLeast(variants, 2, 'the car covers several chassis variants')
    const lotus = await tableRows()
    truthy(
      lotus.includes(
        count(
          `SELECT COUNT(*) FROM race_entries
          WHERE chassis_id IN (SELECT id FROM chassis WHERE car_id = 'lotus-72')`,
        ),
      ),
      'its entries are the variants added together',
    )

  })

  /*
   * IA-06. Four curated cars are one chassis under another id
   * (`mercedes-w11` is the chassis `mercedes-f1-w11`), so two addresses draw
   * one page. The chassis address names the car's as canonical - in the
   * static head, in the app's after the database opens, and in the citation -
   * and only the car's is in the sitemap. A variant of a design of several is
   * its own subject and keeps its own. The set is read out of f1.db, so it
   * holds as the curated register grows.
   */
  await section('/cars/<chassis> that is the whole of a curated car  (one car, one address)', async () => {
    const copies = db
      .prepare(
        `SELECT ch.id AS chassis, c.id AS car
           FROM cars c JOIN chassis ch ON ch.car_id = c.id
          WHERE NOT EXISTS (SELECT 1 FROM chassis y WHERE y.id = c.id)
            AND (SELECT COUNT(*) FROM chassis x WHERE x.car_id = c.id) = 1
          ORDER BY c.id`,
      )
      .all()
    atLeast(copies.length, 1, 'some curated car is a single chassis under another id')
    const canonicalOf = (html) => {
      const href = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
      return href ? new URL(href).pathname : null
    }
    const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text())
    const wrong = []
    for (const { chassis, car } of copies) {
      const html = await (await fetch(`${BASE}/cars/${chassis}`)).text()
      if (canonicalOf(html) !== `/cars/${car}`) wrong.push(`/cars/${chassis}: static canonical ${canonicalOf(html)}`)
      if (!new RegExp(`<span class="url">[^<]*/cars/${car}</span>`).test(html)) {
        wrong.push(`/cars/${chassis}: the static citation does not name /cars/${car}`)
      }
      if (sitemap.includes(`/cars/${chassis}</loc>`)) wrong.push(`/cars/${chassis} is in the sitemap`)
      if (!sitemap.includes(`/cars/${car}</loc>`)) wrong.push(`/cars/${car} is not in the sitemap`)
      const own = await (await fetch(`${BASE}/cars/${car}`)).text()
      if (canonicalOf(own) !== `/cars/${car}`) wrong.push(`/cars/${car}: static canonical ${canonicalOf(own)}`)
    }
    is(wrong.join('; '), '', `all ${copies.length} name the car's page as canonical, and only it is in the sitemap`)

    const appCanonical = () => page.$eval('link[rel=canonical]', (node) => new URL(node.href).pathname)
    const appCited = () => page.$eval('#root .cite .url', (node) => new URL(node.textContent).pathname)
    const { chassis, car } = copies[0]
    await go(`/cars/${chassis}`)
    is(await appCanonical(), `/cars/${car}`, `the app keeps /cars/${chassis}'s canonical on /cars/${car}`)
    is(await appCited(), `/cars/${car}`, 'and cites that address')
    await go('/cars/lotus-72b', 'Lotus 72B')
    is(await appCanonical(), '/cars/lotus-72b', 'a variant of a design of several is its own canonical')
  })

  await section('/cars/mclaren-mp4-4', async () => {
    await go('/cars/mclaren-mp4-4', 'McLaren MP4/4')
    const mp44 = await tableRows()
    truthy(
      mp44.includes(count("SELECT COUNT(*) FROM race_entries WHERE chassis_id = 'mclaren-mp4-4'")),
      'every entry the MP4/4 made',
    )
    // The stat, not just the table. Car.jsx enumerates the columns it selects,
    // and a figure derived from a column that query forgot renders as a
    // confident zero -- which is what happened when pole became its own flag.
    // The MP4/4 is the car for this: fifteen poles, every one linked.
    const mp44Poles = await page.$$eval('#root main dt', (dts) => {
      const dt = dts.find((d) => d.textContent.trim() === 'Poles')
      return dt?.nextElementSibling?.textContent?.trim() ?? null
    })
    is(
      Number(mp44Poles),
      count("SELECT COUNT(*) FROM race_entries WHERE chassis_id = 'mclaren-mp4-4' AND pole = 1"),
      'the poles stat is counted from the entries',
    )

    // A licence violation is the failure mode here, so this is asserted rather
    // than eyeballed. EVERY photograph on the page has to carry its credit, not
    // just one of them: an earlier version of this checked that SOME caption
    // mentioned the licence, which a page showing six images and crediting one
    // would have passed.
    const shown = await page.$$eval('figure.photo', (figures) =>
      figures.map((figure) => ({
        file: figure.querySelector('figcaption a')?.textContent?.trim() ?? '',
        caption: figure.querySelector('figcaption')?.textContent ?? '',
      })),
    )
    atLeast(shown.length, 1, 'the car page shows at least one photograph')

    const credited = db.prepare(
      `SELECT file_name, licence,
            COALESCE(NULLIF(TRIM(COALESCE(artist, '')), ''),
                     NULLIF(TRIM(COALESCE(credit, '')), '')) AS credit
       FROM article_images WHERE article = 'McLaren MP4/4'`,
    ).all()
    const byTitle = new Map(
      credited.map((row) => [row.file_name.replace(/^File:/, '').replace(/_/g, ' '), row]),
    )
    const uncredited = shown.filter((figure) => {
      const row = byTitle.get(figure.file)
      if (!row) return false          // a photograph from elsewhere on the page
      return !figure.caption.includes(row.licence) || !figure.caption.includes(row.credit)
    })
    if (uncredited.length === 0) {
      pass(`all ${shown.length} photograph(s) carry their licence and their credit`)
    } else {
      uncredited.forEach((figure) => fail(`photograph shown without full credit: ${figure.file}`))
    }

  })

  // ------------------------------------------------------------- reference

  // 339 of the 1,153 chassis have nothing in any of the eighteen
  // specification fields, and the section drew eighteen em dashes: eighteen
  // claims that nobody had established a figure, where the truth is one claim
  // about the car (CD-37).
  await section('a car with no published specification', async () => {
    const bare = db
      .prepare(
        `SELECT ch.id FROM chassis ch LEFT JOIN cars c ON c.id = ch.car_id
          WHERE ch.chassis_type IS NULL AND ch.susp_front IS NULL AND ch.susp_rear IS NULL
            AND COALESCE(ch.brakes, c.brakes) IS NULL AND ch.gearbox IS NULL AND ch.gears IS NULL
            AND COALESCE(ch.tyres, c.tyres) IS NULL AND ch.fuel IS NULL
            AND COALESCE(ch.engine_name, c.engine_name) IS NULL
            AND COALESCE(ch.engine_config, c.engine_config) IS NULL
            AND COALESCE(ch.capacity_cc, c.capacity_cc) IS NULL
            AND COALESCE(ch.aspiration, c.aspiration) IS NULL
            AND ch.power_bhp IS NULL AND COALESCE(ch.power_note, c.power_note) IS NULL
            AND ch.weight_kg IS NULL AND ch.wheelbase_mm IS NULL
            AND ch.track_front_mm IS NULL AND ch.track_rear_mm IS NULL
          ORDER BY ch.id LIMIT 1`,
      )
      .get()
    if (!bare) {
      note('every chassis carries a specification — nothing to check')
    } else {
      await go(`/cars/${bare.id}`, null)
      const labels = await page.$$eval('#root main dt', (dts) => dts.map((dt) => dt.textContent.trim()))
      truthy(
        (await page.$eval('#root main', (node) => node.textContent)).includes(
          'No specification is published for this car',
        ),
        `the empty specification is one sentence — /cars/${bare.id}`,
      )
      truthy(!labels.includes('Wheelbase'), 'and not eighteen em dashes')
    }
    // And a car that has one still lists every field, blanks included.
    await go('/cars/mclaren-mp4-4', 'McLaren MP4/4')
    truthy(
      (await page.$$eval('#root main dt', (dts) => dts.map((dt) => dt.textContent.trim()))).includes('Wheelbase'),
      'a specified car keeps its fields',
    )

  })

  await section('/records', async () => {
    await go('/records', 'Records')
    is((await tableRows())[0], count('SELECT COUNT(*) FROM records'), 'published records')
    atLeast(await page.$$eval('#root main .figure svg', (n) => n.length), 4, 'the leaderboards drew')

  })

  // The front door. The version and build date it states are read from the
  // same meta table the file carries, so the page and the database cannot
  // disagree about which edition this is.
  await section('/data  (the front door)', async () => {
    await go('/data', 'Data')
    const edition = one(`SELECT value FROM meta WHERE key = 'version'`)
    const dataText = await page.$eval('#root main', (n) => n.textContent)
    truthy(dataText.includes(`v${edition}`), `the data page states the database version — v${edition}`)
    truthy(dataText.includes(one(`SELECT value FROM meta WHERE key = 'built'`)), 'and the build date')
    atLeast(await page.$$eval('#root main a[href$="/f1.db"]', (n) => n.length), 1, 'it links the database')
    atLeast(
      await page.$$eval('#root main a[href$="/f1-geometry.db"]', (n) => n.length),
      1,
      'and the geometry file beside it',
    )
    atLeast(await page.$$eval('#root main a[href$="/f1-parquet.zip"]', (n) => n.length), 1, 'and the Parquet bundle')

    // SD-01: the documents that explain the file, linked from the page that
    // offers the file and actually served. A link is not the claim - the
    // claim is that whoever took the data can read its terms from where they
    // took it - so each is fetched and its FIRST LINE compared with the file
    // at the repository root. A status alone would pass on the SPA fallback,
    // which answers any unknown path with index.html and a 200. The list is
    // site.js's, so the app, the static page and this test cannot disagree
    // about which three.
    const headers = readFileSync(join(here, '..', 'dist', '_headers'), 'utf8')
    for (const [file] of DOCUMENTS) {
      atLeast(
        await page.$$eval(`#root main a[href$="/${file}"]`, (n) => n.length),
        1,
        `the data page links ${file}`,
      )
      const served = await fetch(`${BASE}/${file}`)
      is(served.status, 200, `and ${file} is served`)
      const first = (line) => line.split('\n')[0].trim()
      is(
        first(await served.text()),
        first(readFileSync(join(here, '..', '..', file), 'utf8')),
        `and what is served is the file at the repository root, not the app shell`,
      )
      // vite preview does not read _headers - Cloudflare does - so the rule
      // is checked where it is written. Without it LICENSE-DATA has no
      // extension to guess from and lands in a downloads folder unread.
      truthy(
        new RegExp(`^/${file}\\n  Content-Type: text/`, 'm').test(headers),
        `and _headers serves ${file} as text rather than as a download`,
      )
    }
    // SD-04: the inbound channel, on every page rather than on this one.
    const reportHref = await page.$$eval('#root footer.sitefoot a[href*="/issues/new"]', (n) => n.length)
    atLeast(reportHref, 1, 'the footer offers a way to report something wrong')
    const staticData = await (await fetch(`${BASE}/data`)).text()
    truthy(staticData.includes('/issues/new'), 'and the prerendered page carries the same one')

    // The masthead stays at eight, and the slot that read Reference reads Data.
    const masthead = await page.$$eval('#root header.masthead nav a', (nodes) => nodes.map((n) => n.textContent.trim()))
    is(masthead.length, 8, 'the masthead has eight items')
    truthy(
      masthead.includes('Data') && !masthead.includes('Reference'),
      'and "Data" is one of them, where "Reference" was',
    )

  })

  await section('/data/quality', async () => {
    await go('/data/quality', 'Data quality')
    const quality = await tableRows()
    // Each group's heading carries its count, so the three states are pinned
    // by name rather than by a row count another table could match.
    const gapHeadings = await page.$$eval('#root main h2', (hs) => hs.map((h) => h.textContent.replace(/\s+/g, ' ').trim()))
    for (const [state, label] of [['open', 'Open gaps'], ['position', 'Positions, not gaps'], ['closed', 'Closed']]) {
      const n = count("SELECT COUNT(*) FROM known_gaps WHERE state = ?", state)
      truthy(
        gapHeadings.some((h) => h.startsWith(label) && h.endsWith(String(n))),
        `the ${label} heading carries the count from the register (${n})`,
      )
    }
    truthy(quality.includes(count('SELECT COUNT(*) FROM v_open_gaps')), 'the open gaps are published')
    truthy(
      quality.includes(count('SELECT COUNT(*) FROM discrepancies')),
      'the recorded disagreements are published',
    )

    // The old section address, in-app: a link written before the move.
    await go('/reference', 'Data')
    is(await page.evaluate(() => location.pathname), '/data', 'the old /reference address lands on /data')

  })

  await section('/data/sources', async () => {
    await go('/data/sources', 'Sources')
    truthy(
      (await tableRows()).includes(count('SELECT COUNT(*) FROM source_registry')),
      'every source is listed with its licence',
    )

  })

  /*
   * SD-20: the return path. The feed is the one artefact here that no reader
   * ever looks at directly - a feed reader does - so nothing but a test will
   * notice it going wrong. What is checked is that it is well-formed, that its
   * entry ids are unique (a repeated id is how a feed silently stops
   * notifying), and that the entry for the current build carries the
   * database's own figures rather than a copy that could drift.
   */
  await section('/changes  (what moved, and the feed)', async () => {
    await go('/changes', 'What changed')

    const meta = (key) => one('SELECT value FROM meta WHERE key = ?', key)
    const shown = await page.$eval('#root main', (node) => node.textContent.replace(/\s+/g, ' '))
    truthy(shown.includes(`v${meta('version')}`), `the app names the database it is running on (v${meta('version')})`)
    truthy(shown.includes(meta('built')), `and the date it was built (${meta('built')})`)
    // SD-25. The build date alone cannot tell a quiet week from a dead
    // refresh, so the check date is shown beside it - and it comes from
    // committed source rather than from meta, which is exactly why it needs
    // checking on both renderers rather than assumed to travel with the file.
    // Matched against the label, never a bare date: on a morning the harvest
    // moved, BUILT and LAST_CHECKED are the same day, and a bare-date test
    // would be satisfied by the `Built` row alone - on precisely the morning
    // refresh.yml runs this suite.
    const checkedDd = await page.$$eval(
      '#root main dl dt',
      (dts, label) =>
        dts
          .filter((dt) => dt.textContent.trim() === label)
          .map((dt) => dt.nextElementSibling?.textContent.trim() ?? null),
      CHECKED_LABEL,
    )
    is(
      checkedDd.join(),
      LAST_CHECKED,
      `and when the sources were last checked, under its own label (${CHECKED_LABEL})`,
    )
    truthy(
      (await (await fetch(`${BASE}/changes`)).text())
        .includes(`<dt>${CHECKED_LABEL}</dt><dd>${LAST_CHECKED}</dd>`),
      'and the prerendered page says the same, in its own markup',
    )

    const run = count(
      'SELECT COUNT(*) FROM races r WHERE EXISTS (SELECT 1 FROM race_entries e WHERE e.race_id = r.id)',
    )
    truthy(shown.includes(run.toLocaleString()), `and how many races it holds the classification of (${run.toLocaleString()})`)

    // The release table is a committed record, not a query, so the one thing
    // worth checking is that the two renderers show the same rows: a release
    // added to lib/changes.js reaches the app and the prerendered page alike.
    //
    // Compared cell by cell rather than by row count, and located by its own
    // heading rather than by being the first table in the document, so that a
    // table added above it moves neither the assertion nor its meaning.
    const cells = (html) => {
      const after = html.slice(html.indexOf('Released versions'))
      const body = (after.match(/<tbody>[\s\S]*?<\/tbody>/) ?? [''])[0]
      return [...body.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((tr) =>
        [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
          .map((td) => td[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
          .join(' | '),
      )
    }
    const staticCells = cells(await (await fetch(`${BASE}/changes`)).text())
    const appCells = await page.$$eval('#root main table tbody tr', (trs) =>
      trs.map((tr) =>
        [...tr.querySelectorAll('td, th')]
          .map((td) => td.textContent.replace(/\s+/g, ' ').trim())
          .join(' | '),
      ),
    )
    atLeast(staticCells.length, 1, 'the prerendered release table has rows')
    is(
      appCells.join('\n'),
      staticCells.join('\n'),
      'and the app shows the same releases, cell for cell',
    )

    // The feed.
    const feed = await fetch(`${BASE}/feed.xml`)
    is(feed.status, 200, 'the feed is served')
    const xml = await feed.text()
    truthy(xml.startsWith('<?xml'), 'and it is XML')
    truthy(xml.includes('xmlns="http://www.w3.org/2005/Atom"'), 'and it is Atom')

    const ids = [...xml.matchAll(/<id>([^<]+)<\/id>/g)].map((m) => m[1])
    // One feed id plus one per entry; every one distinct, or a reader that has
    // seen an entry once will never be told about its successor.
    is(ids.length, new Set(ids).size, `every id in the feed is distinct (${ids.length})`)

    const entries = xml.match(/<entry>/g) ?? []
    atLeast(entries.length, 1, 'the feed has entries in it')
    truthy(
      xml.includes(`tag:lapledger.org,2026:db/${meta('version')}/${meta('built')}`),
      'the current build has an entry of its own, keyed on the version and the build date',
    )
    truthy(
      xml.includes(`${run.toLocaleString()} races run`),
      'and its summary carries the figure the database gives, not a stored copy',
    )

    // Discoverable from anywhere, not only from /changes: the head link is
    // what a browser and a feed reader look for, and it is on every page.
    for (const route of ['/', '/drivers/senna', '/changes']) {
      const html = await (await fetch(`${BASE}${route}`)).text()
      truthy(
        /<link rel="alternate" type="application\/atom\+xml"[^>]*href="[^"]*feed\.xml"/.test(html),
        `${route} points a feed reader at the feed`,
      )
    }

    const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text()
    truthy(sitemap.includes('/feed.xml</loc>'), 'and the sitemap lists it')

    // vite preview does not read _headers - Cloudflare does - so the rule is
    // checked where it is written, as the download rules above are.
    truthy(
      /^\/feed\.xml\n  Content-Type: application\/atom\+xml/m.test(
        readFileSync(join(here, '..', 'public', '_headers'), 'utf8'),
      ),
      'and _headers serves it as atom+xml rather than as plain XML',
    )

  })

  /*
   * UR-05. The one page on the site that is about the site: a reader who
   * wants to cite these figures, or an editor deciding whether they may be
   * cited, needs a publisher, an editorial rule and a way in - and got a
   * footer crediting F1DB and nothing else.
   *
   * What is asserted is what the page exists to carry: that both renderers
   * name the same person, that every section of the shared prose reaches
   * both, and that the way in is on the page rather than only in the footer.
   * The prose itself is site.js's and is not restated here.
   */
  await section('/about  (who publishes this)', async () => {
    await go('/about', 'About')
    const shown = await page.$eval('#root main', (node) => node.textContent.replace(/\s+/g, ' '))
    truthy(shown.includes(MAINTAINER), `the app names who publishes this (${MAINTAINER})`)
    for (const { title } of ABOUT) truthy(shown.includes(title), `and asks "${title}"`)
    truthy(
      await page.$('#root main a[href*="template=report.yml"]'),
      'and the way to say something is wrong is on the page, not only in the footer',
    )

    // Cold, before any of the 20 MB has loaded: this page answers a reader
    // who has not decided to trust the site yet, so it has to answer without
    // the database. Every section, not a sample - the static half losing one
    // is exactly the drift the shared prose exists to prevent.
    const cold = await (await fetch(`${BASE}/about`)).text()
    truthy(cold.includes(MAINTAINER), 'the prerendered page names the same person')
    for (const { title, paragraphs } of ABOUT) {
      truthy(cold.includes(title), `the prerendered page carries "${title}"`)
      for (const paragraph of paragraphs) {
        truthy(
          cold.replace(/&#39;|&#x27;/g, "'").includes(paragraph.slice(0, 60)),
          `and its opening words: "${paragraph.slice(0, 40)}…"`,
        )
      }
    }
    truthy(
      /<script type="application\/ld\+json">[^<]*"@type":"AboutPage"/.test(cold),
      'and describes itself to a search engine as an AboutPage',
    )
    truthy(
      (await (await fetch(`${BASE}/sitemap.xml`)).text()).includes('/about</loc>'),
      'and the sitemap lists it, because it is a page to index',
    )

    // The footer is the route to it from all 3,545 other pages, and the
    // reader who wants it is on one of those rather than here.
    for (const route of ['/', '/drivers/senna']) {
      const html = await (await fetch(`${BASE}${route}`)).text()
      truthy(/<footer[\s\S]*href="\/about"/.test(html), `${route} links to it from the footer`)
    }
  })

  await section('/reference/glossary', async () => {
    await go('/reference/glossary', 'Glossary')
    // The glossary's own rows and the confidence ladder's, which the page
    // reads from `provenance` rather than holding a second wording (CD-09).
    const terms = count('SELECT (SELECT COUNT(*) FROM glossary) + (SELECT COUNT(*) FROM provenance)')
    is((await tableRows())[0], terms, 'glossary terms, and every confidence tier among them')
    // IX-28's sentence is composed by each page, so each page is where it can
    // be read; /drivers proves the component, not the six phrasings. This is
    // the register whose filter values are not noun phrases - `sporting`,
    // `power unit` - which is the case the template has to survive.
    {
      const category = one('SELECT category FROM glossary WHERE category IS NOT NULL ORDER BY category LIMIT 1')
      const group = '[role="group"][aria-label="Filter terms by category"]'
      await page.click(`${group} button:text-is("${category}")`)
      await page.fill('input[type="search"]', 'zzzz-no-such-term')
      await page.waitForSelector('#root main .state.is-empty', { timeout: 10000 })
      is(
        await page.$eval('#root main .state.is-empty p', (node) => node.textContent.trim()),
        `No term matches “zzzz-no-such-term” among terms in the ${category} category.`,
        'the glossary empty state names both filters, and names the category as a category',
      )
      await page.click('#root main .state.is-empty button')
      // Not "a row exists": the people below the glossary always have rows,
      // so that was satisfied by the page as it already stood, and the count
      // could be read while the glossary was still empty. The empty state
      // going is the restoration itself.
      await page.waitForFunction(() => !document.querySelector('#root main .state.is-empty'), null, { timeout: 10000 })
      is(
        (await tableRows())[0],
        terms,
        'Clear filters brings the whole glossary back, category chip and search box both',
      )
    }

    // Where a results header's link arrives (CD-09, IA-12): the codes, and
    // only the codes, with the chip that says so pressed.
    await go('/reference/glossary?category=results', 'Glossary')
    is(
      (await tableRows())[0],
      count("SELECT COUNT(*) FROM glossary WHERE category = 'results'"),
      'the results key arrives on the results terms alone',
    )

  })

  await section('/reference/eras', async () => {
    await go('/reference/eras', 'Eras')
    truthy(
      (await tableRows()).includes(count('SELECT COUNT(*) FROM regulation_changes')),
      'every regulation change is listed',
    )

  })

  // AF-23: the trace is the measurement, not a second drawing of a shape the
  // F1DB outlines already draw. What the page prints is what the build
  // stored, and a trace with a hole in it says so rather than claiming a lap.
  await section('/circuits/spa  (the trace, stated not drawn)', async () => {
    await go('/circuits/spa', 'Circuit de Spa-Francorchamps')
    await page.waitForSelector('#root main a[href*="openstreetmap.org/relation"]', { timeout: 20000 })
    const spa = await page.$eval('#root main', (n) => n.textContent)
    truthy(spa.includes('closes into one lap'), 'a trace that closes says it closes')
    truthy(
      spa.includes(`${one("SELECT published_km FROM geo.circuit_geometry WHERE circuit_id = 'spa'").toFixed(3)} km published here`),
      'the measurement is stated against the length this register publishes',
    )
    // A trace that does not close claims no lap, and says how it is broken.
    const open = one('SELECT circuit_id FROM geo.circuit_geometry WHERE closes = 0 ORDER BY node_count DESC LIMIT 1')
    const ends = one('SELECT loose_ends FROM geo.circuit_geometry WHERE circuit_id = ?', open)
    await go(`/circuits/${open}`)
    await page.waitForSelector('#root main a[href*="openstreetmap.org/relation"]', { timeout: 20000 })
    const broken = await page.$eval('#root main', (n) => n.textContent)
    truthy(
      broken.includes('does not close') && broken.includes(`${ends} loose way end`),
      `a trace that does not close (${open}) says so, and how many ends are loose`,
    )

  })

  // At a phone width the register opens on its phone set, and a table a
  // reader has made wider than the screen says so; the masthead shows every
  // destination rather than a strip with a hidden scrollbar.
  await section('/drivers/senna  (team-mates, head to head: PD-43)', async () => {
    await go('/drivers/senna', 'Ayrton Senna')
    // The pairing counted a second way: one row per Grand Prix, compared here
    // in JavaScript, rather than through TEAM_MATES's grouped TOTALs - so a
    // comparison written the wrong way round in the query, or a race counted
    // that one side was not classified in, shows up as a different figure.
    const pair = (a, b, year) => {
      const races = db
        .prepare(
          `SELECT e.finish_position AS mine, o.finish_position AS theirs,
                  qa.position AS qmine, qb.position AS qtheirs, e.points AS p, o.points AS op
             FROM race_entries e
             JOIN races r ON r.id = e.race_id
             JOIN race_entries o ON o.race_id = e.race_id AND o.driver_id = ? AND o.constructor_id = e.constructor_id
             LEFT JOIN qualifying qa ON qa.race_id = e.race_id AND qa.driver_id = e.driver_id
             LEFT JOIN qualifying qb ON qb.race_id = e.race_id AND qb.driver_id = o.driver_id
            WHERE e.driver_id = ? AND (? IS NULL OR r.year = ?)`,
        )
        .all(b, a, year, year)
      const both = (x, y) => typeof x === 'number' && typeof y === 'number'
      const tally = (key, other) => [
        races.filter((r) => both(r[key], r[other]) && r[key] < r[other]).length,
        races.filter((r) => both(r[key], r[other]) && r[key] > r[other]).length,
      ]
      return {
        races: races.length,
        qualifying: tally('qmine', 'qtheirs'),
        race: tally('mine', 'theirs'),
        classified: races.filter((r) => both(r.mine, r.theirs)).length,
        points: [races.reduce((s, r) => s + (r.p ?? 0), 0), races.reduce((s, r) => s + (r.op ?? 0), 0)],
      }
    }
    const want = pair('senna', 'prost', 1988)
    truthy(want.races > 0, `Senna and Prost share ${want.races} Grands Prix at McLaren in 1988`)
    const row = await page.$$eval(
      '#root main h2',
      (nodes) => {
        const h2 = nodes.find((node) => node.textContent.trim().startsWith('Team-mates'))
        const tr = [...(h2?.closest('section')?.querySelectorAll('tbody tr') ?? [])].find((r) =>
          r.textContent.includes('Alain Prost') && r.textContent.startsWith('1988'),
        )
        return tr ? [...tr.children].map((c) => c.textContent.trim()) : null
      },
    )
    is(
      row?.join(' | '),
      ['1988', 'Alain Prost', 'McLaren', String(want.races), want.qualifying.join('–'), want.race.join('–'), want.points.join('–')].join(' | '),
      'the 1988 McLaren pairing reads as the races, compared one by one, add up',
    )
    // The count is team-mates, not rows: Berger is three seasons and one driver.
    const mates = count(
      `SELECT COUNT(DISTINCT o.driver_id) FROM race_entries e
         JOIN race_entries o ON o.race_id = e.race_id AND o.constructor_id = e.constructor_id AND o.driver_id <> e.driver_id
        WHERE e.driver_id = 'senna'`,
    )
    truthy(
      (await text('#root main section:has(h2:text-matches("^Team-mates")) h2 .count')) === `${mates} team-mates`,
      `the heading counts ${mates} different team-mates`,
    )
    truthy(
      await page.$('#root main a[href="/compare?a=senna"]'),
      'and the section links to /compare with Senna already chosen',
    )
    // A career with no team-mate on the record has no section at all, as the
    // static page has none: a heading over an empty table says nothing.
    const alone = db
      .prepare(
        `SELECT d.id, d.full_name FROM drivers d
          WHERE EXISTS (SELECT 1 FROM race_entries e WHERE e.driver_id = d.id)
            AND NOT EXISTS (SELECT 1 FROM race_entries e JOIN race_entries o
                              ON o.race_id = e.race_id AND o.constructor_id = e.constructor_id AND o.driver_id <> e.driver_id
                             WHERE e.driver_id = d.id)
          ORDER BY d.id LIMIT 1`,
      )
      .get()
    if (alone) {
      await go(`/drivers/${alone.id}`, alone.full_name)
      is(await rowsUnder('Team-mates'), null, `a career with no team-mate has no Team-mates section — /drivers/${alone.id}`)
      truthy(
        !(await (await fetch(`${BASE}/drivers/${alone.id}`)).text()).includes('<h2>Team-mates</h2>'),
        'and neither does its static page',
      )
    }
  })

  await section('/compare  (two drivers side by side: PD-43)', async () => {
    await go('/compare?a=senna&b=prost', 'Ayrton Senna and Alain Prost')
    is(await page.title(), 'Ayrton Senna and Alain Prost — Lap Ledger', 'the pair names the document, in the order the address gives it')
    // The query string is this page, so the citation carries it: without it
    // the cited address is two empty pickers (review of #634).
    truthy(
      (await text('#root main .cite .url'))?.endsWith('/compare?a=senna&b=prost'),
      `the citation names the pair — ${await text('#root main .cite .url')}`,
    )
    // The careers table is DERIVED's figures, the driver pages' own.
    const careers = await page.$$eval('#root main section:has(h2:text-is("Two careers")) tbody tr', (trs) =>
      Object.fromEntries(trs.map((tr) => [tr.children[0].textContent.trim(), [...tr.children].slice(1).map((c) => c.textContent.trim())])),
    )
    const wins = (id) => String(count('SELECT COUNT(*) FROM race_entries WHERE driver_id = ? AND finish_position = 1', id))
    is(careers.Wins?.join(' | '), `${wins('senna')} | ${wins('prost')}`, 'Wins are counted from the race records for each driver')
    const entries = (id) => String(count('SELECT COUNT(*) FROM race_entries WHERE driver_id = ?', id))
    is(careers.Entries?.join(' | '), `${entries('senna')} | ${entries('prost')}`, 'and so are Entries')
    // The sentence is the table's total, by the count above made a second way.
    const want = (() => {
      const races = db
        .prepare(
          `SELECT e.finish_position AS mine, o.finish_position AS theirs, qa.position AS qmine, qb.position AS qtheirs
             FROM race_entries e
             JOIN race_entries o ON o.race_id = e.race_id AND o.driver_id = 'prost' AND o.constructor_id = e.constructor_id
             LEFT JOIN qualifying qa ON qa.race_id = e.race_id AND qa.driver_id = e.driver_id
             LEFT JOIN qualifying qb ON qb.race_id = e.race_id AND qb.driver_id = o.driver_id
            WHERE e.driver_id = 'senna'`,
        )
        .all()
      const both = (x, y) => typeof x === 'number' && typeof y === 'number'
      return {
        races: races.length,
        qualified: races.filter((r) => both(r.qmine, r.qtheirs) && r.qmine < r.qtheirs).length,
        classified: races.filter((r) => both(r.mine, r.theirs)).length,
      }
    })()
    const summary = await text('#root main section:has(h2:text-is("As team-mates")) p.note')
    truthy(
      summary?.startsWith(`Team-mates in ${want.races} Grands Prix at McLaren`) &&
        summary.includes(`In qualifying Ayrton Senna was ahead ${want.qualified} times`) &&
        summary.includes(`Of the ${want.classified} races both were classified in`),
      `the head to head is summed from the races — “${summary}”`,
    )
    is(await rowsUnder('As team-mates'), 2, 'one row per season they shared a constructor')

    // A pair who never shared a constructor: a fact, said, and no table.
    await go('/compare?a=senna&b=fangio', 'Ayrton Senna and Juan Manuel Fangio')
    truthy(
      (await text('#root main section:has(h2:text-is("As team-mates")) p.note'))?.includes('were never team-mates on this record'),
      'a pair who never shared a constructor is told so',
    )
    is(await rowsUnder('As team-mates'), null, 'and gets no empty table')

    // One driver chosen: the team-mates most often beside them, each a pair.
    await go('/compare?a=senna', 'Compare two drivers')
    const berger = await page.$('#root main a[href="/compare?a=senna&b=berger"]')
    truthy(berger, 'one driver chosen offers their team-mates, each a comparison')
    // The picker writes the address, so the pair is shareable by construction.
    await page.selectOption('#root main select[aria-label="Second driver"]', 'prost')
    await page.waitForFunction(() => document.querySelector('#root main h1')?.textContent === 'Ayrton Senna and Alain Prost', null, { timeout: 10000 })
    is(
      await page.evaluate(() => window.location.search),
      '?a=senna&b=prost',
      'choosing the second driver puts the pair in the address',
    )

    // Only the second picker chosen: that driver's team-mates, offered as
    // the first, so the choice the reader made stays where they made it.
    await go('/compare?b=prost', 'Compare two drivers')
    truthy(
      await page.waitForSelector('#root main a[href="/compare?a=senna&b=prost"]', { timeout: 10000 }).catch(() => null),
      'the second driver alone offers their team-mates in the first place',
    )
    truthy(
      !(await text('#root main .cite .url'))?.includes('?'),
      'and a page with no pair cites /compare itself',
    )

    // The same driver twice, and an id the register does not hold.
    await go('/compare?a=senna&b=senna', 'Compare two drivers')
    truthy((await text('#root main p.muted'))?.startsWith('That is the same driver twice'), 'the same driver twice is told so')
    await go('/compare?a=nobody&b=prost', 'Compare two drivers')
    is(
      await page.$eval('#root main select[aria-label="First driver"]', (s) => s.value),
      '',
      'an id the register does not hold leaves the picker empty rather than disagreeing with it',
    )
  })

  await section('/drivers  (at 375 px)', async () => {
    await page.setViewportSize({ width: 375, height: 812 })
    // The headers a reader can see: a column the phone set leaves out is in
    // the document, in both renderers, and drawn by neither.
    const drawn = () =>
      page.$$eval('#root main .table-wrap', (wraps) =>
        [...(wraps.find((w) => !w.closest('figure.figure'))?.querySelectorAll('thead th') ?? [])]
          .filter((th) => getComputedStyle(th).display !== 'none')
          .map((th) => th.textContent.replace(/[▲▼]/g, '').trim()),
      )
    await go('/drivers', 'Drivers')
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    // IX-27: 632 px of every row was off the screen, Wins and Titles among it.
    is((await drawn()).join(' | '), 'Driver | Wins | Titles', 'at 375 px the register opens on its phone set of three')
    truthy(!(await page.$('#root main .table-wrap[data-clipped]')), 'with nothing past the right edge')
    {
      const html = await (await fetch(`${BASE}/drivers`)).text()
      truthy(
        /<th scope="col" class="wide-only">Nationality<\/th>/.test(html) && /<th scope="col" class="num">Wins<\/th>/.test(html),
        'and the static page marks the same columns, so a phone without script opens on the same three',
      )
    }
    // The address changed in place, as a control changes it, rather than by a
    // fresh load: a load would make /drivers the page the reader arrived on,
    // and every later section that opens the register would find it seeded
    // with all 862 rows instead of paged.
    const to = async (search) => {
      await page.evaluate((search) => {
        window.history.replaceState({}, '', `/drivers${search}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, search)
      await page.waitForFunction((search) => window.location.search === search, search, { timeout: 10000 })
      await settle()
    }
    // VD-31: the column the register is sorted by is on the screen, second.
    await to('?sort=poles&dir=desc')
    is((await drawn()).join(' | '), 'Driver | Poles | Wins | Titles', 'sorted by a column the phone set leaves out, that column follows the name')
    // The review of PR #613 found both of these: a phone reader's choices
    // are written as choices, whichever default they happen to land on.
    const tick = async (label, expected) => {
      if (!(await page.$('#root main details.columns[open]'))) await page.click('#root main details.columns > summary')
      await page.click(`#root main details.columns label:has-text("${label}") input`)
      await page.waitForFunction(
        (n) => {
          const wrap = [...document.querySelectorAll('#root main .table-wrap')].find((w) => !w.closest('figure.figure'))
          return [...(wrap?.querySelectorAll('thead th') ?? [])].filter((th) => getComputedStyle(th).display !== 'none').length === n
        },
        expected,
        { timeout: 10000 },
      )
      await settle()
    }
    await tick('Poles', 3)
    is((await drawn()).join(' | '), 'Driver | Wins | Titles', 'unticking the pinned sort column takes it out')
    is(new URL(page.url()).search.match(/cols=([^&]*)/)?.[1], 'full_name+wins+titles', 'as a choice, so it stays out, in an address a reader can read')
    await to('?cols=full_name,nationality,first_season,entries,wins,podiums,poles,titles')
    await tick('Fastest laps', 9)
    truthy(new URL(page.url()).searchParams.has('cols'), 'and ticking up to the desktop default at 375 px keeps all nine rather than returning to three')
    await page.keyboard.press('Escape')
    // A choice is the reader's at every width, and a wide one scrolls.
    const every = 'full_name,nationality,first_season,entries,wins,podiums,poles,fastest_laps,titles'
    await to(`?cols=${every}`)
    is((await drawn()).length, 9, 'columns a reader chose are drawn at any width')
    truthy(
      await page.waitForSelector('.table-wrap[data-clipped]', { timeout: 10000 }).catch(() => null),
      'a table wider than the screen shows a fade at its right edge',
    )
    await to('')
    const navBox = await page.$eval('.masthead nav', (nav) => {
      const box = nav.getBoundingClientRect()
      const links = [...nav.querySelectorAll('a')].map((a) => a.getBoundingClientRect())
      return {
        hidden: links.filter((r) => r.right > box.right + 1 || r.left < box.left - 1).length,
        rows: new Set(links.map((r) => Math.round(r.top))).size,
        scrollable: nav.scrollWidth > nav.clientWidth + 1,
      }
    })
    truthy(navBox.hidden === 0 && !navBox.scrollable, `every masthead item is on screen at 375 px (${navBox.rows} rows)`)
    await page.setViewportSize({ width: 1280, height: 900 })

    // A season without a champion yet opens with its leader, in the app and in
    // the static page, and the static standings table lists each driver once.
    {
      const open = db.prepare("SELECT year FROM seasons WHERE drivers_champion IS NULL AND year = ? LIMIT 1").get(inProgress())
      if (open) {
        const lead = db
          .prepare("SELECT entity, points FROM v_standings_final WHERE year = ? AND table_type = 'drivers' ORDER BY position LIMIT 1")
          .get(open.year)
        note(`\n/seasons/${open.year}  (a season still running)`)
        await go(`/seasons/${open.year}`, String(open.year))
        await page.waitForSelector('#root main .stats', { timeout: 20000 }).catch(() => null)
        const stats = await page.$eval('#root main', (m) => m.textContent)
        truthy(stats.includes('Leads') && stats.includes(lead.entity), `the app leads with ${lead.entity}`)
        const html = await (await fetch(`${BASE}/seasons/${open.year}`)).text()
        truthy(
          html.includes(lead.entity) && !html.includes('Runner-up'),
          'the static page leads with the leader rather than an empty champion',
        )
        const after = one("SELECT MAX(after_round) FROM standings WHERE year = ? AND table_type = 'drivers'", open.year)
        const heading = standingsHeading("Drivers'", true, after)
        const from = html.indexOf(`<h2>${heading.replace(/'/g, '&#39;')}</h2>`)
        truthy(from > 0, `the static page heads the table “${heading}”`)
        const tableHtml = html.slice(from, html.indexOf('</table>', from))
        const listed = (tableHtml.match(/<tr[\s>]/g) ?? []).length - 1
        const rows = one("SELECT COUNT(*) FROM v_standings_final WHERE year = ? AND table_type = 'drivers'", open.year)
        is(listed, rows, 'the static standings table lists each driver once')
        // IA-17: a season with rounds still to run is not headed as concluded,
        // in either renderer - the strip above said "Leads" and got it right.
        truthy(
          stats.includes(titleHeading(true)) && !stats.includes('Final drivers') && !stats.includes(titleHeading(false)),
          'the app heads the season in progress as a title race still running',
        )
        truthy(!html.includes(titleHeading(false)) && !html.includes('Final drivers'), 'so does the static page')
      }
    }

  })

  // Every page can be cited, and the app and the static page say the same
  // sentence - checked on routes whose titles differ between the renderers,
  // which is why the citation names the address and not the title.
  await section('Citation', async () => {
    for (const [route, heading] of [['/seasons/2026', '2026'], ['/races/1988/13', 'Portuguese Grand Prix'], ['/drivers/senna', 'Ayrton Senna']]) {
      await go(route, heading)
      const appCite = await page.waitForSelector('#root .cite', { timeout: 20000 }).then((n) => n.textContent())
      const html = await (await fetch(`${BASE}${route}`)).text()
      const staticCite = html
        .slice(html.indexOf('<aside class="cite"'), html.indexOf('</aside>', html.indexOf('<aside class="cite"')))
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
      is(staticCite.replace('https://lapledger.org', BASE), appCite, `the citation on ${route} is one sentence in both renderers`)
      // CD-08: a race or a driver names the sources behind its rows, each
      // with its terms, read here from the registry rather than from the
      // sentence; a season page passes none and says nothing of the kind.
      const behind =
        route === '/races/1988/13'
          ? db.prepare(RACE_SOURCES).all(1988, 13)
          : route === '/drivers/senna'
            ? db.prepare(DRIVER_SOURCES).all('senna')
            : []
      truthy(
        behind.length ? behind.every((s) => appCite.includes(`${s.source} (${licenceTerms(s)})`)) : !appCite.includes('Behind this page'),
        behind.length
          ? `the citation on ${route} names its ${behind.length} sources and their terms`
          : `the citation on ${route} names no sources, for a page that passes none`,
      )
    }
    // A current driver's page prints the whole calendar, entered or not, so
    // every one of those races' sources is behind it (review of CD-08: on
    // /drivers/hadjar rounds 13-23 came from a source the sentence omitted).
    const current = db
      .prepare(`SELECT DISTINCT driver_id AS id FROM race_entries e JOIN races r ON r.id = e.race_id WHERE r.year = ${CURRENT_SEASON_SQL}`)
      .all()
    const unnamed = current.filter(({ id }) => {
      const named = new Set(db.prepare(DRIVER_SOURCES).all(id).map((s) => s.source))
      return db
        .prepare(THIS_SEASON)
        .all(id)
        .some((row) => !named.has(one('SELECT s.source FROM races r JOIN source_registry s ON s.id = r.source_id WHERE r.year = ? AND r.round = ?', row.season, row.round)))
    })
    is(unnamed.length, 0, `every source behind the season a current driver's page prints is named (${current.length} drivers)`)
    await go('/no-such-page-here')
    truthy(!(await page.$('#root .cite')), 'a page that does not exist offers no citation')
    await go('/drivers/no-such-driver', 'No such driver')
    truthy(!(await page.$('#root .cite')), 'an unknown driver offers no citation either')

    // Where a driver has a published count that differs from the derived one,
    // both renderers show both and say why, in the same words. PD-15 made the
    // same true of STARTS - piquet 203 counted against 204 published,
    // raikkonen 350 against 349 - so the query asks about either figure and
    // the sentence looked for is the one that covers both.
    {
      const two = db
        .prepare(`SELECT d.id FROM drivers d
                   WHERE (d.entries IS NOT NULL
                          AND d.entries != (SELECT COUNT(*) FROM race_entries e WHERE e.driver_id = d.id))
                      OR (d.starts IS NOT NULL
                          AND d.starts != (SELECT COUNT(*) FROM race_entries e WHERE e.driver_id = d.id
                                            AND COALESCE(e.position_text, '') NOT IN ('DNQ', 'DNPQ', 'DNS', 'DNP', 'EX')))
                   LIMIT 1`)
        .get()
      if (two) {
        await go(`/drivers/${two.id}`)
        const appNote = await page.waitForSelector('#root main .source-note', { timeout: 20000 }).then((n) => n.textContent())
        const says = 'both are shown and neither is corrected'
        truthy(appNote.includes(says), `the app says why ${two.id} has two counts of the same thing`)
        const html = await (await fetch(`${BASE}/drivers/${two.id}`)).text()
        truthy(
          html.includes(says) && html.includes('Entries (published)') && html.includes('Starts (published)'),
          'the static page says the same beside both figures',
        )
      }
    }

    // The season's grid is counted, and the page says the count.
    {
      const g = db.prepare('SELECT * FROM v_season_grid WHERE year = 1994').get()
      await go('/seasons/1994', '1994')
      const gridNote = await page
        .waitForFunction(() => [...document.querySelectorAll('#root main .note')].some((n) => n.textContent.startsWith('The grid:')), null, { timeout: 20000 })
        .then(() => page.$$eval('#root main .note', (ns) => ns.map((n) => n.textContent).find((t) => t.startsWith('The grid:'))))
      truthy(
        gridNote.includes(`${g.drivers} drivers`) && gridNote.includes(`${g.constructors} constructors`) && gridNote.includes('entered'),
        `1994's grid reads ${g.drivers} drivers, ${g.constructors} constructors, and says entered`,
      )
      const html = await (await fetch(`${BASE}/seasons/1994`)).text()
      truthy(
        html.includes(`${g.drivers} drivers, ${g.constructors} constructors`) && html.includes('whether or not they started'),
        'the static season page states the same grid, with the same caveat',
      )
    }

    // Cevert's register seasons (1970-1973) are not his race records' (a 1969
    // German Grand Prix in a Formula 2 car), and both renderers say so.
    {
      await go('/drivers/cevert', 'Francois Cevert')
      const app = await page.$eval('#root main', (m) => m.textContent)
      truthy(app.includes('1969–1973 in the race records, 1970–1973 published'), "the app's Seasons note gives both spans, labelled, where they differ")
      truthy(app.includes('each right about something') && app.includes('Formula 2'), "and the reason - a Formula 2 class at the 1969 German Grand Prix - is on the page, not in a comment")
      const html = await (await fetch(`${BASE}/drivers/cevert`)).text()
      truthy(html.includes('1969–1973 in the race records') && html.includes('across 1969–1973'), 'the static page says the same, beside a description that derives its years')
      truthy(html.includes('each right about something') && html.includes('Formula 2'), 'and carries the same explained reading')
    }

    // Record holders link to their pages (PD-26), in both renderers; a shared
    // record stays text.
    {
      const held = db.prepare("SELECT holder, holder_id FROM records WHERE holder_table = 'drivers' AND holder_id IS NOT NULL LIMIT 1").get()
      const shared = db.prepare("SELECT holder FROM records WHERE holder_id IS NULL LIMIT 1").get()
      await go('/records', 'Records')
      const links = await page.$$eval('#root main a[href^="/drivers/"]', (as) => as.map((a) => a.getAttribute('href')))
      truthy(links.includes(`/drivers/${held.holder_id}`), `the app links ${held.holder} to /drivers/${held.holder_id}`)
      const html = await (await fetch(`${BASE}/records`)).text()
      truthy(html.includes(`href="/drivers/${held.holder_id}"`), 'the static page links the same holder')
      // A positive test: the shared holder's text is in a plain cell, not inside a link.
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      truthy(shared && html.includes(`<td class="prose">${esc(shared.holder)}</td>`), `a shared record (${shared?.holder}) is text in its own cell, not a link`)
      // A driver on the wins leaderboard who holds no record: his only link on
      // the page is the leaderboard's.
      const leader = db
        .prepare(
          'SELECT e.driver_id FROM race_entries e WHERE e.finish_position = 1 AND e.driver_id NOT IN (SELECT holder_id FROM records WHERE holder_id IS NOT NULL) GROUP BY e.driver_id ORDER BY COUNT(*) DESC LIMIT 1',
        )
        .get()
      truthy(links.includes(`/drivers/${leader.driver_id}`), `the wins leaderboard links ${leader.driver_id}, who holds no record`)
    }

    // The weekend timetable (LV-02): a race page carries every session with
    // the circuit's clock and UTC, in the app and the static page, from the
    // same rows.
    {
      const sprintRound = one("SELECT MIN(r.round) FROM races r WHERE r.year = 2026 AND r.sprint = 1 AND EXISTS (SELECT 1 FROM sessions s WHERE s.race_id = r.id)")
      const n = count('SELECT COUNT(*) FROM sessions s JOIN races r ON r.id = s.race_id WHERE r.year = 2026 AND r.round = ?', sprintRound)
      note(`\n/races/2026/${sprintRound}  (timetable)`)
      await go(`/races/2026/${sprintRound}`, 'Grand Prix')
      await page.waitForSelector('#root main h2:has-text("Timetable")', { timeout: 20000 })
      const app = await page.$eval('#root main', (m) => m.textContent)
      const shown = await page.$$eval('#root main .table-wrap', (nodes) => nodes.map((n) => Number(n.dataset.rows)))
      truthy(shown.includes(n) && app.includes('Sprint qualifying') && app.includes('At the circuit') && app.includes('UTC'), `the app lists the ${n} sessions with the circuit clock and UTC`)
      const html = await (await fetch(`${BASE}/races/2026/${sprintRound}`)).text()
      truthy(html.includes('<h2>Timetable</h2>') && html.includes('Sprint qualifying') && html.includes('At the circuit'), 'the static page carries the same timetable')

      // A round with no entries held says nothing about entries (PD-47,
      // UR-20): "Entries 0" on a race not yet run read as a claim that
      // nobody had entered. The static page never printed the figure.
      const unrun = db
        .prepare("SELECT r.year, r.round FROM races r WHERE r.status = 'scheduled' AND NOT EXISTS (SELECT 1 FROM race_entries e WHERE e.race_id = r.id) ORDER BY r.year, r.round LIMIT 1")
        .get()
      if (unrun) {
        await go(`/races/${unrun.year}/${unrun.round}`, 'Grand Prix')
        await page.waitForSelector('#root main dl.stats', { timeout: 20000 })
        const tiles = await page.$$eval('#root main dl.stats dt', (dts) => dts.map((d) => d.textContent.trim()))
        truthy(tiles.includes('Status') && !tiles.includes('Entries'), `/races/${unrun.year}/${unrun.round} shows no Entries tile on a round with no entries held — ${tiles.join(', ')}`)
      } else pass('no scheduled round is without entries, so there is no empty weekend to check')
      // The next-session line depends on the clock: asserted only while the
      // season has a session still to come.
      const future = count("SELECT COUNT(*) FROM sessions WHERE start_utc > strftime('%Y-%m-%dT%H:%MZ', 'now')")
      if (future > 0) {
        await go('/seasons/2026', '2026')
        const season = await page.$eval('#root main', (m) => m.textContent)
        // A tile among the others (IA-17): the session, and how long until it.
        const tile = season.match(/Next session.{0,80}/)?.[0] ?? 'no tile'
        truthy(
          season.includes('Next session') && /\bin (under a minute|\d+ (minutes?|hours|days))/.test(tile),
          `the season page sets the next session as a tile, computed in the browser — ${tile}`,
        )
      }
    }

  })

  // ----------------------------------------------------------------- SQL

  await section('/data/sql', async () => {
    await go('/data/sql', 'SQL console')
    await page.waitForSelector('#root main .table-wrap', { timeout: 20000 })
    atLeast((await tableRows())[0], 1, 'the opening query returned rows')

    await page.fill('textarea.sql', 'SELECT COUNT(*) AS n FROM race_entries')
    await page.click('button.button')
    await page.waitForFunction(
      (expected) => document.querySelector('#root main tbody td')?.textContent.replace(/[^0-9]/g, '') === String(expected),
      count('SELECT COUNT(*) FROM race_entries'),
      { timeout: 20000 },
    )
    pass('an arbitrary query runs and agrees with the database')

    // A write must be refused, and the table it names must survive.
    await page.fill('textarea.sql', 'DELETE FROM drivers')
    await page.click('button.button')
    await page.waitForSelector('#root main .error', { timeout: 10000 })
    pass('a write is refused rather than run')

    await page.fill('textarea.sql', 'WITH t AS (SELECT 1) SELECT COUNT(*) AS n FROM drivers')
    await page.click('button.button')
    await page.waitForFunction(
      (expected) => document.querySelector('#root main tbody td')?.textContent.replace(/[^0-9]/g, '') === String(expected),
      count('SELECT COUNT(*) FROM drivers'),
      { timeout: 20000 },
    )
    pass('the register is intact after a rejected write')

    // The permalink: a query in the address runs on arrival, and running a
    // query writes it back to the address. An example keeps what it replaced.
    await go('/data/sql?q=SELECT%207%20AS%20n', 'SQL console')
    await page.waitForFunction(
      () => document.querySelector('#root main tbody td')?.textContent.trim() === '7',
      null,
      { timeout: 20000 },
    )
    pass('a query in the address runs on arrival')
    await page.fill('textarea.sql', 'SELECT 8 AS n')
    await page.click('button.button')
    await page.waitForFunction(() => new URLSearchParams(location.search).get('q') === 'SELECT 8 AS n', null, { timeout: 10000 })
    pass('running a query writes it to the address')
    // The note about the address tells the truth while the reader edits.
    truthy(
      await page
        .waitForFunction(
          () => document.querySelector('#root main .permalink')?.textContent.includes('is a link to this query'),
          null,
          { timeout: 10000 },
        )
        .catch(() => null),
      'after a run, the note says the address is a link to this query',
    )
    await page.fill('textarea.sql', 'SELECT 9 AS n')
    truthy(
      (await page.$eval('#root main .permalink', (n) => n.textContent)).includes('last run'),
      'after an edit without a run, the note says the address holds the query last run',
    )
    await page.click('button.example')
    await page.waitForSelector('button.linklike', { timeout: 10000 })
    await page.click('button.linklike')
    is(await page.$eval('textarea.sql', (t) => t.value), 'SELECT 9 AS n', 'an example can be undone')

    // A runaway statement can be cancelled, and the site survives it. The
    // three-way self-join would hold the worker for the rest of the session; the
    // Cancel button replaces the worker, and the next query - and the next page -
    // must work as if nothing happened.
    const RUNAWAY = 'SELECT COUNT(*) AS n FROM race_entries a, race_entries b, race_entries c'
    await page.fill('textarea.sql', RUNAWAY)
    await page.click('button.button')
    await page.waitForSelector('button.button.cancel', { timeout: 5000 })
    // A second statement while one is stuck is refused: otherwise Cancel aborted
    // the newer request and replayed the runaway onto the fresh worker.
    await page.focus('textarea.sql')
    await page.keyboard.press('Control+Enter')
    await page.waitForTimeout(500)
    truthy(
      (await page.$('button.button.cancel')) &&
        !(await page.evaluate(() => /Cancelled after/.test(document.querySelector('#root main')?.textContent ?? ''))),
      'a second run while one is stuck is refused',
    )
    await page.click('button.button.cancel')
    await page.waitForFunction(
      () => /^Cancelled after/.test(document.querySelector('#root main [role="status"]')?.textContent ?? ''),
      null,
      { timeout: 10000 },
    )
    pass('a runaway query is cancelled and says so')
    await page.fill('textarea.sql', 'SELECT COUNT(*) AS n FROM drivers')
    await page.click('button.button')
    await page.waitForFunction(
      (expected) => document.querySelector('#root main tbody td')?.textContent.replace(/[^0-9]/g, '') === String(expected),
      count('SELECT COUNT(*) FROM drivers'),
      { timeout: 20000 },
    )
    pass('the console works again after a cancel')
    // The critique's scenario verbatim: leave the console with a statement
    // stuck, and the next register must fill rather than show skeletons.
    await page.fill('textarea.sql', RUNAWAY)
    await page.click('button.button')
    await page.waitForSelector('button.button.cancel', { timeout: 5000 })
    await go('/drivers', 'Drivers')
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    atLeast((await tableRows())[0], 100, 'leaving the console stops its statement, and the register fills')

  })

  // The permalink at its old address. /reference/sql?q= was the console's
  // address before the move to /data; a query cited then must still run,
  // with the query carried across rather than dropped at the redirect.
  await section('/reference/sql?q=…  (the old address still runs the query)', async () => {
    await go('/reference/sql?q=SELECT%207%20AS%20n', 'SQL console')
    await page.waitForFunction(
      () =>
        location.pathname === '/data/sql' &&
        new URLSearchParams(location.search).get('q') === 'SELECT 7 AS n' &&
        document.querySelector('#root main tbody td')?.textContent.trim() === '7',
      null,
      { timeout: 20000 },
    )
    pass('the old address lands on /data/sql with its query run')

  })

  // The season being run, at an address that does not change. The year is
  // meta.current_season - what data/current.py declares - and not the newest
  // year in the file, which is a season nobody has raced. The test reads the
  // same row rather than naming a year, so it is still true next January.
  await section('/now  (the season being run has a stable address)', async () => {
    const year = one("SELECT value FROM meta WHERE key = 'current_season'")
    await page.evaluate((to) => {
      window.history.pushState({}, '', to)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, '/now')
    await page.waitForFunction((to) => location.pathname === to, `/seasons/${year}`, {
      timeout: 20000,
    })
    pass(`/now redirects to /seasons/${year}, the season meta.current_season names`)

  })

  // ------------------------------------------------------------------ sorting

  // NULL means "not established" here, and 64 of 862 drivers have no first
  // season. Sorting descending must still sink them, or the register opens on
  // screens of em dashes. (This used the stored entry count until PD-06 took
  // that column off the register.)
  await section('Sorting', async () => {
    await go('/drivers', 'Drivers')
    // One click: a numeric column opens descending.
    await page.click('#root main th:nth-child(3) button')
    const firstEntries = await page.$eval('#root main tbody tr td:nth-child(3)', (node) => node.textContent.trim())
    truthy(
      firstEntries !== '—' && firstEntries !== '',
      `descending sort leads with a value, not a blank — "${firstEntries}"`,
    )
    // The register pages at 150 rows; the unestablished ones are beyond that.
    await page.click('#root main .table-foot button.more')
    await page.waitForFunction(() => document.querySelectorAll('#root main tbody tr').length > 150, null, { timeout: 20000 })
    const lastEntries = await page.$$eval('#root main tbody tr td:nth-child(3)', (nodes) =>
      nodes[nodes.length - 1].textContent.trim(),
    )
    is(lastEntries, '—', 'and sinks the unestablished ones')

    /*
     * IX-20. A header that sorts says so at rest, and one that does not says
     * nothing: before this the two looked the same until one was clicked, and
     * the standings and the classification - the two a reader most wants to
     * sort - did not sort at all. A table that opens in its query's order
     * names that order on its header without re-sorting (CR-28), and the
     * first click there reverses it rather than restating it.
     */
    const headers = (heading) =>
      page.evaluate((heading) => {
        const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.trim().startsWith(heading))
        const table = h2?.closest('section')?.querySelector('.table-wrap table')
        if (!table) return null
        return [...table.querySelectorAll('thead th')].map((th) => {
          const arrow = th.querySelector('.arrow')
          return {
            label: th.textContent.replace(/[▲▼]/g, '').trim(),
            button: Boolean(th.querySelector('button')),
            sort: th.getAttribute('aria-sort'),
            idle: arrow ? getComputedStyle(arrow, '::before').content : null,
          }
        })
      }, heading)
    const firstCell = (heading) =>
      page.evaluate((heading) => {
        const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.trim().startsWith(heading))
        return h2?.closest('section')?.querySelector('tbody tr > :first-child')?.textContent.trim() ?? null
      }, heading)

    // Click the header at `index` in the section under `heading`, and wait for
    // it to announce the order it was clicked into.
    const clickHeader = async (heading, index, expected) => {
      await page.evaluate(
        ([heading, index]) =>
          [...document.querySelectorAll('#root main h2')]
            .find((h) => h.textContent.trim().startsWith(heading))
            .closest('section')
            .querySelectorAll('thead th')
            [index].querySelector('button')
            .click(),
        [heading, index],
      )
      await page.waitForFunction(
        ([heading, index, expected]) =>
          [...document.querySelectorAll('#root main h2')]
            .find((h) => h.textContent.trim().startsWith(heading))
            ?.closest('section')
            ?.querySelectorAll('thead th')
            [index]?.getAttribute('aria-sort') === expected,
        [heading, index, expected],
        { timeout: 10000 },
      )
    }

    await go('/seasons/1976', '1976')
    const standings = "Final drivers' standings"
    const atRest = await headers(standings)
    truthy(atRest?.every((h) => h.button), 'every column of the drivers\' standings sorts')
    is(atRest?.[0].sort, 'ascending', 'and the table names the order it opened in, on Pos')
    is(atRest?.filter((h) => h.sort).length, 1, 'on one header only')
    truthy(
      atRest?.slice(1).every((h) => h.idle.includes('↕')),
      'and every other header that sorts carries the resting mark',
    )
    const champion = one(
      "SELECT position_text FROM v_standings_final WHERE year = 1976 AND table_type = 'drivers' ORDER BY position IS NULL, position LIMIT 1",
    )
    is(await firstCell(standings), String(champion), 'and opens on the champion')
    const dead = await headers('The calendar')
    truthy(
      dead?.length > 0 && dead.every((h) => !h.button && !h.sort && h.idle === null),
      'while a table that does not sort has no button, no aria-sort and no mark',
    )

    is((await headers('Who entered'))?.[0].sort, 'ascending', "the entrants name their query's order on Constructor")

    await clickHeader(standings, 0, 'descending')
    const reversed = await headers(standings)
    is(reversed?.[0].sort, 'descending', 'one click on the opening column reverses it')
    const last = await firstCell(standings)
    truthy(last !== '—' && last !== '' && last !== String(champion), `and leads with a position, not a blank - "${last}"`)

    // The descending order is the ascending one reversed with the missing
    // values still last - and on Pos the missing value is `position`, not the
    // "DSQ" the cell prints. 1997 has a driver excluded from the
    // classification; he is last in both directions, never the leader of
    // the reversed table.
    const lastCell = (heading) =>
      page.evaluate((heading) => {
        const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.trim().startsWith(heading))
        const rows = h2?.closest('section')?.querySelectorAll('tbody tr') ?? []
        return rows.length ? rows[rows.length - 1].querySelector('td').textContent.trim() : null
      }, heading)
    const excluded = one(
      "SELECT position_text FROM v_standings_final WHERE year = 1997 AND table_type = 'drivers' AND position IS NULL",
    )
    await go('/seasons/1997', '1997')
    is(await lastCell(standings), excluded, `1997 opens with the excluded driver last, as "${excluded}"`)
    await clickHeader(standings, 0, 'descending')
    const lowest = one(
      "SELECT MAX(position) FROM v_standings_final WHERE year = 1997 AND table_type = 'drivers'",
    )
    is(await firstCell(standings), String(lowest), 'and reversed, the table leads on the lowest position held')
    is(await lastCell(standings), excluded, 'with the excluded driver still last')

    await go('/races/1976/9')
    const classification = await headers('Classification')
    is(
      classification?.filter((h) => h.button).length,
      classification?.length - 1,
      'the classification sorts on every column but its result rail',
    )
    is(classification?.find((h) => h.sort)?.label, 'Pos', 'and names the classification order on Pos')
    // CD-09, IA-12: the codes a classification prints - DNQ, NC, PL - are one
    // link from its Pos header, on both halves. The header's text is still
    // "Pos" (above): the mark is the stylesheet's.
    {
      const want = '/reference/glossary?category=results'
      const key = await page.evaluate(() => {
        const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.trim().startsWith('Classification'))
        const a = h2?.closest('section')?.querySelector('thead th .key')
        return a && { href: a.getAttribute('href'), name: a.getAttribute('aria-label'), header: a.closest('th').getAttribute('aria-label') }
      })
      is(key?.href, want, 'the classification’s Pos header links to the glossary’s results terms')
      truthy(key?.name?.includes('Pos'), `and the link is named for its column — “${key?.name}”`)
      // A header is named from all it holds; without its own name, every cell
      // under it would be announced with the link's sentence first.
      is(key?.header, 'Pos', 'and the header is still named Pos alone')
      const html = await (await fetch(`${BASE}/races/1976/9`)).text()
      truthy(
        html.includes(`aria-label="Pos"><a class="key" href="${want}"`),
        'and the static race page carries the same link, under the same header name',
      )
    }
    // Pos is the classification's second column: the rail comes first. A
    // retirement has no finish_position and stays below every finisher.
    const posCell = (which) =>
      page.evaluate((which) => {
        const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.trim().startsWith('Classification'))
        const rows = [...h2.closest('section').querySelectorAll('tbody tr')]
        return rows.at(which).querySelectorAll('td')[1].textContent.trim()
      }, which)
    const lastOut = await posCell(-1)
    await clickHeader('Classification', 1, 'descending')
    const lastHome = one(
      `SELECT MAX(e.finish_position) FROM race_entries e JOIN races r ON r.id = e.race_id
        WHERE r.year = 1976 AND r.round = 9`,
    )
    is(await posCell(0), String(lastHome), 'reversed, the classification leads on the last classified finisher')
    is(await posCell(-1), lastOut, 'and the retirements stay below every finisher')

    // The disagreements open in SQLite's order, where "10 chassis" comes
    // before "3 chassis", and the browser's numeric compare would put them
    // the other way round. So this is the table a re-sort would show: the
    // rows at rest are the query's, and down and back up returns to them
    // rather than to a second order under the same "Subject ▲".
    await go('/data/quality', 'Data quality')
    const kept = 'Disagreements kept rather than resolved'
    const opening = one('SELECT subject FROM discrepancies ORDER BY subject COLLATE NOCASE, id LIMIT 1')
    is((await headers(kept))?.[0].sort, 'ascending', 'the disagreements name their order on Subject')
    is(await firstCell(kept), opening, `and open in the query's order, on "${opening}", not a re-sort of it`)
    await clickHeader(kept, 0, 'descending')
    await clickHeader(kept, 0, 'ascending')
    is(await firstCell(kept), opening, 'and down and back up returns to the same rows')

    await go('/reference/glossary', 'Glossary')
    is((await headers('Glossary'))?.[0].sort, 'ascending', 'the glossary names its alphabetical order on Term')

  })

  // ------------------------------------------------------- taking it away

  /*
   * IX-26. Before this there was no `clipboard`, no `download` and no share
   * anywhere in web/src: every table on the site could be read and nothing
   * else. The button is one component in the footer of every table, so the
   * checks here are about what actually comes out of it — the whole table
   * rather than the page of it on screen, numbers a spreadsheet can add up,
   * and a file named for the database version that fixes its figures.
   */
  await section('Taking a table away', async () => {
    await go('/drivers', 'Drivers')
    const [rows, shown] = await page.$eval('#root main .table-wrap', (el) => [
      Number(el.dataset.rows),
      Number(el.dataset.shown),
    ])
    truthy(rows > shown, `the register is paged — ${shown} of ${rows} rows drawn`)

    // The label says the count BEFORE the click, because the difference
    // between what is drawn and what is taken is the one thing a reader
    // would otherwise find out afterwards, in a spreadsheet.
    const labels = await page.$$eval('#root main .table-foot button.take', (buttons) =>
      buttons.map((b) => b.textContent.trim().replace(/\s+/g, ' ')),
    )
    is(
      labels.join(' · '),
      `Copy all ${rows.toLocaleString('en-GB')} as TSV · Download all ${rows.toLocaleString('en-GB')} as CSV`,
      'the buttons name the whole table, not the page of it on screen',
    )

    await page.click('#root main .table-foot button.take.copy')
    await page.waitForFunction(
      (n) => document.querySelector('#root main .take-said')?.textContent.includes(`Copied ${n} rows`),
      rows.toLocaleString('en-GB'),
      { timeout: 10000 },
    )
    const tsv = await page.evaluate(() => navigator.clipboard.readText())
    const lines = tsv.split('\n')
    is(lines.length, rows + 1, 'the clipboard holds every row of the register and one header')
    const headers = await page.$$eval('#root main thead th', (th) =>
      th.map((h) => h.textContent.replace(/[▲▼]/g, '').trim()),
    )
    is(lines[0], headers.join('\t'), 'under the headers the table is showing')
    // Data as data: the table prints 1,000 and the file must not, or every
    // figure over 999 arrives in a spreadsheet as a string — or as two
    // columns, in the CSV.
    truthy(!/\d,\d{3}/.test(tsv), 'with no thousands separators in it')

    const download = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('#root main .table-foot button.take.csv'),
    ]).then(([d]) => d)
    const name = download.suggestedFilename()
    truthy(
      /^lap-ledger-drivers-v\d[\w.]*\.csv$/.test(name),
      `the file is named for the table and the database version — "${name}"`,
    )
    const csv = readFileSync(await download.path(), 'utf8')
    is(csv.slice(0, 1), '﻿', 'and opens with the mark that makes Excel read it as UTF-8')
    is(csv.split('\r\n').length - 2, rows, 'and holds the same rows the clipboard did')

    /*
     * The em dash is a claim, and the file must not make one the page does
     * not. The first review of this found the column that broke the rule:
     * `position_text` on the driver championship table renders `v ??
     * row.position`, and the export saw only the null - so 21 drivers' 2025
     * season read 6 on screen and "not established" in the file, in the one
     * artefact that travels with no page around it to correct it.
     *
     * So this is the general form rather than that one cell: every table on
     * an entity page, every column the file and the page share, and an em
     * dash in the file only where the page has one too.
     */
    await go('/drivers/hamilton', 'Sir Lewis Hamilton')
    const tables = await page.$$('#root main .table-wrap')
    let compared = 0
    for (const [index, wrap] of tables.entries()) {
      const [all, drawn] = await wrap.evaluate((el) => [Number(el.dataset.rows), Number(el.dataset.shown)])
      // Only a table drawn whole can be compared row for row with its file.
      if (all !== drawn) continue
      // A chart's table is folded away behind its own <details> - and it is
      // exactly the table the first review found the defect in, so it is
      // opened rather than skipped.
      await wrap.evaluate((el) => el.closest('details')?.setAttribute('open', ''))
      const button = await wrap.$('.table-foot button.take.copy')
      if (!(await button.isVisible())) continue
      await button.click()
      await page.waitForFunction(
        (i) =>
          document.querySelectorAll('#root main .table-wrap')[i].querySelector('.take-said')?.textContent.length > 0,
        index,
        { timeout: 10000 },
      )
      const copied = (await page.evaluate(() => navigator.clipboard.readText()))
        .split('\n')
        .map((line) => line.split('\t'))
      const seen = await wrap.evaluate((el) => ({
        headers: [...el.querySelectorAll('thead th')].map((h) => h.textContent.replace(/[▲▼]/g, '').trim()),
        rows: [...el.querySelectorAll('tbody tr')].map((tr) =>
          [...tr.children].map((cell) => cell.textContent.trim()),
        ),
      }))
      for (const [column, header] of seen.headers.entries()) {
        const inFile = copied[0].indexOf(header)
        if (inFile === -1) continue
        for (const [row, cells] of seen.rows.entries()) {
          const drawnCell = cells[column] ?? ''
          const written = copied[row + 1]?.[inFile] ?? ''
          // Silent unless it is wrong: one check per cell would be a
          // thousand lines of green. The count below is the passing check.
          if (written === '—' && drawnCell !== '—') {
            truthy(
              false,
              `table ${index + 1}, ${header}, row ${row + 1}: the page shows "${drawnCell}" and the file says not established`,
            )
          }
          compared += 1
        }
      }
    }
    truthy(compared > 200, `every cell of every whole table on a driver page agrees about what is missing — ${compared} compared`)

    // The console's result is a table like any other, and the one the item
    // named first: someone who can write SQL had Run and nothing else.
    await go('/data/sql', 'SQL console')
    const result = await page.$eval('#root main .table-wrap', (el) => Number(el.dataset.rows))
    const consoleLabels = await page.$$eval('#root main .table-foot button.take', (buttons) =>
      buttons.map((b) => b.textContent.trim().replace(/\s+/g, ' ')),
    )
    is(
      consoleLabels.join(' · '),
      'Copy as TSV · Download as CSV',
      'a table with nothing hidden does not claim a count it does not need',
    )
    await page.click('#root main .table-foot button.take.copy')
    await page.waitForFunction(
      () => document.querySelector('#root main .take-said')?.textContent.includes('Copied'),
      null,
      { timeout: 10000 },
    )
    const query = (await page.evaluate(() => navigator.clipboard.readText())).split('\n')
    is(query.length, result + 1, 'the console result comes away whole')
    is(query[0], 'Full name\tPole to win', 'with the headers the console gave it')
  })

  // ------------------------------------------------------ addressable state

  /*
   * IA-08. Every register answered to component state alone: a reader who
   * found the champions, sorted them and expanded the table could send that
   * to nobody, cite none of it, and lose all of it by opening one driver.
   *
   * The two halves of the claim are both here. An address REPRODUCES a view:
   * the same route with the same parameters gives the same rows. And a view
   * SURVIVES: the register comes back from the page the reader opened out of
   * it, which is the Back press at the end and the acceptance test this was
   * written against.
   */
  await section('Registers in the address bar', async () => {
    const chips = '[role="group"][aria-label="Filter drivers by kind"]'
    const query = () => new URL(page.url()).searchParams

    await page.goto(`${BASE}/drivers`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    const everyone = (await tableRows())[0]
    is(page.url(), `${BASE}/drivers`, 'an untouched register carries no parameters')

    await page.click(`${chips} button:text-is("Champions")`)
    await page.waitForFunction((was) => Number(document.querySelector('#root main .table-wrap')?.dataset.rows) !== was, everyone, { timeout: 10000 })
    is(query().get('kind'), 'champions', 'a chip writes itself into the address')
    const champions = (await tableRows())[0]
    truthy(champions > 0 && champions < everyone, `and the register filtered to ${champions} of ${everyone}`)

    // A column header is the other half of what a reader arranges, and the
    // direction with it: a first season ascending is not one descending. The
    // first click takes the column at the direction that column opens in,
    // which is the table's own and so is not written down; the second turns
    // it round, which is.
    const topCell = () => page.$eval('#root main tbody tr td:nth-child(3)', (node) => node.textContent.trim())
    await page.click('#root main th:nth-child(3) button')
    await page.waitForFunction(() => new URL(window.location.href).searchParams.has('sort'), null, { timeout: 10000 })
    await settle()
    const descending = await topCell()
    await page.click('#root main th:nth-child(3) button')
    await page.waitForFunction(() => new URL(window.location.href).searchParams.get('dir') === 'asc', null, { timeout: 10000 })
    await settle()
    const sorted = await topCell()
    const address = page.url()
    truthy(sorted !== descending, `turning the column round reorders the table — ${descending} then ${sorted}`)
    is(query().get('dir'), 'asc', `and the direction is in the address — ${address.slice(BASE.length)}`)

    // The whole of it, from a cold start: this is the link a reader sends.
    await page.goto(address, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    is((await tableRows())[0], champions, 'the address alone reproduces the filtered register')
    is(
      await page.$eval('#root main tbody tr td:nth-child(3)', (node) => node.textContent.trim()),
      sorted,
      'sorted the same way',
    )
    is(
      await page.$eval(`${chips} button[aria-pressed="true"]`, (node) => node.textContent.trim()),
      'Champions',
      'with the chip that did it reading as pressed',
    )

    // The acceptance test. Open a driver out of the register and come back.
    await page.click('#root main tbody tr :is(td, th) a')
    await page.waitForFunction(() => window.location.pathname.startsWith('/drivers/'), null, { timeout: 20000 })
    await page.goBack()
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    is(page.url(), address, 'Back returns to the register as it was left')
    is((await tableRows())[0], champions, 'with the filter still applied')

    // A parameter is typed by hand as often as it is clicked, and a register
    // filtered to nothing by a value no row carries — while the select beside
    // it read "Every nationality" — would be the control and the table
    // disagreeing about what had been asked.
    await page.goto(`${BASE}/drivers?nationality=Ruritania&kind=not-a-kind`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    is((await tableRows())[0], everyone, 'a value the register does not hold is ignored, not filtered on')

    // The same rule for the sort, which is a column and not a string. The
    // race index renders its header unsortable — the query's order, run
    // first and newest first, is the order the page means — so a sort named
    // in the address there would be an order no control expresses and none
    // can undo, announced by an aria-sort on a header with no button in it.
    const firstRace = async (address) => {
      await page.goto(`${BASE}${address}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
      await settle()
      return page.$eval('#root main tbody tr', (node) => node.textContent.trim())
    }
    const ordered = await firstRace('/races')
    is(await firstRace('/races?sort=year&dir=asc'), ordered, 'a table that does not sort ignores a sort in the address')
    is(await page.$$eval('#root main th[aria-sort]', (nodes) => nodes.length), 0, 'and announces none')

    // A key no header offers is not a reason to throw the register's own
    // opening sort away: the arrow and the aria-sort stay where they were.
    await page.goto(`${BASE}/circuits?sort=not-a-column`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    is(
      await page.$eval('#root main th[aria-sort]', (node) => node.getAttribute('aria-sort')),
      'descending',
      'and a sort the header does not offer falls back to the one the register opens on',
    )

    /*
     * IA-23. The columns are the third thing a reader arranges, and the
     * address holds them for the same reason it holds the other two. A
     * column taken out comes out of the address again when it is put back;
     * an optional one is there to be asked for; and the default is absent.
     */
    const heads = () =>
      page.$$eval('#root main .table-wrap', (wraps) =>
        [...(wraps.find((w) => !w.closest('figure.figure'))?.querySelectorAll('thead th') ?? [])].map((th) =>
          th.textContent.replace(/[▲▼]/g, '').trim(),
        ),
      )
    const box = (label) => `#root main details.columns label:has-text("${label}") input`
    // The address is written first and the table redrawn after it, so each
    // step waits for the header it expects, not for the address.
    const headed = (label, present) =>
      page.waitForFunction(
        ([label, present]) => {
          const wrap = [...document.querySelectorAll('#root main .table-wrap')].find((w) => !w.closest('figure.figure'))
          const has = [...(wrap?.querySelectorAll('thead th') ?? [])].some((th) => th.textContent.trim() === label)
          return has === present
        },
        [label, present],
        { timeout: 10000 },
      )
    await page.goto(`${BASE}/constructors`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    const opening = await heads()
    truthy(!opening.includes('Base'), `a register opens without its optional columns — ${opening.join(', ')}`)
    await page.click('#root main details.columns > summary')
    // A click, not check(): the box is the address's to set, and it turns
    // when the address has, a render later than check() looks.
    await page.click(box('Base'))
    await headed('Base', true)
    const withBase = await heads()
    is(withBase.length, opening.length + 1, `asking for one adds it — ${query().get('cols')}`)
    is(withBase[withBase.indexOf('Country') + 1], 'Base', 'in the place the register declares it')
    await page.click(box('Designs'))
    await headed('Designs', false)
    const chosen = page.url()
    truthy(!(await heads()).includes('Designs'), 'and a default one can be taken out')
    await page.goto(chosen, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    is((await heads()).join(' | '), withBase.filter((h) => h !== 'Designs').join(' | '), 'the address alone reproduces the columns')
    truthy(await page.isDisabled('#root main details.columns label.is-fixed input'), 'the column that names the row is not offered')
    await page.click('#root main details.columns > summary')
    await page.click('#root main details.columns button.columns-reset')
    await headed('Designs', true)
    is(query().get('cols'), null, 'the reset takes the parameter out of the address')
    is((await heads()).join(' | '), opening.join(' | '), 'and the default columns are one press away')
    // The same stranger rule as a filter's: a parameter naming nothing the
    // register has is the default, not an empty grid.
    await page.goto(`${BASE}/constructors?cols=not-a-column`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    is((await heads()).join(' | '), opening.join(' | '), 'columns the register does not have are ignored')

    /*
     * IX-41. An expansion the reader made can be put away again, by the same
     * control, and the address forgets it: a link with `?all=1` on it was
     * 1,125 rows with only the address bar to get out of them.
     */
    await page.goto(`${BASE}/races`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    await settle()
    const seeded = await page.$eval('#root main .table-wrap', (node) => Number(node.dataset.shown))
    const says = (start) =>
      page.waitForFunction(
        (start) => document.querySelector('#root main .table-foot button.more')?.textContent.trim().startsWith(start),
        start,
        { timeout: 20000 },
      )
    await page.click('#root main .table-foot button.more')
    await says('Show the first')
    is(query().get('all'), '1', 'the expansion is in the address')
    is(
      await page.$eval('#root main .table-foot button.more', (node) => node.textContent.trim()),
      `Show the first ${seeded}`,
      'an expanded table offers the way back, in the same control',
    )
    await page.click('#root main .table-foot button.more')
    await says('Show the remaining')
    is(query().get('all'), null, 'and putting it away takes it out again')
    is(await page.$eval('#root main .table-wrap', (node) => Number(node.dataset.shown)), seeded, `and pressing it shows ${seeded} again`)
    truthy(
      await page.evaluate(() => document.activeElement?.matches('.table-foot button.more')),
      'with focus still on the control that did it',
    )

  })

  // ---------------------------------------------------------------- search

  await section('Search', async () => {
    await openPalette(page)
    await page.fill('.palette input', 'rindt')
    // The index is one query on first open, so the list can show "no match" for a
    // frame before it lands. Wait for a real hit rather than for any row.
    await page.waitForSelector('#palette-results li a[href^="/drivers/"]', { timeout: 10000 })
    const first = await page.$eval('#palette-results li a', (node) => node.getAttribute('href'))
    is(first, '/drivers/rindt', 'search finds a driver by name')
    // AX-02: the highlighted row is one a screen reader can follow. The field
    // is a combobox pointing into a listbox at the option drawn as active.
    const combo = await page.$eval('.palette input', (field) => {
      const row = document.getElementById(field.getAttribute('aria-activedescendant') ?? '')
      return {
        role: field.getAttribute('role'),
        expanded: field.getAttribute('aria-expanded'),
        list: document.getElementById(field.getAttribute('aria-controls') ?? '')?.getAttribute('role'),
        row: row && [row.getAttribute('role'), row.getAttribute('aria-selected'), row.dataset.active].join(' '),
        tabbable: [...document.querySelectorAll('.palette a')].filter((a) => a.tabIndex >= 0).length,
      }
    })
    is(
      `${combo.role} ${combo.expanded} ${combo.list}`,
      'combobox true listbox',
      'the search field is an expanded combobox controlling a listbox',
    )
    is(combo.row, 'option true true', 'and names the highlighted row as its active descendant')
    is(combo.tabbable, 0, 'and is the palette\'s only tab stop: the result links are out of the tab order')
    await page.click('#palette-results li a')
    // Wait for what that click started. A section that leaves its own
    // navigation in flight hands the next one a page mid-commit, which is
    // where the key above used to be swallowed (AF-61).
    await page.waitForFunction(() => document.querySelector('#root main h1')?.textContent.includes('Rindt'), null, {
      timeout: 20000,
    })

  })

  // The winningest driver of a shared surname comes first: "schumacher" used
  // to offer Ralf, on six wins, above Michael on ninety-one, because the only
  // tie-break was the length of the name.
  await section('Search  (prominence)', async () => {
    // Whatever has focus at the press that opens the palette, read in the
    // capture phase so it is taken before App.jsx's listener acts on the key.
    await page.evaluate(() => {
      const note = (event) => {
        if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return
        window.__paletteOpener = document.activeElement
        window.removeEventListener('keydown', note, true)
      }
      window.addEventListener('keydown', note, true)
    })
    await openPalette(page)
    await page.fill('.palette input', 'schumacher')
    await page.waitForSelector('#palette-results li a[href^="/drivers/"]', { timeout: 10000 })
    is(
      await page.$eval('#palette-results li a', (node) => node.getAttribute('href')),
      `/drivers/${one(`SELECT id FROM drivers WHERE lower(full_name) LIKE '%schumacher%' ORDER BY wins DESC LIMIT 1`)}`,
      'the winningest Schumacher is first',
    )
    // AX-02: a modal the keyboard cannot leave except by closing it.
    const inField = () => page.evaluate(() => document.activeElement === document.querySelector('.palette input'))
    await page.keyboard.press('Shift+Tab')
    truthy(await inField(), 'Shift+Tab does not leave the palette for the page behind it')
    await page.keyboard.press('Tab')
    truthy(await inField(), 'nor does Tab')
    await page.keyboard.press('ArrowDown')
    is(
      await page.$eval('.palette input', (field) => field.getAttribute('aria-activedescendant')),
      'palette-option-1',
      'an arrow key moves the active descendant with the highlight',
    )
    await page.keyboard.press('ArrowUp')
    // Escape is the one way out of the palette that needs no pointer, and the
    // only modal on the site. The route-change close (AF-60) is asserted in the
    // landing section; this is the keyboard one, and it is here rather than
    // there because the palette is already open at this point.
    await page.keyboard.press('Escape')
    truthy(
      await page
        .waitForFunction(() => !document.querySelector('.palette'), null, { timeout: 5000 })
        .then(() => true)
        .catch(() => false),
      'Escape dismisses the palette',
    )
    truthy(
      await page.evaluate(() => {
        const now = document.activeElement
        const was = window.__paletteOpener
        return now !== document.body && (now === was || (was === document.body && now === document.getElementById('main')))
      }),
      'and hands focus back to where it was when the palette opened, not to <body>',
    )
    await page.waitForFunction(() => document.querySelector('#root main h1')?.textContent.includes('Rindt'), null, {
      timeout: 10000,
    })
    pass('revealing the page behind it')
    // AX-15: a single printable key with no modifier and no way to turn it
    // off is a shortcut speech input sets off by accident. It opens nothing.
    await page.keyboard.press('/')
    truthy(
      await page
        .waitForSelector('.palette', { timeout: 750 })
        .then(() => false)
        .catch(() => true),
      'a bare `/` does not open search: Ctrl or Cmd+K is the only key that does',
    )

  })

  // IA-20: the searches that used to return nothing. A model number typed
  // with the wrong separator, a name one letter out, a question, and a term
  // nothing answers - which now hands the reader somewhere to go.
  await section('Search  (questions and near spellings)', async () => {
    const hrefs = () => page.$$eval('#palette-results li a', (nodes) => nodes.map((node) => node.getAttribute('href')))
    const status = () => page.$eval('.palette-status', (node) => node.textContent)
    const settle = (test, arg = null) =>
      page.waitForFunction(test, arg, { timeout: 10000 }).then(
        () => true,
        () => false,
      )
    await openPalette(page)
    await page.fill('.palette input', 'mp4-4')
    const mp44 = `/cars/${one("SELECT id FROM chassis WHERE full_name = 'McLaren MP4/4'")}`
    truthy(
      await settle((want) => document.querySelector('#palette-results li a')?.getAttribute('href') === want, mp44),
      `"mp4-4" finds the McLaren MP4/4 at ${mp44}`,
    )
    await page.fill('.palette input', 'schumaker')
    truthy(
      await settle(() => document.querySelector('.palette-status')?.textContent.includes('Did you mean')),
      'a name two letters out is answered with "Did you mean"',
    )
    is(
      (await hrefs())[0],
      `/drivers/${one(`SELECT id FROM drivers WHERE lower(full_name) LIKE '%schumacher%' ORDER BY wins DESC LIMIT 1`)}`,
      'and the winningest Schumacher first',
    )
    // IA-01: a Grand Prix opens its own page, ahead of its editions.
    await page.fill('.palette input', 'british grand prix')
    truthy(
      await settle(() => document.querySelector('#palette-results li a')?.getAttribute('href') === '/grands-prix/british'),
      '"british grand prix" opens the event, ahead of its editions',
    )
    await page.fill('.palette input', 'qzxvq')
    truthy(await settle(() => document.querySelector('.palette-status')?.textContent.includes('No match')), 'a term nothing answers says so')
    const exits = await hrefs()
    truthy(
      exits.length === 2 && exits[0].startsWith('/data/sql?q=') && exits[1] === '/records',
      'and offers the console and the records as options the arrow keys reach',
    )
    truthy((await status()).includes('Two places'), 'naming them as the places to look instead')
    // A question is answered by running it: Enter on the first row opens the
    // console with the statement, and the console runs it.
    await page.fill('.palette input', 'who has taken the most pole positions')
    await settle(() => document.querySelector('#palette-results li a')?.getAttribute('href')?.startsWith('/data/sql'))
    await page.keyboard.press('Enter')
    const polesLeader = one('SELECT full_name FROM v_poles_by_driver ORDER BY poles DESC LIMIT 1')
    truthy(
      await page
        .waitForFunction((want) => document.querySelector('#root main tbody td')?.textContent === want, polesLeader, { timeout: 20000 })
        .then(
          () => true,
          () => false,
        ),
      `a question opens the console, which runs it: ${polesLeader} leads`,
    )
    is(
      await page.$$eval('#root main button.example', (nodes) => nodes.length),
      EXAMPLES.length,
      'and the console offers every question in the library that is a query',
    )
    // From the console itself, to the question it opens on: only the query
    // string moves, to nothing. The editor must show what runs, and what the
    // reader had typed and not run is offered back (review of #617).
    await page.fill('textarea.sql', 'SELECT 5 AS typed')
    // Ctrl+K from inside a field is the field's; the reader leaves it first.
    await page.evaluate(() => document.activeElement?.blur())
    await openPalette(page)
    await page.fill('.palette input', 'who has led a race from pole most often')
    await settle(() => document.querySelector('#palette-results li a')?.getAttribute('href') === '/data/sql')
    await page.keyboard.press('Enter')
    truthy(
      await settle(() => document.querySelector('textarea.sql')?.value.includes('pole_to_win')),
      'a question picked on the console puts its statement in the editor',
    )
    truthy(
      await settle(() => document.querySelector('button.linklike')?.textContent.includes('Restore')),
      'and offers back what had been typed',
    )
  })

  // -------------------------------------------------------------- 404 route

  await section('Missing routes', async () => {
    await go('/drivers/not-a-driver', 'No such driver')
    pass('an unknown driver is refused rather than rendered blank')
    await go('/nowhere', 'No such page')
    pass('an unknown route is refused')

    // ----------------------------------------------------------------- shapes

    /*
     * One page of every SHAPE the data comes in.
     *
     * This section exists because of what happened without it. The sprint table
     * on a race page had been broken since it was added -- it passed a string
     * where DataTable calls a function, and it called result() on a bare status
     * string -- and every sprint weekend since 2021 rendered a blank page.
     * Thirty races. Nothing caught it, because the two races this test opened
     * were a 1976 grand prix and a 1955 shared drive, and neither had a sprint.
     *
     * A page is not one page. It is a template over rows that vary in ways the
     * developer did not have in front of them: a pit-lane start with no grid
     * number, a field where half the entries did not qualify, a race that has
     * not been run, a driver nobody has totals for. The routes below are chosen
     * BY QUERY rather than written down, so the coverage follows the data rather
     * than going stale beside it -- and each is asserted only to render and to
     * log nothing, because the point is the shapes, not the numbers.
     */
  })

  await section('Shapes', async () => {

    const shapes = [
      ['a sprint weekend',
       `SELECT '/races/' || year || '/' || round FROM races
       WHERE sprint = 1 AND status = 'completed' ORDER BY year DESC LIMIT 1`],
      ['a race somebody started from the pit lane',
       `SELECT '/races/' || r.year || '/' || r.round FROM races r
        JOIN race_entries e ON e.race_id = r.id
       WHERE e.grid_text = 'PL' LIMIT 1`],
      ['a race most of the field failed to qualify for',
       `SELECT '/races/' || r.year || '/' || r.round FROM races r
        JOIN race_entries e ON e.race_id = r.id
       WHERE e.position_text = 'DNQ'
       GROUP BY r.id ORDER BY COUNT(*) DESC LIMIT 1`],
      ['the Indianapolis 500, which shares nothing with the rest',
       `SELECT '/races/' || year || '/' || round FROM races
       WHERE name_used LIKE '%Indianapolis%' LIMIT 1`],
      ['a race that has not been run',
       `SELECT '/races/' || year || '/' || round FROM races
       WHERE status = 'scheduled' ORDER BY round LIMIT 1`],
      ['the race with the most pit stops held for it',
       `SELECT '/races/' || r.year || '/' || r.round FROM races r
        JOIN pit_stops p ON p.race_id = r.id
       GROUP BY r.id ORDER BY COUNT(*) DESC LIMIT 1`],
      ['a driver who never won',
       `SELECT '/drivers/' || id FROM drivers
       WHERE COALESCE(wins, 0) = 0 ORDER BY COALESCE(entries, 0) DESC LIMIT 1`],
      ['a driver nobody has career totals for',
       `SELECT '/drivers/' || id FROM drivers
       WHERE starts IS NULL AND career_points IS NULL LIMIT 1`],
      ['a constructor that never won',
       `SELECT '/constructors/' || id FROM constructors
       WHERE COALESCE(wins, 0) = 0 ORDER BY COALESCE(entries, 0) DESC LIMIT 1`],
      ['a circuit that held one grand prix',
       `SELECT '/circuits/' || id FROM circuits WHERE gp_count = 1 LIMIT 1`],
      // The centrelines moved to f1-geometry.db when the ODbL split landed, so
      // main.circuit_geometry is empty by design. Without the overlay there is
      // no traced circuit to visit and the shape is dropped rather than failed.
      ...(hasGeometry
        ? [['a circuit with a traced centreline',
            `SELECT '/circuits/' || circuit_id FROM geo.circuit_geometry LIMIT 1`]]
        : []),
      ['the car with the most wins',
       `SELECT '/cars/' || id FROM cars ORDER BY COALESCE(wins, 0) DESC LIMIT 1`],
      ['the first season',
       `SELECT '/seasons/' || MIN(year) FROM seasons`],
      ['the season in progress',
       `SELECT '/seasons/' || MAX(year) FROM races WHERE status = 'completed'`],
      ['a season announced and not yet run',
       `SELECT '/seasons/' || MIN(year) FROM seasons s
          WHERE NOT EXISTS (SELECT 1 FROM races r
                             WHERE r.year = s.year AND r.status = 'completed')`],
    ]

    /* A shape with no matching row is a gap in the coverage, not a pass — but it
       must not take the runner down, which is what `one` does on an empty result. */
    const maybe = (sql) => {
      const row = db.prepare(sql).get()
      return row ? Object.values(row)[0] : null
    }

    for (const [what, sql] of shapes) {
      const route = maybe(sql)
      if (!route) {
        fail(`${what}: no row in the database matches, so the shape went untested`)
        continue
      }
      const before = consoleErrors.filter(siteError).length
      try {
        await go(route)
        // A page that threw during render leaves the heading and nothing under
        // it, so "did it render" is asked of the body rather than the title.
        //
        // Waited for rather than sampled. The question is whether the page ever
        // renders, and reading the count at one instant asks whether it had
        // rendered YET — which is the same thing only while nothing is slow.
        // /drivers/moss came back with 0 blocks once on CI and never here, on
        // this commit or under a loaded machine. A page that genuinely renders
        // nothing still fails, three seconds later.
        await page
          .waitForFunction(
            () => document.querySelectorAll('#root main section, #root main .stats').length > 0,
            null,
            { timeout: 3000 },
          )
          .catch(() => {})
        const filled = await page.$$eval('#root main section, #root main .stats', (n) => n.length)
        // A page whose DATABASE failed to load is still caught, and by the
        // stronger assertion: it renders no blocks at all.
        const errors = consoleErrors.filter(siteError).slice(before)
        if (filled > 0 && errors.length === 0) pass(`${what} — ${route}`)
        else fail(`${what} — ${route}: ${filled} blocks, ${errors.length} new error(s) ${JSON.stringify(errors)}`)
      } catch (error) {
        fail(`${what} — ${route}: ${String(error.message).split('\n')[0]}`)
      }
    }

    // ------------------------------------------------------------ prerendering

    /*
     * The static pages are the whole reason this site has URLs a crawler can
     * fetch, and they are written by a script that never runs in a browser. So
     * they are checked the way a crawler would meet them: a fresh page load at a
     * deep path, and the same path again with JavaScript turned off entirely.
     *
     * The counts are read out of f1.db so these stay honest as the data grows.
     */
  })

  await section('Prerendering', async () => {

    const deep = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await deep.goto(`${BASE}/drivers/hamilton`, { waitUntil: 'domcontentloaded' })
    is(await deep.title(), 'Sir Lewis Hamilton — Lap Ledger', 'a deep link has its own title')
    is(
      await deep.$eval('link[rel=canonical]', (node) => new URL(node.href).pathname),
      '/drivers/hamilton',
      'and its own canonical URL',
    )
    truthy(
      JSON.parse(await deep.$eval('script[type="application/ld+json"]', (n) => n.textContent))['@type'] === 'Person',
      'and describes itself to a search engine as a Person',
    )

    /*
     * AF-01. The block every one of the 1,196 race pages emits had no test at
     * all, which is how it went a year without the two properties Search
     * Console asks for. Read off f1.db so the dates cannot be asserted against
     * themselves, and on a round with no timetable held for it, where the day
     * the markup states is `date_iso` itself - eventDay()'s derivation of a
     * circuit's own day is units.mjs's to check, against Las Vegas.
     */
    const marked = one(
      `SELECT r.year || '/' || r.round || '|' || r.date_iso FROM races r
        JOIN race_results rr ON rr.id = r.id
        LEFT JOIN sessions s ON s.race_id = r.id
       WHERE r.date_iso IS NOT NULL AND rr.winner_id IS NOT NULL AND s.id IS NULL
       ORDER BY r.year DESC, r.round DESC LIMIT 1`,
    )
    const [markedRoute, markedDate] = String(marked).split('|')
    const markup = await (await fetch(`${BASE}/races/${markedRoute}`)).text()
    const event = JSON.parse(
      markup.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '{}',
    )
    is(event['@type'], 'SportsEvent', `a race page describes itself as a SportsEvent — /races/${markedRoute}`)
    is(event.startDate, markedDate, 'and starts on the date the database holds')
    is(event.endDate, markedDate, 'and ends on it — a grand prix is a one-day event')
    is(event.eventStatus, 'https://schema.org/EventScheduled', 'and carries the one status this calendar has')
    truthy(
      event.performer === undefined && event.offers === undefined,
      'and sells nobody a ticket: `performer` and `offers` are declined, not invented',
    )
    // The handover: the static block is what a reader sees first, and it must be
    // gone once the app can answer for itself — otherwise the page renders twice.
    await deep.waitForSelector('#root main h1', { timeout: 60000 })
    await deep.waitForFunction(() => !document.getElementById('prerendered'), null, { timeout: 20000 })
    pass('the static page is handed over to the app once the database is open')

    /*
     * IA-04. prerender.js writes the title and the canonical on every page and
     * nothing in the app used to write them again, so this assertion existed
     * for the cold load alone and passed while every in-app navigation was
     * wrong: the tab, the bookmark, the history entry and the screen reader all
     * still named the page the reader LANDED on.
     *
     * Asserted as an invariant — the document is named whatever the h1 says —
     * rather than against a driver's name, which is the hardcoded-figure habit
     * PD-07 and PD-03 exist to undo.
     */
    await deep.evaluate(() => {
      window.history.pushState({}, '', '/drivers/moss')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await deep.waitForFunction(
      () => {
        // An absent h1 is the gap mid-transition, not the new page: `?.` makes
        // the negation vacuously true and the wait returns before Moss renders.
        const h1 = document.querySelector('#root main h1')
        return Boolean(h1) && !h1.textContent.includes('Hamilton')
      },
      null,
      { timeout: 20000 },
    )
    const renamed = await deep.$eval('#root main h1', (n) => n.textContent.trim())
    is(await deep.title(), `${renamed} — Lap Ledger`, 'an in-app navigation renames the document')
    is(
      await deep.$eval('link[rel=canonical]', (node) => new URL(node.href).pathname),
      '/drivers/moss',
      'and repoints the canonical at the page actually being read',
    )

    await deep.close()

    // The old addresses, cold. prerender.js writes a redirecting page at each
    // rather than leaving a 404 where a bookmark or a citation used to resolve;
    // it names the new address canonical and carries the query across.
    const movedStatic = readFileSync(join(web, 'dist', 'reference', 'quality', 'index.html'), 'utf8')
    truthy(
      /http-equiv="refresh"[^>]*url=\/data\/quality/.test(movedStatic) &&
        /<link rel="canonical" href="[^"]*\/data\/quality"/.test(movedStatic),
      'dist/reference/quality/index.html sends the reader to /data/quality and names it canonical',
    )
    truthy(movedStatic.includes('name="robots" content="noindex"'), 'and asks not to be indexed itself')
    const moved = await browser.newPage()
    await moved.goto(`${BASE}/reference/sql?q=SELECT%207%20AS%20n`, { waitUntil: 'domcontentloaded' })
    await moved.waitForFunction(
      () => location.pathname === '/data/sql' && new URLSearchParams(location.search).get('q') === 'SELECT 7 AS n',
      null,
      { timeout: 20000 },
    )
    pass('a cold arrival at /reference/sql?q=… is sent to /data/sql with its query')
    await moved.close()

    // /now, cold. Not a moved address but an alias, written by the same
    // machinery and on the same terms: noindex, the season page canonical,
    // and absent from the sitemap, which lists the addresses to index.
    const season = one("SELECT value FROM meta WHERE key = 'current_season'")
    const nowStatic = readFileSync(join(web, 'dist', 'now', 'index.html'), 'utf8')
    truthy(
      new RegExp(`http-equiv="refresh"[^>]*url=/seasons/${season}`).test(nowStatic) &&
        new RegExp(`<link rel="canonical" href="[^"]*/seasons/${season}"`).test(nowStatic),
      `dist/now/index.html sends a cold arrival to /seasons/${season} and names it canonical`,
    )
    truthy(
      nowStatic.includes('name="robots" content="noindex"') && !nowStatic.includes('has moved'),
      'asks not to be indexed, and does not tell the reader the season page moved',
    )
    truthy(
      !readFileSync(join(web, 'dist', 'sitemap.xml'), 'utf8').includes('/now</loc>'),
      'and is not in the sitemap; the season page is the address to index',
    )

    const noJs = await browser.newContext({ javaScriptEnabled: false })
    const plain = await noJs.newPage()
    await plain.goto(`${BASE}/races/2021/10`, { waitUntil: 'domcontentloaded' })
    const body = await plain.$eval('#prerendered', (node) => node.textContent)
    truthy(body.includes('British Grand Prix'), 'a race page names its Grand Prix without JavaScript')
    truthy(
      body.includes(one('SELECT winner FROM race_results WHERE year = 2021 AND round = 10')),
      'and names the winner the database holds',
    )
    atLeast(
      await plain.$$eval('#prerendered tbody tr', (n) => n.length),
      20,
      'and carries the full classification as real table rows',
    )
    atLeast(
      await plain.$$eval('#prerendered a[href^="/"]', (n) => n.length),
      20,
      'and links onward, so a crawler has somewhere to go',
    )
    truthy(
      await plain.$eval(
        '#prerendered .skiplink',
        (node) => node.getAttribute('href') === '#main' && Boolean(node.closest('.app')?.querySelector('main#main')),
      ),
      'and offers the same skip link, to the same target, without JavaScript',
    )
    await noJs.close()

    // A search arrival reads the static page; its footer has to date the figures.
    const staticFoot = readFileSync(join(web, 'dist', 'drivers', 'hamilton', 'index.html'), 'utf8')
    truthy(
      staticFoot.includes(`v${one(`SELECT value FROM meta WHERE key = 'version'`)}`) &&
        staticFoot.includes(one(`SELECT value FROM meta WHERE key = 'built'`)),
      'the static footer carries the version and build date',
    )
    truthy(
      staticFoot.includes(`<dt>${CHECKED_LABEL}</dt><dd>${LAST_CHECKED}</dd>`),
      `and when the sources were last checked (${LAST_CHECKED}), on every page and not only /changes`,
    )

    const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text())
    const urls = (sitemap.match(/<loc>/g) ?? []).length
    const expected =
      1 + // home
      1 + one('SELECT COUNT(*) AS n FROM seasons') + // index + one per season
      1 + one('SELECT COUNT(*) FROM races') +
      1 + one('SELECT COUNT(*) FROM drivers') +
      1 + one('SELECT COUNT(*) FROM constructors') +
      1 + one('SELECT COUNT(*) FROM circuits') +
      1 + one('SELECT COUNT(*) FROM grands_prix') + // IA-01
      // /cars/<id> is the UNION of the chassis register and the curated cars,
      // because Car.jsx resolves that route against either: a chassis id, or a
      // car id where no chassis owns it (six do, `lotus-72` among them). Counting
      // `cars` alone is what let 1,130 routes work in the app and 404 to anybody
      // who followed a shared link.
      1 + one(`SELECT COUNT(*) FROM (
               SELECT id FROM chassis UNION SELECT id FROM cars
             )`) -
      // IA-06: less the chassis pages that are copies of a curated car's -
      // a car that is one chassis under another id - which name the car's
      // page as canonical and so are not addresses for an index to hold.
      one(`SELECT COUNT(*) FROM cars c
            WHERE NOT EXISTS (SELECT 1 FROM chassis y WHERE y.id = c.id)
              AND (SELECT COUNT(*) FROM chassis x WHERE x.car_id = c.id) = 1`) +
      10 + // records, data and its three children, eras, glossary, changes, about, compare (PD-43)
      // SD-20: feed.xml is listed too. It is not a page, but it is an address
      // worth recrawling, and its lastmod is the one on the site that moves
      // whenever the data does.
      1
    is(urls, expected, 'the sitemap lists every page the database implies')
    truthy(
      sitemap.includes('/data/quality</loc>') && !sitemap.includes('/reference/quality') && !sitemap.includes('/reference</loc>'),
      'the sitemap lists the new addresses and none of the moved ones',
    )
    /*
     * SD-19. Every URL used to carry `meta.built`, so the sitemap told a
     * crawler that 3,539 pages of wildly different shelf lives had all
     * changed on the same day. A page is now dated by the last race it
     * describes, and only a page that describes no single entity keeps the
     * build date.
     */
    const stamps = [...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]])
    const builtOn = one(`SELECT value FROM meta WHERE key = 'built'`)
    is(stamps.length, expected, 'every sitemap URL carries a lastmod')
    atLeast(new Set(stamps.map(([, d]) => d)).size, 100, 'and they are not all the same date')
    truthy(
      stamps.every(([, d]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= builtOn),
      'no page claims to have changed after the database was built',
    )
    const firstOf54 = one('SELECT date_iso FROM races WHERE year = 1954 AND round = 1')
    truthy(
      stamps.some(([loc, d]) => loc.endsWith('/races/1954/1') && d === firstOf54),
      'a finished race page is dated by the race, not by the build',
    )
    truthy(
      stamps.some(([loc, d]) => loc.endsWith('/drivers') && d === builtOn),
      'an index page, which describes no one entity, keeps the build date',
    )

    /*
     * A page's date has to come from what the page shows, and for /cars/<id>
     * that is not `race_entries.car_id`: `ENTRIES` resolves the id through
     * `chassis`, so a curated car covers every chassis of the design and a
     * chassis covers only itself. Dating them off the entry's own columns put
     * six pages on a race they do not render, three of them on a later car of
     * the same lineage. This asks every car page the question its own table
     * answers.
     */
    const raceDates = new Map(
      db
        .prepare('SELECT year, round, date_iso FROM races')
        .all()
        .map((r) => [`${r.year}/${r.round}`, r.date_iso]),
    )
    const carEntries = db.prepare(CAR_ENTRIES)
    const misdated = []
    for (const [loc, d] of stamps) {
      const id = loc.match(/\/cars\/([^/]+)$/)?.[1]
      if (!id) continue
      const shown = carEntries
        .all(id)
        .map((e) => raceDates.get(`${e.year}/${e.round}`))
        .filter((date) => date && date <= builtOn)
        .sort()
      const expect = shown.at(-1) ?? builtOn
      if (d !== expect) misdated.push(`${id} ${d} not ${expect}`)
    }
    truthy(
      misdated.length === 0,
      `every car page is dated by the newest entry its own query shows${
        misdated.length ? ` — ${misdated.slice(0, 5).join('; ')}` : ''
      }`,
    )

    truthy((await fetch(`${BASE}/robots.txt`).then((r) => r.text())).includes('Sitemap:'), 'robots.txt points at it')

    /*
     * PD-02, rung one. The static table and the app's table on the same route
     * came from different SQL and different header rows — eight columns to the
     * app's nine on /drivers, a Category column on /records the app never
     * shows, stored figures against derived ones on a driver page. Both now
     * read web/src/queries/*, and this asks each pair for the same strings:
     * the headers in order, the row count, then every row the app shows, cell
     * for cell (the app pages a long table; the static half prints it whole).
     * The static half is read as a crawler reads it, from the served HTML; the
     * app's from the DOM after navigating to the route in-app. A reviewer need
     * not rebuild this comparison; it is what this block is for.
     */
  })


  await section('Share images and static photographs', async () => {
    /*
     * PD-20 and PD-19, which are one row of `article_images` seen twice: the
     * photograph on the page and the photograph a shared link shows.
     *
     * Read from dist/ rather than the browser. Both are facts about what was
     * SERVED — an unfurler never runs the app, and neither does a crawler — and
     * the interesting pages are the ones no walkthrough visits.
     */
    const distDir = join(web, 'dist')

    // The card the other 3,100 pages carry. An og:image pointing at a file the
    // build did not write is the grey box again, so the bytes are checked, not
    // the tag: signature, then the dimensions out of IHDR.
    const cardPath = join(distDir, 'share-card.png')
    if (!existsSync(cardPath)) {
      fail('dist/share-card.png was not written')
    } else {
      const card = readFileSync(cardPath)
      const signed = card.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      truthy(signed, 'dist/share-card.png is a PNG, which is what an unfurler will rasterise')
      // 1200x630 is the size every platform documents as needing no crop, and
      // the size the tags declare; a card that disagrees with its own
      // og:image:width is cropped by whoever believes the tag.
      is(`${card.readUInt32BE(16)}x${card.readUInt32BE(20)}`, '1200x630', 'at the size the tags declare')
    }

    // Every page. The four that carry none are the redirecting stubs, and they
    // are the one place it would be wrong: they ask not to be indexed and exist
    // to be left immediately.
    const walk = (dir) =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) return walk(full)
        return entry === 'index.html' ? [full] : []
      })
    const served = walk(distDir)
    atLeast(served.length, 3000, 'prerendered pages read from dist')

    /*
     * The rule main.jsx tells a page from a file by, held against the built
     * site from both ends. Asked here because this is where every page is
     * already in hand, one read of dist rather than two.
     *
     * During the boot window a click on the static page is held — the URL
     * moves, the asked-for page's prerendered half is fetched and swapped in,
     * and the database download is never restarted. That is right for a page
     * and wrong for a file: /data links to /f1.db, /f1-parquet.zip,
     * /schema.sql, /ATTRIBUTION.md, /LICENSE-DATA and /SHA256SUMS with no
     * `download` attribute, and holding one of those moved the address bar,
     * downloaded nothing, and left the router to render a 404 for it when the
     * database opened. The test it uses is that a route is a slug; so every
     * route has to pass it, and every link to something that is not a route
     * has to fail it. Neither half is worth anything without the other.
     */
    const slug = /^[a-z0-9-/]*$/
    const routes = new Set(served.map((file) => `/${relative(distDir, dirname(file))}`.replace(/\/$/, '') || '/'))
    const unheld = [...routes].filter((route) => !slug.test(route))
    truthy(
      unheld.length === 0,
      `every one of the ${routes.size} routes is a slug, so a click on a link to one is held${
        unheld.length ? ` — ${unheld.slice(0, 5).join(', ')}` : ''
      }`,
    )
    const filesHeld = [
      ...new Set(
        served.flatMap((file) =>
          [...readFileSync(file, 'utf8').matchAll(/href="(\/[^"#?]*)/g)].map((match) => match[1]),
        ),
      ),
    ].filter((href) => !routes.has(href.replace(/\/$/, '') || '/') && slug.test(href))
    truthy(
      filesHeld.length === 0,
      `and every root-relative link that is not a route — the database, the documents, the feed — fails it, so the browser gets the click${
        filesHeld.length ? ` — ${filesHeld.slice(0, 5).join(', ')}` : ''
      }`,
    )
    const missingCard = served
      .map((file) => ({ file, html: readFileSync(file, 'utf8') }))
      .filter(({ html }) => !/<meta property="og:image" content="[^"]+"/.test(html))
    const naked = missingCard.filter(({ html }) => !/name="robots" content="noindex"/.test(html))
    if (naked.length === 0) {
      pass(
        `all ${served.length - missingCard.length} indexable prerendered pages carry an og:image ` +
          `(${missingCard.length} noindex redirect stub(s) carry none, which is right)`,
      )
    } else {
      for (const { file } of naked.slice(0, 5)) fail(`no og:image: ${relative(distDir, file)}`)
      if (naked.length > 5) fail(`…and ${naked.length - 5} more pages with no og:image`)
    }

    /*
     * The card a car page carries, against the rule that decides it.
     *
     * A `name_matches = 0` photograph is shown on the page with its mark, and
     * must NOT become the card: the file name does not name the car, and one of
     * these leads its article with a picture of police officers. On the page
     * that is labelled; in somebody else's feed it is the whole impression. So
     * the set of car pages whose og:image is a Commons file is compared with
     * the set the database says it should be — not a sample, because the
     * failure this guards against is one page, somewhere, quietly wrong.
     */
    const carDirs = readdirSync(join(distDir, 'cars')).filter((entry) =>
      statSync(join(distDir, 'cars', entry)).isDirectory(),
    )
    const images = db.prepare(CAR_IMAGES)
    const wrong = []
    let shownCards = 0
    for (const id of carDirs) {
      const rows = images.all(id, id).filter(canShow)
      const confirmed = rows.slice(0, PHOTOGRAPHS_SHOWN).find((row) => row.name_matches === 1) ?? null
      const html = readFileSync(join(distDir, 'cars', id, 'index.html'), 'utf8')
      const found = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? null
      const tagged = found === null ? null : unescaped(found)
      const commons = tagged?.includes('commons.wikimedia.org') ? tagged : null
      if (confirmed) {
        shownCards += 1
        const file = encodeURIComponent(confirmed.file_name.replace(/^File:/, '').replace(/ /g, '_'))
        if (commons !== `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=1200`) {
          wrong.push(`/cars/${id}: expected its confirmed photograph, got ${commons ?? 'the site card'}`)
        }
        // The credit has to travel WITH the picture. An unfurler draws the file
        // in its own feed with none of the page's markup around it, so
        // og:image:alt is the only caption that leaves with it — and it must be
        // the caption, not the file name on its own.
        const alt = unescaped(/<meta property="og:image:alt" content="([^"]*)"/.exec(html)?.[1] ?? '')
        const credit = `${fileTitle(confirmed.file_name)} · ${attribution(confirmed)} · ${confirmed.licence.trim()}`
        if (alt !== credit) wrong.push(`/cars/${id}: og:image:alt is "${alt}", not the photograph's credit`)
      } else if (commons) {
        wrong.push(`/cars/${id}: an unconfirmed photograph became the share card`)
      }
    }
    if (wrong.length === 0) {
      pass(`${shownCards} of ${carDirs.length} car pages carry their confirmed photograph, and no other page carries one`)
    } else {
      for (const message of wrong.slice(0, 5)) fail(message)
      if (wrong.length > 5) fail(`…and ${wrong.length - 5} more`)
    }

    /*
     * The credit, on the static half. Same failure mode as the app check on
     * /cars/mclaren-mp4-4 and the same assertion: EVERY figure the page draws
     * names its photographer and its licence. A static renderer that forgets is
     * a licence breach on 762 pages that no walkthrough of the app would see.
     */
    const withPhotos = carDirs.filter((id) => images.all(id, id).filter(canShow).length > 0)
    atLeast(withPhotos.length, 1, 'car pages that join to a photograph')
    const uncredited = []
    let figures = 0
    for (const id of withPhotos) {
      const html = readFileSync(join(distDir, 'cars', id, 'index.html'), 'utf8')
      const captions = [...html.matchAll(/<figcaption>([\s\S]*?)<\/figcaption>/g)].map((m) => m[1])
      const expected = images.all(id, id).filter(canShow).slice(0, PHOTOGRAPHS_SHOWN)
      if (captions.length !== expected.length) {
        uncredited.push(`/cars/${id}: ${expected.length} photograph(s), ${captions.length} caption(s)`)
        continue
      }
      expected.forEach((row, at) => {
        figures += 1
        const caption = unescaped(captions[at].replace(/<[^>]+>/g, ''))
        if (!caption.includes(attribution(row))) uncredited.push(`/cars/${id}: ${row.file_name} names no photographer`)
        else if (!caption.includes(row.licence.trim())) uncredited.push(`/cars/${id}: ${row.file_name} names no licence`)
        else if (!caption.includes(fileTitle(row.file_name))) uncredited.push(`/cars/${id}: ${row.file_name} names no file`)
      })
    }
    if (uncredited.length === 0) {
      pass(`all ${figures} static photograph(s) on ${withPhotos.length} pages carry their file, photographer and licence`)
    } else {
      for (const message of uncredited.slice(0, 5)) fail(message)
      if (uncredited.length > 5) fail(`…and ${uncredited.length - 5} more`)
    }

    /*
     * The same obligation on the pages VD-33 reached: constructor, season and
     * race. 762 static pages showed a photograph before it and 2,068 do now,
     * so this is where a licence breach would sit unseen — every one of them,
     * not a sample, because the failure is one page somewhere quietly wrong.
     *
     * Each is checked against the app's own query, so the static page holds
     * the six the app holds rather than a second selection. The subject line
     * and the alt are checked here too (AX-13): an alt that has gone back to
     * the file name is not visible in any count of figures.
     */
    const dirsIn = (...parts) => {
      const dir = join(distDir, ...parts)
      return existsSync(dir)
        ? readdirSync(dir).filter((entry) => statSync(join(dir, entry)).isDirectory())
        : []
    }
    const surfaces = []
    for (const id of dirsIn('constructors')) surfaces.push({ at: `constructors/${id}`, query: CONSTRUCTOR_IMAGES, args: [id] })
    for (const year of dirsIn('seasons')) surfaces.push({ at: `seasons/${year}`, query: SEASON_IMAGES, args: [Number(year)] })
    for (const year of dirsIn('races')) {
      for (const round of dirsIn('races', year)) {
        surfaces.push({ at: `races/${year}/${round}`, query: RACE_IMAGES, args: [Number(year), Number(round)] })
      }
    }
    atLeast(surfaces.length, 1000, 'constructor, season and race pages read from dist')

    const prepared = new Map()
    const broken = []
    let reached = 0
    let strips = 0
    for (const { at, query, args } of surfaces) {
      const file = join(distDir, at, 'index.html')
      if (!existsSync(file)) continue
      if (!prepared.has(query)) prepared.set(query, db.prepare(query))
      const expected = prepared.get(query).all(...args).filter(canShow).slice(0, PHOTOGRAPHS_SHOWN)
      const html = readFileSync(file, 'utf8')
      // The photographs only: a race page also draws the circuit's outline,
      // which is a <figure> with a caption of its own and no licence to name.
      const drawn = [...html.matchAll(/<figure class="photo">([\s\S]*?)<\/figure>/g)].map((m) => m[1])
      if (drawn.length !== expected.length) {
        broken.push(`/${at}: ${expected.length} photograph(s), ${drawn.length} drawn`)
        continue
      }
      if (expected.length === 0) continue
      strips += 1
      expected.forEach((row, at_) => {
        reached += 1
        const figure = drawn[at_]
        const caption = unescaped(/<figcaption>([\s\S]*?)<\/figcaption>/.exec(figure)?.[1]?.replace(/<[^>]+>/g, '') ?? '')
        const alt = unescaped(/<img [^>]*alt="([^"]*)"/.exec(figure)?.[1] ?? '')
        if (!caption.includes(attribution(row))) broken.push(`/${at}: ${row.file_name} names no photographer`)
        else if (!caption.includes(row.licence.trim())) broken.push(`/${at}: ${row.file_name} names no licence`)
        else if (!caption.includes(fileTitle(row.file_name))) broken.push(`/${at}: ${row.file_name} names no file`)
        else if (!caption.includes(row.article)) broken.push(`/${at}: ${row.file_name} does not say which car it is`)
        else if (alt !== row.article) broken.push(`/${at}: alt is "${alt}", not "${row.article}"`)
      })
    }
    if (broken.length === 0) {
      pass(`all ${reached} photograph(s) on ${strips} constructor, season and race pages carry their credit, their car and an alt that names it`)
    } else {
      for (const message of broken.slice(0, 5)) fail(message)
      if (broken.length > 5) fail(`…and ${broken.length - 5} more`)
    }
  })

  /*
   * One h1 and one title per route, whichever renderer drew it (PD-40).
   *
   * Nine of eighteen sampled routes disagreed when this was written: the home
   * page was a different page in each half, 1,196 race pages dropped the year
   * at the handover and 78 season pages collapsed to the bare year. The
   * headings now come from NAMES in src/lib/site.js, which both halves read,
   * and this is what holds them there - one route per kind of page, since the
   * kind is what carries a heading and not the row behind it.
   *
   * The static half is read from the server rather than from the app's own
   * DOM, and the app's is read after the handover, so this compares the two
   * documents a reader actually gets.
   */
  await section('Both renderers name the page the same way', async () => {
    const ROUTES = [
      '/',
      '/seasons',
      '/seasons/2026',
      // The two page STATES the kinds above do not reach: a season whose
      // rounds have all still to be run, and a round with no result yet.
      '/seasons/2027',
      '/races',
      '/races/1976/9',
      '/races/2027/1',
      '/drivers',
      '/drivers/senna',
      '/compare',
      '/constructors',
      '/constructors/ferrari',
      '/circuits',
      '/circuits/monza',
      '/cars',
      '/cars/lotus-72',
      // IA-06: a curated car that is one chassis under another id, and one
      // whose id a chassis shares - both named after the chassis in the app,
      // and both after the curated row in the static page, until they agreed.
      '/cars/mercedes-w11',
      '/cars/brabham-bt46',
      '/records',
      '/reference/eras',
      '/reference/glossary',
      '/data',
      '/data/quality',
      '/data/sources',
      '/data/sql',
      '/about',
      '/changes',
    ]
    const flat = (value) => unescaped(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const wrong = []
    for (const route of ROUTES) {
      const html = await (await fetch(`${BASE}${route}`)).text()
      const served = {
        title: flat((html.match(/<title>([\s\S]*?)<\/title>/) ?? ['', ''])[1]),
        h1: flat(
          (html.split('<div id="prerendered">')[1]?.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? ['', ''])[1],
        ),
      }
      await go(route)
      const app = await page.evaluate(() => ({
        title: document.title,
        h1: document.querySelector('#root main h1')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
      }))
      if (!served.h1) wrong.push(`${route}: the static page opens on no h1`)
      else if (!app.h1) wrong.push(`${route}: the app opens on no h1`)
      else if (app.h1 !== served.h1) wrong.push(`${route}: h1 \u2014 app \u201c${app.h1}\u201d, static \u201c${served.h1}\u201d`)
      else if (app.title !== served.title)
        wrong.push(`${route}: title \u2014 app \u201c${app.title}\u201d, static \u201c${served.title}\u201d`)
    }
    if (wrong.length === 0) {
      pass(`all ${ROUTES.length} routes carry one h1 and one document title across both renderers`)
    } else {
      for (const message of wrong.slice(0, 6)) fail(message)
      if (wrong.length > 6) fail(`\u2026and ${wrong.length - 6} more`)
    }
  })

  await section('Static tables are the app’s tables', async () => {
    {
      // esc() in prerender.js writes exactly these five entities, and the
      // app's textContent has the characters themselves. &amp; last, so an
      // escaped ampersand does not turn into a second round of decoding.
      const decode = (html) =>
        unescaped(html.replace(/<[^>]+>/g, ''))
          .replace(/\s+/g, ' ')
          .trim()

      // The first table after the h2 given, or the page's first table: its
      // headers, and every row.
      const staticTable = (html, heading) => {
        // prerender.js escapes the apostrophe in "Drivers' standings".
        const from = heading ? html.indexOf(`<h2>${heading.replace(/&/g, '&amp;').replace(/'/g, '&#39;')}</h2>`) : 0
        if (from < 0) return null
        const start = html.indexOf('<table>', from)
        const end = html.indexOf('</table>', start)
        if (start < 0 || end < 0) return null
        const markup = html.slice(start, end)
        const cells = (row, tag) =>
          [...row.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => decode(m[1]))
        const body = markup.slice(markup.indexOf('<tbody>'))
        // A body cell is a <td> or, for the column that names the row, a
        // <th scope="row"> (AX-21); both are cells of the row, in order.
        const bodyCells = (row) => [...row.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/g)]
        const first = body.match(/<tr>([\s\S]*?)<\/tr>/)?.[1] ?? ''
        return {
          // AX-17: the name the table gives assistive technology, which is the
          // heading above it in both halves. Read from the whole slice, not
          // from the head: a <caption> is a child of <table>, before <thead>.
          caption: decode((markup.match(/<caption[^>]*>([\s\S]*?)<\/caption>/) ?? ['', ''])[1]),
          heads: cells(markup.slice(0, markup.indexOf('</thead>')), 'th'),
          rows: [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => bodyCells(m[1]).map((c) => decode(c[2]))),
          rowHeads: bodyCells(first)
            .map((c, i) => (c[1] === 'th' && /scope="row"/.test(c[0]) ? i : -1))
            .filter((i) => i >= 0),
        }
      }

      // The app's table under the same heading, or its first table that is not
      // a chart's own. The sort arrow is markup, not part of a header.
      const appTable = (heading) =>
        page.evaluate((heading) => {
          const main = document.querySelector('#root main')
          const clean = (node) => node.textContent.replace(/[▲▼]/g, '').replace(/\s+/g, ' ').trim()
          let scope = main
          if (heading) {
            const h2 = [...main.querySelectorAll('h2')].find((h) => clean(h).startsWith(heading))
            scope = h2?.closest('section') ?? h2?.parentElement ?? null
          }
          const wrap = [...(scope?.querySelectorAll('.table-wrap') ?? [])].find((n) => !n.closest('figure.figure'))
          const table = wrap?.querySelector('table')
          if (!table) return null
          return {
            caption: table.querySelector('caption') ? clean(table.querySelector('caption')) : '',
            heads: [...table.querySelectorAll('thead th')].map(clean),
            rows: [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map(clean)),
            rowHeads: [...(table.querySelector('tbody tr')?.children ?? [])]
              .map((c, i) => (c.tagName === 'TH' && c.getAttribute('scope') === 'row' ? i : -1))
              .filter((i) => i >= 0),
            // The whole table's count, shown or paged away.
            total: Number(wrap.dataset.rows),
          }
        }, heading ?? null)

      // `prefix`: the static table is a declared leading slice of the app's,
      // as /races says in its lede ("the 200 most recently run"); every other
      // static table holds every row.
      const same = async (route, h1, heading, { prefix = false } = {}) => {
        const html = await (await fetch(`${BASE}${route}`)).text()
        const served = staticTable(html, heading)
        await go(route, h1)
        const app = await appTable(heading)
        const where = heading ? `${route} “${heading}”` : route
        truthy(served && app, `${where}: both renderers carry the table`)
        if (!served || !app) return
        is(served.heads.join(' | '), app.heads.join(' | '), `${where}: the static headers are the app’s, in order`)
        // AX-17. Unnamed, a table announces itself as "table, 10 columns, 862
        // rows"; the two halves take the name from the same heading, so the
        // check is that it is there and that it is the same one.
        truthy(app.caption, `${where}: the app’s table names itself — “${app.caption}”`)
        is(served.caption, app.caption, `${where}: the static table gives the same name`)
        // AX-21. The cell that says which row this is: there is one, and the
        // two halves put it in the same column.
        truthy(app.rowHeads.length > 0, `${where}: the app’s rows are named by a row header`)
        is(served.rowHeads.join(','), app.rowHeads.join(','), `${where}: the static row headers are the app’s columns`)
        if (prefix) {
          truthy(
            served.rows.length > 0 && served.rows.length <= app.total,
            `${where}: the static table is a leading slice of the app’s ${app.total} rows — ${served.rows.length}`,
          )
        } else is(served.rows.length, app.total, `${where}: the static table holds every row the app’s does`)
        const shown = Math.min(app.rows.length, served.rows.length)
        const differ = app.rows.slice(0, shown).findIndex((r, k) => r.join(' | ') !== served.rows[k].join(' | '))
        if (differ < 0) pass(`${where}: all ${shown} shown rows read the same, cell for cell`)
        else
          fail(
            `${where}: row ${differ + 1} differs — app “${app.rows[differ].join(' | ')}”, static “${served.rows[differ].join(' | ')}”`,
          )
      }

      await same('/drivers', 'Drivers')
      // Hamilton, not a driver who split a season between two teams: the
      // Amon's four two-team seasons put a group_concat in the constructor
      // cell; sql.js and node:sqlite agree on its order today, and this is
      // what notices if a SQLite bump makes them disagree.
      await same('/drivers/hamilton', 'Hamilton', 'Season by season')
      await same('/drivers/amon', 'Chris Amon', 'Season by season')
      // PD-43. Senna's thirteen pairings, and Brabham's 176, which page in the
      // app at 100 and are all on the static page: the comparison is of every
      // row the app holds, not of the page it happens to show.
      await same('/drivers/senna', 'Ayrton Senna', 'Team-mates')
      await same('/drivers/brabham', 'Sir Jack Brabham', 'Team-mates')
      await same('/records', 'Records')

      // Rung two: the seasons list, a season's calendar and its two standings
      // tables - headed by the shared rule, so the check asks for the heading
      // the season in progress actually gets - and the races list.
      const open = db.prepare('SELECT year FROM seasons WHERE drivers_champion IS NULL AND year = ? LIMIT 1').get(inProgress())
      await same('/seasons', 'Seasons')
      if (open) {
        // Newest first, so the top row is the latest season the register
        // holds - which is a calendar, not a leaderboard, whenever one has
        // been announced ahead of the season being run. Both rows are
        // checked, and the two must not read alike (IA-17).
        const listed = (await appTable(null))?.rows ?? []
        const rowFor = (year) => listed.find((r) => String(r[0]) === String(year))?.join(' | ') ?? ''
        const newest = one('SELECT MAX(year) FROM seasons')
        truthy(
          rowFor(open.year).includes(SO_FAR),
          `the season in progress carries its leader on /seasons, marked “${SO_FAR}”`,
        )
        if (newest !== open.year) {
          const ahead = rowFor(newest)
          truthy(
            String(listed[0]?.[0]) === String(newest) && ahead.includes(NOT_YET_RUN) && !ahead.includes(SO_FAR),
            `/seasons opens on ${newest}, a calendar announced and “${NOT_YET_RUN}”`,
          )
        }
        const after = one("SELECT MAX(after_round) FROM standings WHERE year = ? AND table_type = 'drivers'", open.year)
        // The entry list is a table of the season being run, so it is here
        // and on no other season page.
        await same(`/seasons/${open.year}`, String(open.year), 'On the grid')
        await same(`/seasons/${open.year}`, String(open.year), 'The calendar')
        await same(`/seasons/${open.year}`, String(open.year), standingsHeading("Drivers'", true, after))
        await same(`/seasons/${open.year}`, String(open.year), standingsHeading("Constructors'", true, after))
      }
      const done = one('SELECT MAX(year) FROM seasons WHERE drivers_champion IS NOT NULL')
      await same(`/seasons/${done}`, String(done), 'The calendar')
      await same(`/seasons/${done}`, String(done), standingsHeading("Drivers'", false))
      await same(`/seasons/${done}`, String(done), 'Who entered')
      await same('/races', 'Races', null, { prefix: true })
      {
        // Run first: the list opens on the last race run, not the next one scheduled.
        const first = (await appTable(null))?.rows[0]?.join(' | ') ?? ''
        truthy(first && !first.includes(NOT_YET_RUN), 'the races list opens on the last race run')
        // Then the races still to come, soonest first across seasons as well as
        // within one (AF-44): the season term once ran newest first for both.
        const next = db
          .prepare("SELECT r.year, r.round FROM races r JOIN race_results rr ON rr.id = r.id WHERE r.status = 'scheduled' ORDER BY r.year, r.round")
          .all()
          .map((r) => `${r.year} | ${r.round}`)
        if (next.length) {
          const rowsAre = (n) => page.waitForFunction((n) => document.querySelector('#root main .table-wrap')?.dataset.rows === String(n), n, { timeout: 10000 })
          await page.click('[role="group"][aria-label="Filter races by status"] button:has-text("Scheduled")')
          await rowsAre(next.length)
          const shown = ((await appTable(null))?.rows ?? []).map((r) => r.slice(0, 2).join(' | '))
          is(shown[0], next[0], `the scheduled races open on the next one to be run, ${next[0]}`)
          is(shown.join(' / '), next.slice(0, shown.length).join(' / '), 'the scheduled races run in calendar order')
          await page.click('[role="group"][aria-label="Filter races by status"] button:has-text("All")')
        } else pass('no race is scheduled, so there is no calendar order to check')
      }
      // Rung three: the three remaining registers.
      await same('/constructors', 'Constructors')
      await same('/circuits', 'Circuits', 'Every venue')
      await same('/grands-prix', 'Grands Prix')
      await same('/grands-prix/french', 'French Grand Prix', 'Where it has been held')
      await same('/grands-prix/french', 'French Grand Prix', 'Most wins')
      await same('/grands-prix/french', 'French Grand Prix', 'Every edition')
      // The car an entrant ran where no constructor row exists (AF-64).
      await same('/grands-prix/indianapolis-500', 'Indianapolis 500', 'Every edition')
      // An event with a round still to come, whose Winner and Car cells say
      // so in both halves.
      {
        const upcoming = one("SELECT gp_id FROM races WHERE status = 'scheduled' ORDER BY year, round LIMIT 1")
        if (upcoming) {
          const name = one('SELECT name FROM grands_prix WHERE id = ?', upcoming)
          await same(`/grands-prix/${upcoming}`, name, 'Where it has been held')
          await same(`/grands-prix/${upcoming}`, name, 'Every edition')
        }
      }
      await same('/cars', 'Cars', 'The chassis register')
      // Rung four: a race page's four tables - a sprint weekend with pit stops
      // and knock-out qualifying, a pre-2006 race with one time per driver, and
      // the shared drive whose "shared" mark both renderers must carry.
      const gp = (year, round) => one('SELECT name_used FROM races WHERE year = ? AND round = ?', year, round)
      const sprintRound = one("SELECT MIN(r.round) FROM races r WHERE r.year = 2026 AND r.sprint = 1 AND r.status = 'completed'")
      if (sprintRound) {
        for (const heading of ['Classification', 'Qualifying', 'Sprint', 'Pit stops']) {
          await same(`/races/2026/${sprintRound}`, gp(2026, sprintRound), heading)
        }
      } else fail('no completed 2026 sprint weekend to compare the race tables on')
      await same('/races/1976/9', gp(1976, 9), 'Qualifying')
      await same('/races/1955/1', gp(1955, 1), 'Classification')
      // Rung five: a constructor's and a circuit's three tables each.
      for (const heading of ['Season by season', 'Every win', 'Cars built']) await same('/constructors/ferrari', 'Ferrari', heading)
      for (const heading of ['Most wins here', 'Constructors here', 'Every race held here']) {
        await same('/circuits/silverstone', 'Silverstone', heading)
      }
      // A venue with a race still to run: its row has a "not yet run" mark and
      // no winning car, which is where a column keyed "constructor" once found
      // Object.prototype.constructor and printed "[object Object]".
      const pending = db.prepare("SELECT c.id, c.name FROM circuits c JOIN races r ON r.circuit_id = c.id WHERE r.status = 'scheduled' ORDER BY r.round LIMIT 1").get()
      if (pending) await same(`/circuits/${pending.id}`, pending.name, 'Every race held here')
      // Rung six: the car page - a car whose variants are separate chassis, and
      // a chassis with a page of its own - and the reference and data pages.
      await same('/cars/lotus-72', 'Lotus', 'Variants')
      await same('/cars/lotus-72', 'Lotus', 'Every entry')
      await same('/cars/mclaren-mp4-4', 'McLaren MP4/4', 'Every entry')
      for (const heading of [
        'Engine formulae',
        'Scoring systems',
        'Regulation changes',
        'Regulation limits',
        'Technical innovations',
        'Governance',
        'Tyre suppliers',
      ]) {
        await same('/reference/eras', 'Eras', heading)
      }
      for (const heading of ['Glossary', 'People']) await same('/reference/glossary', 'Glossary', heading)
      for (const heading of ['What a licence cost, or bought', 'The source registry', 'Photograph licences']) {
        await same('/data/sources', 'Sources', heading)
      }
      for (const heading of [
        'The confidence ladder',
        'Disagreements kept rather than resolved',
        'Career totals against published ones',
        'Circuit geometry',
        'Where a result cannot be attributed to a car',
        'Rows nobody has checked',
      ]) {
        await same('/data/quality', 'Data quality', heading)
      }
    }

  })

  // ------------------------------------------------------- accessibility (axe)

  await section('Accessibility (axe-core, WCAG 2.2 AA)', async () => {
    // Deterministic, and free. The accessibility critic in .claude/agents/
    // reads pages with a language model and costs tens of thousands of tokens
    // a run; this asks axe-core the questions that have a mechanical answer —
    // a control with no name, a contrast ratio, a heading order, an ARIA
    // attribute its role does not take — on one page of each kind, so the
    // critic is left the judgement calls. Every rule axe tags for WCAG 2.0,
    // 2.1 and 2.2 at levels A and AA; best-practice rules are not gates.
    //
    // A violation names the rule, the count and the first node, which is
    // what a fix needs.
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    const race = one('SELECT name_used FROM races WHERE year = 1976 AND round = 9')
    const pages = [
      ['/', null],
      ['/drivers', 'Drivers'],
      ['/drivers/senna', 'Ayrton Senna'],
      ['/seasons/1976', '1976'],
      ['/races/1976/9', race],
      ['/constructors/ferrari', 'Ferrari'],
      ['/circuits/silverstone', 'Silverstone'],
      ['/cars/mclaren-mp4-4', 'McLaren MP4/4'],
      ['/records', 'Records'],
      ['/data/sql', 'SQL console'],
      // PD-43: two pickers, two tables and a sentence, none of which the
      // pages above have in that arrangement.
      ['/compare?a=senna&b=prost', 'Ayrton Senna and Alain Prost'],
      // The one page here that is prose and nothing else - no table, no
      // query, six sections and a way onward - which is a shape none of
      // the nine above covers.
      ['/about', 'About'],
    ]
    for (const [route, heading] of pages) {
      await go(route, heading)
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      if (violations.length === 0) {
        pass(`${route}: no WCAG 2.2 AA violations`)
        continue
      }
      for (const v of violations) {
        const where = v.nodes[0]?.target?.join(' ') ?? ''
        fail(`${route}: ${v.id} (${v.impact}) — ${v.help}; ${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'}, e.g. ${where}`)
      }
    }
  })

  // ------------------------------------------------------- console cleanliness

  await section('Console', async () => {
    // A missing photograph is a Commons request this test cannot control; a
    // failure inside the app is not.
    const real = consoleErrors.filter(siteError)
    if (real.length === 0) pass('no errors logged during the run')
    else real.forEach((message) => fail(`console error: ${message}`))
  })
} finally {
  await browser?.close()
  db.close()
  stop()
}

// A subset that passes is not a site that passes; the summary says so
// rather than reading like a clean bill of health. A pattern that matched
// nothing ran Boot and Console only, which is not a subset of anything the
// caller asked for: a mistyped route must read red, not green.
if (ONLY.length && matched === 0) {
  fail(`--only ${ONLY.join(' ')} matched no section heading; \`--list\` prints them`)
}
const scope = skipped ? ` — ${skipped} section${skipped === 1 ? '' : 's'} skipped by --only` : ''
console.log(
  failures.length === 0
    ? `\nAll checks passed: ${passed} checks${scope}.\n`
    : `\n${failures.length} check${failures.length === 1 ? '' : 's'} failed, ${passed} passed${scope}.\n`,
)
process.exit(failures.length === 0 ? 0 : 1)
