import { fileTitle, thumbUrl } from '../lib/commons.js'

/**
 * The person or source to credit for a photograph.
 *
 * This is the SAME RULE the build applies. verify.py refuses a file where
 * neither `artist` nor `credit` says anything —
 *
 *     COALESCE(NULLIF(TRIM(artist), ''), NULLIF(TRIM(credit), ''))
 *
 * — and if the renderer read only `artist` it would disagree with the check
 * that admitted the row. It did: one of the 602 files, the 1958 Hawthorn
 * photograph on Ferrari 246 F1, carries a source in `credit` and no artist at
 * all, and this component used to caption it "photographer not recorded".
 * The build said attributed, the page said anonymous, and the page was what
 * the reader saw. Two rules for one obligation is how an attribution goes
 * missing, so there is one rule and it lives here.
 */
const attribution = (image) =>
  (image.artist ?? '').trim() || (image.credit ?? '').trim() || null

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
export default function CommonsImage({ image, width = 800, caption, showCheck = true }) {
  if (!image?.file_name) return null

  const credit = attribution(image)
  const licence = (image.licence ?? '').trim()
  if (!credit || !licence) return null

  const src = thumbUrl(image.file_name, width)
  const unchecked = showCheck && image.name_matches === 0

  return (
    <figure className="photo">
      <img
        src={src}
        alt={caption ?? fileTitle(image.file_name)}
        width={image.width || undefined}
        height={image.height || undefined}
        loading="lazy"
        decoding="async"
        style={image.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}
      />
      <figcaption>
        {caption && <div style={{ color: 'var(--ink-soft)', marginBottom: 3 }}>{caption}</div>}
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
            <span className="pill pill-unverified">unchecked</span>
          </>
        )}
      </figcaption>
    </figure>
  )
}
