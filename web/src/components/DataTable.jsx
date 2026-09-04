import { cell, isNumericColumn, isProseColumn } from '../format.js'

function label(column) {
  return column
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bGp\b/, 'GP')
    .replace(/\bId\b/, 'ID')
    .replace(/\bKm\b/, 'km')
}

/**
 * Renders a { columns, rows } result.
 *
 * `columns` narrows or reorders what is shown, `labels` overrides a heading,
 * and `render` replaces a cell — which is how ids become links without this
 * component knowing anything about routes.
 */
export default function DataTable({
  data,
  columns,
  labels = {},
  render = {},
  empty = 'No rows.',
  caption,
}) {
  if (!data) return null
  const cols = columns ?? data.columns
  const { rows } = data

  if (rows.length === 0) return <p className="muted">{empty}</p>

  const kind = Object.fromEntries(
    cols.map((c) => [
      c,
      isNumericColumn(rows, c) ? 'num' : isProseColumn(rows, c) ? 'prose' : undefined,
    ]),
  )

  return (
    <div className="table-scroll">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className={kind[c]} scope="col">
                {labels[c] ?? label(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} className={kind[c]}>
                  {render[c] ? render[c](row[c], row) : cell(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
