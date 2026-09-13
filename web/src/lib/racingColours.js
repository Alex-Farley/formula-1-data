/**
 * National racing colours — and why these, and not team liveries.
 *
 * WHAT I LOOKED FOR AND DID NOT FIND. A per-constructor livery colour has no
 * source this project can admit:
 *
 *   F1DB (CC BY 4.0, already a source here)  constructors carry id, name,
 *       fullName and countryId. There is no colour field at all.
 *   Wikidata (CC0)  P465 "sRGB colour hex triplet" is absent on every F1
 *       constructor sampled — Ferrari, McLaren, Williams, Team Lotus, Vanwall
 *       and Brabham all return nothing. (Searching "Brabham" returns a family
 *       name item, which is its own warning about resolving 150 constructors
 *       to Wikidata by name.)
 *   Wikipedia  the team infobox has no colour parameter.
 *   formula1.com  publishes the current season only, under FOM copyright, and
 *       nothing in this database could contradict a value taken from it.
 *
 * That last point is the one that decides it. This project ranks a source on
 * licence, cadence and independent checkability, and says the third column is
 * the one that matters — it is why fan sites are forbidden as authority. A
 * livery hex fails it completely: nothing here can check one. A livery is also
 * per-season and often mid-season, so a single colour per constructor is a
 * claim the sport does not support.
 *
 * WHAT THIS IS INSTEAD. The international racing colours: the AIACR/FIA
 * convention under which a car was painted for the country it was entered
 * by, in force from the 1900s until sponsor liveries displaced it around
 * 1968. It is the reason Ferrari is red at all. It is a documented historical
 * convention rather than a per-car measurement, it keys off
 * `constructors.country` — which every one of the 150 rows has — and it is
 * true of the era this database mostly covers.
 *
 * It is deliberately NOT called a team colour anywhere in the interface, and
 * it is deliberately incomplete: only the countries whose colour is
 * unambiguous are listed. Everything else gets nothing rather than a guess,
 * which is the same rule the database applies to a missing figure.
 *
 * NONE OF THIS IS IN f1.db. It is presentation metadata, and it stays in the
 * front end so that no unsourced value can ever enter the database. If a
 * licensed, checkable livery set turns up, replacing this file is the whole
 * job: swap the map, keep `colourFor`.
 *
 * WHERE THE HEX LIVES. Not here. Each entry names a `--racing-*` token in
 * styles/tokens.css, which carries a light and a dark value the way `--seq-*`
 * does, because one hex cannot clear 3:1 on both a white panel and a
 * near-black one - six of the eight did not (VD-27). test/conventions.mjs
 * measures every pair against the surfaces it sits on.
 */

/**
 * The register spells countries inconsistently — five constructors are
 * "British" where fifty-three are "United Kingdom", and there are three
 * "French", one "Italian" and one "Brazilian" among the nouns. A few carry
 * two countries; the first is the one the entry raced under.
 */
const CANONICAL = {
  british: 'United Kingdom',
  english: 'United Kingdom',
  french: 'France',
  italian: 'Italy',
  german: 'Germany',
  brazilian: 'Brazil',
  american: 'United States',
  'united states of america': 'United States',
  usa: 'United States',
  us: 'United States',
}

export function canonicalCountry(country) {
  if (!country) return null
  const first = String(country).split(/[/,]/)[0].trim()
  return CANONICAL[first.toLowerCase()] ?? first
}

/**
 * The convention, for the countries where it is unambiguous.
 *
 * Each entry names the colour as the convention names it, so the interface can
 * say "rosso corsa" rather than "#d4001a" and a reader can tell this is a
 * historical claim rather than a sampled pixel. `token` is the `--racing-*`
 * custom property in styles/tokens.css that holds the two hexes.
 */
export const COLOURS = {
  'United Kingdom': { token: 'racing-uk', name: 'British racing green' },
  Italy: { token: 'racing-it', name: 'Rosso corsa' },
  France: { token: 'racing-fr', name: 'Bleu de France' },
  Germany: { token: 'racing-de', name: 'Silver' },
  Belgium: { token: 'racing-be', name: 'Belgian yellow' },
  Netherlands: { token: 'racing-nl', name: 'Dutch orange' },
  Switzerland: { token: 'racing-ch', name: 'Swiss red' },
  // White with blue stripes in the convention; a single swatch can only carry
  // the blue, so it is named for what it shows.
  'United States': { token: 'racing-us', name: 'American blue' },
}

/**
 * The racing colour for a constructor's country, or null: its name and a
 * `css` value - `var(--racing-xx)` - that resolves to the light or the dark
 * hex with the theme, so a swatch never carries a hex of its own.
 */
export function colourFor(country) {
  const entry = COLOURS[canonicalCountry(country)]
  return entry ? { name: entry.name, css: `var(--${entry.token})` } : null
}
