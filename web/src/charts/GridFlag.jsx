import { GRID_FLAG_HEADS, GRID_FLAG_WIDTH, crossPath, gridFlagLayout } from './gridFlag.js'
import { useMeasure } from './useMeasure.js'

/**
 * Grid to flag (PD-30), drawn at the width it occupies. The geometry is
 * charts/gridFlag.js's, which scripts/prerender.js draws from too, so the
 * markup here and gridFlagSvg() there are the same elements with the same
 * classes - the smoke suite compares them - and a change to one is a change
 * to both. There is no hover: every value a line carries is printed beside
 * it, and the table under the figure has them all.
 */
export default function GridFlag({ entries, label }) {
  const [ref, width] = useMeasure(GRID_FLAG_WIDTH)
  const layout = gridFlagLayout(entries, width)
  if (!layout) return null
  const { height, cars } = layout
  return (
    <div className="plot-holder" ref={ref}>
      <svg className="grid-flag" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {layout.ticks.map((t) => (
          <g key={t.value}>
            <line className="grid-line" x1={t.x} x2={t.x} y1={layout.top} y2={layout.bottom} />
            <text className="axis-text" x={t.x} y={layout.tickY} textAnchor="middle">
              {t.value}
            </text>
          </g>
        ))}
        <text className="axis-text" x={(layout.start + layout.finish) / 2} y={layout.axisY} textAnchor="middle">
          {GRID_FLAG_HEADS.axis}
        </text>
        <text className="axis-text" x={layout.gridX} y={layout.headY} textAnchor="end">
          {GRID_FLAG_HEADS.grid}
        </text>
        <text className="axis-text" x={layout.labelX} y={layout.headY}>
          {GRID_FLAG_HEADS.result}
        </text>
        {cars.map((car) => (
          <g key={car.key} className={car.out ? 'flag-car flag-out' : 'flag-car'}>
            <text className="axis-text" x={layout.gridX} y={car.y1} textAnchor="end" dominantBaseline="middle">
              {car.grid}
            </text>
            <line className="flag-line" x1={car.x1} y1={car.y1} x2={car.x2} y2={car.y2} />
            <circle className="flag-start" cx={car.x1} cy={car.y1} r="2.5" />
            {car.leader && <line className="flag-leader" x1={car.leader.from} y1={car.y2} x2={car.leader.to} y2={car.y2} />}
            {car.out ? (
              <path className="flag-cross" d={crossPath(car.x2, car.y2)} />
            ) : (
              <circle className="flag-end" cx={car.x2} cy={car.y2} r="2.5" />
            )}
            <text className="axis-text flag-result" x={layout.labelX} y={car.y2} dominantBaseline="middle">
              {car.result}
            </text>
            <text className="flag-name" x={layout.nameX} y={car.y2} dominantBaseline="middle">
              {car.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
