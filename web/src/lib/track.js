/**
 * A traced centreline, as an SVG path.
 *
 * circuit_geometry holds a GeoJSON MultiLineString per admitted layout, traced
 * from OpenStreetMap. It is the one table in this database under ODbL, which
 * is why nothing else derives from it and why it is excluded from the JSON
 * export — the obligation is confined to this one table and drops with it.
 */

/**
 * Project and fit a centreline into a box, returning { path, ratio }.
 *
 * Equirectangular, with longitude scaled by the cosine of the latitude at the
 * centre of the circuit. Over the couple of kilometres a track spans that is
 * indistinguishable from a proper projection, and without the cosine term a
 * circuit at Silverstone's latitude comes out visibly stretched sideways.
 */
export function trackPath(centreline, width = 640, height = 360, pad = 16) {
  let geo
  try {
    geo = typeof centreline === 'string' ? JSON.parse(centreline) : centreline
  } catch {
    return null
  }

  const lines = geo?.coordinates
  if (!Array.isArray(lines) || lines.length === 0) return null

  const points = lines.flat()
  if (points.length < 2) return null

  const latitudes = points.map((p) => p[1])
  const longitudes = points.map((p) => p[0])
  const midLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2
  const k = Math.cos((midLatitude * Math.PI) / 180)

  const xs = longitudes.map((v) => v * k)
  const minX = Math.min(...xs)
  const minY = Math.min(...latitudes)
  const spanX = Math.max(...xs) - minX || 1e-9
  const spanY = Math.max(...latitudes) - minY || 1e-9

  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY)
  // Centre whichever axis the scale did not fill.
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2

  const project = ([lon, lat]) => [
    (lon * k - minX) * scale + offsetX,
    // SVG y grows downward; north has to end up at the top.
    height - ((lat - minY) * scale + offsetY),
  ]

  const path = lines
    .map((line) =>
      line
        .map((point, i) => {
          const [x, y] = project(point)
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' '),
    )
    .join(' ')

  return { path, segments: lines.length, nodes: points.length }
}
