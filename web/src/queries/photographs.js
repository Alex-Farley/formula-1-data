/**
 * The photographs a surface other than the car page may show.
 *
 * WHY THIS FILE EXISTS
 *     `article_images` holds 623 photographs keyed to a chassis article, and
 *     until VD-33 two pages showed them: /cars and /cars/:id. The home page
 *     counted all of them. Constructor, season and race pages already join
 *     chassis, so the reach costs nothing but the query — no harvest, no
 *     schema change, no new source. The three queries live in one file
 *     because they answer one question three ways, and because the app and
 *     scripts/prerender.js both run them: a static page showing a different
 *     photograph from the app's is the shape PD-19 was filed to end.
 *
 * ONE PHOTOGRAPH PER CAR
 *     These surfaces are about a team, a year or an afternoon, not about one
 *     machine, so the strip shows a row of DIFFERENT cars rather than six
 *     views of whichever car is best photographed. The best photograph of an
 *     article is the one whose file name names the car (`name_matches = 1`),
 *     and the file name breaks the tie so the same row comes back every time.
 *
 * AN ARTICLE, NOT A CHASSIS
 *     `article_images.chassis_id` is NULL on every one of these 623 rows; the
 *     key is the article title, and 118 articles cover more than one chassis
 *     (the Lotus 72 covers seven). Selecting through the article rather than
 *     joining chassis is what keeps one photograph one row instead of seven.
 *
 * WHAT COMES FIRST
 *     Six of forty is a choice about which six, so each query orders by what
 *     its own page is about: the constructor's cars in the order it built
 *     them, which is the order its "Cars built" table prints; the season's
 *     cars by what they won that year; the race's cars by where they
 *     finished that afternoon. `article` last in every one of them, because a
 *     tie has to break the same way in both renderers.
 */

/**
 * The best photograph of each article — the filter the three queries share.
 *
 * `i` is the outer row: a photograph survives only if it is the one its own
 * article would choose. That is "one per car" without a window function,
 * which keeps this the plain SQL the rest of queries/ is written in.
 */
const BEST_OF_ITS_ARTICLE = `
     AND i.file_name = (
           SELECT j.file_name FROM article_images j
            WHERE j.route = 'article' AND j.article = i.article
            ORDER BY j.name_matches DESC, j.file_name
            LIMIT 1)
`

/** The cars this constructor built, oldest first, one photograph each. */
export const CONSTRUCTOR_IMAGES = `
  WITH built AS (
    SELECT ch.article AS article, MIN(ch.first_year) AS from_year
      FROM chassis ch
     WHERE ch.constructor_id = ? AND ch.article IS NOT NULL
     GROUP BY ch.article)
  SELECT i.*, built.from_year FROM article_images i
    JOIN built ON built.article = i.article
   WHERE i.route = 'article'
     ${BEST_OF_ITS_ARTICLE}
   ORDER BY built.from_year IS NULL, built.from_year, i.article
`

/**
 * The cars of one season, what they won first.
 *
 * A season fields more cars than a strip can hold, so the order decides what
 * a reader sees, and the car that won the year is the one the year is about.
 * Wins are counted from the entries rather than read off a standings table
 * because the constructors' championship did not exist before 1958 and this
 * has to order 1950 too. Entries, not starts: a car withdrawn on Saturday
 * was still that season's car.
 */
export const SEASON_IMAGES = `
  WITH raced AS (
    SELECT ch.article AS article,
           SUM(CASE WHEN e.finish_position = 1 THEN 1 ELSE 0 END) AS wins,
           COUNT(*) AS entries
      FROM race_entries e
      JOIN races r ON r.id = e.race_id
      JOIN chassis ch ON ch.id = e.chassis_id
     WHERE r.year = ? AND ch.article IS NOT NULL
     GROUP BY ch.article)
  SELECT i.*, raced.wins, raced.entries FROM article_images i
    JOIN raced ON raced.article = i.article
   WHERE i.route = 'article'
     ${BEST_OF_ITS_ARTICLE}
   ORDER BY raced.wins DESC, raced.entries DESC, i.article
`

/**
 * The cars entered for one Grand Prix, the best finisher first.
 *
 * A car that did not finish has no position, and 999 sends it behind the
 * ones that did rather than in front of them — which is what COALESCE is
 * doing here and is not a stored figure of any kind.
 */
export const RACE_IMAGES = `
  WITH entered AS (
    SELECT ch.article AS article,
           MIN(COALESCE(e.finish_position, 999)) AS best
      FROM race_entries e
      JOIN races r ON r.id = e.race_id
      JOIN chassis ch ON ch.id = e.chassis_id
     WHERE r.year = ? AND r.round = ? AND ch.article IS NOT NULL
     GROUP BY ch.article)
  SELECT i.*, entered.best FROM article_images i
    JOIN entered ON entered.article = i.article
   WHERE i.route = 'article'
     ${BEST_OF_ITS_ARTICLE}
   ORDER BY entered.best, i.article
`
