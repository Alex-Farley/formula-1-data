import { ownColour } from './own.js'
import { INK } from './palette.js'
import { reachLayout } from './reachChart.js'
import { useMeasure } from './useMeasure.js'

/**
 * Who can still reach the leader (AF-132): a contender's points as a solid
 * bar, the most they could still score as an outlined extension of it, and
 * the leader's total as a line. charts/reachChart.js lays it out for this and
 * for the static page, and says what each part is.
 *
 * A bar wears its contender's colour where the caller gives one (the
 * {light, dark} pair, as BarChart's do) and ink where not. The extension is
 * the same colour outlined at full strength over a pale fill: the outline is
 * what carries 3:1 against the panel, and the figures beside every bar carry
 * the values, so neither the fill nor the colour is the only cue.
 */
export default function ReachChart({ data, lead, label }) {
  const [ref, width] = useMeasure()
  const layout = reachLayout({ data, lead, width })
  if (!layout) return null
  return (
    <div className="plot-holder" ref={ref}>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={label}>
        {layout.bars.map((bar) => {
          const own = ownColour(bar.d.colour)
          const paint = own.paint ?? INK
          return (
            <g key={bar.d.key} className={own.className} style={own.style}>
              <text
                className="axis-text bar-label"
                x={bar.labelX}
                y={bar.middle}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--ink)"
              >
                {bar.d.label}
              </text>
              {bar.solid && <path d={bar.solid} fill={paint} />}
              {bar.extension && <path className="reach-extension" d={bar.extension} fill={paint} stroke={paint} />}
              <text className="value-text" x={bar.valueX} y={bar.middle} dominantBaseline="middle">
                {bar.value}
              </text>
            </g>
          )
        })}
        <line className="reach-leader" x1={layout.lead.x} x2={layout.lead.x} y1={layout.lead.y1} y2={layout.lead.y2} />
        <text className="axis-text" x={layout.lead.textX} y={layout.lead.textY} textAnchor="middle">
          {layout.lead.text}
        </text>
      </svg>
    </div>
  )
}
