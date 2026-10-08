import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * The width a chart has to draw in.
 *
 * SVG scales itself, but text inside one does not: a viewBox stretched to
 * twice its intended width doubles the size of every axis label with it. So
 * the chart is drawn at the width it will actually occupy, and redrawn when
 * that changes.
 */
export function useMeasure(fallback = 640) {
  const ref = useRef(null)
  const [width, setWidth] = useState(fallback)

  // The first width is read before the browser paints, not left to the
  // ResizeObserver's first callback, which can land a frame later. Until it
  // did, a chart drew at the fallback's proportions and then grew: in the
  // opening slot (VD-84) that grew the band and moved every block under it,
  // after the handover had already shown the page (a layout shift of 0.094
  // on /seasons/2026 in CI). An update made here is applied before the
  // handover's MutationObserver runs, so the page is swapped in at its size.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const style = getComputedStyle(element)
    const next = Math.round(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))
    if (next > 0) setWidth(next)
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width)
      if (next > 0) setWidth(next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
