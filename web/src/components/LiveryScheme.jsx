/**
 * The identity band at the top of a constructor's or a driver's page: the
 * scheme drawn across the measure, its colours named, and the page's own
 * sentence about whose colour it is.
 *
 * Both pages wrote this markup out, and both drew the primary alone - AF-15
 * sourced up to three colours a team and the site showed one of them, on a
 * 26x8 chip, for the sport whose teams are recognised by their colours before
 * their names (AF-17). One component so the two cannot drift, and so the band
 * is sized once: `colour.style` carries the scheme and app.css draws it.
 *
 * `colour` is a colourForEntry() or nationalEntry() result, or null. `note`
 * is the page's own prose, because a constructor's last season and a driver's
 * last team are different claims about the same colour.
 *
 * THE ACCENTS ARE NAMED WITHOUT THE CLAIM CLAUSE. `colour.claim` reads the
 * PRIMARY's `named` - whether the team's own word for it is what a cited page
 * shows - and liveries.js says `name` is this file's description everywhere
 * else. Appending the primary's clause to an accent would say a team calls a
 * colour something no source has it calling anything, which is the defect
 * AF-15's review found 41 of.
 */
export default function LiveryScheme({ colour, note }) {
  if (!colour) return null
  const accents = colour.scheme.slice(1)
  return (
    <p className="livery-band" style={{ marginTop: 14 }}>
      {/* aria-hidden: the band repeats the names beside it, and the sentence
          below says what it is. A second announcement of the same colour is
          noise, not information. */}
      <i className="livery" style={colour.style} aria-hidden="true" />
      {colour.name}
      {accents.length > 0 && <em>{accents.map((c) => c.name).join(' · ')}</em>}
      <span>{note}</span>
    </p>
  )
}
