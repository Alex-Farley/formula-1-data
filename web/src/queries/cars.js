/**
 * The cars page: the curated gallery and the chassis register, their queries
 * and the register's columns, read by Cars.jsx and by scripts/prerender.js
 * (PD-02, rung three).
 *
 * WHY THIS FILE EXISTS
 *     The static register had six columns to the app's nine — no power,
 *     wheelbase or published wins — and printed a chassis's full name where
 *     the app prints its name; the static gallery read `cars` while the app
 *     reads v_cars. The definitions live here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { span, text } from '../lib/format.js'
import { CURRENT_SEASON_SQL } from '../lib/season.js'
import { LANDMARK } from '../lib/site.js'

/**
 * The curated cars, with a photograph where one has been matched. These are
 * not a subset of the register by size — they are the designs somebody wrote
 * a page about, with a designer, a concept and a record.
 */
export const GALLERY = `
  SELECT v.id, v.car, v.constructor, v.from_year, v.to_year, v.concept,
         v.wins, v.drivers_titles, v.constructors_titles,
         i.file_name, i.licence, i.licence_url, i.artist, i.credit,
         i.description_url, i.width, i.height, i.name_matches
    FROM v_cars v
    LEFT JOIN v_car_images i ON i.car_id = v.id
   ORDER BY v.from_year, v.car
`

/** The static page's table of the gallery: what each card says, as a row. */
export const GALLERY_COLUMNS = [
  { key: 'car', rowHeader: true, label: 'Car' },
  { key: 'constructor', label: 'Constructor' },
  { key: 'from_year', label: 'Years', align: 'num', text: (_, row) => span(row.from_year, row.to_year) },
  { key: 'concept', label: 'What it was for', align: 'prose' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'drivers_titles', label: "Drivers' titles", align: 'num' },
  { key: 'constructors_titles', label: "Constructors' titles", align: 'num' },
]

/**
 * Every chassis with a championship entry, first raced first. `landmark` is
 * the curated car this chassis belongs to, where it belongs to one.
 *
 * `on_grid` is the chassis whose raced span covers the declared season
 * (IA-19; lib/season.js has the anchor). The span, not the entry list:
 * season_entries carries the car as the team names it - "W17" against the
 * register's "F1 W17", "MAC-26" against "CA01" - so there is no key to join
 * on, while first_year and last_year are the very years this row already
 * prints in its Raced column.
 */
export const CHASSIS = `
  SELECT ch.id, ch.name, ch.full_name, ch.constructor_id, k.name AS constructor,
         k.country AS constructor_country,
         ch.first_year, ch.last_year, ch.engine_name, ch.chassis_type,
         ch.power_bhp, ch.wheelbase_mm, ch.weight_kg,
         ch.races, ch.wins, ch.published_wins, ch.car_id, ch.article, ch.confidence,
         CASE WHEN ch.chassis_type IS NULL AND ch.engine_name IS NULL
              THEN 0 ELSE 1 END AS has_spec,
         (SELECT landmark FROM cars WHERE cars.id = ch.car_id) AS landmark,
         ${CURRENT_SEASON_SQL} AS grid_season,
         CASE WHEN ch.first_year <= ${CURRENT_SEASON_SQL}
               AND ch.last_year  >= ${CURRENT_SEASON_SQL}
              THEN 1 ELSE 0 END AS on_grid
    FROM chassis ch
    LEFT JOIN constructors k ON k.id = ch.constructor_id
   ORDER BY ch.first_year, ch.name, ch.id
`

/** "Lotus 72D landmark" where the chassis is one of the curated designs. */
export const chassisName = (name, row) => (row.landmark ? `${text(name)} ${LANDMARK}` : text(name))

export const CHASSIS_COLUMNS = [
  { key: 'name', rowHeader: true, label: 'Chassis', text: chassisName },
  { key: 'constructor', label: 'Constructor' },
  { key: 'first_year', label: 'Raced', align: 'num', text: (_, row) => span(row.first_year, row.last_year) },
  { key: 'engine_name', label: 'Engine', align: 'prose' },
  { key: 'power_bhp', label: 'Power (bhp)', align: 'num' },
  { key: 'wheelbase_mm', label: 'Wheelbase (mm)', align: 'num' },
  { key: 'races', label: 'Races', align: 'num' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'published_wins', label: 'Published wins', align: 'num' },
]

export const CHASSIS_FOOTER =
  "“Wins” counts the races that can be attributed to this exact chassis; “published wins” is what the car's own article claims. A gap between them is usually a season the constructor ran two designs and no source says which car raced when."
