import CommonsImage from './CommonsImage.jsx'
import { Section } from './Page.jsx'
import { canShow } from '../lib/commons.js'
import {
  PHOTOGRAPHS_NOTE,
  PHOTOGRAPHS_SHOWN,
  PHOTOGRAPH_WIDTH,
  UNCHECKED_MARK,
  UNCHECKED_NOTE,
} from '../lib/site.js'

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
 */
export default function Photographs({
  images,
  limit = PHOTOGRAPHS_SHOWN,
  width = PHOTOGRAPH_WIDTH,
  subjects = false,
}) {
  const shown = images.filter(canShow)
  if (shown.length === 0) return null
  const drawn = shown.slice(0, limit)

  return (
    <Section
      title="Photographs"
      count={shown.length > limit ? `${limit} of ${shown.length}` : `${shown.length}`}
      note={PHOTOGRAPHS_NOTE}
    >
      <div className="photo-grid">
        {drawn.map((image) => (
          <CommonsImage
            key={image.file_name}
            image={image}
            width={width}
            caption={subjects ? (image.article ?? undefined) : undefined}
          />
        ))}
      </div>
      {/* Over the photographs DRAWN, not every one the query returned. The
          car page tested the whole set when six of six were drawn and it made
          no difference; a constructor draws six of fifty-one, and a caveat
          explaining a mark that is nowhere on the page explains nothing. The
          static renderer slices the same six from the same query, so the two
          still say the same thing. */}
      {drawn.some((image) => image.name_matches === 0) && (
        <p className="source-note">
          {UNCHECKED_NOTE[0]} <span className="pill pill-unverified">{UNCHECKED_MARK}</span>{' '}
          {UNCHECKED_NOTE[1]}
        </p>
      )}
    </Section>
  )
}
