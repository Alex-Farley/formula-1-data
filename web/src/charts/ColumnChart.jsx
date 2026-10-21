import { useState } from 'react'
import { columnLayout } from './columnChart.js'
import { ownColour } from './own.js'
import { seriesColour } from './palette.js'
import Tooltip from './Tooltip.jsx'
import { useMeasure } from './useMeasure.js'

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
  // The entity whose chart this is, where there is one: its colourForEntry()
  // result, so a constructor's wins are drawn in the constructor's colour
  // rather than in slot one of the shared palette (VD-34). Null on every
  // chart that belongs to no single entity - the home page's, the quality
  // page's - which keep the palette.
  colour = null,
  // Whole-number ticks for a count; a wins axis ticked at 2.5 is an axis
  // that lies (web/README.md says so, and scales.js already supports it).
  integer = false,
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState(null)
  const own = ownColour(colour)

  // The geometry is charts/columnChart.js's, which the static page draws
  // from too (VD-73), so the two halves place every column alike.
  const layout = columnLayout({ data, width, height, format, labelEvery, labelPeak, integer })

  if (!layout) return null
  const { x, y } = layout

  const paint = own.paint ?? seriesColour(0)

  return (
    // The class and the properties go on the HOLDER, not the <svg>: the
    // tooltip is a sibling of the drawing, and a swatch in one colour beside
    // columns in another is a tooltip about some other chart.
    <div className={`plot-holder${own.className ? ` ${own.className}` : ''}`} style={own.style} ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {layout.yTicks.map((tick) => (
          <g key={tick.value}>
            <line className="grid-line" x1={layout.left} x2={layout.right} y1={tick.y} y2={tick.y} />
            <text className="axis-text" x={layout.labelX} y={tick.y} textAnchor="end" dominantBaseline="middle">
              {tick.text}
            </text>
          </g>
        ))}

        {layout.columns.map((column) => {
          const { d } = column
          return (
            <g
              key={d.key}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
            >
              {/* A hit target the full step wide, the gap either side
                  included: a 12px column is not something a pointer should
                  have to land on exactly, and the targets meet, so a chart
                  of many seasons keeps each one as wide as it can (§7's
                  minimum mark width, VD-84). */}
              <rect
                x={column.hit.x}
                y={column.hit.y}
                width={column.hit.width}
                height={column.hit.height}
                fill="transparent"
              />
              <path d={column.path} fill={paint} opacity={hover && hover.key !== d.key ? 0.55 : 1} />
              {column.value !== null && (
                <text className="value-text" x={column.centre} y={column.top - 6} textAnchor="middle">
                  {column.value}
                </text>
              )}
              {column.label !== null && (
                <text className="axis-text" x={column.centre} y={layout.tickY} textAnchor="middle">
                  {column.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Over the column's top, and held inside the plot (charts/Tooltip.jsx):
          centred, the box over the first or last column ran out of the
          figure, which clips it (IX-44). */}
      {hover && (
        <Tooltip x={x.centre(hover.key)} y={y(Math.max(0, hover.value))} onDismiss={() => setHover(null)} role="status">
          {/* `||`, not `??`: an empty label is how a caller suppresses an axis
              tick it does not want drawn, and the tooltip still needs a
              heading. On the home page that is nine columns in ten. */}
          <b>{hover.label || hover.key}</b>
          <span className="row">
            <i style={{ background: paint }} aria-hidden="true" />
            {format(hover.value)}
            {hover.note ? ` · ${hover.note}` : ''}
          </span>
        </Tooltip>
      )}
    </div>
  )
}
