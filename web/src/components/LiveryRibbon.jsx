/**
 * A constructor's livery ribbon (VD-115, docs/design-system.md section 3,
 * Page header): a plate for each season raced from 2010, in that season's
 * scheme - the primary over a strip of each accent - with the year at each
 * change, each run's name under a bracket where the names fit and as one
 * line of text where they do not, and the credit under it at the small
 * measure. lib/liveries.js liveryRibbon() works out every part of it, and
 * scripts/prerender.js draws the same markup from the same object, so the
 * static page and the app put each plate, year and name in the same place.
 *
 * The figure is one image to a screen reader, named by the run line read
 * aloud (`aria`), so the plates, the years and the brackets are not read out
 * one by one; the run line beside it says the same in print and is hidden
 * from the reader that already heard it. The credit is outside the image,
 * because its links are the attribution CC BY-SA 4.0 asks for (AF-19).
 *
 * The plates are not the season plate (SeasonPlate.jsx), which names a
 * champion under a rule in the pair a chart series takes: a plate here holds
 * no words and draws each colour as itself, as a livery mark does (AF-16).
 */
export default function LiveryRibbon({ ribbon }) {
  if (!ribbon) return null
  return (
    <div className={ribbon.fits ? 'livery-ribbon livery-ribbon-bracketed' : 'livery-ribbon'}>
      <p className="livery-ribbon-label">{ribbon.label}</p>
      <div className="livery-ribbon-figure" role="img" aria-label={ribbon.aria} style={{ '--plates': ribbon.plates.length }}>
        <div className="livery-ribbon-plates">
          {ribbon.plates.map((plate) => (
            <span
              key={plate.year}
              className={plate.scheme.length ? 'livery-ribbon-plate' : 'livery-ribbon-plate livery-ribbon-none'}
              title={plate.title}
            >
              {plate.scheme.map((base, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the order is the scheme's
                <i key={i} style={{ background: base }} />
              ))}
            </span>
          ))}
        </div>
        <div className="livery-ribbon-years">
          {ribbon.ticks.map((tick) => (
            <span key={tick.year} className={tick.edge ? 'livery-ribbon-edge' : undefined}>
              {tick.tick}
            </span>
          ))}
        </div>
        {ribbon.fits && (
          <div className="livery-ribbon-names">
            {ribbon.runs.map((run) => (
              <span key={run.from} style={{ gridColumn: `${run.start} / ${run.end}` }}>
                {run.bracket}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="livery-ribbon-list" aria-hidden="true">
        {ribbon.list}
      </p>
      <p className="livery-ribbon-credit">
        {ribbon.note.map((part) =>
          typeof part === 'string' ? (
            part
          ) : (
            // A link's address is unique in its sentence: liveryCredit names
            // each article once, and the licence is not an article.
            <a key={part.href} href={part.href} target="_blank" rel="noreferrer noopener">
              {part.text}
            </a>
          ),
        )}
      </p>
    </div>
  )
}
