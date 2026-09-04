import { useState } from 'react'
import { linear, zeroAxis } from './scales.js'
import { barPath, thickness } from './marks.js'
import { Tooltip, TipRow } from './Figure.jsx'

const M = { top: 8, right: 52, bottom: 26, left: 8 }
const ROW = 26

/**
 * Magnitude across named categories, ranked.
 *
 * Horizontal, because the categories are long names rather than short labels —
 * turning the page sideways beats turning the labels sideways. The height
 * comes from the row count so the axis band is always inside the figure.
 */
export default function BarChart({
  width,
  data,
  x,
  y,
  labelWidth = 190,
  formatValue = String,
  label,
}) {
  const [active, setActive] = useState(null)

  // See LineChart: with no rows the plot has no height and no scale.
  if (data.length === 0) return <p className="muted">Nothing to plot.</p>

  const left = M.left + labelWidth
  const plotW = Math.max(width - left - M.right, 10)
  const plotH = data.length * ROW
  const height = plotH + M.top + M.bottom

  const xAxis = zeroAxis(data.map(y), Math.max(2, Math.floor(plotW / 150)))
  const sx = linear(xAxis.domain, [left, left + plotW])
  const h = thickness(ROW)

  return (
    <div className="chart">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. ${data.length} bars. Full values in the table below.`}
      >
        <g aria-hidden="true">
          {xAxis.ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + plotH} />
              <text className="tick" x={sx(t)} y={height - 8} textAnchor="middle">
                {formatValue(t)}
              </text>
            </g>
          ))}
          <line className="axis" x1={left} x2={left} y1={M.top} y2={M.top + plotH} />
        </g>

        {data.map((row, i) => {
          const top = M.top + i * ROW + (ROW - h) / 2
          const w = sx(y(row)) - left
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
              <rect className="hit" x={M.left} y={M.top + i * ROW} width={width - M.left} height={ROW} />
              <text className="row-label" x={left - 10} y={M.top + i * ROW + ROW / 2} dy="0.32em" textAnchor="end">
                {x(row)}
              </text>
              <path className="series-fill" d={barPath(left, top, w, h)} />
              {/* Outside the bar end, never inside: a short bar cannot hold a
                  label, and a clipped number is worse than none. */}
              <text
                className="cap-label"
                x={sx(y(row)) + 8}
                y={M.top + i * ROW + ROW / 2}
                dy="0.32em"
              >
                {formatValue(y(row))}
              </text>
            </g>
          )
        })}
      </svg>

      {active !== null && (
        <Tooltip x={sx(y(data[active]))} y={M.top + active * ROW + ROW / 2} width={width}>
          <TipRow label={x(data[active])} value={formatValue(y(data[active]))} />
        </Tooltip>
      )}
    </div>
  )
}
