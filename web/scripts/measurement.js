/**
 * The two measurement tags every page carries, and the account of what was
 * written.
 *
 * PD-0 (#261) settled on 2026-09-21 that measurement is wanted, on the
 * narrowest pair that answers it: Cloudflare Web Analytics for arrivals by
 * landing page, Google Search Console for impressions by query. Between them
 * they separate "nobody arrives" from "people arrive and leave", which is the
 * one distinction every other ranking on the board was assuming without
 * evidence. Both are free and cookieless. docs/MEASUREMENT.md is the whole of
 * the setup, and the two numbers to read a fortnight later.
 *
 * WHY THIS IS A MODULE AND NOT TWENTY LINES INSIDE prerender.js
 *     It was twenty lines inside prerender.js, and the test that was supposed
 *     to pin the beacon's `"spa": false` was a grep for `/spa:\s*false/` over
 *     that whole file - which the status line `beacon on - token …, spa:false`
 *     satisfied all by itself. Deleting the entire `data-cf-beacon` expression
 *     left the assertion passing. The one check whose job is to stop the
 *     beacon becoming a running account of a reader's browsing was answered by
 *     a log string (review finding, 2026-09-22).
 *
 *     A grep over a script can only ever be that. Here the tags are the return
 *     value of a function a test can call, so conventions.mjs asserts against
 *     the markup that will actually be written, with the inputs it will
 *     actually be given.
 *
 * WHY THE TOKENS COME FROM THE ENVIRONMENT
 *     Neither is a secret - the beacon's token is in the page source of every
 *     site that uses it, and a verification string is a public claim of
 *     ownership - but neither describes this repository either. They name one
 *     account, so a fork that built this tree would report its arrivals into
 *     somebody else's dashboard and claim its domain for somebody else's
 *     Search Console. They are set on the Workers Builds project instead, and
 *     conventions.mjs fails the build if a literal one is ever pasted here.
 *
 * WHY MANUAL, AND NOT CLOUDFLARE'S AUTOMATIC INJECTION
 *     Automatic setup rewrites HTML at the edge; this site is served out of a
 *     Worker's static assets, and whether that path is rewritten is not
 *     something this repository can establish. The alternative to guessing is
 *     a fortnight of empty dashboard and no way to tell an unvisited site from
 *     an uninstrumented one. Written here, `curl -s https://lapledger.org |
 *     grep beacon` settles it in one line [D-09].
 *
 * WHY `"spa": false`
 *     Left on, the beacon overrides pushState and reports every route change,
 *     so Cloudflare would hold a running account of one reader's browsing
 *     rather than a count of arrivals. What PD-0 asked for is arrivals BY
 *     LANDING PAGE, and an arrival is the first load by definition - so one
 *     beacon per arrival, and site.js's IN_THIS_TAB says exactly that much
 *     about what leaves.
 *
 * Neither tag is ever fatal. A typo in an analytics token must not take the
 * site down; it must not be silent either, so `status` is written into
 * build-status.txt and served at /build-status.txt [D-10].
 */

/**
 * The shapes the two values are accepted in.
 *
 * Every Web Analytics token seen is 32 lowercase hex, but the shape is
 * Cloudflare's to change, so this is only tight enough to do two jobs: keep
 * the value safe inside a single-quoted attribute holding JSON - neither
 * pattern admits `'`, `"`, `<` or `/`, so nothing can close the attribute or
 * the tag - and catch a whole snippet pasted where a token was wanted, which
 * is the mistake the dashboard's copy button invites.
 */
export const BEACON_SHAPE = /^[A-Za-z0-9]{8,64}$/
export const VERIFICATION_SHAPE = /^[A-Za-z0-9_-]{20,128}$/

/**
 * Build the tags for one build, and the account of what was written.
 *
 * `env` is `process.env` in the build and a literal in the tests. `esc` is
 * prerender's own HTML escaper; it is a belt rather than the braces, since
 * VERIFICATION_SHAPE already admits nothing it would change, and it defaults
 * to identity so a caller that has no escaper is not tempted to write a
 * second one.
 *
 * Returns `{ tags, status }`: `tags` are head elements, in order, and are
 * empty when the environment names neither; `status` is one line each, always
 * two, saying what happened.
 */
export function measurement(env = {}, esc = (value) => String(value)) {
  const tags = []
  const status = []

  const beacon = String(env.CF_BEACON_TOKEN ?? '').trim()
  if (beacon === '') {
    status.push('beacon   off — CF_BEACON_TOKEN is not set in the build environment')
  } else if (!BEACON_SHAPE.test(beacon)) {
    status.push(
      `beacon   OFF — CF_BEACON_TOKEN is not 8–64 alphanumerics (${beacon.length} characters); no tag written`,
    )
  } else {
    tags.push(
      `<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" ` +
        `data-cf-beacon='${JSON.stringify({ token: beacon, spa: false })}'></script>`,
    )
    status.push(`beacon   on — token ${beacon.slice(0, 6)}…, one count per arrival`)
  }

  // Search Console verifies a Domain property by DNS TXT, which needs nothing
  // from this build and is what MEASUREMENT.md recommends. This is the other
  // route: a URL-prefix property verified by a meta tag, for the day the DNS
  // is somewhere this maintainer cannot reach.
  const verification = String(env.GOOGLE_SITE_VERIFICATION ?? '').trim()
  if (verification === '') {
    status.push('search   no meta verification — GOOGLE_SITE_VERIFICATION is not set (DNS TXT needs no tag)')
  } else if (!VERIFICATION_SHAPE.test(verification)) {
    status.push(
      `search   OFF — GOOGLE_SITE_VERIFICATION is not 20–128 of [A-Za-z0-9_-] (${verification.length} characters); no tag written`,
    )
  } else {
    tags.push(`<meta name="google-site-verification" content="${esc(verification)}" />`)
    status.push(`search   meta verification ${verification.slice(0, 6)}…`)
  }

  return { tags, status }
}
