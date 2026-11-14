// [SPEC-3.9.2] Bootstrap, the entry script of index.html. It registers the service worker and
// handles new versions before the rest of the app is loaded, and imports nothing from it at run
// time (checked by boot-deps.test.ts): an app that fails to start still receives the next version.
// It then loads the app with a dynamic import() and watches its start [SPEC-3.9.3].
import { listenForInstallPrompt } from '../pwa/install'
import { VERSION_LABEL } from '../version'
import { showFallbackScreen } from './fallback'
import { registerServiceWorker } from './register'
import { SCENE_HASH } from './scene-hash'
import { watchStartup } from './startup'
import { UpdateGate } from './update'

// [SPEC-3.3] A new version reloads the page only on the menu, with no app running: the app
// reports both through the gate.
const updates = new UpdateGate(() => location.reload())

// [SPEC-3.1] [SPEC-3.3] The scene window does not register the service worker: an update never
// reloads it during an app. Its gate never receives a version.
if (!location.hash.startsWith(SCENE_HASH)) {
  registerServiceWorker(() => updates.newVersion())
  // [SPEC-3.5] Listened to before the load event, which the app loaded below may miss.
  listenForInstallPrompt()
}

watchStartup(
  () => import('../main').then((app) => app.startApp({ updates })),
  window,
  (error) => {
    // Also in the console, where the start-up test reads it [SPEC-3.9.1].
    console.error('Proj-Classe did not start:', error)
    showFallbackScreen(VERSION_LABEL, error)
    updates.startupFailed()
  },
)
