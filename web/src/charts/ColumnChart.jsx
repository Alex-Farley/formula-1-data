import { useState } from 'react'
import { linear, zeroAxis } from './scales.js'
import { columnPath, thickness } from './marks.js'
import { Tooltip, TipRow } from './Figure.jsx'

const M = { top: 22, right: 12, bottom: 32, left: 46 }

/**
 * Magnitude across a handful of ordered categories.
 *
 * One series, one colour for every column: the height already encodes the
 * value, so shading it by size too would spend the only free channel on
 * information the chart is already showing.
 */
export default function ColumnChart({
  width,
  height = 250,
  data,
  x,
  y,
  formatY = String,
  formatValue = formatY,
  label,
}) {
  const [active, setActive] = useState(null)

  // See LineChart: with no rows the band width divides by zero.
  if (data.length === 0) return <p className="muted">Nothing to plot.</p>

  const plotW = Math.max(width - M.left - M.right, 10)
  const plotH = height - M.top - M.bottom

  const band = plotW / data.length
  const w = thickness(band)
  const yAxis = zeroAxis(data.map(y), 4)
  const sy = linear(yAxis.domain, [M.top + plotH, M.top])

  const baseline = sy(sy.domain[0])

  return (
    <div className="chart">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. ${data.length} columns. Full values in the table below.`}
      >
        <g aria-hidden="true">
          {yAxis.ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={M.left} x2={M.left + plotW} y1={sy(t)} y2={sy(t)} />
              <text className="tick" x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end">
                {formatY(t)}
              </text>
            </g>
          ))}
          <line className="axis" x1={M.left} x2={M.left + plotW} y1={baseline} y2={baseline} />
        </g>

        {data.map((row, i) => {
          const cx = M.left + band * i + band / 2
          const top = sy(y(row))
          const h = baseline - top
          return (
            <g
              key={x(row)}
              className={`mark${active === i ? ' is-active' : ''}`}
              tabIndex={0}
              role="img"
              aria-label={`${x(row)}: ${formatValue(y(row))}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              {/* The hit area is the whole band, not the painted column: a
                  4px-wide target is one nobody lands on. */}
              <rect className="hit" x={M.left + band * i} y={M.top} width={band} height={plotH} />
              <path className="series-fill" d={columnPath(cx - w / 2, top, w, h)} />
              <text className="cap-label" x={cx} y={top - 7} textAnchor="middle">
                {formatValue(y(row))}
              </text>
              <text className="tick" x={cx} y={height - 10} textAnchor="middle">
                {x(row)}
              </text>
            </g>
          )
        })}
      </svg>

      {active !== null && (
        <Tooltip
          x={M.left + band * active + band / 2}
          y={sy(y(data[active]))}
          width={width}
        >
          <TipRow label={`${label} · ${x(data[active])}`} value={formatValue(y(data[active]))} />
        </Tooltip>
      )}
    </div>
  )
}
