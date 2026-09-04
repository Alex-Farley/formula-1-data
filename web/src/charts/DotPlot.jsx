import { useState } from 'react'
import { linear, ticks, zeroTo } from './scales.js'
import { Tooltip, TipRow } from './Figure.jsx'

const M = { top: 16, right: 16, bottom: 30, left: 52 }

/**
 * Discrete observations against time.
 *
 * Dots, not a line: these are separate cars, and a line between them would
 * claim a continuous quantity moving from one to the next. Only the extreme
 * is directly labelled — a number beside all 29 would be unreadable, and the
 * rest are in the crosshair and the table.
 */
export default function DotPlot({
  width,
  height = 260,
  data,
  x,
  y,
  name,
  formatX = String,
  formatY = String,
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

  const peak = data.reduce((best, row) => (y(row) > y(best) ? row : best), data[0])

  // Nearest-point rather than dead-centre: an 8px dot is a pinpoint, and these
  // overlap where several cars share a decade.
  function nearest(e) {
    const box = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - box.left
    const py = e.clientY - box.top
    let best = 0
    let bestD = Infinity
    data.forEach((row, i) => {
      const d = (sx(x(row)) - px) ** 2 + (sy(y(row)) - py) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return bestD < 60 ** 2 ? best : null
  }

  const point = active === null ? null : data[active]

  return (
    <div className="chart">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}. ${data.length} points. Full values in the table below.`}
      >
        <g aria-hidden="true">
          {yTicks.map((t) => (
            <g key={t}>
              <line className="grid" x1={M.left} x2={M.left + plotW} y1={sy(t)} y2={sy(t)} />
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

          {data.map((row) => (
            <g key={name(row)}>
              {/* A 2px surface ring keeps overlapping points legible. */}
              <circle className="dot-ring" cx={sx(x(row))} cy={sy(y(row))} r="6" />
              <circle className="dot" cx={sx(x(row))} cy={sy(y(row))} r="4" />
            </g>
          ))}

          {point && (
            <circle className="dot-halo" cx={sx(x(point))} cy={sy(y(point))} r="9" />
          )}

          {/* The one direct label goes on the highest point. A label that
              would sit above the plot is placed under its dot instead —
              measured, not nudged, so it is never clipped by the frame. */}
          <text
            className="end-label"
            x={sx(x(peak))}
            y={sy(y(peak)) - M.top < 26 ? sy(y(peak)) + 20 : sy(y(peak)) - 12}
            textAnchor={sx(x(peak)) > M.left + plotW - 80 ? 'end' : 'middle'}
          >
            {name(peak)}
          </text>
        </g>

        <rect
          className="hit"
          x={M.left}
          y={M.top}
          width={plotW}
          height={plotH}
          tabIndex={0}
          role="application"
          aria-label={`${label}: use the left and right arrow keys to read each point`}
          onPointerMove={(e) => setActive(nearest(e))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((i) => i ?? 0)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            e.preventDefault()
            setActive((i) => {
              const next = (i ?? 0) + (e.key === 'ArrowRight' ? 1 : -1)
              return Math.max(0, Math.min(data.length - 1, next))
            })
          }}
        />
      </svg>

      {point && (
        <Tooltip x={sx(x(point))} y={sy(y(point))} width={width}>
          <TipRow label={`${name(point)} · ${formatX(x(point))}`} value={formatY(y(point))} />
        </Tooltip>
      )}
    </div>
  )
}
