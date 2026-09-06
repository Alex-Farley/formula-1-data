import { trackPath } from '../lib/track.js'

/**
 * A circuit's traced centreline.
 *
 * The geometry is from OpenStreetMap and is the only ODbL-licensed table in
 * this database, which is why the attribution is attached to the drawing
 * itself: wherever the shape goes, the notice goes with it.
 *
 * The measured length is shown beside the published one on purpose. Agreement
 * within two per cent is what admitted the relation as this circuit in the
 * first place — the geometry is how identity was settled, not decoration — and
 * where the two disagree, that disagreement is the finding.
 */
export default function TrackMap({ geometry, width = 640, height = 360 }) {
  const drawn = trackPath(geometry?.centreline, width, height)
  if (!drawn) return null

  const delta = geometry.delta_pct
  return (
    <figure className="photo">
      <svg
        className="trackmap"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Traced centreline of this circuit, ${geometry.measured_km} km over ${drawn.nodes} points`}
      >
        <path d={drawn.path} />
      </svg>
      <figcaption>
        Traced from OpenStreetMap relation{' '}
        <a
          href={`https://www.openstreetmap.org/relation/${geometry.osm_relation}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          {geometry.osm_relation}
        </a>{' '}
        · {drawn.nodes.toLocaleString('en-GB')} points
        {drawn.segments > 1 && ` in ${drawn.segments} segments`} · measures{' '}
        {geometry.measured_km?.toFixed(3)} km against {geometry.published_km?.toFixed(3)} km published
        {delta !== null && delta !== undefined && ` (${delta > 0 ? '+' : ''}${delta.toFixed(2)}%)`}
        <br />© OpenStreetMap contributors, {geometry.licence || 'ODbL 1.0'}.
      </figcaption>
    </figure>
  )
}
