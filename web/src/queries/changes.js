/**
 * The /changes page: what the database holds as it stands (SD-20).
 *
 * Read by pages/Changes.jsx and by scripts/prerender.js, so the page a reader
 * sees and the entry the feed carries are counted by the same SQL.
 *
 * WHY "RUN" IS DEFINED BY HAVING A CLASSIFICATION
 *     The calendar holds rounds out to 2027, so a count of `races` is not a
 *     count of races that have happened. The alternative test is
 *     `date_iso <= meta.built`, which needs the build date threaded through as
 *     a parameter; this one asks the database what it actually holds — a race
 *     with a classification is a race that has been run and harvested — and so
 *     it answers the question a reader of this page is asking, which is how
 *     much of the season is in the file rather than how much of it is in the
 *     past. The two agree on today's database, and where they could ever
 *     disagree this is the honest one: a race run last Sunday whose results
 *     have not been harvested yet is exactly what the feed exists to report
 *     the arrival of.
 */

export const SHAPE = `
  SELECT
    (SELECT COUNT(*) FROM races)                                    AS races,
    (SELECT COUNT(*) FROM races r
      WHERE EXISTS (SELECT 1 FROM race_entries e WHERE e.race_id = r.id)) AS races_run,
    (SELECT COUNT(*) FROM race_entries)                             AS entries,
    (SELECT COUNT(*) FROM qualifying)                               AS qualifying,
    (SELECT COUNT(DISTINCT driver_id) FROM race_entries)            AS drivers,
    (SELECT COUNT(*) FROM constructors)                             AS constructors,
    (SELECT COUNT(*) FROM discrepancies WHERE status = 'open')      AS open_discrepancies,
    (SELECT COUNT(*) FROM v_open_gaps)                              AS open_gaps
`

/**
 * Every round this database holds no result for, oldest first (SD-37).
 *
 * Which of them are late is the reader's date's to decide, so it is
 * lib/refresh.js's lateRaces and not a WHERE clause here. "No result" is no
 * race_entries row, as refresh_health.py asks it, and not `status`:
 * data/current.py can author a round `completed` by hand, and that is not a
 * result.
 */
export const UNRESULTED = `
  SELECT r.year, r.round, r.name_used, r.date_iso, r.date_to, r.on_f1db_calendar
    FROM races r
   WHERE NOT EXISTS (SELECT 1 FROM race_entries e WHERE e.race_id = r.id)
   ORDER BY r.date_iso, r.year, r.round
`

/** The most recent race this database holds the classification of. */
export const LATEST = `
  SELECT r.year, r.round, r.name_used, r.date_iso
    FROM races r
   WHERE EXISTS (SELECT 1 FROM race_entries e WHERE e.race_id = r.id)
   ORDER BY r.date_iso DESC, r.round DESC
   LIMIT 1
`
