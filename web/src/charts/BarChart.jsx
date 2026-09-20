import { useState } from 'react'
import { linear, niceDomain } from './scales.js'
import { ownColour } from './own.js'
import { seriesColour } from './palette.js'
import { useMeasure } from './useMeasure.js'

/**
 * A ranked list, drawn as lengths.
 *
 * Horizontal because the categories are names — a driver, a constructor, a
 * circuit — and a name reads along the row rather than rotated under a column.
 * The value rides the tip of each bar, so no axis is needed at all.
 *
 * A datum may carry its own `colour` (AF-53), a colourForEntry() result, as a
 * DotPlot point does: every bar here is a different entity, so the colour is
 * per bar and there is no whole-chart `colour` prop to give. Each bar sits in
 * a `.livery-series` group of its own and reads the {light, dark} pair rather
 * than the flat mark base (charts/own.js). A bar without one falls back to the
 * neutral series colour — and whether to hand out colours at all when only
 * some bars can have one is the CALLER's decision, under the season page's
 * rule that a chart wears liveries only when every mark has one.
 */
const ROW = 27
const THICKNESS = 14
const LABEL_WIDTH = 168

export default function BarChart({ data, format = (v) => v.toLocaleString('en-GB'), label }) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState(null)
  if (data.length === 0) return null

  const height = data.length * ROW + 8
  const valueRoom = 54
  const x = linear(niceDomain(data.map((d) => d.value)), [LABEL_WIDTH, Math.max(LABEL_WIDTH + 40, width - valueRoom)])
  const radius = 4

  return (
    <div className="plot-holder" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {data.map((d, i) => {
          const y = 4 + i * ROW + (ROW - THICKNESS) / 2
          const end = x(d.value)
          const start = x(0)
          const long = Math.max(end - start, 1)
          // The class and the properties go on the bar's own group: the label
          // and the value beside it paint --ink and --ink-soft, so only the
          // path below reads --livery.
          const own = ownColour(d.colour)
          return (
            <g
              key={d.key}
              className={own.className}
              style={own.style}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
            >
              <rect x="0" y={4 + i * ROW} width={width} height={ROW} fill="transparent" />
              <text
                className="axis-text"
                x={LABEL_WIDTH - 10}
                y={y + THICKNESS / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--ink)"
                style={{ fontSize: 12.5 }}
              >
                {d.label ?? d.key}
              </text>
              <path
                d={`M${start},${y} L${start + long - radius},${y} Q${start + long},${y} ${start + long},${y + radius}
                    L${start + long},${y + THICKNESS - radius} Q${start + long},${y + THICKNESS} ${start + long - radius},${y + THICKNESS}
                    L${start},${y + THICKNESS} Z`}
                fill={own.paint ?? seriesColour(0)}
                opacity={hover && hover.key !== d.key ? 0.55 : 1}
              />
              <text
                className="value-text"
                x={start + long + 8}
                y={y + THICKNESS / 2}
                dominantBaseline="middle"
              >
                {format(d.value)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
