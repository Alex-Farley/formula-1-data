import { accentsBySource } from '../lib/liveries.js'

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
 * WHOSE WORD EACH NAME IS. Two provenance flags, two different obligations,
 * and this is the first surface that ever printed an accent name at all:
 *
 *   `named`   is about the primary and is carried by `colour.claim`, the
 *             clause the page's own sentence already appends. An accent is
 *             never given that clause: it reads the PRIMARY's `named`, so
 *             borrowing it would say a team calls a colour something no
 *             cited page shows - the defect AF-15's review found 41 of.
 *   `sourced` is about every colour, and false marks one this project added
 *             because the team is recognised by it while no cited page for
 *             the span names it. The maintainer's decision of 2026-09-14 is
 *             that no surface may present one as the team's own. So the two
 *             kinds are printed in different places: a sourced accent joins
 *             the names beside the primary, and a chosen one is named in the
 *             prose, in a sentence that says whose reading it is. Both are
 *             DRAWN - the mark carries the whole scheme either way, which is
 *             the recognition that decision bought.
 *
 * At present that is one entry, Toro Rosso 2010-2016, whose red and silver
 * no page cited for those seasons names. It is one entry because somebody
 * checked; the split is by the flag, not by the team.
 */
export default function LiveryScheme({ colour, note }) {
  if (!colour) return null
  const { sourced, chosen } = accentsBySource(colour.scheme)
  const them = chosen.length === 1 ? 'it' : 'them'
  return (
    <p className="livery-band" style={{ marginTop: 14 }}>
      {/* aria-hidden: the band repeats the names beside it, and the sentence
          below says what it is. A second announcement of the same colour is
          noise, not information. */}
      <i className="livery" style={colour.style} aria-hidden="true" />
      {colour.name}
      {sourced.length > 0 && <em>{sourced.map((c) => c.name).join(' · ')}</em>}
      <span>
        {note}
        {chosen.length > 0 &&
          ` The mark also carries ${names(chosen)}, which no page cited here states: this site` +
            ` added ${them} because the car is recognised by ${them}, not because a source names` +
            ' the colour.'}
      </span>
    </p>
  )
}

/** "red", or "red and silver", or "red, silver and white". */
function names(colours) {
  const all = colours.map((c) => c.name.toLowerCase())
  if (all.length === 1) return all[0]
  return `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`
}
