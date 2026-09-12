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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
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

// The ODbL centrelines are not in f1.db — OpenStreetMap's share-alike and
// database right would reach the whole file, so build.py writes them to
// f1-geometry.db and the two ship side by side as a Collective Database. The
// app merges them in the browser; this attaches them so the test can ask the
// same questions of the same rows. See tools/geometry_overlay.py.
const geometryPath = join(web, '..', 'f1-geometry.db')
const hasGeometry = existsSync(geometryPath)
if (hasGeometry) db.exec(`ATTACH DATABASE '${geometryPath}' AS geo`)
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

// --------------------------------------------------- attribution, structurally

/**
 * Nothing may render a Commons photograph except CommonsImage.
 *
 * Every one of the 602 files carries its own licence, and almost all of those
 * licences make attribution a condition rather than a courtesy. The component
 * puts the credit in the caption so no caller has to remember to — but that
 * only holds while the component is the ONLY way an image reaches the page.
 * One `<img src={thumbUrl(...)}>` somewhere else and the obligation is
 * silently gone, on a page that looks fine.
 *
 * So this is checked in the source rather than in the browser: a rendered-page
 * assertion can only see the pages it visits, and the bypass would be on the
 * one it does not. It reads the files instead, and fails on a second <img> tag
 * or a second thumbUrl() call anywhere in src/.
 */
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.jsx?$/.test(entry) ? [full] : []
  })
}

