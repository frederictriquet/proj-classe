// Shared by the start-up test [SPEC-3.9.1] and the recovery scenario [SPEC-3.9.4]: serves a build
// with `vite preview` and reads the state of the page in headless Chromium.
import { fileURLToPath } from 'node:url'
import { build, preview } from 'vite'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONFIG_FILE = fileURLToPath(new URL('../vite.config.ts', import.meta.url))

/** Faults injected at build time to test the guard and the recovery, never written to src/. */
const FAULTS = {
  // The app module throws while it loads: the dynamic import() of the bootstrap rejects.
  app: { file: '/src/main.ts', code: "\nthrow new Error('Simulated start-up failure (app module)')\n" },
  // The menu module throws while it loads: the first view of the app fails.
  menu: { file: '/src/menu/menu.ts', code: "\nthrow new Error('Simulated start-up failure (menu module)')\n" },
  // The bootstrap itself throws before it registers the service worker.
  boot: {
    file: '/src/boot/boot.ts',
    code: "if (!('__never' in globalThis)) throw new Error('Simulated bootstrap failure')\n",
    prepend: true,
  },
}

/**
 * Builds the app into `outDir` with the version label `<package version> (<commit>)`, and with
 * an optional fault (`app`, `menu` or `boot`).
 */
export async function buildVariant(outDir, commit, fault) {
  const injected = fault ? FAULTS[fault] : undefined
  if (fault && !injected) throw new Error(`unknown fault "${fault}", expected one of ${Object.keys(FAULTS).join(', ')}`)
  await build({
    configFile: CONFIG_FILE,
    root: ROOT,
    logLevel: 'warn',
    build: { outDir, emptyOutDir: true },
    define: { __APP_COMMIT__: JSON.stringify(commit) },
    plugins: injected
      ? [
          {
            name: 'inject-fault',
            enforce: 'pre',
            transform(code, id) {
              if (!id.endsWith(injected.file)) return null
              return injected.prepend ? injected.code + code : code + injected.code
            },
          },
        ]
      : [],
  })
}

/** Selectors of what the page shows. */
export const SEL = {
  // The menu may have no tile yet: its version line marks it.
  version: '.menu .app-version',
  witness: '.menu .offline-witness',
  fallback: '#startup-fallback',
  errorBanner: '#error-banner',
}

/**
 * Serves `outDir` with `vite preview`. A fixed port with `strictPort` keeps the same origin from
 * one call to the next, hence the same service worker registration.
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function serve(outDir, port) {
  const server = await preview({
    configFile: CONFIG_FILE,
    root: ROOT,
    logLevel: 'warn',
    build: { outDir },
    preview: { port, strictPort: true, host: '127.0.0.1', open: false },
  })
  const url = server.resolvedUrls?.local[0]
  if (!url) throw new Error('vite preview did not report its address')
  return { url, close: () => server.close() }
}

/**
 * Waits until the page shows either the menu or the fallback screen.
 * @param {import('playwright').Page} page
 * @returns {Promise<'menu' | 'fallback'>}
 */
export async function startOutcome(page, timeout = 15000) {
  return Promise.any([
    page.locator(SEL.version).waitFor({ state: 'visible', timeout }).then(() => 'menu'),
    page.locator(SEL.fallback).waitFor({ state: 'visible', timeout }).then(() => 'fallback'),
  ]).catch(() => {
    throw new Error(`neither the menu nor the fallback screen showed within ${timeout} ms`)
  })
}

/** Text of the fallback screen, or null when it is not shown. */
export async function fallbackText(page) {
  const fallback = page.locator(SEL.fallback)
  return (await fallback.count()) > 0 ? fallback.innerText() : null
}

/** Version label shown on the menu, without the « Version » prefix. */
export async function menuVersion(page) {
  return (await page.locator(SEL.version).innerText()).replace(/^Version\s+/, '')
}
