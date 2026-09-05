import { useEffect, useRef, useState } from 'react'

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
