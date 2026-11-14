// [SPEC-3.1] [SPEC-3.7] [SPEC-10 V7] Shared between the service worker, the diagnostic page and
// the offline witness of the menu.

export const PRECACHE_CHECK_REQUEST = 'PRECACHE_CHECK'

export interface PrecacheReport {
  expected: number
  missing: string[]
  /** Every URL of the worker's precache manifest, cached or not. */
  urls: string[]
}

/** Cache keys expected by the precache manifest that are absent from the cache. */
export function findMissing(expectedKeys: readonly string[], cachedKeys: readonly string[]): string[] {
  const cached = new Set(cachedKeys)
  return expectedKeys.filter((key) => !cached.has(key))
}

/** Asks the active service worker for its precache report. */
export function requestPrecacheReport(worker: ServiceWorker, timeoutMs = 5000): Promise<PrecacheReport> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => reject(new Error('Le service worker ne répond pas.')), timeoutMs)
    channel.port1.onmessage = (event: MessageEvent<PrecacheReport | { error: string }>) => {
      clearTimeout(timer)
      const data = event.data
      if ('error' in data) reject(new Error(data.error))
      else resolve(data)
    }
    worker.postMessage({ type: PRECACHE_CHECK_REQUEST }, [channel.port2])
  })
}

/** [SPEC-3.7] [SPEC-10 V7] Precache report of the active service worker, once there is one: the
 *  single cache check used by the diagnostic page and by the menu. */
export async function checkOfflineCache(): Promise<PrecacheReport> {
  const registration = await navigator.serviceWorker.ready
  if (!registration.active) throw new Error('Aucun service worker actif.')
  return requestPrecacheReport(registration.active)
}
