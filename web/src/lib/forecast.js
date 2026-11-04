/**
 * A live weather forecast for the race weekend on the home page (AF-143).
 *
 * Open-Meteo's forecast API, asked from the reader's own browser while the
 * page is open, and never stored: f1.db stays a pure function of its
 * sources (D-01), and once the race is run the stored day in
 * race_weather_modelled (AF-136) is the record. Nothing here reads a clock
 * of its own - `clock` is given, in milliseconds - so units.mjs holds every
 * case on fixed clocks; loadForecast() is the one function that fetches.
 *
 * WHAT IS ASKED FOR
 *     The next round's circuit, at the point race_weather_modelled already
 *     holds for it (F1DB's coordinates, for the circuit raced, with the IANA
 *     zone its day is read in), from the latest row there. A circuit no
 *     race of which has a modelled day - a first visit - has no point, and
 *     so no forecast.
 *
 *     In the weekend state, the hours the sessions start: one figure per
 *     session still to start, the hour nearest its start. A session that
 *     has started has none - a forecast of an hour gone is not one.
 *     In the preview and results states, the weekend's days, one line each,
 *     once its first day is within OUTLOOK_DAYS; further out there is no
 *     outlook, since a forecast that far ahead is not one worth printing.
 *
 * IT FAILS CLOSED
 *     The static page has none: the prerenderer never calls this module.
 *     A fetch that fails, is refused, or answers with anything this module
 *     cannot read gives nothing, and so does a session or a day the answer
 *     holds no figure for. No placeholder figure, no zero for a missing one
 *     and no stale value: a figure is printed only where Open-Meteo gave it,
 *     and a line with none is not drawn.
 *
 * CREDITED BESIDE THE DATA, as Open-Meteo's terms ask: queries/race.js's
 * WEATHER_CREDIT, the one link to Open-Meteo the race page's weather line
 * gives too, and FORECAST_LICENCE.
 *
 * KEPT FRESH (the first review on #1261). An answer is kept for FRESH_MS and
 * then asked for again, so a tab left open through a weekend does not show
 * Friday's forecast on Sunday; and the credit names the day it came where
 * that is not the reader's today.
 */
import { readerLocale, zonedIso } from './format.js'

/** The one host the browser is told to ask: scripts/headers.js allows it under connect-src. */
export const FORECAST_ORIGIN = 'https://api.open-meteo.com'
export const FORECAST_ENDPOINT = `${FORECAST_ORIGIN}/v1/forecast`

/** Days before a weekend's first day that its outlook is printed. */
export const OUTLOOK_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000
const HALF_HOUR_MS = 30 * 60 * 1000

/** How long an answer is kept before it is asked for again: three hours. */
export const FRESH_MS = 3 * 60 * 60 * 1000

