/**
 * How the palette matches and ranks.
 *
 * Pure, so the unit tests can hold the rules to cases: "hamilton" offers Sir
 * Lewis before Duncan, "raikkonen" finds Räikkönen and "Räikkönen" finds
 * Raikkonen, "monaco 1996" finds the 1996 Monaco Grand Prix. The interaction
 * critique found the previous rule put the wrong driver first for 11 of the
 * 25 winningest drivers, because the only tie-break was label length; it
 * matched accents only one way, depending on which spelling the register
 * happened to hold; and it required the reader's words in the label's order.
 *
 * The information-architecture critique then found six of ten realistic
 * searches returned nothing (IA-20): every word had to sit in one entity's
 * label, so "ferrari 2026" and "hamilton 2008" - a name and a year the page
 * for that name covers - could never match, one wrong letter was a flat
 * refusal, and "mp4-4" missed the McLaren MP4/4 on a slash. What follows
 * still asks for every word, and says where else a word may be found.
 */

/**
 * Lower-case, and strip diacritics both from the label and from what was typed.
 *
 * NFD takes care of the marks - Räikkönen, Pérez, Hülkenberg - but a letter
 * that is its own letter has no mark to strip: ø, ł, ß, ð, æ. Tom Belsø was
 * the one driver "belso" could not find, and the review found him.
 */
const LETTERS = { ø: 'o', ł: 'l', ß: 'ss', ð: 'd', æ: 'ae', þ: 'th', đ: 'd', œ: 'oe' }
export const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[øłßðæþđœ]/g, (c) => LETTERS[c])

/**
 * The folded text with everything but letters and digits taken out, so that
 * "mp4-4" and "mp44" find the MP4/4 and "redbull" finds Red Bull: a model
 * number's separator and a team name's space are not what a reader remembers.
 */
export const squash = (s) => fold(s).replace(/[^\p{L}\p{N}]+/gu, '')

const TOKEN = /[\s\-/.,'()·]+/

/**
 * One index row, ready for `rank`: the label as it is matched, and the words
 * beside it that may also answer - the row's `meta` (a driver's nationality,
 * a season's champion, a race's circuit) and its `also`, words a reader might
 * type that are never shown (a Grand Prix's other names, a page's subjects).
 */
export function prepare(row) {
  const needle = fold(row.label)
  let extra = fold(`${row.meta ?? ''} ${row.also ?? ''}`)
  if (needle.includes('grand prix')) extra += ' gp'
  return {
    ...row,
    needle,
    squashed: squash(row.label),
    tokens: needle.split(TOKEN).filter(Boolean),
    extra,
  }
}

/**
 * Words that carry a question's grammar and not its subject. "Who won the
 * 2026 Italian Grand Prix" names a race in its last four words; the first
 * three are in no label, so asking for them as well finds nothing. A word
 * here is dropped unless it is the only kind of word typed.
 */
const GRAMMAR = new Set(
  'a an and at did do does for from has have how in is of on the to was were what when where which who whom won'.split(' '),
)

/**
 * Edits apart, counting a swap of neighbours as one (the optimal string
 * alignment distance), and giving up as soon as `most` is exceeded.
 */
export function distance(a, b, most) {
  if (Math.abs(a.length - b.length) > most) return most + 1
  let before = null
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let low = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      if (before && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1)
      }
      row.push(value)
      if (value < low) low = value
    }
    if (low > most) return most + 1
    before = prev
    prev = row
  }
  return prev[b.length]
}

/**
 * How far a word may be from a label's word and still be taken for it. Words
 * of four letters or fewer are too short to guess at - "hill" is one letter
 * from "hull", "bell" and "hall" - so they must be spelt. Longer words may be
 * one edit out, and eight letters and over two, because the misspellings
 * readers actually type of the longest names are two: "schumaker" is a
 * letter changed and a letter dropped from "schumacher".
 */
export const tolerance = (word) => (word.length <= 4 ? 0 : word.length < 8 ? 1 : 2)

/**
 * How well one word is found in `entry`: 100 at the start of the label, 60 at
 * the start of one of its words, 20 anywhere in it; 90 or 40 once the label's
 * spaces and punctuation are taken out; 10 when it is only in the words
 * beside the label, or is a year inside the span the entry covers; at most
 * 20 as the singular of a plural; 15 within `tolerance` of one of its words
 * when `fuzzy`. 0 is not at all.
 */
