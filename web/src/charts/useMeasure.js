import { useEffect, useRef, useState } from 'react'

/**
 * The rendered width of an element.
 *
 * Charts are drawn at real pixel sizes rather than scaled with a viewBox: a
 * viewBox would scale the axis text along with the plot, so the same chart
 * would carry 9px labels on a phone and 20px labels on a monitor.
 */
export default function useMeasure() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  return [ref, width]
}
