/**
 * How values are written down.
 *
 * The one rule everything else follows: a NULL in this database means "not
 * established" — never zero, never an empty string, never a guess. It renders
 * as an em dash so that a missing figure reads as missing rather than as a
 * hole in the layout, and nothing here ever coalesces one to 0.
 */
export const EMPTY = '—'

export const missing = (value) => value === null || value === undefined || value === ''

/**
 * A null `status` on a classified finisher is not a retirement whose reason
 * nobody recorded — it is a driver who finished. 15,714 of 27,482
 * `race_entries` rows carry a null status *and* a finish position, so the
 * em dash was asserting the opposite of the truth on 57% of entries, under a
 * caption saying exactly that. Every "Out" column reads this, so the rule
 * lives here rather than at the four render sites.
 */
export const finished = (status, finishPosition) =>
  missing(status) && !missing(finishPosition)

export function text(value) {
  if (missing(value)) return EMPTY
  if (typeof value === 'number') return number(value)
  return String(value)
}

/** Integers plain, fractions to three places at most, thousands separated. */
export function number(value) {
  if (missing(value) || typeof value !== 'number' || !Number.isFinite(value)) return EMPTY
  return Number.isInteger(value)
    ? value.toLocaleString('en-GB')
    : Number(value.toFixed(3)).toLocaleString('en-GB')
}

/** Championship points: 24, 25.5, 0.5 — never 25.000. */
export function points(value) {
  if (missing(value) || typeof value !== 'number') return EMPTY
  return Number(value.toFixed(2)).toLocaleString('en-GB')
}

/** A share, given a numerator and a denominator that may be zero. */
export function percent(part, whole, places = 1) {
  if (!whole) return EMPTY
  return `${((part / whole) * 100).toFixed(places)}%`
}

/**
 * A comma-separated list of years as stored ("2008,2014,2015,2017,2018,2019,
 * 2020") read as a career: "2008, 2014–15, 2017–20". Consecutive years - two
 * or more - collapse to a range and the commas gain a space, so the list
 * wraps at commas instead of mid-number; the titles tile used to read
 * "2008,2014,2015,201 / 7".
 */
export function yearList(value) {
  if (missing(value)) return EMPTY
  const years = String(value)
    .split(/[,\s]+/)
    .map((y) => Number(y))
    .filter((y) => Number.isInteger(y))
  if (years.length === 0) return String(value)
  const runs = []
  for (const y of years) {
    const last = runs[runs.length - 1]
    if (last && y === last[1] + 1) last[1] = y
    else runs.push([y, y])
  }
  return runs
    .map(([a, b]) => (a === b ? String(a) : `${a}–${String(b).slice(-2)}`))
    .join(', ')
}

/*
 * DATES ARE WORDS ON THE PAGE AND ISO IN THE DATA (CD-57; docs/design-system.md
 * section 5, *Dates*).
 *
 * Every date in this database is an ISO day, "1997-03-09", and that is how
 * SQL, the exports, the files a table hands over and the SQL console keep
 * it. A reader is never shown one: "1997-03-09" is the schema talking, and
 * "03/09/1997" is a different day on either side of the Atlantic. So a date
 * is written in one of two ways.
 *
 *   The house format, with the month as a word and so unambiguous anywhere:
 *   "9 Mar 1997" in a table, a tile or a field, "9 March 1997" in a
 *   sentence. The prerendered page is written in it, because a static file
 *   cannot know who will read it.
 *
 *   The reader's own, once the app has taken over: the same day through
 *   Intl.DateTimeFormat in `navigator.language`, so a reader in the United
 *   States sees "Mar 9, 1997" and one in Germany "9. März 1997". The house
 *   format is en-GB's, and an en-GB reader keeps it as written rather than
 *   taking ICU's version of it (which abbreviates September "Sept" in one
 *   release and "Sep" in the next), so for them the handover changes nothing.
 *
 * Both are read from the ISO day in a <time datetime>, which the two
 * renderers draw (components/Dates.jsx and scripts/prerender.js), so a
 * machine reading either half keeps the value the database holds.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The locale the house format is, and the one the static page is written for. */
