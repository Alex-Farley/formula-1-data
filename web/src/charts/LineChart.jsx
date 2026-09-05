import { useMemo, useState } from 'react'
import { linear, niceDomain, ticks } from './scales.js'
import { seriesColour } from './palette.js'
import { useMeasure } from './useMeasure.js'

const M = { top: 14, right: 58, bottom: 26, left: 44 }

/**
 * One or more series over a continuous x — years, rounds, laps.
 *
 * Direct labels ride the end of each line, which is what makes a legend a
 * confirmation rather than a lookup table. When the lines converge at the
 * right edge the labels would collide, so past three series this chart is the
 * wrong picture and the caller should facet instead: three is the cap the
 * palette validates to anyway.
 */
export default function LineChart({
  series,
  height = 240,
  format = (v) => v.toLocaleString('en-GB'),
  formatX = (v) => String(v),
  zero = true,
  label,
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState(null)

  const geometry = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    if (all.length === 0) return null
    const xs = all.map((p) => p.x)
    const x = linear([Math.min(...xs), Math.max(...xs)], [M.left, width - M.right])
    const y = linear(niceDomain(all.map((p) => p.y), { zero }), [height - M.bottom, M.top])
    return { x, y }
  }, [series, width, height, zero])

  if (!geometry) return null
  const { x, y } = geometry

  // One x per column of the crosshair. Series may not share every x — a
  // constructor that entered half a season has half the rounds — so the union
  // is what the pointer snaps to.
  const columns = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b)

  /**
   * Which endpoints may carry a direct label.
   *
   * Lines converge at the right-hand edge far more often than they separate —
   * a two-point championship is the whole reason to draw one of these — and
   * two labels on top of each other are worse than none. Nudging them apart
   * would detach a number from its line, so a label that would collide is
   * simply dropped: the legend names the series and the crosshair gives every
   * value on demand.
   */
  const labelled = new Set()
  const ends = series
    .map((s, i) => {
      const sorted = [...s.points].sort((a, b) => a.x - b.x)
      const last = sorted[sorted.length - 1]
      return last ? { i, y: y(last.y) } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.y - b.y)
  let previous = -Infinity
  for (const end of ends) {
    if (end.y - previous >= 15) {
      labelled.add(end.i)
      previous = end.y
    }
  }

  const onMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const at = ((event.clientX - box.left) / box.width) * width
    let best = null
    for (const value of columns) {
      const distance = Math.abs(x(value) - at)
      if (!best || distance < best.distance) best = { value, distance }
    }
    setHover(best && best.distance < 60 ? best.value : null)
  }

  return (
    <div className="plot-holder" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={label}
      >
        {ticks(y.domain, 4).map((value) => (
          <g key={value}>
            <line className="grid-line" x1={M.left} x2={width - M.right} y1={y(value)} y2={y(value)} />
            <text className="axis-text" x={M.left - 8} y={y(value)} textAnchor="end" dominantBaseline="middle">
              {format(value)}
            </text>
          </g>
        ))}

        {ticks(x.domain, Math.max(2, Math.floor(width / 110)), { integer: true }).map((value) => (
          <text
            key={value}
            className="axis-text"
            x={x(value)}
            y={height - M.bottom + 15}
            textAnchor="middle"
          >
            {formatX(value)}
          </text>
        ))}

        {hover !== null && (
          <line className="grid-line" x1={x(hover)} x2={x(hover)} y1={M.top} y2={height - M.bottom} />
        )}

        {series.map((s, i) => {
          const points = [...s.points].sort((a, b) => a.x - b.x)
          const last = points[points.length - 1]
          return (
            <g key={s.name}>
              <path
                d={points.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={seriesColour(i)}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {last && (
                <>
                  <circle className="mark-ring" cx={x(last.x)} cy={y(last.y)} r="4" fill={seriesColour(i)} />
                  {labelled.has(i) && (
                    <text className="value-text" x={x(last.x) + 9} y={y(last.y)} dominantBaseline="middle">
                      {format(last.y)}
                    </text>
                  )}
                </>
              )}
              {hover !== null &&
                points
                  .filter((p) => p.x === hover)
                  .map((p) => (
                    <circle
                      key={`${s.name}-${p.x}`}
                      className="mark-ring"
                      cx={x(p.x)}
                      cy={y(p.y)}
                      r="4.5"
                      fill={seriesColour(i)}
                    />
                  ))}
            </g>
          )
        })}
      </svg>

      {hover !== null && (
        <div
          className="tooltip"
          style={{ left: `${(x(hover) / width) * 100}%`, top: M.top }}
          role="status"
        >
          <b>{formatX(hover)}</b>
          {series.map((s, i) => {
            const point = s.points.find((p) => p.x === hover)
            if (!point) return null
            return (
              <span className="row" key={s.name}>
                <i style={{ background: seriesColour(i) }} aria-hidden="true" />
                {series.length > 1 && `${s.name} `}
                <b style={{ display: 'inline', color: 'var(--ink)' }}>{format(point.y)}</b>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
