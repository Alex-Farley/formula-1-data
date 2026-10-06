import { seasonsRacedLayout, titleRaceLayout } from './spark.js'

/**
 * The two pictures charts/spark.js lays out (VD-54), as a register's cells.
 * scripts/prerender.js's sparkSvg() draws the same elements with the same
 * classes from the same layout, and a change to one is a change to both.
 *
 * `label` is the column's `text` for the row, as the picture's <title>: its
 * accessible name and its hover text at once. Not an aria-label as well -
 * with both, SVG-AAM can make the <title> the description too, and the
 * sentence is read twice. And it is the cell's text, as the static page's is.
 */
export function TitleRaceSpark({ value, label }) {
  const layout = titleRaceLayout(value)
  if (!layout) return label
  return (
    <svg className="spark" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img">
      <title>{label}</title>
      <line className="spark-zero" x1="0" x2={layout.width} y1={layout.zero} y2={layout.zero} />
      <path className="spark-line" d={layout.line} />
      <circle className="spark-end" cx={layout.end.x} cy={layout.end.y} r="2" />
    </svg>
  )
}

export function SeasonsRacedSpark({ value, first, last, label }) {
  const layout = seasonsRacedLayout(value, first, last)
  if (!layout) return label
  return (
    <svg className="spark" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="img">
      <title>{label}</title>
      <line className="spark-track" x1="0" x2={layout.width} y1={layout.track} y2={layout.track} />
      {layout.runs.map((run) => (
        <rect key={run.x} className="spark-run" x={run.x} y={layout.bar.y} width={run.width} height={layout.bar.height} />
      ))}
    </svg>
  )
}
