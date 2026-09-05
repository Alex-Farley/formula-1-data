/**
 * A NULL in this database means "not established" — never zero, never an
 * empty string. It is rendered as an em dash everywhere so that a missing
 * figure reads as missing rather than as a gap in the layout.
 */
export const EMPTY = '—'

export function cell(value) {
  if (value === null || value === undefined || value === '') return EMPTY
  if (typeof value === 'number') return numeric(value)
  return String(value)
}

export function numeric(n) {
  if (n === null || n === undefined) return EMPTY
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))
}

/** Whether a column should be right-aligned and set in tabular figures. */
export function isNumericColumn(rows, column) {
  for (const row of rows) {
    const v = row[column]
    if (v === null || v === undefined) continue
    return typeof v === 'number'
  }
  return false
}

/**
 * Whether a column holds prose rather than a label.
 *
 * Names, countries and circuits should stay on one line — wrapping "United
 * Kingdom" in a table with room to spare just makes every row two lines tall.
 * Gap descriptions and design notes must wrap or they push the rest of the
 * table off screen. The content decides, since the same table component
 * renders both, and an arbitrary SQL result has no schema to consult.
 */
const PROSE_AT = 60

export function isProseColumn(rows, column) {
  return rows.some((row) => typeof row[column] === 'string' && row[column].length > PROSE_AT)
}

/** "1950–2026", "1950–", "1950" — a span written the way the README writes it. */
export function span(from, to) {
  if (!from && !to) return EMPTY
  if (from && to) return from === to ? String(from) : `${from}–${to}`
  return `${from ?? to}${from ? '–' : ''}`
}

/**
 * The confidence ladder, as a class name. The database records how good every
 * fact is; hiding that in the UI would misrepresent it.
 */
export function confidenceClass(confidence) {
  return `pill pill-${confidence ?? 'unknown'}`
}

/**
 * A thumbnail URL for a Commons file, built from the file name.
 *
 * Special:FilePath does the width negotiation server-side, which avoids
 * reconstructing Commons' md5-sharded thumbnail paths here — those are an
 * implementation detail of their storage and have changed before. The
 * database stores no URL for the pixels precisely so that this stays one
 * place to change.
 */
export function thumbUrl(fileName, width = 640) {
  const bare = String(fileName || '').replace(/^File:/, '').replace(/ /g, '_')
  return (
    'https://commons.wikimedia.org/wiki/Special:FilePath/' +
    encodeURIComponent(bare) +
    `?width=${width}`
  )
}

/**
 * A GeoJSON MultiLineString as an SVG path, projected and fitted to a box.
 *
 * Equirectangular with the longitude scaled by cos(latitude) at the centre of
 * the circuit. Over the couple of kilometres a track spans that is
 * indistinguishable from a proper projection, and without the cosine term a
 * circuit at Silverstone's latitude comes out visibly stretched sideways.
 */
export function trackPath(centreline, width = 640, height = 360, pad = 12) {
  let geo
  try {
    geo = typeof centreline === 'string' ? JSON.parse(centreline) : centreline
  } catch {
    return null
  }
  const lines = geo?.coordinates
  if (!Array.isArray(lines) || lines.length === 0) return null

  const pts = lines.flat()
  if (pts.length < 2) return null

  const lats = pts.map((p) => p[1])
  const lons = pts.map((p) => p[0])
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const k = Math.cos((midLat * Math.PI) / 180)

  const xs = lons.map((v) => v * k)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...lats)
  const maxY = Math.max(...lats)

  const spanX = maxX - minX || 1e-9
  const spanY = maxY - minY || 1e-9
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY)
  // Centre whichever axis the scale did not fill.
  const offX = (width - spanX * scale) / 2
  const offY = (height - spanY * scale) / 2

  const project = ([lon, lat]) => [
    (lon * k - minX) * scale + offX,
    // SVG y grows downward; north must end up at the top.
    height - ((lat - minY) * scale + offY),
  ]

  return lines
    .map((line) =>
      line
        .map((p, i) => {
          const [x, y] = project(p)
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')
    )
    .join(' ')
}
