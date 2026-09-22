import { Onward, Page, Section } from '../components/Page.jsx'
import {
  ABOUT,
  ABOUT_LEDE,
  ABOUT_REPOSITORY,
  REPORT_ASK,
  REPORT_LINK,
  REPORT_PROMISE,
  REPORT_URL,
  REPOSITORY,
} from '../lib/site.js'

/**
 * Who publishes this, and how to tell it it is wrong.
 *
 * The site published 3,545 pages of figures and never once said whose they
 * were: no name, no editorial rule, no way in that was not the issue tracker
 * of a repository a reader had no reason to look in. Four of seven simulated
 * readers stopped at exactly that (UR-05), and an encyclopaedia editor asked
 * to treat this as a source could not answer the first question about it.
 *
 * The page runs no query. Everything on it is a statement about how the
 * database is made rather than a figure out of it, and a figure out of it is
 * what /data and /data/quality already are; a count restated here would be a
 * second place for it to go wrong.
 *
 * The prose is lib/site.js's, shared with scripts/prerender.js, because the
 * page a crawler is served before the database has loaded must promise
 * exactly what the page a reader ends up on promises.
 */
export default function About() {
  return (
    <Page title="About" lede={ABOUT_LEDE}>
      {ABOUT.map(({ title, paragraphs, after }) => (
        <Section key={title} title={title}>
          {/* The index: ABOUT is a literal that never reorders and never
              grows at runtime, so the position IS the identity, and a key
              cut from the prose would turn an edit to a sentence into a
              remount. */}
          {paragraphs.map((paragraph, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a static literal that never reorders
            <p key={i} className="measure">
              {paragraph}
            </p>
          ))}
          {after === 'repository' && (
            <p className="measure">
              {ABOUT_REPOSITORY[0]}
              <a href={REPOSITORY}>{ABOUT_REPOSITORY[1]}</a>
              {ABOUT_REPOSITORY[2]}
            </p>
          )}
          {/* The same three strings the footer assembles, in the section that
              is about them: a reader who arrived here to complain should not
              have to go back to the footer to find the door. */}
          {after === 'report' && (
            <p className="measure">
              {REPORT_ASK} <a href={REPORT_URL}>{REPORT_LINK}</a>. {REPORT_PROMISE}
            </p>
          )}
        </Section>
      ))}

      <Onward
        items={[
          { to: '/data', label: 'Data', hint: 'The file itself, what it holds, and what you may do with it.' },
          { to: '/data/quality', label: 'Data quality', hint: 'The ladder, every gap, every disagreement.' },
          {
            to: '/data/sources',
            label: 'Sources and licences',
            hint: 'Who says so, and what each licence cost or bought.',
          },
        ]}
      />
    </Page>
  )
}
