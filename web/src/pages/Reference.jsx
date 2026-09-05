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
      lede="The parts of this database that are about the sport rather than about a result, and the parts that are about the database itself — where every figure came from, how good it is, and what is missing."
    >
      <Result state={state}>
        {(data) => {
          const c = data.rows[0]
          const cards = [
            [
              '/reference/eras',
              'Eras and regulations',
              `${number(c.eras + c.regulations + c.innovations + c.safety)} entries`,
              'Ten eras, the rule changes that made them, the innovations that provoked the rules, and the safety work that followed the accidents.',
            ],
            [
              '/reference/quality',
              'Data quality',
              `${number(c.gaps + c.discrepancies)} findings`,
              'The confidence ladder, the known gaps, the disagreements between sources that were kept rather than resolved, and how much of each table is actually covered.',
            ],
            [
              '/reference/sources',
              'Sources and licences',
              `${number(c.sources)} sources`,
              'Every source, judged on licence, update cadence and whether anything can check it — and what each licence costs, including the one table under a share-alike database right.',
            ],
            [
              '/reference/glossary',
              'Glossary and people',
              `${number(c.glossary + c.personnel)} entries`,
              'The vocabulary, and the designers and administrators whose decisions shaped the rest of the database.',
            ],
            [
              '/reference/sql',
              'SQL console',
              `${number(c.tables)} tables · ${number(c.views)} views`,
              'Ask the database something this front end does not have a page for. It runs in your tab and nothing is written.',
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
