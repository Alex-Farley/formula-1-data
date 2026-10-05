import CommonsImage from './CommonsImage.jsx'
import { Section } from './Page.jsx'
import { canShow } from '../lib/commons.js'
import {
  PHOTOGRAPHS_NOTE,
  PHOTOGRAPHS_SHOWN,
  PHOTOGRAPH_WIDTH,
  UNCHECKED_MARK,
  UNCHECKED_NOTE,
  photographsMore,
} from '../lib/site.js'

/** The caveat under the `unchecked` mark, as one paragraph. */
const Unchecked = () => (
  <p className="source-note">
    {UNCHECKED_NOTE[0]} <span className="pill pill-unverified">{UNCHECKED_MARK}</span> {UNCHECKED_NOTE[1]}
  </p>
)

/**
 * The photographs section, on every surface that has one.
 *
 * The car page wrote this first (PD-19) and VD-33 gave it to the constructor,
 * season and race pages, which already join chassis. Four copies of a licence
 * obligation is how the credit went wrong the first time, so there is one:
 * the fail-closed filter, the count, the grid and the caveat are decided here
 * and nowhere else. scripts/prerender.js writes the same section into the
 * static page from the same strings.
 *
 * IT FAILS CLOSED BEFORE THE COUNT. CommonsImage renders nothing for a file
 * with nobody to credit, so an unfiltered list would head the section
 * "Photographs 1" over an empty grid. The build refuses such a row, which is
 * why this is cheap to be sure of.
 *
 * THE COUNT SAYS WHAT IS SHOWN. A Ferrari has fifty-one photographs and a
 * strip holds six; "51" over six pictures is a figure that disagrees with the
 * page, so a truncated strip says "6 of 51" instead.
 *
 * `subjects` captions each photograph with the car it is of. A car page does
 * not need it — the page is that car, and the caption would be its own title
 * six times. A constructor, a season or a race is showing six different cars,
 * and unlabelled they are six red cars.
 *
 * THE REST ARE ONE CLICK AWAY (PD-64). The six the strip draws are followed
 * by a closed disclosure holding every other photograph the query returned,
 * so "6 of 51" is a count of what is here rather than of what is withheld.
 * scripts/prerender.js writes the same disclosure into the static page.
 *
 * The race page's own photographs (PD-64) are a second strip with its own
 * heading: `title` and `note` say what the photographs are, `alt` describes
 * a photograph with no subject line, `checks` is false where the `unchecked`
 * mark's question - does the file name name the car? - is not one the rows
 * answer, and `more` is a link to everything their category holds.
 */
export default function Photographs({
  images,
  limit = PHOTOGRAPHS_SHOWN,
  width = PHOTOGRAPH_WIDTH,
  subjects = false,
  title = 'Photographs',
  note = PHOTOGRAPHS_NOTE,
  alt,
  checks = true,
  more = null,
}) {
  const shown = images.filter(canShow)
  if (shown.length === 0) return null
  const drawn = shown.slice(0, limit)
  const rest = shown.slice(limit)
  const figure = (image) => (
    <CommonsImage
      key={image.file_name}
      image={image}
      width={width}
      caption={subjects ? (image.article ?? undefined) : undefined}
      alt={alt}
      showCheck={checks}
    />
  )
  // The caveat goes where the mark is. Over the photographs DRAWN first: a
  // constructor draws six of fifty-one, and a caveat explaining a mark that
  // is nowhere in sight explains nothing. Where the strip has no mark and
  // the disclosure does, the caveat goes inside the disclosure, beside them.
  const marked = (list) => checks && list.some((image) => image.name_matches === 0)

  return (
    <Section
      title={title}
      count={shown.length > limit ? `${limit} of ${shown.length}` : `${shown.length}`}
      note={note}
    >
      <div className="photo-grid">{drawn.map(figure)}</div>
      {marked(drawn) && <Unchecked />}
      {rest.length > 0 && (
        <details className="photo-more">
          <summary>{photographsMore(rest.length)}</summary>
          <div className="photo-grid">{rest.map(figure)}</div>
          {!marked(drawn) && marked(rest) && <Unchecked />}
        </details>
      )}
      {more && (
        <p className="source-note">
          <a href={more.href} target="_blank" rel="noreferrer noopener">
            {more.label}
          </a>
        </p>
      )}
    </Section>
  )
}
