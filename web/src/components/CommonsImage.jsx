/**
 * A Wikimedia Commons photograph, with the credit its licence requires.
 *
 * The database holds a REFERENCE, never an image: which file an article leads
 * with, who took it, and under what licence. The pixels come straight from
 * upload.wikimedia.org when this renders, so f1.db stays 1.6 MB and this
 * repository redistributes nothing.
 *
 * The credit line is not decoration. Most of these files are CC BY or
 * CC BY-SA and attribution is a condition of using them at all, so the
 * component renders the photographer and the licence together with the image
 * or it does not render the image.
 */
import { thumbUrl } from '../format.js'

export default function CommonsImage({ row, width = 640, className = '' }) {
  if (!row || !row.file_name) return null

  // No author means no permission. The harvest refuses such a file and the
  // build refuses it again; this is the third place that holds, because the
  // one thing worse than a missing photograph is an uncredited one.
  const author = row.artist || row.credit
  if (!author) return null

  return (
    <figure className={`commons ${className}`.trim()}>
      <img
        src={thumbUrl(row.file_name, width)}
        alt={row.car ? `${row.car}` : row.article}
        width={row.width || undefined}
        height={row.height || undefined}
        loading="lazy"
      />
      <figcaption>
        <a href={row.description_url} target="_blank" rel="noreferrer noopener">
          {row.file_name.replace(/^File:/, '')}
        </a>
        {' — '}
        {author}
        {', '}
        {row.licence_url ? (
          <a href={row.licence_url} target="_blank" rel="noreferrer noopener">
            {row.licence}
          </a>
        ) : (
          row.licence
        )}
        {' via Wikimedia Commons.'}
        {!row.name_matches && (
          <>
            {' '}
            <span className="muted">
              The file name does not mention this car, so nothing here confirms
              the photograph shows it.
            </span>
          </>
        )}
      </figcaption>
    </figure>
  )
}