/** The word before the credit's link, and the licence it names. */
export const FORECAST_WORD = 'Forecast'
export const FORECAST_LICENCE = { text: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' }

/**
 * The sky for a WMO weather code, as Open-Meteo gives it: the mark, one of
 * queries/race.js's WEATHER_MARKS, and the word that says the same, since a
 * mark never stands alone. Snow is drawn with the rain mark - it falls - and
 * named for what it is. A code outside the table is null: no mark, no word.
 */
export function sky(code) {
  if (!Number.isInteger(code)) return null
  if (code === 0 || code === 1) return { mark: 'sun', word: 'Clear' }
  if (code === 2 || code === 3) return { mark: 'cloud', word: 'Cloudy' }
  if (code === 45 || code === 48) return { mark: 'cloud', word: 'Fog' }
  if (code >= 51 && code <= 57) return { mark: 'rain', word: 'Drizzle' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { mark: 'rain', word: 'Rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { mark: 'rain', word: 'Snow' }
  if (code >= 95 && code <= 99) return { mark: 'rain', word: 'Thunderstorms' }
  return null
}

const finite = (value) => typeof value === 'number' && Number.isFinite(value)

/** The point to ask for, or null where the database holds none usable. */
function pointOf(point) {
  if (!point || !finite(point.latitude) || !finite(point.longitude)) return null
  if (typeof point.timezone !== 'string' || point.timezone === '') return null
  return point
}

/** The circuit's local day of an instant, "2026-11-06", or null. */
const localDay = (instant, zone) => zonedIso(instant, zone)?.slice(0, 10) ?? null

/**
 * The hour nearest an instant on the circuit's clock, as Open-Meteo writes
 * its hours: "2026-11-06T13:00". A start on the half hour, an equal way
 * from both, takes the hour after it.
 */
function nearestHour(instant, zone) {
  const at = Date.parse(instant ?? '')
  if (!Number.isFinite(at)) return null
  const local = zonedIso(new Date(at + HALF_HOUR_MS).toISOString(), zone)
  return local ? `${local.slice(0, 13)}:00` : null
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Every ISO day from `from` to `to`, both included; empty where either is not a day. */
function daysBetween(from, to) {
  if (!ISO_DAY.test(from ?? '') || !ISO_DAY.test(to ?? '')) return []
  const days = []
  for (let at = Date.parse(`${from}T00:00Z`); at <= Date.parse(`${to}T00:00Z`) && days.length < 8; at += DAY_MS) {
    days.push(new Date(at).toISOString().slice(0, 10))
  }
  return days
}

/**
 * What to ask Open-Meteo for at `clock`, or null for nothing. `cycle` is
 * homeCycle()'s state; `next` NEXT's row, `sessions` NEXT_SESSIONS' rows and
 * `point` FORECAST_POINT's. `kind` is 'sessions' in the weekend state and
 * 'days' before it; `url` stays the same while what is asked for does, so a
 * page left open fetches once.
 */
export function forecastRequest({ cycle, next, sessions = [], point }, clock) {
  const at = pointOf(point)
  if (!at || !next) return null
  const zone = at.timezone
  let kind
  let days
  if (cycle === 'weekend') {
    const starts = sessions.map((s) => Date.parse(s.start_utc ?? '')).filter(Number.isFinite)
    // Nothing still to start, nothing to forecast.
    if (!starts.some((start) => start > clock)) return null
    days = sessions.map((s) => localDay(s.start_utc, zone)).filter(Boolean).sort()
    kind = 'sessions'
  } else if (cycle === 'preview' || cycle === 'results') {
    days = daysBetween(next.date_from ?? next.date_iso, next.date_to ?? next.date_iso)
    if (days.length === 0) return null
    const first = Date.parse(`${days[0]}T00:00Z`)
    const last = Date.parse(`${days.at(-1)}T00:00Z`) + DAY_MS
    if (first - clock > OUTLOOK_DAYS * DAY_MS || last <= clock) return null
    kind = 'days'
  } else {
    return null
  }
  if (days.length === 0) return null
  const query = new URLSearchParams({
    latitude: String(at.latitude),
    longitude: String(at.longitude),
    timezone: zone,
    start_date: days[0],
    end_date: days.at(-1),
  })
  if (kind === 'sessions') query.set('hourly', 'weather_code,temperature_2m,precipitation_probability')
  else query.set('daily', 'weather_code,temperature_2m_max,precipitation_probability_max')
  return { kind, zone, days, url: `${FORECAST_ENDPOINT}?${query}` }
}

const numberOrNull = (value) => (finite(value) ? value : null)

/**
 * Open-Meteo's answer as a table keyed by its own times - "2026-11-06T13:00"
 * for an hour, "2026-11-06" for a day - or null where the answer is not
 * one this module can read: no table of the kind asked for, or columns of
 * different lengths. A cell that is not a number is null, never zero.
 */
export function readForecast(json, request) {
  if (!json || typeof json !== 'object' || !request) return null
  const table = request.kind === 'sessions' ? json.hourly : json.daily
  const [temp, rain] = request.kind === 'sessions' ? ['temperature_2m', 'precipitation_probability'] : ['temperature_2m_max', 'precipitation_probability_max']
  if (!table || !Array.isArray(table.time)) return null
  const n = table.time.length
  const columns = [table.weather_code, table[temp], table[rain]]
  if (n === 0 || columns.some((column) => !Array.isArray(column) || column.length !== n)) return null
  const rows = new Map()
  table.time.forEach((time, i) => {
    if (typeof time !== 'string') return
    rows.set(time, {
      code: Number.isInteger(table.weather_code[i]) ? table.weather_code[i] : null,
      temp: numberOrNull(table[temp][i]),
      rain: numberOrNull(table[rain][i]),
    })
  })
  return rows
}

/** One forecast as it is printed, or null where Open-Meteo gave no figure for it. */
function shown(row, high) {
  if (!row) return null
  const s = sky(row.code)
  const parts = []
  if (s) parts.push(s.word)
  // Math.round gives -0 for a figure just under zero, which prints as "0".
  if (row.temp !== null) parts.push(high ? `High of ${Math.round(row.temp)} °C` : `${Math.round(row.temp)} °C`)
  if (row.rain !== null) parts.push(high ? `up to ${Math.round(row.rain)}% rain` : `${Math.round(row.rain)}% rain`)
  if (parts.length === 0) return null
  return { mark: s?.mark ?? null, text: parts.join(' · ') }
}

/**
 * The weekend state's figures, one per session in `sessions`' order: the
 * hour nearest its start, or null for a session that has started by `clock`
 * or that the answer holds nothing for.
 */
export function sessionForecasts(rows, sessions, zone, clock) {
  return sessions.map((s) => {
    const start = Date.parse(s.start_utc ?? '')
    if (!rows || !Number.isFinite(start) || start <= clock) return null
    return shown(rows.get(nearestHour(s.start_utc, zone)), false)
  })
}

/** The preview's lines, one per day of the weekend the answer holds a figure for. */
export function outlookDays(rows, days) {
  if (!rows) return []
  return days.map((day) => ({ day, ...shown(rows.get(day), true) })).filter((line) => line.text)
}

/** "Friday": a weekend day's name, in the reader's language. */
export function dayName(day, locale = readerLocale()) {
  if (!ISO_DAY.test(day ?? '')) return null
  const at = Date.parse(`${day}T00:00Z`)
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(at)
  } catch {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(at)
  }
}

/**
 * "14:05": when the answer came, on the reader's clock (UTC where the
 * browser names no zone), in the locale's own short time - "00:05" in
 * en-GB, "12:05 AM" in en-US. Where it came on an earlier day than `now`
 * on that clock, the day is given too: "3 Nov 2026, 14:05".
 */
export function updatedAt(at, zone, locale = readerLocale(), now = at) {
  if (!finite(at)) return null
  const timeZone = zone ?? 'UTC'
  const day = (ms) => zonedIso(new Date(ms).toISOString(), timeZone)?.slice(0, 10)
  const options = finite(now) && day(now) !== day(at) ? { dateStyle: 'medium', timeStyle: 'short', timeZone } : { timeStyle: 'short', timeZone }
  try {
    return new Intl.DateTimeFormat(locale, options).format(at)
  } catch {
    return new Intl.DateTimeFormat('en-GB', options).format(at)
  }
}

/*
 * One request per address in each FRESH_MS of the visit: the promise is
 * kept, so the page opened again, or re-rendered, asks once. A failure is
 * kept too, so a refused host is not asked again on every return to the
 * page.
 */
const answers = new Map()

/**
 * Open-Meteo's answer for `url` and when it came, `{ json, at }`; rejects on
 * any failure. The request carries no credentials and no referrer. `now` is
 * when it is wanted: an answer asked for FRESH_MS or more before it is
 * asked for again.
 */
export function loadForecast(url, fetcher = globalThis.fetch, now = Date.now()) {
  const kept = answers.get(url)
  if (!kept || now - kept.asked >= FRESH_MS) {
    answers.set(url, {
      asked: now,
      answer: fetcher(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }).then(async (response) => {
        if (!response.ok) throw new Error(`forecast: ${response.status}`)
        return { json: await response.json(), at: Date.now() }
      }),
    })
  }
  return answers.get(url).answer
}
