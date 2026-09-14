import { useState } from 'react'
import { linear, ticks } from './scales.js'
import { ownColour } from './own.js'
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
  // The entity whose chart this is (VD-34); see ColumnChart for the rule.
  colour = null,
}) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState(null)
  const own = ownColour(colour)
  const plotted = data.filter((d) => typeof d.y === 'number' && Number.isFinite(d.y))
  if (plotted.length === 0) return null

  const xs = data.map((d) => d.x)
  const top = yMax ?? Math.max(...plotted.map((d) => d.y))
  const x = linear([Math.min(...xs), Math.max(...xs)], [M.left, width - M.right])
  const y = invert
    ? linear([1, top], [M.top, height - M.bottom])
    : linear([0, top], [height - M.bottom, M.top])

  const paint = own.paint ?? seriesColour(0)

  return (
    <div className={`plot-holder${own.className ? ` ${own.className}` : ''}`} style={own.style} ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {/* P1 is the one value this chart exists to show, and a step of 2 from
            1 ticked 2, 4, 6... so the title-winning seasons sat above the top
            gridline with nothing naming their value. Force 1 in, and drop a 2
            that would crowd it. */}
        {[...new Set([1, ...ticks([1, top], 4, { integer: true }).filter((v) => v > 2), top])]
          .filter((v) => v >= 1 && v <= top)
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

        {/* A dot the caller has flagged gets a halo: on a driver's page the
            title-winning seasons were four more dots in a line of dots, told
            apart only by being at the top of an axis a reader has to read to
            know that (VD-34). The halo adds no claim the plot does not
            already make - it is drawn from `mark`, which the caller sets from
            the position it is plotting - and the figure's own table and note
            say what is ringed, so nothing here is carried by colour alone. */}
        {plotted
          .filter((d) => d.mark)
          .map((d) => (
            <circle
              key={`halo-${d.x}-${d.y}`}
              className="mark-halo"
              cx={x(d.x)}
              cy={y(d.y)}
              r={hover === d ? 10 : 8.5}
              fill="none"
              stroke={paint}
            />
          ))}
        {plotted.map((d) => (
          <circle
            key={`${d.x}-${d.y}-${d.label ?? ''}`}
            className="mark-ring"
            cx={x(d.x)}
            cy={y(d.y)}
            r={hover === d ? 6 : 4.5}
            fill={paint}
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
            <i style={{ background: paint }} aria-hidden="true" />
            {hover.note ?? format(hover.y)}
          </span>
        </div>
      )}
    </div>
  )
}
