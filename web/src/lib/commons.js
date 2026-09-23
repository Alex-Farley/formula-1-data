/**
 * Photographs are references here, not images.
 *
 * The database stores no pixels — only a Commons file name, and with it the
 * licence, the photographer and the description page. Every one of the 602
 * rows carries its own licence string, and displaying one of these images
 * without its credit is a licence violation, not a style choice. That is why
 * the credit is inside the image component rather than left to each caller.
 */

/**
 * The width the harvest asked the API for, and so the widest a stored
 * `thumb_url` can stand in for. THUMB_WIDTH in tools/wikimedia_images.py,
 * which must agree.
 */
export const THUMB_WIDTH = 800

/**
 * A thumbnail URL for a row of `article_images`.
 *
 * The row's `thumb_url` where it has one and the width asked is within it
 * (VD-23): the address the API gave for the file, which answers in one
 * request. Built from the file name instead, through Special:FilePath, the
 * same picture took two redirects before a byte of it arrived — on a page of
 * six photographs, eighteen requests where six will do.
 *
 * Special:FilePath is still the answer where there is no stored address, for
 * anything wider than the harvest asked for (the share card), and when a
 * caller passes `direct: false` because the stored one failed to load.
 * Commons' storage paths are theirs and have changed before — they now serve
 * only a fixed ladder of widths, and a direct request for any other is
 * refused — so the address is never assembled here: it is taken as the API
 * gives it or it is not used, and this stays the one place that decides.
 */
export function thumbUrl(image, width = THUMB_WIDTH, { direct = true } = {}) {
  const stored = direct && width <= THUMB_WIDTH ? String(image?.thumb_url ?? '').trim() : ''
  if (stored) return stored
  const bare = String(image?.file_name ?? '')
    .replace(/^File:/, '')
    .replace(/ /g, '_')
  if (!bare) return null
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(bare)}?width=${width}`
}

/** The file name without its "File:" prefix, for a caption. */
export const fileTitle = (fileName) => String(fileName ?? '').replace(/^File:/, '').replace(/_/g, ' ')

/**
 * What the photograph is OF — its `alt` (AX-13).
 *
 * Every figure on the site took its alt from the file name, ".jpg" included:
 * a screen reader read "Rétromobile 2017 dash AGS JH23 dash 1989 dash 001 dot
 * j p g" where a sighted reader saw a car. That is a 1.1.1 failure, and it is
 * the file name twice over, since the figcaption already names the file and
 * links it.
 *
 * Every row of `article_images` carries the article it was gathered from, and
 * that article names the car — "AGS JH23", "McLaren MP4/4". So the alt is the
 * subject, exactly as the cars gallery has always written it.
 *
 * A `name_matches = 0` file is still described by its subject rather than
 * hedged here: the caveat belongs beside the picture, where the figcaption's
 * `unchecked` mark puts it for a screen reader and for everybody else at the
 * same time. What is left is the fallback nothing should reach — a row with
 * no article — and there the file name at least says something, minus the
 * extension, which is a fact about a file and not about a car.
 */
export const photoAlt = (image, caption) =>
  (caption ?? '').trim() ||
  (image?.article ?? '').trim() ||
  fileTitle(image?.file_name).replace(/\.(jpe?g|png|gif|svg|webp|tiff?)$/i, '')

/**
 * The person or source to credit for a photograph — the ONE rule.
 *
 * This is the same rule the build applies. verify.py refuses a file where
 * neither `artist` nor `credit` says anything:
 *
 *     COALESCE(NULLIF(TRIM(artist), ''), NULLIF(TRIM(credit), ''))
 *
 * A renderer that reads only `artist` disagrees with the check that admitted
 * the row, and captions an attributed photograph as anonymous — which is what
 * happened to the 1958 Hawthorn photograph on Ferrari 246 F1. It lives here,
 * exported, because it went wrong once by being written out twice.
 */
export const attribution = (image) =>
  (image?.artist ?? '').trim() || (image?.credit ?? '').trim() || null

/**
 * Whether a photograph may be shown at all.
 *
 * Nobody to credit, or no licence to name, means it is not displayable:
 * showing it is the licence breach, and omitting it costs a picture. The
 * build already refuses such a file, so this should never be false — which is
 * the point of asking.
 */
export const canShow = (image) =>
  Boolean(image?.file_name && attribution(image) && (image?.licence ?? '').trim())
