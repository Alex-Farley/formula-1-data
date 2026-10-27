import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { everyPath } from './scripts/headers.js'

const here = dirname(fileURLToPath(import.meta.url))

// SITE_BASE is the one place a deploy path is configured, and three things
// read it: vite (which rewrites asset URLs), the router's basename, and
// scripts/prerender.js (which writes canonical URLs and the sitemap). It has
// to be absolute rather than the './' this used to be: prerendering puts real
// files at /drivers/hamilton/index.html, and a relative asset URL there would
// resolve to /drivers/hamilton/assets/... and 404 on every deep link.
const base = process.env.SITE_BASE ?? '/'

/**
 * Serve /drivers/hamilton from dist/drivers/hamilton/index.html in preview.
 *
 * Cloudflare's static assets do this by default — html_handling defaults to
 * "auto-trailing-slash", which resolves an extensionless path to the
 * index.html inside it, and that is the URL shape prerender.js writes as
 * canonical. sirv, which is what `vite preview` runs on, only serves the
 * directory when the path ends in a slash.
 *
 * Without this the preview answers a canonical deep link with a 404 while
 * production answers it with the page, which is the worst kind of difference
 * between the two: it does not show up until somebody shares a link. Fifteen
 * lines here keep `npm run preview` and the smoke test honest about what the
 * host will actually do.
 */
const cloudflareHtmlHandling = () => ({
  name: 'cloudflare-html-handling',

  /*
   * In dev there are no prerendered files, so a deep link has to fall back to
   * index.html the way an SPA host would — otherwise `npm run dev` answers
   * /drivers/hamilton with a 404 and the router never gets to see it.
   *
   * This is the fallback appType: 'mpa' turned off, put back deliberately and
   * only where it belongs. It must NOT reach preview or production: there it
   * would answer a missing f1.db with HTML and a 200.
   */
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const pathname = (req.url ?? '/').split('?')[0]
      if (req.method === 'GET' && !extname(pathname) && !pathname.startsWith('/@')) {
        req.url = base
      }
      next()
    })
  },

  configurePreviewServer(server) {
    const dist = join(here, 'dist')

    /*
     * The headers the host gives every path, read out of the _headers file
     * the host is given (AF-76), since sirv reads no such file. The content
     * security policy among them is enforced, here as on the host (AF-126):
     * a refusal in preview breaks what it refuses, so the smoke test fails
     * on it rather than logging a warning nobody reads. The per-path rules
     * (cache, content types, the API's CORS) stay the host's.
     */
    const headersFile = join(dist, '_headers')
    const everywhere = existsSync(headersFile) ? everyPath(readFileSync(headersFile, 'utf8')) : []
    server.middlewares.use((_req, res, next) => {
      for (const [name, value] of everywhere) res.setHeader(name, value)
      next()
    })

    server.middlewares.use((req, _res, next) => {
      const [pathname, search = ''] = (req.url ?? '/').split('?')
      if (req.method === 'GET' && pathname !== '/' && !pathname.endsWith('/') && !extname(pathname)) {
        const candidate = join(dist, decodeURIComponent(pathname), 'index.html')
        if (candidate.startsWith(dist) && existsSync(candidate)) {
          req.url = `${pathname}/index.html${search ? `?${search}` : ''}`
        }
      }
      next()
    })
  },
})

export default defineConfig({
  base,

  // 'mpa' turns off the SPA fallback, and it has to be off. prerender.js writes
  // a real index.html for every route, so an unknown path should 404 rather
  // than come back as the home page with a 200 — which is both what the host is
  // configured to do and what stops a missing f1.db from arriving as HTML
  // pretending to be a database.
  appType: 'mpa',

  plugins: [react(), cloudflareHtmlHandling()],

  build: {
    // The database, its gzip, the manifest and the wasm are staged into
    // public/ by scripts/prepare-assets.js and pass through untouched. They are
    // the large files here and Vite warns about none of them; the JS chunk
    // limit is raised so that a real warning is not lost in noise.
    chunkSizeWarningLimit: 900,
  },
})
