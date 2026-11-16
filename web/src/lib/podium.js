/**
 * The podium (AF-135, VD-108; docs/design-system.md section 3, *Podium*):
 * the top three of a race as three steps, which home draws for the last race
 * run and every race page draws in its header. One rule for both pages and
 * both renderers - components/Podium.jsx in the app, podiumHtml() in
 * scripts/prerender.js - so the two pages cannot come to stand a different
 * three.
 */
import { EMPTY, ordinal } from './format.js'
import { colourForEntry } from './liveries.js'

export const PODIUM_LABEL = 'The podium'

/**
 * The three steps, first to third - the order they are read in; app.css
 * stands the winner in the middle - or null. Each names its place, driver
 * and team, and wears the team's colour for the race's season where one is
 * on record (colourForEntry()); the words carry it either way.
 *
 * `rows` are one per entry, each `{ position, driver, driver_id,
 * constructor, constructor_id, constructor_country, year }`, and `start`
 * where the caller says where the driver started. A place held by two
 * entries - a shared drive, a dead heat - or by none is not a podium this
 * graphic can draw, so podium() declines it and the page keeps its sentence.
 */
export function podium(rows) {
  const steps = [1, 2, 3].map((place) => (rows ?? []).filter((r) => r.position === place))
  if (steps.some((held) => held.length !== 1)) return null
  return steps.map(([r]) => ({
    place: r.position,
    ordinal: ordinal(r.position),
    driver: r.driver ?? r.driver_id,
    driver_id: r.driver_id,
    constructor: r.constructor,
    constructor_id: r.constructor_id,
    start: r.start ?? null,
    colour: colourForEntry({ constructorId: r.constructor_id, country: r.constructor_country, year: r.year, team: r.constructor }),
  }))
}

/**
 * A step's line under the driver: the team, and where the driver started
 * where the caller gave it - *McLaren · from pole*. A team nobody resolved is
 * the em dash, as a table cell's is.
 */
export const podiumTeam = (step) => [step.constructor ?? EMPTY, step.start].filter(Boolean).join(' · ')
