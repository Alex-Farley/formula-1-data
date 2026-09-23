import DataTable from '../components/DataTable.jsx'
import { seriesColour, seriesDash } from './palette.js'

/**
 * The key to one line: a short stroke in the series' colour and its dash
 * (AX-16), so the legend and the tooltip show the same pattern the line is
 * drawn in. `colour` is a {light, dark} livery pair or null; with one the
 * stroke reads --livery, which `.livery-series` resolves per theme.
 */
export function LineKey({ index, colour }) {
  return (
    <svg
      className={colour ? 'line-key livery-series' : 'line-key'}
      style={colour ? { '--livery-light': colour.light, '--livery-dark': colour.dark } : undefined}
      width="20"
      height="8"
      viewBox="0 0 20 8"
      aria-hidden="true"
      focusable="false"
    >
      <line
        x1="2"
        x2="18"
        y1="4"
        y2="4"
        stroke={colour ? 'var(--livery)' : seriesColour(index)}
        strokeWidth="2"
        strokeDasharray={seriesDash(index)}
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * The frame every chart sits in: a title, an optional legend, the drawing,
 * and — always — a table of the same numbers.
 *
 * `legend` is a list of names, or of { name, colour } where a series wears a
 * livery (lib/liveries.js): the swatch then carries the {light, dark} pair and
 * `.livery-series` picks one per theme. `marks="line"` keys a line chart: each
 * entry is then a stroke in its slot's dash rather than a square, because on
 * a line chart the dash is the key that is not colour (AX-16).
 *
 * `table.caption` names the table where the section heading above it would
 * name two tables the same: two figures in one section otherwise both take
 * that heading, and a screen reader's table list cannot tell them apart
 * (AX-28). Left out, the table is named from the heading, as every other is.
 *
 * THE TABLE IS NOT A FALLBACK. A value that can only be got at by hovering is
 * a value a keyboard user and a screen reader cannot get at at all, and it is
 * also the value nobody can copy into anything else. It is collapsed rather
 * than absent. It also used to be the relief the light palette's sub-3:1
 * green leaned on; that green clears 3:1 now (AX-07) and the table stays,
 * for the reason above.
 */
export default function Figure({ title, note, legend, marks = 'swatch', table, children }) {
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
                {marks === 'line' ? (
                  <LineKey index={i} colour={entry.colour} />
                ) : entry.colour ? (
                  <i
                    className="livery-series"
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
          <DataTable rows={table.rows} columns={table.columns} caption={table.caption} sortable={false} page={5000} />
        </details>
      )}
    </figure>
  )
}
