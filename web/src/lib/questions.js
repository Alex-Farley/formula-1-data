/**
 * The questions this database can answer, each as the query that answers it.
 *
 * WHY THIS EXISTS
 *     The search palette matched names and nothing else, so six of ten
 *     realistic searches - "most wins", "pole to win", "who won the Italian
 *     Grand Prix" - returned nothing, and the console's seven examples were
 *     the only worked questions on the site (IA-20, PD-32). This is one list
 *     read in two places: the console offers every question that is a query
 *     as an example, and the palette indexes every question, so a reader who
 *     types what they want to know is handed a statement that runs.
 *
 * HOW TO READ IT
 *     `q` is the question as a reader would put it. `also` is the words a
 *     reader might type instead that the question does not contain - "wins"
 *     for a question that says "won" - and is searched, never shown. Each
 *     entry has exactly one of `sql`, a statement the console runs, or `to`,
 *     a page that already answers it. `topic` groups the console's list.
 *
 *     The first seven are the console's original examples, in their original
 *     order: the first is what the console opens on, and a link written
 *     before this list existed still names the statement it named.
 *
 *     Every statement is run against f1.db by test/units.mjs and must return
 *     at least one row. None names a year other than the season in progress
 *     read from `meta`, or one already complete, so none goes stale as the
 *     calendar turns.
 */
