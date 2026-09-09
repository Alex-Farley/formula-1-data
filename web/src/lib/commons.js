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
 * A thumbnail URL, built from the file name.
 *
 * Special:FilePath negotiates the width server-side, which avoids
 * reconstructing Commons' md5-sharded thumbnail paths here — those are an
 * implementation detail of their storage and have changed before. The database
 * stores no URL for the pixels precisely so that this stays the one place to
 * change if it changes again.
 */
export function thumbUrl(fileName, width = 800) {
  const bare = String(fileName ?? '')
    .replace(/^File:/, '')
    .replace(/ /g, '_')
  if (!bare) return null
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(bare)}?width=${width}`
}

/** The file name without its "File:" prefix, for a caption. */
export const fileTitle = (fileName) => String(fileName ?? '').replace(/^File:/, '').replace(/_/g, ' ')

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
