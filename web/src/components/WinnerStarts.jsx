import { Link } from 'react-router-dom'
import { Fields, Section } from './Page.jsx'
import { Chips } from './Filters.jsx'
import LiveryMark from './LiveryMark.jsx'
import Figure from '../charts/Figure.jsx'
import GridStarts from '../charts/GridStarts.jsx'
import { drawnColours } from '../charts/gridStarts.js'
import { EMPTY } from '../lib/format.js'
import {
  SCOPE_LABEL,
  SCOPE_OPTIONS,
  STARTS_COLUMNS,
  TIMELINE_HEADING,
  byDecade,
  chipRace,
  chipStart,
  startsLabel,
  startsNote,
} from '../queries/circuit.js'

/**
 * Where winners start (AF-133), as a section: the line under the heading,
 * the reader's switch where the block offers one (AF-139), the figures, the
 * grid (or, on a phone, the strip) with its numbers, and the chips by
 * decade. `block` is queries/circuit.js's historyBlock(), which
 * scripts/prerender.js draws from too; nothing where it is null. The circuit
 * page, the upcoming race's page and a Grand Prix's page each give it their
 * own heading, and `onScope` where the switch belongs in the address.
 */
export default function WinnerStarts({ title, id, block, onScope }) {
  if (!block) return null
  const { races, table } = block
  return (
    <Section id={id} title={title} note={block.line}>
      {block.offered && onScope && (
        <div className="filters">
          <Chips label={SCOPE_LABEL} value={block.scope} onChange={onScope} options={SCOPE_OPTIONS} />
        </div>
      )}
      <Fields items={block.figures} />
      {table.some((row) => row.key.startsWith('slot-')) && (
        <Figure note={startsNote(drawnColours(races))} table={{ rows: table, columns: STARTS_COLUMNS }}>
          <GridStarts races={races} label={startsLabel(table)} />
        </Figure>
      )}
      <h3>{TIMELINE_HEADING}</h3>
      <ol className="win-decades">
        {byDecade(races).map(({ decade, races: here }) => (
          <li key={decade}>
            <span className="win-decade">{decade}</span>
            <ol className="win-chips">
              {here.map((race) => (
                <li key={race.key} className="win-chip">
                  {race.colour && <LiveryMark colour={race.colour} year={race.year} />}
                  <Link to={`/races/${race.year}/${race.round}`}>
                    {race.year}
                    <span className="sr-only">{chipRace(race)}</span>
                  </Link>{' '}
                  {race.team ?? EMPTY}{' '}
                  <b>{chipStart(race)}</b>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </Section>
  )
}