console.log('\nAttribution')
{
  // Anything that renders a Commons photograph must render its credit, and
  // must get that credit from the one shared rule.
  //
  // The first version of this said only CommonsImage may render an <img>.
  // That was too narrow, and merging main proved it: the cars gallery renders
  // its own <img> because its card puts the picture inside a link and the
  // credit below the body text, which a <figure> cannot express. The gallery
  // was not wrong to exist — it was wrong to write out its own credit line,
  // which it did WITHOUT the `credit` fallback, so an attributed photograph
  // would have read "photographer not recorded". Two answers to one licence
  // obligation is the actual defect, not two <img> tags.
  //
  // So the rule is: render a Commons file, import the shared credit. This is
  // checked in the SOURCE because a rendered-page assertion only sees the
  // pages it visits, and the bypass would be on the one it does not.
  const SANCTIONED = [
    join(web, 'src', 'components', 'CommonsImage.jsx'),
    join(web, 'src', 'components', 'CommonsCredit.jsx'),
    join(web, 'src', 'lib', 'commons.js'),
  ]
  const offenders = []
  for (const file of sourceFiles(join(web, 'src'))) {
    if (SANCTIONED.includes(file)) continue
    const text = readFileSync(file, 'utf8')
    const rel = file.slice(web.length + 1)
    const showsCommons = /\bthumbUrl\s*\(/.test(text) || /\bCommonsImage\b/.test(text)
    if (!showsCommons) {
      // A file with no Commons file in it may still not invent a credit.
      if (/photographer not recorded|licence not recorded/.test(text)) {
        offenders.push(`${rel} writes its own credit line`)
      }
      continue
    }
    const credited = /\bCommonsImage\b/.test(text) || /\bCommonsCredit\b/.test(text)
    if (!credited) offenders.push(`${rel} shows a Commons file with no shared credit`)
    if (/\bcanShow\b/.test(text) === false && /\bthumbUrl\s*\(/.test(text)) {
      offenders.push(`${rel} shows a Commons file without checking canShow()`)
    }
  }
  if (offenders.length === 0) {
    pass('every surface showing a Commons photograph carries the shared credit')
  } else {
    offenders.forEach((what) => fail(`attribution can be bypassed: ${what}`))
  }

  // The renderer and the build must agree on what counts as attribution.
  // verify.py accepts `artist` OR `credit`; a surface reading only `artist`
  // captions an admitted row as anonymous, which is what the 1958 Hawthorn
  // photograph on Ferrari 246 F1 would have shown.
  const rule = readFileSync(join(web, 'src', 'lib', 'commons.js'), 'utf8')
  truthy(
    /image\?\.artist/.test(rule) && /image\?\.credit/.test(rule),
    'the shared rule falls back to `credit` where a file names no artist, as the build does',
  )
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

  console.log('Boot')
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

  // ------------------------------------------------------------------ home

  console.log('\n/  (overview)')
  const racesRun = count("SELECT COUNT(*) FROM races WHERE status = 'completed'")
  const homeStats = await page.$$eval('#root main .stats dd', (nodes) => nodes.map((n) => n.textContent))
  truthy(
    homeStats.some((value) => value.includes(racesRun.toLocaleString('en-GB'))),
    `the overview leads with ${racesRun.toLocaleString('en-GB')} races run`,
  )

  // --------------------------------------------------------------- seasons

  console.log('\n/seasons')
  await go('/seasons', 'Seasons')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM seasons'), 'every season is listed')

  // One row per driver. The end-of-season rows hold two sources' descriptions
  // of 2026; the page reads v_standings_final, which folds them, and the
  // count here is the view's own, so the assertion and the page cannot drift.
  console.log('\n/seasons/2026  (one row per driver in the final table)')
  await go('/seasons/2026', '2026')
  const finalRows = await page.$$eval('#root main table', (tables) => {
    const t = tables.find((el) => el.closest('section')?.querySelector('h2')?.textContent.includes("drivers' standings"))
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
    const t = tables.find((el) => el.closest('section')?.querySelector('h2')?.textContent.includes("drivers' standings"))
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
    console.log(`\n/constructors/${disputed}  (an open disagreement is shown)`)
    await go(`/constructors/${disputed}`)
    truthy(
      (await page.$$('#root main aside.disagreement')).length > 0,
      'the constructor page shows its open disagreement',
    )
  }

  // The app's SQL page carries the download paragraph the static one does,
  // with both files named: the two renderers used to disagree about whether
  // the file could be had at all.
  console.log('\n/data/sql  (the download paragraph, in the app)')
  await go('/data/sql', 'SQL console')
  const sqlPage = await page.content()
  truthy(
    sqlPage.includes('f1-geometry.db') && sqlPage.includes('sqlite_master'),
    'the app names both files and says the file documents itself',
  )

  console.log('\n/seasons/2025  (the champion is P1, not an em dash)')
  await go('/seasons/2025', '2025')
  const championPos = await page.evaluate(() => {
    const h2 = [...document.querySelectorAll('#root main h2')].find((h) => h.textContent.startsWith('Final drivers'))
    const section = h2?.closest('section') ?? h2?.parentElement
    return section?.querySelector('tbody tr td')?.textContent.trim() ?? null
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
  console.log('\n/drivers/beppe-gabbiani  (a winless season reads 0, not an em dash)')
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
  console.log('\n/races/2026/16  (the Sepang note reaches the page)')
  await go('/races/2026/16', 'Bahrain Grand Prix')
  truthy(((await text('#root main .lede')) ?? '').includes('Sepang'), 'the calendar\'s explanation is the lede')

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
  atLeast(await page.$$eval('#root main .figure', (n) => n.length), 1, 'the title race is charted')
  atLeast(
    await page.$$eval('#root main .figure svg path', (n) => n.length),
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

  /*
   * A race where the driver on pole is not the driver who was quickest. The
   * page holds race_results' pole -- the driver the season record credits --
   * and a reader who knows the sport reads that as an error unless the page
   * names the quickest driver too. There are thirteen such races and
   * verify.py pins the count.
   */
  console.log('\n/races/2021/10  (pole is not the fastest qualifier)')
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
  console.log('\n/races/2022/21  (pole is not the car at grid 1)')
  await go('/races/2022/21')
  truthy((await page.content()).includes('Started first'), 'the page names the car that started from the front')

  console.log('\n/races')
  await go('/races', 'Races')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM races'), 'every race is listed')

  // ---------------------------------------------------------------- people

  console.log('\n/drivers')
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
    truthy(heads.includes('Races') && !heads.includes('Entries') && !heads.includes('Starts'), 'Races is counted; Entries and Starts are gone')
    const races = one('SELECT COUNT(*) FROM race_entries WHERE driver_id = (SELECT id FROM drivers ORDER BY wins DESC, podiums DESC LIMIT 1)')
    is(
      await page.$eval('#root main tbody tr td:nth-child(4)', (td) => Number(td.textContent.replace(/[^0-9]/g, ''))),
      races,
      `${top.full_name}'s Races is the race-record count`,
    )
    const html = await (await fetch(`${BASE}/drivers`)).text()
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
    (await page.$$eval('#root main .stats dd', (n) => n.map((x) => x.textContent))).includes(String(sennaWins)),
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

  // Skipped rather than failed when the overlay is absent: a build without
  // f1-geometry.db is a legitimate one, and the track maps are the only thing
  // it costs. Everything inside needs the centrelines.
  if (!hasGeometry) {
    console.log('\n(no f1-geometry.db — skipping the atlas and traced-circuit checks)')
  } else {
    // The atlas walks a lap, which is only possible where build.py found one.
    console.log('\n/circuits/atlas')
    await go('/circuits/atlas', 'Track atlas')
    is(
      await page.$$eval('#root main .atlas-cell', (n) => n.length),
      count('SELECT COUNT(*) FROM geo.circuit_geometry'),
      'every traced circuit is on the wall',
    )
    atLeast(
      await page.$$eval('#root main .atlas-stage path', (n) => n.length),
      2,
      'the lap is drawn in turn-rate bands',
    )
    // Spa closes, so it can be walked; the readout must agree with the database.
    const spaKm = one("SELECT measured_km FROM geo.circuit_geometry WHERE circuit_id = 'spa'")
    // Drive it as a person would. Assigning .value directly is invisible to
    // React, which tracks the node's value and would swallow the event.
    await page.focus('#atlas-at')
    await page.keyboard.press('End')
    await settle()
    // "6,995 m of 6,995" — the metres travelled is the part before " m ".
    const readout = await text('#root main .atlas-scrub output')
    is(
      Number(readout.split(' m ')[0].replace(/,/g, '')),
      Math.round(spaKm * 1000),
      'a full lap of Spa reads as its measured length',
    )
    // A trace with a loose end has no lap to walk, and must say so.
    const broken = one('SELECT circuit_id FROM geo.circuit_geometry WHERE closes = 0 ORDER BY loose_ends DESC LIMIT 1')
    await page.$$eval(
      '#root main .atlas-cell',
      (nodes, name) => nodes.find((n) => n.querySelector('b').textContent === name)?.click(),
      one('SELECT c.name FROM geo.circuit_geometry g JOIN circuits c ON c.id = g.circuit_id WHERE g.circuit_id = ?', broken),
    )
    await settle()
    truthy(
      await page.$eval('#atlas-at', (el) => el.disabled),
      `${broken} has no closed lap, so the scrubber is disabled`,
    )

    const traced = one('SELECT circuit_id FROM geo.circuit_geometry WHERE closes = 1 ORDER BY node_count DESC LIMIT 1')

    console.log(`\n/circuits/${traced}  (traced geometry)`)
    await go(`/circuits/${traced}`)
    await page.waitForSelector('svg.lapfigure path', { timeout: 20000 }).catch(() => null)
    const drawn = await page
      .$$eval('svg.lapfigure path', (nodes) => nodes.reduce((n, node) => n + (node.getAttribute('d')?.length ?? 0), 0))
      .catch(() => 0)
    atLeast(drawn, 200, 'the centreline drew a path')
    truthy(
      (await page.$$eval('figure.photo figcaption', (n) => n.map((x) => x.textContent).join(' '))).includes(
        'OpenStreetMap',
      ),
      'the ODbL attribution travels with the geometry',
    )
    pass(`the overlay merged in the browser — ${traced} drew from f1-geometry.db`)
  }

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

  // ------------------------------------------------------------- reference

  console.log('\n/records')
  await go('/records', 'Records')
  is((await tableRows())[0], count('SELECT COUNT(*) FROM records'), 'published records')
  atLeast(await page.$$eval('#root main .figure svg', (n) => n.length), 4, 'the leaderboards drew')

  // The front door. The version and build date it states are read from the
  // same meta table the file carries, so the page and the database cannot
  // disagree about which edition this is.
  console.log('\n/data  (the front door)')
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
  // The masthead stays at eight, and the slot that read Reference reads Data.
  const masthead = await page.$$eval('#root header.masthead nav a', (nodes) => nodes.map((n) => n.textContent.trim()))
  is(masthead.length, 8, 'the masthead has eight items')
  truthy(
    masthead.includes('Data') && !masthead.includes('Reference'),
    'and "Data" is one of them, where "Reference" was',
  )

  console.log('\n/data/quality')
  await go('/data/quality', 'Data quality')
  const quality = await tableRows()
  truthy(quality.includes(count('SELECT COUNT(*) FROM known_gaps')), 'the known gaps are published')
  truthy(
    quality.includes(count('SELECT COUNT(*) FROM discrepancies')),
    'the recorded disagreements are published',
  )

  // The old section address, in-app: a link written before the move.
  await go('/reference', 'Data')
  is(await page.evaluate(() => location.pathname), '/data', 'the old /reference address lands on /data')

  console.log('\n/data/sources')
  await go('/data/sources', 'Sources')
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

  // The circuit page draws its lap with the atlas's renderer: several paths,
  // one per run of corner-radius band, not one black line.
  console.log('\n/circuits/spa  (the lap, coloured)')
  await go('/circuits/spa', 'Circuit de Spa-Francorchamps')
  await page.waitForSelector('svg.lapfigure path', { timeout: 20000 })
  atLeast(await page.$$eval('svg.lapfigure path', (els) => els.length), 10, 'the lap is drawn in radius bands')
  truthy(await page.$('svg.lapfigure polygon'), 'the lap carries its direction arrow')
  truthy(await page.$('.lapfigure-card figcaption a[href*="openstreetmap.org/relation"]'), 'the drawing keeps its attribution')
  // A trace that does not close draws no arrow and claims none.
  const open = one("SELECT circuit_id FROM geo.circuit_geometry WHERE closes = 0 ORDER BY node_count DESC LIMIT 1")
  await go(`/circuits/${open}`)
  await page.waitForSelector('svg.lapfigure path', { timeout: 20000 })
  truthy(
    !(await page.$('svg.lapfigure polygon')) &&
      !(await page.$eval('.lapfigure-card figcaption', (n) => n.textContent)).includes('the arrow is'),
    `a trace that does not close (${open}) has no arrow and no caption about one`,
  )

  // At a phone width the register is wider than the screen and says so; the
  // masthead shows every destination rather than a strip with a hidden
  // scrollbar.
  console.log('\n/drivers  (at 375 px)')
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
    const open = db.prepare("SELECT year FROM seasons WHERE drivers_champion IS NULL ORDER BY year DESC LIMIT 1").get()
    if (open) {
      const lead = db
        .prepare("SELECT entity, points FROM v_standings_final WHERE year = ? AND table_type = 'drivers' ORDER BY position LIMIT 1")
        .get(open.year)
      console.log(`\n/seasons/${open.year}  (a season still running)`)
      await go(`/seasons/${open.year}`, String(open.year))
      await page.waitForSelector('#root main .stats', { timeout: 20000 }).catch(() => null)
      const stats = await page.$eval('#root main', (m) => m.textContent)
      truthy(stats.includes('Leads') && stats.includes(lead.entity), `the app leads with ${lead.entity}`)
      const html = await (await fetch(`${BASE}/seasons/${open.year}`)).text()
      truthy(
        html.includes(lead.entity) && !html.includes('Runner-up'),
        'the static page leads with the leader rather than an empty champion',
      )
      const section = html.slice(html.indexOf('Championship standings after round'))
      const listed = (section.match(/<tr[\s>]/g) ?? []).length - 1
      const rows = one("SELECT COUNT(*) FROM v_standings_final WHERE year = ? AND table_type = 'drivers'", open.year)
      is(listed, Math.min(rows, 12), 'the static standings table lists each driver once')
    }
  }

  // Every page can be cited, and the app and the static page say the same
  // sentence - checked on routes whose titles differ between the renderers,
  // which is why the citation names the address and not the title.
  console.log('\nCitation')
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

  // The season's grid is counted, and the page says the count.
  {
    const g = db.prepare('SELECT * FROM v_season_grid WHERE year = 1994').get()
    await go('/seasons/1994', '1994')
    const note = await page
      .waitForFunction(() => [...document.querySelectorAll('#root main .note')].some((n) => n.textContent.startsWith('The grid:')), null, { timeout: 20000 })
      .then(() => page.$$eval('#root main .note', (ns) => ns.map((n) => n.textContent).find((t) => t.startsWith('The grid:'))))
    truthy(
      note.includes(`${g.drivers} drivers`) && note.includes(`${g.constructors} constructors`) && note.includes('entered'),
      `1994's grid reads ${g.drivers} drivers, ${g.constructors} constructors, and says entered`,
    )
    const html = await (await fetch(`${BASE}/seasons/1994`)).text()
    truthy(
      html.includes(`${g.drivers} drivers, ${g.constructors} constructors`) && html.includes('whether or not they started'),
      'the static season page states the same grid, with the same caveat',
    )
  }

  // ----------------------------------------------------------------- SQL

  console.log('\n/data/sql')
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

  // The permalink at its old address. /reference/sql?q= was the console's
  // address before the move to /data; a query cited then must still run,
  // with the query carried across rather than dropped at the redirect.
  console.log('\n/reference/sql?q=…  (the old address still runs the query)')
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

  // ------------------------------------------------------------------ sorting

  // NULL means "not established" here, and 64 of 862 drivers have no first
  // season. Sorting descending must still sink them, or the register opens on
  // screens of em dashes. (This used the stored entry count until PD-06 took
  // that column off the register.)
  console.log('\nSorting')
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

  // ---------------------------------------------------------------- search

  console.log('\nSearch')
  await page.keyboard.press('/')
  await page.waitForSelector('.palette input', { timeout: 10000 })
  await page.fill('.palette input', 'rindt')
  // The index is one query on first open, so the list can show "no match" for a
  // frame before it lands. Wait for a real hit rather than for any row.
  await page.waitForSelector('#palette-results li a[href^="/drivers/"]', { timeout: 10000 })
  const first = await page.$eval('#palette-results li a', (node) => node.getAttribute('href'))
  is(first, '/drivers/rindt', 'search finds a driver by name')
  await page.click('#palette-results li a')

  // The winningest driver of a shared surname comes first: "schumacher" used
  // to offer Ralf, on six wins, above Michael on ninety-one, because the only
  // tie-break was the length of the name.
  console.log('\nSearch  (prominence)')
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

  // -------------------------------------------------------------- 404 route

  console.log('\nMissing routes')
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
  console.log('\nShapes')

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
     `SELECT '/seasons/' || MAX(year) FROM seasons`],
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
    const before = consoleErrors.length
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
      if (filled > 0 && consoleErrors.length === before) pass(`${what} — ${route}`)
      else fail(`${what} — ${route}: ${filled} blocks, ${consoleErrors.length - before} new error(s)`)
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
  console.log('\nPrerendering')

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
    8 // records, data and its three children, eras, glossary, the atlas
  is(urls, expected, 'the sitemap lists every page the database implies')
  truthy(
    sitemap.includes('/data/quality</loc>') && !sitemap.includes('/reference/quality') && !sitemap.includes('/reference</loc>'),
    'the sitemap lists the new addresses and none of the moved ones',
  )
  truthy((await fetch(`${BASE}/robots.txt`).then((r) => r.text())).includes('Sitemap:'), 'robots.txt points at it')

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
