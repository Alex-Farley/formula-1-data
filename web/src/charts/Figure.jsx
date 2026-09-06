import DataTable from '../components/DataTable.jsx'
import { seriesColour } from './palette.js'

/**
 * The frame every chart sits in: a title, an optional legend, the drawing,
 * and — always — a table of the same numbers.
 *
 * THE TABLE IS NOT A FALLBACK. A value that can only be got at by hovering is
 * a value a keyboard user and a screen reader cannot get at at all, and it is
 * also the value nobody can copy into anything else. It is collapsed rather
 * than absent, and it is the relief the light-mode palette's sub-3:1 aqua
 * requires.
 */
export default function Figure({ title, note, legend, table, children }) {
  return (
    <figure className="figure">
      {(title || note) && (
        <figcaption>
          {title && <b>{title}</b>}
          {note && <span>{note}</span>}
        </figcaption>
      )}
      {legend && legend.length > 1 && (
        <div className="legend">
          {legend.map((name, i) => (
            <span key={name}>
              <i style={{ background: seriesColour(i) }} aria-hidden="true" />
              {name}
            </span>
          ))}
        </div>
      )}
      <div className="figure-body">{children}</div>
      {table && (
        <details>
          <summary>The numbers behind this chart</summary>
          <DataTable rows={table.rows} columns={table.columns} sortable={false} page={5000} />
        </details>
      )}
    </figure>
  )
}
