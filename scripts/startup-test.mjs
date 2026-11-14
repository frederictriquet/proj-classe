// [SPEC-3.9.1] Start-up test, run by the deployment workflow after the build and before the
// publication: serves the build with `vite preview` and opens it in headless Chromium, with a
// fresh profile. Exits with a non-zero code when one check fails, which stops the publication.
// Usage: node scripts/startup-test.mjs [build directory, default dist]
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { fallbackText, menuVersion, ROOT, SEL, serve, startOutcome } from './pwa-harness.mjs'

const outDir = resolve(ROOT, process.argv[2] ?? 'dist')
const PORT = Number(process.env.STARTUP_TEST_PORT ?? 4179)

const failures = []
function check(name, ok, detail) {
  if (!ok) failures.push(name)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`)
}

/** Resolves true when `promise` settles before `timeout`, false otherwise. */
const within = (promise) => promise.then(
  () => true,
  () => false,
)

console.log(`Start-up test of ${outDir}`)
const server = await serve(outDir, PORT)
let serverOpen = true
const browser = await chromium.launch()
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') console.log(`     console.error: ${message.text()}`)
  })

  await page.goto(server.url)
  const outcome = await startOutcome(page).catch((error) => error.message)
  const fallback = outcome === 'fallback' ? await fallbackText(page) : null
  check('the menu shows', outcome === 'menu', outcome === 'menu' ? `version ${await menuVersion(page)}` : (fallback ?? outcome))

  if (outcome === 'menu') {
    const controlled = await within(
      page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 }),
    )
    check('the service worker registers and controls the page', controlled)

    // Same check as the diagnostic page and the menu's witness [SPEC-3.7].
    const cached = await within(page.locator(`${SEL.witness}[data-state="ready"]`).waitFor({ timeout: 30000 }))
    check('the cache is complete (« Prête hors ligne »)', cached, cached ? undefined : await page.locator(SEL.witness).innerText())

    if (controlled && cached) {
      // Network cut: the server is gone and the browser is offline.
      await server.close()
      serverOpen = false
      await context.setOffline(true)
      await page.reload()
      const offline = await startOutcome(page).catch((error) => error.message)
      check('the page reloads with the network cut', offline === 'menu', offline === 'menu' ? undefined : ((await fallbackText(page)) ?? offline))
    }
    check('no error banner', await page.locator(SEL.errorBanner).isHidden(), await page.locator(SEL.errorBanner).innerText())
  }
  check('no uncaught error', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser.close()
  if (serverOpen) await server.close()
}

if (failures.length > 0) {
  console.error(`Start-up test failed: ${failures.length} check(s) failed.`)
  process.exitCode = 1
} else {
  console.log('Start-up test passed.')
}
