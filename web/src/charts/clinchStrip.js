/**
 * The clinch strip's geometry (AF-138): one row per rival still in, one cell
 * per place they could finish, and a mark in each, as plain numbers and
 * strings, so that both renderers draw the one picture -
 * charts/ClinchStrip.jsx in the app, and scripts/prerender.js on the static
 * page.
 *
 * Each cell carries a symbol as well as its colour, so the colour is never
 * the only cue (1.4.1): a tick where the leader is champion, an equals sign
 * where the rival is level on points, an arrow where the title goes on, and
 * a dash, with no cell drawn, at the leader's own place. The table under the
 * figure says each cell in words, the countback's outcome included.
 */
import { CLINCH_CHAMPION, CLINCH_LEVEL, CLINCH_ON, CLINCH_TAKEN } from '../queries/season.js'
import { textWidth } from './gridFlag.js'

/** Below this the names and the column heads take their narrow forms. */
export const CLINCH_NARROW_BELOW = 480
const LABEL_WIDE = 120
const LABEL_NARROW = 76
/** A cell's narrowest. */
const CELL_MIN = 14
/** The space between a name and its row's first cell. */
const LABEL_GAP = 8
/** textWidth() measures the axis face's 11 px; a row's name is set at 12. */
const LABEL_SCALE = 12 / 11
const labelWidthOf = (label) => Math.ceil(textWidth(label) * LABEL_SCALE)
/** A name cut to `room`, with an ellipsis, where it would not fit whole; the table under the figure has it whole. */
const fitLabel = (label, room) => {
  if (labelWidthOf(label) <= room) return label
  let cut = String(label)
  while (cut.length > 1 && labelWidthOf(`${cut}…`) > room) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}
/** The widest a cell is drawn: wider, a strip of eleven reads as a band rather than a row of places. */
export const CLINCH_CELL_MAX = 36
export const CLINCH_ROW = 28
const GAP = 2
/** The space that sets the no-points column apart from the places, so "10" and "0" never read as one number. */
const APART = 8
const TOP = 34

/** Each mark's class, which app.css colours from the tokens in both themes. */
export const CLINCH_CLASS = {
  [CLINCH_CHAMPION]: 'clinch-champion',
  [CLINCH_LEVEL]: 'clinch-level',
  [CLINCH_ON]: 'clinch-on',
  [CLINCH_TAKEN]: 'clinch-taken',
}

const r1 = (n) => Math.round(n * 10) / 10

/** A mark's symbol about (cx, cy), `s` its half-width. */
const symbol = (mark, cx, cy, s) => {
  if (mark === CLINCH_CHAMPION) return `M${r1(cx - s)},${r1(cy)} L${r1(cx - s / 3)},${r1(cy + s * 0.66)} L${r1(cx + s)},${r1(cy - s * 0.66)}`
  if (mark === CLINCH_LEVEL) return `M${r1(cx - s)},${r1(cy - s / 3)} H${r1(cx + s)} M${r1(cx - s)},${r1(cy + s / 3)} H${r1(cx + s)}`
  if (mark === CLINCH_ON) return `M${r1(cx - s)},${r1(cy)} H${r1(cx + s)} M${r1(cx + s / 4)},${r1(cy - s * 0.6)} L${r1(cx + s)},${r1(cy)} L${r1(cx + s / 4)},${r1(cy + s * 0.6)}`
  return `M${r1(cx - s * 0.5)},${r1(cy)} H${r1(cx + s * 0.5)}`
}

/**
 * `data` as clinchStrips() in queries/season.js gives a strip's, at `width`.
 * Null where there is nothing to draw.
 *
 * The names sit in a column of their own, end-aligned, widened where a name
 * needs it as far as the cells' narrowest allows and cut with an ellipsis
 * past that, the table under the figure having it whole; the places are
 * numbered over their columns, the last "0 pts", or "0" below
 * CLINCH_NARROW_BELOW, where the axis title says what it is, and set a
 * little apart from the places so "10" and "0" never run together. The cells
 * share what is left of the width, CLINCH_CELL_MAX at the most, so at 320
 * px eleven of them still fit beside the names.
 */
export function clinchLayout({ data, width }) {
  if (!data || data.length === 0 || !data[0].cells?.length) return null
  const narrow = width < CLINCH_NARROW_BELOW
  const count = data[0].cells.length
  // The names' column: its usual width, wider where a name needs it (two
  // rivals sharing a surname are named in full), but never so wide the cells
  // drop below their narrowest.
  const need = Math.max(...data.map((d) => labelWidthOf(d.label))) + LABEL_GAP
  const room = width - APART - count * CELL_MIN
  const labelWidth = Math.max(narrow ? LABEL_NARROW : LABEL_WIDE, Math.min(need, room))
  const cell = Math.max(CELL_MIN, Math.min(CLINCH_CELL_MAX, Math.floor((width - labelWidth - APART) / count)))
  // A column's left edge: the last, no points, set APART from the rest.
  const left = (i) => labelWidth + i * cell + (i === count - 1 ? APART : 0)
  const box = cell - GAP
  const height = TOP + data.length * CLINCH_ROW + 2
  const s = Math.min(box, CLINCH_ROW - GAP) * 0.28
  const columns = Array.from({ length: count }, (_, i) => ({
    x: r1(left(i) + box / 2),
    text: i === count - 1 ? (narrow ? '0' : '0 pts') : String(i + 1),
  }))
  const rows = data.map((d, j) => {
    const y = TOP + j * CLINCH_ROW
    const cy = y + (CLINCH_ROW - GAP) / 2
    return {
      d,
      labelX: labelWidth - LABEL_GAP,
      label: fitLabel(d.label, labelWidth - LABEL_GAP),
      labelY: r1(cy),
      cells: d.cells.map((c, i) => {
        const x = left(i)
        return {
          place: c.place,
          mark: c.mark,
          className: CLINCH_CLASS[c.mark],
          rect: c.mark === CLINCH_TAKEN ? null : { x, y, width: box, height: CLINCH_ROW - GAP },
          symbol: symbol(c.mark, x + box / 2, cy, s),
        }
      }),
    }
  })
  return {
    width,
    height,
    narrow,
    rows,
    columns,
    columnY: TOP - 8,
    axis: { x: labelWidth, y: 11, text: narrow ? "Rival's place (0: no points)" : "Where the rival finishes" },
  }
}
