/**
 * The headers every response from the site carries (AF-76).
 *
 * prepare-assets.js writes them under `/*` in public/_headers, which the host
 * reads; vite.config.js reads the same block back out of dist/_headers so
 * that the preview server, and the smoke test that runs on it, answer with
 * them too. This module is the one place they are written.
 *
 * WHY A POLICY AT ALL
 *     Every page is written from harvested text (Wikipedia, F1DB) by
 *     prerender.js, and the app runs a public SQL console. Both escape what
 *     they write; the policy is the backstop for the day an escape is missed,
 *     so that injected markup cannot run a script or load one from elsewhere.
 *
 * WHY REPORT-ONLY, FOR NOW
 *     The smoke test runs the whole site under this policy ENFORCED - the
 *     preview server turns the header below into Content-Security-Policy -
 *     and fails on any refusal. The host only reports, until the live site
 *     has been read under it too: the Cloudflare beacon only loads where
 *     CF_BEACON_TOKEN is set, which no test build has, and the host may add
 *     things a preview server never sees. Enforcing is then a one-word change
 *     to POLICY_HEADER.
 *
 *     Only the policy waits. nosniff, Referrer-Policy and X-Frame-Options are
 *     enforced on the host from AF-76 on, because none of them depends on
 *     anything the smoke test cannot see.
 *
 * What each source is for, so that nothing here outlives its reason:
 *
 *   'wasm-unsafe-eval'   sql.js compiling its wasm, in the worker
 *   'unsafe-hashes' +    index.html's one inline handler, the onload that
 *     its hash           swaps the Google Fonts stylesheet in without
 *                        blocking the first paint. The hash allows that
 *                        handler's exact text and no other.
 *   cloudflareinsights   the Web Analytics beacon (measurement.js), and the
 *                        origin it sends its one count to
 *   fonts.googleapis /   the stylesheet, and the faces it names
 *     fonts.gstatic
 *   *.wikimedia.org      Commons photographs: Special:FilePath on commons,
 *                        the stored thumb_url addresses on upload and thumb
 *   data: images         the inline favicon in index.html
 *   'unsafe-inline'      style attributes, which prerender.js writes for a
 *     styles             livery colour or a plot's height. A style cannot
 *                        run script; style-src-attr would be narrower but
 *                        a browser without it would fall back to style-src
 *                        and drop every one.
 *
 * Not needed, and why: the JSON-LD blocks are type=application/ld+json, a
 * data block the browser never executes and CSP does not check; the worker
 * is a same-origin file; the redirect stubs run /redirect.js rather than an
 * inline script, so that no hash is needed per stub.
 */
import { createHash } from 'node:crypto'

/** The text of every inline event handler the site serves, exactly. */
export const INLINE_HANDLERS = ["this.media='all'"]

const sha256 = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`

export const BEACON_ORIGIN = 'https://static.cloudflareinsights.com'

export const POLICY = [
  ['default-src', "'self'"],
  ['script-src', "'self'", "'wasm-unsafe-eval'", "'unsafe-hashes'", ...INLINE_HANDLERS.map(sha256), BEACON_ORIGIN],
  ['style-src', "'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  ['font-src', "'self'", 'https://fonts.gstatic.com'],
  ['img-src', "'self'", 'data:', 'https://*.wikimedia.org'],
  ['connect-src', "'self'", 'https://cloudflareinsights.com'],
  ['worker-src', "'self'"],
  ['object-src', "'none'"],
  ['base-uri', "'self'"],
  ['form-action', "'self'"],
  ['frame-ancestors', "'none'"],
]
  .map((directive) => directive.join(' '))
  .join('; ')

/** Report-Only until the live site has been read under it; see above. */
export const POLICY_HEADER = 'Content-Security-Policy-Report-Only'

export const SECURITY_HEADERS = [
  [POLICY_HEADER, POLICY],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  // frame-ancestors says the same, but only once the policy is enforced.
  ['X-Frame-Options', 'DENY'],
]

/**
 * The headers a `_headers` file gives every path: the `/*` block, as
 * [name, value] pairs. vite.config.js serves these in preview.
 */
export function everyPath(text) {
  const headers = []
  let inBlock = false
  for (const line of String(text).split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!/^\s/.test(line)) {
      inBlock = line.trim() === '/*'
      continue
    }
    const colon = line.indexOf(':')
    if (inBlock && colon > 0) headers.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()])
  }
  return headers
}
