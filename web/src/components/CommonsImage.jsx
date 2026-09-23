import { useState } from 'react'
import { THUMB_WIDTH, attribution, canShow, fileTitle, photoAlt, thumbUrl } from '../lib/commons.js'
import { UNCHECKED_MARK } from '../lib/site.js'

/**
 * A photograph from Wikimedia Commons, with its credit.
 *
 * THE CREDIT IS NOT OPTIONAL. The database stores no pixels — 602 rows of
 * file name, licence, photographer and description page, and sixteen
 * different licence strings between them. Almost all of those licences
 * require attribution, so the caption is built into this component rather
 * than left to each caller to remember, and nothing else in the app is
 * allowed to render a Commons file — the smoke test reads the source and
 * fails if a second <img> or a second thumbUrl() call appears anywhere else.
 *
 * IT FAILS CLOSED. An image with nobody to credit, or with no licence to
 * name, is not rendered at all. Displaying it would be the licence breach;
 * omitting it costs a photograph. The build already refuses such a file, so
 * this branch should be unreachable — which is the point. It is what keeps it
 * unreachable if the build's rule ever loosens.
 *
 * `name_matches = 0` means the file name does not name the subject. Most such
 * photographs are still right — filed under the driver rather than the car —
 * but nothing in the database can say which are not, and one of them leads an
 * article with a picture of police officers. They are all held at
 * `unverified`, and this says so on the picture rather than in a footnote.
 */
export default function CommonsImage({ image, width = THUMB_WIDTH, caption, showCheck = true }) {
  // Loading, arrived, or failed: three states that used to look the same -
  // a sunk grey box - for the seconds a Commons thumbnail takes to arrive,
  // and for ever when it does not. The box now says which it is.
  const [state, setState] = useState('loading')
  // The stored address that failed, if one did (VD-23). The harvest fetched
  // every one before writing it, but Commons can move a file after that, and
  // a picture that would still arrive through Special:FilePath is not a
  // failure: it gets one more try there before the box says it failed.
  const [refused, setRefused] = useState(null)
  if (!image?.file_name) return null

  if (!canShow(image)) return null
  const credit = attribution(image)
  const licence = (image.licence ?? '').trim()

  const direct = thumbUrl(image, width)
  const fallback = thumbUrl(image, width, { direct: false })
  const src = refused === direct ? fallback : direct
  const unchecked = showCheck && image.name_matches === 0

  return (
    <figure className="photo" data-state={state}>
      <img
        src={src}
        alt={photoAlt(image, caption)}
        width={image.width || undefined}
        height={image.height || undefined}
        loading="lazy"
        decoding="async"
        onLoad={() => setState('ready')}
        onError={() => (src === direct && direct !== fallback ? setRefused(direct) : setState('failed'))}
        style={image.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
      />
      {state === 'failed' && (
        <p className="photo-failed" role="status">
          The photograph did not arrive from Wikimedia Commons. It is still there:{' '}
          <a href={image.description_url} target="_blank" rel="noreferrer noopener">
            open the file page
          </a>
          .
        </p>
      )}
      <figcaption>
        {/* The subject, above the credit: which car this is, where the page
            is showing several (VD-33). A class rather than an inline style so
            that scripts/prerender.js can write the same figure. */}
        {caption && <div className="photo-subject">{caption}</div>}
        <a href={image.description_url} target="_blank" rel="noreferrer noopener">
          {fileTitle(image.file_name)}
        </a>
        {' · '}
        {credit}
        {' · '}
        {image.licence_url ? (
          <a href={image.licence_url} target="_blank" rel="noreferrer noopener">
            {licence}
          </a>
        ) : (
          licence
        )}
        {unchecked && (
          <>
            {' · '}
            <span className="pill pill-unverified">{UNCHECKED_MARK}</span>
          </>
        )}
      </figcaption>
    </figure>
  )
}
