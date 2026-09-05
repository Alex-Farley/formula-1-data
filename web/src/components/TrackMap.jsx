/**
 * A circuit centreline, drawn from the coordinates in the database.
 *
 * Inline SVG from a GeoJSON MultiLineString — no tiles, no map library, no
 * network. The same file that answers every other query on the page answers
 * this one.
 *
 * The caption states what the shape IS, because the honest answer is narrower
 * than "this is the circuit": OpenStreetMap maps what is on the ground now, so
 * a trace is the current configuration and nothing else. Historic layouts have
 * no geometry anywhere and are not drawn as though they do.
 */
import { trackPath } from '../format.js'

const W = 640
const H = 360

export default function TrackMap({ row }) {
  if (!row || !row.centreline) return null
  const d = trackPath(row.centreline, W, H)
  if (!d) return null

  return (
    <figure className="trackmap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Centreline of ${row.circuit ?? row.circuit_id}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={d}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="trackmap-line"
        />
      </svg>
      <figcaption>
        {row.layout && row.layout !== '-'
          ? `The ${row.layout} layout, as OpenStreetMap maps it. `
          : 'The current configuration, as OpenStreetMap maps it. '}
        Measured {Number(row.measured_km).toFixed(3)} km against a published{' '}
        {Number(row.published_km).toFixed(3)} km (
        {row.delta_pct > 0 ? '+' : ''}
        {Number(row.delta_pct).toFixed(2)}%). Pit lane excluded. Geometry ©
        OpenStreetMap contributors,{' '}
        <a
          href="https://opendatacommons.org/licenses/odbl/1-0/"
          target="_blank"
          rel="noreferrer noopener"
        >
          ODbL 1.0
        </a>
        .
      </figcaption>
    </figure>
  )
}
