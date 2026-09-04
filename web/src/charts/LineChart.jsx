import { useState } from 'react'
import { linear, ticks, zeroTo } from './scales.js'
import { Tooltip, TipRow } from './Figure.jsx'

const M = { top: 14, right: 58, bottom: 30, left: 46 }

/**
 * A single series over time.
 *
 * One series, so there is no legend — the title says what is plotted, and a
 * one-swatch legend box would only restate it. The endpoint is directly
 * labelled; every other value is on the axis, the crosshair, or the table.
 */
export default function LineChart({
  width,
  height = 250,
  data,
  x,
  y,
  formatX = String,
  formatY = String,
  endLabel,
  label,
}) {
  const [active, setActive] = useState(null)

  const plotW = Math.max(width - M.left - M.right, 10)
  const plotH = height - M.top - M.bottom

  const xs = data.map(x)
  const sx = linear([Math.min(...xs), Math.max(...xs)], [M.left, M.left + plotW])
  const sy = linear(zeroTo(data.map(y)), [M.top + plotH, M.top])

  const yTicks = ticks(sy.domain[0], sy.domain[1], 4)
  const xTicks = ticks(sx.domain[0], sx.domain[1], Math.max(2, Math.floor(plotW / 90)))

  const d = data.map((row, i) => `${i ? 'L' : 'M'}${sx(x(row))},${sy(y(row))}`).join(' ')
  const last = data[data.length - 1]

  // The pointer aims at a year, not at a 2px line: snap to the nearest x.
  function nearest(clientX, target) {
    const box = target.getBoundingClientRect()
    const value = sx.invert(clientX - box.left)
    let best = 0
    for (let i = 1; i < data.length; i++) {
      if (Math.abs(x(data[i]) - value) < Math.abs(x(data[best]) - value)) best = i
    }
    return best
  }

  function onKeyDown(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setActive((i) => {
      const next = (i ?? data.length - 1) + (e.key === 'ArrowRight' ? 1 : -1)
      return Math.max(0, Math.min(data.length - 1, next))
    })
  }

  const point = active === null ? null : data[active]

  return (
    <div className="chart">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. ${data.length} points from ${formatX(x(data[0]))} to ${formatX(
          x(last),
        )}. Full values in the table below.`}
      >
        <g aria-hidden="true">
          {yTicks.map((t) => (
            <g key={t}>
              <line
                className="grid"
                x1={M.left}
                x2={M.left + plotW}
                y1={sy(t)}
                y2={sy(t)}
              />
              <text className="tick" x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end">
                {formatY(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="tick" x={sx(t)} y={height - 10} textAnchor="middle">
              {formatX(t)}
            </text>
          ))}
          <line
            className="axis"
            x1={M.left}
            x2={M.left + plotW}
            y1={sy(sy.domain[0])}
            y2={sy(sy.domain[0])}
          />

          <path className="series-line" d={d} />

          {point && (
            <g>
              <line
                className="crosshair"
                x1={sx(x(point))}
                x2={sx(x(point))}
                y1={M.top}
                y2={M.top + plotH}
              />
              <circle className="dot-ring" cx={sx(x(point))} cy={sy(y(point))} r="6" />
              <circle className="dot" cx={sx(x(point))} cy={sy(y(point))} r="4" />
            </g>
          )}

          {/* The endpoint is the one direct label: it is where the series ends
              up, which is the number a reader wants without hovering. */}
          <circle className="dot-ring" cx={sx(x(last))} cy={sy(y(last))} r="6" />
          <circle className="dot" cx={sx(x(last))} cy={sy(y(last))} r="4" />
          <text className="end-label" x={sx(x(last)) + 10} y={sy(y(last))} dy="0.32em">
            {endLabel ?? formatY(y(last))}
          </text>
        </g>

        {/* One tab stop, then arrow keys scrub — the keyboard gets the same
            readout as the pointer without 77 tab stops in a row. */}
        <rect
          className="hit"
          x={M.left}
          y={M.top}
          width={plotW}
          height={plotH}
          tabIndex={0}
          role="application"
          aria-label={`${label}: use the left and right arrow keys to read each point`}
          onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((i) => i ?? data.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        />
      </svg>

      {point && (
        <Tooltip x={sx(x(point))} y={sy(y(point))} width={width}>
          <TipRow label={`${label} · ${formatX(x(point))}`} value={formatY(y(point))} />
        </Tooltip>
      )}
    </div>
  )
}
