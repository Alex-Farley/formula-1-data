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

import { COLOURS } from '../src/lib/racingColours.js'
import { LIVERIES, LIVERY_ERA, LIVERY_GAPS } from '../src/lib/liveries.js'
import { DatabaseSync } from 'node:sqlite'

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

describe('a racing colour is a pair, one per theme (VD-27)', () => {
  // The eight national racing colours were one hex each, and six of the eight
  // fell under 3:1 against the panel in one theme or the other - US blue at
  // 1.78:1 in dark, Belgian yellow at 2.38:1 in light - on the 3 px band that
  // is a register row's only identity mark. Each is now a --racing-* token in
  // tokens.css with a light and a dark value, keyed the way --seq-* is. This
  // measures every one against the surfaces the swatch sits on, in both
  // themes, so a retuned palette cannot quietly fail one of them again.
  const css = read(join(web, 'src', 'styles', 'tokens.css'))
  const blocks = {
    light: css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')),
    osDark: css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf(":root[data-theme='dark']")),
    stampedDark: css.slice(css.indexOf(":root[data-theme='dark']")),
  }
  const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/g)].map((m) => [m[1], m[2]]))
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const racing = (block) => Object.entries(tokens(block)).filter(([name]) => name.startsWith('racing-'))

  it('every token racingColours.js names is defined in all three blocks, and the two dark blocks agree', () => {
    const named = Object.values(COLOURS).map((c) => c.token).sort()
    // Eight countries have an unambiguous colour; an emptied map and deleted
    // tokens would otherwise agree with each other and pass the rest of this.
    assert.ok(named.length >= 8, `racingColours.js names ${named.length} tokens, expected the eight`)
    assert.equal(new Set(named).size, named.length, 'two countries share a token')
    for (const [label, block] of Object.entries(blocks)) {
      assert.deepEqual(racing(block).map(([name]) => name).sort(), named, `${label} block`)
    }
    assert.deepEqual(racing(blocks.osDark), racing(blocks.stampedDark))
  })

  it('each light value clears 3:1 on --panel and --panel-sunk, each dark value on --panel and --panel-raised', () => {
    const failing = []
    const light = tokens(blocks.light)
    for (const [name, hex] of racing(blocks.light)) {
      for (const surface of ['panel', 'panel-sunk']) {
        const ratio = contrast(hex, light[surface])
        if (ratio < 3) failing.push(`light ${name} ${hex} on --${surface}: ${ratio.toFixed(2)}:1`)
      }
    }
    const dark = tokens(blocks.stampedDark)
    for (const [name, hex] of racing(blocks.stampedDark)) {
      for (const surface of ['panel', 'panel-raised']) {
        const ratio = contrast(hex, dark[surface])
        if (ratio < 3) failing.push(`dark ${name} ${hex} on --${surface}: ${ratio.toFixed(2)}:1`)
      }
    }
    assert.deepEqual(failing, [])
  })

  it('no swatch carries a hex of its own', () => {
    const offenders = sourceFiles(join(web, 'src'), /\.jsx?$/)
      .filter((file) => /colour\.hex\b/.test(read(file)))
      .map(rel)
    assert.deepEqual(offenders, [])
  })
})

