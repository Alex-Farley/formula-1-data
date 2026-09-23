/**
 * One car's page: its queries and its three tables' columns, read by Car.jsx
 * and by scripts/prerender.js (PD-02, rung six).
 *
 * WHY THIS FILE EXISTS
 *     The static chassis page had a six-column "Every championship entry"
 *     from a grouped pass over race_entries, and the static curated-car
 *     page had no entries table at all; the app has "Every entry" with the
 *     driver, the grid, the result and the reason out, plus the variants of
 *     a multi-chassis design and the seasons whose results cannot be
 *     attributed. The definitions live here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { finished, missing, span, text } from '../lib/format.js'

/**
 * Every chassis a page covers.
 *
 * An id usually names one chassis. Six of them name a CAR that no single
 * chassis shares an id with — `lotus-72` is the 72B, 72C, 72D and 72E — and
 * those pages have to cover the variants together, because no race entry is
 * ever attributed to `lotus-72` itself. Matching `car_id` only when no chassis
 * owns the id keeps every other page exactly as it was: `mclaren-mp4-4` names
 * both a car and a chassis, and resolves to the chassis.
 */
export const VARIANTS = `
  SELECT ch.*, k.name AS constructor, k.country AS constructor_country
    FROM chassis ch
    LEFT JOIN constructors k ON k.id = ch.constructor_id
   WHERE ch.id = ?1
      OR (ch.car_id = ?1 AND NOT EXISTS (SELECT 1 FROM chassis x WHERE x.id = ?1))
   ORDER BY ch.first_year, ch.id
`

export const CAR = `
  SELECT c.* FROM cars c
   WHERE c.id = (SELECT car_id FROM chassis WHERE id = ?) OR c.id = ?
   LIMIT 1
`

// The article route only. A photograph from a Commons category (AF-42,
// route 'category', confidence 'catalogued') is not shown until a person
// decides whether that rung is shown at all.
export const IMAGES = `
  SELECT * FROM article_images
   WHERE route = 'article'
     AND (article = (SELECT article FROM chassis WHERE id = ?)
       OR article = (SELECT article FROM chassis WHERE car_id = ? LIMIT 1))
   ORDER BY name_matches DESC
`

/** Entries for every chassis the page covers — the same set VARIANTS resolves; newest first. */
export const ENTRIES = `
  SELECT r.year, r.round, r.name_used, r.circuit_id, c.name AS circuit,
         e.driver_id, d.full_name AS driver, e.grid_text, e.grid,
         e.chassis_id, ch.name AS chassis,
         e.position_text, e.finish_position, e.status, e.fastest_lap, e.pole
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN circuits c ON c.id = r.circuit_id
    LEFT JOIN drivers d  ON d.id = e.driver_id
    LEFT JOIN chassis ch ON ch.id = e.chassis_id
   WHERE e.chassis_id IN (
           SELECT id FROM chassis
            WHERE id = ?1
               OR (car_id = ?1 AND NOT EXISTS (SELECT 1 FROM chassis x WHERE x.id = ?1))
         )
   ORDER BY r.year DESC, r.round DESC, e.id
`

export const SEASONS = `
  SELECT cs.year, cs.corroborated, cs.other_chassis
    FROM car_seasons cs
   WHERE cs.car_id = (SELECT car_id FROM chassis WHERE id = ?) OR cs.car_id = ?
   ORDER BY cs.year
`

/* ---------------------------------------------------------------- columns */

export const VARIANT_COLUMNS = [
  { key: 'name', label: 'Chassis' },
  { key: 'first_year', label: 'Raced', align: 'num', text: (_, row) => span(row.first_year, row.last_year) },
  { key: 'engine_name', label: 'Engine', align: 'prose' },
  { key: 'power_bhp', label: 'Power (bhp)', align: 'num' },
  { key: 'wheelbase_mm', label: 'Wheelbase (mm)', align: 'num' },
  { key: 'races', label: 'Races', align: 'num' },
  { key: 'wins', label: 'Wins', align: 'num' },
]

export const VARIANTS_FOOTER =
  'Races and wins here belong to that particular variant. The published figure covers the whole car and is shown once, below.'

export const AMBIGUOUS_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'other_chassis', label: 'Also entered by this constructor', align: 'prose' },
]

export const AMBIGUOUS_FOOTER =
  'In these seasons the team ran more than one design and no source says which car raced which round, so the results are left unattributed rather than guessed.'

/** The classified position — the source's own spelling first — or, for a retirement, whatever it says. */
export const entryResult = (value, row) => (missing(row.finish_position) ? text(value) : text(value ?? row.finish_position))

/** "Finished" for a classified finisher with no status; the status; the em dash for neither. */
export const entryOut = (value, row) => (finished(value, row.finish_position) ? 'Finished' : text(value))

/** The columns of the entries table; the Chassis column only where the page covers several. */
export const entryColumns = (several) => [
  { key: 'year', label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', label: 'Grand Prix' },
  { key: 'driver', label: 'Driver' },
  ...(several ? [{ key: 'chassis', label: 'Chassis' }] : []),
  { key: 'grid_text', label: 'Grid', align: 'num' },
  { key: 'position_text', label: 'Result', align: 'num', text: entryResult },
  { key: 'status', label: 'Out', text: entryOut },
]

/**
 * What the Specification section says where there is no specification (CD-37).
 *
 * 339 of the 1,153 chassis in the register have nothing in any of the
 * eighteen fields, and the section drew eighteen em dashes for them: eighteen
 * separate claims that nobody has established a figure, where the truth is
 * one claim about the car. The sentence replaces the fields rather than the
 * heading, so a reader who came looking for a specification is still told
 * where they are and what the answer is. The static half already drops a
 * field nothing is known for rather than dashing it.
 */
export const NO_SPECIFICATION =
  'No specification is published for this car: no chassis, engine, weight or dimension figure is ' +
  'on record for it.'

/**
 * THIS YEAR'S CHASSIS LEADS WITH ITS PHOTOGRAPH (PD-49).
 *
 * A car on this season's grid is one a reader has just watched race, and the
 * picture is what they came to match it against; every other car's page
 * leads with its figures and the photographs follow, as before. "This
 * year's" is the last season any variant the page covers raced - the span
 * the Raced tile prints - reaching meta.current_season (lib/season.js), and
 * never the latest season the register holds. Both renderers ask here.
 */
export const leadsWithPhotograph = (variants, season) => {
  const years = variants.map((v) => v.last_year ?? v.first_year).filter((y) => !missing(y))
  return !missing(season) && years.length > 0 && Math.max(...years) === season
}

/** Whether any specification field holds a figure, and so whether to draw the fields at all. */
export const specified = (fields) => fields.some(({ value }) => !missing(value))

export const NO_ENTRIES =
  'No race entry in this database resolves here. That is usually a constructor that ran several designs in a season and no source saying which raced when, not a car that never raced.'
