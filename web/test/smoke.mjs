#!/usr/bin/env node
/**
 * Drive the built site in a real browser and check what it renders against
 * the database it renders from.
 *
 * WHY THE EXPECTATIONS COME OUT OF f1.db
 *     Hardcoding "the drivers page shows 182 rows" would fail the day someone
 *     adds a driver, and a test that cries wolf gets deleted. So every count
 *     below is read from the same database the page is querying: the test
 *     asserts the page and the database agree, which stays true as the data
 *     grows and false when the page is broken.
 *
 *     It is also the only check that the app actually works. `npm run build`
 *     proves the JavaScript compiles; it does not prove that SQLite loaded,
 *     that a query returned, or that a chart drew anything. Those failures
 *     look fine at build time and blank in a browser - see the wasm filename
 *     note in ../README.md for one that did.
 *
 * USE
 *     npm run build && npm test
 *     CHROME_PATH=/path/to/chrome npm test    reuse a browser you already have
 *
 * It reuses a preview server if one is already listening, otherwise starts
 * one and stops it again on the way out. The whole app is loaded once and
 * then navigated through its own router, so the database is fetched and the
 * wasm instantiated a single time for the entire run.
 */
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..')
const PORT = 4179
const BASE = `http://localhost:${PORT}`

if (!existsSync(join(web, 'dist', 'index.html'))) {
  console.error('\ndist/ is missing. Build it first:  npm run build\n')
  process.exit(1)
}

const db = new DatabaseSync(join(web, '..', 'f1.db'))
const count = (sql, ...args) => db.prepare(sql).get(...args).n

// Each route, and how many table rows the database says it should show.
const ROUTES = [
  ['/', count('SELECT COUNT(*) n FROM v_champions')],
  ['/seasons/1976', count('SELECT COUNT(*) n FROM races WHERE year = 1976')],
  ['/drivers', count('SELECT COUNT(*) n FROM drivers')],
  ['/drivers/senna', count('SELECT COUNT(*) n FROM race_entries WHERE driver_id = ?', 'senna')],
  ['/constructors', count('SELECT COUNT(*) n FROM constructors')],
  [
    '/constructors/ferrari',
    count(
      "SELECT COUNT(*) n FROM race_entries WHERE constructor_id = 'ferrari' AND finish_position = 1",
    ),
  ],
  ['/circuits', count('SELECT COUNT(*) n FROM v_circuits')],
  [
    '/circuits/silverstone',
    count("SELECT COUNT(*) n FROM circuit_layouts WHERE circuit_id = 'silverstone'") +
      count("SELECT COUNT(*) n FROM v_circuit_winners WHERE circuit_id = 'silverstone'") +
      count("SELECT COUNT(*) n FROM v_race_venues WHERE circuit_id = 'silverstone'"),
  ],
  ['/cars', count('SELECT COUNT(*) n FROM cars')],
  ['/cars/mclaren-mp4-4', count("SELECT COUNT(*) n FROM v_car_races WHERE car_id = 'mclaren-mp4-4'")],
]

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.log(`  FAIL  ${msg}`)
}
const pass = (msg) => console.log(`  ok    ${msg}`)

// --------------------------------------------------------------- the server
const alive = async () => {
  try {
    return (await fetch(BASE)).ok
  } catch {
    return false
  }
}

// Reuse a preview server that is already up rather than paying to start
// another one — and, more importantly, never leave a second one running.
let server = null
if (await alive()) {
  console.log(`reusing the preview server already on ${BASE}`)
} else {
  // detached puts it in its own process group. npx spawns vite as a child, so
  // killing the npx pid alone orphans the server that is actually holding the
  // port — which leaks a process per run locally and hangs the job in CI.
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
    cwd: web,
    stdio: 'ignore',
    detached: true,
  })
  // detached without unref is a deadlock: the parent's event loop stays alive
  // waiting on the child handle, so the exit handler that would kill it never
  // runs. The test finishes its checks and then hangs on a clean pass.
  server.unref()
  for (let i = 0; i < 40 && !(await alive()); i++) {
    await new Promise((r) => setTimeout(r, 250))
  }
  if (!(await alive())) {
    server.kill()
    console.error(`\npreview server never came up on ${BASE}\n`)
    process.exit(1)
  }
}

// Only ever kill a server this process started, and kill the whole group.
// SIGTERM matters as much as a clean exit here: a `timeout 60 npm test`, or
// CI cancelling the job, would otherwise leave the server behind.
const stop = () => {
  if (!server) return
  const { pid } = server
  server = null
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    /* already gone */
  }
}
process.on('exit', stop)
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    stop()
    process.exit(130)
  })
}

// --------------------------------------------------------------- the checks
let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error(
    '\nplaywright is not installed.\n' +
      '  npm install\n' +
      '  npx playwright install chromium\n',
  )
  process.exit(1)
}

