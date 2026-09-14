import { useMemo } from 'react'
import { fitted, pointAt, runsFor } from '../lib/lap.js'
import { number } from '../lib/format.js'

/**
 * A traced lap, drawn the one way this site draws laps.
 *
 * The atlas had the good renderer - corner radius in five bands, a marker
 * that walks the lap - and the circuit page had the flattest drawing of the
 * same asset, one black line from a second stitcher. Now both call this.
 * Every pixel is a fact the geometry holds: the trace, the radius at each
 * point, and the direction the register states. There is no start/finish
 * marker because neither database has that coordinate; the arrow shows the
 * direction of travel at an arbitrary point instead.
 *
 * `lap` is buildLap()'s result. `runs` may be supplied by a caller that has
 * already memoised them; `at` is a fraction along the lap for the marker, or
 * null for none.
 */
export default function LapFigure({ lap, runs: given, at = null, colour = true, style, ...rest }) {
  const runs = useMemo(() => given ?? runsFor(lap, colour), [given, lap, colour])
  const { row, shape } = lap
  const arrow = useMemo(() => {
    if (!lap.complete || !row.direction) return null
    const a = pointAt(shape, 0.12)
    const b = pointAt(shape, 0.126)
    return { x: a.x, y: a.y, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
  }, [lap, row.direction, shape])
  const marker = at === null ? null : pointAt(shape, at)
  return (
    <svg
      className="lapfigure"
      viewBox={fitted(shape)}
      role="img"
      aria-label={`Traced centreline of ${row.name ?? 'this circuit'}, ${row.measured_km} km over ${number(row.node_count)} points${
        row.direction ? `, raced ${row.direction}` : ''
      }`}
      style={style}
      {...rest}
    >
      {runs.map((run, i) => (
        <path
          key={i}
          d={run.d}
          fill="none"
          stroke={run.stroke}
          strokeWidth={run.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: run.width }}
        />
      ))}
      {arrow && (
        <polygon
          points="-42,-30 46,0 -42,30"
          transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
          fill="var(--ink)"
          stroke="var(--stage)"
          strokeWidth="10"
          strokeLinejoin="round"
        />
      )}
      {marker && (
        <>
          <circle cx={marker.x} cy={marker.y} r="70" fill="var(--accent)" opacity="0.16" />
          <circle cx={marker.x} cy={marker.y} r="30" fill="var(--accent)" stroke="var(--panel)" strokeWidth="9" />
        </>
      )}
    </svg>
  )
}
