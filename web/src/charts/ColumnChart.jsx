import { useMemo, useState } from 'react'
import { band, linear, niceDomain, ticks } from './scales.js'
import { seriesColour } from './palette.js'
import { useMeasure } from './useMeasure.js'

const M = { top: 16, right: 10, bottom: 30, left: 44 }
const MAX_THICKNESS = 24

/**
 * A magnitude per category, measured from a zero baseline.
 *
 * Columns are capped at 24px and the leftover in each slot is left as air —
 * a bar that fills its slot has no gap to separate it from its neighbour, and
 * the gap is what does the separating. Rounded at the data end only: the
 * baseline end is square because that is where the measurement starts.
 */
export default function ColumnChart({
  data,
  height = 230,
  format = (v) => v.toLocaleString('en-GB'),
  labelEvery = 1,
  labelPeak = true,
  label,
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState(null)

  const geometry = useMemo(() => {
    const keys = data.map((d) => d.key)
    const x = band(keys, [M.left, width - M.right], 0.28)
    const y = linear(niceDomain(data.map((d) => d.value)), [height - M.bottom, M.top])
    return { x, y, keys }
  }, [data, width, height])

  if (data.length === 0) return null
  const { x, y } = geometry
  const thickness = Math.min(x.bandwidth, MAX_THICKNESS)
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0])
  const radius = Math.min(4, thickness / 2)

  return (
    <div className="plot-holder" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {ticks(y.domain, 4).map((value) => (
          <g key={value}>
            <line className="grid-line" x1={M.left} x2={width - M.right} y1={y(value)} y2={y(value)} />
            <text className="axis-text" x={M.left - 8} y={y(value)} textAnchor="end" dominantBaseline="middle">
              {format(value)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const left = x.centre(d.key) - thickness / 2
          const top = y(Math.max(0, d.value))
          const bottom = y(0)
          const tall = Math.abs(bottom - top)
          const isPeak = labelPeak && d.key === peak.key
          return (
            <g
              key={d.key}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
            >
              {/* A hit target the full slot wide: a 12px column is not something
                  a pointer should have to land on exactly. */}
              <rect
                x={x(d.key)}
                y={M.top}
                width={x.bandwidth}
                height={height - M.bottom - M.top}
                fill="transparent"
              />
              <path
                d={`M${left},${bottom} L${left},${top + radius} Q${left},${top} ${left + radius},${top}
                    L${left + thickness - radius},${top} Q${left + thickness},${top} ${left + thickness},${top + radius}
                    L${left + thickness},${bottom} Z`}
                fill={seriesColour(0)}
                opacity={hover && hover.key !== d.key ? 0.55 : 1}
              />
              {isPeak && tall > 14 && (
                <text className="value-text" x={x.centre(d.key)} y={top - 6} textAnchor="middle">
                  {format(d.value)}
                </text>
              )}
              {i % labelEvery === 0 && (
                <text className="axis-text" x={x.centre(d.key)} y={height - M.bottom + 15} textAnchor="middle">
                  {d.label ?? d.key}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hover && (
        <div
          className="tooltip"
          style={{ left: `${(x.centre(hover.key) / width) * 100}%`, top: y(hover.value) }}
          role="status"
        >
          {/* `||`, not `??`: an empty label is how a caller suppresses an axis
              tick it does not want drawn, and the tooltip still needs a
              heading. On the home page that is nine columns in ten. */}
          <b>{hover.label || hover.key}</b>
          <span className="row">
            <i style={{ background: seriesColour(0) }} aria-hidden="true" />
            {format(hover.value)}
            {hover.note ? ` · ${hover.note}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