export const HOUSE_LOCALE = 'en-GB'

/** Whole ISO days, and the same pattern for finding one inside a sentence. */
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
// Standing alone in a sentence, not inside a longer token: a day in a file
// name ("Foo 2019-05-26.jpg") or a path ("/2024-01-01/") is part of that
// name and is left as written. A full stop or a bracket after one is fine.
const ISO_IN_TEXT = /(?<![\w/.:-])(\d{4}-\d{2}-\d{2})(?![\w/-]|[.:]\w)/

/** The parts of a whole ISO day, or null for anything else - "1911", "1997-02-30". */
function dayParts(iso) {
  const match = ISO_DAY.exec(String(iso ?? ''))
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, month, day, date }
}

/** Whether a value is a whole ISO day, and so a date this module can write. */
export const isDay = (value) => dayParts(value) !== null

/**
 * A day in the house format: "9 Mar 1997", or "9 March 1997" when `length`
 * is 'long', which is for prose and a page's eyebrow (VD-81). Null where the
 * value is not a whole ISO day, so the caller leaves the clause out rather
 * than printing half a date.
 */
export function houseDate(iso, length = 'short') {
  const parts = dayParts(iso)
  if (!parts) return null
  const names = length === 'long' ? MONTH_NAMES : MONTHS
  return `${parts.day} ${names[parts.month - 1]} ${parts.year}`
}

/** "7 January 1985", from "1985-01-07": houseDate's long form. */
export const longDate = (iso) => houseDate(iso, 'long')

/**
 * The reader's locale, in the browser: what the app writes dates in. The
 * static page never asks - Node has a `navigator` too, and its answer is the
 * build machine's, not the reader's.
 */
export function readerLocale() {
  try {
    return globalThis.navigator?.language || HOUSE_LOCALE
  } catch {
    return HOUSE_LOCALE
  }
}

/** One Intl formatter per locale and length; a bad locale falls back to the house. */
const formatters = new Map()
function formatter(locale, length) {
  const key = `${locale}|${length}`
  if (!formatters.has(key)) {
    let made = null
    try {
      // UTC both ways: the day is a calendar day, and read in a reader's own
      // zone midnight UTC is the evening before for everyone west of London.
      made = new Intl.DateTimeFormat(locale, { day: 'numeric', month: length, year: 'numeric', timeZone: 'UTC' })
    } catch {
      made = null
    }
    formatters.set(key, made)
  }
  return formatters.get(key)
}

/**
 * A day as the reader in `locale` writes it: "Mar 9, 1997" in en-US, "9.
 * März 1997" in de-DE, and the house format itself in en-GB (see above).
 * Null where houseDate is.
 */
export function localDate(iso, length = 'short', locale = readerLocale()) {
  const house = houseDate(iso, length)
  if (house === null || locale === HOUSE_LOCALE) return house
  const format = formatter(locale, length)
  return format ? format.format(dayParts(iso).date) : house
}

/**
 * A sentence cut at the ISO days inside it: strings, and `{ iso }` for each
 * whole day, so a renderer can draw each one as a <time> and leave the words
 * alone. A string with no day in it comes back as itself, alone.
 */
export function dateSegments(value) {
  const parts = String(value ?? '').split(new RegExp(ISO_IN_TEXT.source, 'g'))
  // split() with a capturing group puts each match at an odd index.
  return parts
    .map((part, i) => (i % 2 === 1 && isDay(part) ? { iso: part } : part))
    .filter((part) => part !== '')
}

/**
 * When a race was run, as a reader is shown it: the weekend where one is
 * stated - "27–29 Mar 2026", "30 Oct–1 Nov 2026" - and the race day where
 * none is, which is every round before the current season: "13 May 1950".
 * Null where the row has neither, so a caller's em dash or empty clause
 * still decides.
 *
 * `races` holds three dates rather than a display string (DA-15): date_iso,
 * the race day, and date_from / date_to, the weekend. This is the house
 * format; localRaceDates is the reader's.
 */
