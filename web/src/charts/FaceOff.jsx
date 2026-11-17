import { faceColours } from './own.js'

/**
 * The team-mates face-off (VD-122): the headline, the standfirst, one block
 * per team-mate shown and the key, from queries/driver.js faceOffs(), which
 * scripts/prerender.js draws with the same markup. Two names at either end
 * over their colour rules, the line between them saying who was ahead on
 * what; three split tallies with the leading figure large; then each season
 * as a small split. The figures are printed beside every bar, so the colour
 * is never the only cue (1.4.1), and the table under the blocks holds every
 * pairing. The bars are hidden from assistive technology, the printed
 * figures saying what they draw, each after its driver's name in sr-only
 * text; the per-season splits are hidden too, as the table under them holds
 * every season's figures under its own headers.
 */
export default function FaceOffs({ faceOff }) {
  if (!faceOff) return null
  const { headline, standfirst, blocks, note } = faceOff
  return (
    <>
      <p className="face-headline">
        {headline.text} <em>{headline.figure}</em>
      </p>
      <p className="note">{standfirst}</p>
      {blocks.map((block) => (
        <Block key={block.key} block={block} />
      ))}
      <p className="faint face-key">{note}</p>
    </>
  )
}

const figureClass = (tally, side, base) => `${base}${tally.ahead === side ? ' face-win' : ''}`

function Duel({ tally }) {
  if (tally.share === null) return <span className="duel duel-none" aria-hidden="true" />
  return (
    <span className="duel" aria-hidden="true">
      <i style={{ '--share': tally.share }} />
      <i />
    </span>
  )
}

function Block({ block }) {
  const { className, vars } = faceColours(block.colour)
  const [a, b] = block.names
  return (
    <div className={className} style={vars}>
      <div className="face-names">
        <span className="face-name">{a}</span>
        <span className="face-verdict">
          <b>{block.verdict}</b>
          {block.when}
        </span>
        <span className="face-name face-name-mate">{b}</span>
      </div>
      <div className="face-tallies">
        {block.tallies.map((tally) => (
          <div className="face-tally" key={tally.key}>
            <p className="face-label">{tally.label}</p>
            <div className="face-row">
              <span className={figureClass(tally, 'mine', 'face-figure')}>
                <span className="sr-only">{`${a} `}</span>
                {tally.mine}
              </span>
              <Duel tally={tally} />
              <span className={figureClass(tally, 'theirs', 'face-figure face-figure-mate')}>
                <span className="sr-only">{`, ${b} `}</span>
                {tally.theirs}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="face-seasons" aria-hidden="true">
        <div className="face-season face-season-head">
          <span>Season</span>
          <span>Qualifying</span>
          <span>Race</span>
          <span>Points</span>
        </div>
        {block.seasons.map((season) => (
          <div className="face-season" key={season.key}>
            <b>{season.year}</b>
            {season.tallies.map((tally) => (
              <span className="face-mini" key={tally.key}>
                <span className={figureClass(tally, 'mine', 'face-mini-figure')}>{tally.mine}</span>
                <Duel tally={tally} />
                <span className={figureClass(tally, 'theirs', 'face-mini-figure face-figure-mate')}>{tally.theirs}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