// CHROME_PATH lets an environment that already has a browser - a CI image, a
// sandbox with one preinstalled - point at it instead of downloading a second
// copy that has to match Playwright's expected build number.
const browser = await chromium
  .launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
  .catch((e) => {
    console.error(
      `\nCould not start Chromium: ${e.message.split('\n')[0]}\n` +
        'Install it with:  npx playwright install chromium\n' +
        'or point at one you already have:  CHROME_PATH=/path/to/chrome npm test\n',
    )
    process.exit(1)
  })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(`uncaught: ${e.message}`))

// The app is loaded ONCE and then navigated by its own router.
//
// A page.goto() per route would be a full reload each time: re-fetching the
// 1.6 MB database and re-instantiating the wasm engine for every check, to
// reach data already sitting in memory. Setting location.hash drives the
// HashRouter client-side, which is both what a visitor's session actually
// does and about an order of magnitude less work.
await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
await page.waitForSelector('table', { timeout: 30000 })

async function visit(route, selector) {
  await page.evaluate((r) => {
    // Blank the hash first so re-visiting the current route still triggers a
    // route change, and so the wait below cannot pass on the previous page's
    // leftover markup.
    window.location.hash = '#/__blank'
    window.location.hash = `#${r}`
  }, route)
  try {
    await page.waitForSelector(selector, { timeout: 20000 })
    return true
  } catch {
    const text = (await page.textContent('main').catch(() => '')) ?? ''
    fail(`${route} never rendered ${selector} — ${text.slice(0, 160)}`)
    return false
  }
}

console.log('\nroutes')
for (const [route, expected] of ROUTES) {
  if (!(await visit(route, 'table'))) continue
  const actual = await page.locator('tbody tr').count()
  if (actual === expected) pass(`${route.padEnd(24)} ${actual} rows`)
  else fail(`${route} rendered ${actual} rows, the database says ${expected}`)
}

console.log('\ncharts')
if (await visit('/trends', 'svg .series-line')) {
  const figures = await page.locator('figure.figure').count()
  const marks = await page.locator('.series-fill, circle.dot').count()
  const cars = count('SELECT COUNT(*) n FROM cars WHERE power_bhp IS NOT NULL')
  figures === 4 ? pass(`${figures} figures`) : fail(`${figures} figures, expected 4`)
  marks > cars ? pass(`${marks} marks drawn`) : fail(`only ${marks} marks drawn`)

  // A chart that cannot be read without a pointer is not finished.
  await page.locator('figure').first().getByRole('button', { name: 'Show table' }).click()
  await page.waitForTimeout(200)
  const seasons = count('SELECT COUNT(*) n FROM seasons')
  const tableRows = await page.locator('figure').first().locator('tbody tr').count()
  tableRows === seasons
    ? pass(`table view ${tableRows} rows`)
    : fail(`table view showed ${tableRows} rows, the database says ${seasons}`)

  // Axis ticks must be round numbers: a tick drawn at 0.25 and printed as
  // "0.3" is an axis that lies.
  const tickText = await page.evaluate(() =>
    [...[...document.querySelectorAll('figure')].at(-1).querySelectorAll('text.tick')].map(
      (t) => t.textContent,
    ),
  )
  const ugly = tickText.filter((t) => /\.\d\d/.test(t))
  ugly.length === 0 ? pass('axis ticks are round') : fail(`ragged axis ticks: ${ugly.join(', ')}`)

  // Nothing may be drawn outside its own frame.
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.chart svg')].flatMap((svg) => {
      const box = svg.getBoundingClientRect()
      return [...svg.querySelectorAll('text')]
        .filter((t) => {
          const r = t.getBoundingClientRect()
          return (
            r.width > 0 &&
            (r.top < box.top - 0.5 ||
              r.bottom > box.bottom + 0.5 ||
              r.left < box.left - 0.5 ||
              r.right > box.right + 0.5)
          )
        })
        .map((t) => t.textContent)
    }),
  )
  clipped.length === 0
    ? pass('no clipped labels')
    : fail(`labels drawn outside the chart: ${clipped.join(' | ')}`)
}

console.log('\nsql console')
if (await visit('/console', 'textarea.sql')) {
  await page.click('button.primary')
  try {
    await page.waitForSelector('tbody tr', { timeout: 20000 })
    pass(`returned ${await page.locator('tbody tr').count()} rows`)
  } catch {
    fail('the console query returned nothing')
  }
}

console.log('\ngaps')
if (await visit('/gaps', 'table')) {
  const gaps = count('SELECT COUNT(*) n FROM known_gaps')
  const rows = await page.locator('tbody tr').count()
  rows > gaps ? pass(`${rows} rows`) : fail(`${rows} rows, expected more than ${gaps}`)
}

console.log('\nconsole')
if (consoleErrors.length === 0) pass('no browser console errors')
else fail(`browser console errors:\n    ${consoleErrors.join('\n    ')}`)

await browser.close()

console.log('')
if (failures.length) {
  console.log(`${failures.length} failure(s).`)
  process.exit(1)
}
console.log('All checks passed.')
