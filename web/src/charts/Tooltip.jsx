import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * The box a chart opens on the mark under the pointer, placed so that the
 * whole of it can be read (IX-44).
 *
 * figure.figure clips what overflows it, so a box centred over the first or
 * last column of a chart, or risen above a point at the top of a plot, lost
 * whatever ran past the frame: Ferrari's 2026 column at 1440, and the season
 * chart's first round at every width, where the box also left the screen at
 * 400. DotPlot had already learned to hold its box inside the plot (CR-74);
 * this is that rule in one place, for every chart that opens a box.
 *
 * The box is held inside the plot holder it is drawn in - which is inside the
 * figure, and so inside the screen's width, since the page never scrolls
 * sideways - and it opens where it fits:
 *
 *  - `above` (the default): centred over the anchor and above it, below it
 *    instead where there is no room above inside the plot or on the screen,
 *    and moved along at either side until it is inside. A column's top, a
 *    dot.
 *  - `beside`: to the right of the anchor, to the left where there is no room
 *    on the right, and its top at the anchor's height, held inside the plot.
 *    A line chart's hover line, whose marks the box would otherwise cover.
 *
 * Its own size is read after it renders and before it paints, so a long team
 * name is placed by its real width rather than by a guess. Wider than the
 * plot, it wraps (`max-width` in app.css) rather than running out of it.
 *
 * Escape closes it wherever the pointer is (WCAG 1.4.13): `onDismiss` is the
 * chart letting go of the mark, and the next mark the pointer reaches opens
 * the box again.
 *
 * `x` and `y` are the anchor in the plot's own pixels, which are the SVG's
 * viewBox units: every chart draws its viewBox at the width it occupies
 * (useMeasure), so the two are the same.
 */
const GAP = 10

export default function Tooltip({ x, y, place = 'above', gap = GAP, onDismiss, children, ...rest }) {
  const tip = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0, plotWidth: 0, plotHeight: 0, plotTop: 0 })

  // No dependency list: the box changes size with its text, and the plot with
  // the page, so both are read on every render, and set only when they move.
  useLayoutEffect(() => {
    const element = tip.current
    const plot = element?.offsetParent
    if (!element || !plot) return
    const frame = plot.getBoundingClientRect()
    const next = {
      width: element.offsetWidth,
      height: element.offsetHeight,
      plotWidth: plot.clientWidth,
      plotHeight: plot.clientHeight,
      plotTop: frame.top,
    }
    if (Object.keys(next).some((key) => Math.abs(next[key] - box[key]) > 0.5)) setBox(next)
  })

  useEffect(() => {
    if (!onDismiss) return undefined
    const press = (event) => {
      // Not an Escape something else already answered and prevented - the
      // search palette's - which was meant for that and not for this.
      if (event.key === 'Escape' && !event.defaultPrevented) onDismiss()
    }
    document.addEventListener('keydown', press)
    return () => document.removeEventListener('keydown', press)
  }, [onDismiss])

  const { width, height, plotWidth, plotHeight, plotTop } = box
  const hold = (value, size, room) => Math.max(0, Math.min(room - size, value))
  let left
  let top
  if (place === 'beside') {
    left = x + gap + width <= plotWidth ? x + gap : x - gap - width
    top = y
  } else {
    left = x - width / 2
    const above = y - gap - height
    // Room above inside the plot, and on the screen: a plot scrolled to the
    // top of the window has a box above its top point cut off by the window.
    const fitsAbove = above >= 0 && plotTop + above >= 0
    const fitsBelow = y + gap + height <= plotHeight
    // Where it fits in neither, the side with more room, and held inside.
    if (fitsAbove) top = above
    else if (fitsBelow) top = y + gap
    else top = Math.min(y, plotTop + y) > plotHeight - y ? above : y + gap
  }

  return (
    <div
      {...rest}
      className="tooltip"
      ref={tip}
      style={{ left: `${hold(left, width, plotWidth)}px`, top: `${hold(top, height, plotHeight)}px` }}
    >
      {children}
    </div>
  )
}
