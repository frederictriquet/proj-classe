import { registerSW } from 'virtual:pwa-register'

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

/** [SPEC-3.1] [SPEC-3.3] Registers the service worker; new versions apply on their own (autoUpdate). */
export function registerServiceWorker(): void {
  if (state.kind === 'unsupported') return
  registerSW({
    immediate: true,
    onRegisteredSW: (scriptUrl, registration) => setState({ kind: 'registered', scriptUrl, registration }),
    onRegisterError: (error: unknown) => setState({ kind: 'error', message: errorMessage(error) }),
  })
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name} : ${error.message}`
  return String(error)
}
