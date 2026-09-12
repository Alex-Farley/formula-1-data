import { useMemo, useState } from 'react'
import { Confidence, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import SubNav from '../components/SubNav.jsx'
import { Chips } from '../components/Filters.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { span } from '../lib/format.js'

const SPEC = {
  eras: ['SELECT * FROM eras ORDER BY from_year'],
  engines: ['SELECT * FROM engine_eras ORDER BY from_year'],
  points: ['SELECT * FROM points_systems ORDER BY from_year'],
  regulations: ['SELECT * FROM regulation_changes ORDER BY year, id'],
  innovations: ['SELECT * FROM technical_innovations ORDER BY year, id'],
  safety: ['SELECT * FROM safety_milestones ORDER BY year, id'],
  governance: ['SELECT * FROM governance ORDER BY year, id'],
  tyres: ['SELECT * FROM tyre_suppliers ORDER BY from_year'],
  limits: ['SELECT * FROM v_regulation_limits ORDER BY field, from_year'],
}

export default function Eras() {
  const state = useQueries(SPEC)

  return (
    <Page
      title="Eras and regulations"
      lede="Formula One is a rule set that keeps being rewritten, and most of what changed about the cars follows from that. Here is the chronology: what the rules were, what someone invented to get round them, and what was banned afterwards."
    >
      <SubNav />
      <Result state={state}>{(data) => <Body data={data} />}</Result>
    </Page>
  )
}

function Body({ data }) {
  const eras = rows(data, 'eras')
  const engines = rows(data, 'engines')
  const points = rows(data, 'points')
  const regulations = rows(data, 'regulations')
  const innovations = rows(data, 'innovations')
  const safety = rows(data, 'safety')
  const governance = rows(data, 'governance')
  const tyres = rows(data, 'tyres')
  const limits = rows(data, 'limits')

  const [category, setCategory] = useState('')
  const categories = useMemo(
    () => [...new Set(regulations.map((r) => r.category).filter(Boolean))].sort(),
    [regulations],
  )
  const shownRegulations = category ? regulations.filter((r) => r.category === category) : regulations
  const eraTiers = [...new Set(eras.map((e) => e.confidence))]

  return (
    <>
      <Section
        title="Ten eras"
        count={`${eras.length}`}
        note={
          eraTiers.length === 1
            ? `Each era carries the ${eraTiers[0]} tier: the boundaries are the conventional ones, not a measurement.`
            : undefined
        }
      >
        <div className="timeline">
          {eras.map((era) => (
            <article key={era.id}>
              <h3>
                {era.era_name}
                <span className="years">{span(era.from_year, era.to_year)}</span>
                {eraTiers.length > 1 && <Confidence value={era.confidence} />}
              </h3>
              <p>{era.summary}</p>
              {era.dominant_teams && (
                <p className="faint small">
                  <strong>Dominant:</strong> {era.dominant_teams}
                </p>
              )}
              {era.defining_features && (
                <p className="faint small">
                  <strong>Technology:</strong> {era.defining_features}
                </p>
              )}
            </article>
          ))}
        </div>
      </Section>

      <Section title="Engine formulae" count={`${engines.length}`}>
        <DataTable
          rows={engines}
          rowKey={(row) => row.id}
          sortable={false}
          columns={[
            {
              key: 'era_name',
              label: 'Era',
              render: (name, row) => (
                <>
                  <b>{name}</b>
                  <br />
                  <span className="faint small">{span(row.from_year, row.to_year)}</span>
                </>
              ),
            },
            { key: 'formula', label: 'Formula', align: 'prose' },
            { key: 'typical_config', label: 'Typical' },
            { key: 'approx_power_bhp', label: 'Power (bhp)', align: 'num' },
            { key: 'rev_limit', label: 'Revs', align: 'num' },
            { key: 'notes', label: 'Notes', align: 'prose' },
          ]}
        />
      </Section>

      <Section
        title="Scoring systems"
        count={`${points.length}`}
        note="Read this before comparing points across eras: until 1990 only a driver's best few results counted, so a published career total can be lower than the points actually scored."
      >
        <DataTable
          rows={points}
          rowKey={(row) => row.id}
          sortable={false}
          columns={[
            {
              key: 'from_year',
              label: 'Years',
              align: 'num',
              render: (_, row) => span(row.from_year, row.to_year),
            },
            { key: 'scoring', label: 'Scoring', align: 'prose' },
            { key: 'fastest_lap', label: 'Fastest lap' },
            { key: 'dropped_scores', label: 'Dropped scores', align: 'prose' },
            { key: 'notes', label: 'Notes', align: 'prose' },
          ]}
        />
      </Section>

      <Section title="Regulation changes" count={`${regulations.length}`}>
        <div className="filters">
          <Chips
            label="Filter regulation changes by category"
            value={category}
            onChange={setCategory}
            options={[['', 'All'], ...categories.map((c) => [c, c])]}
          />
        </div>
        <DataTable
          rows={shownRegulations}
          rowKey={(row) => row.id}
          sort="year"
          direction="desc"
          page={80}
          columns={[
            { key: 'year', label: 'Year', align: 'num' },
            { key: 'category', label: 'Category' },
            { key: 'title', label: 'Change' },
            { key: 'detail', label: 'Detail', align: 'prose' },
            { key: 'impact', label: 'Impact', align: 'prose' },
          ]}
        />
      </Section>

      <Section
        title="Regulation limits"
        count={`${limits.length}`}
        note="The limits every car of a season was built to. They are kept here rather than on each car, because a rule several teams quote is not a measurement of any one of them."
      >
        <DataTable
          rows={limits}
          rowKey={(row) => `${row.field}-${row.from_year}`}
          sortable
          sort="from_year"
          direction="desc"
          columns={[
            { key: 'field', label: 'Limit' },
            {
              key: 'from_year',
              label: 'Years',
              align: 'num',
              render: (_, row) => span(row.from_year, row.to_year),
            },
            { key: 'value', label: 'Value', align: 'num' },
            { key: 'unit', label: 'Unit' },
            { key: 'note', label: 'Note', align: 'prose' },
          ]}
        />
      </Section>

      <Section title="Technical innovations" count={`${innovations.length}`}>
        <DataTable
          rows={innovations}
          rowKey={(row) => row.id}
          sort="year"
          direction="asc"
          page={60}
          columns={[
            { key: 'year', label: 'Year', align: 'num' },
            { key: 'innovation', label: 'Innovation' },
            { key: 'originator', label: 'Originator' },
            { key: 'description', label: 'What it was', align: 'prose' },
            { key: 'legacy', label: 'What became of it', align: 'prose' },
            { key: 'banned_year', label: 'Banned', align: 'num' },
          ]}
        />
      </Section>

      <Section title="Safety" count={`${safety.length}`}>
        <div className="timeline">
          {safety.map((milestone) => (
            <article key={milestone.id}>
              <h3>
                {milestone.milestone}
                <span className="years">{milestone.year}</span>
              </h3>
              {milestone.trigger_event && (
                <p className="faint small">
                  <strong>After:</strong> {milestone.trigger_event}
                </p>
              )}
              <p>{milestone.description}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Governance" count={`${governance.length}`}>
        <DataTable
          rows={governance}
          rowKey={(row) => row.id}
          sort="year"
          direction="asc"
          page={40}
          columns={[
            { key: 'year', label: 'Year', align: 'num' },
            { key: 'event', label: 'Event' },
            { key: 'detail', label: 'Detail', align: 'prose' },
            { key: 'significance', label: 'Why it mattered', align: 'prose' },
          ]}
        />
      </Section>

      <Section title="Tyre suppliers" count={`${tyres.length}`}>
        <DataTable
          rows={tyres}
          rowKey={(row) => row.id}
          sort="from_year"
          direction="asc"
          columns={[
            { key: 'supplier', label: 'Supplier' },
            {
              key: 'from_year',
              label: 'Years',
              align: 'num',
              render: (_, row) => span(row.from_year, row.to_year),
            },
            { key: 'exclusive', label: 'Sole supplier', align: 'num', render: (v) => (v ? 'yes' : 'no') },
            { key: 'notes', label: 'Notes', align: 'prose' },
          ]}
        />
      </Section>

      <Onward
        items={[
          { to: '/cars', label: 'Cars', hint: 'The designs these rules produced.' },
          { to: '/seasons', label: 'Seasons', hint: 'The championships they were raced under.' },
          { to: '/reference/glossary', label: 'Glossary', hint: 'The vocabulary the rules are written in.' },
        ]}
      />
    </>
  )
}
