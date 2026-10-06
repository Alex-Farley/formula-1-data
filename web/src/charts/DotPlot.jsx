import { useLayoutEffect, useRef, useState } from 'react'
import { linear, ticks } from './scales.js'
import { ownColour } from './own.js'
import { seriesColour } from './palette.js'
import { useMeasure } from './useMeasure.js'

const M = { top: 16, right: 14, bottom: 30, left: 40 }

/**
 * One mark per event: a season of results, round by round.
 *
 * Finishing position is drawn with 1 at the top, because that is where a
 * classification puts it and an axis that runs the other way reads as a chart
 * of how badly someone did. Rounds where a driver was entered but not
 * classified have no y value at all and are not plotted — the point of this
 * database is that a missing result is missing, not zero, and a dot on the
 * floor would say "last".
 *
 * A point may carry its own `colour` (AF-47): a driver's championship dots
 * each take the team of their season. Each dot and its halo then sit in a
 * `.livery-series` group of their own, reading the {light, dark} pair as a
 * whole-chart colour does (charts/own.js), and the tooltip swatch takes the
 * hovered point's. A point without one takes the chart's `colour`, and
 * failing that the neutral series colour.
 *
 * A point may instead be `hollow` (AF-55): outlined, unfilled, drawn in ink
 * rather than in any colour. That is how a chart that wears liveries draws a
 * mark the record holds no colour for - the seasons in the declared 1968-2009
 * gap - so a career crossing the boundary keeps the colours it has instead of
 * losing all of them. The objection the all-or-nothing rule existed to answer
 * - a neutral among liveries reads as a team - is met by making the mark
 * visibly a NON-colour rather than by silencing the rest: `.livery-none`'s
 * "nothing grey pretends to be a colour", on a surface where the mark cannot
 * simply be withheld because the mark is the datum. Mixing a hollow point
 * with coloured ones is the caller's decision; a chart no point of which has
 * a colour has nothing to be misread against and stays plainly neutral.
 *
 * WHICH POINT IS READ, AND HOW (CR-74). The marks themselves take no pointer
 * events. A hollow dot is `fill: none`, so it answered the pointer on its
 * 1.6 px outline alone: moving onto Hamilton's 2008 showed the box on the
 * ring and dropped it at the centre, and the dot grew on hover, carrying its
 * outline away from the pointer and back. Instead the plot reads the point
 * nearest the pointer, within HIT px, so a point is held for as long as the
 * pointer stays near it whatever is drawn there. The box takes no pointer
 * events either (.tooltip), and it sits above the point, clear of the
 * pointer - below it near the top - and is held inside the plot at either
 * side, because figure.figure clips what overflows it. A tap reads the point
 * on pointerdown, since a tap sends no pointermove, and its box stays when
 * the finger lifts.
 *
 * The plot is one tab stop: on keyboard focus it reads the first point, the
 * arrow keys step along, Home and End jump, and Escape lets go. What is read
 * goes to a status region that is always in the document, which is what lets
 * a screen reader announce each step; the visible box is the same words,
 * hidden from it, so they are not read twice.
 */
