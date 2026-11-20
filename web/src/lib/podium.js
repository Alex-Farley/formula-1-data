/**
 * The podium (AF-135, VD-108; docs/design-system.md section 3, *Podium*):
 * the top three of a race, which home draws for the last race run as three
 * steps and every race page draws as three slabs in team colour where its
 * tiles stood. One rule for both pages and both renderers - podium() picks
 * the three - so the two pages cannot come to stand a different three; the
 * steps are components/Podium.jsx and podiumHtml() in scripts/prerender.js,
 * the slabs Race.jsx's RacePodium and racePodiumBlock() there, both from
 * slab() below.
 */
import { EMPTY, nameParts, ordinal } from './format.js'
import { ownColour } from '../charts/own.js'
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
 * where the caller says where the driver started, `grid` where it gives the
 * numbered slot the start was (queries/race.js's podiumSlot()). A place held by two
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
    grid: r.grid ?? null,
    colour: colourForEntry({ constructorId: r.constructor_id, country: r.constructor_country, year: r.year, team: r.constructor }),
  }))
}

/**
 * A step's line under the driver: the team, and where the driver started
 * where the caller gave it, as a race page's slab does - *McLaren · from
 * pole*. A team nobody resolved is
 * the em dash, as a table cell's is.
 */
export const podiumTeam = (step) => [step.constructor ?? EMPTY, step.start].filter(Boolean).join(' · ')

/*
 * A race page's slab (VD-108, the stepped podium approved on #1330): the
 * step in its team's colour, its words in whichever of two inks reads
 * better on that colour.
 */

/**
 * The two inks a slab's words can take, black and white. A slab is a colour
 * of its own, not the page's paper, so it takes neither theme's ink but the
 * one the colour under it calls for. Black rather than the light theme's
 * --ink (#1b1511) because §7's floor is 4.5:1 for text in both themes, and
 * against black and white together the better ratio is never under 4.58:1,
 * whatever the colour; against #1b1511 and white it can fall to 4.25:1, and
 * three of the national colours' dark values (Britain's, Switzerland's and
 * the United States') and Germany's light one would sit under 4.5
 * (test/units.mjs holds every slab to the floor).
 */
export const SLAB_INK = { dark: '#000000', light: '#ffffff' }

const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2's contrast ratio between two #rrggbb colours, 1 to 21. */
export const contrastRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * The ink a slab of `hex` sets its words in: whichever of SLAB_INK's two
 * has the higher contrast ratio against it, the dark one on a tie, so a
 * papaya or a yellow takes the dark ink and a navy the white.
 */
export const inkOn = (hex) =>
  contrastRatio(hex, SLAB_INK.dark) >= contrastRatio(hex, SLAB_INK.light) ? SLAB_INK.dark : SLAB_INK.light

/**
 * The ink on each national racing colour (1950-1967), in each theme. These
 * colours are tokens in styles/tokens.css rather than values in JS, so the
 * slab cannot measure them where it draws; test/units.mjs reads each token's
 * light and dark value out of tokens.css and holds this map to inkOn() of
 * them, so a token that moves and leaves its ink behind fails there.
 */
export const RACING_INK = {
  'racing-uk': { light: SLAB_INK.light, dark: SLAB_INK.dark },
  'racing-it': { light: SLAB_INK.light, dark: SLAB_INK.light },
  'racing-fr': { light: SLAB_INK.light, dark: SLAB_INK.dark },
  'racing-de': { light: SLAB_INK.dark, dark: SLAB_INK.dark },
  'racing-be': { light: SLAB_INK.dark, dark: SLAB_INK.dark },
  'racing-nl': { light: SLAB_INK.dark, dark: SLAB_INK.dark },
  'racing-ch': { light: SLAB_INK.light, dark: SLAB_INK.dark },
  'racing-us': { light: SLAB_INK.light, dark: SLAB_INK.dark },
}

/** The ink for one of a colour's two values: a #rrggbb, or a racing token's var(). */
const inkFor = (value, theme) => {
  const token = /^var\(--(racing-[a-z]+)\)$/.exec(value)?.[1]
  if (token) return RACING_INK[token]?.[theme] ?? null
  return /^#[0-9a-f]{6}$/i.test(value) ? inkOn(value) : null
}

/**
 * The custom properties a slab in `colour` carries, in the order both
 * renderers write them: the livery pair `.livery-series` resolves per theme,
 * as charts/own.js's ownColour() hands it to a series (the slab is the pair's
 * surface as a chart is), and the ink for each of its two values. Null - a plain slab, in the page's
 * own ink on a panel - where the team has no colour on record, or a value
 * nothing here can measure.
 */
export function slabVars(colour) {
  if (!colour) return null
  const light = inkFor(colour.light, 'light')
  const dark = inkFor(colour.dark, 'dark')
  if (!light || !dark) return null
  return {
    ...ownColour(colour).style,
    '--slab-ink-light': light,
    '--slab-ink-dark': dark,
  }
}

/**
 * Places made or lost from the grid to the flag, for a step whose start is a
 * numbered slot (`grid`, which racePodium() gives only then): `kind` is the
 * chip's class, `text` what it shows and `said` what it says to a screen
 * reader in place of the arrow. Null with no slot - a pit-lane start, a grid
 * nobody recorded - since there is nothing to count from.
 */
export function placesMoved(grid, place) {
  if (typeof grid !== 'number' || typeof place !== 'number') return null
  const by = grid - place
  if (by === 0) return { kind: 'held', text: 'held', said: 'held its grid place' }
  const n = Math.abs(by)
  const places = `${n} ${n === 1 ? 'place' : 'places'}`
  return by > 0
    ? { kind: 'up', text: `\u25b2 ${n}`, said: `${places} gained` }
    : { kind: 'down', text: `\u25bc ${n}`, said: `${places} lost` }
}

/**
 * One slab as both renderers draw it, from a podium() step: the numeral
 * behind it, the place and given name over the surname, the surname that
 * links to the driver, the team and start under it, the chip for the places
 * moved, and the colour's properties or null.
 */
export function slab(step) {
  const { given, surname } = nameParts(step.driver ?? '')
  return {
    place: step.place,
    numeral: String(step.place),
    first: [step.ordinal, given].filter(Boolean).join(' · '),
    surname: surname || EMPTY,
    href: step.driver_id ? `drivers/${step.driver_id}` : null,
    meta: podiumTeam(step),
    move: placesMoved(step.grid ?? null, step.place),
    vars: slabVars(step.colour),
  }
}