describe('a livery is a sourced pair, one per theme, and every 2010+ constructor-season is placed (AF-04)', () => {
  // lib/liveries.js is the second colour map: a team's own colour for each
  // season from 2010, beside the national convention. Its header says what
  // is a fact (the named colour, read from a source) and what is not (the
  // hex, this palette's rendering, tuned to 3:1). This holds the file to
  // both halves: every entry names its source and what it said, every pair
  // clears the same surfaces the national colours do, no two spans overlap,
  // and - against f1.db itself - every constructor-season with race entries
  // from 2010 is either coloured or declared a gap, never both, never
  // neither. A span that quietly covers a season nobody sourced, or a gap
  // that stays declared after someone fills it, fails here.
  const css = read(join(web, 'src', 'styles', 'tokens.css'))
  const blocks = {
    light: css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')),
    stampedDark: css.slice(css.indexOf(":root[data-theme='dark']")),
  }
  const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/g)].map((m) => [m[1], m[2]]))
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const HEX = /^#[0-9a-f]{6}$/

  it('every entry carries a constructor, a span from 2010, a name, a base and a pair, at least one https source and what it said', () => {
    assert.ok(LIVERIES.length >= 50, `${LIVERIES.length} liveries; the map covered 168 constructor-seasons when it landed`)
    for (const l of LIVERIES) {
      const where = `${l.constructor} ${l.from}-${l.to}`
      assert.match(l.constructor, /^[a-z0-9-]+$/, where)
      assert.ok(Number.isInteger(l.from) && Number.isInteger(l.to) && l.from >= LIVERY_ERA && l.to >= l.from, `${where}: span`)
      assert.ok(typeof l.name === 'string' && l.name.trim().length > 1, `${where}: name`)
      for (const key of ['base', 'light', 'dark']) assert.match(l[key], HEX, `${where}: ${key}`)
      assert.ok(Array.isArray(l.source) && l.source.length >= 1, `${where}: source`)
      for (const s of l.source) assert.match(s, /^https:\/\//, `${where}: source ${s}`)
      assert.ok(typeof l.says === 'string' && l.says.length > 20, `${where}: says`)
    }
  })

  it('no constructor has two entries for one season, and no gap overlaps an entry', () => {
    const seen = new Map()
    for (const l of LIVERIES)
      for (let y = l.from; y <= l.to; y++) {
        const key = `${l.constructor} ${y}`
        assert.ok(!seen.has(key), `${key} is in two entries: ${seen.get(key)} and ${l.name}`)
        seen.set(key, l.name)
      }
    for (const g of LIVERY_GAPS)
      for (let y = g.from; y <= g.to; y++) assert.ok(!seen.has(`${g.constructor} ${y}`), `${g.constructor} ${y} is both a gap and ${seen.get(`${g.constructor} ${y}`)}`)
  })

  it('each light value clears 3:1 on --panel and --panel-sunk, each dark value on --panel and --panel-raised', () => {
    const light = tokens(blocks.light)
    const dark = tokens(blocks.stampedDark)
    const failing = []
    for (const l of LIVERIES) {
      for (const surface of ['panel', 'panel-sunk']) {
        const ratio = contrast(l.light, light[surface])
        if (ratio < 3) failing.push(`${l.constructor} ${l.from} light ${l.light} on --${surface}: ${ratio.toFixed(2)}:1`)
      }
      for (const surface of ['panel', 'panel-raised']) {
        const ratio = contrast(l.dark, dark[surface])
        if (ratio < 3) failing.push(`${l.constructor} ${l.from} dark ${l.dark} on --${surface}: ${ratio.toFixed(2)}:1`)
      }
    }
    assert.deepEqual(failing, [])
  })

  it('against f1.db, every constructor-season with race entries from 2010 is exactly one of: coloured, a declared gap', () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    const rows = db
      .prepare(
        `SELECT DISTINCT r.year, e.constructor_id FROM race_entries e JOIN races r ON r.id = e.race_id
          WHERE r.year >= ? AND e.constructor_id IS NOT NULL ORDER BY e.constructor_id, r.year`,
      )
      .all(LIVERY_ERA)
    const ids = new Set(db.prepare('SELECT id FROM constructors').all().map((r) => r.id))
    db.close()
    assert.ok(rows.length >= 170, `${rows.length} constructor-seasons from ${LIVERY_ERA}; expected the 180 of 2010-2026`)
    const covered = (list, id, y) => list.some((l) => l.constructor === id && y >= l.from && y <= l.to)
    const unplaced = rows.filter((r) => !covered(LIVERIES, r.constructor_id, r.year) && !covered(LIVERY_GAPS, r.constructor_id, r.year))
    assert.deepEqual(unplaced.map((r) => `${r.constructor_id} ${r.year}`), [], 'constructor-seasons in neither list')
    // A span may not reach a season the constructor did not race: that is a
    // colour claimed for a car that never ran.
    const raced = new Set(rows.map((r) => `${r.constructor_id} ${r.year}`))
    const phantom = []
    for (const l of [...LIVERIES, ...LIVERY_GAPS])
      for (let y = l.from; y <= l.to; y++) if (!raced.has(`${l.constructor} ${y}`)) phantom.push(`${l.constructor} ${y}`)
    assert.deepEqual(phantom, [], 'spans covering a season with no race entries')
    for (const l of [...LIVERIES, ...LIVERY_GAPS]) assert.ok(ids.has(l.constructor), `${l.constructor} is not a constructor id`)
  })

  it('no page carries a livery hex of its own: every pair reaches an element through lib/liveries.js', () => {
    const offenders = sourceFiles(join(web, 'src'), /\.jsx?$/)
      .filter((file) => !/lib\/liveries\.js$/.test(file))
      .filter((file) => /--livery-(?:light|dark)['"]?\s*:\s*['"]#[0-9a-f]{6}/i.test(read(file)))
      .map(rel)
    assert.deepEqual(offenders, [])
  })
})

