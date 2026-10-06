import { STINT_HEADS, STINTS_WIDTH, stintLayout } from './stints.js'
import { useMeasure } from './useMeasure.js'

/**
 * Stint windows (PD-56), drawn at the width they occupy. The geometry is
 * charts/stints.js's, which scripts/prerender.js draws from too, so the
 * markup here and stintsSvg() there are the same elements with the same
 * classes - the smoke suite compares them - and a change to one is a change
 * to both. There is no hover: the table under the figure has every lap.
 */
export default function Stints({ entries, pits, label }) {
  const [ref, width] = useMeasure(STINTS_WIDTH)
  const layout = stintLayout(entries, pits, width)
  if (!layout) return null
  const { height, cars, bar } = layout
  return (
    <div className="plot-holder" ref={ref}>
      <svg className="stints" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {layout.ticks.map((t) => (
          <g key={t.value}>
            <line className="grid-line" x1={t.x} x2={t.x} y1={layout.top} y2={layout.bottom} />
            <text className="axis-text" x={t.x} y={layout.tickY} textAnchor="middle">
              {t.value}
            </text>
          </g>
        ))}
        <text className="axis-text" x={(layout.start + layout.finish) / 2} y={layout.axisY} textAnchor="middle">
          {STINT_HEADS.axis}
        </text>
        {cars.map((car) => (
          <g key={car.key} className={car.out ? 'stint-car stint-out' : 'stint-car'}>
            <text className="axis-text stint-result" x={layout.resultX} y={car.y} textAnchor="end" dominantBaseline="middle">
              {car.result}
            </text>
            <text className="stint-name" x={layout.nameX} y={car.y} dominantBaseline="middle">
              {car.name}
            </text>
            {car.stints.map((s) => (
              <rect key={s.x} className="stint" x={s.x} y={car.barY} width={s.width} height={bar} />
            ))}
            {car.stops.map((x, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: two stops can share a position, at a bar's end
              <line key={i} className="stint-stop" x1={x} x2={x} y1={car.barY - 3} y2={car.barY + bar + 3} />
            ))}
            {car.cross && <path className="stint-cross" d={car.cross} />}
          </g>
        ))}
      </svg>
    </div>
  )
}
