/**
 * The records page: its queries and its tables' columns, read by Records.jsx
 * and by scripts/prerender.js.
 *
 * WHY THIS FILE EXISTS
 *     The static /records table had a Category column the app never shows
 *     (CR-23), sorted its rows by a different key, and said nothing about
 *     the confidence tier the app states once above the table (CR-22). One
 *     query and one column list, here; both renderers read them.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { LABELS } from '../lib/site.js'
import { inWords, longDate, number, percent, span } from '../lib/format.js'
import { OUTLINE_BY, roundShortName } from '../lib/outline.js'

// A race holder is stored by races.id; the page needs year and round to
// link it, so they ride along (NULL for every other holder).
//
// In the order they are derived, which is the order build.py writes them:
// a family's own records in that order, and the families in the order their
// first record comes (WK-08). By category first, as this once was, put every
// constructor's record ahead of the driver's it answers.
export const RECORDS = `
  SELECT rec.*, ra.year AS race_year, ra.round AS race_round
    FROM records rec
    LEFT JOIN races ra ON rec.holder_table = 'races' AND ra.id = CAST(rec.holder_id AS INTEGER)
   ORDER BY rec.id
`

/**
 * One record, by its key, for its own page (PD-27). The key and not the id:
 * `records.id` is a position in a derived list and moves whenever a record
 * is added ahead of it, so it is published as unstable, and `key` is the
 * natural key the identifier policy names instead (DA-26). An address has to
 * be the one that does not move.
 */
export const RECORD = `
  SELECT rec.*, ra.year AS race_year, ra.round AS race_round
    FROM records rec
    LEFT JOIN races ra ON rec.holder_table = 'races' AND ra.id = CAST(rec.holder_id AS INTEGER)
   WHERE rec.key = ?
`

/**
 * A record's own page: the path without its leading slash, as holderPath()
 * gives one. A key that is not a slug would make an address that is not one
 * record, so the prerenderer refuses it rather than writing it (KEY_SHAPE).
 */
export const recordPath = (row) => `records/${row.key}`
export const KEY_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** The derivation's heading, on the page and in the table's column. */
export const DERIVATION = 'How it is derived'

/**
 * Where a record's holder has a page: the path without its leading slash,
 * or null for a holder the page cannot resolve - a shared record names two
 * or more holders and carries no holder_id, and stays text (PD-26). The
 * app prefixes the slash for its router; the prerenderer's link() adds it.
 */
export function holderPath(row) {
  if (!row.holder_id) return null
  switch (row.holder_table) {
    case 'drivers':
      return `drivers/${row.holder_id}`
    case 'constructors':
      return `constructors/${row.holder_id}`
    case 'circuits':
      return `circuits/${row.holder_id}`
    case 'races':
      return row.race_year && row.race_round ? `races/${row.race_year}/${row.race_round}` : null
    default:
      return null
  }
}

export const DRIVER_WINS = `
  SELECT e.driver_id, d.full_name, COUNT(*) AS wins,
         MIN(r.year) AS first_win, MAX(r.year) AS last_win
    FROM race_entries e
    JOIN races r   ON r.id = e.race_id
    JOIN drivers d ON d.id = e.driver_id
   WHERE e.finish_position = 1
   GROUP BY e.driver_id
   ORDER BY wins DESC, d.full_name
   LIMIT 40
`

export const DRIVER_POLES = `
  SELECT e.driver_id, d.full_name, COUNT(*) AS poles
    FROM race_entries e
    JOIN drivers d ON d.id = e.driver_id
   WHERE e.pole = 1
   GROUP BY e.driver_id
   ORDER BY poles DESC, d.full_name
   LIMIT 40
`

// The view orders by wins alone, so teams level on wins came back in
// whatever order SQLite chose; the name settles them, as the drivers' do.
export const CONSTRUCTOR_WINS = `
  SELECT * FROM v_wins_by_constructor ORDER BY wins DESC, name, id LIMIT 40
`

export const TITLES = `SELECT * FROM v_title_count`

export const DECADES = `SELECT * FROM v_wins_by_decade`

export const POLE_TO_WIN = `SELECT * FROM v_pole_to_win ORDER BY year`

export const GRAND_SLAMS = `SELECT * FROM v_grand_slams ORDER BY year DESC, round DESC`

/** The confidence tiers the records carry, in first-seen order. */
export const tiersOf = (records) => [...new Set(records.map((r) => r.confidence))]

