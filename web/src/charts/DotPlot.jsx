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
 *
 * A point may carry its own `colour` (AF-47): a driver's championship dots
 * each take the team of their season. Each dot and its halo then sit in a
 * `.livery-series` group of their own, reading the {light, dark} pair as a
 * whole-chart colour does (charts/own.js), and the tooltip swatch takes the
 * hovered point's. A point without one takes the chart's `colour`, and
 * failing that the neutral series colour.
 *
 * A point may instead be `hollow` (AF-55): outlined, unfilled, drawn in ink
 * rather than in any colour. That is how a chart that wears liveries draws a
 * mark the record holds no colour for - the seasons in the declared 1968-2009
 * gap - so a career crossing the boundary keeps the colours it has instead of
 * losing all of them. The objection the all-or-nothing rule existed to answer
 * - a neutral among liveries reads as a team - is met by making the mark
 * visibly a NON-colour rather than by silencing the rest: `.livery-none`'s
 * "nothing grey pretends to be a colour", on a surface where the mark cannot
 * simply be withheld because the mark is the datum. Mixing a hollow point
 * with coloured ones is the caller's decision; a chart no point of which has
 * a colour has nothing to be misread against and stays plainly neutral.
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

  // The chart's own colour, or a point's where it carries one. A hollow
  // point carries neither: it is drawn in ink by `.mark-hollow`, and takes no
  // `.livery-series` group, because there is no pair for one to resolve.
  const ownOf = (d) => (d.colour ? ownColour(d.colour) : own)
  const paintOf = (d) => ownOf(d).paint ?? seriesColour(0)

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
            <g key={`halo-${d.x}-${d.y}`} className={d.colour ? ownOf(d).className : undefined} style={d.colour ? ownOf(d).style : undefined}>
              {/* A title won inside the colour gap is both ringed and
                  hollow - Hamilton 2008 - so the ring follows the dot into
                  ink rather than ringing an uncoloured mark in a colour. */}
              <circle
                className={d.hollow ? 'mark-halo mark-halo-hollow' : 'mark-halo'}
                cx={x(d.x)}
                cy={y(d.y)}
                r={hover === d ? 10 : 8.5}
                fill="none"
                stroke={d.hollow ? undefined : paintOf(d)}
              />
            </g>
          ))}
        {plotted.map((d) => (
          <g key={`${d.x}-${d.y}-${d.label ?? ''}`} className={d.colour ? ownOf(d).className : undefined} style={d.colour ? ownOf(d).style : undefined}>
            <circle
              className={d.hollow ? 'mark-hollow' : 'mark-ring'}
              cx={x(d.x)}
              cy={y(d.y)}
              r={hover === d ? 6 : 4.5}
              fill={d.hollow ? 'none' : paintOf(d)}
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>

      {hover && (
        <div
          className="tooltip"
          style={{ left: `${(x(hover.x) / width) * 100}%`, top: y(hover.y) }}
          role="status"
        >
          <b>{hover.label ?? formatX(hover.x)}</b>
          <span className={hover.colour ? `row ${ownOf(hover).className}` : 'row'} style={hover.colour ? ownOf(hover).style : undefined}>
            {/* The swatch says what the dot says. A hollow dot's is outlined
                and unfilled, so the tooltip does not hand a colour to a
                season the record holds none for - the note beside it still
                names the team. */}
            <i
              className={hover.hollow ? 'swatch-hollow' : undefined}
              style={hover.hollow ? undefined : { background: paintOf(hover) }}
              aria-hidden="true"
            />
            {hover.note ?? format(hover.y)}
          </span>
        </div>
      )}
    </div>
  )
}
