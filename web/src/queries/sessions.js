/**
 * The weekend timetable (LV-02), shared by the race page, the season page and
 * the prerenderer, so the app and the static page print the same rows.
 *
 * `sessions.start_utc` is "YYYY-MM-DDTHH:MMZ" and `zone` the circuit's IANA
 * name; every rendering here derives from those two, through Intl, so the
 * circuit's clock and the reader's are both computed rather than stored. The
 * static page shows the circuit's time and UTC; the app adds the reader's
 * zone and how long until the next session, which only a browser can know.
 */

export const RACE_SESSIONS = `
  SELECT s.kind, s.name, s.start_utc, s.zone
    FROM sessions s JOIN races r ON r.id = s.race_id
   WHERE r.year = ?1 AND r.round = ?2
   ORDER BY s.start_utc
`

export const SEASON_SESSIONS = `
  SELECT r.round, r.name_used, s.kind, s.name, s.start_utc, s.zone
    FROM sessions s JOIN races r ON r.id = s.race_id
   WHERE r.year = ?1
   ORDER BY s.start_utc
`

const fmt = (zone) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

/** "Fri 9 Oct, 16:30" - the start on the clock of `zone`. */
export const clock = (startUtc, zone) => fmt(zone).format(new Date(startUtc)).replace(',', '')

/** "Fri 9 Oct 08:30" in UTC. */
export const utc = (startUtc) => clock(startUtc, 'UTC')

/** The reader's zone, or null where the runtime cannot say (the prerenderer). */
export const readerZone = () => {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    return z && z !== 'UTC' ? z : null
  } catch {
    return null
  }
}

/** The first session that has not started by `now`, or null. */
export const nextSession = (rows, now = Date.now()) =>
  rows.find((r) => new Date(r.start_utc).getTime() > now) ?? null

/** "in 11 days", "in 3 hours", "in 40 minutes"; null once the start has passed. */
export const until = (startUtc, now = Date.now()) => {
  const ms = new Date(startUtc).getTime() - now
  if (ms <= 0) return null
  const minutes = Math.round(ms / 60000)
  if (minutes < 90) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.round(ms / 3600000)
  if (hours < 48) return `in ${hours} hours`
  const days = Math.round(ms / 86400000)
  return `in ${days} days`
}

/** The columns both renderers print, in order: the session, the circuit's clock, UTC. */
export const SESSION_COLUMNS = [
  { key: 'name', label: 'Session' },
  { key: 'circuit_time', label: 'At the circuit', text: (_, row) => clock(row.start_utc, row.zone) },
  { key: 'utc_time', label: 'UTC', text: (_, row) => utc(row.start_utc) },
]

export const TIMETABLE_NOTE =
  "Start times as published on formula1.com's race page, shown on the circuit's clock and in UTC; a session's length and any change on the day are not held here."
