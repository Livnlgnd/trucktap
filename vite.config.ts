import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

function serviceWorkerVersion(): Plugin {
  let buildVersion = String(Date.now())

  return {
    name: 'trucktap-service-worker-version',
    apply: 'build',
    buildStart() {
      buildVersion = String(Date.now())
    },
    closeBundle() {
      const swPath = path.resolve('dist', 'sw.js')
      if (!fs.existsSync(swPath)) return
      const source = fs.readFileSync(swPath, 'utf8')
      fs.writeFileSync(
        swPath,
        source.replaceAll('__TRUCKTAP_BUILD__', buildVersion),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss(), serviceWorkerVersion()],
  build: {
    rollupOptions: {
      input: {
        landing: path.resolve(process.cwd(), 'index.html'),
        app: path.resolve(process.cwd(), 'app.html'),
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/release/**', '**/dist/**', '**/build/**'],
    },
  },
})
