import './style.css'
import { listenForInstallPrompt } from './pwa/install'
import { errorMessage, registerServiceWorker } from './pwa/register'
import { requestPersistentStorage } from './pwa/storage'

// Any uncaught error is shown on screen, not only in the console.
const banner = document.getElementById('error-banner')
function showError(error: unknown): void {
  if (!banner) return
  banner.textContent = `Erreur : ${errorMessage(error)}`
  banner.hidden = false
}
window.addEventListener('error', (event) => showError(event.error ?? event.message))
window.addEventListener('unhandledrejection', (event) => showError(event.reason))

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
  else next = (await import('./home')).renderHome(appRoot)
  if (id !== renderId) next()
  else dispose = next
}

window.addEventListener('hashchange', () => void route().catch(showError))
route().catch(showError)
