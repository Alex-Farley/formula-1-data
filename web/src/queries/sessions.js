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

/**
 * "in 11 days", "in 3 hours", "in 40 minutes", "in under a minute"; null once
 * the start has passed. Each unit is chosen before it is rounded, so the
 * string never reads "in 0 minutes" or "in 1 hours".
 */
export const until = (startUtc, now = Date.now()) => {
  const ms = new Date(startUtc).getTime() - now
  if (ms <= 0) return null
  if (ms < 60000) return 'in under a minute'
  if (ms < 90 * 60000) {
    const minutes = Math.round(ms / 60000)
    return `in ${minutes} minute${minutes === 1 ? '' : 's'}`
  }
  if (ms < 48 * 3600000) {
    const hours = Math.max(2, Math.round(ms / 3600000))
    return `in ${hours} hours`
  }
  const days = Math.max(2, Math.round(ms / 86400000))
  return `in ${days} days`
}

/**
 * The three hours a grand prix may last: FIA Sporting Regulations art. 5.3
 * caps the elapsed time at three hours, suspensions included, so a race whose
 * start was three hours ago is over whatever else the day held.
 */
export const RACE_WINDOW_MS = 3 * 60 * 60 * 1000

/**
 * Where a round stands against the clock, rather than against the record
 * (AF-01).
 *
 * `races.status` says whether a classification is held, which is a different
 * question from whether the race has happened: the harvest lands a day or two
 * after the flag, and for twenty-three hours after the 2026 Madrid Grand Prix
 * the page for it said the race had not been run. The timetable this page
 * already prints answers it, so nothing new is stored and nothing is guessed.
 *
 *   'awaited'  the race session has not started
 *   'running'  it has, and the three hours of RACE_WINDOW_MS have not passed
 *   'run'      it is over, whatever the database holds for it
 *
 * Sessions are held for the current season alone, so the fallback for every
 * other round is the end of its own UTC day — a race cannot still be running
 * after midnight UTC on the day after it, in any zone it was run in, and that
 * is the latest claim the date alone supports. A round with neither a session
 * nor a readable date is 'awaited': an unreadable date is not evidence that
 * something happened.
 */
export const raceStage = (race, sessions = [], now = Date.now()) => {
  const started = Date.parse(sessions.find((s) => s.kind === 'race')?.start_utc ?? '')
  if (Number.isFinite(started)) {
    if (now < started) return 'awaited'
    return now < started + RACE_WINDOW_MS ? 'running' : 'run'
  }
  const dayEnd = Date.parse(`${race?.date_iso ?? ''}T23:59Z`)
  if (!Number.isFinite(dayEnd)) return 'awaited'
  return now > dayEnd ? 'run' : 'awaited'
}

/** The columns both renderers print, in order: the session, the circuit's clock, UTC. */
export const SESSION_COLUMNS = [
  { key: 'name', label: 'Session' },
  { key: 'circuit_time', label: 'At the circuit', text: (_, row) => clock(row.start_utc, row.zone) },
  { key: 'utc_time', label: 'UTC', text: (_, row) => utc(row.start_utc) },
]

export const TIMETABLE_NOTE =
  "Start times on the circuit's clock and in UTC; a session's length and any change on the day are not held here."

/** The reader's own clock, as a fourth column beside the shared three; the zone reads as words. */
export const yourTimeColumn = (zone) => ({
  key: 'your_time',
  label: `Your time (${zone.replace(/_/g, ' ')})`,
  text: (_, row) => clock(row.start_utc, zone),
})
