/**
 * A tile strip as data, which both renderers can draw (VD-49).
 *
 * components/Page.jsx's <Stats> and scripts/prerender.js's stats() draw the
 * same `.stats` element, but the static half can only draw a strip it can
 * read: a list written inline in a page's JSX, with <Link> elements in its
 * values, is a list prerender.js has to transcribe, and a transcription
 * drifts. So a strip is built in its page's queries/*.js module, as plain
 * objects, and each renderer turns it into its own markup:
 *
 *   label  the tile's heading, text
 *   value  the figure or name, text or a number; a null drops the tile
 *   note   the line under it, text
 *   kind   'name' for a person, a team or a place rather than a figure
 *   lead   the tile is one of the strip's lead figures (VD-28)
 *   href   the page the value links to, relative and with no leading slash
 *          ('drivers/senna'), the form prerender.js's link() takes
 *   links  in place of `href`, where the value is several names that each
 *          link - a shared drive's winners - as [{ label, href }], drawn
 *          joined by TILE_JOIN; `value` still holds the joined text, so a
 *          strip is filtered on one field whichever form a tile takes
 *   quiet  the value is words standing where a figure would be ("not yet
 *          run", "not contested"), set smaller and muted
 *   date   the value is an ISO day, drawn as a date in the reader's format
 *          (components/Dates.jsx, CD-57) and never as the string
 */

/** What sits between two linked names in one tile, as on every race list. */
export const TILE_JOIN = ' / '

/**
 * A tile's value as the pieces a renderer draws in turn: each a label, and
 * the page it links to or null. One piece for a plain or singly linked
 * value; one per name for a tile with `links`.
 */
export const tileSegments = (item) =>
  item.links?.length ? item.links : [{ label: item.value, href: item.href ?? null }]

/** `links` from a list of rows, and the joined text `value` carries beside it. */
export const linked = (list) => ({
  value: list.map(({ label }) => label).join(TILE_JOIN),
  links: list,
})
