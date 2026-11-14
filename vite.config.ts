/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// [SPEC-2.1] Served by GitHub Pages under /<repository>/. The service worker scope,
// the manifest start_url, scope and id are all derived from this single value.
const REPO_NAME = 'proj-classe'
const BASE = `/${REPO_NAME}/`

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
// Short commit hash; "-dirty" flags a local build with uncommitted changes.
const commit = execSync('git describe --always --dirty --abbrev=7').toString().trim()

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  build: {
    target: 'es2022',
  },
  plugins: [
    VitePWA({
      // [SPEC-3.3] New versions install without user action. The reload waits for the
      // menu (UpdateGate in src/boot/update.ts).
      registerType: 'autoUpdate',
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // [SPEC-3.1] Precache every file of the build, whatever its type. The glob already
      // covers the icons, so the plugin does not need to add them a second time.
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: ['**/*'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        // [SPEC-1] Name shown in the Dock.
        name: 'Proj-Classe',
        short_name: 'Proj-Classe',
        description: 'Application de classe',
        lang: 'fr',
        id: BASE,
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#2E6B3F',
        theme_color: '#2E6B3F',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
