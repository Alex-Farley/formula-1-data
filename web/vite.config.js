import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' so a build can be served from any path — the repo root of a
// GitHub Pages site, a subdirectory, or straight off the filesystem. Combined
// with the HashRouter in App.jsx that means there is no deploy-time config and
// no server rewrite rules to get wrong.
export default defineConfig({
  base: './',
  build: {
    // The database, its gzip, the manifest and the wasm are staged into
    // public/ by scripts/prepare-assets.js and pass through untouched. They are
    // the large files here and Vite warns about none of them; the JS chunk
    // limit is raised so that a real warning is not lost in noise.
    chunkSizeWarningLimit: 900,
  },
})
