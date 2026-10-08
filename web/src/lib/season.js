/**
 * The season in progress, and the one label every register uses to name it.
 *
 * WHY THIS FILE EXISTS
 *     Four registers ask the same question — what belongs to this year? —
 *     and three of them had a different answer. `/drivers` offered "On the
 *     2026 grid", `/constructors` called the same idea "Active", and
 *     `/cars` and `/circuits` had no route to this year's chassis or
 *     calendar at all (IA-19). One concept with two labels and two silences
 *     is four registers a reader has to learn separately.
 *
 * THE ANCHOR
 *     `meta.current_season` — the season data/current.py declares is being
 *     run — and never a MAX() over the records (CR-07). The register already
 *     carries next season's calendar, so MAX(races.year) is 2027 today, and
 *     MAX(year) over the completed races names last season for the whole of
 *     a winter. v_current_grid and v_lost_circuits read this same value;
 *     these four queries now read it too, so the chip on one register cannot
 *     name a different year from the chip on the next.
 */

/**
 * The declared season as a scalar subquery, for interpolation into a
 * register's SQL. build.py writes the row and verify.py holds it to the
 * season the built database actually has an entry list and a timetable for,
 * so it is always present and always an integer.
 */
export const CURRENT_SEASON_SQL =
  "(SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'current_season')"

/**
 * The words on the control, in one place so the four registers cannot drift
 * apart again. A register that reaches the fallback is one whose rows did not
 * carry the season, which is a query that changed without its page.
 */
export const gridLabel = (season) => (season ? `On the ${season} grid` : 'On the grid')
export const calendarLabel = (season) => (season ? `On the ${season} calendar` : 'On the calendar')

/**
 * The season the rows were selected against, from the rows themselves: every
 * row of a register carries the same value, because it is a global and not a
 * fact about the row beside it.
 */
export const seasonOf = (rows) => rows[0]?.grid_season ?? rows[0]?.calendar_season ?? null

/**
 * Whether the control is worth drawing at all.
 *
 * "0 of 1,153" is a claim about the database made in the database's voice
 * (IX-31), and a filter whose only possible outcome is an empty table makes
 * it. A register holds a chassis or a venue once the records reach it, so
 * between the declaration of a season and its first entry there is nothing
 * to keep; the control waits rather than offering to empty the table.
 */
export const anyThisSeason = (rows, key) => rows.some((row) => row[key])