function place(entry, word, fuzzy) {
  const at = entry.needle.indexOf(word)
  if (at !== -1) {
    const before = entry.needle[at - 1]
    return at === 0 ? 100 : before === ' ' || before === '-' || before === '/' ? 60 : 20
  }
  const flat = squash(word)
  if (flat.length >= 3 && entry.squashed) {
    const at2 = entry.squashed.indexOf(flat)
    if (at2 !== -1) return at2 === 0 ? 90 : 40
  }
  if (entry.extra?.includes(word)) return 10
  if (/^\d{4}$/.test(word) && entry.from_year) {
    // An end the register leaves empty is a career, a team or a circuit
    // still running - span() in lib/format.js writes it as an open range -
    // so the span runs on from its start.
    const year = Number(word)
    if (year >= entry.from_year && year <= (entry.to_year ?? Number.POSITIVE_INFINITY)) return 10
  }
  // "poles" for "Most pole positions", "championships" for "championship":
  // a plural typed is found as its singular, no better than mid-word.
  if (word.length > 3 && word.endsWith('s')) {
    const singular = place(entry, word.slice(0, -1), false)
    if (singular > 0) return Math.min(singular, 20)
  }
  if (fuzzy) {
    const most = tolerance(word)
    if (most > 0 && (entry.tokens ?? []).some((token) => distance(word, token, most) <= most)) return 15
  }
  return 0
}

/**
 * A rank for `entry` against what was typed, or -1 for no match.
 *
 * Every word typed must be found (grammar words aside - see GRAMMAR). The
 * rank is the class of the WORST-placed word: a result is only as good as
 * its weakest word, so "hamilton 2008" offers Sir Lewis, whose career holds
 * 2008, before the 2008 season, whose label holds the year and whose
 * champion only is Hamilton - and a year that sits in a label by accident
 * cannot lift a name that matched badly. Then prominence, so that among
 * names that match equally the one with the most wins (or races, for a
 * circuit) comes first, and only then the shorter label. `entry.weight` is
 * the prominence figure the index carries.
 *
 * `fuzzy` allows the near spellings `tolerance` describes. The palette asks
 * for it only when nothing matched as typed, so a correct spelling is never
 * crowded by its neighbours.
 */
export function rank(entry, typed, { fuzzy = false } = {}) {
  const all = fold(typed).split(/\s+/).filter(Boolean)
  if (all.length === 0) return -1
  const subject = all.filter((word) => !GRAMMAR.has(word))
  const words = subject.length > 0 ? subject : all
  let worst = 100
  for (const word of words) {
    const cls = place(entry, word, fuzzy)
    if (cls === 0) return -1
    if (cls < worst) worst = cls
  }
  const prominence = Math.min(Number(entry.weight) || 0, 100) / 100
  return worst + prominence - entry.needle.length / 2000
}

/**
 * Where a search that found nothing can go instead (IA-21): the console, with
 * a statement that looks for the same words in every name, and the records.
 * The term goes inside a string literal, so a quote in it is doubled, and
 * into a line comment, so any line break in it is made a space first.
 */
export function elsewhere(typed) {
  const term = String(typed).replace(/\s+/g, ' ').trim()
  const literal = `'%${term.replaceAll("'", "''")}%'`
  const sql = `-- Every name that holds "${term}". LIKE ignores case, not accents.
SELECT 'driver' AS kind, id, full_name AS name FROM drivers WHERE full_name LIKE ${literal}
UNION ALL
SELECT 'constructor', id, name FROM constructors WHERE name LIKE ${literal}
UNION ALL
SELECT 'circuit', id, name FROM circuits WHERE name LIKE ${literal}
UNION ALL
SELECT 'car', id, full_name FROM chassis WHERE full_name LIKE ${literal}
UNION ALL
SELECT 'race', id, year || ' ' || name_used FROM races WHERE name_used LIKE ${literal}`
  return [
    { kind: 'Try', key: 'sql', label: `Look for “${term}” in the SQL console`, meta: '', path: `/data/sql?q=${encodeURIComponent(sql)}` },
    { kind: 'Try', key: 'records', label: 'Browse the records', meta: '', path: '/records' },
  ]
}
