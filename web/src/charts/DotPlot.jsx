import { useState } from 'react'
import { linear, ticks } from './scales.js'
import { seriesColour } from './palette.js'
import { useMeasure } from './useMeasure.js'

const M = { top: 16, right: 14, bottom: 30, left: 40 }

/**
 * One mark per event: a season of results, round by round.
 *
 * Finishing position is drawn with 1 at the top, because that is where a
 * classification puts it and an axis that runs the other way reads as a chart
 * of how badly someone did. Rounds where a driver was entered but not
 * classified have no y value at all and are not plotted — the point of this
 * database is that a missing result is missing, not zero, and a dot on the
 * floor would say "last".
 */
export default function DotPlot({
  data,
  height = 220,
  yMax,
  invert = true,
  format = (v) => String(v),
  formatX = (v) => String(v),
  label,
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState(null)
  const plotted = data.filter((d) => typeof d.y === 'number' && Number.isFinite(d.y))
  if (plotted.length === 0) return null

  const xs = data.map((d) => d.x)
  const top = yMax ?? Math.max(...plotted.map((d) => d.y))
  const x = linear([Math.min(...xs), Math.max(...xs)], [M.left, width - M.right])
  const y = invert
    ? linear([1, top], [M.top, height - M.bottom])
    : linear([0, top], [height - M.bottom, M.top])

  return (
    <div className="plot-holder" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {ticks([1, top], 4, { integer: true })
          .filter((v) => v >= 1)
          .map((value) => (
            <g key={value}>
              <line className="grid-line" x1={M.left} x2={width - M.right} y1={y(value)} y2={y(value)} />
              <text className="axis-text" x={M.left - 8} y={y(value)} textAnchor="end" dominantBaseline="middle">
                {format(value)}
              </text>
            </g>
          ))}

        {ticks(x.domain, Math.max(2, Math.floor(width / 90)), { integer: true }).map((value) => (
          <text key={value} className="axis-text" x={x(value)} y={height - M.bottom + 15} textAnchor="middle">
            {formatX(value)}
          </text>
        ))}

        {plotted.map((d) => (
          <circle
            key={`${d.x}-${d.y}-${d.label ?? ''}`}
            className="mark-ring"
            cx={x(d.x)}
            cy={y(d.y)}
            r={hover === d ? 6 : 4.5}
            fill={seriesColour(0)}
            onMouseEnter={() => setHover(d)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {hover && (
        <div
          className="tooltip"
          style={{ left: `${(x(hover.x) / width) * 100}%`, top: y(hover.y) }}
          role="status"
        >
          <b>{hover.label ?? formatX(hover.x)}</b>
          <span className="row">
            <i style={{ background: seriesColour(0) }} aria-hidden="true" />
            {hover.note ?? format(hover.y)}
          </span>
        </div>
      )}
    </div>
  )
}
