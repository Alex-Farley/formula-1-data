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
import { LAST_CHECKED } from '../src/lib/refresh.js'
import { DOCUMENTS, IN_THIS_TAB } from '../src/lib/site.js'
import { measurement } from '../scripts/measurement.js'
import {
  ACCENT_APART,
  accentsBySource,
  colourForEntry,
  deltaE,
  LIVERIES,
  LIVERY_ERA,
  LIVERY_GAPS,
  liveryFor,
  liveryPair,
  liveryPrimary,
  liveryStyle,
  markStyleAttr,
  pairStyle,
  RECOGNITION,
  schemeGradient,
} from '../src/lib/liveries.js'
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

  // The scan above reads src/ only, and prerender.js is not in src/. It writes
  // its own <img> and its own caption because it emits HTML and CommonsImage is
  // a React component (PD-19) — which is exactly the shape the cars gallery had
  // when it grew a second answer to the licence question. So the static
  // renderer is held to the same rule by its own check: it may draw the figure
  // itself, it may not decide for itself who is credited or whether a file may
  // be shown.
  it('the static renderer takes the same rule from lib/commons.js', () => {
    const offenders = []
    for (const file of sourceFiles(join(web, 'scripts'), /\.m?js$/)) {
      const text = read(file)
      if (!/\bthumbUrl\s*\(/.test(text)) {
        if (/photographer not recorded|licence not recorded/.test(text)) {
          offenders.push(`${rel(file)} writes its own credit line`)
        }
        continue
      }
      if (!/\battribution\s*\(/.test(text)) {
        offenders.push(`${rel(file)} shows a Commons file without attribution()`)
      }
      if (!/\bcanShow\s*\(/.test(text)) {
        offenders.push(`${rel(file)} shows a Commons file without checking canShow()`)
      }
      if (!/from '\.\.\/src\/lib\/commons\.js'/.test(text)) {
        offenders.push(`${rel(file)} does not take the rule from src/lib/commons.js`)
      }
    }
    assert.deepEqual(offenders, [], 'attribution can be bypassed in the static renderer')
  })

  // VD-33 took the section from one page to four. The component is the whole
  // of the licence obligation on those four - the fail-closed filter, the
  // credit under every figure, the caveat - so a page that draws its own grid
  // is a page that has opted out of it without saying so. The static renderer
  // writes the same markup from its own function, for the reason the check
  // below this one exists: it emits HTML, and a React component cannot.
  it('one photographs section: no page writes its own grid', () => {
    const offenders = []
    const section = join(web, 'src', 'components', 'Photographs.jsx')
    for (const file of sourceFiles(join(web, 'src'), /\.jsx?$/)) {
      if (file === section) continue
      if (/photo-grid/.test(read(file))) offenders.push(`${rel(file)} draws its own photographs section`)
    }
    assert.deepEqual(offenders, [], 'the photographs section has more than one definition')
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
    ['src/pages/Constructor.jsx', [4, 'derived career counts']],
    // IA-03 moved the two sorts that pick an onward band's car and season out
    // of Constructor.jsx and Driver.jsx and into one module both renderers
    // read. Same eight comparisons, same reason: every key is a COUNT over the
    // race records, where nothing matched IS zero - a design with no win has
    // no wins, not an unknown number of them - and none reads a stored column.
    ['src/lib/wayfinding.js', [8, 'sort keys over derived win, podium and race counts']],
    // PD-15 added six: entries, starts, the four results figures tested
    // together, recorded grids and retirements. Every one is a COUNT over
    // race_entries, where SUM and COUNT are NULL only when no row matched
    // and none-matched IS the zero - a driver with no entry has no start,
    // not an unknown number of them. None reads a stored column.
    ['src/queries/driver.js', [13, 'derived career counts; seasons with an entry; PD-15 substitutes']],
    ['src/pages/Driver.jsx', [1, 'a chart ceiling; its sort keys are in lib/wayfinding.js']],
    ['src/data/worker.js', [3, 'download progress in bytes']],
    ['src/lib/search.js', [1, 'a ranking weight']],
    // IX-19: how many rows the static page drew for a table of this name.
    // A name the static half does not hold - a table it never drew, or one
    // heading over two tables, which is dropped rather than guessed at -
    // drew none of them, and none IS the zero. It counts <tr> in a document,
    // never a stored column, and the table pages as it always did.
    ['src/lib/handover.js', [1, 'rows a static table drew; a name it does not hold drew none']],
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

  // SD-01 put three files from the repository root into what the site
  // publishes, and this check was scoped to web/ - so schema.sql arrived on
  // lapledger.org still headed with the old name, past the one test that
  // exists to catch that. What a reader reads is the rule, not where the
  // file happens to live, so the list the site publishes is read from the
  // same DOCUMENTS the two renderers link.
  //
  // DECLARED: meta.database_name still holds the old name inside f1.db. It
  // reaches f1_compat.json, which other things consume, so the rename stops
  // short of it deliberately - PM-22 (#165) carries that one, with its own
  // version bump. This check reads the served documents, not the database.
  it('nor in a document the site serves beside the data', () => {
    const stale = DOCUMENTS.map(([file]) => join(web, '..', file))
      .filter((file) => read(file).includes('F1 Verified Facts'))
      .map((file) => relative(join(web, '..'), file))
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
  // tokens.css with a light and a dark value, one per theme block. This
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

describe('a livery is a sourced scheme drawn as itself, and every 2010+ constructor-season is placed (AF-04, AF-15, AF-16)', () => {
  // lib/liveries.js is the second colour map: a team's own colour for each
  // season from 2010, beside the national convention. Its header says what
  // is a fact (the named colour, read from a source) and what is not (the
  // hex, this palette's rendering). This holds the file to both halves:
  // every entry names its source and what it said, every mark's edge stays
  // perceivable where its fill is not, the pair a chart series wears still
  // clears the surfaces the national colours do, no two spans overlap,
  // every colour of a scheme declares whose choice it is (AF-15), and no two
  // teams on the same grid wear the same scheme,
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

  it('every entry carries a constructor, a span from 2010, a name, a scheme and a pair, at least one https source, a paraphrase of what it states and whether each colour is the team\'s own word and its sources\' (AF-15)', () => {
    assert.ok(LIVERIES.length >= 50, `${LIVERIES.length} liveries; the map covered 168 constructor-seasons when it landed`)
    for (const l of LIVERIES) {
      const where = `${l.constructor} ${l.from}-${l.to}`
      assert.match(l.constructor, /^[a-z0-9-]+$/, where)
      assert.ok(Number.isInteger(l.from) && Number.isInteger(l.to) && l.from >= LIVERY_ERA && l.to >= l.from, `${where}: span`)
      assert.ok(typeof l.name === 'string' && l.name.trim().length > 1, `${where}: name`)
      for (const key of ['light', 'dark']) assert.match(l[key], HEX, `${where}: ${key}`)
      // A scheme is a primary and one or two accents, in that order. Each
      // colour says whose word its name is (`named`) and whether a cited
      // page states it at all (`sourced`); a colour the team itself names
      // cannot be one this project chose, so named implies sourced.
      assert.ok(Array.isArray(l.scheme) && l.scheme.length >= 1 && l.scheme.length <= 3, `${where}: scheme is a primary and up to two accents`)
      for (const c of l.scheme) {
        assert.ok(typeof c.name === 'string' && c.name.trim().length > 1, `${where}: scheme colour name`)
        assert.match(c.base, HEX, `${where}: ${c.name} base`)
        assert.equal(typeof c.named, 'boolean', `${where}: ${c.name} named`)
        assert.equal(typeof c.sourced, 'boolean', `${where}: ${c.name} sourced`)
        assert.ok(!(c.named && !c.sourced), `${where}: ${c.name} is the team's own word and unsourced`)
      }
      // The pair renders the MARK'S LEAD (AF-57), not the primary and not
      // some third colour: the lead survives untouched in whichever theme
      // already clears 3:1, and only the other is moved. A pair that matches
      // neither is a pair for some other colour.
      //
      // This is the check that was missing when AF-45 landed. AF-45 gave the
      // mark a recognition-led lead and left the pair on the primary, so
      // Mercedes' mark went Petronas green while its title-race line stayed
      // black - the same team, two colours, one page - and nothing failed.
      // Holding the pair to the lead means a recognition colour that moves
      // cannot leave the charts behind: the pair stops rendering the lead
      // and this fails until it is recomputed. The 3:1 floor those values
      // owe is measured below, and is the reason the pair exists at all.
      const lead = liveryPair(l).lead
      assert.ok(
        lead.base === l.light || lead.base === l.dark,
        `${where}: neither half of the pair ${l.light}/${l.dark} is the mark's lead ${lead.base} (${lead.name}), so one of them is a rendering of some other colour`,
      )
      assert.ok(Array.isArray(l.source) && l.source.length >= 1, `${where}: source`)
      for (const s of l.source) assert.match(s, /^https:\/\//, `${where}: source ${s}`)
      assert.ok(typeof l.says === 'string' && l.says.length > 20, `${where}: says`)
      // A paraphrase, never a quotation: the first draft put quotation marks
      // round wording the cited pages did not contain, and review found 41.
      assert.ok(!/["\u201c\u201d]/.test(l.says), `${where}: says carries a quotation mark - it is a paraphrase, not a quote`)
    }
  })

  it('a colour name renders one hex within a constructor: the palette renders a name, so one team cannot have two greys called Grey (AF-15)', () => {
    const seen = new Map()
    const clashes = []
    for (const l of LIVERIES)
      for (const c of l.scheme) {
        const key = `${l.constructor} ${c.name}`
        if (seen.has(key) && seen.get(key) !== c.base) clashes.push(`${key}: ${seen.get(key)} and ${c.base}`)
        seen.set(key, c.base)
      }
    assert.deepEqual(clashes, [])
  })

  it('no two constructors on the same grid wear the same scheme (AF-15)', () => {
    // The defect AF-15 names, stated so it cannot come back: Haas and
    // Racing Bulls were one colour each and the same one. This compares
    // schemes, which is what this file decides; the check below it now
    // compares the MARKS, because AF-17 made the mark draw the whole scheme
    // and two teams whose schemes differ no longer draw the same bar.
    const byYear = new Map()
    const clashes = []
    for (const l of LIVERIES) {
      const sig = l.scheme.map((c) => `${c.name} ${c.base}`).join(' / ')
      for (let y = l.from; y <= l.to; y++) {
        const grid = byYear.get(y) ?? new Map()
        if (grid.has(sig)) clashes.push(`${y}: ${grid.get(sig)} and ${l.constructor} are both ${sig}`)
        grid.set(sig, l.constructor)
        byYear.set(y, grid)
      }
    }
    assert.deepEqual(clashes, [])
  })

  it('no two constructors on the same grid draw the same mark (AF-17, AF-46)', () => {
    // What the check above became reachable as. The mark used to be the
    // primary alone, so two teams could differ in the file and be identical
    // on screen; it draws a pair now (AF-46), and this measures the style the
    // app and the prerenderer both write, so a mark that stops carrying its
    // accent fails here rather than going quietly grey-on-grey.
    //
    // Not every surface, and the difference matters: `.outline-strip .livery`
    // drops the gradient because a three-pixel bar has no room for bands, so
    // two winning constructors sharing a lead would still draw alike
    // there - and near-alike already happens: the navy leads of Red Bull and
    // AlphaTauri in 2020, and of Red Bull and Williams in 2012, are different
    // hexes a few delta E apart (#375). This checks what is HANDED to a mark, which is
    // the thing this file can decide; what each surface then does with it is
    // the stylesheet's, and the strip's exception is declared in it.
    const byYear = new Map()
    const clashes = []
    for (const l of LIVERIES) {
      const mark = markStyleAttr({ mark: pairStyle(liveryPair(l)) })
      for (let y = l.from; y <= l.to; y++) {
        const grid = byYear.get(y) ?? new Map()
        if (grid.has(mark)) clashes.push(`${y}: ${grid.get(mark)} and ${l.constructor} draw ${mark}`)
        grid.set(mark, l.constructor)
        byYear.set(y, grid)
      }
    }
    assert.deepEqual(clashes, [])
  })

  it('two marks on one grid differ by delta E 15 in their lead or their accent, but for the pairs declared here (AF-46)', () => {
    // Not being byte-identical is a weak promise: two navies 6 apart are
    // different strings and the same bar. AF-46 chose a two-colour mark on
    // the measurement that no 2026 pair is nearer than 26.3 in whichever of
    // lead and accent differs more; this holds every season to 15.
    //
    // Declared, with the reason: Red Bull and Toro Rosso 2010-2016 are navy
    // over red and navy over red. The third colour told them apart when a
    // mark drew the whole scheme, and a pair drops it (#375).
    const DECLARED = new Set(['red-bull/toro-rosso'])
    const years = new Map()
    for (const l of LIVERIES)
      for (let y = l.from; y <= l.to; y++) years.set(y, [...(years.get(y) ?? []), l])
    const failing = []
    const used = new Set()
    for (const [y, grid] of years)
      for (let i = 0; i < grid.length; i++)
        for (let j = i + 1; j < grid.length; j++) {
          const [a, b] = [liveryPair(grid[i]), liveryPair(grid[j])]
          const lead = deltaE(a.lead.base, b.lead.base)
          const accent = a.accent && b.accent ? deltaE(a.accent.base, b.accent.base) : a.accent || b.accent ? Infinity : 0
          if (Math.max(lead, accent) >= 15) continue
          const pair = [grid[i].constructor, grid[j].constructor].sort().join('/')
          if (DECLARED.has(pair)) used.add(pair)
          else failing.push(`${y}: ${pair} ${Math.max(lead, accent).toFixed(1)}`)
        }
    assert.deepEqual(failing, [])
    assert.deepEqual([...DECLARED].filter((p) => !used.has(p)), [], 'a declared pair no longer collides: take it off the list')
  })

  it('the recognition colours are the eleven decided, each one a colour its team has raced (AF-45)', () => {
    // One fact per constructor. Three moved on the maintainer's word, two
    // were confirmed where they stood, and the other six are the 2026
    // sourced primary - which this holds them to, so a relaunch that moves a
    // primary cannot quietly leave the recognition colour behind.
    const grid = LIVERIES.filter((l) => l.to === 2026).map((l) => l.constructor).sort()
    assert.deepEqual(Object.keys(RECOGNITION).sort(), grid, 'every 2026 constructor has one recognition colour, and nobody else')
    const moved = { mercedes: '#0f9c94', 'red-bull': '#1b2a5e', 'racing-bulls': '#2b4bd8' }
    for (const [team, rec] of Object.entries(RECOGNITION)) {
      if (moved[team]) assert.equal(rec.base, moved[team], team)
      else assert.equal(rec.base, liveryPrimary(liveryFor(team, 2026)).base, `${team}: not its 2026 primary`)
      assert.ok(
        LIVERIES.some((l) => l.constructor === team && l.scheme.some((c) => c.name === rec.name && c.base === rec.base)),
        `${team}: ${rec.name} ${rec.base} is not a colour any of its seasons carries`,
      )
    }
    // Racing Bulls' blue is the one this project picked rather than one a
    // maintainer named, and nothing else is.
    assert.deepEqual(
      Object.entries(RECOGNITION).filter(([, rec]) => rec.chosen).map(([team]) => team),
      ['racing-bulls'],
    )
  })

  it('a mark leads with the recognition colour where its season carries one, and draws exactly two (AF-45, AF-46)', () => {
    // The check AF-17 wrote said the SOURCED primary leads the mark. That
    // was true of the car and not of the team, and AF-45 moved it: the mark
    // leads with the colour the team is recognised by, drawn in the
    // season's own shade, and where the season never raced it the primary
    // leads unchanged. Two colours, not the scheme: the band draws all three.
    const failing = []
    const count = { leads: 0, lifted: 0, absent: 0 }
    for (const l of LIVERIES) {
      const where = `${l.constructor} ${l.from}`
      const { lead, accent, recognised } = liveryPair(l)
      const mark = pairStyle({ lead, accent })
      if (!l.scheme.includes(lead) || (accent && !l.scheme.includes(accent)))
        failing.push(`${where}: the pair draws a colour the scheme does not hold`)
      const rec = RECOGNITION[l.constructor]
      if (rec) {
        const nearest = Math.min(...l.scheme.map((c) => deltaE(c.base, rec.base)))
        if (recognised && deltaE(lead.base, rec.base) !== nearest) failing.push(`${where}: a nearer colour than ${lead.name} was passed over`)
        if (recognised) count[lead === l.scheme[0] ? 'leads' : 'lifted']++
        else count.absent++
      }
      if (!recognised && lead !== l.scheme[0]) failing.push(`${where}: an unrecognised mark does not lead with the primary`)
      if (mark['--livery'] !== lead.base) failing.push(`${where}: the ring is not mixed from the lead`)
      if (!accent) {
        if (l.scheme.length > 1 && l.scheme.some((c) => c !== lead && deltaE(c.base, lead.base) >= ACCENT_APART))
          failing.push(`${where}: an accent was available and not drawn`)
        if (mark['--livery-scheme']) failing.push(`${where}: a single colour drew a gradient`)
        continue
      }
      if (deltaE(accent.base, lead.base) < ACCENT_APART) failing.push(`${where}: the accent is the lead again`)
      const first = l.scheme.find((c) => c !== lead && deltaE(c.base, lead.base) >= ACCENT_APART)
      if (accent !== first) failing.push(`${where}: the accent is not the first colour standing`)
      const expected = `linear-gradient(to bottom, ${lead.base} 0 62.00%, ${accent.base} 62.00% 100.00%)`
      if (mark['--livery-scheme'] !== expected) failing.push(`${where}: the mark draws ${mark['--livery-scheme']}`)
    }
    assert.deepEqual(failing, [])
    // The figures #372 was decided on, over the 32 entries of the eleven
    // teams: fifteen already led with it, eight lift it, nine never raced it.
    assert.deepEqual(count, { leads: 15, lifted: 8, absent: 9 })
  })

  it('a mark says the team is recognised by its lead, and the band still says what the car raced in (AF-45)', () => {
    const failing = []
    for (const l of LIVERIES) {
      const where = `${l.constructor} ${l.from}`
      const colour = colourForEntry({ constructorId: l.constructor, country: null, year: l.from, team: 'T' })
      const { lead, recognised } = colour.pair
      if (!recognised) {
        if (!colour.title.includes(`T raced in ${l.from}`)) failing.push(`${where}: a primary-led mark does not say what the car raced in`)
        continue
      }
      if (/raced in/.test(colour.title)) failing.push(`${where}: a recognition-led mark says the car raced in it`)
      if (!colour.title.startsWith(`${lead.name} — the colour T is recognised by, which is this site's reading`))
        failing.push(`${where}: the tooltip does not say whose reading the recognition is`)
      // The second claim is the sources', and only where they make it.
      const own = RECOGNITION[l.constructor].chosen || !lead.sourced
      const sourced = /as its sources describe it|the name is the team's own/.test(colour.title)
      if (own && sourced) failing.push(`${where}: a colour this project picked borrows a source`)
      if (!own && !sourced) failing.push(`${where}: the tooltip drops the sourced fact that the livery carries it`)
      if (/the name is the team's own/.test(colour.title) !== (!own && lead.named))
        failing.push(`${where}: the tooltip says whose name it is wrongly`)
    }
    assert.deepEqual(failing, [])
    for (const page of ['Constructor.jsx', 'Driver.jsx'])
      assert.match(read(join(web, 'src', 'pages', page)), /raced in \$?\{/, `${page}: the band no longer says what the car raced in`)
  })

  it('a band draws every colour of its scheme, primary first, and a scheme of one draws no gradient (AF-17)', () => {
    // The stops are hard and name the bases unchanged: a blended stop would
    // put a colour on screen that no source states, which is the objection
    // this file's header raises about hexes in the first place.
    const failing = []
    for (const l of LIVERIES) {
      const gradient = schemeGradient(l.scheme)
      if (l.scheme.length === 1) {
        if (gradient !== null) failing.push(`${l.constructor} ${l.from}: a scheme of one drew ${gradient}`)
        continue
      }
      if (!gradient) {
        failing.push(`${l.constructor} ${l.from}: ${l.scheme.length} colours and no gradient`)
        continue
      }
      for (const c of l.scheme)
        if (!gradient.includes(c.base)) failing.push(`${l.constructor} ${l.from}: ${c.name} ${c.base} is not drawn`)
      // The primary leads the BAND: the band says what the car raced in, in
      // the car's order. A mark's lead is the recognition colour, above.
      if (!gradient.startsWith(`linear-gradient(to bottom, ${liveryPrimary(l).base} 0 `))
        failing.push(`${l.constructor} ${l.from}: the primary does not lead the band`)
      if (!gradient.endsWith('100.00%)')) failing.push(`${l.constructor} ${l.from}: the last stop stops short of the edge`)
    }
    assert.deepEqual(failing, [])
  })

  it('a national colour is a scheme of one, and its mark carries no gradient (AF-17)', () => {
    // The convention painted a car one colour. An accent invented for it
    // would be a fact this project made up, which is the one thing the
    // database's own rules forbid everywhere else.
    const entry = colourForEntry({ constructorId: 'ferrari', country: 'Italy', year: 1955, team: 'Ferrari' })
    assert.equal(entry.kind, 'national')
    assert.equal(entry.scheme.length, 1)
    assert.deepEqual(Object.keys(entry.style), ['--livery'])
    assert.deepEqual(entry.mark, entry.style)
  })

  it('.livery paints the scheme over the primary, and the primary is still what the edge is mixed from (AF-17)', () => {
    const app = read(join(web, 'src', 'styles', 'app.css'))
    const rule = app.slice(app.indexOf('\n.livery {'), app.indexOf('\n.livery-none {'))
    assert.match(
      rule,
      /background-image:\s*var\(--livery-scheme,\s*none\)/,
      '.livery does not draw --livery-scheme: the mark is back to the primary alone',
    )
    // Order matters and a stylesheet will not say so: `background:` is a
    // shorthand and resets background-image, so the image must come after it.
    // The presence check first, because indexOf returns -1 for a shorthand
    // that is GONE and every index is greater than that - which would pass
    // this while a scheme-of-one mark painted nothing at all.
    assert.notEqual(rule.indexOf('background:'), -1, '.livery no longer sets the background shorthand')
    assert.ok(
      rule.indexOf('background-image:') > rule.indexOf('background:'),
      '.livery sets background-image before the background shorthand, which resets it',
    )
  })

  it('the prerenderer writes the mark from the same function the app does (AF-17)', () => {
    // The static strip spelled out `--livery:` itself, so a second property
    // reached the app alone. Both go through markStyleAttr now.
    const pre = read(join(web, 'scripts', 'prerender.js'))
    assert.ok(/markStyleAttr/.test(pre), 'prerender.js no longer uses markStyleAttr')
    assert.ok(
      !/style="--livery:/.test(pre),
      'prerender.js writes a livery property out by hand again; it will drift from the app',
    )
  })

  it('accentsBySource splits every accent by whether a page states it, and loses none (AF-15, AF-17)', () => {
    // The header's promise made mechanical: `sourced: false` marks a colour
    // this project added for recognition, and no surface may present one as
    // the team's own. A surface that names accents has to tell them apart,
    // and this is the split it has to use.
    const failing = []
    for (const l of LIVERIES) {
      const { sourced, chosen } = accentsBySource(l.scheme)
      const where = `${l.constructor} ${l.from}`
      if (sourced.length + chosen.length !== l.scheme.length - 1) failing.push(`${where}: an accent was dropped`)
      for (const c of sourced) if (!c.sourced) failing.push(`${where}: ${c.name} is unsourced and was called sourced`)
      for (const c of chosen) if (c.sourced) failing.push(`${where}: ${c.name} is sourced and was called this site's`)
      // The primary is never an accent: it is the colour the scheme is named
      // after and the one `claim` speaks for.
      for (const c of [...sourced, ...chosen])
        if (c === l.scheme[0]) failing.push(`${where}: the primary was listed as an accent`)
    }
    assert.deepEqual(failing, [])
    // It is not vacuously true: at least one entry has a colour this project
    // chose, or the check below has nothing to be about.
    assert.ok(
      LIVERIES.some((l) => accentsBySource(l.scheme).chosen.length > 0),
      'no livery has an unsourced accent, so nothing exercises the split',
    )
  })

  it('the one surface that names accents reads the split, and nothing else slices a scheme (AF-17)', () => {
    // AF-17 was the first surface ever to print an accent name, and its first
    // draft printed a colour this project chose under a sentence saying the
    // sources describe it. The bypass is slicing the scheme directly, so this
    // refuses that outside liveries.js itself.
    const band = read(join(web, 'src', 'components', 'LiveryScheme.jsx'))
    assert.ok(/accentsBySource/.test(band), 'LiveryScheme no longer reads accentsBySource')
    assert.ok(
      /no page cited here states/.test(band),
      'LiveryScheme names a colour this site chose without the clause saying so',
    )
    // Both ways round: slicing the scheme, and liveryAccents(), which returns
    // the same list unsplit. It is the right export for a test reading the
    // raw data - test/units.mjs does - and the wrong one for a surface that
    // prints names, because it hands back the sourced and the chosen alike.
    const slicers = sourceFiles(join(web, 'src'), /\.jsx?$/)
      .filter((file) => rel(file) !== 'src/lib/liveries.js')
      .filter((file) => /\.scheme\.slice\(|\bliveryAccents\(/.test(read(file)))
      .map(rel)
    assert.deepEqual(slicers, [], 'a surface takes a scheme apart itself instead of going through accentsBySource')
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

  it('the pair a chart series wears still clears 3:1: light on --panel and --panel-sunk, dark on --panel and --panel-raised', () => {
    // AF-16 took the moved pair off the mark and left it here, on the one
    // surface where a colour is told from its neighbour by colour alone.
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

  it('the mark draws the primary unmoved, and its derived edge clears 2:1 on every surface it sits on (AF-16)', () => {
    // What replaced the lightness shift. The fill is now the primary's base,
    // whatever it measures against the panel, because the mark sits beside
    // the name it never replaces. The shape is carried by a ring app.css
    // mixes from the fill and the theme's ink - so it vanishes into a mid
    // colour and outlines one the panel has swallowed. This is the check the
    // fill's 3:1 became: the same mix, measured against the same four
    // surfaces, at the floor a hairline needs to be seen at all.
    const app = read(join(web, 'src', 'styles', 'app.css'))
    const rule = app.slice(app.indexOf('\n.livery {'), app.indexOf('\n.livery-none {'))
    assert.ok(rule.length > 0, '.livery rule not found in app.css')
    assert.ok(
      /background:\s*var\(--livery,/.test(rule),
      '.livery no longer paints --livery: the mark must draw the colour it is given',
    )
    assert.ok(
      !/--livery:\s*var\(--livery-light\)/.test(rule),
      '.livery maps --livery to the moved pair again: AF-16 is that the mark draws the colour itself',
    )
    // The mix takes var(--livery) with NO fallback on purpose: with no colour
    // there is nothing to mix, --livery-edge is invalid and box-shadow falls
    // back to none, so the register's placeholder grey is not ringed.
    const mix = rule.match(/--livery-edge:\s*color-mix\(in srgb, var\(--livery\)\s*(\d+)%, var\(--ink\)\);/)
    assert.ok(mix, '.livery carries no --livery-edge mixed from a fallback-free var(--livery) and --ink; a white fill on a white panel would have no shape, or a placeholder would gain one')
    assert.match(rule, /box-shadow:[^;]*var\(--livery-edge\)/, '.livery does not draw --livery-edge')
    const share = Number(mix[1]) / 100
    const blend = (a, b) =>
      `#${[1, 3, 5]
        .map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * share + parseInt(b.slice(i, i + 2), 16) * (1 - share)).toString(16).padStart(2, '0'))
        .join('')}`
    const light = tokens(blocks.light)
    const dark = tokens(blocks.stampedDark)
    // Every surface a mark actually sits on, which is more than the fill's
    // 3:1 used to measure: the constructor page's band is on --bg, and a
    // mark under a calendar round is on --stage.
    const themes = [
      ['light', light.ink, ['bg', 'stage', 'panel', 'panel-sunk'], light],
      ['dark', dark.ink, ['bg', 'stage', 'panel', 'panel-raised'], dark],
    ]
    const failing = []
    for (const l of LIVERIES) {
      // The band rings the primary; a mark rings its lead (AF-45), which is
      // not always the primary.
      for (const base of new Set([l.scheme[0].base, liveryPair(l).lead.base]))
        for (const [theme, ink, surfaces, t] of themes)
          for (const surface of surfaces) {
            const ratio = contrast(blend(base, ink), t[surface])
            if (ratio < 2) failing.push(`${l.constructor} ${l.from} ${theme} edge of ${base} on --${surface}: ${ratio.toFixed(2)}:1`)
          }
    }
    assert.deepEqual(failing, [])
  })

  it('a mark is given the primary unmoved, and only a chart surface is given the pair (AF-16, AF-17)', () => {
    // The other half of AF-16, and the half the stylesheet cannot guard: a
    // liveryStyle() that handed back l.light would put the contrast-shifted
    // value on every mark again - papaya as #d66c00 - with the CSS above
    // still passing, because the CSS only says what it does with what it is
    // given.
    //
    // AF-17 added a second property, so this can no longer be an equality
    // against one key. What it asserts instead is the thing AF-16 decided:
    // --livery is the primary's base exactly, and the MOVED value - whichever
    // of the pair is not the lead's base - appears nowhere in what a mark is
    // handed, the gradient's stops included.
    //
    // Against the LEAD's base since AF-57, because that is what the pair
    // renders. The unmoved half now equals the lead, which a mark is
    // supposed to draw and a band may hold in its gradient; the moved half
    // is a value no scheme contains, so finding it on a mark is still
    // exactly the regression AF-16 decided against.
    for (const l of LIVERIES) {
      const where = `${l.constructor} ${l.from}-${l.to}`
      const base = liveryPrimary(l).base
      const leadBase = liveryPair(l).lead.base
      const colour = colourForEntry({ constructorId: l.constructor, country: null, year: l.from, team: l.constructor })
      assert.equal(colour.base, base, `${where}: colourForEntry base`)
      assert.equal(colour.mark['--livery'], colour.pair.lead.base, `${where}: colourForEntry mark does not lead with the pair`)
      for (const [what, style, lead] of [
        ['liveryStyle', liveryStyle(l), base],
        ['colourForEntry style', colour.style, base],
        ['colourForEntry mark', colour.mark, colour.pair.lead.base],
      ]) {
        assert.equal(style['--livery'], lead, `${where}: ${what} does not hand the element its lead's base unmoved`)
        assert.deepEqual(
          Object.keys(style).filter((k) => k !== '--livery' && k !== '--livery-scheme'),
          [],
          `${where}: ${what} carries a property a mark has no rule for`,
        )
        const written = Object.values(style).join(' ')
        for (const moved of [l.light, l.dark])
          if (moved !== leadBase)
            assert.ok(!written.includes(moved), `${where}: ${what} writes the moved ${moved} onto a mark`)
      }
    }
    // Nobody outside the chart surfaces writes the pair onto an element at
    // all. own.js is the third: it is where VD-34 put the single-series
    // colour, and the pair is exactly what a chart owes 3:1 on.
    const writers = [...sourceFiles(join(web, 'src'), /\.jsx?$/), join(web, 'scripts', 'prerender.js')]
      .filter((file) => /--livery-(?:light|dark)\s*['"]?\s*:/.test(read(file)))
      .map(rel)
      .sort()
    assert.deepEqual(
      writers,
      ['src/charts/Figure.jsx', 'src/charts/LineChart.jsx', 'src/charts/own.js'],
      'the moved pair is written outside the chart surfaces that owe 3:1',
    )
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

  it('no page carries a livery hex of its own: every colour reaches an element through lib/liveries.js', () => {
    const offenders = sourceFiles(join(web, 'src'), /\.jsx?$/)
      .filter((file) => !/lib\/liveries\.js$/.test(file))
      .filter((file) => /--livery(?:-(?:light|dark))?['"]?\s*:\s*['"]#[0-9a-f]{6}/i.test(read(file)))
      .map(rel)
    assert.deepEqual(offenders, [])
  })
})

describe('a chart series clears 3:1 on the surface figures draw on (AX-07)', () => {
  // The light green was reference-palette slot 3 as published, #1baf7a, at
  // 2.82:1 on --panel, and charts/palette.js called every figure's data
  // table its relief. The table gets a reader the value; it does not make
  // the line perceivable, which is what 1.4.11 asks. figure.figure paints
  // --panel, so that is the surface measured here, for all three slots in
  // both themes. The first figure.figure rule in app.css is read rather than
  // assumed; a later override, a .figure-body background or a backdrop
  // <rect> in a chart would move the marks without failing this, so the
  // check pins the declared surface and no more.
  const css = read(join(web, 'src', 'styles', 'tokens.css'))
  const app = read(join(web, 'src', 'styles', 'app.css'))
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
  const series = (block) => [1, 2, 3].map((i) => tokens(block)[`series-${i}`])

  it('the figure draws on --panel', () => {
    const rule = app.match(/figure\.figure \{[^}]*\}/)
    assert.ok(rule, 'app.css has no figure.figure rule')
    assert.match(rule[0], /background:\s*var\(--panel\)/, rule[0])
  })

  it('all three slots are defined in every block, and the two dark blocks agree', () => {
    for (const [label, block] of Object.entries(blocks)) {
      assert.ok(series(block).every((hex) => hex), `${label} block: ${JSON.stringify(series(block))}`)
    }
    assert.deepEqual(series(blocks.osDark), series(blocks.stampedDark))
  })

  for (const [label, block] of [['light', blocks.light], ['dark', blocks.stampedDark]]) {
    it(`${label}: every series clears 3:1 on --panel`, () => {
      const t = tokens(block)
      // an unmatched --panel (three-digit hex, uppercase, color-mix()) would
      // make luminance() throw on undefined - a failure, but a cryptic one
      assert.ok(t.panel, `${label} block has no six-digit --panel`)
      const failing = series(block)
        .map((hex, i) => [`--series-${i + 1}`, hex, contrast(hex, t.panel)])
        .filter(([, , ratio]) => ratio < 3)
        .map(([name, hex, ratio]) => `${name} ${hex} on --panel: ${ratio.toFixed(2)}:1`)
      assert.deepEqual(failing, [])
    })
  }
})

describe('the button carries a foreground that clears 4.5:1 on its own fill (AX-06)', () => {
  // The rule said `color: #fff` against `background: var(--accent)`. In
  // light that is 5.9:1; in dark the accent is #ff4757 and it was 3.34:1,
  // under the 4.5:1 that 1.4.3 asks of 13.5px semibold text - on the one
  // button the SQL console has, and on Boot's retry. The fix is a token, so
  // the check is that the declarations stay tokens and that every
  // fill/foreground pair still measures: a later theme that lightens
  // --accent, or a hand-written hex creeping back into any of these rules,
  // fails here rather than on the page. The secondary variant is measured
  // too - it is the same kind of pair, and a theme change could break it
  // just as quietly.
  const css = read(join(web, 'src', 'styles', 'tokens.css'))
  const app = read(join(web, 'src', 'styles', 'app.css'))
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
  // The caller passes the pattern, already escaped: an escape helper here
  // would be one more thing to get right, and a wrong one reads like a
  // guard while matching nothing. Each pattern anchors the selector to the
  // start of a line, so `.button` is the base rule and not the
  // `.boot-strip .button` override that only resizes it. Comments come out
  // of the body, because this rule's comment names the #fff it replaced.
  const rule = (pattern, label) => {
    const found = app.match(pattern)
    assert.ok(found, `app.css has no ${label} rule`)
    return found[1].replace(/\/\*[\s\S]*?\*\//g, '')
  }
  const varOf = (body, property, label) => {
    const found = body.match(new RegExp(`(?:^|;|\\n)\\s*${property}:\\s*var\\((--[a-z0-9-]+)\\)`))
    assert.ok(found, `${label}: ${property} is not a var() reference in "${body.trim()}"`)
    return found[1].slice(2)
  }

  const rules = {
    '.button': rule(/\n\.button \{([^}]*)\}/, '.button'),
    '.button:hover': rule(/\n\.button:hover \{([^}]*)\}/, '.button:hover'),
    '.button.secondary': rule(/\n\.button\.secondary \{([^}]*)\}/, '.button.secondary'),
    '.button.secondary:hover': rule(/\n\.button\.secondary:hover \{([^}]*)\}/, '.button.secondary:hover'),
    'a.button:hover': rule(/\na\.button:hover \{([^}]*)\}/, 'a.button:hover'),
    'a.button.secondary:hover': rule(/\na\.button\.secondary:hover \{([^}]*)\}/, 'a.button.secondary:hover'),
  }
  // [label, the rule the fill comes from, the rule the foreground comes
  // from] - :hover on the primary restates only the background, so its
  // foreground is still the base rule's.
  const pairs = [
    ['.button', '.button', '.button'],
    ['.button:hover', '.button:hover', '.button'],
    ['.button.secondary', '.button.secondary', '.button.secondary'],
    ['.button.secondary:hover', '.button.secondary:hover', '.button.secondary:hover'],
  ]

  it('no button rule declares a colour of its own: the defect was a literal #fff', () => {
    const offenders = Object.entries(rules)
      .filter(([, body]) => /#[0-9a-f]{3,8}\b/i.test(body))
      .map(([label, body]) => `${label}: ${body.trim()}`)
    assert.deepEqual(offenders, [])
  })

  it('the anchor variants restate the foreground of the rule they shadow, never a second one', () => {
    assert.equal(varOf(rules['a.button:hover'], 'color', 'a.button:hover'), varOf(rules['.button'], 'color', '.button'))
    assert.equal(
      varOf(rules['a.button.secondary:hover'], 'color', 'a.button.secondary:hover'),
      varOf(rules['.button.secondary:hover'], 'color', '.button.secondary:hover'),
    )
  })

  it('the two dark blocks declare the same fills and foregrounds', () => {
    const [a, b] = [tokens(blocks.osDark), tokens(blocks.stampedDark)]
    const names = new Set(pairs.flatMap(([label, fill, fg]) => [varOf(rules[fill], 'background', label), varOf(rules[fg], 'color', label)]))
    assert.ok(names.size > 0)
    for (const name of names) assert.equal(a[name], b[name], name)
  })

  for (const [label, block] of [['light', blocks.light], ['dark', blocks.stampedDark]]) {
    it(`${label}: every button state's foreground clears 4.5:1 on its own fill`, () => {
      const t = tokens(block)
      const failing = pairs
        .map(([state, fillRule, fgRule]) => {
          const fill = varOf(rules[fillRule], 'background', state)
          const fg = varOf(rules[fgRule], 'color', state)
          // an unmatched token would make luminance() throw on undefined -
          // a failure, but a cryptic one
          assert.ok(t[fill], `${label} block has no six-digit --${fill}`)
          assert.ok(t[fg], `${label} block has no six-digit --${fg}`)
          return [state, fg, fill, contrast(t[fg], t[fill])]
        })
        .filter(([, , , ratio]) => ratio < 4.5)
        .map(([state, fg, fill, ratio]) => `${state}: --${fg} on --${fill}: ${ratio.toFixed(2)}:1`)
      assert.deepEqual(failing, [])
    })
  }
})


describe('a column declaring collapse: true is drawn by nobody (VD-29)', () => {
  /*
   * `collapse: true` in web/src/queries/* says the cell is its text, so the
   * column may be dropped and stated once above the table. A page that gives
   * that column a `render` - a link that differs row by row, a livery mark, a
   * tag - makes the claim false, and the first version of this rule shipped
   * exactly that: a nine-column static table under the app's ten on 32 driver
   * pages, because the app protected its renders and the static half did not.
   *
   * The static half's own answer is a build failure: fromColumns() in
   * scripts/prerender.js refuses a declared column that appears in its `links`
   * map, on the page where it happens. This is the app's half, read from the
   * source because a page is JSX and cannot be imported here.
   */
  const declared = sourceFiles(join(web, 'src', 'queries'), /\.js$/).flatMap((file) =>
    [...read(file).matchAll(/key:\s*'([^']+)'[^}]*collapse:\s*true/g)].map((m) => [m[1], rel(file)]),
  )

  it('the repository declares the columns this rule expects', () => {
    assert.deepEqual(
      [...new Set(declared.map(([key]) => key))].sort(),
      ['as_of', 'fastest_laps', 'layout_key', 'podiums', 'poles', 'source', 'wins'],
    )
    // Ten declarations of those seven keys: a driver's season table and a
    // constructor's each declare wins, podiums and poles.
    assert.equal(declared.length, 10, declared.map(([key, file]) => `${file}: ${key}`).join(', '))
  })

  // The override maps are written as `<key>: { ... }`; this reads the block
  // that follows each one, so a `render` anywhere inside it is found wherever
  // the map happens to live.
  const blockAfter = (source, at) => {
    const open = source.indexOf('{', at)
    if (open < 0) return ''
    let depth = 0
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1
      else if (source[i] === '}') {
        depth -= 1
        if (depth === 0) return source.slice(open, i + 1)
      }
    }
    return source.slice(open)
  }

  it('no page gives one of them a render', () => {
    const drawn = []
    for (const file of sourceFiles(join(web, 'src', 'pages'), /\.jsx$/)) {
      const source = read(file)
      for (const [key] of declared) {
        for (const match of source.matchAll(new RegExp(`\\b${key}:\\s*\\{`, 'g'))) {
          if (/\brender\b/.test(blockAfter(source, match.index))) drawn.push(`${rel(file)}: ${key}`)
        }
      }
    }
    assert.deepEqual(drawn, [])
  })
})

/*
 * SD-25. `refresh.yml` rewrites one line of src/lib/refresh.js with sed every
 * morning and asserts the rewrite with grep, so a red run is the failure mode
 * if the line ever changes shape. That is a failure a day later, in a job
 * nobody is watching, on the one signal that exists to be watched.
 *
 * So the coupling is checked here instead, and from the workflow rather than
 * from a copy of it: the sed expression and the grep pattern are read out of
 * refresh.yml and run against the real file. Rename the constant, requote it,
 * wrap the line, or edit either pattern alone, and this fails on the pull
 * request that did it.
 */
describe('the workflow can still stamp the check date it publishes (SD-25)', () => {
  const workflow = read(join(web, '..', '.github', 'workflows', 'refresh.yml'))
  const stampedFile = workflow.match(/^\s*file=(\S+)$/m)

  it('names the file it stamps', () => {
    assert.ok(stampedFile, 'refresh.yml no longer sets `file=` in the stamping step')
    assert.equal(stampedFile[1], 'web/src/lib/refresh.js')
  })

  const sed = workflow.match(/sed -i "s\/(.+?)\/(.+?)\/" "\$file"/)
  const grep = workflow.match(/grep -q "(.+?)" "\$file"/)
  const today = '2099-12-31'

  it('still has a sed expression and a grep assertion for it', () => {
    assert.ok(sed, 'refresh.yml no longer seds $file')
    assert.ok(grep, 'refresh.yml no longer greps $file for the result')
  })

  it('and the sed expression matches exactly one line of the file', () => {
    const source = read(join(web, 'src', 'lib', 'refresh.js'))
    const matched = source.split('\n').filter((line) => new RegExp(sed[1]).test(line))
    assert.equal(matched.length, 1, `matched ${matched.length} lines, not 1`)
  })

  it('and the grep assertion passes on what the sed expression produces', () => {
    const source = read(join(web, 'src', 'lib', 'refresh.js'))
    const stamped = source.replace(new RegExp(sed[1], 'm'), sed[2].replace('${today}', today))
    const pattern = new RegExp(grep[1].replace('${today}', today), 'm')
    assert.ok(pattern.test(stamped), 'the grep pattern would not match the stamped file')
  })

  /*
   * The patterns above prove the stamp can still be WRITTEN. These prove it
   * would still be RUN and COMMITTED: an `if:` added to the stamping step, or
   * the guard dropped from the committing one, silently removes the whole
   * heartbeat - the first by skipping the no-change morning that is the only
   * one it exists for, the second by committing on a path that already
   * commits.
   */
  const step = (name) => {
    const all = workflow.split(/\n(?=      - )/)
    return all.find((s) => s.includes(`- name: ${name}`))
  }

  it('stamps on every morning, changed or not', () => {
    const stamp = step('Stamp the check')
    assert.ok(stamp, 'refresh.yml no longer has a "Stamp the check" step')
    assert.doesNotMatch(
      stamp,
      /^\s+if:/m,
      'the stamping step is now conditional, so a no-change morning stamps nothing',
    )
  })

  it('and commits it only on the path that would otherwise commit nothing', () => {
    const commit = step('Commit the check')
    assert.ok(commit, 'refresh.yml no longer has a "Commit the check" step')
    assert.match(commit, /^\s+if: steps\.diff\.outputs\.changed == 'false'$/m)
  })

  it('and what is committed today is an ISO day, not a placeholder', () => {
    assert.match(LAST_CHECKED, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(!Number.isNaN(Date.parse(`${LAST_CHECKED}T00:00:00Z`)), `${LAST_CHECKED} is not a date`)
  })
})

/*
 * The measurement tags, and the promise they cost (PD-0, #261).
 *
 * The site counts arrivals with a Cloudflare Web Analytics beacon that
 * prerender.js writes into every page, and it does that against a footer whose
 * whole purpose is to say where the reading happens.
 *
 * THE FIRST VERSION OF THIS BLOCK DID NOT CHECK WHAT IT SAID IT DID.
 *     Its beacon test was `assert.match(prerender, /spa:\s*false/)` - a grep
 *     over the whole of prerender.js, which that file's own status line
 *     `beacon on - token …, spa:false` satisfied by itself. Deleting the
 *     entire `data-cf-beacon` expression left it passing. The one assertion
 *     whose job is to stop the beacon becoming a running account of a reader's
 *     browsing was answered by a log string (review finding, 2026-09-22).
 *
 *     A grep over a script is all a test can do to a script. The tags moved to
 *     scripts/measurement.js so that this file can call the function and read
 *     the markup it really returns, with the inputs it will really be given.
 *
 * The other rule here is the host list, and it is drawn the way the rest of
 * this file draws one: every address in the front end is classified, with a
 * reason, and a new one fails until somebody writes it down. Its first version
 * looked only at hosts beginning `fonts.` or `static.`, which let it call
 * itself a third-party rule while skipping commons.wikimedia.org - the
 * browser's largest third-party fetch on this site, on hundreds of pages (the
 * same review). A rule that names a property it does not have is worse than no
 * rule, because it is cited.
 */
describe('what the pages send, and to whom (PD-0)', () => {
  const prerender = read(join(web, 'scripts', 'prerender.js'))
  const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
  const VERIFICATION = 'abcdefghijklmnopqrstuvwxyz0123456789_-ABCD'

  /*
   * Every host the front end names, and what it is.
   *
   * `load` - the browser is told to fetch it, so it learns the reader's IP,
   * the referrer and what was wanted. These are the ones IN_THIS_TAB has to
   * account for, and the list is deliberately short enough to read.
   *
   * `cite` - an address the site prints, links or stores as a source. A reader
   * who clicks one has chosen to; nothing is fetched by rendering the page.
   *
   * A host that appears in neither list fails, whichever kind it is. Adding a
   * livery source or a new document link therefore costs one line here, which
   * is the price of the load list being trustworthy.
   */
  const HOSTS = {
    // load
    'fonts.googleapis.com': ['load', 'the stylesheet for Saira and JetBrains Mono, non-blocking in index.html'],
    'fonts.gstatic.com': ['load', 'the font files that stylesheet names'],
    'static.cloudflareinsights.com': ['load', 'the Web Analytics beacon, one count per arrival (PD-0)'],
    // Special:FilePath redirects to upload.wikimedia.org, which is therefore
    // fetched too and never appears in this source. One entry, one decision.
    'commons.wikimedia.org': ['load', 'the photographs, via thumbUrl() in src/lib/commons.js'],
    // cite
    'en.wikipedia.org': ['cite', 'the source behind a prose field or a register row'],
    'www.formula1.com': ['cite', 'the official record a figure is checked against'],
    'www.openstreetmap.org': ['cite', 'the ODbL attribution the centrelines carry'],
    'schema.org': ['cite', 'the JSON-LD vocabulary, a namespace and not a fetch'],
    'www.w3.org': ['cite', 'an XML namespace, likewise'],
    'www.sitemaps.org': ['cite', 'the sitemap namespace, likewise'],
    'creativecommons.org': ['cite', 'the licence a row or a photograph is offered under'],
    'opendatacommons.org': ['cite', 'the ODbL text'],
    'github.com': ['cite', 'the repository, the issue tracker and the releases'],
    'lapledger.org': ['cite', 'this site, in canonical URLs and the default origin'],
    'www.williamsf1.com': ['cite', 'a livery source (AF-15)'],
    'www.redbullracing.com': ['cite', 'a livery source (AF-15)'],
    'www.redbull.com': ['cite', 'a livery source (AF-15)'],
    'www.mclaren.com': ['cite', 'a livery source (AF-15)'],
    'www.astonmartinf1.com': ['cite', 'a livery source (AF-15)'],
    'www.mercedesamgf1.com': ['cite', 'a livery source (AF-15)'],
    'www.ferrari.com': ['cite', 'a livery source (AF-15)'],
    'www.haasf1team.com': ['cite', 'a livery source (AF-15)'],
    'www.visacashapprb.com': ['cite', 'a livery source (AF-15)'],
    'www.cadillacf1team.com': ['cite', 'a livery source (AF-15)'],
    'www.audi-mediacenter.com': ['cite', 'a livery source (AF-15)'],
    'media.alpinecars.com': ['cite', 'a livery source (AF-15)'],
  }

  const hostsInFrontEnd = () => {
    const files = [join(web, 'index.html'), ...sourceFiles(join(web, 'src')), ...sourceFiles(join(web, 'scripts'))]
    const found = new Map()
    for (const file of files) {
      for (const [, host] of read(file).matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
        if (!found.has(host)) found.set(host, rel(file))
      }
    }
    return found
  }

  it('every address the front end names is classified, load or cite', () => {
    const undeclared = []
    for (const [host, where] of hostsInFrontEnd()) {
      if (!(host in HOSTS)) undeclared.push(`${host} (first seen in ${where})`)
    }
    assert.deepEqual(
      undeclared,
      [],
      `undeclared host(s):\n  ${undeclared.join('\n  ')}\nAdd each to HOSTS in this file as 'load' (the browser fetches it) or 'cite' (the site only prints it), with the reason.`,
    )
  })

  it('and the hosts the browser actually fetches from are these four and no others', () => {
    // Spelled out rather than derived, so that reclassifying a host from cite
    // to load is a visible edit in two places and not a quiet one in a table.
    assert.deepEqual(
      Object.entries(HOSTS)
        .filter(([, [use]]) => use === 'load')
        .map(([host]) => host)
        .sort(),
      ['commons.wikimedia.org', 'fonts.googleapis.com', 'fonts.gstatic.com', 'static.cloudflareinsights.com'],
    )
  })

  it('the tag the build will write carries "spa":false, so one arrival is one count', () => {
    const [tag] = measurement({ CF_BEACON_TOKEN: TOKEN }).tags
    // Against the markup, not against the source that produces it: the whole
    // point of the module.
    assert.match(tag, /^<script type="module" src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js" /)
    assert.match(tag, /data-cf-beacon='\{"token":"[A-Za-z0-9]+","spa":false\}'><\/script>$/)
  })

  it('and the footer names what that buys: a count of the page arrived on', () => {
    assert.match(IN_THIS_TAB, /cookieless count of each page you open/)
    // And, since #580, the half that sentence alone does not carry: the
    // address is the reader's own text on a searched register or the console.
    assert.match(
      IN_THIS_TAB,
      /kept in the address, so opening or reloading one of those counts it/,
      'the footer no longer says that a search, a filter or a statement is in the address the beacon counts',
    )
  })

  it('the footer claims only what the page leaves true', () => {
    assert.doesNotMatch(
      IN_THIS_TAB,
      /[Nn]othing you look at/,
      'the footer promises that nothing you look at is sent, and the beacon sends the page you opened',
    )
    // The clause this replaced. commons.wikimedia.org is fetched on a route
    // change to any page with photographs, so the absolute is not available.
    assert.doesNotMatch(
      IN_THIS_TAB,
      /asks the network for nothing/,
      'the footer says a route change fetches nothing, and a photograph is fetched from Wikimedia',
    )
    assert.match(IN_THIS_TAB, /Wikimedia Commons/, 'the footer does not name the photographs as something that leaves')
  })

  it('neither token is written into the source; both come from the environment', () => {
    assert.match(prerender, /measurement\(process\.env, esc\)/, 'prerender.js no longer reads the environment')
    assert.doesNotMatch(
      read(join(web, 'scripts', 'measurement.js')),
      /"token"\s*:\s*"[A-Za-z0-9]{8,}"/,
      'a literal Web Analytics token is written into measurement.js',
    )
    assert.doesNotMatch(
      prerender,
      /google-site-verification"\s+content="[A-Za-z0-9_-]{20,}"/,
      'a literal Search Console verification string is written into prerender.js',
    )
  })

  it('an unset environment writes no tag at all, and a malformed one writes no tag and says why', () => {
    assert.deepEqual(measurement({}).tags, [])
    for (const bad of ['abc', `abc'><script>`, 'x'.repeat(65)]) {
      const { tags, status } = measurement({ CF_BEACON_TOKEN: bad })
      assert.deepEqual(tags, [], `a token of ${JSON.stringify(bad)} produced a tag`)
      assert.match(status[0], /^beacon\s+OFF — /)
    }
    const { tags } = measurement({ GOOGLE_SITE_VERIFICATION: 'short' })
    assert.deepEqual(tags, [])
  })

  it('and both cases are readable without a deploy log [D-10]', () => {
    assert.match(prerender, /build-status\.txt/, 'prerender.js no longer reports what it wrote for measurement')
    assert.equal(measurement({}).status.length, 2)
    assert.equal(measurement({ CF_BEACON_TOKEN: TOKEN, GOOGLE_SITE_VERIFICATION: VERIFICATION }).status.length, 2)
  })

  /*
   * Every claim the front end publishes about what is not sent, and why it is
   * true.
   *
   * The two tests above pin IN_THIS_TAB, which is the sentence PD-0 rewrote
   * when the beacon went in. It was not the only claim, and the first version
   * of this test — which looked for the word "nothing" in two directories —
   * was not the whole sweep either. What the review of #580 established is
   * why: the beacon records `document.location.href` at execution, and this
   * site puts reader input in the address. `Sql.jsx` writes the typed
   * statement to `?q=`, and `urlstate.js` writes a register's search, filters
   * and sort there too (IA-08). So an arrival at one of those addresses — a
   * reload, a bookmark, a restored session, a shared link — sends what the
   * reader typed to Cloudflare. "Nothing you type is sent anywhere" was false
   * on the one page it was written for.
   *
   * The claims below are therefore about the moment, not the lifetime: what
   * you type is not sent *as you type it*, which is true and stays true, and
   * the footer names the address separately. Every match has to be declared
   * with the reason it is true, so the next rewrite of the prose argues its
   * case here rather than passing a pattern.
   */
  const SCOPED = [
    [
      'src/lib/site.js',
      /nothing you search for, sort or type is sent as you do it/,
      'the footer: true of the moment, and the sentence after it names the address',
    ],
    ['src/queries/home.js', /nothing you search for is sent as you type it/, "home's standfirst: the same claim, narrower"],
    [
      'scripts/prerender.js',
      /Nothing you type is sent as you write it; the statement is kept in the address/,
      'the console: the denial and its limit in one sentence',
    ],
    [
      'README.md',
      /Nothing you query leaves the tab as you type it; the statement is kept in/,
      'web/README.md, the same claim for a reader of the source',
    ],
    [
      'src/queries/sources.js',
      /No pixels are stored/,
      'about the photographs, not the reader: commons.js stores a reference (AF-07)',
    ],
    ['README.md', /never sent to a server/, 'web/README.md on fragments, the history of the hash router, and true of them'],
    ['../README.md', /No image is stored/, 'the project README on article_images, the same as sources.js'],
    [
      '../docs/MEASUREMENT.md',
      /nothing you search for, sort or type is sent \*\*as you do it\*\*/,
      'the account of the footer, quoting it',
    ],
    ['../docs/MEASUREMENT.md', /typing alone sends nothing/, 'true: "spa": false, so no beacon fires on a keystroke'],
    [
      '../docs/MEASUREMENT.md',
      /[Nn]othing you look at or type is sent\s*anywhere/,
      'the wording this replaced, quoted as history and marked as such',
    ],
    [
      '../docs/MEASUREMENT.md',
      /moving between pages asks the network for nothing/,
      'likewise: the first attempt, quoted to say why it was wrong',
    ],
  ]

  it('every published claim about what is not sent says why it is true', () => {
    const files = [
      ...sourceFiles(join(web, 'src'), /\.jsx?$/),
      ...sourceFiles(join(web, 'scripts'), /\.m?js$/),
      join(web, 'index.html'),
      join(web, 'README.md'),
      // The documents make the same claims in the same present tense, and are
      // read by anyone the site sends there. MEASUREMENT.md carried the
      // retracted absolute for a day because nothing looked here (#580).
      join(web, '..', 'README.md'),
      join(web, '..', 'docs', 'MEASUREMENT.md'),
    ]
    const undeclared = []
    for (const file of files) {
      // Comments quote the claims these replaced, deliberately and at length;
      // they are the record of why, not something a reader is told. Markdown
      // and HTML are read whole.
      const prose = /\.(jsx?|mjs)$/.test(file)
        ? read(file)
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '')
        : read(file)
      // No terminal full stop required, and "never"/"no" as well as "nothing":
      // the review got `Nothing is stored or tracked`, `Your query is never
      // sent anywhere.` and the no-period form of the removed sentence past
      // the first version of this.
      for (const [claim] of prose.matchAll(
        /\b(?:nothing|never|no)\b[^.<>{}]{0,90}?\b(?:sent|leaves?|stored|tracked|kept)\b[^.]{0,90}/gi,
      )) {
        // A published sentence is often written across a `' + '` join; the
        // reader sees one sentence, so the test reads one too.
        const flat = claim
          .replace(/['"]\s*\+\s*['"]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        // Declared per file, not per pattern: a reason that is true of
        // `sources.js` is not a licence to write the same words anywhere
        // else, which a pattern-only allowlist would have granted (review
        // finding, #580).
        // Exact, not endsWith: `README.md` is a suffix of `../README.md`, so
        // the first version of this binding let a web/README.md declaration
        // license those words in the project README (review finding, #580).
        const declared = SCOPED.some(([where, pattern]) => rel(file) === where && pattern.test(flat))
        if (!declared) undeclared.push(`${rel(file)}: ${flat}`)
      }
    }
    assert.deepEqual(
      undeclared,
      [],
      `undeclared claim(s) about what is not sent:\n  ${undeclared.join('\n  ')}\n` +
        'Say when it is true — as you type, as you read — and add it to SCOPED with that reason.',
    )
  })
})
