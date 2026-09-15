import { useMemo } from 'react'
import { fitted, pointAt, runsFor } from '../lib/lap.js'
import { number } from '../lib/format.js'

/**
 * A traced lap, drawn the one way this site draws laps: one line, one
 * colour.
 *
 * Every pixel is a fact the geometry holds: the trace and the direction the
 * register states. There is no start/finish marker because neither database
 * has that coordinate; the arrow shows the direction of travel at an
 * arbitrary point instead.
 *
 * `lap` is buildLap()'s result.
 */
export default function LapFigure({ lap, style, ...rest }) {
  const runs = useMemo(() => runsFor(lap), [lap])
  const { row, shape } = lap
  const arrow = useMemo(() => {
    if (!lap.complete || !row.direction) return null
    const a = pointAt(shape, 0.12)
    const b = pointAt(shape, 0.126)
    return { x: a.x, y: a.y, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI }
  }, [lap, row.direction, shape])
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
    </svg>
  )
}
