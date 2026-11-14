/// <reference lib="webworker" />
import { cacheNames, clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, getCacheKeyForURL, precacheAndRoute } from 'workbox-precaching'
import { findMissing, type PrecacheReport, PRECACHE_CHECK_REQUEST } from './pwa/precache-check'

declare const self: ServiceWorkerGlobalScope

// [SPEC-3.1] Every file of the build is cached at install time; the app then runs without network.
const manifest = self.__WB_MANIFEST
precacheAndRoute(manifest)
cleanupOutdatedCaches()

// [SPEC-3.3] autoUpdate: a new worker takes over as soon as it is installed. The page reloads
// on it only when the menu shows with no app running (UpdateGate in src/pwa/update.ts).
void self.skipWaiting()
clientsClaim()

// Diagnostic page: report whether every precache entry is really present in the cache.
self.addEventListener('message', (event) => {
  if (event.data?.type !== PRECACHE_CHECK_REQUEST) return
  const port = event.ports[0]
  if (!port) return
  event.waitUntil(
    checkPrecache().then(
      (report) => port.postMessage(report),
      (error: unknown) => port.postMessage({ error: String(error) }),
    ),
  )
})

async function checkPrecache(): Promise<PrecacheReport> {
  // The plugin may list a file twice (manifest and its icons); count each URL once.
  const urls = [...new Set(manifest.map((entry) => new URL(typeof entry === 'string' ? entry : entry.url, self.registration.scope).href))]
  const expected = urls.map((url) => {
    const key = getCacheKeyForURL(url)
    if (!key) throw new Error(`No precache key for ${url}`)
    return { url, key }
  })
  const cache = await caches.open(cacheNames.precache)
  const cachedKeys = (await cache.keys()).map((request) => request.url)
  const missing = findMissing(
    expected.map((e) => e.key),
    cachedKeys,
  )
  const missingUrls = expected.filter((e) => missing.includes(e.key)).map((e) => e.url)
  return { expected: expected.length, missing: missingUrls }
}
