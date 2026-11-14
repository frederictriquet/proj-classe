import './style.css'
import { APP_REGISTRY } from './apps/registry'
import { errorMessage } from './errors'
import { FullscreenDisplay } from './host/fullscreen-display'
import { AppHost } from './host/host'
import { checkNeeds } from './host/needs'
import type { HostCommand, HostState } from './host/protocol'
import { listenForInstallPrompt } from './pwa/install'
import { registerServiceWorker } from './pwa/register'
import { requestPersistentStorage } from './pwa/storage'
import { SettingsStore } from './settings/settings'

// Any uncaught error is shown on screen, not only in the console.
const banner = document.getElementById('error-banner')
function showError(error: unknown): void {
  if (!banner) return
  banner.textContent = `Erreur : ${errorMessage(error)}`
  banner.hidden = false
}

// [SPEC-5.2] Single-screen mode: the menu and the running app share this window.
const settings = new SettingsStore(localStorage, (message) => showError(message))
const display = new FullscreenDisplay(() => host.dispatch({ type: 'stop' }))
const host = new AppHost({ registry: APP_REGISTRY, settings, display, checkNeeds })

// [SPEC-4.8] While an app runs, an uncaught error is its own: the host stops it and the menu
// shows the message. Otherwise the error goes to the banner.
function onUncaught(error: unknown): void {
  if (!host.fail(error)) showError(error)
}
window.addEventListener('error', (event) => onUncaught(event.error ?? event.message))
window.addEventListener('unhandledrejection', (event) => onUncaught(event.reason))

if (import.meta.env.DEV) {
  // Development hook: sends commands the way the control window will with two screens [SPEC-5.5].
  ;(window as unknown as { __projClasse: unknown }).__projClasse = {
    dispatch: (command: HostCommand) => host.dispatch(command),
    state: (): HostState => host.state,
  }
}

registerServiceWorker() // [SPEC-3.1]
listenForInstallPrompt() // [SPEC-3.5]
void requestPersistentStorage() // [SPEC-3.2]

const root = document.getElementById('app')
if (!root) throw new Error('#app element missing')
const appRoot: HTMLElement = root

let dispose: (() => void) | undefined
let renderId = 0

async function route(): Promise<void> {
  const id = ++renderId
  dispose?.()
  dispose = undefined
  const hash = location.hash
  let next: () => void
  // Views are loaded on demand so that PixiJS is not part of the start-up bundle.
  if (hash === '#diagnostic') next = (await import('./diagnostic/diagnostic')).renderDiagnostic(appRoot)
  else if (hash === '#scene-test') next = (await import('./diagnostic/scene-test')).renderSceneTest(appRoot)
  else next = (await import('./menu/menu')).renderMenu(appRoot, APP_REGISTRY, host)
  if (id !== renderId) next()
  else dispose = next
}

window.addEventListener('hashchange', () => void route().catch(showError))
route().catch(showError)
