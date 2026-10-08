/**
 * When the pipeline last looked, as distinct from when the data last moved
 * (SD-25, absorbing SD-14).
 *
 * WHY A SECOND DATE
 *     `refresh.yml` fetches F1DB every morning and commits only when the
 *     rebuilt database passed every check AND something had actually changed.
 *     That is the right rule for the data and the wrong one for the reader:
 *     a run that found nothing new commits nothing, so the site keeps saying
 *     `Built 2026-09-16` whether the refresh ran green ten mornings running
 *     or died on the first one. Over a quiet winter those two states look
 *     identical for months, and the second is the one worth knowing about.
 *
 *     So the workflow now stamps this file on every morning the check
 *     completed, changed or not, and commits it on the no-change path as a
 *     one-line commit of its own. `built` still means "the day the data last
 *     moved"; `LAST_CHECKED` means "the last morning we looked and the look
 *     finished". A reader compares them to the calendar.
 *
 * WHY IT IS THE LAST SUCCESSFUL CHECK, AND NOT THE LAST ATTEMPT
 *     Deliberately. The stamp is written after the fetch has succeeded, so a
 *     morning that failed — as 2026-09-13 did, when verify.py refused the
 *     chassis harvest — leaves this date where it was. A date going stale IS
 *     the signal; a date that advanced on every attempt would report the
 *     pipeline healthy right up to the point nobody could tell any more.
 *
 * WHY IT IS COMMITTED SOURCE AND NOT A ROW IN THE DATABASE
 *     `BUILT` in build.py is a constant so that the same sources always
 *     rebuild to the same bytes [D-01]. A clock in `meta` would undo exactly
 *     that. This is a fact about the pipeline rather than about the data, it
 *     belongs to the repository, and one module imported by both the app and
 *     scripts/prerender.js is how this site keeps the static page and the
 *     rendered page from saying different things.
 *
 * HOW IT IS WRITTEN
 *     By `refresh.yml`, with sed against the exact shape of the line below
 *     and a grep that asserts the rewrite landed — the same handling
 *     build.py's `BUILT` line gets in the same workflow, for the same reason.
 *     Keep the declaration on one line, single-quoted, ISO `YYYY-MM-DD`. The
 *     daily commit is also what keeps GitHub's 60-day idle disable away from
 *     the schedule, which is the whole of SD-14.
 */

/** The last morning the refresh fetched F1DB and the fetch completed. */
export const LAST_CHECKED = '2026-10-08'

// ---------------------------------------------------------------- the words

/** The footer's and the page's label for it, in one place. */
export const CHECKED_LABEL = 'Checked'

/**
 * What the pair of dates means, said once, where a reader meets them.
 *
 * It has to carry the inference, not just the figures: the point of showing
 * a check date at all is that a reader can tell a quiet week from a broken
 * pipeline, and that only works if the page says which is which.
 */
export const CHECKED_NOTE =
  'F1DB, the source the harvest is rebuilt from, is checked every morning; “checked” is the '
  + 'last morning that check finished. '
  + '“Built” moves only when something had genuinely changed, so a later check date than build '
  + 'date means the data has not moved. A check date that is itself several days old means the '
  + 'refresh itself is failing.'

// ------------------------------------------------------ late results (SD-37)
//
// WHY THE BROWSER, AND WHY THIS RULE
//     refresh.yml's health check (.github/scripts/refresh_health.py) opens an
//     issue when a race goes unresulted, and a reader saw nothing: the race
//     still showed as scheduled, and the check date above only helps when the
//     refresh itself is failing, not when it runs every morning and F1DB is
//     the one that is late. The notice is computed where the reader is, with
//     the reader's own date, because that is the one place it does not wait
//     on a deploy - when the refresh fails nothing deploys, so anything the
//     build wrote would stop moving at the same moment as everything else.
//
//     It is the rule decided on #786, with the same three days: a round is
//     late once more than GRACE_DAYS have passed since its date with no
//     result, unless F1DB's calendar holds the season and no longer lists a
//     race that day - then it was cancelled or moved and is never late.
//     build.py carries that last half as races.on_f1db_calendar, and
//     verify.py holds it to the harvest. test/units.mjs holds GRACE_DAYS to
//     refresh_health.py's, so the issue and the page cannot disagree on it.
//
//     The static page reads it at the build's own date (prerender's
//     STATIC_NOW), which is the conservative reading: a race that has gone
//     late since the build shows no notice there, and the app adds it the
//     moment the database opens.

/** Days after a race before its missing result counts as late. */
export const GRACE_DAYS = 3

/** The reader's own calendar day, YYYY-MM-DD, in the reader's zone. */
export const readerDay = (now = Date.now()) => {
  const d = new Date(now)
  const two = (v) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/**
 * How many days late a round is at `today`, or null when it is not late.
 *
 * `race` is a row of races with no result - the caller's query says that,
 * as UNRESULTED does - carrying date_iso and on_f1db_calendar. Whole days,
 * as refresh_health.py counts them: both ends are read as UTC midnight, so
 * no zone or clock change can make it a fraction.
 */
export const lateDays = (race, today) => {
  if (race?.on_f1db_calendar === 0) return null
  const from = Date.parse(`${race?.date_iso ?? ''}T00:00Z`)
  const to = Date.parse(`${today ?? ''}T00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  const days = Math.round((to - from) / 86400000)
  return days > GRACE_DAYS ? days : null
}

/** The rounds of `rounds` that are late at `today`, each with its `days`. */
export const lateRaces = (rounds, today) =>
  rounds.map((r) => ({ ...r, days: lateDays(r, today) })).filter((r) => r.days !== null)

/**
 * What a reader is told, once, wherever it is told: the words after the
 * race's own sentence. The foot of every page carries the check date, which
 * is what tells F1DB being late from the refresh failing.
 */
export const LATE_NOTE =
  `Results come from F1DB, which this site checks every morning. More than ${GRACE_DAYS} days `
  + 'without one means F1DB has not published it yet or the refresh is failing; if the check '
  + 'date at the foot of the page is several days old, it is the refresh.'

/**
 * The day a reader is told the race was run: the circuit's own day. date_to
 * is the race's local day wherever a weekend is stated, and date_iso is
 * F1DB's UTC day, which for Las Vegas is the Sunday after a Saturday-night
 * race - the page around the sentence says 19-21 Nov, so it must not say the
 * 22nd. The count of days stays on date_iso, as refresh_health.py's does,
 * which is why no count is printed beside this day.
 */
export const raceDay = (r) => r.date_to ?? r.date_iso

/** The sentence for one late round. */
export const lateLine = (r) =>
  `The ${r.year} ${r.name_used} was run on ${raceDay(r)}, and its result is not here yet.`

/** /changes' notice, as both renderers draw it, or null when nothing is late. */
export const lateNotice = (late) =>
  late.length === 0
    ? null
    : { head: 'Results are late.', body: `${late.map(lateLine).join(' ')} ${LATE_NOTE}` }
