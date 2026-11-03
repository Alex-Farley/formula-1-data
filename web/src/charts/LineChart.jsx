import { lineLayout } from './lineChart.js'
import { seriesDash, slotColour } from './palette.js'
import { LineKey } from './Figure.jsx'
import Tooltip from './Tooltip.jsx'
import { useChartKeys } from './useChartKeys.js'
import { useMeasure } from './useMeasure.js'

/**
 * One or more series over a continuous x — years, rounds, laps.
 *
 * Direct labels ride the end of each line, which is what makes a legend a
 * confirmation rather than a lookup table. When the lines converge at the
 * right edge the labels would collide, so past three series this chart is the
 * wrong picture and the caller should facet instead: three is the cap the
 * palette validates to anyway.
 *
 * A series may carry `colour` - a {light, dark} pair from lib/liveries.js,
 * rendering the mark's lead so the line and the team's mark read as one
 * colour (AF-57). With a colour the <g> wears the pair as custom properties
 * and the strokes read --livery, which styles/app.css resolves per theme;
 * without one a lone series is drawn in ink, and each of several takes its
 * slot in the neutral palette (VD-94; charts/palette.js).
 *
 * Every series also takes its slot's dash - solid, dashed, dotted - whatever
 * its colour (AX-16). A dropped end label leaves the legend as the key to
 * that line, and a key in hue alone is not one 1.4.1 allows; the caller's
 * Figure takes `marks="line"` so the legend draws the same strokes.
 *
 * The chart is one tab stop, as DotPlot is (charts/useChartKeys.js, AX-32):
 * on keyboard focus it reads the first x any series has a point at - a
 * round, a season - the arrow keys step along, Home and End jump, and Escape lets
 * go. What is read goes to a status region that is always in the document;
 * the box is the same words, hidden from it.
 */
const seriesStyle = (s) => (s.colour ? { '--livery-light': s.colour.light, '--livery-dark': s.colour.dark } : undefined)
export default function LineChart({
  series,
  height = 240,
  format = (v) => v.toLocaleString('en-GB'),
  formatX = (v) => String(v),
  zero = true,
  label,
}) {
  const [ref, width] = useMeasure()
  const seriesPaint = (s, i) => (s.colour ? 'var(--livery)' : slotColour(i, series.length))

  // The geometry, the crosshair's columns and which line ends carry a label
  // are charts/lineChart.js's, which the static page draws from too (VD-73).
  const layout = lineLayout({ series, width, height, format, formatX, zero })
  // An index into the crosshair's columns, which run in x order.
  const { active, setActive, keys } = useChartKeys(layout ? layout.columns.length : 0)

  if (!layout) return null
  const { x, y, columns } = layout
  const hover = active !== null ? columns[active] : null
  // What each series reads at the held x; a series with no point there is
  // left out, in the box and in what is announced alike.
  const read =
    hover === null
      ? []
      : series.flatMap((s, i) => {
          const point = s.points.find((p) => p.x === hover)
          return point ? [{ s, i, point }] : []
        })
  const said =
    hover === null
      ? ''
      : `${formatX(hover)}: ${read.map(({ s, point }) => (series.length > 1 ? `${s.name} ${format(point.y)}` : format(point.y))).join(', ')}`

  const onMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const at = ((event.clientX - box.left) / box.width) * width
    let best = null
    columns.forEach((value, i) => {
      const distance = Math.abs(x(value) - at)
      if (!best || distance < best.distance) best = { i, distance }
    })
    setActive(best && best.distance < 60 ? best.i : null)
  }

  return (
    <div className="plot-holder" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={onMove}
        onMouseLeave={() => setActive(null)}
        role="img"
        aria-label={label}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: one tab stop that reaches every round by the arrow keys, a keyboard's way to what hover shows (AX-32)
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

        {layout.xTicks.map((tick) => (
          <text key={tick.value} className="axis-text" x={tick.x} y={layout.tickY} textAnchor="middle">
            {tick.text}
          </text>
        ))}

        {hover !== null && (
          <line className="grid-line" x1={x(hover)} x2={x(hover)} y1={layout.top} y2={layout.bottom} />
        )}

        {layout.lines.map(({ s, i, points, path, end }) => {
          return (
            <g key={s.name} className={s.colour ? 'livery-series' : undefined} style={seriesStyle(s)}>
              <path
                d={path}
                fill="none"
                stroke={seriesPaint(s, i)}
                strokeWidth="2"
                strokeDasharray={seriesDash(i)}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {end && (
                <>
                  <circle className="mark-ring" cx={end.x} cy={end.y} r="4" fill={seriesPaint(s, i)} />
                  {end.text !== null && (
                    <text className="value-text" x={end.x + 9} y={end.y} dominantBaseline="middle">
                      {end.text}
                    </text>
                  )}
                </>
              )}
              {hover !== null &&
                points
                  .filter((p) => p.x === hover)
                  .map((p) => (
                    <circle
                      key={`${s.name}-${p.x}`}
                      className="mark-ring"
                      cx={x(p.x)}
                      cy={y(p.y)}
                      r="4.5"
                      fill={seriesPaint(s, i)}
                    />
                  ))}
            </g>
          )
        })}
      </svg>

      {/* Beside the hover line rather than over it, so it covers none of the
          marks it reads, and held inside the plot (charts/Tooltip.jsx):
          risen above the plot's top, it ran out of the figure, which clips
          it, at every width (IX-44). */}
      <p className="sr-only" role="status">
        {said}
      </p>
      {hover !== null && (
        <Tooltip x={x(hover)} y={layout.top} place="beside" onDismiss={() => setActive(null)} aria-hidden="true">
          <b>{formatX(hover)}</b>
          {read.map(({ s, i, point }) => (
            <span className="row" key={s.name}>
              <LineKey index={i} count={series.length} colour={s.colour} />
              {series.length > 1 && `${s.name} `}
              <b style={{ display: 'inline', color: 'var(--ink)' }}>{format(point.y)}</b>
            </span>
          ))}
        </Tooltip>
      )}
    </div>
  )
}
