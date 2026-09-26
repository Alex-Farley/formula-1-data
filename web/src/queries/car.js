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
import { finished, missing, number, span, text } from '../lib/format.js'

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

/**
 * The curated car behind a page, with the two facts carAddress() needs:
 * `family`, how many chassis name it as their design, and `owned`, whether a
 * chassis shares its id.
 */
export const CAR = `
  SELECT c.*,
         (SELECT COUNT(*) FROM chassis x WHERE x.car_id = c.id) AS family,
         EXISTS (SELECT 1 FROM chassis y WHERE y.id = c.id) AS owned
    FROM cars c
   WHERE c.id = (SELECT car_id FROM chassis WHERE id = ?) OR c.id = ?
   LIMIT 1
`

/**
 * ONE CAR, ONE ADDRESS (IA-06).
 *
 * Four curated cars are a single chassis under another id: `mercedes-w11` is
 * the chassis `mercedes-f1-w11` and nothing else. VARIANTS resolves both
 * addresses to that one chassis, so both draw the same page, and both named
 * themselves canonical and sat in the sitemap - two indexed records of one
 * object. The curated id is the subject: it is the address the gallery at
 * /cars links, and the one every car that shares its id with its chassis
 * (`mclaren-mp4-4`) already has. The chassis address still answers; it says
 * which page it is a copy of, and the sitemap lists only that one.
 *
 * A design of several variants is not a copy. `/cars/lotus-72b` is one of
 * the four chassis `/cars/lotus-72` covers, with its own entries and its own
 * specification, and stays its own subject; so does a variant beside a car
 * whose id a chassis owns (`ferrari-312t2` beside `ferrari-312t`).
 *
 * `id` is the address's own id and `car` the CAR row for it. Returns the
 * router path, which both renderers print as the canonical and cite.
 */
export const carAddress = (id, car) => `/cars/${wholeOfOneChassis(car) && car.id !== id ? car.id : id}`

/** Whether the curated car is the whole of one chassis registered under another id: one object, two rows. */
export const wholeOfOneChassis = (car) => Boolean(car && !car.owned && car.family === 1)

/**
 * ONE PRECEDENCE, BOTH HALVES (IA-28).
 *
 * Every field the page shows about what the car is, resolved from the two
 * rows it may have: `chassis`, the register's row the page is about, and
 * `car`, the curated row behind it. Car.jsx and the static half in
 * scripts/prerender.js both read the page's figures from here, so the two
 * halves of one address cannot print different engines again.
 *
 * Where the car is the whole of one chassis (`mercedes-w11`, which is
 * `mercedes-f1-w11`), the two rows are one object, and every field is the
 * chassis's where it holds a value and the car's only where it does not -
 * the maintainer's ruling on IA-28. A figure the two give differently is
 * shown from the chassis and is on the record beside it: build.py files it
 * in `discrepancies` and the page shows both readings. The power note goes
 * with the power figure, so a figure is never captioned by the other row's
 * description of a different number. The curated row's one `suspension`
 * stands in only where the chassis has neither end's.
 *
 * Every other page keeps the precedence it had: the curated designers first,
 * the engine, brakes and tyres the chassis's before the design's, and the
 * rest the chassis's alone, because a variant of a design of several is its
 * own machine and the family's weight is not its weight.
 */
export function carFacts(chassis, car) {
  const whole = wholeOfOneChassis(car)
  const either = (field) => chassis?.[field] ?? car?.[field] ?? null
  const own = (field) => (whole ? either(field) : (chassis?.[field] ?? null))
  const powered = whole && missing(chassis?.power_bhp) ? car : chassis
  return {
    designers: whole ? either('designers') : (car?.designers ?? chassis?.designers ?? null),
    chassis_type: own('chassis_type'),
    susp_front: chassis?.susp_front ?? null,
    susp_rear: chassis?.susp_rear ?? null,
    suspension: whole && missing(chassis?.susp_front) && missing(chassis?.susp_rear) ? (car?.suspension ?? null) : null,
    brakes: either('brakes'),
    gearbox: own('gearbox'),
    gears: chassis?.gears ?? null,
    tyres: either('tyres'),
    fuel: chassis?.fuel ?? null,
    engine_name: either('engine_name'),
    engine_config: either('engine_config'),
    capacity_cc: either('capacity_cc'),
    aspiration: either('aspiration'),
    power_bhp: own('power_bhp'),
    power_note: whole ? (powered?.power_note ?? null) : either('power_note'),
    weight_kg: own('weight_kg'),
    wheelbase_mm: own('wheelbase_mm'),
    track_front_mm: own('track_front_mm'),
    track_rear_mm: own('track_rear_mm'),
  }
}