export function raceDates(race) {
  const { date_iso: day, date_from: from, date_to: to } = race ?? {}
  const a = dayParts(from)
  const b = dayParts(to)
  if (!a || !b) return houseDate(day)
  if (a.year !== b.year) return `${houseDate(from)}–${houseDate(to)}`
  if (a.month !== b.month) return `${a.day} ${MONTHS[a.month - 1]}–${houseDate(to)}`
  return `${a.day}–${houseDate(to)}`
}

/**
 * raceDates in the reader's locale: a weekend through Intl's own range
 * format ("Mar 27 – 29, 2026" in en-US), which knows where each language
 * puts the month; the house format in en-GB, or where formatRange is missing.
 */
export function localRaceDates(race, locale = readerLocale()) {
  const { date_iso: day, date_from: from, date_to: to } = race ?? {}
  if (!isDay(from) || !isDay(to)) return localDate(day, 'short', locale)
  const format = locale === HOUSE_LOCALE ? null : formatter(locale, 'short')
  if (!format || typeof format.formatRange !== 'function') return raceDates(race)
  return format.formatRange(dayParts(from).date, dayParts(to).date)
}

/*
 * Times (CD-59): a session's start, held as an instant - "2026-12-04T09:30Z"
 * - and read on the clock of an IANA zone, the circuit's, UTC or the
 * reader's own. The same two forms as a day:
 *
 *   The house form, "Fri 4 Dec 13:30": the weekday and month as words, a
 *   24-hour clock, no year (a timetable is one weekend). The static page is
 *   written in it. Its words are this module's own, as houseDate's are, and
 *   Intl supplies only the figures, so it cannot drift with a release of ICU.
 *
 *   The reader's, once the app has taken over: the same instant through
 *   Intl.DateTimeFormat in `navigator.language`, so the weekday, the order
 *   and the 12- or 24-hour clock are that locale's - "Fri, Dec 4, 1:30 PM" in
 *   en-US, "Fr., 4. Dez., 13:30" in de-DE. An en-GB reader keeps the house
 *   form, as with a day.
 *
 * Both renderers put it in a <time datetime> holding the instant itself, and
 * a file carries the wall-clock time on that zone with its offset (zonedIso).
 */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad = (n) => String(n).padStart(2, '0')

/** One figures-only formatter per zone; a zone Intl will not take is null. */
const clocks = new Map()
function clockOf(zone) {
  if (!clocks.has(zone)) {
    let made = null
    try {
      made = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      })
    } catch {
      made = null
    }
    clocks.set(zone, made)
  }
  return clocks.get(zone)
}

/**
 * The wall clock on `zone` at `instant`, as figures, or null where the
 * instant does not parse or the zone is not one Intl knows. A zone is
 * required: left out, Intl would quietly read the runtime's own.
 */
function wallClock(instant, zone) {
  if (typeof zone !== 'string' || zone === '') return null
  // Date.parse rather than new Date(): new Date(null) is the epoch.
  const at = Date.parse(instant ?? '')
  const format = Number.isFinite(at) ? clockOf(zone) : null
  if (!format) return null
  const part = Object.fromEntries(format.formatToParts(at).map((p) => [p.type, Number(p.value)]))
  const figures = { year: part.year, month: part.month, day: part.day, hour: part.hour % 24, minute: part.minute }
  return Object.values(figures).every(Number.isInteger) ? { ...figures, at } : null
}

/** "Fri 4 Dec 13:30": `instant` on the clock of `zone`, in the house form; null as wallClock is. */
export function houseTime(instant, zone) {
  const c = wallClock(instant, zone)
  if (!c) return null
  const weekday = WEEKDAYS[new Date(Date.UTC(c.year, c.month - 1, c.day)).getUTCDay()]
  return `${weekday} ${c.day} ${MONTHS[c.month - 1]} ${pad(c.hour)}:${pad(c.minute)}`
}

