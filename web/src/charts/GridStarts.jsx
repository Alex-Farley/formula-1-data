import { ownColour } from './own.js'
import { dotStrip, gridDiagram } from './gridStarts.js'
import { startTitle } from '../queries/circuit.js'

/**
 * Where winners start (AF-133): the starting grid, and its phone form, the
 * dot strip, both drawn and one shown by app.css - the grid from 768 px,
 * the strip below - so that the static page, which scripts/prerender.js
 * draws from the same layouts, is this markup at every width.
 * charts/gridStarts.js says what each part is.
 *
 * A dot wears its winning team's colour as a chart series does (the
 * {light, dark} pair, charts/own.js) and is hollow, outlined in ink, where
 * the team has none on record - never a guessed colour. Each dot names its
 * race, winner and team in its tooltip, and the table under the figure
 * carries every one of them, so the colour is never the only cue.
 */
function Dot({ dot }) {
  const own = ownColour(dot.race.colour)
  return (
    <circle
      className={own.className ?? 'start-dot-none'}
      style={own.style}
      cx={dot.cx}
      cy={dot.cy}
      r={dot.r}
      fill={own.paint ?? 'none'}
    >
      <title>{startTitle(dot.race)}</title>
    </circle>
  )
}

export default function GridStarts({ races, label }) {
  const grid = gridDiagram(races)
  const strip = dotStrip(races)
  if (!grid || !strip) return null
  return (
    <div className="plot-holder">
      <svg
        className="grid-starts grid-starts-grid"
        width={grid.width}
        height={grid.height}
        viewBox={`0 0 ${grid.width} ${grid.height}`}
        role="img"
        aria-label={label}
      >
        {grid.boxes.map((box) => (
          <g key={box.slot}>
            <rect className="start-box" x={box.x} y={box.y} width={box.width} height={box.height} rx="3" />
            <text className="axis-text" x={box.labelX} y={box.labelY} textAnchor="middle">
              {box.slot}
            </text>
            {box.count !== null && (
              <text className="value-text" x={box.labelX} y={box.y + box.height / 2} textAnchor="middle" dominantBaseline="middle">
                {box.count}
              </text>
            )}
            {box.dots.map((dot) => (
              <Dot key={dot.race.key} dot={dot} />
            ))}
          </g>
        ))}
      </svg>
      <svg
        className="grid-starts grid-starts-strip"
        width={strip.width}
        height={strip.height}
        viewBox={`0 0 ${strip.width} ${strip.height}`}
        role="img"
        aria-label={label}
      >
        <line className="start-baseline" x1="0" x2={strip.width} y1={strip.baseline} y2={strip.baseline} />
        {strip.columns.map((column) => (
          <g key={column.slot}>
            <text className="axis-text" x={column.x} y={column.labelY} textAnchor="middle">
              {column.slot}
            </text>
            {column.bar && (
              <>
                <rect className="start-bar" x={column.bar.x} y={column.bar.y} width={column.bar.width} height={column.bar.height} rx="3" />
                <text className="value-text" x={column.x} y={column.countY} textAnchor="middle">
                  {column.count}
                </text>
              </>
            )}
            {column.dots.map((dot) => (
              <Dot key={dot.race.key} dot={dot} />
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}
