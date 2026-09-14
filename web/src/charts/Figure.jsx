import DataTable from '../components/DataTable.jsx'
import { seriesColour } from './palette.js'

/**
 * The frame every chart sits in: a title, an optional legend, the drawing,
 * and — always — a table of the same numbers.
 *
 * `legend` is a list of names, or of { name, colour, dash } where a series
 * wears a livery (lib/liveries.js): the swatch then carries the {light, dark}
 * pair and `.livery-series` picks one per theme; `dash` outlines it.
 *
 * THE TABLE IS NOT A FALLBACK. A value that can only be got at by hovering is
 * a value a keyboard user and a screen reader cannot get at at all, and it is
 * also the value nobody can copy into anything else. It is collapsed rather
 * than absent. It also used to be the relief the light palette's sub-3:1
 * green leaned on; that green clears 3:1 now (AX-07) and the table stays,
 * for the reason above.
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
          {legend.map((item, i) => {
            const entry = typeof item === 'string' ? { name: item } : item
            return (
              <span key={entry.name}>
                {entry.colour ? (
                  <i
                    className={`livery-series${entry.dash ? ' dashed' : ''}`}
                    style={{ '--livery-light': entry.colour.light, '--livery-dark': entry.colour.dark, background: 'var(--livery)' }}
                    aria-hidden="true"
                  />
                ) : (
                  <i style={{ background: seriesColour(i) }} aria-hidden="true" />
                )}
                {entry.name}
              </span>
            )
          })}
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
