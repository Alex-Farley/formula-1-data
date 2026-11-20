/**
 * BarChart's geometry: every bar, its name, its value and the leader's
 * margin, as plain numbers, so that the layout can be tested without a
 * browser (test/units.mjs). charts/BarChart.jsx draws it; the static page
 * has no bar chart, and carries each leaderboard's numbers as its table.
 *
 * From the tablet breakpoint (lib/table.js PHONE, tokens.css --bp-tablet)
 * the names sit in a column of their own beside the bars, end-aligned.
 * Below it (VD-114) each name sits on its own line above its bar, from the
 * plot's left edge, and the bar takes the plot's whole width under it: a
 * 168 px name column on a 400 px phone left the longest bar about 100 px to
 * make the comparison the chart exists for. The reach chart (AF-132) does
 * the same below a 480 px plot; this switches on the page's width instead,
 * because from 768 px the drivers' two leaderboards sit side by side in
 * `.split`, and the approved design keeps the names beside the bars there.
 */
import { linear, niceDomain } from './scales.js'
import { textWidth } from './gridFlag.js'

export const BAR_ROW = 27
export const BAR_THICKNESS = 14
/** The name column beside the bars. */
export const BAR_LABEL_WIDTH = 168
/** A row's height where its name sits above the bar. */
export const BAR_STACKED_ROW = 40
/** Room after the longest bar for its value. */
const VALUE_ROOM = 54
/** From a bar's end to its value. */
export const VALUE_GAP = 8
/** From the leader's value to its margin. */
export const MARGIN_GAP = 10
const RADIUS = 4
/**
 * The most of the bars' length the margin may cost. Where the leader's value
 * and margin would take more than this off every bar - two leaderboards side
 * by side in `.split` from 768 to about 930 px, the name column beside them -
 * the margin is left off: the bars are the figure, and the table under it
 * carries every value the margin is worked from.
 */
const MARGIN_COST = 0.25
// textWidth() measures the axis face's 11 px; a value and the margin are set
// at 12 px, the value semibold, so it is scaled up, generous as textWidth is.
const TEXT_SCALE = 1.2
const widthOf = (text) => Math.ceil(textWidth(text) * TEXT_SCALE)

/**
 * How far the leader is clear of the next bar: "15 clear", on the one bar
 * that alone holds the top value (VD-114). Null where two or more share it,
 * since a tie leads nobody, and where no bar is lower to be clear of.
 */
export function barMargin(data, format) {
  const values = data.map((d) => d.value).filter((v) => Number.isFinite(v))
  if (values.length < 2) return null
  const top = Math.max(...values)
  const holders = data.filter((d) => d.value === top)
  const below = values.filter((v) => v < top)
  if (holders.length !== 1 || below.length === 0) return null
  return { key: holders[0].key, text: `${format(top - Math.max(...below))} clear` }
}

/**
 * `data` as BarChart takes it, `width` the plot's, `stacked` whether the
 * page is below the tablet breakpoint. Null where there is nothing to draw.
 */
export function barLayout({ data, width, stacked, format }) {
  if (!data || data.length === 0) return null
  const labelWidth = stacked ? 0 : BAR_LABEL_WIDTH
  const row = stacked ? BAR_STACKED_ROW : BAR_ROW
  // Where a bar starts below its row's top: under the name, or centred.
  const barOffset = stacked ? row - BAR_THICKNESS - 4 : (row - BAR_THICKNESS) / 2
  const height = data.length * row + 8
  const domain = niceDomain(data.map((d) => d.value))
  const plain = Math.max(labelWidth + 40, width - VALUE_ROOM)
  let end = plain
  let margin = barMargin(data, format)
  if (margin) {
    // The leader's bar ends short enough that its value and the margin after
    // it fit inside the plot, wherever the round domain puts that bar.
    const lead = data.find((d) => d.key === margin.key).value
    const need = VALUE_GAP + widthOf(format(lead)) + MARGIN_GAP + widthOf(margin.text)
    const share = (lead - domain[0]) / (domain[1] - domain[0] || 1)
    const fits = share > 0 ? Math.min(plain, labelWidth + (width - need - labelWidth) / share) : plain
    if (fits - labelWidth >= (plain - labelWidth) * (1 - MARGIN_COST)) end = fits
    else margin = null
  }
  const x = linear(domain, [labelWidth, end])
  const start = x(0)
  const bars = data.map((d, i) => {
    const rowTop = 4 + i * row
    const y = rowTop + barOffset
    const long = Math.max(x(d.value) - start, 1)
    const tip = start + long
    return {
      d,
      rowTop,
      y,
      middle: y + BAR_THICKNESS / 2,
      // The name: end-aligned in its column, or from the left edge above the bar.
      labelX: stacked ? 0 : labelWidth - 10,
      labelY: stacked ? y - 10 : y + BAR_THICKNESS / 2,
      labelAnchor: stacked ? 'start' : 'end',
      path: `M${start},${y} L${tip - RADIUS},${y} Q${tip},${y} ${tip},${y + RADIUS}
                    L${tip},${y + BAR_THICKNESS - RADIUS} Q${tip},${y + BAR_THICKNESS} ${tip - RADIUS},${y + BAR_THICKNESS}
                    L${start},${y + BAR_THICKNESS} Z`,
      tip,
      valueX: tip + VALUE_GAP,
      margin: margin && margin.key === d.key ? margin.text : null,
    }
  })
  return { width, height, row, stacked, bars }
}

/** The width the layout allows a bar's value and its margin, for the tests. */
export const textRoom = (bar, format) =>
  widthOf(format(bar.d.value)) + (bar.margin ? MARGIN_GAP + widthOf(bar.margin) : 0)
