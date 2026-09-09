import { attribution, fileTitle } from '../lib/commons.js'

/**
 * The credit line for a Commons photograph.
 *
 * ATTRIBUTION IS A CONDITION, NOT A COURTESY, for CC BY and CC BY-SA — which
 * is what almost all 602 of these files are. Every surface that shows one of
 * them shows this, so that there is a single place where "what does a credit
 * look like, and what counts as one" is answered.
 *
 * It exists because there were briefly two answers. CommonsImage fell back to
 * `credit` where a file names no artist; the cars gallery, written later and
 * separately, did not, and would have captioned an attributed photograph
 * "photographer not recorded". Both now render this.
 */
export default function CommonsCredit({ image, className }) {
  const credit = attribution(image)
  if (!credit) return null
  const licence = (image.licence ?? '').trim()

  return (
    <p className={className}>
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
      {image.name_matches === 0 && ' · unchecked'}
    </p>
  )
}
