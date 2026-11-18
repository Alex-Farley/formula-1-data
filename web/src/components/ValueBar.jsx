import { ownColour } from '../charts/own.js'
import { plain } from './DataTable.jsx'

/**
 * A figure with a bar beside it, in a table cell (VD-110): the bar is the
 * figure's share of the table's leader, `share` from 0 to 1 as the page's
 * queries module works it out, in the row's colour - a colourForEntry()
 * entry, worn as a chart series wears it (charts/own.js), so its pair holds
 * 3:1 in either theme - or in ink where there is none (D-61). The figure is
 * always printed and is the cell's whole text, so the bar is never the only
 * cue, and a cell copied or compared reads the figure alone. Without a share
 * the cell is the figure, as it was. scripts/prerender.js writes the same
 * markup, and app.css's `.value-bar` draws both (docs/design-system.md
 * section 3, *Table*).
 */
export default function ValueBar({ figure, share, colour }) {
  if (share === null || share === undefined) return plain(figure)
  const own = ownColour(colour)
  return (
    <span className="value-bar">
      <span>{plain(figure)}</span>
      <i className={own.className} style={{ ...own.style, '--share': share }} aria-hidden="true" />
    </span>
  )
}
