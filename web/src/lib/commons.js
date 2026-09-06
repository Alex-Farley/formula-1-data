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
