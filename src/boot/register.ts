import { registerSW } from 'virtual:pwa-register'
import { errorMessage } from '../errors'
import { checkOfflineCache } from '../pwa/precache-check'
import { pageIsOutdated, reportUpdateFailure, runUpdateCheck, type UpdateLookup } from './update'

export type SwRegistrationState =
  | { kind: 'unsupported' }
  | { kind: 'pending' }
  | { kind: 'registered'; scriptUrl: string; registration: ServiceWorkerRegistration | undefined }
  | { kind: 'error'; message: string }

let state: SwRegistrationState = 'serviceWorker' in navigator ? { kind: 'pending' } : { kind: 'unsupported' }
const listeners = new Set<() => void>()

export function getSwRegistrationState(): SwRegistrationState {
  return state
}

export function onSwRegistrationChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setState(next: SwRegistrationState): void {
  state = next
  for (const listener of listeners) listener()
}

/**
 * [SPEC-3.1] [SPEC-3.3] [SPEC-3.9.2] Registers the service worker and looks for a new version at
 * each launch. Called by the bootstrap before the app is loaded, so that an app that fails to
 * start still receives the next version.
 * A new version installs and takes control on its own (autoUpdate, see sw.ts); the page is not
 * reloaded here: `onNewVersion` hands that decision to the UpdateGate, which waits for the menu.
 */
export function registerServiceWorker(onNewVersion: () => void): void {
  if (state.kind === 'unsupported') return

  // A worker that takes over a page that already had one is a new version. The navigation may
  // have started the update before workbox-window listens, so its `activated` event alone is not
  // enough. The first worker of a page is a new version only if the page is older than it.
  let controlled = navigator.serviceWorker.controller !== null
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) onNewVersion()
    else checkFirstWorker(onNewVersion)
    controlled = true
  })

  registerSW({
    immediate: true,
    // Replaces the plugin's immediate reload [SPEC-3.3].
    onNeedReload: onNewVersion,
    onRegisteredSW: (scriptUrl, registration) => {
      // Set before the state, so that its listeners can already offer the button [SPEC-3.10.2].
      if (registration) updateLookup = lookupFor(scriptUrl, registration)
      setState({ kind: 'registered', scriptUrl, registration })
      void checkForUpdateNow(false)
    },
    onRegisterError: (error: unknown) => setState({ kind: 'error', message: errorMessage(error) }),
  })
}

/** [SPEC-3.3] A page loaded without a worker may come from Chrome's HTTP cache, older than the
 *  worker just installed from the network: it then reloads on the menu like any new version. */
function checkFirstWorker(onNewVersion: () => void): void {
  const entryScript = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? null
  checkOfflineCache().then(
    (report) => {
      if (pageIsOutdated(entryScript, report.urls)) onNewVersion()
    },
    (error: unknown) =>
      reportUpdateFailure(`impossible de comparer la page à la version téléchargée : ${errorMessage(error)}`),
  )
}

let updateLookup: UpdateLookup | undefined

/** [SPEC-3.10.2] True once the service worker is registered: a search for a new version can run. */
export function canCheckForUpdate(): boolean {
  return updateLookup !== undefined
}

/** [SPEC-3.3] [SPEC-3.6] [SPEC-3.10] Asks the server for a new version: once per launch, and when
 *  the adult clicks « Rechercher une mise à jour » (`manual`). A version found applies through the
 *  UpdateGate, never by a reload from here. */
export function checkForUpdateNow(manual: boolean): Promise<void> {
  return updateLookup ? runUpdateCheck(updateLookup, manual) : Promise.resolve()
}

function lookupFor(scriptUrl: string, registration: ServiceWorkerRegistration): UpdateLookup {
  return {
    update: () => registration.update(),
    installing: () => registration.installing,
    // Any HTTP answer proves the network is there; only a failed fetch means it is not.
    serverReachable: () => fetch(scriptUrl, { cache: 'no-store' }).then(
      () => true,
      () => false,
    ),
  }
}