const HIT = 14
// How far the box stands off the point, clear of the grown dot and its ring,
// and the height above a point it needs to open upward rather than down.
const GAP = 16
const ROOM = 80
export default function DotPlot({
  data,
  height = 220,
  yMax,
  invert = true,
  format = (v) => String(v),
  formatX = (v) => String(v),
  label,
  // The entity whose chart this is (VD-34); see ColumnChart for the rule.
  colour = null,
}) {
  const [ref, width] = useMeasure()
  // An index into `plotted`, not the point: the caller builds `data` afresh
  // on every render, and an object held from the last one would match none.
  const [active, setActive] = useState(null)
  // The box's own width, read after it renders and before it paints, so it
  // can be held inside the plot whatever its text: a long team name at 400 px
  // ran it out of a figure that clips what overflows it.
  const tip = useRef(null)
  const [tipWidth, setTipWidth] = useState(0)
  useLayoutEffect(() => {
    const measured = tip.current ? tip.current.offsetWidth : 0
    if (measured !== tipWidth) setTipWidth(measured)
  })
  const own = ownColour(colour)
  const plotted = data.filter((d) => typeof d.y === 'number' && Number.isFinite(d.y))
  if (plotted.length === 0) return null
  const hover = active !== null && active < plotted.length ? plotted[active] : null

  const xs = data.map((d) => d.x)
  const top = yMax ?? Math.max(...plotted.map((d) => d.y))
  const x = linear([Math.min(...xs), Math.max(...xs)], [M.left, width - M.right])
  const y = invert
    ? linear([1, top], [M.top, height - M.bottom])
    : linear([0, top], [height - M.bottom, M.top])

  // The chart's own colour, or a point's where it carries one. A hollow
  // point carries neither: it is drawn in ink by `.mark-hollow`, and takes no
  // `.livery-series` group, because there is no pair for one to resolve.
  const ownOf = (d) => (d.colour ? ownColour(d.colour) : own)
  const paintOf = (d) => ownOf(d).paint ?? seriesColour(0)

  // The point nearest the pointer, in the plot's own units, or none past HIT.
  // A tap sends no pointermove, so a pointerdown reads the point as well.
  const onPointer = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    if (!box.width || !box.height) return
    const px = ((event.clientX - box.left) / box.width) * width
    const py = ((event.clientY - box.top) / box.height) * height
    let best = null
    plotted.forEach((d, i) => {
      const distance = Math.hypot(x(d.x) - px, y(d.y) - py)
      if (distance <= HIT && (!best || distance < best.distance)) best = { i, distance }
    })
    const next = best ? best.i : null
    if (next !== active) setActive(next)
  }
  const onKeyDown = (event) => {
    const last = plotted.length - 1
    // No point read yet: the arrows start from the first.
    const at = active === null ? 0 : active
    const step = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: last }
    if (event.key === 'Escape') {
      setActive(null)
      return
    }
    if (!(event.key in step)) return
    event.preventDefault()
    setActive(Math.max(0, Math.min(last, step[event.key])))
  }
  // A click focuses the plot too; only a keyboard arrival picks a point for
  // the reader, or every click would open the box on the first season.
  const onFocus = (event) => {
    if (active === null && event.currentTarget.matches(':focus-visible')) setActive(0)
  }

  // Where the box opens: centred over the point, but held inside the plot
  // at either side, and below a point too near the top for it to fit above -
  // figure.figure clips what overflows it, which cut the box off every title
  // year's dot.
  const left = hover ? Math.max(0, Math.min(width - tipWidth, x(hover.x) - tipWidth / 2)) : 0
  const rise = hover && y(hover.y) < ROOM ? `${GAP}px` : `calc(-100% - ${GAP}px)`
  const said = hover ? `${hover.label ?? formatX(hover.x)}: ${hover.note ?? format(hover.y)}` : ''

  return (
    <div className={`plot-holder${own.className ? ` ${own.className}` : ''}`} style={own.style} ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: one tab stop that reaches every point by the arrow keys, a keyboard's way to what hover shows (CR-74)
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        // A finger lifting is a pointerleave; the box it opened stays until
        // the next tap, or until focus leaves the plot.
        onPointerLeave={(event) => event.pointerType !== 'touch' && setActive(null)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={() => setActive(null)}
      >
        {/* P1 is the one value this chart exists to show, and a step of 2 from
            1 ticked 2, 4, 6... so the title-winning seasons sat above the top
            gridline with nothing naming their value. Force 1 in, and drop a 2
            that would crowd it. */}
        {[...new Set([1, ...ticks([1, top], 4, { integer: true }).filter((v) => v > 2), top])]
          .filter((v) => v >= 1 && v <= top)
          .map((value) => (
            <g key={value}>
              <line className="grid-line" x1={M.left} x2={width - M.right} y1={y(value)} y2={y(value)} />
              <text className="axis-text" x={M.left - 8} y={y(value)} textAnchor="end" dominantBaseline="middle">
                {format(value)}
              </text>
            </g>
          ))}

        {ticks(x.domain, Math.max(2, Math.floor(width / 90)), { integer: true }).map((value) => (
          <text key={value} className="axis-text" x={x(value)} y={height - M.bottom + 15} textAnchor="middle">
            {formatX(value)}
          </text>
        ))}

        {/* A dot the caller has flagged gets a halo: on a driver's page the
            title-winning seasons were four more dots in a line of dots, told
            apart only by being at the top of an axis a reader has to read to
            know that (VD-34). The halo adds no claim the plot does not
            already make - it is drawn from `mark`, which the caller sets from
            the position it is plotting - and the figure's own table and note
            say what is ringed, so nothing here is carried by colour alone. */}
        {plotted
          .filter((d) => d.mark)
          .map((d) => (
            <g key={`halo-${d.x}-${d.y}`} className={d.colour ? ownOf(d).className : undefined} style={d.colour ? ownOf(d).style : undefined}>
              {/* A title won inside the colour gap is both ringed and
                  hollow - Hamilton 2008 - so the ring follows the dot into
                  ink rather than ringing an uncoloured mark in a colour. */}
              <circle
                className={d.hollow ? 'mark-halo mark-halo-hollow' : 'mark-halo'}
                cx={x(d.x)}
                cy={y(d.y)}
                r={hover === d ? 10 : 8.5}
                fill="none"
                stroke={d.hollow ? undefined : paintOf(d)}
                pointerEvents="none"
              />
            </g>
          ))}
        {plotted.map((d) => (
          <g key={`${d.x}-${d.y}-${d.label ?? ''}`} className={d.colour ? ownOf(d).className : undefined} style={d.colour ? ownOf(d).style : undefined}>
            <circle
              className={d.hollow ? 'mark-hollow' : 'mark-ring'}
              cx={x(d.x)}
              cy={y(d.y)}
              r={hover === d ? 6 : 4.5}
              fill={d.hollow ? 'none' : paintOf(d)}
              pointerEvents="none"
            />
          </g>
        ))}
      </svg>

      <p className="sr-only" role="status">
        {said}
      </p>
      {hover && (
        <div
          className="tooltip"
          ref={tip}
          style={{ left: `${left}px`, top: y(hover.y), '--tooltip-shift': '0px', '--tooltip-rise': rise }}
          aria-hidden="true"
        >
          <b>{hover.label ?? formatX(hover.x)}</b>
          <span className={hover.colour ? `row ${ownOf(hover).className}` : 'row'} style={hover.colour ? ownOf(hover).style : undefined}>
            {/* The swatch says what the dot says. A hollow dot's is outlined
                and unfilled, so the tooltip does not hand a colour to a
                season the record holds none for - the note beside it still
                names the team. */}
            <i
              className={hover.hollow ? 'swatch-hollow' : undefined}
              style={hover.hollow ? undefined : { background: paintOf(hover) }}
              aria-hidden="true"
            />
            {hover.note ?? format(hover.y)}
          </span>
        </div>
      )}
    </div>
  )
}