/** The one date every record is as of, or null where they differ. */
export const asOfOf = (records) => {
  const dates = [...new Set(records.map((r) => r.as_of))]
  return dates.length === 1 ? dates[0] : null
}

/**
 * The page's grouping (WK-08), read from `records.family` and
 * `records.headline` and from no list here, so a family the build adds is on
 * the page without a line of this file changing.
 *
 * The headline records lead, and every other record is shown once, under its
 * family: the ruling asked for a page that grows more focused as the records
 * list grows to some two hundred, not a longer table. The families come in
 * the order their first record does - the headline ones included, so Wins
 * stays second although its first record is in the headline table - and a
 * family with nothing below the headline has no section at all.
 */
export const HEADLINE = 'Headline records'
export const headlineRecords = (records) => records.filter((r) => r.headline)

/** The in-page address of a family's section: "Pole positions" -> "pole-positions". */
export const familyAnchor = (family) =>
  family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function recordFamilies(records) {
  const families = new Map()
  for (const r of records) {
    if (!families.has(r.family)) families.set(r.family, [])
    if (!r.headline) families.get(r.family).push(r)
  }
  return [...families]
    .filter(([, rows]) => rows.length)
    .map(([family, rows]) => ({ family, anchor: familyAnchor(family), rows }))
}

/** The line that leads from the headline records to the families. */
export const familiesLead = (count) => `The other ${count}, by family:`

/**
 * What a headline record's card carries beside its name, value, holder and
 * derivation (VD-68): the date and the tier, but only where the records
 * differ on them, which is when recordColumns() gives each its own column.
 * Where they agree they are said once above the cards, as above a table.
 */
export const cardExtras = (records) =>
  recordColumns(records).filter((c) => c.key === 'as_of' || c.key === 'confidence')

/*
 * A record card sets its number large (VD-111; docs/design-system.md section
 * 3, *Record card*). The value used to be the whole display string at the
 * tile's figure size, so '18 years, 228 days, 2016 Spanish Grand Prix' wrapped
 * to three lines where '106' took one. Now the card leads with the number the
 * value opens with and sets the rest beside it as a qualifier at the label
 * size; a value that opens with no number keeps the old setting whole.
 */
