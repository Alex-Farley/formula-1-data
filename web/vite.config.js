import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' so a build can be served from any path — the repo root of a
// GitHub Pages site, a subdirectory, or straight off the filesystem. Combined
// with the HashRouter in App.jsx that means there is no deploy-time config and
// no server rewrite rules to get wrong.
export default defineConfig({
  base: './',
  build: {
    // f1.db and sql-wasm.wasm are copied into public/ by scripts/copy-assets.js
    // and pass through untouched; they are the two large files here and Vite
    // warns about neither, but the JS chunk limit is raised so a real warning
    // is not lost in noise.
    chunkSizeWarningLimit: 900,
  },
})
