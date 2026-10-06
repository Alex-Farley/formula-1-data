import { useContext, useId } from 'react'
import DataTable from '../components/DataTable.jsx'
import { SectionTitle } from '../components/Page.jsx'
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
 * The frame every chart sits in, in one grammar (VD-80, DP-04;
 * docs/design-system.md section 3, *Figure*): the plot, its legend, the
 * method note, and - always - a table of the same numbers.
 *
 * THE HEADING NAMES THE FIGURE. There is no `title`: the h2 of the Section
 * the figure sits in (or the h3 of a FigurePart, where one section holds
 * two) is its name, read from SectionTitle as a table reads its caption, so
 * the figure carries that one string as its accessible name and a second
 * bold title cannot drift from the heading above it. Every figure had both
 * until VD-80 - "Where each championship finished" over "Final standing by
 * season" - and two caption orders, the note above the plot on most pages
 * and below it on the three VD-67 reached.
 *
 * THE NOTE GOES UNDER THE PLOT, on every figure, and the figure names it as
 * its description so a screen reader hears it with the figure. Above the
 * plot a two-to-five-line note was 58-154 px at 1440 and 77-231 px at 400
 * against plots of 180-250 px, so a phone's first screen went to caption
 * prose and no data (VD-67). It is cut to what stops a misreading, 50 words
 * at most: test/conventions.mjs holds every note builder to that at its
 * longest, and smoke.mjs every rendered note on its routes.
 *
 * `legend` is a list of names, or of { name, colour } where a series wears a
 * livery (lib/liveries.js): the swatch then carries the {light, dark} pair and
 * `.livery-series` picks one per theme. `marks="line"` keys a line chart: each
 * entry is then a stroke in its slot's dash rather than a square, because on
 * a line chart the dash is the key that is not colour (AX-16).
 *
 * `table.caption` names the table where the heading above it would not;
 * left out, the table is named from the heading, as every other is (AX-28).
 * `table.footer` is what the table holds that the plot does not draw: an
 * entry with no line, which the table carries and the drawing cannot.
 *
 * THE TABLE IS NOT A FALLBACK. A value that can only be got at by hovering is
 * a value a keyboard user and a screen reader cannot get at at all, and it is
 * also the value nobody can copy into anything else. It is collapsed rather
 * than absent. It also used to be the relief the light palette's sub-3:1
 * green leaned on; that green clears 3:1 now (AX-07) and the table stays,
 * for the reason above.
 *
 * `lead` is the variant a figure takes where it leads a page (VD-53, VD-67):
 * the same parts in the same order, in the slot app.css gives it.
 */
export default function Figure({ note, legend, marks = 'swatch', lead = false, table, children }) {
  const name = useContext(SectionTitle)
  const noteId = useId()
  const key = legend && legend.length > 1 && (
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
  )
  const numbers = table && (
    <details>
      <summary>The numbers behind this chart</summary>
      <DataTable
        rows={table.rows}
        columns={table.columns}
        caption={table.caption}
        footer={table.footer}
        sortable={false}
        page={5000}
      />
    </details>
  )
  return (
    <figure
      className={lead ? 'figure figure-lead' : 'figure'}
      aria-label={name ?? undefined}
      aria-describedby={note ? noteId : undefined}
    >
      <div className="figure-body">{children}</div>
      {key}
      {note && (
        <p className="figure-note" id={noteId}>
          <span>{note}</span>
        </p>
      )}
      {numbers}
    </figure>
  )
}
