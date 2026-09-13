/**
 * The front end's conventions that a pattern can decide, decided by one.
 *
 * WHY THIS FILE EXISTS
 *     The frontend-reviewer checklist in .claude/agents/ has ten items. Four
 *     of them are answerable by reading the source with a regular expression,
 *     and until now a reviewer answered them by reading the source with a
 *     language model — at 40,000 to 130,000 tokens a pass, on every pull
 *     request, whether or not the diff went near them. Here they run in
 *     `npm run test:units`, in about a millisecond, and the checklist says
 *     they are taken so the review spends its attention on judgement.
 *
 *     The attribution check began life in smoke.mjs and moved here on
 *     2026-09-13 unchanged: it reads files, not pages, so it never needed
 *     the browser, and here a reviewer or an agent can run it alone.
 *
 * A rule with declared exceptions lists them here with the reason, the way
 * verify.py declares its deviations. A new site fails until it is declared.
 * The repository-level equivalents are in tests/test_conventions.py.
 *
 *     npm run test:units
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..')

function sourceFiles(dir, pattern = /\.(jsx?|mjs|css)$/) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full, pattern)
    return pattern.test(entry) ? [full] : []
  })
}
const rel = (file) => relative(web, file)
const read = (file) => readFileSync(file, 'utf8')

describe('one attribution rule (frontend-reviewer, item 1)', () => {
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
  // So the rule is: render a Commons file, import the shared credit. Checked
  // in the SOURCE because a rendered-page assertion only sees the pages it
  // visits, and the bypass would be on the one it does not.
  const SANCTIONED = [
    join(web, 'src', 'components', 'CommonsImage.jsx'),
    join(web, 'src', 'components', 'CommonsCredit.jsx'),
    join(web, 'src', 'lib', 'commons.js'),
  ]

  it('every surface showing a Commons photograph carries the shared credit', () => {
    const offenders = []
    for (const file of sourceFiles(join(web, 'src'), /\.jsx?$/)) {
      if (SANCTIONED.includes(file)) continue
      const text = read(file)
      const showsCommons = /\bthumbUrl\s*\(/.test(text) || /\bCommonsImage\b/.test(text)
      if (!showsCommons) {
        // A file with no Commons file in it may still not invent a credit.
        if (/photographer not recorded|licence not recorded/.test(text)) {
          offenders.push(`${rel(file)} writes its own credit line`)
        }
        continue
      }
      const credited = /\bCommonsImage\b/.test(text) || /\bCommonsCredit\b/.test(text)
      if (!credited) offenders.push(`${rel(file)} shows a Commons file with no shared credit`)
      if (/\bcanShow\b/.test(text) === false && /\bthumbUrl\s*\(/.test(text)) {
        offenders.push(`${rel(file)} shows a Commons file without checking canShow()`)
      }
    }
    assert.deepEqual(offenders, [], 'attribution can be bypassed')
  })

  it('the shared rule falls back to `credit` where a file names no artist, as the build does', () => {
    // verify.py accepts `artist` OR `credit`; a surface reading only `artist`
    // captions an admitted row as anonymous, which is what the 1958 Hawthorn
    // photograph on Ferrari 246 F1 would have shown.
    const rule = read(join(web, 'src', 'lib', 'commons.js'))
    assert.ok(/image\?\.artist/.test(rule) && /image\?\.credit/.test(rule))
  })
})

describe('a NULL is "not established", never zero (frontend-reviewer, item 2)', () => {
  // A stored figure the database does not hold renders as an em dash, and
  // `?? 0` or `|| 0` is how it would silently become a number. Every site
  // below was read on 2026-09-13 and is a COUNT or a WEIGHT — a driver with
  // no wins has zero wins, a download has zero bytes so far — where zero is
  // the true value when nothing matches, and none of them touches a stored
  // fact. The number is the most a file may carry; a new site anywhere fails
  // until it is added here with its reason, or written as `missing()`.
  const DECLARED = new Map([
    ['src/pages/Constructor.jsx', [8, 'derived career counts and a sort over the designs']],
    ['src/queries/driver.js', [5, 'derived career counts; seasons with an entry']],
    ['src/pages/Driver.jsx', [5, 'sort keys over derived counts, and a chart ceiling']],
    ['src/data/worker.js', [3, 'download progress in bytes']],
    ['src/lib/search.js', [1, 'a ranking weight']],
    ['src/pages/Quality.jsx', [1, 'rows in a confidence class']],
    ['src/pages/Data.jsx', [1, 'sources in a licence class']],
    ['src/pages/Circuit.jsx', [1, 'seasons a layout was used']],
    ['scripts/prerender.js', [3, 'sources in a licence class, the static copy of Data.jsx']],
  ])

  it('every zero fallback is a declared count or weight', () => {
    const undeclared = []
    for (const file of [...sourceFiles(join(web, 'src'), /\.jsx?$/), ...sourceFiles(join(web, 'scripts'), /\.m?js$/)]) {
      const hits = (read(file).match(/\?\? 0\b|\|\| 0\b/g) ?? []).length
      if (hits === 0) continue
      const [allowed] = DECLARED.get(rel(file)) ?? [0]
      if (hits > allowed) undeclared.push(`${rel(file)}: ${hits} zero fallbacks, ${allowed} declared`)
    }
    assert.deepEqual(undeclared, [], 'a `?? 0` or `|| 0` that is not declared above')
  })
})

describe('display: contents is never a styled wrapper (frontend-reviewer, item 8)', () => {
  // The box tree looks right and selectors match the DOM, so `.fields > dd`
  // silently matches nothing. A keyed Fragment is the answer; a comment
  // saying so is allowed, a rule is not.
  it('no stylesheet or component uses it', () => {
    const uses = []
    for (const file of sourceFiles(join(web, 'src'))) {
      read(file).split('\n').forEach((line, i) => {
        const trimmed = line.trim()
        if (/^(\*|\/\/|\{\/\*|\/\*)/.test(trimmed)) return
        if (/display:\s*contents/.test(trimmed)) uses.push(`${rel(file)}:${i + 1}`)
      })
    }
    assert.deepEqual(uses, [])
  })
})

describe('the prerendered half and the app agree on the name (frontend-reviewer, item 6)', () => {
  // The site was F1 Verified Facts; the rename reached the app and not the
  // prerenderer, and every static title said the old name for a release.
  it('the old wordmark appears nowhere a reader or a crawler reads', () => {
    const stale = [...sourceFiles(join(web, 'src')), ...sourceFiles(join(web, 'scripts'), /\.m?js$/), join(web, 'index.html')]
      .filter((file) => read(file).includes('F1 Verified Facts'))
      .map(rel)
    assert.deepEqual(stale, [])
  })
})

describe('routing is path-based and prerendered (frontend-reviewer, item 10)', () => {
  // BrowserRouter, not HashRouter: a hash is never sent to a server, so under
  // HashRouter all 2,300 pages shared one URL, one title and one index entry.
  // prerender.js writes a real file at every path, which is what makes a deep
  // link resolve on a static host with no rewrite rule. A HashRouter coming
  // back would undo the crawlability the prerenderer exists for.
  it('App.jsx mounts a BrowserRouter and no HashRouter', () => {
    const app = read(join(web, 'src', 'App.jsx'))
    assert.ok(/<BrowserRouter\b/.test(app), 'App.jsx does not mount a BrowserRouter')
    assert.ok(!/<HashRouter\b|createHashRouter/.test(app), 'App.jsx mounts a HashRouter')
  })
})
