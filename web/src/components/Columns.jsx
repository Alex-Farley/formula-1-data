import { useEffect, useRef } from 'react'

/**
 * Which columns a register shows, chosen by the reader (IA-23).
 *
 * A disclosure rather than a dialog: it holds a list of checkboxes and asks
 * nothing of the reader that has to be confirmed, so each tick takes effect
 * as it is made and the table below redraws behind the open list. `<details>`
 * gives the open state, the keyboard and the announcement for nothing; what
 * it does not give is the way out a popover is expected to have, so Escape
 * closes it and returns focus to the summary, and so does a press anywhere
 * outside it.
 *
 * The cells that name the row are listed, ticked and not offered: a table
 * whose rows cannot be told apart is not one of the choices (AX-21). The
 * choice itself is DataTable's, which writes it into the address as `?cols=`.
 */
export default function Columns({ columns, ticked, onChange, onReset }) {
  const box = useRef(null)

  useEffect(() => {
    const details = box.current
    if (!details) return undefined
    const close = (focus) => {
      if (!details.open) return
      details.open = false
      if (focus) details.querySelector('summary')?.focus()
    }
    const onKey = (event) => {
      if (event.key === 'Escape') close(true)
    }
    const onPress = (event) => {
      if (!details.contains(event.target)) close(false)
    }
    details.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPress)
    return () => {
      details.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPress)
    }
  }, [])

  const offered = columns.filter((column) => column.ariaHidden !== true)
  const shown = offered.filter((column) => column.rowHeader === true || ticked.includes(column.key)).length

  return (
    <details className="columns" ref={box}>
      <summary>
        Columns{' '}
        <span className="columns-count">
          {shown} of {offered.length}
        </span>
      </summary>
      <fieldset>
        <legend className="sr-only">Columns to show</legend>
        {offered.map((column) => {
          const fixed = column.rowHeader === true
          return (
            <label key={column.key} className={fixed ? 'is-fixed' : undefined}>
              <input
                type="checkbox"
                checked={fixed || ticked.includes(column.key)}
                disabled={fixed}
                onChange={(event) => onChange(column.key, event.target.checked)}
              />
              {column.label}
              {fixed && <span className="columns-note"> — names the row</span>}
            </label>
          )
        })}
        {onReset && (
          <button
            type="button"
            className="columns-reset"
            // The button goes with the choice it undoes, so focus goes back
            // to the control that opened the list rather than to the page.
            onClick={() => {
              onReset()
              box.current?.querySelector('summary')?.focus()
            }}
          >
            Back to the default columns
          </button>
        )}
      </fieldset>
    </details>
  )
}
