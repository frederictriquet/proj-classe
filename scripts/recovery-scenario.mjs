// [SPEC-3.9.3] [SPEC-3.9.4] [SPEC-3.9.5] Recovery scenario, run by hand (`npm run test:recovery`),
// never on GitHub Pages: a faulty version installed on the Mac recovers once a fixed version is
// published. Each version is copied in turn into the directory served by `vite preview`, at the
// same address; a launch opens the browser on a persistent profile and closes it afterwards, like
// the teacher opening and quitting the installed app.
//
// Scenario A: v1 healthy, v2 fails to start (app module), v3 healthy (a revert of v2).
// Scenario B: v1 healthy, v2 whose bootstrap itself fails, v3 healthy: only Chrome's own check of
// the service worker script at each navigation can bring v3.
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { buildVariant, SEL, serve } from './pwa-harness.mjs'

const PORT = Number(process.env.RECOVERY_PORT ?? 4181)
const work = await mkdtemp(join(tmpdir(), 'proj-classe-recovery-'))
const served = join(work, 'served')
let server
let failed = false

function expect(ok, message) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${message}`)
  if (!ok) failed = true
}

async function publish(build) {
  await rm(served, { recursive: true, force: true })
  await cp(build, served, { recursive: true })
}

async function networkOn() {
  server ??= await serve(served, PORT)
}

async function networkOff() {
  await server?.close()
  server = undefined
}

/** What the page shows now: `menu <version>`, `fallback <version>`, or `blank`. */
async function screen(page) {
  try {
    return await page.evaluate(
      ([fallbackSel, versionSel]) => {
        const fallback = document.querySelector(fallbackSel)
        if (fallback) return `fallback ${/Version : (.*)/.exec(fallback.innerText)?.[1] ?? fallback.innerText}`
        const version = document.querySelector(versionSel)
        return version ? `menu ${version.textContent?.replace(/^Version\s+/, '')}` : 'blank'
      },
      [SEL.fallback, SEL.version],
    )
  } catch {
    return 'navigating'
  }
}

/**
 * Opens the app on the profile, records every screen it goes through until `until(screen)` holds
 * or `timeoutMs` elapses, then quits the browser.
 */
async function launch(profile, name, { until, timeoutMs = 20000, settleMs = 0 } = {}) {
  const context = await chromium.launchPersistentContext(profile, { headless: true })
  const page = context.pages()[0] ?? (await context.newPage())
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  let loads = 0
  page.on('load', () => loads++)
  const seen = []
  const fallbackTexts = new Set()
  const started = Date.now()
  let reached = false
  try {
    await page.goto(`http://127.0.0.1:${PORT}/proj-classe/`).catch((error) => seen.push(`navigation failed: ${error.message.split('\n')[0]}`))
    while (Date.now() - started < timeoutMs) {
      const now = await screen(page)
      if (now !== seen.at(-1)) seen.push(now)
      if (now.startsWith('fallback')) fallbackTexts.add(await page.locator(SEL.fallback).innerText().catch(() => ''))
      if (until?.(now)) {
        reached = true
        break
      }
      await page.waitForTimeout(200)
    }
    if (settleMs) {
      await page.waitForTimeout(settleMs)
      const now = await screen(page)
      if (now !== seen.at(-1)) seen.push(now)
    }
    const ready = await page
      .locator(`${SEL.witness}[data-state="ready"]`)
      .count()
      .catch(() => 0)
    const final = seen.at(-1)
    console.log(`  ${name}: ${seen.join(' -> ')} (page loads: ${loads}${ready ? ', « Prête hors ligne »' : ''})`)
    for (const text of fallbackTexts) console.log(`    fallback screen: ${JSON.stringify(text)}`)
    if (errors.length) console.log(`    uncaught errors: ${errors.join(' | ')}`)
    return { seen, final, reached, fallbackTexts: [...fallbackTexts] }
  } finally {
    await context.close()
  }
}

/** Launches until the menu shows `version`, at most `max` times. Returns the number of launches. */
async function launchesUntilMenu(profile, version, max = 3) {
  for (let n = 1; n <= max; n++) {
    const result = await launch(profile, `launch ${n} after publishing`, { until: (s) => s === `menu ${version}` })
    if (result.reached) return n
  }
  return Infinity
}

