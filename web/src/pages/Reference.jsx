import { Link } from 'react-router-dom'
import { Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import { useQuery } from '../data/useQuery.js'
import { number } from '../lib/format.js'

const COUNTS = `
  SELECT
    (SELECT COUNT(*) FROM eras)                  AS eras,
    (SELECT COUNT(*) FROM regulation_changes)    AS regulations,
    (SELECT COUNT(*) FROM technical_innovations) AS innovations,
    (SELECT COUNT(*) FROM safety_milestones)     AS safety,
    (SELECT COUNT(*) FROM glossary)              AS glossary,
    (SELECT COUNT(*) FROM personnel)             AS personnel,
    (SELECT COUNT(*) FROM source_registry)       AS sources,
    (SELECT COUNT(*) FROM known_gaps)            AS gaps,
    (SELECT COUNT(*) FROM discrepancies)         AS discrepancies,
    (SELECT COUNT(*) FROM v_unverified)          AS unverified,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table') AS tables,
    (SELECT COUNT(*) FROM sqlite_master WHERE type = 'view')  AS views
`

export default function Reference() {
  const state = useQuery(COUNTS)

  return (
    <Page
      title="Reference"
      lede="The context behind the results: how the rules changed, what the words mean, where every figure came from, and what is still missing. Plus a console for the question no page here answers."
    >
      <Result state={state}>
        {(data) => {
          const c = data.rows[0]
          const cards = [
            [
              '/reference/eras',
              'Eras and regulations',
              `${number(c.eras + c.regulations + c.innovations + c.safety)} entries`,
              'Ten eras, the rule changes that made them, the inventions that provoked those rules, and the safety work that followed the accidents.',
            ],
            [
              '/reference/quality',
              'Data quality',
              `${number(c.gaps + c.discrepancies)} findings`,
              'How far to trust each figure, what is missing, and where two sources disagree.',
            ],
            [
              '/reference/sources',
              'Sources and licences',
              `${number(c.sources)} sources`,
              'Every source behind the data, what it is good for, and how each one may be reused.',
            ],
            [
              '/reference/glossary',
              'Glossary and people',
              `${number(c.glossary + c.personnel)} entries`,
              'What the words on a classification mean, and the people whose decisions shaped the sport.',
            ],
            [
              '/reference/sql',
              'SQL console',
              `${number(c.tables)} tables · ${number(c.views)} views`,
              'Ask the database anything these pages do not answer. It runs in your tab, and nothing can be changed.',
            ],
          ]
          return (
            <Section>
              <div className="board">
                {cards.map(([to, title, meta, blurb]) => (
                  <Link key={to} to={to}>
                    <b>
                      {title}
                      <span className="n">{meta}</span>
                    </b>
                    <p>{blurb}</p>
                  </Link>
                ))}
              </div>
            </Section>
          )
        }}
      </Result>
    </Page>
  )
}
