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
export const LAST_CHECKED = '2026-09-22'

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
