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
 *     CHROME_PATH=/path/to/chrome npm test    reuse a browser you already have
 *
 * The whole app is loaded ONCE and then navigated through its own router: a
 * page.goto per route would re-download the database and re-instantiate the
 * wasm every time. The preview server is spawned detached and killed as a
 * process group, so a cancelled run does not leak a server holding the port.
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

const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
const one = (sql, ...args) => Object.values(db.prepare(sql).get(...args))[0]
const count = (sql, ...args) => one(sql, ...args)

const failures = []
const fail = (message) => {
  failures.push(message)
  console.log(`  FAIL  ${message}`)
}
const pass = (message) => console.log(`  ok    ${message}`)

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
    console.log(`Reusing the server already on ${BASE}\n`)
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
      console.log(`Preview server on ${BASE}\n`)
      return server
    }
  }
  throw new Error('the preview server never came up')
}

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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  /**
   * Wait until the page has finished answering its queries.
   *
   * A page renders its heading BEFORE its data arrives — that is deliberate, so
   * a reader gets the title immediately — which means `main h2` is not the
   * signal that a page is ready. The placeholders are. Then two frames, because
   * a component reused across a param change can satisfy both conditions on the
   * render still showing the previous route's data, and the assertions read the
   * DOM over a separate round trip.
   */
  const settle = async () => {
    await page.waitForFunction(
      () => !document.querySelector('main .state, main .skeleton-table'),
      null,
      { timeout: 20000 },
    )
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    )
  }

  /** Navigate through the app's own router and wait for the new page. */
  const go = async (route, heading) => {
    await page.evaluate((to) => {
      window.location.hash = `#${to}`
    }, route)
    await page.waitForFunction(
      (expected) => {
        const h2 = document.querySelector('main h2')
        return h2 && (!expected || h2.textContent.includes(expected))
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
    page.$$eval('main .table-wrap', (nodes) =>
      nodes.filter((node) => !node.closest('figure.figure')).map((node) => Number(node.dataset.rows)),
    )

  const text = (selector) => page.$eval(selector, (node) => node.textContent.trim()).catch(() => null)

  // ---------------------------------------------------------------- booting

  console.log('Boot')
  const started = Date.now()
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('main h2', { timeout: 60000 })
  await settle()
  pass(`database opened and the first page rendered in ${Date.now() - started} ms`)

  const version = await text('.sitefoot dd')
  is(version, `v${one('SELECT value FROM meta WHERE key = ?', 'version')}`, 'footer reports the database version')

  // ------------------------------------------------------------------ home

  console.log('\n/  (overview)')
  const racesRun = count("SELECT COUNT(*) FROM races WHERE status = 'completed'")
  const homeStats = await page.$$eval('main .stats dd', (nodes) => nodes.map((n) => n.textContent))
  truthy(
    homeStats.some((value) => value.includes(racesRun.toLocaleString('en-GB'))),
    `the overview leads with ${racesRun.toLocaleString('en-GB')} races run`,
  )

  // --------------------------------------------------------------- seasons

  console.log('\n/seasons')
  await go('/seasons', 'Seasons')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM seasons'), 'every season is listed')

  console.log('\n/seasons/1976')
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
  atLeast(await page.$$eval('main .figure', (n) => n.length), 1, 'the title race is charted')
  atLeast(
    await page.$$eval('main .figure svg path', (n) => n.length),
    2,
    'the championship chart drew its lines',
  )

  // ---------------------------------------------------------------- a race

  // 2026 carries two final standings rows per driver — formula1.com records the
  // team, F1DB the position — so a page that does not collapse them lists every
  // driver twice.
  console.log('\n/seasons/2026  (the same fact from two sources)')
  await go('/seasons/2026', '2026')
  is(
    (await tableRows())[1],
    count(
      `SELECT COUNT(DISTINCT entity_id) FROM standings
        WHERE year = 2026 AND table_type = 'drivers' AND after_round IS NULL`,
    ),
    'each driver appears once in the final table',
  )

  // 2018 is the opposite case: Force India was excluded with nothing and its
  // successor scored 52 under the same id. Both rows belong in that table.
  console.log('\n/seasons/2018  (an entity that finished twice)')
  await go('/seasons/2018', '2018')
  is(
    (await tableRows())[2],
    count(
      `SELECT COUNT(*) FROM standings
        WHERE year = 2018 AND table_type = 'constructors' AND after_round IS NULL`,
    ),
    "the excluded constructor and its successor both stand",
  )

  console.log('\n/races/1976/9  (the classification)')
  const raceId = one('SELECT id FROM races WHERE year = 1976 AND round = 9')
  await go('/races/1976/9')
  const race = await tableRows()
  is(race[0], count('SELECT COUNT(*) FROM race_entries WHERE race_id = ?', raceId), 'classification entries')
  is(race[1], count('SELECT COUNT(*) FROM qualifying WHERE race_id = ?', raceId), 'qualifying entries')

  console.log('\n/races/1955/1  (a shared drive)')
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

  console.log('\n/races')
  await go('/races', 'Races')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM races'), 'every race is listed')

  // ---------------------------------------------------------------- people

  console.log('\n/drivers')
  await go('/drivers', 'Drivers')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM drivers'), 'the driver register')

  console.log('\n/drivers/senna')
  await go('/drivers/senna', 'Ayrton Senna')
  const senna = await tableRows()
  is(
    senna[senna.length - 1],
    count('SELECT COUNT(*) FROM race_entries WHERE driver_id = ?', 'senna'),
    "every one of Senna's entries",
  )
  const sennaWins = count("SELECT COUNT(*) FROM race_entries WHERE driver_id = 'senna' AND finish_position = 1")
  truthy(
    (await page.$$eval('main .stats dd', (n) => n.map((x) => x.textContent))).includes(String(sennaWins)),
    `wins derived from the race records — ${sennaWins}`,
  )

  console.log('\n/constructors')
  await go('/constructors', 'Constructors')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM constructors'), 'the constructor register')

  console.log('\n/constructors/ferrari')
  await go('/constructors/ferrari', 'Ferrari')
  const ferrari = await tableRows()
  truthy(
    ferrari.includes(
      count("SELECT COUNT(*) FROM race_entries WHERE constructor_id = 'ferrari' AND finish_position = 1"),
    ),
    'every Ferrari win is listed',
  )

  // -------------------------------------------------------------- circuits

  console.log('\n/circuits')
  await go('/circuits', 'Circuits')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM v_circuits'), 'the circuit register')

  console.log('\n/circuits/silverstone')
  await go('/circuits/silverstone', 'Silverstone')
  const silverstone = await tableRows()
  truthy(
    silverstone.includes(count("SELECT COUNT(*) FROM races WHERE circuit_id = 'silverstone'")),
    'every race held at Silverstone',
  )

  const traced = one('SELECT circuit_id FROM circuit_geometry ORDER BY node_count DESC LIMIT 1')
  console.log(`\n/circuits/${traced}  (traced geometry)`)
  await go(`/circuits/${traced}`)
  const path = await page.$eval('.trackmap path', (node) => node.getAttribute('d')).catch(() => null)
  atLeast(path?.length ?? 0, 200, 'the centreline drew a path')
  truthy(
    (await page.$$eval('figure.photo figcaption', (n) => n.map((x) => x.textContent).join(' '))).includes(
      'OpenStreetMap',
    ),
    'the ODbL attribution travels with the geometry',
  )

  // ------------------------------------------------------------------ cars

  console.log('\n/cars')
  await go('/cars', 'Cars')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM chassis'), 'the chassis register')

  // Six ids name a car that no single chassis shares an id with. No race entry
  // is ever attributed to `lotus-72` itself, so a page that queries only that
  // id shows nothing and then reports a discrepancy it invented.
  console.log('\n/cars/lotus-72  (a car, not a chassis)')
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

  console.log('\n/cars/mclaren-mp4-4')
  await go('/cars/mclaren-mp4-4', 'McLaren MP4/4')
  const mp44 = await tableRows()
  truthy(
    mp44.includes(count("SELECT COUNT(*) FROM race_entries WHERE chassis_id = 'mclaren-mp4-4'")),
    'every entry the MP4/4 made',
  )

  // A licence violation is the failure mode here, so this is asserted rather
  // than eyeballed: a Commons photograph must carry its licence and the person
  // who took it.
  const credits = await page.$$eval('figure.photo figcaption', (nodes) =>
    nodes.map((node) => node.textContent),
  )
  const image = db
    .prepare("SELECT artist, licence FROM article_images WHERE article = 'McLaren MP4/4' LIMIT 1")
    .get()
  if (image) {
    truthy(
      credits.some((caption) => caption.includes(image.licence)),
      `the photograph carries its licence (${image.licence})`,
    )
    truthy(
      credits.some((caption) => caption.includes(image.artist)),
      `the photograph carries its photographer (${image.artist})`,
    )
  }

  // ------------------------------------------------------------- reference

  console.log('\n/records')
  await go('/records', 'Records')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM records'), 'published records')
  atLeast(await page.$$eval('main .figure svg', (n) => n.length), 4, 'the leaderboards drew')

  console.log('\n/reference/quality')
  await go('/reference/quality', 'Data quality')
  const quality = await tableRows()
  truthy(quality.includes(count('SELECT COUNT(*) FROM known_gaps')), 'the known gaps are published')
  truthy(
    quality.includes(count('SELECT COUNT(*) FROM discrepancies')),
    'the recorded disagreements are published',
  )

  console.log('\n/reference/sources')
  await go('/reference/sources', 'Sources')
  truthy(
    (await tableRows()).includes(count('SELECT COUNT(*) FROM source_registry')),
    'every source is listed with its licence',
  )

  console.log('\n/reference/glossary')
  await go('/reference/glossary', 'Glossary')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM glossary'), 'glossary terms')

  console.log('\n/reference/eras')
  await go('/reference/eras', 'Eras')
  truthy(
    (await tableRows()).includes(count('SELECT COUNT(*) FROM regulation_changes')),
    'every regulation change is listed',
  )

  // ----------------------------------------------------------------- SQL

  console.log('\n/reference/sql')
  await go('/reference/sql', 'SQL console')
  await page.waitForSelector('main .table-wrap', { timeout: 20000 })
  atLeast((await tableRows())[0], 1, 'the opening query returned rows')

  await page.fill('textarea.sql', 'SELECT COUNT(*) AS n FROM race_entries')
  await page.click('button.button')
  await page.waitForFunction(
    (expected) => document.querySelector('main tbody td')?.textContent.replace(/[^0-9]/g, '') === String(expected),
    count('SELECT COUNT(*) FROM race_entries'),
    { timeout: 20000 },
  )
  pass('an arbitrary query runs and agrees with the database')

  // A write must be refused, and the table it names must survive.
  await page.fill('textarea.sql', 'DELETE FROM drivers')
  await page.click('button.button')
  await page.waitForSelector('main .error', { timeout: 10000 })
  pass('a write is refused rather than run')

  await page.fill('textarea.sql', 'WITH t AS (SELECT 1) SELECT COUNT(*) AS n FROM drivers')
  await page.click('button.button')
  await page.waitForFunction(
    (expected) => document.querySelector('main tbody td')?.textContent.replace(/[^0-9]/g, '') === String(expected),
    count('SELECT COUNT(*) FROM drivers'),
    { timeout: 20000 },
  )
  pass('the register is intact after a rejected write')

  // ------------------------------------------------------------------ sorting

  // NULL means "not established" here, and 824 of 862 drivers have no stored
  // entry count. Sorting descending must still sink them, or the register opens
  // on several screens of em dashes.
  console.log('\nSorting')
  await go('/drivers', 'Drivers')
  await page.click('main th:nth-child(4) button')
  const firstEntries = await page.$eval('main tbody tr td:nth-child(4)', (node) => node.textContent.trim())
  truthy(
    firstEntries !== '—' && firstEntries !== '',
    `descending sort leads with a value, not a blank — "${firstEntries}"`,
  )
  const lastEntries = await page.$$eval('main tbody tr td:nth-child(4)', (nodes) =>
    nodes[nodes.length - 1].textContent.trim(),
  )
  is(lastEntries, '—', 'and sinks the unestablished ones')

  // ---------------------------------------------------------------- search

  console.log('\nSearch')
  await page.keyboard.press('/')
  await page.waitForSelector('.palette input', { timeout: 10000 })
  await page.fill('.palette input', 'rindt')
  // The index is one query on first open, so the list can show "no match" for a
  // frame before it lands. Wait for a real hit rather than for any row.
  await page.waitForSelector('#palette-results li a[href^="#/drivers/"]', { timeout: 10000 })
  const first = await page.$eval('#palette-results li a', (node) => node.getAttribute('href'))
  is(first, '#/drivers/rindt', 'search finds a driver by name')
  await page.click('#palette-results li a')
  await page.waitForFunction(() => document.querySelector('main h2')?.textContent.includes('Rindt'), null, {
    timeout: 10000,
  })
  pass('and opens their page')

  // -------------------------------------------------------------- 404 route

  console.log('\nMissing routes')
  await go('/drivers/not-a-driver', 'No such driver')
  pass('an unknown driver is refused rather than rendered blank')
  await go('/nowhere', 'No such page')
  pass('an unknown route is refused')

  // ------------------------------------------------------- console cleanliness

  console.log('\nConsole')
  // A missing photograph is a Commons request this test cannot control; a
  // failure inside the app is not.
  const real = consoleErrors.filter(
    (message) => !/commons\.wikimedia\.org|ERR_|net::/i.test(message),
  )
  if (real.length === 0) pass('no errors logged during the run')
  else real.forEach((message) => fail(`console error: ${message}`))
} finally {
  await browser?.close()
  db.close()
  stop()
}

console.log(
  failures.length === 0
    ? '\nAll checks passed.\n'
    : `\n${failures.length} check${failures.length === 1 ? '' : 's'} failed.\n`,
)
process.exit(failures.length === 0 ? 0 : 1)