// A figure as build.py's _num() writes one: '106', '3,723.5', '40.63'. The
// comma is a thousands separator only before three digits, so the '10' of
// '10, 2023 Miami Grand Prix' is not read as '10,'.
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`
const LEADING = new RegExp(`^(${NUM})([\\s,].*)?$`, 's')
const asNumber = (figure) => Number(figure.replace(/,/g, ''))

/**
 * The card's figure and qualifier, or null where the value has no leading
 * number to set apart. `counts` is true where the figure is value_num itself,
 * so its unit names what it counts: '106' is 106 wins, '7 each' 7 titles
 * each. Where it is not - an age, held in days and written in years - the
 * value's own words say what the figure is, and the unit is not borrowed.
 */
// The words a value's rest can open on that leave the figure to its unit:
// '7 each' is 7 titles each, '19 of the 22 races' 19 wins of them.
const OPENERS = /^(?:each|of|in)\b/

export function cardFigure(row) {
  const m = LEADING.exec(row.value ?? '')
  if (!m) return null
  const tail = m[2] ?? ''
  const counts = asNumber(m[1]) === row.value_num
  const rest = tail.replace(/^,?\s*/, '')
  if (counts) {
    // A value that already names its unit ('1,234 points'), or says in its
    // own word what it counts ('6 starters', '0.002 s each'), is not given
    // the unit too; a value whose rest opens on 'each', 'of' or 'in' is, and
    // so is one whose rest follows a comma ('84, with Mercedes'), which is a
    // phrase about the figure rather than a word for it.
    const own = !tail.startsWith(',') && /^[^\W\d_]/u.test(rest) && !OPENERS.test(rest)
    const unit = row.unit && !rest.startsWith(row.unit) && !own ? row.unit : ''
    // '10, 2023 Miami Grand Prix to ...' keeps its comma after the unit.
    const qualifier = !tail ? row.unit ?? '' : !unit ? rest : tail.startsWith(',') ? `${unit}${tail}` : `${unit} ${rest}`
    return { figure: m[1], qualifier, counts }
  }
  return rest ? { figure: m[1], qualifier: rest, counts } : null
}

// A list in the build's prose, item by item: split on its commas, with a
// generational suffix kept on its name - 'Kurt Ahrens, Jr.' is one driver.
const SUFFIX = /^(?:Jr|Sr)\.(?:\s|$)/
function listItems(text) {
  const items = []
  for (const piece of text.split(', ')) {
    if (items.length && SUFFIX.test(piece)) items[items.length - 1] += `, ${piece}`
    else items.push(piece)
  }
  return items
}

// The two forms build.py writes a 'Next:' list in (its _also() and a
// season's 'Name N (year)'). A list in any other form, or one with an item
// that fits neither, gives no comparator rather than a guessed one.
const NEXT_FORMS = [
  [new RegExp(`^(.+) on (${NUM})$`), (m) => ({ label: m[1], figure: m[2] })],
  [new RegExp(`^(.+) (${NUM}) \\((\\d{4})\\)$`), (m) => ({ label: `${m[1]} ${m[3]}`, figure: m[2], season: true })],
]

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The holder's bars where the runners are seasons ('Max Verstappen 15
 * (2022)'), each labelled with its own season as they are: from the
 * derivation's 'Max Verstappen, 2023: 19 of 22', one bar for each season it
 * names a holder in - a shared record held twice by one driver draws both -
 * or, for one holder the derivation does not name so, the one year the value
 * gives ('575, 2023'). Null where a holder's season cannot be found: a bar
 * that compares a driver with seasons is not drawn.
 */
function seasonHolders(row, holders, figure) {
  const before = row.detail.slice(0, row.detail.lastIndexOf('Next: '))
  const bars = []
  for (const holder of holders) {
    let years = [...before.matchAll(new RegExp(`(?:^|[\\s.;:])${escapeRe(holder)}, (\\d{4}):`, 'g'))].map((m) => m[1])
    if (!years.length && holders.length === 1) {
      const inValue = row.value.slice(figure.length).match(/\b\d{4}\b/g) ?? []
      years = inValue.length === 1 ? inValue : []
    }
    if (!years.length) return null
    for (const year of years) bars.push(`${holder} ${year}`)
  }
  return bars
}

/**
 * The rows a record's derivation names after its holder, from the 'Next:'
 * list that closes it: [{ label, figure, value }], or null where there is no
 * list or it does not read as one of NEXT_FORMS throughout.
 */
export function nextList(detail) {
  const at = (detail ?? '').lastIndexOf('Next: ')
  if (at < 0) return null
  const text = detail.slice(at + 'Next: '.length).replace(/\.$/, '')
  // A sentence after the list ('Next: A on 5. B on 3.') would otherwise read
  // as a runner named 'A on 5. B': a full stop after a figure or a bracket
  // ends the list, and the list is then not one the card can read.
  if (/[\d)]\.\s/.test(text)) return null
  const items = listItems(text)
  for (const [form, read] of NEXT_FORMS) {
    const matched = items.map((item) => form.exec(item))
    if (matched.every(Boolean)) {
      return matched.map(read).map((r) => ({ ...r, value: asNumber(r.figure) }))
    }
  }
  return null
}

/** How many bars a card's comparator draws: the holder and the next two. */
export const COMPARED = 3

// The first `limit` rows, and on through every row level with the last one
// kept, as leadersDrawn() and build.py's _through_ties() cut: a figure shared
// at the cut is not shown as one holder's.
function throughTies(rows, limit) {
  const kept = rows.slice(0, limit)
  while (kept.length && kept.length < rows.length && rows[kept.length].value === kept.at(-1).value) kept.push(rows[kept.length])
  return kept
}

const andList = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)
const decimals = (figure) => (figure.split('.')[1] ?? '').length

/**
 * A headline card's comparator (VD-111): the holder's bar and the next two,
 * read from the record's own derivation, with the margin to the next in a
 * line under them. A record is only as large as its gap to the next one.
 *
 * `bars` are [{ label, figure, holder, share }], `share` the bar's length
 * against the longest, 0 to 1. A shared record (no holder_id) draws a bar for
 * each holder, all marked; where the runners are seasons, each holder's bar
 * is its season too (seasonHolders), or there are no bars; past COMPARED the rest are cut as throughTies()
 * cuts, so a tie at the third bar is drawn whole. `margin` says how far clear
 * the holder is of the next, or, for a shared record, who is next on what;
 * null where the two are level. `label` is the bars' accessible name, every
 * figure in it.
 *
 * Null - no bars and no margin - where the figure is not value_num, the
 * derivation names no one after the holder, or no figure is above zero to
 * scale against: the card then carries its figure and holder only, as it did.
 */
export function cardComparator(row) {
  const figure = cardFigure(row)
  if (!figure?.counts) return null
  const next = nextList(row.detail)
  if (!next?.length) return null
  const named = row.holder_id ? [row.holder] : listItems(row.holder)
  const holders = next[0].season ? seasonHolders(row, named, figure.figure) : named
  if (!holders) return null
  const top = holders.map((label) => ({ label, figure: figure.figure, value: row.value_num, holder: true }))
  const bars = [...top, ...throughTies(next, Math.max(0, COMPARED - top.length)).map((r) => ({ ...r, holder: false }))]
  const longest = Math.max(...bars.map((b) => b.value))
  if (!(longest > 0)) return null
  const level = next.filter((r) => r.value === next[0].value)
  const names = andList(level.map((r) => r.label))
  const places = Math.max(decimals(figure.figure), decimals(next[0].figure))
  const gap = Number(Math.abs(row.value_num - next[0].value).toFixed(places))
  const margin = holders.length > 1 ? `Shared; ${names} next on ${next[0].figure}` : gap > 0 ? `${number(gap)} clear of ${names}` : null
  return {
    bars: bars.map(({ label, figure: shown, holder, value }) => ({ label, figure: shown, holder, share: Math.round((value / longest) * 1e4) / 1e4 })),
    margin,
    label: `${row.record}: ${bars.map((b) => `${b.label} ${b.figure}`).join(', ')}`,
  }
}

/**
 * The leaderboards that follow the headline records (VD-68), in both halves.
 *
 * The app draws each as a bar chart of its leading rows with a table of the
 * same numbers under it; the static half has no chart and carries that table
 * open, of the rows the chart draws. They come before the
 * families in both, so the families stand in the same place either side of
 * the handover (WK-08 review): a static page that left them out put
 * /records#wins a screen or more above where the app then drew it.
 */
export const LEADERBOARDS = 'Counted from the race records'
export const CONSTRUCTORS_HEADING = 'Constructors'
export const LEADERS_DRAWN = 15

/**
 * The rows a leaderboard draws: the first LEADERS_DRAWN, and every row level
 * with the last of them on `key`. A cut through a tie keeps some of the teams
 * on nine wins and drops the others, and calls what is left the ones with the
 * most (VD-68 review); a tie at the cut is kept whole instead.
 */
export function leadersDrawn(rows, key) {
  if (rows.length <= LEADERS_DRAWN) return rows
  const last = rows[LEADERS_DRAWN - 1][key]
  let n = LEADERS_DRAWN
  while (n < rows.length && rows[n][key] === last) n += 1
  return rows.slice(0, n)
}

/**
 * A leaderboard's bars with the record's holder marked (VD-94): the bar a
 * page about the record is stating, drawn in the accent on a chart otherwise
 * in ink. Every bar level with the top is marked, so a record two drivers
 * share marks both rather than whichever the sort put first; an empty board
 * marks nothing.
 */
export function markLeaders(bars) {
  const top = Math.max(...bars.map((bar) => bar.value))
  return bars.map((bar) => ({ ...bar, mark: bar.value === top }))
}

// "fifteen" where the cut is clean, the count where a tie has lengthened it.
const howMany = (n) => (n === LEADERS_DRAWN ? 'fifteen' : String(n))

/** What the static half says of a table that is the chart's rows. */
export const leadersDrawnLine = (n) =>
  n > LEADERS_DRAWN
    ? `The ${n} with the most: those level with the fifteenth are all here.`
    : `The ${howMany(n)} with the most.`

export const DRIVER_WINS_FIGURE = {
  title: 'Most Grand Prix wins',
  note: 'One win per driver classified first, so a shared drive counts for both of them.',
  key: 'wins',
  label: (n) => `The ${howMany(n)} drivers with the most Grand Prix wins`,
}
export const DRIVER_POLES_FIGURE = {
  title: 'Most pole positions',
  note: 'The driver the season record credits with pole. Not always the car at grid 1: a penalty or a sprint-set grid can part them, and each race page says so where they differ.',
  key: 'poles',
  label: (n) => `The ${howMany(n)} drivers with the most pole positions`,
}
export const CONSTRUCTOR_WINS_FIGURE = {
  title: 'Most wins by constructor',
  note: 'A win belongs to the car, so a shared drive counts once here and twice in the driver tables.',
  key: 'wins',
  label: (n) => `The ${howMany(n)} constructors with the most Grand Prix wins`,
}

/**
 * The constructors' figure's note in the app, where the bars wear colours:
 * 49 words at the longest, with liveries, national colours and a hollow bar
 * all drawn, under the 50 the figure grammar allows (VD-80). `source` is
 * colourSource()'s clause, or null where no bar is coloured.
 */
export const constructorWinsNote = (source, hollow) =>
  `${CONSTRUCTOR_WINS_FIGURE.note}${
    source ? ` Coloured as of each team’s last win: ${source}.${hollow ? ' A hollow bar has no colour on record.' : ''}` : ''
  }`

const year = (value) => String(value)
export const DRIVER_WINS_COLUMNS = [
  { key: 'full_name', label: 'Driver', rowHeader: true },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'first_win', label: 'First', align: 'num', text: year },
  { key: 'last_win', label: 'Last', align: 'num', text: year },
]
export const DRIVER_POLES_COLUMNS = [
  { key: 'full_name', label: 'Driver', rowHeader: true },
  { key: 'poles', label: 'Poles', align: 'num' },
]
export const CONSTRUCTOR_WINS_COLUMNS = [
  { key: 'name', label: 'Constructor', rowHeader: true },
  { key: 'country', label: 'Country' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'first_win', label: 'First', align: 'num', text: year },
  { key: 'last_win', label: 'Last', align: 'num', text: year },
  { key: 'constructors_titles', label: "Constructors' titles", align: 'num' },
]

/**
 * The records table. Thirty identical badges in a column mean nothing, so
 * the tier is a column only where the rows differ on it; where they all
 * share one it is said once above the table (tierBefore / TIER_AFTER) and
 * not repeated on every row.
 */
export function recordColumns(records) {
  return [
    { key: 'record', rowHeader: true, label: 'Record', cellClass: 'record-name' },
    // SECOND, not third. The pair a reader came for is the record and its
    // figure; the holder answers "whose", which is the next question, not the
    // first. Third, the value was the column behind the horizontal scroll at
    // 400 px - the one thing on the page that should never be (VD-51).
    //
    // "18 years, 228 days, 2016 Spanish Grand Prix": a phrase, not a column of
    // figures, so it stays left-aligned and does not pretend to align as one.
    // Mono lines the leading figures up at the edge the eye starts from, which
    // is as much as a figure-led phrase can honestly claim; `num` would line up
    // the ends of sentences instead. The comparable number is value_num, with
    // its unit, for a query.
    { key: 'value', label: LABELS.value, align: 'prose', cellClass: 'record-value' },
    { key: 'holder', label: LABELS.heldBy, align: 'prose' },
    // The derivation is what CR-22's claim rests on, so it stays in the table
    // and stays legible; it is the footnote to the figure, not its equal, and
    // it was set in the same ink at the same size (VD-51).
    { key: 'detail', label: DERIVATION, align: 'prose', cellClass: 'record-derivation', date: 'text' },
    // Every record is derived in one pass, so the date is the same on all of
    // them until a figure moves (VD-29). It was a collapsing column, said once
    // above the table; with a table per family it would be said eleven times,
    // and not at all under a family of fewer than five, so it is said once for
    // the page (asOfLine) and is a column only where the records differ on it,
    // as the tier is.
    ...(asOfOf(records) === null ? [{ key: 'as_of', label: 'As of', date: 'short' }] : []),
    ...(tiersOf(records).length === 1 ? [] : [{ key: 'confidence', label: 'Confidence' }]),
  ]
}

/** The date, said once, where every record shares it. */
// It follows RECORDS_LEDE, which has just named that race, so it does not
// name it again.
export const asOfLine = (date) => `That race was run on ${date}.`

/**
 * The sentence above the table when every record shares a tier, in two
 * halves around the tier itself: the app sets the tier as a Confidence pill
 * and the static page as a link, so neither can be given the whole string.
 */
export const tierBefore = (count) => `All ${count} carry the `
export const TIER_AFTER = ' tier, so it is not repeated on every row.'

export const TITLE_COLUMNS = [
  { key: 'full_name', rowHeader: true, label: 'Driver' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'titles', label: 'Titles', align: 'num' },
  { key: 'title_years', label: 'Years', align: 'prose' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'poles', label: 'Poles', align: 'num' },
]

/*
 * The four sections after the families, in both renderers (VD-87): the
 * static page stopped at the families. Each heading, note and column list is
 * here once; the app adds the links, the chips and the charts.
 */
export const CHAMPIONS = 'Champions'

export const DECADE_TITLE = 'Who won the decade'
export const decadeCount = (decades) => `${decades.length} decades`
/** The decades on the page, newest first: the chips' options, in the app. */
export const decadeOptions = (rows) => [...new Set(rows.map((d) => d.decade))].sort((a, b) => b - a)
/** The decade the page opens on, and the one a page with no script shows: the latest. */
export const latestDecade = (rows) => String(Math.max(...rows.map((d) => d.decade)))
/** One decade's leaders, as many as the figure draws, in the view's order. */
export const decadeLeaders = (rows, decade) => rows.filter((d) => String(d.decade) === decade).slice(0, 12)
export const decadeFigureTitle = (decade) => `Most wins, the ${decade}s`
export const DECADE_NOTE = 'A decade is the ten seasons whose year begins with it; the 2020s are still running.'
export const DECADE_COLUMNS = [
  { key: 'full_name', label: 'Driver', rowHeader: true },
  { key: 'wins', label: 'Wins', align: 'num' },
]

export const POLE_TO_WIN_TITLE = 'How often pole becomes a win'
export const POLE_TO_WIN_NOTE =
  "The share of races each season won from the front row's first slot. It says as much about how hard a car was to pass as about who was quickest on Saturday."
export const POLE_TO_WIN_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num', rowHeader: true, text: (year) => String(year) },
  { key: 'races', label: 'Races', align: 'num' },
  { key: 'pole_converted', label: 'Won from pole', align: 'num' },
  { key: 'share', label: 'Share', align: 'num' },
]
/** The figure's table rows: each season with its share, the em dash where no race was run. */
export const poleToWinRows = (rows) => rows.map((r) => ({ ...r, share: percent(r.pole_converted, r.races) }))

export const GRAND_SLAMS_TITLE = 'Grand slams'
export const GRAND_SLAM_NOTE = {
  head: 'Pole, win and fastest lap in the same Grand Prix.',
  body: 'The stricter definition also asks for every lap led, which is not checked here — there is no lap-by-lap data for most of these races — so this is the three-part version.',
}

export const GRAND_SLAM_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'gp_name', rowHeader: true, label: 'Grand Prix' },
  { key: 'driver', label: 'Driver' },
  { key: 'constructor', label: 'Constructor' },
]

/** The sentence both renderers open the headline records with; CR-22's claim rests on it. */
export const RECORDS_LEDE =
  'Every record here is derived from the same tables as the leaderboards on every build, as of the last completed race the database holds, and each one says how.'

/**
 * The page's lede, under its h1 in both renderers (VD-79): the app's words,
 * read by pages/Records.jsx and by scripts/prerender.js, where the static page
 * used to open on a sentence of its own and swap it at the handover.
 */
export const RECORDS_STANDFIRST =
  'Who has the most of everything: wins, poles, titles, grand slams, and the decade each of them owned. The records at the top are derived from the same tables as the leaderboards below on every build; the leaderboards are counted from the race records as this page loads.'

/*
 * A record's page is built around its record (VD-112; docs/design-system.md
 * section 4, *Lookup pages*). It opened on a tile strip whose value was the
 * whole stored phrase - '10, 2023 Miami Grand Prix to 2023 Italian Grand
 * Prix' - with the holder in a tile beside it, so nothing on the page made
 * ten in a row look like ten in a row. Now it opens on the number, large,
 * with the words that give it meaning; and a record that is a run of races
 * draws the races and the longest runs there have been, each counted in the
 * page under the record's own rule.
 *
 * Everything here is data for both renderers: pages/Record.jsx draws it and
 * scripts/prerender.js writes the same markup from the same functions.
 */

/**
 * The records whose page draws the runs behind them, by key: a run of
 * consecutive completed championship races, counted as build.py's streak()
 * counts the record - every completed race in date order (date_iso, then
 * year and round), the Indianapolis 500 of 1950-60 among them, a run
 * carrying over a winter and ending at the first race the holder does not
 * meet `where` in, entered or not. `where` is a condition on race_entries
 * `e`, the one streak() is given for the record; `verb` is what the holder
 * did in each race of a run; `rule` is that rule as the page states it under
 * the runs, the words of the approved mockup (P12). A record not named here
 * keeps the lead figure alone.
 */
export const STREAKS = {
  'most-consecutive-wins': {
    where: 'e.finish_position = 1',
    verb: 'won',
    rule: 'A streak carries over a winter and ends at the first race the driver did not win, entered or not; the Indianapolis 500 of 1950–60 counts.',
  },
}

// The runs, one row per maximal run of a driver meeting `where` in
// consecutive completed races: the islands of a driver's race numbers, where
// a race's number less its rank among that driver's races is constant along
// a run. DISTINCT, because a driver can hold two entries at one race, as in
// the early years, and a run is counted in races, as streak()'s set is.
const runsWith = (where) => `
  WITH ordered AS (
    SELECT id, year, round, name_used, date_iso, f1db_layout_id,
           ROW_NUMBER() OVER (ORDER BY date_iso, year, round) AS n
      FROM races
     WHERE status = 'completed'
  ),
  hits AS (
    SELECT DISTINCT e.driver_id AS holder_id, o.n
      FROM race_entries e
      JOIN ordered o ON o.id = e.race_id
     WHERE ${where} AND e.driver_id IS NOT NULL
  ),
  runs AS (
    SELECT holder_id, MIN(n) AS first_n, MAX(n) AS last_n, COUNT(*) AS length
      FROM (SELECT holder_id, n, n - ROW_NUMBER() OVER (PARTITION BY holder_id ORDER BY n) AS island FROM hits)
     GROUP BY holder_id, island
  )`

/**
 * The longest runs, longest first and a tie by the date it began, then the
 * name: enough rows for longestRuns() to cut through a tie at its last.
 * `ongoing` is 1 for a run that reaches the latest completed race.
 */
export const streakRuns = (key) =>
  STREAKS[key]
    ? `${runsWith(STREAKS[key].where)}
  SELECT runs.holder_id, d.full_name AS holder, runs.length, runs.first_n,
         f.year AS from_year, f.name_used AS from_name, f.date_iso AS from_date,
         l.year AS to_year, l.name_used AS to_name, l.date_iso AS to_date,
         runs.last_n = (SELECT MAX(n) FROM ordered) AS ongoing
    FROM runs
    JOIN drivers d ON d.id = runs.holder_id
    JOIN ordered f ON f.n = runs.first_n
    JOIN ordered l ON l.n = runs.last_n
   ORDER BY runs.length DESC, runs.first_n, d.full_name
   LIMIT 40`
    : null

/**
 * Every race of every run as long as the longest, in order, each with its
 * F1DB outline where the race names a layout F1DB draws (NULL otherwise, and
 * the strip keeps the race's place with an empty box).
 */
export const streakRaces = (key) =>
  STREAKS[key]
    ? `${runsWith(STREAKS[key].where)}
  SELECT runs.holder_id, runs.first_n, o.year, o.round, o.name_used, co.path AS outline
    FROM runs
    JOIN ordered o ON o.n BETWEEN runs.first_n AND runs.last_n
    LEFT JOIN circuit_outlines co ON co.f1db_layout_id = o.f1db_layout_id
   WHERE runs.length = (SELECT MAX(length) FROM runs)
   ORDER BY runs.first_n, o.n`
    : null

/** How many runs 'The longest runs' draws, before a tie at the last is kept whole. */
export const RUNS_SHOWN = 5
export const LONGEST_RUNS = 'The longest runs'
/** The derivation's section, which the runs' rule links to. */
export const DERIVATION_ID = 'how-it-is-derived'
export const recordRacesNote = `Outlines: ${OUTLINE_BY}. Each links to its race.`


// 'May', or 'September 2023' where the run spans seasons; null for a race
// with no whole day, and the sentence then names the race alone.
const monthOf = (iso, withYear) => {
  const long = longDate(iso)
  if (!long) return null
  const month = long.replace(/^\d+ /, '')
  return withYear ? month : month.replace(/ \d{4}$/, '')
}
const theRace = (name, iso, withYear) => {
  const month = monthOf(iso, withYear)
  return `the ${name}${month ? ` in ${month}` : ''}`
}

/**
 * The sentence a run is read as, after its holder's name: ' won ten Grands
 * Prix in a row in 2023, from the Miami Grand Prix in May to the Italian
 * Grand Prix in September.' A run over a winter names each end's year instead
 * of the season's; a run with a race in it that is not a Grand Prix - the
 * Indianapolis 500 - is a run of championship races; and a run that reaches
 * the latest completed race says so, since the next one may extend it.
 */
export function runSentence(run, verb) {
  const one = run.from_year === run.to_year
  const noun = [run.from_name, run.to_name, ...(run.names ?? [])].every((name) => /Grand Prix/.test(name ?? ''))
    ? 'Grands Prix'
    : 'championship races'
  const season = one ? ` in ${run.from_year}` : ''
  const ends = `from ${theRace(run.from_name, run.from_date, !one)} to ${theRace(run.to_name, run.to_date, !one)}`
  const tail = run.ongoing ? ', the latest race the database holds' : ''
  return `${run.ongoing ? ` has ${verb}` : ` ${verb}`} ${inWords(run.length)} ${noun} in a row${season}, ${ends}${tail}.`
}

/** 'Miami to Italian': a run's ends as the strip names a race. */
export const runEnds = (run) =>
  run.length === 1 ? roundShortName(run.from_name) : `${roundShortName(run.from_name)} to ${roundShortName(run.to_name)}`

/** A strip's accessible name: 'The 10 races of Max Verstappen’s run, 2023'. */
export const runRacesLabel = (run) => `The ${run.length} races of ${run.holder}’s run, ${span(run.from_year, run.to_year)}`

/**
 * What a record's page opens on (VD-112): the number the value opens with,
 * as a record card sets it (cardFigure), and the words that give it meaning,
 * as `lines` of parts - { text } or { text, href } - for both renderers.
 *
 * For most records the words are the rest of the value and the holder. For
 * a record STREAKS names whose runs, counted in the page, bear out its figure,
 * they are a sentence per record-length run, and `runs` carries the races of
 * each and the longest runs; where the count in the page does not agree with
 * the record's own figure, the page draws neither, rather than two figures
 * for one record. A value that opens with no number is set `whole`.
 *
 * `runRows` and `raceRows` are streakRuns()' and streakRaces()' rows, or
 * undefined for a record with none.
 */
export function recordLead(record, runRows, raceRows) {
  const figure = cardFigure(record)
  const holder = { text: record.holder ?? '', href: holderPath(record) }
  const runs = figure?.counts ? recordRuns(record, runRows, raceRows) : null
  if (runs) {
    return {
      figure: figure.figure,
      whole: null,
      lines: runs.top.map((run) => [{ text: run.holder, href: `drivers/${run.holder_id}` }, { text: runSentence(run, STREAKS[record.key].verb) }]),
      runs,
    }
  }
  const held = [{ text: `${LABELS.heldBy} ` }, holder]
  if (!figure) return { figure: null, whole: record.value, lines: [held], runs: null }
  return { figure: figure.figure, whole: null, lines: [...(figure.qualifier ? [[{ text: figure.qualifier }]] : []), held], runs: null }
}

/**
 * The runs behind a streak record, or null. `top` is every run as long as
 * the record, each with its races; `longest` is the first RUNS_SHOWN runs and
 * on through a tie at the last, each with `share`, its length against the
 * longest, and `mark` where it is as long as the record (D-61: the value the
 * page states takes the accent, every holder of it alike).
 */
export function recordRuns(record, runRows, raceRows) {
  if (!STREAKS[record.key] || !runRows?.length || !raceRows) return null
  const best = runRows[0].length
  if (best !== record.value_num) return null
  const races = (run) => raceRows.filter((r) => r.holder_id === run.holder_id && r.first_n === run.first_n)
  const top = runRows
    .filter((run) => run.length === best)
    .map((run) => {
      const its = races(run)
      return { ...run, ongoing: Boolean(run.ongoing), names: its.map((r) => r.name_used), races: its, label: runRacesLabel(run) }
    })
  if (top.some((run) => run.races.length !== run.length)) return null
  const longest = throughTies(
    runRows.map((run) => ({ ...run, value: run.length })),
    RUNS_SHOWN,
  ).map((run) => ({
    key: `${run.holder_id}-${run.first_n}`,
    holder: run.holder,
    href: `drivers/${run.holder_id}`,
    years: `${span(run.from_year, run.to_year)}${run.ongoing ? ' (ongoing)' : ''}`,
    figure: number(run.length),
    ends: runEnds(run),
    share: Math.round((run.length / best) * 1e4) / 1e4,
    mark: run.length === best,
  }))
  return { top, longest, rule: STREAKS[record.key].rule, spansSeasons: top.map((run) => run.from_year !== run.to_year) }
}

/** A race in a run's strip: 'R5', or '2023 R18' in a run over a winter. */
export const stripRound = (race, overWinter) => (overWinter ? `${race.year} R${race.round}` : `R${race.round}`)