export const QUESTIONS = [
  {
    topic: 'Drivers',
    q: 'Who has led a race from pole most often?',
    also: 'pole to win conversion converted wins',
    sql: `SELECT d.full_name, COUNT(*) AS pole_to_win
   FROM race_entries e
   JOIN drivers d ON d.id = e.driver_id
  WHERE e.pole = 1 AND e.finish_position = 1
  GROUP BY e.driver_id
  ORDER BY pole_to_win DESC
  LIMIT 15`,
  },
  {
    topic: 'Seasons',
    q: "The drivers' championship as it stands",
    also: 'standings table points current season leader',
    sql: `SELECT position, entity AS driver, team, points
   -- standings keeps a row after every round, and more than one source's
   -- reading of each; this view is the fold — one row per driver per season.
   FROM v_standings_final
  WHERE table_type = 'drivers'
    AND year = (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'current_season')
  ORDER BY position`,
  },
  {
    topic: 'Races',
    q: 'The races two drivers both won',
    also: 'shared drive co-winner wins',
    sql: `SELECT r.year, r.name_used, group_concat(d.full_name, ' and ') AS winners
   FROM race_entries e
   JOIN races r   ON r.id = e.race_id
   JOIN drivers d ON d.id = e.driver_id
  WHERE e.finish_position = 1
  GROUP BY r.id
 HAVING COUNT(*) > 1
  ORDER BY r.year`,
  },
  {
    topic: 'Races',
    q: 'What actually stops a Formula One car',
    also: 'retirements retired dnf reasons engine failure accident',
    sql: `SELECT status, COUNT(*) AS entries
   FROM race_entries
  WHERE status IS NOT NULL
  GROUP BY status
  ORDER BY entries DESC
  LIMIT 25`,
  },
  {
    topic: 'Constructors',
    q: 'Constructors who entered a race and never scored',
    also: 'teams no points pointless',
    sql: `SELECT k.name, COUNT(*) AS entries, MIN(r.year) AS first_year, MAX(r.year) AS last_year
   FROM race_entries e
   JOIN races r        ON r.id = e.race_id
   JOIN constructors k ON k.id = e.constructor_id
  GROUP BY k.id
 HAVING SUM(COALESCE(e.points, 0)) = 0
  ORDER BY entries DESC`,
  },
  {
    topic: 'Races',
    q: 'How grid position turns into a result, in 2025',
    also: 'starting position qualifying finish',
    sql: `SELECT e.grid, COUNT(*) AS starts,
         ROUND(AVG(e.finish_position), 2) AS mean_finish,
         SUM(e.finish_position = 1) AS wins
   FROM race_entries e
   JOIN races r ON r.id = e.race_id
  WHERE r.year = 2025 AND e.grid IS NOT NULL
  GROUP BY e.grid
  ORDER BY e.grid`,
  },
  {
    topic: 'The data',
    q: 'Everything the database is unsure about',
    also: 'confidence unverified uncertain',
    sql: `SELECT tbl, label, confidence
   FROM v_unverified
  ORDER BY tbl, label`,
  },

  // Drivers
  {
    topic: 'Drivers',
    q: 'Who has won the most Grands Prix?',
    also: 'most wins victories winningest races',
    sql: `SELECT full_name, nationality, wins, first_win, last_win, titles
   FROM v_wins_by_driver
  ORDER BY wins DESC
  LIMIT 25`,
  },
  {
    topic: 'Drivers',
    q: 'Who has taken the most pole positions?',
    also: 'most poles qualifying',
    sql: `SELECT full_name, nationality, poles, first_pole, last_pole
   FROM v_poles_by_driver
  ORDER BY poles DESC
  LIMIT 25`,
  },
  {
    topic: 'Drivers',
    q: 'Who has set the most fastest laps?',
    also: 'fastest lap',
    sql: `SELECT full_name, nationality, fastest_laps, first, last, shared
   FROM v_fastest_laps_by_driver
  ORDER BY fastest_laps DESC
  LIMIT 25`,
  },
  {
    topic: 'Drivers',
    q: 'Who has won the most world championships?',
    also: 'most titles champions',
    sql: `SELECT full_name, nationality, titles, title_years, wins, poles
   FROM v_title_count
  ORDER BY titles DESC, wins DESC`,
  },
  {
    topic: 'Drivers',
    q: 'The youngest drivers to win a Grand Prix',
    also: 'age youngest winner',
    sql: `SELECT d.full_name, r.year, r.name_used,
         CAST((julianday(r.date_iso) - julianday(d.born)) / 365.2425 AS INTEGER) AS age
   FROM race_entries e
   JOIN races r   ON r.id = e.race_id
   JOIN drivers d ON d.id = e.driver_id
  WHERE e.finish_position = 1 AND d.born IS NOT NULL AND r.date_iso IS NOT NULL
  ORDER BY julianday(r.date_iso) - julianday(d.born)
  LIMIT 20`,
  },
  {
    topic: 'Drivers',
    q: 'The oldest drivers to win a Grand Prix',
    also: 'age oldest winner',
    sql: `SELECT d.full_name, r.year, r.name_used,
         CAST((julianday(r.date_iso) - julianday(d.born)) / 365.2425 AS INTEGER) AS age
   FROM race_entries e
   JOIN races r   ON r.id = e.race_id
   JOIN drivers d ON d.id = e.driver_id
  WHERE e.finish_position = 1 AND d.born IS NOT NULL AND r.date_iso IS NOT NULL
  ORDER BY julianday(r.date_iso) - julianday(d.born) DESC
  LIMIT 20`,
  },
  {
    topic: 'Drivers',
    q: 'The most wins in a single season',
    also: 'season record dominant year',
    sql: `SELECT d.full_name, r.year, COUNT(*) AS wins,
         (SELECT COUNT(*) FROM races x WHERE x.year = r.year AND x.status = 'completed') AS races
   FROM race_entries e
   JOIN races r   ON r.id = e.race_id
   JOIN drivers d ON d.id = e.driver_id
  WHERE e.finish_position = 1
  GROUP BY e.driver_id, r.year
  ORDER BY wins DESC, r.year
  LIMIT 20`,
  },
  {
    topic: 'Drivers',
    q: 'Grand Prix wins by nationality',
    also: 'country countries nation',
    sql: `SELECT nationality, SUM(wins) AS wins, COUNT(*) AS winners
   FROM v_wins_by_driver
  WHERE wins > 0
  GROUP BY nationality
  ORDER BY wins DESC`,
  },
  {
    topic: 'Drivers',
    q: 'Pole, win and fastest lap in the same race',
    also: 'hat-trick hat trick',
    sql: `SELECT year, gp_name, driver, constructor
   FROM v_grand_slams
  ORDER BY year, round`,
  },
  {
    topic: 'Drivers',
    q: 'Who won the most races in each decade?',
    also: 'decade wins best driver',
    sql: `SELECT decade, full_name, wins
   FROM v_wins_by_decade w
  WHERE wins = (SELECT MAX(wins) FROM v_wins_by_decade x WHERE x.decade = w.decade)
  ORDER BY decade`,
  },
  {
    topic: 'Drivers',
    q: 'Who is on the grid this season?',
    also: 'current drivers line-up lineup this year',
    sql: `SELECT car_number, driver, nationality_code, team, car, power_unit, role
   FROM v_current_grid
  ORDER BY team, car_number`,
  },

  // Constructors
  {
    topic: 'Constructors',
    q: 'Which constructors have won the most races?',
    also: 'teams most wins',
    sql: `SELECT name, country, wins, first_win, last_win, constructors_titles
   FROM v_wins_by_constructor
  ORDER BY wins DESC
  LIMIT 25`,
  },
  {
    topic: 'Constructors',
    q: "Every team's championships",
    also: 'constructors titles',
    sql: `SELECT name, country, constructors_titles, drivers_titles, title_years
   FROM v_constructor_titles
  ORDER BY constructors_titles DESC, drivers_titles DESC`,
  },
  {
    topic: 'Constructors',
    q: 'Which engine makers have won the most?',
    also: 'engines power unit manufacturer wins',
    sql: `SELECT name, country, first_year, last_year, wins, constructors_titles, drivers_titles
   FROM engine_manufacturers
  ORDER BY wins DESC
  LIMIT 25`,
  },

  // Races and circuits
  {
    topic: 'Circuits',
    q: 'The circuits that have held the most races',
    also: 'tracks venues most used',
    sql: `SELECT name, country, races, first_gp, last_gp, length_km, turns
   FROM v_circuits
  ORDER BY races DESC
  LIMIT 25`,
  },
  {
    topic: 'Circuits',
    q: 'Circuits Formula One no longer visits',
    also: 'lost tracks dropped former',
    sql: `SELECT name, country, races, first_gp, last_gp, years_since
   FROM v_lost_circuits
  ORDER BY races DESC`,
  },
  {
    topic: 'Circuits',
    q: 'Who has won most often at each circuit?',
    also: 'track specialist wins',
    sql: `SELECT circuit, driver, wins, first_win, last_win
   FROM v_circuit_winners w
  WHERE wins = (SELECT MAX(wins) FROM v_circuit_winners x WHERE x.circuit_id = w.circuit_id)
  ORDER BY wins DESC, circuit`,
  },
  {
    topic: 'Circuits',
    q: 'Who has won at Monaco?',
    also: 'monte carlo winners',
    sql: `SELECT driver, wins, first_win, last_win
   FROM v_circuit_winners
  WHERE circuit_id = 'monaco'
  ORDER BY wins DESC, first_win`,
  },
  {
    topic: 'Circuits',
    q: 'The countries that have held the most races',
    also: 'nations hosts',
    sql: `SELECT country, races, circuits, first_gp, last_gp
   FROM v_circuits_by_country
  ORDER BY races DESC`,
  },
  {
    topic: 'Races',
    q: 'The Grands Prix held most often',
    also: 'events editions oldest',
    sql: `SELECT name, country, editions, first_held, last_held
   FROM v_grands_prix
  ORDER BY editions DESC
  LIMIT 25`,
  },
  {
    topic: 'Races',
    q: 'How often pole turns into a win, season by season',
    also: 'pole to win conversion rate',
    sql: `SELECT year, races, pole_converted,
         ROUND(100.0 * pole_converted / races, 1) AS pct
   FROM v_pole_to_win
  ORDER BY year`,
  },
  {
    topic: 'Races',
    q: 'Races won from furthest down the grid',
    also: 'comeback lowest grid position win',
    sql: `SELECT r.year, r.name_used, d.full_name, e.grid
   FROM race_entries e
   JOIN races r   ON r.id = e.race_id
   JOIN drivers d ON d.id = e.driver_id
  WHERE e.finish_position = 1 AND e.grid > 0
  ORDER BY e.grid DESC
  LIMIT 20`,
  },
  {
    topic: 'Races',
    q: 'Every race winner this season',
    also: 'who won results current year',
    sql: `SELECT round, gp_name, winner, constructor
   FROM v_race_winners
  WHERE year = (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'current_season')
  ORDER BY round`,
  },

  // Cars
  {
    topic: 'Cars',
    q: 'The cars that won the most races',
    also: 'chassis most wins winningest',
    sql: `SELECT chassis, constructor, first_year, last_year, wins
   FROM v_chassis
  WHERE wins > 0
  ORDER BY wins DESC
  LIMIT 25`,
  },
  {
    topic: 'Cars',
    q: 'How the landmark cars changed: engine, power and weight',
    also: 'evolution specifications horsepower',
    sql: `SELECT from_year, car, constructor, engine_config, aspiration, power_bhp, weight_kg
   FROM v_car_evolution
  ORDER BY from_year`,
  },
  {
    topic: 'Cars',
    q: 'Technical innovations, and which were banned',
    also: 'ban technology ground effect',
    sql: `SELECT year, innovation, originator, banned_year
   FROM technical_innovations
  ORDER BY year`,
  },

  // Seasons and the rules
  {
    topic: 'Seasons',
    q: 'Every world champion, and by how much',
    also: 'champions margin runner-up title',
    sql: `SELECT year, champion, team, points, runner_up, margin
   FROM v_champions
  ORDER BY year`,
  },
  {
    topic: 'Seasons',
    q: 'The closest championships',
    also: 'margin title deciders tight',
    sql: `SELECT year, champion, runner_up, points, runner_up_points, margin
   FROM v_champions
  WHERE margin IS NOT NULL
  ORDER BY margin, year
  LIMIT 20`,
  },
  {
    topic: 'Seasons',
    q: 'How points have been scored over the years',
    also: 'points system scoring',
    sql: `SELECT from_year, to_year, scoring, win_points, fastest_lap_points, dropped_scores
   FROM points_systems
  ORDER BY from_year`,
  },
  {
    topic: 'Seasons',
    q: 'Safety milestones and what prompted them',
    also: 'safety changes accidents',
    sql: `SELECT year, milestone, trigger_event
   FROM safety_milestones
  ORDER BY year`,
  },

  // The data itself
  {
    topic: 'The data',
    q: 'Where the sources disagree',
    also: 'discrepancies conflicts open questions',
    sql: `SELECT key, subject, field, stored_value, derived_value
   FROM discrepancies
  WHERE status = 'open'
  ORDER BY subject`,
  },
  {
    topic: 'The data',
    q: 'What the database does not yet hold',
    also: 'known gaps missing',
    sql: `SELECT area, field, state, description
   FROM v_open_gaps
  ORDER BY area, field`,
  },
  {
    topic: 'The data',
    q: 'Every all-time record, with who is next',
    also: 'records most youngest',
    to: '/records',
  },
]

/** The console's folds, in the order it shows them. */
export const TOPICS = ['Drivers', 'Constructors', 'Races', 'Circuits', 'Cars', 'Seasons', 'The data']

/** The questions the console can run, as its examples: [label, statement]. */
export const EXAMPLES = QUESTIONS.filter((entry) => entry.sql).map((entry) => [entry.q, entry.sql])

/** Where a question goes: the page that answers it, or the console running it. */
export const questionPath = (entry) =>
  entry.to ?? (entry.sql === EXAMPLES[0][1] ? '/data/sql' : `/data/sql?q=${encodeURIComponent(entry.sql)}`)