describe('the corner-radius ramp is stepped, in both themes (VD-25)', () => {
  // Five bands of one hue. The pale end has to read as a mark against the
  // stage it is drawn on and the panel its key sits on; every neighbouring
  // pair has to be told apart. The dark ramp's pale end was 2.73:1 on the
  // panel and its steps ran 1.23-1.48:1, so Spa was one blue from La Source
  // to Kemmel. Ratios multiply, so 2:1 steps over a 3:1 floor would need
  // 48:1 at the far end - more than black on white - which is why the floor
  // here is 1.4:1 and lib/lap.js gives each band a stroke width as well.
  const css = read(join(web, 'src', 'styles', 'tokens.css'))
  const blocks = {
    light: css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')),
    osDark: css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf(":root[data-theme='dark']")),
    stampedDark: css.slice(css.indexOf(":root[data-theme='dark']")),
  }
  const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/g)].map((m) => [m[1], m[2]]))
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const ramp = (block) => [1, 2, 3, 4, 5].map((i) => tokens(block)[`seq-${i}`])

  it('all five steps are defined in every block, and the two dark blocks agree', () => {
    for (const [label, block] of Object.entries(blocks)) {
      assert.ok(ramp(block).every((hex) => hex), `${label} block: ${JSON.stringify(ramp(block))}`)
    }
    assert.deepEqual(ramp(blocks.osDark), ramp(blocks.stampedDark))
  })

  for (const [label, block] of [['light', blocks.light], ['dark', blocks.stampedDark]]) {
    it(`${label}: the pale end clears 3:1 on --stage and --panel, neighbours 1.4:1, and luminance runs one way`, () => {
      const t = tokens(block)
      const steps = ramp(block)
      const failing = []
      for (const surface of ['stage', 'panel']) {
        const ratio = contrast(steps[0], t[surface])
        if (ratio < 3) failing.push(`--seq-1 ${steps[0]} on --${surface}: ${ratio.toFixed(2)}:1`)
      }
      for (let i = 1; i < steps.length; i += 1) {
        const ratio = contrast(steps[i - 1], steps[i])
        if (ratio < 1.4) failing.push(`--seq-${i} against --seq-${i + 1}: ${ratio.toFixed(2)}:1`)
      }
      // "More" is darker in light and lighter in dark; a ramp that doubled
      // back would pass the pairwise check and still confuse two bands.
      const lums = steps.map(luminance)
      const sign = label === 'light' ? -1 : 1
      for (let i = 1; i < lums.length; i += 1) {
        if (Math.sign(lums[i] - lums[i - 1]) !== sign) failing.push(`--seq-${i + 1} does not continue the ramp`)
      }
      assert.deepEqual(failing, [])
    })
  }
})
