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
 *   value  the figure or name, text or a number. A null, an empty string or
 *          the em dash is a value nobody has established, and the tile is
 *          drawn with an em dash (VD-88): the floor of the NULL rule, as in a
 *          table cell. A tile that does not apply to this page - the next
 *          session of a season with none to come, a Grand Prix with no round
 *          still to run - is not a tile with a null value but no tile: the
 *          strip leaves it out, or puts a null in its place, which both
 *          renderers skip
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

import { EMPTY, missing } from './format.js'

/** What sits between two linked names in one tile, as on every race list. */
export const TILE_JOIN = ' / '

/**
 * The strip's accessible name, which both renderers give it (VD-88): the
 * `<dl>` stands in a `role="group"` wrapper that carries it, because an
 * aria-label on a bare `<dl>` is not reliably exposed and `role="group"` on
 * the `<dl>` itself breaks its `<dt>`/`<dd>` pairs.
 */
export const TILE_STRIP_NAME = 'At a glance'

/** A tile whose value nobody has established, drawn as an em dash (VD-88). */
export const unestablished = (item) => missing(item.value) || item.value === EMPTY

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
