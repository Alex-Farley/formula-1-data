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
  note: "A constructor's win belongs to the car, so a shared drive counts once here and twice in the driver tables.",
  key: 'wins',
  label: (n) => `The ${howMany(n)} constructors with the most Grand Prix wins`,
}

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
    { key: 'value', label: 'Value', align: 'prose', cellClass: 'record-value' },
    { key: 'holder', label: 'Holder', align: 'prose' },
    // The derivation is what CR-22's claim rests on, so it stays in the table
    // and stays legible; it is the footnote to the figure, not its equal, and
    // it was set in the same ink at the same size (VD-51).
    { key: 'detail', label: DERIVATION, align: 'prose', cellClass: 'record-derivation' },
    // Every record is derived in one pass, so the date is the same on all of
    // them until a figure moves (VD-29). It was a collapsing column, said once
    // above the table; with a table per family it would be said eleven times,
    // and not at all under a family of fewer than five, so it is said once for
    // the page (asOfLine) and is a column only where the records differ on it,
    // as the tier is.
    ...(asOfOf(records) === null ? [{ key: 'as_of', label: 'As of' }] : []),
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

/**
 * A record's tile strip, as data (VD-71, after VD-49): read by
 * pages/Record.jsx and drawn by scripts/prerender.js's tiles(). The holder
 * links to their page where holderPath() finds one.
 */
export const recordStrip = (record) => [
  { label: 'Value', value: record.value, lead: true },
  { label: 'Holder', value: record.holder, href: holderPath(record) },
]
