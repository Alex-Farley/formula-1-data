import { FigurePart } from '../components/Page.jsx'
import Figure from './Figure.jsx'
import { clinchLayout } from './clinchStrip.js'
import { useMeasure } from './useMeasure.js'

/**
 * Which finishes at the next round settle the title (AF-138): a row per
 * rival still in, a cell per place they could finish, each marked by colour
 * and by symbol. charts/clinchStrip.js lays it out for this and for the
 * static page, and says what each mark is; the figure's table says each
 * cell in words.
 */
export default function ClinchStrip({ data, label }) {
  const [ref, width] = useMeasure()
  const layout = clinchLayout({ data, width })
  if (!layout) return null
  return (
    <div className="plot-holder" ref={ref}>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={label}>
        <text className="axis-text" x={layout.axis.x} y={layout.axis.y}>
          {layout.axis.text}
        </text>
        {layout.columns.map((column) => (
          <text key={column.x} className="axis-text" x={column.x} y={layout.columnY} textAnchor="middle">
            {column.text}
          </text>
        ))}
        {layout.rows.map((row) => (
          <g key={row.d.key}>
            <text className="axis-text bar-label" x={row.labelX} y={row.labelY} textAnchor="end" dominantBaseline="middle" fill="var(--ink)">
              {row.label}
            </text>
            {row.cells.map((cell) => (
              <g key={cell.place} className={cell.className}>
                {cell.rect && <rect x={cell.rect.x} y={cell.rect.y} width={cell.rect.width} height={cell.rect.height} rx="3" />}
                <path className="clinch-symbol" d={cell.symbol} />
              </g>
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}

/**
 * clinchStrips()'s answer in queries/season.js as the season page and the
 * upcoming race's print it (AF-138): each strip a figure part named for the
 * leader's finish, its numbers a table under it; or the sentence saying why
 * a round that could settle it is not drawn. Nothing where it is null.
 */
export function ClinchStrips({ clinch }) {
  if (!clinch) return null
  if (clinch.declined) return <p className="note follows">{clinch.declined}</p>
  return clinch.strips.map((strip) => (
    <FigurePart key={strip.key} title={strip.title}>
      <Figure note={strip.note} table={{ rows: strip.rows, columns: strip.columns }}>
        <ClinchStrip data={strip.data} label={strip.label} />
      </Figure>
    </FigurePart>
  ))
}
