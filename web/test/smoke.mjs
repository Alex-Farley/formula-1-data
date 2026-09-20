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
import { fileURLToPath } from 'node:url'
// The heading rule and the cell marks both renderers share, so the checks
// below ask for the strings the pages compute rather than copies of them.
import { standingsHeading, titleHeading } from '../src/queries/season.js'
import { DOCUMENTS, NOT_YET_RUN, SO_FAR } from '../src/lib/site.js'
// The rule that decides who is credited and whether a file may be shown at
// all — asked of the served HTML below rather than restated in it.
import { attribution, canShow, fileTitle } from '../src/lib/commons.js'
import { ENTRIES as CAR_ENTRIES, IMAGES as CAR_IMAGES } from '../src/queries/car.js'

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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
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
        const id = setInterval(() => {
          if (document.getElementById('prerendered')) {
            seen = true
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

    // A route change that commits UNDER an open modal must not pull focus out
    // of it. Found by this suite: the search palette is opened, the router
    // catches up with a click made a moment earlier, focus goes to the heading
    // behind the palette -- and Escape, pressed into the page, misses the
    // dialog, which stays open over a page nothing can click through to.
    await held.keyboard.press('/')
    await held.waitForSelector('.palette input', { timeout: 10000 })
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
      await held.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))),
      'a route change under the open search palette leaves focus inside the palette',
    )
    await held.keyboard.press('Escape')
    truthy(
      await held
        .waitForFunction(() => !document.querySelector('.palette-backdrop'), null, { timeout: 5000 })
        .then(() => true)
        .catch(() => false),
      'so Escape still reaches it and closes it',
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
     * open moves the router on while the reader is still looking at the page
     * they left, so the offset they had belongs to that page and not to the
     * one about to render: 1,500 px into the circuit register is nowhere in
     * particular on one circuit's page. Both halves have to agree about
     * that — handOver() drops the offset and ScrollToTop treats it as the
     * route change it is — or the two race and the reader lands wherever the
     * machine was quick that morning.
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
    truthy(
      (await clicked.evaluate(() => window.scrollY)) < 200,
      'and a reader who clicked through it arrives at the top of the page they asked for, not at the offset of the one they left',
    )
    await clicked.close()

    // Every section after this one drives the shared page, which has been in
    // the background throughout.
    await page.bringToFront()
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

  })

  // ---------------------------------------------------------------- a race

  // 2026 carries two final standings rows per driver — formula1.com records the
  // team, F1DB the position — so a page that does not collapse them lists every
  // driver twice.
  await section('/seasons/2026  (the same fact from two sources)', async () => {
    await go('/seasons/2026', '2026')
    is(
      (await tableRows())[1],
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
      // The Active filter keeps the current grid - it matched nobody for a
      // version, testing last_season against a year the open span never holds.
      const latest = one("SELECT MAX(year) FROM races WHERE status = 'completed'")
      const gridCount = count(
        "SELECT COUNT(DISTINCT e.driver_id) FROM race_entries e JOIN races r ON r.id = e.race_id WHERE r.year = ?",
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
      await page.click('#root main .table-foot button')
      await page.waitForFunction(() => document.querySelectorAll('#root main tbody tr').length > 150, null, { timeout: 20000 })
      const appOrder = await page.$$eval('#root main tbody tr td:first-child', (tds) => tds.map((td) => td.textContent.trim()))
      const staticOrder = ([...html.matchAll(/<tbody>[\s\S]*?<\/tbody>/g)][0][0].match(/<tr>[\s\S]*?<\/tr>/g) ?? []).map(
        (tr) =>
          tr
            .match(/<td[^>]*>([\s\S]*?)<\/td>/)[1]
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
    await page.waitForSelector('#root main .state.is-empty', { timeout: 10000 })
    truthy(await page.$('#root main h1'), 'a register filtered to no rows shows its empty state, and the page stands')
    await page.fill('input[type="search"]', '')
    await page.waitForSelector('#root main tbody tr', { timeout: 10000 })

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
        truthy(
          html.includes('<dt>Entries (published)</dt>') && html.includes('<dt>Starts (published)</dt>'),
          'the static facts label the published figures as the app does',
        )
      }
    }

  })

  await section('/constructors', async () => {
    await go('/constructors', 'Constructors')
    is((await tableRows())[0], count('SELECT COUNT(*) FROM constructors'), 'the constructor register')

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

  })

  // -------------------------------------------------------------- circuits

  await section('/circuits', async () => {
    await go('/circuits', 'Circuits')
    is((await tableRows())[0], count('SELECT COUNT(*) FROM v_circuits'), 'the circuit register')

    // AF-23: the strip of 25 thumbnails was the third place the site drew the
    // same circuit. The cards carry what each trace measures instead, and the
    // ODbL credit travels with the figures now that no line is drawn from them.
    if (hasGeometry) {
      await page.waitForSelector('.lapcard', { timeout: 20000 })
      const register = await page.$eval('#root main', (n) => n.textContent)
      is(
        await page.$$eval('.lapcard svg', (n) => n.length),
        0,
        'the register does not draw the circuits a third time',
      )
      is(
        await page.$$eval('.lapcard', (n) => n.length),
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
    // app and in the static page alike.
    const outlinesHere = count("SELECT COUNT(*) FROM circuit_outlines WHERE circuit_id = 'silverstone'")
    await page.waitForSelector('#root main .outline-card svg.outline path', { timeout: 20000 })
    is(await page.$$eval('#root main .outline-card', (n) => n.length), outlinesHere, 'every F1DB layout of Silverstone is drawn')
    truthy(
      await page.$$eval('#root main .outline-card figcaption', (n) => n.length > 0 && n.every((c) => c.textContent.includes('Jules Roy'))),
      'every outline carries its credit',
    )
    const staticCircuit = await (await fetch(`${BASE}/circuits/silverstone`)).text()
    is(
      (staticCircuit.match(/<figure class="outline-card">/g) ?? []).length,
      outlinesHere,
      'the static page draws the same outlines',
    )
    // AF-23/VD-44: the cards are all fitted to one box, so the page says they
    // are not to scale - in both renderers, from the one string.
    truthy(
      (await page.$eval('#root main', (n) => n.textContent)).includes('not to scale') &&
        staticCircuit.includes('not to scale'),
      'the app and the static page both say the outlines are not to scale',
    )
    // IX-31: Silverstone has no trace, and 55 of the 80 are in the same
    // position. Saying nothing made an untraced circuit and a failed download
    // the same page.
    truthy(
      (await page.$eval('#root main', (n) => n.textContent)).includes('No traced centreline for this circuit'),
      'a circuit with no trace says so',
    )

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

  // ------------------------------------------------------------------ cars

  await section('/cars', async () => {
    await go('/cars', 'Cars')
    is((await tableRows())[0], count('SELECT COUNT(*) FROM chassis'), 'the chassis register')

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

  await section('/reference/glossary', async () => {
    await go('/reference/glossary', 'Glossary')
    is((await tableRows())[0], count('SELECT COUNT(*) FROM glossary'), 'glossary terms')

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

  // At a phone width the register is wider than the screen and says so; the
  // masthead shows every destination rather than a strip with a hidden
  // scrollbar.
  await section('/drivers  (at 375 px)', async () => {
    await page.setViewportSize({ width: 375, height: 812 })
    await go('/drivers', 'Drivers')
    await page.waitForSelector('#root main tbody tr', { timeout: 20000 })
    truthy(
      await page.waitForSelector('.table-wrap[data-clipped]', { timeout: 10000 }).catch(() => null),
      'a table wider than the screen shows a fade at its right edge',
    )
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
    }
    await go('/no-such-page-here')
    truthy(!(await page.$('#root .cite')), 'a page that does not exist offers no citation')
    await go('/drivers/no-such-driver', 'No such driver')
    truthy(!(await page.$('#root .cite')), 'an unknown driver offers no citation either')

    // Where a driver has a published entry count that differs from the derived
    // one, both renderers show both and say why, in the same words.
    {
      const two = db
        .prepare('SELECT d.id FROM drivers d WHERE d.entries IS NOT NULL AND d.entries != (SELECT COUNT(*) FROM race_entries e WHERE e.driver_id = d.id) LIMIT 1')
        .get()
      if (two) {
        await go(`/drivers/${two.id}`)
        const appNote = await page.waitForSelector('#root main .source-note', { timeout: 20000 }).then((n) => n.textContent())
        truthy(appNote.includes('an entry is not a start'), `the app says why ${two.id} has two entry counts`)
        const html = await (await fetch(`${BASE}/drivers/${two.id}`)).text()
        truthy(html.includes('an entry is not a start') && html.includes('Entries (published)'), 'the static page says the same beside both figures')
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
    await page.click('#root main .table-foot button')
    await page.waitForFunction(() => document.querySelectorAll('#root main tbody tr').length > 150, null, { timeout: 20000 })
    const lastEntries = await page.$$eval('#root main tbody tr td:nth-child(3)', (nodes) =>
      nodes[nodes.length - 1].textContent.trim(),
    )
    is(lastEntries, '—', 'and sinks the unestablished ones')

  })

  // ---------------------------------------------------------------- search

  await section('Search', async () => {
    await page.keyboard.press('/')
    await page.waitForSelector('.palette input', { timeout: 10000 })
    await page.fill('.palette input', 'rindt')
    // The index is one query on first open, so the list can show "no match" for a
    // frame before it lands. Wait for a real hit rather than for any row.
    await page.waitForSelector('#palette-results li a[href^="/drivers/"]', { timeout: 10000 })
    const first = await page.$eval('#palette-results li a', (node) => node.getAttribute('href'))
    is(first, '/drivers/rindt', 'search finds a driver by name')
    await page.click('#palette-results li a')

  })

  // The winningest driver of a shared surname comes first: "schumacher" used
  // to offer Ralf, on six wins, above Michael on ninety-one, because the only
  // tie-break was the length of the name.
  await section('Search  (prominence)', async () => {
    await page.keyboard.press('/')
    await page.waitForSelector('.palette input', { timeout: 10000 })
    await page.fill('.palette input', 'schumacher')
    await page.waitForSelector('#palette-results li a[href^="/drivers/"]', { timeout: 10000 })
    is(
      await page.$eval('#palette-results li a', (node) => node.getAttribute('href')),
      `/drivers/${one(`SELECT id FROM drivers WHERE lower(full_name) LIKE '%schumacher%' ORDER BY wins DESC LIMIT 1`)}`,
      'the winningest Schumacher is first',
    )
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('#root main h1')?.textContent.includes('Rindt'), null, {
      timeout: 10000,
    })
    pass('and opens their page')

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

    const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text())
    const urls = (sitemap.match(/<loc>/g) ?? []).length
    const expected =
      1 + // home
      1 + one('SELECT COUNT(*) AS n FROM seasons') + // index + one per season
      1 + one('SELECT COUNT(*) FROM races') +
      1 + one('SELECT COUNT(*) FROM drivers') +
      1 + one('SELECT COUNT(*) FROM constructors') +
      1 + one('SELECT COUNT(*) FROM circuits') +
      // /cars/<id> is the UNION of the chassis register and the curated cars,
      // because Car.jsx resolves that route against either: a chassis id, or a
      // car id where no chassis owns it (six do, `lotus-72` among them). Counting
      // `cars` alone is what let 1,130 routes work in the app and 404 to anybody
      // who followed a shared link.
      1 + one(`SELECT COUNT(*) FROM (
               SELECT id FROM chassis UNION SELECT id FROM cars
             )`) +
      8 + // records, data and its three children, eras, glossary, changes
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
      const confirmed = rows.slice(0, 6).find((row) => row.name_matches === 1) ?? null
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
      const expected = images.all(id, id).filter(canShow).slice(0, 6)
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
        return {
          heads: cells(markup.slice(0, markup.indexOf('</thead>')), 'th'),
          rows: [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => cells(m[1], 'td')),
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
            heads: [...table.querySelectorAll('thead th')].map(clean),
            rows: [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map(clean)),
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
