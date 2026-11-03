import { columnLayout } from './columnChart.js'
import { ownColour } from './own.js'
import { INK, MARK } from './palette.js'
import Tooltip from './Tooltip.jsx'
import { useChartKeys } from './useChartKeys.js'
import { useMeasure } from './useMeasure.js'

/**
 * A magnitude per category, measured from a zero baseline.
 *
 * Columns are capped at 24px and the leftover in each slot is left as air —
 * a bar that fills its slot has no gap to separate it from its neighbour, and
 * the gap is what does the separating. Rounded at the data end only: the
 * baseline end is square because that is where the measurement starts.
 *
 * The colour (VD-94; charts/palette.js has the order): the owner's, where the
 * chart has one, and ink where it has none. A datum may carry `mark`, drawn
 * in the accent - the one value the page states - and `print`, which prints
 * its value over it (charts/columnChart.js). A datum may instead be `hollow`:
 * outlined in ink and unfilled, for a column that is not a measurement of the
 * same kind as the rest - the home page's calendars, which are not results.
 * Each carries a second cue beside the colour: the printed value, the fill.
 *
 * The chart is one tab stop, as DotPlot is (charts/useChartKeys.js, AX-32):
 * on keyboard focus it reads the first column, the arrow keys step along,
 * Home and End jump, and Escape lets go. What is read goes to a status
 * region that is always in the document; the box is the same words, hidden
 * from it.
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
  // page's - which are drawn in ink.
  colour = null,
  // Whole-number ticks for a count; a wins axis ticked at 2.5 is an axis
  // that lies (web/README.md says so, and scales.js already supports it).
  integer = false,
}) {
  const [ref, width] = useMeasure()
  const own = ownColour(colour)

  // The geometry is charts/columnChart.js's, which the static page draws
  // from too (VD-73), so the two halves place every column alike.
  const layout = columnLayout({ data, width, height, format, labelEvery, labelPeak, integer })
  // An index into the columns, in the order they are drawn.
  const { active, setActive, keys } = useChartKeys(layout ? layout.columns.length : 0)

  if (!layout) return null
  const { x, y } = layout
  const hover = active !== null ? layout.columns[active].d : null

  // The owner's colour outranks `mark`, as in BarChart: a chart in liveries
  // takes no accent (charts/palette.js).
  const paint = (d) => (d.hollow ? 'none' : (own.paint ?? (d.mark ? MARK : INK)))
  // `||`, not `??`: an empty label is how a caller suppresses an axis tick it
  // does not want drawn, and the box still needs a heading. On the home page
  // that is nine columns in ten.
  const heading = (d) => d.label || d.key
  const said = hover ? `${heading(hover)}: ${format(hover.value)}${hover.note ? ` · ${hover.note}` : ''}` : ''

  return (
    // The class and the properties go on the HOLDER, not the <svg>: the
    // tooltip is a sibling of the drawing, and a swatch in one colour beside
    // columns in another is a tooltip about some other chart.
    <div className={`plot-holder${own.className ? ` ${own.className}` : ''}`} style={own.style} ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: one tab stop that reaches every column by the arrow keys, a keyboard's way to what hover shows (AX-32)
        tabIndex={0}
        {...keys}
      >
        {layout.yTicks.map((tick) => (
          <g key={tick.value}>
            <line className="grid-line" x1={layout.left} x2={layout.right} y1={tick.y} y2={tick.y} />
            <text className="axis-text" x={layout.labelX} y={tick.y} textAnchor="end" dominantBaseline="middle">
              {tick.text}
            </text>
          </g>
        ))}

        {layout.columns.map((column, i) => {
          const { d } = column
          return (
            <g key={d.key} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
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
              <path
                className={d.hollow ? 'column-hollow' : undefined}
                d={column.path}
                fill={paint(d)}
                opacity={hover && hover.key !== d.key ? 0.55 : 1}
              />
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
      <p className="sr-only" role="status">
        {said}
      </p>
      {hover && (
        <Tooltip x={x.centre(hover.key)} y={y(Math.max(0, hover.value))} onDismiss={() => setActive(null)} aria-hidden="true">
          <b>{heading(hover)}</b>
          <span className="row">
            {hover.hollow ? (
              <i className="swatch-hollow" aria-hidden="true" />
            ) : (
              <i style={{ background: paint(hover) }} aria-hidden="true" />
            )}
            {format(hover.value)}
            {hover.note ? ` · ${hover.note}` : ''}
          </span>
        </Tooltip>
      )}
    </div>
  )
}
