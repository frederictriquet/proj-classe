import { registerSW } from 'virtual:pwa-register'
import { errorMessage } from '../errors'
import { lookForUpdate, reportUpdateFailure } from './update'

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
 * [SPEC-3.1] [SPEC-3.3] Registers the service worker and looks for a new version at each launch.
 * A new version installs and takes control on its own (autoUpdate, see sw.ts); the page is not
 * reloaded here: `onNewVersion` hands that decision to the UpdateGate, which waits for the menu.
 */
export function registerServiceWorker(onNewVersion: () => void): void {
  if (state.kind === 'unsupported') return

  // A worker that takes over a page that already had one is a new version. The navigation may
  // have started the update before workbox-window listens, so its `activated` event alone is not
  // enough. The first install also changes controller, but the page had none before.
  let controlled = navigator.serviceWorker.controller !== null
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) onNewVersion()
    controlled = true
  })

  registerSW({
    immediate: true,
    // Replaces the plugin's immediate reload [SPEC-3.3].
    onNeedReload: onNewVersion,
    onRegisteredSW: (scriptUrl, registration) => {
      setState({ kind: 'registered', scriptUrl, registration })
      if (registration) checkForUpdate(scriptUrl, registration)
    },
    onRegisterError: (error: unknown) => setState({ kind: 'error', message: errorMessage(error) }),
  })
}

/** [SPEC-3.3] [SPEC-3.6] Asks the server for a new version once per launch and reports any
 *  failure other than the absence of network. */
function checkForUpdate(scriptUrl: string, registration: ServiceWorkerRegistration): void {
  lookForUpdate({
    update: () => registration.update(),
    installing: () => registration.installing,
    // Any HTTP answer proves the network is there; only a failed fetch means it is not.
    serverReachable: () => fetch(scriptUrl, { cache: 'no-store' }).then(
      () => true,
      () => false,
    ),
  }).then(
    (cause) => {
      if (cause) reportUpdateFailure(cause)
    },
    (error: unknown) => reportUpdateFailure(errorMessage(error)),
  )
}
