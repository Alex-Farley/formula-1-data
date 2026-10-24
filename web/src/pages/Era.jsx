import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Onward, Page, Section, Stepper } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import { UNFOLDED } from '../lib/table.js'
import { rows, useQueries } from '../data/useQuery.js'
import { EYEBROWS, NAMES } from '../lib/site.js'
import { ONWARD, TRAIL, eraSteps } from '../lib/wayfinding.js'
import { SEASONS } from '../queries/seasons.js'
import {
  ENGINES,
  ERAS,
  ERA_EMPTY,
  ERA_FIELDS,
  ERA_SEASONS_TITLE,
  INNOVATIONS,
  INNOVATION_COLUMNS,
  REGULATIONS,
  REGULATION_COLUMNS,
  SAFETY,
  eraByKey,
  eraPath,
  inEra,
  rowsInEra,
  rowsTouchingEra,
} from '../queries/eras.js'
import { EngineTable, SafetyTimeline } from './Eras.jsx'
import { SeasonsTable } from './Seasons.jsx'

/**
 * One era, at an address of its own (IA-25): /eras/<its first season>.
 *
 * The ten eras were ten paragraphs on one long page, and the registers'
 * onward bands promised an era filter that did not exist. This page is the
 * era's slice of what /eras holds whole - its seasons, then the engine
 * formulae that ran in them and the regulation changes, innovations and
 * safety milestones dated in them - each from the query /eras draws it
 * from, and its onward band is the three registers narrowed to it.
 *
 * scripts/prerender.js writes the same page for every era the database holds,
 * from the same queries and in the same order.
 */
export default function Era() {
  const { key } = useParams()
  const state = useQueries({
    eras: [ERAS],
    seasons: [SEASONS],
    engines: [ENGINES],
    regulations: [REGULATIONS],
    innovations: [INNOVATIONS],
    safety: [SAFETY],
  })

  return (
    <Result state={state} context="That era could not be read">
      {(data) => {
        const eras = rows(data, 'eras')
        const era = eraByKey(eras, key)
        if (!era) {
          // A season inside an era names the era it falls in. Search indexes
          // /eras and not the eras one by one, so it is not offered here.
          const year = /^\d{4}$/.test(String(key)) ? Number(key) : null
          const within = year === null ? null : (eras.find((e) => inEra(e, year)) ?? null)
          return (
            <Page title="No such era" cite={false} trail={TRAIL.missing('/eras', 'Eras')}>
              <p className="muted">
                No era in the database begins in “{key}”: an era’s address is the season it begins in.
              </p>
              <p>
                {within ? (
                  <>
                    {year} falls in <Link to={eraPath(within)}>{within.era_name}</Link>. Or{' '}
                    <Link to="/eras">see every era</Link>.
                  </>
                ) : (
                  <Link to="/eras">See every era</Link>
                )}
              </p>
            </Page>
          )
        }
        return <EraBody era={era} eras={eras} data={data} />
      }}
    </Result>
  )
}

function EraBody({ era, eras, data }) {
  const seasons = rowsInEra(era, rows(data, 'seasons'))
  const engines = rowsTouchingEra(era, rows(data, 'engines'))
  const regulations = rowsInEra(era, rows(data, 'regulations'))
  const innovations = rowsInEra(era, rows(data, 'innovations'))
  const safety = rowsInEra(era, rows(data, 'safety'))

  return (
    <Page
      eyebrow={EYEBROWS.era(era.from_year, era.to_year)}
      title={NAMES.era(era).headline}
      documentName={NAMES.era(era).title}
      trail={TRAIL.era(era)}
      lede={era.summary}
      aside={<Stepper {...eraSteps(eras, era)} />}
    >
      <Section>
        {/* A line the era does not hold is left out, as the static page's
            fields() leaves it, rather than drawn as a dash. */}
        <Fields
          items={[
            ...ERA_FIELDS.map(([field, label]) => (era[field] ? { label, value: era[field] } : null)),
            { label: 'Confidence', value: <Confidence value={era.confidence} /> },
          ]}
        />
      </Section>

      <Section title={ERA_SEASONS_TITLE} count={`${seasons.length}`}>
        <SeasonsTable rows={seasons} />
      </Section>

      <Section title="Engine formulae" count={`${engines.length}`}>
        <EngineTable rows={engines} empty={ERA_EMPTY} />
      </Section>

      <Section title="Regulation changes" count={`${regulations.length}`}>
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={regulations}
          rowKey={(row) => row.id}
          sort="year"
          direction="desc"
          columns={REGULATION_COLUMNS}
          empty={ERA_EMPTY}
        />
      </Section>

      <Section title="Technical innovations" count={`${innovations.length}`}>
        <DataTable
          unfolded={UNFOLDED.reference}
          rows={innovations}
          rowKey={(row) => row.id}
          sort="year"
          direction="asc"
          columns={INNOVATION_COLUMNS}
          empty={ERA_EMPTY}
        />
      </Section>

      <Section title="Safety" count={`${safety.length}`}>
        <SafetyTimeline milestones={safety} empty={ERA_EMPTY} />
      </Section>

      <Onward {...ONWARD.era({ era })} />
    </Page>
  )
}
