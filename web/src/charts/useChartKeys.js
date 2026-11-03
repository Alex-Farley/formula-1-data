import { useState } from 'react'

/**
 * The keyboard's way to what a chart's hover box shows (CR-74, AX-32).
 *
 * A chart that opens a box on the pointer is one tab stop: on keyboard focus
 * it reads its first mark, the arrow keys step along - right and down to the
 * next, left and up to the one before - Home and End jump to either end, and
 * Escape or leaving the chart lets go. DotPlot learned this first; ColumnChart
 * and LineChart had no tab stop at all, so a keyboard reader could reach what
 * hover shows only through each figure's table. This is that one pattern for
 * the three, so they step, announce and let go alike.
 *
 * `count` is how many marks the chart reads in order. What the hook holds is
 * an index into them, not the mark: a caller builds its data afresh on every
 * render, and an object held from the last one would match none. An index
 * past the end - the data shrank under it - reads as nothing held.
 *
 * The chart spreads `keys` on its <svg> beside `tabIndex={0}` and the
 * pointer handlers that call `setActive`, and puts what is read in a status
 * region that is always in the document, which is what lets a screen reader
 * announce each step. The visible box is the same words, hidden from it, so
 * they are not read twice.
 */
export function useChartKeys(count) {
  const [held, setActive] = useState(null)
  const active = held !== null && held < count ? held : null

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setActive(null)
      return
    }
    const last = count - 1
    if (last < 0) return
    // No mark read yet: the arrows start from the first.
    const at = active === null ? 0 : active
    const step = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: last }
    if (!(event.key in step)) return
    event.preventDefault()
    setActive(Math.max(0, Math.min(last, step[event.key])))
  }
  // A click focuses the chart too; only a keyboard arrival picks a mark for
  // the reader, or every click would open the box on the first one.
  const onFocus = (event) => {
    if (active === null && count > 0 && event.currentTarget.matches(':focus-visible')) setActive(0)
  }
  const onBlur = () => setActive(null)

  return { active, setActive, keys: { onKeyDown, onFocus, onBlur } }
}