const label = (commit) => `${process.env.npm_package_version ?? ''} (${commit})`.trim()
const INSTRUCTION = "L'application a rencontré un problème. Connectez le Mac à internet puis relancez-la."

try {
  console.log(`Working directory: ${work}`)
  const builds = {
    v1: join(work, 'v1'),
    v2app: join(work, 'v2-app'),
    v2boot: join(work, 'v2-boot'),
    v3: join(work, 'v3'),
  }
  console.log('Building v1, v2 (app fault), v2 (bootstrap fault), v3...')
  await buildVariant(builds.v1, 'v1')
  await buildVariant(builds.v2app, 'v2', 'app')
  await buildVariant(builds.v2boot, 'v2-boot', 'boot')
  await buildVariant(builds.v3, 'v3')
  await mkdir(served, { recursive: true })

  // ---- Scenario A ----
  console.log('\nScenario A: v1 healthy, v2 fails to start, v3 healthy')
  const profileA = join(work, 'profile-a')
  await publish(builds.v1)
  await networkOn()
  console.log('Publish v1')
  const a1 = await launch(profileA, 'launch', {
    until: (s) => s === `menu ${label('v1')}`,
    settleMs: 3000,
  })
  expect(a1.final === `menu ${label('v1')}`, 'v1 shows the menu')

  console.log('Publish v2 (fails to start)')
  await publish(builds.v2app)
  const a2 = await launch(profileA, 'launch', { until: (s) => s === `fallback ${label('v2')}` })
  expect(a2.reached, 'v2 is taken at this launch and shows the fallback screen')
  const a3 = await launch(profileA, 'relaunch', { timeoutMs: 6000 })
  expect(a3.final === `fallback ${label('v2')}`, 'relaunched, v2 shows the fallback screen again')
  expect(a3.fallbackTexts.some((t) => t.includes(INSTRUCTION) && t.includes(`Version : ${label('v2')}`)), 'the fallback screen shows the instruction word for word and the version')

  await networkOff()
  const a4 = await launch(profileA, 'relaunch without network', { timeoutMs: 6000 })
  expect(a4.final === `fallback ${label('v2')}`, 'without network, v2 stays in place [SPEC-3.9.5]')
  await networkOn()

  console.log('Publish v3 (healthy, like a revert of v2)')
  await publish(builds.v3)
  const nA = await launchesUntilMenu(profileA, label('v3'))
  expect(nA === 1, `the menu is back in v3 after ${nA} launch(es)`)

  await networkOff()
  const a5 = await launch(profileA, 'relaunch without network', {
    until: (s) => s === `menu ${label('v3')}`,
    timeoutMs: 10000,
  })
  expect(a5.reached, 'without network, v3 starts from the cache')
  await networkOn()

  // ---- Scenario B ----
  console.log('\nScenario B: v1 healthy, v2 with a failing bootstrap, v3 healthy')
  const profileB = join(work, 'profile-b')
  await publish(builds.v1)
  console.log('Publish v1')
  const b1 = await launch(profileB, 'launch', { until: (s) => s === `menu ${label('v1')}`, settleMs: 3000 })
  expect(b1.final === `menu ${label('v1')}`, 'v1 shows the menu')
  console.log('Publish v2 (bootstrap fails)')
  await publish(builds.v2boot)
  const b2 = await launch(profileB, 'launch', { timeoutMs: 8000 })
  expect(b2.final === 'blank', 'v2 is taken and shows a blank page (no bootstrap, no fallback screen)')
  console.log('Publish v3 (healthy)')
  await publish(builds.v3)
  const nB = await launchesUntilMenu(profileB, label('v3'))
  expect(Number.isFinite(nB), `the menu is back in v3 after ${nB} launch(es), with no page code looking for it`)
} finally {
  await networkOff()
  await rm(work, { recursive: true, force: true })
}

if (failed) {
  console.error('\nRecovery scenario failed.')
  process.exitCode = 1
} else {
  console.log('\nRecovery scenario passed.')
}
