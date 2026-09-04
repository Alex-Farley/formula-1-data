import { useState } from 'react'
import DataTable from '../components/DataTable.jsx'
import useMeasure from './useMeasure.js'

/**
 * The frame every chart sits in: a title, the plot, and a table view of the
 * same numbers.
 *
 * The table is not a nicety. A tooltip enhances but never gates — every value
 * a chart shows has to be reachable without a pointer, and the table is that
 * path for screen readers, for keyboard users, and for anyone who wants the
 * figure rather than the shape.
 */
export default function Figure({ title, subtitle, note, table, children }) {
  const [ref, width] = useMeasure()
  const [showTable, setShowTable] = useState(false)

  return (
    <figure className="figure">
      <figcaption>
        <h3>{title}</h3>
        {subtitle && <p className="figure-sub">{subtitle}</p>}
      </figcaption>

      <div className="plot" ref={ref}>
        {width > 0 && children(width)}
      </div>

      <div className="figure-foot">
        {note && <p className="note">{note}</p>}
        {table && (
          <button
            type="button"
            className="chip"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
          >
            {showTable ? 'Hide table' : 'Show table'}
          </button>
        )}
      </div>

      {showTable && table && (
        <div className="figure-table">
          <DataTable data={table.data} columns={table.columns} labels={table.labels} />
        </div>
      )}
    </figure>
  )
}

/**
 * The hover readout. The value leads and the label follows — the reader
 * already knows which series they are pointing at and wants the number.
 *
 * Content arrives as React children, so names out of the database are escaped
 * as text rather than parsed as markup.
 */
export function Tooltip({ x, y, width, children }) {
  if (x === null) return null
  // Flip to the left of the pointer near the right edge so the readout never
  // leaves the card.
  const flip = x > width - 150
  return (
    <div
      className="chart-tip"
      style={{ left: x, top: y, transform: `translate(${flip ? '-100%' : '0'}, -50%)` }}
      role="status"
    >
      {children}
    </div>
  )
}

/** A row in a tooltip: a short stroke of the series colour, then the number. */
export function TipRow({ label, value }) {
  return (
    <div className="tip-row">
      <span className="tip-key" aria-hidden="true" />
      <span className="tip-value">{value}</span>
      <span className="tip-label">{label}</span>
    </div>
  )
}