/** One Intl formatter per locale and zone; a bad locale falls back to the house. */
const timeFormatters = new Map()
function timeFormatter(locale, zone) {
  const key = `${locale}|${zone}`
  if (!timeFormatters.has(key)) {
    let made = null
    try {
      made = new Intl.DateTimeFormat(locale, {
        timeZone: zone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      made = null
    }
    timeFormatters.set(key, made)
  }
  return timeFormatters.get(key)
}

/**
 * houseTime in the reader's locale: "Fri, Dec 4, 1:30 PM" in en-US, "Fr., 4.
 * Dez., 13:30" in de-DE, and the house form itself in en-GB. Null where
 * houseTime is.
 */
export function localTime(instant, zone, locale = readerLocale()) {
  const house = houseTime(instant, zone)
  if (house === null || locale === HOUSE_LOCALE) return house
  const format = timeFormatter(locale, zone)
  return format ? format.format(Date.parse(instant)) : house
}

/**
 * The instant as a file carries it: the wall clock on `zone` with its offset,
 * "2026-12-04T13:30+04:00", or "Z" where the offset is nothing. Data stays
 * ISO, and a column headed *At the circuit* holds the circuit's time, not
 * UTC's. Null as wallClock is.
 */
export function zonedIso(instant, zone) {
  const c = wallClock(instant, zone)
  if (!c) return null
  const offset = Math.round((Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute) - c.at) / 60000)
  const sign = offset < 0 ? '-' : '+'
  const zoneText = offset === 0 ? 'Z' : `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  return `${c.year}-${pad(c.month)}-${pad(c.day)}T${pad(c.hour)}:${pad(c.minute)}${zoneText}`
}

/** "1950–2026", "1950–", "1950". The dash is an en dash, as a span should be. */
export function span(from, to) {
  if (missing(from) && missing(to)) return EMPTY
  if (!missing(from) && !missing(to)) return from === to ? String(from) : `${from}–${to}`
  if (missing(to)) return `${from}–`
  return String(to)
}

export function bytes(n) {
  if (!n) return EMPTY
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * A race result as it is written in a classification.
 *
 * position_text carries what the source actually printed — a number, DNF, DSQ,
 * NC, DNQ, DNPQ — and finish_position is NULL for all but the numbers. Showing
 * the text is the honest rendering: a driver who did not finish did not finish
 * in no position, they did not finish.
 */
export function result(entry) {
  if (!missing(entry.position_text)) return String(entry.position_text)
  if (!missing(entry.finish_position)) return String(entry.finish_position)
  return EMPTY
}

/** Sorting key for a classification: finishers in order, then everyone else. */
export function classificationOrder(entry) {
  if (!missing(entry.finish_position)) return entry.finish_position
  if (!missing(entry.laps_completed)) return 1000 - entry.laps_completed
  return 9999
}

/** Sentence-case a snake_case column name, keeping the initialisms upright. */
export function label(column) {
  return String(column)
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bGp\b/g, 'GP')
    .replace(/\bId\b/g, 'ID')
    .replace(/\bKm\b/g, 'km')
    .replace(/\bMm\b/g, 'mm')
    .replace(/\bKg\b/g, 'kg')
    .replace(/\bBhp\b/g, 'bhp')
    .replace(/\bCc\b/g, 'cc')
    .replace(/\bQ1\b/g, 'Q1')
    .replace(/\bSql\b/g, 'SQL')
    .replace(/\bPct\b/g, '%')
}

/** Whether a column of results holds numbers, and so should be set right. */
export function isNumericColumn(rows, column) {
  for (const row of rows) {
    const value = row[column]
    if (missing(value)) continue
    return typeof value === 'number'
  }
  return false
}

/**
 * Whether a column holds prose rather than a label.
 *
 * Names and countries stay on one line — wrapping "United Kingdom" in a table
 * with room to spare makes every row two lines tall for nothing. Assessments
 * and gap descriptions must wrap or they push the rest of the table off the
 * screen. The content decides, because the same component renders a register
 * and an arbitrary SQL result, and the second has no schema to consult.
 */
const PROSE_AT = 60

export function isProseColumn(rows, column) {
  return rows.some((row) => typeof row[column] === 'string' && row[column].length > PROSE_AT)
}

/** A URL's host, for showing a source without showing 120 characters of it. */
export function host(url) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return String(url ?? '')
  }
}
