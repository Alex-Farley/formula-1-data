import { useState } from 'react'
import { MARGIN_GAP, barLayout } from './barChart.js'
import { ownColour } from './own.js'
import { INK, MARK } from './palette.js'
import { useMeasure } from './useMeasure.js'
import { PHONE } from '../lib/table.js'
import { useMatches } from '../lib/useMatches.js'

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
 * than the flat mark base (charts/own.js). A bar without one is drawn in ink,
 * and one that carries `mark` in the accent: the record's holder, say, on a
 * chart whose page states the record (VD-94; charts/palette.js has the
 * order). Every bar's name and value are printed beside it, so the accent is
 * never the only thing that says which bar it is.
 *
 * A datum may instead be `hollow` (AF-55), the bar form of DotPlot's hollow
 * point and the same convention: outlined and unfilled, in ink rather than in
 * any colour, for an entity the record holds no colour for. A bar cannot be
 * withheld the way `.livery-none` withholds a table mark - the bar IS the
 * figure - so it is drawn as visibly a non-colour instead, which lets a chart
 * keep the colours it has rather than dropping all of them because some
 * entity falls in the declared 1968-2009 gap. Whether to mix at all stays the
 * CALLER's decision; see Records.jsx.
 *
 * Below the tablet breakpoint each name sits above its bar and the bar takes
 * the whole width (VD-114), and the one bar that alone leads says by how
 * much, "15 clear", after its value, where that leaves the bars their room;
 * charts/barChart.js lays both out.
 */

export default function BarChart({ data, format = (v) => v.toLocaleString('en-GB'), label }) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState(null)
  const stacked = useMatches(PHONE)
  const layout = barLayout({ data, width, stacked, format })
  if (!layout) return null

  return (
    <div className="plot-holder" ref={ref}>
      <svg viewBox={`0 0 ${width} ${layout.height}`} role="img" aria-label={label}>
        {layout.bars.map((bar) => {
          const { d } = bar
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
              <rect x="0" y={bar.rowTop} width={width} height={layout.row} fill="transparent" />
              <text
                className="axis-text bar-label"
                x={bar.labelX}
                y={bar.labelY}
                textAnchor={bar.labelAnchor}
                dominantBaseline="middle"
                fill="var(--ink)"
              >
                {d.label ?? d.key}
              </text>
              <path
                className={d.hollow ? 'bar-hollow' : undefined}
                d={bar.path}
                fill={d.hollow ? 'none' : (own.paint ?? (d.mark ? MARK : INK))}
                opacity={hover && hover.key !== d.key ? 0.55 : 1}
              />
              <text className="value-text" x={bar.valueX} y={bar.middle} dominantBaseline="middle">
                {format(d.value)}
                {bar.margin && (
                  <tspan className="bar-margin" dx={MARGIN_GAP}>
                    {bar.margin}
                  </tspan>
                )}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
