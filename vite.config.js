import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// Every deploy carries a build stamp (17 Nov 2026): baked into the app and
// written to /version.json beside it. An open Octos (a portal, the Eye, the
// desktop app) reads version.json now and then; when it no longer matches its
// own stamp, a newer Octos is live and the page reloads at a safe moment
// (src/lib/freshness.js). Local dev has no stamp and never checks.
function buildStamp() {
  const build = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || String(Date.now())
  let serving = false
  return {
    name: 'octos-build-stamp',
    config: (_, { command }) => {
      serving = command === 'serve'
      return { define: { 'import.meta.env.VITE_OCTOS_BUILD': JSON.stringify(serving ? 'dev' : build) } }
    },
    generateBundle() {
      if (serving) return
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build }) })
    },
  }
}

export default defineConfig({
  plugins: [react(), buildStamp()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