const unit = (value, suffix) => (value ? `${number(value)} ${suffix}` : null)

/**
 * The Specification section's two lists, from carFacts(): the chassis's
 * build and its engine, as label/value pairs of plain text, which Car.jsx
 * draws and the static half prints. A null is a figure nobody published.
 */
export const specificationFields = (facts) => ({
  chassis: [
    { label: 'Chassis', value: facts.chassis_type },
    // The curated row's one field in place of the two ends it has no figure for.
    ...(missing(facts.suspension)
      ? [
          { label: 'Front suspension', value: facts.susp_front },
          { label: 'Rear suspension', value: facts.susp_rear },
        ]
      : [{ label: 'Suspension', value: facts.suspension }]),
    { label: 'Brakes', value: facts.brakes },
    { label: 'Gearbox', value: facts.gearbox },
    { label: 'Gears', value: facts.gears },
    { label: 'Tyres', value: facts.tyres },
    { label: 'Fuel', value: facts.fuel },
  ],
  engine: [
    { label: 'Engine', value: facts.engine_name },
    { label: 'Configuration', value: facts.engine_config },
    { label: 'Capacity', value: unit(facts.capacity_cc, 'cc') },
    { label: 'Aspiration', value: facts.aspiration },
    { label: 'Power', value: unit(facts.power_bhp, 'bhp') },
    { label: 'Power note', value: facts.power_note },
    { label: 'Weight', value: facts.weight_kg ? `${facts.weight_kg} kg` : null },
    { label: 'Wheelbase', value: unit(facts.wheelbase_mm, 'mm') },
    { label: 'Track, front', value: unit(facts.track_front_mm, 'mm') },
    { label: 'Track, rear', value: unit(facts.track_rear_mm, 'mm') },
  ],
})

/**
 * Open disagreements filed against the curated car behind a page, found as
 * CAR finds the car - so the chassis address of a car that is one chassis
 * shows the same rows as the car's own. By the row's key, the car's id,
 * rather than its free-text subject; verify.py holds every open `cars` row's
 * key to a car and its subject to that car's name. Args: [the address's id].
 */
export const CAR_DISAGREEMENTS = `
  SELECT d.id, d.field, d.status, d.status_note, d.assessment, d.stored_value, d.derived_value
    FROM discrepancies d
   WHERE d.tbl = 'cars'
     AND d.row_key = (SELECT id FROM cars
                       WHERE id = (SELECT car_id FROM chassis WHERE id = ?1) OR id = ?1
                       LIMIT 1)
     AND d.status = 'open'
   ORDER BY d.id
`

/**
 * The page's name, the h1 and the title in both renderers: the car's where
 * the page covers several variants, the chassis's otherwise. The static
 * curated page printed the car's always, so `/cars/mercedes-w11` opened on
 * "Mercedes F1 W11 EQ Performance" and the app then renamed it "Mercedes F1
 * W11" - and three more did the same (IA-06). Which of the two records names
 * the car better is a separate question; this is only the two halves of one
 * page agreeing on the answer the app already gives.
 */
export const carPageName = (variants, car) =>
  (variants.length > 1 ? car?.full_name : null) ||
  variants[0]?.full_name ||
  variants[0]?.name ||
  car?.full_name ||
  car?.designation

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
  { key: 'name', rowHeader: true, label: 'Chassis' },
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
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
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
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', rowHeader: true, label: 'Grand Prix' },
  { key: 'driver', rowHeader: true, label: 'Driver' },
  ...(several ? [{ key: 'chassis', label: 'Chassis' }] : []),
  { key: 'grid_text', label: 'Grid', align: 'num' },
  { key: 'position_text', label: 'Result', align: 'num', text: entryResult, glossary: 'results' },
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
/**
 * The heading the figures take when the photograph leads: under the
 * Photographs h2 the untitled strip and fields read as the section's own, so
 * they get one of their own there, and nowhere else.
 */
export const FIGURES_HEADING = 'In figures'

export const leadsWithPhotograph = (variants, season) => {
  const years = variants.map((v) => v.last_year ?? v.first_year).filter((y) => !missing(y))
  return !missing(season) && years.length > 0 && Math.max(...years) === season
}

/** Whether any specification field holds a figure, and so whether to draw the fields at all. */
export const specified = (fields) => fields.some(({ value }) => !missing(value))

export const NO_ENTRIES =
  'No race entry in this database resolves here. That is usually a constructor that ran several designs in a season and no source saying which raced when, not a car that never raced.'
