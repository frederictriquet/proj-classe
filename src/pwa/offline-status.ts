// [SPEC-3.7] [SPEC-3.8] Offline witness of the menu: says whether every file of the build is in
// the service worker cache, with the same check as the diagnostic page (checkOfflineCache).
import { errorMessage } from '../errors'
import { checkOfflineCache } from './precache-check'
import { getSwRegistrationState, onSwRegistrationChange } from './register'

export type OfflineStatus =
  /** Some files of the build are not in the cache yet. */
  | { kind: 'downloading' }
  /** Every file of the build is in the cache. */
  | { kind: 'ready' }
  /** No offline cache at all (development, no service worker, check failed). */
  | { kind: 'unavailable'; reason: string }

/** [SPEC-3.8] Shown when the adult clicks the witness. Word for word from the spec. */
export const OFFLINE_NOTICE =
  "Si les données de navigation de Chrome ont été effacées, ouvrez l'application une fois avec une connexion internet avant la classe."

/** [SPEC-3.7] Text of the witness. */
export function offlineLabel(status: OfflineStatus): string {
  switch (status.kind) {
    case 'ready':
      return 'Prête hors ligne'
    case 'downloading':
      return 'Téléchargement en cours'
    case 'unavailable':
      return `Hors ligne impossible : ${status.reason}`
  }
}

/** Last known state, so that a menu shown again does not flash « Téléchargement en cours ». */
let lastStatus: OfflineStatus = { kind: 'downloading' }

/** Calls `listener` with the witness state now, then whenever it changes, until disposed. */
export function watchOfflineStatus(listener: (status: OfflineStatus) => void): () => void {
  if (import.meta.env.DEV) {
    listener({ kind: 'unavailable', reason: 'pas de cache en mode développement (npm run dev)' })
    return () => {}
  }
  if (!('serviceWorker' in navigator)) {
    listener({ kind: 'unavailable', reason: 'service worker non pris en charge par ce navigateur' })
    return () => {}
  }

  let disposed = false
  let lastRun = 0
  const show = (status: OfflineStatus) => {
    lastStatus = status
    if (!disposed) listener(status)
  }
  const check = () => {
    const registration = getSwRegistrationState()
    if (registration.kind === 'error') {
      show({ kind: 'unavailable', reason: `le service worker n’a pas pu s’enregistrer : ${registration.message}` })
      return
    }
    // Only the latest check counts: an older one may answer last.
    const run = ++lastRun
    checkOfflineCache().then(
      (report) => {
        if (run === lastRun) show(report.missing.length === 0 ? { kind: 'ready' } : { kind: 'downloading' })
      },
      (error: unknown) => {
        if (run === lastRun) show({ kind: 'unavailable', reason: errorMessage(error) })
      },
    )
  }

  listener(lastStatus)
  check()
  // The download ends when the worker that holds it becomes active: `ready` resolves (first
  // install, awaited by the check above) or the page changes controller (new version).
  navigator.serviceWorker.addEventListener('controllerchange', check)
  const offRegistration = onSwRegistrationChange(check)
  return () => {
    disposed = true
    navigator.serviceWorker.removeEventListener('controllerchange', check)
    offRegistration()
  }
}
