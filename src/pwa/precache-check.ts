// [SPEC-3.1] [SPEC-10 V7] Shared between the service worker and the diagnostic page.

export const PRECACHE_CHECK_REQUEST = 'PRECACHE_CHECK'

export interface PrecacheReport {
  expected: number
  missing: string[]
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
